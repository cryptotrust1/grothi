import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';

// GET: Get a single scheduled post
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const post = await db.scheduledPost.findUnique({
    where: { id },
    include: {
      bot: { select: { userId: true, name: true } },
      media: true,
    },
  });

  if (!post || post.bot.userId !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(post);
}

// PATCH: Update a scheduled post
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const post = await db.scheduledPost.findUnique({
    where: { id },
    include: { bot: { select: { userId: true } } },
  });

  if (!post || post.bot.userId !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Only allow editing DRAFT and SCHEDULED posts
  if (!['DRAFT', 'SCHEDULED'].includes(post.status)) {
    return NextResponse.json(
      { error: `Cannot edit a post with status ${post.status}` },
      { status: 400 }
    );
  }

  const body = await request.json();
  const updates: Record<string, unknown> = {};

  if (body.content !== undefined) updates.content = body.content;
  if (body.contentType !== undefined) updates.contentType = body.contentType;
  if (body.platforms !== undefined) updates.platforms = body.platforms;
  if (body.platformContent !== undefined) updates.platformContent = body.platformContent;
  if (body.mediaId !== undefined) updates.mediaId = body.mediaId || null;

  if (body.scheduledAt !== undefined) {
    if (body.scheduledAt) {
      const scheduled = new Date(body.scheduledAt);
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
}

// DELETE: Delete a scheduled post
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const post = await db.scheduledPost.findUnique({
    where: { id },
    include: { bot: { select: { userId: true } } },
  });

  if (!post || post.bot.userId !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (post.status === 'PUBLISHING') {
    return NextResponse.json({ error: 'Cannot delete a post that is currently publishing' }, { status: 400 });
  }

  await db.scheduledPost.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
