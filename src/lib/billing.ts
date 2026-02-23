/**
 * GROTHI.COM Billing, Pricing & Credit System
 *
 * Subscription-based model with 4 tiers + top-up credit packs.
 * Credits consumed via FIFO: Top-up → Rollover → Subscription.
 */

// ============ SUBSCRIPTION PLANS ============

export interface PlanDefinition {
  slug: string;
  name: string;
  priceUsd: number;      // In cents
  credits: number;        // Monthly credits included
  maxBots: number;
  maxPlatforms: number;   // Per bot
  allowRollover: boolean;
  maxRolloverCredits: number;
  features: string[];
  popular?: boolean;
}

export const SUBSCRIPTION_PLANS: PlanDefinition[] = [
  {
    slug: 'bronze',
    name: 'Bronze',
    priceUsd: 1500,       // $15
    credits: 0,           // No credits included
    maxBots: 1,
    maxPlatforms: 3,
    allowRollover: false,
    maxRolloverCredits: 0,
    features: [
      '1 AI marketing bot',
      '3 platforms per bot',
      'Basic analytics',
      'Email support',
    ],
  },
  {
    slug: 'silver',
    name: 'Silver',
    priceUsd: 2900,       // $29
    credits: 500,
    maxBots: 3,
    maxPlatforms: 8,
    allowRollover: false,
    maxRolloverCredits: 0,
    popular: true,
    features: [
      '3 AI marketing bots',
      '8 platforms per bot',
      '500 credits/month',
      'AI content generation',
      'Priority support',
    ],
  },
  {
    slug: 'gold',
    name: 'Gold',
    priceUsd: 8900,       // $89
    credits: 2000,
    maxBots: 10,
    maxPlatforms: 17,
    allowRollover: true,
    maxRolloverCredits: 1000,
    features: [
      '10 AI marketing bots',
      'All 17 platforms',
      '2,000 credits/month',
      'Credit rollover (max 1,000)',
      'AI image + video generation',
      'Advanced analytics',
      'Priority support',
    ],
  },
  {
    slug: 'diamond',
    name: 'Diamond',
    priceUsd: 22000,      // $220
    credits: 6000,
    maxBots: 999,         // Unlimited
    maxPlatforms: 17,
    allowRollover: true,
    maxRolloverCredits: 3000,
    features: [
      'Unlimited bots',
      'All 17 platforms',
      '6,000 credits/month',
      'Credit rollover (max 3,000)',
      'AI image + video generation',
      'Full analytics suite',
      'Affiliate program access',
      'Dedicated support',
    ],
  },
];

export function getPlanBySlug(slug: string): PlanDefinition | undefined {
  return SUBSCRIPTION_PLANS.find(p => p.slug === slug);
}

// ============ TOP-UP PACKS ============

export interface TopupPackDefinition {
  slug: string;
  name: string;
  credits: number;
  priceUsd: number;   // In cents
  popular?: boolean;
}

export const TOPUP_PACKS: TopupPackDefinition[] = [
  { slug: 'mini',       name: 'Mini',       credits: 20,    priceUsd: 199 },    // $1.99
  { slug: 'starter',    name: 'Starter',    credits: 100,   priceUsd: 899 },    // $8.99
  { slug: 'standard',   name: 'Standard',   credits: 300,   priceUsd: 2499, popular: true },  // $24.99
  { slug: 'pro',        name: 'Pro',        credits: 600,   priceUsd: 4499 },   // $44.99
  { slug: 'business',   name: 'Business',   credits: 1000,  priceUsd: 6999 },   // $69.99
  { slug: 'enterprise', name: 'Enterprise', credits: 1600,  priceUsd: 9999 },   // $99.99
];

export function getTopupBySlug(slug: string): TopupPackDefinition | undefined {
  return TOPUP_PACKS.find(p => p.slug === slug);
}

// ============ CREDIT COSTS PER ACTION ============
// Updated comprehensive cost table based on specification

export const CREDIT_COSTS: Record<string, number> = {
  // Content generation
  GENERATE_CONTENT: 2,      // AI text post generation
  GENERATE_IMAGE: 5,        // AI image generation
  GENERATE_VIDEO: 25,       // Short video (5-15s)
  GENERATE_VIDEO_LONG: 50,  // Medium video (30-60s)
  GENERATE_VIDEO_PREMIUM: 100, // Long/premium video (2-5min)
  GENERATE_EMAIL: 3,        // AI email content

  // Publishing
  POST: 1,                  // Publish to 1 platform
  REPLY: 2,                 // AI-generated reply
  FAVOURITE: 0,             // Like (free)
  BOOST: 1,                 // Repost/boost

  // Intelligence
  SCAN_FEEDS: 1,            // RSS feed scan
  COLLECT_METRICS: 0,       // Metrics collection (free)

  // AI Chat
  AI_CHAT_MESSAGE: 5,       // Chat with AI assistant

  // Safety (no cost)
  SAFETY_BLOCK: 0,
  BAN_DETECTED: 0,

  // Email
  SEND_EMAIL: 1,            // Send 1 email
};

// ============ AFFILIATE COMMISSION RATES ============

export const AFFILIATE_RATES = {
  /** Commission on subscription payments (30%) */
  SUBSCRIPTION: 0.30,
  /** Commission on top-up purchases (15%) */
  TOPUP: 0.15,
  /** Minimum payout amount in cents ($25) */
  MIN_PAYOUT_CENTS: 2500,
  /** Cookie duration in days (10 years ≈ 3650 days) */
  COOKIE_DAYS: 3650,
  /** Commission lock period in days (30 days before payout eligible) */
  LOCK_PERIOD_DAYS: 30,
} as const;

// ============ BILLING LIMITS ============

export const BILLING_LIMITS = {
  /** Max top-up purchases per day per user */
  MAX_TOPUPS_PER_DAY: 10,
  /** Max credit balance (prevent abuse) */
  MAX_CREDIT_BALANCE: 50000,
  /** Welcome bonus credits for new signups */
  WELCOME_BONUS: 100,
  /** Free tier credits (no subscription) */
  FREE_CREDITS: 0,
} as const;
