import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Heart, MessageSquare, Share2 } from 'lucide-react';

export const metadata: Metadata = { title: 'Bot Analytics', robots: { index: false } };

export default async function BotAnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth();
  const { id } = await params;

  const bot = await db.bot.findFirst({ where: { id, userId: user.id } });
  if (!bot) notFound();

  const last30Days = new Date();
  last30Days.setDate(last30Days.getDate() - 30);

  const [stats, recentStats] = await Promise.all([
    db.botActivity.aggregate({
      where: { botId: bot.id },
      _sum: { likes: true, comments: true, shares: true, creditsUsed: true },
      _count: true,
    }),
    db.botDailyStat.findMany({
      where: { botId: bot.id, date: { gte: last30Days } },
      orderBy: { date: 'desc' },
      take: 30,
    }),
  ]);

  const totalLikes = stats._sum.likes || 0;
  const totalComments = stats._sum.comments || 0;
  const totalShares = stats._sum.shares || 0;
  const totalCreditsUsed = stats._sum.creditsUsed || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{bot.name} - Analytics</h1>
        <div className="flex gap-4 mt-4 border-b pb-2">
          <Link href={`/dashboard/bots/${id}`} className="text-sm text-muted-foreground hover:text-foreground pb-2">Overview</Link>
          <Link href={`/dashboard/bots/${id}/activity`} className="text-sm text-muted-foreground hover:text-foreground pb-2">Activity</Link>
          <Link href={`/dashboard/bots/${id}/platforms`} className="text-sm text-muted-foreground hover:text-foreground pb-2">Platforms</Link>
          <Link href={`/dashboard/bots/${id}/settings`} className="text-sm text-muted-foreground hover:text-foreground pb-2">Settings</Link>
        </div>
      </div>

      {/* Engagement KPIs */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Likes</CardTitle>
            <Heart className="h-4 w-4 text-pink-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalLikes.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Comments</CardTitle>
            <MessageSquare className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalComments.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Shares</CardTitle>
            <Share2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalShares.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Credits Used</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCreditsUsed.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">${(totalCreditsUsed / 100).toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Daily Stats Table */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Statistics (Last 30 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          {recentStats.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No daily stats yet. Stats appear after your bot starts working.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium">Date</th>
                    <th className="text-right py-2 font-medium">Posts</th>
                    <th className="text-right py-2 font-medium">Likes</th>
                    <th className="text-right py-2 font-medium">Comments</th>
                    <th className="text-right py-2 font-medium">Credits</th>
                  </tr>
                </thead>
                <tbody>
                  {recentStats.map((stat) => (
                    <tr key={stat.id} className="border-b last:border-0">
                      <td className="py-2">{new Date(stat.date).toLocaleDateString()}</td>
                      <td className="text-right py-2">{stat.postsCount}</td>
                      <td className="text-right py-2">{stat.totalLikes}</td>
                      <td className="text-right py-2">{stat.totalComments}</td>
                      <td className="text-right py-2">{stat.creditsUsed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
