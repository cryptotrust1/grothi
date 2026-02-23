import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { deductCredits, getActionCost, hasEnoughCredits } from '@/lib/credits';

export const maxDuration = 120;

// Max conversation length to prevent excessive token usage
const MAX_MESSAGES = 40;
// Max image size in bytes (5MB)
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

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
    'claude-sonnet-4-5-20250514',
    'claude-haiku-4-5-20251001',
  ],
  openai: [
    'gpt-4o',
    'gpt-4o-mini',
  ],
  google: [
    'gemini-2.5-flash',
    'gemini-2.5-pro',
  ],
};

const DEFAULT_MODELS: Record<Provider, string> = {
  anthropic: 'claude-sonnet-4-5-20250514',
  openai: 'gpt-4o',
  google: 'gemini-2.5-flash',
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

// ── Provider-specific API callers ──

async function callAnthropic(
  apiKey: string, model: string, systemPrompt: string, messages: ChatMessage[],
): Promise<Response> {
  return fetch('https://api.anthropic.com/v1/messages', {
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
  });
}

async function callOpenAI(
  apiKey: string, model: string, systemPrompt: string, messages: ChatMessage[],
): Promise<Response> {
  return fetch('https://api.openai.com/v1/chat/completions', {
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
  });
}

async function callGemini(
  apiKey: string, model: string, systemPrompt: string, messages: ChatMessage[],
): Promise<Response> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: buildGeminiContents(messages),
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: { maxOutputTokens: 2000, temperature: 0.7, topP: 0.95 },
    }),
  });
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
              if (event.type === 'message_stop') {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, creditCost })}\n\n`));
              }
            } catch { /* skip */ }
          }
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, creditCost })}\n\n`));
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Stream error';
        console.error('Anthropic stream error:', msg);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Stream interrupted.' })}\n\n`));
      } finally {
        controller.close();
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
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, creditCost })}\n\n`));
              continue;
            }
            try {
              const chunk = JSON.parse(jsonStr);
              const delta = chunk.choices?.[0]?.delta;
              if (delta?.content) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: delta.content })}\n\n`));
              }
              // Check finish_reason
              const finishReason = chunk.choices?.[0]?.finish_reason;
              if (finishReason === 'content_filter') {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Content blocked by safety filter.' })}\n\n`));
              }
            } catch { /* skip */ }
          }
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, creditCost })}\n\n`));
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Stream error';
        console.error('OpenAI stream error:', msg);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Stream interrupted.' })}\n\n`));
      } finally {
        controller.close();
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
              if (finishReason && finishReason !== 'SAFETY') {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, creditCost })}\n\n`));
              }
            } catch { /* skip */ }
          }
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, creditCost })}\n\n`));
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Stream error';
        console.error('Gemini stream error:', msg);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Stream interrupted.' })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });
}

// ── Main handler ──

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
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
    let apiKey: string;
    if (provider === 'anthropic') {
      apiKey = process.env.ANTHROPIC_API_KEY || '';
      if (!apiKey) return NextResponse.json({ error: 'Anthropic API key not configured. Contact admin.' }, { status: 503 });
    } else if (provider === 'openai') {
      apiKey = process.env.OPENAI_API_KEY || '';
      if (!apiKey) return NextResponse.json({ error: 'OpenAI API key not configured. Contact admin.' }, { status: 503 });
    } else {
      apiKey = process.env.GOOGLE_AI_API_KEY || '';
      if (!apiKey) return NextResponse.json({ error: 'Google AI API key not configured. Contact admin.' }, { status: 503 });
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
    if (provider === 'openai') {
      upstreamResponse = await callOpenAI(apiKey, selectedModel, systemPrompt, messages);
    } else if (provider === 'google') {
      upstreamResponse = await callGemini(apiKey, selectedModel, systemPrompt, messages);
    } else {
      upstreamResponse = await callAnthropic(apiKey, selectedModel, systemPrompt, messages);
    }

    // ── Handle upstream errors ──
    if (!upstreamResponse.ok) {
      const errBody = await upstreamResponse.text().catch(() => '');
      console.error(`${provider} API error ${upstreamResponse.status}:`, errBody.slice(0, 500));

      if (upstreamResponse.status === 401) {
        return NextResponse.json({ error: `${provider} API authentication failed. Contact admin.` }, { status: 502 });
      }
      if (upstreamResponse.status === 429) {
        return NextResponse.json({ error: 'AI service rate limited. Wait a moment and try again.' }, { status: 429 });
      }
      if (upstreamResponse.status === 529 || upstreamResponse.status === 503) {
        return NextResponse.json({ error: 'AI service temporarily overloaded. Try again in a minute.' }, { status: 503 });
      }
      return NextResponse.json({ error: 'AI service error. Please try again.' }, { status: 502 });
    }

    if (!upstreamResponse.body) {
      return NextResponse.json({ error: 'No response from AI service.' }, { status: 502 });
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
    db.botActivity.create({
      data: {
        botId,
        platform: 'FACEBOOK',
        action: 'GENERATE_CONTENT',
        content: `[AI Chat: ${selectedModel}] ${lastMessage.content.slice(0, 460)}`,
        success: true,
        creditsUsed: creditCost,
      },
    }).catch(() => {});

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
    console.error('Chat API error:', message);
    return NextResponse.json({ error: 'Chat failed. Please try again.' }, { status: 500 });
  }
}
