import { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { PLATFORM_NAMES, POST_STATUS_COLORS } from '@/lib/constants';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Calendar, Clock, Plus, Send, Trash2,
  ChevronLeft, ChevronRight, Film,
} from 'lucide-react';
import { BotNav } from '@/components/dashboard/bot-nav';
import { HelpTip } from '@/components/ui/help-tip';

export const metadata: Metadata = { title: 'Post Scheduler', robots: { index: false } };

export default async function SchedulerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    view?: string;
    status?: string;
    month?: string;
    success?: string;
    error?: string;
    mediaId?: string;
  }>;
}) {
  const user = await requireAuth();
  const { id } = await params;
  const sp = await searchParams;

  const bot = await db.bot.findFirst({
    where: { id, userId: user.id },
    include: {
      platformConns: { where: { status: 'CONNECTED' }, select: { platform: true } },
    },
  });
  if (!bot) notFound();

  const view = sp.view || 'list';
  const statusFilter = sp.status || 'ALL';

  // Get the month for calendar view
  const now = new Date();
  const monthStr = sp.month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [year, month] = monthStr.split('-').map(Number);

  // Date range for queries
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0, 23, 59, 59);

  const where: Record<string, unknown> = { botId: bot.id };
  if (statusFilter !== 'ALL') {
    where.status = statusFilter;
  }
  if (view === 'calendar') {
    where.scheduledAt = { gte: monthStart, lte: monthEnd };
  }

  const [posts, draftsCount, scheduledCount, publishedCount] = await Promise.all([
    db.scheduledPost.findMany({
      where: where as any,
      orderBy: { scheduledAt: 'asc' },
      include: { media: { select: { id: true, filename: true, type: true } } },
      take: 200,
    }),
    db.scheduledPost.count({ where: { botId: bot.id, status: 'DRAFT' } }),
    db.scheduledPost.count({ where: { botId: bot.id, status: 'SCHEDULED' } }),
    db.scheduledPost.count({ where: { botId: bot.id, status: 'PUBLISHED' } }),
  ]);

  // Get media for the "create post" form (if mediaId is provided)
  let preSelectedMedia = null;
  if (sp.mediaId) {
    preSelectedMedia = await db.media.findFirst({
      where: { id: sp.mediaId, botId: bot.id },
      select: { id: true, filename: true, type: true, altText: true, platformCaptions: true },
    });
  }

  // Media library for selection
  const mediaLibrary = await db.media.findMany({
    where: { botId: bot.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { id: true, filename: true, type: true, altText: true },
  });

  const connectedPlatforms = bot.platformConns.map(p => p.platform);

  // Calendar data
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
  const prevMonth = month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, '0')}`;
  const nextMonth = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, '0')}`;
  const monthName = new Date(year, month - 1).toLocaleString('en', { month: 'long', year: 'numeric' });

  // Group posts by date for calendar
  const postsByDate: Record<string, typeof posts> = {};
  for (const post of posts) {
    if (post.scheduledAt) {
      const dateKey = post.scheduledAt.toISOString().split('T')[0];
      if (!postsByDate[dateKey]) postsByDate[dateKey] = [];
      postsByDate[dateKey].push(post);
    }
  }

  async function handleQuickCreate(formData: FormData) {
    'use server';

    const currentUser = await requireAuth();
    const currentBot = await db.bot.findFirst({ where: { id, userId: currentUser.id } });
    if (!currentBot) redirect('/dashboard/bots');

    const content = (formData.get('content') as string)?.trim();
    if (!content) redirect(`/dashboard/bots/${id}/scheduler?error=Content is required`);

    const platformsRaw = formData.getAll('platforms') as string[];
    const platforms = platformsRaw.length > 0 ? platformsRaw : ['MASTODON'];

    const scheduledAt = formData.get('scheduledAt') as string;
    const autoSchedule = formData.get('autoSchedule') === 'on';
    const mediaId = (formData.get('mediaId') as string) || null;

    let finalScheduledAt: Date | null = null;
    if (!autoSchedule && scheduledAt) {
      finalScheduledAt = new Date(scheduledAt);
    } else if (autoSchedule) {
      // Simple auto-schedule: next round hour + 1
      finalScheduledAt = new Date();
      finalScheduledAt.setHours(finalScheduledAt.getHours() + 1, 0, 0, 0);
    }

    const status = finalScheduledAt ? 'SCHEDULED' : 'DRAFT';

    await db.scheduledPost.create({
      data: {
        botId: id,
        content,
        contentType: 'custom',
        mediaId,
        platforms,
        scheduledAt: finalScheduledAt,
        autoSchedule,
        status,
      },
    });

    redirect(`/dashboard/bots/${id}/scheduler?success=Post ${status === 'SCHEDULED' ? 'scheduled' : 'saved as draft'}`);
  }

  async function handleDelete(formData: FormData) {
    'use server';

    const currentUser = await requireAuth();
    const postId = formData.get('postId') as string;
    const post = await db.scheduledPost.findUnique({
      where: { id: postId },
      include: { bot: { select: { userId: true } } },
    });

    if (!post || post.bot.userId !== currentUser.id) {
      redirect(`/dashboard/bots/${id}/scheduler?error=Post not found`);
    }

    await db.scheduledPost.delete({ where: { id: postId } });
    redirect(`/dashboard/bots/${id}/scheduler?success=Post deleted`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{bot.name} - Post Scheduler</h1>
        <p className="text-sm text-muted-foreground mt-1">Plan, schedule, and manage your posts across all platforms.</p>
        <BotNav botId={id} activeTab="scheduler" />
      </div>

      {sp.success && <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-800">{sp.success}</div>}
      {sp.error && <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">{sp.error}</div>}

      {/* Stats */}
      <div className="grid gap-4 grid-cols-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{draftsCount}</p>
            <p className="text-xs text-muted-foreground">Drafts</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{scheduledCount}</p>
            <p className="text-xs text-muted-foreground">Scheduled</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{publishedCount}</p>
            <p className="text-xs text-muted-foreground">Published</p>
          </CardContent>
        </Card>
      </div>

      {/* Create Post */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5" /> Create Post</CardTitle>
          <CardDescription>Write content, attach media, choose platforms, and schedule.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={handleQuickCreate} className="space-y-4">
            <div>
              <textarea
                name="content"
                placeholder="Write your post content here... Use {url} to insert your target URL with UTM tracking."
                className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                required
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Character limits: X/Twitter 280 · Mastodon 500 · LinkedIn 3,000 · Instagram 2,200
                </p>
              </div>
            </div>

            {/* Media Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Attach Media (optional)</label>
              <select name="mediaId" defaultValue={preSelectedMedia?.id || ''} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">No media</option>
                {mediaLibrary.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.type === 'VIDEO' ? '🎥' : '🖼️'} {m.filename}{m.altText ? ` - ${m.altText.slice(0, 40)}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Platform Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-1">
                Target Platforms
                <HelpTip text="Select which connected platforms should receive this post. Each platform will get an optimized version." />
              </label>
              <div className="flex flex-wrap gap-2">
                {connectedPlatforms.length > 0 ? (
                  connectedPlatforms.map((p) => (
                    <label key={p} className="flex items-center gap-1.5 text-xs border rounded-full px-3 py-1.5 cursor-pointer hover:bg-muted/50 has-[:checked]:border-primary has-[:checked]:bg-primary/10">
                      <input type="checkbox" name="platforms" value={p} defaultChecked className="h-3 w-3" />
                      {PLATFORM_NAMES[p] || p}
                    </label>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No platforms connected. <Link href={`/dashboard/bots/${id}/platforms`} className="text-primary underline">Connect platforms first</Link>.
                  </p>
                )}
              </div>
            </div>

            {/* Scheduling */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-1">
                  Schedule For
                  <HelpTip text="Set a specific date and time to publish. Leave empty to save as a draft that you can schedule later." />
                </label>
                <input
                  type="datetime-local"
                  name="scheduledAt"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
                <p className="text-xs text-muted-foreground">Leave empty to save as draft</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-1">
                  Auto-Schedule
                  <HelpTip text="When enabled, the AI analyzes the best posting time for each platform based on when your audience is most active." />
                </label>
                <label className="flex items-center gap-2 h-10 cursor-pointer">
                  <input type="checkbox" name="autoSchedule" className="h-4 w-4" />
                  <span className="text-sm">Let AI pick the best time</span>
                </label>
                <p className="text-xs text-muted-foreground">AI analyzes optimal posting times per platform</p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button type="submit" className="gap-2">
                <Send className="h-4 w-4" /> Schedule Post
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* View Toggle */}
      <div className="flex items-center gap-2 justify-between">
        <div className="flex gap-1">
          {['ALL', 'DRAFT', 'SCHEDULED', 'PUBLISHED', 'FAILED'].map((s) => (
            <Link
              key={s}
              href={`/dashboard/bots/${id}/scheduler?view=${view}&status=${s}`}
              className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                statusFilter === s ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted border-input'
              }`}
            >
              {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
            </Link>
          ))}
        </div>
        <div className="flex gap-1">
          <Link
            href={`/dashboard/bots/${id}/scheduler?view=list&status=${statusFilter}`}
            className={`text-xs px-3 py-1.5 rounded border ${view === 'list' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
          >
            List
          </Link>
          <Link
            href={`/dashboard/bots/${id}/scheduler?view=calendar&status=${statusFilter}&month=${monthStr}`}
            className={`text-xs px-3 py-1.5 rounded border ${view === 'calendar' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
          >
            Calendar
          </Link>
        </div>
      </div>

      {/* Calendar View */}
      {view === 'calendar' && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <Link href={`/dashboard/bots/${id}/scheduler?view=calendar&status=${statusFilter}&month=${prevMonth}`}>
                <Button variant="ghost" size="sm"><ChevronLeft className="h-4 w-4" /></Button>
              </Link>
              <CardTitle className="text-lg">{monthName}</CardTitle>
              <Link href={`/dashboard/bots/${id}/scheduler?view=calendar&status=${statusFilter}&month=${nextMonth}`}>
                <Button variant="ghost" size="sm"><ChevronRight className="h-4 w-4" /></Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-px bg-muted rounded-lg overflow-hidden">
              {/* Day headers */}
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div key={d} className="bg-background p-2 text-center text-xs font-medium text-muted-foreground">{d}</div>
              ))}
              {/* Empty cells for days before month start */}
              {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                <div key={`empty-${i}`} className="bg-background p-2 min-h-[80px]" />
              ))}
              {/* Calendar days */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const dayPosts = postsByDate[dateKey] || [];
                const isToday = now.getFullYear() === year && now.getMonth() === month - 1 && now.getDate() === day;

                return (
                  <div key={day} className={`bg-background p-1.5 min-h-[80px] ${isToday ? 'ring-2 ring-primary ring-inset' : ''}`}>
                    <p className={`text-xs font-medium mb-1 ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>{day}</p>
                    <div className="space-y-0.5">
                      {dayPosts.slice(0, 3).map((post) => {
                        const platforms = Array.isArray(post.platforms) ? post.platforms as string[] : [];
                        return (
                          <div
                            key={post.id}
                            className={`text-[9px] leading-tight px-1 py-0.5 rounded truncate ${POST_STATUS_COLORS[post.status] || 'bg-gray-100'}`}
                            title={post.content.slice(0, 100)}
                          >
                            {post.scheduledAt ? new Date(post.scheduledAt).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }) : ''} {platforms.map(p => (PLATFORM_NAMES[p] || p).slice(0, 2)).join('·')}
                          </div>
                        );
                      })}
                      {dayPosts.length > 3 && (
                        <p className="text-[9px] text-muted-foreground">+{dayPosts.length - 3} more</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* List View */}
      {view === 'list' && (
        <div className="space-y-3">
          {posts.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No posts yet. Create your first post above!</p>
              </CardContent>
            </Card>
          ) : (
            posts.map((post) => {
              const platforms = Array.isArray(post.platforms) ? post.platforms as string[] : [];
              return (
                <Card key={post.id}>
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      {/* Media thumbnail */}
                      {post.media && (
                        <div className="shrink-0">
                          {post.media.type === 'VIDEO' ? (
                            <div className="h-16 w-16 rounded bg-muted flex items-center justify-center">
                              <Film className="h-6 w-6 text-muted-foreground" />
                            </div>
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={`/api/media/${post.media.id}`}
                              alt={post.media.filename}
                              className="h-16 w-16 rounded object-cover"
                            />
                          )}
                        </div>
                      )}

                      <div className="flex-1 min-w-0 space-y-2">
                        {/* Status & platforms */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${POST_STATUS_COLORS[post.status]}`}>
                            {post.status}
                          </span>
                          {platforms.map((p) => (
                            <Badge key={p} variant="outline" className="text-[10px] h-5">
                              {PLATFORM_NAMES[p] || p}
                            </Badge>
                          ))}
                          {post.autoSchedule && (
                            <Badge variant="secondary" className="text-[10px] h-5">Auto</Badge>
                          )}
                        </div>

                        {/* Content preview */}
                        <p className="text-sm line-clamp-2">{post.content}</p>

                        {/* Time */}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          {post.scheduledAt && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(post.scheduledAt).toLocaleString('en', {
                                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                              })}
                            </span>
                          )}
                          {post.publishedAt && (
                            <span className="text-green-600">
                              Published {new Date(post.publishedAt).toLocaleString('en', {
                                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                              })}
                            </span>
                          )}
                          {post.error && (
                            <span className="text-destructive">{post.error}</span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      {['DRAFT', 'SCHEDULED'].includes(post.status) && (
                        <div className="shrink-0">
                          <form action={handleDelete}>
                            <input type="hidden" name="postId" value={post.id} />
                            <Button variant="ghost" size="sm" className="text-destructive h-8 w-8 p-0">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </form>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
