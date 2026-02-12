import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Activity, Settings, Globe, BarChart3, Clock, Brain,
  TrendingUp, Rss, Shield, Zap, CheckCircle2, Circle,
} from 'lucide-react';
import { BotNav } from '@/components/dashboard/bot-nav';
import { HelpTip } from '@/components/ui/help-tip';
import { Progress } from '@/components/ui/progress';
import { BOT_STATUS_CONFIG, PLATFORM_NAMES, GOAL_LABELS, RL_DIMENSION_LABELS, TONE_STYLES, HASHTAG_PATTERNS, CONTENT_TYPES } from '@/lib/constants';

export const metadata: Metadata = {
  title: 'Bot Detail',
  robots: { index: false },
};

const statusConfig = BOT_STATUS_CONFIG;

export default async function BotDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAuth();
  const { id } = await params;

  const bot = await db.bot.findFirst({
    where: { id, userId: user.id },
    include: {
      platformConns: true,
      activities: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
      _count: { select: { activities: true } },
    },
  });

  if (!bot) notFound();

  const sc = statusConfig[bot.status] || { variant: 'secondary' as const, label: bot.status };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [todayActivities, weekStats] = await Promise.all([
    db.botActivity.count({
      where: { botId: bot.id, createdAt: { gte: today } },
    }),
    db.botActivity.aggregate({
      where: {
        botId: bot.id,
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
      _sum: { likes: true, comments: true, shares: true, creditsUsed: true },
      _count: true,
    }),
  ]);

  // RL Learning Stats per platform
  const [rlConfigs, topArms] = await Promise.all([
    db.rLConfig.findMany({ where: { botId: bot.id }, orderBy: { totalEpisodes: 'desc' }, take: 5 }),
    db.rLArmState.findMany({
      where: { botId: bot.id },
      orderBy: { ewmaReward: 'desc' },
      take: 20,
    }),
  ]);

  const totalEpisodes = rlConfigs.reduce((sum, c) => sum + c.totalEpisodes, 0);
  const avgEpsilon = rlConfigs.length > 0
    ? rlConfigs.reduce((sum, c) => sum + c.epsilon, 0) / rlConfigs.length
    : 0.2;

  // Build best arms per dimension
  const bestArmsByDimension: Record<string, { arm: string; reward: number; pulls: number }> = {};
  for (const arm of topArms) {
    const key = arm.dimension;
    if (!bestArmsByDimension[key] || arm.ewmaReward > bestArmsByDimension[key].reward) {
      bestArmsByDimension[key] = { arm: arm.armKey, reward: Math.round(arm.ewmaReward * 100) / 100, pulls: arm.pulls };
    }
  }

  // Content Reactor / Self-Learning stats
  const reactorState = (bot.reactorState as Record<string, unknown>) || {};
  const selfLearning = (reactorState.selfLearning as boolean) ?? true;
  const contentTypes = (reactorState.contentTypes as string[]) || [];
  const maxPostsPerDay = (reactorState.maxPostsPerDay as number) || 10;
  const rssFeeds = Array.isArray(bot.rssFeeds) ? (bot.rssFeeds as string[]) : [];
  const keywords = Array.isArray(bot.keywords) ? (bot.keywords as string[]) : [];
  const goalLabels = GOAL_LABELS;

  // Setup progress checklist
  const setupSteps = [
    { label: 'Create bot', done: true, href: '' },
    { label: 'Connect at least one platform', done: bot.platformConns.length > 0, href: `/dashboard/bots/${bot.id}/platforms` },
    { label: 'Add keywords for content optimization', done: keywords.length > 0, href: `/dashboard/bots/${bot.id}/settings` },
    { label: 'Configure image style preferences', done: Boolean(bot.imagePreferences), href: `/dashboard/bots/${bot.id}/image-style` },
    { label: 'Activate the bot', done: bot.status === 'ACTIVE', href: `/dashboard/bots/${bot.id}/settings` },
  ];
  const completedSteps = setupSteps.filter(s => s.done).length;
  const setupProgress = Math.round((completedSteps / setupSteps.length) * 100);
  const isSetupComplete = completedSteps === setupSteps.length;

  const weekLikes = weekStats._sum.likes || 0;
  const weekComments = weekStats._sum.comments || 0;
  const weekShares = weekStats._sum.shares || 0;
  const weekCredits = weekStats._sum.creditsUsed || 0;
  const weekEngagement = weekStats._count > 0
    ? ((weekLikes + weekComments * 3 + weekShares * 5) / weekStats._count).toFixed(1)
    : '0.0';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{bot.name}</h1>
            <Badge variant={sc.variant}>{sc.label}</Badge>
          </div>
          <p className="text-muted-foreground">{bot.brandName}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/dashboard/bots/${bot.id}/platforms`}>
            <Button variant="outline" size="sm"><Globe className="mr-2 h-4 w-4" /> Platforms</Button>
          </Link>
          <Link href={`/dashboard/bots/${bot.id}/settings`}>
            <Button variant="outline" size="sm"><Settings className="mr-2 h-4 w-4" /> Settings</Button>
          </Link>
          <Link href={`/dashboard/bots/${bot.id}/analytics`}>
            <Button variant="outline" size="sm"><BarChart3 className="mr-2 h-4 w-4" /> Analytics</Button>
          </Link>
        </div>
      </div>

      <BotNav botId={bot.id} activeTab="overview" />

      {/* Setup Checklist - shown until all steps are complete */}
      {!isSetupComplete && (
        <Card className="border-blue-200 bg-blue-50/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="h-5 w-5 text-blue-600" /> Getting Started
            </CardTitle>
            <div className="flex items-center gap-3 mt-2">
              <Progress value={setupProgress} className="h-2 flex-1" />
              <span className="text-sm font-medium text-muted-foreground">{completedSteps}/{setupSteps.length}</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {setupSteps.map((step) => (
                <div key={step.label} className="flex items-center gap-3">
                  {step.done ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
                  )}
                  {step.done ? (
                    <span className="text-sm text-muted-foreground line-through">{step.label}</span>
                  ) : step.href ? (
                    <Link href={step.href} className="text-sm text-blue-600 hover:underline font-medium">{step.label}</Link>
                  ) : (
                    <span className="text-sm font-medium">{step.label}</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPIs */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={sc.variant} className="text-lg">{sc.label}</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Platforms</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{bot.platformConns.length}</div>
            <p className="text-xs text-muted-foreground">
              {bot.platformConns.filter((p) => p.status === 'CONNECTED').length} connected
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Today</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayActivities}</div>
            <p className="text-xs text-muted-foreground">actions</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Actions</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{bot._count.activities}</div>
            <p className="text-xs text-muted-foreground">all time</p>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Performance + Content Reactor */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5" /> This Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Actions</p>
                <p className="text-2xl font-bold">{weekStats._count}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">Engagement Score <HelpTip text="Calculated as: Likes (1pt) + Comments (3pt) + Shares (5pt) divided by total actions. Higher means your content resonates better with your audience." /></p>
                <p className="text-2xl font-bold">{weekEngagement}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Likes / Comments / Shares</p>
                <p className="text-lg font-semibold">{weekLikes} / {weekComments} / {weekShares}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Credits Used</p>
                <p className="text-lg font-semibold">{weekCredits} <span className="text-xs text-muted-foreground">(${(weekCredits / 100).toFixed(2)})</span></p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Brain className="h-5 w-5" /> Content Reactor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Goal</span>
                <Badge variant="default">{goalLabels[bot.goal] || bot.goal}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm flex items-center gap-1">Self-Learning AI <HelpTip text="When enabled, the bot uses reinforcement learning to optimize content. It learns which post types, times, and hashtags work best for each platform." /></span>
                <Badge variant={selfLearning ? 'success' : 'secondary'}>
                  {selfLearning ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Content Types</span>
                <span className="text-sm text-muted-foreground">
                  {contentTypes.length > 0 ? contentTypes.join(', ') : 'Not configured'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Keywords</span>
                <span className="text-sm text-muted-foreground">
                  {keywords.length > 0 ? `${keywords.length} keywords` : 'None'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Max Posts/Day</span>
                <span className="text-sm font-medium">{maxPostsPerDay}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">RSS Feeds</span>
                <span className="text-sm font-medium">{rssFeeds.length} sources</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Google Analytics</span>
                <Badge variant={bot.gaPropertyId ? 'success' : 'secondary'}>
                  {bot.gaPropertyId ? 'Connected' : 'Not connected'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm flex items-center gap-1">Safety Level <HelpTip text="Conservative: max 5 posts/day, safest. Moderate: 10 posts/day, balanced. Aggressive: 20 posts/day, higher engagement but more visibility." /></span>
                <Badge variant={bot.safetyLevel === 'AGGRESSIVE' ? 'warning' : bot.safetyLevel === 'CONSERVATIVE' ? 'success' : 'secondary'}>
                  {bot.safetyLevel}
                </Badge>
              </div>
              {(contentTypes.length === 0 || keywords.length === 0) && (
                <Link href={`/dashboard/bots/${bot.id}/settings`}>
                  <Button size="sm" variant="outline" className="w-full mt-2">
                    <Settings className="mr-2 h-4 w-4" /> Configure Strategy
                  </Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* RL Learning Progress */}
      {selfLearning && totalEpisodes > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Brain className="h-5 w-5" /> AI Learning Progress
              <HelpTip text="Shows what the reinforcement learning engine has learned. Exploration rate decreases as the bot gains confidence. Best performing strategies are shown per dimension." />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3 mb-4">
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold">{totalEpisodes}</p>
                <p className="text-xs text-muted-foreground">Learning Episodes</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold">{Math.round(avgEpsilon * 100)}%</p>
                <p className="text-xs text-muted-foreground">Exploration Rate</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold">{rlConfigs.length}</p>
                <p className="text-xs text-muted-foreground">Platforms Learning</p>
              </div>
            </div>
            {Object.keys(bestArmsByDimension).length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Best Performing Strategies</p>
                {Object.entries(bestArmsByDimension).map(([dim, data]) => {
                  const dimLabel = RL_DIMENSION_LABELS[dim] || dim;
                  let armLabel = data.arm;
                  if (dim === 'TIME_SLOT') armLabel = `${data.arm}:00`;
                  if (dim === 'CONTENT_TYPE') armLabel = CONTENT_TYPES.find(c => c.value === data.arm)?.label || data.arm;
                  if (dim === 'TONE_STYLE') armLabel = TONE_STYLES.find(t => t.value === data.arm)?.label || data.arm;
                  if (dim === 'HASHTAG_PATTERN') armLabel = HASHTAG_PATTERNS.find(h => h.value === data.arm)?.label || data.arm;
                  return (
                    <div key={dim} className="flex items-center justify-between py-1.5 border-b last:border-0">
                      <span className="text-sm text-muted-foreground">{dimLabel}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{armLabel}</Badge>
                        <span className="text-xs text-muted-foreground">({data.pulls} tests, score: {data.reward})</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Connected Platforms */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Connected Platforms</CardTitle>
        </CardHeader>
        <CardContent>
          {bot.platformConns.length === 0 ? (
            <div className="text-center py-6">
              <Globe className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="font-medium mb-1">No platforms connected yet</p>
              <p className="text-sm text-muted-foreground mb-4">Connect at least one social network so your bot can start posting and engaging with your audience.</p>
              <Link href={`/dashboard/bots/${bot.id}/platforms`}>
                <Button size="sm"><Globe className="mr-2 h-4 w-4" /> Connect Your First Platform</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {bot.platformConns.map((conn) => (
                <div key={conn.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{PLATFORM_NAMES[conn.platform] || conn.platform}</span>
                    <Badge variant={conn.status === 'CONNECTED' ? 'success' : conn.status === 'ERROR' ? 'destructive' : 'secondary'}>
                      {conn.status}
                    </Badge>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {conn.postsToday} posts today
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Recent Activity</CardTitle>
          <Link href={`/dashboard/bots/${bot.id}/activity`}>
            <Button variant="ghost" size="sm">View All</Button>
          </Link>
        </CardHeader>
        <CardContent>
          {bot.activities.length === 0 ? (
            <div className="text-center py-6">
              <Activity className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="font-medium mb-1">No activity yet</p>
              <p className="text-sm text-muted-foreground">Once your bot is active and has connected platforms, you&apos;ll see posts, replies, and engagement actions here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {bot.activities.map((activity) => (
                <div key={activity.id} className="flex items-start justify-between py-2 border-b last:border-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {activity.action.replace(/_/g, ' ')}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {PLATFORM_NAMES[activity.platform] || activity.platform}
                      </span>
                    </div>
                    {activity.content && (
                      <p className="text-sm text-muted-foreground mt-1 truncate">{activity.content}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {activity.success ? (
                      <Badge variant="success" className="text-xs">OK</Badge>
                    ) : (
                      <Badge variant="destructive" className="text-xs">Failed</Badge>
                    )}
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(activity.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
