import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Filter } from 'lucide-react';

export const metadata: Metadata = { title: 'Bot Activity', robots: { index: false } };

const platformNames: Record<string, string> = {
  MASTODON: 'Mastodon', FACEBOOK: 'Facebook', TELEGRAM: 'Telegram',
  MOLTBOOK: 'Moltbook', DISCORD: 'Discord', TWITTER: 'Twitter',
  BLUESKY: 'Bluesky', REDDIT: 'Reddit', DEVTO: 'Dev.to',
};

const PLATFORMS = ['ALL', 'MASTODON', 'FACEBOOK', 'TELEGRAM', 'MOLTBOOK', 'DISCORD', 'TWITTER', 'BLUESKY', 'REDDIT', 'DEVTO'];
const ACTIONS = ['ALL', 'POST', 'REPLY', 'FAVOURITE', 'BOOST', 'SCAN_FEEDS', 'COLLECT_METRICS', 'GENERATE_CONTENT', 'SAFETY_BLOCK'];
const STATUSES = ['ALL', 'SUCCESS', 'FAILED'];
const PAGE_SIZE = 25;

export default async function BotActivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; platform?: string; action?: string; status?: string }>;
}) {
  const user = await requireAuth();
  const { id } = await params;
  const sp = await searchParams;

  const bot = await db.bot.findFirst({ where: { id, userId: user.id } });
  if (!bot) notFound();

  const page = Math.max(1, parseInt(sp.page || '1'));
  const platformFilter = sp.platform && sp.platform !== 'ALL' ? sp.platform : undefined;
  const actionFilter = sp.action && sp.action !== 'ALL' ? sp.action : undefined;
  const statusFilter = sp.status && sp.status !== 'ALL' ? sp.status : undefined;

  const where: Record<string, unknown> = { botId: bot.id };
  if (platformFilter) where.platform = platformFilter;
  if (actionFilter) where.action = actionFilter;
  if (statusFilter === 'SUCCESS') where.success = true;
  if (statusFilter === 'FAILED') where.success = false;

  const [activities, totalCount] = await Promise.all([
    db.botActivity.findMany({
      where: where as any,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.botActivity.count({ where: where as any }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  function buildUrl(overrides: Record<string, string>) {
    const params = new URLSearchParams();
    const current = {
      page: String(page),
      platform: sp.platform || 'ALL',
      action: sp.action || 'ALL',
      status: sp.status || 'ALL',
      ...overrides,
    };
    for (const [k, v] of Object.entries(current)) {
      if (v && v !== 'ALL' && !(k === 'page' && v === '1')) params.set(k, v);
    }
    const qs = params.toString();
    return `/dashboard/bots/${id}/activity${qs ? '?' + qs : ''}`;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{bot.name} - Activity</h1>
        <div className="flex gap-4 mt-4 border-b pb-2">
          <Link href={`/dashboard/bots/${bot.id}`} className="text-sm text-muted-foreground hover:text-foreground pb-2">Overview</Link>
          <Link href={`/dashboard/bots/${bot.id}/activity`} className="text-sm font-medium border-b-2 border-primary pb-2">Activity</Link>
          <Link href={`/dashboard/bots/${bot.id}/platforms`} className="text-sm text-muted-foreground hover:text-foreground pb-2">Platforms</Link>
          <Link href={`/dashboard/bots/${bot.id}/analytics`} className="text-sm text-muted-foreground hover:text-foreground pb-2">Analytics</Link>
          <Link href={`/dashboard/bots/${bot.id}/settings`} className="text-sm text-muted-foreground hover:text-foreground pb-2">Settings</Link>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filters</span>
            <span className="text-xs text-muted-foreground ml-auto">{totalCount} total results</span>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Platform</label>
              <div className="flex flex-wrap gap-1">
                {PLATFORMS.map((p) => (
                  <Link
                    key={p}
                    href={buildUrl({ platform: p, page: '1' })}
                    className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                      (sp.platform || 'ALL') === p
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'hover:bg-muted border-input'
                    }`}
                  >
                    {p === 'ALL' ? 'All' : platformNames[p] || p}
                  </Link>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Action</label>
              <div className="flex flex-wrap gap-1">
                {ACTIONS.map((a) => (
                  <Link
                    key={a}
                    href={buildUrl({ action: a, page: '1' })}
                    className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                      (sp.action || 'ALL') === a
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'hover:bg-muted border-input'
                    }`}
                  >
                    {a === 'ALL' ? 'All' : a.replace(/_/g, ' ')}
                  </Link>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Status</label>
              <div className="flex flex-wrap gap-1">
                {STATUSES.map((s) => (
                  <Link
                    key={s}
                    href={buildUrl({ status: s, page: '1' })}
                    className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                      (sp.status || 'ALL') === s
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'hover:bg-muted border-input'
                    }`}
                  >
                    {s === 'ALL' ? 'All' : s}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activity Log */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Log</CardTitle>
        </CardHeader>
        <CardContent>
          {activities.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              {totalCount === 0 ? 'No activity yet. Start your bot to see actions here.' : 'No results match your filters.'}
            </p>
          ) : (
            <div className="space-y-3">
              {activities.map((a) => (
                <div key={a.id} className="flex items-start gap-4 py-3 border-b last:border-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline">{a.action.replace(/_/g, ' ')}</Badge>
                      <span className="text-xs text-muted-foreground">{platformNames[a.platform] || a.platform}</span>
                      {a.contentType && <Badge variant="secondary" className="text-xs">{a.contentType}</Badge>}
                    </div>
                    {a.content && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{a.content}</p>}
                    {a.error && <p className="text-sm text-destructive mt-1">{a.error}</p>}
                    {(a.likes !== null || a.comments !== null || a.shares !== null) && (
                      <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                        {a.likes !== null && a.likes > 0 && <span>{a.likes} likes</span>}
                        {a.comments !== null && a.comments > 0 && <span>{a.comments} comments</span>}
                        {a.shares !== null && a.shares > 0 && <span>{a.shares} shares</span>}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {a.success ? (
                      <Badge variant="success" className="text-xs">OK</Badge>
                    ) : (
                      <Badge variant="destructive" className="text-xs">Failed</Badge>
                    )}
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(a.createdAt).toLocaleDateString()} {new Date(a.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {a.creditsUsed > 0 && (
                      <span className="text-xs text-muted-foreground">-{a.creditsUsed} credits</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 mt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages} ({totalCount} total)
              </p>
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
        </CardContent>
      </Card>
    </div>
  );
}
