import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { deductCredits } from '@/lib/credits';
import { GENERATION_COSTS } from '@/lib/replicate';
import { generateVideo } from '@/lib/video-provider';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { randomUUID } from 'crypto';

export const maxDuration = 300; // 5 minutes for video generation

const UPLOAD_DIR = join(process.cwd(), 'data', 'uploads');

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

    // Deduct credits
    const deducted = await deductCredits(
      user.id,
      GENERATION_COSTS.GENERATE_VIDEO,
      `AI video generation for ${platform || 'general'}`,
      botId
    );
    if (!deducted) {
      return NextResponse.json({ error: 'Insufficient credits. You need 8 credits to generate a video.' }, { status: 402 });
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

    // Generate video via active provider (Replicate or Runway)
    const result = await generateVideo(fullPrompt);

    // Download the generated video
    const videoResponse = await fetch(result.videoUrl);
    if (!videoResponse.ok) {
      return NextResponse.json({ error: 'Failed to download generated video' }, { status: 500 });
    }
    const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());

    // Save to filesystem
    const botDir = resolve(join(UPLOAD_DIR, botId));
    if (!botDir.startsWith(resolve(UPLOAD_DIR))) {
      return NextResponse.json({ error: 'Invalid bot ID' }, { status: 400 });
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
        filename: `ai-generated-${platform || 'general'}.mp4`,
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
        platform: (platform as any) || 'TIKTOK',
        action: 'GENERATE_VIDEO',
        content: `[${result.provider}] ${fullPrompt.slice(0, 480)}`,
        success: true,
        creditsUsed: GENERATION_COSTS.GENERATE_VIDEO,
      },
    });

    return NextResponse.json({
      id: media.id,
      filename: media.filename,
      type: media.type,
      fileSize: media.fileSize,
      url: `/api/media/${media.id}`,
      prompt: fullPrompt,
      provider: result.provider,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Video generation error:', message);

    if (message.includes('API_TOKEN') || message.includes('API_SECRET') || message.includes('not configured')) {
      return NextResponse.json({ error: 'AI video generation is not configured yet. Check Admin → Settings.' }, { status: 503 });
    }

    return NextResponse.json({ error: 'Video generation failed. Please try again.' }, { status: 500 });
  }
}
