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
  const { id } = await params;

  const media = await db.media.findUnique({
    where: { id },
    include: { bot: { select: { userId: true } } },
  });

  if (!media) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Auth: if user is logged in, verify ownership.
  // If no user (external access from Instagram/Threads/Facebook servers), allow access.
  // The CUID media ID is unguessable (25+ random chars) so it acts as a secret token.
  // This is required because Instagram Graph API fetches the image URL server-side.
  const user = await getCurrentUser();
  if (user && media.bot.userId !== user.id) {
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

  const isImage = media.mimeType.startsWith('image/');
  const isVideo = media.mimeType.startsWith('video/');
  const safeFilename = media.filename.replace(/[^a-zA-Z0-9._-]/g, '_');

  // Serve images and videos inline (for preview/playback), others as attachment
  const disposition = (isImage || isVideo) ? 'inline' : 'attachment';

  // Support Range requests for video streaming (required for HTML5 <video>)
  if (isVideo) {
    const rangeHeader = request.headers.get('range');
    const { stat } = await import('fs/promises');
    const fileStat = await stat(filePath);
    const fileSize = fileStat.size;

    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      const { createReadStream } = await import('fs');
      const stream = createReadStream(filePath, { start, end });

      // Convert Node.js Readable to Web ReadableStream
      const webStream = new ReadableStream({
        start(controller) {
          stream.on('data', (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)));
          stream.on('end', () => controller.close());
          stream.on('error', (err) => controller.error(err));
        },
      });

      return new NextResponse(webStream, {
        status: 206,
        headers: {
          'Content-Type': media.mimeType,
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': String(chunkSize),
          'Content-Disposition': `inline; filename="${safeFilename}"`,
          'X-Content-Type-Options': 'nosniff',
          'Cache-Control': 'private, max-age=86400',
        },
      });
    }

    // No Range header — return full video with Accept-Ranges
    const buffer = await readFile(filePath);
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': media.mimeType,
        'Content-Length': String(fileSize),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'private, max-age=86400',
        'Content-Disposition': `inline; filename="${safeFilename}"`,
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }

  // Non-video files: serve as before
  const buffer = await readFile(filePath);

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
