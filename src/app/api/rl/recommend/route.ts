import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  getContentRecommendation,
  checkSpamLimits,
  getLearningOverview,
  getArmDistribution,
} from '@/lib/rl-engine';
import type { PlatformType, RLDimension } from '@prisma/client';

// GET: Get content recommendation or learning analytics
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const botId = searchParams.get('botId');
  const platform = searchParams.get('platform') as PlatformType | null;
  const action = searchParams.get('action') ?? 'recommend';

  if (!botId) {
    return NextResponse.json({ error: 'botId required' }, { status: 400 });
  }

  const bot = await db.bot.findFirst({ where: { id: botId, userId: user.id } });
  if (!bot) {
    return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
  }

  try {
    switch (action) {
      case 'recommend': {
        if (!platform) {
          return NextResponse.json({ error: 'platform required for recommendation' }, { status: 400 });
        }

        const spamCheck = await checkSpamLimits(botId, platform, bot.safetyLevel);
        if (!spamCheck.allowed) {
          return NextResponse.json({
            recommendation: null,
            blocked: true,
            reason: spamCheck.reason,
            waitMinutes: spamCheck.waitMinutes,
          });
        }

        // Get allowed content types from bot reactor state
        const reactorState = (bot.reactorState as Record<string, unknown>) || {};
        const allowedContentTypes = (reactorState.contentTypes as string[]) || undefined;

        const recommendation = await getContentRecommendation(
          botId, platform, bot.safetyLevel, allowedContentTypes
        );
        return NextResponse.json({ recommendation, blocked: false });
      }

      case 'overview': {
        const overview = await getLearningOverview(botId);
        return NextResponse.json(overview);
      }

      case 'distribution': {
        if (!platform) {
          return NextResponse.json({ error: 'platform required for distribution' }, { status: 400 });
        }
        const dimension = (searchParams.get('dimension') ?? 'CONTENT_TYPE') as RLDimension;
        const distribution = await getArmDistribution(botId, platform, dimension);
        return NextResponse.json(distribution);
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('RL recommend error:', message);
    return NextResponse.json({ error: 'Failed to generate recommendation' }, { status: 500 });
  }
}
