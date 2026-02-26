'use client';

import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sparkles, Send, Loader2, Bot, User, ChevronDown, X, Save, MessageSquare,
} from 'lucide-react';

// ── AI Models (same as post-chat-assistant) ──

interface AIModel {
  id: string;
  label: string;
  provider: 'anthropic' | 'openai' | 'google';
  apiModel: string;
}

const AI_MODELS: AIModel[] = [
  { id: 'opus-4.6', label: 'Claude Opus 4.6', provider: 'anthropic', apiModel: 'claude-opus-4-6' },
  { id: 'sonnet-4.5', label: 'Claude Sonnet 4.5', provider: 'anthropic', apiModel: 'claude-sonnet-4-5-20250929' },
  { id: 'haiku-4.5', label: 'Claude Haiku 4.5', provider: 'anthropic', apiModel: 'claude-haiku-4-5-20251001' },
  { id: 'gpt-4.1', label: 'GPT-4.1', provider: 'openai', apiModel: 'gpt-4.1' },
  { id: 'gpt-4.1-mini', label: 'GPT-4.1 Mini', provider: 'openai', apiModel: 'gpt-4.1-mini' },
  { id: 'gpt-4o', label: 'GPT-4o', provider: 'openai', apiModel: 'gpt-4o' },
  { id: 'o3', label: 'o3', provider: 'openai', apiModel: 'o3' },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', provider: 'google', apiModel: 'gemini-2.5-pro' },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', provider: 'google', apiModel: 'gemini-2.5-flash' },
];

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  google: 'Google',
};

// ── Types ──

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface AutopilotCustomPromptProps {
  botId: string;
  platforms: string[];
  savedPrompt: string;
  onSavePrompt: (prompt: string) => void;
}

export function AutopilotCustomPrompt({ botId, platforms, savedPrompt, onSavePrompt }: AutopilotCustomPromptProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `I'm your Autopilot AI assistant. Tell me exactly what kind of content you want me to create for your social media.

**Your instructions here override all other settings** (strategy, brand, content types). Be specific about:
- What topics to post about
- Writing style and tone
- Types of content (questions, tips, stories, etc.)
- Anything you want or don't want

When you're happy with the plan, click **"Use as Autopilot Prompt"** to save it.`,
    },
  ]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [selectedModel, setSelectedModel] = useState('sonnet-4.5');
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [lastAiContent, setLastAiContent] = useState('');
  const [promptSaved, setPromptSaved] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const modelConfig = AI_MODELS.find(m => m.id === selectedModel) || AI_MODELS[1];

  const scrollToBottom = () => {
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isSending) return;

    const userMessage: Message = { id: `u-${Date.now()}`, role: 'user', content: text };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsSending(true);
    scrollToBottom();

    const assistantId = `a-${Date.now()}`;
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '' }]);

    try {
      const controller = new AbortController();
      abortRef.current = controller;

      const apiMessages = [...messages.filter(m => m.id !== 'welcome'), userMessage].map(m => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch('/api/chat/post-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botId,
          messages: apiMessages,
          platforms,
          model: modelConfig.apiModel,
          provider: modelConfig.provider,
          systemOverride: `You are an Autopilot planning assistant. The user is defining custom instructions for their autonomous social media content plan. Help them craft clear, specific content instructions. Suggest improvements and clarify their vision. Do NOT generate actual social media posts yet — just help refine the content strategy and instructions.

Connected platforms: ${platforms.join(', ')}

When the user is satisfied, summarize their instructions as a clear, concise prompt that the Autopilot AI content generator can follow.`,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'AI request failed' }));
        setMessages(prev => prev.map(m =>
          m.id === assistantId ? { ...m, content: `Error: ${data.error || 'Request failed'}` } : m
        ));
        setIsSending(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.text) {
              fullContent += parsed.text;
              setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, content: fullContent } : m
              ));
              scrollToBottom();
            }
          } catch {
            // Skip unparseable SSE chunks
          }
        }
      }

      setLastAiContent(fullContent);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // User cancelled
      } else {
        setMessages(prev => prev.map(m =>
          m.id === `a-${Date.now()}` ? { ...m, content: 'Error: Connection failed. Try again.' } : m
        ));
      }
    } finally {
      setIsSending(false);
      abortRef.current = null;
    }
  }, [input, isSending, messages, botId, platforms, modelConfig]);

  const handleSaveAsPrompt = (content: string) => {
    onSavePrompt(content);
    setPromptSaved(true);
    setTimeout(() => setPromptSaved(false), 3000);
  };

  return (
    <div className="rounded-lg border bg-card overflow-hidden flex flex-col" style={{ height: '400px' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-violet-600" />
          <span className="text-sm font-semibold">Custom Autopilot Prompt</span>
        </div>
        {savedPrompt && (
          <Badge variant="outline" className="text-[10px] text-green-600 border-green-300">
            Prompt saved
          </Badge>
        )}
      </div>

      {/* Saved prompt preview */}
      {savedPrompt && (
        <div className="px-3 py-2 bg-violet-50 border-b text-xs">
          <p className="font-medium text-violet-800 mb-0.5">Current autopilot instructions:</p>
          <p className="text-violet-700 line-clamp-2">{savedPrompt}</p>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : ''}`}>
            {msg.role === 'assistant' && (
              <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="h-3.5 w-3.5 text-violet-600" />
              </div>
            )}
            <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
              msg.role === 'user'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted'
            }`}>
              <p className="whitespace-pre-wrap leading-relaxed">{msg.content || '...'}</p>
              {msg.role === 'assistant' && msg.content && msg.id !== 'welcome' && (
                <button
                  onClick={() => handleSaveAsPrompt(msg.content)}
                  className="mt-2 flex items-center gap-1 text-[10px] text-violet-600 hover:text-violet-800 transition-colors"
                >
                  <Save className="h-3 w-3" /> Use as Autopilot Prompt
                </button>
              )}
            </div>
            {msg.role === 'user' && (
              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                <User className="h-3.5 w-3.5 text-primary" />
              </div>
            )}
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div className="border-t px-3 py-2 space-y-2">
        {promptSaved && (
          <div className="text-xs text-green-600 flex items-center gap-1">
            <Sparkles className="h-3 w-3" /> Prompt saved! Autopilot will use these instructions.
          </div>
        )}
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder="Describe what kind of content you want..."
              className="w-full min-h-[40px] max-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
              rows={2}
              disabled={isSending}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Button
              size="sm"
              onClick={sendMessage}
              disabled={!input.trim() || isSending}
              className="h-8 w-8 p-0"
            >
              {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        {/* Model selector */}
        <div className="flex items-center justify-between">
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowModelDropdown(!showModelDropdown)}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              disabled={isSending}
            >
              {modelConfig.label}
              <ChevronDown className="h-3 w-3" />
            </button>
            {showModelDropdown && (
              <div className="absolute bottom-full left-0 mb-1 w-48 bg-white rounded-md border shadow-lg z-50 py-1 max-h-[250px] overflow-y-auto">
                {(['anthropic', 'openai', 'google'] as const).map(provider => {
                  const providerModels = AI_MODELS.filter(m => m.provider === provider);
                  if (providerModels.length === 0) return null;
                  return (
                    <div key={provider}>
                      <div className="px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase">
                        {PROVIDER_LABELS[provider]}
                      </div>
                      {providerModels.map(model => (
                        <button
                          key={model.id}
                          onClick={() => { setSelectedModel(model.id); setShowModelDropdown(false); }}
                          className={`w-full text-left px-3 py-1.5 text-xs hover:bg-muted ${
                            selectedModel === model.id ? 'text-violet-700 font-medium bg-violet-50' : ''
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
          <span className="text-[10px] text-muted-foreground">
            5 credits per message
          </span>
        </div>
      </div>
    </div>
  );
}
