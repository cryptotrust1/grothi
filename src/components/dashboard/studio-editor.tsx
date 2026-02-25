'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Scissors, Type, Crop, Play, Pause, RotateCcw,
  Download, Film, CheckCircle2, Loader2, ChevronRight,
  Sparkles, ChevronDown, ChevronUp, Wand2, Camera, Copy, MessageSquare,
  Palette, SlidersHorizontal,
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
  { value: '9:16', label: '9:16 Vertical', desc: 'TikTok · Reels · Shorts', shape: 'w-4 h-8' },
  { value: '1:1', label: '1:1 Square', desc: 'Instagram · Facebook', shape: 'w-6 h-6' },
  { value: '16:9', label: '16:9 Wide', desc: 'YouTube · Twitter', shape: 'w-8 h-5' },
];

const GEN_PLATFORMS = [
  { value: 'TIKTOK', label: 'TikTok' },
  { value: 'INSTAGRAM', label: 'Instagram' },
  { value: 'YOUTUBE', label: 'YouTube' },
  { value: 'FACEBOOK', label: 'Facebook' },
  { value: 'TWITTER', label: 'X / Twitter' },
  { value: 'THREADS', label: 'Threads' },
];

export function StudioEditor({ videos: initialVideos, botId, botPageId }: StudioEditorProps) {
  // Videos state — starts with server-fetched list, grows when AI generates new ones
  const [videos, setVideos] = useState<VideoMedia[]>(initialVideos);

  // ── AI Generate section ──
  const [showGenSection, setShowGenSection] = useState(false);
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

  // ── Color & Filters (Step 3) ──
  const [selectedFilterId, setSelectedFilterId] = useState('original');
  const [filterCategory, setFilterCategory] = useState<FilterCategory | 'all'>('all');
  const [adjustments, setAdjustments] = useState<AdjustmentValues>({});

  // ── Phase 3: AI Caption Generator ──
  const [showCaptionForm, setShowCaptionForm] = useState(false);
  const [captionPlatforms, setCaptionPlatforms] = useState<string[]>(['INSTAGRAM', 'TIKTOK', 'FACEBOOK']);
  const [generatingCaptions, setGeneratingCaptions] = useState(false);
  const [captions, setCaptions] = useState<Record<string, string> | null>(null);
  const [captionError, setCaptionError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // ── Phase 4: Thumbnail Extraction ──
  const [capturingThumb, setCapturingThumb] = useState(false);
  const [thumbResult, setThumbResult] = useState<{ mediaId: string; url: string; filename: string } | null>(null);
  const [thumbError, setThumbError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);

  const handleVideoSelect = useCallback((videoId: string) => {
    setSelectedVideoId(videoId);
    setTrimStart(0);
    setTrimEnd(0);
    setVideoDuration(0);
    setCurrentTime(0);
    setIsPlaying(false);
    setResult(null);
    setError(null);
    // Reset Color & Filters
    setSelectedFilterId('original');
    setAdjustments({});
    setFilterCategory('all');
    // Reset Phase 3 + 4 state
    setShowCaptionForm(false);
    setCaptions(null);
    setCaptionError(null);
    setThumbResult(null);
    setThumbError(null);
  }, []);

  const handleVideoLoaded = useCallback(() => {
    if (videoRef.current) {
      const dur = videoRef.current.duration;
      if (isFinite(dur) && dur > 0) {
        setVideoDuration(dur);
        setTrimEnd(dur);
      }
    }
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
    // Auto-select the new video so user can immediately edit it
    setSelectedVideoId(newVideo.id);
    setTrimStart(0);
    setTrimEnd(0);
    setVideoDuration(0);
    setCurrentTime(0);
    setIsPlaying(false);
    setResult(null);
    setError(null);
    setShowGenSection(false);
    // Reset Color & Filters
    setSelectedFilterId('original');
    setAdjustments({});
    setFilterCategory('all');
    // Reset Phase 3+4 — clear stale state from any previously selected video
    setShowCaptionForm(false);
    setCaptions(null);
    setCaptionError(null);
    setThumbResult(null);
    setThumbError(null);
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!genPrompt.trim()) return;
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

      // Occasionally synchronous (rare for video)
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

  // ── Phase 3: Generate AI captions for the processed video ──
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

  // ── Phase 4: Extract thumbnail frame from current video position ──
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

  const trimDuration = trimEnd - trimStart;
  const selectedVideo = videos.find(v => v.id === selectedVideoId);
  const textPreviewY = textPosition === 'top' ? 'top-3' : textPosition === 'center' ? 'top-1/2 -translate-y-1/2' : 'bottom-3';

  return (
    <div className="space-y-5">
      {/* ── AI Video Generation ── */}
      <Card className={showGenSection ? 'border-primary/40 shadow-sm' : ''}>
        <CardHeader className="pb-3">
          <button
            onClick={() => setShowGenSection(v => !v)}
            className="flex items-center justify-between w-full text-left group"
          >
            <CardTitle className="flex items-center gap-2 text-base">
              <Wand2 className="h-4 w-4 text-primary" />
              Generate new video with AI
              <Badge variant="secondary" className="text-[10px] ml-1">New</Badge>
            </CardTitle>
            {showGenSection
              ? <ChevronUp className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              : <ChevronDown className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />}
          </button>
          {!showGenSection && (
            <CardDescription className="mt-1">
              Use AI to create a video from a text prompt — then edit it in the steps below
            </CardDescription>
          )}
        </CardHeader>

        {showGenSection && (
          <CardContent className="space-y-4">
            {/* Model selector */}
            <div className="space-y-1.5">
              <Label htmlFor="gen-model" className="text-xs font-medium">AI Model</Label>
              <select
                id="gen-model"
                value={genModelId}
                onChange={e => setGenModelId(e.target.value)}
                disabled={generating}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50"
              >
                {VIDEO_MODELS.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name} — {m.creditCost} credits · {m.estimatedTime}{m.badge ? ` · ${m.badge}` : ''}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground">
                {VIDEO_MODELS.find(m => m.id === genModelId)?.description}
              </p>
            </div>

            {/* Platform */}
            <div className="space-y-1.5">
              <Label htmlFor="gen-platform" className="text-xs font-medium">Target Platform</Label>
              <select
                id="gen-platform"
                value={genPlatform}
                onChange={e => setGenPlatform(e.target.value)}
                disabled={generating}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50"
              >
                {GEN_PLATFORMS.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>

            {/* Prompt */}
            <div className="space-y-1.5">
              <Label htmlFor="gen-prompt" className="text-xs font-medium">Prompt</Label>
              <textarea
                id="gen-prompt"
                value={genPrompt}
                onChange={e => setGenPrompt(e.target.value)}
                placeholder="Describe the video you want — e.g. 'A product showcase of a coffee cup on a wooden table, cinematic lighting, slow zoom in'"
                rows={3}
                disabled={generating}
                maxLength={1000}
                className="flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y disabled:opacity-50"
              />
              <p className="text-[10px] text-muted-foreground text-right">{genPrompt.length}/1000</p>
            </div>

            {/* Error */}
            {genError && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                {genError}
              </div>
            )}

            {/* Progress */}
            {generating && genProgress && (
              <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-sm text-primary flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                {genProgress}
              </div>
            )}

            {generating && (
              <p className="text-xs text-muted-foreground text-center">
                Video generation takes 1–6 minutes depending on the model. Keep this page open.
              </p>
            )}

            <Button
              onClick={handleGenerate}
              disabled={generating || !genPrompt.trim()}
              className="w-full gap-2"
            >
              {generating ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Generating…</>
              ) : (
                <>
                  <Wand2 className="h-4 w-4" />
                  Generate Video
                  <span className="text-[11px] opacity-75">
                    ({VIDEO_MODELS.find(m => m.id === genModelId)?.creditCost ?? '?'} credits)
                  </span>
                </>
              )}
            </Button>
          </CardContent>
        )}
      </Card>

      {/* ── Step 1: Select video ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-bold">1</span>
            <Film className="h-4 w-4" /> Select a video
          </CardTitle>
          <CardDescription>Pick a video from your Media library to edit</CardDescription>
        </CardHeader>
        <CardContent>
          {videos.length === 0 ? (
            <div className="text-center py-10">
              <Film className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium">No videos yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                <Link href={`/dashboard/bots/${botPageId}/media`} className="text-primary underline">
                  Upload a video in Media
                </Link>{' '}
                and come back here to edit it.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-72 overflow-y-auto pr-1">
              {videos.map((v) => {
                const isSelected = selectedVideoId === v.id;
                return (
                  <button
                    key={v.id}
                    onClick={() => handleVideoSelect(v.id)}
                    className={`relative rounded-lg border-2 overflow-hidden text-left transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                      isSelected ? 'border-primary ring-2 ring-primary/20 shadow-md' : 'border-muted hover:border-primary/50'
                    }`}
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
                          <CheckCircle2 className="h-7 w-7 text-primary drop-shadow-md" />
                        </div>
                      )}
                    </div>
                    <div className="px-2 py-1.5 bg-muted/40">
                      <p className="text-xs font-medium truncate">{v.filename}</p>
                      <p className="text-[10px] text-muted-foreground">{formatFileSize(v.fileSize)}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Editor steps (only shown after video selected) ── */}
      {selectedVideoId && selectedVideo && (
        <>
          {/* ── Step 2: Preview & Trim ── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-bold">2</span>
                <Scissors className="h-4 w-4" /> Trim the video
              </CardTitle>
              <CardDescription>Set start and end points — everything outside gets removed</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Video preview */}
              <div className="relative rounded-xl overflow-hidden bg-black aspect-video max-h-80 shadow-inner">
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video
                  ref={videoRef}
                  key={selectedVideoId}
                  src={`/api/media/${selectedVideoId}`}
                  className="w-full h-full object-contain"
                  onLoadedMetadata={handleVideoLoaded}
                  onTimeUpdate={handleTimeUpdate}
                  onEnded={() => setIsPlaying(false)}
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
              </div>

              {/* Playback row */}
              <div className="flex items-center gap-3 flex-wrap">
                <Button size="sm" variant="outline" onClick={togglePlay} className="w-22 shrink-0">
                  {isPlaying
                    ? <><Pause className="h-3.5 w-3.5 mr-1.5" />Pause</>
                    : <><Play className="h-3.5 w-3.5 mr-1.5" />Play trim</>}
                </Button>
                <span className="text-xs font-mono text-muted-foreground tabular-nums">
                  {formatTime(currentTime)} / {formatTime(videoDuration)}
                </span>
                {/* Phase 4: Capture thumbnail at current frame */}
                {videoDuration > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCaptureThumb}
                    disabled={capturingThumb}
                    className="shrink-0"
                    title={`Capture thumbnail at ${formatTime(currentTime)}`}
                  >
                    {capturingThumb
                      ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Capturing…</>
                      : <><Camera className="h-3.5 w-3.5 mr-1.5" />Capture Thumbnail</>
                    }
                  </Button>
                )}
                {videoDuration > 0 && (
                  <Badge variant="secondary" className="ml-auto text-xs">
                    <Scissors className="h-3 w-3 mr-1" />
                    {formatTime(trimStart)} → {formatTime(trimEnd)} &nbsp;·&nbsp; {formatTime(trimDuration)}
                  </Badge>
                )}
              </div>

              {/* Phase 4: Thumbnail result */}
              {thumbError && (
                <div className="rounded-md bg-destructive/10 border border-destructive/20 p-2 text-xs text-destructive">
                  {thumbError}
                </div>
              )}
              {thumbResult && (
                <div className="rounded-lg bg-green-50 border border-green-200 p-3 flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={thumbResult.url}
                    alt="Thumbnail"
                    className="h-14 w-24 object-cover rounded border shrink-0"
                  />
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-xs font-medium text-green-800 truncate">{thumbResult.filename}</p>
                    <p className="text-[11px] text-green-700">Saved to Media library as image</p>
                  </div>
                  <button
                    onClick={() => setThumbResult(null)}
                    className="text-green-600 hover:text-green-800 shrink-0 text-lg leading-none"
                    title="Dismiss"
                  >
                    ×
                  </button>
                </div>
              )}

              {/* Timeline visualiser + sliders */}
              {videoDuration > 0 && (
                <div className="space-y-4 rounded-xl bg-muted/40 border p-4">
                  {/* Visual timeline bar */}
                  <div className="relative h-4 bg-muted rounded-full overflow-hidden cursor-pointer">
                    <div className="absolute inset-0 bg-muted-foreground/20 rounded-full" />
                    <div
                      className="absolute top-0 bottom-0 bg-primary/50 rounded-full"
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

                  {/* Start slider */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground">
                        Start — <strong className="text-foreground">{formatTime(trimStart)}</strong>
                      </Label>
                      <button
                        onClick={() => { setTrimStart(0); if (videoRef.current) videoRef.current.currentTime = 0; }}
                        className="text-[10px] text-primary hover:underline"
                      >
                        Reset to 0:00
                      </button>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={videoDuration}
                      step={0.1}
                      value={trimStart}
                      onChange={(e) => handleTrimStartChange(parseFloat(e.target.value))}
                      className="w-full accent-primary h-2"
                    />
                  </div>

                  {/* End slider */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground">
                        End — <strong className="text-foreground">{formatTime(trimEnd)}</strong>
                      </Label>
                      <button
                        onClick={() => setTrimEnd(videoDuration)}
                        className="text-[10px] text-primary hover:underline"
                      >
                        Reset to end
                      </button>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={videoDuration}
                      step={0.1}
                      value={trimEnd}
                      onChange={(e) => handleTrimEndChange(parseFloat(e.target.value))}
                      className="w-full accent-primary h-2"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Step 3: Color & Filters ── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-muted text-muted-foreground text-xs font-bold">3</span>
                <Palette className="h-4 w-4" /> Color &amp; Filters
                <Badge variant="secondary" className="text-[10px] ml-1">Optional</Badge>
              </CardTitle>
              <CardDescription>Apply a color grade and fine-tune with adjustment sliders</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">

              {/* Category tabs */}
              <div className="flex flex-wrap gap-1.5">
                {(['all', ...Object.keys(FILTER_CATEGORY_LABELS)] as (FilterCategory | 'all')[]).map(cat => (
                  <button
                    key={cat}
                    onClick={() => setFilterCategory(cat)}
                    className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
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
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                {VIDEO_FILTERS
                  .filter(f => filterCategory === 'all' || f.category === filterCategory)
                  .map(f => {
                    const isSelected = selectedFilterId === f.id;
                    return (
                      <button
                        key={f.id}
                        onClick={() => setSelectedFilterId(f.id)}
                        title={f.name}
                        className={`flex flex-col items-center gap-1 p-1.5 rounded-lg border transition-all ${
                          isSelected
                            ? 'border-primary ring-2 ring-primary/40 bg-primary/5'
                            : 'border-transparent hover:border-primary/30'
                        }`}
                      >
                        {/* Swatch — gradient approximation of a typical scene with CSS filter */}
                        <div
                          className="w-full aspect-square rounded-md overflow-hidden"
                          style={{
                            background: 'linear-gradient(135deg, #4a90a4 0%, #6cb86a 40%, #e8a435 100%)',
                            filter: f.cssPreview || 'none',
                          }}
                        />
                        <span className={`text-[10px] leading-tight text-center w-full truncate ${
                          isSelected ? 'text-primary font-semibold' : 'text-muted-foreground'
                        }`}>
                          {f.name}
                        </span>
                      </button>
                    );
                  })}
              </div>

              {/* Adjustment sliders */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold flex items-center gap-1.5">
                    <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
                    Adjustments
                  </span>
                  {hasActiveAdjustments(adjustments) && (
                    <button
                      onClick={handleResetAdjustments}
                      className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                    >
                      <RotateCcw className="h-3 w-3" /> Reset all
                    </button>
                  )}
                </div>

                {ADJUSTMENT_DEFS.map(def => {
                  const value = adjustments[def.key] ?? def.default;
                  const isChanged = value !== def.default;
                  return (
                    <div key={def.key} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium">{def.label}</label>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-xs tabular-nums w-8 text-right ${
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
                              <RotateCcw className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                      <input
                        type="range"
                        min={def.min}
                        max={def.max}
                        step={def.step}
                        value={value}
                        onChange={e => handleSetAdjustment(def.key, parseInt(e.target.value, 10))}
                        className="w-full h-1.5 appearance-none rounded-full bg-muted accent-primary cursor-pointer"
                      />
                      {def.min < 0 && (
                        <div className="flex justify-between text-[10px] text-muted-foreground/60">
                          <span>{def.min}</span>
                          <span>0</span>
                          <span>+{def.max}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

            </CardContent>
          </Card>

          {/* ── Step 4: Text Overlay ── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-muted text-muted-foreground text-xs font-bold">4</span>
                <Type className="h-4 w-4" /> Text overlay
                <Badge variant="secondary" className="text-[10px] ml-1">Optional</Badge>
              </CardTitle>
              <CardDescription>Burn a caption or title into the video</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Toggle */}
              <div className="flex items-center gap-3">
                <button
                  role="switch"
                  aria-checked={textEnabled}
                  onClick={() => setTextEnabled(!textEnabled)}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                    textEnabled ? 'bg-primary' : 'bg-muted-foreground/30'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      textEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
                <Label
                  className="text-sm cursor-pointer select-none"
                  onClick={() => setTextEnabled(!textEnabled)}
                >
                  Add text to video
                </Label>
              </div>

              {textEnabled && (
                <div className="space-y-4 pl-1 border-l-2 border-primary/20 ml-5 pt-1">
                  {/* Text input */}
                  <div className="space-y-1.5">
                    <Label htmlFor="studio-text" className="text-xs font-medium">Text content</Label>
                    <Input
                      id="studio-text"
                      value={textContent}
                      onChange={(e) => setTextContent(e.target.value)}
                      placeholder="e.g. Special offer — 20% off today!"
                      maxLength={100}
                      autoComplete="off"
                    />
                    <p className="text-[10px] text-muted-foreground text-right">{textContent.length}/100</p>
                  </div>

                  {/* Position + Color */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-medium">Position</Label>
                      {(['top', 'center', 'bottom'] as const).map((pos) => (
                        <label key={pos} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="radio"
                            name="text-pos"
                            value={pos}
                            checked={textPosition === pos}
                            onChange={() => setTextPosition(pos)}
                            className="accent-primary"
                          />
                          {pos.charAt(0).toUpperCase() + pos.slice(1)}
                        </label>
                      ))}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-medium">Color</Label>
                      {TEXT_COLORS.map((c) => (
                        <label key={c.value} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="radio"
                            name="text-color"
                            value={c.value}
                            checked={textColor === c.value}
                            onChange={() => setTextColor(c.value)}
                            className="accent-primary"
                          />
                          <span className={`inline-block w-3 h-3 rounded-full shrink-0 ${c.cls}`} />
                          {c.label}
                        </label>
                      ))}
                    </div>
                  </div>

                  {textContent.trim() && (
                    <p className="text-[11px] text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
                      Preview shown in the video player above ↑
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Step 5: Aspect Ratio ── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-muted text-muted-foreground text-xs font-bold">5</span>
                <Crop className="h-4 w-4" /> Aspect ratio
                <Badge variant="secondary" className="text-[10px] ml-1">Optional</Badge>
              </CardTitle>
              <CardDescription>Resize for a specific platform — center-crops the video</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {ASPECT_RATIOS.map((ar) => (
                  <button
                    key={ar.value}
                    onClick={() => setAspectRatio(ar.value)}
                    className={`rounded-xl border-2 p-3 text-left transition-all ${
                      aspectRatio === ar.value
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-muted hover:border-primary/40'
                    }`}
                  >
                    <div className="flex justify-center mb-2">
                      <div className={`border-2 border-current rounded-sm ${ar.shape} ${aspectRatio === ar.value ? 'border-primary text-primary' : 'border-muted-foreground/40'}`} />
                    </div>
                    <p className="text-xs font-semibold">{ar.label}</p>
                    <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{ar.desc}</p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* ── Step 6: Process ── */}
          <Card className={processing ? 'border-primary/40 shadow-sm' : ''}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-bold">6</span>
                <Sparkles className="h-4 w-4" /> Process & save
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Error */}
              {error && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              {/* Result */}
              {result ? (
                <div className="space-y-4">
                  <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-800 flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>
                      Done! Saved as <strong>{result.filename}</strong> in your Media library.
                    </span>
                  </div>
                  <div className="rounded-xl overflow-hidden bg-black aspect-video max-h-64 shadow-inner">
                    {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                    <video
                      key={result.url}
                      src={result.url}
                      className="w-full h-full object-contain"
                      controls
                      playsInline
                      preload="metadata"
                    />
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <a href={`${result.url}?download=true`}>
                      <Button variant="outline" size="sm">
                        <Download className="h-3.5 w-3.5 mr-1.5" /> Download
                      </Button>
                    </a>
                    <Link href={`/dashboard/bots/${botPageId}/post?mediaId=${result.mediaId}`}>
                      <Button size="sm">
                        <ChevronRight className="h-3.5 w-3.5 mr-1.5" /> Use in Post
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setShowCaptionForm(v => !v); setCaptions(null); setCaptionError(null); }}
                    >
                      <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                      {showCaptionForm ? 'Hide Captions' : 'Generate Caption'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setResult(null); setError(null);
                        setShowCaptionForm(false); setCaptions(null);
                        setSelectedFilterId('original'); setAdjustments({});
                      }}
                    >
                      <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Edit another
                    </Button>
                  </div>

                  {/* ── Phase 3: AI Caption Generator ── */}
                  {showCaptionForm && (
                    <div className="rounded-xl border bg-muted/30 p-4 space-y-4">
                      <p className="text-xs font-semibold flex items-center gap-1.5">
                        <MessageSquare className="h-3.5 w-3.5 text-primary" />
                        Generate post captions for this video
                      </p>

                      {/* Platform toggles */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Platforms</Label>
                        <div className="flex flex-wrap gap-2">
                          {['INSTAGRAM', 'TIKTOK', 'FACEBOOK', 'TWITTER', 'LINKEDIN', 'THREADS', 'YOUTUBE'].map(p => (
                            <button
                              key={p}
                              onClick={() => toggleCaptionPlatform(p)}
                              className={`text-[11px] px-2.5 py-1 rounded-full border transition-all ${
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
                        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-2 text-xs text-destructive">
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
                          className="w-full gap-2"
                        >
                          {generatingCaptions
                            ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Generating captions…</>
                            : <><Sparkles className="h-3.5 w-3.5" />Generate Captions</>
                          }
                        </Button>
                      )}

                      {captions && Object.keys(captions).length > 0 && (
                        <div className="space-y-3">
                          {Object.entries(captions).map(([platform, caption]) => (
                            <div key={platform} className="space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                                  {platform}
                                </span>
                                <button
                                  onClick={() => handleCopyCaption(platform, caption)}
                                  className="text-[11px] flex items-center gap-1 text-primary hover:underline"
                                >
                                  <Copy className="h-3 w-3" />
                                  {copiedKey === platform ? 'Copied!' : 'Copy'}
                                </button>
                              </div>
                              <div className="rounded-md bg-background border p-2.5 text-xs whitespace-pre-wrap leading-relaxed">
                                {caption}
                              </div>
                            </div>
                          ))}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setCaptions(null); setCaptionError(null); }}
                            className="text-xs"
                          >
                            <RotateCcw className="h-3 w-3 mr-1.5" /> Regenerate
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Summary box */}
                  <div className="rounded-lg bg-muted/50 border p-4 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">What will be saved</p>
                    <ul className="space-y-1.5 text-sm">
                      <li className="flex items-start gap-2">
                        <Scissors className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                        <span>
                          Trim <strong>{formatTime(trimStart)}</strong> → <strong>{formatTime(trimEnd)}</strong>
                          {videoDuration > 0 && <span className="text-muted-foreground"> (keeping {formatTime(trimDuration)} of {formatTime(videoDuration)})</span>}
                        </span>
                      </li>
                      {selectedFilterId !== 'original' && (() => {
                        const preset = VIDEO_FILTERS.find(f => f.id === selectedFilterId);
                        return preset ? (
                          <li className="flex items-start gap-2">
                            <Palette className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                            <span>Filter: <strong>{preset.name}</strong></span>
                          </li>
                        ) : null;
                      })()}
                      {hasActiveAdjustments(adjustments) && (
                        <li className="flex items-start gap-2">
                          <SlidersHorizontal className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                          <span className="text-muted-foreground">{adjustmentSummary(adjustments)}</span>
                        </li>
                      )}
                      {textEnabled && textContent.trim() && (
                        <li className="flex items-start gap-2">
                          <Type className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                          <span>Text: <strong>"{textContent}"</strong> — {textPosition}, {textColor}</span>
                        </li>
                      )}
                      {aspectRatio !== 'original' && (
                        <li className="flex items-start gap-2">
                          <Crop className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                          <span>Aspect ratio: <strong>{aspectRatio}</strong></span>
                        </li>
                      )}
                    </ul>
                    <p className="text-[11px] text-muted-foreground mt-2">
                      The original video stays untouched. A new file is saved to your Media library.
                    </p>
                  </div>

                  <Button
                    onClick={handleProcess}
                    disabled={processing || !selectedVideoId}
                    size="lg"
                    className="w-full"
                  >
                    {processing ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing video…</>
                    ) : (
                      <><Scissors className="h-4 w-4 mr-2" />Process &amp; Save Video</>
                    )}
                  </Button>

                  {processing && (
                    <p className="text-xs text-center text-muted-foreground">
                      This may take 10–60 seconds depending on the video length. Please keep this page open.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
