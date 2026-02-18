'use client';

import { useState, useCallback, useRef, useEffect, type ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Loader2, Sparkles, ImageIcon, Film, CheckCircle, AlertCircle,
  XCircle, Upload, X, ChevronDown, ChevronUp, Settings2, Zap,
} from 'lucide-react';
import type { AIModel, ModelParam } from '@/lib/ai-models';
import {
  IMAGE_MODELS, VIDEO_MODELS,
  getDefaultImageModel, getDefaultVideoModel,
  getDefaultParams,
} from '@/lib/ai-models';

// ── Types ──

interface GenerateResult {
  type: 'image' | 'video';
  status: 'generating' | 'success' | 'error';
  error?: string;
  mediaId?: string;
  mediaUrl?: string;
  prompt?: string;
  httpStatus?: number;
  progress?: string;
  predictionId?: string;
  modelName?: string;
}

interface PendingMedia {
  id: string;
  replicatePredictionId: string;
  generationStatus: string;
  aiDescription: string | null;
  createdAt: string;
}

const PLATFORMS = [
  { value: 'INSTAGRAM', label: 'Instagram' },
  { value: 'FACEBOOK', label: 'Facebook' },
  { value: 'TWITTER', label: 'X / Twitter' },
  { value: 'LINKEDIN', label: 'LinkedIn' },
  { value: 'TIKTOK', label: 'TikTok' },
  { value: 'YOUTUBE', label: 'YouTube' },
  { value: 'PINTEREST', label: 'Pinterest' },
  { value: 'THREADS', label: 'Threads' },
  { value: 'MASTODON', label: 'Mastodon' },
  { value: 'BLUESKY', label: 'Bluesky' },
  { value: 'TELEGRAM', label: 'Telegram' },
  { value: 'DISCORD', label: 'Discord' },
  { value: 'REDDIT', label: 'Reddit' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'DEVTO', label: 'Dev.to' },
  { value: 'NOSTR', label: 'Nostr' },
];

const POLL_INTERVAL = 5000;
const MAX_POLLS = 120; // 10 minutes max for longer video models

// ── Parameter Control Component ──

function ParamControl({
  param,
  value,
  onChange,
}: {
  param: ModelParam;
  value: unknown;
  onChange: (key: string, value: unknown) => void;
}) {
  if (param.type === 'select' && param.options) {
    return (
      <div className="space-y-1">
        <label className="text-xs font-medium text-foreground">{param.label}</label>
        <select
          value={String(value ?? param.default ?? '')}
          onChange={e => onChange(param.key, e.target.value)}
          className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
        >
          {param.options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <p className="text-[10px] text-muted-foreground">{param.description}</p>
      </div>
    );
  }

  if (param.type === 'number') {
    const numValue = value !== undefined && value !== '' ? Number(value) : '';
    const hasRange = param.min !== undefined && param.max !== undefined;

    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-foreground">{param.label}</label>
          {numValue !== '' && <span className="text-[10px] text-muted-foreground font-mono">{numValue}</span>}
        </div>
        {hasRange && (param.max! - param.min!) <= 200 ? (
          <input
            type="range"
            min={param.min}
            max={param.max}
            step={param.step || 1}
            value={numValue !== '' ? numValue : Number(param.default ?? param.min ?? 0)}
            onChange={e => onChange(param.key, Number(e.target.value))}
            className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-primary bg-muted"
          />
        ) : (
          <input
            type="number"
            min={param.min}
            max={param.max}
            step={param.step || 1}
            value={numValue !== '' ? String(numValue) : ''}
            onChange={e => onChange(param.key, e.target.value ? Number(e.target.value) : undefined)}
            placeholder={param.default !== undefined ? `Default: ${param.default}` : 'Optional'}
            className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
          />
        )}
        <p className="text-[10px] text-muted-foreground">{param.description}</p>
      </div>
    );
  }

  if (param.type === 'boolean') {
    const checked = value !== undefined ? Boolean(value) : Boolean(param.default);
    return (
      <div className="space-y-1">
        <label className="flex items-center gap-2 cursor-pointer group">
          <div className="relative">
            <input
              type="checkbox"
              checked={checked}
              onChange={e => onChange(param.key, e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-8 h-4 bg-muted rounded-full peer-checked:bg-primary transition-colors" />
            <div className="absolute left-0.5 top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4" />
          </div>
          <span className="text-xs font-medium text-foreground">{param.label}</span>
        </label>
        <p className="text-[10px] text-muted-foreground ml-10">{param.description}</p>
      </div>
    );
  }

  if (param.type === 'string') {
    return (
      <div className="space-y-1">
        <label className="text-xs font-medium text-foreground">{param.label}</label>
        <textarea
          value={String(value ?? param.default ?? '')}
          onChange={e => onChange(param.key, e.target.value)}
          placeholder={param.description}
          rows={2}
          className="flex min-h-[50px] w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
        />
      </div>
    );
  }

  return null;
}

// ── Model Selector Card ──

function ModelCard({
  model,
  selected,
  onClick,
}: {
  model: AIModel;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left p-2.5 rounded-lg border transition-all ${
        selected
          ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
          : 'border-input hover:border-primary/40 hover:bg-muted/50'
      }`}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold truncate">{model.name}</span>
            {model.badge && (
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                model.badge === 'Recommended' ? 'bg-emerald-100 text-emerald-700' :
                model.badge === 'Best Quality' ? 'bg-purple-100 text-purple-700' :
                model.badge === 'Fastest' ? 'bg-yellow-100 text-yellow-700' :
                model.badge === 'Most Control' ? 'bg-orange-100 text-orange-700' :
                model.badge === 'Design' ? 'bg-pink-100 text-pink-700' :
                model.badge === 'Best Text' ? 'bg-cyan-100 text-cyan-700' :
                model.badge === 'Classic' ? 'bg-gray-100 text-gray-700' :
                model.badge === 'Longest' ? 'bg-red-100 text-red-700' :
                model.badge === 'Flexible' ? 'bg-orange-100 text-orange-700' :
                model.badge === 'OpenAI' ? 'bg-emerald-100 text-emerald-700' :
                model.badge === 'Versatile' ? 'bg-cyan-100 text-cyan-700' :
                model.badge === 'Audio' ? 'bg-amber-100 text-amber-700' :
                model.badge === 'Premium + Audio' ? 'bg-amber-100 text-amber-700' :
                model.badge === 'Flagship + Audio' ? 'bg-amber-100 text-amber-700' :
                model.badge === 'Audio + HD' ? 'bg-amber-100 text-amber-700' :
                model.badge === 'MiniMax Latest' ? 'bg-emerald-100 text-emerald-700' :
                model.badge === 'Premium' ? 'bg-purple-100 text-purple-700' :
                model.badge === 'Cinematic' ? 'bg-violet-100 text-violet-700' :
                model.badge === 'Image to Video' ? 'bg-teal-100 text-teal-700' :
                model.badge === 'Reliable' ? 'bg-blue-100 text-blue-700' :
                model.badge === 'I2V' ? 'bg-teal-100 text-teal-700' :
                model.badge === 'Stable' ? 'bg-blue-100 text-blue-700' :
                'bg-gray-100 text-gray-700'
              }`}>
                {model.badge}
              </span>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground/70 font-medium">{model.brand}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{model.description}</p>
        </div>
        <div className="text-right shrink-0">
          <span className="text-[10px] font-bold text-primary">{model.creditCost} cr</span>
          <p className="text-[9px] text-muted-foreground">{model.estimatedTime}</p>
        </div>
      </div>
    </button>
  );
}

// ── Main Form ──

export function MediaGenerateForm({ botId }: { botId: string }) {
  // Tab state
  const [activeTab, setActiveTab] = useState<'image' | 'video'>('image');

  // Model selection
  const [selectedImageModel, setSelectedImageModel] = useState<AIModel>(getDefaultImageModel());
  const [selectedVideoModel, setSelectedVideoModel] = useState<AIModel>(getDefaultVideoModel());

  // Params state per model
  const [imageParams, setImageParams] = useState<Record<string, unknown>>(getDefaultParams(getDefaultImageModel()));
  const [videoParams, setVideoParams] = useState<Record<string, unknown>>(getDefaultParams(getDefaultVideoModel()));

  // Prompts
  const [imagePrompt, setImagePrompt] = useState('');
  const [imageNegativePrompt, setImageNegativePrompt] = useState('');
  const [videoPrompt, setVideoPrompt] = useState('');
  const [videoNegativePrompt, setVideoNegativePrompt] = useState('');

  // Platform
  const [imagePlatform, setImagePlatform] = useState('INSTAGRAM');
  const [videoPlatform, setVideoPlatform] = useState('TIKTOK');

  // Reference images
  const [imageRef, setImageRef] = useState<string | null>(null);
  const [imageRefName, setImageRefName] = useState('');
  const [videoRef, setVideoRef] = useState<string | null>(null);
  const [videoRefName, setVideoRefName] = useState('');
  const imageFileRef = useRef<HTMLInputElement>(null);
  const videoFileRef = useRef<HTMLInputElement>(null);

  // Advanced settings
  const [showImageAdvanced, setShowImageAdvanced] = useState(false);
  const [showVideoAdvanced, setShowVideoAdvanced] = useState(false);

  // Results
  const [results, setResults] = useState<GenerateResult[]>([]);
  const abortRefs = useRef<Map<string, AbortController>>(new Map());
  const hasResumed = useRef(false);

  // When model changes, reset params to new defaults
  const handleImageModelChange = useCallback((model: AIModel) => {
    setSelectedImageModel(model);
    setImageParams(getDefaultParams(model));
    setShowImageAdvanced(false);
  }, []);

  const handleVideoModelChange = useCallback((model: AIModel) => {
    setSelectedVideoModel(model);
    setVideoParams(getDefaultParams(model));
    setShowVideoAdvanced(false);
  }, []);

  const updateImageParam = useCallback((key: string, value: unknown) => {
    setImageParams(prev => ({ ...prev, [key]: value }));
  }, []);

  const updateVideoParam = useCallback((key: string, value: unknown) => {
    setVideoParams(prev => ({ ...prev, [key]: value }));
  }, []);

  // Resume polling for pending generations on mount
  useEffect(() => {
    if (hasResumed.current) return;
    hasResumed.current = true;

    async function resumePending() {
      try {
        const res = await fetch(`/api/generate/video?botId=${encodeURIComponent(botId)}&pending=true`);
        if (!res.ok) return;
        const data = await res.json();
        const pending: PendingMedia[] = data.pending || [];

        for (const p of pending) {
          if (!p.replicatePredictionId) continue;

          const result: GenerateResult = {
            type: 'video',
            status: 'generating',
            progress: 'Resuming video generation...',
            predictionId: p.replicatePredictionId,
            prompt: p.aiDescription || undefined,
          };
          setResults(prev => [result, ...prev]);
          pollPrediction(p.replicatePredictionId, pending.indexOf(p));
        }
      } catch {
        // Silently ignore
      }
    }

    resumePending();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botId]);

  // Poll a video prediction until completion
  const pollPrediction = useCallback(async (predictionId: string, resultIndex?: number) => {
    const controller = new AbortController();
    abortRefs.current.set(predictionId, controller);
    const idx = resultIndex ?? 0;

    for (let poll = 0; poll < MAX_POLLS; poll++) {
      await new Promise(r => setTimeout(r, POLL_INTERVAL));
      if (controller.signal.aborted) return;

      try {
        const pollRes = await fetch(
          `/api/generate/video?predictionId=${encodeURIComponent(predictionId)}`,
          { signal: controller.signal },
        );
        const pollData = await pollRes.json().catch(() => null);
        if (!pollData) continue;

        if (pollData.status === 'succeeded') {
          setResults(prev => prev.map((r, i) => {
            if (r.predictionId === predictionId || (i === idx && r.status === 'generating')) {
              return { ...r, status: 'success', mediaId: pollData.id, mediaUrl: pollData.url, prompt: pollData.prompt };
            }
            return r;
          }));
          abortRefs.current.delete(predictionId);
          return;
        }

        if (pollData.status === 'failed') {
          setResults(prev => prev.map((r, i) => {
            if (r.predictionId === predictionId || (i === idx && r.status === 'generating')) {
              return { ...r, status: 'error', error: pollData.error || 'Video generation failed.' };
            }
            return r;
          }));
          abortRefs.current.delete(predictionId);
          return;
        }

        if (pollData.status === 'cancelled') {
          setResults(prev => prev.filter(r => r.predictionId !== predictionId));
          abortRefs.current.delete(predictionId);
          return;
        }

        const elapsed = Math.round((poll + 1) * POLL_INTERVAL / 1000);
        setResults(prev => prev.map((r, i) => {
          if (r.predictionId === predictionId || (i === idx && r.status === 'generating')) {
            return { ...r, progress: pollData.progress || `Generating video... (${elapsed}s)` };
          }
          return r;
        }));
      } catch (e) {
        if (controller.signal.aborted) return;
        continue;
      }
    }

    setResults(prev => prev.map(r => {
      if (r.predictionId === predictionId && r.status === 'generating') {
        return { ...r, status: 'error', error: 'Video generation timed out after 10 minutes. Check the Media Library — it may still complete.' };
      }
      return r;
    }));
    abortRefs.current.delete(predictionId);
  }, []);

  // Handle reference file selection
  const handleRefFile = useCallback((e: ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert('Reference file must be under 10MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      if (type === 'image') {
        setImageRef(dataUrl);
        setImageRefName(file.name);
      } else {
        setVideoRef(dataUrl);
        setVideoRefName(file.name);
      }
    };
    reader.readAsDataURL(file);
  }, []);

  // Generate Image
  const generateImage = useCallback(async () => {
    const result: GenerateResult = {
      type: 'image',
      status: 'generating',
      modelName: selectedImageModel.name,
    };
    setResults(prev => [result, ...prev]);

    try {
      const res = await fetch('/api/generate/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botId,
          platform: imagePlatform,
          prompt: imagePrompt || undefined,
          referenceImage: imageRef || undefined,
          modelId: selectedImageModel.id,
          params: imageParams,
          negativePrompt: imageNegativePrompt || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const error = data?.error || `Generation failed (HTTP ${res.status})`;
        setResults(prev => prev.map((r, i) => i === 0 ? { ...r, status: 'error', error, httpStatus: res.status } : r));
        return;
      }

      const data = await res.json();
      setResults(prev => prev.map((r, i) => i === 0 ? {
        ...r,
        status: 'success',
        mediaId: data.id,
        mediaUrl: data.url,
        prompt: data.prompt,
        modelName: data.model,
      } : r));
    } catch {
      setResults(prev => prev.map((r, i) => i === 0 ? {
        ...r, status: 'error', error: 'Network error — check your internet connection.',
      } : r));
    }
  }, [botId, imagePlatform, imagePrompt, imageRef, selectedImageModel, imageParams, imageNegativePrompt]);

  // Generate Video
  const generateVideo = useCallback(async () => {
    const result: GenerateResult = {
      type: 'video',
      status: 'generating',
      progress: 'Starting video generation...',
      modelName: selectedVideoModel.name,
    };
    setResults(prev => [result, ...prev]);

    try {
      const res = await fetch('/api/generate/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botId,
          platform: videoPlatform,
          prompt: videoPrompt || undefined,
          referenceImage: videoRef || undefined,
          modelId: selectedVideoModel.id,
          params: videoParams,
          negativePrompt: videoNegativePrompt || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const error = data?.error || `Failed to start video generation (HTTP ${res.status})`;
        setResults(prev => prev.map((r, i) => i === 0 ? { ...r, status: 'error', error, httpStatus: res.status } : r));
        return;
      }

      const data = await res.json();

      if (data.status === 'succeeded') {
        setResults(prev => prev.map((r, i) => i === 0 ? {
          ...r, status: 'success', mediaId: data.id, mediaUrl: data.url, prompt: data.prompt, modelName: data.model,
        } : r));
        return;
      }

      const predictionId = data.predictionId;
      if (!predictionId) {
        setResults(prev => prev.map((r, i) => i === 0 ? {
          ...r, status: 'error', error: 'Server did not return a prediction ID.',
        } : r));
        return;
      }

      setResults(prev => prev.map((r, i) => i === 0 ? {
        ...r,
        predictionId,
        progress: `${selectedVideoModel.name}: Video generation started. ${selectedVideoModel.estimatedTime}...`,
      } : r));

      pollPrediction(predictionId, 0);
    } catch {
      setResults(prev => prev.map((r, i) => i === 0 ? {
        ...r, status: 'error', error: 'Network error — check your internet connection.',
      } : r));
    }
  }, [botId, videoPlatform, videoPrompt, videoRef, selectedVideoModel, videoParams, videoNegativePrompt, pollPrediction]);

  const cancelGeneration = useCallback(async (predictionId: string) => {
    const controller = abortRefs.current.get(predictionId);
    if (controller) controller.abort();
    abortRefs.current.delete(predictionId);
    try {
      await fetch(`/api/generate/video?predictionId=${encodeURIComponent(predictionId)}`, { method: 'DELETE' });
    } catch { /* ignore */ }
    setResults(prev => prev.filter(r => r.predictionId !== predictionId));
  }, []);

  const clearResults = () => {
    Array.from(abortRefs.current.values()).forEach(c => c.abort());
    abortRefs.current.clear();
    setResults(prev => prev.filter(r => r.status === 'generating'));
  };

  const isGeneratingImage = results.some(r => r.type === 'image' && r.status === 'generating');
  const isGeneratingVideo = results.some(r => r.type === 'video' && r.status === 'generating');
  const missingRequiredImage = activeTab === 'video'
    && selectedVideoModel.requiresReferenceImage
    && !videoRef;

  const currentModel = activeTab === 'image' ? selectedImageModel : selectedVideoModel;
  const models = activeTab === 'image' ? IMAGE_MODELS : VIDEO_MODELS;

  const basicParams = currentModel.params.filter(p => p.group === 'basic');
  const advancedParams = currentModel.params.filter(p => p.group === 'advanced');
  const showAdvanced = activeTab === 'image' ? showImageAdvanced : showVideoAdvanced;
  const toggleAdvanced = activeTab === 'image'
    ? () => setShowImageAdvanced(v => !v)
    : () => setShowVideoAdvanced(v => !v);

  return (
    <div className="space-y-4">
      {/* Tab Switcher */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg">
        <button
          onClick={() => setActiveTab('image')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-xs font-medium transition-all ${
            activeTab === 'image'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <ImageIcon className="h-3.5 w-3.5" />
          Generate Image
        </button>
        <button
          onClick={() => setActiveTab('video')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-xs font-medium transition-all ${
            activeTab === 'video'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Film className="h-3.5 w-3.5" />
          Generate Video
        </button>
      </div>

      {/* Model Selector */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Zap className="h-3.5 w-3.5 text-primary" />
          <Label className="text-xs font-semibold">
            Choose AI Model
          </Label>
          <span className="text-[10px] text-muted-foreground ml-auto">
            {currentModel.creditCost} credits per generation
          </span>
        </div>
        <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
          {models.map(model => (
            <ModelCard
              key={model.id}
              model={model}
              selected={currentModel.id === model.id}
              onClick={() => activeTab === 'image'
                ? handleImageModelChange(model)
                : handleVideoModelChange(model)
              }
            />
          ))}
        </div>
      </div>

      {/* Platform + Prompt */}
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Target Platform</Label>
          <select
            value={activeTab === 'image' ? imagePlatform : videoPlatform}
            onChange={e => activeTab === 'image'
              ? setImagePlatform(e.target.value)
              : setVideoPlatform(e.target.value)
            }
            className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
          >
            {PLATFORMS.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Prompt</Label>
          <textarea
            placeholder={activeTab === 'image'
              ? 'Describe the image you want. Be specific about subjects, style, colors, composition. Leave empty to use Creative Style preferences.'
              : 'Describe the video you want. Be specific about action, scene, movement. Leave empty to use Creative Style preferences.'
            }
            value={activeTab === 'image' ? imagePrompt : videoPrompt}
            onChange={e => activeTab === 'image'
              ? setImagePrompt(e.target.value)
              : setVideoPrompt(e.target.value)
            }
            rows={3}
            className="flex min-h-[70px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-y"
          />
        </div>

        {/* Negative Prompt (if model supports it) */}
        {currentModel.supportsNegativePrompt && (
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Negative Prompt</Label>
            <textarea
              placeholder="What to avoid in the generation (e.g. blurry, low quality, distorted faces...)"
              value={activeTab === 'image' ? imageNegativePrompt : videoNegativePrompt}
              onChange={e => activeTab === 'image'
                ? setImageNegativePrompt(e.target.value)
                : setVideoNegativePrompt(e.target.value)
              }
              rows={2}
              className="flex min-h-[50px] w-full rounded-md border border-input bg-background px-3 py-2 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-y"
            />
          </div>
        )}

        {/* Reference Image Upload */}
        {currentModel.supportsReferenceImage && (
          <div>
            <input
              ref={activeTab === 'image' ? imageFileRef : videoFileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={e => handleRefFile(e, activeTab)}
              className="hidden"
            />
            {(activeTab === 'image' ? imageRef : videoRef) ? (
              <div className="flex items-center gap-2 p-2 rounded-md border border-input bg-muted/50 text-xs">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={(activeTab === 'image' ? imageRef : videoRef) || ''}
                  alt="Reference"
                  className="h-10 w-10 object-cover rounded"
                />
                <span className="flex-1 truncate">
                  {activeTab === 'image' ? imageRefName : videoRefName}
                </span>
                <button
                  onClick={() => {
                    if (activeTab === 'image') {
                      setImageRef(null);
                      setImageRefName('');
                    } else {
                      setVideoRef(null);
                      setVideoRefName('');
                    }
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => (activeTab === 'image' ? imageFileRef : videoFileRef).current?.click()}
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Upload className="h-3 w-3" />
                {activeTab === 'image'
                  ? `Add reference image (${currentModel.referenceImageKey === 'image_prompt' ? 'style guide' : 'input image'})`
                  : `Add reference image (${currentModel.referenceImageKey === 'first_frame_image' ? 'first frame' : 'input'})`
                }
              </button>
            )}
          </div>
        )}
      </div>

      {/* Basic Parameters */}
      {basicParams.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
            <Label className="text-xs font-semibold">Model Settings</Label>
          </div>
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
            {basicParams.map(param => (
              <ParamControl
                key={param.key}
                param={param}
                value={activeTab === 'image' ? imageParams[param.key] : videoParams[param.key]}
                onChange={activeTab === 'image' ? updateImageParam : updateVideoParam}
              />
            ))}
          </div>
        </div>
      )}

      {/* Advanced Parameters (collapsible) */}
      {advancedParams.length > 0 && (
        <div className="space-y-2">
          <button
            onClick={toggleAdvanced}
            className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {showAdvanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            Advanced Settings ({advancedParams.length})
          </button>
          {showAdvanced && (
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 pl-1 border-l-2 border-muted ml-1">
              {advancedParams.map(param => (
                <ParamControl
                  key={param.key}
                  param={param}
                  value={activeTab === 'image' ? imageParams[param.key] : videoParams[param.key]}
                  onChange={activeTab === 'image' ? updateImageParam : updateVideoParam}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Required image warning */}
      {missingRequiredImage && (
        <div className="rounded-md border border-orange-200 bg-orange-50 p-3 text-xs text-orange-800">
          <p className="font-medium">{currentModel.name} requires a reference image</p>
          <p className="mt-0.5 text-[11px]">This is an image-to-video model. Upload an image above before generating.</p>
        </div>
      )}

      {/* Generate Button */}
      <Button
        onClick={activeTab === 'image' ? generateImage : generateVideo}
        disabled={(activeTab === 'image' ? isGeneratingImage : isGeneratingVideo) || missingRequiredImage}
        className="w-full gap-2"
        size="sm"
      >
        {(activeTab === 'image' ? isGeneratingImage : isGeneratingVideo) ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Generating with {currentModel.name}...
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            Generate {activeTab === 'image' ? 'Image' : 'Video'} with {currentModel.name}
            <span className="text-[10px] opacity-80">({currentModel.creditCost} credits)</span>
          </>
        )}
      </Button>

      {/* Generation Results */}
      {results.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Generation Results</Label>
            {results.some(r => r.status !== 'generating') && (
              <button onClick={clearResults} className="text-xs text-muted-foreground hover:text-foreground">
                Clear completed
              </button>
            )}
          </div>
          {results.map((r, i) => (
            <div
              key={r.predictionId || `result-${i}`}
              className={`p-3 rounded-lg border text-sm ${
                r.status === 'error' ? 'bg-destructive/5 border-destructive/20' :
                r.status === 'success' ? 'bg-green-50 border-green-200' :
                'bg-muted/50'
              }`}
            >
              <div className="flex items-start gap-3">
                {r.type === 'image' ? (
                  <ImageIcon className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                ) : (
                  <Film className="h-4 w-4 text-violet-500 shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium">
                    {r.modelName ? `${r.modelName} — ` : ''}{r.type === 'image' ? 'Image' : 'Video'}
                    {r.status === 'generating' && ' — in progress...'}
                    {r.status === 'success' && ' — completed!'}
                  </p>

                  {r.status === 'generating' && r.progress && (
                    <p className="text-xs text-muted-foreground mt-1">{r.progress}</p>
                  )}

                  {r.error && (
                    <div className="mt-1.5 space-y-1.5">
                      <p className="text-xs text-destructive break-words whitespace-pre-wrap">{r.error}</p>
                      {r.httpStatus === 503 && (
                        <div className="rounded border border-orange-200 bg-orange-50 p-2 text-[11px] text-orange-800 space-y-1">
                          <p className="font-medium">Setup required:</p>
                          <ol className="list-decimal list-inside space-y-0.5">
                            <li>Get an API token from the provider mentioned above</li>
                            <li>Add it to your <code className="bg-orange-100 px-1 rounded">.env</code> file</li>
                            <li>Restart: <code className="bg-orange-100 px-1 rounded">pm2 restart grothi</code></li>
                          </ol>
                        </div>
                      )}
                      {r.httpStatus === 502 && (
                        <p className="text-[11px] text-orange-700">Check that your API token is valid and billing is enabled.</p>
                      )}
                      {r.httpStatus === 402 && (
                        <p className="text-[11px] text-orange-700">
                          <a href="/dashboard/credits/buy" className="underline">Buy more credits</a> to continue.
                        </p>
                      )}
                    </div>
                  )}

                  {r.prompt && r.status === 'success' && (
                    <p className="text-xs text-muted-foreground truncate mt-1">{r.prompt}</p>
                  )}

                  {r.status === 'success' && r.mediaUrl && r.type === 'image' && (
                    <div className="mt-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={r.mediaUrl} alt="Generated" className="rounded-md max-h-40 object-contain" />
                    </div>
                  )}
                </div>
                <div className="shrink-0 flex items-center gap-1">
                  {r.status === 'generating' && r.predictionId && (
                    <button
                      onClick={() => cancelGeneration(r.predictionId!)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                      title="Cancel generation"
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                  )}
                  {r.status === 'generating' && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                  {r.status === 'success' && <CheckCircle className="h-4 w-4 text-green-600" />}
                  {r.status === 'error' && <AlertCircle className="h-4 w-4 text-destructive" />}
                </div>
              </div>
            </div>
          ))}

          {results.some(r => r.status === 'success') && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => window.location.reload()}
            >
              Refresh Library to see generated media
            </Button>
          )}
        </div>
      )}

      {/* Provider info */}
      <p className="text-[10px] text-muted-foreground">
        {activeTab === 'image'
          ? `${IMAGE_MODELS.length} image models available via Replicate. Credits deducted only on success.`
          : `${VIDEO_MODELS.length} video models available. Video generation persists across page refresh.`
        }
      </p>
    </div>
  );
}
