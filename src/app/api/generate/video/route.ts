import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { deductCredits } from '@/lib/credits';
import { GENERATION_COSTS } from '@/lib/replicate';
import { getActiveVideoProvider, getProviderApiKey } from '@/lib/video-provider';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { randomUUID } from 'crypto';

export const maxDuration = 300; // 5 minutes for video generation

const UPLOAD_DIR = join(process.cwd(), 'data', 'uploads');

// ── In-memory store for pending async predictions ──
// Uses globalThis to survive hot reloads in dev mode (same pattern as db.ts)
interface PendingGeneration {
  userId: string;
  botId: string;
  platform: string;
  fullPrompt: string;
  provider: 'replicate' | 'runway';
  apiKey: string;
  createdAt: number;
}

const globalForVideo = globalThis as unknown as {
  pendingVideoGenerations: Map<string, PendingGeneration>;
  finalizedVideoIds: Set<string>;
};

if (!globalForVideo.pendingVideoGenerations) {
  globalForVideo.pendingVideoGenerations = new Map();
}
if (!globalForVideo.finalizedVideoIds) {
  globalForVideo.finalizedVideoIds = new Set();
}

const pendingGenerations = globalForVideo.pendingVideoGenerations;
const finalizedIds = globalForVideo.finalizedVideoIds;

// Cleanup entries older than 10 minutes (prevent memory leak)
function cleanupOldEntries() {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [id, meta] of Array.from(pendingGenerations.entries())) {
    if (meta.createdAt < cutoff) {
      pendingGenerations.delete(id);
    }
  }
  if (finalizedIds.size > 500) {
    finalizedIds.clear();
  }
}

// ── POST: Start video generation (returns immediately for Replicate) ──
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { botId, platform, prompt, style } = body;

    if (!botId) {
      return NextResponse.json({ error: 'Bot ID required' }, { status: 400 });
    }

    // Verify bot ownership
    const bot = await db.bot.findFirst({ where: { id: botId, userId: user.id } });
    if (!bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
    }

    // ── CHECK CONFIG BEFORE ANYTHING ──
    const provider = await getActiveVideoProvider();
    const apiKey = await getProviderApiKey(provider);

    if (!apiKey) {
      const envVar = provider === 'replicate' ? 'REPLICATE_API_TOKEN' : 'RUNWAYML_API_SECRET';
      const signupUrl = provider === 'replicate'
        ? 'https://replicate.com/account/api-tokens'
        : 'https://app.runwayml.com/settings/api-keys';

      return NextResponse.json({
        error: `Video generation not configured. ${envVar} is missing. Provider: ${provider}. Set the token in Admin → Settings or in your .env file. Get a token at ${signupUrl}`,
      }, { status: 503 });
    }

    // Check credits are sufficient (deduct only after success)
    const balance = await db.creditBalance.findUnique({ where: { userId: user.id } });
    if (!balance || balance.balance < GENERATION_COSTS.GENERATE_VIDEO) {
      return NextResponse.json({
        error: `Insufficient credits. You need ${GENERATION_COSTS.GENERATE_VIDEO} credits to generate a video. Buy more credits in the Credits page.`,
      }, { status: 402 });
    }

    // Build prompt from bot preferences
    const prefs = (bot.creativePreferences || bot.imagePreferences) as Record<string, unknown> | null;
    const brandName = bot.brandName;
    const videoStyle = style || (prefs?.videoStyle as string) || 'quick_tips';
    const subjects = (prefs?.subjects as string) || '';
    const avoidTopics = (prefs?.avoidTopics as string) || '';
    const videoCustomInstructions = (prefs?.videoCustomInstructions as string) || '';

    const fullPrompt = [
      prompt || `Professional marketing video for ${brandName}`,
      `Video style: ${videoStyle.replace(/_/g, ' ')}`,
      subjects ? `About: ${subjects}` : '',
      videoCustomInstructions ? `Instructions: ${videoCustomInstructions}` : '',
      avoidTopics ? `Avoid: ${avoidTopics}` : '',
      'High quality, professional, suitable for social media.',
    ].filter(Boolean).join('. ');

    if (provider === 'replicate') {
      // ── ASYNC: Create prediction and return immediately ──
      // This avoids Nginx/Cloudflare timeout (60-100s) since video takes 1-3 min
      const Replicate = (await import('replicate')).default;
      const replicate = new Replicate({ auth: apiKey });

      const prediction = await replicate.predictions.create({
        model: 'minimax/video-01-live',
        input: { prompt: fullPrompt },
      });

      // Store metadata for finalization when polling completes
      pendingGenerations.set(prediction.id, {
        userId: user.id,
        botId,
        platform: platform || 'TIKTOK',
        fullPrompt,
        provider: 'replicate',
        apiKey,
        createdAt: Date.now(),
      });

      cleanupOldEntries();

      return NextResponse.json({
        predictionId: prediction.id,
        status: prediction.status || 'starting',
        provider: 'replicate',
      });
    } else {
      // ── RUNWAY: Synchronous (typically faster, less likely to timeout) ──
      const result = await generateWithRunway(fullPrompt, apiKey);
      return await finalizeVideo(result.videoUrl, 'runway', user.id, botId, platform || 'TIKTOK', fullPrompt);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Video generation POST error:', message);

    if (message.includes('Invalid token') || message.includes('Unauthenticated') || message.includes('401') || message.includes('invalid_api_key')) {
      return NextResponse.json({
        error: `Authentication failed. Check your API token. Error: ${message}`,
      }, { status: 502 });
    }
    if (message.includes('rate limit') || message.includes('429')) {
      return NextResponse.json({
        error: `Rate limit reached. Wait a moment and try again. Error: ${message}`,
      }, { status: 429 });
    }
    if (message.includes('billing') || message.includes('payment') || message.includes('insufficient')) {
      return NextResponse.json({
        error: `Billing issue. Check your account billing. Error: ${message}`,
      }, { status: 402 });
    }

    return NextResponse.json({
      error: `Video generation failed: ${message}`,
    }, { status: 500 });
  }
}

// ── GET: Poll async video generation status ──
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const predictionId = request.nextUrl.searchParams.get('predictionId');
  if (!predictionId) {
    return NextResponse.json({ error: 'Missing predictionId parameter' }, { status: 400 });
  }

  const meta = pendingGenerations.get(predictionId);
  if (!meta) {
    if (finalizedIds.has(predictionId)) {
      return NextResponse.json({ status: 'already_processed' }, { status: 200 });
    }
    return NextResponse.json({
      error: 'Prediction not found or expired. It may have been processed already, or the server was restarted. Try generating again.',
    }, { status: 404 });
  }

  if (meta.userId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const Replicate = (await import('replicate')).default;
    const replicate = new Replicate({ auth: meta.apiKey });

    const prediction = await replicate.predictions.get(predictionId);

    // Still running
    if (prediction.status === 'starting' || prediction.status === 'processing') {
      return NextResponse.json({
        status: prediction.status,
        progress: prediction.status === 'processing' ? 'Video is being generated...' : 'Starting up...',
      });
    }

    // Failed or canceled
    if (prediction.status === 'failed' || prediction.status === 'canceled') {
      pendingGenerations.delete(predictionId);
      const errorMsg = typeof prediction.error === 'string'
        ? prediction.error
        : prediction.error ? JSON.stringify(prediction.error) : 'Video generation failed';

      console.error(`Video prediction ${predictionId} failed:`, errorMsg);
      return NextResponse.json({
        status: 'failed',
        error: `Replicate error: ${errorMsg}`,
      });
    }

    // Succeeded — finalize (download, save, deduct credits)
    if (prediction.status === 'succeeded') {
      // Prevent double finalization
      if (finalizedIds.has(predictionId)) {
        pendingGenerations.delete(predictionId);
        return NextResponse.json({ status: 'already_processed' });
      }
      finalizedIds.add(predictionId);

      // Extract video URL from output
      const output = prediction.output;
      let videoUrl: string;

      if (typeof output === 'string') {
        videoUrl = output;
      } else if (Array.isArray(output) && output.length > 0) {
        const first = output[0];
        if (typeof first === 'string') {
          videoUrl = first;
        } else if (first && typeof first === 'object' && typeof (first as any).url === 'function') {
          const urlResult = (first as any).url();
          videoUrl = urlResult instanceof URL ? urlResult.toString() : String(urlResult);
        } else {
          videoUrl = String(first);
        }
      } else if (output && typeof output === 'object') {
        if (typeof (output as any).url === 'function') {
          const urlResult = (output as any).url();
          videoUrl = urlResult instanceof URL ? urlResult.toString() : String(urlResult);
        } else {
          videoUrl = String(output);
        }
      } else {
        pendingGenerations.delete(predictionId);
        finalizedIds.delete(predictionId);
        return NextResponse.json({
          status: 'failed',
          error: `No video URL in Replicate output. Output type: ${typeof output}`,
        });
      }

      if (!videoUrl || !videoUrl.startsWith('http')) {
        pendingGenerations.delete(predictionId);
        finalizedIds.delete(predictionId);
        return NextResponse.json({
          status: 'failed',
          error: `Invalid video URL from Replicate: ${videoUrl}`,
        });
      }

      const result = await finalizeVideo(videoUrl, 'replicate', meta.userId, meta.botId, meta.platform, meta.fullPrompt);
      pendingGenerations.delete(predictionId);
      return result;
    }

    // Unknown status
    return NextResponse.json({ status: prediction.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Video poll error:', message);
    return NextResponse.json({
      status: 'failed',
      error: `Error checking video status: ${message}`,
    });
  }
}

// ── Shared: Download video, save to disk, deduct credits, create media record ──
async function finalizeVideo(
  videoUrl: string,
  provider: string,
  userId: string,
  botId: string,
  platform: string,
  fullPrompt: string,
): Promise<NextResponse> {
  // Download the generated video
  const videoResponse = await fetch(videoUrl);
  if (!videoResponse.ok) {
    return NextResponse.json({
      status: 'failed',
      error: `Failed to download generated video from ${provider} (HTTP ${videoResponse.status}). Try generating again.`,
    }, { status: 500 });
  }
  const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());

  // Deduct credits AFTER successful generation + download
  const deducted = await deductCredits(
    userId,
    GENERATION_COSTS.GENERATE_VIDEO,
    `AI video generation for ${platform}`,
    botId
  );
  if (!deducted) {
    return NextResponse.json({
      status: 'failed',
      error: `Insufficient credits. You need ${GENERATION_COSTS.GENERATE_VIDEO} credits.`,
    }, { status: 402 });
  }

  // Save to filesystem
  const botDir = resolve(join(UPLOAD_DIR, botId));
  if (!botDir.startsWith(resolve(UPLOAD_DIR))) {
    return NextResponse.json({ status: 'failed', error: 'Invalid bot ID' }, { status: 400 });
  }
  if (!existsSync(botDir)) {
    await mkdir(botDir, { recursive: true });
  }

  const uuid = randomUUID();
  const filename = `${uuid}.mp4`;
  const filePath = join(botDir, filename);
  await writeFile(filePath, videoBuffer);

  // Save to database
  const media = await db.media.create({
    data: {
      botId,
      type: 'VIDEO',
      filename: `ai-generated-${platform}.mp4`,
      mimeType: 'video/mp4',
      fileSize: videoBuffer.length,
      filePath: `${botId}/${filename}`,
      aiDescription: fullPrompt,
    },
  });

  // Log activity
  await db.botActivity.create({
    data: {
      botId,
      platform: platform as any,
      action: 'GENERATE_VIDEO',
      content: `[${provider}] ${fullPrompt.slice(0, 480)}`,
      success: true,
      creditsUsed: GENERATION_COSTS.GENERATE_VIDEO,
    },
  });

  return NextResponse.json({
    status: 'succeeded',
    id: media.id,
    filename: media.filename,
    type: media.type,
    fileSize: media.fileSize,
    url: `/api/media/${media.id}`,
    prompt: fullPrompt,
    provider,
  });
}

// ── Runway provider (synchronous) ──
async function generateWithRunway(
  prompt: string,
  apiKey: string
): Promise<{ videoUrl: string }> {
  const RunwayML = (await import('@runwayml/sdk')).default;

  const client = new RunwayML({ apiKey });

  const task = await client.textToVideo
    .create({
      model: 'veo3.1_fast',
      promptText: prompt.slice(0, 1000),
      ratio: '1280:720',
      duration: 6,
    })
    .waitForTaskOutput();

  if (!task.output || task.output.length === 0) {
    throw new Error('Runway returned no video output');
  }

  return { videoUrl: task.output[0] };
}
