/**
 * POST /api/generate/post-content
 *
 * AI-powered post content generation.
 * Takes a topic/prompt and generates platform-optimized post text.
 * Supports Anthropic (Claude), OpenAI (GPT), and Google (Gemini).
 *
 * Cost: GENERATE_CONTENT credits (default 2).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { deductCredits, getActionCost } from '@/lib/credits';
import { PLATFORM_REQUIREMENTS } from '@/lib/constants';
import { generateText, isValidModelId, type TextProvider } from '@/lib/ai-providers';
import { aiGenerationLimiter } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Rate limit per user (prevents credit-draining abuse)
  const rateCheck = aiGenerationLimiter.check(`postcontent:${user.id}`);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: `Too many AI requests. Try again in ${Math.ceil(rateCheck.retryAfterMs / 1000)} seconds.` },
      { status: 429 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const botId = body.botId as string | undefined;
  const prompt = (body.prompt as string | undefined)?.trim();
  const platforms = Array.isArray(body.platforms) ? (body.platforms as string[]) : [];
  // When useBrand is true (AI Suggestion button), include brand context in the prompt.
  // When false/omitted (direct user input), write exactly what the user asks for.
  const useBrand = body.useBrand === true;

  if (!botId || !prompt) {
    return NextResponse.json(
      { error: 'botId and prompt are required' },
      { status: 400 }
    );
  }

  if (prompt.length < 3) {
    return NextResponse.json(
      { error: 'Prompt must be at least 3 characters' },
      { status: 400 }
    );
  }

  // Validate and resolve AI model selection
  const requestedModel = typeof body.model === 'string' ? body.model : undefined;
  const requestedProvider = typeof body.provider === 'string' ? body.provider as TextProvider : undefined;

  // Validate model ID against whitelist (prevents model injection)
  if (requestedModel && !isValidModelId(requestedModel)) {
    return NextResponse.json({ error: 'Invalid model selection.' }, { status: 400 });
  }

  // Verify bot ownership
  const bot = await db.bot.findFirst({
    where: { id: botId, userId: user.id },
    select: {
      id: true,
      brandName: true,
      instructions: true,
      keywords: true,
      goal: true,
      targetUrl: true,
    },
  });

  if (!bot) {
    return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
  }

  // Deduct credits atomically before calling the API
  const cost = await getActionCost('GENERATE_CONTENT');
  const deducted = await deductCredits(
    user.id,
    cost,
    'AI post content generation',
    botId
  );
  if (!deducted) {
    return NextResponse.json(
      { error: `Not enough credits. You need ${cost} credits for AI generation.` },
      { status: 402 }
    );
  }

  // Build platform instructions
  const selectedPlatforms = platforms.filter(p => PLATFORM_REQUIREMENTS[p]);
  const platformInstructions = selectedPlatforms.map(p => {
    const req = PLATFORM_REQUIREMENTS[p];
    return `${req.name} (max ${req.maxCharacters} chars): Write in a style appropriate for ${req.name}.${
      req.mediaRequired ? ' Note: this platform requires media.' : ''
    }`;
  }).join('\n');

  const keywords = Array.isArray(bot.keywords) ? (bot.keywords as string[]).join(', ') : '';

  let systemPrompt: string;
  if (useBrand) {
    // AI Suggestion mode: include full brand context
    systemPrompt = `You are an expert social media marketing copywriter for "${bot.brandName}".
Brand instructions: ${bot.instructions?.slice(0, 500) || 'No specific instructions'}
Keywords: ${keywords || 'None specified'}
Goal: ${bot.goal || 'engagement'}
${bot.targetUrl ? `Website: ${bot.targetUrl}` : ''}

Write compelling, authentic social media posts. No generic filler. Each post should feel natural for the platform.
Do NOT use markdown formatting in the post text (no bold, no headers). Write plain text only.
Use line breaks and emojis where appropriate for the platform.`;
  } else {
    // Direct user mode: write exactly what the user asks for, no brand override
    systemPrompt = `You are a versatile social media copywriter. Write EXACTLY what the user asks for.
Do NOT inject any brand, company, or product information unless the user explicitly mentions it.
Follow the user's topic and instructions precisely.

Write compelling, authentic social media posts. No generic filler. Each post should feel natural for the platform.
Do NOT use markdown formatting in the post text (no bold, no headers). Write plain text only.
Use line breaks and emojis where appropriate for the platform.`;
  }

  const userPrompt = `Write a social media post about: ${prompt}

Generate:
1. A "universal" version that works well across platforms (aim for the shortest platform limit among selected platforms)
2. Platform-specific versions optimized for each platform:
${platformInstructions || 'General social media post'}

Format your response EXACTLY as JSON:
{
  "content": "The universal post text...",
  "platformContent": {
    "PLATFORM_NAME": "Platform-specific text..."
  }
}

Return ONLY valid JSON, no markdown code blocks.`;

  try {
    const result = await generateText({
      modelId: requestedModel,
      provider: requestedProvider,
      systemPrompt,
      userPrompt,
      maxTokens: 2000,
      timeoutMs: 60000,
    });

    // Parse the JSON response
    let parsed: { content?: string; platformContent?: Record<string, string> };
    try {
      const jsonMatch = result.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found');
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      return NextResponse.json(
        { error: 'Failed to parse AI response. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      content: parsed.content || '',
      platformContent: parsed.platformContent || {},
      modelUsed: result.modelUsed,
      provider: result.provider,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('AI post generation error:', message);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
