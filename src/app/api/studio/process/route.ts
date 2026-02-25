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

interface TimelineClipInput {
  mediaId: string;
  startTime: number;
  duration: number;
  mediaOffset: number;
}

interface TimelineTextClipInput {
  text: string;
  startTime: number;
  endTime: number;
  color: string;
  position: 'top' | 'center' | 'bottom';
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
  timelineClips?: TimelineClipInput[];
  timelineTextClips?: TimelineTextClipInput[];
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

  const { mediaId, botId, trim, filterId, adjustments, textOverlay, aspectRatio, speed, volume, fadeIn, fadeOut, subtitles, timelineClips, timelineTextClips } = body;

  if (!botId || typeof botId !== 'string') {
    return NextResponse.json({ error: 'botId is required' }, { status: 400 });
  }
  // mediaId is required unless timelineClips are provided
  if (!timelineClips?.length && (!mediaId || typeof mediaId !== 'string')) {
    return NextResponse.json({ error: 'mediaId is required' }, { status: 400 });
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

  // ── Validate timeline clips ──
  if (timelineClips !== undefined) {
    if (!Array.isArray(timelineClips) || timelineClips.length > 20) {
      return NextResponse.json({ error: 'Timeline clips must be an array (max 20)' }, { status: 400 });
    }
    for (const clip of timelineClips) {
      if (!clip.mediaId || typeof clip.mediaId !== 'string') {
        return NextResponse.json({ error: 'Each timeline clip must have a mediaId' }, { status: 400 });
      }
      if (typeof clip.startTime !== 'number' || typeof clip.duration !== 'number' ||
        typeof clip.mediaOffset !== 'number' ||
        !isFinite(clip.startTime) || !isFinite(clip.duration) || !isFinite(clip.mediaOffset) ||
        clip.startTime < 0 || clip.duration <= 0 || clip.mediaOffset < 0 ||
        clip.duration > 86400 || clip.startTime > 86400) {
        return NextResponse.json({ error: 'Invalid timeline clip parameters' }, { status: 400 });
      }
    }
  }

  // ── Validate timeline text clips ──
  if (timelineTextClips !== undefined) {
    if (!Array.isArray(timelineTextClips) || timelineTextClips.length > 20) {
      return NextResponse.json({ error: 'Timeline text clips must be an array (max 20)' }, { status: 400 });
    }
    for (const tc of timelineTextClips) {
      if (!tc.text || typeof tc.text !== 'string' || tc.text.length > 200) {
        return NextResponse.json({ error: 'Each text clip must have text (max 200 chars)' }, { status: 400 });
      }
      if (typeof tc.startTime !== 'number' || typeof tc.endTime !== 'number' ||
        !isFinite(tc.startTime) || !isFinite(tc.endTime) ||
        tc.startTime < 0 || tc.endTime <= tc.startTime || tc.endTime > 86400) {
        return NextResponse.json({ error: 'Invalid text clip timing' }, { status: 400 });
      }
    }
  }

  // Verify bot ownership
  const bot = await db.bot.findFirst({ where: { id: botId, userId: user.id } });
  if (!bot) {
    return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
  }

  const uploadPrefix = resolve(UPLOAD_DIR) + '/';
  const isTimelineMode = timelineClips && timelineClips.length > 0;

  // ── Resolve all media files needed ────────────────────────────────────
  // In timeline mode, we need to resolve all clip media; in single mode, just the one.
  const allMediaIds = isTimelineMode
    ? Array.from(new Set(timelineClips.map(c => c.mediaId)))
    : mediaId ? [mediaId] : [];

  if (allMediaIds.length === 0) {
    return NextResponse.json({ error: 'No media specified' }, { status: 400 });
  }

  const mediaRecords = await db.media.findMany({
    where: { id: { in: allMediaIds } },
    include: { bot: { select: { userId: true } } },
  });

  // Verify ownership and type for all media
  const mediaMap: Record<string, { filePath: string; filename: string; resolvedPath: string }> = {};
  for (const m of mediaRecords) {
    if (m.bot.userId !== user.id || m.type !== 'VIDEO') {
      return NextResponse.json({ error: `Video not found: ${m.id}` }, { status: 404 });
    }
    if (!m.filePath) {
      return NextResponse.json({ error: `Video file not ready: ${m.id}` }, { status: 404 });
    }
    const resolvedPath = resolve(join(UPLOAD_DIR, m.filePath));
    if (!resolvedPath.startsWith(uploadPrefix) || !existsSync(resolvedPath)) {
      return NextResponse.json({ error: 'Video file not found on disk' }, { status: 404 });
    }
    mediaMap[m.id] = { filePath: m.filePath, filename: m.filename, resolvedPath };
  }

  // Check we found all requested media
  for (const id of allMediaIds) {
    if (!mediaMap[id]) {
      return NextResponse.json({ error: `Video not found: ${id}` }, { status: 404 });
    }
  }

  // For single-video mode, use the primary media
  const media = mediaRecords.find(m => m.id === (mediaId || allMediaIds[0]))!;
  const inputPath = mediaMap[media.id].resolvedPath;

  // Validate trim parameters (single-video mode only)
  if (!isTimelineMode && trim) {
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

    // ── Font path for drawtext ────────────────────────────────────────
    const fontPath = existsSync('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf')
      ? 'fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:'
      : existsSync('/usr/share/fonts/truetype/freefont/FreeSansBold.ttf')
      ? 'fontfile=/usr/share/fonts/truetype/freefont/FreeSansBold.ttf:'
      : '';

    if (isTimelineMode) {
      // ═══════════════════════════════════════════════════════════════
      // MULTI-CLIP TIMELINE MODE
      // Uses FFmpeg concat demuxer to join multiple clips, then applies
      // global effects (color, text, aspect ratio) on the result.
      // ═══════════════════════════════════════════════════════════════

      // Step 1: Create individual trimmed clips as temp files
      const { writeFile, unlink: unlinkFile } = await import('fs/promises');
      const tempDir = resolve(join(UPLOAD_DIR, '.tmp'));
      if (!existsSync(tempDir)) await mkdir(tempDir, { recursive: true });

      const tempFiles: string[] = [];
      const concatListPath = join(tempDir, `${uuid}_concat.txt`);

      try {
        // Create a normalized temp file for each timeline clip
        for (let i = 0; i < timelineClips!.length; i++) {
          const clip = timelineClips![i];
          const clipMedia = mediaMap[clip.mediaId];
          if (!clipMedia) continue;

          const tempFile = join(tempDir, `${uuid}_clip${i}.ts`);
          tempFiles.push(tempFile);

          await new Promise<void>((res, rej) => {
            let cmd = ffmpeg(clipMedia.resolvedPath)
              .setStartTime(clip.mediaOffset)
              .setDuration(clip.duration);

            // Normalize all clips to same format for concat
            cmd.videoCodec('libx264')
              .audioCodec('aac')
              .outputOptions([
                '-crf 23', '-preset fast',
                '-vf', 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1',
                '-ar', '44100', '-ac', '2',
              ])
              .output(tempFile)
              .on('end', () => res())
              .on('error', (err: Error) => rej(err))
              .run();
          });
        }

        // Step 2: Create concat list file
        const concatContent = tempFiles
          .filter(f => existsSync(f))
          .map(f => `file '${f}'`)
          .join('\n');
        await writeFile(concatListPath, concatContent, 'utf-8');

        // Step 3: Concatenate and apply global effects
        await new Promise<void>((res, rej) => {
          let cmd = ffmpeg()
            .input(concatListPath)
            .inputOptions(['-f', 'concat', '-safe', '0']);

          const videoFilters: string[] = [];

          // Aspect ratio (applied to concatenated result)
          if (aspectRatio === '9:16') {
            videoFilters.push('crop=ih*9/16:ih,scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2');
          } else if (aspectRatio === '1:1') {
            videoFilters.push("crop='min(iw,ih)':'min(iw,ih)',scale=1080:1080");
          } else if (aspectRatio === '16:9') {
            // Already normalized to 16:9 in clip step
          } else if (aspectRatio === '4:5') {
            videoFilters.push("crop='min(iw,ih*4/5)':'min(ih,iw*5/4)',scale=864:1080:force_original_aspect_ratio=decrease,pad=864:1080:(ow-iw)/2:(oh-ih)/2");
          } else if (aspectRatio === '4:3') {
            videoFilters.push("crop='min(iw,ih*4/3)':'min(ih,iw*3/4)',scale=1440:1080:force_original_aspect_ratio=decrease,pad=1440:1080:(ow-iw)/2:(oh-ih)/2");
          }

          // Color grading
          const colorFilters = buildColorFiltersChain(filterId ?? 'original', adjustments ?? {});
          videoFilters.push(...colorFilters);

          // Fade
          if (fadeIn && fadeIn > 0) {
            videoFilters.push(`fade=t=in:st=0:d=${Math.min(fadeIn, 10).toFixed(2)}`);
          }

          // Global text overlay
          if (textOverlay && textOverlay.text && textOverlay.text.trim()) {
            const safeText = escapeDrawtext(textOverlay.text.trim().slice(0, 200));
            const fontSize = Math.max(24, Math.min(96, textOverlay.fontSize || 48));
            const color = ['white', 'yellow', 'black', 'red', 'cyan'].includes(textOverlay.color) ? textOverlay.color : 'white';
            let yExpr = 'h-text_h-40';
            if (textOverlay.position === 'top') yExpr = '40';
            if (textOverlay.position === 'center') yExpr = '(h-text_h)/2';
            videoFilters.push(`drawtext=${fontPath}text='${safeText}':fontsize=${fontSize}:fontcolor=${color}:x=(w-text_w)/2:y=${yExpr}:box=1:boxcolor=black@0.6:boxborderw=10`);
          }

          // Timeline text clips (timed overlays)
          if (timelineTextClips && timelineTextClips.length > 0) {
            for (const tc of timelineTextClips) {
              const safeText = escapeDrawtext(tc.text.trim().slice(0, 200));
              const color = ['white', 'yellow', 'black', 'red', 'cyan'].includes(tc.color) ? tc.color : 'white';
              let yExpr = 'h-text_h-40';
              if (tc.position === 'top') yExpr = '40';
              if (tc.position === 'center') yExpr = '(h-text_h)/2';
              videoFilters.push(
                `drawtext=${fontPath}text='${safeText}':fontsize=42:fontcolor=${color}:x=(w-text_w)/2:y=${yExpr}:box=1:boxcolor=black@0.5:boxborderw=8:enable='between(t\\,${tc.startTime.toFixed(3)}\\,${tc.endTime.toFixed(3)})'`
              );
            }
          }

          // Subtitles
          if (subtitles && subtitles.length > 0) {
            for (const sub of subtitles) {
              if (!sub.text || !sub.text.trim()) continue;
              const safeText = escapeDrawtext(sub.text.trim().slice(0, 200));
              videoFilters.push(
                `drawtext=${fontPath}text='${safeText}':fontsize=36:fontcolor=white:x=(w-text_w)/2:y=h-text_h-60:box=1:boxcolor=black@0.5:boxborderw=8:enable='between(t\\,${sub.startTime.toFixed(3)}\\,${sub.endTime.toFixed(3)})'`
              );
            }
          }

          if (videoFilters.length > 0) cmd = cmd.videoFilters(videoFilters);

          // Audio filters
          const audioFilters: string[] = [];
          if (volume !== undefined && volume !== 100) {
            audioFilters.push(`volume=${(Math.max(0, Math.min(100, volume)) / 100).toFixed(4)}`);
          }
          if (fadeIn && fadeIn > 0) audioFilters.push(`afade=t=in:st=0:d=${Math.min(fadeIn, 10).toFixed(2)}`);
          if (audioFilters.length > 0) cmd = cmd.audioFilters(audioFilters);

          cmd
            .videoCodec('libx264')
            .audioCodec('aac')
            .outputOptions(['-movflags faststart', '-crf 23', '-preset fast'])
            .output(outputPath)
            .on('end', () => res())
            .on('error', (err: Error) => rej(err))
            .run();
        });
      } finally {
        // Clean up temp files
        for (const f of [...tempFiles, concatListPath]) {
          if (existsSync(f)) {
            try { await unlinkFile(f); } catch { /* ignore */ }
          }
        }
      }
    } else {
      // ═══════════════════════════════════════════════════════════════
      // SINGLE-VIDEO MODE (original behavior)
      // ═══════════════════════════════════════════════════════════════

      await new Promise<void>((resolve, reject) => {
        let cmd = ffmpeg(inputPath);

        // Trim: set start time and duration
        if (trim && typeof trim.start === 'number' && typeof trim.end === 'number') {
          const duration = Math.round((trim.end - trim.start) * 100) / 100;
          cmd = cmd.setStartTime(trim.start).setDuration(duration);
        }

        const videoFilters: string[] = [];

        // 1. Aspect ratio
        if (aspectRatio === '9:16') {
          videoFilters.push('crop=ih*9/16:ih,scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2');
        } else if (aspectRatio === '1:1') {
          videoFilters.push("crop='min(iw,ih)':'min(iw,ih)',scale=1080:1080");
        } else if (aspectRatio === '16:9') {
          videoFilters.push("crop=iw:'iw*9/16',scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2");
        } else if (aspectRatio === '4:5') {
          videoFilters.push("crop='min(iw,ih*4/5)':'min(ih,iw*5/4)',scale=864:1080:force_original_aspect_ratio=decrease,pad=864:1080:(ow-iw)/2:(oh-ih)/2");
        } else if (aspectRatio === '4:3') {
          videoFilters.push("crop='min(iw,ih*4/3)':'min(ih,iw*3/4)',scale=1440:1080:force_original_aspect_ratio=decrease,pad=1440:1080:(ow-iw)/2:(oh-ih)/2");
        }

        // 2. Color grading
        const colorFilters = buildColorFiltersChain(filterId ?? 'original', adjustments ?? {});
        videoFilters.push(...colorFilters);

        // 3. Fade
        const trimDuration = trim ? Math.round((trim.end - trim.start) * 100) / 100 : 0;
        if (fadeIn && fadeIn > 0) {
          videoFilters.push(`fade=t=in:st=0:d=${Math.min(fadeIn, 10).toFixed(2)}`);
        }
        if (fadeOut && fadeOut > 0 && trimDuration > 0) {
          const outStart = Math.max(0, trimDuration - fadeOut);
          videoFilters.push(`fade=t=out:st=${outStart.toFixed(2)}:d=${Math.min(fadeOut, 10).toFixed(2)}`);
        }

        // 4. Speed
        if (speed && speed !== 1 && speed >= 0.25 && speed <= 4) {
          videoFilters.push(`setpts=${(1 / speed).toFixed(6)}*PTS`);
        }

        // 5. Text overlay
        if (textOverlay && textOverlay.text && textOverlay.text.trim()) {
          const safeText = escapeDrawtext(textOverlay.text.trim().slice(0, 200));
          const fontSize = Math.max(24, Math.min(96, textOverlay.fontSize || 48));
          const color = ['white', 'yellow', 'black', 'red', 'cyan'].includes(textOverlay.color) ? textOverlay.color : 'white';
          let yExpr = 'h-text_h-40';
          if (textOverlay.position === 'top') yExpr = '40';
          if (textOverlay.position === 'center') yExpr = '(h-text_h)/2';
          videoFilters.push(`drawtext=${fontPath}text='${safeText}':fontsize=${fontSize}:fontcolor=${color}:x=(w-text_w)/2:y=${yExpr}:box=1:boxcolor=black@0.6:boxborderw=10`);
        }

        // 6. Subtitles
        if (subtitles && subtitles.length > 0) {
          const trimOffset = trim?.start ?? 0;
          for (const sub of subtitles) {
            if (!sub.text || !sub.text.trim()) continue;
            const safeText = escapeDrawtext(sub.text.trim().slice(0, 200));
            const subStart = Math.max(0, sub.startTime - trimOffset);
            const subEnd = Math.max(subStart + 0.1, sub.endTime - trimOffset);
            const speedFactor = (speed && speed !== 1) ? (1 / speed) : 1;
            const adjStart = (subStart * speedFactor).toFixed(3);
            const adjEnd = (subEnd * speedFactor).toFixed(3);
            videoFilters.push(
              `drawtext=${fontPath}text='${safeText}':fontsize=36:fontcolor=white:x=(w-text_w)/2:y=h-text_h-60:box=1:boxcolor=black@0.5:boxborderw=8:enable='between(t\\,${adjStart}\\,${adjEnd})'`
            );
          }
        }

        if (videoFilters.length > 0) cmd = cmd.videoFilters(videoFilters);

        // Audio filters
        const audioFilters: string[] = [];
        if (volume !== undefined && volume !== 100) {
          audioFilters.push(`volume=${(Math.max(0, Math.min(100, volume)) / 100).toFixed(4)}`);
        }
        if (fadeIn && fadeIn > 0) audioFilters.push(`afade=t=in:st=0:d=${Math.min(fadeIn, 10).toFixed(2)}`);
        if (fadeOut && fadeOut > 0 && trimDuration > 0) {
          const outStart = Math.max(0, trimDuration - fadeOut);
          audioFilters.push(`afade=t=out:st=${outStart.toFixed(2)}:d=${Math.min(fadeOut, 10).toFixed(2)}`);
        }
        if (speed && speed !== 1 && speed >= 0.25 && speed <= 4) {
          audioFilters.push(...buildAtempoChain(speed));
        }
        if (audioFilters.length > 0) cmd = cmd.audioFilters(audioFilters);

        cmd
          .videoCodec('libx264')
          .audioCodec('aac')
          .outputOptions(['-movflags faststart', '-crf 23', '-preset fast'])
          .output(outputPath)
          .on('end', () => resolve())
          .on('error', (err: Error) => reject(err))
          .run();
      });
    }

    // Get file size of processed output
    const fileStat = await stat(outputPath);

    // Build a descriptive filename
    const baseName = media.filename.replace(/\.[^.]+$/, '');
    const suffix: string[] = [];
    if (isTimelineMode) suffix.push('timeline');
    if (trim && !isTimelineMode) suffix.push('trimmed');
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
        altText: isTimelineMode
          ? `Timeline edit: ${timelineClips!.length} clips`
          : `Edited from: ${media.filename}`,
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
