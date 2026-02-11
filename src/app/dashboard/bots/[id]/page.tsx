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
  TrendingUp, Rss, Shield, Zap,
} from 'lucide-react';
import { BotNav } from '@/components/dashboard/bot-nav';
import { BOT_STATUS_CONFIG, PLATFORM_NAMES, GOAL_LABELS } from '@/lib/constants';

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

  // Content Reactor / Self-Learning stats
  const reactorState = (bot.reactorState as Record<string, unknown>) || {};
  const selfLearning = (reactorState.selfLearning as boolean) ?? true;
  const contentTypes = (reactorState.contentTypes as string[]) || [];
  const maxPostsPerDay = (reactorState.maxPostsPerDay as number) || 10;
  const rssFeeds = Array.isArray(bot.rssFeeds) ? (bot.rssFeeds as string[]) : [];
  const keywords = Array.isArray(bot.keywords) ? (bot.keywords as string[]) : [];
  const goalLabels = GOAL_LABELS;

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
                <p className="text-sm text-muted-foreground">Engagement Score</p>
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
                <span className="text-sm">Self-Learning AI</span>
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
                <span className="text-sm">Safety Level</span>
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

      {/* Connected Platforms */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Connected Platforms</CardTitle>
        </CardHeader>
        <CardContent>
          {bot.platformConns.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-muted-foreground mb-4">No platforms connected yet.</p>
              <Link href={`/dashboard/bots/${bot.id}/platforms`}>
                <Button size="sm"><Globe className="mr-2 h-4 w-4" /> Add Platform</Button>
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
            <p className="text-center py-6 text-muted-foreground">
              No activity yet. Start your bot to see actions here.
            </p>
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
