'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Scissors, Type, Crop, Play, Pause, RotateCcw,
  Download, Film, CheckCircle2, Loader2, ChevronRight,
  Sparkles, Wand2, Camera, Copy, MessageSquare,
  Palette, SlidersHorizontal, Layers, MonitorPlay,
} from 'lucide-react';
import Link from 'next/link';
import { VIDEO_MODELS, getDefaultVideoModel } from '@/lib/ai-models';
import {
  VIDEO_FILTERS,
  ADJUSTMENT_DEFS,
  FILTER_CATEGORY_LABELS,
  hasActiveAdjustments,
  adjustmentSummary,
  type FilterCategory,
  type AdjustmentValues,
} from '@/lib/studio-filters';

interface VideoMedia {
  id: string;
  filename: string;
  fileSize: number;
  width: number | null;
  height: number | null;
  createdAt: Date;
}

interface StudioEditorProps {
  videos: VideoMedia[];
  botId: string;
  botPageId: string;
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

const TEXT_COLORS = [
  { value: 'white', label: 'White', cls: 'bg-white border border-gray-300' },
  { value: 'yellow', label: 'Yellow', cls: 'bg-yellow-400' },
  { value: 'black', label: 'Black', cls: 'bg-gray-900' },
];

const ASPECT_RATIOS = [
  { value: 'original', label: 'Original', desc: 'Keep as-is', shape: 'w-8 h-5' },
  { value: '9:16', label: '9:16', desc: 'TikTok · Reels', shape: 'w-4 h-8' },
  { value: '1:1', label: '1:1', desc: 'Instagram · FB', shape: 'w-6 h-6' },
  { value: '16:9', label: '16:9', desc: 'YouTube · X', shape: 'w-8 h-5' },
];

const GEN_PLATFORMS = [
  { value: 'TIKTOK', label: 'TikTok' },
  { value: 'INSTAGRAM', label: 'Instagram' },
  { value: 'YOUTUBE', label: 'YouTube' },
  { value: 'FACEBOOK', label: 'Facebook' },
  { value: 'TWITTER', label: 'X / Twitter' },
  { value: 'THREADS', label: 'Threads' },
];

type InspectorTab = 'trim' | 'color' | 'text' | 'ratio' | 'caption';

const INSPECTOR_TABS: { key: InspectorTab; label: string; icon: typeof Scissors }[] = [
  { key: 'trim', label: 'Trim', icon: Scissors },
  { key: 'color', label: 'Color', icon: Palette },
  { key: 'text', label: 'Text', icon: Type },
  { key: 'ratio', label: 'Ratio', icon: Crop },
  { key: 'caption', label: 'AI Caption', icon: MessageSquare },
];

export function StudioEditor({ videos: initialVideos, botId, botPageId }: StudioEditorProps) {
  const [videos, setVideos] = useState<VideoMedia[]>(initialVideos);

  // ── AI Generate section ──
  const [showGenPanel, setShowGenPanel] = useState(false);
  const [genModelId, setGenModelId] = useState(getDefaultVideoModel().id);
  const [genPrompt, setGenPrompt] = useState('');
  const [genPlatform, setGenPlatform] = useState('TIKTOK');
  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState('');
  const [genError, setGenError] = useState<string | null>(null);
  const genPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (genPollRef.current) clearInterval(genPollRef.current);
    };
  }, []);

  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  // Text overlay
  const [textEnabled, setTextEnabled] = useState(false);
  const [textContent, setTextContent] = useState('');
  const [textPosition, setTextPosition] = useState<'top' | 'center' | 'bottom'>('bottom');
  const [textColor, setTextColor] = useState('white');

  // Aspect ratio
  const [aspectRatio, setAspectRatio] = useState('original');

  // Processing
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ mediaId: string; url: string; filename: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Color & Filters
  const [selectedFilterId, setSelectedFilterId] = useState('original');
  const [filterCategory, setFilterCategory] = useState<FilterCategory | 'all'>('all');
  const [adjustments, setAdjustments] = useState<AdjustmentValues>({});

  // AI Caption Generator
  const [captionPlatforms, setCaptionPlatforms] = useState<string[]>(['INSTAGRAM', 'TIKTOK', 'FACEBOOK']);
  const [generatingCaptions, setGeneratingCaptions] = useState(false);
  const [captions, setCaptions] = useState<Record<string, string> | null>(null);
  const [captionError, setCaptionError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Thumbnail Extraction
  const [capturingThumb, setCapturingThumb] = useState(false);
  const [thumbResult, setThumbResult] = useState<{ mediaId: string; url: string; filename: string } | null>(null);
  const [thumbError, setThumbError] = useState<string | null>(null);

  // Video loading & frame capture for filter previews
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoLoadError, setVideoLoadError] = useState<string | null>(null);
  const [videoFrameUrl, setVideoFrameUrl] = useState<string | null>(null);

  // Inspector tab
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('trim');

  const videoRef = useRef<HTMLVideoElement>(null);

  const handleVideoSelect = useCallback((videoId: string) => {
    if (processing) return; // prevent state corruption during processing
    setSelectedVideoId(videoId);
    setTrimStart(0);
    setTrimEnd(0);
    setVideoDuration(0);
    setCurrentTime(0);
    setIsPlaying(false);
    setResult(null);
    setError(null);
    setSelectedFilterId('original');
    setAdjustments({});
    setFilterCategory('all');
    setCaptions(null);
    setCaptionError(null);
    setThumbResult(null);
    setThumbError(null);
    setShowGenPanel(false);
    setVideoLoading(true);
    setVideoLoadError(null);
    setVideoFrameUrl(null);
  }, [processing]);

  const captureVideoFrame = useCallback(() => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = Math.round(160 * (video.videoHeight / video.videoWidth));
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    try {
      setVideoFrameUrl(canvas.toDataURL('image/jpeg', 0.7));
    } catch {
      // SecurityError if cross-origin — fall back to gradient
    }
  }, []);

  const handleVideoLoaded = useCallback(() => {
    if (videoRef.current) {
      const dur = videoRef.current.duration;
      if (isFinite(dur) && dur > 0) {
        setVideoDuration(dur);
        setTrimEnd(dur);
      }
      setVideoLoading(false);
      setVideoLoadError(null);
      // Capture frame for filter swatches after a short delay to ensure frame is decoded
      setTimeout(() => captureVideoFrame(), 200);
    }
  }, [captureVideoFrame]);

  const handleVideoError = useCallback(() => {
    setVideoLoading(false);
    setVideoLoadError('Failed to load video. The file may be corrupted or in an unsupported format.');
  }, []);

  const handleTimeUpdate = useCallback(() => {
    if (!videoRef.current) return;
    const t = videoRef.current.currentTime;
    setCurrentTime(t);
    if (t >= trimEnd) {
      videoRef.current.pause();
      videoRef.current.currentTime = trimStart;
      setIsPlaying(false);
    }
  }, [trimEnd, trimStart]);

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.currentTime = trimStart;
      videoRef.current.play().catch(() => setIsPlaying(false));
      setIsPlaying(true);
    }
  }, [isPlaying, trimStart]);

  const handleTrimStartChange = useCallback((val: number) => {
    const clamped = Math.min(val, trimEnd - 0.5);
    setTrimStart(Math.max(0, clamped));
    if (videoRef.current) videoRef.current.currentTime = Math.max(0, clamped);
  }, [trimEnd]);

  const handleTrimEndChange = useCallback((val: number) => {
    const clamped = Math.max(val, trimStart + 0.5);
    setTrimEnd(Math.min(clamped, videoDuration));
  }, [trimStart, videoDuration]);

  // ── AI generation helpers ──
  const addGeneratedVideo = useCallback((data: { id: string; filename?: string; fileSize?: number }) => {
    const newVideo: VideoMedia = {
      id: data.id,
      filename: data.filename || 'ai-generated.mp4',
      fileSize: data.fileSize || 0,
      width: null,
      height: null,
      createdAt: new Date(),
    };
    setVideos(prev => [newVideo, ...prev]);
    setGenerating(false);
    setGenProgress('');
    setSelectedVideoId(newVideo.id);
    setTrimStart(0);
    setTrimEnd(0);
    setVideoDuration(0);
    setCurrentTime(0);
    setIsPlaying(false);
    setResult(null);
    setError(null);
    setShowGenPanel(false);
    setSelectedFilterId('original');
    setAdjustments({});
    setFilterCategory('all');
    setCaptions(null);
    setCaptionError(null);
    setThumbResult(null);
    setThumbError(null);
    setVideoLoading(true);
    setVideoLoadError(null);
    setVideoFrameUrl(null);
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!genPrompt.trim()) return;
    // Clear any existing poll to prevent race condition with parallel polls
    if (genPollRef.current) {
      clearInterval(genPollRef.current);
      genPollRef.current = null;
    }
    setGenerating(true);
    setGenError(null);
    setGenProgress('Starting video generation...');

    try {
      const res = await fetch('/api/generate/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botId,
          platform: genPlatform,
          prompt: genPrompt.trim(),
          modelId: genModelId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');

      if (data.status === 'succeeded') {
        addGeneratedVideo(data);
        return;
      }

      const predictionId = data.predictionId;
      if (!predictionId) throw new Error('Server did not return a prediction ID');

      const modelName = VIDEO_MODELS.find(m => m.id === genModelId)?.name || 'AI';
      setGenProgress(`${modelName}: video is generating…`);

      let polls = 0;
      genPollRef.current = setInterval(async () => {
        polls++;
        if (polls > 120) {
          clearInterval(genPollRef.current!);
          setGenerating(false);
          setGenError('Timed out after 10 minutes. Check Media Library — the video may still complete there.');
          return;
        }
        try {
          const pollRes = await fetch(`/api/generate/video?predictionId=${encodeURIComponent(predictionId)}`);
          const pollData = await pollRes.json();

          if (pollData.status === 'succeeded') {
            clearInterval(genPollRef.current!);
            addGeneratedVideo(pollData);
          } else if (pollData.status === 'failed' || pollData.status === 'cancelled') {
            clearInterval(genPollRef.current!);
            setGenerating(false);
            setGenError(pollData.error || 'Video generation failed.');
          } else {
            const elapsed = Math.round(polls * 5);
            setGenProgress((pollData.progress || `${modelName}: generating…`) + ` (${elapsed}s)`);
          }
        } catch {
          // ignore transient poll errors
        }
      }, 5000);
    } catch (err) {
      setGenerating(false);
      setGenError(err instanceof Error ? err.message : 'Generation failed');
    }
  }, [botId, genModelId, genPlatform, genPrompt, addGeneratedVideo]);

  // ── Color & Filters handlers ──
  const handleSetAdjustment = useCallback((key: string, value: number) => {
    setAdjustments(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleResetAdjustments = useCallback(() => {
    setAdjustments({});
  }, []);

  // ── AI captions ──
  const handleGenerateCaptions = useCallback(async (mediaId: string, videoDescription?: string) => {
    setGeneratingCaptions(true);
    setCaptionError(null);
    setCaptions(null);

    try {
      const res = await fetch('/api/studio/caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaId,
          botId,
          platforms: captionPlatforms,
          videoDescription,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Caption generation failed');
      setCaptions(data.captions || {});
    } catch (err) {
      setCaptionError(err instanceof Error ? err.message : 'Caption generation failed');
    } finally {
      setGeneratingCaptions(false);
    }
  }, [botId, captionPlatforms]);

  const handleCopyCaption = useCallback((platform: string, text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedKey(platform);
    setTimeout(() => setCopiedKey(null), 2000);
  }, []);

  const toggleCaptionPlatform = useCallback((platform: string) => {
    setCaptionPlatforms(prev =>
      prev.includes(platform) ? prev.filter(p => p !== platform) : [...prev, platform]
    );
  }, []);

  // ── Thumbnail extraction ──
  const handleCaptureThumb = useCallback(async () => {
    if (!selectedVideoId) return;
    setCapturingThumb(true);
    setThumbError(null);
    setThumbResult(null);

    try {
      const res = await fetch('/api/studio/thumbnail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaId: selectedVideoId,
          botId,
          timestamp: Math.round(currentTime * 100) / 100,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Thumbnail capture failed');
      setThumbResult(data);
    } catch (err) {
      setThumbError(err instanceof Error ? err.message : 'Thumbnail capture failed');
    } finally {
      setCapturingThumb(false);
    }
  }, [selectedVideoId, botId, currentTime]);

  const handleProcess = async () => {
    if (!selectedVideoId) return;
    setProcessing(true);
    setError(null);
    setResult(null);

    try {
      const body: Record<string, unknown> = {
        mediaId: selectedVideoId,
        botId,
        trim: {
          start: Math.round(trimStart * 100) / 100,
          end: Math.round(trimEnd * 100) / 100,
        },
      };

      if (selectedFilterId !== 'original') {
        body.filterId = selectedFilterId;
      }

      if (hasActiveAdjustments(adjustments)) {
        body.adjustments = adjustments;
      }

      if (textEnabled && textContent.trim()) {
        body.textOverlay = {
          text: textContent.trim(),
          position: textPosition,
          color: textColor,
          fontSize: 48,
        };
      }

      if (aspectRatio !== 'original') {
        body.aspectRatio = aspectRatio;
      }

      const resp = await fetch('/api/studio/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Processing failed');
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Processing failed');
    } finally {
      setProcessing(false);
    }
  };

  // Keyboard shortcut: Space = play/pause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && selectedVideoId && !result) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedVideoId, result, togglePlay]);

  const trimDuration = trimEnd - trimStart;
  const selectedVideo = videos.find(v => v.id === selectedVideoId);
  const textPreviewY = textPosition === 'top' ? 'top-3' : textPosition === 'center' ? 'top-1/2 -translate-y-1/2' : 'bottom-3';

  // Base image for filter swatches — video frame if available, else a scene-like gradient
  const filterSwatchBg = videoFrameUrl
    ? `url(${videoFrameUrl})`
    : 'linear-gradient(to bottom right, #5B86C5 0%, #A7C7E7 18%, #D4956B 32%, #8FBC5A 48%, #D4A76A 62%, #7B5B3A 78%, #2D2D2D 100%)';

  // Build edit summary items for the status bar
  const editSummary: string[] = [];
  if (videoDuration > 0 && (trimStart > 0.1 || trimEnd < videoDuration - 0.1)) {
    editSummary.push(`Trim: ${formatTime(trimStart)}→${formatTime(trimEnd)}`);
  }
  if (selectedFilterId !== 'original') {
    const preset = VIDEO_FILTERS.find(f => f.id === selectedFilterId);
    if (preset) editSummary.push(`Filter: ${preset.name}`);
  }
  if (hasActiveAdjustments(adjustments)) {
    editSummary.push(adjustmentSummary(adjustments));
  }
  if (textEnabled && textContent.trim()) {
    editSummary.push(`Text: "${textContent.length > 20 ? textContent.slice(0, 20) + '…' : textContent}"`);
  }
  if (aspectRatio !== 'original') {
    editSummary.push(`Ratio: ${aspectRatio}`);
  }

  // ── RENDER: DaVinci Resolve-inspired layout ──

  // No videos at all — empty state
  if (videos.length === 0 && !showGenPanel) {
    return (
      <div className="text-center py-16">
        <Film className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
        <p className="text-lg font-medium">No videos yet</p>
        <p className="text-sm text-muted-foreground mt-2 mb-6">
          Upload a video in your{' '}
          <Link href={`/dashboard/bots/${botPageId}/media`} className="text-primary underline">
            Media library
          </Link>{' '}
          or generate one with AI to start editing.
        </p>
        <Button onClick={() => setShowGenPanel(true)} className="gap-2">
          <Wand2 className="h-4 w-4" /> Generate Video with AI
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 10rem)' }}>
      {/* ══════════════ HEADER BAR ══════════════ */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <MonitorPlay className="h-5 w-5 text-primary shrink-0" />
          <span className="text-sm font-semibold truncate">
            {selectedVideo ? selectedVideo.filename : 'Select a video'}
          </span>
          {selectedVideo && selectedVideo.width && selectedVideo.height && (
            <Badge variant="outline" className="text-[10px] shrink-0">
              {selectedVideo.width}×{selectedVideo.height}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {result ? (
            <>
              <a href={`${result.url}?download=true`}>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Download className="h-3.5 w-3.5" /> Download
                </Button>
              </a>
              <Link href={`/dashboard/bots/${botPageId}/post?mediaId=${result.mediaId}`}>
                <Button size="sm" className="gap-1.5">
                  <ChevronRight className="h-3.5 w-3.5" /> Use in Post
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setResult(null);
                  setError(null);
                  setCaptions(null);
                  setSelectedFilterId('original');
                  setAdjustments({});
                }}
                className="gap-1.5"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Edit more
              </Button>
            </>
          ) : (
            <Button
              onClick={handleProcess}
              disabled={processing || !selectedVideoId}
              size="sm"
              className="gap-1.5"
            >
              {processing ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Processing…</>
              ) : (
                <><Sparkles className="h-3.5 w-3.5" /> Process &amp; Save</>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* ══════════════ MAIN 3-COLUMN LAYOUT ══════════════ */}
      <div className="flex flex-col md:flex-row flex-1 min-h-0 gap-0 mt-3">

        {/* ── LEFT: Media Pool ── */}
        <div className="w-full md:w-48 lg:w-56 shrink-0 flex flex-col border rounded-t-lg md:rounded-t-none md:rounded-l-lg bg-card overflow-hidden max-h-48 md:max-h-none">
          <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/40">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5" /> Media Pool
            </span>
            <span className="text-[10px] text-muted-foreground">{videos.length}</span>
          </div>

          {/* AI Generate button */}
          <div className="px-2 py-2 border-b">
            <Button
              variant={showGenPanel ? 'default' : 'outline'}
              size="sm"
              className="w-full gap-1.5 text-xs"
              onClick={() => setShowGenPanel(v => !v)}
            >
              <Wand2 className="h-3.5 w-3.5" />
              {showGenPanel ? 'Back to Pool' : 'AI Generate'}
            </Button>
          </div>

          {/* Video list or AI generate form */}
          <div className="flex-1 overflow-y-auto">
            {showGenPanel ? (
              /* ── AI Generation Panel ── */
              <div className="p-3 space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="gen-model" className="text-[11px] font-medium">Model</Label>
                  <select
                    id="gen-model"
                    value={genModelId}
                    onChange={e => setGenModelId(e.target.value)}
                    disabled={generating}
                    className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-[11px] disabled:opacity-50"
                  >
                    {VIDEO_MODELS.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name} — {m.creditCost}cr
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="gen-platform" className="text-[11px] font-medium">Platform</Label>
                  <select
                    id="gen-platform"
                    value={genPlatform}
                    onChange={e => setGenPlatform(e.target.value)}
                    disabled={generating}
                    className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-[11px] disabled:opacity-50"
                  >
                    {GEN_PLATFORMS.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="gen-prompt" className="text-[11px] font-medium">Prompt</Label>
                  <textarea
                    id="gen-prompt"
                    value={genPrompt}
                    onChange={e => setGenPrompt(e.target.value)}
                    placeholder="Describe the video…"
                    rows={4}
                    disabled={generating}
                    maxLength={1000}
                    className="flex w-full rounded-md border border-input bg-background px-2 py-1.5 text-[11px] placeholder:text-muted-foreground resize-y disabled:opacity-50"
                  />
                  <p className="text-[10px] text-muted-foreground text-right">{genPrompt.length}/1000</p>
                </div>

                {genError && (
                  <div className="rounded bg-destructive/10 border border-destructive/20 p-2 text-[11px] text-destructive">
                    {genError}
                  </div>
                )}

                {generating && genProgress && (
                  <div className="rounded bg-primary/5 border border-primary/20 p-2 text-[11px] text-primary flex items-center gap-1.5">
                    <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                    <span className="break-words">{genProgress}</span>
                  </div>
                )}

                <Button
                  onClick={handleGenerate}
                  disabled={generating || !genPrompt.trim()}
                  className="w-full gap-1.5 text-xs"
                  size="sm"
                >
                  {generating ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" />Generating…</>
                  ) : (
                    <>
                      <Wand2 className="h-3.5 w-3.5" /> Generate
                      <span className="text-[10px] opacity-75">
                        ({VIDEO_MODELS.find(m => m.id === genModelId)?.creditCost ?? '?'}cr)
                      </span>
                    </>
                  )}
                </Button>
              </div>
            ) : (
              /* ── Video Grid ── */
              <div className="p-2 space-y-1.5">
                {videos.map((v) => {
                  const isSelected = selectedVideoId === v.id;
                  return (
                    <button
                      key={v.id}
                      onClick={() => handleVideoSelect(v.id)}
                      disabled={processing}
                      className={`w-full rounded-md border overflow-hidden text-left transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                        isSelected ? 'border-primary ring-1 ring-primary/30 shadow-sm' : 'border-muted hover:border-primary/40'
                      } ${processing ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div className="aspect-video bg-black relative flex items-center justify-center overflow-hidden">
                        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                        <video
                          src={`/api/media/${v.id}#t=0.5`}
                          className="w-full h-full object-contain"
                          preload="metadata"
                          muted
                          playsInline
                        />
                        {isSelected && (
                          <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                            <CheckCircle2 className="h-5 w-5 text-primary drop-shadow-md" />
                          </div>
                        )}
                      </div>
                      <div className="px-2 py-1 bg-muted/40">
                        <p className="text-[10px] font-medium truncate">{v.filename}</p>
                        <p className="text-[9px] text-muted-foreground">{formatFileSize(v.fileSize)}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── CENTER: Viewer ── */}
        <div className="flex-1 flex flex-col border-y bg-black/95 min-w-0">
          {selectedVideoId && selectedVideo ? (
            <>
              {/* Video Player */}
              <div className="flex-1 relative flex items-center justify-center overflow-hidden min-h-0">
                {result ? (
                  /* Show processed result */
                  <>
                    {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                    <video
                      key={result.url}
                      src={result.url}
                      className="max-w-full max-h-full object-contain"
                      controls
                      playsInline
                      preload="metadata"
                    />
                    <div className="absolute top-3 left-3">
                      <Badge className="bg-green-600 text-white text-[10px]">
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Saved: {result.filename}
                      </Badge>
                    </div>
                  </>
                ) : (
                  /* Show source video with text overlay preview */
                  <>
                    {videoLoading && (
                      <div className="absolute inset-0 flex items-center justify-center z-10">
                        <Loader2 className="h-8 w-8 text-white/60 animate-spin" />
                      </div>
                    )}
                    {videoLoadError && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center z-10 text-red-400 px-6">
                        <Film className="h-10 w-10 mb-2 opacity-50" />
                        <p className="text-sm text-center">{videoLoadError}</p>
                      </div>
                    )}
                    {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                    <video
                      ref={videoRef}
                      key={selectedVideoId}
                      src={`/api/media/${selectedVideoId}`}
                      className="max-w-full max-h-full object-contain"
                      onLoadedMetadata={handleVideoLoaded}
                      onTimeUpdate={handleTimeUpdate}
                      onEnded={() => setIsPlaying(false)}
                      onError={handleVideoError}
                      playsInline
                      preload="metadata"
                    />
                    {/* Text overlay preview */}
                    {textEnabled && textContent.trim() && (
                      <div className={`absolute left-0 right-0 pointer-events-none flex justify-center px-4 ${textPreviewY}`}>
                        <span
                          className="text-center text-sm font-bold px-3 py-1.5 rounded shadow-lg max-w-full break-words"
                          style={{
                            color: textColor === 'black' ? '#000' : textColor === 'yellow' ? '#facc15' : '#fff',
                            backgroundColor: 'rgba(0,0,0,0.55)',
                          }}
                        >
                          {textContent}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Playback controls bar */}
              <div className="flex items-center gap-3 px-4 py-2 bg-black/80 border-t border-white/10 shrink-0">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={togglePlay}
                  className="text-white hover:bg-white/10 h-8 w-8 p-0"
                  disabled={!!result}
                >
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>
                <span className="text-[11px] font-mono text-white/70 tabular-nums">
                  {formatTime(currentTime)} / {formatTime(videoDuration)}
                </span>
                {videoDuration > 0 && !result && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCaptureThumb}
                    disabled={capturingThumb}
                    className="text-white/70 hover:bg-white/10 hover:text-white gap-1.5 text-[11px] h-7 ml-auto"
                  >
                    {capturingThumb
                      ? <><Loader2 className="h-3 w-3 animate-spin" /> Capturing…</>
                      : <><Camera className="h-3 w-3" /> Thumbnail</>
                    }
                  </Button>
                )}
              </div>

              {/* Thumbnail result toast */}
              {thumbResult && (
                <div className="flex items-center gap-2 px-4 py-1.5 bg-green-900/80 text-green-200 text-[11px] shrink-0">
                  <CheckCircle2 className="h-3 w-3 shrink-0" />
                  <span className="truncate">Thumbnail saved: {thumbResult.filename}</span>
                  <button onClick={() => setThumbResult(null)} className="ml-auto text-green-400 hover:text-white shrink-0">×</button>
                </div>
              )}
              {thumbError && (
                <div className="flex items-center gap-2 px-4 py-1.5 bg-red-900/80 text-red-200 text-[11px] shrink-0">
                  <span className="truncate">{thumbError}</span>
                  <button onClick={() => setThumbError(null)} className="ml-auto text-red-400 hover:text-white shrink-0">×</button>
                </div>
              )}
            </>
          ) : (
            /* No video selected placeholder */
            <div className="flex-1 flex flex-col items-center justify-center text-white/40">
              <Film className="h-16 w-16 mb-3" />
              <p className="text-sm font-medium">Select a video from the Media Pool</p>
              <p className="text-xs mt-1">or generate one with AI</p>
            </div>
          )}
        </div>

        {/* ── RIGHT: Inspector Panel ── */}
        <div className="w-full md:w-72 lg:w-80 shrink-0 flex flex-col border rounded-b-lg md:rounded-b-none md:rounded-r-lg bg-card overflow-hidden max-h-72 md:max-h-none">
          {/* Inspector tabs */}
          <div className="flex border-b bg-muted/40 shrink-0">
            {INSPECTOR_TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = inspectorTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setInspectorTab(tab.key)}
                  className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors border-b-2 ${
                    isActive
                      ? 'border-primary text-primary bg-primary/5'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/60'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Inspector content — scrollable */}
          <div className="flex-1 overflow-y-auto p-3">
            {/* ── TRIM TAB ── */}
            {inspectorTab === 'trim' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">Trim Controls</span>
                  {videoDuration > 0 && (
                    <Badge variant="secondary" className="text-[10px]">
                      {formatTime(trimDuration)}
                    </Badge>
                  )}
                </div>

                {videoDuration > 0 ? (
                  <>
                    {/* Timeline bar */}
                    <div className="relative h-6 bg-muted rounded-md overflow-hidden">
                      <div className="absolute inset-0 bg-muted-foreground/10 rounded-md" />
                      <div
                        className="absolute top-0 bottom-0 bg-primary/40 rounded-md"
                        style={{
                          left: `${(trimStart / videoDuration) * 100}%`,
                          right: `${100 - (trimEnd / videoDuration) * 100}%`,
                        }}
                      />
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-primary"
                        style={{ left: `${(currentTime / videoDuration) * 100}%` }}
                      />
                    </div>

                    {/* Start */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label className="text-[11px] text-muted-foreground">
                          Start — <strong className="text-foreground">{formatTime(trimStart)}</strong>
                        </Label>
                        <button
                          onClick={() => { setTrimStart(0); if (videoRef.current) videoRef.current.currentTime = 0; }}
                          className="text-[10px] text-primary hover:underline"
                        >
                          Reset
                        </button>
                      </div>
                      <input
                        type="range" min={0} max={videoDuration} step={0.1}
                        value={trimStart}
                        onChange={(e) => handleTrimStartChange(parseFloat(e.target.value))}
                        className="w-full accent-primary h-1.5"
                      />
                    </div>

                    {/* End */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label className="text-[11px] text-muted-foreground">
                          End — <strong className="text-foreground">{formatTime(trimEnd)}</strong>
                        </Label>
                        <button
                          onClick={() => setTrimEnd(videoDuration)}
                          className="text-[10px] text-primary hover:underline"
                        >
                          Reset
                        </button>
                      </div>
                      <input
                        type="range" min={0} max={videoDuration} step={0.1}
                        value={trimEnd}
                        onChange={(e) => handleTrimEndChange(parseFloat(e.target.value))}
                        className="w-full accent-primary h-1.5"
                      />
                    </div>

                    <div className="text-[11px] text-muted-foreground bg-muted/50 rounded-md p-2">
                      Keeping {formatTime(trimDuration)} of {formatTime(videoDuration)} total
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">Select a video to enable trim controls.</p>
                )}
              </div>
            )}

            {/* ── COLOR TAB ── */}
            {inspectorTab === 'color' && (
              <div className="space-y-4">
                <span className="text-xs font-semibold">Color &amp; Filters</span>

                {/* Category tabs */}
                <div className="flex flex-wrap gap-1">
                  {(['all', ...Object.keys(FILTER_CATEGORY_LABELS)] as (FilterCategory | 'all')[]).map(cat => (
                    <button
                      key={cat}
                      onClick={() => setFilterCategory(cat)}
                      className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                        filterCategory === cat
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-input text-muted-foreground hover:border-primary/40'
                      }`}
                    >
                      {cat === 'all' ? 'All' : FILTER_CATEGORY_LABELS[cat as FilterCategory]}
                    </button>
                  ))}
                </div>

                {/* Filter gallery */}
                <div className="grid grid-cols-4 gap-1.5">
                  {VIDEO_FILTERS
                    .filter(f => filterCategory === 'all' || f.category === filterCategory)
                    .map(f => {
                      const isSelected = selectedFilterId === f.id;
                      return (
                        <button
                          key={f.id}
                          onClick={() => setSelectedFilterId(f.id)}
                          title={f.name}
                          className={`flex flex-col items-center gap-0.5 p-1 rounded-md border transition-all ${
                            isSelected
                              ? 'border-primary ring-1 ring-primary/40 bg-primary/5'
                              : 'border-transparent hover:border-primary/30'
                          }`}
                        >
                          <div
                            className="w-full aspect-square rounded overflow-hidden bg-cover bg-center"
                            style={{
                              backgroundImage: filterSwatchBg,
                              filter: f.cssPreview || 'none',
                            }}
                          />
                          <span className={`text-[9px] leading-tight text-center w-full truncate ${
                            isSelected ? 'text-primary font-semibold' : 'text-muted-foreground'
                          }`}>
                            {f.name}
                          </span>
                        </button>
                      );
                    })}
                </div>

                {/* Adjustment sliders */}
                <div className="space-y-2.5 pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold flex items-center gap-1">
                      <SlidersHorizontal className="h-3 w-3 text-primary" />
                      Adjustments
                    </span>
                    {hasActiveAdjustments(adjustments) && (
                      <button
                        onClick={handleResetAdjustments}
                        className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5"
                      >
                        <RotateCcw className="h-2.5 w-2.5" /> Reset
                      </button>
                    )}
                  </div>

                  {ADJUSTMENT_DEFS.map(def => {
                    const value = adjustments[def.key] ?? def.default;
                    const isChanged = value !== def.default;
                    return (
                      <div key={def.key} className="space-y-0.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px]">{def.label}</label>
                          <div className="flex items-center gap-1">
                            <span className={`text-[10px] tabular-nums w-7 text-right ${
                              isChanged ? 'text-primary font-semibold' : 'text-muted-foreground'
                            }`}>
                              {value > 0 ? `+${value}` : value}
                            </span>
                            {isChanged && (
                              <button
                                onClick={() => handleSetAdjustment(def.key, def.default)}
                                className="text-muted-foreground hover:text-foreground shrink-0"
                                title={`Reset ${def.label}`}
                              >
                                <RotateCcw className="h-2.5 w-2.5" />
                              </button>
                            )}
                          </div>
                        </div>
                        <input
                          type="range"
                          min={def.min} max={def.max} step={def.step}
                          value={value}
                          onChange={e => handleSetAdjustment(def.key, parseInt(e.target.value, 10))}
                          className="w-full h-1 appearance-none rounded-full bg-muted accent-primary cursor-pointer"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── TEXT TAB ── */}
            {inspectorTab === 'text' && (
              <div className="space-y-4">
                <span className="text-xs font-semibold">Text Overlay</span>

                {/* Toggle */}
                <div className="flex items-center gap-3">
                  <button
                    role="switch"
                    aria-checked={textEnabled}
                    onClick={() => setTextEnabled(!textEnabled)}
                    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                      textEnabled ? 'bg-primary' : 'bg-muted-foreground/30'
                    }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                        textEnabled ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                  <Label className="text-[11px] cursor-pointer" onClick={() => setTextEnabled(!textEnabled)}>
                    Add text to video
                  </Label>
                </div>

                {textEnabled && (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label htmlFor="studio-text" className="text-[11px] font-medium">Text</Label>
                      <Input
                        id="studio-text"
                        value={textContent}
                        onChange={(e) => setTextContent(e.target.value)}
                        placeholder="e.g. Special offer — 20% off!"
                        maxLength={100}
                        autoComplete="off"
                        className="h-8 text-xs"
                      />
                      <p className="text-[10px] text-muted-foreground text-right">{textContent.length}/100</p>
                    </div>

                    {/* Position */}
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-medium">Position</Label>
                      <div className="flex gap-1.5">
                        {(['top', 'center', 'bottom'] as const).map((pos) => (
                          <button
                            key={pos}
                            onClick={() => setTextPosition(pos)}
                            className={`flex-1 text-[10px] py-1.5 rounded-md border transition-colors ${
                              textPosition === pos
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'border-input text-muted-foreground hover:border-primary/40'
                            }`}
                          >
                            {pos.charAt(0).toUpperCase() + pos.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Color */}
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-medium">Color</Label>
                      <div className="flex gap-2">
                        {TEXT_COLORS.map((c) => (
                          <button
                            key={c.value}
                            onClick={() => setTextColor(c.value)}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-[10px] transition-colors ${
                              textColor === c.value
                                ? 'border-primary bg-primary/5'
                                : 'border-input hover:border-primary/40'
                            }`}
                          >
                            <span className={`inline-block w-3 h-3 rounded-full shrink-0 ${c.cls}`} />
                            {c.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {textContent.trim() && (
                      <p className="text-[10px] text-muted-foreground bg-muted/50 rounded p-2">
                        Preview visible on the video player
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── RATIO TAB ── */}
            {inspectorTab === 'ratio' && (
              <div className="space-y-4">
                <span className="text-xs font-semibold">Aspect Ratio</span>
                <p className="text-[11px] text-muted-foreground">Resize for a specific platform — center-crops the video</p>

                <div className="grid grid-cols-2 gap-2">
                  {ASPECT_RATIOS.map((ar) => (
                    <button
                      key={ar.value}
                      onClick={() => setAspectRatio(ar.value)}
                      className={`rounded-lg border-2 p-3 text-center transition-all ${
                        aspectRatio === ar.value
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-muted hover:border-primary/40'
                      }`}
                    >
                      <div className="flex justify-center mb-1.5">
                        <div className={`border-2 border-current rounded-sm ${ar.shape} ${
                          aspectRatio === ar.value ? 'border-primary text-primary' : 'border-muted-foreground/40'
                        }`} />
                      </div>
                      <p className="text-[11px] font-semibold">{ar.label}</p>
                      <p className="text-[9px] text-muted-foreground leading-tight mt-0.5">{ar.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── CAPTION TAB ── */}
            {inspectorTab === 'caption' && (
              <div className="space-y-4">
                <span className="text-xs font-semibold">AI Caption Generator</span>

                {!result ? (
                  <p className="text-[11px] text-muted-foreground bg-muted/50 rounded-md p-3">
                    Process your video first, then generate AI captions for each platform.
                  </p>
                ) : (
                  <>
                    {/* Platform toggles */}
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-medium">Platforms</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {['INSTAGRAM', 'TIKTOK', 'FACEBOOK', 'TWITTER', 'LINKEDIN', 'THREADS', 'YOUTUBE'].map(p => (
                          <button
                            key={p}
                            onClick={() => toggleCaptionPlatform(p)}
                            className={`text-[10px] px-2 py-0.5 rounded-full border transition-all ${
                              captionPlatforms.includes(p)
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'border-input text-muted-foreground hover:border-primary/50'
                            }`}
                          >
                            {p.charAt(0) + p.slice(1).toLowerCase()}
                          </button>
                        ))}
                      </div>
                    </div>

                    {captionError && (
                      <div className="rounded bg-destructive/10 border border-destructive/20 p-2 text-[11px] text-destructive">
                        {captionError}
                      </div>
                    )}

                    {!captions && (
                      <Button
                        size="sm"
                        onClick={() => handleGenerateCaptions(
                          result.mediaId,
                          selectedVideo?.filename?.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')
                        )}
                        disabled={generatingCaptions || captionPlatforms.length === 0}
                        className="w-full gap-1.5 text-xs"
                      >
                        {generatingCaptions
                          ? <><Loader2 className="h-3 w-3 animate-spin" />Generating…</>
                          : <><Sparkles className="h-3 w-3" />Generate Captions</>
                        }
                      </Button>
                    )}

                    {captions && Object.keys(captions).length > 0 && (
                      <div className="space-y-2.5">
                        {Object.entries(captions).map(([platform, caption]) => (
                          <div key={platform} className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                                {platform}
                              </span>
                              <button
                                onClick={() => handleCopyCaption(platform, caption)}
                                className="text-[10px] flex items-center gap-0.5 text-primary hover:underline"
                              >
                                <Copy className="h-2.5 w-2.5" />
                                {copiedKey === platform ? 'Copied!' : 'Copy'}
                              </button>
                            </div>
                            <div className="rounded bg-background border p-2 text-[11px] whitespace-pre-wrap leading-relaxed">
                              {caption}
                            </div>
                          </div>
                        ))}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setCaptions(null); setCaptionError(null); }}
                          className="text-[11px] w-full"
                        >
                          <RotateCcw className="h-2.5 w-2.5 mr-1" /> Regenerate
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══════════════ BOTTOM STATUS BAR ══════════════ */}
      <div className="flex items-center gap-3 px-3 py-2 border rounded-b-lg bg-muted/30 mt-0 shrink-0">
        {error && (
          <span className="text-[11px] text-destructive flex items-center gap-1.5">
            {error}
            <button onClick={() => setError(null)} className="text-destructive/60 hover:text-destructive shrink-0">×</button>
          </span>
        )}
        {processing && (
          <span className="text-[11px] text-primary flex items-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" /> Processing video… keep this page open
          </span>
        )}
        {!error && !processing && editSummary.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-muted-foreground font-medium">Edits:</span>
            {editSummary.map((s, i) => (
              <Badge key={i} variant="outline" className="text-[10px]">{s}</Badge>
            ))}
          </div>
        )}
        {!error && !processing && editSummary.length === 0 && (
          <span className="text-[10px] text-muted-foreground">
            {selectedVideo ? 'No edits applied — the original will be copied as-is' : 'Select a video to begin editing'}
          </span>
        )}
        <span className="text-[10px] text-muted-foreground ml-auto">
          Original stays untouched
        </span>
      </div>
    </div>
  );
}
