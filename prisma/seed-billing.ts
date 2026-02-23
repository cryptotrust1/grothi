/**
 * Seed billing tables: SubscriptionPlan and TopupPack.
 *
 * Run: DATABASE_URL="..." npx tsx prisma/seed-billing.ts
 *
 * This script is idempotent — it upserts records by slug.
 */

import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function main() {
  console.log('Seeding billing data...');

  // ── Subscription Plans ──
  const plans = [
    {
      slug: 'bronze',
      name: 'Bronze',
      priceUsd: 1500,
      credits: 0,
      maxBots: 1,
      maxPlatforms: 3,
      allowRollover: false,
      maxRolloverCredits: 0,
      sortOrder: 0,
      features: ['1 AI marketing bot', '3 platforms per bot', 'Basic analytics', 'Email support'],
    },
    {
      slug: 'silver',
      name: 'Silver',
      priceUsd: 2900,
      credits: 500,
      maxBots: 3,
      maxPlatforms: 8,
      allowRollover: false,
      maxRolloverCredits: 0,
      sortOrder: 1,
      features: ['3 AI marketing bots', '8 platforms per bot', '500 credits/month', 'AI content generation', 'Priority support'],
    },
    {
      slug: 'gold',
      name: 'Gold',
      priceUsd: 8900,
      credits: 2000,
      maxBots: 10,
      maxPlatforms: 17,
      allowRollover: true,
      maxRolloverCredits: 1000,
      sortOrder: 2,
      features: ['10 AI marketing bots', 'All 17 platforms', '2,000 credits/month', 'Credit rollover (max 1,000)', 'AI image + video generation', 'Advanced analytics'],
    },
    {
      slug: 'diamond',
      name: 'Diamond',
      priceUsd: 22000,
      credits: 6000,
      maxBots: 999,
      maxPlatforms: 17,
      allowRollover: true,
      maxRolloverCredits: 3000,
      sortOrder: 3,
      features: ['Unlimited bots', 'All 17 platforms', '6,000 credits/month', 'Credit rollover (max 3,000)', 'Full feature access', 'Affiliate program', 'Dedicated support'],
    },
  ];

  for (const plan of plans) {
    await db.subscriptionPlan.upsert({
      where: { slug: plan.slug },
      update: {
        name: plan.name,
        priceUsd: plan.priceUsd,
        credits: plan.credits,
        maxBots: plan.maxBots,
        maxPlatforms: plan.maxPlatforms,
        allowRollover: plan.allowRollover,
        maxRolloverCredits: plan.maxRolloverCredits,
        sortOrder: plan.sortOrder,
        features: plan.features,
      },
      create: {
        slug: plan.slug,
        name: plan.name,
        priceUsd: plan.priceUsd,
        credits: plan.credits,
        maxBots: plan.maxBots,
        maxPlatforms: plan.maxPlatforms,
        allowRollover: plan.allowRollover,
        maxRolloverCredits: plan.maxRolloverCredits,
        sortOrder: plan.sortOrder,
        features: plan.features,
      },
    });
    console.log(`  ✓ Plan: ${plan.name} ($${(plan.priceUsd / 100).toFixed(0)}/mo, ${plan.credits} credits)`);
  }

  // ── Top-up Packs ──
  const packs = [
    { slug: 'mini',       name: 'Mini',       credits: 20,   priceUsd: 199,  sortOrder: 0 },
    { slug: 'starter',    name: 'Starter',    credits: 100,  priceUsd: 899,  sortOrder: 1 },
    { slug: 'standard',   name: 'Standard',   credits: 300,  priceUsd: 2499, sortOrder: 2 },
    { slug: 'pro',        name: 'Pro',        credits: 600,  priceUsd: 4499, sortOrder: 3 },
    { slug: 'business',   name: 'Business',   credits: 1000, priceUsd: 6999, sortOrder: 4 },
    { slug: 'enterprise', name: 'Enterprise', credits: 1600, priceUsd: 9999, sortOrder: 5 },
  ];

  for (const pack of packs) {
    await db.topupPack.upsert({
      where: { slug: pack.slug },
      update: {
        name: pack.name,
        credits: pack.credits,
        priceUsd: pack.priceUsd,
        sortOrder: pack.sortOrder,
      },
      create: {
        slug: pack.slug,
        name: pack.name,
        credits: pack.credits,
        priceUsd: pack.priceUsd,
        sortOrder: pack.sortOrder,
      },
    });
    console.log(`  ✓ Pack: ${pack.name} (${pack.credits} credits, $${(pack.priceUsd / 100).toFixed(2)})`);
  }

  console.log('\nBilling data seeded successfully!');
  console.log('\nNext steps:');
  console.log('1. Create Stripe Products and Prices for each plan/pack');
  console.log('2. Update stripePriceId in SubscriptionPlan and TopupPack tables');
  console.log('3. Configure Stripe webhooks for your domain');
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
