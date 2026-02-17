'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Download, Trash2, Loader2 } from 'lucide-react';

interface MediaCardActionsProps {
  mediaId: string;
  filename: string;
}

export function MediaCardActions({ mediaId, filename }: MediaCardActionsProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setError(null);
      // Auto-reset after 3 seconds
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }

    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/media/${encodeURIComponent(mediaId)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.error || `Delete failed (${res.status})`);
      }
    } catch {
      setError('Network error. Try again.');
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-1">
        {/* Download */}
        <a
          href={`/api/media/${encodeURIComponent(mediaId)}?download=true`}
          download={filename}
          className="flex-none"
        >
          <Button variant="outline" size="sm" className="h-7 w-7 p-0" title={`Download ${filename}`}>
            <Download className="h-3.5 w-3.5" />
          </Button>
        </a>

        {/* Delete */}
        <Button
          variant={confirmDelete ? 'destructive' : 'outline'}
          size="sm"
          className="h-7 w-7 p-0"
          onClick={handleDelete}
          disabled={deleting}
          title={confirmDelete ? 'Click again to confirm delete' : `Delete ${filename}`}
        >
          {deleting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
      {error && (
        <p className="text-[10px] text-destructive">{error}</p>
      )}
    </div>
  );
}
