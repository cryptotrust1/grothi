import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { deductCredits, addCredits } from '@/lib/credits';
import { getModelById, getDefaultImageModel, buildModelInput, IMAGE_MODELS } from '@/lib/ai-models';
import { PLATFORM_IMAGE_DIMENSIONS } from '@/lib/replicate';
import { BOT_STORAGE_LIMIT_BYTES, BOT_STORAGE_LIMIT_MB } from '@/lib/constants';
import { aiGenerationLimiter, globalAILimiter } from '@/lib/rate-limit';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { randomUUID } from 'crypto';
import { generateFilePath } from '@/lib/media-validation';
import { getCachedStorageUsage, addToStorageCache } from '@/lib/storage-cache';
import { PlatformType } from '@prisma/client';

export const maxDuration = 120;

const UPLOAD_DIR = join(process.cwd(), 'data', 'uploads');

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Rate limit per user per endpoint
  const rateCheck = aiGenerationLimiter.check(`image:${user.id}`);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: `Too many AI requests. Try again in ${Math.ceil(rateCheck.retryAfterMs / 1000)} seconds.` },
      { status: 429 }
    );
  }
  // Global AI rate limit across ALL AI endpoints
  const globalCheck = globalAILimiter.check(user.id);
  if (!globalCheck.allowed) {
    return NextResponse.json(
      { error: `AI usage limit reached. Try again in ${Math.ceil(globalCheck.retryAfterMs / 1000)} seconds.` },
      { status: 429 }
    );
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

    // Check storage limit (200MB per bot) - uses cached value for speed
    const currentUsageBytes = await getCachedStorageUsage(botId);
    // Estimate ~5MB for a generated image (conservative)
    const estimatedSizeBytes = 5 * 1024 * 1024;
    if (currentUsageBytes + estimatedSizeBytes > BOT_STORAGE_LIMIT_BYTES) {
      const usedMB = (currentUsageBytes / (1024 * 1024)).toFixed(1);
      return NextResponse.json({
        error: `Storage limit exceeded. This bot uses ${usedMB} MB of ${BOT_STORAGE_LIMIT_MB} MB. Delete some media to free up space before generating new images.`,
      }, { status: 413 });
    }

    // Resolve model — user can pick any image model, defaults to FLUX 1.1 Pro
    const model = modelId
      ? IMAGE_MODELS.find(m => m.id === modelId)
      : getDefaultImageModel();

    if (!model) {
      return NextResponse.json({ error: `Unknown image model: ${modelId}` }, { status: 400 });
    }

    // Check Replicate API token
    const replicateToken = process.env.REPLICATE_API_TOKEN;
    if (!replicateToken) {
      console.error('[generate/image] REPLICATE_API_TOKEN not configured');
      return NextResponse.json({
        error: 'Image generation service is not available. Please contact support.',
      }, { status: 503 });
    }

    // Dynamic credit cost from model
    const creditCost = model.creditCost;

    // Deduct credits BEFORE generation (atomically check and deduct)
    const deducted = await deductCredits(
      user.id,
      creditCost,
      `AI image generation (${model.name})`,
      botId
    );
    if (!deducted) {
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
      const visualStyles = (prefs?.visualStyles as string[]) || ['minimalist'];
      const customInstructions = (prefs?.customInstructions as string) || '';
      const avoidTopics = (prefs?.avoidTopics as string) || '';

      fullPrompt = [
        `Professional marketing image for ${brandName}`,
        subjects ? `Subjects: ${subjects}` : '',
        `Style: ${visualStyles.join(', ')}`,
        customInstructions || '',
        avoidTopics ? `Avoid: ${avoidTopics}` : '',
        'High quality, professional, suitable for social media marketing.',
      ].filter(Boolean).join('. ');
    }

    // Build model input from user params
    const parsedParams: Record<string, unknown> = userParams && typeof userParams === 'object' ? userParams : {};
    const replicateInput = buildModelInput(model, fullPrompt, parsedParams, referenceImage, negativePrompt);

    // Determine output format for file extension
    const outputFormat = (replicateInput.output_format as string) || 'png';
    const fileExt = outputFormat === 'jpg' ? 'jpg' : outputFormat === 'webp' ? 'webp' : 'png';
    const mimeType = outputFormat === 'jpg' ? 'image/jpeg' : outputFormat === 'webp' ? 'image/webp' : 'image/png';

    // Generate image via Replicate
    const Replicate = (await import('replicate')).default;
    const replicate = new Replicate({ auth: replicateToken });

    let output: unknown;
    try {
      output = await replicate.run(model.replicateId as `${string}/${string}`, {
        input: replicateInput,
      });
    } catch (apiError) {
      const apiMsg = apiError instanceof Error ? apiError.message : String(apiError);
      console.error(`Replicate API error (${model.name}):`, apiMsg);

      // Refund credits since generation failed
      await addCredits(user.id, creditCost, 'REFUND', `Refund: image generation failed (${model.name})`).catch(
        (e: unknown) => console.error('Credit refund failed:', e instanceof Error ? e.message : e)
      );

      if (apiMsg.includes('Invalid token') || apiMsg.includes('Unauthenticated') || apiMsg.includes('401')) {
        return NextResponse.json({
          error: 'Image generation service authentication failed. Please contact support.',
        }, { status: 502 });
      }
      if (apiMsg.includes('rate limit') || apiMsg.includes('429')) {
        return NextResponse.json({
          error: 'Image generation rate limit reached. Wait a moment and try again.',
        }, { status: 429 });
      }
      if (apiMsg.includes('billing') || apiMsg.includes('payment')) {
        return NextResponse.json({
          error: 'Image generation service billing issue. Please contact support.',
        }, { status: 402 });
      }

      return NextResponse.json({
        error: `Replicate API error: ${apiMsg}`,
      }, { status: 502 });
    }

    // Get the image URL from output
    const rawOutput = Array.isArray(output) ? output[0] : output;
    let imageUrl: string;
    if (typeof rawOutput === 'string') {
      imageUrl = rawOutput;
    } else if (rawOutput && typeof rawOutput === 'object') {
      if (typeof (rawOutput as Record<string, unknown>).url === 'function') {
        const urlResult = (rawOutput as { url: () => unknown }).url();
        imageUrl = urlResult instanceof URL ? urlResult.toString() : String(urlResult);
      } else {
        imageUrl = String(rawOutput);
      }
    } else {
      console.error('Replicate returned unexpected output:', JSON.stringify(output).slice(0, 500));
      await addCredits(user.id, creditCost, 'REFUND', `Refund: image generation no output (${model.name})`).catch(
        (e: unknown) => console.error('Credit refund failed:', e instanceof Error ? e.message : e)
      );
      return NextResponse.json({
        error: 'Image generation returned no output. This may be a temporary issue — try again.',
      }, { status: 500 });
    }

    if (!imageUrl || !imageUrl.startsWith('http')) {
      console.error('Replicate returned invalid URL:', imageUrl);
      await addCredits(user.id, creditCost, 'REFUND', `Refund: image generation invalid URL (${model.name})`).catch(
        (e: unknown) => console.error('Credit refund failed:', e instanceof Error ? e.message : e)
      );
      return NextResponse.json({
        error: 'Image generation returned invalid URL. This may be a temporary issue — try again.',
      }, { status: 500 });
    }

    // Download the generated image (60s timeout)
    const dlController = new AbortController();
    const dlTimeout = setTimeout(() => dlController.abort(), 60000);
    let imageResponse: Response;
    try {
      imageResponse = await fetch(imageUrl, { signal: dlController.signal });
    } catch (dlErr) {
      clearTimeout(dlTimeout);
      // Refund credits since download failed
      await addCredits(user.id, creditCost, 'REFUND', `Refund: image download failed (${model.name})`).catch(
        (e: unknown) => console.error('Credit refund failed:', e instanceof Error ? e.message : e)
      );
      if (dlErr instanceof DOMException && dlErr.name === 'AbortError') {
        return NextResponse.json({ error: 'Image download timed out. Try generating again.' }, { status: 504 });
      }
      throw dlErr;
    }
    clearTimeout(dlTimeout);
    if (!imageResponse.ok) {
      // Refund credits since download returned an error
      await addCredits(user.id, creditCost, 'REFUND', `Refund: image download HTTP ${imageResponse.status} (${model.name})`).catch(
        (e: unknown) => console.error('Credit refund failed:', e instanceof Error ? e.message : e)
      );
      return NextResponse.json({
        error: `Failed to download generated image (HTTP ${imageResponse.status}). Try generating again.`,
      }, { status: 500 });
    }
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

    // Save to filesystem
    const botDir = resolve(join(UPLOAD_DIR, botId));
    if (!botDir.startsWith(resolve(UPLOAD_DIR))) {
      return NextResponse.json({ error: 'Invalid bot ID' }, { status: 400 });
    }
    if (!existsSync(botDir)) {
      await mkdir(botDir, { recursive: true });
    }

    const uuid = randomUUID();
    const filename = `${uuid}.${fileExt}`;
    const filePath = join(botDir, filename);
    await writeFile(filePath, imageBuffer);
    
    const dbFilePath = generateFilePath(botId, uuid, fileExt);

    // Credits were already deducted before generation (atomically)
    // Get dimensions for DB
    const dims = PLATFORM_IMAGE_DIMENSIONS[platform || 'INSTAGRAM'] || { width: 1024, height: 1024 };

    // Save to database
    const media = await db.media.create({
      data: {
        botId,
        type: 'IMAGE',
        filename: `ai-${model.id}-${platform || 'general'}.${fileExt}`,
        mimeType,
        fileSize: imageBuffer.length,
        filePath: dbFilePath,
        width: dims.width,
        height: dims.height,
        aiDescription: fullPrompt,
        generationStatus: 'SUCCEEDED',
      },
    });

    // Update storage cache
    addToStorageCache(botId, imageBuffer.length);

    // Log activity
    await db.botActivity.create({
      data: {
        botId,
        platform: (platform as PlatformType) || 'INSTAGRAM',
        action: 'GENERATE_IMAGE',
        content: `[${model.name}] ${fullPrompt.slice(0, 480)}`,
        success: true,
        creditsUsed: creditCost,
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
      prompt: fullPrompt,
      model: model.name,
      creditCost,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Image generation error:', message);

    // Refund credits if they were deducted but generation failed
    try {
      const body = await request.clone().json().catch(() => ({}));
      const bId = body.botId as string | undefined;
      const modelId = body.modelId as string | undefined;
      const m = modelId ? getModelById(modelId) : getDefaultImageModel();
      if (m) {
        await addCredits(user.id, m.creditCost, 'REFUND', `Refund for failed image generation (${m.name})`, undefined, { source: 'BONUS' });
      }
    } catch (refundErr) {
      console.error('Image generation credit refund failed:', refundErr instanceof Error ? refundErr.message : refundErr);
    }

    return NextResponse.json({
      error: `Image generation failed: ${message}`,
    }, { status: 500 });
  }
}
