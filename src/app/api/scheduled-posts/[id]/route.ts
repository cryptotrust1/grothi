import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { apiError } from '@/lib/api-helpers';

// GET: Get a single scheduled post
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return apiError.unauthorized();

  const { id } = await params;

  const post = await db.scheduledPost.findUnique({
    where: { id },
    include: {
      bot: { select: { userId: true, name: true } },
      media: true,
    },
  });

  if (!post || post.bot.userId !== user.id) return apiError.notFound('Post');

  return NextResponse.json(post);
}

// PATCH: Update a scheduled post
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError.unauthorized();

    const { id } = await params;

    const post = await db.scheduledPost.findUnique({
      where: { id },
      include: { bot: { select: { userId: true } } },
    });

    if (!post || post.bot.userId !== user.id) return apiError.notFound('Post');

    // Only allow editing DRAFT and SCHEDULED posts
    if (!['DRAFT', 'SCHEDULED'].includes(post.status)) {
      return apiError.badRequest(`Cannot edit a post with status ${post.status}`);
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
  const updates: Record<string, unknown> = {};

  if (body.content !== undefined) {
    if (typeof body.content !== 'string' || (body.content as string).length > 10000) {
      return NextResponse.json({ error: 'Content must be a string under 10,000 characters' }, { status: 400 });
    }
    updates.content = body.content;
  }
  if (body.contentType !== undefined) updates.contentType = body.contentType;
  if (body.platforms !== undefined) {
    const { ALL_PLATFORMS } = await import('@/lib/constants');
    if (!Array.isArray(body.platforms) || !body.platforms.every((p: unknown) => typeof p === 'string' && (ALL_PLATFORMS as readonly string[]).includes(p as string))) {
      return NextResponse.json({ error: 'Invalid platforms array' }, { status: 400 });
    }
    updates.platforms = body.platforms;
  }
  if (body.platformContent !== undefined) updates.platformContent = body.platformContent;
  if (body.mediaId !== undefined) {
    if (body.mediaId) {
      const media = await db.media.findFirst({ where: { id: body.mediaId as string, botId: post.botId } });
      if (!media) {
        return NextResponse.json({ error: 'Media not found' }, { status: 404 });
      }
    }
    updates.mediaId = body.mediaId || null;
  }

  // Post type and carousel media
  if (body.postType !== undefined) {
    const validPostTypes = ['feed', 'reel', 'story', 'carousel', ''];
    if (body.postType && !validPostTypes.includes(body.postType as string)) {
      return NextResponse.json(
        { error: `Invalid postType. Must be one of: feed, reel, story, carousel` },
        { status: 400 }
      );
    }
    updates.postType = body.postType || null;
  }
  if (body.mediaIds !== undefined) {
    updates.mediaIds = Array.isArray(body.mediaIds) && body.mediaIds.length > 0 ? body.mediaIds : null;
  }

  if (body.scheduledAt !== undefined) {
    if (body.scheduledAt) {
      const scheduled = new Date(body.scheduledAt as string | number);
      if (isNaN(scheduled.getTime())) {
        return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
      }
      if (scheduled < new Date()) {
        return NextResponse.json({ error: 'Scheduled time must be in the future' }, { status: 400 });
      }
      updates.scheduledAt = scheduled;
      updates.status = 'SCHEDULED';
    } else {
      updates.scheduledAt = null;
      updates.status = 'DRAFT';
    }
  }

  if (body.status === 'CANCELLED') {
    updates.status = 'CANCELLED';
  }

    const updated = await db.scheduledPost.update({
      where: { id },
      data: updates,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('[scheduled-posts PATCH] Error:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: 'Failed to update scheduled post' },
      { status: 500 }
    );
  }
}

// DELETE: Delete a scheduled post
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError.unauthorized();

    const { id } = await params;

    const post = await db.scheduledPost.findUnique({
      where: { id },
      include: { bot: { select: { userId: true } } },
    });

    if (!post || post.bot.userId !== user.id) return apiError.notFound('Post');

    if (post.status === 'PUBLISHING') {
      return apiError.badRequest('Cannot delete a post that is currently publishing');
    }

    await db.scheduledPost.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[scheduled-posts DELETE] Error:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: 'Failed to delete scheduled post' },
      { status: 500 }
    );
  }
}
