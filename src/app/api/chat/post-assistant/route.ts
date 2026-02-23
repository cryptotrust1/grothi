import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { deductCredits, getActionCost, hasEnoughCredits } from '@/lib/credits';

export const maxDuration = 120;

// Max conversation length to prevent excessive token usage
const MAX_MESSAGES = 40;
// Max image size in bytes (5MB — Anthropic API limit)
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

interface ChatImage {
  data: string;      // base64 data (without data URL prefix)
  mediaType: string; // e.g. 'image/jpeg'
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  images?: ChatImage[];
}

// Build the Anthropic messages array from our chat format
function buildAnthropicMessages(messages: ChatMessage[]): Array<Record<string, unknown>> {
  return messages.map((msg) => {
    if (msg.role === 'assistant') {
      return { role: 'assistant', content: msg.content };
    }

    // User messages may include images (Vision)
    if (msg.images && msg.images.length > 0) {
      const contentBlocks: Array<Record<string, unknown>> = [];

      for (const img of msg.images) {
        contentBlocks.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: img.mediaType,
            data: img.data,
          },
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

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { botId, messages, platforms, model } = body as {
      botId?: string;
      messages?: ChatMessage[];
      platforms?: string[];
      model?: string;
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

    // Validate message format
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== 'user') {
      return NextResponse.json({ error: 'Last message must be from user.' }, { status: 400 });
    }

    // Validate image sizes
    for (const msg of messages) {
      if (msg.images) {
        for (const img of msg.images) {
          // base64 string length * 0.75 ≈ byte size
          const approxBytes = img.data.length * 0.75;
          if (approxBytes > MAX_IMAGE_SIZE_BYTES) {
            return NextResponse.json({
              error: `Image too large (max 5MB). Resize and try again.`,
            }, { status: 400 });
          }
          // Validate media type
          if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(img.mediaType)) {
            return NextResponse.json({
              error: `Unsupported image format: ${img.mediaType}. Use JPEG, PNG, GIF, or WebP.`,
            }, { status: 400 });
          }
        }
      }
    }

    // ── Verify bot ownership ──
    const bot = await db.bot.findFirst({
      where: { id: botId, userId: user.id },
      select: { id: true, brandName: true, instructions: true, keywords: true, goal: true, targetUrl: true },
    });
    if (!bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
    }

    // ── Check API key ──
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        error: 'AI service not configured. ANTHROPIC_API_KEY is missing.',
      }, { status: 503 });
    }

    // ── Credit check & deduction ──
    const creditCost = await getActionCost('GENERATE_CONTENT');
    const canAfford = await hasEnoughCredits(user.id, creditCost);
    if (!canAfford) {
      return NextResponse.json({
        error: `Insufficient credits. You need ${creditCost} credits per message. Buy more in the Credits page.`,
      }, { status: 402 });
    }

    const deducted = await deductCredits(user.id, creditCost, 'AI chat assistant', botId);
    if (!deducted) {
      return NextResponse.json({ error: 'Insufficient credits.' }, { status: 402 });
    }

    // ── Build system prompt ──
    const platformList = Array.isArray(platforms) && platforms.length > 0
      ? platforms.join(', ')
      : 'social media';

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

    // ── Build Anthropic messages ──
    const anthropicMessages = buildAnthropicMessages(messages);

    // ── Resolve model (whitelist only allowed models) ──
    const ALLOWED_MODELS = [
      'claude-sonnet-4-5-20250514',
      'claude-haiku-4-5-20251001',
      'claude-3-5-sonnet-20241022',
    ];
    const selectedModel = model && ALLOWED_MODELS.includes(model) ? model : 'claude-sonnet-4-5-20250514';

    // ── Call Anthropic API with streaming ──
    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: selectedModel,
        max_tokens: 2000,
        system: systemPrompt,
        messages: anthropicMessages,
        stream: true,
      }),
    });

    if (!anthropicResponse.ok) {
      const errBody = await anthropicResponse.text().catch(() => '');
      console.error(`Anthropic API error ${anthropicResponse.status}:`, errBody.slice(0, 500));

      // Don't expose API details to client
      if (anthropicResponse.status === 401) {
        return NextResponse.json({ error: 'AI service authentication failed. Contact admin.' }, { status: 502 });
      }
      if (anthropicResponse.status === 429) {
        return NextResponse.json({ error: 'AI service rate limited. Wait a moment and try again.' }, { status: 429 });
      }
      if (anthropicResponse.status === 529) {
        return NextResponse.json({ error: 'AI service is temporarily overloaded. Try again in a minute.' }, { status: 503 });
      }
      return NextResponse.json({ error: 'AI service error. Please try again.' }, { status: 502 });
    }

    if (!anthropicResponse.body) {
      return NextResponse.json({ error: 'No response from AI service.' }, { status: 502 });
    }

    // ── Stream response to client ──
    // Parse Anthropic SSE and re-emit simplified SSE events
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const readableStream = new ReadableStream({
      async start(controller) {
        const reader = anthropicResponse.body!.getReader();
        let buffer = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep incomplete last line in buffer

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;

              const jsonStr = line.slice(6).trim();
              if (!jsonStr || jsonStr === '[DONE]') continue;

              try {
                const event = JSON.parse(jsonStr);

                // Extract text deltas
                if (
                  event.type === 'content_block_delta' &&
                  event.delta?.type === 'text_delta' &&
                  event.delta.text
                ) {
                  const chunk = JSON.stringify({ text: event.delta.text });
                  controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
                }

                // Stream errors from Anthropic
                if (event.type === 'error') {
                  const errMsg = event.error?.message || 'AI service error';
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ error: errMsg })}\n\n`)
                  );
                }

                // Message complete
                if (event.type === 'message_stop') {
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ done: true, creditCost })}\n\n`)
                  );
                }
              } catch {
                // Skip unparseable SSE data lines
              }
            }
          }

          // Ensure we always signal completion
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ done: true, creditCost })}\n\n`)
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Stream error';
          console.error('Chat stream error:', msg);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: 'Stream interrupted. Try again.' })}\n\n`)
          );
        } finally {
          controller.close();
        }
      },
    });

    // Log activity
    await db.botActivity.create({
      data: {
        botId,
        platform: 'FACEBOOK', // Generic — chat isn't platform-specific
        action: 'GENERATE_CONTENT',
        content: `[AI Chat] ${lastMessage.content.slice(0, 480)}`,
        success: true,
        creditsUsed: creditCost,
      },
    }).catch(() => {}); // Don't fail the response if logging fails

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Chat API error:', message);
    return NextResponse.json({ error: 'Chat failed. Please try again.' }, { status: 500 });
  }
}
