import { Metadata } from 'next';
import { db } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Bot, DollarSign, Activity } from 'lucide-react';

export const metadata: Metadata = { title: 'Admin Dashboard', robots: { index: false } };

export default async function AdminDashboard() {
  const [userCount, botCount, totalRevenue, totalActivity] = await Promise.all([
    db.user.count(),
    db.bot.count(),
    db.creditTransaction.aggregate({
      where: { type: 'PURCHASE' },
      _sum: { amount: true },
    }),
    db.botActivity.count(),
  ]);

  const revenue = totalRevenue._sum.amount || 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Bots</CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{botCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
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
    </div>
  );
}
