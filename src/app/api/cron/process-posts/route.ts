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
import { db } from '@/lib/db';
import { deductCredits, getActionCost, hasEnoughCredits } from '@/lib/credits';
import {
  decryptFacebookCredentials,
  postText,
  postWithImage,
  postWithVideo as fbPostWithVideo,
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
  isTokenNearExpiry,
  type ThreadsPostResult,
} from '@/lib/threads';
import type { PlatformType } from '@prisma/client';
import path from 'path';
import { existsSync, mkdirSync } from 'fs';
import sharp from 'sharp';

/** Base directory for uploaded media files. */
const UPLOAD_DIR = path.join(process.cwd(), 'data', 'uploads');

/**
 * Direct media URL base for Meta platforms (Instagram, Threads, Facebook).
 * When set (e.g., "http://89.167.18.92:8787/media"), media files are served
 * directly via Nginx on the server IP, bypassing Cloudflare entirely.
 * This is needed because Cloudflare's bot protection blocks Meta's crawlers
 * from downloading images, causing Instagram error code 2.
 */
const MEDIA_DIRECT_BASE = process.env.MEDIA_DIRECT_BASE;

const CRON_SECRET = process.env.CRON_SECRET;

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
  const authHeader = request.headers.get('authorization');
  const cronSecret = authHeader?.replace('Bearer ', '');

  if (!CRON_SECRET || cronSecret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();

  // Find posts due for publishing
  const duePosts = await db.scheduledPost.findMany({
    where: {
      status: 'SCHEDULED',
      scheduledAt: { lte: now },
    },
    orderBy: { scheduledAt: 'asc' },
    take: BATCH_SIZE,
    include: {
      bot: { select: { id: true, userId: true, name: true, status: true } },
      media: { select: { id: true, filePath: true, type: true, mimeType: true } },
    },
  });

  if (duePosts.length === 0) {
    return NextResponse.json({ processed: 0, message: 'No posts due' });
  }

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
          error: `Bot is ${post.bot.status}. Activate the bot to publish posts.`,
        },
      });
      results.push({ postId: post.id, status: 'FAILED', platforms: {} });
      continue;
    }

    // Mark as PUBLISHING
    await db.scheduledPost.update({
      where: { id: post.id },
      data: { status: 'PUBLISHING' },
    });

    const platforms = (Array.isArray(post.platforms) ? post.platforms : []) as string[];
    const platformResults: Record<string, { success: boolean; externalId?: string; error?: string }> = {};
    let allSucceeded = true;
    let anySucceeded = false;

    for (const platform of platforms) {
      try {
        // Check credit balance before posting
        const hasCreds = await hasEnoughCredits(post.bot.userId, await getActionCost('POST'));
        if (!hasCreds) {
          platformResults[platform] = {
            success: false,
            error: 'Insufficient credits. Buy more credits to continue posting.',
          };
          allSucceeded = false;
          continue;
        }

        const result = await publishToPlatform(
          platform as PlatformType,
          post.botId,
          post.content,
          post.media?.filePath || null,
          (post.media?.type as 'IMAGE' | 'VIDEO' | 'GIF' | null) || null,
          post.media?.mimeType || null,
          post.media?.id || null,
          (post.postType as 'feed' | 'reel' | 'story' | 'carousel' | null) || null,
          (post.mediaIds as string[] | null) || null
        );

        platformResults[platform] = result;

        if (result.success) {
          anySucceeded = true;
          // Deduct credits on successful post
          const cost = await getActionCost('POST');
          await deductCredits(post.bot.userId, cost, `Post to ${platform}`, post.botId);
        } else {
          allSucceeded = false;
        }

        // Record activity
        const cost = result.success ? await getActionCost('POST') : 0;
        await db.botActivity.create({
          data: {
            botId: post.botId,
            platform: platform as PlatformType,
            action: 'POST',
            content: post.content.slice(0, 500),
            postId: result.externalId || null,
            contentType: post.contentType || 'custom',
            success: result.success,
            error: result.error || null,
            creditsUsed: cost,
          },
        });

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
        console.error(`[process-posts] Platform ${platform} failed for post ${post.id}:`, msg);
        platformResults[platform] = { success: false, error: msg.slice(0, 500) };
        allSucceeded = false;
      }
    }

    // Update scheduled post status
    const finalStatus = allSucceeded
      ? 'PUBLISHED'
      : anySucceeded
        ? 'PUBLISHED' // Partial success still counts as published
        : 'FAILED';

    await db.scheduledPost.update({
      where: { id: post.id },
      data: {
        status: finalStatus,
        publishedAt: anySucceeded ? now : null,
        publishResults: platformResults,
        error: allSucceeded
          ? null
          : Object.entries(platformResults)
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
      platforms: platformResults,
    });
  }

  return NextResponse.json({
    processed: results.length,
    results,
  });
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
  postType: 'feed' | 'reel' | 'story' | 'carousel' | null = null,
  mediaIds: string[] | null = null
): Promise<{ success: boolean; externalId?: string; error?: string }> {
  // Get platform connection
  const conn = await db.platformConnection.findUnique({
    where: { botId_platform: { botId, platform } },
  });

  if (!conn || conn.status !== 'CONNECTED') {
    return { success: false, error: `${platform} not connected` };
  }

  switch (platform) {
    case 'FACEBOOK':
      return publishToFacebook(conn, content, mediaPath, mediaType);

    case 'INSTAGRAM':
      return publishToInstagram(conn, content, mediaPath, mediaType, mediaId, mediaMimeType, postType, mediaIds);

    case 'THREADS':
      return publishToThreads(conn, content, mediaPath, mediaType);

    default:
      return {
        success: false,
        error: `Platform ${platform} publishing not yet implemented`,
      };
  }
}

async function publishToFacebook(
  conn: any,
  content: string,
  mediaPath: string | null,
  mediaType: 'IMAGE' | 'VIDEO' | 'GIF' | null
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
        return { success: false, error: 'Invalid media path' };
      }

      if (mediaType === 'VIDEO') {
        result = await fbPostWithVideo(creds, content, absPath);
      } else {
        result = await postWithImage(creds, content, absPath);
      }
    } else {
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
          lastError: 'Token expired. Please reconnect Facebook.',
        },
      });
    }

    return { success: false, error: result.error };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return { success: false, error: msg };
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
  conn: any,
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

      if (tokenInfo.isValid === false && !tokenInfo.error) {
        // Definitive answer: /me returned an API error with a specific error code.
        // This means the token is expired, revoked, or account is restricted.
        await markConnectionError(conn.id, `Token invalid: ${tokenInfo.error || 'unknown reason'}. Please reconnect Instagram.`);
        return {
          success: false,
          error: 'Instagram token is invalid. Please reconnect Instagram in Platform settings.',
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
        error: 'Instagram requires an image or video. Text-only posts are not supported.',
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

    // Determine the effective post type:
    // 1. VIDEO media ALWAYS uses 'reel' — Instagram does not support video in feed
    //    posts via the Container API (image_url param). Videos require media_type=REELS
    //    with video_url. If user selected 'feed' for a video, override to 'reel'.
    // 2. Use explicit postType if set (for non-video)
    // 3. Auto-detect: multiple mediaIds → carousel, else → feed
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
      effectivePostType = postType
        || (mediaIds && mediaIds.length >= 2 ? 'carousel' : null)
        || 'feed';
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
          return { success: false, error: 'Could not resolve media URL for Story.' };
        }
        console.log(`[process-posts] Instagram: posting Story (${isVideo ? 'video' : 'image'})`);
        result = await igPostStory(creds, publicUrl, isVideo);
        break;
      }

      case 'carousel': {
        // Resolve all media items for the carousel, converting each to JPEG if needed
        const carouselMediaIds = mediaIds || [];
        if (carouselMediaIds.length < 2) {
          return { success: false, error: 'Carousel requires at least 2 media items.' };
        }

        const allMedia = await db.media.findMany({
          where: { id: { in: carouselMediaIds } },
          select: { id: true, filePath: true, type: true, mimeType: true },
        });

        const imageUrls: string[] = [];
        for (const m of allMedia) {
          // Convert non-JPEG carousel items to JPEG
          let carouselFilePath = m.filePath;
          if (m.type === 'IMAGE' && m.mimeType && IG_CONVERT_TO_JPEG_MIMES.includes(m.mimeType.toLowerCase())) {
            const jpegPath = await convertToJpegForInstagram(m.filePath, m.mimeType);
            if (jpegPath) carouselFilePath = jpegPath;
          }
          const url = await resolveMediaUrl(carouselFilePath, m.id);
          if (!url) {
            return { success: false, error: `Could not resolve URL for media item ${m.id}.` };
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
          return { success: false, error: 'Could not resolve video URL for Reel.' };
        }
        console.log(`[process-posts] Instagram: posting Reel`);
        result = await igPostReel(creds, content, publicUrl);
        break;
      }

      default: {
        // 'feed' - single image post (use converted JPEG)
        const publicUrl = await resolveMediaUrl(igMediaPath, mediaId);
        if (!publicUrl) {
          return { success: false, error: 'Could not resolve media URL for feed post.' };
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
      await markConnectionError(conn.id, 'Token expired. Please reconnect Instagram.');
    }
    return { success: false, error: result.error };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[process-posts] Instagram publishing error:', msg);
    return { success: false, error: msg };
  }
}

/**
 * Publish content to Threads.
 *
 * Threads supports both text-only and image posts.
 * Uses the 2-step Container API: create container → publish.
 * For image posts, requires a publicly accessible image URL.
 */
async function publishToThreads(
  conn: any,
  content: string,
  mediaPath: string | null,
  mediaType: 'IMAGE' | 'VIDEO' | 'GIF' | null
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

    let result: ThreadsPostResult;

    if (mediaPath) {
      let mediaUrl: string;

      if (mediaPath.startsWith('http://') || mediaPath.startsWith('https://')) {
        mediaUrl = mediaPath;
      } else if (MEDIA_DIRECT_BASE) {
        // Direct path: Nginx serves the file from disk, bypasses Cloudflare
        const absPath = path.resolve(path.join(UPLOAD_DIR, mediaPath));
        if (!existsSync(absPath)) {
          console.error(`[process-posts] Threads: media file NOT FOUND: ${absPath}`);
          return { success: false, error: `Media file not found on disk: ${mediaPath}` };
        }
        mediaUrl = `${MEDIA_DIRECT_BASE}/${mediaPath}`;
        console.log(`[process-posts] Threads publishing via DIRECT URL (bypasses Cloudflare): ${mediaUrl}`);
      } else {
        // Fallback: API endpoint through Cloudflare
        const baseUrl = process.env.NEXTAUTH_URL || 'https://grothi.com';
        const media = await db.media.findFirst({
          where: { filePath: mediaPath },
          select: { id: true },
        });

        if (!media) {
          return {
            success: false,
            error: 'Could not find media record for Threads publishing. Set MEDIA_DIRECT_BASE to bypass Cloudflare.',
          };
        }

        mediaUrl = `${baseUrl}/api/media/${encodeURIComponent(media.id)}`;
        console.log(`[process-posts] Threads publishing via API URL (through Cloudflare): ${mediaUrl}`);
      }

      // Use correct posting function based on media type
      if (mediaType === 'VIDEO') {
        result = await threadsPostWithVideo(creds, content, mediaUrl);
      } else {
        result = await threadsPostWithImage(creds, content, mediaUrl);
      }
    } else {
      // Text-only post
      result = await threadsPostText(creds, content);
    }

    if (result.success) {
      return { success: true, externalId: result.postId };
    }

    // Check for token errors
    if (isThreadsTokenError(result.error)) {
      await markConnectionError(conn.id, 'Token expired. Please reconnect Threads.');
    }

    return { success: false, error: result.error };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return { success: false, error: msg };
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
