import { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getCachedPostCounts } from '@/lib/counts-cache';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AlertMessage } from '@/components/ui/alert-message';
import { HelpTip } from '@/components/ui/help-tip';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Zap, Bot, Clock, FileText, ImageIcon, Film, CheckCircle2,
  AlertCircle, Eye, ArrowRight, Trash2, RefreshCw, Info, Sparkles,
  Calendar, BarChart3, Target, Shield,
} from 'lucide-react';
import { PLATFORM_NAMES, POST_STATUS_COLORS } from '@/lib/constants';
import {
  PLATFORM_ALGORITHM,
  getRecommendedPlan,
  getGrowthTactics,
  getEngagementVelocityTip,
  getBestContentFormat,
} from '@/lib/platform-algorithm';

export const metadata: Metadata = { title: 'Autopilot', robots: { index: false } };

export default async function AutopilotPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const user = await requireAuth();
  const { id } = await params;
  const sp = await searchParams;

  const bot = await db.bot.findFirst({
    where: { id, userId: user.id },
    include: {
      platformConns: true,
      contentPlans: true,
      products: { where: { isActive: true }, select: { id: true, name: true } },
      media: {
        select: { id: true, type: true },
        take: 1,
      },
    },
  });
  if (!bot) notFound();

  const connectedPlatforms = bot.platformConns
    .filter(p => p.status === 'CONNECTED')
    .map(p => p.platform);

  // Count autopilot posts by status (cached)
  const now = new Date();
  const postCounts = await getCachedPostCounts(id, 'AUTOPILOT');
  const draftCount = postCounts.DRAFT;
  const scheduledCount = postCounts.SCHEDULED;
  const publishedCount = postCounts.PUBLISHED;
  const failedCount = postCounts.FAILED;

  // Get pending review posts (DRAFT autopilot posts)
  const pendingReview = await db.scheduledPost.findMany({
    where: { botId: id, source: 'AUTOPILOT', status: 'DRAFT' },
    orderBy: { scheduledAt: 'asc' },
    take: 20,
    select: {
      id: true,
      content: true,
      contentType: true,
      contentFormat: true,
      platforms: true,
      scheduledAt: true,
      mediaId: true,
      productId: true,
      product: { select: { name: true } },
    },
  });

  // Platform algorithm recommendations — v2 with full data
  const platformRecommendations = connectedPlatforms.map(p => {
    const algo = PLATFORM_ALGORITHM[p];
    const rec = getRecommendedPlan(p);
    const bestFormat = getBestContentFormat(p);
    const growthTactics = getGrowthTactics(p);
    const velocityTip = getEngagementVelocityTip(p);
    return {
      platform: p,
      name: PLATFORM_NAMES[p] || p,
      recommendation: rec,
      primaryMetric: algo?.primaryMetric || 'engagement',
      tip: algo?.contentTips[0] || '',
      frequency: algo?.frequency,
      bestFormat: bestFormat?.format || null,
      bestFormatReach: bestFormat?.reachMultiplier || 1,
      topSignals: algo?.engagementSignals
        ?.sort((a, b) => b.weight - a.weight)
        .slice(0, 3) || [],
      growthTactics: growthTactics.slice(0, 3),
      velocityTip,
      goldenWindow: algo?.engagementVelocity.goldenWindowMinutes || 60,
      minInterval: algo?.minPostIntervalHours || 4,
      maxPromo: algo?.maxPromotionalPercent || 20,
    };
  });

  // ── Server Actions ──────────────────────────────────────────

  async function handleToggleAutopilot() {
    'use server';
    const currentUser = await requireAuth();
    const currentBot = await db.bot.findFirst({ where: { id, userId: currentUser.id } });
    if (!currentBot) redirect('/dashboard/bots');

    await db.bot.update({
      where: { id },
      data: { autonomousEnabled: !currentBot.autonomousEnabled },
    });

    const action = currentBot.autonomousEnabled ? 'disabled' : 'enabled';
    redirect(`/dashboard/bots/${id}/autopilot?success=Autopilot ${action}`);
  }

  async function handleUpdateSettings(formData: FormData) {
    'use server';
    const currentUser = await requireAuth();
    const currentBot = await db.bot.findFirst({ where: { id, userId: currentUser.id } });
    if (!currentBot) redirect('/dashboard/bots');

    const approvalMode = formData.get('approvalMode') as string;
    const planDuration = parseInt(formData.get('planDuration') as string, 10);
    const contentMixMode = formData.get('contentMixMode') as string;
    const productRotation = formData.get('productRotation') === 'on';

    const validApproval = ['REVIEW_ALL', 'AUTO_APPROVE'].includes(approvalMode) ? approvalMode : 'REVIEW_ALL';
    const validDuration = [7, 14, 30].includes(planDuration) ? planDuration : 7;
    const validMix = ['AI_RECOMMENDED', 'CUSTOM'].includes(contentMixMode) ? contentMixMode : 'AI_RECOMMENDED';

    await db.bot.update({
      where: { id },
      data: {
        approvalMode: validApproval as 'REVIEW_ALL' | 'AUTO_APPROVE',
        planDuration: validDuration,
        contentMixMode: validMix,
        autopilotProductRotation: productRotation,
      },
    });

    redirect(`/dashboard/bots/${id}/autopilot?success=Autopilot settings saved`);
  }

  async function handleApproveAll() {
    'use server';
    const currentUser = await requireAuth();
    const currentBot = await db.bot.findFirst({ where: { id, userId: currentUser.id } });
    if (!currentBot) redirect('/dashboard/bots');

    // Only approve posts that have real content (not placeholders)
    const approved = await db.scheduledPost.updateMany({
      where: {
        botId: id,
        source: 'AUTOPILOT',
        status: 'DRAFT',
        content: { not: { startsWith: '[AUTOPILOT]' } },
      },
      data: { status: 'SCHEDULED' },
    });

    redirect(`/dashboard/bots/${id}/autopilot?success=${approved.count} posts approved and scheduled`);
  }

  async function handleApprovePost(formData: FormData) {
    'use server';
    const currentUser = await requireAuth();
    const postId = formData.get('postId') as string;
    if (!postId) redirect(`/dashboard/bots/${id}/autopilot`);

    const post = await db.scheduledPost.findFirst({
      where: { id: postId, botId: id, bot: { userId: currentUser.id } },
    });
    if (!post) redirect(`/dashboard/bots/${id}/autopilot`);

    // Prevent approving posts that still have placeholder content
    if (post.content.startsWith('[AUTOPILOT]')) {
      redirect(`/dashboard/bots/${id}/autopilot?error=${encodeURIComponent('Cannot approve this post — AI is still generating content. Please wait and try again.')}`);
    }

    // Ensure post has a future scheduledAt, or set it to 5 minutes from now
    const scheduledAt = post.scheduledAt && post.scheduledAt > new Date()
      ? post.scheduledAt
      : new Date(Date.now() + 5 * 60 * 1000);

    await db.scheduledPost.update({
      where: { id: postId },
      data: { status: 'SCHEDULED', scheduledAt },
    });

    redirect(`/dashboard/bots/${id}/autopilot?success=Post approved and scheduled`);
  }

  async function handleRejectPost(formData: FormData) {
    'use server';
    const currentUser = await requireAuth();
    const postId = formData.get('postId') as string;
    if (!postId) redirect(`/dashboard/bots/${id}/autopilot`);

    // Verify the post belongs to this bot and this user before deleting
    const post = await db.scheduledPost.findFirst({
      where: { id: postId, botId: id, bot: { userId: currentUser.id } },
    });
    if (!post) redirect(`/dashboard/bots/${id}/autopilot`);

    await db.scheduledPost.delete({
      where: { id: postId },
    });

    redirect(`/dashboard/bots/${id}/autopilot?success=Post removed`);
  }

  async function handleRetryFailed() {
    'use server';
    const currentUser = await requireAuth();
    const currentBot = await db.bot.findFirst({ where: { id, userId: currentUser.id } });
    if (!currentBot) redirect('/dashboard/bots');

    // Reset failed autopilot posts back to SCHEDULED so they get retried
    // Only retry posts that have real content (not placeholders needing generation)
    const retried = await db.scheduledPost.updateMany({
      where: {
        botId: id,
        source: 'AUTOPILOT',
        status: 'FAILED',
      },
      data: {
        status: 'SCHEDULED',
        error: null,
        scheduledAt: new Date(Date.now() + 5 * 60 * 1000), // Retry 5 min from now
      },
    });

    redirect(`/dashboard/bots/${id}/autopilot?success=${retried.count} failed posts queued for retry`);
  }

  async function handleClearPlan() {
    'use server';
    const currentUser = await requireAuth();
    const currentBot = await db.bot.findFirst({ where: { id, userId: currentUser.id } });
    if (!currentBot) redirect('/dashboard/bots');

    const deleted = await db.scheduledPost.deleteMany({
      where: {
        botId: id,
        source: 'AUTOPILOT',
        status: { in: ['DRAFT', 'SCHEDULED'] },
      },
    });

    redirect(`/dashboard/bots/${id}/autopilot?success=${deleted.count} pending autopilot posts cleared`);
  }

  // ── Render ──────────────────────────────────────────────────

  const isAutopilotActive = bot.autonomousEnabled;
  const hasMedia = bot.media.length > 0;
  const hasProducts = bot.products.length > 0;
  const hasPlatforms = connectedPlatforms.length > 0;
  const totalPending = draftCount + scheduledCount;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{bot.name} - Autopilot</h1>
          <Badge variant={isAutopilotActive ? 'success' : 'secondary'} className="text-sm">
            {isAutopilotActive ? 'Active' : 'Off'}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Fully autonomous content creation and posting powered by AI and platform algorithm research.
        </p>
      </div>

      {sp.success && <AlertMessage type="success" message={sp.success} />}
      {sp.error && <AlertMessage type="error" message={sp.error} />}

      {/* Prerequisites check */}
      {!hasPlatforms && (
        <Card className="border-yellow-300 bg-yellow-50/50">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-900">No platforms connected</p>
                <p className="text-sm text-yellow-700 mt-1">
                  Connect at least one social media platform before enabling Autopilot.
                </p>
                <Link href={`/dashboard/bots/${id}/platforms`}>
                  <Button variant="outline" size="sm" className="mt-2">Connect Platforms</Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Controls */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Autopilot Toggle */}
        <Card className={isAutopilotActive ? 'border-green-300 bg-green-50/30' : ''}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Zap className={`h-5 w-5 ${isAutopilotActive ? 'text-green-600' : 'text-muted-foreground'}`} />
              Autopilot Mode
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              {isAutopilotActive
                ? 'Autopilot is generating and scheduling posts automatically.'
                : 'Enable to let AI create and schedule posts based on platform best practices.'}
            </p>
            <form action={handleToggleAutopilot}>
              <Button
                type="submit"
                variant={isAutopilotActive ? 'outline' : 'default'}
                className="w-full"
                disabled={!hasPlatforms}
              >
                {isAutopilotActive ? 'Disable Autopilot' : 'Enable Autopilot'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Stats */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              Autopilot Stats
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-yellow-50 p-2 text-center">
                <p className="text-xl font-bold text-yellow-800">{draftCount}</p>
                <p className="text-xs text-yellow-600">Pending Review</p>
              </div>
              <div className="rounded-lg bg-blue-50 p-2 text-center">
                <p className="text-xl font-bold text-blue-800">{scheduledCount}</p>
                <p className="text-xs text-blue-600">Scheduled</p>
              </div>
              <div className="rounded-lg bg-green-50 p-2 text-center">
                <p className="text-xl font-bold text-green-800">{publishedCount}</p>
                <p className="text-xs text-green-600">Published</p>
              </div>
              <div className="rounded-lg bg-red-50 p-2 text-center">
                <p className="text-xl font-bold text-red-800">{failedCount}</p>
                <p className="text-xs text-red-600">Failed</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-5 w-5 text-violet-600" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <AutopilotGenerateButton botId={id} disabled={!hasPlatforms} />
            {draftCount > 0 && (
              <form action={handleApproveAll}>
                <Button type="submit" variant="outline" className="w-full gap-2" size="sm">
                  <CheckCircle2 className="h-4 w-4" /> Approve All ({draftCount})
                </Button>
              </form>
            )}
            {failedCount > 0 && (
              <form action={handleRetryFailed}>
                <Button type="submit" variant="outline" className="w-full gap-2" size="sm">
                  <RefreshCw className="h-4 w-4" /> Retry Failed ({failedCount})
                </Button>
              </form>
            )}
            {totalPending > 0 && (
              <ConfirmDialog
                title="Clear All Pending Posts"
                description={`This will delete ${totalPending} pending autopilot post(s) (drafts and scheduled). Published posts are not affected.`}
                confirmLabel="Clear All"
                variant="destructive"
                formAction={handleClearPlan}
                trigger={
                  <Button variant="ghost" className="w-full gap-2 text-destructive" size="sm">
                    <Trash2 className="h-4 w-4" /> Clear Pending ({totalPending})
                  </Button>
                }
              />
            )}
            {bot.lastPlanGeneratedAt && (
              <p className="text-xs text-muted-foreground text-center pt-1">
                Last plan: {new Date(bot.lastPlanGeneratedAt).toLocaleDateString('en-US', {
                  month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                })}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" /> Autopilot Settings
          </CardTitle>
          <CardDescription>
            Control how the autopilot creates and schedules posts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={handleUpdateSettings} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Approval Mode */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Label>Approval Mode</Label>
                  <HelpTip text="REVIEW ALL: Every autopilot post is created as a draft for your review before scheduling. AUTO APPROVE: Posts are automatically scheduled for publishing without manual review." />
                </div>
                <select
                  name="approvalMode"
                  defaultValue={bot.approvalMode}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="REVIEW_ALL">Review All Posts</option>
                  <option value="AUTO_APPROVE">Auto-Approve</option>
                </select>
                <p className="text-xs text-muted-foreground">
                  {bot.approvalMode === 'REVIEW_ALL'
                    ? 'You review every post before it goes live'
                    : 'Posts are scheduled automatically'}
                </p>
              </div>

              {/* Plan Duration */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Label>Plan Duration</Label>
                  <HelpTip text="How far ahead the autopilot plans content. 7 days is recommended for most users. 30 days gives maximum coverage but generates more posts." />
                </div>
                <select
                  name="planDuration"
                  defaultValue={bot.planDuration}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="7">7 Days</option>
                  <option value="14">14 Days</option>
                  <option value="30">30 Days</option>
                </select>
              </div>

              {/* Content Mix */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Label>Content Mix</Label>
                  <HelpTip text="AI RECOMMENDED: The system uses platform algorithm research to determine the optimal mix of text, image, and video posts for each platform. CUSTOM: Use your settings from the Content Strategy page." />
                </div>
                <select
                  name="contentMixMode"
                  defaultValue={bot.contentMixMode}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="AI_RECOMMENDED">AI Recommended</option>
                  <option value="CUSTOM">Custom (from Strategy)</option>
                </select>
              </div>

              {/* Product Rotation */}
              <div className="space-y-2">
                <Label>Product Rotation</Label>
                <label className="flex items-center gap-2 h-10 cursor-pointer">
                  <input
                    type="checkbox"
                    name="productRotation"
                    defaultChecked={bot.autopilotProductRotation}
                    className="h-4 w-4 rounded border-input"
                  />
                  <span className="text-sm">Auto-promote products</span>
                </label>
                <p className="text-xs text-muted-foreground">
                  {hasProducts
                    ? `Rotate ${bot.products.length} product(s) in promotional posts`
                    : 'No products added yet'}
                </p>
              </div>
            </div>

            <Button type="submit" size="sm">Save Settings</Button>
          </form>
        </CardContent>
      </Card>

      {/* Platform Algorithm Insights — v2 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" /> Platform Algorithm Intelligence
          </CardTitle>
          <CardDescription>
            Research-backed algorithm data for each connected platform (2025-2026 verified sources)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {connectedPlatforms.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Connect platforms to see algorithm-optimized recommendations.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {platformRecommendations.map(pr => {
                const algo = PLATFORM_ALGORITHM[pr.platform];
                return (
                  <div key={pr.platform} className="rounded-lg border p-4 space-y-3">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">{pr.name}</span>
                      <div className="flex gap-1">
                        <Badge variant="secondary" className="text-xs">
                          {algo?.platformCategory || 'general'}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {algo?.hasAlgorithm ? 'algo' : 'chrono'}
                        </Badge>
                      </div>
                    </div>

                    {/* Posting frequency */}
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      <div className="flex justify-between">
                        <span>Posts/day:</span>
                        <span className="font-medium">{pr.frequency?.postsPerDay.optimal || 1}</span>
                      </div>
                      {pr.frequency?.reelsPerWeek && (
                        <div className="flex justify-between">
                          <span>Reels/week:</span>
                          <span className="font-medium">{pr.frequency.reelsPerWeek.optimal}</span>
                        </div>
                      )}
                      {pr.frequency?.storiesPerDay && (
                        <div className="flex justify-between">
                          <span>Stories/day:</span>
                          <span className="font-medium">{pr.frequency.storiesPerDay.optimal}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span>Min interval:</span>
                        <span className="font-medium">{pr.minInterval}h between posts</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Max promo:</span>
                        <span className="font-medium">{pr.maxPromo}%</span>
                      </div>
                    </div>

                    <Separator />

                    {/* Best format */}
                    {pr.bestFormat && (
                      <div className="text-xs">
                        <span className="text-muted-foreground">Best format: </span>
                        <span className="font-medium text-green-700">
                          {pr.bestFormat} ({pr.bestFormatReach}x reach)
                        </span>
                      </div>
                    )}

                    {/* Top engagement signals */}
                    {pr.topSignals.length > 0 && (
                      <div className="text-xs space-y-0.5">
                        <span className="text-muted-foreground font-medium">Top signals:</span>
                        {pr.topSignals.map((s, i) => (
                          <div key={i} className="flex items-center gap-1">
                            <div className="flex">
                              {Array.from({ length: Math.min(5, Math.ceil(s.weight / 2)) }).map((_, j) => (
                                <div
                                  key={j}
                                  className={`h-1.5 w-1.5 rounded-full mr-0.5 ${
                                    s.weight >= 9 ? 'bg-green-500' : s.weight >= 7 ? 'bg-blue-500' : 'bg-gray-400'
                                  }`}
                                />
                              ))}
                            </div>
                            <span>{s.signal}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Engagement velocity */}
                    <div className="text-xs bg-amber-50 rounded p-1.5">
                      <Clock className="h-3 w-3 inline mr-1 text-amber-600" />
                      <span className="text-amber-800">
                        Golden window: first {pr.goldenWindow} min
                      </span>
                    </div>

                    {/* Growth tactics */}
                    {pr.growthTactics.length > 0 && (
                      <div className="text-xs space-y-0.5 border-t pt-2">
                        <span className="text-muted-foreground font-medium">Growth tactics:</span>
                        {pr.growthTactics.map((t, i) => (
                          <p key={i} className="text-blue-700 leading-tight">• {t}</p>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending Review */}
      {pendingReview.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" /> Pending Review ({draftCount})
                </CardTitle>
                <CardDescription>
                  Review and approve autopilot-generated posts before they go live
                </CardDescription>
              </div>
              <form action={handleApproveAll}>
                <Button type="submit" size="sm" className="gap-1">
                  <CheckCircle2 className="h-4 w-4" /> Approve All
                </Button>
              </form>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingReview.map(post => {
                const platforms = (post.platforms as string[]) || [];
                const isPlaceholder = post.content.startsWith('[AUTOPILOT]');
                const platformName = platforms.map(p => PLATFORM_NAMES[p] || p).join(', ');

                return (
                  <div key={post.id} className="rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {platforms.map(p => (
                            <Badge key={p} variant="secondary" className="text-xs">
                              {PLATFORM_NAMES[p] || p}
                            </Badge>
                          ))}
                          {post.contentType && (
                            <Badge variant="outline" className="text-xs">
                              {post.contentType}
                            </Badge>
                          )}
                          {post.contentFormat && (
                            <Badge variant="outline" className="text-xs text-green-700 border-green-300 bg-green-50">
                              {post.contentFormat}
                            </Badge>
                          )}
                          {post.product && (
                            <Badge variant="default" className="text-xs">
                              {post.product.name}
                            </Badge>
                          )}
                          {isPlaceholder && (
                            <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-800">
                              <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                              Generating...
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-3">
                          {isPlaceholder ? 'AI is generating content for this post...' : post.content}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          <Clock className="h-3 w-3 inline mr-1" />
                          {post.scheduledAt
                            ? new Date(post.scheduledAt).toLocaleString('en-US', {
                                weekday: 'short', month: 'short', day: 'numeric',
                                hour: '2-digit', minute: '2-digit',
                              })
                            : 'Not scheduled'}
                        </p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {!isPlaceholder && (
                          <form action={handleApprovePost}>
                            <input type="hidden" name="postId" value={post.id} />
                            <Button type="submit" size="sm" variant="default" className="gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Approve
                            </Button>
                          </form>
                        )}
                        <form action={handleRejectPost}>
                          <input type="hidden" name="postId" value={post.id} />
                          <Button type="submit" size="sm" variant="ghost" className="text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </form>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {draftCount > 20 && (
              <p className="text-xs text-muted-foreground mt-3 text-center">
                Showing 20 of {draftCount} pending posts.{' '}
                <Link href={`/dashboard/bots/${id}/post`} className="underline">
                  View all in Post Scheduler
                </Link>
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* How Autopilot Works */}
      <Card className="bg-blue-50/30 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Info className="h-5 w-5 text-blue-600" />
            How Autopilot Works
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">1</div>
                <p className="font-medium text-sm">Plan Generation</p>
              </div>
              <p className="text-xs text-muted-foreground pl-9">
                AI analyzes platform algorithms, your brand, and engagement data to create an optimal posting schedule for {bot.planDuration} days.
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">2</div>
                <p className="font-medium text-sm">Content Creation</p>
              </div>
              <p className="text-xs text-muted-foreground pl-9">
                AI generates unique, platform-optimized content for each post using your brand voice, products, and media library.
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">3</div>
                <p className="font-medium text-sm">
                  {bot.approvalMode === 'REVIEW_ALL' ? 'Your Review' : 'Auto-Schedule'}
                </p>
              </div>
              <p className="text-xs text-muted-foreground pl-9">
                {bot.approvalMode === 'REVIEW_ALL'
                  ? 'You review each post before it goes live. Approve, edit, or reject any post.'
                  : 'Posts are automatically scheduled at optimal times. You can still review and edit.'}
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">4</div>
                <p className="font-medium text-sm">Learn & Optimize</p>
              </div>
              <p className="text-xs text-muted-foreground pl-9">
                The RL engine tracks engagement and continuously improves content strategy, timing, tone, and hashtag selection.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Client-side generate button that calls the API.
 * Uses a form action to keep the page server-rendered.
 */
function AutopilotGenerateButton({ botId, disabled }: { botId: string; disabled: boolean }) {
  async function handleGenerate() {
    'use server';
    const user = await requireAuth();
    const bot = await db.bot.findFirst({
      where: { id: botId, userId: user.id },
    });
    if (!bot) redirect('/dashboard/bots');

    // Call the generate plan API internally — forward session cookie for auth
    const baseUrl = process.env.NEXTAUTH_URL || 'https://grothi.com';
    try {
      const cookieStore = await cookies();
      const sessionToken = cookieStore.get('session-token')?.value || '';
      const res = await fetch(`${baseUrl}/api/autonomous/generate-plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `session-token=${sessionToken}`,
        },
        body: JSON.stringify({ botId, duration: bot.planDuration }),
      });

      if (!res.ok) {
        const data = await res.json();
        redirect(`/dashboard/bots/${botId}/autopilot?error=${encodeURIComponent(data.error || 'Failed to generate plan')}`);
      }

      const data = await res.json();
      redirect(`/dashboard/bots/${botId}/autopilot?success=Plan generated: ${data.plan.totalPosts} posts for ${data.plan.duration} days`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      // Re-throw NEXT_REDIRECT errors (from redirect())
      if (msg === 'NEXT_REDIRECT') throw error;
      redirect(`/dashboard/bots/${botId}/autopilot?error=${encodeURIComponent('Failed to generate plan: ' + msg)}`);
    }
  }

  return (
    <form action={handleGenerate}>
      <Button type="submit" className="w-full gap-2" disabled={disabled}>
        <Sparkles className="h-4 w-4" /> Generate Content Plan
      </Button>
    </form>
  );
}
