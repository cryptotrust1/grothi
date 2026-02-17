import { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PLATFORM_NAMES } from '@/lib/constants';
import { Bot, Search, Pause, Play, Trash2, CheckCircle, XCircle } from 'lucide-react';

export const metadata: Metadata = { title: 'Admin - Bots', robots: { index: false } };

const statusVariant: Record<string, 'success' | 'warning' | 'destructive' | 'secondary'> = {
  ACTIVE: 'success', PAUSED: 'secondary', STOPPED: 'secondary', ERROR: 'destructive', NO_CREDITS: 'warning',
};
const connVariant: Record<string, 'success' | 'destructive' | 'secondary' | 'warning'> = {
  CONNECTED: 'success', DISCONNECTED: 'secondary', ERROR: 'destructive', SUSPENDED: 'warning',
};

export default async function AdminBotsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string; q?: string; status?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const search = sp.q?.trim() || '';
  const statusFilter = sp.status || '';

  const bots = await db.bot.findMany({
    where: {
      ...(search ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { brandName: { contains: search, mode: 'insensitive' as const } },
          { user: { email: { contains: search, mode: 'insensitive' as const } } },
        ],
      } : {}),
      ...(statusFilter ? { status: statusFilter as any } : {}),
    },
    include: {
      user: { select: { id: true, email: true, name: true } },
      platformConns: { select: { platform: true, status: true } },
      _count: { select: { activities: true, media: true, scheduledPosts: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  async function handleToggleStatus(formData: FormData) {
    'use server';
    await requireAdmin();
    const botId = formData.get('botId') as string;
    if (!botId) redirect('/admin/bots?error=Invalid bot');
    const bot = await db.bot.findUnique({ where: { id: botId } });
    if (!bot) redirect('/admin/bots?error=Bot not found');
    const newStatus = bot.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    await db.bot.update({ where: { id: botId }, data: { status: newStatus as any } });
    redirect('/admin/bots?success=' + bot.name + ' is now ' + newStatus);
  }

  async function handleDeleteBot(formData: FormData) {
    'use server';
    await requireAdmin();
    const botId = formData.get('botId') as string;
    if (!botId) redirect('/admin/bots?error=Invalid bot');
    const bot = await db.bot.findUnique({ where: { id: botId }, select: { name: true } });
    if (!bot) redirect('/admin/bots?error=Bot not found');
    await db.bot.delete({ where: { id: botId } });
    redirect('/admin/bots?success=Deleted bot: ' + bot.name);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Bot className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">All Bots ({bots.length})</h1>
        </div>
        <form action="/admin/bots" method="GET" className="flex gap-2">
          <Input name="q" defaultValue={search} placeholder="Search bot, brand, or owner..." className="w-56 h-9" />
          <select name="status" defaultValue={statusFilter} className="flex h-9 rounded-md border border-input bg-background px-2 text-sm">
            <option value="">All status</option>
            <option value="ACTIVE">Active</option>
            <option value="PAUSED">Paused</option>
            <option value="STOPPED">Stopped</option>
            <option value="ERROR">Error</option>
            <option value="NO_CREDITS">No Credits</option>
          </select>
          <Button type="submit" size="sm" variant="outline" className="h-9 gap-1.5">
            <Search className="h-3.5 w-3.5" /> Filter
          </Button>
        </form>
      </div>

      {sp.success && <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-800">{sp.success}</div>}
      {sp.error && <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800">{sp.error}</div>}

      <Card>
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="text-left py-2.5 font-medium">Bot / Brand</th>
                  <th className="text-left py-2.5 font-medium">Owner</th>
                  <th className="text-left py-2.5 font-medium">Status</th>
                  <th className="text-left py-2.5 font-medium">Platforms</th>
                  <th className="text-right py-2.5 font-medium">Actions</th>
                  <th className="text-right py-2.5 font-medium">Media</th>
                  <th className="text-right py-2.5 font-medium">Posts</th>
                  <th className="text-right py-2.5 font-medium">Created</th>
                  <th className="text-right py-2.5 font-medium min-w-[140px]">Manage</th>
                </tr>
              </thead>
              <tbody>
                {bots.map((bot) => (
                  <tr key={bot.id} className="border-b last:border-0">
                    <td className="py-3">
                      <div className="font-medium">{bot.name}</div>
                      <div className="text-xs text-muted-foreground">{bot.brandName}</div>
                      <div className="text-[10px] text-muted-foreground">Goal: {bot.goal} | Safety: {bot.safetyLevel}</div>
                    </td>
                    <td className="py-3">
                      <Link href={`/admin/users/${bot.user.id}`} className="text-xs hover:underline text-muted-foreground">
                        {bot.user.email}
                      </Link>
                    </td>
                    <td className="py-3">
                      <Badge variant={statusVariant[bot.status] || 'secondary'} className="text-[10px]">{bot.status}</Badge>
                    </td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-0.5">
                        {bot.platformConns.map(conn => (
                          <Badge key={conn.platform} variant={connVariant[conn.status] || 'secondary'} className="text-[9px] px-1 py-0 gap-0.5">
                            {conn.status === 'CONNECTED' ? <CheckCircle className="h-2 w-2" /> : <XCircle className="h-2 w-2" />}
                            {PLATFORM_NAMES[conn.platform] || conn.platform}
                          </Badge>
                        ))}
                        {bot.platformConns.length === 0 && <span className="text-[10px] text-muted-foreground">-</span>}
                      </div>
                    </td>
                    <td className="text-right py-3 text-xs">{bot._count.activities}</td>
                    <td className="text-right py-3 text-xs">{bot._count.media}</td>
                    <td className="text-right py-3 text-xs">{bot._count.scheduledPosts}</td>
                    <td className="text-right py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(bot.createdAt).toLocaleDateString()}
                    </td>
                    <td className="text-right py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <form action={handleToggleStatus}>
                          <input type="hidden" name="botId" value={bot.id} />
                          <Button type="submit" size="sm" variant="ghost" className="h-7 text-[10px] gap-1 px-2">
                            {bot.status === 'ACTIVE' ? <><Pause className="h-3 w-3" /> Pause</> : <><Play className="h-3 w-3" /> Start</>}
                          </Button>
                        </form>
                        <form action={handleDeleteBot}>
                          <input type="hidden" name="botId" value={bot.id} />
                          <Button type="submit" size="sm" variant="destructive" className="h-7 text-[10px] gap-1 px-2">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
