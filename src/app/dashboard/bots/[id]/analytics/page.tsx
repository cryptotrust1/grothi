import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Heart, MessageSquare, Share2, TrendingUp, Activity, DollarSign, BarChart3, Brain } from 'lucide-react';
import { EngagementChart, ActivityChart, CreditsChart } from '@/components/dashboard/analytics-charts';
import { BotNav } from '@/components/dashboard/bot-nav';
import { Badge } from '@/components/ui/badge';
import { HelpTip } from '@/components/ui/help-tip';
import { RL_DIMENSION_LABELS, TONE_STYLES, HASHTAG_PATTERNS, CONTENT_TYPES, PLATFORM_NAMES } from '@/lib/constants';

export const metadata: Metadata = { title: 'Bot Analytics', robots: { index: false } };

export default async function BotAnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth();
  const { id } = await params;

  const bot = await db.bot.findFirst({ where: { id, userId: user.id } });
  if (!bot) notFound();

  const last30Days = new Date();
  last30Days.setDate(last30Days.getDate() - 30);

  const last7Days = new Date();
  last7Days.setDate(last7Days.getDate() - 7);

  const [stats, recentStats, weeklyActivities, platformBreakdown, rlConfigs, rlTopArms] = await Promise.all([
    db.botActivity.aggregate({
      where: { botId: bot.id },
      _sum: { likes: true, comments: true, shares: true, creditsUsed: true },
      _count: true,
    }),
    db.botDailyStat.findMany({
      where: { botId: bot.id, date: { gte: last30Days } },
      orderBy: { date: 'asc' },
      take: 30,
    }),
    db.botActivity.count({
      where: { botId: bot.id, createdAt: { gte: last7Days } },
    }),
    db.botActivity.groupBy({
      by: ['platform'],
      where: { botId: bot.id },
      _count: true,
      _sum: { likes: true, comments: true, shares: true },
    }),
    db.rLConfig.findMany({
      where: { botId: bot.id },
      orderBy: { totalEpisodes: 'desc' },
    }),
    db.rLArmState.findMany({
      where: { botId: bot.id },
      orderBy: { ewmaReward: 'desc' },
      take: 50,
    }),
  ]);

  const totalLikes = stats._sum.likes || 0;
  const totalComments = stats._sum.comments || 0;
  const totalShares = stats._sum.shares || 0;
  const totalCreditsUsed = stats._sum.creditsUsed || 0;
  const engagementRate = stats._count > 0
    ? ((totalLikes + totalComments * 3 + totalShares * 5) / stats._count).toFixed(1)
    : '0.0';

  const chartData = recentStats.map((stat) => ({
    date: new Date(stat.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    posts: stat.postsCount,
    replies: stat.repliesCount,
    likes: stat.totalLikes,
    comments: stat.totalComments,
    shares: stat.totalShares,
    credits: stat.creditsUsed,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{bot.name} - Analytics</h1>
        <BotNav botId={id} activeTab="analytics" />
      </div>

      {/* Engagement KPIs */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Likes</CardTitle>
            <Heart className="h-4 w-4 text-pink-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{totalLikes.toLocaleString()}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Comments</CardTitle>
            <MessageSquare className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{totalComments.toLocaleString()}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Shares</CardTitle>
            <Share2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{totalShares.toLocaleString()}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">Engagement <HelpTip text="Engagement score = Likes (1pt) + Comments (3pt) + Shares (5pt) per action. Higher score means your content generates more interaction." /></CardTitle>
            <Activity className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{engagementRate}</div>
            <p className="text-xs text-muted-foreground">score/action</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Credits</CardTitle>
            <DollarSign className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCreditsUsed.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">${(totalCreditsUsed / 100).toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Engagement Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" /> Engagement Trends (30 Days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <p className="text-center py-12 text-muted-foreground">No engagement data yet. Charts appear after your bot starts working.</p>
          ) : (
            <EngagementChart data={chartData} />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" /> Post Volume</CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <p className="text-center py-12 text-muted-foreground">No activity data yet.</p>
            ) : (
              <ActivityChart data={chartData} />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5" /> Credit Usage</CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <p className="text-center py-12 text-muted-foreground">No credit usage data yet.</p>
            ) : (
              <CreditsChart data={chartData} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Platform Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">Platform Performance <HelpTip text="Breakdown of bot activity across all connected platforms. The 'Score' column shows engagement per action - use it to identify your best-performing platforms." /></CardTitle>
        </CardHeader>
        <CardContent>
          {platformBreakdown.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No platform data yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium">Platform</th>
                    <th className="text-right py-2 font-medium">Actions</th>
                    <th className="text-right py-2 font-medium">Likes</th>
                    <th className="text-right py-2 font-medium">Comments</th>
                    <th className="text-right py-2 font-medium">Shares</th>
                    <th className="text-right py-2 font-medium">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {platformBreakdown.map((p) => {
                    const pLikes = p._sum.likes || 0;
                    const pComments = p._sum.comments || 0;
                    const pShares = p._sum.shares || 0;
                    const pRate = p._count > 0 ? ((pLikes + pComments * 3 + pShares * 5) / p._count).toFixed(1) : '0.0';
                    return (
                      <tr key={p.platform} className="border-b last:border-0">
                        <td className="py-2 font-medium">{p.platform}</td>
                        <td className="text-right py-2">{p._count}</td>
                        <td className="text-right py-2">{pLikes}</td>
                        <td className="text-right py-2">{pComments}</td>
                        <td className="text-right py-2">{pShares}</td>
                        <td className="text-right py-2 font-semibold">{pRate}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Learning Analytics */}
      {rlConfigs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" /> AI Learning Analytics
              <HelpTip text="Detailed view of what the reinforcement learning engine has learned per platform. The exploration rate decreases as the bot gains confidence in its strategy." />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {rlConfigs.map((config) => {
                const platformArms = rlTopArms.filter(
                  (a) => a.platform === config.platform
                );
                const bestByDim: Record<string, typeof rlTopArms[0]> = {};
                for (const arm of platformArms) {
                  if (!bestByDim[arm.dimension] || arm.ewmaReward > bestByDim[arm.dimension].ewmaReward) {
                    bestByDim[arm.dimension] = arm;
                  }
                }
                const explorationPct = Math.round(config.epsilon * 100);
                const exploitPct = 100 - explorationPct;

                return (
                  <div key={config.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium">{PLATFORM_NAMES[config.platform] || config.platform}</h4>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{config.totalEpisodes} episodes</span>
                        <span>Explore: {explorationPct}% / Exploit: {exploitPct}%</span>
                      </div>
                    </div>
                    <div className="w-full h-2 rounded-full bg-muted overflow-hidden mb-3">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${exploitPct}%` }}
                      />
                    </div>
                    {Object.keys(bestByDim).length > 0 ? (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {Object.entries(bestByDim).map(([dim, arm]) => {
                          const dimLabel = RL_DIMENSION_LABELS[dim] || dim;
                          let armLabel = arm.armKey;
                          if (dim === 'TIME_SLOT') armLabel = `${arm.armKey}:00`;
                          if (dim === 'CONTENT_TYPE') armLabel = CONTENT_TYPES.find(c => c.value === arm.armKey)?.label || arm.armKey;
                          if (dim === 'TONE_STYLE') armLabel = TONE_STYLES.find(t => t.value === arm.armKey)?.label || arm.armKey;
                          if (dim === 'HASHTAG_PATTERN') armLabel = HASHTAG_PATTERNS.find(h => h.value === arm.armKey)?.label || arm.armKey;
                          return (
                            <div key={dim} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                              <span className="text-xs text-muted-foreground">{dimLabel}</span>
                              <div className="flex items-center gap-1.5">
                                <Badge variant="outline" className="text-xs">{armLabel}</Badge>
                                <span className="text-xs text-muted-foreground">({arm.pulls}x, avg: {(Math.round(arm.ewmaReward * 100) / 100)})</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Not enough data yet. The bot needs more posts to identify patterns.</p>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-muted-foreground">This Week</p>
            <p className="text-3xl font-bold mt-1">{weeklyActivities}</p>
            <p className="text-xs text-muted-foreground mt-1">actions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-muted-foreground">All Time</p>
            <p className="text-3xl font-bold mt-1">{stats._count}</p>
            <p className="text-xs text-muted-foreground mt-1">total actions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-muted-foreground">Platforms</p>
            <p className="text-3xl font-bold mt-1">{platformBreakdown.length}</p>
            <p className="text-xs text-muted-foreground mt-1">active</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
