import { Metadata } from 'next';
import Link from 'next/link';
import { db } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PLATFORM_NAMES } from '@/lib/constants';
import {
  Users, Bot, DollarSign, Activity, CreditCard, Globe,
  Shield, TrendingUp, UserPlus, Clock,
} from 'lucide-react';

export const metadata: Metadata = { title: 'Admin Dashboard', robots: { index: false } };

export default async function AdminDashboard() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);

  const [
    userCount,
    blockedCount,
    botCount,
    activeBotCount,
    totalRevenue,
    totalActivity,
    creditsInCirculation,
    platformConns,
    recentUsers,
    recentActivity,
    newUsersThisWeek,
    newUsersThisMonth,
  ] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { isBlocked: true } }),
    db.bot.count(),
    db.bot.count({ where: { status: 'ACTIVE' } }),
    db.creditTransaction.aggregate({ where: { type: 'PURCHASE' }, _sum: { amount: true } }),
    db.botActivity.count(),
    db.creditBalance.aggregate({ _sum: { balance: true } }),
    db.platformConnection.groupBy({
      by: ['platform'],
      where: { status: 'CONNECTED' },
      _count: true,
      orderBy: { _count: { platform: 'desc' } },
    }),
    db.user.findMany({
      include: { creditBalance: true, _count: { select: { bots: true } } },
      orderBy: { createdAt: 'desc' },
      take: 8,
    }),
    db.botActivity.findMany({
      include: { bot: { select: { name: true, user: { select: { email: true } } } } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    db.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    db.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
  ]);

  const revenue = totalRevenue._sum.amount || 0;
  const totalCredits = creditsInCirculation._sum.balance || 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>

      {/* KPI Cards - Row 1 */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userCount}</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600">+{newUsersThisWeek}</span> this week, <span className="text-green-600">+{newUsersThisMonth}</span> this month
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Bots</CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeBotCount} <span className="text-base font-normal text-muted-foreground">/ {botCount}</span></div>
            <p className="text-xs text-muted-foreground">{botCount > 0 ? Math.round(activeBotCount / botCount * 100) : 0}% active</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${(revenue / 100).toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">{revenue.toLocaleString()} credits sold</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Bot Actions</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalActivity.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      {/* KPI Cards - Row 2 */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Credits in Circulation</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCredits.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Connected Platforms</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{platformConns.reduce((s, p) => s + p._count, 0)}</div>
            <p className="text-xs text-muted-foreground">{platformConns.length} unique platforms</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Blocked Users</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{blockedCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Growth Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{newUsersThisMonth > 0 ? `+${newUsersThisMonth}` : '0'}</div>
            <p className="text-xs text-muted-foreground">new users (30 days)</p>
          </CardContent>
        </Card>
      </div>

      {/* Platform Breakdown */}
      {platformConns.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Platform Connections</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {platformConns.map(p => (
                <Badge key={p.platform} variant="outline" className="gap-1.5 py-1 px-2.5">
                  {PLATFORM_NAMES[p.platform] || p.platform}
                  <span className="font-bold text-primary">{p._count}</span>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Users */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <UserPlus className="h-4 w-4" /> Recent Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentUsers.map(u => (
                <Link key={u.id} href={`/admin/users/${u.id}`} className="flex items-center justify-between p-2 rounded hover:bg-muted/50 transition-colors">
                  <div>
                    <div className="text-sm font-medium">{u.name || u.email}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-mono">{(u.creditBalance?.balance ?? 0).toLocaleString()} cr</div>
                    <div className="text-[10px] text-muted-foreground">{u._count.bots} bots</div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" /> Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentActivity.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity yet.</p>
              ) : recentActivity.map(a => (
                <div key={a.id} className="flex items-center justify-between p-2 rounded border text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant={a.success ? 'outline' : 'destructive'} className="text-[9px] shrink-0">{a.action}</Badge>
                    <span className="text-muted-foreground truncate">{a.bot.name} — {a.bot.user.email}</span>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <Badge variant="outline" className="text-[9px]">{PLATFORM_NAMES[a.platform] || a.platform}</Badge>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {new Date(a.createdAt).toLocaleDateString()} {new Date(a.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
