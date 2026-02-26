/**
 * POST /api/autonomous/generate-plan
 *
 * Generates an autonomous content plan for a bot.
 * Creates ScheduledPost entries for the specified duration (7, 14, or 30 days).
 *
 * The plan uses:
 * - Platform algorithm knowledge (platform-algorithm.ts)
 * - Bot's connected platforms and their content strategies
 * - Bot's products for promotional rotation
 * - Bot's media library for image/video selection
 * - Bot's brand knowledge, instructions, and creative preferences
 * - RL engine insights (what tones/types/times work best)
 * - User approval mode (REVIEW_ALL → DRAFT, AUTO_APPROVE → SCHEDULED)
 *
 * Auth: Requires authenticated user who owns the bot.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  PLATFORM_ALGORITHM,
  getContentGenerationContext,
  getRecommendedPlan,
  getOptimalHoursForPlatform,
  getMinPostInterval,
  wouldExceedPromoLimit,
  getBestContentFormat,
} from '@/lib/platform-algorithm';
import { PLATFORM_NAMES, CONTENT_TYPES } from '@/lib/constants';
import type { PlatformType, PostSource } from '@prisma/client';

/** Maximum posts to generate in a single plan */
const MAX_PLAN_POSTS = 300;

interface GeneratePlanRequest {
  botId: string;
  duration?: number;  // 7, 14, or 30 days
}

interface PlanSlot {
  platform: string;
  scheduledAt: Date;
  contentType: string;
  toneStyle: string;
  hashtagPattern: string;
  productId: string | null;
  mediaId: string | null;
  postType: string | null;
  contentFormat: string | null;  // e.g. 'Reels (15-60s)', 'Carousel', 'Thread'
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as GeneratePlanRequest;
    const { botId } = body;

    if (!botId) {
      return NextResponse.json({ error: 'botId is required' }, { status: 400 });
    }

    // Load bot with all related data
    const bot = await db.bot.findFirst({
      where: { id: botId, userId: user.id },
      include: {
        platformConns: true,
        contentPlans: true,
        products: { where: { isActive: true } },
        media: {
          where: { generationStatus: { not: 'PENDING' } },
          orderBy: { createdAt: 'desc' },
          take: 100,
        },
        rlArmStates: true,
      },
    });

    if (!bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
    }

    const duration = body.duration || bot.planDuration || 7;
    if (![7, 14, 30].includes(duration)) {
      return NextResponse.json({ error: 'Duration must be 7, 14, or 30 days' }, { status: 400 });
    }

    // Get connected platforms
    const connectedPlatforms = bot.platformConns
      .filter(p => p.status === 'CONNECTED')
      .map(p => p.platform);

    if (connectedPlatforms.length === 0) {
      return NextResponse.json({
        error: 'No connected platforms. Connect at least one platform before generating a plan.',
      }, { status: 400 });
    }

    // Check for existing future posts to avoid duplicates
    const now = new Date();
    const existingFuturePosts = await db.scheduledPost.count({
      where: {
        botId,
        source: 'AUTOPILOT',
        status: { in: ['DRAFT', 'SCHEDULED'] },
        scheduledAt: { gte: now },
      },
    });

    if (existingFuturePosts > 50) {
      return NextResponse.json({
        error: `You already have ${existingFuturePosts} pending autopilot posts. Please review or clear existing posts before generating a new plan.`,
      }, { status: 400 });
    }

    // Build content plan slots per platform
    const planByPlatform = new Map<string, typeof bot.contentPlans[0]>();
    for (const plan of bot.contentPlans) {
      planByPlatform.set(plan.platform, plan);
    }

    // Get RL insights for best-performing content dimensions
    const rlInsights = getRLInsights(bot.rlArmStates);

    // Get reactor state
    const reactorState = (bot.reactorState as Record<string, unknown>) || {};
    const contentTypes = (reactorState.contentTypes as string[]) || ['educational', 'engagement'];
    const toneStyles = (reactorState.toneStyles as string[]) || ['professional', 'casual'];
    const hashtagPatterns = (reactorState.hashtagPatterns as string[]) || ['moderate'];

    // Build available media pools
    const imageMedia = bot.media.filter(m => m.type === 'IMAGE');
    const videoMedia = bot.media.filter(m => m.type === 'VIDEO');

    // Build product rotation pool
    const products = bot.products;
    let productIndex = 0;

    // Generate plan slots
    const slots: PlanSlot[] = [];
    const startDate = new Date(now.getTime() + 60 * 60 * 1000); // Start 1 hour from now

    for (let day = 0; day < duration; day++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + day);
      const dayOfWeek = date.getDay(); // 0=Sun, 6=Sat
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      for (const platform of connectedPlatforms) {
        const algo = PLATFORM_ALGORITHM[platform];
        if (!algo) continue;

        // Skip weekends for platforms that don't benefit (LinkedIn)
        if (isWeekend && algo.bestTimesWeekend.length === 0) continue;

        // Check if this day is a "best day" for this platform
        const isBestDay = algo.bestDays.includes(dayOfWeek);

        // Get content plan or AI recommendation
        const plan = planByPlatform.get(platform);
        const useAI = bot.contentMixMode === 'AI_RECOMMENDED' || !plan;

        let dailyTexts: number, dailyImages: number, dailyVideos: number, dailyStories: number;

        if (useAI) {
          const rec = getRecommendedPlan(platform);
          dailyTexts = rec.dailyTexts;
          dailyImages = rec.dailyImages;
          dailyVideos = rec.dailyVideos;
          dailyStories = rec.dailyStories;
        } else {
          dailyTexts = plan!.dailyTexts;
          dailyImages = plan!.dailyImages;
          dailyVideos = plan!.dailyVideos;
          dailyStories = plan!.dailyStories;
        }

        // On non-best days, reduce volume slightly
        if (!isBestDay) {
          dailyTexts = Math.max(0, dailyTexts - 1);
          dailyImages = Math.max(0, Math.ceil(dailyImages * 0.7));
          dailyVideos = Math.max(0, Math.ceil(dailyVideos * 0.7));
        }

        // Get posting hours — priority: user plan > RL best time slot > algorithm optimal hours
        let postingHours: number[];
        if (plan?.postingHours) {
          // User-configured posting hours take highest priority
          postingHours = plan.postingHours as number[];
        } else {
          // Use the algorithm's optimal hours helper (sorted by engagement data)
          postingHours = getOptimalHoursForPlatform(platform);
          // If RL engine has learned a best time slot, prioritize it
          const rlBestHour = rlInsights.bestTimeSlot[platform];
          if (rlBestHour !== undefined && !postingHours.includes(rlBestHour)) {
            // Insert RL's best hour at the front so it gets first pick
            postingHours = [rlBestHour, ...postingHours];
          } else if (rlBestHour !== undefined) {
            // Move RL's best hour to front of the array
            postingHours = [rlBestHour, ...postingHours.filter(h => h !== rlBestHour)];
          }
          // For weekends, filter to weekend-appropriate hours if available
          if (isWeekend && algo.bestTimesWeekend.length > 0) {
            const weekendSet = new Set(algo.bestTimesWeekend);
            const weekendFiltered = postingHours.filter(h => weekendSet.has(h));
            if (weekendFiltered.length > 0) postingHours = weekendFiltered;
          }
        }

        if (postingHours.length === 0) continue;

        // Distribute posts across available time slots
        const totalPosts = dailyTexts + dailyImages + dailyVideos + dailyStories;
        const postSlots: Array<{ type: 'text' | 'image' | 'video' | 'story'; hour: number }> = [];

        // Build ordered list of post types
        const types: Array<'text' | 'image' | 'video' | 'story'> = [];
        for (let i = 0; i < dailyTexts; i++) types.push('text');
        for (let i = 0; i < dailyImages; i++) types.push('image');
        for (let i = 0; i < dailyVideos; i++) types.push('video');
        for (let i = 0; i < dailyStories; i++) types.push('story');

        // Assign hours to posts
        for (let i = 0; i < types.length && i < postingHours.length; i++) {
          postSlots.push({ type: types[i], hour: postingHours[i % postingHours.length] });
        }
        // If more posts than hours, cycle through hours
        for (let i = postingHours.length; i < types.length; i++) {
          postSlots.push({ type: types[i], hour: postingHours[i % postingHours.length] });
        }

        // Track promo count per platform for limit enforcement
        const platformPromoCount = slots.filter(s => s.platform === platform && s.productId).length;
        const platformTotalCount = slots.filter(s => s.platform === platform).length;

        // Get minimum post interval for this platform
        const minInterval = getMinPostInterval(platform);
        let lastPostHour = -minInterval;  // Allow first post at any time

        for (const slot of postSlots) {
          if (slots.length >= MAX_PLAN_POSTS) break;

          // Enforce minimum post interval to avoid cannibalization
          if (slot.hour - lastPostHour < minInterval && lastPostHour >= 0) {
            continue;  // Skip this slot — too close to previous post
          }

          const scheduledAt = new Date(date);
          scheduledAt.setHours(slot.hour, Math.floor(Math.random() * 30), 0, 0);

          // Select content type — use RL insights if available
          const platformBestTypes = algo.bestContentTypes.filter(t =>
            contentTypes.includes(t)
          );
          const contentType = rlInsights.bestContentType[platform]
            || (platformBestTypes.length > 0
              ? platformBestTypes[Math.floor(Math.random() * platformBestTypes.length)]
              : contentTypes[Math.floor(Math.random() * contentTypes.length)]);

          // Select tone - use RL insights if available, otherwise rotate
          const platformTones = plan?.toneOverride
            ? [plan.toneOverride]
            : (algo.bestTones.filter(t => toneStyles.includes(t)));
          const toneStyle = rlInsights.bestTone[platform]
            || (platformTones.length > 0
              ? platformTones[Math.floor(Math.random() * platformTones.length)]
              : toneStyles[Math.floor(Math.random() * toneStyles.length)]);

          // Select hashtag pattern
          const hashtagPattern = plan?.hashtagOverride
            || algo.hashtags.strategy
            || hashtagPatterns[Math.floor(Math.random() * hashtagPatterns.length)];

          // Select media based on post type
          let mediaId: string | null = null;
          if (slot.type === 'image' && imageMedia.length > 0) {
            mediaId = imageMedia[Math.floor(Math.random() * imageMedia.length)].id;
          } else if ((slot.type === 'video' || slot.type === 'story') && videoMedia.length > 0) {
            mediaId = videoMedia[Math.floor(Math.random() * videoMedia.length)].id;
          }

          // Product rotation for promotional content — enforce platform promo limit
          let productId: string | null = null;
          if (
            bot.autopilotProductRotation &&
            products.length > 0 &&
            contentType === 'promotional' &&
            !wouldExceedPromoLimit(platform, platformTotalCount, platformPromoCount)
          ) {
            productId = products[productIndex % products.length].id;
            productIndex++;
          }

          // Determine post type for Instagram/TikTok
          let postType: string | null = null;
          if (platform === 'INSTAGRAM') {
            if (slot.type === 'video') postType = 'reel';
            else if (slot.type === 'story') postType = 'story';
            else postType = 'feed';
          }

          // Select best content format based on platform rankings
          const bestFormat = getBestContentFormat(platform);
          const contentFormat = bestFormat?.format || null;

          lastPostHour = slot.hour;

          slots.push({
            platform,
            scheduledAt,
            contentType,
            toneStyle,
            hashtagPattern,
            productId,
            mediaId,
            postType,
            contentFormat,
          });
        }
      }
    }

    if (slots.length === 0) {
      return NextResponse.json({
        error: 'Could not generate any posts. Check that your connected platforms have content plans configured, or enable AI-recommended content mix.',
      }, { status: 400 });
    }

    // Sort slots by scheduled time
    slots.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());

    // Determine initial status based on approval mode
    const initialStatus = bot.approvalMode === 'AUTO_APPROVE' ? 'SCHEDULED' : 'DRAFT';

    // Create all scheduled posts
    const createdPosts = await db.$transaction(
      slots.map(slot => {
        // Generate placeholder content - the actual AI content will be generated
        // by the autonomous planner cron job
        const platformName = PLATFORM_NAMES[slot.platform] || slot.platform;
        const contentTypeLabel = CONTENT_TYPES.find(ct => ct.value === slot.contentType)?.label || slot.contentType;
        const formatNote = slot.contentFormat ? ` [Format: ${slot.contentFormat}]` : '';
        const placeholderContent = `[AUTOPILOT] ${contentTypeLabel} for ${platformName}${formatNote} — AI content generation pending`;

        return db.scheduledPost.create({
          data: {
            botId,
            status: initialStatus as 'DRAFT' | 'SCHEDULED',
            content: placeholderContent,
            contentType: slot.contentType,
            mediaId: slot.mediaId,
            platforms: [slot.platform],
            scheduledAt: slot.scheduledAt,
            toneStyle: slot.toneStyle,
            hashtagPattern: slot.hashtagPattern,
            productId: slot.productId,
            postType: slot.postType,
            contentFormat: slot.contentFormat,
            source: 'AUTOPILOT' as PostSource,
            autoSchedule: bot.approvalMode === 'AUTO_APPROVE',
          },
        });
      })
    );

    // Update bot's last plan generation time
    await db.bot.update({
      where: { id: botId },
      data: { lastPlanGeneratedAt: now },
    });

    // Group results by platform for response
    const platformBreakdown: Record<string, number> = {};
    for (const slot of slots) {
      const name = PLATFORM_NAMES[slot.platform] || slot.platform;
      platformBreakdown[name] = (platformBreakdown[name] || 0) + 1;
    }

    return NextResponse.json({
      success: true,
      plan: {
        totalPosts: createdPosts.length,
        duration,
        status: initialStatus,
        platformBreakdown,
        startDate: slots[0]?.scheduledAt,
        endDate: slots[slots.length - 1]?.scheduledAt,
      },
    });
  } catch (error) {
    console.error('[autonomous/generate-plan] Error:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: 'Failed to generate content plan. Please try again.' },
      { status: 500 }
    );
  }
}

/**
 * Extract RL (Reinforcement Learning) insights from arm states.
 * Returns the best-performing tone, content type, and time slot per platform.
 */
function getRLInsights(armStates: Array<{
  platform: string;
  dimension: string;
  armKey: string;
  avgReward: number;
  pulls: number;
}>): {
  bestTone: Record<string, string>;
  bestContentType: Record<string, string>;
  bestTimeSlot: Record<string, number>;
} {
  const bestTone: Record<string, string> = {};
  const bestContentType: Record<string, string> = {};
  const bestTimeSlot: Record<string, number> = {};

  // Group by platform and dimension, find the best arm
  const grouped: Record<string, typeof armStates> = {};
  for (const arm of armStates) {
    const key = `${arm.platform}:${arm.dimension}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(arm);
  }

  for (const [key, arms] of Object.entries(grouped)) {
    const [platform, dimension] = key.split(':');
    // Require at least 5 pulls to consider an arm reliable
    const reliable = arms.filter(a => a.pulls >= 5);
    if (reliable.length === 0) continue;

    // Sort by average reward descending
    reliable.sort((a, b) => b.avgReward - a.avgReward);
    const best = reliable[0];

    switch (dimension) {
      case 'TONE_STYLE':
        bestTone[platform] = best.armKey;
        break;
      case 'CONTENT_TYPE':
        bestContentType[platform] = best.armKey;
        break;
      case 'TIME_SLOT':
        bestTimeSlot[platform] = parseInt(best.armKey, 10);
        break;
    }
  }

  return { bestTone, bestContentType, bestTimeSlot };
}
