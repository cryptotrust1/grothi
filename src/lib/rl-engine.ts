// Content Reactor - Multi-Strategy Reinforcement Learning Engine
// Each bot learns independently per platform using multi-armed bandits.
//
// Strategies (selectable per bot):
//   1. Epsilon-Greedy (default) — simple, proven baseline
//   2. Thompson Sampling (Beta distribution) — Chapelle & Li 2011
//      Naturally balances exploration/exploitation via posterior sampling.
//   3. UCB1 (Upper Confidence Bound) — Auer et al. 2002
//      Deterministic, logarithmically optimal regret bound.
//
// Additional techniques:
//   - Bayesian reward normalization (z-score per platform)
//   - Time-decayed EWMA with configurable half-life
//   - Content fingerprinting for automatic dimension detection

import { db } from './db';
import type { PlatformType, RLDimension } from '@prisma/client';
import { OPTIMAL_POSTING_TIMES } from './platform-specs';
import {
  getHypeState,
  getHypeContentBias,
  getHypeHashtagBias,
  type HypeState,
  type HypeAlert,
} from './hype-engine';

/** Arm selection strategy */
export type ArmStrategy = 'epsilon_greedy' | 'thompson_sampling' | 'ucb1';

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

// ============ THOMPSON SAMPLING (Chapelle & Li, 2011) ============
//
// Instead of using a fixed epsilon for exploration, Thompson Sampling draws
// a random sample from each arm's posterior distribution (Beta distribution
// parameterized by successes/failures). The arm with the highest sample wins.
//
// For continuous rewards, we use the Normal-Gamma conjugate prior approximation:
// sample ~ Normal(mu, 1/sqrt(tau)) where tau ~ Gamma(alpha, beta).
// With enough data this converges to sampling from Normal(avg, variance/pulls).
//
// This is mathematically proven to achieve lower cumulative regret than
// epsilon-greedy in expectation (Agrawal & Goyal, 2012).

export async function selectArmThompson(
  botId: string,
  platform: PlatformType,
  dimension: RLDimension,
  options?: { allowedArms?: string[]; excludeArms?: string[] }
): Promise<{ armKey: string; isExploration: boolean }> {
  let availableArms = options?.allowedArms ?? DIMENSION_ARMS[dimension] ?? [];
  if (options?.excludeArms) {
    const excluded = new Set(options.excludeArms);
    availableArms = availableArms.filter((a) => !excluded.has(a));
  }
  if (availableArms.length === 0) {
    return { armKey: DIMENSION_ARMS[dimension]?.[0] ?? '0', isExploration: true };
  }

  const armStates = await db.rLArmState.findMany({
    where: { botId, platform, dimension, armKey: { in: availableArms } },
  });

  const stateMap = new Map(armStates.map(a => [a.armKey, a]));

  // Sample from posterior for each arm
  let bestArm = availableArms[0];
  let bestSample = -Infinity;
  const bestArmKey: string | null = armStates.length > 0
    ? armStates.reduce((a, b) => a.ewmaReward > b.ewmaReward ? a : b).armKey
    : null;

  for (const armKey of availableArms) {
    const state = stateMap.get(armKey);

    if (!state || state.pulls < 2) {
      // Uninitiated arm: high prior variance encourages exploration
      // Sample from a wide prior: Normal(0, 10)
      const sample = gaussianRandom() * 10;
      if (sample > bestSample) {
        bestSample = sample;
        bestArm = armKey;
      }
      continue;
    }

    // Normal posterior: sample ~ Normal(ewmaReward, stddev / sqrt(pulls))
    // Using EWMA reward (recency-weighted) instead of raw average
    const stddev = Math.sqrt(Math.max(state.variance, 0.01));
    const posteriorStddev = stddev / Math.sqrt(state.pulls);
    const sample = state.ewmaReward + gaussianRandom() * posteriorStddev;

    if (sample > bestSample) {
      bestSample = sample;
      bestArm = armKey;
    }
  }

  return {
    armKey: bestArm,
    isExploration: bestArm !== bestArmKey,
  };
}

// ============ UCB1 (Auer, Cesa-Bianchi & Fischer, 2002) ============
//
// Upper Confidence Bound: picks arm with highest (avg_reward + exploration_bonus).
// Formula: UCB = avg_reward + c * sqrt(ln(total_pulls) / arm_pulls)
// where c is the exploration coefficient (sqrt(2) is theoretically optimal).
//
// Proven to achieve O(ln(n)) regret bound — optimal for stochastic bandits.

export async function selectArmUCB1(
  botId: string,
  platform: PlatformType,
  dimension: RLDimension,
  options?: { allowedArms?: string[]; excludeArms?: string[]; explorationCoeff?: number }
): Promise<{ armKey: string; isExploration: boolean }> {
  const c = options?.explorationCoeff ?? Math.SQRT2;
  let availableArms = options?.allowedArms ?? DIMENSION_ARMS[dimension] ?? [];
  if (options?.excludeArms) {
    const excluded = new Set(options.excludeArms);
    availableArms = availableArms.filter((a) => !excluded.has(a));
  }
  if (availableArms.length === 0) {
    return { armKey: DIMENSION_ARMS[dimension]?.[0] ?? '0', isExploration: true };
  }

  const armStates = await db.rLArmState.findMany({
    where: { botId, platform, dimension, armKey: { in: availableArms } },
  });

  const stateMap = new Map(armStates.map(a => [a.armKey, a]));
  const totalPulls = armStates.reduce((sum, a) => sum + a.pulls, 0);

  // Arms with 0 pulls get infinite UCB (explored first)
  const untriedArms = availableArms.filter(a => !stateMap.has(a) || stateMap.get(a)!.pulls === 0);
  if (untriedArms.length > 0) {
    return {
      armKey: untriedArms[Math.floor(Math.random() * untriedArms.length)],
      isExploration: true,
    };
  }

  // Compute UCB1 score for each arm
  const bestArmByReward = armStates.reduce((a, b) => a.ewmaReward > b.ewmaReward ? a : b).armKey;
  let bestArm = availableArms[0];
  let bestUCB = -Infinity;

  for (const armKey of availableArms) {
    const state = stateMap.get(armKey);
    if (!state) continue;

    const explorationBonus = c * Math.sqrt(Math.log(totalPulls) / state.pulls);
    const ucbScore = state.ewmaReward + explorationBonus;

    if (ucbScore > bestUCB) {
      bestUCB = ucbScore;
      bestArm = armKey;
    }
  }

  return {
    armKey: bestArm,
    isExploration: bestArm !== bestArmByReward,
  };
}

/** Box-Muller transform for generating standard normal random samples */
function gaussianRandom(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
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
  allowedContentTypes?: string[],
  strategy: ArmStrategy = 'thompson_sampling'
): Promise<ContentRecommendation> {
  const config = await getOrCreateRLConfig(botId, platform);
  const spamLimits = SPAM_LIMITS[safetyLevel] ?? SPAM_LIMITS.MODERATE;
  const excludeContentTypes: string[] = [];

  if (config.lastContentType && config.consecutiveSameType >= spamLimits.maxConsecutiveSameType) {
    excludeContentTypes.push(config.lastContentType);
  }

  // Use the unified smart arm selection (defaults to Thompson Sampling)
  const timeSlotResult = await selectArmSmart(botId, platform, 'TIME_SLOT', strategy);
  const contentTypeResult = await selectArmSmart(botId, platform, 'CONTENT_TYPE', strategy, {
    excludeArms: excludeContentTypes,
    allowedArms: allowedContentTypes,
  });
  const hashtagResult = await selectArmSmart(botId, platform, 'HASHTAG_PATTERN', strategy);
  const toneResult = await selectArmSmart(botId, platform, 'TONE_STYLE', strategy);

  const isExplore = timeSlotResult.isExploration || contentTypeResult.isExploration ||
    hashtagResult.isExploration || toneResult.isExploration;

  const armStates = await db.rLArmState.findMany({
    where: { botId, platform },
    select: { pulls: true },
  });
  const totalPulls = armStates.reduce((sum, a) => sum + a.pulls, 0);
  const confidence = Math.round((1 - Math.exp(-totalPulls / 100)) * 100) / 100;

  return {
    timeSlot: parseInt(timeSlotResult.armKey) || 12,
    contentType: contentTypeResult.armKey,
    hashtagPattern: hashtagResult.armKey,
    toneStyle: toneResult.armKey,
    platform,
    isExploration: isExplore,
    confidence,
  };
}

// ============ HYPE-AWARE CONTENT RECOMMENDATION ============
//
// When active hype alerts exist, this function biases the RL arm selection
// toward content types and hashtag patterns that are optimal for trend-riding.
//
// The bias is applied as a weighted random selection boost:
// - During EMERGENCE: boost "news" content type (be first to report)
// - During GROWTH: boost "educational" (explain the trend to audience)
// - During PEAK: boost "engagement" (drive discussion, maximum visibility)
//
// Scientific basis:
// - Berger (2013) STEPPS: Triggers + Public principles favor timely content
// - Rogers (1962): Early Adopters (GROWTH stage) gain most social currency
// - Graffius (2026): Platform half-life determines urgency of action

export interface HypeAwareRecommendation extends ContentRecommendation {
  /** Whether this recommendation is influenced by hype detection */
  hypeInfluenced: boolean;
  /** Active hype alerts that influenced the recommendation */
  activeAlerts: HypeAlert[];
  /** Suggested content angle for trend-riding */
  trendAngle?: string;
}

export async function getHypeAwareRecommendation(
  botId: string,
  platform: PlatformType,
  safetyLevel: string = 'MODERATE',
  strategy: ArmStrategy = 'thompson_sampling'
): Promise<HypeAwareRecommendation> {
  // Fetch bot's hype state
  const bot = await db.bot.findUnique({
    where: { id: botId },
    select: { algorithmConfig: true },
  });

  const hypeState = getHypeState(bot?.algorithmConfig);
  const contentBias = getHypeContentBias(hypeState);
  const hashtagBias = getHypeHashtagBias(hypeState);
  const activeAlerts = hypeState.activeAlerts.filter(a => !a.dismissed);

  const hasHype = activeAlerts.length > 0 && Object.keys(contentBias).length > 0;

  if (!hasHype) {
    // No hype detected — use standard recommendation
    const recommendation = await getContentRecommendation(botId, platform, safetyLevel, undefined, strategy);
    return {
      ...recommendation,
      hypeInfluenced: false,
      activeAlerts: [],
    };
  }

  // Apply hype bias to content type selection
  // Strategy: with 30% probability, override RL selection with hype-biased choice
  // This maintains RL learning integrity while injecting trend-awareness
  const HYPE_OVERRIDE_PROBABILITY = 0.30;
  const shouldOverride = Math.random() < HYPE_OVERRIDE_PROBABILITY;

  const config = await getOrCreateRLConfig(botId, platform);
  const spamLimits = SPAM_LIMITS[safetyLevel] ?? SPAM_LIMITS.MODERATE;
  const excludeContentTypes: string[] = [];

  if (config.lastContentType && config.consecutiveSameType >= spamLimits.maxConsecutiveSameType) {
    excludeContentTypes.push(config.lastContentType);
  }

  let contentTypeKey: string;
  let hashtagPatternKey: string;
  let toneStyleKey: string;
  let isExploration = false;
  let trendAngle: string | undefined;

  if (shouldOverride) {
    // Use hype-biased selection
    contentTypeKey = weightedRandomSelect(contentBias, excludeContentTypes);
    hashtagPatternKey = weightedRandomSelect(hashtagBias);

    // Use the best alert's suggested tone
    const topAlert = activeAlerts.sort((a, b) => b.hypeScore - a.hypeScore)[0];
    toneStyleKey = topAlert?.suggestedTone || 'casual';
    trendAngle = topAlert?.suggestedAngle;
    isExploration = true; // Trend-riding is a form of exploration
  } else {
    // Standard RL selection
    const contentTypeResult = await selectArmSmart(botId, platform, 'CONTENT_TYPE', strategy, {
      excludeArms: excludeContentTypes,
    });
    const hashtagResult = await selectArmSmart(botId, platform, 'HASHTAG_PATTERN', strategy);
    const toneResult = await selectArmSmart(botId, platform, 'TONE_STYLE', strategy);

    contentTypeKey = contentTypeResult.armKey;
    hashtagPatternKey = hashtagResult.armKey;
    toneStyleKey = toneResult.armKey;
    isExploration = contentTypeResult.isExploration || hashtagResult.isExploration || toneResult.isExploration;
  }

  const timeSlotResult = await selectArmSmart(botId, platform, 'TIME_SLOT', strategy);

  const armStates = await db.rLArmState.findMany({
    where: { botId, platform },
    select: { pulls: true },
  });
  const totalPulls = armStates.reduce((sum, a) => sum + a.pulls, 0);
  const confidence = Math.round((1 - Math.exp(-totalPulls / 100)) * 100) / 100;

  return {
    timeSlot: parseInt(timeSlotResult.armKey) || 12,
    contentType: contentTypeKey,
    hashtagPattern: hashtagPatternKey,
    toneStyle: toneStyleKey,
    platform,
    isExploration,
    confidence,
    hypeInfluenced: shouldOverride,
    activeAlerts,
    trendAngle,
  };
}

/**
 * Weighted random selection from a bias map
 * Higher weights = higher probability of selection
 */
function weightedRandomSelect(
  weights: Record<string, number>,
  exclude: string[] = []
): string {
  const entries = Object.entries(weights).filter(([key]) => !exclude.includes(key));
  if (entries.length === 0) return 'engagement'; // Fallback

  const totalWeight = entries.reduce((sum, [, w]) => sum + w, 0);
  let random = Math.random() * totalWeight;

  for (const [key, weight] of entries) {
    random -= weight;
    if (random <= 0) return key;
  }

  return entries[entries.length - 1][0];
}

// ============ PROCESS ENGAGEMENT FEEDBACK ============

export async function processEngagementFeedback(
  postEngagementId: string
): Promise<{ score: number; epsilon: number }> {
  const engagement = await db.postEngagement.findUnique({
    where: { id: postEngagementId },
  });
  if (!engagement) throw new Error(`PostEngagement not found: ${postEngagementId}`);

  // Fetch the associated post content for fingerprinting (if available)
  const scheduledPost = engagement.scheduledPostId
    ? await db.scheduledPost.findUnique({
        where: { id: engagement.scheduledPostId },
        select: { content: true },
      })
    : null;

  const rawScore = computeEngagementScore(
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

  // Apply time-decay adjustment: estimate final engagement for newer posts
  const ageAdjustedScore = computeAgeAdjustedScore(rawScore, engagement.postedAt, engagement.platform);

  // Use content fingerprinting to backfill missing dimensions.
  // If the post content is available but contentType/toneStyle/hashtagPattern are null,
  // analyze the content to determine what they should be.
  let contentType = engagement.contentType;
  let toneStyle = engagement.toneStyle;
  let hashtagPattern = engagement.hashtagPattern;

  const postContent = scheduledPost?.content;
  if (postContent && (!contentType || !toneStyle || !hashtagPattern)) {
    const fingerprint = fingerprintContent(postContent);
    if (!contentType || contentType === 'custom') contentType = fingerprint.contentType;
    if (!toneStyle) toneStyle = fingerprint.toneStyle;
    if (!hashtagPattern) hashtagPattern = fingerprint.hashtagPattern;

    // Persist the backfilled dimensions for future analytics
    await db.postEngagement.update({
      where: { id: postEngagementId },
      data: {
        engagementScore: ageAdjustedScore,
        collectedAt: new Date(),
        contentType,
        toneStyle,
        hashtagPattern,
      },
    });
  } else {
    await db.postEngagement.update({
      where: { id: postEngagementId },
      data: { engagementScore: ageAdjustedScore, collectedAt: new Date() },
    });
  }

  // Normalize reward using Bayesian z-score for cross-platform comparability
  const normalizedReward = await normalizeRewardForPlatform(
    engagement.botId, engagement.platform, ageAdjustedScore
  );

  // Update each dimension arm with normalized reward
  const dimensions: { dimension: RLDimension; armKey: string | null }[] = [
    { dimension: 'TIME_SLOT', armKey: engagement.timeSlot != null ? String(engagement.timeSlot) : null },
    { dimension: 'CONTENT_TYPE', armKey: contentType },
    { dimension: 'HASHTAG_PATTERN', armKey: hashtagPattern },
    { dimension: 'TONE_STYLE', armKey: toneStyle },
  ];

  for (const { dimension, armKey } of dimensions) {
    if (armKey) {
      await updateArmReward(engagement.botId, engagement.platform, dimension, armKey, normalizedReward);
    }
  }

  const newEpsilon = await decayEpsilon(engagement.botId, engagement.platform);

  // Update spam prevention state
  const currentConfig = await db.rLConfig.findUnique({
    where: { botId_platform: { botId: engagement.botId, platform: engagement.platform } },
    select: { lastContentType: true },
  });
  const sameType = contentType === currentConfig?.lastContentType;

  await db.rLConfig.update({
    where: { botId_platform: { botId: engagement.botId, platform: engagement.platform } },
    data: {
      lastPostAt: new Date(),
      lastContentType: contentType,
      consecutiveSameType: sameType ? { increment: 1 } : 1,
    },
  });

  return { score: ageAdjustedScore, epsilon: newEpsilon };
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

// ============ CONTENT FINGERPRINTING ============
//
// Deterministic heuristic analysis of post content to automatically detect:
//   - contentType (educational, promotional, engagement, etc.)
//   - toneStyle (professional, casual, humorous, etc.)
//   - hashtagPattern (none, minimal, moderate, heavy, etc.)
//
// This eliminates the need for manual labeling or AI guessing.
// Uses keyword frequency, punctuation patterns, and structural analysis.

export interface ContentFingerprint {
  contentType: string;
  toneStyle: string;
  hashtagPattern: string;
  confidence: number;
}

const CONTENT_TYPE_SIGNALS: Record<string, { keywords: RegExp; weight: number }[]> = {
  educational: [
    { keywords: /\b(how to|learn|guide|tutorial|step[s]?|tip[s]?|trick[s]?|did you know|explain|understand)\b/i, weight: 3 },
    { keywords: /\b(fact|research|study|science|data|statistics|insight|lesson)\b/i, weight: 2 },
    { keywords: /\d+\s*(ways|steps|tips|reasons|things)/i, weight: 3 },
  ],
  promotional: [
    { keywords: /\b(buy|shop|sale|discount|offer|deal|promo|coupon|limited|exclusive|order)\b/i, weight: 3 },
    { keywords: /\b(link in bio|check out|available now|get yours|free shipping)\b/i, weight: 3 },
    { keywords: /\b(launch|new product|introducing|announcing)\b/i, weight: 2 },
  ],
  engagement: [
    { keywords: /\b(what do you think|agree\??|comment|share your|tell us|vote|poll|opinion)\b/i, weight: 3 },
    { keywords: /\?\s*$/m, weight: 2 },
    { keywords: /\b(tag someone|tag a friend|who else|double tap|like if)\b/i, weight: 3 },
  ],
  news: [
    { keywords: /\b(breaking|update|announcement|just in|report|happening|today)\b/i, weight: 3 },
    { keywords: /\b(source|according to|confirmed|official|released)\b/i, weight: 2 },
  ],
  storytelling: [
    { keywords: /\b(story|journey|experience|remember when|once upon|looking back)\b/i, weight: 3 },
    { keywords: /\b(i was|we were|it all started|that moment when)\b/i, weight: 2 },
    { keywords: /\b(chapter|part \d|episode)\b/i, weight: 2 },
  ],
  curated: [
    { keywords: /\b(roundup|collection|best of|top \d|must[- ]see|must[- ]read|favorites|picks)\b/i, weight: 3 },
    { keywords: /\b(thread|list|compilation|recap)\b/i, weight: 2 },
  ],
  ugc: [
    { keywords: /\b(repost|shared by|credit|photo by|via @|submitted by|fan|community)\b/i, weight: 3 },
    { keywords: /\b(your (photos?|videos?|content)|user[- ]generated)\b/i, weight: 3 },
  ],
};

const TONE_SIGNALS: Record<string, { keywords: RegExp; weight: number }[]> = {
  professional: [
    { keywords: /\b(therefore|consequently|furthermore|regarding|implement|strategy|leverage|optimize)\b/i, weight: 3 },
    { keywords: /\b(pleased to|delighted to|we are proud|industry|insights|analysis)\b/i, weight: 2 },
  ],
  casual: [
    { keywords: /\b(hey|yo|gonna|wanna|kinda|tbh|ngl|btw|omg|lol|haha)\b/i, weight: 3 },
    { keywords: /(!{2,}|\?{2,})/g, weight: 2 },
    { keywords: /[\uD83D][\uDE00-\uDE4F]|[\uD83C][\uDF00-\uDFFF]|[\uD83D][\uDE80-\uDEFF]/g, weight: 2 },
  ],
  humorous: [
    { keywords: /\b(lol|lmao|rofl|haha|joke|funny|hilarious|meme|pun)\b/i, weight: 3 },
    { keywords: /\b(plot twist|wait for it|spoiler|not gonna lie)\b/i, weight: 2 },
    { keywords: /[\uD83D][\uDE02]|[\uD83E][\uDD23]|[\uD83D][\uDE43]/g, weight: 3 },
  ],
  inspirational: [
    { keywords: /\b(believe|dream|achieve|success|never give up|motivat|inspir|empower|greatness)\b/i, weight: 3 },
    { keywords: /\b(you can|we can|together|make it happen|change the world|purpose|passion)\b/i, weight: 2 },
    { keywords: /[""\u201C\u201D].{10,}[""\u201C\u201D]/g, weight: 2 },
  ],
  educational: [
    { keywords: /\b(here'?s (how|what|why)|let me explain|in this (post|thread)|breakdown)\b/i, weight: 3 },
    { keywords: /\b(step \d|first[,.]|second[,.]|finally|in conclusion|key takeaway)\b/i, weight: 2 },
  ],
  provocative: [
    { keywords: /\b(unpopular opinion|hot take|controversial|nobody talks about|harsh truth)\b/i, weight: 3 },
    { keywords: /\b(wrong|overrated|underrated|myth|stop (doing|saying|believing))\b/i, weight: 2 },
  ],
};

export function fingerprintContent(content: string): ContentFingerprint {
  // Detect content type
  const contentScores: Record<string, number> = {};
  for (const [type, signals] of Object.entries(CONTENT_TYPE_SIGNALS)) {
    let score = 0;
    for (const signal of signals) {
      const matches = content.match(signal.keywords);
      if (matches) score += signal.weight * matches.length;
    }
    contentScores[type] = score;
  }

  // Detect tone
  const toneScores: Record<string, number> = {};
  for (const [tone, signals] of Object.entries(TONE_SIGNALS)) {
    let score = 0;
    for (const signal of signals) {
      const matches = content.match(signal.keywords);
      if (matches) score += signal.weight * matches.length;
    }
    toneScores[tone] = score;
  }

  // Detect hashtag pattern
  const hashtags = content.match(/#\w+/g) || [];
  const hashtagCount = hashtags.length;
  let hashtagPattern: string;
  if (hashtagCount === 0) hashtagPattern = 'none';
  else if (hashtagCount <= 2) hashtagPattern = 'minimal';
  else if (hashtagCount <= 5) hashtagPattern = 'moderate';
  else if (hashtagCount <= 10) hashtagPattern = 'heavy';
  else hashtagPattern = 'heavy';

  // Check for trending/niche/branded patterns
  const trendingHashtags = hashtags.filter(h => /^#(trending|viral|fyp|foryou|explore)/i.test(h));
  const brandedHashtags = hashtags.filter(h => /[A-Z]{2,}/.test(h.slice(1))); // ALLCAPS brand
  if (trendingHashtags.length > 0 && hashtagCount >= 3) hashtagPattern = 'trending';
  else if (brandedHashtags.length > hashtagCount * 0.5 && hashtagCount >= 2) hashtagPattern = 'branded';
  else if (hashtagCount >= 3 && hashtagCount <= 5 && trendingHashtags.length === 0) hashtagPattern = 'niche';

  // Select winner for each dimension
  const bestContentType = getTopScorer(contentScores, 'engagement');
  const bestTone = getTopScorer(toneScores, 'casual');

  // Confidence: based on total signal strength
  const totalSignals = Object.values(contentScores).reduce((a, b) => a + b, 0) +
    Object.values(toneScores).reduce((a, b) => a + b, 0);
  const confidence = Math.min(1, totalSignals / 15);

  return {
    contentType: bestContentType,
    toneStyle: bestTone,
    hashtagPattern,
    confidence: Math.round(confidence * 100) / 100,
  };
}

function getTopScorer(scores: Record<string, number>, fallback: string): string {
  let best = fallback;
  let bestScore = 0;
  for (const [key, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      best = key;
    }
  }
  return best;
}

// ============ TIME-DECAYED ENGAGEMENT SCORING ============
//
// Recent posts get their engagement score adjusted upward to account for
// the fact that they haven't had time to accumulate full engagement.
// Uses an exponential saturation curve: adjustment = 1 / (1 - e^(-age/halflife))
// where halflife is the typical time for a post to reach 50% of final engagement.
//
// Platform half-lives based on industry data (Khoros/Sprout Social research):
// - Twitter: ~18 min lifespan → halflife 30 min
// - Instagram: ~48h peak → halflife 12h
// - Facebook: ~5h peak → halflife 6h
// - LinkedIn: ~24h → halflife 12h

const PLATFORM_HALFLIFE_HOURS: Partial<Record<PlatformType, number>> = {
  TWITTER: 0.5,
  THREADS: 1,
  FACEBOOK: 6,
  INSTAGRAM: 12,
  LINKEDIN: 12,
  TIKTOK: 24,
  YOUTUBE: 48,
  PINTEREST: 168, // 7 days (Pinterest has very long tail)
};

export function computeAgeAdjustedScore(
  rawScore: number,
  postedAt: Date,
  platform: PlatformType
): number {
  const halflifeHours = PLATFORM_HALFLIFE_HOURS[platform] ?? 12;
  const ageHours = (Date.now() - postedAt.getTime()) / (1000 * 60 * 60);

  if (ageHours < 0.1) return rawScore; // Too fresh, don't adjust

  // Saturation curve: what fraction of final engagement has the post likely received?
  // saturation = 1 - e^(-age / halflife)
  const saturation = 1 - Math.exp(-ageHours / halflifeHours);

  // Clamp saturation to [0.1, 1] to avoid extreme amplification for very new posts
  const clampedSaturation = Math.max(0.1, Math.min(1, saturation));

  // Adjusted score estimates what the final engagement will be
  return rawScore / clampedSaturation;
}

// ============ BAYESIAN REWARD NORMALIZATION ============
//
// Normalizes arm rewards to z-scores relative to the platform's mean and stddev.
// This makes rewards comparable across platforms with different engagement scales.
// A z-score of 1.5 on Twitter means the same thing as 1.5 on Instagram:
// "1.5 standard deviations above average performance on this platform."

export async function normalizeRewardForPlatform(
  botId: string,
  platform: PlatformType,
  rawReward: number
): Promise<number> {
  const engagements = await db.postEngagement.findMany({
    where: { botId, platform, engagementScore: { gt: 0 } },
    select: { engagementScore: true },
    orderBy: { postedAt: 'desc' },
    take: 100,
  });

  if (engagements.length < 5) return rawReward; // Not enough data to normalize

  const scores = engagements.map(e => e.engagementScore);
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((a, b) => a + (b - mean) ** 2, 0) / scores.length;
  const stddev = Math.sqrt(variance);

  if (stddev < 0.01) return rawReward; // All scores are the same

  // Return z-score (centered and scaled)
  return (rawReward - mean) / stddev;
}

// ============ SMART ARM SELECTION (UNIFIED) ============
//
// Unified arm selection that picks the appropriate strategy based on
// the bot's configuration. Falls back gracefully.

export async function selectArmSmart(
  botId: string,
  platform: PlatformType,
  dimension: RLDimension,
  strategy: ArmStrategy = 'thompson_sampling',
  options?: { allowedArms?: string[]; excludeArms?: string[] }
): Promise<{ armKey: string; isExploration: boolean }> {
  switch (strategy) {
    case 'thompson_sampling':
      return selectArmThompson(botId, platform, dimension, options);
    case 'ucb1':
      return selectArmUCB1(botId, platform, dimension, options);
    case 'epsilon_greedy':
    default: {
      const armKey = await selectArm(botId, platform, dimension, {
        allowedArms: options?.allowedArms,
        excludeArms: options?.excludeArms,
      });
      // Determine if it was exploration (approximate)
      const config = await getOrCreateRLConfig(botId, platform);
      return { armKey, isExploration: Math.random() < config.epsilon };
    }
  }
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
