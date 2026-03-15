import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { deductCredits, getActionCost } from '@/lib/credits';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { generateText, isValidModelId, type TextProvider } from '@/lib/ai-providers';
import { aiGenerationLimiter } from '@/lib/rate-limit';

const UPLOAD_DIR = join(process.cwd(), 'data', 'uploads');

// Platform-specific content guidelines
const PLATFORM_GUIDELINES: Record<string, { maxLength: number; style: string }> = {
  FACEBOOK: { maxLength: 500, style: 'conversational, engaging, include a question or CTA' },
  INSTAGRAM: { maxLength: 300, style: 'short, visual, use line breaks, include relevant emojis and hashtags' },
  TWITTER: { maxLength: 280, style: 'concise, punchy, trending hashtags, attention-grabbing' },
  LINKEDIN: { maxLength: 700, style: 'professional, insightful, thought-leadership tone' },
  TIKTOK: { maxLength: 150, style: 'trendy, casual, Gen-Z friendly, use popular phrases' },
  MASTODON: { maxLength: 500, style: 'community-focused, thoughtful, no aggressive marketing' },
  BLUESKY: { maxLength: 300, style: 'casual, authentic, conversational' },
  TELEGRAM: { maxLength: 1000, style: 'informative, structured, can use markdown formatting' },
  PINTEREST: { maxLength: 500, style: 'descriptive, keyword-rich for SEO, inspiring' },
  THREADS: { maxLength: 500, style: 'conversational, hot take, engaging question' },
  REDDIT: { maxLength: 1000, style: 'informative, genuine, not promotional, add value' },
  MEDIUM: { maxLength: 2000, style: 'long-form intro, storytelling, educational' },
  DEVTO: { maxLength: 2000, style: 'technical, tutorial-style, developer-friendly' },
  YOUTUBE: { maxLength: 500, style: 'descriptive, SEO-optimized, include keywords' },
  DISCORD: { maxLength: 500, style: 'casual, community-focused, use embeds' },
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Rate limit per user per endpoint
  const rateCheck = aiGenerationLimiter.check(`caption:${user.id}`);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: `Too many AI requests. Try again in ${Math.ceil(rateCheck.retryAfterMs / 1000)} seconds.` },
      { status: 429 }
    );
  }
  // Global AI rate limit across ALL AI endpoints
  const { globalAILimiter } = await import('@/lib/rate-limit');
  const globalCheck = globalAILimiter.check(user.id);
  if (!globalCheck.allowed) {
    return NextResponse.json(
      { error: `AI usage limit reached. Try again in ${Math.ceil(globalCheck.retryAfterMs / 1000)} seconds.` },
      { status: 429 }
    );
  }

  const { id } = await params;
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    // Default to empty body - platforms will use defaults
  }
  const platforms = Array.isArray(body.platforms) ? (body.platforms as string[]) : ['FACEBOOK', 'INSTAGRAM', 'TWITTER'];

  // Validate and resolve AI model selection
  const requestedModel = typeof body.model === 'string' ? body.model : undefined;
  const requestedProvider = typeof body.provider === 'string' ? body.provider as TextProvider : undefined;

  // Validate model ID against whitelist (prevents model injection)
  if (requestedModel && !isValidModelId(requestedModel)) {
    return NextResponse.json({ error: 'Invalid model selection.' }, { status: 400 });
  }

  const media = await db.media.findUnique({
    where: { id },
    include: {
      bot: {
        select: {
          userId: true,
          brandName: true,
          instructions: true,
          keywords: true,
          goal: true,
          targetUrl: true,
          imagePreferences: true,
        },
      },
    },
  });

  if (!media || media.bot.userId !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (media.type === 'VIDEO') {
    return NextResponse.json(
      { error: 'AI descriptions for video files are not yet supported. Please add descriptions manually.' },
      { status: 400 }
    );
  }

  if (!media.filePath) {
    return NextResponse.json({ error: 'Media file not ready or unavailable' }, { status: 404 });
  }

  const filePath = resolve(join(UPLOAD_DIR, media.filePath));

  // Prevent path traversal — ensure resolved path is within UPLOAD_DIR
  if (!filePath.startsWith(resolve(UPLOAD_DIR))) {
    return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
  }

  if (!existsSync(filePath)) {
    return NextResponse.json({ error: 'File not found on disk' }, { status: 404 });
  }

  // Read the image file
  const imageBuffer = await readFile(filePath);
  const base64Image = imageBuffer.toString('base64');

  // Build the prompt
  const keywords = Array.isArray(media.bot.keywords) ? (media.bot.keywords as string[]).join(', ') : '';
  const imagePrefs = media.bot.imagePreferences as Record<string, unknown> | null;

  let styleContext = '';
  if (imagePrefs) {
    const tone = (imagePrefs.tone as string) || '';
    const brandColors = (imagePrefs.brandColors as string[]) || [];
    styleContext = `Brand tone: ${tone}. Brand colors: ${brandColors.join(', ')}.`;
  }

  const platformPrompts = platforms
    .filter(p => PLATFORM_GUIDELINES[p])
    .map(p => {
      const guide = PLATFORM_GUIDELINES[p];
      return `${p}: Write a ${guide.style} caption (max ${guide.maxLength} chars)`;
    })
    .join('\n');

  const systemPrompt = `You are an expert social media marketing copywriter for "${media.bot.brandName}".
Brand instructions: ${media.bot.instructions?.slice(0, 500) || 'None'}
Keywords: ${keywords}
Goal: ${media.bot.goal}
${styleContext}
${media.bot.targetUrl ? `Include a subtle mention of ${media.bot.targetUrl} where appropriate.` : ''}

Generate compelling, platform-optimized captions for this image.`;

  const userPrompt = `Analyze this image and generate marketing captions for each platform.

${platformPrompts}

Also generate:
- ALT_TEXT: A concise, accessible description of the image (max 125 chars)
- DESCRIPTION: A detailed description of what's in the image (max 300 chars)

Format your response EXACTLY as JSON:
{
  "altText": "...",
  "description": "...",
  "captions": {
    "PLATFORM_NAME": "caption text..."
  }
}

Return ONLY valid JSON, no markdown code blocks.`;

  // Deduct credits BEFORE generation (atomically check and deduct)
  const cost = await getActionCost('GENERATE_CONTENT');
  const deducted = await deductCredits(
    user.id,
    cost,
    'AI caption generation',
    media.botId
  );
  if (!deducted) {
    return NextResponse.json(
      { error: 'Insufficient credits. You need ' + cost + ' credits for AI generation.' },
      { status: 402 }
    );
  }

  try {
    const mediaType = media.mimeType === 'image/gif' ? 'image/gif' :
                       media.mimeType === 'image/webp' ? 'image/webp' :
                       media.mimeType === 'image/png' ? 'image/png' : 'image/jpeg';

    const result = await generateText({
      modelId: requestedModel,
      provider: requestedProvider,
      systemPrompt,
      userPrompt,
      image: { base64: base64Image, mediaType },
      maxTokens: 2000,
      timeoutMs: 60000,
    });

    // Parse the JSON response
    let parsed: { altText?: string; description?: string; captions?: Record<string, string> };
    try {
      // Try to extract JSON from the response (handle potential markdown wrapping)
      const jsonMatch = result.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found in response');
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      return NextResponse.json(
        { error: 'Failed to parse AI response. Please try again.' },
        { status: 500 }
      );
    }

    // Update media with AI-generated content
    await db.media.update({
      where: { id },
      data: {
        altText: parsed.altText || null,
        aiDescription: parsed.description || null,
        platformCaptions: parsed.captions || {},
      },
    });

    return NextResponse.json({
      altText: parsed.altText,
      description: parsed.description,
      captions: parsed.captions,
      modelUsed: result.modelUsed,
      provider: result.provider,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('AI generation error:', message);
    // Error messages from generateText are already sanitized
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
