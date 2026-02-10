import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

const UPLOAD_DIR = join(process.cwd(), 'data', 'uploads');

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const media = await db.media.findUnique({
    where: { id },
    include: { bot: { select: { userId: true } } },
  });

  if (!media || media.bot.userId !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const filePath = join(UPLOAD_DIR, media.filePath);

  if (!existsSync(filePath)) {
    return NextResponse.json({ error: 'File not found on disk' }, { status: 404 });
  }

  const buffer = await readFile(filePath);

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': media.mimeType,
      'Content-Length': String(media.fileSize),
      'Cache-Control': 'private, max-age=86400',
      'Content-Disposition': `inline; filename="${media.filename}"`,
    },
  });
}

// Delete media
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const media = await db.media.findUnique({
    where: { id },
    include: { bot: { select: { userId: true } } },
  });

  if (!media || media.bot.userId !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const filePath = join(UPLOAD_DIR, media.filePath);

  // Delete from filesystem
  try {
    const { unlink } = await import('fs/promises');
    if (existsSync(filePath)) {
      await unlink(filePath);
    }
  } catch {
    // File may already be deleted
  }

  // Delete from database
  await db.media.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
