'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Send, Save, Clock, Image as ImageIcon, Film,
  Zap, Globe, AlertTriangle, CheckCircle2,
  Sparkles, Loader2, X, AlertCircle, Camera,
  FileVideo, Info, ChevronDown, ChevronUp, Download,
} from 'lucide-react';
import { HelpTip } from '@/components/ui/help-tip';
import type { PlatformRequirement } from '@/lib/constants';

// ── Types ────────────────────────────────────────────────────

interface MediaItem {
  id: string;
  filename: string;
  type: string;
  mimeType: string;
  fileSize: number;
  altText: string | null;
  platformCaptions: Record<string, string> | null;
  width: number | null;
  height: number | null;
}

interface RecentPost {
  id: string;
  status: string;
  content: string;
  createdAt: string;
  platforms: string[];
  media: { id: string; filename: string; type: string } | null;
}

interface PostFormClientProps {
  botId: string;
  botName: string;
  connectedPlatforms: string[];
  platformRequirements: Record<string, PlatformRequirement>;
  platformNames: Record<string, string>;
  postStatusColors: Record<string, string>;
  mediaLibrary: MediaItem[];
  recentPosts: RecentPost[];
  postCost: number;
  userCredits: number;
  preSelectedMediaId: string | null;
  successMessage: string | null;
  errorMessage: string | null;
}

// ── Validation helpers ───────────────────────────────────────

interface ValidationIssue {
  platform: string;
  type: 'error' | 'warning';
  message: string;
}

function getMediaFileExtension(mimeType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'JPEG',
    'image/png': 'PNG',
    'image/gif': 'GIF',
    'image/webp': 'WebP',
    'image/avif': 'AVIF',
    'video/mp4': 'MP4',
    'video/webm': 'WebM',
    'video/quicktime': 'MOV',
  };
  return map[mimeType] || mimeType.split('/')[1]?.toUpperCase() || 'Unknown';
}

function getMediaTypeLabel(type: string): string {
  switch (type) {
    case 'IMAGE': return 'Image';
    case 'VIDEO': return 'Video';
    case 'GIF': return 'GIF';
    default: return type;
  }
}

// ── Component ────────────────────────────────────────────────

export function PostFormClient({
  botId,
  botName,
  connectedPlatforms,
  platformRequirements,
  platformNames,
  postStatusColors,
  mediaLibrary,
  recentPosts,
  postCost,
  userCredits,
  preSelectedMediaId,
  successMessage,
  errorMessage,
}: PostFormClientProps) {
  // ── State ──────────────────────────────────────────────────
  const [content, setContent] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<string>>(
    new Set(connectedPlatforms)
  );
  const [selectedMediaId, setSelectedMediaId] = useState<string>(preSelectedMediaId || '');
  const [scheduledAt, setScheduledAt] = useState('');
  const [postType, setPostType] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDimensions, setShowDimensions] = useState(false);

  // Reset submitting state when page navigates back with success/error message
  useEffect(() => {
    setIsSubmitting(false);
  }, [successMessage, errorMessage]);

  // AI generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [aiPlatformSuggestions, setAiPlatformSuggestions] = useState<Record<string, string> | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [showAiPanel, setShowAiPanel] = useState(false);

  // ── Derived data ───────────────────────────────────────────

  const selectedMedia = useMemo(
    () => mediaLibrary.find((m) => m.id === selectedMediaId) || null,
    [mediaLibrary, selectedMediaId]
  );

  const hasMedia = !!selectedMediaId;
  const totalCost = postCost * selectedPlatforms.size;
  const hasEnoughCredits = userCredits >= totalCost;

  // ── Validation ─────────────────────────────────────────────

  const validationIssues = useMemo((): ValidationIssue[] => {
    const issues: ValidationIssue[] = [];

    for (const platform of Array.from(selectedPlatforms)) {
      const req = platformRequirements[platform];
      if (!req) continue;

      // Media required check
      if (req.mediaRequired && !hasMedia) {
        issues.push({
          platform,
          type: 'error',
          message: `${req.name} requires an image or video. Text-only posts are not supported.`,
        });
      }

      // Character limit check
      if (content.length > req.maxCharacters) {
        issues.push({
          platform,
          type: 'error',
          message: `${req.name}: ${content.length.toLocaleString()}/${req.maxCharacters.toLocaleString()} chars (${(content.length - req.maxCharacters).toLocaleString()} over limit)`,
        });
      } else if (content.length > req.maxCharacters * 0.9 && content.length > 0) {
        issues.push({
          platform,
          type: 'warning',
          message: `${req.name}: ${content.length.toLocaleString()}/${req.maxCharacters.toLocaleString()} chars (approaching limit)`,
        });
      }

      // Media format compatibility
      if (selectedMedia) {
        const mediaFormat = getMediaFileExtension(selectedMedia.mimeType);
        const mediaType = selectedMedia.type; // IMAGE, VIDEO, GIF

        // Check if platform supports this media type
        if (!req.supportedMediaTypes.includes(mediaType as 'IMAGE' | 'VIDEO' | 'GIF')) {
          issues.push({
            platform,
            type: 'error',
            message: `${req.name} does not support ${getMediaTypeLabel(mediaType)} files.`,
          });
        }

        // Check format compatibility
        if (mediaType === 'VIDEO' || mediaType === 'GIF') {
          if (req.videoFormats.length > 0 && !req.videoFormats.includes(mediaFormat)) {
            issues.push({
              platform,
              type: 'warning',
              message: `${req.name} may not support ${mediaFormat} videos. Supported: ${req.videoFormats.join(', ')}.`,
            });
          }
        } else {
          if (req.imageFormats.length > 0 && !req.imageFormats.includes(mediaFormat)) {
            issues.push({
              platform,
              type: 'error',
              message: `${req.name} does not support ${mediaFormat} images. Use: ${req.imageFormats.join(', ')}.`,
            });
          }
        }

        // File size check
        const fileSizeMB = selectedMedia.fileSize / (1024 * 1024);
        if (mediaType === 'VIDEO') {
          if (req.maxVideoSizeMB > 0 && fileSizeMB > req.maxVideoSizeMB) {
            issues.push({
              platform,
              type: 'error',
              message: `${req.name}: Video too large (${fileSizeMB.toFixed(1)}MB). Max: ${req.maxVideoSizeMB}MB.`,
            });
          }
        } else {
          if (fileSizeMB > req.maxImageSizeMB) {
            issues.push({
              platform,
              type: 'error',
              message: `${req.name}: Image too large (${fileSizeMB.toFixed(1)}MB). Max: ${req.maxImageSizeMB}MB.`,
            });
          }
        }
      }
    }

    return issues;
  }, [content, selectedPlatforms, hasMedia, selectedMedia, platformRequirements]);

  const errors = validationIssues.filter((i) => i.type === 'error');
  const warnings = validationIssues.filter((i) => i.type === 'warning');
  const canPost = content.trim().length > 0 && selectedPlatforms.size > 0 && errors.length === 0;

  // ── Character count display ────────────────────────────────

  const charCountDisplay = useMemo(() => {
    if (selectedPlatforms.size === 0) return [];

    return Array.from(selectedPlatforms).map((p) => {
      const req = platformRequirements[p];
      if (!req) return { platform: p, name: p, count: content.length, max: 99999, status: 'ok' as const };

      const ratio = content.length / req.maxCharacters;
      let status: 'ok' | 'warning' | 'error' = 'ok';
      if (ratio > 1) status = 'error';
      else if (ratio > 0.9) status = 'warning';

      return { platform: p, name: req.name, count: content.length, max: req.maxCharacters, status };
    }).sort((a, b) => a.max - b.max); // Show tightest limits first
  }, [content, selectedPlatforms, platformRequirements]);

  // ── Lowest char limit for tip ──────────────────────────────
  const lowestLimit = useMemo(() => {
    let min = 100000;
    for (const p of Array.from(selectedPlatforms)) {
      const req = platformRequirements[p];
      if (req && req.maxCharacters < min) min = req.maxCharacters;
    }
    return min;
  }, [selectedPlatforms, platformRequirements]);

  // ── Platform toggle ────────────────────────────────────────

  const togglePlatform = (platform: string) => {
    setSelectedPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(platform)) next.delete(platform);
      else next.add(platform);
      return next;
    });
  };

  const selectAllPlatforms = () => setSelectedPlatforms(new Set(connectedPlatforms));
  const deselectAllPlatforms = () => setSelectedPlatforms(new Set());

  // ── AI Generation ──────────────────────────────────────────

  const generateContent = useCallback(async () => {
    if (!aiPrompt.trim()) {
      setAiError('Please describe what you want to post about.');
      return;
    }

    setIsGenerating(true);
    setAiError(null);
    setAiSuggestion(null);
    setAiPlatformSuggestions(null);

    try {
      const res = await fetch('/api/generate/post-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botId,
          prompt: aiPrompt,
          platforms: Array.from(selectedPlatforms),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'AI generation failed' }));
        setAiError(data.error || `AI generation failed (HTTP ${res.status})`);
        return;
      }

      const data = await res.json();
      setAiSuggestion(data.content || null);
      setAiPlatformSuggestions(data.platformContent || null);
    } catch {
      setAiError('Network error. Check your connection and try again.');
    } finally {
      setIsGenerating(false);
    }
  }, [aiPrompt, botId, selectedPlatforms]);

  const applyAiSuggestion = (text: string) => {
    setContent(text);
    setShowAiPanel(false);
  };

  // ── Form submission ────────────────────────────────────────

  const handleSubmit = (action: 'now' | 'schedule' | 'draft') => {
    if (isSubmitting) return;

    // Client-side validation
    if (!content.trim()) return;
    if (selectedPlatforms.size === 0) return;
    if (action !== 'draft' && errors.length > 0) return;

    if (action === 'schedule' && !scheduledAt) return;

    setIsSubmitting(true);

    // Use the hidden server-action form to submit
    const form = document.getElementById('post-form') as HTMLFormElement | null;
    if (!form) {
      setIsSubmitting(false);
      return;
    }

    // Clear existing hidden inputs
    form.querySelectorAll('input[type="hidden"]').forEach(el => el.remove());

    // Add all form data as hidden inputs
    const addHidden = (name: string, value: string) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      input.value = value;
      form.appendChild(input);
    };

    addHidden('content', content);
    addHidden('action', action);
    if (selectedMediaId) addHidden('mediaId', selectedMediaId);
    if (scheduledAt) addHidden('scheduledAt', scheduledAt);
    if (postType) addHidden('postType', postType);
    for (const p of Array.from(selectedPlatforms)) {
      addHidden('platforms', p);
    }

    // Submit the server-action form
    form.requestSubmit();
  };

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Success/Error Messages */}
      {successMessage && (
        <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-800 flex items-start gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{successMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive flex items-start gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* No platforms warning */}
      {connectedPlatforms.length === 0 && (
        <Card className="border-orange-200 bg-orange-50/50">
          <CardContent className="pt-6">
            <div className="flex gap-3 items-start">
              <Globe className="h-5 w-5 text-orange-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-orange-900">No platforms connected</p>
                <p className="text-sm text-orange-700 mt-1">Connect at least one social platform before creating posts.</p>
                <Link href={`/dashboard/bots/${botId}/platforms`}>
                  <Button size="sm" variant="outline" className="mt-3">
                    <Globe className="mr-2 h-4 w-4" /> Connect Platforms
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {connectedPlatforms.length > 0 && (
        <form action={`/dashboard/bots/${botId}/post`} method="POST" onSubmit={(e) => e.preventDefault()}>
          <div className="grid gap-6 lg:grid-cols-3">
            {/* ═══════ Main Content - Left Column ═══════ */}
            <div className="lg:col-span-2 space-y-4">
              {/* Post Content Card */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Send className="h-5 w-5" /> Post Content
                      </CardTitle>
                      <CardDescription>Write your post content. Character limits vary by platform.</CardDescription>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => setShowAiPanel(!showAiPanel)}
                    >
                      <Sparkles className="h-4 w-4" />
                      AI Assist
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* AI Generation Panel */}
                  {showAiPanel && (
                    <div className="rounded-lg border border-purple-200 bg-purple-50/50 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-sm flex items-center gap-1.5 text-purple-900">
                          <Sparkles className="h-4 w-4" /> AI Content Generator
                        </h4>
                        <button
                          type="button"
                          onClick={() => setShowAiPanel(false)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="text-xs text-purple-700">
                        Describe your topic and AI will generate platform-optimized content. Cost: 5 credits.
                      </p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={aiPrompt}
                          onChange={(e) => setAiPrompt(e.target.value)}
                          placeholder="e.g., Announce our new product launch for spring collection..."
                          className="flex-1 h-9 rounded-md border border-input bg-white px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); generateContent(); } }}
                        />
                        <Button
                          type="button"
                          size="sm"
                          className="gap-1.5 h-9"
                          onClick={generateContent}
                          disabled={isGenerating || !aiPrompt.trim()}
                        >
                          {isGenerating ? (
                            <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
                          ) : (
                            <><Sparkles className="h-4 w-4" /> Generate</>
                          )}
                        </Button>
                      </div>

                      {aiError && (
                        <p className="text-xs text-destructive flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" /> {aiError}
                        </p>
                      )}

                      {/* AI suggestion result */}
                      {aiSuggestion && (
                        <div className="space-y-3">
                          <div className="rounded-md border bg-white p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-medium text-purple-700">Universal version</span>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-6 text-xs gap-1"
                                onClick={() => applyAiSuggestion(aiSuggestion)}
                              >
                                <CheckCircle2 className="h-3 w-3" /> Use this
                              </Button>
                            </div>
                            <p className="text-sm whitespace-pre-wrap">{aiSuggestion}</p>
                          </div>

                          {/* Per-platform suggestions */}
                          {aiPlatformSuggestions && Object.keys(aiPlatformSuggestions).length > 0 && (
                            <div className="space-y-2">
                              <p className="text-xs font-medium text-purple-700">Platform-optimized versions:</p>
                              {Object.entries(aiPlatformSuggestions).map(([p, text]) => {
                                const req = platformRequirements[p];
                                if (!req || !selectedPlatforms.has(p)) return null;
                                return (
                                  <div key={p} className="rounded-md border bg-white p-3">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-xs font-medium">{req.name}</span>
                                      <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-muted-foreground">
                                          {text.length}/{req.maxCharacters}
                                        </span>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 text-xs gap-1"
                                          onClick={() => applyAiSuggestion(text)}
                                        >
                                          Use
                                        </Button>
                                      </div>
                                    </div>
                                    <p className="text-xs whitespace-pre-wrap text-muted-foreground">{text}</p>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Content textarea */}
                  <div className="space-y-2">
                    <Label htmlFor="content">Content *</Label>
                    <textarea
                      id="content"
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder="What do you want to share? Write your post here..."
                      className="flex min-h-[180px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
                      required
                    />

                    {/* Live character counts per platform */}
                    {content.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {charCountDisplay.map(({ platform, name, count, max, status }) => (
                          <span
                            key={platform}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium ${
                              status === 'error'
                                ? 'bg-red-100 text-red-800'
                                : status === 'warning'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-green-50 text-green-700'
                            }`}
                          >
                            {status === 'error' ? (
                              <AlertCircle className="h-3 w-3" />
                            ) : status === 'warning' ? (
                              <AlertTriangle className="h-3 w-3" />
                            ) : (
                              <CheckCircle2 className="h-3 w-3" />
                            )}
                            {name}: {count.toLocaleString()}/{max.toLocaleString()}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Default limits display when no content */}
                    {content.length === 0 && (
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        {Array.from(selectedPlatforms)
                          .map(p => platformRequirements[p])
                          .filter(Boolean)
                          .sort((a, b) => a.maxCharacters - b.maxCharacters)
                          .map(req => (
                            <span key={req.name} className="px-2 py-0.5 rounded bg-muted">
                              {req.name}: {req.maxCharacters.toLocaleString()} chars
                            </span>
                          ))}
                      </div>
                    )}
                  </div>

                  {/* ═══════ Instagram Post Type ═══════ */}
                  {selectedPlatforms.has('INSTAGRAM') && (
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1">
                        <Film className="h-4 w-4" />
                        Instagram Post Type
                        <HelpTip text="Choose how this post appears on Instagram. Feed = standard image post, Reel = video post (9:16 recommended), Story = 24-hour temporary post, Carousel = 2-10 images in a swipeable gallery." />
                      </Label>
                      <select
                        value={postType}
                        onChange={(e) => setPostType(e.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="">Auto-detect (based on media type)</option>
                        <option value="feed">Feed Post (image)</option>
                        <option value="reel">Reel (video, 9:16 recommended)</option>
                        <option value="story">Story (disappears after 24h)</option>
                        <option value="carousel">Carousel (2-10 images)</option>
                      </select>
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        <p><strong>Image specs:</strong> JPEG, 4:5 to 1.91:1 ratio, max 8MB. Best: 1080x1080 or 1080x1350</p>
                        <p><strong>Video/Reel:</strong> MP4, H.264+AAC, 3s-15min, max 300MB. Best: 1080x1920 (9:16)</p>
                        <p><strong>Story:</strong> JPEG or MP4, 9:16, max 60s video. Captions not supported via API.</p>
                      </div>
                    </div>
                  )}

                  {/* ═══════ Media Selection ═══════ */}
                  <div className="space-y-3">
                    <Label className="flex items-center gap-1">
                      <Camera className="h-4 w-4" />
                      Attach Media
                      <HelpTip text="Select an image or video from your media library. Some platforms (Instagram, TikTok, Pinterest) require media." />
                    </Label>

                    {/* Media required warning */}
                    {!hasMedia && Array.from(selectedPlatforms).some(p => platformRequirements[p]?.mediaRequired) && (
                      <div className="rounded-md bg-orange-50 border border-orange-200 p-2.5 text-xs text-orange-800 flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 shrink-0 mt-0" />
                        <div>
                          <p className="font-medium">Media required for selected platforms:</p>
                          <ul className="mt-1 space-y-0.5">
                            {Array.from(selectedPlatforms)
                              .filter(p => platformRequirements[p]?.mediaRequired)
                              .map(p => {
                                const req = platformRequirements[p]!;
                                return (
                                  <li key={p} className="flex items-center gap-1">
                                    <span className="font-medium">{req.name}</span> — {req.note}
                                  </li>
                                );
                              })}
                          </ul>
                        </div>
                      </div>
                    )}

                    {/* Media selector */}
                    <select
                      value={selectedMediaId}
                      onChange={(e) => setSelectedMediaId(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">
                        {Array.from(selectedPlatforms).some(p => platformRequirements[p]?.mediaRequired)
                          ? '-- Select media (REQUIRED) --'
                          : '-- No media (optional) --'
                        }
                      </option>
                      {mediaLibrary.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.type === 'VIDEO' ? '[VIDEO]' : m.type === 'GIF' ? '[GIF]' : '[IMG]'} {m.filename}
                          {m.fileSize ? ` (${(m.fileSize / (1024 * 1024)).toFixed(1)}MB)` : ''}
                          {m.altText ? ` - ${m.altText.slice(0, 30)}` : ''}
                        </option>
                      ))}
                    </select>

                    {mediaLibrary.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        No media uploaded yet.{' '}
                        <Link href={`/dashboard/bots/${botId}/media`} className="text-primary underline">
                          Upload media first
                        </Link>
                      </p>
                    )}

                    {/* Selected media preview & compatibility */}
                    {selectedMedia && (
                      <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
                        <div className="flex gap-3">
                          {/* Preview */}
                          <div className="shrink-0">
                            {selectedMedia.type === 'VIDEO' ? (
                              <div className="relative h-20 w-20 rounded-lg overflow-hidden bg-muted">
                                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                                <video
                                  src={`/api/media/${selectedMedia.id}`}
                                  className="h-full w-full object-cover"
                                  muted
                                  preload="metadata"
                                />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                  <div className="h-8 w-8 rounded-full bg-black/50 flex items-center justify-center">
                                    <svg className="h-4 w-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={`/api/media/${selectedMedia.id}`}
                                alt={selectedMedia.filename}
                                className="h-20 w-20 rounded-lg object-cover"
                              />
                            )}
                          </div>

                          {/* Media info */}
                          <div className="flex-1 min-w-0 space-y-1">
                            <p className="text-sm font-medium truncate">{selectedMedia.filename}</p>
                            <div className="flex flex-wrap gap-1.5">
                              <Badge variant="secondary" className="text-[10px]">
                                {getMediaTypeLabel(selectedMedia.type)}
                              </Badge>
                              <Badge variant="secondary" className="text-[10px]">
                                {getMediaFileExtension(selectedMedia.mimeType)}
                              </Badge>
                              <Badge variant="secondary" className="text-[10px]">
                                {(selectedMedia.fileSize / (1024 * 1024)).toFixed(1)}MB
                              </Badge>
                              {selectedMedia.width && selectedMedia.height && (
                                <Badge variant="secondary" className="text-[10px]">
                                  {selectedMedia.width}x{selectedMedia.height}
                                </Badge>
                              )}
                            </div>

                            {/* AI caption available indicator */}
                            {selectedMedia.platformCaptions && Object.keys(selectedMedia.platformCaptions).length > 0 && (
                              <p className="text-[10px] text-purple-600 flex items-center gap-1">
                                <Sparkles className="h-3 w-3" /> AI captions available — use them from the Media tab
                              </p>
                            )}
                          </div>

                          <div className="shrink-0 flex items-center gap-1">
                            <a
                              href={`/api/media/${selectedMedia.id}?download=true`}
                              download={selectedMedia.filename}
                              className="text-muted-foreground hover:text-foreground"
                              title="Download"
                            >
                              <Download className="h-4 w-4" />
                            </a>
                            <button
                              type="button"
                              onClick={() => setSelectedMediaId('')}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        {/* Platform compatibility for this media */}
                        <div className="space-y-1">
                          <p className="text-[11px] font-medium text-muted-foreground">Platform compatibility:</p>
                          <div className="flex flex-wrap gap-1">
                            {Array.from(selectedPlatforms).map((p) => {
                              const req = platformRequirements[p];
                              if (!req) return null;

                              const mediaFormat = getMediaFileExtension(selectedMedia.mimeType);
                              const mediaType = selectedMedia.type;
                              const fileSizeMB = selectedMedia.fileSize / (1024 * 1024);

                              // Check compatibility
                              let status: 'ok' | 'warning' | 'error' = 'ok';
                              let issue = '';

                              if (!req.supportedMediaTypes.includes(mediaType as 'IMAGE' | 'VIDEO' | 'GIF')) {
                                status = 'error';
                                issue = `No ${getMediaTypeLabel(mediaType).toLowerCase()} support`;
                              } else if (mediaType === 'IMAGE' && !req.imageFormats.includes(mediaFormat)) {
                                status = 'error';
                                issue = `${mediaFormat} not supported`;
                              } else if (mediaType === 'VIDEO' && req.videoFormats.length > 0 && !req.videoFormats.includes(mediaFormat)) {
                                status = 'warning';
                                issue = `${mediaFormat} may not work`;
                              } else if (mediaType === 'VIDEO' && fileSizeMB > req.maxVideoSizeMB) {
                                status = 'error';
                                issue = `Too large (max ${req.maxVideoSizeMB}MB)`;
                              } else if (mediaType !== 'VIDEO' && fileSizeMB > req.maxImageSizeMB) {
                                status = 'error';
                                issue = `Too large (max ${req.maxImageSizeMB}MB)`;
                              }

                              return (
                                <span
                                  key={p}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${
                                    status === 'error'
                                      ? 'bg-red-100 text-red-700'
                                      : status === 'warning'
                                        ? 'bg-yellow-100 text-yellow-700'
                                        : 'bg-green-50 text-green-700'
                                  }`}
                                  title={issue}
                                >
                                  {status === 'error' ? (
                                    <X className="h-3 w-3" />
                                  ) : status === 'warning' ? (
                                    <AlertTriangle className="h-3 w-3" />
                                  ) : (
                                    <CheckCircle2 className="h-3 w-3" />
                                  )}
                                  {req.name}
                                  {issue && `: ${issue}`}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Validation Issues Card */}
              {(errors.length > 0 || warnings.length > 0) && (
                <Card className={errors.length > 0 ? 'border-destructive/50' : 'border-yellow-300'}>
                  <CardContent className="pt-4 space-y-2">
                    {errors.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-semibold text-destructive flex items-center gap-1">
                          <AlertCircle className="h-3.5 w-3.5" />
                          {errors.length} issue{errors.length > 1 ? 's' : ''} must be fixed before posting:
                        </p>
                        {errors.map((issue, i) => (
                          <p key={i} className="text-xs text-destructive pl-5">
                            {issue.message}
                          </p>
                        ))}
                      </div>
                    )}
                    {warnings.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-semibold text-yellow-700 flex items-center gap-1">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          {warnings.length} warning{warnings.length > 1 ? 's' : ''}:
                        </p>
                        {warnings.map((issue, i) => (
                          <p key={i} className="text-xs text-yellow-700 pl-5">
                            {issue.message}
                          </p>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Schedule & Actions Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" /> When to Post
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="scheduledAt" className="flex items-center gap-1">
                      Schedule for a specific time
                      <HelpTip text="Leave empty and use 'Post Now' for immediate posting, or 'Save Draft' to post later." />
                    </Label>
                    <input
                      id="scheduledAt"
                      type="datetime-local"
                      value={scheduledAt}
                      onChange={(e) => setScheduledAt(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                    <p className="text-xs text-muted-foreground">Optional. Set a date/time to schedule the post for later.</p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-3 pt-2">
                    <Button
                      type="button"
                      className="gap-2"
                      disabled={!canPost || !hasEnoughCredits || isSubmitting}
                      onClick={() => handleSubmit('now')}
                    >
                      {isSubmitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Zap className="h-4 w-4" />
                      )}
                      Post Now
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2"
                      disabled={!canPost || !scheduledAt || isSubmitting}
                      onClick={() => handleSubmit('schedule')}
                    >
                      <Clock className="h-4 w-4" /> Schedule Post
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="gap-2"
                      disabled={!content.trim() || selectedPlatforms.size === 0 || isSubmitting}
                      onClick={() => handleSubmit('draft')}
                    >
                      <Save className="h-4 w-4" /> Save as Draft
                    </Button>
                  </div>

                  {/* Credit info */}
                  <p className="text-xs text-muted-foreground">
                    Posting costs {postCost} credit{postCost !== 1 ? 's' : ''} per platform.
                    {selectedPlatforms.size > 1 && (
                      <> Posting to {selectedPlatforms.size} platforms = {totalCost} credits.</>
                    )}
                    {!hasEnoughCredits && totalCost > 0 && (
                      <span className="text-destructive font-medium"> Not enough credits! ({userCredits} available){' '}
                        <Link href="/dashboard/credits/buy" className="underline">Buy more</Link>
                      </span>
                    )}
                  </p>

                  {/* Why Post Now is disabled */}
                  {!canPost && content.trim().length > 0 && selectedPlatforms.size > 0 && errors.length > 0 && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Fix the {errors.length} error{errors.length > 1 ? 's' : ''} above before posting.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* ═══════ Right Sidebar ═══════ */}
            <div className="space-y-4">
              {/* Target Platforms Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5" /> Target Platforms
                  </CardTitle>
                  <CardDescription>Select where to publish this post.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Select All/None */}
                  <div className="flex gap-3 pb-2 border-b text-xs">
                    <button type="button" onClick={selectAllPlatforms} className="text-primary hover:underline">
                      Select all
                    </button>
                    <button type="button" onClick={deselectAllPlatforms} className="text-muted-foreground hover:underline">
                      Deselect all
                    </button>
                  </div>

                  {/* Platform checkboxes with requirements */}
                  <div className="space-y-1.5">
                    {connectedPlatforms.map((p) => {
                      const req = platformRequirements[p];
                      const isSelected = selectedPlatforms.has(p);
                      const requiresMedia = req?.mediaRequired;
                      const hasIssues = isSelected && errors.some(e => e.platform === p);

                      return (
                        <label
                          key={p}
                          className={`flex items-center gap-3 p-2.5 rounded-md border cursor-pointer transition-colors ${
                            isSelected
                              ? hasIssues
                                ? 'border-destructive/50 bg-destructive/5'
                                : 'border-primary bg-primary/5'
                              : 'hover:bg-muted/50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => togglePlatform(p)}
                            className="h-4 w-4 rounded"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-medium">{platformNames[p] || p}</span>
                              {requiresMedia && (
                                <Badge
                                  variant={isSelected && !hasMedia ? 'destructive' : 'secondary'}
                                  className="text-[9px] h-4 px-1"
                                >
                                  <Camera className="h-2.5 w-2.5 mr-0.5" />
                                  Media required
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-muted-foreground">
                                max {req ? req.maxCharacters.toLocaleString() : '?'} chars
                              </span>
                              {req && (
                                <span className="text-[10px] text-muted-foreground">
                                  {req.supportedMediaTypes.join(', ').toLowerCase()}
                                </span>
                              )}
                            </div>
                            {/* Show error for this platform */}
                            {isSelected && errors.filter(e => e.platform === p).map((e, i) => (
                              <p key={i} className="text-[10px] text-destructive mt-0.5 flex items-center gap-0.5">
                                <AlertCircle className="h-3 w-3 shrink-0" /> {e.message.replace(`${req?.name || p}: `, '')}
                              </p>
                            ))}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Post Preview Card */}
              {content.trim().length > 0 && selectedPlatforms.size > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Globe className="h-4 w-4" /> Post Preview
                    </CardTitle>
                    <CardDescription className="text-xs">How your post will look on each platform.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {Array.from(selectedPlatforms).map((platform) => {
                      const mediaUrl = selectedMedia ? `/api/media/${selectedMedia.id}` : null;
                      const isVideo = selectedMedia?.type === 'VIDEO';
                      const pName = platformNames[platform] || platform;

                      if (platform === 'FACEBOOK') {
                        return (
                          <div key={platform} className="rounded-lg border bg-white shadow-sm max-w-full overflow-hidden">
                            <div className="flex items-center gap-2.5 p-3">
                              <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold shrink-0">
                                {botName.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-gray-900">{botName}</p>
                                <p className="text-[10px] text-gray-500">Just now · 🌐</p>
                              </div>
                            </div>
                            <div className="px-3 pb-2">
                              <p className="text-sm text-gray-900 whitespace-pre-wrap break-words">
                                {content.length > 477 ? content.slice(0, 477) + '... See more' : content}
                              </p>
                            </div>
                            {mediaUrl && (
                              <div className="aspect-[1.91/1] bg-gray-100 overflow-hidden">
                                {isVideo ? (
                                  /* eslint-disable-next-line jsx-a11y/media-has-caption */
                                  <video src={mediaUrl} className="w-full h-full object-cover" muted preload="metadata" />
                                ) : (
                                  /* eslint-disable-next-line @next/next/no-img-element */
                                  <img src={mediaUrl} alt="" className="w-full h-full object-cover" />
                                )}
                              </div>
                            )}
                            <div className="flex items-center justify-around py-1.5 px-3 border-t text-gray-500 text-xs">
                              <span>👍 Like</span>
                              <span>💬 Comment</span>
                              <span>↗️ Share</span>
                            </div>
                          </div>
                        );
                      }

                      if (platform === 'INSTAGRAM') {
                        return (
                          <div key={platform} className="rounded-lg border bg-white shadow-sm max-w-full overflow-hidden">
                            <div className="flex items-center gap-2.5 p-3">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 via-red-500 to-purple-600 p-[2px] shrink-0">
                                <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-[10px] font-bold text-gray-900">
                                  {botName.charAt(0).toUpperCase()}
                                </div>
                              </div>
                              <p className="text-sm font-semibold text-gray-900">{botName.toLowerCase().replace(/\s+/g, '')}</p>
                            </div>
                            {mediaUrl ? (
                              <div className="aspect-square bg-gray-100 overflow-hidden">
                                {isVideo ? (
                                  /* eslint-disable-next-line jsx-a11y/media-has-caption */
                                  <video src={mediaUrl} className="w-full h-full object-cover" muted preload="metadata" />
                                ) : (
                                  /* eslint-disable-next-line @next/next/no-img-element */
                                  <img src={mediaUrl} alt="" className="w-full h-full object-cover" />
                                )}
                              </div>
                            ) : (
                              <div className="aspect-square bg-gray-100 flex items-center justify-center text-gray-400 text-xs">
                                Image required
                              </div>
                            )}
                            <div className="flex items-center justify-between px-3 py-2 text-gray-900">
                              <div className="flex items-center gap-3.5">
                                <span className="text-lg">♡</span>
                                <span className="text-lg">💬</span>
                                <span className="text-lg">↗️</span>
                              </div>
                              <span className="text-lg">🔖</span>
                            </div>
                            <div className="px-3 pb-3">
                              <p className="text-sm text-gray-900">
                                <span className="font-semibold">{botName.toLowerCase().replace(/\s+/g, '')}</span>{' '}
                                {content.length > 125 ? content.slice(0, 125) + '... more' : content}
                              </p>
                            </div>
                          </div>
                        );
                      }

                      if (platform === 'THREADS') {
                        return (
                          <div key={platform} className="rounded-lg border bg-white shadow-sm max-w-full p-3.5">
                            <div className="flex items-start gap-2.5">
                              <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600 shrink-0">
                                {botName.charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-sm font-semibold text-gray-900">{botName.toLowerCase().replace(/\s+/g, '')}</span>
                                  <span className="text-xs text-gray-500">· now</span>
                                </div>
                                <p className="text-sm text-gray-900 mt-1 whitespace-pre-wrap break-words">
                                  {content.length > 500 ? content.slice(0, 500) : content}
                                </p>
                                {mediaUrl && (
                                  <div className="mt-2 rounded-lg overflow-hidden border aspect-[16/9] bg-gray-100">
                                    {isVideo ? (
                                      /* eslint-disable-next-line jsx-a11y/media-has-caption */
                                      <video src={mediaUrl} className="w-full h-full object-cover" muted preload="metadata" />
                                    ) : (
                                      /* eslint-disable-next-line @next/next/no-img-element */
                                      <img src={mediaUrl} alt="" className="w-full h-full object-cover" />
                                    )}
                                  </div>
                                )}
                                <div className="flex items-center gap-5 mt-2.5 text-gray-400 text-xs">
                                  <span>♡</span>
                                  <span>💬</span>
                                  <span>🔁</span>
                                  <span>↗️</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      // Generic fallback for other platforms
                      return (
                        <div key={platform} className="rounded-lg border bg-white shadow-sm p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="text-[10px]">{pName}</Badge>
                          </div>
                          <p className="text-sm text-gray-900 whitespace-pre-wrap break-words line-clamp-4">{content}</p>
                          {mediaUrl && (
                            <div className="mt-2 rounded overflow-hidden aspect-video bg-gray-100">
                              {isVideo ? (
                                /* eslint-disable-next-line jsx-a11y/media-has-caption */
                                <video src={mediaUrl} className="w-full h-full object-cover" muted preload="metadata" />
                              ) : (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img src={mediaUrl} alt="" className="w-full h-full object-cover" />
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}

              {/* Platform Specs Card (collapsible) */}
              <Card className="bg-muted/30">
                <CardHeader className="pb-2 cursor-pointer" onClick={() => setShowDimensions(!showDimensions)}>
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Info className="h-4 w-4" /> Platform Specs
                    </span>
                    {showDimensions ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </CardTitle>
                </CardHeader>
                {showDimensions && (
                  <CardContent className="space-y-3">
                    {Array.from(selectedPlatforms).map((p) => {
                      const req = platformRequirements[p];
                      if (!req) return null;
                      return (
                        <div key={p} className="text-xs border-b pb-2 last:border-0">
                          <p className="font-medium">{req.name}</p>
                          <div className="mt-1 space-y-0.5 text-muted-foreground">
                            <p>Text: max {req.maxCharacters.toLocaleString()} chars</p>
                            {req.imageFormats.length > 0 && (
                              <p>Image: {req.imageFormats.join(', ')} (max {req.maxImageSizeMB}MB)</p>
                            )}
                            {req.videoFormats.length > 0 && (
                              <p>Video: {req.videoFormats.join(', ')} (max {req.maxVideoSizeMB}MB)</p>
                            )}
                            <p>
                              Sizes: {req.recommendedDimensions.map(d => `${d.width}x${d.height} ${d.label}`).join(', ')}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    {selectedPlatforms.size === 0 && (
                      <p className="text-xs text-muted-foreground">Select platforms to see specs.</p>
                    )}
                  </CardContent>
                )}
              </Card>

              {/* Tips Card */}
              <Card className="bg-blue-50/50 border-blue-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-blue-900">Tips for better reach</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="text-xs text-blue-800 space-y-1.5 list-disc list-inside">
                    {selectedPlatforms.size > 0 && (
                      <li>Keep text under {lowestLimit.toLocaleString()} chars for all platforms</li>
                    )}
                    <li>Posts with images get 2-3x more engagement</li>
                    <li>Instagram requires JPEG/PNG images — no text-only posts</li>
                    <li>Use hashtags for Instagram & TikTok, avoid for Facebook</li>
                    <li>Best times: weekdays 9-11 AM and 1-3 PM</li>
                    <li>Ask a question to boost comments</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </form>
      )}

      {/* Recent Posts */}
      {recentPosts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Posts</CardTitle>
            <CardDescription>
              Your last {recentPosts.length} post{recentPosts.length > 1 ? 's' : ''}.{' '}
              <Link href={`/dashboard/bots/${botId}/scheduler`} className="text-primary underline">View all in Scheduler</Link>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentPosts.map((post) => (
                <div key={post.id} className="flex gap-3 py-2 border-b last:border-0">
                  {post.media && (
                    <div className="shrink-0">
                      {post.media.type === 'VIDEO' ? (
                        <div className="relative h-12 w-12 rounded overflow-hidden bg-muted">
                          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                          <video
                            src={`/api/media/${post.media.id}`}
                            className="h-full w-full object-cover"
                            muted
                            preload="metadata"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                            <svg className="h-3 w-3 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                          </div>
                        </div>
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`/api/media/${post.media.id}`}
                          alt={post.media.filename}
                          className="h-12 w-12 rounded object-cover"
                        />
                      )}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${postStatusColors[post.status] || ''}`}>
                        {post.status}
                      </span>
                      {post.platforms.slice(0, 3).map((p) => (
                        <Badge key={p} variant="outline" className="text-[10px] h-5">
                          {platformNames[p] || p}
                        </Badge>
                      ))}
                      {post.platforms.length > 3 && (
                        <span className="text-[10px] text-muted-foreground">+{post.platforms.length - 3}</span>
                      )}
                    </div>
                    <p className="text-sm line-clamp-1 mt-1">{post.content}</p>
                    <p suppressHydrationWarning className="text-[10px] text-muted-foreground mt-0.5">
                      {new Date(post.createdAt).toLocaleString('en', {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
