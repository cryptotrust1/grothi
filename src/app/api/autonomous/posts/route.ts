import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';

/**
 * PATCH /api/autonomous/posts — Edit, approve, or delete autopilot posts
 * Actions: approve, delete, edit
 */
export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { action: string; postId: string; content?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { action, postId, content } = body;
  if (!action || !postId) {
    return NextResponse.json({ error: 'Missing action or postId' }, { status: 400 });
  }

  // Verify the post belongs to this user
  const post = await db.scheduledPost.findFirst({
    where: { id: postId, bot: { userId: user.id } },
    include: { bot: { select: { id: true, userId: true } } },
  });

  if (!post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  }

  switch (action) {
    case 'approve': {
      if (post.content.startsWith('[AUTOPILOT]') || post.content.startsWith('[GENERATING]')) {
        return NextResponse.json({ error: 'Cannot approve — AI is still generating content' }, { status: 400 });
      }
      const scheduledAt = post.scheduledAt && post.scheduledAt > new Date()
        ? post.scheduledAt
        : new Date(Date.now() + 5 * 60 * 1000);

      await db.scheduledPost.update({
        where: { id: postId },
        data: { status: 'SCHEDULED', scheduledAt },
      });
      return NextResponse.json({ success: true, message: 'Post approved and scheduled' });
    }

    case 'delete': {
      // Allow deleting DRAFT, SCHEDULED, and FAILED posts
      if (!['DRAFT', 'SCHEDULED', 'FAILED', 'CANCELLED'].includes(post.status)) {
        return NextResponse.json({ error: 'Cannot delete a published or publishing post' }, { status: 400 });
      }
      await db.scheduledPost.delete({ where: { id: postId } });
      return NextResponse.json({ success: true, message: 'Post deleted' });
    }

    case 'edit': {
      if (!content || typeof content !== 'string') {
        return NextResponse.json({ error: 'Missing content for edit' }, { status: 400 });
      }
      if (content.length > 10000) {
        return NextResponse.json({ error: 'Content too long' }, { status: 400 });
      }
      // Allow editing DRAFT, SCHEDULED, and FAILED posts
      if (!['DRAFT', 'SCHEDULED', 'FAILED'].includes(post.status)) {
        return NextResponse.json({ error: 'Cannot edit a published post' }, { status: 400 });
      }
      await db.scheduledPost.update({
        where: { id: postId },
        data: { content: content.trim() },
      });
      return NextResponse.json({ success: true, message: 'Post updated' });
    }

    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }
}
