import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { OPTIMAL_POSTING_TIMES } from '@/lib/platform-specs';

// GET: List scheduled posts for a bot
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const botId = searchParams.get('botId');
  const status = searchParams.get('status');
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  if (!botId) {
    return NextResponse.json({ error: 'botId required' }, { status: 400 });
  }

  const bot = await db.bot.findFirst({ where: { id: botId, userId: user.id } });
  if (!bot) {
    return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
  }

  const where: Record<string, unknown> = { botId };
  if (status && status !== 'ALL') {
    where.status = status;
  }
  if (from || to) {
    where.scheduledAt = {};
    if (from) (where.scheduledAt as Record<string, unknown>).gte = new Date(from);
    if (to) (where.scheduledAt as Record<string, unknown>).lte = new Date(to);
  }

  const posts = await db.scheduledPost.findMany({
    where: where as any,
    orderBy: { scheduledAt: 'asc' },
    include: { media: { select: { id: true, filename: true, type: true, mimeType: true } } },
    take: 100,
  });

  return NextResponse.json(posts);
}

// POST: Create a scheduled post
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { botId, content, contentType, mediaId, platforms, platformContent, scheduledAt, autoSchedule } = body;

    if (!botId || !content) {
      return NextResponse.json({ error: 'botId and content are required' }, { status: 400 });
    }

    const bot = await db.bot.findFirst({ where: { id: botId, userId: user.id } });
    if (!bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
    }

    // Validate platforms
    const selectedPlatforms = Array.isArray(platforms) ? platforms : ['MASTODON'];
    if (selectedPlatforms.length === 0) {
      return NextResponse.json({ error: 'At least one platform required' }, { status: 400 });
    }

    // If autoSchedule, determine the next optimal time
    let finalScheduledAt: Date | null = null;
    if (autoSchedule) {
      finalScheduledAt = getNextOptimalTime(selectedPlatforms, bot.timezone);
    } else if (scheduledAt) {
      finalScheduledAt = new Date(scheduledAt);
      if (finalScheduledAt < new Date()) {
        return NextResponse.json({ error: 'Scheduled time must be in the future' }, { status: 400 });
      }
    }

    // Validate media if provided
    if (mediaId) {
      const media = await db.media.findFirst({ where: { id: mediaId, botId } });
      if (!media) {
        return NextResponse.json({ error: 'Media not found' }, { status: 404 });
      }
    }

    const status = finalScheduledAt ? 'SCHEDULED' : 'DRAFT';

    const post = await db.scheduledPost.create({
      data: {
        botId,
        content,
        contentType: contentType || 'custom',
        mediaId: mediaId || null,
        platforms: selectedPlatforms,
        platformContent: platformContent || null,
        scheduledAt: finalScheduledAt,
        autoSchedule: autoSchedule || false,
        status,
      },
    });

    return NextResponse.json(post, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Create scheduled post error:', message);
    return NextResponse.json(
      { error: 'Failed to create post: ' + message },
      { status: 500 }
    );
  }
}

// Helper: Find next optimal posting time
function getNextOptimalTime(platforms: string[], timezone: string): Date {
  const now = new Date();
  const isWeekend = now.getDay() === 0 || now.getDay() === 6;

  // Collect all optimal hours from selected platforms
  const allHours: number[] = [];
  for (const platform of platforms) {
    const times = OPTIMAL_POSTING_TIMES[platform];
    if (times) {
      const hours = isWeekend ? times.weekend : times.weekday;
      allHours.push(...hours);
    }
  }

  if (allHours.length === 0) {
    // Default: next hour
    const next = new Date(now);
    next.setHours(next.getHours() + 1, 0, 0, 0);
    return next;
  }

  // Find the most common optimal hour (overlap between platforms)
  const hourCounts: Record<number, number> = {};
  for (const h of allHours) {
    hourCounts[h] = (hourCounts[h] || 0) + 1;
  }

  const sortedHours = Object.entries(hourCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([h]) => parseInt(h));

  const currentHour = now.getHours();

  // Find the next available optimal hour
  for (const hour of sortedHours) {
    if (hour > currentHour) {
      const next = new Date(now);
      next.setHours(hour, 0, 0, 0);
      return next;
    }
  }

  // All optimal hours for today have passed - schedule for tomorrow
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(sortedHours[0], 0, 0, 0);
  return tomorrow;
}
