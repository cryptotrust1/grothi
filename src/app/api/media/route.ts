import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { randomUUID } from 'crypto';

// Allow up to 2 minutes for large video uploads
export const maxDuration = 120;

const UPLOAD_DIR = join(process.cwd(), 'data', 'uploads');

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif',
];
const ALLOWED_VIDEO_TYPES = [
  'video/mp4', 'video/webm', 'video/quicktime',
];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB

function getMediaType(mimeType: string): 'IMAGE' | 'VIDEO' | 'GIF' {
  if (mimeType === 'image/gif') return 'GIF';
  if (ALLOWED_IMAGE_TYPES.includes(mimeType)) return 'IMAGE';
  return 'VIDEO';
}

function getExtension(mimeType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'image/avif': '.avif',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'video/quicktime': '.mov',
  };
  return map[mimeType] || '.bin';
}

// Validate file magic bytes
function validateMagicBytes(buffer: Buffer, mimeType: string): boolean {
  if (buffer.length < 4) return false;

  const signatures: Record<string, number[][]> = {
    'image/jpeg': [[0xFF, 0xD8, 0xFF]],
    'image/png': [[0x89, 0x50, 0x4E, 0x47]],
    'image/gif': [[0x47, 0x49, 0x46, 0x38]],
    'image/webp': [[0x52, 0x49, 0x46, 0x46]], // RIFF
    'video/mp4': [], // ftyp box at offset 4
    'video/webm': [[0x1A, 0x45, 0xDF, 0xA3]],
  };

  // AVIF: also uses ftyp box like MP4 but with 'ftyp' at offset 4
  if (mimeType === 'image/avif') {
    if (buffer.length < 12) return false;
    const ftyp = buffer.slice(4, 8).toString('ascii');
    return ftyp === 'ftyp';
  }

  // MP4 check: "ftyp" at offset 4
  if (mimeType === 'video/mp4' || mimeType === 'video/quicktime') {
    if (buffer.length < 8) return false;
    const ftyp = buffer.slice(4, 8).toString('ascii');
    return ftyp === 'ftyp';
  }

  const sigs = signatures[mimeType];
  if (!sigs || sigs.length === 0) return true; // No signature check available

  return sigs.some(sig =>
    sig.every((byte, i) => buffer[i] === byte)
  );
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const botId = formData.get('botId') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!botId) {
      return NextResponse.json({ error: 'Bot ID required' }, { status: 400 });
    }

    // Verify bot ownership
    const bot = await db.bot.findFirst({ where: { id: botId, userId: user.id } });
    if (!bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
    }

    const mimeType = file.type;
    const isImage = ALLOWED_IMAGE_TYPES.includes(mimeType);
    const isVideo = ALLOWED_VIDEO_TYPES.includes(mimeType);

    if (!isImage && !isVideo) {
      return NextResponse.json(
        { error: `Unsupported file type: ${mimeType}. Allowed: JPEG, PNG, WebP, GIF, AVIF, MP4, WebM, MOV` },
        { status: 400 }
      );
    }

    const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `File too large. Max: ${maxSize / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Validate magic bytes
    if (!validateMagicBytes(buffer, mimeType)) {
      return NextResponse.json(
        { error: 'File content does not match declared type' },
        { status: 400 }
      );
    }

    // Ensure upload directory exists - validate botId to prevent path traversal
    const botDir = resolve(join(UPLOAD_DIR, botId));
    if (!botDir.startsWith(resolve(UPLOAD_DIR))) {
      return NextResponse.json({ error: 'Invalid bot ID' }, { status: 400 });
    }
    if (!existsSync(botDir)) {
      await mkdir(botDir, { recursive: true });
    }

    // Generate unique filename
    const uuid = randomUUID();
    const ext = getExtension(mimeType);
    const filename = `${uuid}${ext}`;
    const filePath = join(botDir, filename);

    // Write file
    await writeFile(filePath, buffer);

    // Get dimensions for images (basic approach without sharp dependency)
    let width: number | null = null;
    let height: number | null = null;

    if (isImage && mimeType === 'image/png') {
      // PNG: width at offset 16, height at offset 20 (4 bytes each, big-endian)
      if (buffer.length > 24) {
        width = buffer.readUInt32BE(16);
        height = buffer.readUInt32BE(20);
      }
    } else if (isImage && mimeType === 'image/jpeg') {
      // JPEG: parse SOF markers for dimensions
      let offset = 2;
      while (offset < buffer.length - 1) {
        if (buffer[offset] !== 0xFF) break;
        const marker = buffer[offset + 1];
        if (marker >= 0xC0 && marker <= 0xC3) {
          if (offset + 9 < buffer.length) {
            height = buffer.readUInt16BE(offset + 5);
            width = buffer.readUInt16BE(offset + 7);
          }
          break;
        }
        if (offset + 3 < buffer.length) {
          const len = buffer.readUInt16BE(offset + 2);
          offset += 2 + len;
        } else {
          break;
        }
      }
    }

    // Save to database
    const media = await db.media.create({
      data: {
        botId,
        type: getMediaType(mimeType),
        filename: file.name,
        mimeType,
        fileSize: file.size,
        filePath: `${botId}/${filename}`,
        width,
        height,
      },
    });

    return NextResponse.json({
      id: media.id,
      filename: media.filename,
      type: media.type,
      width: media.width,
      height: media.height,
      fileSize: media.fileSize,
      url: `/api/media/${media.id}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Upload error:', message);
    return NextResponse.json(
      { error: 'Upload failed. Please try again.' },
      { status: 500 }
    );
  }
}
