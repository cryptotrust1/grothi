import { Metadata } from 'next';
import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { addCredits } from '@/lib/credits';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { PLATFORM_NAMES } from '@/lib/constants';
import {
  ArrowLeft, User, Mail, Calendar, CreditCard, Bot, Activity,
  Shield, ShieldOff, Trash2, Globe, CheckCircle, XCircle, Clock,
} from 'lucide-react';

export const metadata: Metadata = { title: 'Admin - User Details', robots: { index: false } };

const statusVariant: Record<string, 'success' | 'warning' | 'destructive' | 'secondary'> = {
  ACTIVE: 'success', PAUSED: 'secondary', STOPPED: 'secondary', ERROR: 'destructive', NO_CREDITS: 'warning',
};
const connVariant: Record<string, 'success' | 'destructive' | 'secondary' | 'warning'> = {
  CONNECTED: 'success', DISCONNECTED: 'secondary', ERROR: 'destructive', SUSPENDED: 'warning',
};

export default async function AdminUserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;

  const user = await db.user.findUnique({
    where: { id },
    include: {
      creditBalance: true,
      bots: {
        include: {
          platformConns: true,
          _count: { select: { activities: true, media: true, scheduledPosts: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!user) notFound();

  // Fetch recent activity across all user's bots
  const botIds = user.bots.map(b => b.id);
  const [recentActivity, creditTxns, sessionCount] = await Promise.all([
    db.botActivity.findMany({
      where: { botId: { in: botIds } },
      include: { bot: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 25,
    }),
    db.creditTransaction.findMany({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    db.session.count({ where: { userId: id, expiresAt: { gt: new Date() } } }),
  ]);

  // Server actions
  async function handleAddCredits(formData: FormData) {
    'use server';
    await requireAdmin();
    const credits = parseInt(formData.get('credits') as string, 10);
    if (isNaN(credits) || credits <= 0) redirect(`/admin/users/${id}?error=Invalid amount`);
    await addCredits(id, credits, 'BONUS', `Admin bonus: ${credits} credits`);
    redirect(`/admin/users/${id}?success=Added ${credits} credits`);
  }

  async function handleDeductCredits(formData: FormData) {
    'use server';
    await requireAdmin();
    const credits = parseInt(formData.get('deductCredits') as string, 10);
    if (isNaN(credits) || credits <= 0) redirect(`/admin/users/${id}?error=Invalid amount`);

    // Atomic deduction using transaction to prevent race conditions
    try {
      await db.$transaction(async (tx) => {
        const balance = await tx.creditBalance.findUnique({ where: { userId: id } });
        if (!balance || balance.balance < credits) {
          throw new Error('Insufficient balance');
        }
        const updated = await tx.creditBalance.update({
          where: { userId: id },
          data: { balance: { decrement: credits } },
        });
        await tx.creditTransaction.create({
          data: {
            userId: id,
            type: 'USAGE',
            amount: -credits,
            balance: updated.balance,
            description: `Admin deduction: ${credits} credits`,
          },
        });
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Deduction failed';
      redirect(`/admin/users/${id}?error=${encodeURIComponent(msg)}`);
    }
    redirect(`/admin/users/${id}?success=Deducted ${credits} credits`);
  }

  async function handleToggleBlock() {
    'use server';
    await requireAdmin();
    const u = await db.user.findUnique({ where: { id } });
    if (!u || u.role === 'ADMIN') redirect(`/admin/users/${id}?error=Cannot block admin`);
    await db.user.update({
      where: { id },
      data: { isBlocked: !u.isBlocked, blockedAt: u.isBlocked ? null : new Date(), blockedReason: u.isBlocked ? null : 'Blocked by admin' },
    });
    if (!u.isBlocked) await db.session.deleteMany({ where: { userId: id } });
    redirect(`/admin/users/${id}?success=${u.isBlocked ? 'User unblocked' : 'User blocked and sessions terminated'}`);
  }

  async function handleToggleRole() {
    'use server';
    await requireAdmin();
    const u = await db.user.findUnique({ where: { id } });
    if (!u) redirect(`/admin/users/${id}?error=User not found`);
    const newRole = u.role === 'ADMIN' ? 'USER' : 'ADMIN';
    await db.user.update({ where: { id }, data: { role: newRole } });
    redirect(`/admin/users/${id}?success=Role changed to ${newRole}`);
  }

  async function handleDeleteUser() {
    'use server';
    await requireAdmin();
    const u = await db.user.findUnique({ where: { id } });
    if (!u || u.role === 'ADMIN') redirect(`/admin/users/${id}?error=Cannot delete admin`);
    await db.user.delete({ where: { id } });
    redirect('/admin/users?success=User deleted');
  }

  async function handleKillSessions() {
    'use server';
    await requireAdmin();
    await db.session.deleteMany({ where: { userId: id } });
    redirect(`/admin/users/${id}?success=All sessions terminated`);
  }

  // Collect all unique platforms
  const allPlatforms = new Map<string, string>();
  for (const bot of user.bots) {
    for (const conn of bot.platformConns) {
      allPlatforms.set(conn.platform, conn.status);
    }
  }

  const balance = user.creditBalance?.balance ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/admin/users">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Users
          </Button>
        </Link>
      </div>

      {sp.success && <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-800">{sp.success}</div>}
      {sp.error && <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800">{sp.error}</div>}

      {/* User Profile Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-7 w-7 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl">{user.name || 'No name'}</CardTitle>
                <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" /> {user.email}
                </div>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" /> Joined {new Date(user.createdAt).toLocaleDateString()} ({Math.floor((Date.now() - user.createdAt.getTime()) / 86400000)} days ago)
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant={user.role === 'ADMIN' ? 'default' : 'secondary'}>{user.role}</Badge>
              {user.isBlocked && <Badge variant="destructive">BLOCKED</Badge>}
              {user.emailVerified ? (
                <Badge variant="outline" className="gap-1"><CheckCircle className="h-3 w-3 text-green-500" /> Verified</Badge>
              ) : (
                <Badge variant="outline" className="gap-1 text-orange-500"><XCircle className="h-3 w-3" /> Unverified</Badge>
              )}
              {user.twoFactorEnabled && <Badge variant="outline">2FA Enabled</Badge>}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold">{balance.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">Credits</div>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold">{user.bots.length}</div>
              <div className="text-xs text-muted-foreground">Bots</div>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold">{allPlatforms.size}</div>
              <div className="text-xs text-muted-foreground">Platforms</div>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold">{recentActivity.length > 24 ? '25+' : recentActivity.length}</div>
              <div className="text-xs text-muted-foreground">Activities</div>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold">{sessionCount}</div>
              <div className="text-xs text-muted-foreground">Active Sessions</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Admin Actions */}
      <Card>
        <CardHeader><CardTitle className="text-base">Admin Actions</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {/* Credits */}
            <form action={handleAddCredits} className="flex items-center gap-1.5">
              <Input name="credits" type="number" placeholder="Amount" className="w-24 h-9" min="1" />
              <Button type="submit" size="sm" variant="outline" className="gap-1.5">
                <CreditCard className="h-3.5 w-3.5" /> Add Credits
              </Button>
            </form>
            <form action={handleDeductCredits} className="flex items-center gap-1.5">
              <Input name="deductCredits" type="number" placeholder="Amount" className="w-24 h-9" min="1" />
              <Button type="submit" size="sm" variant="secondary" className="gap-1.5">
                <CreditCard className="h-3.5 w-3.5" /> Deduct
              </Button>
            </form>

            <Separator orientation="vertical" className="h-9" />

            {/* Role toggle */}
            <form action={handleToggleRole}>
              <Button type="submit" size="sm" variant="outline" className="gap-1.5">
                <Shield className="h-3.5 w-3.5" /> {user.role === 'ADMIN' ? 'Demote to User' : 'Promote to Admin'}
              </Button>
            </form>

            {/* Block toggle */}
            {user.role !== 'ADMIN' && (
              <form action={handleToggleBlock}>
                <Button type="submit" size="sm" variant={user.isBlocked ? 'outline' : 'destructive'} className="gap-1.5">
                  {user.isBlocked ? <><ShieldOff className="h-3.5 w-3.5" /> Unblock</> : <><Shield className="h-3.5 w-3.5" /> Block User</>}
                </Button>
              </form>
            )}

            {/* Kill sessions */}
            <form action={handleKillSessions}>
              <Button type="submit" size="sm" variant="secondary" className="gap-1.5">
                <Clock className="h-3.5 w-3.5" /> Kill Sessions ({sessionCount})
              </Button>
            </form>

            {/* Delete */}
            {user.role !== 'ADMIN' && (
              <form action={handleDeleteUser}>
                <Button type="submit" size="sm" variant="destructive" className="gap-1.5">
                  <Trash2 className="h-3.5 w-3.5" /> Delete User
                </Button>
              </form>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Bots */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Bot className="h-4 w-4" /> Bots ({user.bots.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {user.bots.length === 0 ? (
              <p className="text-sm text-muted-foreground">No bots created yet.</p>
            ) : user.bots.map(bot => (
              <div key={bot.id} className="p-3 rounded-lg border space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">{bot.name}</div>
                    <div className="text-xs text-muted-foreground">{bot.brandName}</div>
                  </div>
                  <Badge variant={statusVariant[bot.status] || 'secondary'} className="text-[10px]">{bot.status}</Badge>
                </div>
                <div className="flex flex-wrap gap-1">
                  {bot.platformConns.map(conn => (
                    <Badge key={conn.id} variant={connVariant[conn.status] || 'secondary'} className="text-[9px] px-1.5 py-0 gap-1">
                      {conn.status === 'CONNECTED' ? <CheckCircle className="h-2.5 w-2.5" /> : <XCircle className="h-2.5 w-2.5" />}
                      {PLATFORM_NAMES[conn.platform] || conn.platform}
                    </Badge>
                  ))}
                  {bot.platformConns.length === 0 && <span className="text-[10px] text-muted-foreground">No platforms</span>}
                </div>
                <div className="flex gap-4 text-[10px] text-muted-foreground">
                  <span>{bot._count.activities} actions</span>
                  <span>{bot._count.media} media</span>
                  <span>{bot._count.scheduledPosts} posts</span>
                  <span>Goal: {bot.goal}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Connected Platforms */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="h-4 w-4" /> All Platforms ({allPlatforms.size})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {allPlatforms.size === 0 ? (
              <p className="text-sm text-muted-foreground">No platforms connected.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {Array.from(allPlatforms.entries()).map(([platform, status]) => (
                  <div key={platform} className="flex items-center justify-between p-2 rounded border text-xs">
                    <span className="font-medium">{PLATFORM_NAMES[platform] || platform}</span>
                    <Badge variant={connVariant[status] || 'secondary'} className="text-[9px]">{status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Credit History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4" /> Credit History (Last 20)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {creditTxns.length === 0 ? (
            <p className="text-sm text-muted-foreground">No transactions yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 font-medium">Type</th>
                    <th className="text-left py-2 font-medium">Description</th>
                    <th className="text-right py-2 font-medium">Amount</th>
                    <th className="text-right py-2 font-medium">Balance</th>
                    <th className="text-right py-2 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {creditTxns.map(tx => (
                    <tr key={tx.id} className="border-b last:border-0">
                      <td className="py-2">
                        <Badge variant={tx.type === 'PURCHASE' ? 'default' : tx.type === 'USAGE' ? 'secondary' : 'outline'} className="text-[9px]">
                          {tx.type}
                        </Badge>
                      </td>
                      <td className="py-2 text-muted-foreground max-w-[200px] truncate">{tx.description || '-'}</td>
                      <td className={`text-right py-2 font-mono ${tx.amount > 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {tx.amount > 0 ? '+' : ''}{tx.amount}
                      </td>
                      <td className="text-right py-2 font-mono">{tx.balance}</td>
                      <td className="text-right py-2 text-muted-foreground whitespace-nowrap">
                        {new Date(tx.createdAt).toLocaleDateString()} {new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" /> Recent Activity (Last 25)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 font-medium">Bot</th>
                    <th className="text-left py-2 font-medium">Platform</th>
                    <th className="text-left py-2 font-medium">Action</th>
                    <th className="text-left py-2 font-medium">Content</th>
                    <th className="text-center py-2 font-medium">Status</th>
                    <th className="text-right py-2 font-medium">Credits</th>
                    <th className="text-right py-2 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentActivity.map(a => (
                    <tr key={a.id} className="border-b last:border-0">
                      <td className="py-2 font-medium">{a.bot.name}</td>
                      <td className="py-2">
                        <Badge variant="outline" className="text-[9px]">{PLATFORM_NAMES[a.platform] || a.platform}</Badge>
                      </td>
                      <td className="py-2">{a.action}</td>
                      <td className="py-2 text-muted-foreground max-w-[150px] truncate">{a.content || '-'}</td>
                      <td className="py-2 text-center">
                        {a.success ? <CheckCircle className="h-3.5 w-3.5 text-green-500 inline" /> : <XCircle className="h-3.5 w-3.5 text-red-500 inline" />}
                      </td>
                      <td className="text-right py-2 font-mono">{a.creditsUsed || 0}</td>
                      <td className="text-right py-2 text-muted-foreground whitespace-nowrap">
                        {new Date(a.createdAt).toLocaleDateString()} {new Date(a.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
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
