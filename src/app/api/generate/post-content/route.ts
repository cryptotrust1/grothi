/**
 * POST /api/generate/post-content
 *
 * AI-powered post content generation.
 * Takes a topic/prompt and generates platform-optimized post text.
 * Uses Claude to generate a universal version + per-platform versions.
 *
 * Cost: GENERATE_CONTENT credits (default 5).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { deductCredits, getActionCost, hasEnoughCredits } from '@/lib/credits';
import { PLATFORM_REQUIREMENTS } from '@/lib/constants';

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

  // Check and deduct credits
  const cost = await getActionCost('GENERATE_CONTENT');
  const canAfford = await hasEnoughCredits(user.id, cost);
  if (!canAfford) {
    return NextResponse.json(
      { error: `Not enough credits. You need ${cost} credits for AI generation.` },
      { status: 402 }
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'AI service not configured. Set ANTHROPIC_API_KEY in environment.' },
      { status: 503 }
    );
  }

  // Deduct credits before calling the API
  const deducted = await deductCredits(
    user.id,
    cost,
    'AI post content generation',
    botId
  );
  if (!deducted) {
    return NextResponse.json(
      { error: 'Failed to deduct credits. Please try again.' },
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

  const systemPrompt = `You are an expert social media marketing copywriter for "${bot.brandName}".
Brand instructions: ${bot.instructions?.slice(0, 500) || 'No specific instructions'}
Keywords: ${keywords || 'None specified'}
Goal: ${bot.goal || 'engagement'}
${bot.targetUrl ? `Website: ${bot.targetUrl}` : ''}

Write compelling, authentic social media posts. No generic filler. Each post should feel natural for the platform.
Do NOT use markdown formatting in the post text (no bold, no headers). Write plain text only.
Use line breaks and emojis where appropriate for the platform.`;

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
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Anthropic API error:', errorText);
      return NextResponse.json(
        { error: 'AI service returned an error. Please try again later.' },
        { status: 502 }
      );
    }

    const result = await response.json();
    const textContent = result.content?.find(
      (c: { type: string; text?: string }) => c.type === 'text'
    )?.text || '';

    // Parse the JSON response
    let parsed: { content?: string; platformContent?: Record<string, string> };
    try {
      const jsonMatch = textContent.match(/\{[\s\S]*\}/);
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
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('AI post generation error:', message);
    return NextResponse.json(
      { error: 'AI generation failed: ' + message },
      { status: 500 }
    );
  }
}
