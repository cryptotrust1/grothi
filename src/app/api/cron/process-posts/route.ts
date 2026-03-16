/**
 * POST /api/cron/process-posts
 *
 * Background worker that processes scheduled posts.
 * Called by an external cron job (e.g., every minute via PM2 cron or system crontab).
 *
 * Flow per post:
 * 1. Find SCHEDULED posts with scheduledAt <= now
 * 2. Mark as PUBLISHING
 * 3. For each target platform, get connection + decrypt credentials
 * 4. Call the platform-specific posting function
 * 5. Record BotActivity + update ScheduledPost status
 * 6. Deduct credits (if not already deducted for "Post Now")
 *
 * Security: Protected by CRON_SECRET header to prevent unauthorized calls.
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateCronSecret } from '@/lib/api-helpers';
import { withCronLock } from '@/lib/cron-lock';
import { db } from '@/lib/db';
import { deductCredits, getActionCost, hasEnoughCredits, addCredits } from '@/lib/credits';
import {
  decryptFacebookCredentials,
  postText,
  postWithImage,
  postWithVideo as fbPostWithVideo,
  postReel as fbPostReel,
  type FacebookPostResult,
} from '@/lib/facebook';
import {
  decryptInstagramCredentials,
  postImage as igPostImage,
  postReel as igPostReel,
  postStory as igPostStory,
  postCarousel as igPostCarousel,
  postLocalImage as igPostLocalImage,
  isTokenNearExpiry as igIsTokenNearExpiry,
  debugToken as igDebugToken,
  type InstagramPostResult,
} from '@/lib/instagram';
import {
  decryptThreadsCredentials,
  postText as threadsPostText,
  postWithImage as threadsPostWithImage,
  postWithVideo as threadsPostWithVideo,
  postCarousel as threadsPostCarousel,
  isTokenNearExpiry,
  type ThreadsPostResult,
} from '@/lib/threads';
import { processEngagementFeedback } from '@/lib/rl-engine';
import { PLATFORM_NAMES } from '@/lib/constants';
import type { PlatformType, PlatformConnection } from '@prisma/client';
import path from 'path';
import { existsSync, mkdirSync } from 'fs';
import sharp from 'sharp';

// Allow up to 5 minutes for processing a batch of posts (up to 10 posts × multiple platforms)
export const maxDuration = 300;

/** Base directory for uploaded media files. */
const UPLOAD_DIR = path.join(process.cwd(), 'data', 'uploads');

/**
 * Direct media URL base for Meta platforms (Instagram, Threads, Facebook).
 * When set (e.g., "https://grothi.com/media"), media files are served
 * directly by Nginx from disk, bypassing the Next.js API route.
 * IMPORTANT: Meta's infrastructure requires HTTPS + domain name + standard port (443).
 * Raw IP addresses and non-standard ports (e.g., http://IP:8787) are blocked by Meta.
 * The /media/ location in nginx-grothi.conf serves from data/uploads/ with gzip off.
 */
const MEDIA_DIRECT_BASE = process.env.MEDIA_DIRECT_BASE;

/** Max posts to process per invocation (prevents long-running requests). */
const BATCH_SIZE = 10;

/**
 * MIME types that require conversion to JPEG before posting to Instagram.
 * Instagram officially recommends sRGB JPEG. While PNG is sometimes accepted,
 * AI-generated PNGs (with alpha channels, unusual color profiles, or non-sRGB
 * color spaces) frequently fail with error 9004 "Only photo or video can be
 * accepted as media type". Converting to JPEG eliminates these issues.
 */
const IG_CONVERT_TO_JPEG_MIMES = ['image/png', 'image/webp', 'image/avif', 'image/gif'];

/**
 * Convert a non-JPEG image to JPEG for Instagram compatibility.
 *
 * Instagram's Container API downloads images from a URL. If the image is a PNG
 * with an alpha channel, unusual color profile, or AI-generated metadata,
 * Instagram often rejects it with error 9004. Converting to JPEG (flattening
 * alpha to white, forcing sRGB, stripping metadata) fixes these issues.
 *
 * The converted file is saved alongside the original (with -ig.jpg suffix).
 * Returns the new file path relative to UPLOAD_DIR, or null on failure.
 */
async function convertToJpegForInstagram(
  originalFilePath: string,
  mimeType: string
): Promise<string | null> {
  if (!IG_CONVERT_TO_JPEG_MIMES.includes(mimeType.toLowerCase())) {
    return null; // Already JPEG or unsupported — no conversion needed
  }

  const absOriginal = path.resolve(path.join(UPLOAD_DIR, originalFilePath));
  if (!existsSync(absOriginal)) {
    console.error(`[process-posts] convertToJpeg: source file not found: ${absOriginal}`);
    return null;
  }

  // Construct the JPEG path: same directory, same name but with -ig.jpg suffix
  const dir = path.dirname(absOriginal);
  const ext = path.extname(absOriginal);
  const baseName = path.basename(absOriginal, ext);
  const jpegPath = path.join(dir, `${baseName}-ig.jpg`);
  const relJpegPath = path.relative(UPLOAD_DIR, jpegPath);

  // Skip conversion if already exists (cached from previous attempt)
  if (existsSync(jpegPath)) {
    console.log(`[process-posts] convertToJpeg: using cached JPEG: ${relJpegPath}`);
    return relJpegPath;
  }

  try {
    await sharp(absOriginal)
      // Flatten alpha channel to white background (Instagram doesn't support transparency)
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      // Force sRGB color space (Instagram requirement)
      .toColorspace('srgb')
      // Remove metadata (EXIF, ICC profiles that might confuse Instagram)
      .withMetadata({ orientation: undefined })
      // Convert to JPEG with quality 92 (high quality, reasonable file size)
      .jpeg({ quality: 92, mozjpeg: true })
      .toFile(jpegPath);

    console.log(`[process-posts] convertToJpeg: converted ${originalFilePath} → ${relJpegPath}`);
    return relJpegPath;
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error(`[process-posts] convertToJpeg: failed to convert ${originalFilePath}: ${msg}`);
    return null;
  }
}

export async function POST(request: NextRequest) {
  // Verify cron secret
  const cronError = validateCronSecret(request.headers.get('authorization'));
  if (cronError) return cronError;

  // Prevent overlapping execution — if previous run is still going, skip this one
  const result = await withCronLock('process-posts', () => processPostsBatch(), 5 * 60 * 1000);
  if (result === null) {
    return NextResponse.json({ skipped: true, message: 'Previous process-posts run still in progress' });
  }
  return result;
}

async function processPostsBatch(): Promise<NextResponse> {
  const now = new Date();

  // Recovery: Find posts stuck in PUBLISHING state for more than 5 minutes.
  // This happens when the process crashes or times out during publishing.
  // Reset them to FAILED so they don't block the queue forever.
  // 3 minutes: longer than the 2-minute platform timeout but short enough
  // to prevent double-posting if cron crashes mid-publish (runs every 1 min)
  const stuckThreshold = new Date(now.getTime() - 3 * 60 * 1000);
  try {
    const stuckPosts = await db.scheduledPost.updateMany({
      where: {
        status: 'PUBLISHING',
        updatedAt: { lt: stuckThreshold },
      },
      data: {
        status: 'FAILED',
        error: 'Publishing timed out — the server took longer than 5 minutes and was interrupted. Some platforms may have published successfully. Check your social media accounts before retrying to avoid duplicate posts.',
      },
    });
    if (stuckPosts.count > 0) {
      console.warn(`[process-posts] Recovered ${stuckPosts.count} stuck PUBLISHING post(s) → FAILED`);
    }
  } catch (e) {
    // Don't let recovery failure block normal processing
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error(`[process-posts] Stuck post recovery failed: ${msg}`);
  }

  // Atomically claim posts for processing to prevent race conditions.
  // First, update BATCH_SIZE posts from SCHEDULED to PUBLISHING.
  // This ensures that even if multiple cron instances run simultaneously,
  // each post is processed by only one instance.
  const claimResult = await db.$transaction(async (tx) => {
    // Find candidate posts
    const candidates = await tx.scheduledPost.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledAt: { lte: now },
      },
      orderBy: { scheduledAt: 'asc' },
      take: BATCH_SIZE,
      select: { id: true },
    });

    if (candidates.length === 0) {
      return [];
    }

    // Atomically update them to PUBLISHING
    await tx.scheduledPost.updateMany({
      where: {
        id: { in: candidates.map(c => c.id) },
        status: 'SCHEDULED', // Extra safety: only update if still SCHEDULED
      },
      data: { status: 'PUBLISHING' },
    });

    // Return the claimed IDs
    return candidates.map(c => c.id);
  });

  if (claimResult.length === 0) {
    return NextResponse.json({ processed: 0, message: 'No posts due' });
  }

  // Fetch full data for the claimed posts
  const duePosts = await db.scheduledPost.findMany({
    where: { id: { in: claimResult } },
    include: {
      bot: { select: { id: true, userId: true, name: true, status: true } },
      media: { select: { id: true, filePath: true, type: true, mimeType: true } },
    },
  });

  const results: Array<{
    postId: string;
    status: string;
    platforms: Record<string, { success: boolean; externalId?: string; error?: string }>;
  }> = [];

  for (const post of duePosts) {
    // Skip posts for non-active bots
    if (post.bot.status !== 'ACTIVE') {
      await db.scheduledPost.update({
        where: { id: post.id },
        data: {
          status: 'FAILED',
          error: `Bot "${post.bot.name}" is currently ${post.bot.status.toLowerCase()}. Go to Bot Settings and set the status to Active before publishing.`,
        },
      });
      results.push({ postId: post.id, status: 'FAILED', platforms: {} });
      continue;
    }

    // Guard: Never publish posts with placeholder content (autopilot posts waiting for AI generation)
    if (post.content.startsWith('[AUTOPILOT]') || post.content.startsWith('[GENERATING]')) {
      await db.scheduledPost.update({
        where: { id: post.id },
        data: {
          status: 'SCHEDULED',
          error: 'Content not yet generated by AI. Re-queued for next cycle.',
          scheduledAt: new Date(Date.now() + 5 * 60 * 1000), // Retry in 5 minutes
        },
      });
      results.push({ postId: post.id, status: 'REQUEUED', platforms: {} });
      continue;
    }

    const allPlatforms = (Array.isArray(post.platforms) ? post.platforms : []) as string[];

    // On retry, skip platforms that already succeeded to avoid duplicate posts.
    // publishResults stores the outcome from the previous attempt.
    const existingResults = post.publishResults as Record<string, { success: boolean; externalId?: string; error?: string }> | null;
    const platforms = existingResults
      ? allPlatforms.filter(p => !existingResults[p]?.success)
      : allPlatforms;

    const platformResults: Record<string, { success: boolean; externalId?: string; error?: string }> = {};
    let allSucceeded = true;
    // If some platforms already succeeded in a previous attempt, count them
    let anySucceeded = existingResults
      ? Object.values(existingResults).some(r => r.success)
      : false;

    for (const platform of platforms) {
      let platformCreditsDeducted = false;
      try {
        // Deduct credits BEFORE posting to prevent race conditions
        // If posting fails, we'll refund the credits
        const cost = await getActionCost('POST');
        const deducted = await deductCredits(post.bot.userId, cost, `Post to ${platform}`, post.botId);

        if (!deducted) {
          const platformName = PLATFORM_NAMES[platform] || platform;
          platformResults[platform] = {
            success: false,
            error: `Not enough credits to post to ${platformName} (${cost} credits required). Purchase more credits in Dashboard → Credits → Buy.`,
          };
          allSucceeded = false;
          continue;
        }
        platformCreditsDeducted = true;

        // Resolve per-platform content/media overrides
        const overrides = (post.platformContent as Record<string, { content?: string; mediaId?: string }> | null)?.[platform];
        const platformSpecificContent = overrides?.content || post.content;

        // If this platform has a media override, resolve it
        let effectiveMediaPath = post.media?.filePath || null;
        let effectiveMediaType = (post.media?.type as 'IMAGE' | 'VIDEO' | 'GIF' | null) || null;
        let effectiveMediaMime = post.media?.mimeType || null;
        let effectiveMediaId = post.media?.id || null;

        if (overrides?.mediaId && overrides.mediaId !== post.media?.id) {
          const overrideMedia = await db.media.findFirst({
            where: { id: overrides.mediaId, botId: post.botId },
            select: { id: true, filePath: true, type: true, mimeType: true },
          });
          if (overrideMedia) {
            effectiveMediaPath = overrideMedia.filePath;
            effectiveMediaType = overrideMedia.type as 'IMAGE' | 'VIDEO' | 'GIF';
            effectiveMediaMime = overrideMedia.mimeType;
            effectiveMediaId = overrideMedia.id;
          }
        }

        // Platform API timeout: 2 minutes max per platform publish
        const PLATFORM_TIMEOUT_MS = 120_000;
        const result = await Promise.race([
          publishToPlatform(
            platform as PlatformType,
            post.botId,
            platformSpecificContent,
            effectiveMediaPath,
            effectiveMediaType,
            effectiveMediaMime,
            effectiveMediaId,
            (post.postType as 'feed' | 'reel' | 'story' | 'carousel' | null) || null,
            (post.mediaIds as string[] | null) || null
          ),
          new Promise<{ success: false; error: string }>((_, reject) =>
            setTimeout(() => reject(new Error(`Platform API timeout after ${PLATFORM_TIMEOUT_MS / 1000}s`)), PLATFORM_TIMEOUT_MS)
          ).catch(err => ({ success: false as const, error: err instanceof Error ? err.message : 'Timeout' })),
        ]);

        platformResults[platform] = result;

        if (result.success) {
          anySucceeded = true;
        } else {
          // Refund credits if posting failed
          await addCredits(post.bot.userId, cost, 'REFUND', `Refund for failed post to ${platform}`);
          allSucceeded = false;
        }

        // Record activity
        const activityCost = result.success ? cost : 0;
        await db.botActivity.create({
          data: {
            botId: post.botId,
            platform: platform as PlatformType,
            action: 'POST',
            content: platformSpecificContent.slice(0, 500),
            postId: result.externalId || null,
            contentType: post.contentType || 'custom',
            success: result.success,
            error: result.error || null,
            creditsUsed: activityCost,
          },
        });

        // Create PostEngagement record AND trigger immediate RL learning.
        // This ensures learning starts from the very first post, not just
        // after engagement collection. Content fingerprinting (tone, type,
        // hashtags, time slot) is recorded immediately for the RL engine.
        // Even zero-engagement posts provide valuable signal about what
        // content/timing combinations the bot is using.
        if (result.success) {
          try {
            const pe = await db.postEngagement.create({
              data: {
                botId: post.botId,
                platform: platform as PlatformType,
                scheduledPostId: post.id,
                externalPostId: result.externalId || undefined,
                contentType: post.contentType || 'custom',
                timeSlot: now.getHours(),
                dayOfWeek: now.getDay(),
                toneStyle: post.toneStyle || undefined,
                hashtagPattern: post.hashtagPattern || undefined,
                postedAt: now,
              },
            });

            // Immediately trigger RL learning with initial (zero) engagement.
            // The content dimensions (type, tone, time, hashtags) are recorded
            // so the RL engine starts building arm statistics from post #1.
            // When engagement is collected later, processEngagementFeedback
            // will update the reward with actual metrics.
            try {
              await processEngagementFeedback(pe.id);
            } catch {
              // Non-fatal: engagement collection will retry later
            }
          } catch (peError) {
            // Don't fail the post if engagement tracking fails
            const peMsg = peError instanceof Error ? peError.message : 'Unknown';
            console.error(`[process-posts] PostEngagement creation failed: ${peMsg}`);
          }
        }

        // Update connection last post time
        if (result.success) {
          await db.platformConnection.updateMany({
            where: { botId: post.botId, platform: platform as PlatformType },
            data: {
              lastPostAt: now,
              postsToday: { increment: 1 },
              lastError: null,
            },
          });
        } else if (result.error) {
          await db.platformConnection.updateMany({
            where: { botId: post.botId, platform: platform as PlatformType },
            data: { lastError: result.error.slice(0, 500) },
          });
        }
      } catch (error) {
        // Catch unexpected errors per platform so other platforms still get processed
        const msg = error instanceof Error ? error.message : 'Unknown error';
        const platformName = PLATFORM_NAMES[platform] || platform;
        console.error(`[process-posts] Platform ${platform} failed for post ${post.id}:`, msg);
        platformResults[platform] = {
          success: false,
          error: `${platformName} publishing failed unexpectedly: ${msg.slice(0, 400)}. If this keeps happening, try reconnecting ${platformName} in Platforms settings.`,
        };
        allSucceeded = false;

        // Refund credits only if they were actually deducted before the error
        if (platformCreditsDeducted) try {
          const cost = await getActionCost('POST');
          await addCredits(post.bot.userId, cost, 'REFUND', `Refund for failed ${platformName} post (error)`);
        } catch (refundErr) {
          console.error(`[process-posts] Credit refund failed for ${platform}:`,
            refundErr instanceof Error ? refundErr.message : refundErr);
        }
      }
    }

    // Update scheduled post status
    const finalStatus = allSucceeded
      ? 'PUBLISHED'
      : anySucceeded
        ? 'PUBLISHED' // Partial success still counts as published
        : 'FAILED';

    // Merge new results with existing results (preserves prior successes on retry)
    const mergedResults = existingResults
      ? { ...existingResults, ...platformResults }
      : platformResults;

    await db.scheduledPost.update({
      where: { id: post.id },
      data: {
        status: finalStatus,
        publishedAt: anySucceeded ? now : null,
        publishResults: mergedResults,
        error: allSucceeded
          ? null
          : Object.entries(mergedResults)
              .filter(([, r]) => !r.success)
              .map(([p, r]) => `${p}: ${r.error}`)
              .join('; '),
      },
    });

    // Update daily stats
    if (anySucceeded) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await db.botDailyStat.upsert({
        where: { botId_date: { botId: post.botId, date: today } },
        create: {
          botId: post.botId,
          date: today,
          postsCount: 1,
        },
        update: {
          postsCount: { increment: 1 },
        },
      });
    }

    results.push({
      postId: post.id,
      status: finalStatus,
      platforms: mergedResults,
    });
  }

  const responseData = { processed: results.length, results };

  // Return 500 if ALL posts failed — allows monitoring tools to detect total failures
  const allFailed = results.length > 0 && results.every(r => r.status === 'FAILED');
  if (allFailed) {
    return NextResponse.json(responseData, { status: 500 });
  }

  return NextResponse.json(responseData);
}

/**
 * Parse the postType field which may be:
 * - null (no post type specified)
 * - A plain string like "reel" (legacy Instagram-only format)
 * - A JSON string like '{"instagram":"reel","facebook":"photo","threads":"text"}'
 */
function parsePostTypes(postType: string | null): {
  instagram: string | null;
  facebook: string | null;
  threads: string | null;
} {
  if (!postType) return { instagram: null, facebook: null, threads: null };
  try {
    const parsed = JSON.parse(postType);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return {
        instagram: parsed.instagram || null,
        facebook: parsed.facebook || null,
        threads: parsed.threads || null,
      };
    }
  } catch {
    // Legacy: plain string applies to Instagram only
  }
  return { instagram: postType, facebook: null, threads: null };
}

/**
 * Publish content to a specific platform.
 * Currently supports: FACEBOOK.
 * Other platforms return a "not implemented" placeholder.
 */
async function publishToPlatform(
  platform: PlatformType,
  botId: string,
  content: string,
  mediaPath: string | null,
  mediaType: 'IMAGE' | 'VIDEO' | 'GIF' | null,
  mediaMimeType: string | null,
  mediaId: string | null,
  postTypeRaw: string | null = null,
  mediaIds: string[] | null = null
): Promise<{ success: boolean; externalId?: string; error?: string }> {
  // Get platform connection
  const conn = await db.platformConnection.findUnique({
    where: { botId_platform: { botId, platform } },
  });

  if (!conn || conn.status !== 'CONNECTED') {
    const platformName = PLATFORM_NAMES[platform] || platform;
    const statusDetail = conn ? `(status: ${conn.status.toLowerCase()})` : '(no account linked)';
    return {
      success: false,
      error: `${platformName} is not connected ${statusDetail}. Go to Platforms settings and connect your ${platformName} account before posting.`,
    };
  }

  // Parse per-platform post types from the JSON field
  const postTypes = parsePostTypes(postTypeRaw);

  switch (platform) {
    case 'FACEBOOK':
      return publishToFacebook(conn, content, mediaPath, mediaType, postTypes.facebook);

    case 'INSTAGRAM':
      return publishToInstagram(
        conn, content, mediaPath, mediaType, mediaId, mediaMimeType,
        (postTypes.instagram as 'feed' | 'reel' | 'story' | 'carousel' | null),
        mediaIds
      );

    case 'THREADS':
      return publishToThreads(conn, botId, content, mediaPath, mediaType, mediaMimeType, postTypes.threads, mediaIds);

    default:
      return {
        success: false,
        error: `${PLATFORM_NAMES[platform] || platform} publishing is not yet available. Currently supported platforms: Facebook, Instagram, and Threads. More platforms are coming soon.`,
      };
  }
}

async function publishToFacebook(
  conn: PlatformConnection,
  content: string,
  mediaPath: string | null,
  mediaType: 'IMAGE' | 'VIDEO' | 'GIF' | null,
  fbPostType: string | null = null
): Promise<{ success: boolean; externalId?: string; error?: string }> {
  try {
    const creds = decryptFacebookCredentials(conn);

    let result: FacebookPostResult;

    if (mediaPath) {
      // Resolve to absolute path — filePath in DB is relative to data/uploads/
      const absPath = path.resolve(
        path.isAbsolute(mediaPath) ? mediaPath : path.join(UPLOAD_DIR, mediaPath)
      );

      // Prevent path traversal — ensure resolved path is within UPLOAD_DIR
      if (!absPath.startsWith(path.resolve(UPLOAD_DIR))) {
        return { success: false, error: 'Media file path is invalid or outside the allowed directory. The file may have been moved or deleted. Try uploading the media again.' };
      }

      if (mediaType === 'VIDEO') {
        // Determine effective post type for video
        // User can choose 'reel' for vertical video or 'video' for standard video
        const effectiveFbType = fbPostType || 'video'; // default: standard video

        if (effectiveFbType === 'reel') {
          console.log('[process-posts] Facebook: posting as Reel (vertical video)');
          result = await fbPostReel(creds, content, absPath);
        } else {
          console.log('[process-posts] Facebook: posting as standard Video');
          result = await fbPostWithVideo(creds, content, absPath);
        }
      } else {
        // Image post
        console.log('[process-posts] Facebook: posting as Photo');
        result = await postWithImage(creds, content, absPath);
      }
    } else {
      // No media — text or link post
      // For 'link' post type, the URL in the content auto-generates a preview
      // Both text and link posts use the same endpoint (/{page-id}/feed)
      console.log(`[process-posts] Facebook: posting as ${fbPostType === 'link' ? 'Link' : 'Text'} post`);
      result = await postText(creds, content);
    }

    if (result.success) {
      return { success: true, externalId: result.postId };
    }

    // Check if token error - mark connection
    if (result.error?.includes('Invalid OAuth') || result.error?.includes('Session has expired')) {
      await db.platformConnection.update({
        where: { id: conn.id },
        data: {
          status: 'ERROR',
          lastError: 'Facebook access token has expired. Please reconnect Facebook.',
        },
      });
    }

    return { success: false, error: result.error };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return { success: false, error: `Facebook publishing failed: ${msg}. If this keeps happening, try reconnecting Facebook in Platforms settings.` };
  }
}

/**
 * Publish content to Instagram.
 *
 * Instagram does NOT support text-only posts — media is required.
 * Uses the 2-step Container API: create container → publish.
 * Requires a publicly accessible image URL (uses /api/media/{id} endpoint).
 */
async function publishToInstagram(
  conn: PlatformConnection,
  content: string,
  mediaPath: string | null,
  mediaType: 'IMAGE' | 'VIDEO' | 'GIF' | null,
  mediaId: string | null,
  mediaMimeType: string | null = null,
  postType: 'feed' | 'reel' | 'story' | 'carousel' | null = null,
  mediaIds: string[] | null = null
): Promise<{ success: boolean; externalId?: string; error?: string }> {
  try {
    const creds = decryptInstagramCredentials(conn);
    const config = (conn.config || {}) as Record<string, unknown>;

    console.log(`[process-posts] Instagram: starting publish for connection ${conn.id}`, {
      mediaType,
      mediaMimeType,
      hasMediaPath: !!mediaPath,
      hasMediaId: !!mediaId,
      accountId: creds.accountId,
      tokenLength: creds.accessToken.length,
    });

    // Check if token is near expiry and log warning (same as Threads)
    if (igIsTokenNearExpiry(config)) {
      console.warn(
        `[process-posts] Instagram token for connection ${conn.id} is near expiry. ` +
        `Expires at: ${config.tokenExpiresAt}. Consider refreshing.`
      );
    }

    // Token validation (soft check — do NOT block publishing if it fails).
    // Instagram Direct Login tokens CANNOT be introspected for specific scopes.
    // The /me endpoint only confirms the token is valid (instagram_business_basic works),
    // but cannot tell us if instagram_business_content_publish is present.
    // Therefore we ONLY block publishing if the token is definitively INVALID.
    // The actual publish attempt is the real permission test.
    try {
      const tokenInfo = await igDebugToken(creds.accessToken);
      console.log(`[process-posts] Instagram token check:`, {
        isValid: tokenInfo.isValid,
        userId: tokenInfo.userId,
        type: tokenInfo.type,
        error: tokenInfo.error,
      });

      if (tokenInfo.isValid === false && tokenInfo.error) {
        // Definitive answer: /me returned an API error with a specific error code.
        // This means the token is expired, revoked, or account is restricted.
        await markConnectionError(conn.id, `Token invalid: ${tokenInfo.error || 'unknown reason'}. Please reconnect Instagram.`);
        return {
          success: false,
          error: 'Instagram access token is invalid or expired. Go to Platforms → Instagram and reconnect your account to get a new token.',
        };
      }

      if (tokenInfo.error) {
        // /me call failed but we can't be sure why — proceed with publishing.
        console.warn(
          `[process-posts] Instagram token check inconclusive (will proceed anyway): ${tokenInfo.error}`
        );
      } else {
        console.log('[process-posts] Instagram: token check passed, proceeding to publish');
      }
    } catch (debugErr) {
      // Token check crashed — log and proceed with publishing
      const msg = debugErr instanceof Error ? debugErr.message : 'Unknown error';
      console.warn(`[process-posts] Instagram token check threw (will proceed anyway): ${msg}`);
    }

    if (!mediaPath) {
      return {
        success: false,
        error: 'Instagram requires an image or video — text-only posts are not supported by Instagram API. Attach a JPEG/PNG image or MP4 video in the post form, or deselect Instagram from the target platforms.',
      };
    }

    // Convert non-JPEG images to JPEG for Instagram compatibility.
    // Instagram officially recommends sRGB JPEG. AI-generated PNGs frequently fail
    // with error 9004 due to alpha channels, unusual color profiles, or metadata.
    // Converting ALL non-JPEG images to JPEG eliminates these issues.
    let igMediaPath = mediaPath;
    let igMediaMimeType = mediaMimeType;
    if (mediaType === 'IMAGE' && mediaMimeType && IG_CONVERT_TO_JPEG_MIMES.includes(mediaMimeType.toLowerCase())) {
      console.log(`[process-posts] Instagram: converting ${mediaMimeType} → JPEG for compatibility`);
      const jpegPath = await convertToJpegForInstagram(mediaPath, mediaMimeType);
      if (jpegPath) {
        igMediaPath = jpegPath;
        igMediaMimeType = 'image/jpeg';
        console.log(`[process-posts] Instagram: using converted JPEG: ${jpegPath}`);
      } else {
        console.warn('[process-posts] Instagram: JPEG conversion failed, using original file');
      }
    }

    // Determine the effective post type with safety overrides:
    // 1. VIDEO media ALWAYS uses 'reel' (or 'story') — Instagram does not support
    //    video in feed posts via the Container API (image_url param).
    //    Videos require media_type=REELS with video_url.
    // 2. IMAGE media CANNOT be a 'reel' — Reels require video. Override to 'feed'.
    // 3. Use explicit postType if valid for the media type.
    // 4. Auto-detect: multiple mediaIds → carousel, else → feed.
    let effectivePostType: string;
    if (mediaType === 'VIDEO') {
      if (postType && postType !== 'reel' && postType !== 'story') {
        console.warn(
          `[process-posts] Instagram: overriding postType "${postType}" → "reel" because media is VIDEO. ` +
          `Instagram API requires media_type=REELS for video content.`
        );
      }
      effectivePostType = (postType === 'story') ? 'story' : 'reel';
    } else {
      // IMAGE or GIF — cannot be reel (reel requires video)
      if (postType === 'reel') {
        console.warn(
          `[process-posts] Instagram: overriding postType "reel" → "feed" because media is ${mediaType || 'IMAGE'}. ` +
          `Instagram Reels require video content. Images can only be posted as feed, story, or carousel.`
        );
        effectivePostType = 'feed';
      } else {
        effectivePostType = postType
          || (mediaIds && mediaIds.length >= 2 ? 'carousel' : null)
          || 'feed';
      }
    }

    console.log(`[process-posts] Instagram: effective post type: ${effectivePostType}`);

    // Helper to resolve a media file path or ID to a public URL
    const resolveMediaUrl = async (filePath: string | null, mId: string | null): Promise<string | null> => {
      if (!filePath && !mId) return null;

      // Already a URL
      if (filePath?.startsWith('http://') || filePath?.startsWith('https://')) {
        return filePath;
      }

      if (MEDIA_DIRECT_BASE && filePath) {
        const absPath = path.resolve(path.join(UPLOAD_DIR, filePath));
        if (!existsSync(absPath)) {
          console.error(`[process-posts] Instagram: media file NOT FOUND: ${absPath}`);
          return null;
        }
        return `${MEDIA_DIRECT_BASE}/${filePath}`;
      }

      const baseUrl = process.env.NEXTAUTH_URL || 'https://grothi.com';
      const resolvedId = mId || (filePath ? (await db.media.findFirst({
        where: { filePath },
        select: { id: true },
      }))?.id : null);

      if (!resolvedId) return null;
      return `${baseUrl}/api/media/${encodeURIComponent(resolvedId)}`;
    };

    let result: InstagramPostResult;

    switch (effectivePostType) {
      case 'story': {
        const isVideo = mediaType === 'VIDEO';
        // Use converted JPEG for image stories, original for video stories
        const storyPath = isVideo ? mediaPath : igMediaPath;
        const publicUrl = await resolveMediaUrl(storyPath, mediaId);
        if (!publicUrl) {
          return { success: false, error: 'Instagram Story failed: could not generate a public URL for the media file. The file may have been deleted or the server configuration is incorrect. Try re-uploading the media.' };
        }
        console.log(`[process-posts] Instagram: posting Story (${isVideo ? 'video' : 'image'})`);
        result = await igPostStory(creds, publicUrl, isVideo);
        break;
      }

      case 'carousel': {
        // Resolve all media items for the carousel, converting each to JPEG if needed
        const carouselMediaIds = mediaIds || [];
        if (carouselMediaIds.length < 2) {
          return { success: false, error: 'Instagram Carousel requires at least 2 media items (max 10). You only selected 1 item. Add more images/videos or switch to Feed Post type.' };
        }

        const allMedia = await db.media.findMany({
          where: { id: { in: carouselMediaIds } },
          select: { id: true, filePath: true, type: true, mimeType: true },
        });

        const imageUrls: string[] = [];
        for (const m of allMedia) {
          // Skip media without filePath (pending generations, failed uploads)
          if (!m.filePath) {
            console.warn(`[process-posts] Instagram: skipping media ${m.id} - no filePath (status: pending/failed)`);
            continue;
          }
          
          // Convert non-JPEG carousel items to JPEG
          let carouselFilePath = m.filePath;
          if (m.type === 'IMAGE' && m.mimeType && IG_CONVERT_TO_JPEG_MIMES.includes(m.mimeType.toLowerCase())) {
            const jpegPath = await convertToJpegForInstagram(m.filePath, m.mimeType);
            if (jpegPath) carouselFilePath = jpegPath;
          }
          const url = await resolveMediaUrl(carouselFilePath, m.id);
          if (!url) {
            return { success: false, error: `Instagram Carousel failed: could not generate a public URL for one of the media files. The file may have been deleted. Try re-uploading media in the Media library.` };
          }
          imageUrls.push(url);
        }

        console.log(`[process-posts] Instagram: posting Carousel with ${imageUrls.length} items`);
        result = await igPostCarousel(creds, content, imageUrls);
        break;
      }

      case 'reel': {
        // Videos use original path (no JPEG conversion for video)
        const publicUrl = await resolveMediaUrl(mediaPath, mediaId);
        if (!publicUrl) {
          return { success: false, error: 'Instagram Reel failed: could not generate a public URL for the video file. The file may have been deleted or the server configuration is incorrect. Try re-uploading the video.' };
        }
        console.log(`[process-posts] Instagram: posting Reel`);
        result = await igPostReel(creds, content, publicUrl);
        break;
      }

      default: {
        // 'feed' - single image post (use converted JPEG)
        const publicUrl = await resolveMediaUrl(igMediaPath, mediaId);
        if (!publicUrl) {
          return { success: false, error: 'Instagram Feed Post failed: could not generate a public URL for the image. The file may have been deleted. Try re-uploading the image in the Media library.' };
        }
        console.log(`[process-posts] Instagram: posting Feed Image`);
        result = await igPostImage(creds, content, publicUrl);
        break;
      }
    }

    if (result.success) {
      return { success: true, externalId: result.mediaId };
    }
    if (isInstagramTokenError(result.error)) {
      await markConnectionError(conn.id, 'Instagram access token has expired. Go to Platforms → Instagram and reconnect your account.');
    }
    return { success: false, error: result.error };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[process-posts] Instagram publishing error:', msg);
    return { success: false, error: `Instagram publishing failed: ${msg}. If this keeps happening, try reconnecting Instagram in Platforms settings.` };
  }
}

/**
 * Publish content to Threads.
 *
 * Threads supports text-only, image, video, and carousel posts.
 * Uses the 2-step Container API: create container → publish.
 * For media posts, requires a publicly accessible URL.
 *
 * Post types (media_type in Threads API):
 * - TEXT: text-only (max 500 chars)
 * - IMAGE: single image with caption
 * - VIDEO: single video with caption (max 500MB, max 5min)
 * - CAROUSEL: 2-20 images/videos in a swipeable gallery
 */
async function publishToThreads(
  conn: PlatformConnection,
  botId: string,
  content: string,
  mediaPath: string | null,
  mediaType: 'IMAGE' | 'VIDEO' | 'GIF' | null,
  mediaMimeType: string | null = null,
  threadsPostType: string | null = null,
  mediaIds: string[] | null = null
): Promise<{ success: boolean; externalId?: string; error?: string }> {
  try {
    const creds = decryptThreadsCredentials(conn);
    const config = (conn.config || {}) as Record<string, unknown>;

    // Check if token is near expiry and log warning
    if (isTokenNearExpiry(config)) {
      console.warn(
        `[process-posts] Threads token for connection ${conn.id} is near expiry. ` +
        `Expires at: ${config.tokenExpiresAt}. Consider refreshing.`
      );
    }

    /**
     * Resolve a media file path to a publicly accessible URL for the Threads API.
     */
    const resolveThreadsMediaUrl = async (filePath: string, mId?: string | null): Promise<string | null> => {
      // Convert non-JPEG images for Threads compatibility
      let resolvedPath = filePath;
      const mime = mediaMimeType; // Use the primary media's MIME type for single-media posts
      if (mediaType === 'IMAGE' && mime && IG_CONVERT_TO_JPEG_MIMES.includes(mime.toLowerCase())) {
        const jpegPath = await convertToJpegForInstagram(resolvedPath, mime);
        if (jpegPath) resolvedPath = jpegPath;
      }

      if (resolvedPath.startsWith('http://') || resolvedPath.startsWith('https://')) {
        return resolvedPath;
      }

      if (MEDIA_DIRECT_BASE) {
        const absPath = path.resolve(path.join(UPLOAD_DIR, resolvedPath));
        if (!existsSync(absPath)) {
          console.error(`[process-posts] Threads: media file NOT FOUND: ${absPath}`);
          return null;
        }
        return `${MEDIA_DIRECT_BASE}/${resolvedPath}`;
      }

      const baseUrl = process.env.NEXTAUTH_URL || 'https://grothi.com';
      const resolvedId = mId || (await db.media.findFirst({
        where: { filePath: resolvedPath },
        select: { id: true },
      }))?.id;

      if (!resolvedId) return null;
      return `${baseUrl}/api/media/${encodeURIComponent(resolvedId)}`;
    };

    // Determine effective post type
    let effectiveType = threadsPostType;
    if (!effectiveType) {
      // Auto-detect based on media
      if (mediaIds && mediaIds.length >= 2) {
        effectiveType = 'carousel';
      } else if (mediaPath) {
        effectiveType = mediaType === 'VIDEO' ? 'video' : 'image';
      } else {
        effectiveType = 'text';
      }
    }

    console.log(`[process-posts] Threads: effective post type: ${effectiveType}`);

    let result: ThreadsPostResult;

    switch (effectiveType) {
      case 'carousel': {
        // Carousel post: 2-20 media items
        const carouselMediaIds = mediaIds || [];
        if (carouselMediaIds.length < 2) {
          return { success: false, error: 'Threads Carousel requires at least 2 media items (max 20). You only selected 1 item. Add more images/videos or switch to a single Image/Video post type.' };
        }

        const allMedia = await db.media.findMany({
          where: { id: { in: carouselMediaIds }, botId },
          select: { id: true, filePath: true, type: true, mimeType: true },
        });

        const imageUrls: string[] = [];
        for (const m of allMedia) {
          // Skip media without filePath
          if (!m.filePath) {
            console.warn(`[process-posts] Threads: skipping media ${m.id} - no filePath`);
            continue;
          }
          
          // Convert non-JPEG images
          let itemPath = m.filePath;
          if (m.type === 'IMAGE' && m.mimeType && IG_CONVERT_TO_JPEG_MIMES.includes(m.mimeType.toLowerCase())) {
            const jpegPath = await convertToJpegForInstagram(m.filePath, m.mimeType);
            if (jpegPath) itemPath = jpegPath;
          }

          let itemUrl: string | null;
          if (MEDIA_DIRECT_BASE) {
            const absPath = path.resolve(path.join(UPLOAD_DIR, itemPath));
            if (!existsSync(absPath)) {
              return { success: false, error: `Threads Carousel failed: media file not found on server. The file may have been deleted. Try re-uploading media in the Media library.` };
            }
            itemUrl = `${MEDIA_DIRECT_BASE}/${itemPath}`;
          } else {
            const baseUrl = process.env.NEXTAUTH_URL || 'https://grothi.com';
            itemUrl = `${baseUrl}/api/media/${encodeURIComponent(m.id)}`;
          }

          imageUrls.push(itemUrl);
        }

        console.log(`[process-posts] Threads: posting Carousel with ${imageUrls.length} items`);
        result = await threadsPostCarousel(creds, content, imageUrls);
        break;
      }

      case 'video': {
        if (!mediaPath) {
          return { success: false, error: 'Threads Video Post requires a video file attached. Attach an MP4 video in the post form, or change the post type to Text.' };
        }
        const videoUrl = await resolveThreadsMediaUrl(mediaPath, null);
        if (!videoUrl) {
          return { success: false, error: 'Threads Video Post failed: could not generate a public URL for the video file. The file may have been deleted. Try re-uploading the video.' };
        }
        console.log('[process-posts] Threads: posting Video');
        result = await threadsPostWithVideo(creds, content, videoUrl);
        break;
      }

      case 'image': {
        if (!mediaPath) {
          return { success: false, error: 'Threads Image Post requires an image file attached. Attach a JPEG/PNG image in the post form, or change the post type to Text.' };
        }
        // Convert non-JPEG images for compatibility
        let threadsMediaPath = mediaPath;
        if (mediaType === 'IMAGE' && mediaMimeType && IG_CONVERT_TO_JPEG_MIMES.includes(mediaMimeType.toLowerCase())) {
          console.log(`[process-posts] Threads: converting ${mediaMimeType} → JPEG for compatibility`);
          const jpegPath = await convertToJpegForInstagram(threadsMediaPath, mediaMimeType);
          if (jpegPath) {
            threadsMediaPath = jpegPath;
            console.log(`[process-posts] Threads: using converted JPEG: ${jpegPath}`);
          }
        }

        const imageUrl = await resolveThreadsMediaUrl(threadsMediaPath, null);
        if (!imageUrl) {
          return { success: false, error: 'Threads Image Post failed: could not generate a public URL for the image. The file may have been deleted. Try re-uploading the image in the Media library.' };
        }
        console.log('[process-posts] Threads: posting Image');
        result = await threadsPostWithImage(creds, content, imageUrl);
        break;
      }

      default: {
        // 'text' or fallback — text-only post
        if (mediaPath) {
          // User explicitly chose 'text' but has media attached — still support it.
          // If they have media, auto-detect the actual type.
          let threadsMediaPath = mediaPath;
          if (mediaType === 'IMAGE' && mediaMimeType && IG_CONVERT_TO_JPEG_MIMES.includes(mediaMimeType.toLowerCase())) {
            const jpegPath = await convertToJpegForInstagram(threadsMediaPath, mediaMimeType);
            if (jpegPath) threadsMediaPath = jpegPath;
          }

          const mediaUrl = await resolveThreadsMediaUrl(threadsMediaPath, null);
          if (mediaUrl) {
            if (mediaType === 'VIDEO') {
              result = await threadsPostWithVideo(creds, content, mediaUrl);
            } else {
              result = await threadsPostWithImage(creds, content, mediaUrl);
            }
            break;
          }
        }

        console.log('[process-posts] Threads: posting Text-only');
        result = await threadsPostText(creds, content);
        break;
      }
    }

    if (result.success) {
      return { success: true, externalId: result.postId };
    }

    // Check for token errors
    if (isThreadsTokenError(result.error)) {
      await markConnectionError(conn.id, 'Threads access token has expired. Go to Platforms → Threads and reconnect your account.');
    }

    return { success: false, error: result.error };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return { success: false, error: `Threads publishing failed: ${msg}. If this keeps happening, try reconnecting Threads in Platforms settings.` };
  }
}

// ── Helpers ────────────────────────────────────────────────────

function isInstagramTokenError(error?: string): boolean {
  if (!error) return false;
  return (
    error.includes('Invalid OAuth') ||
    error.includes('Session has expired') ||
    error.includes('Error validating access token') ||
    error.includes('token expired')
  );
}

function isThreadsTokenError(error?: string): boolean {
  if (!error) return false;
  return (
    error.includes('Invalid OAuth') ||
    error.includes('expired') ||
    error.includes('Error validating access token')
  );
}

async function markConnectionError(connectionId: string, message: string): Promise<void> {
  await db.platformConnection.update({
    where: { id: connectionId },
    data: { status: 'ERROR', lastError: message },
  });
}
