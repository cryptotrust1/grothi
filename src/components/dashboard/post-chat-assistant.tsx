'use client';

import { useState, useRef, useCallback, useEffect, type ChangeEvent } from 'react';
import {
  Sparkles, Send, Upload, X, Loader2, Image as ImageIcon,
  CheckCircle2, AlertCircle, MessageSquare, Coins, ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// ── Types ──

interface ChatImage {
  data: string;      // base64 WITHOUT data: prefix
  mediaType: string; // e.g. 'image/jpeg'
  preview: string;   // full data URL for display
  name: string;      // filename
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  images?: ChatImage[];
  isStreaming?: boolean;
}

// ── Model definitions ──

interface AIModel {
  id: string;
  label: string;
  provider: 'anthropic' | 'openai' | 'google';
  apiModel: string;
  vision: boolean;
}

const AI_MODELS: AIModel[] = [
  // Anthropic
  { id: 'opus-4.6', label: 'Claude Opus 4.6', provider: 'anthropic', apiModel: 'claude-opus-4-6', vision: true },
  { id: 'sonnet-4.5', label: 'Claude Sonnet 4.5', provider: 'anthropic', apiModel: 'claude-sonnet-4-5-20250929', vision: true },
  { id: 'haiku-4.5', label: 'Claude Haiku 4.5', provider: 'anthropic', apiModel: 'claude-haiku-4-5-20251001', vision: true },
  // OpenAI
  { id: 'o3', label: 'o3 (Reasoning)', provider: 'openai', apiModel: 'o3', vision: true },
  { id: 'o4-mini', label: 'o4-mini (Reasoning)', provider: 'openai', apiModel: 'o4-mini', vision: true },
  { id: 'gpt-4.1', label: 'GPT-4.1', provider: 'openai', apiModel: 'gpt-4.1', vision: true },
  { id: 'gpt-4.1-mini', label: 'GPT-4.1 Mini', provider: 'openai', apiModel: 'gpt-4.1-mini', vision: true },
  { id: 'gpt-4.1-nano', label: 'GPT-4.1 Nano', provider: 'openai', apiModel: 'gpt-4.1-nano', vision: true },
  { id: 'gpt-4o', label: 'GPT-4o', provider: 'openai', apiModel: 'gpt-4o', vision: true },
  { id: 'gpt-4o-mini', label: 'GPT-4o Mini', provider: 'openai', apiModel: 'gpt-4o-mini', vision: true },
  // Google
  { id: 'gemini-3-pro', label: 'Gemini 3 Pro', provider: 'google', apiModel: 'gemini-3-pro-preview', vision: true },
  { id: 'gemini-3-flash', label: 'Gemini 3 Flash', provider: 'google', apiModel: 'gemini-3-flash-preview', vision: true },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', provider: 'google', apiModel: 'gemini-2.5-pro', vision: true },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', provider: 'google', apiModel: 'gemini-2.5-flash', vision: true },
  { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite', provider: 'google', apiModel: 'gemini-2.5-flash-lite', vision: true },
];

interface PostChatAssistantProps {
  botId: string;
  platforms: string[];
  productId?: string;
  onUseContent: (content: string) => void;
  onClose: () => void;
}

// ── Helpers ──

function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function parseDataUrl(dataUrl: string): { data: string; mediaType: string } | null {
  const match = dataUrl.match(/^data:(image\/(?:jpeg|png|gif|webp));base64,(.+)$/);
  if (!match) return null;
  return { mediaType: match[1], data: match[2] };
}

/**
 * Extract the actual post content from AI response.
 * Looks for text between [POST] and [/POST] markers.
 * Falls back to a heuristic strip of common intro/outro, then full text.
 */
function extractPostContent(text: string): string {
  // Try to extract between [POST] and [/POST] markers
  const markerMatch = text.match(/\[POST\]\s*\n?([\s\S]*?)\n?\s*\[\/POST\]/);
  if (markerMatch && markerMatch[1].trim()) {
    return markerMatch[1].trim();
  }

  // Fallback: try to extract between --- delimiters (common AI pattern)
  const dashMatch = text.match(/---\s*\n([\s\S]*?)\n\s*---/);
  if (dashMatch && dashMatch[1].trim().length > 20) {
    return dashMatch[1].trim();
  }

  // Final fallback: return full text
  return text.trim();
}

/**
 * Strip [POST] / [/POST] markers from displayed text so user doesn't see them.
 */
function stripPostMarkers(text: string): string {
  return text
    .replace(/\[POST\]\s*\n?/g, '')
    .replace(/\n?\s*\[\/POST\]/g, '');
}

// ── Component ──

export function PostChatAssistant({ botId, platforms, productId, onUseContent, onClose }: PostChatAssistantProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Hi! I\'m your AI marketing assistant. Tell me what you want to post about and I\'ll help you create engaging content. You can also upload images for me to analyze.',
    },
  ]);
  const [input, setInput] = useState('');
  const [pendingImages, setPendingImages] = useState<ChatImage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>(AI_MODELS[0].id);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [creditCostPerMsg, setCreditCostPerMsg] = useState<number | null>(null);
  const [useStrategyOverride, setUseStrategyOverride] = useState(false);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Track whether user has manually scrolled up
  const userScrolledUpRef = useRef(false);
  const lastScrollTopRef = useRef(0);

  // Scroll to bottom of chat container only (not the page)
  const scrollToBottom = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, []);

  // Auto-scroll only if user hasn't scrolled up
  useEffect(() => {
    if (!userScrolledUpRef.current) {
      scrollToBottom();
    }
  }, [messages, scrollToBottom]);

  // Detect user scrolling up in the chat container
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 60;
    // User scrolled up if scroll position decreased and not at bottom
    if (scrollTop < lastScrollTopRef.current && !isAtBottom) {
      userScrolledUpRef.current = true;
    }
    // Reset when user scrolls back to bottom
    if (isAtBottom) {
      userScrolledUpRef.current = false;
    }
    lastScrollTopRef.current = scrollTop;
  }, []);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close model dropdown when clicking outside
  useEffect(() => {
    if (!showModelDropdown) return;
    const handleClickOutside = () => setShowModelDropdown(false);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showModelDropdown]);

  // ── Image upload ──

  const handleImageUpload = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 5 * 1024 * 1024) {
        setError(`${file.name} is too large (max 5MB). Resize and try again.`);
        continue;
      }
      if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
        setError(`${file.name}: Unsupported format. Use JPEG, PNG, GIF, or WebP.`);
        continue;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const parsed = parseDataUrl(dataUrl);
        if (!parsed) return;

        setPendingImages(prev => [...prev, {
          data: parsed.data,
          mediaType: parsed.mediaType,
          preview: dataUrl,
          name: file.name,
        }]);
      };
      reader.readAsDataURL(file);
    }

    // Reset file input
    if (e.target) e.target.value = '';
  }, []);

  const removePendingImage = useCallback((index: number) => {
    setPendingImages(prev => prev.filter((_, i) => i !== index));
  }, []);

  // ── Send message ──

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text && pendingImages.length === 0) return;
    if (isSending) return;

    setError(null);
    setIsSending(true);

    // Create user message
    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: text,
      images: pendingImages.length > 0 ? [...pendingImages] : undefined,
    };

    // Create placeholder for assistant response
    const assistantMessage: ChatMessage = {
      id: generateId(),
      role: 'assistant',
      content: '',
      isStreaming: true,
    };

    // Update UI immediately
    setMessages(prev => [...prev, userMessage, assistantMessage]);
    setInput('');
    setPendingImages([]);

    // Build messages for API (exclude welcome message and streaming flag)
    const apiMessages = [...messages.filter(m => m.id !== 'welcome'), userMessage].map(m => ({
      role: m.role,
      content: m.content,
      images: m.images?.map(img => ({ data: img.data, mediaType: img.mediaType })),
    }));

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // Find the selected model config
      const modelConfig = AI_MODELS.find(m => m.id === selectedModel) || AI_MODELS[0];

      const res = await fetch('/api/chat/post-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botId,
          messages: apiMessages,
          platforms,
          productId: productId || undefined,
          model: modelConfig.apiModel,
          provider: modelConfig.provider,
          useStrategyOverride,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const errMsg = data?.error || `Error (HTTP ${res.status})`;
        setMessages(prev => prev.map(m =>
          m.id === assistantMessage.id
            ? { ...m, content: '', isStreaming: false }
            : m
        ));
        // Remove the empty assistant message
        setMessages(prev => prev.filter(m => m.id !== assistantMessage.id));
        setError(errMsg);
        setIsSending(false);
        return;
      }

      // Read streaming response
      const reader = res.body?.getReader();
      if (!reader) {
        setError('No response from AI service.');
        setIsSending(false);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedText = '';

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
            const event = JSON.parse(jsonStr);

            if (event.text) {
              accumulatedText += event.text;
              setMessages(prev => prev.map(m =>
                m.id === assistantMessage.id
                  ? { ...m, content: accumulatedText }
                  : m
              ));
            }

            if (event.error) {
              setError(event.error);
            }

            if (event.done) {
              // Update credit cost from actual API response
              if (typeof event.creditCost === 'number') {
                setCreditCostPerMsg(event.creditCost);
              }
              setMessages(prev => prev.map(m =>
                m.id === assistantMessage.id
                  ? { ...m, content: accumulatedText, isStreaming: false }
                  : m
              ));
            }
          } catch {
            // Skip unparseable lines
          }
        }
      }

      // Ensure streaming is marked complete
      setMessages(prev => prev.map(m =>
        m.id === assistantMessage.id
          ? { ...m, content: accumulatedText || m.content, isStreaming: false }
          : m
      ));
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // User cancelled
        setMessages(prev => prev.filter(m => m.id !== assistantMessage.id));
      } else {
        setError('Network error. Check your connection and try again.');
        setMessages(prev => prev.filter(m => m.id !== assistantMessage.id));
      }
    } finally {
      setIsSending(false);
      abortRef.current = null;
      inputRef.current?.focus();
    }
  }, [input, pendingImages, isSending, messages, botId, platforms, selectedModel]);

  // ── Cancel generation ──

  const cancelGeneration = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  // ── Handle Enter key ──

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  // ── New conversation ──

  const newConversation = useCallback(() => {
    if (isSending) return;
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: 'Starting a fresh conversation. What would you like to post about?',
    }]);
    setInput('');
    setPendingImages([]);
    setError(null);
  }, [isSending]);

  // ── Render ──

  return (
    <div className="flex flex-col h-[500px] rounded-lg border border-purple-200 bg-purple-50/30 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-purple-200 bg-purple-50">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-purple-600" />
          <span className="font-medium text-sm text-purple-900">AI Post Assistant</span>
          <span className="text-[10px] text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded">
            <Coins className="h-2.5 w-2.5 inline mr-0.5" />
            {creditCostPerMsg !== null ? `${creditCostPerMsg} credits/msg` : '~2 credits/msg'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={newConversation}
            className="text-xs text-purple-600 hover:text-purple-800 px-2 py-1 rounded hover:bg-purple-100 transition-colors"
            disabled={isSending}
          >
            New chat
          </button>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-purple-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
      >
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                msg.role === 'user'
                  ? 'bg-purple-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-900'
              }`}
            >
              {/* User images */}
              {msg.images && msg.images.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {msg.images.map((img, i) => (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      key={i}
                      src={img.preview}
                      alt={img.name}
                      className="h-16 w-16 object-cover rounded"
                    />
                  ))}
                </div>
              )}

              {/* Message text */}
              {msg.content ? (
                <div className="whitespace-pre-wrap break-words">
                  {msg.role === 'assistant' ? stripPostMarkers(msg.content) : msg.content}
                </div>
              ) : msg.isStreaming ? (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span className="text-xs">Thinking...</span>
                </div>
              ) : null}

              {/* Streaming indicator */}
              {msg.isStreaming && msg.content && (
                <span className="inline-block w-1.5 h-4 bg-purple-400 animate-pulse ml-0.5 align-middle" />
              )}

              {/* "Use as post content" button for assistant messages */}
              {msg.role === 'assistant' && msg.content && !msg.isStreaming && msg.id !== 'welcome' && (
                <div className="mt-2 pt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => onUseContent(extractPostContent(msg.content))}
                    className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 transition-colors"
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    Use as post content
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mb-2 px-3 py-2 rounded-md bg-destructive/10 text-destructive text-xs flex items-center gap-1.5">
          <AlertCircle className="h-3 w-3 shrink-0" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError(null)} className="hover:text-destructive/80">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Pending images preview */}
      {pendingImages.length > 0 && (
        <div className="mx-4 mb-2 flex flex-wrap gap-1.5">
          {pendingImages.map((img, i) => (
            <div key={i} className="relative group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.preview}
                alt={img.name}
                className="h-12 w-12 object-cover rounded border border-purple-200"
              />
              <button
                type="button"
                onClick={() => removePendingImage(i)}
                className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-purple-200 bg-white p-3">
        <div className="flex items-end gap-2">
          {/* Image upload button */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            onChange={handleImageUpload}
            multiple
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="shrink-0 p-2 rounded-md text-muted-foreground hover:text-purple-600 hover:bg-purple-50 transition-colors"
            title="Upload image (JPEG, PNG, GIF, WebP — max 5MB)"
            disabled={isSending}
          >
            <ImageIcon className="h-4 w-4" />
          </button>

          {/* Text input */}
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe what you want to post about..."
            className="flex-1 min-h-[38px] max-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            rows={1}
            disabled={isSending}
          />

          {/* Send / Cancel button */}
          {isSending ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={cancelGeneration}
              className="shrink-0 h-9 px-3"
            >
              <X className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={sendMessage}
              disabled={!input.trim() && pendingImages.length === 0}
              className="shrink-0 h-9 px-3 gap-1"
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        <div className="flex items-center justify-between mt-1.5 gap-2">
          <label className="flex items-center gap-1.5 cursor-pointer shrink-0" title="When enabled, AI uses your per-platform content strategy (custom content types, tones, hashtags) from Content Strategy settings">
            <input
              type="checkbox"
              checked={useStrategyOverride}
              onChange={(e) => setUseStrategyOverride(e.target.checked)}
              className="h-3.5 w-3.5 rounded"
              disabled={isSending}
            />
            <span className="text-[12px] text-muted-foreground whitespace-nowrap">Use platform strategy</span>
          </label>
          {/* Model selector */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowModelDropdown(!showModelDropdown)}
              className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-muted font-medium"
              disabled={isSending}
            >
              {AI_MODELS.find(m => m.id === selectedModel)?.label || 'Select model'}
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {showModelDropdown && (
              <div className="absolute bottom-full right-0 mb-1 w-56 bg-white rounded-md border shadow-lg z-50 py-1">
                {(['anthropic', 'openai', 'google'] as const).map((provider) => {
                  const providerModels = AI_MODELS.filter(m => m.provider === provider);
                  const providerLabel = provider === 'anthropic' ? 'Anthropic' : provider === 'openai' ? 'OpenAI' : 'Google';
                  return (
                    <div key={provider}>
                      <div className="px-3 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                        {providerLabel}
                      </div>
                      {providerModels.map((model) => (
                        <button
                          key={model.id}
                          type="button"
                          onClick={() => {
                            setSelectedModel(model.id);
                            setShowModelDropdown(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors ${
                            selectedModel === model.id ? 'text-purple-700 font-medium bg-purple-50' : 'text-gray-700'
                          }`}
                        >
                          {model.label}
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
