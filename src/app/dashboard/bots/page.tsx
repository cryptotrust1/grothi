import { Metadata } from 'next';
import Link from 'next/link';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bot, Plus, Settings, Activity, Globe } from 'lucide-react';

export const metadata: Metadata = {
  title: 'My Bots',
  robots: { index: false },
};

const statusConfig: Record<string, { variant: 'success' | 'warning' | 'destructive' | 'secondary'; label: string }> = {
  ACTIVE: { variant: 'success', label: 'Active' },
  PAUSED: { variant: 'secondary', label: 'Paused' },
  STOPPED: { variant: 'secondary', label: 'Stopped' },
  ERROR: { variant: 'destructive', label: 'Error' },
  NO_CREDITS: { variant: 'warning', label: 'No Credits' },
};

export default async function BotsPage() {
  const user = await requireAuth();

  const bots = await db.bot.findMany({
    where: { userId: user.id },
    include: {
      platformConns: true,
      _count: { select: { activities: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Bots</h1>
          <p className="text-muted-foreground">{bots.length} bot{bots.length !== 1 ? 's' : ''}</p>
        </div>
        <Link href="/dashboard/bots/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" /> New Bot
          </Button>
        </Link>
      </div>

      {bots.length === 0 ? (
        <Card className="text-center py-16">
          <CardContent>
            <Bot className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">Create your first bot</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Set up an AI marketing bot in minutes. Just give it a name, connect your platforms, and let it work.
            </p>
            <Link href="/dashboard/bots/new">
              <Button size="lg">
                <Plus className="mr-2 h-4 w-4" /> Create Bot
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {bots.map((bot) => {
            const sc = statusConfig[bot.status] || { variant: 'secondary' as const, label: bot.status };
            return (
              <Card key={bot.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg truncate">{bot.name}</CardTitle>
                    <Badge variant={sc.variant}>{sc.label}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{bot.brandName}</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {bot.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{bot.description}</p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Globe className="h-3 w-3" /> {bot.platformConns.length} platforms
                    </span>
                    <span className="flex items-center gap-1">
                      <Activity className="h-3 w-3" /> {bot._count.activities} actions
                    </span>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Link href={`/dashboard/bots/${bot.id}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full">View</Button>
                    </Link>
                    <Link href={`/dashboard/bots/${bot.id}/settings`}>
                      <Button variant="ghost" size="sm">
                        <Settings className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
