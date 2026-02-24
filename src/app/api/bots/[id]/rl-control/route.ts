/**
 * POST /api/bots/{id}/rl-control
 *
 * User-controlled RL learning management.
 * Allows users to confirm, reject, or reset what the bot has learned.
 *
 * Actions:
 *   - boost_arm: Confirm a learning (increase arm reward by +2 sigma)
 *   - penalize_arm: Reject a learning (decrease arm reward by -2 sigma)
 *   - reset_dimension: Reset all arms for a dimension on a platform
 *   - reset_platform: Reset all learning for a specific platform
 *   - reset_all: Reset all learning data for the bot
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import type { PlatformType, RLDimension } from '@prisma/client';

const VALID_DIMENSIONS: RLDimension[] = ['TIME_SLOT', 'CONTENT_TYPE', 'HASHTAG_PATTERN', 'TONE_STYLE'];

type Action = 'boost_arm' | 'penalize_arm' | 'reset_dimension' | 'reset_platform' | 'reset_all';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: botId } = await params;

  // Verify bot ownership
  const bot = await db.bot.findFirst({ where: { id: botId, userId: user.id } });
  if (!bot) {
    return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const action = body.action as Action;

  switch (action) {
    case 'boost_arm':
    case 'penalize_arm': {
      const platform = body.platform as PlatformType;
      const dimension = body.dimension as RLDimension;
      const armKey = body.armKey as string;

      if (!platform || !dimension || !armKey) {
        return NextResponse.json(
          { error: 'platform, dimension, and armKey are required' },
          { status: 400 }
        );
      }
      if (!VALID_DIMENSIONS.includes(dimension)) {
        return NextResponse.json({ error: 'Invalid dimension' }, { status: 400 });
      }

      const armState = await db.rLArmState.findUnique({
        where: { botId_platform_dimension_armKey: { botId, platform, dimension, armKey } },
      });

      if (!armState) {
        return NextResponse.json({ error: 'Arm state not found' }, { status: 404 });
      }

      // Apply user feedback as a reward adjustment
      // Boost: add +2 standard deviations worth of reward
      // Penalize: subtract 2 standard deviations worth of reward
      const stddev = Math.sqrt(Math.max(armState.variance, 0.01));
      const adjustment = action === 'boost_arm' ? stddev * 2 : -stddev * 2;
      const newEwma = Math.max(0, armState.ewmaReward + adjustment);

      await db.rLArmState.update({
        where: { botId_platform_dimension_armKey: { botId, platform, dimension, armKey } },
        data: { ewmaReward: newEwma },
      });

      return NextResponse.json({
        success: true,
        message: `${action === 'boost_arm' ? 'Boosted' : 'Penalized'} ${armKey} in ${dimension} on ${platform}`,
        newReward: Math.round(newEwma * 100) / 100,
      });
    }

    case 'reset_dimension': {
      const platform = body.platform as PlatformType;
      const dimension = body.dimension as RLDimension;

      if (!platform || !dimension) {
        return NextResponse.json(
          { error: 'platform and dimension are required' },
          { status: 400 }
        );
      }

      const deleted = await db.rLArmState.deleteMany({
        where: { botId, platform, dimension },
      });

      return NextResponse.json({
        success: true,
        message: `Reset ${dimension} learning on ${platform}`,
        deletedArms: deleted.count,
      });
    }

    case 'reset_platform': {
      const platform = body.platform as PlatformType;
      if (!platform) {
        return NextResponse.json({ error: 'platform is required' }, { status: 400 });
      }

      const [deletedArms, deletedConfig] = await db.$transaction([
        db.rLArmState.deleteMany({ where: { botId, platform } }),
        db.rLConfig.deleteMany({ where: { botId, platform } }),
      ]);

      return NextResponse.json({
        success: true,
        message: `Reset all learning on ${platform}`,
        deletedArms: deletedArms.count,
        deletedConfigs: deletedConfig.count,
      });
    }

    case 'reset_all': {
      const [deletedArms, deletedConfigs] = await db.$transaction([
        db.rLArmState.deleteMany({ where: { botId } }),
        db.rLConfig.deleteMany({ where: { botId } }),
      ]);

      return NextResponse.json({
        success: true,
        message: 'Reset all learning data',
        deletedArms: deletedArms.count,
        deletedConfigs: deletedConfigs.count,
      });
    }

    default:
      return NextResponse.json(
        { error: `Unknown action: ${action}. Valid: boost_arm, penalize_arm, reset_dimension, reset_platform, reset_all` },
        { status: 400 }
      );
  }
}
