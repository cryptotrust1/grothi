import { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Image, Film, Upload, Trash2, Sparkles, ChevronLeft, ChevronRight, Wand2 } from 'lucide-react';
import { MediaUploadForm } from '@/components/dashboard/media-upload-form';
import { MediaGenerateForm } from '@/components/dashboard/media-generate-form';
import { BotNav } from '@/components/dashboard/bot-nav';

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

  const page = Math.max(1, parseInt(sp.page || '1'));
  const typeFilter = sp.type && sp.type !== 'ALL' ? sp.type : undefined;

  const where: Record<string, unknown> = { botId: bot.id };
  if (typeFilter) where.type = typeFilter;

  const [media, totalCount] = await Promise.all([
    db.media.findMany({
      where: where as any,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.media.count({ where: where as any }),
  ]);

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
        <BotNav botId={id} activeTab="media" />
      </div>

      {sp.success && <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-800">{sp.success}</div>}
      {sp.error && <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">{sp.error}</div>}

      {/* Upload Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5" /> Upload Media</CardTitle>
          <CardDescription>Drag & drop or click to upload. Supports JPEG, PNG, WebP, GIF, AVIF (up to 10MB) and MP4, WebM, MOV (up to 50MB). Select multiple files at once.</CardDescription>
        </CardHeader>
        <CardContent>
          <MediaUploadForm botId={bot.id} />
        </CardContent>
      </Card>

      {/* AI Generate Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Wand2 className="h-5 w-5" /> AI Generate</CardTitle>
          <CardDescription>Generate images and videos with AI. Uses your Creative Style preferences. Images cost 3 credits, videos cost 8 credits.</CardDescription>
        </CardHeader>
        <CardContent>
          <MediaGenerateForm botId={bot.id} />
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
                  <Film className="h-12 w-12 text-muted-foreground" />
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
                  <Link href={`/dashboard/bots/${id}/scheduler?mediaId=${m.id}`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full text-xs h-7">
                      Create Post
                    </Button>
                  </Link>
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
