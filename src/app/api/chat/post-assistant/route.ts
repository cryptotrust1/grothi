import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { deductCredits, getActionCost, hasEnoughCredits } from '@/lib/credits';
import { aiGenerationLimiter } from '@/lib/rate-limit';

export const maxDuration = 120;

// Max conversation length to prevent excessive token usage
const MAX_MESSAGES = 40;
// Max image size in bytes (5MB)
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
// Upstream API timeout (55 seconds — Nginx default is 60s)
const UPSTREAM_TIMEOUT_MS = 55_000;

// ── Provider types ──

type Provider = 'anthropic' | 'openai' | 'google';

interface ChatImage {
  data: string;      // base64 data (without data URL prefix)
  mediaType: string; // e.g. 'image/jpeg'
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  images?: ChatImage[];
}

// ── Model whitelists per provider ──

const ALLOWED_MODELS: Record<Provider, string[]> = {
  anthropic: [
    'claude-opus-4-6',
    'claude-sonnet-4-5-20250929',
    'claude-haiku-4-5-20251001',
  ],
  openai: [
    'gpt-4.1',
    'gpt-4.1-mini',
    'gpt-4.1-nano',
    'gpt-4o',
    'gpt-4o-mini',
  ],
  google: [
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
  ],
};

const DEFAULT_MODELS: Record<Provider, string> = {
  anthropic: 'claude-sonnet-4-5-20250929',
  openai: 'gpt-4.1-mini',
  google: 'gemini-2.5-flash',
};

// ── ENV key names per provider ──

const ENV_KEYS: Record<Provider, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  google: 'GOOGLE_AI_API_KEY',
};

// ── Message builders per provider ──

function buildAnthropicMessages(messages: ChatMessage[]): Array<Record<string, unknown>> {
  return messages.map((msg) => {
    if (msg.role === 'assistant') {
      return { role: 'assistant', content: msg.content };
    }
    if (msg.images && msg.images.length > 0) {
      const contentBlocks: Array<Record<string, unknown>> = [];
      for (const img of msg.images) {
        contentBlocks.push({
          type: 'image',
          source: { type: 'base64', media_type: img.mediaType, data: img.data },
        });
      }
      contentBlocks.push({
        type: 'text',
        text: msg.content || 'Analyze this image and suggest post content for it.',
      });
      return { role: 'user', content: contentBlocks };
    }
    return { role: 'user', content: msg.content };
  });
}

function buildOpenAIMessages(systemPrompt: string, messages: ChatMessage[]): Array<Record<string, unknown>> {
  const result: Array<Record<string, unknown>> = [
    { role: 'developer', content: systemPrompt },
  ];
  for (const msg of messages) {
    if (msg.role === 'assistant') {
      result.push({ role: 'assistant', content: msg.content });
      continue;
    }
    if (msg.images && msg.images.length > 0) {
      const contentParts: Array<Record<string, unknown>> = [];
      for (const img of msg.images) {
        contentParts.push({
          type: 'image_url',
          image_url: { url: `data:${img.mediaType};base64,${img.data}`, detail: 'auto' },
        });
      }
      contentParts.push({
        type: 'text',
        text: msg.content || 'Analyze this image and suggest post content for it.',
      });
      result.push({ role: 'user', content: contentParts });
    } else {
      result.push({ role: 'user', content: msg.content });
    }
  }
  return result;
}

function buildGeminiContents(messages: ChatMessage[]): Array<Record<string, unknown>> {
  return messages.map((msg) => {
    const parts: Array<Record<string, unknown>> = [];
    if (msg.images && msg.images.length > 0) {
      for (const img of msg.images) {
        parts.push({ inlineData: { mimeType: img.mediaType, data: img.data } });
      }
    }
    parts.push({ text: msg.content || 'Analyze this image and suggest post content for it.' });
    return {
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts,
    };
  });
}

// ── Provider-specific API callers (with timeout) ──

async function callAnthropic(
  apiKey: string, model: string, systemPrompt: string, messages: ChatMessage[],
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    return await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 2000,
        system: systemPrompt,
        messages: buildAnthropicMessages(messages),
        stream: true,
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function callOpenAI(
  apiKey: string, model: string, systemPrompt: string, messages: ChatMessage[],
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    return await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: buildOpenAIMessages(systemPrompt, messages),
        max_completion_tokens: 2000,
        stream: true,
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function callGemini(
  apiKey: string, model: string, systemPrompt: string, messages: ChatMessage[],
): Promise<Response> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    return await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: buildGeminiContents(messages),
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: { maxOutputTokens: 2000, temperature: 0.7, topP: 0.95 },
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

// ── Stream parsers: each provider SSE → unified { text } / { done } / { error } events ──

function createAnthropicStreamParser(
  upstreamBody: ReadableStream<Uint8Array>, creditCost: number,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  return new ReadableStream({
    async start(controller) {
      const reader = upstreamBody.getReader();
      let buffer = '';
      let sentDone = false;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const jsonStr = line.slice(6).trim();
            if (!jsonStr || jsonStr === '[DONE]') continue;
            try {
              const event = JSON.parse(jsonStr);
              if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta' && event.delta.text) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`));
              }
              if (event.type === 'error') {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: event.error?.message || 'AI error' })}\n\n`));
              }
              if (event.type === 'message_stop' && !sentDone) {
                sentDone = true;
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, creditCost })}\n\n`));
              }
            } catch { /* skip unparseable */ }
          }
        }
        // Final done (only if not already sent)
        if (!sentDone) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, creditCost })}\n\n`));
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Stream error';
        console.error('[chat] Anthropic stream error:', msg);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Stream interrupted. Try again.' })}\n\n`));
      } finally {
        try { controller.close(); } catch { /* already closed */ }
      }
    },
  });
}

function createOpenAIStreamParser(
  upstreamBody: ReadableStream<Uint8Array>, creditCost: number,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  return new ReadableStream({
    async start(controller) {
      const reader = upstreamBody.getReader();
      let buffer = '';
      let sentDone = false;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const jsonStr = line.slice(6).trim();
            if (!jsonStr) continue;
            if (jsonStr === '[DONE]') {
              if (!sentDone) {
                sentDone = true;
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, creditCost })}\n\n`));
              }
              continue;
            }
            try {
              const chunk = JSON.parse(jsonStr);
              const delta = chunk.choices?.[0]?.delta;
              if (delta?.content) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: delta.content })}\n\n`));
              }
              const finishReason = chunk.choices?.[0]?.finish_reason;
              if (finishReason === 'content_filter') {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Content blocked by safety filter.' })}\n\n`));
              }
            } catch { /* skip unparseable */ }
          }
        }
        if (!sentDone) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, creditCost })}\n\n`));
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Stream error';
        console.error('[chat] OpenAI stream error:', msg);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Stream interrupted. Try again.' })}\n\n`));
      } finally {
        try { controller.close(); } catch { /* already closed */ }
      }
    },
  });
}

function createGeminiStreamParser(
  upstreamBody: ReadableStream<Uint8Array>, creditCost: number,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  return new ReadableStream({
    async start(controller) {
      const reader = upstreamBody.getReader();
      let buffer = '';
      let sentDone = false;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const jsonStr = line.slice(6).trim();
            if (!jsonStr) continue;
            try {
              const chunk = JSON.parse(jsonStr);
              const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
              }
              const finishReason = chunk.candidates?.[0]?.finishReason;
              if (finishReason === 'SAFETY') {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Content blocked by safety filter.' })}\n\n`));
              }
              if (finishReason && finishReason !== 'SAFETY' && !sentDone) {
                sentDone = true;
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, creditCost })}\n\n`));
              }
            } catch { /* skip unparseable */ }
          }
        }
        if (!sentDone) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, creditCost })}\n\n`));
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Stream error';
        console.error('[chat] Gemini stream error:', msg);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Stream interrupted. Try again.' })}\n\n`));
      } finally {
        try { controller.close(); } catch { /* already closed */ }
      }
    },
  });
}

// ── Main handler ──

export async function POST(request: NextRequest) {
  let user;
  try {
    user = await getCurrentUser();
  } catch (err) {
    console.error('[chat] Auth error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Authentication error. Please sign in again.' }, { status: 401 });
  }

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 });
  }

  // Rate limit per user (prevents credit-draining abuse)
  const rateCheck = aiGenerationLimiter.check(`chat:${user.id}`);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: `Too many AI requests. Try again in ${Math.ceil(rateCheck.retryAfterMs / 1000)} seconds.` },
      { status: 429 }
    );
  }

  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    const { botId, messages, platforms, model, provider: rawProvider } = body as {
      botId?: string;
      messages?: ChatMessage[];
      platforms?: string[];
      model?: string;
      provider?: string;
    };

    // ── Validate request ──
    if (!botId || !messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Invalid request. Provide botId and messages.' }, { status: 400 });
    }
    if (messages.length > MAX_MESSAGES) {
      return NextResponse.json({
        error: `Conversation too long (${messages.length} messages). Start a new conversation to continue.`,
      }, { status: 400 });
    }
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== 'user') {
      return NextResponse.json({ error: 'Last message must be from user.' }, { status: 400 });
    }

    // Validate image sizes
    for (const msg of messages) {
      if (msg.images) {
        for (const img of msg.images) {
          const approxBytes = img.data.length * 0.75;
          if (approxBytes > MAX_IMAGE_SIZE_BYTES) {
            return NextResponse.json({ error: 'Image too large (max 5MB). Resize and try again.' }, { status: 400 });
          }
          if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(img.mediaType)) {
            return NextResponse.json({ error: `Unsupported image format: ${img.mediaType}. Use JPEG, PNG, GIF, or WebP.` }, { status: 400 });
          }
        }
      }
    }

    // ── Resolve provider and model ──
    const provider: Provider = (rawProvider === 'openai' || rawProvider === 'google') ? rawProvider : 'anthropic';
    const allowedForProvider = ALLOWED_MODELS[provider];
    const selectedModel = model && allowedForProvider.includes(model) ? model : DEFAULT_MODELS[provider];

    // ── Check API key for selected provider ──
    const envKey = ENV_KEYS[provider];
    const apiKey = process.env[envKey] || '';
    if (!apiKey) {
      const providerName = provider === 'anthropic' ? 'Anthropic' : provider === 'openai' ? 'OpenAI' : 'Google AI';
      console.error(`[chat] Missing ${envKey} env var`);
      return NextResponse.json({
        error: `${providerName} API key not configured. Contact admin to add ${envKey} to server environment.`,
      }, { status: 503 });
    }

    // ── Verify bot ownership ──
    const bot = await db.bot.findFirst({
      where: { id: botId, userId: user.id },
      select: { id: true, brandName: true, instructions: true, keywords: true, goal: true, targetUrl: true },
    });
    if (!bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
    }

    // ── Credit check & deduction ──
    const creditCost = await getActionCost('GENERATE_CONTENT');
    const canAfford = await hasEnoughCredits(user.id, creditCost);
    if (!canAfford) {
      return NextResponse.json({
        error: `Insufficient credits. You need ${creditCost} credits per message. Buy more in the Credits page.`,
      }, { status: 402 });
    }
    const deducted = await deductCredits(user.id, creditCost, `AI chat (${selectedModel})`, botId);
    if (!deducted) {
      return NextResponse.json({ error: 'Insufficient credits.' }, { status: 402 });
    }

    // ── Build system prompt ──
    const platformList = Array.isArray(platforms) && platforms.length > 0 ? platforms.join(', ') : 'social media';
    const systemPrompt = [
      `You are an expert AI assistant for social media marketing. You work inside Grothi — a SaaS platform for automated social media posting.`,
      `\nThe user is currently working with their brand "${bot.brandName}".`,
      bot.instructions ? `\nBrand context (for reference only): ${bot.instructions.slice(0, 1000)}` : '',
      bot.keywords ? `\nBrand keywords (for reference): ${bot.keywords}` : '',
      bot.goal ? `\nBrand marketing goal: ${bot.goal}` : '',
      bot.targetUrl ? `\nBrand website: ${bot.targetUrl}` : '',
      `\nCurrently selected platforms: ${platformList}`,
      '\nYour capabilities (no restrictions):',
      '- Answer ANY question the user asks — marketing, strategy, copywriting, general knowledge, coding, analysis, etc.',
      '- Help create compelling social media post content for any topic',
      '- Analyze images the user shares and suggest captions or content ideas',
      '- Provide marketing advice, hashtag suggestions, engagement tips, scheduling advice',
      '- Brainstorm ideas, refine drafts, translate content, rewrite in different tones',
      '- Discuss competitor strategies, trends, analytics interpretation',
      '\nContent formatting rules:',
      '- When writing social media post content, use PLAIN TEXT only — no markdown (no **bold**, no #headings, no bullet points)',
      '- For regular chat/advice/explanations, you may use light formatting',
      '- Keep post content natural, human-sounding, and ready to copy-paste',
      '- Respond in the same language the user writes to you',
    ].filter(Boolean).join('');

    // ── Call provider API ──
    let upstreamResponse: Response;
    try {
      if (provider === 'openai') {
        upstreamResponse = await callOpenAI(apiKey, selectedModel, systemPrompt, messages);
      } else if (provider === 'google') {
        upstreamResponse = await callGemini(apiKey, selectedModel, systemPrompt, messages);
      } else {
        upstreamResponse = await callAnthropic(apiKey, selectedModel, systemPrompt, messages);
      }
    } catch (fetchErr) {
      const isTimeout = fetchErr instanceof DOMException && fetchErr.name === 'AbortError';
      const msg = fetchErr instanceof Error ? fetchErr.message : 'Unknown error';
      console.error(`[chat] ${provider} fetch failed (timeout=${isTimeout}):`, msg);
      return NextResponse.json({
        error: isTimeout
          ? 'AI service took too long to respond. Try a shorter message or a different model.'
          : `Could not reach ${provider} API. Try again in a moment.`,
      }, { status: 504 });
    }

    // ── Handle upstream errors ──
    if (!upstreamResponse.ok) {
      const errBody = await upstreamResponse.text().catch(() => '');
      console.error(`[chat] ${provider} API error ${upstreamResponse.status}:`, errBody.slice(0, 500));

      if (upstreamResponse.status === 401 || upstreamResponse.status === 403) {
        return NextResponse.json({
          error: `${provider} API authentication failed. The API key may be expired or invalid. Contact admin.`,
        }, { status: 502 });
      }
      if (upstreamResponse.status === 400) {
        // Try to extract error message from response
        let detail = 'Invalid request to AI service.';
        try {
          const parsed = JSON.parse(errBody);
          detail = parsed.error?.message || parsed.error?.status || detail;
        } catch { /* use default */ }
        return NextResponse.json({ error: `AI error: ${detail}` }, { status: 400 });
      }
      if (upstreamResponse.status === 429) {
        return NextResponse.json({ error: 'AI service rate limited. Wait a moment and try again.' }, { status: 429 });
      }
      if (upstreamResponse.status === 529 || upstreamResponse.status === 503) {
        return NextResponse.json({ error: 'AI service temporarily overloaded. Try again in a minute.' }, { status: 503 });
      }
      return NextResponse.json({
        error: `AI service error (HTTP ${upstreamResponse.status}). Try a different model or try again later.`,
      }, { status: 502 });
    }

    if (!upstreamResponse.body) {
      return NextResponse.json({ error: 'No response body from AI service.' }, { status: 502 });
    }

    // ── Parse provider-specific SSE → unified stream ──
    let clientStream: ReadableStream<Uint8Array>;
    if (provider === 'openai') {
      clientStream = createOpenAIStreamParser(upstreamResponse.body, creditCost);
    } else if (provider === 'google') {
      clientStream = createGeminiStreamParser(upstreamResponse.body, creditCost);
    } else {
      clientStream = createAnthropicStreamParser(upstreamResponse.body, creditCost);
    }

    // Log activity (don't block response)
    const logPlatform = Array.isArray(platforms) && platforms.length > 0 ? platforms[0] : 'FACEBOOK';
    db.botActivity.create({
      data: {
        botId,
        platform: logPlatform as 'FACEBOOK',
        action: 'GENERATE_CONTENT',
        content: `[AI Chat: ${selectedModel}] ${lastMessage.content.slice(0, 460)}`,
        success: true,
        creditsUsed: creditCost,
      },
    }).catch((err) => {
      console.error('[chat] Activity log failed:', err instanceof Error ? err.message : err);
    });

    return new Response(clientStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[chat] Unhandled error:', message);
    return NextResponse.json({ error: 'Chat failed. Please try again.' }, { status: 500 });
  }
}
