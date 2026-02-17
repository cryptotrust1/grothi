'use client';

import { useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, Loader2, CheckCircle, XCircle, Sparkles, FileImage, FileVideo, AlertCircle } from 'lucide-react';

const ACCEPTED_TYPES = 'image/jpeg,image/png,image/webp,image/gif,image/avif,video/mp4,video/webm,video/quicktime';
const MAX_IMAGE_MB = 10;
const MAX_VIDEO_MB = 50;
const MAX_FILES_PER_BATCH = 20;

const SUPPORTED_FORMATS = [
  { label: 'JPEG', ext: '.jpg / .jpeg' },
  { label: 'PNG', ext: '.png' },
  { label: 'WebP', ext: '.webp' },
  { label: 'GIF', ext: '.gif' },
  { label: 'AVIF', ext: '.avif' },
  { label: 'MP4', ext: '.mp4' },
  { label: 'WebM', ext: '.webm' },
  { label: 'MOV', ext: '.mov' },
];

interface FileEntry {
  id: string;       // temp id before upload, real id after
  file: File;
  status: 'queued' | 'uploading' | 'success' | 'error';
  error?: string;
  mediaId?: string;
  mediaUrl?: string;
  mediaType?: string;
  generating?: boolean;
  generated?: boolean;
  genError?: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function isVideoFile(file: File): boolean {
  return file.type.startsWith('video/');
}

export function MediaUploadForm({ botId }: { botId: string }) {
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showFormats, setShowFormats] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const idCounter = useRef(0);

  const validateFile = (file: File): string | null => {
    const allowed = ACCEPTED_TYPES.split(',');
    if (!allowed.includes(file.type)) {
      return `Unsupported format: ${file.type || file.name.split('.').pop()}. Use JPEG, PNG, WebP, GIF, AVIF, MP4, WebM, or MOV.`;
    }
    const maxMB = isVideoFile(file) ? MAX_VIDEO_MB : MAX_IMAGE_MB;
    if (file.size > maxMB * 1024 * 1024) {
      return `File too large (${formatBytes(file.size)}). Max ${maxMB}MB for ${isVideoFile(file) ? 'videos' : 'images'}.`;
    }
    return null;
  };

  const uploadSingleFile = async (entry: FileEntry): Promise<FileEntry> => {
    const formData = new FormData();
    formData.append('file', entry.file);
    formData.append('botId', botId);

    try {
      const res = await fetch('/api/media', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        // 413 from Nginx returns HTML, not JSON
        if (res.status === 413) {
          return { ...entry, status: 'error', error: `File too large for server (${formatBytes(entry.file.size)}). The server rejected it. Contact support if this persists.` };
        }
        if (res.status === 408 || res.status === 504) {
          return { ...entry, status: 'error', error: 'Upload timed out. Try a smaller file or check your connection.' };
        }
        const data = await res.json().catch(() => null);
        const msg = data?.error || `Upload failed (HTTP ${res.status})`;
        return { ...entry, status: 'error', error: msg };
      }

      const data = await res.json();
      return {
        ...entry,
        status: 'success',
        mediaId: data.id,
        mediaUrl: data.url,
        mediaType: data.type,
      };
    } catch {
      return { ...entry, status: 'error', error: 'Network error. Check your connection and try again.' };
    }
  };

  const handleFiles = useCallback(async (fileList: FileList) => {
    const files = Array.from(fileList).slice(0, MAX_FILES_PER_BATCH);
    if (files.length === 0) return;

    // Create entries with validation
    const newEntries: FileEntry[] = files.map((file) => {
      const validationError = validateFile(file);
      return {
        id: `temp-${++idCounter.current}`,
        file,
        status: validationError ? 'error' as const : 'queued' as const,
        error: validationError || undefined,
      };
    });

    setEntries(prev => [...newEntries, ...prev]);
    setIsUploading(true);

    // Upload valid files one by one (sequential to avoid overwhelming the server)
    for (const entry of newEntries) {
      if (entry.status === 'error') continue;

      // Mark as uploading
      setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, status: 'uploading' } : e));

      const result = await uploadSingleFile(entry);

      // Update with result
      setEntries(prev => prev.map(e => e.id === entry.id ? result : e));
    }

    setIsUploading(false);
    // Reset file input so the same files can be re-selected
    if (inputRef.current) inputRef.current.value = '';
  }, [botId]);

  const generateAI = useCallback(async (entryId: string, mediaId: string) => {
    setEntries(prev => prev.map(e => e.id === entryId ? { ...e, generating: true, genError: undefined } : e));

    try {
      const res = await fetch(`/api/media/${mediaId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platforms: ['FACEBOOK', 'INSTAGRAM', 'TWITTER', 'LINKEDIN', 'TIKTOK'],
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Generation failed' }));
        setEntries(prev => prev.map(e => e.id === entryId ? { ...e, generating: false, genError: data.error } : e));
        return;
      }

      setEntries(prev => prev.map(e => e.id === entryId ? { ...e, generating: false, generated: true } : e));
    } catch {
      setEntries(prev => prev.map(e => e.id === entryId ? { ...e, generating: false, genError: 'Network error' } : e));
    }
  }, []);

  const removeEntry = (entryId: string) => {
    setEntries(prev => prev.filter(e => e.id !== entryId));
  };

  const successCount = entries.filter(e => e.status === 'success').length;
  const errorCount = entries.filter(e => e.status === 'error').length;
  const queuedCount = entries.filter(e => e.status === 'queued' || e.status === 'uploading').length;

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          isUploading ? 'pointer-events-none opacity-60 border-input' : 'border-input hover:border-primary/50'
        }`}
        onClick={() => !isUploading && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); }}
        onDrop={(e) => {
          e.preventDefault();
          if (!isUploading && e.dataTransfer.files.length > 0) {
            handleFiles(e.dataTransfer.files);
          }
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
        {isUploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium">Uploading {queuedCount} file{queuedCount !== 1 ? 's' : ''}...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Drop files here or click to browse</p>
            <p className="text-xs text-muted-foreground">
              Select multiple files at once. Up to {MAX_FILES_PER_BATCH} files per batch.
            </p>
            <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-1">
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <FileImage className="h-3 w-3" /> Images up to {MAX_IMAGE_MB}MB
              </span>
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <FileVideo className="h-3 w-3" /> Videos up to {MAX_VIDEO_MB}MB
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Supported formats toggle */}
      <details className="text-xs" open={showFormats} onToggle={(e) => setShowFormats((e.target as HTMLDetailsElement).open)}>
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground font-medium">
          Supported formats
        </summary>
        <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {SUPPORTED_FORMATS.map((f) => (
            <div key={f.label} className="flex items-center gap-2 px-2 py-1 rounded border bg-muted/30">
              {f.label.match(/MP4|WebM|MOV/) ? (
                <FileVideo className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <FileImage className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              <div>
                <span className="font-medium">{f.label}</span>
                <span className="text-muted-foreground ml-1">{f.ext}</span>
              </div>
            </div>
          ))}
        </div>
        <p className="text-muted-foreground mt-2">
          Images: max {MAX_IMAGE_MB}MB each &middot; Videos: max {MAX_VIDEO_MB}MB each &middot; Max {MAX_FILES_PER_BATCH} files per upload
        </p>
      </details>

      {/* Upload results */}
      {entries.length > 0 && (
        <div className="space-y-2">
          {/* Summary bar */}
          <div className="flex items-center gap-3 text-xs">
            <span className="font-medium">Upload results:</span>
            {successCount > 0 && (
              <span className="flex items-center gap-1 text-green-600">
                <CheckCircle className="h-3 w-3" /> {successCount} uploaded
              </span>
            )}
            {errorCount > 0 && (
              <span className="flex items-center gap-1 text-destructive">
                <XCircle className="h-3 w-3" /> {errorCount} failed
              </span>
            )}
            {queuedCount > 0 && (
              <span className="flex items-center gap-1 text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> {queuedCount} in queue
              </span>
            )}
          </div>

          {/* File list */}
          <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className={`flex items-center gap-3 p-2 rounded-lg border text-sm ${
                  entry.status === 'error' ? 'bg-destructive/5 border-destructive/20' :
                  entry.status === 'success' ? 'bg-green-50 border-green-200' :
                  'bg-background'
                }`}
              >
                {/* Thumbnail / icon */}
                {entry.status === 'success' && entry.mediaUrl && entry.mediaType === 'VIDEO' ? (
                  <div className="relative h-10 w-10 rounded overflow-hidden bg-muted shrink-0">
                    {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                    <video src={entry.mediaUrl} className="h-full w-full object-cover" muted preload="metadata" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <svg className="h-3 w-3 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    </div>
                  </div>
                ) : entry.status === 'success' && entry.mediaUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={entry.mediaUrl} alt="" className="h-10 w-10 rounded object-cover shrink-0" />
                ) : isVideoFile(entry.file) ? (
                  <div className="h-10 w-10 rounded bg-muted flex items-center justify-center shrink-0">
                    <FileVideo className="h-5 w-5 text-muted-foreground" />
                  </div>
                ) : (
                  <div className="h-10 w-10 rounded bg-muted flex items-center justify-center shrink-0">
                    <FileImage className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}

                {/* File info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{entry.file.name}</p>
                  <p className="text-xs text-muted-foreground">{formatBytes(entry.file.size)}</p>
                  {entry.error && (
                    <p className="text-xs text-destructive flex items-center gap-1 mt-0.5">
                      <AlertCircle className="h-3 w-3 shrink-0" /> {entry.error}
                    </p>
                  )}
                  {entry.genError && (
                    <p className="text-xs text-destructive mt-0.5">{entry.genError}</p>
                  )}
                </div>

                {/* Status / actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {entry.status === 'queued' && (
                    <span className="text-xs text-muted-foreground">Queued</span>
                  )}
                  {entry.status === 'uploading' && (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  )}
                  {entry.status === 'error' && (
                    <button
                      onClick={() => removeEntry(entry.id)}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Dismiss
                    </button>
                  )}
                  {entry.status === 'success' && (
                    <>
                      {entry.generated ? (
                        <span className="flex items-center gap-1 text-xs text-green-600">
                          <Sparkles className="h-3 w-3" /> AI done
                        </span>
                      ) : entry.generating ? (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Loader2 className="h-3 w-3 animate-spin" /> AI...
                        </span>
                      ) : entry.mediaType !== 'VIDEO' && entry.mediaId ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs h-7"
                          onClick={() => generateAI(entry.id, entry.mediaId!)}
                        >
                          <Sparkles className="h-3 w-3 mr-1" /> Captions
                        </Button>
                      ) : null}
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Refresh button */}
          {successCount > 0 && !isUploading && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => window.location.reload()}
            >
              Refresh Library to see {successCount} new file{successCount !== 1 ? 's' : ''}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
