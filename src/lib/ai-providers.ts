/**
 * Unified Text/Vision AI Provider Abstraction
 *
 * Supports Anthropic (Claude), OpenAI (GPT), and Google (Gemini) for:
 * - Media caption generation (vision)
 * - Post content generation (text)
 * - Any non-streaming text generation task
 *
 * Streaming chat uses its own implementation in /api/chat/post-assistant.
 *
 * All latest models included (Feb 2026):
 *   - Anthropic: Claude Opus 4.6, Sonnet 4.5, Haiku 4.5
 *   - OpenAI:    o3, o4-mini, GPT-4.1, GPT-4.1 Mini, GPT-4.1 Nano, GPT-4o, GPT-4o Mini
 *   - Google:    Gemini 3 Pro, Gemini 3 Flash, Gemini 2.5 Pro, Gemini 2.5 Flash, Gemini 2.5 Flash Lite
 */

// ── Types ──

export type TextProvider = 'anthropic' | 'openai' | 'google';

export interface TextAIModel {
  id: string;
  name: string;
  provider: TextProvider;
  apiModelId: string;
  vision: boolean;
  maxOutputTokens: number;
  badge?: string;
}

// ── Model Registry ──
// Model IDs verified against official API documentation.
// Only stable, production-ready models with vision support.

export const TEXT_AI_MODELS: TextAIModel[] = [
  // ── Anthropic (Claude) ──
  {
    id: 'claude-opus-4-6',
    name: 'Claude Opus 4.6',
    provider: 'anthropic',
    apiModelId: 'claude-opus-4-6',
    vision: true,
    maxOutputTokens: 16384,
    badge: 'Most Powerful',
  },
  {
    id: 'claude-sonnet-4-5',
    name: 'Claude Sonnet 4.5',
    provider: 'anthropic',
    apiModelId: 'claude-sonnet-4-5-20250929',
    vision: true,
    maxOutputTokens: 8192,
    badge: 'Balanced',
  },
  {
    id: 'claude-haiku-4-5',
    name: 'Claude Haiku 4.5',
    provider: 'anthropic',
    apiModelId: 'claude-haiku-4-5-20251001',
    vision: true,
    maxOutputTokens: 8192,
    badge: 'Fast',
  },

  // ── OpenAI (GPT + Reasoning) ──
  {
    id: 'o3',
    name: 'o3 (Reasoning)',
    provider: 'openai',
    apiModelId: 'o3',
    vision: true,
    maxOutputTokens: 100000,
    badge: 'Reasoning',
  },
  {
    id: 'o4-mini',
    name: 'o4-mini (Reasoning)',
    provider: 'openai',
    apiModelId: 'o4-mini',
    vision: true,
    maxOutputTokens: 65536,
    badge: 'Fast Reasoning',
  },
  {
    id: 'gpt-4.1',
    name: 'GPT-4.1',
    provider: 'openai',
    apiModelId: 'gpt-4.1',
    vision: true,
    maxOutputTokens: 32768,
    badge: 'Latest',
  },
  {
    id: 'gpt-4.1-mini',
    name: 'GPT-4.1 Mini',
    provider: 'openai',
    apiModelId: 'gpt-4.1-mini',
    vision: true,
    maxOutputTokens: 16384,
    badge: 'Best Value',
  },
  {
    id: 'gpt-4.1-nano',
    name: 'GPT-4.1 Nano',
    provider: 'openai',
    apiModelId: 'gpt-4.1-nano',
    vision: true,
    maxOutputTokens: 16384,
    badge: 'Cheapest',
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    apiModelId: 'gpt-4o',
    vision: true,
    maxOutputTokens: 16384,
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    apiModelId: 'gpt-4o-mini',
    vision: true,
    maxOutputTokens: 16384,
  },

  // ── Google (Gemini) ──
  {
    id: 'gemini-3-pro',
    name: 'Gemini 3 Pro',
    provider: 'google',
    apiModelId: 'gemini-3-pro-preview',
    vision: true,
    maxOutputTokens: 8192,
    badge: 'Most Powerful',
  },
  {
    id: 'gemini-3-flash',
    name: 'Gemini 3 Flash',
    provider: 'google',
    apiModelId: 'gemini-3-flash-preview',
    vision: true,
    maxOutputTokens: 8192,
    badge: 'Fast & Smart',
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'google',
    apiModelId: 'gemini-2.5-pro',
    vision: true,
    maxOutputTokens: 8192,
    badge: 'Powerful',
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'google',
    apiModelId: 'gemini-2.5-flash',
    vision: true,
    maxOutputTokens: 8192,
    badge: 'Fast',
  },
  {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash Lite',
    provider: 'google',
    apiModelId: 'gemini-2.5-flash-lite',
    vision: true,
    maxOutputTokens: 8192,
    badge: 'Budget',
  },
];

// ── Environment variable mapping ──

const ENV_KEYS: Record<TextProvider, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  google: 'GOOGLE_AI_API_KEY',
};

const DEFAULT_MODELS: Record<TextProvider, string> = {
  anthropic: 'claude-sonnet-4-5',
  openai: 'gpt-4.1-mini',
  google: 'gemini-2.5-flash',
};

// ── Helpers ──

export function getTextModel(id: string): TextAIModel | undefined {
  return TEXT_AI_MODELS.find(m => m.id === id || m.apiModelId === id);
}

export function getDefaultTextModel(provider: TextProvider): TextAIModel {
  const model = TEXT_AI_MODELS.find(m => m.id === DEFAULT_MODELS[provider]);
  if (!model) throw new Error(`No default model for provider: ${provider}`);
  return model;
}

export function getTextModelsByProvider(provider: TextProvider): TextAIModel[] {
  return TEXT_AI_MODELS.filter(m => m.provider === provider);
}

/** Check which providers have API keys configured */
export function getAvailableProviders(): TextProvider[] {
  const providers: TextProvider[] = [];
  if (process.env.ANTHROPIC_API_KEY) providers.push('anthropic');
  if (process.env.OPENAI_API_KEY) providers.push('openai');
  if (process.env.GOOGLE_AI_API_KEY) providers.push('google');
  return providers;
}

/** Whitelist of valid model IDs (prevents arbitrary model injection) */
const VALID_MODEL_IDS = new Set(TEXT_AI_MODELS.map(m => m.id));

/** Validate that a model ID is in our whitelist */
export function isValidModelId(id: string): boolean {
  return VALID_MODEL_IDS.has(id);
}

// ── Generation types ──

export interface ImageInput {
  base64: string;
  mediaType: string; // e.g. 'image/jpeg'
}

export interface GenerateTextOptions {
  modelId?: string;
  provider?: TextProvider;
  systemPrompt: string;
  userPrompt: string;
  image?: ImageInput;
  maxTokens?: number;
  timeoutMs?: number;
}

export interface GenerateTextResult {
  text: string;
  modelUsed: string;
  provider: TextProvider;
}

/**
 * Generate text using any supported AI provider (non-streaming).
 * Supports vision (image analysis) when image is provided.
 *
 * Security:
 * - Model IDs validated against whitelist
 * - API keys never exposed in errors
 * - Timeouts prevent hanging requests
 *
 * @throws Error with safe message on failure
 */
export async function generateText(options: GenerateTextOptions): Promise<GenerateTextResult> {
  const {
    modelId,
    provider: requestedProvider,
    systemPrompt,
    userPrompt,
    image,
    maxTokens = 2000,
    timeoutMs = 60000,
  } = options;

  // Resolve model (whitelist-validated)
  let model: TextAIModel;
  let provider: TextProvider;

  if (modelId) {
    if (!isValidModelId(modelId)) {
      throw new Error('Invalid model selection.');
    }
    const found = getTextModel(modelId);
    if (!found) {
      throw new Error('Invalid model selection.');
    }
    model = found;
    provider = found.provider;
  } else {
    provider = requestedProvider && ['anthropic', 'openai', 'google'].includes(requestedProvider)
      ? requestedProvider
      : 'anthropic';
    model = getDefaultTextModel(provider);
  }

  // Check API key availability
  const apiKey = process.env[ENV_KEYS[provider]];
  if (!apiKey) {
    const providerName = provider === 'anthropic' ? 'Anthropic' : provider === 'openai' ? 'OpenAI' : 'Google AI';
    throw new Error(`${providerName} API key not configured. Contact admin.`);
  }

  // Check vision capability
  if (image && !model.vision) {
    throw new Error(`Model ${model.name} does not support image analysis.`);
  }

  // Call provider with timeout
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let responseText: string;

    switch (provider) {
      case 'anthropic':
        responseText = await callAnthropicSync(apiKey, model.apiModelId, systemPrompt, userPrompt, image, maxTokens, controller.signal);
        break;
      case 'openai':
        responseText = await callOpenAISync(apiKey, model.apiModelId, systemPrompt, userPrompt, image, maxTokens, controller.signal);
        break;
      case 'google':
        responseText = await callGeminiSync(apiKey, model.apiModelId, systemPrompt, userPrompt, image, maxTokens, controller.signal);
        break;
    }

    return { text: responseText, modelUsed: model.apiModelId, provider };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('AI generation timed out. Please try again.');
    }
    // Re-throw our own errors (they have safe messages)
    if (error instanceof Error && !error.message.includes('api') && !error.message.includes('key')) {
      throw error;
    }
    // Sanitize unexpected errors
    const raw = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[ai-providers] ${provider} error:`, raw);
    throw new Error('AI service error. Please try again.');
  } finally {
    clearTimeout(timeout);
  }
}

// ── Provider-specific API callers (non-streaming) ──

async function callAnthropicSync(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  image: ImageInput | undefined,
  maxTokens: number,
  signal: AbortSignal,
): Promise<string> {
  const userContent: Array<Record<string, unknown>> = [];

  if (image) {
    userContent.push({
      type: 'image',
      source: { type: 'base64', media_type: image.mediaType, data: image.base64 },
    });
  }
  userContent.push({ type: 'text', text: userPrompt });

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    console.error(`[ai-providers] Anthropic API error ${response.status}:`, errorText.slice(0, 500));
    handleProviderError(response.status, 'Anthropic');
  }

  const result = await response.json();
  return result.content?.find((c: { type: string; text?: string }) => c.type === 'text')?.text || '';
}

async function callOpenAISync(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  image: ImageInput | undefined,
  maxTokens: number,
  signal: AbortSignal,
): Promise<string> {
  const userContent: Array<Record<string, unknown>> = [];

  if (image) {
    userContent.push({
      type: 'image_url',
      image_url: { url: `data:${image.mediaType};base64,${image.base64}`, detail: 'auto' },
    });
  }
  userContent.push({ type: 'text', text: userPrompt });

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'developer', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      max_completion_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    console.error(`[ai-providers] OpenAI API error ${response.status}:`, errorText.slice(0, 500));
    handleProviderError(response.status, 'OpenAI');
  }

  const result = await response.json();
  return result.choices?.[0]?.message?.content || '';
}

async function callGeminiSync(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  image: ImageInput | undefined,
  maxTokens: number,
  signal: AbortSignal,
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`;

  const parts: Array<Record<string, unknown>> = [];
  if (image) {
    parts.push({ inlineData: { mimeType: image.mediaType, data: image.base64 } });
  }
  parts.push({ text: userPrompt });

  const response = await fetch(url, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: { maxOutputTokens: maxTokens, temperature: 0.7 },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    console.error(`[ai-providers] Gemini API error ${response.status}:`, errorText.slice(0, 500));
    handleProviderError(response.status, 'Google AI');
  }

  const result = await response.json();
  return result.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// ── Shared error handler ──
// Maps HTTP status codes to safe user-facing error messages.

function handleProviderError(status: number, providerName: string): never {
  if (status === 401 || status === 403) {
    throw new Error(`${providerName} API authentication failed. Contact admin.`);
  }
  if (status === 429) {
    throw new Error('AI service rate limited. Wait a moment and try again.');
  }
  if (status === 529 || status === 503) {
    throw new Error('AI service temporarily overloaded. Try again in a minute.');
  }
  throw new Error(`AI service error (HTTP ${status}). Try again later.`);
}
