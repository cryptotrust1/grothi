'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, Film, Key, Settings } from 'lucide-react';

interface Props {
  initialProvider: 'replicate' | 'runway';
  replicateKeyPreview: string | null;
  runwayKeyPreview: string | null;
  replicateConfigured: boolean;
  runwayConfigured: boolean;
}

export function AdminSettingsClient({
  initialProvider,
  replicateKeyPreview: initialReplicatePreview,
  runwayKeyPreview: initialRunwayPreview,
  replicateConfigured: initialReplicateConfigured,
  runwayConfigured: initialRunwayConfigured,
}: Props) {
  const [provider, setProvider] = useState(initialProvider);
  const [replicateKey, setReplicateKey] = useState('');
  const [runwayKey, setRunwayKey] = useState('');
  const [replicatePreview, setReplicatePreview] = useState(initialReplicatePreview);
  const [runwayPreview, setRunwayPreview] = useState(initialRunwayPreview);
  const [replicateConfigured, setReplicateConfigured] = useState(initialReplicateConfigured);
  const [runwayConfigured, setRunwayConfigured] = useState(initialRunwayConfigured);
  const [loading, setLoading] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const apiCall = useCallback(async (body: Record<string, string>) => {
    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.error || `Failed (${res.status})`);
    }
    return res.json();
  }, []);

  const switchProvider = useCallback(async (newProvider: 'replicate' | 'runway') => {
    setLoading('provider');
    setError('');
    setMessage('');
    try {
      await apiCall({ action: 'set_provider', provider: newProvider });
      setProvider(newProvider);
      setMessage(`Video provider switched to ${newProvider === 'replicate' ? 'Replicate (Minimax)' : 'Runway (Gen-4.5)'}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading('');
    }
  }, [apiCall]);

  const saveReplicateKey = useCallback(async () => {
    if (!replicateKey.trim()) return;
    setLoading('replicate');
    setError('');
    setMessage('');
    try {
      const data = await apiCall({ action: 'set_replicate_key', apiKey: replicateKey });
      setReplicatePreview(data.preview);
      setReplicateConfigured(true);
      setReplicateKey('');
      setMessage('Replicate API token saved');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading('');
    }
  }, [replicateKey, apiCall]);

  const saveRunwayKey = useCallback(async () => {
    if (!runwayKey.trim()) return;
    setLoading('runway');
    setError('');
    setMessage('');
    try {
      const data = await apiCall({ action: 'set_runway_key', apiKey: runwayKey });
      setRunwayPreview(data.preview);
      setRunwayConfigured(true);
      setRunwayKey('');
      setMessage('Runway API secret saved');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading('');
    }
  }, [runwayKey, apiCall]);

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-2">
        <Settings className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Settings</h1>
      </div>

      {message && (
        <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-800 flex items-center gap-2">
          <CheckCircle className="h-4 w-4" /> {message}
        </div>
      )}
      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Video Provider Selection */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Film className="h-5 w-5 text-violet-500" />
            <CardTitle>AI Video Provider</CardTitle>
          </div>
          <CardDescription>
            Choose which AI provider generates videos for your bots.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {/* Replicate option */}
            <button
              onClick={() => switchProvider('replicate')}
              disabled={loading === 'provider'}
              className={`text-left p-4 rounded-lg border-2 transition-colors ${
                provider === 'replicate'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">Replicate</span>
                <div className="flex items-center gap-2">
                  {replicateConfigured && <Badge variant="outline" className="text-green-700 border-green-300">Configured</Badge>}
                  {provider === 'replicate' && <Badge>Active</Badge>}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Minimax video-01-live</p>
              <p className="text-xs text-muted-foreground mt-1">~$0.50/video, 6 sec, 720p</p>
            </button>

            {/* Runway option */}
            <button
              onClick={() => switchProvider('runway')}
              disabled={loading === 'provider'}
              className={`text-left p-4 rounded-lg border-2 transition-colors ${
                provider === 'runway'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">Runway</span>
                <div className="flex items-center gap-2">
                  {runwayConfigured && <Badge variant="outline" className="text-green-700 border-green-300">Configured</Badge>}
                  {provider === 'runway' && <Badge>Active</Badge>}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Veo 3.1 Fast (text-to-video)</p>
              <p className="text-xs text-muted-foreground mt-1">~$0.60/video, 6 sec, 720p</p>
            </button>
          </div>

          {loading === 'provider' && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Switching provider...
            </div>
          )}
        </CardContent>
      </Card>

      {/* API Keys */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-amber-500" />
            <CardTitle>API Keys</CardTitle>
          </div>
          <CardDescription>
            Enter your API keys here. They are stored in the database (not in .env).
            Keys from .env are used as fallback if no DB key is set.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Replicate */}
          <div className="space-y-2">
            <Label className="font-medium">Replicate API Token</Label>
            {replicatePreview && (
              <p className="text-xs text-muted-foreground">Current: <code className="bg-muted px-1 rounded">{replicatePreview}</code></p>
            )}
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder="r8_..."
                value={replicateKey}
                onChange={e => setReplicateKey(e.target.value)}
                className="font-mono text-sm"
              />
              <Button onClick={saveReplicateKey} disabled={!replicateKey.trim() || loading === 'replicate'} size="sm">
                {loading === 'replicate' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Get your token at replicate.com/account/api-tokens
            </p>
          </div>

          {/* Runway */}
          <div className="space-y-2">
            <Label className="font-medium">Runway API Secret</Label>
            {runwayPreview && (
              <p className="text-xs text-muted-foreground">Current: <code className="bg-muted px-1 rounded">{runwayPreview}</code></p>
            )}
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder="key_..."
                value={runwayKey}
                onChange={e => setRunwayKey(e.target.value)}
                className="font-mono text-sm"
              />
              <Button onClick={saveRunwayKey} disabled={!runwayKey.trim() || loading === 'runway'} size="sm">
                {loading === 'runway' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Get your secret at dev.runwayml.com
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Pricing Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cost Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 font-medium">Provider</th>
                  <th className="text-left py-2 font-medium">Model</th>
                  <th className="text-left py-2 font-medium">Cost/Video</th>
                  <th className="text-left py-2 font-medium">Duration</th>
                  <th className="text-left py-2 font-medium">Resolution</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr className="border-b">
                  <td className="py-2">Replicate</td>
                  <td className="py-2">Minimax video-01-live</td>
                  <td className="py-2">~$0.50</td>
                  <td className="py-2">6 sec</td>
                  <td className="py-2">720p</td>
                </tr>
                <tr>
                  <td className="py-2">Runway</td>
                  <td className="py-2">Veo 3.1 Fast</td>
                  <td className="py-2">~$0.60</td>
                  <td className="py-2">6 sec</td>
                  <td className="py-2">720p</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Both providers charge 8 credits per video to the user.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
