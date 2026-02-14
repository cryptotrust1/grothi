import { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { deductCredits, getActionCost, hasEnoughCredits } from '@/lib/credits';
import { PLATFORM_NAMES, POST_STATUS_COLORS } from '@/lib/constants';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Send, Save, Clock, Image as ImageIcon, Film,
  CheckCircle2, AlertCircle, Zap, Globe,
} from 'lucide-react';
import { BotNav } from '@/components/dashboard/bot-nav';
import { HelpTip } from '@/components/ui/help-tip';

export const metadata: Metadata = { title: 'Create Post', robots: { index: false } };

// Character limits per platform
const CHAR_LIMITS: Record<string, number> = {
  TWITTER: 280,
  MASTODON: 500,
  BLUESKY: 300,
  THREADS: 500,
  LINKEDIN: 3000,
  FACEBOOK: 63206,
  INSTAGRAM: 2200,
  TIKTOK: 2200,
  PINTEREST: 500,
  TELEGRAM: 4096,
  DISCORD: 2000,
  REDDIT: 40000,
  MEDIUM: 100000,
  DEVTO: 100000,
  YOUTUBE: 5000,
  NOSTR: 10000,
  MOLTBOOK: 5000,
};

export default async function ManualPostPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
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

  const connectedPlatforms = bot.platformConns.map(p => p.platform);

  // Media library for selection
  const mediaLibrary = await db.media.findMany({
    where: { botId: bot.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { id: true, filename: true, type: true, altText: true },
  });

  // Pre-selected media
  let preSelectedMedia = null;
  if (sp.mediaId) {
    preSelectedMedia = await db.media.findFirst({
      where: { id: sp.mediaId, botId: bot.id },
      select: { id: true, filename: true, type: true, altText: true },
    });
  }

  // Recent posts for reference
  const recentPosts = await db.scheduledPost.findMany({
    where: { botId: bot.id },
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: { media: { select: { id: true, filename: true, type: true } } },
  });

  // Get credit cost for posting
  const postCost = await getActionCost('POST');
  const userHasCredits = await hasEnoughCredits(user.id, postCost);

  // ── Server Actions ──────────────────────────────────────────

  async function handleCreatePost(formData: FormData) {
    'use server';

    const currentUser = await requireAuth();
    const currentBot = await db.bot.findFirst({
      where: { id, userId: currentUser.id },
      include: { platformConns: { where: { status: 'CONNECTED' }, select: { platform: true } } },
    });
    if (!currentBot) redirect('/dashboard/bots');

    const content = (formData.get('content') as string)?.trim();
    if (!content) {
      redirect(`/dashboard/bots/${id}/post?error=${encodeURIComponent('Content is required')}`);
    }

    const platformsRaw = formData.getAll('platforms') as string[];
    if (platformsRaw.length === 0) {
      redirect(`/dashboard/bots/${id}/post?error=${encodeURIComponent('Select at least one platform')}`);
    }

    // Validate platforms are actually connected
    const connectedSet = new Set(currentBot.platformConns.map(p => p.platform));
    const invalidPlatforms = platformsRaw.filter(p => !connectedSet.has(p as any));
    if (invalidPlatforms.length > 0) {
      redirect(`/dashboard/bots/${id}/post?error=${encodeURIComponent(`Platform not connected: ${invalidPlatforms.map(p => PLATFORM_NAMES[p] || p).join(', ')}`)}`);
    }

    const mediaId = (formData.get('mediaId') as string) || null;
    const action = formData.get('action') as string; // 'now', 'draft', 'schedule'
    const scheduledAt = formData.get('scheduledAt') as string;

    // Validate media ownership
    if (mediaId) {
      const media = await db.media.findFirst({ where: { id: mediaId, botId: id } });
      if (!media) {
        redirect(`/dashboard/bots/${id}/post?error=${encodeURIComponent('Media not found')}`);
      }
    }

    // Determine status and scheduledAt
    let finalStatus: 'DRAFT' | 'SCHEDULED' = 'DRAFT';
    let finalScheduledAt: Date | null = null;

    if (action === 'now') {
      // Post immediately - set to SCHEDULED with current time (worker picks it up)
      finalStatus = 'SCHEDULED';
      finalScheduledAt = new Date();
    } else if (action === 'schedule' && scheduledAt) {
      const parsed = new Date(scheduledAt);
      if (isNaN(parsed.getTime())) {
        redirect(`/dashboard/bots/${id}/post?error=${encodeURIComponent('Invalid date format')}`);
      }
      if (parsed <= new Date()) {
        redirect(`/dashboard/bots/${id}/post?error=${encodeURIComponent('Scheduled time must be in the future')}`);
      }
      finalStatus = 'SCHEDULED';
      finalScheduledAt = parsed;
    } else {
      finalStatus = 'DRAFT';
    }

    // Deduct credits for immediate post
    if (action === 'now') {
      const cost = await getActionCost('POST');
      const totalCost = cost * platformsRaw.length;
      const hasCredits = await hasEnoughCredits(currentUser.id, totalCost);
      if (!hasCredits) {
        redirect(`/dashboard/bots/${id}/post?error=${encodeURIComponent(`Not enough credits. Need ${totalCost} credits (${cost} per platform x ${platformsRaw.length} platforms).`)}`);
      }
      await deductCredits(
        currentUser.id,
        totalCost,
        `Manual post to ${platformsRaw.length} platform(s)`,
        id
      );
    }

    await db.scheduledPost.create({
      data: {
        botId: id,
        content,
        contentType: 'custom',
        mediaId,
        platforms: platformsRaw,
        scheduledAt: finalScheduledAt,
        autoSchedule: false,
        status: finalStatus,
      },
    });

    const actionLabel = action === 'now'
      ? 'Post queued for immediate publishing!'
      : action === 'schedule'
        ? 'Post scheduled successfully!'
        : 'Post saved as draft.';

    redirect(`/dashboard/bots/${id}/post?success=${encodeURIComponent(actionLabel)}`);
  }

  // ── Render ──────────────────────────────────────────────────

  // Lowest char limit across connected platforms (for the warning)
  const lowestLimit = connectedPlatforms.reduce((min, p) => {
    const limit = CHAR_LIMITS[p] || 100000;
    return limit < min ? limit : min;
  }, 100000);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{bot.name} - New Post</h1>
        <p className="text-sm text-muted-foreground mt-1">Create and publish a manual post to your connected platforms.</p>
        <BotNav botId={id} activeTab="post" />
      </div>

      {sp.success && (
        <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-800 flex items-start gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{sp.success}</span>
        </div>
      )}
      {sp.error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive flex items-start gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{sp.error}</span>
        </div>
      )}

      {/* No platforms warning */}
      {connectedPlatforms.length === 0 && (
        <Card className="border-orange-200 bg-orange-50/50">
          <CardContent className="pt-6">
            <div className="flex gap-3 items-start">
              <Globe className="h-5 w-5 text-orange-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-orange-900">No platforms connected</p>
                <p className="text-sm text-orange-700 mt-1">Connect at least one social platform before creating posts.</p>
                <Link href={`/dashboard/bots/${id}/platforms`}>
                  <Button size="sm" variant="outline" className="mt-3">
                    <Globe className="mr-2 h-4 w-4" /> Connect Platforms
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Post Form */}
      {connectedPlatforms.length > 0 && (
        <form action={handleCreatePost}>
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Main Content - Left Column */}
            <div className="lg:col-span-2 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Send className="h-5 w-5" /> Post Content
                  </CardTitle>
                  <CardDescription>Write your post. The same content will be sent to all selected platforms.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Content */}
                  <div className="space-y-2">
                    <Label htmlFor="content">Content *</Label>
                    <textarea
                      id="content"
                      name="content"
                      placeholder="What do you want to share? Write your post here...&#10;&#10;Tip: Keep it under the lowest platform limit to ensure it posts everywhere without truncation."
                      className="flex min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
                      required
                    />
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {connectedPlatforms.map(p => (
                        <span key={p} className="px-2 py-0.5 rounded bg-muted">
                          {PLATFORM_NAMES[p] || p}: {(CHAR_LIMITS[p] || '?').toLocaleString()} chars
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Media Selection */}
                  <div className="space-y-2">
                    <Label htmlFor="mediaId" className="flex items-center gap-1">
                      Attach Media
                      <HelpTip text="Attach an image or video from your media library. Upload new media in the Media tab first." />
                    </Label>
                    <select
                      id="mediaId"
                      name="mediaId"
                      defaultValue={preSelectedMedia?.id || ''}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">No media attached</option>
                      {mediaLibrary.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.type === 'VIDEO' ? '[VIDEO]' : m.type === 'GIF' ? '[GIF]' : '[IMG]'} {m.filename}
                          {m.altText ? ` - ${m.altText.slice(0, 40)}` : ''}
                        </option>
                      ))}
                    </select>
                    {mediaLibrary.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        No media yet.{' '}
                        <Link href={`/dashboard/bots/${id}/media`} className="text-primary underline">
                          Upload media first
                        </Link>
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Schedule Options */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" /> When to Post
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="scheduledAt" className="flex items-center gap-1">
                      Schedule for a specific time
                      <HelpTip text="Leave empty and use 'Post Now' for immediate posting, or 'Save Draft' to post later." />
                    </Label>
                    <input
                      id="scheduledAt"
                      type="datetime-local"
                      name="scheduledAt"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                    <p className="text-xs text-muted-foreground">Optional. Set a date/time to schedule the post for later.</p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-3 pt-2">
                    <Button type="submit" name="action" value="now" className="gap-2" disabled={!userHasCredits}>
                      <Zap className="h-4 w-4" /> Post Now
                    </Button>
                    <Button type="submit" name="action" value="schedule" variant="outline" className="gap-2">
                      <Clock className="h-4 w-4" /> Schedule Post
                    </Button>
                    <Button type="submit" name="action" value="draft" variant="secondary" className="gap-2">
                      <Save className="h-4 w-4" /> Save as Draft
                    </Button>
                  </div>

                  {/* Credit info */}
                  <p className="text-xs text-muted-foreground">
                    Posting costs {postCost} credit{postCost !== 1 ? 's' : ''} per platform.
                    {connectedPlatforms.length > 1 && (
                      <> Posting to all {connectedPlatforms.length} platforms = {postCost * connectedPlatforms.length} credits.</>
                    )}
                    {!userHasCredits && (
                      <span className="text-destructive font-medium"> Not enough credits!{' '}
                        <Link href="/dashboard/credits/buy" className="underline">Buy more</Link>
                      </span>
                    )}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Right Sidebar - Platform Selection */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5" /> Target Platforms
                  </CardTitle>
                  <CardDescription>Select where to publish this post.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Select All / None */}
                  <div className="flex gap-2 pb-2 border-b">
                    <label className="text-xs text-primary cursor-pointer hover:underline">
                      <input type="checkbox" className="sr-only peer" id="selectAllPlatforms" />
                      All platforms are selected by default
                    </label>
                  </div>

                  {/* Platform checkboxes */}
                  <div className="space-y-2">
                    {connectedPlatforms.map((p) => (
                      <label
                        key={p}
                        className="flex items-center gap-3 p-2 rounded-md border cursor-pointer hover:bg-muted/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5 transition-colors"
                      >
                        <input
                          type="checkbox"
                          name="platforms"
                          value={p}
                          defaultChecked
                          className="h-4 w-4 rounded"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{PLATFORM_NAMES[p] || p}</p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            max {(CHAR_LIMITS[p] || '?').toLocaleString()} chars
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Tips */}
              <Card className="bg-blue-50/50 border-blue-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-blue-900">Tips for better reach</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="text-xs text-blue-800 space-y-1.5 list-disc list-inside">
                    <li>Keep text under {lowestLimit} chars for all platforms</li>
                    <li>Posts with images get 2-3x more engagement</li>
                    <li>Use hashtags for Instagram, avoid for Facebook</li>
                    <li>Best times: weekdays 9-11 AM and 1-3 PM</li>
                    <li>Ask a question to boost comments</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </form>
      )}

      {/* Recent Posts */}
      {recentPosts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Posts</CardTitle>
            <CardDescription>
              Your last {recentPosts.length} post{recentPosts.length > 1 ? 's' : ''}.{' '}
              <Link href={`/dashboard/bots/${id}/scheduler`} className="text-primary underline">View all in Scheduler</Link>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentPosts.map((post) => {
                const platforms = Array.isArray(post.platforms) ? post.platforms as string[] : [];
                return (
                  <div key={post.id} className="flex gap-3 py-2 border-b last:border-0">
                    {post.media && (
                      <div className="shrink-0">
                        {post.media.type === 'VIDEO' ? (
                          <div className="h-12 w-12 rounded bg-muted flex items-center justify-center">
                            <Film className="h-4 w-4 text-muted-foreground" />
                          </div>
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={`/api/media/${post.media.id}`}
                            alt={post.media.filename}
                            className="h-12 w-12 rounded object-cover"
                          />
                        )}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${POST_STATUS_COLORS[post.status]}`}>
                          {post.status}
                        </span>
                        {platforms.slice(0, 3).map((p) => (
                          <Badge key={p} variant="outline" className="text-[10px] h-5">
                            {PLATFORM_NAMES[p] || p}
                          </Badge>
                        ))}
                        {platforms.length > 3 && (
                          <span className="text-[10px] text-muted-foreground">+{platforms.length - 3}</span>
                        )}
                      </div>
                      <p className="text-sm line-clamp-1 mt-1">{post.content}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {new Date(post.createdAt).toLocaleString('en', {
                          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
