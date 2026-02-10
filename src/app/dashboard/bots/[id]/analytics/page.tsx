import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Heart, MessageSquare, Share2, TrendingUp, Activity, DollarSign, BarChart3 } from 'lucide-react';
import { EngagementChart, ActivityChart, CreditsChart } from '@/components/dashboard/analytics-charts';

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

  const [stats, recentStats, weeklyActivities, platformBreakdown] = await Promise.all([
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
        <div className="flex gap-4 mt-4 border-b pb-2">
          <Link href={`/dashboard/bots/${id}`} className="text-sm text-muted-foreground hover:text-foreground pb-2">Overview</Link>
          <Link href={`/dashboard/bots/${id}/activity`} className="text-sm text-muted-foreground hover:text-foreground pb-2">Activity</Link>
          <Link href={`/dashboard/bots/${id}/platforms`} className="text-sm text-muted-foreground hover:text-foreground pb-2">Platforms</Link>
          <Link href={`/dashboard/bots/${id}/analytics`} className="text-sm font-medium text-foreground border-b-2 border-primary pb-2">Analytics</Link>
          <Link href={`/dashboard/bots/${id}/settings`} className="text-sm text-muted-foreground hover:text-foreground pb-2">Settings</Link>
        </div>
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Engagement</CardTitle>
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
        <CardHeader><CardTitle>Platform Performance</CardTitle></CardHeader>
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
