// Video generation abstraction layer
// Supports switching between Replicate (Minimax) and Runway (Gen-4.5) via admin settings

import { db } from './db';

export type VideoProvider = 'replicate' | 'runway';

export interface VideoGenerationResult {
  videoUrl: string;
  provider: VideoProvider;
}

// ============ SYSTEM SETTINGS HELPERS ============

export async function getSystemSetting(key: string): Promise<string | null> {
  const setting = await db.systemSetting.findUnique({ where: { key } });
  return setting?.value ?? null;
}

export async function setSystemSetting(key: string, value: string): Promise<void> {
  await db.systemSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

// ============ PROVIDER CONFIG ============

export async function getActiveVideoProvider(): Promise<VideoProvider> {
  const provider = await getSystemSetting('video_provider');
  if (provider === 'runway') return 'runway';
  return 'replicate'; // default
}

export async function getProviderApiKey(provider: VideoProvider): Promise<string | null> {
  if (provider === 'replicate') {
    // Check DB first, fall back to env
    const dbKey = await getSystemSetting('replicate_api_token');
    return dbKey || process.env.REPLICATE_API_TOKEN || null;
  }
  if (provider === 'runway') {
    const dbKey = await getSystemSetting('runway_api_secret');
    return dbKey || process.env.RUNWAYML_API_SECRET || null;
  }
  return null;
}

// ============ VIDEO GENERATION ============

export async function generateVideo(prompt: string): Promise<VideoGenerationResult> {
  const provider = await getActiveVideoProvider();
  const apiKey = await getProviderApiKey(provider);

  if (!apiKey) {
    throw new Error(
      `${provider === 'replicate' ? 'REPLICATE_API_TOKEN' : 'RUNWAYML_API_SECRET'} is not configured. Set it in Admin → Settings.`
    );
  }

  if (provider === 'runway') {
    return generateWithRunway(prompt, apiKey);
  }
  return generateWithReplicate(prompt, apiKey);
}

// ============ REPLICATE (Minimax video-01 text-to-video) ============

async function generateWithReplicate(prompt: string, apiKey: string): Promise<VideoGenerationResult> {
  const Replicate = (await import('replicate')).default;
  const replicate = new Replicate({ auth: apiKey });

  const output = await replicate.run('minimax/video-01', {
    input: { prompt },
  });

  // Replicate v1.4+ returns FileOutput objects, not strings
  const rawOutput = Array.isArray(output) ? output[0] : output;
  let videoUrl: string;
  if (typeof rawOutput === 'string') {
    videoUrl = rawOutput;
  } else if (rawOutput && typeof rawOutput === 'object') {
    if (typeof (rawOutput as any).url === 'function') {
      const urlResult = (rawOutput as any).url();
      videoUrl = urlResult instanceof URL ? urlResult.toString() : String(urlResult);
    } else {
      videoUrl = String(rawOutput);
    }
  } else {
    throw new Error('Replicate: No video URL in output');
  }

  if (!videoUrl || !videoUrl.startsWith('http')) {
    throw new Error(`Replicate: Invalid video URL: ${videoUrl}`);
  }

  return { videoUrl, provider: 'replicate' };
}

// ============ RUNWAY (veo3.1_fast text-to-video) ============
// Official SDK: @runwayml/sdk
// Docs: https://docs.dev.runwayml.com/
// SDK text-to-video models: veo3.1, veo3.1_fast, veo3
// veo3.1_fast: 10 credits/sec without audio ($0.10/sec) — cheapest option

async function generateWithRunway(prompt: string, apiKey: string): Promise<VideoGenerationResult> {
  const RunwayML = (await import('@runwayml/sdk')).default;

  const client = new RunwayML({ apiKey });

  // veo3.1_fast is the most cost-effective text-to-video model
  // 6 seconds × 10 credits/sec = 60 credits = $0.60
  const task = await client.textToVideo
    .create({
      model: 'veo3.1_fast',
      promptText: prompt.slice(0, 1000), // max 1000 chars
      ratio: '1280:720',
      duration: 6,
    })
    .waitForTaskOutput();

  if (!task.output || task.output.length === 0) {
    throw new Error('Runway: No video output returned');
  }

  // task.output[0] is an ephemeral CloudFront URL (expires in 24-48h)
  // Must download immediately
  return { videoUrl: task.output[0], provider: 'runway' };
}
