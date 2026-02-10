import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

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

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const platforms = (body.platforms as string[]) || ['FACEBOOK', 'INSTAGRAM', 'TWITTER'];

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

  const filePath = join(UPLOAD_DIR, media.filePath);
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

  // Call Claude Vision API
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'AI service not configured. Set ANTHROPIC_API_KEY in environment.' },
      { status: 503 }
    );
  }

  try {
    const mediaType = media.mimeType === 'image/gif' ? 'image/gif' :
                       media.mimeType === 'image/webp' ? 'image/webp' :
                       media.mimeType === 'image/png' ? 'image/png' : 'image/jpeg';

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
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: base64Image,
                },
              },
              {
                type: 'text',
                text: userPrompt,
              },
            ],
          },
        ],
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
    const textContent = result.content?.find((c: any) => c.type === 'text')?.text || '';

    // Parse the JSON response
    let parsed: { altText?: string; description?: string; captions?: Record<string, string> };
    try {
      // Try to extract JSON from the response (handle potential markdown wrapping)
      const jsonMatch = textContent.match(/\{[\s\S]*\}/);
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
    });
  } catch (error: any) {
    console.error('AI generation error:', error);
    return NextResponse.json(
      { error: 'AI generation failed: ' + (error.message || 'Unknown error') },
      { status: 500 }
    );
  }
}
