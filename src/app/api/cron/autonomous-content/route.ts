/**
 * POST /api/cron/autonomous-content
 *
 * Background worker that generates AI content for autopilot posts.
 * Called by cron every 5 minutes.
 *
 * Flow:
 * 1. Find DRAFT or SCHEDULED autopilot posts with placeholder content
 * 2. For each post, generate AI content using Claude API
 * 3. Use platform algorithm knowledge + bot settings to create optimized content
 * 4. Update the post with generated content
 * 5. Deduct credits for content generation
 *
 * Security: Protected by CRON_SECRET.
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateCronSecret } from '@/lib/api-helpers';
import { db } from '@/lib/db';
import { deductCredits, getActionCost } from '@/lib/credits';
import {
  getContentGenerationContext,
  PLATFORM_ALGORITHM,
  getSuppressionTriggers,
  getBestContentFormat,
} from '@/lib/platform-algorithm';
import { PLATFORM_NAMES, CONTENT_TYPES } from '@/lib/constants';

/** Max posts to generate content for per invocation */
const BATCH_SIZE = 5;

/** Placeholder prefix that identifies autopilot posts needing content */
const AUTOPILOT_PLACEHOLDER = '[AUTOPILOT]';

export async function POST(request: NextRequest) {
  const cronError = validateCronSecret(request.headers.get('authorization'));
  if (cronError) return cronError;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  // Find autopilot posts that need content generation
  const pendingPosts = await db.scheduledPost.findMany({
    where: {
      source: 'AUTOPILOT',
      content: { startsWith: AUTOPILOT_PLACEHOLDER },
      status: { in: ['DRAFT', 'SCHEDULED'] },
    },
    include: {
      bot: {
        select: {
          id: true,
          userId: true,
          name: true,
          brandName: true,
          brandKnowledge: true,
          instructions: true,
          goal: true,
          keywords: true,
          targetUrl: true,
          utmSource: true,
          utmMedium: true,
          creativePreferences: true,
        },
      },
      product: {
        select: {
          id: true,
          name: true,
          description: true,
          brand: true,
          price: true,
          url: true,
          advantages: true,
          targetAudience: true,
          buyingReasons: true,
          aiInstructions: true,
          keywords: true,
        },
      },
      media: {
        select: {
          id: true,
          type: true,
          aiDescription: true,
          altText: true,
        },
      },
    },
    orderBy: { scheduledAt: 'asc' },
    take: BATCH_SIZE,
  });

  if (pendingPosts.length === 0) {
    return NextResponse.json({ processed: 0, message: 'No autopilot posts need content generation' });
  }

  const results: Array<{ postId: string; success: boolean; error?: string }> = [];

  for (const post of pendingPosts) {
    try {
      // Deduct credits for content generation
      const cost = await getActionCost('GENERATE_CONTENT');
      const deducted = await deductCredits(
        post.bot.userId,
        cost,
        `Autopilot content generation for ${PLATFORM_NAMES[(post.platforms as string[])[0]] || 'platform'}`,
        post.bot.id
      );

      if (!deducted) {
        // Mark post with error and skip
        await db.scheduledPost.update({
          where: { id: post.id },
          data: {
            status: 'FAILED',
            error: 'Not enough credits for content generation. Purchase more credits to continue autopilot.',
          },
        });
        results.push({ postId: post.id, success: false, error: 'Insufficient credits' });
        continue;
      }

      // Generate content
      const platform = (post.platforms as string[])[0] || 'FACEBOOK';
      const content = await generateContent(apiKey, {
        platform,
        contentType: post.contentType || 'educational',
        toneStyle: post.toneStyle || 'professional',
        hashtagPattern: post.hashtagPattern || 'moderate',
        bot: post.bot,
        product: post.product,
        media: post.media,
      });

      if (!content) {
        await db.scheduledPost.update({
          where: { id: post.id },
          data: { error: 'AI content generation failed. Will retry on next cycle.' },
        });
        results.push({ postId: post.id, success: false, error: 'Generation failed' });
        continue;
      }

      // Update post with generated content
      await db.scheduledPost.update({
        where: { id: post.id },
        data: {
          content: content.text,
        },
      });

      // Record activity
      await db.botActivity.create({
        data: {
          botId: post.bot.id,
          platform: platform as any,
          action: 'GENERATE_CONTENT',
          content: content.text.slice(0, 500),
          contentType: post.contentType || 'educational',
          success: true,
          creditsUsed: cost,
        },
      });

      results.push({ postId: post.id, success: true });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[autonomous-content] Failed for post ${post.id}:`, msg);
      results.push({ postId: post.id, success: false, error: msg });
    }
  }

  return NextResponse.json({
    processed: results.length,
    succeeded: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    results,
  });
}

/**
 * Generate AI content for a specific post using the Anthropic Messages API.
 */
async function generateContent(
  apiKey: string,
  params: {
    platform: string;
    contentType: string;
    toneStyle: string;
    hashtagPattern: string;
    bot: {
      name: string;
      brandName: string;
      brandKnowledge: string | null;
      instructions: string;
      goal: string;
      keywords: unknown;
      targetUrl: string | null;
      utmSource: string | null;
      utmMedium: string | null;
    };
    product: {
      name: string;
      description: string;
      brand: string | null;
      price: string | null;
      url: string | null;
      advantages: string;
      targetAudience: string;
      buyingReasons: string;
      aiInstructions: string | null;
      keywords: string[];
    } | null;
    media: {
      type: string;
      aiDescription: string | null;
      altText: string | null;
    } | null;
  }
): Promise<{ text: string; platformContent?: Record<string, unknown> } | null> {
  const algo = PLATFORM_ALGORITHM[params.platform];
  const platformContext = getContentGenerationContext(params.platform);
  const platformName = PLATFORM_NAMES[params.platform] || params.platform;
  const contentTypeLabel = CONTENT_TYPES.find(ct => ct.value === params.contentType)?.label || params.contentType;
  const keywords = Array.isArray(params.bot.keywords)
    ? (params.bot.keywords as string[]).join(', ')
    : '';

  // Get suppression triggers to explicitly warn the AI
  const suppressionTriggers = getSuppressionTriggers(params.platform);
  const bestFormat = getBestContentFormat(params.platform);

  // Build system prompt — v2 with full algorithm knowledge
  const systemParts: string[] = [
    `You are an expert social media growth strategist and content creator specializing in ${platformName}.`,
    `Your PRIMARY GOAL is to create content that the ${platformName} algorithm will recommend and distribute widely.`,
    `You create content for the brand "${params.bot.brandName}".`,
    '',
    `=== BRAND INSTRUCTIONS ===`,
    params.bot.instructions,
    '',
  ];

  if (params.bot.brandKnowledge) {
    systemParts.push(`=== BRAND KNOWLEDGE ===`, params.bot.brandKnowledge, '');
  }

  systemParts.push(
    `=== PLATFORM ALGORITHM INTELLIGENCE: ${platformName} ===`,
    platformContext,
    '',
  );

  // Add suppression triggers as explicit warnings
  if (suppressionTriggers.length > 0) {
    systemParts.push(
      `=== CRITICAL: SUPPRESSION TRIGGERS (MUST AVOID) ===`,
      ...suppressionTriggers.map(t => `- DO NOT: ${t}`),
      '',
    );
  }

  // Add best format recommendation
  if (bestFormat) {
    systemParts.push(
      `=== RECOMMENDED FORMAT ===`,
      `Best performing format: ${bestFormat.format} (${bestFormat.reachMultiplier}x reach, ${bestFormat.engagementRate}% engagement)`,
      `Note: ${bestFormat.note}`,
      '',
    );
  }

  systemParts.push(
    `=== REQUIREMENTS ===`,
    `- Content type: ${contentTypeLabel}`,
    `- Tone: ${params.toneStyle}`,
    `- Hashtag strategy: ${params.hashtagPattern}`,
    `- Goal: ${params.bot.goal}`,
    `- Max character limit: ${algo?.caption.maxLength || 2000}`,
    `- Optimal length: ${algo?.caption.optimalLength.min || 50}-${algo?.caption.optimalLength.max || 300} characters`,
    `- Emoji usage: ${algo?.caption.emojiUsage || 'moderate'}`,
  );

  if (algo?.caption.hookImportant) {
    systemParts.push(`- CRITICAL: Start with a strong hook that stops the scroll in the first line`);
  }

  if (keywords) {
    systemParts.push(`- Target keywords: ${keywords}`);
  }

  if (params.bot.targetUrl) {
    const utm = `?utm_source=${params.bot.utmSource || 'grothi'}&utm_medium=${params.bot.utmMedium || 'social'}`;
    systemParts.push(`- Target URL: ${params.bot.targetUrl}${utm}`);
    systemParts.push(`- Include the URL naturally when appropriate (not forced)`);
  }

  if (params.media?.aiDescription) {
    systemParts.push('', `=== ATTACHED MEDIA ===`, `Description: ${params.media.aiDescription}`);
  }

  // User prompt — v2 with algorithm optimization directives
  let userPrompt = `Create a single ${contentTypeLabel.toLowerCase()} post for ${platformName}.`;
  userPrompt += `\n\nYour goal: Create content that the ${platformName} algorithm will prioritize and distribute to non-followers.`;
  userPrompt += `\nPrimary metric to optimize: ${algo?.primaryMetric || 'engagement'}`;

  if (params.product) {
    userPrompt += `\n\nProduct to promote: "${params.product.name}"`;
    userPrompt += `\nDescription: ${params.product.description}`;
    if (params.product.price) userPrompt += `\nPrice: ${params.product.price}`;
    userPrompt += `\nAdvantages: ${params.product.advantages}`;
    userPrompt += `\nTarget audience: ${params.product.targetAudience}`;
    userPrompt += `\nBuying reasons: ${params.product.buyingReasons}`;
    if (params.product.aiInstructions) {
      userPrompt += `\nSpecial instructions: ${params.product.aiInstructions}`;
    }
    if (params.product.url) {
      const utm = `?utm_source=${params.bot.utmSource || 'grothi'}&utm_medium=${params.bot.utmMedium || 'social'}`;
      userPrompt += `\nProduct URL: ${params.product.url}${utm}`;
    }
  }

  userPrompt += `\n\nIMPORTANT RULES:`;
  userPrompt += `\n- Output ONLY the post text. No explanations, no "Here's a post:", no quotes.`;
  userPrompt += `\n- Stay within ${algo?.caption.optimalLength.min || 50}-${algo?.caption.optimalLength.max || 300} characters if possible`;
  userPrompt += `\n- Use ${params.toneStyle} tone`;
  userPrompt += `\n- Include exactly ${algo?.hashtags.recommended || 3} relevant hashtags (${params.hashtagPattern} style)`;
  if (algo?.hashtags.strategy === 'none') {
    userPrompt += `\n- DO NOT include any hashtags (${platformName} does not use them)`;
  }
  if (algo?.caption.hookImportant) {
    userPrompt += `\n- CRITICAL: Start with a strong hook in the very first line that stops the scroll`;
  }
  if (algo?.caption.ctaRecommended && params.bot.goal !== 'COMMUNITY') {
    userPrompt += `\n- Include a natural call-to-action`;
  }
  if (algo?.caption.emojiUsage === 'none') {
    userPrompt += `\n- Do NOT use emojis`;
  } else if (algo?.caption.emojiUsage === 'heavy') {
    userPrompt += `\n- Use emojis liberally throughout`;
  }
  // Algorithm-specific directives
  if (algo?.primaryMetric === 'dwell_time') {
    userPrompt += `\n- Format with short paragraphs and line breaks to maximize reading time`;
  }
  if (algo?.primaryMetric === 'replies_and_engagement') {
    userPrompt += `\n- End with a question or controversial opinion to drive replies`;
  }
  if (algo?.primaryMetric === 'saves_and_clicks') {
    userPrompt += `\n- Include actionable tips that people will want to save for later`;
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 1000,
        system: systemParts.join('\n'),
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error(`[autonomous-content] Anthropic API error ${response.status}:`, errorText.slice(0, 500));
      return null;
    }

    const result = await response.json();
    const textContent = result.content?.find((c: { type: string; text?: string }) => c.type === 'text')?.text;
    if (!textContent) return null;

    let text = textContent.trim();

    // Clean up: remove surrounding quotes if present
    if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
      text = text.slice(1, -1);
    }

    // Validate length
    if (algo && text.length > algo.caption.maxLength) {
      text = text.slice(0, algo.caption.maxLength);
    }

    return { text };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[autonomous-content] AI generation failed: ${msg}`);
    return null;
  }
}
