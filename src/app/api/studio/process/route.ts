import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { join, resolve } from 'path';
import { mkdir, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { randomUUID } from 'crypto';

// Allow up to 5 minutes for video processing
export const maxDuration = 300;

const UPLOAD_DIR = join(process.cwd(), 'data', 'uploads');

interface ProcessBody {
  mediaId: string;
  botId: string;
  trim?: { start: number; end: number };
  textOverlay?: { text: string; position: 'top' | 'center' | 'bottom'; color: string; fontSize: number };
  aspectRatio?: string;
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: ProcessBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { mediaId, botId, trim, textOverlay, aspectRatio } = body;

  if (!mediaId || !botId) {
    return NextResponse.json({ error: 'mediaId and botId are required' }, { status: 400 });
  }

  // Verify bot ownership
  const bot = await db.bot.findFirst({ where: { id: botId, userId: user.id } });
  if (!bot) {
    return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
  }

  // Verify media ownership and type
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

  // Validate trim parameters
  if (trim) {
    if (
      typeof trim.start !== 'number' || typeof trim.end !== 'number' ||
      trim.start < 0 || trim.end <= trim.start
    ) {
      return NextResponse.json({ error: 'Invalid trim parameters' }, { status: 400 });
    }
  }

  // Prepare output path
  const botDir = resolve(join(UPLOAD_DIR, botId));
  if (!botDir.startsWith(resolve(UPLOAD_DIR))) {
    return NextResponse.json({ error: 'Invalid bot ID' }, { status: 400 });
  }
  if (!existsSync(botDir)) {
    await mkdir(botDir, { recursive: true });
  }

  const uuid = randomUUID();
  const outputFilename = `${uuid}.mp4`;
  const outputPath = join(botDir, outputFilename);

  try {
    const ffmpeg = (await import('fluent-ffmpeg')).default;

    await new Promise<void>((resolve, reject) => {
      let cmd = ffmpeg(inputPath);

      // Trim: set start time and duration
      if (trim && typeof trim.start === 'number' && typeof trim.end === 'number') {
        const duration = Math.round((trim.end - trim.start) * 100) / 100;
        cmd = cmd.setStartTime(trim.start).setDuration(duration);
      }

      // Build video filter chain
      const videoFilters: string[] = [];

      // Aspect ratio crop (center-crop to target ratio)
      if (aspectRatio === '9:16') {
        videoFilters.push('crop=ih*9/16:ih,scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2');
      } else if (aspectRatio === '1:1') {
        videoFilters.push("crop='min(iw,ih)':'min(iw,ih)',scale=1080:1080");
      } else if (aspectRatio === '16:9') {
        videoFilters.push("crop=iw:'iw*9/16',scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2");
      }

      // Text overlay using drawtext filter
      if (textOverlay && textOverlay.text && textOverlay.text.trim()) {
        // Escape special drawtext characters
        const safeText = textOverlay.text
          .trim()
          .replace(/\\/g, '\\\\')
          .replace(/'/g, "\\'")
          .replace(/:/g, '\\:')
          .replace(/,/g, '\\,')
          .replace(/\[/g, '\\[')
          .replace(/\]/g, '\\]');

        const fontSize = Math.max(24, Math.min(96, textOverlay.fontSize || 48));
        const color = ['white', 'yellow', 'black'].includes(textOverlay.color)
          ? textOverlay.color
          : 'white';

        let yExpr = 'h-text_h-40'; // bottom
        if (textOverlay.position === 'top') yExpr = '40';
        if (textOverlay.position === 'center') yExpr = '(h-text_h)/2';

        // Try system fonts — use fontconfig if available, fallback to basic
        const fontPath = existsSync('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf')
          ? 'fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:'
          : existsSync('/usr/share/fonts/truetype/freefont/FreeSansBold.ttf')
          ? 'fontfile=/usr/share/fonts/truetype/freefont/FreeSansBold.ttf:'
          : '';

        videoFilters.push(
          `drawtext=${fontPath}text='${safeText}':fontsize=${fontSize}:fontcolor=${color}:x=(w-text_w)/2:y=${yExpr}:box=1:boxcolor=black@0.6:boxborderw=10`
        );
      }

      if (videoFilters.length > 0) {
        cmd = cmd.videoFilters(videoFilters);
      }

      cmd
        .videoCodec('libx264')
        .audioCodec('aac')
        .outputOptions(['-movflags faststart', '-crf 23', '-preset fast'])
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', (err: Error) => reject(err))
        .run();
    });

    // Get file size of processed output
    const fileStat = await stat(outputPath);

    // Build a descriptive filename
    const baseName = media.filename.replace(/\.[^.]+$/, '');
    const suffix: string[] = [];
    if (trim) suffix.push('trimmed');
    if (textOverlay?.text) suffix.push('captioned');
    if (aspectRatio && aspectRatio !== 'original') suffix.push(aspectRatio.replace(':', 'x'));
    const newFilename = `${baseName}_${suffix.join('_') || 'edited'}.mp4`;

    // Save processed video to media library
    const newMedia = await db.media.create({
      data: {
        botId,
        type: 'VIDEO',
        filename: newFilename,
        mimeType: 'video/mp4',
        fileSize: fileStat.size,
        filePath: `${botId}/${outputFilename}`,
        width: null,
        height: null,
        altText: `Edited from: ${media.filename}`,
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
    console.error('[studio/process] FFmpeg error:', message);

    // Clean up partial output
    if (existsSync(outputPath)) {
      try {
        const { unlink } = await import('fs/promises');
        await unlink(outputPath);
      } catch {
        // ignore cleanup errors
      }
    }

    if (message.includes('ffmpeg') && message.includes('not found')) {
      return NextResponse.json(
        { error: 'FFmpeg is not installed on the server. Ask your admin to run: sudo apt-get install ffmpeg' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: `Processing failed: ${message}` },
      { status: 500 }
    );
  }
}
