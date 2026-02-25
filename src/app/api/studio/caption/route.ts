import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { deductCredits, getActionCost, addCredits } from '@/lib/credits';
import { generateText } from '@/lib/ai-providers';

const PLATFORM_GUIDELINES: Record<string, { maxLength: number; style: string }> = {
  FACEBOOK: { maxLength: 500, style: 'conversational, engaging, include a CTA' },
  INSTAGRAM: { maxLength: 300, style: 'short, visual, emojis + hashtags' },
  TWITTER: { maxLength: 280, style: 'concise, punchy, 1-2 hashtags' },
  LINKEDIN: { maxLength: 700, style: 'professional, thought-leadership tone' },
  TIKTOK: { maxLength: 150, style: 'trendy, casual, Gen-Z friendly' },
  THREADS: { maxLength: 500, style: 'conversational, engaging question' },
  YOUTUBE: { maxLength: 500, style: 'descriptive, SEO-optimized, include keywords' },
};

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { mediaId?: string; botId?: string; platforms?: string[]; videoDescription?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const {
    mediaId,
    botId,
    platforms = ['FACEBOOK', 'INSTAGRAM', 'TIKTOK'],
    videoDescription,
  } = body;

  if (!mediaId || !botId || typeof mediaId !== 'string' || typeof botId !== 'string') {
    return NextResponse.json({ error: 'mediaId and botId are required strings' }, { status: 400 });
  }

  if (!Array.isArray(platforms)) {
    return NextResponse.json({ error: 'platforms must be an array' }, { status: 400 });
  }

  if (platforms.length > 10) {
    return NextResponse.json({ error: 'Too many platforms (max 10)' }, { status: 400 });
  }

  const bot = await db.bot.findFirst({ where: { id: botId, userId: user.id } });
  if (!bot) {
    return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
  }

  const media = await db.media.findUnique({
    where: { id: mediaId },
    include: { bot: { select: { userId: true } } },
  });
  if (!media || media.bot.userId !== user.id) {
    return NextResponse.json({ error: 'Media not found' }, { status: 404 });
  }

  const keywords = Array.isArray(bot.keywords) ? (bot.keywords as string[]).join(', ') : '';

  const validPlatforms = platforms.filter(p => PLATFORM_GUIDELINES[p]);
  if (validPlatforms.length === 0) {
    return NextResponse.json({ error: 'No valid platforms selected' }, { status: 400 });
  }

  const platformPrompts = validPlatforms
    .map(p => {
      const guide = PLATFORM_GUIDELINES[p];
      return `${p}: Write a ${guide.style} caption (max ${guide.maxLength} chars)`;
    })
    .join('\n');

  // Use provided description, AI generation prompt, or filename as context
  // Truncate user-supplied context to prevent prompt inflation
  const rawContext =
    videoDescription?.trim()?.slice(0, 500) ||
    media.aiDescription?.slice(0, 500) ||
    media.filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
  const videoContext = rawContext;

  const brandName = (bot.brandName || 'Brand').slice(0, 100);
  const systemPrompt = `You are an expert social media marketing copywriter for "${brandName}".
Brand instructions: ${bot.instructions?.slice(0, 400) || 'None'}
Keywords: ${keywords}
Goal: ${bot.goal}
${bot.targetUrl ? `Website: ${bot.targetUrl}` : ''}

Generate compelling, platform-optimized post captions for a marketing video.`;

  const userPrompt = `Generate marketing post captions for this video.

Video description: "${videoContext}"

${platformPrompts}

Format your response EXACTLY as JSON:
{
  "captions": {
    "PLATFORM_NAME": "caption text..."
  }
}

Return ONLY valid JSON, no markdown code blocks.`;

  const cost = await getActionCost('GENERATE_CONTENT');
  const deducted = await deductCredits(
    user.id,
    cost,
    'AI video caption generation',
    botId
  );
  if (!deducted) {
    return NextResponse.json(
      { error: `Insufficient credits. You need ${cost} credits for AI caption generation.` },
      { status: 402 }
    );
  }

  try {
    const result = await generateText({
      systemPrompt,
      userPrompt,
      maxTokens: 1500,
      timeoutMs: 30000,
    });

    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in AI response');

    const parsed = JSON.parse(jsonMatch[0]) as { captions?: Record<string, string> };
    return NextResponse.json({ captions: parsed.captions || {} });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[studio/caption] error:', message);
    // Refund credits since AI call failed and user got nothing
    try {
      await addCredits(user.id, cost, 'REFUND', `Refund: caption generation failed`);
    } catch (refundErr) {
      console.error('[studio/caption] refund failed:', refundErr instanceof Error ? refundErr.message : refundErr);
    }
    return NextResponse.json(
      { error: `Caption generation failed: ${message}` },
      { status: 500 }
    );
  }
}
