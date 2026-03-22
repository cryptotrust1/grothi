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
import { getActionCost, getUserBalance } from '@/lib/credits';
import type { PlatformType, PostSource } from '@prisma/client';

/** Maximum posts to generate in a single plan */
const MAX_PLAN_POSTS = 300;

// Parse a cron hour field (e.g. "9,13,18" or "* /3") into an array of hours (0-23).
// Used to convert bot.postingSchedule into posting hours for plan generation.
// Returns null if the cron expression is empty/invalid.
function parseCronToHours(cronExpression: string | null): number[] | null {
  if (!cronExpression || cronExpression.trim() === '') return null;
  const parts = cronExpression.trim().split(/\s+/);
  // Standard cron: minute hour day month weekday
  if (parts.length < 2) return null;
  const hourField = parts[1];

  const hours: number[] = [];
  // Handle each comma-separated segment
  for (const segment of hourField.split(',')) {
    const trimmed = segment.trim();
    // */N pattern (every N hours)
    const stepMatch = trimmed.match(/^\*\/(\d+)$/);
    if (stepMatch) {
      const step = parseInt(stepMatch[1], 10);
      if (step >= 1 && step <= 24) {
        for (let h = 0; h < 24; h += step) hours.push(h);
      }
      continue;
    }
    // Range: start-end (must check BEFORE single number — parseInt("9-17") returns 9)
    const rangeMatch = trimmed.match(/^(\d+)-(\d+)$/);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1], 10);
      const end = parseInt(rangeMatch[2], 10);
      if (start >= 0 && end <= 23 && start <= end) {
        for (let h = start; h <= end; h++) hours.push(h);
      }
      continue;
    }
    // Single number (only after range check to avoid partial parsing)
    const num = parseInt(trimmed, 10);
    if (!isNaN(num) && num >= 0 && num <= 23 && String(num) === trimmed) {
      hours.push(num);
      continue;
    }
    // Wildcard *
    if (trimmed === '*') return null; // * means every hour — not useful as override
  }
  return hours.length > 0 ? [...new Set(hours)].sort((a, b) => a - b) : null;
}

interface GeneratePlanRequest {
  botId: string;
  duration?: number;  // 3, 5, 7, 14, 30, or 60 days
  startDate?: string; // ISO date string (YYYY-MM-DD) — custom date range start
  endDate?: string;   // ISO date string (YYYY-MM-DD) — custom date range end
  preview?: boolean;  // If true, return cost estimate without creating posts
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
      return NextResponse.json({
        error: 'Unauthorized',
        code: 'AUTH_REQUIRED',
        detail: 'You must be logged in to generate a content plan.',
      }, { status: 401 });
    }

    let body: GeneratePlanRequest;
    try {
      body = await request.json() as GeneratePlanRequest;
    } catch {
      return NextResponse.json({
        error: 'Invalid request body',
        code: 'INVALID_JSON',
        detail: 'The request body must be valid JSON with a botId field.',
      }, { status: 400 });
    }
    const { botId, preview } = body;

    if (!botId || typeof botId !== 'string') {
      return NextResponse.json({
        error: 'botId is required',
        code: 'MISSING_BOT_ID',
        detail: 'Provide a valid bot ID to generate a plan for.',
      }, { status: 400 });
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
      return NextResponse.json({
        error: 'Bot not found',
        code: 'BOT_NOT_FOUND',
        detail: 'The specified bot does not exist or you do not have access to it.',
      }, { status: 404 });
    }

    // Concurrency guard: prevent double-submission (min 60s between plan generations)
    if (bot.lastPlanGeneratedAt) {
      const secondsSinceLast = (Date.now() - new Date(bot.lastPlanGeneratedAt).getTime()) / 1000;
      if (secondsSinceLast < 60) {
        return NextResponse.json({
          error: 'Please wait before generating another plan',
          code: 'RATE_LIMITED',
          detail: `A plan was generated ${Math.round(secondsSinceLast)} seconds ago. Please wait at least 60 seconds.`,
        }, { status: 429 });
      }
    }

    // Optimistic lock: set lastPlanGeneratedAt immediately to prevent concurrent requests
    await db.bot.update({
      where: { id: botId },
      data: { lastPlanGeneratedAt: new Date() },
    });

    // Determine duration and custom start date from either date range or duration param
    let duration: number;
    let customPlanStart: Date | null = null;

    if (body.startDate && body.endDate) {
      // Custom date range mode
      const start = new Date(body.startDate + 'T00:00:00');
      const end = new Date(body.endDate + 'T23:59:59');
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return NextResponse.json({ error: 'Invalid date format. Use YYYY-MM-DD.' }, { status: 400 });
      }
      if (end <= start) {
        return NextResponse.json({ error: 'End date must be after start date.' }, { status: 400 });
      }
      const diffMs = end.getTime() - start.getTime();
      duration = Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1; // inclusive
      if (duration > 90) {
        return NextResponse.json({ error: 'Date range cannot exceed 90 days.' }, { status: 400 });
      }
      customPlanStart = start;
    } else {
      duration = body.duration || bot.planDuration || 7;
      if (![3, 5, 7, 14, 30, 60].includes(duration)) {
        return NextResponse.json({ error: 'Duration must be 3, 5, 7, 14, 30, or 60 days' }, { status: 400 });
      }
    }

    // Get connected platforms
    const connectedPlatforms = bot.platformConns
      .filter(p => p.status === 'CONNECTED')
      .map(p => p.platform);

    if (connectedPlatforms.length === 0) {
      return NextResponse.json({
        error: 'No connected platforms',
        code: 'NO_PLATFORMS',
        detail: 'Connect at least one social media platform before generating a content plan. Go to Platforms settings to connect your accounts.',
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

    // Get reactor state
    const reactorState = (bot.reactorState as Record<string, unknown>) || {};
    const contentTypes = (reactorState.contentTypes as string[]) || ['educational', 'engagement'];
    const toneStyles = (reactorState.toneStyles as string[]) || ['professional', 'casual'];
    const hashtagPatterns = (reactorState.hashtagPatterns as string[]) || ['moderate'];
    const selfLearning = (reactorState.selfLearning as boolean) ?? true;

    // Post intensity multiplier — adjusts how many posts per day
    const intensityLevel = (reactorState.autopilotIntensity as string) || 'recommended';
    const INTENSITY_MULTIPLIERS: Record<string, number> = {
      low: 0.5,
      recommended: 1.0,
      high: 1.5,
      extreme: 2.5,
    };
    const intensityMultiplier = INTENSITY_MULTIPLIERS[intensityLevel] ?? 1.0;

    // Get RL insights for best-performing content dimensions — only if self-learning is enabled
    const rlInsights = selfLearning
      ? getRLInsights(bot.rlArmStates)
      : { bestTone: {} as Record<string, string>, bestContentType: {} as Record<string, string>, bestTimeSlot: {} as Record<string, number> };

    // Build available media pools
    const imageMedia = bot.media.filter(m => m.type === 'IMAGE');
    const videoMedia = bot.media.filter(m => m.type === 'VIDEO');

    // Build product rotation pool — filter by user selection if applicable
    const productRotationMode = (reactorState.autopilotProductRotationMode as string) || 'all';
    const selectedProductIds = (reactorState.autopilotSelectedProductIds as string[]) || [];
    const products = productRotationMode === 'selected' && selectedProductIds.length > 0
      ? bot.products.filter(p => selectedProductIds.includes(p.id))
      : bot.products;
    let productIndex = 0;

    // Generate plan slots
    const slots: PlanSlot[] = [];
    // If custom start date is set, use it; otherwise start 1 hour from now
    const startDate = customPlanStart || new Date(now.getTime() + 60 * 60 * 1000);

    // Load existing scheduled posts to detect time conflicts
    const planEnd = new Date(startDate);
    planEnd.setDate(planEnd.getDate() + duration);
    const existingPosts = await db.scheduledPost.findMany({
      where: {
        botId,
        status: { in: ['DRAFT', 'SCHEDULED', 'PUBLISHED', 'PUBLISHING'] },
        scheduledAt: { gte: startDate, lte: planEnd },
      },
      select: { platforms: true, scheduledAt: true },
    });

    // Build a set of occupied time slots: "PLATFORM:YYYY-MM-DDTHH"
    const occupiedSlots = new Set<string>();
    for (const ep of existingPosts) {
      if (!ep.scheduledAt) continue;
      const key = `${(ep.platforms as string[])[0]}:${ep.scheduledAt.toISOString().slice(0, 13)}`;
      occupiedSlots.add(key);
    }

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
          dailyTexts = plan?.dailyTexts ?? 1;
          dailyImages = plan?.dailyImages ?? 0;
          dailyVideos = plan?.dailyVideos ?? 0;
          dailyStories = plan?.dailyStories ?? 0;
        }

        // Apply intensity multiplier
        if (intensityMultiplier !== 1.0) {
          dailyTexts = Math.max(0, Math.round(dailyTexts * intensityMultiplier));
          dailyImages = Math.max(0, Math.round(dailyImages * intensityMultiplier));
          dailyVideos = Math.max(0, Math.round(dailyVideos * intensityMultiplier));
          dailyStories = Math.max(0, Math.round(dailyStories * intensityMultiplier));
          // Ensure at least 1 post on low intensity (avoid 0 total)
          if (intensityMultiplier < 1 && dailyTexts + dailyImages + dailyVideos + dailyStories === 0) {
            dailyTexts = 1;
          }
        }

        // On non-best days, reduce volume slightly
        if (!isBestDay) {
          dailyTexts = Math.max(0, dailyTexts - 1);
          dailyImages = Math.max(0, Math.ceil(dailyImages * 0.7));
          dailyVideos = Math.max(0, Math.ceil(dailyVideos * 0.7));
        }

        // Get posting hours — priority: user plan > bot postingSchedule > RL best time slot > algorithm optimal hours
        let postingHours: number[];
        const botScheduleHours = parseCronToHours(bot.postingSchedule);
        if (plan?.postingHours) {
          // User-configured per-platform posting hours take highest priority
          postingHours = plan.postingHours as number[];
        } else if (botScheduleHours) {
          // Bot-level posting schedule (cron expression from settings) as fallback
          postingHours = botScheduleHours;
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

        // Track promo count per platform PER DAY for accurate limit enforcement
        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(date);
        dayEnd.setHours(23, 59, 59, 999);
        const todaySlots = slots.filter(s =>
          s.platform === platform &&
          s.scheduledAt >= dayStart &&
          s.scheduledAt <= dayEnd
        );
        const platformPromoCount = todaySlots.filter(s => s.productId).length;
        const platformTotalCount = todaySlots.length;

        // Get minimum post interval for this platform
        const minInterval = getMinPostInterval(platform);
        let lastPostHour = -minInterval;  // Allow first post at any time

        for (const slot of postSlots) {
          if (slots.length >= MAX_PLAN_POSTS) break;

          // Enforce minimum post interval to avoid cannibalization
          if (slot.hour - lastPostHour < minInterval && lastPostHour >= 0) {
            continue;  // Skip this slot — too close to previous post
          }

          // Schedule in the bot's timezone by creating a date string with explicit offset
          const botTimezone = bot.timezone || 'UTC';
          const dateStr = date.toISOString().slice(0, 10); // YYYY-MM-DD
          const minute = Math.floor(Math.random() * 60);
          let scheduledAt: Date;
          try {
            // Use Intl to convert bot's local hour to UTC
            const localDateStr = `${dateStr}T${String(slot.hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
            const formatter = new Intl.DateTimeFormat('en-US', { timeZone: botTimezone, timeZoneName: 'longOffset' });
            // Create date assuming UTC, then adjust
            const tempDate = new Date(localDateStr + 'Z');
            const parts = formatter.formatToParts(tempDate);
            // Fallback: use the date as-is if timezone conversion fails
            scheduledAt = tempDate;
            // Simple offset-based approach: get the timezone offset
            const tzDate = new Date(new Date().toLocaleString('en-US', { timeZone: botTimezone }));
            const utcDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'UTC' }));
            const offsetMs = utcDate.getTime() - tzDate.getTime();
            scheduledAt = new Date(new Date(`${localDateStr}Z`).getTime() + offsetMs);
          } catch {
            // Fallback to server-local time if timezone is invalid
            scheduledAt = new Date(date);
            scheduledAt.setHours(slot.hour, minute, 0, 0);
          }

          // Conflict detection: check if a post already exists at this platform+hour
          const slotKey = `${platform}:${scheduledAt.toISOString().slice(0, 13)}`;
          if (occupiedSlots.has(slotKey)) {
            // Try shifting to the next available hour within the same day
            let shifted = false;
            for (let offset = 1; offset <= 3; offset++) {
              const altHour = slot.hour + offset;
              if (altHour > 23) break;
              // Use same timezone-aware approach for alt slots
              const altMinute = Math.floor(Math.random() * 60);
              const altLocalStr = `${dateStr}T${String(altHour).padStart(2, '0')}:${String(altMinute).padStart(2, '0')}:00`;
              let altAt: Date;
              try {
                const tzD = new Date(new Date().toLocaleString('en-US', { timeZone: botTimezone }));
                const utcD = new Date(new Date().toLocaleString('en-US', { timeZone: 'UTC' }));
                const offMs = utcD.getTime() - tzD.getTime();
                altAt = new Date(new Date(`${altLocalStr}Z`).getTime() + offMs);
              } catch {
                altAt = new Date(date);
                altAt.setHours(altHour, altMinute, 0, 0);
              }
              const altKey = `${platform}:${altAt.toISOString().slice(0, 13)}`;
              if (!occupiedSlots.has(altKey)) {
                scheduledAt = altAt;
                shifted = true;
                break;
              }
            }
            if (!shifted) continue; // Skip — no available slot this day for this platform
          }
          // Mark this slot as occupied
          occupiedSlots.add(`${platform}:${scheduledAt.toISOString().slice(0, 13)}`);

          // Select content type — custom override > per-platform checkboxes > RL insights > global
          let contentType: string;
          if (plan?.customContentType) {
            // User-defined custom content type takes absolute priority
            contentType = plan.customContentType;
          } else {
            const platformContentTypesOverride = plan?.contentTypesOverride
              ? (plan.contentTypesOverride as string[])
              : null;
            const effectiveContentTypes = platformContentTypesOverride || contentTypes;
            const platformBestTypes = algo.bestContentTypes.filter(t =>
              effectiveContentTypes.includes(t)
            );
            contentType = rlInsights.bestContentType[platform]
              || (platformBestTypes.length > 0
                ? platformBestTypes[Math.floor(Math.random() * platformBestTypes.length)]
                : effectiveContentTypes[Math.floor(Math.random() * effectiveContentTypes.length)]);
          }

          // Select tone — custom override > per-platform checkboxes > RL insights > global
          let toneStyle: string;
          if (plan?.customToneStyle) {
            // User-defined custom tone takes absolute priority
            toneStyle = plan.customToneStyle;
          } else {
            const platformTonesOverride = plan?.tonesOverride
              ? (plan.tonesOverride as string[])
              : null;
            const effectiveTones = platformTonesOverride
              || (plan?.toneOverride ? [plan.toneOverride] : toneStyles);
            const platformTones = algo.bestTones.filter(t => effectiveTones.includes(t));
            toneStyle = rlInsights.bestTone[platform]
              || (platformTones.length > 0
                ? platformTones[Math.floor(Math.random() * platformTones.length)]
                : effectiveTones[Math.floor(Math.random() * effectiveTones.length)]);
          }

          // Select hashtag pattern — per-platform override > global
          const platformHashtagPatternsOverride = plan?.hashtagPatternsOverride
            ? (plan.hashtagPatternsOverride as string[])
            : null;
          const effectiveHashtagPatterns = platformHashtagPatternsOverride
            || (plan?.hashtagOverride ? [plan.hashtagOverride] : hashtagPatterns);
          const hashtagPattern = effectiveHashtagPatterns.length > 0
            ? effectiveHashtagPatterns[Math.floor(Math.random() * effectiveHashtagPatterns.length)]
            : (algo.hashtags.strategy || hashtagPatterns[Math.floor(Math.random() * hashtagPatterns.length)]);

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

    // Deduplicate: remove slots with identical platform + hour (same day)
    // Two posts at the exact same time on the same platform hurts algorithm reach
    const seenSlotKeys = new Set<string>();
    const deduplicatedSlots: PlanSlot[] = [];
    for (const slot of slots) {
      const key = `${slot.platform}:${slot.scheduledAt.toISOString().slice(0, 13)}`; // platform:YYYY-MM-DDTHH
      if (seenSlotKeys.has(key)) continue;
      seenSlotKeys.add(key);
      deduplicatedSlots.push(slot);
    }

    // Shuffle content types per platform to avoid consecutive repeats
    // (e.g., 3 educational posts in a row looks spammy to the algorithm)
    const slotsByPlatform = new Map<string, PlanSlot[]>();
    for (const slot of deduplicatedSlots) {
      const existing = slotsByPlatform.get(slot.platform) || [];
      existing.push(slot);
      slotsByPlatform.set(slot.platform, existing);
    }
    const platformKeys = Array.from(slotsByPlatform.keys());
    for (const pKey of platformKeys) {
      const platformSlots = slotsByPlatform.get(pKey)!;
      // Sort by time first
      platformSlots.sort((a: PlanSlot, b: PlanSlot) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
      // Detect consecutive same contentType and swap with next different one
      for (let i = 1; i < platformSlots.length - 1; i++) {
        if (platformSlots[i].contentType === platformSlots[i - 1].contentType) {
          // Find the next different content type to swap with
          for (let j = i + 1; j < platformSlots.length; j++) {
            if (platformSlots[j].contentType !== platformSlots[i].contentType) {
              // Swap content types and tones (keep scheduled times)
              const tmpType = platformSlots[i].contentType;
              const tmpTone = platformSlots[i].toneStyle;
              platformSlots[i].contentType = platformSlots[j].contentType;
              platformSlots[i].toneStyle = platformSlots[j].toneStyle;
              platformSlots[j].contentType = tmpType;
              platformSlots[j].toneStyle = tmpTone;
              break;
            }
          }
        }
      }
    }

    // Sort all slots by scheduled time
    deduplicatedSlots.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());

    // Use the deduplicated slots from here
    const finalSlots = deduplicatedSlots;

    // If preview mode, calculate exact cost and return WITHOUT creating posts
    if (preview) {
      const generateCost = await getActionCost('GENERATE_CONTENT');
      const postCost = await getActionCost('POST');
      const userBalance = await getUserBalance(user.id);

      // Each autopilot post costs: GENERATE_CONTENT (AI writes it) + POST per platform (publishing)
      // Each slot has exactly 1 platform
      const totalGenerationCredits = finalSlots.length * generateCost;
      const totalPublishCredits = finalSlots.length * postCost;
      const totalCredits = totalGenerationCredits + totalPublishCredits;

      // Build per-platform breakdown
      const platformBreakdown: Record<string, { posts: number; generationCredits: number; publishCredits: number; totalCredits: number }> = {};
      for (const slot of finalSlots) {
        const name = PLATFORM_NAMES[slot.platform] || slot.platform;
        if (!platformBreakdown[name]) {
          platformBreakdown[name] = { posts: 0, generationCredits: 0, publishCredits: 0, totalCredits: 0 };
        }
        platformBreakdown[name].posts += 1;
        platformBreakdown[name].generationCredits += generateCost;
        platformBreakdown[name].publishCredits += postCost;
        platformBreakdown[name].totalCredits += generateCost + postCost;
      }

      return NextResponse.json({
        preview: true,
        cost: {
          totalPosts: finalSlots.length,
          creditsPerPost: {
            generation: generateCost,
            publishing: postCost,
            total: generateCost + postCost,
          },
          totalGenerationCredits,
          totalPublishCredits,
          totalCredits,
          userBalance,
          hasEnoughCredits: userBalance >= totalCredits,
          shortfall: Math.max(0, totalCredits - userBalance),
          platformBreakdown,
          duration,
          startDate: finalSlots[0]?.scheduledAt,
          endDate: finalSlots[finalSlots.length - 1]?.scheduledAt,
        },
      });
    }

    // Check user has enough credits BEFORE creating any posts
    // Each post costs: GENERATE_CONTENT + POST
    const generateCostCheck = await getActionCost('GENERATE_CONTENT');
    const postCostCheck = await getActionCost('POST');
    const totalCostCheck = finalSlots.length * (generateCostCheck + postCostCheck);
    const balanceCheck = await getUserBalance(user.id);
    if (balanceCheck < totalCostCheck) {
      const shortfall = totalCostCheck - balanceCheck;
      return NextResponse.json({
        error: 'Insufficient credits',
        code: 'INSUFFICIENT_CREDITS',
        detail: `This plan requires ${totalCostCheck} credits (${finalSlots.length} posts × ${generateCostCheck + postCostCheck} cr/post) but you only have ${balanceCheck} credits. You need ${shortfall} more credits.`,
        data: {
          required: totalCostCheck,
          available: balanceCheck,
          shortfall,
          postsPlanned: finalSlots.length,
          costPerPost: generateCostCheck + postCostCheck,
        },
      }, { status: 402 });
    }

    // Determine initial status based on approval mode
    const initialStatus = bot.approvalMode === 'AUTO_APPROVE' ? 'SCHEDULED' : 'DRAFT';

    // Create all scheduled posts in batches to prevent transaction timeouts
    const BATCH_CREATE_SIZE = 50;
    let createdCount = 0;

    for (let batchStart = 0; batchStart < finalSlots.length; batchStart += BATCH_CREATE_SIZE) {
      const batch = finalSlots.slice(batchStart, batchStart + BATCH_CREATE_SIZE);

      await db.scheduledPost.createMany({
        data: batch.map(slot => {
          const platformName = PLATFORM_NAMES[slot.platform] || slot.platform;
          const contentTypeLabel = CONTENT_TYPES.find(ct => ct.value === slot.contentType)?.label || slot.contentType;
          const formatNote = slot.contentFormat ? ` [Format: ${slot.contentFormat}]` : '';
          const placeholderContent = `[AUTOPILOT] ${contentTypeLabel} for ${platformName}${formatNote} — AI content generation pending`;

          return {
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
          };
        }),
      });

      createdCount += batch.length;
    }

    // Update bot's last plan generation time
    await db.bot.update({
      where: { id: botId },
      data: { lastPlanGeneratedAt: now },
    });

    // Group results by platform for response
    const platformBreakdown: Record<string, number> = {};
    for (const slot of finalSlots) {
      const name = PLATFORM_NAMES[slot.platform] || slot.platform;
      platformBreakdown[name] = (platformBreakdown[name] || 0) + 1;
    }

    return NextResponse.json({
      success: true,
      plan: {
        totalPosts: createdCount,
        duration,
        status: initialStatus,
        platformBreakdown,
        startDate: finalSlots[0]?.scheduledAt,
        endDate: finalSlots[finalSlots.length - 1]?.scheduledAt,
        intensity: intensityLevel,
        conflictsResolved: existingPosts.length,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('[autonomous/generate-plan] Error:', errorMessage);
    if (errorStack) console.error('[autonomous/generate-plan] Stack:', errorStack);

    // Classify the error for a helpful response
    let code = 'INTERNAL_ERROR';
    let detail = 'An unexpected error occurred while generating the content plan. Please try again.';
    let status = 500;

    if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
      code = 'TIMEOUT';
      detail = 'The plan generation took too long. Try a shorter duration or fewer platforms.';
      status = 504;
    } else if (errorMessage.includes('connect') || errorMessage.includes('ECONNREFUSED')) {
      code = 'DATABASE_ERROR';
      detail = 'Could not connect to the database. Please try again in a moment.';
      status = 503;
    }

    return NextResponse.json(
      { error: 'Failed to generate content plan', code, detail },
      { status }
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
