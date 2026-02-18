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
  postLocalImage as igPostLocalImage,
  isTokenNearExpiry as igIsTokenNearExpiry,
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
import { existsSync } from 'fs';

/** Base directory for uploaded media files. */
const UPLOAD_DIR = path.join(process.cwd(), 'data', 'uploads');

const CRON_SECRET = process.env.CRON_SECRET;

/** Max posts to process per invocation (prevents long-running requests). */
const BATCH_SIZE = 10;

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
          post.media?.id || null
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
  mediaId: string | null
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
      return publishToInstagram(conn, content, mediaPath, mediaType, mediaId, mediaMimeType);

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
  mediaMimeType: string | null = null
): Promise<{ success: boolean; externalId?: string; error?: string }> {
  try {
    const creds = decryptInstagramCredentials(conn);
    const config = (conn.config || {}) as Record<string, unknown>;

    console.log(`[process-posts] Instagram: starting publish for connection ${conn.id}`, {
      mediaType,
      mediaMimeType,
      hasMediaPath: !!mediaPath,
      hasMediaId: !!mediaId,
    });

    // Check if token is near expiry and log warning (same as Threads)
    if (igIsTokenNearExpiry(config)) {
      console.warn(
        `[process-posts] Instagram token for connection ${conn.id} is near expiry. ` +
        `Expires at: ${config.tokenExpiresAt}. Consider refreshing.`
      );
    }

    if (!mediaPath) {
      return {
        success: false,
        error: 'Instagram requires an image or video. Text-only posts are not supported.',
      };
    }

    // Instagram only supports JPEG and PNG for images. Warn about unsupported formats.
    if (mediaType === 'IMAGE' && mediaMimeType) {
      const supportedImageTypes = ['image/jpeg', 'image/png'];
      if (!supportedImageTypes.includes(mediaMimeType)) {
        console.warn(
          `[process-posts] Instagram image format warning: ${mediaMimeType} may not be supported. ` +
          `Instagram officially supports only JPEG and PNG.`
        );
      }
    }

    // Determine the correct posting function based on media type
    const postFn = mediaType === 'VIDEO' ? igPostReel : igPostImage;

    // Check if mediaPath is already a URL
    if (mediaPath.startsWith('http://') || mediaPath.startsWith('https://')) {
      console.log(`[process-posts] Instagram: posting with external URL: ${mediaPath.substring(0, 100)}`);
      const result = await postFn(creds, content, mediaPath);
      if (result.success) {
        return { success: true, externalId: result.mediaId };
      }
      if (isInstagramTokenError(result.error)) {
        await markConnectionError(conn.id, 'Token expired. Please reconnect Instagram.');
      }
      return { success: false, error: result.error };
    }

    // Verify file exists on disk before constructing public URL
    const absMediaPath = path.resolve(path.join(UPLOAD_DIR, mediaPath));
    if (!existsSync(absMediaPath)) {
      console.error(`[process-posts] Instagram: media file NOT FOUND on disk: ${absMediaPath}`);
      return { success: false, error: `Media file not found on disk: ${mediaPath}` };
    }
    console.log(`[process-posts] Instagram: media file verified on disk: ${absMediaPath}`);

    // For local files, construct a public URL via the media serve endpoint
    const baseUrl = process.env.NEXTAUTH_URL || 'https://grothi.com';

    // Use the media ID directly if available (avoids extra DB lookup)
    const resolvedMediaId = mediaId || (await db.media.findFirst({
      where: { filePath: mediaPath },
      select: { id: true },
    }))?.id;

    if (resolvedMediaId) {
      const publicUrl = `${baseUrl}/api/media/${encodeURIComponent(resolvedMediaId)}`;
      console.log(`[process-posts] Instagram publishing via URL: ${publicUrl}`);
      const result = await postFn(creds, content, publicUrl);

      if (result.success) {
        return { success: true, externalId: result.mediaId };
      }
      if (isInstagramTokenError(result.error)) {
        await markConnectionError(conn.id, 'Token expired. Please reconnect Instagram.');
      }
      return { success: false, error: result.error };
    }

    return {
      success: false,
      error: 'Could not find media record for Instagram publishing. Instagram requires a publicly accessible URL.',
    };
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
      } else {
        // Construct public URL from media record
        const baseUrl = process.env.NEXTAUTH_URL || 'https://grothi.com';
        const media = await db.media.findFirst({
          where: { filePath: mediaPath },
          select: { id: true },
        });

        if (!media) {
          return {
            success: false,
            error: 'Could not find media record for Threads publishing. Threads requires a publicly accessible URL.',
          };
        }

        mediaUrl = `${baseUrl}/api/media/${encodeURIComponent(media.id)}`;
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
