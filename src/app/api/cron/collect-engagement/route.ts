/**
 * POST /api/cron/collect-engagement
 *
 * Collects engagement metrics (likes, comments, shares) from published posts
 * on Facebook (and other platforms in the future).
 *
 * Called periodically (e.g., every 15 minutes or hourly) by external cron.
 *
 * Only processes posts published in the last 7 days to keep API calls manageable.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  decryptFacebookCredentials,
  getPostEngagement,
} from '@/lib/facebook';
import {
  decryptInstagramCredentials,
  getMediaInsights,
} from '@/lib/instagram';
import type { PlatformType } from '@prisma/client';

const CRON_SECRET = process.env.CRON_SECRET;

/** Only collect engagement for posts published within this window. */
const COLLECTION_WINDOW_DAYS = 7;

/** Max posts to process per invocation. */
const BATCH_SIZE = 50;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = authHeader?.replace('Bearer ', '');

  if (!CRON_SECRET || cronSecret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[collect-engagement] Starting engagement collection...');
  const startTime = Date.now();

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - COLLECTION_WINDOW_DAYS);

  // Find recently published posts with Facebook/Instagram as a platform
  // Race condition protection: We check isNewEngagement flag before incrementing daily stats
  const publishedPosts = await db.scheduledPost.findMany({
    where: {
      status: 'PUBLISHED',
      publishedAt: { gte: cutoff },
      publishResults: { not: undefined },
    },
    orderBy: { publishedAt: 'desc' },
    take: BATCH_SIZE,
    include: {
      bot: { select: { id: true, userId: true } },
    },
  });

  console.log(`[collect-engagement] Found ${publishedPosts.length} posts to check`);

  let collected = 0;
  let errors = 0;

  for (const post of publishedPosts) {
    const results = post.publishResults as Record<
      string,
      { success: boolean; externalId?: string }
    > | null;
    if (!results) continue;

    for (const [platform, result] of Object.entries(results)) {
      if (!result.success || !result.externalId) continue;
      if (platform !== 'FACEBOOK' && platform !== 'INSTAGRAM') continue;

      // Get platform connection
      const conn = await db.platformConnection.findUnique({
        where: {
          botId_platform: { botId: post.botId, platform: platform as PlatformType },
        },
      });
      if (!conn || conn.status !== 'CONNECTED') continue;

      try {
        let engagement: { likes: number; comments: number; shares: number } | null = null;

        if (platform === 'FACEBOOK') {
          const creds = decryptFacebookCredentials(conn);
          engagement = await getPostEngagement(creds, result.externalId);
        } else if (platform === 'INSTAGRAM') {
          const creds = decryptInstagramCredentials(conn);
          const insights = await getMediaInsights(creds, result.externalId);
          if (insights) {
            engagement = {
              likes: insights.likes || 0,
              comments: insights.comments || 0,
              shares: insights.shares || 0,
            };
          }
        }

        if (!engagement) {
          errors++;
          continue;
        }

        // Update BotActivity record with engagement data
        await db.botActivity.updateMany({
          where: {
            botId: post.botId,
            platform: platform as PlatformType,
            postId: result.externalId,
            action: 'POST',
          },
          data: {
            likes: engagement.likes,
            comments: engagement.comments,
            shares: engagement.shares,
          },
        });

        // Check if this is new or existing engagement (for daily stats)
        const existingEngagement = await db.postEngagement.findFirst({
          where: {
            botId: post.botId,
            platform: platform as PlatformType,
            externalPostId: result.externalId,
          },
        });
        const isNewEngagement = !existingEngagement;

        const engagementScore =
          engagement.likes * 1 +
          engagement.comments * 3 +
          engagement.shares * 5;

        if (existingEngagement) {
          await db.postEngagement.update({
            where: { id: existingEngagement.id },
            data: {
              likes: engagement.likes,
              comments: engagement.comments,
              shares: engagement.shares,
              engagementScore,
              collectedAt: new Date(),
            },
          });
        } else {
          await db.postEngagement.create({
            data: {
              botId: post.botId,
              platform: platform as PlatformType,
              scheduledPostId: post.id,
              externalPostId: result.externalId,
              likes: engagement.likes,
              comments: engagement.comments,
              shares: engagement.shares,
              engagementScore,
              contentType: post.contentType || undefined,
              postedAt: post.publishedAt || post.createdAt,
              collectedAt: new Date(),
            },
          });
        }

        // Update daily stats only if this is the first time collecting
        // This prevents double-counting when cron jobs overlap
        if (post.publishedAt && isNewEngagement) {
          const postDate = new Date(post.publishedAt);
          postDate.setHours(0, 0, 0, 0);

          await db.botDailyStat.upsert({
            where: { botId_date: { botId: post.botId, date: postDate } },
            create: {
              botId: post.botId,
              date: postDate,
              totalLikes: engagement.likes,
              totalComments: engagement.comments,
              totalShares: engagement.shares,
            },
            update: {
              totalLikes: { increment: engagement.likes },
              totalComments: { increment: engagement.comments },
              totalShares: { increment: engagement.shares },
            },
          });
        }

        collected++;
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[collect-engagement] Failed for post ${post.id}, platform ${platform}:`, msg);
        errors++;
      }

      // Rate-limit friendly delay between API calls
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  const duration = Date.now() - startTime;
  console.log(`[collect-engagement] Completed in ${duration}ms: ${collected} collected, ${errors} errors`);

  return NextResponse.json({
    postsScanned: publishedPosts.length,
    engagementCollected: collected,
    errors,
  });
}
