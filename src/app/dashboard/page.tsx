import { Metadata } from 'next';
import Link from 'next/link';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Bots</CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{bots.length}</div>
            <p className="text-xs text-muted-foreground">{activeBots} active</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Credits</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{credits.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">${(credits / 100).toFixed(2)} value</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Actions</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalActivity.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">all time</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Platforms</CardTitle>
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
          <Card className="text-center py-12">
            <CardContent>
              <Bot className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No bots yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first AI marketing bot to get started.
              </p>
              <Link href="/dashboard/bots/new">
                <Button>
                  <Plus className="mr-2 h-4 w-4" /> Create Your First Bot
                </Button>
              </Link>
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
  const config: Record<string, { variant: 'success' | 'warning' | 'destructive' | 'secondary'; label: string }> = {
    ACTIVE: { variant: 'success', label: 'Active' },
    PAUSED: { variant: 'secondary', label: 'Paused' },
    STOPPED: { variant: 'secondary', label: 'Stopped' },
    ERROR: { variant: 'destructive', label: 'Error' },
    NO_CREDITS: { variant: 'warning', label: 'No Credits' },
  };
  const { variant, label } = config[status] || { variant: 'secondary' as const, label: status };
  return <Badge variant={variant}>{label}</Badge>;
}
