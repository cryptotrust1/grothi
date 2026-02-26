/**
 * POST /api/cron/autonomous-content
 *
 * Background worker that generates AI content for autopilot posts.
 * Called by cron every 5 minutes.
 *
 * Flow:
 * 1. Atomically claim DRAFT/SCHEDULED autopilot posts with placeholder content
 * 2. For each post, deduct credits then generate AI content using Claude API
 * 3. Use platform algorithm knowledge + bot settings to create optimized content
 * 4. Update the post with generated content (or refund credits on failure)
 *
 * Security: Protected by CRON_SECRET.
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateCronSecret } from '@/lib/api-helpers';
import { db } from '@/lib/db';
import { deductCredits, addCredits, getActionCost } from '@/lib/credits';
import {
  getContentGenerationContext,
  PLATFORM_ALGORITHM,
  getSuppressionTriggers,
  getBestContentFormat,
} from '@/lib/platform-algorithm';
import { PLATFORM_NAMES, CONTENT_TYPES } from '@/lib/constants';
import { buildRssContext, loadRssSettings, formatRssContextForPrompt, type RssContext } from '@/lib/rss-intelligence';
import type { PlatformType } from '@prisma/client';

/** Max posts to generate content for per invocation */
const BATCH_SIZE = 5;

/** Placeholder prefix that identifies autopilot posts needing content */
const AUTOPILOT_PLACEHOLDER = '[AUTOPILOT]';

/** Timeout for Anthropic API calls (60 seconds) */
const AI_TIMEOUT_MS = 60_000;

export async function POST(request: NextRequest) {
  const cronError = validateCronSecret(request.headers.get('authorization'));
  if (cronError) return cronError;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  // Recovery: Reset stale [GENERATING] posts that have been stuck for >10 minutes
  // This handles crashes where the cron claimed posts but died before completing
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  await db.scheduledPost.updateMany({
    where: {
      source: 'AUTOPILOT',
      content: { startsWith: '[GENERATING]' },
      status: { in: ['DRAFT', 'SCHEDULED'] },
      updatedAt: { lt: tenMinutesAgo },
    },
    data: { content: '[AUTOPILOT] Retry pending — recovered from stale generation lock' },
  });

  // Atomically claim posts for processing to prevent race conditions.
  // If two cron instances overlap, each post is processed by only one instance.
  const claimedIds = await db.$transaction(async (tx) => {
    const candidates = await tx.scheduledPost.findMany({
      where: {
        source: 'AUTOPILOT',
        content: { startsWith: AUTOPILOT_PLACEHOLDER },
        status: { in: ['DRAFT', 'SCHEDULED'] },
      },
      orderBy: { scheduledAt: 'asc' },
      take: BATCH_SIZE,
      select: { id: true },
    });

    if (candidates.length === 0) return [];

    // Mark as "being generated" by prepending a lock marker
    // This prevents the next cron invocation from picking the same posts
    for (const c of candidates) {
      await tx.scheduledPost.update({
        where: { id: c.id },
        data: { content: `[GENERATING] ${c.id}` },
      });
    }

    return candidates.map(c => c.id);
  });

  if (claimedIds.length === 0) {
    return NextResponse.json({ processed: 0, message: 'No autopilot posts need content generation' });
  }

  // Fetch full data for claimed posts
  const pendingPosts = await db.scheduledPost.findMany({
    where: { id: { in: claimedIds } },
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
          rssFeeds: true,
          reactorState: true,
          contentPlans: {
            select: {
              platform: true,
              contentTypesOverride: true,
              tonesOverride: true,
              hashtagPatternsOverride: true,
              customHashtags: true,
            },
          },
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
  });

  const results: Array<{ postId: string; success: boolean; error?: string }> = [];

  // Pre-fetch RSS context once per bot (shared across all posts from the same bot)
  const rssContextCache = new Map<string, RssContext>();

  for (const post of pendingPosts) {
    try {
      // Fetch RSS context for this bot (cached per bot)
      let rssContext: RssContext | null = null;
      if (!rssContextCache.has(post.bot.id)) {
        const feedUrls = Array.isArray(post.bot.rssFeeds) ? (post.bot.rssFeeds as string[]) : [];
        const reactorState = (post.bot.reactorState as Record<string, unknown>) || {};
        const rssSettings = loadRssSettings(reactorState);
        if (feedUrls.length > 0 && rssSettings.adaptationMode !== 'never') {
          try {
            rssContext = await buildRssContext(feedUrls, rssSettings);
            rssContextCache.set(post.bot.id, rssContext);
          } catch (rssError) {
            console.warn(`[autonomous-content] RSS fetch failed for bot ${post.bot.id}:`, rssError instanceof Error ? rssError.message : rssError);
            rssContextCache.set(post.bot.id, { shouldApply: false, trendsSummary: '', topics: [], significantEvent: false, significantEventDesc: null, articles: [] });
          }
        } else {
          rssContextCache.set(post.bot.id, { shouldApply: false, trendsSummary: '', topics: [], significantEvent: false, significantEventDesc: null, articles: [] });
        }
      }
      rssContext = rssContextCache.get(post.bot.id) || null;

      // Get per-platform content plan overrides
      const platform = (post.platforms as string[])[0] || 'FACEBOOK';
      const platformPlan = post.bot.contentPlans?.find((p: { platform: string }) => p.platform === platform);
      const customHashtags = (platformPlan?.customHashtags as string) || null;

      // Deduct credits for content generation
      const cost = await getActionCost('GENERATE_CONTENT');
      const deducted = await deductCredits(
        post.bot.userId,
        cost,
        `Autopilot content generation for ${PLATFORM_NAMES[platform] || 'platform'}`,
        post.bot.id
      );

      if (!deducted) {
        // Mark post with error and restore placeholder so it can be retried after credits are added
        await db.scheduledPost.update({
          where: { id: post.id },
          data: {
            status: 'FAILED',
            content: `[AUTOPILOT] Pending — insufficient credits`,
            error: 'Not enough credits for content generation. Purchase more credits to continue autopilot.',
          },
        });
        results.push({ postId: post.id, success: false, error: 'Insufficient credits' });
        continue;
      }

      // Extract language and audience profile from reactor state
      const botReactor = (post.bot.reactorState as Record<string, unknown>) || {};
      const postLanguage = (botReactor.postLanguage as string) || 'en';
      const audienceProfile = (botReactor.audienceProfile as Record<string, unknown>) || {};

      // Generate content
      const content = await generateContent(apiKey, {
        platform,
        contentType: post.contentType || 'educational',
        toneStyle: post.toneStyle || 'professional',
        hashtagPattern: post.hashtagPattern || 'moderate',
        contentFormat: post.contentFormat || null,
        bot: post.bot,
        product: post.product,
        media: post.media,
        rssContext: rssContext || undefined,
        customHashtags: customHashtags || undefined,
        postLanguage,
        audienceProfile,
      });

      if (!content) {
        // REFUND credits — generation failed, user shouldn't pay for nothing
        await addCredits(
          post.bot.userId,
          cost,
          'REFUND',
          `Refund: AI content generation failed for autopilot post`,
        );
        // Restore placeholder so autonomous-content can retry on next cycle
        await db.scheduledPost.update({
          where: { id: post.id },
          data: {
            content: `[AUTOPILOT] Retry pending — generation failed`,
            error: 'AI content generation failed. Credits refunded. Will retry on next cycle.',
          },
        });
        results.push({ postId: post.id, success: false, error: 'Generation failed (credits refunded)' });
        continue;
      }

      // Update post with generated content and clear any previous error
      await db.scheduledPost.update({
        where: { id: post.id },
        data: {
          content: content.text,
          error: null,
        },
      });

      // Record activity — safe cast through validation
      const validPlatform = Object.keys(PLATFORM_NAMES).includes(platform) ? platform as PlatformType : 'FACEBOOK' as PlatformType;
      await db.botActivity.create({
        data: {
          botId: post.bot.id,
          platform: validPlatform,
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
      // Restore placeholder so it can be retried
      try {
        await db.scheduledPost.update({
          where: { id: post.id },
          data: {
            content: `[AUTOPILOT] Retry pending — error occurred`,
            error: `Content generation error: ${msg.slice(0, 200)}`,
          },
        });
      } catch { /* best effort */ }
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
    contentFormat: string | null;
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
    rssContext?: RssContext;
    customHashtags?: string;
    postLanguage?: string;
    audienceProfile?: Record<string, unknown>;
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

  // Add language directive (CRITICAL — must be early in the prompt for strongest adherence)
  if (params.postLanguage && params.postLanguage !== 'en') {
    const langNames: Record<string, string> = {
      sk: 'Slovak', cs: 'Czech', de: 'German', es: 'Spanish', fr: 'French',
      it: 'Italian', pt: 'Portuguese', nl: 'Dutch', pl: 'Polish', hu: 'Hungarian',
      ro: 'Romanian', bg: 'Bulgarian', hr: 'Croatian', sl: 'Slovenian', uk: 'Ukrainian',
      ru: 'Russian', tr: 'Turkish', ar: 'Arabic', zh: 'Chinese', ja: 'Japanese',
      ko: 'Korean', hi: 'Hindi', sv: 'Swedish', da: 'Danish', fi: 'Finnish',
      no: 'Norwegian', el: 'Greek', he: 'Hebrew', th: 'Thai', vi: 'Vietnamese',
      id: 'Indonesian', ms: 'Malay',
    };
    const langName = langNames[params.postLanguage] || params.postLanguage;
    systemParts.push(
      `=== LANGUAGE REQUIREMENT (MANDATORY) ===`,
      `You MUST write the ENTIRE post in ${langName} (${params.postLanguage}). Every word, hashtag description, and call-to-action must be in ${langName}.`,
      `Do NOT mix languages. Do NOT write in English unless the user's language IS English.`,
      '',
    );
  }

  if (params.bot.brandKnowledge) {
    systemParts.push(`=== BRAND KNOWLEDGE ===`, params.bot.brandKnowledge, '');
  }

  // Add audience profile if available
  if (params.audienceProfile && Object.keys(params.audienceProfile).length > 0) {
    const ap = params.audienceProfile;
    const profileParts: string[] = ['=== TARGET AUDIENCE PROFILE ==='];

    if (ap.audienceName) profileParts.push(`Audience name: ${ap.audienceName}`);
    if (ap.summary) profileParts.push(`Audience summary: ${ap.summary}`);
    if (ap.transformation) profileParts.push(`TRANSFORMATION: ${ap.transformation} — Every piece of content should move them along this journey.`);

    // Demographics
    if (ap.ageRange) profileParts.push(`Age range: ${ap.ageRange}`);
    if (ap.gender) profileParts.push(`Gender: ${ap.gender}`);
    if (ap.location) profileParts.push(`Location: ${ap.location}`);
    if (ap.languages) profileParts.push(`Languages spoken: ${ap.languages}`);
    if (ap.occupation) profileParts.push(`Occupation/Industry: ${ap.occupation}`);
    if (ap.incomeLevel) profileParts.push(`Income level: ${ap.incomeLevel}`);
    if (ap.education) profileParts.push(`Education: ${ap.education}`);

    // Psychographics
    if (ap.interests) profileParts.push(`\nInterests & Hobbies: ${ap.interests}`);
    if (ap.values) profileParts.push(`Core values: ${ap.values}`);
    if (ap.lifestyle) profileParts.push(`Lifestyle: ${ap.lifestyle}`);
    if (ap.onlineBehavior) profileParts.push(`Online behavior: ${ap.onlineBehavior}`);
    if (ap.contentPreferences) profileParts.push(`Content preferences: ${ap.contentPreferences}`);
    if (ap.followMotivation) profileParts.push(`Primary reason they follow accounts: ${ap.followMotivation}`);

    // Core psychology — pain/gain framework (highest impact on content)
    if (ap.painPoints) profileParts.push(`\nPAIN POINTS (problems they face — address these directly): ${ap.painPoints}`);
    if (ap.desires) profileParts.push(`DESIRES (what they want to achieve — speak to these aspirations): ${ap.desires}`);
    if (ap.biggestFear) profileParts.push(`BIGGEST FEAR (what keeps them up at night): ${ap.biggestFear}`);
    if (ap.aspirationalIdentity) profileParts.push(`ASPIRATIONAL IDENTITY (who they want to become): ${ap.aspirationalIdentity}`);
    if (ap.objections) profileParts.push(`OBJECTIONS (why they hesitate to buy/follow): ${ap.objections}`);
    if (ap.commonQuestions) profileParts.push(`QUESTIONS THEY ASK (use these as content inspiration): ${ap.commonQuestions}`);

    // Vocabulary — critical for authentic voice
    if (ap.wordsTheyUse) profileParts.push(`\nWORDS & PHRASES TO USE (their actual vocabulary): ${ap.wordsTheyUse}`);
    if (ap.wordsToAvoid) profileParts.push(`WORDS & PHRASES TO AVOID (will make content feel inauthentic): ${ap.wordsToAvoid}`);

    // Buying psychology
    if (ap.buyingTriggers) profileParts.push(`\nBUYING TRIGGERS (what makes them take action): ${ap.buyingTriggers}`);
    if (ap.decisionFactors) profileParts.push(`DECISION STYLE: ${ap.decisionFactors}`);
    if (ap.purchaseStage) profileParts.push(`PURCHASE STAGE: ${ap.purchaseStage}`);
    if (ap.priceSensitivity) profileParts.push(`PRICE SENSITIVITY: ${ap.priceSensitivity}`);
    if (ap.trustBarriers) profileParts.push(`TRUST BARRIERS: ${ap.trustBarriers}`);

    // Competitive & relationship context
    if (ap.brandRelationship) profileParts.push(`\nRelationship with brand: ${ap.brandRelationship}`);
    if (ap.competitors) profileParts.push(`Competitors they follow: ${ap.competitors}`);
    if (ap.influencers) profileParts.push(`Influencers they trust: ${ap.influencers}`);

    // Communication strategy
    if (ap.communicationStyle) profileParts.push(`\nHow to communicate with them: ${ap.communicationStyle}`);
    if (ap.emotionalHooks) profileParts.push(`Emotional hooks that work: ${ap.emotionalHooks}`);
    if (ap.avoidTopics) profileParts.push(`Topics/approaches to AVOID: ${ap.avoidTopics}`);

    // Purchase stage → content strategy mapping (Eugene Schwartz awareness model)
    if (ap.purchaseStage) {
      const stageDirectives: Record<string, string> = {
        unaware: 'Audience is UNAWARE of their problem. Focus on curiosity-driven content — make them realize they have a problem without selling. Use stories, questions, and relatable scenarios.',
        problem_aware: 'Audience KNOWS they have a problem but not the solution. Validate their struggles, name the problem clearly, and hint at solutions without hard-selling.',
        exploring: 'Audience is EXPLORING solutions. Provide educational content — how-tos, comparisons, frameworks. Position the brand as a knowledgeable guide.',
        comparing: 'Audience is COMPARING options. Use social proof, case studies, data, and differentiators. Show why this solution is better than alternatives.',
        ready_to_buy: 'Audience is READY TO BUY. Use clear CTAs, urgency, limited offers, and remove final objections. Focus on risk-reversal (guarantees, free trials).',
        existing_customer: 'Audience is ALREADY A CUSTOMER. Focus on community, loyalty, advanced tips, and cross-sell. Make them feel valued and encourage advocacy.',
      };
      const directive = stageDirectives[ap.purchaseStage as string];
      if (directive) {
        profileParts.push(`\nCONTENT STRATEGY FOR PURCHASE STAGE: ${directive}`);
      }
    }

    profileParts.push('');
    profileParts.push('INSTRUCTIONS: Use this audience profile to create content that deeply resonates with these specific people.');
    profileParts.push('Address their pain points, speak to their desires, use their vocabulary (not corporate language), and trigger the psychological factors that drive them to engage, follow, and buy.');
    if (ap.wordsTheyUse) {
      const topWords = (ap.wordsTheyUse as string).split(/[,;\n|]+/).map(w => w.trim()).filter(Boolean).slice(0, 5);
      profileParts.push(`CRITICAL: Naturally incorporate their language: ${topWords.map(w => `"${w}"`).join(', ')}`);
    }
    if (ap.wordsToAvoid) {
      profileParts.push(`NEVER use these words/phrases: ${ap.wordsToAvoid}`);
    }
    profileParts.push('');

    systemParts.push(...profileParts);
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

  // Add best format recommendation — use stored contentFormat if available, else fall back to live lookup
  const effectiveFormat = params.contentFormat || bestFormat?.format || null;
  if (effectiveFormat || bestFormat) {
    const formatParts: string[] = [
      `=== RECOMMENDED FORMAT ===`,
      `Target format for this post: ${effectiveFormat || bestFormat?.format}`,
    ];
    if (bestFormat) {
      formatParts.push(`Performance data: ${bestFormat.format} (${bestFormat.reachMultiplier}x reach, ${bestFormat.engagementRate}% engagement)`);
    }
    if (bestFormat?.note) {
      formatParts.push(`Note: ${bestFormat.note}`);
    }
    formatParts.push(`Optimize the content structure specifically for this format.`, '');
    systemParts.push(...formatParts);
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

  // Add RSS intelligence context if available
  if (params.rssContext) {
    const rssPrompt = formatRssContextForPrompt(params.rssContext);
    if (rssPrompt) {
      systemParts.push('', rssPrompt);
    }
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
  // Add custom hashtags if configured for this platform
  if (params.customHashtags) {
    userPrompt += `\n- MUST include these custom hashtags: ${params.customHashtags}`;
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
    // Use AbortController to enforce timeout on the API call
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

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
        system: systemParts.filter(Boolean).join('\n'),
        messages: [{ role: 'user', content: userPrompt }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

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
