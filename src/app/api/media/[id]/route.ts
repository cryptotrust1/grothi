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

  // Detect if request is from Meta's servers (Instagram/Facebook/Threads).
  // Meta crawlers use user-agents like "facebookexternalhit/1.1" and "Instagram".
  const userAgent = request.headers.get('user-agent') || '';
  const isMetaCrawler = /facebookexternalhit|Instagram|Facebot/i.test(userAgent);

  // Auth: if user is logged in, verify ownership.
  // If no user (external access from Instagram/Threads/Facebook servers), allow access.
  // The CUID media ID is unguessable (25+ random chars) so it acts as a secret token.
  // This is required because Instagram Graph API fetches the image URL server-side.
  const user = isMetaCrawler ? null : await getCurrentUser();
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

  // Force download when ?download=true is passed
  const forceDownload = request.nextUrl.searchParams.get('download') === 'true';

  // Serve images and videos inline (for preview/playback), others as attachment
  const disposition = forceDownload ? 'attachment' : (isImage || isVideo) ? 'inline' : 'attachment';

  // Support Range requests for video streaming (required for HTML5 <video>)
  if (isVideo && !forceDownload) {
    const rangeHeader = request.headers.get('range');
    const { stat } = await import('fs/promises');
    const fileStat = await stat(filePath);
    const fileSize = fileStat.size;

    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      // Validate range boundaries
      if (isNaN(start) || isNaN(end) || start < 0 || end < start || end >= fileSize) {
        return new NextResponse(null, {
          status: 416,
          headers: { 'Content-Range': `bytes */${fileSize}` },
        });
      }

      const chunkSize = end - start + 1;

      const { createReadStream } = await import('fs');
      const stream = createReadStream(filePath, { start, end });

      // Convert Node.js Readable to Web ReadableStream.
      // Track closed state to prevent ERR_INVALID_STATE when data arrives
      // after the controller has been closed (race condition in Node streams).
      const webStream = new ReadableStream({
        start(controller) {
          let closed = false;
          stream.on('data', (chunk) => {
            if (!closed) {
              try {
                controller.enqueue(new Uint8Array(Buffer.from(chunk)));
              } catch {
                // Controller already closed — ignore
                closed = true;
              }
            }
          });
          stream.on('end', () => {
            if (!closed) {
              closed = true;
              try {
                controller.close();
              } catch {
                // Already closed — ignore
              }
            }
          });
          stream.on('error', (err) => {
            if (!closed) {
              closed = true;
              try {
                controller.error(err);
              } catch {
                // Already closed/errored — ignore
              }
            }
          });
        },
        cancel() {
          // Client disconnected — destroy the file stream to free resources
          stream.destroy();
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
    const videoCacheControl = isMetaCrawler ? 'public, max-age=86400' : 'private, max-age=86400';
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': media.mimeType,
        'Content-Length': String(fileSize),
        'Accept-Ranges': 'bytes',
        'Cache-Control': videoCacheControl,
        'Content-Disposition': `inline; filename="${safeFilename}"`,
        'X-Content-Type-Options': 'nosniff',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  // Non-video files: serve as before
  const buffer = await readFile(filePath);

  // Use public cache for Meta crawlers so Cloudflare doesn't interfere.
  // For logged-in users, keep private caching.
  const cacheControl = isMetaCrawler ? 'public, max-age=86400' : 'private, max-age=86400';

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': media.mimeType,
      'Content-Length': String(media.fileSize),
      'Cache-Control': cacheControl,
      'Content-Disposition': `${disposition}; filename="${safeFilename}"`,
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
      'Access-Control-Allow-Origin': '*',
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

  // Delete from database first (authoritative), then filesystem
  try {
    await db.media.delete({ where: { id } });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Database delete failed';
    console.error(`[media] DB delete failed for ${id}:`, msg);
    return NextResponse.json({ error: 'Failed to delete media record' }, { status: 500 });
  }

  // Delete from filesystem (best-effort after DB delete)
  try {
    const { unlink } = await import('fs/promises');
    if (existsSync(filePath)) {
      await unlink(filePath);
    }
  } catch (error) {
    // Log but don't fail — DB record is already deleted
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[media] File delete failed for ${filePath}:`, msg);
  }

  return NextResponse.json({ success: true });
}
