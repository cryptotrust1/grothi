import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { OPTIMAL_POSTING_TIMES } from '@/lib/platform-specs';
import { ALL_PLATFORMS } from '@/lib/constants';
import { apiError } from '@/lib/api-helpers';

// GET: List scheduled posts for a bot
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return apiError.unauthorized();

  const { searchParams } = new URL(request.url);
  const botId = searchParams.get('botId');
  const status = searchParams.get('status');
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  if (!botId) return apiError.badRequest('botId required');

  const bot = await db.bot.findFirst({ where: { id: botId, userId: user.id } });
  if (!bot) return apiError.notFound('Bot');

  const where: Record<string, unknown> = { botId };
  const VALID_STATUSES = ['DRAFT', 'SCHEDULED', 'PUBLISHING', 'PUBLISHED', 'FAILED', 'CANCELLED'];
  if (status && status !== 'ALL') {
    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 });
    }
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
  if (!user) return apiError.unauthorized();

  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const { botId, content, contentType, mediaId, platforms, platformContent, scheduledAt, autoSchedule, postType, mediaIds, fbPostType, threadsPostType } = body;

    if (!botId || !content) return apiError.badRequest('botId and content are required');
    if (typeof content !== 'string' || content.length > 10000) {
      return NextResponse.json({ error: 'Content must be a string under 10,000 characters' }, { status: 400 });
    }

    const bot = await db.bot.findFirst({ where: { id: botId, userId: user.id } });
    if (!bot) return apiError.notFound('Bot');

    // Validate platforms
    const selectedPlatforms = Array.isArray(platforms) ? platforms : ['MASTODON'];
    if (selectedPlatforms.length === 0) {
      return NextResponse.json({ error: 'At least one platform required' }, { status: 400 });
    }
    if (selectedPlatforms.length > 17) {
      return NextResponse.json({ error: 'Maximum 17 platforms allowed per post' }, { status: 400 });
    }
    const validPlatforms = new Set(ALL_PLATFORMS as readonly string[]);
    const invalidPlatforms = selectedPlatforms.filter((p: string) => !validPlatforms.has(p));
    if (invalidPlatforms.length > 0) {
      return NextResponse.json({ error: `Invalid platforms: ${invalidPlatforms.join(', ')}` }, { status: 400 });
    }

    // If autoSchedule, determine the next optimal time
    let finalScheduledAt: Date | null = null;
    if (autoSchedule) {
      finalScheduledAt = getNextOptimalTime(selectedPlatforms, bot.timezone);
    } else if (scheduledAt) {
      finalScheduledAt = new Date(scheduledAt);
      if (isNaN(finalScheduledAt.getTime())) {
        return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
      }
      if (finalScheduledAt < new Date()) {
        return NextResponse.json({ error: 'Scheduled time must be in the future' }, { status: 400 });
      }
    }

    // Validate postType (Instagram) if provided
    const validIgPostTypes = ['feed', 'reel', 'story', 'carousel'];
    if (postType && !validIgPostTypes.includes(postType)) {
      return NextResponse.json(
        { error: `Invalid postType: ${postType}. Must be one of: ${validIgPostTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate fbPostType (Facebook) if provided
    const validFbPostTypes = ['text', 'photo', 'video', 'reel', 'link'];
    if (fbPostType && !validFbPostTypes.includes(fbPostType)) {
      return NextResponse.json(
        { error: `Invalid fbPostType: ${fbPostType}. Must be one of: ${validFbPostTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate threadsPostType (Threads) if provided
    const validThreadsPostTypes = ['text', 'image', 'video', 'carousel'];
    if (threadsPostType && !validThreadsPostTypes.includes(threadsPostType)) {
      return NextResponse.json(
        { error: `Invalid threadsPostType: ${threadsPostType}. Must be one of: ${validThreadsPostTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate media if provided
    if (mediaId) {
      const media = await db.media.findFirst({ where: { id: mediaId, botId } });
      if (!media) {
        return NextResponse.json({ error: 'Media not found' }, { status: 404 });
      }
    }

    // Validate mediaIds for carousel
    const validatedMediaIds: string[] | null = Array.isArray(mediaIds) && mediaIds.length > 0 ? mediaIds : null;
    if (postType === 'carousel') {
      if (!validatedMediaIds || validatedMediaIds.length < 2) {
        return NextResponse.json(
          { error: 'Carousel requires at least 2 media items.' },
          { status: 400 }
        );
      }
      if (validatedMediaIds.length > 10) {
        return NextResponse.json(
          { error: 'Carousel allows maximum 10 media items.' },
          { status: 400 }
        );
      }
      // Verify all media items exist and belong to this bot
      const mediaCount = await db.media.count({
        where: { id: { in: validatedMediaIds }, botId },
      });
      if (mediaCount !== validatedMediaIds.length) {
        return NextResponse.json(
          { error: 'Some carousel media items not found or do not belong to this bot.' },
          { status: 400 }
        );
      }
    }

    // Instagram-specific validation
    if (selectedPlatforms.includes('INSTAGRAM')) {
      if (postType === 'reel' && mediaId) {
        const media = await db.media.findFirst({ where: { id: mediaId, botId } });
        if (media && media.type !== 'VIDEO') {
          return NextResponse.json(
            { error: 'Reels require a video file. Selected media is not a video.' },
            { status: 400 }
          );
        }
      }
      if (!mediaId && !validatedMediaIds && postType !== 'carousel') {
        // Instagram requires media (no text-only posts)
        return NextResponse.json(
          { error: 'Instagram does not support text-only posts. Please add an image or video.' },
          { status: 400 }
        );
      }
    }

    // Combine per-platform post types into JSON for storage
    const postTypeMap: Record<string, string> = {};
    if (postType) postTypeMap.instagram = postType;
    if (fbPostType) postTypeMap.facebook = fbPostType;
    if (threadsPostType) postTypeMap.threads = threadsPostType;
    const finalPostType = Object.keys(postTypeMap).length > 0 ? JSON.stringify(postTypeMap) : null;

    const status = finalScheduledAt ? 'SCHEDULED' : 'DRAFT';

    const post = await db.scheduledPost.create({
      data: {
        botId,
        content,
        contentType: contentType || 'custom',
        mediaId: mediaId || null,
        postType: finalPostType,
        mediaIds: validatedMediaIds ?? undefined,
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
      { error: 'Failed to create post. Please try again.' },
      { status: 500 }
    );
  }
}

// Helper: Find next optimal posting time (timezone-aware)
function getNextOptimalTime(platforms: string[], timezone: string): Date {
  const now = new Date();

  // Get current hour in the bot's timezone
  let currentHourInTz: number;
  let isWeekend: boolean;
  try {
    const tzNow = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
    currentHourInTz = tzNow.getHours();
    isWeekend = tzNow.getDay() === 0 || tzNow.getDay() === 6;
  } catch {
    currentHourInTz = now.getHours();
    isWeekend = now.getDay() === 0 || now.getDay() === 6;
  }

  // Calculate timezone offset for converting local hours to UTC
  let offsetMs = 0;
  try {
    const tzDate = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
    const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
    offsetMs = utcDate.getTime() - tzDate.getTime();
  } catch {
    // Invalid timezone — use server time
  }

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

  // Convert optimal local hours to UTC dates
  const todayStr = now.toISOString().slice(0, 10);

  // Find the next available optimal hour (in bot's timezone)
  for (const hour of sortedHours) {
    if (hour > currentHourInTz) {
      const localStr = `${todayStr}T${String(hour).padStart(2, '0')}:00:00Z`;
      return new Date(new Date(localStr).getTime() + offsetMs);
    }
  }

  // All optimal hours for today have passed - schedule for tomorrow
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);
  const localStr = `${tomorrowStr}T${String(sortedHours[0]).padStart(2, '0')}:00:00Z`;
  return new Date(new Date(localStr).getTime() + offsetMs);
}
