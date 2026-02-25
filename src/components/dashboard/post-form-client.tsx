'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Send, Save, Clock,
  Zap, Globe, AlertTriangle, CheckCircle2,
  Sparkles, Loader2, X, AlertCircle, Camera,
  Info,
} from 'lucide-react';
import { HelpTip } from '@/components/ui/help-tip';
import { PostChatAssistant } from '@/components/dashboard/post-chat-assistant';
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

interface ProductMediaItem {
  id: string;
  filename: string;
  type: string;
  fileSize: number | null;
  mimeType: string | null;
  isPrimary: boolean;
}

interface ProductItem {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  price: string | null;
  primaryImage: { id: string; filename: string; type: string } | null;
  mediaCount: number;
  media: ProductMediaItem[];
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
  products?: ProductItem[];
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
  products = [],
  postCost,
  userCredits,
  preSelectedMediaId,
  successMessage,
  errorMessage,
}: PostFormClientProps) {
  // ── State ──────────────────────────────────────────────────
  const [content, setContent] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<string>>(
    new Set(connectedPlatforms)
  );
  const [selectedMediaId, setSelectedMediaId] = useState<string>(preSelectedMediaId || '');
  const [scheduledAt, setScheduledAt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Per-platform overrides
  const [platformContentOverrides, setPlatformContentOverrides] = useState<Record<string, string>>({});
  const [platformMediaOverrides, setPlatformMediaOverrides] = useState<Record<string, string>>({});
  const [platformPostTypeOverrides, setPlatformPostTypeOverrides] = useState<Record<string, string>>({});
  const [optimizingPlatform, setOptimizingPlatform] = useState<string | null>(null);

  // Reset submitting state when page navigates back with success/error message
  useEffect(() => {
    setIsSubmitting(false);
  }, [successMessage, errorMessage]);

  // AI chat state — open by default
  const [showAiPanel, setShowAiPanel] = useState(true);

  // Optimize error display
  const [optimizeError, setOptimizeError] = useState<string | null>(null);

  // ── Derived data ───────────────────────────────────────────

  const selectedMedia = useMemo(
    () => mediaLibrary.find((m) => m.id === selectedMediaId) || null,
    [mediaLibrary, selectedMediaId]
  );

  const hasMedia = !!selectedMediaId;
  const totalCost = postCost * selectedPlatforms.size;
  const hasEnoughCredits = userCredits >= totalCost;

  // ── Per-platform helpers ────────────────────────────────────

  const getPlatformContent = useCallback((platform: string): string => {
    return platformContentOverrides[platform] ?? content;
  }, [platformContentOverrides, content]);

  const getPlatformMediaId = useCallback((platform: string): string => {
    return platformMediaOverrides[platform] ?? selectedMediaId;
  }, [platformMediaOverrides, selectedMediaId]);

  const getPlatformMedia = useCallback((platform: string): MediaItem | null => {
    const mId = getPlatformMediaId(platform);
    return mediaLibrary.find((m) => m.id === mId) || null;
  }, [getPlatformMediaId, mediaLibrary]);

  const getPlatformPostType = useCallback((platform: string): string => {
    return platformPostTypeOverrides[platform] ?? '';
  }, [platformPostTypeOverrides]);

  const setPlatformContent = useCallback((platform: string, text: string) => {
    setPlatformContentOverrides(prev => ({ ...prev, [platform]: text }));
  }, []);

  const resetPlatformContent = useCallback((platform: string) => {
    setPlatformContentOverrides(prev => {
      const next = { ...prev };
      delete next[platform];
      return next;
    });
  }, []);

  const setPlatformMedia = useCallback((platform: string, mediaId: string) => {
    setPlatformMediaOverrides(prev => ({ ...prev, [platform]: mediaId }));
  }, []);

  const resetPlatformMedia = useCallback((platform: string) => {
    setPlatformMediaOverrides(prev => {
      const next = { ...prev };
      delete next[platform];
      return next;
    });
  }, []);

  const setPlatformPostType = useCallback((platform: string, val: string) => {
    setPlatformPostTypeOverrides(prev => ({ ...prev, [platform]: val }));
  }, []);

  // ── Validation ─────────────────────────────────────────────

  const validationIssues = useMemo((): ValidationIssue[] => {
    const issues: ValidationIssue[] = [];

    for (const platform of Array.from(selectedPlatforms)) {
      const req = platformRequirements[platform];
      if (!req) continue;

      const pContent = getPlatformContent(platform);
      const pMedia = getPlatformMedia(platform);
      const pHasMedia = !!getPlatformMediaId(platform);

      // Media required check
      if (req.mediaRequired && !pHasMedia) {
        issues.push({
          platform,
          type: 'error',
          message: `${req.name} requires an image or video. Text-only posts are not supported.`,
        });
      }

      // Character limit check
      if (pContent.length > req.maxCharacters) {
        issues.push({
          platform,
          type: 'error',
          message: `${req.name}: ${pContent.length.toLocaleString()}/${req.maxCharacters.toLocaleString()} chars (${(pContent.length - req.maxCharacters).toLocaleString()} over limit)`,
        });
      } else if (pContent.length > req.maxCharacters * 0.9 && pContent.length > 0) {
        issues.push({
          platform,
          type: 'warning',
          message: `${req.name}: ${pContent.length.toLocaleString()}/${req.maxCharacters.toLocaleString()} chars (approaching limit)`,
        });
      }

      // Media format compatibility
      if (pMedia) {
        const mediaFormat = getMediaFileExtension(pMedia.mimeType);
        const mediaType = pMedia.type;

        if (!req.supportedMediaTypes.includes(mediaType as 'IMAGE' | 'VIDEO' | 'GIF')) {
          issues.push({
            platform,
            type: 'error',
            message: `${req.name} does not support ${getMediaTypeLabel(mediaType)} files.`,
          });
        }

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

        const fileSizeMB = pMedia.fileSize / (1024 * 1024);
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
  }, [content, selectedPlatforms, platformRequirements, getPlatformContent, getPlatformMedia, getPlatformMediaId, platformContentOverrides, platformMediaOverrides]);

  const errors = validationIssues.filter((i) => i.type === 'error');
  const warnings = validationIssues.filter((i) => i.type === 'warning');
  const canPost = content.trim().length > 0 && selectedPlatforms.size > 0 && errors.length === 0;

  // ── Character count display ────────────────────────────────

  const charCountDisplay = useMemo(() => {
    if (selectedPlatforms.size === 0) return [];

    return Array.from(selectedPlatforms).map((p) => {
      const req = platformRequirements[p];
      const pContent = getPlatformContent(p);
      if (!req) return { platform: p, name: p, count: pContent.length, max: 99999, status: 'ok' as const };

      const ratio = pContent.length / req.maxCharacters;
      let status: 'ok' | 'warning' | 'error' = 'ok';
      if (ratio > 1) status = 'error';
      else if (ratio > 0.9) status = 'warning';

      return { platform: p, name: req.name, count: pContent.length, max: req.maxCharacters, status };
    }).sort((a, b) => a.max - b.max);
  }, [content, selectedPlatforms, platformRequirements, getPlatformContent, platformContentOverrides]);

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

  // ── AI Chat callback ──────────────────────────────────────

  const handleUseAiContent = useCallback((text: string) => {
    // Strip markdown formatting so raw text goes into the post
    const cleaned = text
      .replace(/\*\*(.+?)\*\*/g, '$1')   // **bold** → bold
      .replace(/\*(.+?)\*/g, '$1')       // *italic* → italic
      .replace(/__(.+?)__/g, '$1')       // __bold__ → bold
      .replace(/_(.+?)_/g, '$1')         // _italic_ → italic
      .replace(/~~(.+?)~~/g, '$1')       // ~~strike~~ → strike
      .replace(/^#{1,6}\s+/gm, '')       // # heading → heading
      .replace(/^[>\s]*>\s?/gm, '')      // > blockquote → text
      .replace(/^[-*+]\s+/gm, '')        // - list item → list item
      .replace(/^\d+\.\s+/gm, '')        // 1. list → list
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [link](url) → link
      .replace(/`([^`]+)`/g, '$1');      // `code` → code
    setContent(cleaned);
    // Clear all per-platform content overrides so they inherit the new master text
    setPlatformContentOverrides({});
  }, []);

  // ── Optimize content for a single platform ──────────────

  const optimizeForPlatform = useCallback(async (platform: string) => {
    const pContent = getPlatformContent(platform);
    const req = platformRequirements[platform];
    if (!pContent.trim() || !req || optimizingPlatform) return;

    setOptimizingPlatform(platform);
    setOptimizeError(null);

    const optimizePrompt = `Optimize the following text for posting on ${req.name}. The text MUST fit within ${req.maxCharacters.toLocaleString()} characters. Return ONLY the optimized text, nothing else — no explanations, no labels, no markdown formatting, no [POST] markers. Keep the core message, tone, and meaning. Make it engaging and natural for ${req.name}.

Character limit: ${req.maxCharacters.toLocaleString()} characters
Current length: ${pContent.length.toLocaleString()} characters (${(pContent.length - req.maxCharacters).toLocaleString()} over)

Original text:
${pContent}`;

    try {
      const res = await fetch('/api/chat/post-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botId,
          messages: [{ role: 'user', content: optimizePrompt }],
          platforms: [platform],
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setOptimizeError(data?.error || 'Optimization failed.');
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) { setOptimizeError('No response from AI.'); return; }

      const decoder = new TextDecoder();
      let buffer = '';
      let optimizedText = '';

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
            if (event.text) optimizedText += event.text;
          } catch { /* skip */ }
        }
      }

      if (optimizedText.trim()) {
        // Extract between [POST] markers if present
        const markerMatch = optimizedText.match(/\[POST\]\s*\n?([\s\S]*?)\n?\s*\[\/POST\]/);
        let cleaned = markerMatch ? markerMatch[1].trim() : optimizedText.trim();
        // Strip markdown
        cleaned = cleaned
          .replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1')
          .replace(/__(.+?)__/g, '$1').replace(/_(.+?)_/g, '$1')
          .replace(/~~(.+?)~~/g, '$1').replace(/^#{1,6}\s+/gm, '')
          .replace(/^[>\s]*>\s?/gm, '').replace(/^[-*+]\s+/gm, '')
          .replace(/^\d+\.\s+/gm, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
          .replace(/`([^`]+)`/g, '$1');
        setPlatformContent(platform, cleaned);
      }
    } catch {
      setOptimizeError('Network error.');
    } finally {
      setOptimizingPlatform(null);
    }
  }, [getPlatformContent, platformRequirements, optimizingPlatform, botId, setPlatformContent]);

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

    // Per-platform post types
    const igPT = getPlatformPostType('INSTAGRAM');
    const fbPT = getPlatformPostType('FACEBOOK');
    const thPT = getPlatformPostType('THREADS');
    if (igPT) addHidden('postType', igPT);
    if (fbPT) addHidden('fbPostType', fbPT);
    if (thPT) addHidden('threadsPostType', thPT);

    for (const p of Array.from(selectedPlatforms)) {
      addHidden('platforms', p);
    }

    // Per-platform content & media overrides as JSON
    const platformContent: Record<string, { content?: string; mediaId?: string }> = {};
    for (const p of Array.from(selectedPlatforms)) {
      const hasContentOverride = platformContentOverrides[p] !== undefined;
      const hasMediaOverride = platformMediaOverrides[p] !== undefined;
      if (hasContentOverride || hasMediaOverride) {
        platformContent[p] = {};
        if (hasContentOverride) platformContent[p].content = platformContentOverrides[p];
        if (hasMediaOverride) platformContent[p].mediaId = platformMediaOverrides[p];
      }
    }
    if (Object.keys(platformContent).length > 0) {
      addHidden('platformContent', JSON.stringify(platformContent));
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
          <div className="space-y-4">
            {/* ═══════ Target Platforms — Full Width ═══════ */}
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

                {/* Platform checkboxes in a responsive grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
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

            {/* ═══════ All Content Cards — Full Width ═══════ */}
            <div className="space-y-4">
              {/* Product Selector */}
              {products.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Sparkles className="h-4 w-4" /> Promote a Product
                      <HelpTip text="Select a product to give AI full context about what you're promoting. The AI will use product details (description, advantages, target audience) to create better content." />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    <select
                      value={selectedProductId}
                      onChange={(e) => setSelectedProductId(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="">No product (general post)</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}{p.brand ? ` — ${p.brand}` : ''}{p.price ? ` (${p.price})` : ''}
                        </option>
                      ))}
                    </select>
                    {selectedProductId && (() => {
                      const prod = products.find(p => p.id === selectedProductId);
                      if (!prod) return null;
                      return (
                        <>
                          <div className="flex items-center gap-3 p-2 rounded-md bg-amber-50 border border-amber-200">
                            {prod.primaryImage && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={`/api/media/${prod.primaryImage.id}`}
                                alt={prod.name}
                                className="h-10 w-10 rounded object-cover shrink-0"
                              />
                            )}
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{prod.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {[prod.category, prod.price].filter(Boolean).join(' · ')}
                                {prod.mediaCount > 0 && ` · ${prod.mediaCount} media`}
                              </p>
                            </div>
                          </div>

                          {/* Product Media Picker */}
                          {prod.media.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-xs font-medium text-muted-foreground">
                                Product media — click to attach to this post:
                              </p>
                              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                                {prod.media.map((pm) => {
                                  const isSelected = selectedMediaId === pm.id;
                                  const sizeMB = pm.fileSize ? (pm.fileSize / (1024 * 1024)).toFixed(1) : null;
                                  return (
                                    <button
                                      key={pm.id}
                                      type="button"
                                      onClick={() => setSelectedMediaId(isSelected ? '' : pm.id)}
                                      className={`relative rounded-lg overflow-hidden border-2 transition-all text-left ${
                                        isSelected
                                          ? 'border-primary shadow-md ring-1 ring-primary/30'
                                          : 'border-muted hover:border-muted-foreground/30 hover:shadow-sm'
                                      }`}
                                    >
                                      <div className="h-20 w-full relative">
                                        {pm.type === 'VIDEO' ? (
                                          <>
                                            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                                            <video src={`/api/media/${pm.id}`} className="h-full w-full object-cover" muted preload="metadata" />
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                              <div className="h-6 w-6 rounded-full bg-black/50 flex items-center justify-center">
                                                <svg className="h-3 w-3 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                                              </div>
                                            </div>
                                          </>
                                        ) : (
                                          // eslint-disable-next-line @next/next/no-img-element
                                          <img src={`/api/media/${pm.id}`} alt={pm.filename} className="h-full w-full object-cover" />
                                        )}
                                        {/* Type badge */}
                                        <span className={`absolute top-1 left-1 text-[9px] px-1 py-0.5 rounded font-medium text-white ${pm.type === 'VIDEO' ? 'bg-purple-600/80' : 'bg-emerald-600/80'}`}>
                                          {pm.type === 'VIDEO' ? 'VIDEO' : 'IMG'}
                                        </span>
                                        {/* Primary star */}
                                        {pm.isPrimary && (
                                          <span className="absolute top-1 right-1 text-amber-400 drop-shadow" title="Primary image">
                                            <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                                          </span>
                                        )}
                                        {/* Selected checkmark */}
                                        {isSelected && (
                                          <div className="absolute top-1 right-1 h-5 w-5 rounded-full bg-primary flex items-center justify-center shadow">
                                            <CheckCircle2 className="h-3.5 w-3.5 text-primary-foreground" />
                                          </div>
                                        )}
                                      </div>
                                      <div className="px-1.5 py-1">
                                        <p className="text-[10px] truncate" title={pm.filename}>{pm.filename}</p>
                                        {sizeMB && <p className="text-[9px] text-muted-foreground">{sizeMB} MB</p>}
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                              {/* Use Primary button */}
                              {prod.primaryImage && selectedMediaId !== prod.primaryImage.id && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="gap-1.5 text-xs w-full"
                                  onClick={() => setSelectedMediaId(prod.primaryImage!.id)}
                                >
                                  <Sparkles className="h-3 w-3 text-amber-500" />
                                  Use Primary Image ({prod.primaryImage.filename})
                                </Button>
                              )}
                            </div>
                          )}
                        </>
                      );
                    })()}
                    <input type="hidden" name="productId" value={selectedProductId} form="post-form" />
                  </CardContent>
                </Card>
              )}

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
                      variant={showAiPanel ? 'secondary' : 'outline'}
                      size="sm"
                      className="gap-1.5"
                      onClick={() => setShowAiPanel(!showAiPanel)}
                    >
                      <Sparkles className="h-4 w-4" />
                      {showAiPanel ? 'Hide AI Assistant' : 'Show AI Assistant'}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* AI Chat Assistant Panel */}
                  {showAiPanel && (
                    <PostChatAssistant
                      botId={botId}
                      platforms={Array.from(selectedPlatforms)}
                      productId={selectedProductId || undefined}
                      onUseContent={handleUseAiContent}
                      onClose={() => setShowAiPanel(false)}
                    />
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

                    {/* Hint about per-platform optimization below */}
                    {content.trim().length > 0 && selectedPlatforms.size > 0 && (
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Info className="h-3 w-3" /> Edit &amp; optimize text per-platform below in Platform Details
                      </p>
                    )}

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

                </CardContent>
              </Card>

              {/* ═══════ Per-Platform Customization Cards ═══════ */}
              {selectedPlatforms.size > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Globe className="h-4 w-4" /> Platform Details
                      <HelpTip text="Customize content and media for each platform individually. Each platform shows its own text, media, post type, and preview. Changes here override the master content above." />
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Edit text, pick media, and preview each platform. Default: uses master content above.
                    </CardDescription>

                    {/* Default media selector */}
                    <div className="mt-2 space-y-1.5">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <Camera className="h-3 w-3" /> Default media (applies to all platforms unless overridden)
                      </Label>
                      <div className="flex items-center gap-2">
                        <select
                          value={selectedMediaId}
                          onChange={(e) => setSelectedMediaId(e.target.value)}
                          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs"
                        >
                          <option value="">-- No media (optional) --</option>
                          {mediaLibrary.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.type === 'VIDEO' ? '[VIDEO]' : '[IMG]'} {m.filename}
                              {m.fileSize ? ` (${(m.fileSize / (1024 * 1024)).toFixed(1)}MB)` : ''}
                            </option>
                          ))}
                        </select>
                        {mediaLibrary.length === 0 && (
                          <Link href={`/dashboard/bots/${botId}/media`} className="text-xs text-primary underline whitespace-nowrap">
                            Upload media
                          </Link>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-0">
                    {Array.from(selectedPlatforms).map((platform) => {
                      const req = platformRequirements[platform];
                      if (!req) return null;
                      const pContent = getPlatformContent(platform);
                      const pMediaId = getPlatformMediaId(platform);
                      const pMedia = getPlatformMedia(platform);
                      const pPostType = getPlatformPostType(platform);
                      const pHasMedia = !!pMediaId;
                      const hasContentOverride = platformContentOverrides[platform] !== undefined;
                      const hasMediaOverride = platformMediaOverrides[platform] !== undefined;
                      const pName = platformNames[platform] || platform;
                      const isVideo = pMedia?.type === 'VIDEO';
                      const mediaUrl = pMedia ? `/api/media/${pMedia.id}` : null;

                      // Char status
                      const charRatio = pContent.length / req.maxCharacters;
                      const charStatus: 'ok' | 'warning' | 'error' = charRatio > 1 ? 'error' : charRatio > 0.9 ? 'warning' : 'ok';
                      const charColor = charStatus === 'error' ? 'text-red-600' : charStatus === 'warning' ? 'text-yellow-600' : 'text-green-600';

                      // Validation for this platform
                      const pIssues = validationIssues.filter(i => i.platform === platform);
                      const pErrors = pIssues.filter(i => i.type === 'error');
                      const allOk = pErrors.length === 0 && pContent.trim().length > 0;

                      // Post type options per platform
                      const postTypeOptions: { value: string; label: string }[] = [];
                      if (platform === 'INSTAGRAM') {
                        postTypeOptions.push(
                          { value: '', label: 'Auto-detect' },
                          { value: 'feed', label: 'Feed Post (image)' },
                          { value: 'reel', label: 'Reel (video)' },
                          { value: 'story', label: 'Story (24h)' },
                          { value: 'carousel', label: 'Carousel (2-10)' },
                        );
                      } else if (platform === 'FACEBOOK') {
                        postTypeOptions.push(
                          { value: '', label: 'Auto-detect' },
                          { value: 'text', label: 'Text Post' },
                          { value: 'photo', label: 'Photo Post' },
                          { value: 'video', label: 'Video Post' },
                          { value: 'reel', label: 'Reel (9:16)' },
                          { value: 'link', label: 'Link Post' },
                        );
                      } else if (platform === 'THREADS') {
                        postTypeOptions.push(
                          { value: '', label: 'Auto-detect' },
                          { value: 'text', label: 'Text Post' },
                          { value: 'image', label: 'Image Post' },
                          { value: 'video', label: 'Video Post' },
                          { value: 'carousel', label: 'Carousel (2-20)' },
                        );
                      }

                      return (
                        <div
                          key={platform}
                          className={`rounded-lg border-2 overflow-hidden ${
                            pErrors.length > 0 ? 'border-red-300 bg-red-50/30' : allOk ? 'border-green-200 bg-green-50/20' : 'border-muted'
                          }`}
                        >
                          {/* Platform header */}
                          <div className={`flex items-center justify-between px-3 py-2 ${
                            pErrors.length > 0 ? 'bg-red-50' : allOk ? 'bg-green-50' : 'bg-muted/30'
                          }`}>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold">{pName}</span>
                              {allOk ? (
                                <Badge variant="secondary" className="text-[9px] bg-green-100 text-green-700 gap-0.5">
                                  <CheckCircle2 className="h-2.5 w-2.5" /> Ready
                                </Badge>
                              ) : pErrors.length > 0 ? (
                                <Badge variant="destructive" className="text-[9px] gap-0.5">
                                  <AlertCircle className="h-2.5 w-2.5" /> {pErrors.length} issue{pErrors.length > 1 ? 's' : ''}
                                </Badge>
                              ) : null}
                              {req.mediaRequired && (
                                <Badge variant={pHasMedia ? 'secondary' : 'destructive'} className="text-[9px] gap-0.5">
                                  <Camera className="h-2.5 w-2.5" /> {pHasMedia ? 'Media attached' : 'Media required'}
                                </Badge>
                              )}
                            </div>
                            <span className={`text-xs font-mono ${charColor}`}>
                              {pContent.length.toLocaleString()}/{req.maxCharacters.toLocaleString()}
                            </span>
                          </div>

                          <div className="px-3 py-3 space-y-3">
                            {/* Per-platform content textarea */}
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <Label className="text-xs text-muted-foreground">
                                  {hasContentOverride ? 'Custom text for ' + pName : 'Text (inherited from master)'}
                                </Label>
                                {hasContentOverride && (
                                  <button
                                    type="button"
                                    onClick={() => resetPlatformContent(platform)}
                                    className="text-[10px] text-primary hover:underline"
                                  >
                                    Reset to master
                                  </button>
                                )}
                              </div>
                              <textarea
                                value={pContent}
                                onChange={(e) => setPlatformContent(platform, e.target.value)}
                                className={`flex min-h-[80px] w-full rounded-md border px-2 py-1.5 text-xs resize-y focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                                  hasContentOverride ? 'border-primary/50 bg-primary/5' : 'border-input bg-background'
                                }`}
                                placeholder="Edit to customize for this platform..."
                              />

                              {/* Char progress bar */}
                              <div className="h-1 rounded-full bg-muted overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    charStatus === 'error' ? 'bg-red-500' : charStatus === 'warning' ? 'bg-yellow-500' : 'bg-green-500'
                                  }`}
                                  style={{ width: `${Math.min(charRatio * 100, 100)}%` }}
                                />
                              </div>

                              {/* Optimize button - always visible */}
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="gap-1.5 text-xs h-8"
                                onClick={() => optimizeForPlatform(platform)}
                                disabled={optimizingPlatform !== null || !pContent.trim()}
                              >
                                {optimizingPlatform === platform ? (
                                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Optimizing...</>
                                ) : (
                                  <><Sparkles className="h-3.5 w-3.5" /> Optimize for {pName} ({req.maxCharacters.toLocaleString()} chars) — ~2 credits</>
                                )}
                              </Button>
                              {optimizeError && optimizingPlatform === null && (
                                <p className="text-[10px] text-destructive">{optimizeError}</p>
                              )}
                            </div>

                            {/* Per-platform media + post type row */}
                            <div className="grid grid-cols-2 gap-3 items-end">
                              {/* Media selector */}
                              <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <Label className="text-xs text-muted-foreground">Media</Label>
                                  {hasMediaOverride && (
                                    <button type="button" onClick={() => resetPlatformMedia(platform)} className="text-[10px] text-primary hover:underline">
                                      Reset
                                    </button>
                                  )}
                                </div>
                                <select
                                  value={pMediaId}
                                  onChange={(e) => setPlatformMedia(platform, e.target.value)}
                                  className={`flex h-9 w-full rounded-md border px-2 py-1 text-xs ${
                                    hasMediaOverride ? 'border-primary/50 bg-primary/5' : 'border-input bg-background'
                                  }`}
                                >
                                  <option value="">
                                    {req.mediaRequired ? '-- REQUIRED --' : '-- None --'}
                                  </option>
                                  {mediaLibrary.map((m) => (
                                    <option key={m.id} value={m.id}>
                                      {m.type === 'VIDEO' ? '[VID]' : '[IMG]'} {m.filename} ({(m.fileSize / (1024 * 1024)).toFixed(1)}MB)
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {/* Post type selector - always takes its column */}
                              <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Post Type</Label>
                                {postTypeOptions.length > 0 ? (
                                  <select
                                    value={pPostType}
                                    onChange={(e) => setPlatformPostType(platform, e.target.value)}
                                    className="flex h-9 w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
                                  >
                                    {postTypeOptions.map((opt) => (
                                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <div className="flex h-9 w-full items-center rounded-md border border-input bg-muted/30 px-2 text-xs text-muted-foreground">
                                    Standard post
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Validation issues for this platform */}
                            {pIssues.length > 0 && (
                              <div className="space-y-0.5">
                                {pIssues.map((issue, i) => (
                                  <p key={i} className={`text-[10px] flex items-center gap-1 ${issue.type === 'error' ? 'text-red-600' : 'text-yellow-600'}`}>
                                    {issue.type === 'error' ? <AlertCircle className="h-3 w-3 shrink-0" /> : <AlertTriangle className="h-3 w-3 shrink-0" />}
                                    {issue.message.replace(`${req.name}: `, '').replace(`${req.name} `, '')}
                                  </p>
                                ))}
                              </div>
                            )}

                            {/* ── Realistic Preview ── */}
                            <div className="space-y-1">
                              <Label className="text-[10px] text-muted-foreground">Preview</Label>

                              {platform === 'FACEBOOK' && (() => {
                                const fbIsReel = pPostType === 'reel';
                                const fbMediaAspect = fbIsReel ? 'aspect-[9/16] max-h-[280px]' : 'aspect-[1.91/1]';
                                return (
                                  <div className="rounded-lg border bg-white shadow-sm max-w-full overflow-hidden">
                                    <div className="flex items-center gap-2 p-2.5">
                                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-[10px] font-bold shrink-0">
                                        {botName.charAt(0).toUpperCase()}
                                      </div>
                                      <div>
                                        <p className="text-xs font-semibold text-gray-900">{botName}</p>
                                        <p className="text-[9px] text-gray-500">Just now · 🌐{fbIsReel ? ' · Reel' : ''}</p>
                                      </div>
                                    </div>
                                    {!fbIsReel && (
                                      <div className="px-2.5 pb-1.5">
                                        <p className="text-[11px] text-gray-900 whitespace-pre-wrap break-words">
                                          {pContent.length > 300 ? pContent.slice(0, 300) + '... See more' : pContent}
                                        </p>
                                      </div>
                                    )}
                                    {mediaUrl && (
                                      <div className={`${fbMediaAspect} bg-gray-100 overflow-hidden relative`}>
                                        {isVideo ? (
                                          /* eslint-disable-next-line jsx-a11y/media-has-caption */
                                          <video src={mediaUrl} className="w-full h-full object-cover" muted preload="metadata" />
                                        ) : (
                                          /* eslint-disable-next-line @next/next/no-img-element */
                                          <img src={mediaUrl} alt="" className="w-full h-full object-cover" />
                                        )}
                                        {fbIsReel && (
                                          <div className="absolute bottom-2 left-2 right-2">
                                            <p className="text-[10px] text-white drop-shadow-lg line-clamp-2">{pContent.slice(0, 100)}</p>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                    {fbIsReel && !mediaUrl && (
                                      <div className="aspect-[9/16] max-h-[280px] bg-gray-900 flex items-center justify-center text-gray-500 text-xs">
                                        Reel requires video
                                      </div>
                                    )}
                                    <div className="flex items-center justify-around py-1 px-2 border-t text-gray-400 text-[9px]">
                                      <span>👍 Like</span><span>💬 Comment</span><span>↗️ Share</span>
                                    </div>
                                  </div>
                                );
                              })()}

                              {platform === 'INSTAGRAM' && (() => {
                                const igIsReel = pPostType === 'reel';
                                const igIsStory = pPostType === 'story';
                                const igIsCarousel = pPostType === 'carousel';
                                const igIsVertical = igIsReel || igIsStory;
                                const igMediaAspect = igIsVertical ? 'aspect-[9/16] max-h-[300px]' : 'aspect-square';
                                return (
                                  <div className="rounded-lg border bg-white shadow-sm max-w-full overflow-hidden">
                                    {/* Story/Reel: no header, overlay style */}
                                    {!igIsStory && (
                                      <div className="flex items-center gap-2 p-2.5">
                                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-yellow-400 via-red-500 to-purple-600 p-[1.5px] shrink-0">
                                          <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-[9px] font-bold text-gray-900">
                                            {botName.charAt(0).toUpperCase()}
                                          </div>
                                        </div>
                                        <p className="text-xs font-semibold text-gray-900">
                                          {botName.toLowerCase().replace(/\s+/g, '')}
                                          {igIsReel && <span className="text-[9px] font-normal text-gray-500 ml-1">· Reel</span>}
                                          {igIsCarousel && <span className="text-[9px] font-normal text-gray-500 ml-1">· Carousel</span>}
                                        </p>
                                      </div>
                                    )}
                                    {mediaUrl ? (
                                      <div className={`${igMediaAspect} bg-gray-100 overflow-hidden relative`}>
                                        {isVideo ? (
                                          /* eslint-disable-next-line jsx-a11y/media-has-caption */
                                          <video src={mediaUrl} className="w-full h-full object-cover" muted preload="metadata" />
                                        ) : (
                                          /* eslint-disable-next-line @next/next/no-img-element */
                                          <img src={mediaUrl} alt="" className="w-full h-full object-cover" />
                                        )}
                                        {igIsStory && (
                                          <div className="absolute top-2 left-2 flex items-center gap-1.5">
                                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-yellow-400 via-red-500 to-purple-600 p-[1px]">
                                              <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-[7px] font-bold">
                                                {botName.charAt(0).toUpperCase()}
                                              </div>
                                            </div>
                                            <span className="text-[10px] text-white font-semibold drop-shadow-lg">{botName.toLowerCase().replace(/\s+/g, '')}</span>
                                          </div>
                                        )}
                                        {igIsReel && (
                                          <div className="absolute bottom-2 left-2 right-2">
                                            <p className="text-[10px] text-white drop-shadow-lg line-clamp-2">
                                              <span className="font-semibold">{botName.toLowerCase().replace(/\s+/g, '')}</span>{' '}
                                              {pContent.slice(0, 80)}
                                            </p>
                                          </div>
                                        )}
                                        {igIsCarousel && (
                                          <div className="absolute top-2 right-2 bg-black/50 text-white text-[8px] px-1.5 py-0.5 rounded-full">
                                            1 / 2+
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <div className={`${igIsVertical ? 'aspect-[9/16] max-h-[300px]' : 'aspect-[4/3]'} bg-gray-100 flex items-center justify-center text-gray-400 text-xs`}>
                                        {req.mediaRequired ? '⚠ Image/video required' : 'No media'}
                                      </div>
                                    )}
                                    {!igIsStory && (
                                      <>
                                        <div className="flex items-center justify-between px-2.5 py-1.5 text-gray-900">
                                          <div className="flex items-center gap-3"><span>♡</span><span>💬</span><span>↗️</span></div>
                                          <span>🔖</span>
                                        </div>
                                        {igIsCarousel && (
                                          <div className="flex justify-center gap-1 pb-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                            <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                                            <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                                          </div>
                                        )}
                                        <div className="px-2.5 pb-2">
                                          <p className="text-[11px] text-gray-900">
                                            <span className="font-semibold">{botName.toLowerCase().replace(/\s+/g, '')}</span>{' '}
                                            {pContent.length > 100 ? pContent.slice(0, 100) + '... more' : pContent}
                                          </p>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                );
                              })()}

                              {platform === 'THREADS' && (() => {
                                const thIsCarousel = pPostType === 'carousel';
                                return (
                                  <div className="rounded-lg border bg-white shadow-sm max-w-full p-2.5">
                                    <div className="flex items-start gap-2">
                                      <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-600 shrink-0">
                                        {botName.charAt(0).toUpperCase()}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1">
                                          <span className="text-xs font-semibold text-gray-900">{botName.toLowerCase().replace(/\s+/g, '')}</span>
                                          <span className="text-[10px] text-gray-500">· now</span>
                                        </div>
                                        <p className="text-[11px] text-gray-900 mt-0.5 whitespace-pre-wrap break-words">
                                          {pContent.length > 500 ? pContent.slice(0, 500) : pContent}
                                        </p>
                                        {mediaUrl && (
                                          <div className={`mt-1.5 rounded-lg overflow-hidden border ${thIsCarousel ? 'aspect-square' : 'aspect-[16/9]'} bg-gray-100 relative`}>
                                            {isVideo ? (
                                              /* eslint-disable-next-line jsx-a11y/media-has-caption */
                                              <video src={mediaUrl} className="w-full h-full object-cover" muted preload="metadata" />
                                            ) : (
                                              /* eslint-disable-next-line @next/next/no-img-element */
                                              <img src={mediaUrl} alt="" className="w-full h-full object-cover" />
                                            )}
                                            {thIsCarousel && (
                                              <div className="absolute top-1.5 right-1.5 bg-black/50 text-white text-[8px] px-1.5 py-0.5 rounded-full">
                                                1 / 2+
                                              </div>
                                            )}
                                          </div>
                                        )}
                                        <div className="flex items-center gap-4 mt-1.5 text-gray-400 text-[10px]">
                                          <span>♡</span><span>💬</span><span>🔁</span><span>↗️</span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })()}

                              {/* Generic preview for other platforms */}
                              {platform !== 'FACEBOOK' && platform !== 'INSTAGRAM' && platform !== 'THREADS' && (
                                <div className="rounded-lg border bg-white shadow-sm p-2.5">
                                  <div className="flex items-center gap-1.5 mb-1.5">
                                    <Badge variant="outline" className="text-[9px]">{pName}</Badge>
                                    {pHasMedia && <Badge variant="secondary" className="text-[9px]">{isVideo ? 'Video' : 'Image'}</Badge>}
                                  </div>
                                  {mediaUrl && (
                                    <div className="rounded overflow-hidden aspect-video bg-gray-100 mb-1.5">
                                      {isVideo ? (
                                        /* eslint-disable-next-line jsx-a11y/media-has-caption */
                                        <video src={mediaUrl} className="w-full h-full object-cover" muted preload="metadata" />
                                      ) : (
                                        /* eslint-disable-next-line @next/next/no-img-element */
                                        <img src={mediaUrl} alt="" className="w-full h-full object-cover" />
                                      )}
                                    </div>
                                  )}
                                  <p className="text-[11px] text-gray-900 whitespace-pre-wrap break-words line-clamp-3">{pContent}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}

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

          </div>
        </form>
      )}

    </div>
  );
}
