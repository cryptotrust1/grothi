import { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Image, Film, Upload, Trash2, Sparkles, ChevronLeft, ChevronRight, Wand2, HardDrive } from 'lucide-react';
import { BOT_STORAGE_LIMIT_BYTES, BOT_STORAGE_LIMIT_MB } from '@/lib/constants';
import { getCachedStorageUsage } from '@/lib/storage-cache';
import { MediaUploadForm } from '@/components/dashboard/media-upload-form';
import { MediaGenerateForm } from '@/components/dashboard/media-generate-form';
import { MediaCardActions } from '@/components/dashboard/media-card-actions';
import { MediaVideoThumbnail } from '@/components/dashboard/media-video-thumbnail';
import { AlertMessage } from '@/components/ui/alert-message';

export const metadata: Metadata = { title: 'Media Library', robots: { index: false } };

const PAGE_SIZE = 12;

export default async function BotMediaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; type?: string; success?: string; error?: string }>;
}) {
  const user = await requireAuth();
  const { id } = await params;
  const sp = await searchParams;

  const bot = await db.bot.findFirst({ where: { id, userId: user.id } });
  if (!bot) notFound();

  const parsedPage = parseInt(sp.page || '1', 10);
  const page = Math.max(1, isNaN(parsedPage) ? 1 : parsedPage);
  const typeFilter = sp.type && sp.type !== 'ALL' ? sp.type : undefined;

  const where: Record<string, unknown> = {
    botId: bot.id,
    // Exclude PENDING/PROCESSING generations (not yet finalized)
    OR: [
      { generationStatus: null },
      { generationStatus: 'SUCCEEDED' },
    ],
  };
  if (typeFilter) where.type = typeFilter;

  const [media, totalCount, storageUsedBytes] = await Promise.all([
    db.media.findMany({
      where: where as any,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.media.count({ where: where as any }),
    getCachedStorageUsage(bot.id), // Use cached storage for speed
  ]);
  const storageUsedMB = storageUsedBytes / (1024 * 1024);
  const storagePercent = Math.min(100, (storageUsedBytes / BOT_STORAGE_LIMIT_BYTES) * 100);
  const storageFull = storageUsedBytes >= BOT_STORAGE_LIMIT_BYTES;

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  function buildUrl(overrides: Record<string, string>) {
    const params = new URLSearchParams();
    const current = { page: String(page), type: sp.type || 'ALL', ...overrides };
    for (const [k, v] of Object.entries(current)) {
      if (v && v !== 'ALL' && !(k === 'page' && v === '1')) params.set(k, v);
    }
    const qs = params.toString();
    return `/dashboard/bots/${id}/media${qs ? '?' + qs : ''}`;
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{bot.name} - Media Library</h1>
        <p className="text-sm text-muted-foreground mt-1">Upload images and videos. AI generates platform-optimized captions automatically.</p>
      </div>

      {sp.success && <AlertMessage type="success" message={sp.success} />}
      {sp.error && <AlertMessage type="error" message={sp.error} />}

      {/* Storage Usage */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            <HardDrive className={`h-5 w-5 shrink-0 ${storageFull ? 'text-destructive' : storagePercent > 75 ? 'text-yellow-500' : 'text-muted-foreground'}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium">
                  Storage: {storageUsedMB < 0.1 ? '0' : storageUsedMB.toFixed(1)} MB / {BOT_STORAGE_LIMIT_MB} MB
                </span>
                <span className={`text-xs font-medium ${storageFull ? 'text-destructive' : storagePercent > 90 ? 'text-red-500' : storagePercent > 75 ? 'text-yellow-600' : 'text-muted-foreground'}`}>
                  {storagePercent.toFixed(0)}% used
                  {storageFull && ' — FULL'}
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    storageFull ? 'bg-destructive' : storagePercent > 90 ? 'bg-red-500' : storagePercent > 75 ? 'bg-yellow-500' : 'bg-primary'
                  }`}
                  style={{ width: `${Math.max(storagePercent, 0.5)}%` }}
                />
              </div>
              {storageFull && (
                <p className="text-xs text-destructive mt-1.5">Storage limit reached. Delete some media to free up space before uploading or generating new files.</p>
              )}
              {!storageFull && storagePercent > 75 && (
                <p className="text-xs text-yellow-600 mt-1.5">Running low on storage. Consider deleting unused media to free up space.</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upload Card */}
      <Card className={storageFull ? 'opacity-60' : ''}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" /> Upload Media
            {storageFull && <Badge variant="destructive" className="ml-2 text-[10px]">Storage Full</Badge>}
          </CardTitle>
          <CardDescription>
            {storageFull
              ? 'Storage limit reached. Delete some media below to free up space.'
              : `Drag & drop or click to upload. Supports JPEG, PNG, WebP, GIF, AVIF (up to 10MB) and MP4, WebM, MOV (up to 50MB). ${(BOT_STORAGE_LIMIT_MB - storageUsedMB).toFixed(1)} MB remaining.`
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MediaUploadForm botId={bot.id} storageFull={storageFull} storageRemainingMB={Math.max(0, BOT_STORAGE_LIMIT_MB - storageUsedMB)} />
        </CardContent>
      </Card>

      {/* AI Generate Card */}
      <Card className={storageFull ? 'opacity-60' : ''}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5" /> AI Generate
            {storageFull && <Badge variant="destructive" className="ml-2 text-[10px]">Storage Full</Badge>}
          </CardTitle>
          <CardDescription>
            {storageFull
              ? 'Storage limit reached. Delete some media below to free up space.'
              : 'Generate images and videos with AI. Uses your Creative Style preferences. Images cost 3 credits, videos cost 8 credits.'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MediaGenerateForm botId={bot.id} storageFull={storageFull} />
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">{totalCount} file{totalCount !== 1 ? 's' : ''}</span>
        <div className="flex gap-1 ml-auto">
          {['ALL', 'IMAGE', 'VIDEO', 'GIF'].map((t) => (
            <Link
              key={t}
              href={buildUrl({ type: t, page: '1' })}
              className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                (sp.type || 'ALL') === t
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'hover:bg-muted border-input'
              }`}
            >
              {t === 'ALL' ? 'All' : t}
            </Link>
          ))}
        </div>
      </div>

      {/* Media Grid */}
      {media.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Image className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No media uploaded yet. Upload your first image or video above.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {media.map((m) => (
            <Card key={m.id} className="overflow-hidden group">
              <div className="aspect-square relative bg-muted flex items-center justify-center">
                {m.type === 'VIDEO' ? (
                  <div className="relative w-full h-full">
                    <MediaVideoThumbnail
                      src={`/api/media/${m.id}`}
                      className="object-cover w-full h-full"
                    />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none group-hover:opacity-0 transition-opacity">
                      <div className="h-10 w-10 rounded-full bg-black/50 flex items-center justify-center">
                        <svg className="h-5 w-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                      </div>
                    </div>
                  </div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/media/${m.id}`}
                    alt={m.altText || m.filename}
                    className="object-cover w-full h-full"
                    loading="lazy"
                  />
                )}
                <div className="absolute top-2 right-2 flex gap-1">
                  <Badge variant="secondary" className="text-[10px]">
                    {m.type}
                  </Badge>
                </div>
                {m.aiDescription && (
                  <div className="absolute top-2 left-2">
                    <Badge variant="default" className="text-[10px] bg-violet-600">
                      <Sparkles className="h-3 w-3 mr-1" /> AI
                    </Badge>
                  </div>
                )}
              </div>
              <CardContent className="p-3">
                <p className="text-xs font-medium truncate">{m.filename}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-muted-foreground">
                    {m.width && m.height ? `${m.width}x${m.height} · ` : ''}{formatFileSize(m.fileSize)}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(m.createdAt).toLocaleDateString()}
                  </span>
                </div>
                {m.altText && (
                  <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{m.altText}</p>
                )}
                <div className="flex gap-1 mt-2">
                  <Link href={`/dashboard/bots/${id}/post?mediaId=${m.id}`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full text-xs h-7">
                      Create Post
                    </Button>
                  </Link>
                  <MediaCardActions mediaId={m.id} filename={m.filename} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link href={buildUrl({ page: String(page - 1) })}>
                <Button variant="outline" size="sm"><ChevronLeft className="h-4 w-4 mr-1" /> Prev</Button>
              </Link>
            ) : (
              <Button variant="outline" size="sm" disabled><ChevronLeft className="h-4 w-4 mr-1" /> Prev</Button>
            )}
            {page < totalPages ? (
              <Link href={buildUrl({ page: String(page + 1) })}>
                <Button variant="outline" size="sm">Next <ChevronRight className="h-4 w-4 ml-1" /></Button>
              </Link>
            ) : (
              <Button variant="outline" size="sm" disabled>Next <ChevronRight className="h-4 w-4 ml-1" /></Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
