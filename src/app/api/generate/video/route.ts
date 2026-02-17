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

    // ── CHECK CONFIG BEFORE DEDUCTING CREDITS ──────────────────
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

    // Deduct credits only after confirming service is available
    const deducted = await deductCredits(
      user.id,
      GENERATION_COSTS.GENERATE_VIDEO,
      `AI video generation for ${platform || 'general'}`,
      botId
    );
    if (!deducted) {
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

    // Generate video via active provider
    let videoUrl: string;
    let usedProvider: string;

    try {
      if (provider === 'runway') {
        const result = await generateWithRunway(fullPrompt, apiKey);
        videoUrl = result.videoUrl;
        usedProvider = 'runway';
      } else {
        const result = await generateWithReplicate(fullPrompt, apiKey);
        videoUrl = result.videoUrl;
        usedProvider = 'replicate';
      }
    } catch (genError) {
      const genMsg = genError instanceof Error ? genError.message : String(genError);
      console.error(`Video generation error (${provider}):`, genMsg);

      // Check for common errors
      if (genMsg.includes('Invalid token') || genMsg.includes('Unauthenticated') || genMsg.includes('401') || genMsg.includes('invalid_api_key')) {
        const envVar = provider === 'replicate' ? 'REPLICATE_API_TOKEN' : 'RUNWAYML_API_SECRET';
        return NextResponse.json({
          error: `${provider} authentication failed. Your ${envVar} may be invalid or expired. Error: ${genMsg}`,
        }, { status: 502 });
      }
      if (genMsg.includes('rate limit') || genMsg.includes('429')) {
        return NextResponse.json({
          error: `${provider} rate limit reached. Wait a moment and try again. Error: ${genMsg}`,
        }, { status: 429 });
      }
      if (genMsg.includes('billing') || genMsg.includes('payment') || genMsg.includes('insufficient')) {
        return NextResponse.json({
          error: `${provider} billing issue. Check your account billing. Error: ${genMsg}`,
        }, { status: 402 });
      }

      return NextResponse.json({
        error: `Video generation failed (${provider}): ${genMsg}`,
      }, { status: 502 });
    }

    // Download the generated video
    const videoResponse = await fetch(videoUrl);
    if (!videoResponse.ok) {
      return NextResponse.json({
        error: `Failed to download generated video from ${usedProvider} (HTTP ${videoResponse.status}). The video URL may have expired. Try generating again.`,
      }, { status: 500 });
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
        content: `[${usedProvider}] ${fullPrompt.slice(0, 480)}`,
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
      provider: usedProvider,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Video generation error:', message);

    // Always show the real error to help debug
    return NextResponse.json({
      error: `Video generation failed: ${message}`,
    }, { status: 500 });
  }
}

// ── Provider implementations (inlined to avoid import issues) ──

async function generateWithReplicate(
  prompt: string,
  apiKey: string
): Promise<{ videoUrl: string }> {
  const Replicate = (await import('replicate')).default;
  const replicate = new Replicate({ auth: apiKey });

  const output = await replicate.run('minimax/video-01-live', {
    input: { prompt },
  });

  const videoUrl = Array.isArray(output) ? output[0] : output;
  if (!videoUrl || typeof videoUrl !== 'string') {
    throw new Error(`Replicate returned no video URL. Output type: ${typeof output}`);
  }

  return { videoUrl };
}

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
