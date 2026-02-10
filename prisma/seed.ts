import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create admin user
  const adminPassword = await hash('Admin123!', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@grothi.com' },
    update: {},
    create: {
      email: 'admin@grothi.com',
      name: 'Admin',
      passwordHash: adminPassword,
      role: 'ADMIN',
      emailVerified: true,
    },
  });

  // Create admin credit balance
  await prisma.creditBalance.upsert({
    where: { userId: admin.id },
    update: {},
    create: {
      userId: admin.id,
      balance: 99999,
    },
  });

  // Create default pricing plans
  const plans = [
    { name: 'Starter', credits: 1000, priceUsd: 1000, sortOrder: 0 },
    { name: 'Growth', credits: 5500, priceUsd: 4500, isPopular: true, sortOrder: 1 },
    { name: 'Pro', credits: 17000, priceUsd: 12000, sortOrder: 2 },
    { name: 'Enterprise', credits: 60000, priceUsd: 35000, sortOrder: 3 },
  ];

  for (const plan of plans) {
    await prisma.pricingPlan.upsert({
      where: { id: plan.name.toLowerCase() },
      update: plan,
      create: { id: plan.name.toLowerCase(), ...plan },
    });
  }

  // Create default action costs
  const actionCosts = [
    { actionType: 'GENERATE_CONTENT' as const, credits: 5, description: 'AI content generation (Claude API)' },
    { actionType: 'POST' as const, credits: 2, description: 'Post to platform' },
    { actionType: 'REPLY' as const, credits: 3, description: 'Reply to mention' },
    { actionType: 'FAVOURITE' as const, credits: 1, description: 'Like/Favourite' },
    { actionType: 'BOOST' as const, credits: 1, description: 'Boost/Repost' },
    { actionType: 'SCAN_FEEDS' as const, credits: 2, description: 'RSS feed scan' },
    { actionType: 'COLLECT_METRICS' as const, credits: 1, description: 'Engagement metrics collection' },
  ];

  for (const ac of actionCosts) {
    await prisma.actionCost.upsert({
      where: { actionType: ac.actionType },
      update: ac,
      create: ac,
    });
  }

  console.log('Seeding complete!');
  console.log(`Admin user: admin@grothi.com / Admin123!`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
