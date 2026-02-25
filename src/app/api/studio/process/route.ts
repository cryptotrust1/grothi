import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { join, resolve } from 'path';
import { mkdir, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { randomUUID } from 'crypto';
import {
  VIDEO_FILTERS,
  ADJUSTMENT_DEFS,
  buildColorFiltersChain,
  type AdjustmentValues,
} from '@/lib/studio-filters';

// Allow up to 5 minutes for video processing
export const maxDuration = 300;

const UPLOAD_DIR = join(process.cwd(), 'data', 'uploads');

interface SubtitleInput {
  text: string;
  startTime: number;
  endTime: number;
}

interface ProcessBody {
  mediaId: string;
  botId: string;
  trim?: { start: number; end: number };
  filterId?: string;
  adjustments?: AdjustmentValues;
  textOverlay?: { text: string; position: 'top' | 'center' | 'bottom'; color: string; fontSize: number };
  aspectRatio?: string;
  speed?: number;
  volume?: number;
  fadeIn?: number;
  fadeOut?: number;
  subtitles?: SubtitleInput[];
}

/** Build atempo chain for audio speed — FFmpeg atempo only supports 0.5-2.0 */
function buildAtempoChain(speed: number): string[] {
  const filters: string[] = [];
  let remaining = speed;
  while (remaining > 2.0) { filters.push('atempo=2.0'); remaining /= 2.0; }
  while (remaining < 0.5) { filters.push('atempo=0.5'); remaining /= 0.5; }
  if (Math.abs(remaining - 1.0) > 0.01) { filters.push(`atempo=${remaining.toFixed(4)}`); }
  return filters;
}

/** Escape text for FFmpeg drawtext filter */
function escapeDrawtext(raw: string): string {
  return raw
    .replace(/[\r\n\t]/g, ' ')
    .replace(/[\x00-\x1F\x7F]/g, '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/:/g, '\\:')
    .replace(/,/g, '\\,')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/%/g, '%%');
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

  const { mediaId, botId, trim, filterId, adjustments, textOverlay, aspectRatio, speed, volume, fadeIn, fadeOut, subtitles } = body;

  if (!mediaId || !botId || typeof mediaId !== 'string' || typeof botId !== 'string') {
    return NextResponse.json({ error: 'mediaId and botId are required strings' }, { status: 400 });
  }

  // ── Security: validate filterId against whitelist ──────────────────────────
  // Filter strings come only from our pre-defined constants, never from user input.
  if (filterId !== undefined) {
    const validFilter = VIDEO_FILTERS.find(f => f.id === filterId);
    if (!validFilter) {
      return NextResponse.json({ error: 'Invalid filter ID' }, { status: 400 });
    }
  }

  // ── Security: validate adjustments (keys + numeric ranges) ────────────────
  if (adjustments !== undefined) {
    if (typeof adjustments !== 'object' || adjustments === null) {
      return NextResponse.json({ error: 'Invalid adjustments format' }, { status: 400 });
    }
    const validKeys = new Set(ADJUSTMENT_DEFS.map(d => d.key));
    for (const [key, value] of Object.entries(adjustments)) {
      if (!validKeys.has(key)) {
        return NextResponse.json({ error: `Unknown adjustment: ${key}` }, { status: 400 });
      }
      if (typeof value !== 'number' || !isFinite(value)) {
        return NextResponse.json({ error: `Invalid value for adjustment: ${key}` }, { status: 400 });
      }
      const def = ADJUSTMENT_DEFS.find(d => d.key === key);
      if (def && (value < def.min || value > def.max)) {
        return NextResponse.json(
          { error: `Adjustment out of range: ${key} must be ${def.min}..${def.max}` },
          { status: 400 }
        );
      }
    }
  }

  // ── Validate speed ──
  if (speed !== undefined) {
    if (typeof speed !== 'number' || !isFinite(speed) || speed < 0.25 || speed > 4) {
      return NextResponse.json({ error: 'Speed must be between 0.25 and 4' }, { status: 400 });
    }
  }

  // ── Validate volume ──
  if (volume !== undefined) {
    if (typeof volume !== 'number' || !isFinite(volume) || volume < 0 || volume > 100) {
      return NextResponse.json({ error: 'Volume must be between 0 and 100' }, { status: 400 });
    }
  }

  // ── Validate fade ──
  if (fadeIn !== undefined) {
    if (typeof fadeIn !== 'number' || !isFinite(fadeIn) || fadeIn < 0 || fadeIn > 10) {
      return NextResponse.json({ error: 'Fade in must be between 0 and 10 seconds' }, { status: 400 });
    }
  }
  if (fadeOut !== undefined) {
    if (typeof fadeOut !== 'number' || !isFinite(fadeOut) || fadeOut < 0 || fadeOut > 10) {
      return NextResponse.json({ error: 'Fade out must be between 0 and 10 seconds' }, { status: 400 });
    }
  }

  // ── Validate subtitles ──
  if (subtitles !== undefined) {
    if (!Array.isArray(subtitles) || subtitles.length > 50) {
      return NextResponse.json({ error: 'Subtitles must be an array (max 50)' }, { status: 400 });
    }
    for (const sub of subtitles) {
      if (!sub.text || typeof sub.text !== 'string' || sub.text.length > 200) {
        return NextResponse.json({ error: 'Each subtitle text must be a string (max 200 chars)' }, { status: 400 });
      }
      if (typeof sub.startTime !== 'number' || typeof sub.endTime !== 'number' ||
        !isFinite(sub.startTime) || !isFinite(sub.endTime) ||
        sub.startTime < 0 || sub.endTime <= sub.startTime || sub.endTime > 86400) {
        return NextResponse.json({ error: 'Invalid subtitle timing' }, { status: 400 });
      }
    }
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

  if (!media.filePath) {
    return NextResponse.json({ error: 'Video file not ready or generation pending' }, { status: 404 });
  }

  const inputPath = resolve(join(UPLOAD_DIR, media.filePath));
  const uploadPrefix = resolve(UPLOAD_DIR) + '/';
  if (!inputPath.startsWith(uploadPrefix) || !existsSync(inputPath)) {
    return NextResponse.json({ error: 'Video file not found on disk' }, { status: 404 });
  }

  // Validate trim parameters
  if (trim) {
    if (
      typeof trim.start !== 'number' || typeof trim.end !== 'number' ||
      !isFinite(trim.start) || !isFinite(trim.end) ||
      trim.start < 0 || trim.end <= trim.start || trim.end > 86400
    ) {
      return NextResponse.json({ error: 'Invalid trim parameters' }, { status: 400 });
    }
  }

  // Prepare output path
  const botDir = resolve(join(UPLOAD_DIR, botId));
  if (!botDir.startsWith(uploadPrefix)) {
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

      // ── Build video filter chain ───────────────────────────────────────
      //
      // Correct order for video filters:
      //   1. Geometric (crop/scale/pad for aspect ratio)  ← spatial first
      //   2. Color grading (preset + adjustments)          ← color second
      //   3. drawtext (text overlay always last)           ← text on top
      //
      const videoFilters: string[] = [];

      // ── 1. Aspect ratio (geometric) ──────────────────────────────────
      if (aspectRatio === '9:16') {
        videoFilters.push(
          'crop=ih*9/16:ih,scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2'
        );
      } else if (aspectRatio === '1:1') {
        videoFilters.push("crop='min(iw,ih)':'min(iw,ih)',scale=1080:1080");
      } else if (aspectRatio === '16:9') {
        videoFilters.push(
          "crop=iw:'iw*9/16',scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2"
        );
      } else if (aspectRatio === '4:5') {
        videoFilters.push(
          "crop='min(iw,ih*4/5)':'min(ih,iw*5/4)',scale=864:1080:force_original_aspect_ratio=decrease,pad=864:1080:(ow-iw)/2:(oh-ih)/2"
        );
      } else if (aspectRatio === '4:3') {
        videoFilters.push(
          "crop='min(iw,ih*4/3)':'min(ih,iw*3/4)',scale=1440:1080:force_original_aspect_ratio=decrease,pad=1440:1080:(ow-iw)/2:(oh-ih)/2"
        );
      }

      // ── 2. Color grading (preset + adjustments) ───────────────────────
      const colorFilters = buildColorFiltersChain(
        filterId ?? 'original',
        adjustments ?? {}
      );
      videoFilters.push(...colorFilters);

      // ── 3. Fade in/out (video) ─────────────────────────────────────
      const trimDuration = trim ? Math.round((trim.end - trim.start) * 100) / 100 : 0;
      if (fadeIn && fadeIn > 0) {
        videoFilters.push(`fade=t=in:st=0:d=${Math.min(fadeIn, 10).toFixed(2)}`);
      }
      if (fadeOut && fadeOut > 0 && trimDuration > 0) {
        const outStart = Math.max(0, trimDuration - fadeOut);
        videoFilters.push(`fade=t=out:st=${outStart.toFixed(2)}:d=${Math.min(fadeOut, 10).toFixed(2)}`);
      }

      // ── 4. Speed change (video PTS) ────────────────────────────────
      if (speed && speed !== 1 && speed >= 0.25 && speed <= 4) {
        videoFilters.push(`setpts=${(1 / speed).toFixed(6)}*PTS`);
      }

      // ── 5. Text overlay (drawtext) ─────────────────────────────────
      // Try system fonts — use fontconfig if available, fallback to basic
      const fontPath = existsSync('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf')
        ? 'fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:'
        : existsSync('/usr/share/fonts/truetype/freefont/FreeSansBold.ttf')
        ? 'fontfile=/usr/share/fonts/truetype/freefont/FreeSansBold.ttf:'
        : '';

      if (textOverlay && textOverlay.text && textOverlay.text.trim()) {
        const safeText = escapeDrawtext(textOverlay.text.trim().slice(0, 200));
        const fontSize = Math.max(24, Math.min(96, textOverlay.fontSize || 48));
        const color = ['white', 'yellow', 'black', 'red', 'cyan'].includes(textOverlay.color)
          ? textOverlay.color
          : 'white';

        let yExpr = 'h-text_h-40'; // bottom
        if (textOverlay.position === 'top') yExpr = '40';
        if (textOverlay.position === 'center') yExpr = '(h-text_h)/2';

        videoFilters.push(
          `drawtext=${fontPath}text='${safeText}':fontsize=${fontSize}:fontcolor=${color}:x=(w-text_w)/2:y=${yExpr}:box=1:boxcolor=black@0.6:boxborderw=10`
        );
      }

      // ── 6. Subtitles (timed drawtext with enable) ──────────────────
      if (subtitles && subtitles.length > 0) {
        const trimOffset = trim?.start ?? 0;
        for (const sub of subtitles) {
          if (!sub.text || !sub.text.trim()) continue;
          const safeText = escapeDrawtext(sub.text.trim().slice(0, 200));
          // Adjust times relative to trim start (FFmpeg output starts at 0)
          const subStart = Math.max(0, sub.startTime - trimOffset);
          const subEnd = Math.max(subStart + 0.1, sub.endTime - trimOffset);
          // Apply speed factor to timing
          const speedFactor = (speed && speed !== 1) ? (1 / speed) : 1;
          const adjStart = (subStart * speedFactor).toFixed(3);
          const adjEnd = (subEnd * speedFactor).toFixed(3);
          videoFilters.push(
            `drawtext=${fontPath}text='${safeText}':fontsize=36:fontcolor=white:x=(w-text_w)/2:y=h-text_h-60:box=1:boxcolor=black@0.5:boxborderw=8:enable='between(t\\,${adjStart}\\,${adjEnd})'`
          );
        }
      }

      if (videoFilters.length > 0) {
        cmd = cmd.videoFilters(videoFilters);
      }

      // ── Audio filters ──────────────────────────────────────────────
      const audioFilters: string[] = [];

      // Volume
      if (volume !== undefined && volume !== 100) {
        const vol = Math.max(0, Math.min(100, volume)) / 100;
        audioFilters.push(`volume=${vol.toFixed(4)}`);
      }

      // Fade audio
      if (fadeIn && fadeIn > 0) {
        audioFilters.push(`afade=t=in:st=0:d=${Math.min(fadeIn, 10).toFixed(2)}`);
      }
      if (fadeOut && fadeOut > 0 && trimDuration > 0) {
        const outStart = Math.max(0, trimDuration - fadeOut);
        audioFilters.push(`afade=t=out:st=${outStart.toFixed(2)}:d=${Math.min(fadeOut, 10).toFixed(2)}`);
      }

      // Speed (audio tempo)
      if (speed && speed !== 1 && speed >= 0.25 && speed <= 4) {
        audioFilters.push(...buildAtempoChain(speed));
      }

      if (audioFilters.length > 0) {
        cmd = cmd.audioFilters(audioFilters);
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
    if (filterId && filterId !== 'original') {
      const preset = VIDEO_FILTERS.find(f => f.id === filterId);
      if (preset) suffix.push(preset.name.toLowerCase().replace(/\s+/g, '_'));
    }
    if (adjustments && Object.values(adjustments).some(v => v !== 0)) suffix.push('adjusted');
    if (textOverlay?.text) suffix.push('captioned');
    if (subtitles && subtitles.length > 0) suffix.push('subtitled');
    if (aspectRatio && aspectRatio !== 'original') suffix.push(aspectRatio.replace(':', 'x'));
    if (speed && speed !== 1) suffix.push(`${speed}x`);
    if (fadeIn || fadeOut) suffix.push('faded');
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

    // Strip file paths from error messages to avoid leaking server internals
    const safeMsg = message.replace(/\/[^\s:]+/g, '[path]');
    return NextResponse.json(
      { error: `Processing failed: ${safeMsg}` },
      { status: 500 }
    );
  }
}
