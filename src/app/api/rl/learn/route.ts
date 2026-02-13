import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { processEngagementFeedback } from '@/lib/rl-engine';

// POST: Trigger learning from engagement records
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { postEngagementId, botId } = body;

    if (postEngagementId) {
      const engagement = await db.postEngagement.findUnique({
        where: { id: postEngagementId },
        include: { bot: { select: { userId: true } } },
      });

      if (!engagement || engagement.bot.userId !== user.id) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }

      const result = await processEngagementFeedback(postEngagementId);
      return NextResponse.json(result);
    }

    if (botId) {
      const bot = await db.bot.findFirst({ where: { id: botId, userId: user.id } });
      if (!bot) {
        return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
      }

      // Process unprocessed engagements with non-zero metrics
      const unprocessed = await db.postEngagement.findMany({
        where: {
          botId,
          collectedAt: null,
          OR: [
            { likes: { gt: 0 } },
            { comments: { gt: 0 } },
            { shares: { gt: 0 } },
            { saves: { gt: 0 } },
          ],
        },
        take: 50,
        orderBy: { postedAt: 'asc' },
      });

      const results = [];
      for (const eng of unprocessed) {
        try {
          const result = await processEngagementFeedback(eng.id);
          results.push({ id: eng.id, ...result });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown';
          results.push({ id: eng.id, error: message });
        }
      }

      return NextResponse.json({ processed: results.length, results });
    }

    return NextResponse.json({ error: 'postEngagementId or botId required' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('RL learn error:', message);
    return NextResponse.json({ error: 'Failed to process learning' }, { status: 500 });
  }
}
