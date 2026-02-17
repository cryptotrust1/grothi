import { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { addCredits } from '@/lib/credits';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Users, Search, Shield, ShieldOff, Trash2, Eye, CreditCard } from 'lucide-react';

export const metadata: Metadata = { title: 'Admin - Users', robots: { index: false } };

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string; q?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const search = sp.q?.trim() || '';

  const users = await db.user.findMany({
    where: search ? {
      OR: [
        { email: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ],
    } : undefined,
    include: {
      creditBalance: true,
      _count: { select: { bots: true } },
      bots: {
        select: {
          platformConns: { select: { platform: true, status: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  async function handleAddBonus(formData: FormData) {
    'use server';
    await requireAdmin();
    const userId = formData.get('userId') as string;
    const credits = parseInt(formData.get('credits') as string, 10);
    if (!userId || isNaN(credits) || credits <= 0) {
      redirect('/admin/users?error=Invalid credits amount');
    }
    await addCredits(userId, credits, 'BONUS', `Admin bonus: ${credits} credits`);
    redirect('/admin/users?success=Added ' + credits + ' bonus credits');
  }

  async function handleBlockUser(formData: FormData) {
    'use server';
    await requireAdmin();
    const userId = formData.get('userId') as string;
    if (!userId) redirect('/admin/users?error=Invalid user');
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) redirect('/admin/users?error=User not found');
    if (user.role === 'ADMIN') redirect('/admin/users?error=Cannot block admin users');
    await db.user.update({
      where: { id: userId },
      data: {
        isBlocked: !user.isBlocked,
        blockedAt: user.isBlocked ? null : new Date(),
        blockedReason: user.isBlocked ? null : 'Blocked by admin',
      },
    });
    if (!user.isBlocked) {
      await db.session.deleteMany({ where: { userId } });
    }
    redirect('/admin/users?success=' + (user.isBlocked ? 'User unblocked' : 'User blocked'));
  }

  async function handleDeleteUser(formData: FormData) {
    'use server';
    await requireAdmin();
    const userId = formData.get('userId') as string;
    if (!userId) redirect('/admin/users?error=Invalid user');
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) redirect('/admin/users?error=User not found');
    if (user.role === 'ADMIN') redirect('/admin/users?error=Cannot delete admin users');
    await db.user.delete({ where: { id: userId } });
    redirect('/admin/users?success=User deleted: ' + user.email);
  }

  function getConnectedPlatforms(user: typeof users[number]) {
    const platforms = new Set<string>();
    for (const bot of user.bots) {
      for (const conn of bot.platformConns) {
        if (conn.status === 'CONNECTED') platforms.add(conn.platform);
      }
    }
    return platforms;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Users ({users.length})</h1>
        </div>
        <form action="/admin/users" method="GET" className="flex gap-2">
          <Input name="q" defaultValue={search} placeholder="Search email or name..." className="w-60 h-9" />
          <Button type="submit" size="sm" variant="outline" className="h-9 gap-1.5">
            <Search className="h-3.5 w-3.5" /> Search
          </Button>
        </form>
      </div>

      {sp.success && (
        <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-800">{sp.success}</div>
      )}
      {sp.error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800">{sp.error}</div>
      )}

      <Card>
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="text-left py-2.5 font-medium">User</th>
                  <th className="text-left py-2.5 font-medium">Status</th>
                  <th className="text-right py-2.5 font-medium">Credits</th>
                  <th className="text-right py-2.5 font-medium">Bots</th>
                  <th className="text-left py-2.5 font-medium">Platforms</th>
                  <th className="text-right py-2.5 font-medium">Joined</th>
                  <th className="text-right py-2.5 font-medium min-w-[280px]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const platforms = getConnectedPlatforms(u);
                  return (
                    <tr key={u.id} className={`border-b last:border-0 ${u.isBlocked ? 'opacity-50 bg-red-50/50' : ''}`}>
                      <td className="py-3">
                        <div>
                          <Link href={`/admin/users/${u.id}`} className="font-medium hover:underline">{u.name || '-'}</Link>
                          <div className="text-xs text-muted-foreground">{u.email}</div>
                          {!u.emailVerified && <span className="text-[10px] text-orange-500">unverified</span>}
                        </div>
                      </td>
                      <td className="py-3">
                        <div className="flex flex-col gap-1">
                          <Badge variant={u.role === 'ADMIN' ? 'default' : 'secondary'} className="w-fit text-[10px]">{u.role}</Badge>
                          {u.isBlocked && <Badge variant="destructive" className="w-fit text-[10px]">BLOCKED</Badge>}
                          {u.twoFactorEnabled && <Badge variant="outline" className="w-fit text-[10px]">2FA</Badge>}
                        </div>
                      </td>
                      <td className="text-right py-3 font-mono text-xs">{(u.creditBalance?.balance ?? 0).toLocaleString()}</td>
                      <td className="text-right py-3">{u._count.bots}</td>
                      <td className="py-3">
                        {platforms.size > 0 ? (
                          <div className="flex flex-wrap gap-0.5">
                            {Array.from(platforms).slice(0, 5).map(p => (
                              <Badge key={p} variant="outline" className="text-[9px] px-1 py-0">{p}</Badge>
                            ))}
                            {platforms.size > 5 && <span className="text-[9px] text-muted-foreground">+{platforms.size - 5}</span>}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="text-right py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td className="text-right py-3">
                        <div className="flex items-center gap-1 justify-end flex-wrap">
                          <Link href={`/admin/users/${u.id}`}>
                            <Button size="sm" variant="ghost" className="h-7 text-[10px] gap-1 px-2">
                              <Eye className="h-3 w-3" /> View
                            </Button>
                          </Link>
                          <form action={handleAddBonus} className="flex items-center gap-0.5">
                            <input type="hidden" name="userId" value={u.id} />
                            <Input name="credits" type="number" placeholder="100" className="w-16 h-7 text-[10px]" min="1" />
                            <Button type="submit" size="sm" variant="outline" className="h-7 text-[10px] gap-1 px-2">
                              <CreditCard className="h-3 w-3" /> +
                            </Button>
                          </form>
                          {u.role !== 'ADMIN' && (
                            <form action={handleBlockUser}>
                              <input type="hidden" name="userId" value={u.id} />
                              <Button type="submit" size="sm" variant={u.isBlocked ? 'outline' : 'secondary'} className="h-7 text-[10px] gap-1 px-2">
                                {u.isBlocked ? <><ShieldOff className="h-3 w-3" /> Unblock</> : <><Shield className="h-3 w-3" /> Block</>}
                              </Button>
                            </form>
                          )}
                          {u.role !== 'ADMIN' && (
                            <form action={handleDeleteUser}>
                              <input type="hidden" name="userId" value={u.id} />
                              <Button type="submit" size="sm" variant="destructive" className="h-7 text-[10px] gap-1 px-2">
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </form>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
