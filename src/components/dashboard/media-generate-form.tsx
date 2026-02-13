'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Loader2, Sparkles, ImageIcon, Film, CheckCircle, AlertCircle } from 'lucide-react';

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
        setResults(prev => prev.map((r, i) => i === 0 ? { ...r, status: 'error', error: data?.error || `Failed (${res.status})` } : r));
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
      setResults(prev => prev.map((r, i) => i === 0 ? { ...r, status: 'error', error: 'Network error' } : r));
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
        setResults(prev => prev.map((r, i) => i === 0 ? { ...r, status: 'error', error: data?.error || `Failed (${res.status})` } : r));
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
      setResults(prev => prev.map((r, i) => i === 0 ? { ...r, status: 'error', error: 'Network error' } : r));
    }
  }, [botId, videoPlatform, videoPrompt]);

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
          <Label className="text-xs text-muted-foreground">Generation Results</Label>
          {results.map((r, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 p-2 rounded-lg border text-sm ${
                r.status === 'error' ? 'bg-destructive/5 border-destructive/20' :
                r.status === 'success' ? 'bg-green-50 border-green-200' :
                'bg-muted/50'
              }`}
            >
              {r.type === 'image' ? (
                <ImageIcon className="h-4 w-4 text-emerald-500 shrink-0" />
              ) : (
                <Film className="h-4 w-4 text-violet-500 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium">
                  {r.type === 'image' ? 'Image' : 'Video'} generation
                </p>
                {r.error && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> {r.error}
                  </p>
                )}
                {r.prompt && (
                  <p className="text-xs text-muted-foreground truncate">{r.prompt}</p>
                )}
              </div>
              <div className="shrink-0">
                {r.status === 'generating' && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                {r.status === 'success' && <CheckCircle className="h-4 w-4 text-green-600" />}
                {r.status === 'error' && <AlertCircle className="h-4 w-4 text-destructive" />}
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
    </div>
  );
}
