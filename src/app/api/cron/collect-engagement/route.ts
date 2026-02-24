/**
 * POST /api/cron/collect-engagement
 *
 * Collects engagement metrics (likes, comments, shares) from published posts
 * on Facebook, Instagram, and Threads. Triggers RL learning after collection.
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
import {
  decryptThreadsCredentials,
  getPostInsights,
} from '@/lib/threads';
import { processEngagementFeedback } from '@/lib/rl-engine';
import type { PlatformType } from '@prisma/client';

/** Platforms that support engagement collection via API. */
const SUPPORTED_PLATFORMS = new Set(['FACEBOOK', 'INSTAGRAM', 'THREADS']);

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

  // Find recently published posts on supported platforms (Facebook, Instagram, Threads)
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
      if (!SUPPORTED_PLATFORMS.has(platform)) continue;

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
        } else if (platform === 'THREADS') {
          const creds = decryptThreadsCredentials(conn);
          const insights = await getPostInsights(creds, result.externalId);
          if (insights) {
            engagement = {
              likes: insights.likes || 0,
              comments: insights.replies || 0,
              shares: insights.reposts || 0,
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

        // Derive content dimensions from post data for RL learning
        const postTime = post.publishedAt || post.createdAt;
        const timeSlot = postTime.getHours();
        const dayOfWeek = postTime.getDay();

        let engagementId: string;

        if (existingEngagement) {
          await db.postEngagement.update({
            where: { id: existingEngagement.id },
            data: {
              likes: engagement.likes,
              comments: engagement.comments,
              shares: engagement.shares,
              engagementScore,
              // Backfill content dimensions if they were missing
              timeSlot: existingEngagement.timeSlot ?? timeSlot,
              dayOfWeek: existingEngagement.dayOfWeek ?? dayOfWeek,
              toneStyle: existingEngagement.toneStyle || post.toneStyle || undefined,
              hashtagPattern: existingEngagement.hashtagPattern || post.hashtagPattern || undefined,
              contentType: existingEngagement.contentType || post.contentType || undefined,
              collectedAt: new Date(),
            },
          });
          engagementId = existingEngagement.id;
        } else {
          const created = await db.postEngagement.create({
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
              timeSlot,
              dayOfWeek,
              toneStyle: post.toneStyle || undefined,
              hashtagPattern: post.hashtagPattern || undefined,
              postedAt: postTime,
              collectedAt: new Date(),
            },
          });
          engagementId = created.id;
        }

        // Trigger RL learning from the engagement data
        // IMPORTANT: Learn from ALL posts including zero-engagement ones.
        // Zero engagement is valuable signal — it teaches the RL engine what
        // content types/times/tones DON'T work. Without this, new bots with
        // no followers can never start learning (chicken-and-egg problem).
        // Reference: Even negative/zero rewards are valid in multi-armed bandit
        // algorithms (Auer et al., 2002; Chapelle & Li, 2011).
        try {
          await processEngagementFeedback(engagementId);
        } catch (rlError) {
          const rlMsg = rlError instanceof Error ? rlError.message : 'Unknown';
          console.error(`[collect-engagement] RL learning failed for ${engagementId}: ${rlMsg}`);
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
