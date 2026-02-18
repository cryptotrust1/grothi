import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { deductCredits } from '@/lib/credits';
import { getModelById, getDefaultVideoModel, buildModelInput, VIDEO_MODELS } from '@/lib/ai-models';
import { getActiveVideoProvider, getProviderApiKey } from '@/lib/video-provider';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { randomUUID } from 'crypto';

export const maxDuration = 300; // 5 minutes for video generation

const UPLOAD_DIR = join(process.cwd(), 'data', 'uploads');

// ── POST: Start video generation ──
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      botId,
      platform,
      prompt,
      referenceImage,
      modelId,
      params: userParams,
      negativePrompt,
    } = body;

    if (!botId) {
      return NextResponse.json({ error: 'Bot ID required' }, { status: 400 });
    }

    // Verify bot ownership
    const bot = await db.bot.findFirst({ where: { id: botId, userId: user.id } });
    if (!bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
    }

    // Resolve model — user picks any video model, default is MiniMax Hailuo
    const model = modelId
      ? VIDEO_MODELS.find(m => m.id === modelId)
      : getDefaultVideoModel();

    if (!model) {
      return NextResponse.json({ error: `Unknown video model: ${modelId}` }, { status: 400 });
    }

    // Dynamic credit cost from model
    const creditCost = model.creditCost;

    // Check provider config based on model
    let apiKey: string | null = null;

    if (model.provider === 'runway') {
      apiKey = await getProviderApiKey('runway');
      if (!apiKey) {
        return NextResponse.json({
          error: 'Runway API not configured. RUNWAYML_API_SECRET is missing. Set it in Admin Settings or .env file. Get a key at https://app.runwayml.com/settings/api-keys',
        }, { status: 503 });
      }
    } else {
      apiKey = await getProviderApiKey('replicate');
      if (!apiKey) {
        return NextResponse.json({
          error: 'Video generation not configured. REPLICATE_API_TOKEN is missing. Set it in Admin Settings or .env file. Get a token at https://replicate.com/account/api-tokens',
        }, { status: 503 });
      }
    }

    // Check credits
    const balance = await db.creditBalance.findUnique({ where: { userId: user.id } });
    if (!balance || balance.balance < creditCost) {
      return NextResponse.json({
        error: `Insufficient credits. You need ${creditCost} credits to generate with ${model.name}. Buy more credits in the Credits page.`,
      }, { status: 402 });
    }

    // Build prompt: user's prompt takes priority, preferences only as fallback
    const prefs = (bot.creativePreferences || bot.imagePreferences) as Record<string, unknown> | null;
    const brandName = bot.brandName;
    let fullPrompt: string;

    if (prompt && prompt.trim()) {
      fullPrompt = prompt.trim();
    } else {
      const subjects = (prefs?.subjects as string) || '';
      const videoCustomInstructions = (prefs?.videoCustomInstructions as string) || '';
      const avoidTopics = (prefs?.avoidTopics as string) || '';

      fullPrompt = [
        `Professional marketing video for ${brandName}`,
        subjects ? `About: ${subjects}` : '',
        videoCustomInstructions || '',
        avoidTopics ? `Avoid: ${avoidTopics}` : '',
        'High quality, professional, suitable for social media.',
      ].filter(Boolean).join('. ');
    }

    const targetPlatform = platform || 'TIKTOK';

    if (model.provider === 'runway') {
      // Runway: synchronous path
      const parsedParams: Record<string, unknown> = userParams && typeof userParams === 'object' ? userParams : {};
      const duration = Number(parsedParams.duration) || 6;
      const ratio = (parsedParams.ratio as string) || '1280:720';

      const result = await generateWithRunway(fullPrompt, apiKey!, duration, ratio);
      return await finalizeVideo(result.videoUrl, 'runway', user.id, botId, targetPlatform, fullPrompt, null, model.name, creditCost);
    }

    // Replicate: async prediction path
    const Replicate = (await import('replicate')).default;
    const replicate = new Replicate({ auth: apiKey! });

    // Build input from model params
    const parsedParams: Record<string, unknown> = userParams && typeof userParams === 'object' ? userParams : {};
    const replicateInput = buildModelInput(model, fullPrompt, parsedParams, referenceImage, negativePrompt);

    // Create async prediction
    const prediction = await replicate.predictions.create({
      model: model.replicateId as `${string}/${string}`,
      input: replicateInput,
    });

    // Store in DB so generation survives page refresh
    const media = await db.media.create({
      data: {
        botId,
        type: 'VIDEO',
        filename: `ai-${model.id}-${targetPlatform}.mp4`,
        mimeType: 'video/mp4',
        fileSize: 0,
        filePath: '',
        aiDescription: fullPrompt,
        replicatePredictionId: prediction.id,
        generationStatus: 'PENDING',
      },
    });

    return NextResponse.json({
      predictionId: prediction.id,
      mediaId: media.id,
      status: prediction.status || 'starting',
      provider: 'replicate',
      model: model.name,
      creditCost,
    });
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

    return NextResponse.json({
      error: `Video generation failed: ${message}`,
    }, { status: 500 });
  }
}

// ── GET: Poll video generation status OR list pending generations ──
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const predictionId = request.nextUrl.searchParams.get('predictionId');
  const botId = request.nextUrl.searchParams.get('botId');
  const pending = request.nextUrl.searchParams.get('pending');

  // List pending generations for a bot
  if (botId && pending === 'true') {
    const bot = await db.bot.findFirst({ where: { id: botId, userId: user.id } });
    if (!bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
    }

    const pendingMedia = await db.media.findMany({
      where: {
        botId,
        generationStatus: { in: ['PENDING', 'PROCESSING'] },
        replicatePredictionId: { not: null },
      },
      select: {
        id: true,
        replicatePredictionId: true,
        generationStatus: true,
        aiDescription: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ pending: pendingMedia });
  }

  // Poll a specific prediction
  if (!predictionId) {
    return NextResponse.json({ error: 'Missing predictionId parameter' }, { status: 400 });
  }

  const media = await db.media.findFirst({
    where: { replicatePredictionId: predictionId },
  });

  if (!media) {
    return NextResponse.json({
      error: 'Prediction not found. It may have been cancelled or already completed.',
    }, { status: 404 });
  }

  // Verify the media belongs to a bot owned by this user
  const bot = await db.bot.findFirst({ where: { id: media.botId, userId: user.id } });
  if (!bot) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // If already finalized, return current status
  if (media.generationStatus === 'SUCCEEDED') {
    return NextResponse.json({
      status: 'succeeded',
      id: media.id,
      url: `/api/media/${media.id}`,
      prompt: media.aiDescription,
    });
  }
  if (media.generationStatus === 'FAILED') {
    return NextResponse.json({ status: 'failed', error: 'Video generation failed.' });
  }
  if (media.generationStatus === 'CANCELLED') {
    return NextResponse.json({ status: 'cancelled' });
  }

  try {
    const apiKey = await getProviderApiKey('replicate');
    if (!apiKey) {
      return NextResponse.json({ status: 'failed', error: 'API key not configured' });
    }

    const Replicate = (await import('replicate')).default;
    const replicate = new Replicate({ auth: apiKey });
    const prediction = await replicate.predictions.get(predictionId);

    // Still running
    if (prediction.status === 'starting' || prediction.status === 'processing') {
      if (media.generationStatus !== 'PROCESSING' && prediction.status === 'processing') {
        await db.media.update({
          where: { id: media.id },
          data: { generationStatus: 'PROCESSING' },
        });
      }

      return NextResponse.json({
        status: prediction.status,
        progress: prediction.status === 'processing' ? 'Video is being generated...' : 'Starting up...',
      });
    }

    // Failed or canceled
    if (prediction.status === 'failed' || prediction.status === 'canceled') {
      await db.media.update({
        where: { id: media.id },
        data: { generationStatus: 'FAILED' },
      });

      const errorMsg = typeof prediction.error === 'string'
        ? prediction.error
        : prediction.error ? JSON.stringify(prediction.error) : 'Video generation failed';

      console.error(`Video prediction ${predictionId} failed:`, errorMsg);
      return NextResponse.json({ status: 'failed', error: `Replicate error: ${errorMsg}` });
    }

    // Succeeded — finalize
    if (prediction.status === 'succeeded') {
      const output = prediction.output;
      let videoUrl: string;

      if (typeof output === 'string') {
        videoUrl = output;
      } else if (Array.isArray(output) && output.length > 0) {
        const first = output[0];
        if (typeof first === 'string') {
          videoUrl = first;
        } else if (first && typeof first === 'object' && typeof (first as { url?: () => unknown }).url === 'function') {
          const urlResult = (first as { url: () => unknown }).url();
          videoUrl = urlResult instanceof URL ? urlResult.toString() : String(urlResult);
        } else {
          videoUrl = String(first);
        }
      } else if (output && typeof output === 'object') {
        if (typeof (output as { url?: () => unknown }).url === 'function') {
          const urlResult = (output as { url: () => unknown }).url();
          videoUrl = urlResult instanceof URL ? urlResult.toString() : String(urlResult);
        } else {
          videoUrl = String(output);
        }
      } else {
        await db.media.update({ where: { id: media.id }, data: { generationStatus: 'FAILED' } });
        return NextResponse.json({ status: 'failed', error: 'No video URL in Replicate output.' });
      }

      if (!videoUrl || !videoUrl.startsWith('http')) {
        await db.media.update({ where: { id: media.id }, data: { generationStatus: 'FAILED' } });
        return NextResponse.json({ status: 'failed', error: `Invalid video URL from Replicate: ${videoUrl}` });
      }

      // Extract model name from filename
      const modelName = media.filename.replace('ai-', '').split('-')[0] || 'Replicate';
      // Extract credit cost from model registry
      const videoModel = VIDEO_MODELS.find(m => media.filename.includes(m.id));
      const creditCost = videoModel?.creditCost ?? 8;

      return await finalizeVideo(
        videoUrl, 'replicate', user.id, media.botId,
        media.filename.replace(/^ai-[^-]+-/, '').replace('.mp4', '') || 'TIKTOK',
        media.aiDescription || '', media.id, modelName, creditCost
      );
    }

    return NextResponse.json({ status: prediction.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Video poll error:', message);
    return NextResponse.json({ status: 'failed', error: `Error checking video status: ${message}` });
  }
}

// ── DELETE: Cancel a video generation ──
export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const predictionId = request.nextUrl.searchParams.get('predictionId');
  if (!predictionId) {
    return NextResponse.json({ error: 'Missing predictionId' }, { status: 400 });
  }

  const media = await db.media.findFirst({
    where: { replicatePredictionId: predictionId },
  });
  if (!media) {
    return NextResponse.json({ error: 'Prediction not found' }, { status: 404 });
  }

  const bot = await db.bot.findFirst({ where: { id: media.botId, userId: user.id } });
  if (!bot) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const apiKey = await getProviderApiKey('replicate');
    if (apiKey) {
      const Replicate = (await import('replicate')).default;
      const replicate = new Replicate({ auth: apiKey });
      await replicate.predictions.cancel(predictionId).catch(() => {});
    }

    await db.media.delete({ where: { id: media.id } });

    return NextResponse.json({ status: 'cancelled' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Video cancel error:', message);
    return NextResponse.json({ error: `Failed to cancel: ${message}` }, { status: 500 });
  }
}

// ── Shared: Download video, save to disk, deduct credits, update media record ──
async function finalizeVideo(
  videoUrl: string,
  provider: string,
  userId: string,
  botId: string,
  platform: string,
  fullPrompt: string,
  existingMediaId: string | null,
  modelName: string,
  creditCost: number,
): Promise<NextResponse> {
  const dlController = new AbortController();
  const dlTimeout = setTimeout(() => dlController.abort(), 120000);
  let videoResponse: Response;
  try {
    videoResponse = await fetch(videoUrl, { signal: dlController.signal });
  } catch (dlErr) {
    clearTimeout(dlTimeout);
    if (existingMediaId) {
      await db.media.update({ where: { id: existingMediaId }, data: { generationStatus: 'FAILED' } });
    }
    if (dlErr instanceof DOMException && dlErr.name === 'AbortError') {
      return NextResponse.json({ status: 'failed', error: 'Video download timed out. Try generating again.' }, { status: 504 });
    }
    throw dlErr;
  }
  clearTimeout(dlTimeout);
  if (!videoResponse.ok) {
    if (existingMediaId) {
      await db.media.update({ where: { id: existingMediaId }, data: { generationStatus: 'FAILED' } });
    }
    return NextResponse.json({
      status: 'failed',
      error: `Failed to download generated video from ${provider} (HTTP ${videoResponse.status}). Try generating again.`,
    }, { status: 500 });
  }
  const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());

  // Deduct credits AFTER successful generation + download
  const deducted = await deductCredits(
    userId,
    creditCost,
    `AI video (${modelName}) for ${platform}`,
    botId
  );
  if (!deducted) {
    if (existingMediaId) {
      await db.media.update({ where: { id: existingMediaId }, data: { generationStatus: 'FAILED' } });
    }
    return NextResponse.json({
      status: 'failed',
      error: `Insufficient credits. You need ${creditCost} credits.`,
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

  let media;
  if (existingMediaId) {
    media = await db.media.update({
      where: { id: existingMediaId },
      data: {
        fileSize: videoBuffer.length,
        filePath: `${botId}/${filename}`,
        generationStatus: 'SUCCEEDED',
      },
    });
  } else {
    media = await db.media.create({
      data: {
        botId,
        type: 'VIDEO',
        filename: `ai-generated-${platform}.mp4`,
        mimeType: 'video/mp4',
        fileSize: videoBuffer.length,
        filePath: `${botId}/${filename}`,
        aiDescription: fullPrompt,
        generationStatus: 'SUCCEEDED',
      },
    });
  }

  // Log activity
  await db.botActivity.create({
    data: {
      botId,
      platform: platform as any,
      action: 'GENERATE_VIDEO',
      content: `[${modelName}] ${fullPrompt.slice(0, 480)}`,
      success: true,
      creditsUsed: creditCost,
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
    model: modelName,
    creditCost,
  });
}

// ── Runway provider (synchronous) ──
async function generateWithRunway(
  prompt: string,
  apiKey: string,
  duration: number,
  ratio: string,
): Promise<{ videoUrl: string }> {
  const RunwayML = (await import('@runwayml/sdk')).default;

  const client = new RunwayML({ apiKey });

  const task = await client.textToVideo
    .create({
      model: 'veo3.1_fast',
      promptText: prompt.slice(0, 1000),
      ratio: ratio as any,
      duration: duration as any,
    })
    .waitForTaskOutput();

  if (!task.output || task.output.length === 0) {
    throw new Error('Runway returned no video output');
  }

  return { videoUrl: task.output[0] };
}
