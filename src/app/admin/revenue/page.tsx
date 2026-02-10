import { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign, TrendingUp, CreditCard, ShoppingCart } from 'lucide-react';

export const metadata: Metadata = { title: 'Admin - Revenue', robots: { index: false } };

export default async function AdminRevenuePage() {
  await requireAdmin();

  const [purchases, totalRevenue, totalUsage, recentTxns] = await Promise.all([
    db.creditTransaction.count({ where: { type: 'PURCHASE' } }),
    db.creditTransaction.aggregate({
      where: { type: 'PURCHASE' },
      _sum: { amount: true },
    }),
    db.creditTransaction.aggregate({
      where: { type: 'USAGE' },
      _sum: { amount: true },
    }),
    db.creditTransaction.findMany({
      where: { type: 'PURCHASE' },
      include: { user: { select: { email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
  ]);

  const revenue = totalRevenue._sum.amount || 0;
  const usage = Math.abs(totalUsage._sum.amount || 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Revenue</h1>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${(revenue / 100).toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Credits Sold</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{revenue.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Credits Used</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{usage.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Purchases</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{purchases}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Purchases</CardTitle>
        </CardHeader>
        <CardContent>
          {recentTxns.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No purchases yet.</p>
          ) : (
            <div className="space-y-3">
              {recentTxns.map((txn) => (
                <div key={txn.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">{txn.user.email}</p>
                    <p className="text-xs text-muted-foreground">{txn.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-green-600">+{txn.amount} credits</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(txn.createdAt).toLocaleDateString()}
                    </p>
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
