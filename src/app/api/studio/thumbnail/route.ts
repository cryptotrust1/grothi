import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { join, resolve } from 'path';
import { mkdir, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { randomUUID } from 'crypto';

export const maxDuration = 60;

const UPLOAD_DIR = join(process.cwd(), 'data', 'uploads');

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { mediaId?: string; botId?: string; timestamp?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { mediaId, botId, timestamp = 0 } = body;

  if (!mediaId || !botId) {
    return NextResponse.json({ error: 'mediaId and botId are required' }, { status: 400 });
  }

  if (typeof timestamp !== 'number' || timestamp < 0) {
    return NextResponse.json({ error: 'Invalid timestamp' }, { status: 400 });
  }

  const bot = await db.bot.findFirst({ where: { id: botId, userId: user.id } });
  if (!bot) {
    return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
  }

  const media = await db.media.findUnique({
    where: { id: mediaId },
    include: { bot: { select: { userId: true } } },
  });
  if (!media || media.bot.userId !== user.id || media.type !== 'VIDEO') {
    return NextResponse.json({ error: 'Video not found' }, { status: 404 });
  }

  const inputPath = resolve(join(UPLOAD_DIR, media.filePath));
  if (!inputPath.startsWith(resolve(UPLOAD_DIR)) || !existsSync(inputPath)) {
    return NextResponse.json({ error: 'Video file not found on disk' }, { status: 404 });
  }

  const botDir = resolve(join(UPLOAD_DIR, botId));
  if (!botDir.startsWith(resolve(UPLOAD_DIR))) {
    return NextResponse.json({ error: 'Invalid bot ID' }, { status: 400 });
  }
  if (!existsSync(botDir)) {
    await mkdir(botDir, { recursive: true });
  }

  const uuid = randomUUID();
  const outputFilename = `${uuid}.jpg`;
  const outputPath = join(botDir, outputFilename);

  try {
    const ffmpeg = (await import('fluent-ffmpeg')).default;

    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .setStartTime(Math.max(0, timestamp))
        .frames(1)
        .output(outputPath)
        .outputOptions(['-q:v 2']) // high quality JPEG (scale: 1=best, 31=worst)
        .on('end', () => resolve())
        .on('error', (err: Error) => reject(err))
        .run();
    });

    const fileStat = await stat(outputPath);
    const baseName = media.filename.replace(/\.[^.]+$/, '');
    const thumbFilename = `${baseName}_thumbnail.jpg`;

    const newMedia = await db.media.create({
      data: {
        botId,
        type: 'IMAGE',
        filename: thumbFilename,
        mimeType: 'image/jpeg',
        fileSize: fileStat.size,
        filePath: `${botId}/${outputFilename}`,
        altText: `Thumbnail from: ${media.filename}`,
      },
    });

    return NextResponse.json({
      success: true,
      mediaId: newMedia.id,
      url: `/api/media/${newMedia.id}`,
      filename: newMedia.filename,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[studio/thumbnail] FFmpeg error:', message);

    if (existsSync(outputPath)) {
      try {
        const { unlink } = await import('fs/promises');
        await unlink(outputPath);
      } catch {
        // ignore cleanup errors
      }
    }

    return NextResponse.json(
      { error: `Thumbnail extraction failed: ${message}` },
      { status: 500 }
    );
  }
}
