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
import type { PlatformType } from '@prisma/client';

const CRON_SECRET = process.env.CRON_SECRET;

/** Only collect engagement for posts published within this window. */
const COLLECTION_WINDOW_DAYS = 7;

/** Max posts to process per invocation. */
const BATCH_SIZE = 50;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = authHeader?.replace('Bearer ', '');

  if (CRON_SECRET && cronSecret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - COLLECTION_WINDOW_DAYS);

  // Find recently published posts with Facebook as a platform
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
      if (platform !== 'FACEBOOK') continue; // Only Facebook for now

      // Get Facebook connection
      const conn = await db.platformConnection.findUnique({
        where: {
          botId_platform: { botId: post.botId, platform: platform as PlatformType },
        },
      });
      if (!conn || conn.status !== 'CONNECTED') continue;

      try {
        const creds = decryptFacebookCredentials(conn);
        const engagement = await getPostEngagement(creds, result.externalId);

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

        // Upsert PostEngagement record for RL engine
        const existingEngagement = await db.postEngagement.findFirst({
          where: {
            botId: post.botId,
            platform: platform as PlatformType,
            externalPostId: result.externalId,
          },
        });

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

        // Update daily stats with latest engagement totals
        if (post.publishedAt) {
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
      } catch {
        errors++;
      }

      // Rate-limit friendly delay between API calls
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  return NextResponse.json({
    postsScanned: publishedPosts.length,
    engagementCollected: collected,
    errors,
  });
}
