import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { computeEngagementScore } from '@/lib/rl-engine';
import type { PlatformType, Prisma } from '@prisma/client';
import { ALL_PLATFORMS } from '@/lib/constants';

// POST: Record engagement metrics for a published post
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      botId, platform, scheduledPostId, activityId, externalPostId,
      likes, comments, shares, saves,
      dwellTimeMs, watchTimeSec, impressions, reach, clickthroughs,
      contentType, timeSlot, dayOfWeek, hashtagPattern, toneStyle,
      postedAt,
    } = body;

    if (!botId || !platform) {
      return NextResponse.json({ error: 'botId and platform are required' }, { status: 400 });
    }

    const validPlatforms = new Set(ALL_PLATFORMS as readonly string[]);
    if (!validPlatforms.has(platform)) {
      return NextResponse.json({ error: 'Invalid platform' }, { status: 400 });
    }

    const bot = await db.bot.findFirst({ where: { id: botId, userId: user.id } });
    if (!bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
    }

    const safeInt = (val: unknown, fallback: number = 0): number => {
      const num = typeof val === 'number' ? val : parseInt(String(val));
      return isNaN(num) ? fallback : Math.max(0, num);
    };

    const safeFloat = (val: unknown): number | null => {
      if (val == null) return null;
      const num = typeof val === 'number' ? val : parseFloat(String(val));
      return isNaN(num) ? null : num;
    };

    const engagementData = {
      botId,
      platform: platform as PlatformType,
      scheduledPostId: scheduledPostId || null,
      activityId: activityId || null,
      externalPostId: externalPostId || null,
      likes: safeInt(likes),
      comments: safeInt(comments),
      shares: safeInt(shares),
      saves: safeInt(saves),
      dwellTimeMs: safeFloat(dwellTimeMs) != null ? safeInt(dwellTimeMs) : null,
      watchTimeSec: safeFloat(watchTimeSec),
      impressions: safeFloat(impressions) != null ? safeInt(impressions) : null,
      reach: safeFloat(reach) != null ? safeInt(reach) : null,
      clickthroughs: safeFloat(clickthroughs) != null ? safeInt(clickthroughs) : null,
      engagementScore: 0,
      contentType: contentType || null,
      timeSlot: timeSlot != null ? safeInt(timeSlot) : null,
      dayOfWeek: dayOfWeek != null ? safeInt(dayOfWeek) : null,
      hashtagPattern: hashtagPattern || null,
      toneStyle: toneStyle || null,
      postedAt: postedAt ? new Date(postedAt) : new Date(),
    };

    engagementData.engagementScore = computeEngagementScore(
      {
        likes: engagementData.likes,
        comments: engagementData.comments,
        shares: engagementData.shares,
        saves: engagementData.saves,
        dwellTimeMs: engagementData.dwellTimeMs,
        watchTimeSec: engagementData.watchTimeSec,
      },
      platform as PlatformType
    );

    const engagement = await db.postEngagement.create({ data: engagementData });
    return NextResponse.json(engagement, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Record engagement error:', message);
    return NextResponse.json({ error: 'Failed to record engagement' }, { status: 500 });
  }
}

// GET: List engagement records for a bot
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const botId = searchParams.get('botId');
  const platform = searchParams.get('platform');
  const limitRaw = parseInt(searchParams.get('limit') ?? '50');
  const limit = isNaN(limitRaw) ? 50 : Math.min(Math.max(1, limitRaw), 200);

  if (!botId) {
    return NextResponse.json({ error: 'botId required' }, { status: 400 });
  }

  const bot = await db.bot.findFirst({ where: { id: botId, userId: user.id } });
  if (!bot) {
    return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
  }

  const where: Prisma.PostEngagementWhereInput = { botId };
  if (platform) where.platform = platform as PlatformType;

  const engagements = await db.postEngagement.findMany({
    where,
    orderBy: { postedAt: 'desc' },
    take: limit,
  });

  return NextResponse.json(engagements);
}
