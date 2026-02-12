import { Metadata } from 'next';
import Link from 'next/link';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { BOT_STATUS_CONFIG } from '@/lib/constants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { HelpTip } from '@/components/ui/help-tip';
import { Bot, CreditCard, Activity, TrendingUp, Plus, ArrowRight } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Dashboard',
  robots: { index: false },
};

export default async function DashboardPage() {
  const user = await requireAuth();

  const [bots, totalActivity, creditBalance] = await Promise.all([
    db.bot.findMany({
      where: { userId: user.id },
      include: {
        platformConns: true,
        _count: { select: { activities: true } },
      },
      orderBy: { updatedAt: 'desc' },
    }),
    db.botActivity.count({
      where: { bot: { userId: user.id } },
    }),
    db.creditBalance.findUnique({
      where: { userId: user.id },
    }),
  ]);

  const activeBots = bots.filter((b) => b.status === 'ACTIVE').length;
  const credits = creditBalance?.balance ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back, {user.name || 'there'}!
          </p>
        </div>
        <Link href="/dashboard/bots/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" /> New Bot
          </Button>
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="flex items-center gap-1">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Bots</CardTitle>
              <HelpTip text="The total number of AI marketing bots you have created, including active, paused, and stopped bots." side="top" />
            </div>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{bots.length}</div>
            <p className="text-xs text-muted-foreground">{activeBots} active</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="flex items-center gap-1">
              <CardTitle className="text-sm font-medium text-muted-foreground">Credits</CardTitle>
              <HelpTip text="Your available credit balance. Credits are consumed by bot actions like generating content, posting, replying, and more." side="top" />
            </div>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{credits.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">${(credits / 100).toFixed(2)} value</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="flex items-center gap-1">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Actions</CardTitle>
              <HelpTip text="The cumulative number of actions performed by all your bots, including posts, replies, boosts, and content generation." side="top" />
            </div>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalActivity.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">all time</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="flex items-center gap-1">
              <CardTitle className="text-sm font-medium text-muted-foreground">Platforms</CardTitle>
              <HelpTip text="The number of unique social media platforms connected across all your bots, such as X, Mastodon, LinkedIn, and others." side="top" />
            </div>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(bots.flatMap((b) => b.platformConns.map((p) => p.platform))).size}
            </div>
            <p className="text-xs text-muted-foreground">connected</p>
          </CardContent>
        </Card>
      </div>

      {/* Bot List */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Your Bots</h2>
        {bots.length === 0 ? (
          <Card className="py-12">
            <CardContent>
              <div className="text-center">
                <Bot className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No bots yet</h3>
                <p className="text-muted-foreground mb-6">
                  Get your AI marketing up and running in just a few steps.
                </p>
              </div>
              <ol className="mx-auto max-w-md space-y-3 text-sm text-muted-foreground mb-8">
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">1</span>
                  <span><strong className="text-foreground">Create a bot</strong> &mdash; give it a name, brand, and marketing goal so the AI knows your voice.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">2</span>
                  <span><strong className="text-foreground">Connect platforms</strong> &mdash; link social accounts like X, Mastodon, LinkedIn, and more.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">3</span>
                  <span><strong className="text-foreground">Set a schedule</strong> &mdash; choose how often your bot posts, replies, and engages.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">4</span>
                  <span><strong className="text-foreground">Activate &amp; monitor</strong> &mdash; start the bot and track performance from your dashboard.</span>
                </li>
              </ol>
              <div className="text-center">
                <Link href="/dashboard/bots/new">
                  <Button>
                    <Plus className="mr-2 h-4 w-4" /> Create Your First Bot
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {bots.map((bot) => (
              <Link key={bot.id} href={`/dashboard/bots/${bot.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{bot.name}</CardTitle>
                      <StatusBadge status={bot.status} />
                    </div>
                    <p className="text-sm text-muted-foreground">{bot.brandName}</p>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {bot.platformConns.length} platform{bot.platformConns.length !== 1 ? 's' : ''}
                      </span>
                      <span className="text-muted-foreground">
                        {bot._count.activities} actions
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const { variant, label } = BOT_STATUS_CONFIG[status] || { variant: 'secondary' as const, label: status };
  return <Badge variant={variant}>{label}</Badge>;
}
