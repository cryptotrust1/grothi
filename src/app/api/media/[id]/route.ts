import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, resolve } from 'path';

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

  const filePath = resolve(join(UPLOAD_DIR, media.filePath));

  // Prevent path traversal - ensure resolved path is within UPLOAD_DIR
  if (!filePath.startsWith(resolve(UPLOAD_DIR))) {
    return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
  }

  if (!existsSync(filePath)) {
    return NextResponse.json({ error: 'File not found on disk' }, { status: 404 });
  }

  const buffer = await readFile(filePath);

  // Use inline for images, attachment for other types to prevent XSS
  const isImage = media.mimeType.startsWith('image/');
  const disposition = isImage ? 'inline' : 'attachment';
  const safeFilename = media.filename.replace(/[^a-zA-Z0-9._-]/g, '_');

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': media.mimeType,
      'Content-Length': String(media.fileSize),
      'Cache-Control': 'private, max-age=86400',
      'Content-Disposition': `${disposition}; filename="${safeFilename}"`,
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
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

  const filePath = resolve(join(UPLOAD_DIR, media.filePath));

  // Prevent path traversal
  if (!filePath.startsWith(resolve(UPLOAD_DIR))) {
    return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
  }

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
