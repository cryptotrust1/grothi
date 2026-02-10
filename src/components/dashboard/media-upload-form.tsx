'use client';

import { useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, Loader2, CheckCircle, XCircle, Sparkles } from 'lucide-react';

interface UploadedFile {
  id: string;
  filename: string;
  type: string;
  url: string;
  generating?: boolean;
  generated?: boolean;
  error?: string;
}

export function MediaUploadForm({ botId }: { botId: string }) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('botId', botId);

    const res = await fetch('/api/media', {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Upload failed');
    }

    return await res.json();
  }, [botId]);

  const generateAI = useCallback(async (mediaId: string) => {
    setFiles(prev => prev.map(f => f.id === mediaId ? { ...f, generating: true } : f));

    try {
      const res = await fetch(`/api/media/${mediaId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platforms: ['FACEBOOK', 'INSTAGRAM', 'TWITTER', 'LINKEDIN', 'TIKTOK'],
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setFiles(prev => prev.map(f => f.id === mediaId ? { ...f, generating: false, error: data.error } : f));
        return;
      }

      setFiles(prev => prev.map(f => f.id === mediaId ? { ...f, generating: false, generated: true } : f));
    } catch {
      setFiles(prev => prev.map(f => f.id === mediaId ? { ...f, generating: false, error: 'Failed to generate' } : f));
    }
  }, []);

  const handleFiles = useCallback(async (fileList: FileList) => {
    setError(null);
    setUploading(true);

    const newFiles: File[] = Array.from(fileList).slice(0, 10);

    for (const file of newFiles) {
      try {
        const result = await uploadFile(file);
        setFiles(prev => [...prev, {
          id: result.id,
          filename: result.filename,
          type: result.type,
          url: result.url,
        }]);
      } catch (err: any) {
        setError(err.message);
      }
    }

    setUploading(false);
  }, [uploadFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  return (
    <div className="space-y-4">
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          dragOver ? 'border-primary bg-primary/5' : 'border-input hover:border-primary/50'
        }`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/avif,video/mp4,video/webm,video/quicktime"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Uploading...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Drop files here or click to browse</p>
            <p className="text-xs text-muted-foreground">Images (JPEG, PNG, WebP, GIF) up to 10MB | Videos (MP4, WebM) up to 50MB</p>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive flex items-center gap-2">
          <XCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Recently uploaded files */}
      {files.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Uploaded in this session:</p>
          {files.map((f) => (
            <div key={f.id} className="flex items-center gap-3 p-2 rounded-lg border bg-background">
              {f.type === 'IMAGE' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={f.url} alt={f.filename} className="h-10 w-10 rounded object-cover" />
              ) : (
                <div className="h-10 w-10 rounded bg-muted flex items-center justify-center text-xs">{f.type}</div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{f.filename}</p>
                {f.error && <p className="text-xs text-destructive">{f.error}</p>}
              </div>
              <div className="flex items-center gap-2">
                {f.generated ? (
                  <span className="flex items-center gap-1 text-xs text-green-600">
                    <CheckCircle className="h-3 w-3" /> AI Generated
                  </span>
                ) : f.generating ? (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" /> Generating...
                  </span>
                ) : f.type !== 'VIDEO' ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => generateAI(f.id)}
                  >
                    <Sparkles className="h-3 w-3 mr-1" /> Generate Captions
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => window.location.reload()}
          >
            Refresh Library
          </Button>
        </div>
      )}
    </div>
  );
}
