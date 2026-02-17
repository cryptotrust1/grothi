import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { deductCredits } from '@/lib/credits';
import { MODELS, PLATFORM_IMAGE_DIMENSIONS, GENERATION_COSTS } from '@/lib/replicate';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { randomUUID } from 'crypto';

export const maxDuration = 120;

const UPLOAD_DIR = join(process.cwd(), 'data', 'uploads');

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { botId, platform, prompt } = body;

    if (!botId) {
      return NextResponse.json({ error: 'Bot ID required' }, { status: 400 });
    }

    // Verify bot ownership
    const bot = await db.bot.findFirst({ where: { id: botId, userId: user.id } });
    if (!bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
    }

    // ── CHECK CONFIG BEFORE DEDUCTING CREDITS ──────────────────
    // Check Replicate API token BEFORE deducting credits
    const replicateToken = process.env.REPLICATE_API_TOKEN;
    if (!replicateToken) {
      return NextResponse.json({
        error: 'Image generation not configured. REPLICATE_API_TOKEN is missing from environment variables. Add it to your .env file and restart the server. Get a token at https://replicate.com/account/api-tokens',
      }, { status: 503 });
    }

    // Deduct credits only after confirming service is available
    const deducted = await deductCredits(
      user.id,
      GENERATION_COSTS.GENERATE_IMAGE,
      `AI image generation for ${platform || 'general'}`,
      botId
    );
    if (!deducted) {
      return NextResponse.json({
        error: `Insufficient credits. You need ${GENERATION_COSTS.GENERATE_IMAGE} credits to generate an image. Buy more credits in the Credits page.`,
      }, { status: 402 });
    }

    // Build prompt from bot preferences
    const prefs = (bot.creativePreferences || bot.imagePreferences) as Record<string, unknown> | null;
    const brandName = bot.brandName;
    const subjects = (prefs?.subjects as string) || '';
    const avoidTopics = (prefs?.avoidTopics as string) || '';
    const visualStyles = (prefs?.visualStyles as string[]) || ['minimalist'];
    const customInstructions = (prefs?.customInstructions as string) || '';

    const fullPrompt = [
      prompt || `Professional marketing image for ${brandName}`,
      subjects ? `Subjects: ${subjects}` : '',
      `Style: ${visualStyles.join(', ')}`,
      customInstructions ? `Instructions: ${customInstructions}` : '',
      avoidTopics ? `Avoid: ${avoidTopics}` : '',
      'High quality, professional, suitable for social media marketing.',
    ].filter(Boolean).join('. ');

    // Get platform-specific dimensions
    const dims = PLATFORM_IMAGE_DIMENSIONS[platform || 'INSTAGRAM'] || { width: 1080, height: 1080 };

    // Generate image via Replicate
    const Replicate = (await import('replicate')).default;
    const replicate = new Replicate({ auth: replicateToken });

    let output: unknown;
    try {
      output = await replicate.run(MODELS.IMAGE, {
        input: {
          prompt: fullPrompt,
          width: dims.width,
          height: dims.height,
          num_outputs: 1,
          output_format: 'png',
        },
      });
    } catch (apiError) {
      const apiMsg = apiError instanceof Error ? apiError.message : String(apiError);
      console.error('Replicate API error:', apiMsg);

      // Check for common Replicate errors
      if (apiMsg.includes('Invalid token') || apiMsg.includes('Unauthenticated') || apiMsg.includes('401')) {
        return NextResponse.json({
          error: `Replicate API authentication failed. Your REPLICATE_API_TOKEN may be invalid or expired. Check your token at https://replicate.com/account/api-tokens. Error: ${apiMsg}`,
        }, { status: 502 });
      }
      if (apiMsg.includes('rate limit') || apiMsg.includes('429')) {
        return NextResponse.json({
          error: `Replicate rate limit reached. Wait a moment and try again. Error: ${apiMsg}`,
        }, { status: 429 });
      }
      if (apiMsg.includes('billing') || apiMsg.includes('payment')) {
        return NextResponse.json({
          error: `Replicate billing issue. Check your Replicate account billing at https://replicate.com/account/billing. Error: ${apiMsg}`,
        }, { status: 402 });
      }

      return NextResponse.json({
        error: `Replicate API error: ${apiMsg}`,
      }, { status: 502 });
    }

    // Get the image URL from output
    const imageUrl = Array.isArray(output) ? output[0] : output;
    if (!imageUrl || typeof imageUrl !== 'string') {
      console.error('Replicate returned unexpected output:', JSON.stringify(output).slice(0, 500));
      return NextResponse.json({
        error: `Image generation returned no output. Replicate response type: ${typeof output}. This may be a temporary issue — try again.`,
      }, { status: 500 });
    }

    // Download the generated image
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      return NextResponse.json({
        error: `Failed to download generated image from Replicate (HTTP ${imageResponse.status}). The image URL may have expired. Try generating again.`,
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
    const filename = `${uuid}.png`;
    const filePath = join(botDir, filename);
    await writeFile(filePath, imageBuffer);

    // Save to database
    const media = await db.media.create({
      data: {
        botId,
        type: 'IMAGE',
        filename: `ai-generated-${platform || 'general'}.png`,
        mimeType: 'image/png',
        fileSize: imageBuffer.length,
        filePath: `${botId}/${filename}`,
        width: dims.width,
        height: dims.height,
        aiDescription: fullPrompt,
      },
    });

    // Log activity
    await db.botActivity.create({
      data: {
        botId,
        platform: (platform as any) || 'INSTAGRAM',
        action: 'GENERATE_IMAGE',
        content: fullPrompt.slice(0, 500),
        success: true,
        creditsUsed: GENERATION_COSTS.GENERATE_IMAGE,
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
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Image generation error:', message);

    // Always show the real error to help debug
    return NextResponse.json({
      error: `Image generation failed: ${message}`,
    }, { status: 500 });
  }
}
