'use client';

import { useState, useCallback, useRef, useEffect, type ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2, Sparkles, ImageIcon, Film, CheckCircle, AlertCircle, XCircle, Upload, X } from 'lucide-react';

const PLATFORMS = [
  { value: 'INSTAGRAM', label: 'Instagram (1080x1080)' },
  { value: 'FACEBOOK', label: 'Facebook (1200x630)' },
  { value: 'TWITTER', label: 'X / Twitter (1200x675)' },
  { value: 'LINKEDIN', label: 'LinkedIn (1200x627)' },
  { value: 'TIKTOK', label: 'TikTok (1080x1920)' },
  { value: 'YOUTUBE', label: 'YouTube (1280x720)' },
  { value: 'PINTEREST', label: 'Pinterest (1000x1500)' },
  { value: 'THREADS', label: 'Threads (1080x1080)' },
];

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
}

interface PendingMedia {
  id: string;
  replicatePredictionId: string;
  generationStatus: string;
  aiDescription: string | null;
  createdAt: string;
}

const POLL_INTERVAL = 5000;
const MAX_POLLS = 60; // 5 minutes

export function MediaGenerateForm({ botId }: { botId: string }) {
  const [imagePrompt, setImagePrompt] = useState('');
  const [imagePlatform, setImagePlatform] = useState('INSTAGRAM');
  const [videoPrompt, setVideoPrompt] = useState('');
  const [videoPlatform, setVideoPlatform] = useState('TIKTOK');
  const [results, setResults] = useState<GenerateResult[]>([]);
  const abortRefs = useRef<Map<string, AbortController>>(new Map());
  const [imageRef, setImageRef] = useState<string | null>(null);
  const [imageRefName, setImageRefName] = useState<string>('');
  const [videoRef, setVideoRef] = useState<string | null>(null);
  const [videoRefName, setVideoRefName] = useState<string>('');
  const imageFileRef = useRef<HTMLInputElement>(null);
  const videoFileRef = useRef<HTMLInputElement>(null);
  const hasResumed = useRef(false);

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

          // Add as generating result
          const result: GenerateResult = {
            type: 'video',
            status: 'generating',
            progress: 'Resuming video generation...',
            predictionId: p.replicatePredictionId,
            prompt: p.aiDescription || undefined,
          };
          setResults(prev => [result, ...prev]);

          // Start polling
          pollPrediction(p.replicatePredictionId, pending.indexOf(p));
        }
      } catch {
        // Silently ignore — not critical
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

        // Still processing
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

    // Timeout
    setResults(prev => prev.map(r => {
      if (r.predictionId === predictionId && r.status === 'generating') {
        return { ...r, status: 'error', error: 'Video generation timed out after 5 minutes. Check the Media Library — the video may still appear.' };
      }
      return r;
    }));
    abortRefs.current.delete(predictionId);
  }, []);

  // Handle reference file selection
  const handleRefFile = useCallback((e: ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Max 10MB for reference images
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

  const generateImage = useCallback(async () => {
    const result: GenerateResult = { type: 'image', status: 'generating' };
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
      } : r));
    } catch {
      setResults(prev => prev.map((r, i) => i === 0 ? {
        ...r,
        status: 'error',
        error: 'Network error — check your internet connection and try again.',
      } : r));
    }
  }, [botId, imagePlatform, imagePrompt, imageRef]);

  const generateVideo = useCallback(async () => {
    const result: GenerateResult = { type: 'video', status: 'generating', progress: 'Starting video generation...' };
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
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const error = data?.error || `Failed to start video generation (HTTP ${res.status})`;
        setResults(prev => prev.map((r, i) => i === 0 ? { ...r, status: 'error', error, httpStatus: res.status } : r));
        return;
      }

      const data = await res.json();

      // If response already has final result (Runway synchronous path)
      if (data.status === 'succeeded') {
        setResults(prev => prev.map((r, i) => i === 0 ? {
          ...r,
          status: 'success',
          mediaId: data.id,
          mediaUrl: data.url,
          prompt: data.prompt,
        } : r));
        return;
      }

      const predictionId = data.predictionId;
      if (!predictionId) {
        setResults(prev => prev.map((r, i) => i === 0 ? {
          ...r,
          status: 'error',
          error: 'Server did not return a prediction ID. Check server logs.',
        } : r));
        return;
      }

      // Store predictionId on the result for cancel functionality
      setResults(prev => prev.map((r, i) => i === 0 ? {
        ...r,
        predictionId,
        progress: 'Video generation started. This takes 1-3 minutes...',
      } : r));

      // Start polling
      pollPrediction(predictionId, 0);
    } catch (err) {
      setResults(prev => prev.map((r, i) => i === 0 ? {
        ...r,
        status: 'error',
        error: 'Network error — check your internet connection and try again.',
      } : r));
    }
  }, [botId, videoPlatform, videoPrompt, videoRef, pollPrediction]);

  const cancelGeneration = useCallback(async (predictionId: string) => {
    // Abort client-side polling
    const controller = abortRefs.current.get(predictionId);
    if (controller) controller.abort();
    abortRefs.current.delete(predictionId);

    // Cancel on server (DELETE /api/generate/video?predictionId=xxx)
    try {
      await fetch(`/api/generate/video?predictionId=${encodeURIComponent(predictionId)}`, {
        method: 'DELETE',
      });
    } catch {
      // Ignore cancel errors
    }

    // Remove from results
    setResults(prev => prev.filter(r => r.predictionId !== predictionId));
  }, []);

  const clearResults = () => {
    // Abort all ongoing polls
    Array.from(abortRefs.current.values()).forEach(controller => controller.abort());
    abortRefs.current.clear();
    setResults(prev => prev.filter(r => r.status === 'generating'));
  };

  const isGeneratingImage = results.some(r => r.type === 'image' && r.status === 'generating');
  const isGeneratingVideo = results.some(r => r.type === 'video' && r.status === 'generating');
  const isGenerating = isGeneratingImage || isGeneratingVideo;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        {/* Generate Image */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-emerald-500" />
            <Label className="font-medium">Generate Image</Label>
            <span className="text-xs text-muted-foreground ml-auto">3 credits</span>
          </div>
          <div className="space-y-2">
            <select
              value={imagePlatform}
              onChange={e => setImagePlatform(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              {PLATFORMS.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            <textarea
              placeholder="Describe the image you want to generate. Be specific about subjects, style, colors, composition. Leave empty to use your Creative Style preferences."
              value={imagePrompt}
              onChange={e => setImagePrompt(e.target.value)}
              rows={3}
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y"
            />

            {/* Reference image upload */}
            <div>
              <input
                ref={imageFileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={e => handleRefFile(e, 'image')}
                className="hidden"
              />
              {imageRef ? (
                <div className="flex items-center gap-2 p-2 rounded-md border border-input bg-muted/50 text-xs">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageRef} alt="Reference" className="h-10 w-10 object-cover rounded" />
                  <span className="flex-1 truncate">{imageRefName}</span>
                  <button
                    onClick={() => { setImageRef(null); setImageRefName(''); }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => imageFileRef.current?.click()}
                  className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Upload className="h-3 w-3" /> Add reference image (style guide)
                </button>
              )}
            </div>

            <Button
              onClick={generateImage}
              disabled={isGeneratingImage}
              className="w-full gap-2"
              size="sm"
            >
              {isGeneratingImage ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
              ) : (
                <><Sparkles className="h-4 w-4" /> Generate Image</>
              )}
            </Button>
          </div>
        </div>

        {/* Generate Video */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Film className="h-4 w-4 text-violet-500" />
            <Label className="font-medium">Generate Video</Label>
            <span className="text-xs text-muted-foreground ml-auto">8 credits</span>
          </div>
          <div className="space-y-2">
            <select
              value={videoPlatform}
              onChange={e => setVideoPlatform(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              {PLATFORMS.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            <textarea
              placeholder="Describe the video you want to generate. Be specific about the action, scene, movement. Example: 'A cat dancing on a colorful stage with disco lights'. Leave empty to use your Creative Style preferences."
              value={videoPrompt}
              onChange={e => setVideoPrompt(e.target.value)}
              rows={3}
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y"
            />

            {/* Reference image upload for video (first frame) */}
            <div>
              <input
                ref={videoFileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={e => handleRefFile(e, 'video')}
                className="hidden"
              />
              {videoRef ? (
                <div className="flex items-center gap-2 p-2 rounded-md border border-input bg-muted/50 text-xs">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={videoRef} alt="Reference" className="h-10 w-10 object-cover rounded" />
                  <span className="flex-1 truncate">{videoRefName}</span>
                  <button
                    onClick={() => { setVideoRef(null); setVideoRefName(''); }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => videoFileRef.current?.click()}
                  className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Upload className="h-3 w-3" /> Add reference image (first frame)
                </button>
              )}
            </div>

            <Button
              onClick={generateVideo}
              disabled={isGeneratingVideo}
              variant="secondary"
              className="w-full gap-2"
              size="sm"
            >
              {isGeneratingVideo ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Generating (1-3 min)...</>
              ) : (
                <><Sparkles className="h-4 w-4" /> Generate Video</>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Generation results */}
      {results.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Generation Results</Label>
            {results.some(r => r.status !== 'generating') && (
              <button
                onClick={clearResults}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
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
                    {r.type === 'image' ? 'Image' : 'Video'} generation
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
                            <li>Add it to your <code className="bg-orange-100 px-1 rounded">.env</code> file on the server</li>
                            <li>Restart the server: <code className="bg-orange-100 px-1 rounded">pm2 restart grothi</code></li>
                          </ol>
                        </div>
                      )}
                      {r.httpStatus === 502 && (
                        <p className="text-[11px] text-orange-700">Check that your API token is valid and your account has billing enabled.</p>
                      )}
                      {r.httpStatus === 402 && (
                        <p className="text-[11px] text-orange-700">
                          <a href="/dashboard/credits/buy" className="underline">Buy more credits</a> to continue generating.
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
        Images: Replicate (Flux 1.1 Pro). Videos: Replicate (MiniMax) or Runway (configurable in Admin Settings).
        Requires REPLICATE_API_TOKEN in .env. Credits are only deducted on successful generation.
        Video generation persists across page refresh — you can safely navigate away.
      </p>
    </div>
  );
}
