import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { processEngagementFeedback } from '@/lib/rl-engine';

// POST: Bulk update engagement metrics and trigger learning
// Called by metrics collection worker after fetching from platform APIs
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { updates } = body;

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json({ error: 'updates array required' }, { status: 400 });
    }

    if (updates.length > 100) {
      return NextResponse.json({ error: 'Maximum 100 updates per request' }, { status: 400 });
    }

    const results = [];

    for (const update of updates) {
      try {
        const engagement = await db.postEngagement.findUnique({
          where: { id: update.postEngagementId },
          include: { bot: { select: { userId: true } } },
        });

        if (!engagement || engagement.bot.userId !== user.id) {
          results.push({ id: update.postEngagementId, error: 'Not found' });
          continue;
        }

        await db.postEngagement.update({
          where: { id: update.postEngagementId },
          data: {
            likes: update.likes ?? engagement.likes,
            comments: update.comments ?? engagement.comments,
            shares: update.shares ?? engagement.shares,
            saves: update.saves ?? engagement.saves,
            dwellTimeMs: update.dwellTimeMs ?? engagement.dwellTimeMs,
            watchTimeSec: update.watchTimeSec ?? engagement.watchTimeSec,
            impressions: update.impressions ?? engagement.impressions,
            reach: update.reach ?? engagement.reach,
            clickthroughs: update.clickthroughs ?? engagement.clickthroughs,
            collectedAt: null,
          },
        });

        const learnResult = await processEngagementFeedback(update.postEngagementId);
        results.push({ id: update.postEngagementId, ...learnResult });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown';
        results.push({ id: update.postEngagementId, error: message });
      }
    }

    return NextResponse.json({
      processed: results.filter((r) => !('error' in r)).length,
      errors: results.filter((r) => 'error' in r).length,
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Metrics collection error:', message);
    return NextResponse.json({ error: 'Failed to process metrics' }, { status: 500 });
  }
}
