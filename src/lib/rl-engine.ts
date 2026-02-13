// Content Reactor - Epsilon-Greedy Reinforcement Learning Engine
// Each bot learns independently per platform using multi-armed bandits

import { db } from './db';
import type { PlatformType, RLDimension } from '@prisma/client';
import { OPTIMAL_POSTING_TIMES } from './platform-specs';

// ============ CONSTANTS ============

export const ENGAGEMENT_WEIGHTS = {
  likes: 1,
  comments: 3,
  shares: 5,
  saves: 2,
} as const;

/** Platform-specific bonus multipliers for their primary engagement metric */
export const PLATFORM_METRIC_BONUSES: Partial<Record<PlatformType, {
  metric: 'saves' | 'shares' | 'dwellTimeMs' | 'watchTimeSec';
  multiplier: number;
}>> = {
  LINKEDIN:  { metric: 'dwellTimeMs',  multiplier: 0.001 },
  TIKTOK:    { metric: 'watchTimeSec',  multiplier: 0.5 },
  INSTAGRAM: { metric: 'saves',         multiplier: 1 },     // extra 1pt per save (on top of base 2)
  TWITTER:   { metric: 'shares',        multiplier: 2 },     // extra 2pt per retweet
  FACEBOOK:  { metric: 'shares',        multiplier: 2 },
  YOUTUBE:   { metric: 'watchTimeSec',  multiplier: 0.3 },
  PINTEREST: { metric: 'saves',         multiplier: 2 },
};

/** All available arms per dimension */
export const DIMENSION_ARMS: Record<string, string[]> = {
  TIME_SLOT: Array.from({ length: 24 }, (_, i) => String(i)),
  CONTENT_TYPE: [
    'educational', 'promotional', 'engagement', 'news',
    'curated', 'storytelling', 'ugc',
  ],
  HASHTAG_PATTERN: [
    'none', 'minimal', 'moderate', 'heavy', 'trending', 'niche', 'branded',
  ],
  TONE_STYLE: [
    'professional', 'casual', 'humorous', 'inspirational',
    'educational', 'provocative',
  ],
};

/** Spam prevention limits per safety level */
export const SPAM_LIMITS: Record<string, {
  minIntervalMinutes: number;
  maxPostsPerHour: number;
  maxPostsPerDay: number;
  maxConsecutiveSameType: number;
}> = {
  CONSERVATIVE: { minIntervalMinutes: 120, maxPostsPerHour: 1, maxPostsPerDay: 5, maxConsecutiveSameType: 2 },
  MODERATE:     { minIntervalMinutes: 60,  maxPostsPerHour: 2, maxPostsPerDay: 10, maxConsecutiveSameType: 3 },
  AGGRESSIVE:   { minIntervalMinutes: 30,  maxPostsPerHour: 3, maxPostsPerDay: 20, maxConsecutiveSameType: 4 },
};

// ============ SCORE COMPUTATION ============

export function computeEngagementScore(
  metrics: {
    likes: number;
    comments: number;
    shares: number;
    saves: number;
    dwellTimeMs?: number | null;
    watchTimeSec?: number | null;
  },
  platform: PlatformType
): number {
  let score =
    metrics.likes * ENGAGEMENT_WEIGHTS.likes +
    metrics.comments * ENGAGEMENT_WEIGHTS.comments +
    metrics.shares * ENGAGEMENT_WEIGHTS.shares +
    metrics.saves * ENGAGEMENT_WEIGHTS.saves;

  const bonus = PLATFORM_METRIC_BONUSES[platform];
  if (bonus) {
    if (bonus.metric === 'dwellTimeMs' && metrics.dwellTimeMs != null) {
      score += metrics.dwellTimeMs * bonus.multiplier;
    } else if (bonus.metric === 'watchTimeSec' && metrics.watchTimeSec != null) {
      score += metrics.watchTimeSec * bonus.multiplier;
    } else if (bonus.metric === 'saves') {
      score += metrics.saves * bonus.multiplier;
    } else if (bonus.metric === 'shares') {
      score += metrics.shares * bonus.multiplier;
    }
  }

  return score;
}

// ============ RL CONFIG MANAGEMENT ============

export async function getOrCreateRLConfig(botId: string, platform: PlatformType) {
  return db.rLConfig.upsert({
    where: { botId_platform: { botId, platform } },
    create: { botId, platform, epsilon: 0.2, epsilonMin: 0.05, epsilonDecay: 0.995, totalEpisodes: 0, ewmaAlpha: 0.3 },
    update: {},
  });
}

export async function decayEpsilon(botId: string, platform: PlatformType): Promise<number> {
  const config = await getOrCreateRLConfig(botId, platform);
  const newEpsilon = Math.max(config.epsilonMin, config.epsilon * config.epsilonDecay);

  await db.rLConfig.update({
    where: { botId_platform: { botId, platform } },
    data: { epsilon: newEpsilon, totalEpisodes: { increment: 1 } },
  });

  return newEpsilon;
}

// ============ ARM SELECTION (EPSILON-GREEDY) ============

export async function selectArm(
  botId: string,
  platform: PlatformType,
  dimension: RLDimension,
  options?: { epsilon?: number; excludeArms?: string[]; allowedArms?: string[] }
): Promise<string> {
  const config = await getOrCreateRLConfig(botId, platform);
  const epsilon = options?.epsilon ?? config.epsilon;

  let availableArms = options?.allowedArms ?? DIMENSION_ARMS[dimension] ?? [];
  if (options?.excludeArms) {
    const excluded = new Set(options.excludeArms);
    availableArms = availableArms.filter((a) => !excluded.has(a));
  }

  if (availableArms.length === 0) {
    return DIMENSION_ARMS[dimension]?.[0] ?? '0';
  }

  // Explore with probability epsilon
  if (Math.random() < epsilon) {
    return availableArms[Math.floor(Math.random() * availableArms.length)];
  }

  // Exploit: pick the arm with highest EWMA reward
  const armStates = await db.rLArmState.findMany({
    where: { botId, platform, dimension, armKey: { in: availableArms } },
    orderBy: { ewmaReward: 'desc' },
  });

  if (armStates.length === 0) {
    if (dimension === 'TIME_SLOT') return getDefaultTimeSlot(platform);
    return availableArms[Math.floor(Math.random() * availableArms.length)];
  }

  return armStates[0].armKey;
}

function getDefaultTimeSlot(platform: PlatformType): string {
  const times = OPTIMAL_POSTING_TIMES[platform];
  if (!times) return '12';
  const isWeekend = new Date().getDay() === 0 || new Date().getDay() === 6;
  const hours = isWeekend ? times.weekend : times.weekday;
  if (hours.length === 0) return '12';
  return String(hours[Math.floor(Math.random() * hours.length)]);
}

// ============ REWARD UPDATE ============

export async function updateArmReward(
  botId: string,
  platform: PlatformType,
  dimension: RLDimension,
  armKey: string,
  reward: number,
  ewmaAlpha: number = 0.3
): Promise<void> {
  await db.$transaction(async (tx) => {
    const existing = await tx.rLArmState.findUnique({
      where: { botId_platform_dimension_armKey: { botId, platform, dimension, armKey } },
    });

    if (!existing) {
      await tx.rLArmState.create({
        data: {
          botId, platform, dimension, armKey,
          pulls: 1, totalReward: reward, avgReward: reward,
          lastReward: reward, maxReward: reward, ewmaReward: reward, variance: 0,
        },
      });
    } else {
      const newPulls = existing.pulls + 1;
      const newTotal = existing.totalReward + reward;
      const newAvg = newTotal / newPulls;
      const newEwma = ewmaAlpha * reward + (1 - ewmaAlpha) * existing.ewmaReward;
      const delta = reward - existing.avgReward;
      const delta2 = reward - newAvg;
      const newVariance = existing.pulls > 1
        ? ((existing.variance * (existing.pulls - 1)) + delta * delta2) / (newPulls - 1)
        : 0;

      await tx.rLArmState.update({
        where: { botId_platform_dimension_armKey: { botId, platform, dimension, armKey } },
        data: {
          pulls: newPulls, totalReward: newTotal, avgReward: newAvg,
          lastReward: reward, maxReward: Math.max(existing.maxReward, reward),
          ewmaReward: newEwma, variance: Math.max(0, newVariance),
        },
      });
    }
  });
}

// ============ CONTENT RECOMMENDATION ============

export interface ContentRecommendation {
  timeSlot: number;
  contentType: string;
  hashtagPattern: string;
  toneStyle: string;
  platform: PlatformType;
  isExploration: boolean;
  confidence: number;
}

export async function getContentRecommendation(
  botId: string,
  platform: PlatformType,
  safetyLevel: string = 'MODERATE',
  allowedContentTypes?: string[]
): Promise<ContentRecommendation> {
  const config = await getOrCreateRLConfig(botId, platform);
  const spamLimits = SPAM_LIMITS[safetyLevel] ?? SPAM_LIMITS.MODERATE;
  const excludeContentTypes: string[] = [];

  if (config.lastContentType && config.consecutiveSameType >= spamLimits.maxConsecutiveSameType) {
    excludeContentTypes.push(config.lastContentType);
  }

  const isExplore = Math.random() < config.epsilon;

  const timeSlotStr = await selectArm(botId, platform, 'TIME_SLOT', { epsilon: config.epsilon });
  const contentType = await selectArm(botId, platform, 'CONTENT_TYPE', {
    epsilon: config.epsilon,
    excludeArms: excludeContentTypes,
    allowedArms: allowedContentTypes,
  });
  const hashtagPattern = await selectArm(botId, platform, 'HASHTAG_PATTERN', { epsilon: config.epsilon });
  const toneStyle = await selectArm(botId, platform, 'TONE_STYLE', { epsilon: config.epsilon });

  const armStates = await db.rLArmState.findMany({
    where: { botId, platform },
    select: { pulls: true },
  });
  const totalPulls = armStates.reduce((sum, a) => sum + a.pulls, 0);
  const confidence = Math.round((1 - Math.exp(-totalPulls / 100)) * 100) / 100;

  return {
    timeSlot: parseInt(timeSlotStr) || 12,
    contentType,
    hashtagPattern,
    toneStyle,
    platform,
    isExploration: isExplore,
    confidence,
  };
}

// ============ PROCESS ENGAGEMENT FEEDBACK ============

export async function processEngagementFeedback(
  postEngagementId: string
): Promise<{ score: number; epsilon: number }> {
  const engagement = await db.postEngagement.findUnique({
    where: { id: postEngagementId },
  });
  if (!engagement) throw new Error(`PostEngagement not found: ${postEngagementId}`);

  const score = computeEngagementScore(
    {
      likes: engagement.likes,
      comments: engagement.comments,
      shares: engagement.shares,
      saves: engagement.saves,
      dwellTimeMs: engagement.dwellTimeMs,
      watchTimeSec: engagement.watchTimeSec,
    },
    engagement.platform
  );

  await db.postEngagement.update({
    where: { id: postEngagementId },
    data: { engagementScore: score, collectedAt: new Date() },
  });

  // Update each dimension arm
  const dimensions: { dimension: RLDimension; armKey: string | null }[] = [
    { dimension: 'TIME_SLOT', armKey: engagement.timeSlot != null ? String(engagement.timeSlot) : null },
    { dimension: 'CONTENT_TYPE', armKey: engagement.contentType },
    { dimension: 'HASHTAG_PATTERN', armKey: engagement.hashtagPattern },
    { dimension: 'TONE_STYLE', armKey: engagement.toneStyle },
  ];

  for (const { dimension, armKey } of dimensions) {
    if (armKey) {
      await updateArmReward(engagement.botId, engagement.platform, dimension, armKey, score);
    }
  }

  const newEpsilon = await decayEpsilon(engagement.botId, engagement.platform);

  // Update spam prevention state
  const currentConfig = await db.rLConfig.findUnique({
    where: { botId_platform: { botId: engagement.botId, platform: engagement.platform } },
    select: { lastContentType: true },
  });
  const sameType = engagement.contentType === currentConfig?.lastContentType;

  await db.rLConfig.update({
    where: { botId_platform: { botId: engagement.botId, platform: engagement.platform } },
    data: {
      lastPostAt: new Date(),
      lastContentType: engagement.contentType,
      consecutiveSameType: sameType ? { increment: 1 } : 1,
    },
  });

  return { score, epsilon: newEpsilon };
}

// ============ SPAM PREVENTION CHECK ============

export async function checkSpamLimits(
  botId: string,
  platform: PlatformType,
  safetyLevel: string = 'MODERATE'
): Promise<{ allowed: boolean; reason?: string; waitMinutes?: number }> {
  const config = await getOrCreateRLConfig(botId, platform);
  const limits = SPAM_LIMITS[safetyLevel] ?? SPAM_LIMITS.MODERATE;

  if (config.lastPostAt) {
    const minutesSince = (Date.now() - config.lastPostAt.getTime()) / (1000 * 60);
    if (minutesSince < limits.minIntervalMinutes) {
      return {
        allowed: false,
        reason: `Minimum interval not met (${limits.minIntervalMinutes}min)`,
        waitMinutes: Math.ceil(limits.minIntervalMinutes - minutesSince),
      };
    }
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const postsLastHour = await db.postEngagement.count({
    where: { botId, platform, postedAt: { gte: oneHourAgo } },
  });
  if (postsLastHour >= limits.maxPostsPerHour) {
    return { allowed: false, reason: `Hourly limit reached (${limits.maxPostsPerHour}/hour)`, waitMinutes: 60 };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const postsToday = await db.postEngagement.count({
    where: { botId, platform, postedAt: { gte: today } },
  });
  if (postsToday >= limits.maxPostsPerDay) {
    return { allowed: false, reason: `Daily limit reached (${limits.maxPostsPerDay}/day)` };
  }

  return { allowed: true };
}

// ============ ANALYTICS QUERIES ============

export async function getLearningOverview(botId: string) {
  const configs = await db.rLConfig.findMany({ where: { botId }, orderBy: { platform: 'asc' } });

  const overview: Record<string, {
    epsilon: number;
    totalEpisodes: number;
    bestArms: Record<string, { arm: string; ewmaReward: number; pulls: number }>;
  }> = {};

  for (const config of configs) {
    const dimensions: RLDimension[] = ['TIME_SLOT', 'CONTENT_TYPE', 'HASHTAG_PATTERN', 'TONE_STYLE'];
    const bestArms: Record<string, { arm: string; ewmaReward: number; pulls: number }> = {};

    for (const dim of dimensions) {
      const best = await db.rLArmState.findFirst({
        where: { botId, platform: config.platform, dimension: dim },
        orderBy: { ewmaReward: 'desc' },
      });
      if (best) {
        bestArms[dim] = {
          arm: best.armKey,
          ewmaReward: Math.round(best.ewmaReward * 100) / 100,
          pulls: best.pulls,
        };
      }
    }

    overview[config.platform] = {
      epsilon: Math.round(config.epsilon * 1000) / 1000,
      totalEpisodes: config.totalEpisodes,
      bestArms,
    };
  }

  return overview;
}

export async function getArmDistribution(
  botId: string,
  platform: PlatformType,
  dimension: RLDimension
) {
  const arms = await db.rLArmState.findMany({
    where: { botId, platform, dimension },
    orderBy: { ewmaReward: 'desc' },
  });

  return arms.map((a) => ({
    armKey: a.armKey,
    pulls: a.pulls,
    avgReward: Math.round(a.avgReward * 100) / 100,
    ewmaReward: Math.round(a.ewmaReward * 100) / 100,
    maxReward: Math.round(a.maxReward * 100) / 100,
    confidence: a.pulls > 0 ? Math.round((1 - 1 / Math.sqrt(a.pulls)) * 100) / 100 : 0,
  }));
}
