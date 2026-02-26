'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Scissors, Type, Crop, Play, Pause, RotateCcw,
  Download, Film, CheckCircle2, Loader2, ChevronRight,
  Sparkles, Wand2, Camera, Copy, MessageSquare,
  Palette, SlidersHorizontal, Layers, MonitorPlay,
  Volume2, VolumeX, Plus, Trash2, ChevronDown, ChevronUp,
  Image, SkipBack, SkipForward, Gauge,
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
import { StudioTimeline } from '@/components/dashboard/studio-timeline';
import { PhotoEditorPanel } from '@/components/dashboard/photo-editor';
import {
  type TimelineState,
  type TimelineClip,
  type TrackType,
  createDefaultTimeline,
  computeTotalDuration,
  findNextAvailableTime,
  splitClipAtTime,
  genId,
} from '@/lib/timeline-types';

interface VideoMedia {
  id: string;
  filename: string;
  fileSize: number;
  width: number | null;
  height: number | null;
  createdAt: Date;
}

export type StudioMode = 'video' | 'photo';

interface StudioEditorProps {
  videos: VideoMedia[];
  images?: VideoMedia[];
  botId: string;
  botPageId: string;
  initialMode?: StudioMode;
}

interface SubtitleEntry {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
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

let _subIdCounter = 0;
function genSubId() { return `sub-${Date.now()}-${++_subIdCounter}`; }

const TEXT_COLORS = [
  { value: 'white', label: 'White', cls: 'bg-white border border-gray-300' },
  { value: 'yellow', label: 'Yellow', cls: 'bg-yellow-400' },
  { value: 'black', label: 'Black', cls: 'bg-gray-900' },
  { value: 'red', label: 'Red', cls: 'bg-red-500' },
  { value: 'cyan', label: 'Cyan', cls: 'bg-cyan-400' },
];

const ASPECT_RATIOS = [
  { value: 'original', label: 'Original', desc: 'Keep as-is', networks: '', shape: 'w-8 h-5', recommended: false },
  { value: '9:16', label: '9:16', desc: 'Vertical', networks: 'TikTok, Reels, Shorts, Stories', shape: 'w-4 h-7', recommended: true },
  { value: '1:1', label: '1:1', desc: 'Square', networks: 'Instagram Feed, Facebook, Twitter/X', shape: 'w-6 h-6', recommended: false },
  { value: '16:9', label: '16:9', desc: 'Landscape', networks: 'YouTube, LinkedIn, Twitter/X', shape: 'w-8 h-[18px]', recommended: false },
  { value: '4:5', label: '4:5', desc: 'Portrait', networks: 'Instagram Feed, Facebook Feed', shape: 'w-5 h-6', recommended: false },
  { value: '4:3', label: '4:3', desc: 'Classic', networks: 'Facebook, Presentations', shape: 'w-7 h-5', recommended: false },
];

const SPEED_OPTIONS = [
  { value: 0.25, label: '0.25x' },
  { value: 0.5, label: '0.5x' },
  { value: 0.75, label: '0.75x' },
  { value: 1, label: '1x' },
  { value: 1.25, label: '1.25x' },
  { value: 1.5, label: '1.5x' },
  { value: 2, label: '2x' },
  { value: 3, label: '3x' },
  { value: 4, label: '4x' },
];

const GEN_PLATFORMS = [
  { value: 'TIKTOK', label: 'TikTok' },
  { value: 'INSTAGRAM', label: 'Instagram' },
  { value: 'YOUTUBE', label: 'YouTube' },
  { value: 'FACEBOOK', label: 'Facebook' },
  { value: 'TWITTER', label: 'X / Twitter' },
  { value: 'THREADS', label: 'Threads' },
];

const FADE_OPTIONS = [0, 0.5, 1, 1.5, 2, 3];

export function StudioEditor({ videos: initialVideos, images: initialImages, botId, botPageId, initialMode = 'video' }: StudioEditorProps) {
  const [studioMode, setStudioMode] = useState<StudioMode>(initialMode);
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
    return () => { if (genPollRef.current) clearInterval(genPollRef.current); };
  }, []);

  // ── Video selection & playback ──
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  // ── Speed control ──
  const [speed, setSpeed] = useState(1);

  // ── Volume control ──
  const [volume, setVolume] = useState(100);
  const [muted, setMuted] = useState(false);

  // ── Fade in/out ──
  const [fadeIn, setFadeIn] = useState(0);
  const [fadeOut, setFadeOut] = useState(0);

  // ── Text overlay ──
  const [textEnabled, setTextEnabled] = useState(false);
  const [textContent, setTextContent] = useState('');
  const [textPosition, setTextPosition] = useState<'top' | 'center' | 'bottom'>('bottom');
  const [textColor, setTextColor] = useState('white');

  // ── Subtitles ──
  const [subtitles, setSubtitles] = useState<SubtitleEntry[]>([]);
  const [subtitleGenerating, setSubtitleGenerating] = useState(false);

  // ── Aspect ratio ──
  const [aspectRatio, setAspectRatio] = useState('original');

  // ── Processing ──
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ mediaId: string; url: string; filename: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Color & Filters ──
  const [selectedFilterId, setSelectedFilterId] = useState('original');
  const [filterCategory, setFilterCategory] = useState<FilterCategory | 'all'>('all');
  const [adjustments, setAdjustments] = useState<AdjustmentValues>({});
  const [showAdjustments, setShowAdjustments] = useState(false);

  // ── AI Caption Generator ──
  const [captionPlatforms, setCaptionPlatforms] = useState<string[]>(['INSTAGRAM', 'TIKTOK', 'FACEBOOK']);
  const [generatingCaptions, setGeneratingCaptions] = useState(false);
  const [captions, setCaptions] = useState<Record<string, string> | null>(null);
  const [captionError, setCaptionError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // ── Thumbnail ──
  const [capturingThumb, setCapturingThumb] = useState(false);
  const [thumbResult, setThumbResult] = useState<{ mediaId: string; url: string; filename: string } | null>(null);
  const [thumbError, setThumbError] = useState<string | null>(null);

  // ── Video loading & frame capture ──
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoLoadError, setVideoLoadError] = useState<string | null>(null);
  const [videoFrameUrl, setVideoFrameUrl] = useState<string | null>(null);

  // ── Timeline dragging (legacy single-clip) ──
  const [dragging, setDragging] = useState<'start' | 'end' | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  // ── Multi-track timeline ──
  const [timeline, setTimeline] = useState<TimelineState>(createDefaultTimeline);
  // Track durations of loaded video elements by mediaId
  const [mediaDurations, setMediaDurations] = useState<Record<string, number>>({});

  // ── Section collapse state ──
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const videoRef = useRef<HTMLVideoElement>(null);

  // ── Toggle section collapse ──
  const toggleSection = useCallback((key: string) => {
    setCollapsedSections(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // ── Video selection ──
  const handleVideoSelect = useCallback((videoId: string) => {
    if (processing) return;
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
    setSpeed(1);
    setVolume(100);
    setMuted(false);
    setFadeIn(0);
    setFadeOut(0);
    setSubtitles([]);
    setTextEnabled(false);
    setTextContent('');
  }, [processing]);

  // Record media durations when videos load (for timeline clip sizing)
  const handleVideoMetadataForTimeline = useCallback((videoId: string, duration: number) => {
    setMediaDurations(prev => ({ ...prev, [videoId]: duration }));
  }, []);

  // ── Capture video frame for filter swatches ──
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
    try { setVideoFrameUrl(canvas.toDataURL('image/jpeg', 0.7)); } catch { /* cross-origin */ }
  }, []);

  const handleVideoLoaded = useCallback(() => {
    if (videoRef.current) {
      const dur = videoRef.current.duration;
      if (isFinite(dur) && dur > 0) {
        setVideoDuration(dur);
        setTrimEnd(dur);
        // Also record for timeline
        if (selectedVideoId) {
          handleVideoMetadataForTimeline(selectedVideoId, dur);
        }
      }
      setVideoLoading(false);
      setVideoLoadError(null);
      setTimeout(() => captureVideoFrame(), 200);
    }
  }, [captureVideoFrame, selectedVideoId, handleVideoMetadataForTimeline]);

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
      if (videoRef.current.currentTime < trimStart || videoRef.current.currentTime >= trimEnd) {
        videoRef.current.currentTime = trimStart;
      }
      videoRef.current.play().catch(() => setIsPlaying(false));
      setIsPlaying(true);
    }
  }, [isPlaying, trimStart, trimEnd]);

  const handleTrimStartChange = useCallback((val: number) => {
    const clamped = Math.min(val, trimEnd - 0.5);
    setTrimStart(Math.max(0, clamped));
    if (videoRef.current) videoRef.current.currentTime = Math.max(0, clamped);
  }, [trimEnd]);

  const handleTrimEndChange = useCallback((val: number) => {
    const clamped = Math.max(val, trimStart + 0.5);
    setTrimEnd(Math.min(clamped, videoDuration));
  }, [trimStart, videoDuration]);

  // ── Live volume & speed sync ──
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = muted ? 0 : volume / 100;
    }
  }, [volume, muted]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  }, [speed]);

  // ── Timeline drag handlers (pointer events for mouse+touch) ──
  const getTimeFromPointer = useCallback((clientX: number) => {
    if (!timelineRef.current || videoDuration === 0) return 0;
    const rect = timelineRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return ratio * videoDuration;
  }, [videoDuration]);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => {
      const t = getTimeFromPointer(e.clientX);
      if (dragging === 'start') handleTrimStartChange(t);
      else handleTrimEndChange(t);
    };
    const onUp = () => setDragging(null);
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };
  }, [dragging, getTimeFromPointer, handleTrimStartChange, handleTrimEndChange]);

  const handleTimelineClick = useCallback((e: React.MouseEvent) => {
    if (dragging) return;
    const t = getTimeFromPointer(e.clientX);
    if (videoRef.current) {
      videoRef.current.currentTime = t;
      setCurrentTime(t);
    }
  }, [dragging, getTimeFromPointer]);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedVideoId || result) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
      if (e.code === 'KeyI') { e.preventDefault(); setTrimStart(currentTime); }
      if (e.code === 'KeyO') { e.preventDefault(); setTrimEnd(currentTime); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedVideoId, result, togglePlay, currentTime]);

  // ── AI generation helpers ──
  const addGeneratedVideo = useCallback((data: { id: string; filename?: string; fileSize?: number }) => {
    const newVideo: VideoMedia = {
      id: data.id, filename: data.filename || 'ai-generated.mp4',
      fileSize: data.fileSize || 0, width: null, height: null, createdAt: new Date(),
    };
    setVideos(prev => [newVideo, ...prev]);
    setGenerating(false);
    setGenProgress('');
    setSelectedVideoId(newVideo.id);
    setTrimStart(0); setTrimEnd(0); setVideoDuration(0); setCurrentTime(0);
    setIsPlaying(false); setResult(null); setError(null);
    setShowGenPanel(false); setSelectedFilterId('original'); setAdjustments({});
    setFilterCategory('all'); setCaptions(null); setCaptionError(null);
    setThumbResult(null); setThumbError(null);
    setVideoLoading(true); setVideoLoadError(null); setVideoFrameUrl(null);
    setSpeed(1); setVolume(100); setMuted(false);
    setFadeIn(0); setFadeOut(0); setSubtitles([]);
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!genPrompt.trim()) return;
    if (genPollRef.current) { clearInterval(genPollRef.current); genPollRef.current = null; }
    setGenerating(true); setGenError(null); setGenProgress('Starting video generation...');
    try {
      const res = await fetch('/api/generate/video', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botId, platform: genPlatform, prompt: genPrompt.trim(), modelId: genModelId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      if (data.status === 'succeeded') { addGeneratedVideo(data); return; }
      const predictionId = data.predictionId;
      if (!predictionId) throw new Error('Server did not return a prediction ID');
      const modelName = VIDEO_MODELS.find(m => m.id === genModelId)?.name || 'AI';
      setGenProgress(`${modelName}: video is generating…`);
      let polls = 0;
      genPollRef.current = setInterval(async () => {
        polls++;
        if (polls > 120) { clearInterval(genPollRef.current!); setGenerating(false); setGenError('Timed out after 10 minutes.'); return; }
        try {
          const pollRes = await fetch(`/api/generate/video?predictionId=${encodeURIComponent(predictionId)}`);
          const pollData = await pollRes.json();
          if (pollData.status === 'succeeded') { clearInterval(genPollRef.current!); addGeneratedVideo(pollData); }
          else if (pollData.status === 'failed' || pollData.status === 'cancelled') { clearInterval(genPollRef.current!); setGenerating(false); setGenError(pollData.error || 'Video generation failed.'); }
          else { setGenProgress((pollData.progress || `${modelName}: generating…`) + ` (${Math.round(polls * 5)}s)`); }
        } catch { /* transient */ }
      }, 5000);
    } catch (err) { setGenerating(false); setGenError(err instanceof Error ? err.message : 'Generation failed'); }
  }, [botId, genModelId, genPlatform, genPrompt, addGeneratedVideo]);

  // ── Color & Filters handlers ──
  const handleSetAdjustment = useCallback((key: string, value: number) => {
    setAdjustments(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleResetAdjustments = useCallback(() => { setAdjustments({}); }, []);

  // ── AI captions ──
  const handleGenerateCaptions = useCallback(async (mediaId: string, videoDescription?: string) => {
    setGeneratingCaptions(true); setCaptionError(null); setCaptions(null);
    try {
      const res = await fetch('/api/studio/caption', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaId, botId, platforms: captionPlatforms, videoDescription }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Caption generation failed');
      setCaptions(data.captions || {});
    } catch (err) { setCaptionError(err instanceof Error ? err.message : 'Caption generation failed'); }
    finally { setGeneratingCaptions(false); }
  }, [botId, captionPlatforms]);

  const handleCopyCaption = useCallback((platform: string, text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedKey(platform); setTimeout(() => setCopiedKey(null), 2000);
  }, []);

  const toggleCaptionPlatform = useCallback((platform: string) => {
    setCaptionPlatforms(prev => prev.includes(platform) ? prev.filter(p => p !== platform) : [...prev, platform]);
  }, []);

  // ── Thumbnail extraction ──
  const handleCaptureThumb = useCallback(async () => {
    if (!selectedVideoId) return;
    setCapturingThumb(true); setThumbError(null); setThumbResult(null);
    try {
      const res = await fetch('/api/studio/thumbnail', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaId: selectedVideoId, botId, timestamp: Math.round(currentTime * 100) / 100 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Thumbnail capture failed');
      setThumbResult(data);
    } catch (err) { setThumbError(err instanceof Error ? err.message : 'Thumbnail capture failed'); }
    finally { setCapturingThumb(false); }
  }, [selectedVideoId, botId, currentTime]);

  // ── Subtitle handlers ──
  const addSubtitle = useCallback(() => {
    const start = currentTime;
    const end = Math.min(start + 3, videoDuration);
    setSubtitles(prev => [...prev, { id: genSubId(), text: '', startTime: start, endTime: end }]);
  }, [currentTime, videoDuration]);

  const updateSubtitle = useCallback((id: string, field: keyof SubtitleEntry, value: string | number) => {
    setSubtitles(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  }, []);

  const removeSubtitle = useCallback((id: string) => {
    setSubtitles(prev => prev.filter(s => s.id !== id));
  }, []);

  const handleAISubtitles = useCallback(async () => {
    if (!selectedVideoId || videoDuration === 0) return;
    setSubtitleGenerating(true);
    try {
      const res = await fetch('/api/studio/caption', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaId: selectedVideoId, botId,
          platforms: ['TIKTOK'],
          videoDescription: videos.find(v => v.id === selectedVideoId)?.filename?.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'AI suggestion failed');
      const captionText = data.captions?.TIKTOK || Object.values(data.captions || {})[0] || '';
      if (!captionText) return;
      const sentences = captionText.split(/[.!?\n]+/).filter((s: string) => s.trim().length > 2);
      if (sentences.length === 0) return;
      const segDur = Math.min(videoDuration / sentences.length, 5);
      const newSubs = sentences.slice(0, 10).map((text: string, i: number) => ({
        id: genSubId(),
        text: text.trim(),
        startTime: Math.round(i * segDur * 10) / 10,
        endTime: Math.round((i + 1) * segDur * 10) / 10,
      }));
      setSubtitles(prev => [...prev, ...newSubs]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI subtitle suggestion failed');
    } finally { setSubtitleGenerating(false); }
  }, [selectedVideoId, botId, videos, videoDuration]);

  // ── Multi-track timeline handlers ──

  const handleAddToTimeline = useCallback((video: VideoMedia) => {
    const dur = mediaDurations[video.id] || 10; // fallback 10s if not loaded
    setTimeline(prev => {
      const tracks = prev.tracks.map(t => ({ ...t, clips: [...t.clips] }));
      // Find V1 track (or first video track)
      const v1 = tracks.find(t => t.type === 'video') || tracks[0];
      if (!v1) return prev;

      const startTime = findNextAvailableTime(v1, dur);
      const newClip: TimelineClip = {
        id: genId('clip'),
        mediaId: video.id,
        trackId: v1.id,
        startTime,
        duration: dur,
        mediaOffset: 0,
        mediaDuration: dur,
        filename: video.filename,
      };
      v1.clips.push(newClip);
      const totalDuration = computeTotalDuration(tracks);
      return { ...prev, tracks, totalDuration, selectedClipId: newClip.id };
    });
  }, [mediaDurations]);

  const handleTimelineChange = useCallback((newTimeline: TimelineState) => {
    setTimeline(newTimeline);
  }, []);

  const handlePlayheadChange = useCallback((time: number) => {
    setTimeline(prev => ({ ...prev, playheadPosition: time }));
    // Seek the video if current clip is under playhead
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  const handleClipSelect = useCallback((clipId: string | null) => {
    setTimeline(prev => ({ ...prev, selectedClipId: clipId }));
    // If selecting a clip, also select its video for preview
    if (clipId) {
      const clip = timeline.tracks.flatMap(t => t.clips).find(c => c.id === clipId);
      if (clip && clip.mediaId !== selectedVideoId) {
        setSelectedVideoId(clip.mediaId);
        setVideoLoading(true);
        setVideoLoadError(null);
        setVideoFrameUrl(null);
        setResult(null);
        setError(null);
      }
    }
  }, [timeline.tracks, selectedVideoId]);

  const handleClipDelete = useCallback((clipId: string) => {
    setTimeline(prev => {
      const tracks = prev.tracks.map(t => ({
        ...t,
        clips: t.clips.filter(c => c.id !== clipId),
      }));
      return {
        ...prev,
        tracks,
        totalDuration: computeTotalDuration(tracks),
        selectedClipId: prev.selectedClipId === clipId ? null : prev.selectedClipId,
      };
    });
  }, []);

  const handleClipSplit = useCallback((clipId: string, time: number) => {
    setTimeline(prev => {
      const tracks = prev.tracks.map(t => ({ ...t, clips: [...t.clips] }));
      for (const track of tracks) {
        const idx = track.clips.findIndex(c => c.id === clipId);
        if (idx === -1) continue;
        const result = splitClipAtTime(track.clips[idx], time);
        if (!result) return prev;
        const [first, second] = result;
        first.trackId = track.id;
        second.trackId = track.id;
        track.clips.splice(idx, 1, first, second);
        return {
          ...prev,
          tracks,
          totalDuration: computeTotalDuration(tracks),
          selectedClipId: second.id,
        };
      }
      return prev;
    });
  }, []);

  const handleAddTrack = useCallback((type: TrackType) => {
    setTimeline(prev => {
      const count = prev.tracks.filter(t => t.type === type).length + 1;
      const prefix = type === 'video' ? 'V' : type === 'audio' ? 'A' : 'T';
      const newTrack = {
        id: genId(prefix.toLowerCase()),
        type,
        name: `${prefix}${count}`,
        clips: [],
        muted: false,
        locked: false,
        height: type === 'text' ? 36 : 48,
      };
      return { ...prev, tracks: [...prev.tracks, newTrack] };
    });
  }, []);

  // Update playhead from video timeupdate
  useEffect(() => {
    if (!videoRef.current) return;
    const onTimeUpdate = () => {
      if (videoRef.current) {
        const t = videoRef.current.currentTime;
        setTimeline(prev => ({ ...prev, playheadPosition: t }));
      }
    };
    const video = videoRef.current;
    video.addEventListener('timeupdate', onTimeUpdate);
    return () => video.removeEventListener('timeupdate', onTimeUpdate);
  }, [selectedVideoId]);

  // ── Process & Save ──
  const timelineHasClips = timeline.tracks.some(t => t.clips.length > 0);

  const handleProcess = async () => {
    if (!selectedVideoId && !timelineHasClips) return;
    setProcessing(true); setError(null); setResult(null);
    try {
      const body: Record<string, unknown> = {
        mediaId: selectedVideoId || '', botId,
        trim: { start: Math.round(trimStart * 100) / 100, end: Math.round(trimEnd * 100) / 100 },
      };
      if (selectedFilterId !== 'original') body.filterId = selectedFilterId;
      if (hasActiveAdjustments(adjustments)) body.adjustments = adjustments;
      if (textEnabled && textContent.trim()) {
        body.textOverlay = { text: textContent.trim(), position: textPosition, color: textColor, fontSize: 48 };
      }
      if (aspectRatio !== 'original') body.aspectRatio = aspectRatio;
      if (speed !== 1) body.speed = speed;
      if (volume < 100 || muted) body.volume = muted ? 0 : volume;
      if (fadeIn > 0) body.fadeIn = fadeIn;
      if (fadeOut > 0) body.fadeOut = fadeOut;
      if (subtitles.length > 0) {
        body.subtitles = subtitles.filter(s => s.text.trim()).map(s => ({
          text: s.text.trim(),
          startTime: Math.round(s.startTime * 100) / 100,
          endTime: Math.round(s.endTime * 100) / 100,
        }));
      }
      // Include multi-track timeline clips if any
      if (timelineHasClips) {
        const videoClips = timeline.tracks
          .filter(t => t.type === 'video' && !t.muted)
          .flatMap(t => t.clips)
          .sort((a, b) => a.startTime - b.startTime)
          .map(c => ({
            mediaId: c.mediaId,
            startTime: Math.round(c.startTime * 100) / 100,
            duration: Math.round(c.duration * 100) / 100,
            mediaOffset: Math.round(c.mediaOffset * 100) / 100,
          }));
        if (videoClips.length > 0) {
          body.timelineClips = videoClips;
          // Use the first clip's mediaId as the primary media
          body.mediaId = videoClips[0].mediaId;
        }
        const textClips = timeline.tracks
          .filter(t => t.type === 'text' && !t.muted)
          .flatMap(t => t.clips)
          .filter(c => c.text && c.text.trim())
          .map(c => ({
            text: c.text!.trim(),
            startTime: Math.round(c.startTime * 100) / 100,
            endTime: Math.round((c.startTime + c.duration) * 100) / 100,
            color: c.textColor || 'white',
            position: c.textPosition || 'bottom',
          }));
        if (textClips.length > 0) body.timelineTextClips = textClips;
      }
      const resp = await fetch('/api/studio/process', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Processing failed');
      setResult(data);
    } catch (err) { setError(err instanceof Error ? err.message : 'Processing failed'); }
    finally { setProcessing(false); }
  };

  // ── Computed values ──
  const trimDuration = trimEnd - trimStart;
  const selectedVideo = videos.find(v => v.id === selectedVideoId);
  const textPreviewY = textPosition === 'top' ? 'top-3' : textPosition === 'center' ? 'top-1/2 -translate-y-1/2' : 'bottom-3';

  // Live CSS filter preview for the video element
  const liveFilterCss = useMemo(() => {
    const parts: string[] = [];
    const preset = VIDEO_FILTERS.find(f => f.id === selectedFilterId);
    if (preset?.cssPreview) parts.push(preset.cssPreview);
    const br = adjustments['brightness'] ?? 0;
    if (br !== 0) parts.push(`brightness(${(1 + br / 200).toFixed(3)})`);
    const co = adjustments['contrast'] ?? 0;
    if (co !== 0) parts.push(`contrast(${(1 + co / 100).toFixed(3)})`);
    const sa = adjustments['saturation'] ?? 0;
    if (sa !== 0) parts.push(`saturate(${(1 + sa / 100).toFixed(3)})`);
    const warmth = adjustments['warmth'] ?? 0;
    if (warmth > 0) parts.push(`sepia(${(warmth / 400).toFixed(3)})`);
    else if (warmth < 0) parts.push(`hue-rotate(${Math.round(warmth / 8)}deg)`);
    return parts.join(' ') || 'none';
  }, [selectedFilterId, adjustments]);

  const filterSwatchBg = videoFrameUrl
    ? `url(${videoFrameUrl})`
    : 'linear-gradient(to bottom right, #5B86C5 0%, #A7C7E7 18%, #D4956B 32%, #8FBC5A 48%, #D4A76A 62%, #7B5B3A 78%, #2D2D2D 100%)';

  // Active subtitles at current time
  const activeSubtitles = subtitles.filter(s => currentTime >= s.startTime && currentTime < s.endTime && s.text.trim());

  // Edit summary
  const editSummary: string[] = [];
  if (videoDuration > 0 && (trimStart > 0.1 || trimEnd < videoDuration - 0.1)) editSummary.push(`Trim: ${formatTime(trimStart)}→${formatTime(trimEnd)}`);
  if (selectedFilterId !== 'original') { const p = VIDEO_FILTERS.find(f => f.id === selectedFilterId); if (p) editSummary.push(`Filter: ${p.name}`); }
  if (hasActiveAdjustments(adjustments)) editSummary.push(adjustmentSummary(adjustments));
  if (textEnabled && textContent.trim()) editSummary.push(`Text: "${textContent.length > 20 ? textContent.slice(0, 20) + '…' : textContent}"`);
  if (subtitles.filter(s => s.text.trim()).length > 0) editSummary.push(`Subtitles: ${subtitles.filter(s => s.text.trim()).length}`);
  if (aspectRatio !== 'original') editSummary.push(`Ratio: ${aspectRatio}`);
  if (speed !== 1) editSummary.push(`Speed: ${speed}x`);
  if (muted || volume < 100) editSummary.push(`Vol: ${muted ? 'Muted' : volume + '%'}`);
  if (fadeIn > 0) editSummary.push(`Fade In: ${fadeIn}s`);
  if (fadeOut > 0) editSummary.push(`Fade Out: ${fadeOut}s`);

  // ── Media pool collapsed state ──
  const [mediaPoolOpen, setMediaPoolOpen] = useState(true);

  // ── Section Header helper ──
  const SectionHead = ({ id, icon: Icon, title, badge }: { id: string; icon: typeof Scissors; title: string; badge?: string }) => (
    <button
      onClick={() => toggleSection(id)}
      className="flex items-center justify-between w-full py-2.5 px-1 text-left group"
    >
      <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground group-hover:text-foreground transition-colors">
        <Icon className="h-4 w-4 text-primary" />
        {title}
        {badge && <Badge variant="secondary" className="text-xs px-1.5 py-0">{badge}</Badge>}
      </span>
      {collapsedSections[id] ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />}
    </button>
  );

  // ═══════════ RENDER ═══════════

  // ── Mode toggle ──
  const modeToggle = (
    <div className="flex items-center bg-muted rounded-lg p-0.5 gap-0.5">
      <button
        onClick={() => setStudioMode('video')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
          studioMode === 'video'
            ? 'bg-background text-primary shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <Film className="h-3.5 w-3.5" /> Video
      </button>
      <button
        onClick={() => setStudioMode('photo')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
          studioMode === 'photo'
            ? 'bg-background text-primary shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <Image className="h-3.5 w-3.5" /> Photo
      </button>
    </div>
  );

  // ── Photo mode: render the photo editor ──
  if (studioMode === 'photo') {
    return (
      <div className="flex flex-col" style={{ height: 'calc(100vh - 10rem)' }}>
        <div className="flex items-center justify-between gap-3 pb-3 border-b flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {modeToggle}
          </div>
        </div>
        <div className="flex-1 min-h-0 mt-3">
          <PhotoEditorPanel images={initialImages ?? []} botId={botId} botPageId={botPageId} />
        </div>
      </div>
    );
  }

  // ── Video mode: empty state ──
  if (videos.length === 0 && !showGenPanel) {
    return (
      <div className="flex flex-col" style={{ height: 'calc(100vh - 10rem)' }}>
        <div className="flex items-center gap-3 pb-3 border-b flex-shrink-0">
          {modeToggle}
        </div>
        <div className="text-center py-16">
          <Film className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-lg font-medium">No videos yet</p>
          <p className="text-sm text-muted-foreground mt-2 mb-6">
            Upload a video in your{' '}
            <Link href={`/dashboard/bots/${botPageId}/media`} className="text-primary underline">Media library</Link>
            {' '}or generate one with AI to start editing.
          </p>
          <Button onClick={() => setShowGenPanel(true)} className="gap-2"><Wand2 className="h-4 w-4" /> Generate Video with AI</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 10rem)' }}>
      {/* ══════════════ HEADER BAR ══════════════ */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {modeToggle}
          <span className="text-sm font-semibold truncate">{selectedVideo ? selectedVideo.filename : 'Select a video'}</span>
          {selectedVideo && selectedVideo.width && selectedVideo.height && (
            <Badge variant="outline" className="text-xs shrink-0">{selectedVideo.width}×{selectedVideo.height}</Badge>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {result ? (
            <>
              <a href={`${result.url}?download=true`}>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs"><Download className="h-4 w-4" /> Download</Button>
              </a>
              <Link href={`/dashboard/bots/${botPageId}/post?mediaId=${result.mediaId}`}>
                <Button size="sm" className="gap-1.5 text-xs"><ChevronRight className="h-4 w-4" /> Use in Post</Button>
              </Link>
              <Button variant="ghost" size="sm" onClick={() => { setResult(null); setError(null); setCaptions(null); setSelectedFilterId('original'); setAdjustments({}); }} className="gap-1.5 text-xs">
                <RotateCcw className="h-4 w-4" /> Edit more
              </Button>
            </>
          ) : (
            <Button onClick={handleProcess} disabled={processing || (!selectedVideoId && !timelineHasClips)} size="sm" className="gap-1.5 text-xs">
              {processing ? <><Loader2 className="h-4 w-4 animate-spin" /> Processing…</> : <><Sparkles className="h-4 w-4" /> Process &amp; Save</>}
            </Button>
          )}
        </div>
      </div>

      {/* ══════════════ MAIN 2-COLUMN LAYOUT (Preview + Tools) ══════════════ */}
      <div className="flex flex-col md:flex-row flex-1 min-h-0 gap-0 mt-3">

        {/* ── LEFT: Video Preview (takes most space) ── */}
        <div className="flex-1 flex flex-col bg-black/95 border rounded-tl-lg min-w-0">
          {selectedVideoId && selectedVideo ? (
            <>
              {/* Video Player — larger preview area */}
              <div className="flex-1 relative flex items-center justify-center overflow-hidden min-h-0">
                {result ? (
                  <>
                    {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                    <video key={result.url} src={result.url} className="max-w-full max-h-full object-contain" controls playsInline preload="metadata" />
                    <div className="absolute top-3 left-3">
                      <Badge className="bg-green-600 text-white text-xs"><CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Saved: {result.filename}</Badge>
                    </div>
                  </>
                ) : (
                  <>
                    {videoLoading && <div className="absolute inset-0 flex items-center justify-center z-10"><Loader2 className="h-10 w-10 text-white/60 animate-spin" /></div>}
                    {videoLoadError && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center z-10 text-red-400 px-6">
                        <Film className="h-12 w-12 mb-2 opacity-50" /><p className="text-sm text-center">{videoLoadError}</p>
                      </div>
                    )}
                    {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                    <video ref={videoRef} key={selectedVideoId} src={`/api/media/${selectedVideoId}`}
                      className="max-w-full max-h-full object-contain transition-[filter] duration-200"
                      style={{ filter: liveFilterCss }}
                      onLoadedMetadata={handleVideoLoaded} onTimeUpdate={handleTimeUpdate}
                      onEnded={() => setIsPlaying(false)} onError={handleVideoError} playsInline preload="metadata" />
                    {/* Text overlay preview */}
                    {textEnabled && textContent.trim() && (
                      <div className={`absolute left-0 right-0 pointer-events-none flex justify-center px-4 ${textPreviewY}`}>
                        <span className="text-center text-base font-bold px-4 py-2 rounded shadow-lg max-w-full break-words"
                          style={{ color: textColor === 'black' ? '#000' : textColor === 'yellow' ? '#facc15' : textColor === 'red' ? '#ef4444' : textColor === 'cyan' ? '#22d3ee' : '#fff', backgroundColor: 'rgba(0,0,0,0.55)' }}>
                          {textContent}
                        </span>
                      </div>
                    )}
                    {/* Subtitle overlay preview */}
                    {activeSubtitles.map((sub) => (
                      <div key={sub.id} className="absolute bottom-14 left-0 right-0 pointer-events-none flex justify-center px-4">
                        <span className="text-center text-base font-bold px-4 py-2 rounded shadow-lg max-w-[80%] break-words"
                          style={{ color: '#fff', backgroundColor: 'rgba(0,0,0,0.6)' }}>
                          {sub.text}
                        </span>
                      </div>
                    ))}
                    {/* Fade overlay indicators */}
                    {fadeIn > 0 && currentTime < trimStart + fadeIn && (
                      <div className="absolute inset-0 pointer-events-none bg-black transition-opacity"
                        style={{ opacity: Math.max(0, 1 - (currentTime - trimStart) / fadeIn) }} />
                    )}
                  </>
                )}
              </div>

              {/* ── Playback controls bar ── */}
              <div className="flex items-center gap-2 px-4 py-2 bg-black/80 border-t border-white/10 shrink-0">
                <Button size="sm" variant="ghost" className="text-white hover:bg-white/10 h-8 w-8 p-0"
                  disabled={!!result} onClick={() => { if (videoRef.current) { videoRef.current.currentTime = Math.max(0, currentTime - 5); } }}>
                  <SkipBack className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={togglePlay} className="text-white hover:bg-white/10 h-9 w-9 p-0" disabled={!!result}>
                  {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                </Button>
                <Button size="sm" variant="ghost" className="text-white hover:bg-white/10 h-8 w-8 p-0"
                  disabled={!!result} onClick={() => { if (videoRef.current) { videoRef.current.currentTime = Math.min(videoDuration, currentTime + 5); } }}>
                  <SkipForward className="h-4 w-4" />
                </Button>
                <span className="text-xs font-mono text-white/80 tabular-nums ml-1">{formatTime(currentTime)} / {formatTime(videoDuration)}</span>

                <div className="flex-1" />

                {/* Volume */}
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setMuted(m => !m)} className="text-white/70 hover:text-white p-1">
                    {muted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                  </button>
                  <input type="range" min={0} max={100} step={1} value={muted ? 0 : volume}
                    onChange={e => { setVolume(parseInt(e.target.value, 10)); setMuted(false); }}
                    className="w-20 h-1 accent-white appearance-none rounded-full bg-white/20 cursor-pointer" />
                </div>

                {/* Speed */}
                <select value={speed} onChange={e => setSpeed(parseFloat(e.target.value))}
                  className="bg-transparent text-white/80 text-xs border-none outline-none cursor-pointer h-8 px-1">
                  {SPEED_OPTIONS.map(s => <option key={s.value} value={s.value} className="bg-gray-900 text-white">{s.label}</option>)}
                </select>

                {/* Thumbnail */}
                {videoDuration > 0 && !result && (
                  <Button size="sm" variant="ghost" onClick={handleCaptureThumb} disabled={capturingThumb}
                    className="text-white/70 hover:bg-white/10 hover:text-white gap-1.5 text-xs h-8">
                    {capturingThumb ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Capture</> : <><Camera className="h-3.5 w-3.5" /> Thumbnail</>}
                  </Button>
                )}
              </div>

              {/* Toast notifications */}
              {thumbResult && (
                <div className="flex items-center gap-2 px-4 py-2 bg-green-900/80 text-green-200 text-xs shrink-0">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">Thumbnail saved: {thumbResult.filename}</span>
                  <button onClick={() => setThumbResult(null)} className="ml-auto text-green-400 hover:text-white shrink-0">×</button>
                </div>
              )}
              {thumbError && (
                <div className="flex items-center gap-2 px-4 py-2 bg-red-900/80 text-red-200 text-xs shrink-0">
                  <span className="truncate">{thumbError}</span>
                  <button onClick={() => setThumbError(null)} className="ml-auto text-red-400 hover:text-white shrink-0">×</button>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-white/40">
              <Film className="h-20 w-20 mb-4" />
              <p className="text-base font-medium">Select a video from the Media Pool</p>
              <p className="text-sm mt-1 text-white/30">or add clips to the timeline below</p>
            </div>
          )}
        </div>

        {/* ── RIGHT: Tools Panel (scrollable) ── */}
        <div className="w-full md:w-72 lg:w-80 shrink-0 flex flex-col border rounded-tr-lg bg-card overflow-hidden max-h-72 md:max-h-none">
          <div className="flex items-center px-3 py-2.5 border-b bg-muted/40 shrink-0">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4" /> Tools
            </span>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="divide-y">

              {/* ══════════ FILTERS & COLOR ══════════ */}
              <div className="px-3">
                <SectionHead id="filters" icon={Palette} title="Filters & Color" badge={selectedFilterId !== 'original' ? VIDEO_FILTERS.find(f => f.id === selectedFilterId)?.name : undefined} />
                {!collapsedSections['filters'] && (
                  <div className="pb-3 space-y-3">
                    {/* Category tabs */}
                    <div className="flex flex-wrap gap-1">
                      {(['all', ...Object.keys(FILTER_CATEGORY_LABELS)] as (FilterCategory | 'all')[]).map(cat => (
                        <button key={cat} onClick={() => setFilterCategory(cat)}
                          className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                            filterCategory === cat ? 'bg-primary text-primary-foreground border-primary' : 'border-input text-muted-foreground hover:border-primary/40'
                          }`}>
                          {cat === 'all' ? 'All' : FILTER_CATEGORY_LABELS[cat as FilterCategory]}
                        </button>
                      ))}
                    </div>
                    {/* Filter gallery */}
                    <div className="grid grid-cols-4 gap-1.5">
                      {VIDEO_FILTERS.filter(f => filterCategory === 'all' || f.category === filterCategory).map(f => {
                        const isSelected = selectedFilterId === f.id;
                        return (
                          <button key={f.id} onClick={() => setSelectedFilterId(f.id)} title={f.name}
                            className={`flex flex-col items-center gap-0.5 p-1 rounded-md border transition-all ${
                              isSelected ? 'border-primary ring-1 ring-primary/40 bg-primary/5' : 'border-transparent hover:border-primary/30'
                            }`}>
                            <div className="w-full aspect-square rounded overflow-hidden bg-cover bg-center"
                              style={{ backgroundImage: filterSwatchBg, filter: f.cssPreview || 'none' }} />
                            <span className={`text-xs leading-tight text-center w-full truncate ${isSelected ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>{f.name}</span>
                          </button>
                        );
                      })}
                    </div>
                    {/* Adjustments (collapsible sub-section) */}
                    <button onClick={() => setShowAdjustments(v => !v)}
                      className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground w-full">
                      <SlidersHorizontal className="h-3 w-3 text-primary" />
                      Adjustments
                      {hasActiveAdjustments(adjustments) && <Badge variant="secondary" className="text-xs px-1 py-0 ml-1">Active</Badge>}
                      {showAdjustments ? <ChevronUp className="h-3 w-3 ml-auto" /> : <ChevronDown className="h-3 w-3 ml-auto" />}
                    </button>
                    {showAdjustments && (
                      <div className="space-y-2">
                        {hasActiveAdjustments(adjustments) && (
                          <button onClick={handleResetAdjustments} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5">
                            <RotateCcw className="h-2.5 w-2.5" /> Reset All
                          </button>
                        )}
                        {ADJUSTMENT_DEFS.map(def => {
                          const value = adjustments[def.key] ?? def.default;
                          const isChanged = value !== def.default;
                          return (
                            <div key={def.key} className="space-y-0.5">
                              <div className="flex items-center justify-between">
                                <label className="text-xs">{def.label}</label>
                                <div className="flex items-center gap-1">
                                  <span className={`text-xs tabular-nums w-7 text-right ${isChanged ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>
                                    {value > 0 ? `+${value}` : value}
                                  </span>
                                  {isChanged && (
                                    <button onClick={() => handleSetAdjustment(def.key, def.default)} className="text-muted-foreground hover:text-foreground shrink-0" title={`Reset ${def.label}`}>
                                      <RotateCcw className="h-2.5 w-2.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                              <input type="range" min={def.min} max={def.max} step={def.step} value={value}
                                onChange={e => handleSetAdjustment(def.key, parseInt(e.target.value, 10))}
                                className="w-full h-1 appearance-none rounded-full bg-muted accent-primary cursor-pointer" />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ══════════ TEXT OVERLAY ══════════ */}
              <div className="px-3">
                <SectionHead id="text" icon={Type} title="Text Overlay" badge={textEnabled && textContent.trim() ? 'On' : undefined} />
                {!collapsedSections['text'] && (
                  <div className="pb-3 space-y-3">
                    <div className="flex items-center gap-3">
                      <button role="switch" aria-checked={textEnabled} onClick={() => setTextEnabled(!textEnabled)}
                        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${textEnabled ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${textEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </button>
                      <Label className="text-xs cursor-pointer" onClick={() => setTextEnabled(!textEnabled)}>Add text to video</Label>
                    </div>
                    {textEnabled && (
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <Label htmlFor="studio-text" className="text-xs font-medium">Text</Label>
                          <Input id="studio-text" value={textContent} onChange={(e) => setTextContent(e.target.value)}
                            placeholder="e.g. Special offer — 20% off!" maxLength={100} autoComplete="off" className="h-8 text-xs" />
                          <p className="text-xs text-muted-foreground text-right">{textContent.length}/100</p>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium">Position</Label>
                          <div className="flex gap-1.5">
                            {(['top', 'center', 'bottom'] as const).map((pos) => (
                              <button key={pos} onClick={() => setTextPosition(pos)}
                                className={`flex-1 text-xs py-1.5 rounded-md border transition-colors ${
                                  textPosition === pos ? 'bg-primary text-primary-foreground border-primary' : 'border-input text-muted-foreground hover:border-primary/40'
                                }`}>{pos.charAt(0).toUpperCase() + pos.slice(1)}</button>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium">Color</Label>
                          <div className="flex flex-wrap gap-1.5">
                            {TEXT_COLORS.map((c) => (
                              <button key={c.value} onClick={() => setTextColor(c.value)}
                                className={`flex items-center gap-1 px-2 py-1 rounded-md border text-xs transition-colors ${
                                  textColor === c.value ? 'border-primary bg-primary/5' : 'border-input hover:border-primary/40'
                                }`}>
                                <span className={`inline-block w-3 h-3 rounded-full shrink-0 ${c.cls}`} />
                                {c.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ══════════ SUBTITLES ══════════ */}
              <div className="px-3">
                <SectionHead id="subtitles" icon={MessageSquare} title="Subtitles" badge={subtitles.length > 0 ? `${subtitles.length}` : undefined} />
                {!collapsedSections['subtitles'] && (
                  <div className="pb-3 space-y-3">
                    <p className="text-xs text-muted-foreground">Add burned-in subtitles. Drag timeline to set timing, then add text.</p>
                    {/* Subtitle entries */}
                    {subtitles.map((sub, idx) => (
                      <div key={sub.id} className="space-y-1.5 p-2 rounded-md border bg-muted/30">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-muted-foreground">#{idx + 1}</span>
                          <button onClick={() => removeSubtitle(sub.id)} className="text-muted-foreground hover:text-destructive">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                        <Input value={sub.text} onChange={e => updateSubtitle(sub.id, 'text', e.target.value)}
                          placeholder="Subtitle text..." maxLength={200} className="h-8 text-xs" />
                        <div className="flex gap-2">
                          <div className="flex-1 space-y-0.5">
                            <label className="text-xs text-muted-foreground">Start</label>
                            <Input type="number" min={0} max={videoDuration} step={0.1}
                              value={sub.startTime} onChange={e => updateSubtitle(sub.id, 'startTime', parseFloat(e.target.value) || 0)}
                              className="h-8 text-xs px-2" />
                          </div>
                          <div className="flex-1 space-y-0.5">
                            <label className="text-xs text-muted-foreground">End</label>
                            <Input type="number" min={0} max={videoDuration} step={0.1}
                              value={sub.endTime} onChange={e => updateSubtitle(sub.id, 'endTime', parseFloat(e.target.value) || 0)}
                              className="h-8 text-xs px-2" />
                          </div>
                        </div>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={addSubtitle} className="flex-1 gap-1 text-xs" disabled={!selectedVideoId || videoDuration === 0}>
                        <Plus className="h-3 w-3" /> Add Subtitle
                      </Button>
                      <Button size="sm" variant="outline" onClick={handleAISubtitles}
                        disabled={subtitleGenerating || !selectedVideoId || videoDuration === 0}
                        className="flex-1 gap-1 text-xs">
                        {subtitleGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                        AI Suggest
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* ══════════ ASPECT RATIO ══════════ */}
              <div className="px-3">
                <SectionHead id="ratio" icon={Crop} title="Aspect Ratio" badge={aspectRatio !== 'original' ? aspectRatio : undefined} />
                {!collapsedSections['ratio'] && (
                  <div className="pb-3 space-y-3">
                    <p className="text-xs text-muted-foreground">
                      Resize for a specific platform. <strong>9:16</strong> is the most universal for social media (TikTok, Reels, Shorts).
                    </p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {ASPECT_RATIOS.map((ar) => (
                        <button key={ar.value} onClick={() => setAspectRatio(ar.value)}
                          className={`rounded-lg border-2 p-2 text-center transition-all relative ${
                            aspectRatio === ar.value ? 'border-primary bg-primary/5 shadow-sm' : 'border-muted hover:border-primary/40'
                          }`}>
                          {ar.recommended && (
                            <span className="absolute -top-1.5 -right-1.5 text-[8px] bg-primary text-primary-foreground px-1 rounded-full">Best</span>
                          )}
                          <div className="flex justify-center mb-1">
                            <div className={`border-2 border-current rounded-sm ${ar.shape} ${
                              aspectRatio === ar.value ? 'border-primary text-primary' : 'border-muted-foreground/40'
                            }`} />
                          </div>
                          <p className="text-xs font-semibold">{ar.label}</p>
                          <p className="text-[8px] text-muted-foreground leading-tight mt-0.5">{ar.desc}</p>
                        </button>
                      ))}
                    </div>
                    {/* Social network info for selected ratio */}
                    {aspectRatio !== 'original' && (
                      <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2">
                        <strong>{aspectRatio}</strong>: Best for {ASPECT_RATIOS.find(a => a.value === aspectRatio)?.networks || 'various platforms'}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ══════════ SPEED & FADE ══════════ */}
              <div className="px-3">
                <SectionHead id="speed" icon={Gauge} title="Speed & Effects" badge={speed !== 1 ? `${speed}x` : fadeIn > 0 || fadeOut > 0 ? 'Fade' : undefined} />
                {!collapsedSections['speed'] && (
                  <div className="pb-3 space-y-3">
                    {/* Speed control */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Playback Speed</Label>
                      <div className="flex flex-wrap gap-1">
                        {SPEED_OPTIONS.map(s => (
                          <button key={s.value} onClick={() => setSpeed(s.value)}
                            className={`text-xs px-2 py-1 rounded-md border transition-colors ${
                              speed === s.value ? 'bg-primary text-primary-foreground border-primary' : 'border-input text-muted-foreground hover:border-primary/40'
                            }`}>{s.label}</button>
                        ))}
                      </div>
                      {speed !== 1 && (
                        <p className="text-xs text-muted-foreground">
                          {speed < 1 ? 'Slow motion effect' : 'Fast forward effect'} — output duration: ~{formatTime(trimDuration / speed)}
                        </p>
                      )}
                    </div>
                    {/* Fade In */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Fade In (from black)</Label>
                      <div className="flex flex-wrap gap-1">
                        {FADE_OPTIONS.map(f => (
                          <button key={f} onClick={() => setFadeIn(f)}
                            className={`text-xs px-2 py-1 rounded-md border transition-colors ${
                              fadeIn === f ? 'bg-primary text-primary-foreground border-primary' : 'border-input text-muted-foreground hover:border-primary/40'
                            }`}>{f === 0 ? 'Off' : `${f}s`}</button>
                        ))}
                      </div>
                    </div>
                    {/* Fade Out */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Fade Out (to black)</Label>
                      <div className="flex flex-wrap gap-1">
                        {FADE_OPTIONS.map(f => (
                          <button key={f} onClick={() => setFadeOut(f)}
                            className={`text-xs px-2 py-1 rounded-md border transition-colors ${
                              fadeOut === f ? 'bg-primary text-primary-foreground border-primary' : 'border-input text-muted-foreground hover:border-primary/40'
                            }`}>{f === 0 ? 'Off' : `${f}s`}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ══════════ THUMBNAIL ══════════ */}
              <div className="px-3">
                <SectionHead id="thumb" icon={Image} title="Thumbnail" badge={thumbResult ? 'Saved' : undefined} />
                {!collapsedSections['thumb'] && (
                  <div className="pb-3 space-y-3">
                    <p className="text-xs text-muted-foreground">
                      Pause the video at the perfect frame, then capture a high-quality thumbnail image.
                    </p>
                    {thumbResult ? (
                      <div className="space-y-2">
                        <div className="aspect-video rounded-md border overflow-hidden bg-muted">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={thumbResult.url} alt="Thumbnail preview" className="w-full h-full object-contain" />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />{thumbResult.filename}</span>
                          <div className="flex-1" />
                          <a href={`${thumbResult.url}?download=true`}><Button variant="outline" size="sm" className="h-6 text-xs gap-1"><Download className="h-3 w-3" />Save</Button></a>
                          <Button variant="ghost" size="sm" onClick={() => setThumbResult(null)} className="h-6 text-xs">Recapture</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {/* Frame preview */}
                        {videoFrameUrl && (
                          <div className="aspect-video rounded-md border overflow-hidden bg-muted">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={videoFrameUrl} alt="Current frame" className="w-full h-full object-contain" />
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Frame at {formatTime(currentTime)}</span>
                          <div className="flex-1" />
                          <Button size="sm" onClick={handleCaptureThumb} disabled={capturingThumb || !selectedVideoId}
                            className="gap-1 text-xs">
                            {capturingThumb ? <><Loader2 className="h-3 w-3 animate-spin" />Capturing…</> : <><Camera className="h-3 w-3" />Capture Thumbnail</>}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ══════════ AI CAPTIONS ══════════ */}
              <div className="px-3">
                <SectionHead id="captions" icon={MessageSquare} title="AI Post Captions" badge={captions ? `${Object.keys(captions).length}` : undefined} />
                {!collapsedSections['captions'] && (
                  <div className="pb-3 space-y-3">
                    {!result ? (
                      <p className="text-xs text-muted-foreground bg-muted/50 rounded-md p-3">
                        Process your video first, then generate AI captions for each social media platform.
                      </p>
                    ) : (
                      <>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium">Platforms</Label>
                          <div className="flex flex-wrap gap-1.5">
                            {['INSTAGRAM', 'TIKTOK', 'FACEBOOK', 'TWITTER', 'LINKEDIN', 'THREADS', 'YOUTUBE'].map(p => (
                              <button key={p} onClick={() => toggleCaptionPlatform(p)}
                                className={`text-xs px-2 py-0.5 rounded-full border transition-all ${
                                  captionPlatforms.includes(p) ? 'bg-primary text-primary-foreground border-primary' : 'border-input text-muted-foreground hover:border-primary/50'
                                }`}>{p.charAt(0) + p.slice(1).toLowerCase()}</button>
                            ))}
                          </div>
                        </div>
                        {captionError && <div className="rounded bg-destructive/10 border border-destructive/20 p-2 text-xs text-destructive">{captionError}</div>}
                        {!captions && (
                          <Button size="sm" onClick={() => handleGenerateCaptions(result.mediaId, selectedVideo?.filename?.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '))}
                            disabled={generatingCaptions || captionPlatforms.length === 0} className="w-full gap-1.5 text-xs">
                            {generatingCaptions ? <><Loader2 className="h-3 w-3 animate-spin" />Generating…</> : <><Sparkles className="h-3 w-3" />Generate Captions</>}
                          </Button>
                        )}
                        {captions && Object.keys(captions).length > 0 && (
                          <div className="space-y-2.5">
                            {Object.entries(captions).map(([platform, caption]) => (
                              <div key={platform} className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{platform}</span>
                                  <button onClick={() => handleCopyCaption(platform, caption)}
                                    className="text-xs flex items-center gap-0.5 text-primary hover:underline">
                                    <Copy className="h-2.5 w-2.5" /> {copiedKey === platform ? 'Copied!' : 'Copy'}
                                  </button>
                                </div>
                                <div className="rounded bg-background border p-2 text-xs whitespace-pre-wrap leading-relaxed">{caption}</div>
                              </div>
                            ))}
                            <Button variant="ghost" size="sm" onClick={() => { setCaptions(null); setCaptionError(null); }} className="text-xs w-full">
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
        </div>
      </div>

      {/* ══════════════ MULTI-TRACK TIMELINE (DaVinci Resolve style) ══════════════ */}
      {!result && (
        <StudioTimeline
          timeline={timeline}
          isPlaying={isPlaying}
          onTimelineChange={handleTimelineChange}
          onPlayheadChange={handlePlayheadChange}
          onClipSelect={handleClipSelect}
          onClipDelete={handleClipDelete}
          onClipSplit={handleClipSplit}
          onAddTrack={handleAddTrack}
          onTogglePlay={togglePlay}
        />
      )}

      {/* ══════════════ MEDIA POOL (below timeline, collapsible) ══════════════ */}
      <div className="border-t shrink-0 bg-card">
        <button onClick={() => setMediaPoolOpen(v => !v)}
          className="flex items-center justify-between w-full px-4 py-2 text-left hover:bg-muted/50 transition-colors">
          <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <Layers className="h-4 w-4" />
            Media Pool
            <span className="text-xs font-normal">({videos.length} items)</span>
          </span>
          <div className="flex items-center gap-2">
            <Button variant={showGenPanel ? 'default' : 'outline'} size="sm" className="h-7 text-xs gap-1.5"
              onClick={(e) => { e.stopPropagation(); setShowGenPanel(v => !v); if (!mediaPoolOpen) setMediaPoolOpen(true); }}>
              <Wand2 className="h-3.5 w-3.5" /> {showGenPanel ? 'Back' : 'AI Generate'}
            </Button>
            {mediaPoolOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
          </div>
        </button>

        {mediaPoolOpen && (
          <div className="border-t px-3 pb-3 pt-2 max-h-56 overflow-y-auto">
            {showGenPanel ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="gen-model" className="text-xs font-medium">Model</Label>
                  <select id="gen-model" value={genModelId} onChange={e => setGenModelId(e.target.value)} disabled={generating}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-xs disabled:opacity-50">
                    {VIDEO_MODELS.map(m => <option key={m.id} value={m.id}>{m.name} — {m.creditCost}cr</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gen-platform" className="text-xs font-medium">Platform</Label>
                  <select id="gen-platform" value={genPlatform} onChange={e => setGenPlatform(e.target.value)} disabled={generating}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-xs disabled:opacity-50">
                    {GEN_PLATFORMS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
                <div className="space-y-2 sm:col-span-2 lg:col-span-1">
                  <Label htmlFor="gen-prompt" className="text-xs font-medium">Prompt</Label>
                  <textarea id="gen-prompt" value={genPrompt} onChange={e => setGenPrompt(e.target.value)}
                    placeholder="Describe the video…" rows={2} disabled={generating} maxLength={1000}
                    className="flex w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs placeholder:text-muted-foreground resize-y disabled:opacity-50" />
                </div>
                <div className="flex flex-col justify-end gap-2">
                  {genError && <div className="rounded bg-destructive/10 border border-destructive/20 p-2 text-xs text-destructive">{genError}</div>}
                  {generating && genProgress && (
                    <div className="rounded bg-primary/5 border border-primary/20 p-2 text-xs text-primary flex items-center gap-1.5">
                      <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" /><span className="break-words">{genProgress}</span>
                    </div>
                  )}
                  <Button onClick={handleGenerate} disabled={generating || !genPrompt.trim()} className="w-full gap-1.5 text-xs" size="sm">
                    {generating ? <><Loader2 className="h-4 w-4 animate-spin" />Generating…</> : <><Wand2 className="h-4 w-4" /> Generate ({VIDEO_MODELS.find(m => m.id === genModelId)?.creditCost ?? '?'}cr)</>}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {videos.map((v) => {
                  const isSelected = selectedVideoId === v.id;
                  return (
                    <div key={v.id} className={`rounded-lg border-2 overflow-hidden transition-all flex-shrink-0 w-32 ${
                      isSelected ? 'border-primary ring-1 ring-primary/40 shadow-md' : 'border-transparent hover:border-primary/30'
                    } ${processing ? 'opacity-50' : ''}`}>
                      <button onClick={() => handleVideoSelect(v.id)} disabled={processing}
                        className="w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-primary">
                        <div className="aspect-video bg-black relative flex items-center justify-center overflow-hidden">
                          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                          <video src={`/api/media/${v.id}#t=0.5`} className="w-full h-full object-contain" preload="metadata" muted playsInline
                            onLoadedMetadata={(e) => {
                              const vid = e.currentTarget;
                              if (vid.duration && isFinite(vid.duration)) {
                                handleVideoMetadataForTimeline(v.id, vid.duration);
                              }
                            }} />
                          {isSelected && <div className="absolute inset-0 bg-primary/20 flex items-center justify-center"><CheckCircle2 className="h-5 w-5 text-primary drop-shadow-md" /></div>}
                        </div>
                      </button>
                      <div className="px-2 py-1.5 bg-muted/40 flex items-center gap-1">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{v.filename}</p>
                          <p className="text-xs text-muted-foreground">{formatFileSize(v.fileSize)}{mediaDurations[v.id] ? ` · ${Math.round(mediaDurations[v.id])}s` : ''}</p>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleAddToTimeline(v); }}
                          disabled={processing}
                          className="shrink-0 bg-primary/10 hover:bg-primary/20 text-primary p-1 rounded transition-colors"
                          title="Add to timeline">
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ══════════════ BOTTOM STATUS BAR ══════════════ */}
      <div className="flex items-center gap-3 px-4 py-2 border rounded-b-lg bg-muted/30 mt-0 shrink-0">
        {error && (
          <span className="text-xs text-destructive flex items-center gap-1.5">
            {error}
            <button onClick={() => setError(null)} className="text-destructive/60 hover:text-destructive shrink-0">×</button>
          </span>
        )}
        {processing && (
          <span className="text-xs text-primary flex items-center gap-1.5">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Processing video… keep this page open
          </span>
        )}
        {!error && !processing && (
          <div className="flex items-center gap-2 flex-wrap">
            {editSummary.length > 0 && (
              <>
                <span className="text-xs text-muted-foreground font-medium">Edits:</span>
                {editSummary.map((s, i) => <Badge key={i} variant="outline" className="text-xs">{s}</Badge>)}
              </>
            )}
            {timelineHasClips && (
              <Badge variant="secondary" className="text-xs">
                Timeline: {timeline.tracks.reduce((n, t) => n + t.clips.length, 0)} clips
              </Badge>
            )}
            {!timelineHasClips && editSummary.length === 0 && (
              <span className="text-xs text-muted-foreground">
                {selectedVideo ? 'Add clips to timeline or apply effects' : 'Select a video or add clips to timeline'}
              </span>
            )}
          </div>
        )}
        <span className="text-xs text-muted-foreground ml-auto">Non-destructive editing</span>
      </div>
    </div>
  );
}
