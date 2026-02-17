'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Loader2, Sparkles, ImageIcon, Film, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';

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
}

export function MediaGenerateForm({ botId }: { botId: string }) {
  const [imagePrompt, setImagePrompt] = useState('');
  const [imagePlatform, setImagePlatform] = useState('INSTAGRAM');
  const [videoPrompt, setVideoPrompt] = useState('');
  const [videoPlatform, setVideoPlatform] = useState('TIKTOK');
  const [results, setResults] = useState<GenerateResult[]>([]);

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
  }, [botId, imagePlatform, imagePrompt]);

  const generateVideo = useCallback(async () => {
    const result: GenerateResult = { type: 'video', status: 'generating' };
    setResults(prev => [result, ...prev]);

    try {
      const res = await fetch('/api/generate/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botId,
          platform: videoPlatform,
          prompt: videoPrompt || undefined,
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
  }, [botId, videoPlatform, videoPrompt]);

  const clearResults = () => setResults([]);

  const isGenerating = results.some(r => r.status === 'generating');

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
            <Input
              placeholder="Describe the image (optional — AI uses your creative style)"
              value={imagePrompt}
              onChange={e => setImagePrompt(e.target.value)}
              className="text-sm"
            />
            <Button
              onClick={generateImage}
              disabled={isGenerating}
              className="w-full gap-2"
              size="sm"
            >
              {isGenerating && results[0]?.type === 'image' && results[0]?.status === 'generating' ? (
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
            <Input
              placeholder="Describe the video (optional — AI uses your creative style)"
              value={videoPrompt}
              onChange={e => setVideoPrompt(e.target.value)}
              className="text-sm"
            />
            <Button
              onClick={generateVideo}
              disabled={isGenerating}
              variant="secondary"
              className="w-full gap-2"
              size="sm"
            >
              {isGenerating && results[0]?.type === 'video' && results[0]?.status === 'generating' ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Generating (may take 1-3 min)...</>
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
            {results.length > 1 && (
              <button
                onClick={clearResults}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Clear all
              </button>
            )}
          </div>
          {results.map((r, i) => (
            <div
              key={i}
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

                  {/* Error display with full detail */}
                  {r.error && (
                    <div className="mt-1.5 space-y-1.5">
                      <p className="text-xs text-destructive break-words whitespace-pre-wrap">
                        {r.error}
                      </p>

                      {/* Configuration help for 503 errors */}
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

                      {/* Auth help for 502 errors */}
                      {r.httpStatus === 502 && (
                        <p className="text-[11px] text-orange-700">
                          Check that your API token is valid and your account has billing enabled.
                        </p>
                      )}

                      {/* Credits help */}
                      {r.httpStatus === 402 && (
                        <p className="text-[11px] text-orange-700">
                          <a href="/dashboard/credits/buy" className="underline">Buy more credits</a> to continue generating.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Success: show prompt */}
                  {r.prompt && r.status === 'success' && (
                    <p className="text-xs text-muted-foreground truncate mt-1">{r.prompt}</p>
                  )}

                  {/* Success: show preview */}
                  {r.status === 'success' && r.mediaUrl && r.type === 'image' && (
                    <div className="mt-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={r.mediaUrl}
                        alt="Generated"
                        className="rounded-md max-h-40 object-contain"
                      />
                    </div>
                  )}
                </div>
                <div className="shrink-0">
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
        Images: Replicate (Flux 1.1 Pro). Videos: Replicate or Runway (configurable in Admin Settings).
        Requires REPLICATE_API_TOKEN in .env. Credits are only deducted on successful generation.
      </p>
    </div>
  );
}
