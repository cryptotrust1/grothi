import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { deductCredits } from '@/lib/credits';
import { getReplicate, MODELS, PLATFORM_IMAGE_DIMENSIONS, GENERATION_COSTS } from '@/lib/replicate';
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

    // Deduct credits
    const deducted = await deductCredits(
      user.id,
      GENERATION_COSTS.GENERATE_IMAGE,
      `AI image generation for ${platform || 'general'}`,
      botId
    );
    if (!deducted) {
      return NextResponse.json({ error: 'Insufficient credits. You need 3 credits to generate an image.' }, { status: 402 });
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
    const replicate = getReplicate();
    const output = await replicate.run(MODELS.IMAGE, {
      input: {
        prompt: fullPrompt,
        width: dims.width,
        height: dims.height,
        num_outputs: 1,
        output_format: 'png',
      },
    });

    // Get the image URL from output
    const imageUrl = Array.isArray(output) ? output[0] : output;
    if (!imageUrl || typeof imageUrl !== 'string') {
      return NextResponse.json({ error: 'Image generation failed — no output from AI' }, { status: 500 });
    }

    // Download the generated image
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      return NextResponse.json({ error: 'Failed to download generated image' }, { status: 500 });
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

    if (message.includes('REPLICATE_API_TOKEN')) {
      return NextResponse.json({ error: 'AI image generation is not configured yet. Contact support.' }, { status: 503 });
    }

    return NextResponse.json({ error: 'Image generation failed. Please try again.' }, { status: 500 });
  }
}
