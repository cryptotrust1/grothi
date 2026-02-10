import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Activity, Settings, Globe, BarChart3, Play, Pause,
  AlertCircle, Clock,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Bot Detail',
  robots: { index: false },
};

const statusConfig: Record<string, { variant: 'success' | 'warning' | 'destructive' | 'secondary'; label: string }> = {
  ACTIVE: { variant: 'success', label: 'Active' },
  PAUSED: { variant: 'secondary', label: 'Paused' },
  STOPPED: { variant: 'secondary', label: 'Stopped' },
  ERROR: { variant: 'destructive', label: 'Error' },
  NO_CREDITS: { variant: 'warning', label: 'No Credits' },
};

const platformNames: Record<string, string> = {
  MASTODON: 'Mastodon',
  FACEBOOK: 'Facebook',
  TELEGRAM: 'Telegram',
  MOLTBOOK: 'Moltbook',
  DISCORD: 'Discord',
  TWITTER: 'Twitter',
  BLUESKY: 'Bluesky',
  REDDIT: 'Reddit',
  DEVTO: 'Dev.to',
};

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

  const todayActivities = await db.botActivity.count({
    where: {
      botId: bot.id,
      createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
    },
  });

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

      {/* Sub-nav */}
      <div className="flex gap-4 border-b pb-2">
        <Link href={`/dashboard/bots/${bot.id}`} className="text-sm font-medium border-b-2 border-primary pb-2">
          Overview
        </Link>
        <Link href={`/dashboard/bots/${bot.id}/activity`} className="text-sm text-muted-foreground hover:text-foreground pb-2">
          Activity
        </Link>
        <Link href={`/dashboard/bots/${bot.id}/platforms`} className="text-sm text-muted-foreground hover:text-foreground pb-2">
          Platforms
        </Link>
        <Link href={`/dashboard/bots/${bot.id}/settings`} className="text-sm text-muted-foreground hover:text-foreground pb-2">
          Settings
        </Link>
      </div>

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
                    <span className="font-medium">{platformNames[conn.platform] || conn.platform}</span>
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
                        {activity.action}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {platformNames[activity.platform] || activity.platform}
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
                      {new Date(activity.createdAt).toLocaleTimeString()}
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
