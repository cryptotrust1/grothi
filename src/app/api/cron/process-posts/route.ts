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
  type FacebookPostResult,
} from '@/lib/facebook';
import {
  decryptInstagramCredentials,
  postImage as igPostImage,
  postLocalImage as igPostLocalImage,
  type InstagramPostResult,
} from '@/lib/instagram';
import {
  decryptThreadsCredentials,
  postText as threadsPostText,
  postWithImage as threadsPostWithImage,
  isTokenNearExpiry,
  type ThreadsPostResult,
} from '@/lib/threads';
import type { PlatformType } from '@prisma/client';
import path from 'path';

const CRON_SECRET = process.env.CRON_SECRET;

/** Max posts to process per invocation (prevents long-running requests). */
const BATCH_SIZE = 10;

export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = authHeader?.replace('Bearer ', '');

  if (CRON_SECRET && cronSecret !== CRON_SECRET) {
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
      const result = await publishToPlatform(
        platform as PlatformType,
        post.botId,
        post.content,
        post.media?.filePath || null
      );

      platformResults[platform] = result;

      if (result.success) {
        anySucceeded = true;
      } else {
        allSucceeded = false;
      }

      // Record activity
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
          creditsUsed: result.success ? await getActionCost('POST') : 0,
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
  mediaPath: string | null
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
      return publishToFacebook(conn, content, mediaPath);

    case 'INSTAGRAM':
      return publishToInstagram(conn, content, mediaPath);

    case 'THREADS':
      return publishToThreads(conn, content, mediaPath);

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
  mediaPath: string | null
): Promise<{ success: boolean; externalId?: string; error?: string }> {
  try {
    const creds = decryptFacebookCredentials(conn);

    let result: FacebookPostResult;

    if (mediaPath) {
      // Resolve to absolute path
      const absPath = path.isAbsolute(mediaPath)
        ? mediaPath
        : path.join(process.cwd(), mediaPath);

      result = await postWithImage(creds, content, absPath);
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
  mediaPath: string | null
): Promise<{ success: boolean; externalId?: string; error?: string }> {
  try {
    const creds = decryptInstagramCredentials(conn);

    if (!mediaPath) {
      return {
        success: false,
        error: 'Instagram requires an image or video. Text-only posts are not supported.',
      };
    }

    // Check if mediaPath is already a URL
    if (mediaPath.startsWith('http://') || mediaPath.startsWith('https://')) {
      const result = await igPostImage(creds, content, mediaPath);
      if (result.success) {
        return { success: true, externalId: result.mediaId };
      }
      if (isInstagramTokenError(result.error)) {
        await markConnectionError(conn.id, 'Token expired. Please reconnect Instagram.');
      }
      return { success: false, error: result.error };
    }

    // For local files, construct a public URL via the media serve endpoint
    // The mediaPath format is: data/uploads/{botId}/{uuid}.{ext}
    // We need the media ID from the database to construct the public URL
    const baseUrl = process.env.NEXTAUTH_URL || 'https://grothi.com';

    // Try to find the media record by file path
    const media = await db.media.findFirst({
      where: { filePath: mediaPath },
      select: { id: true },
    });

    if (media) {
      const publicUrl = `${baseUrl}/api/media/${encodeURIComponent(media.id)}`;
      const result = await igPostImage(creds, content, publicUrl);

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
  mediaPath: string | null
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
      let imageUrl: string;

      if (mediaPath.startsWith('http://') || mediaPath.startsWith('https://')) {
        imageUrl = mediaPath;
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
            error: 'Could not find media record for Threads publishing. Threads requires a publicly accessible URL for images.',
          };
        }

        imageUrl = `${baseUrl}/api/media/${encodeURIComponent(media.id)}`;
      }

      result = await threadsPostWithImage(creds, content, imageUrl);
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
    error.includes('Error validating access token')
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
