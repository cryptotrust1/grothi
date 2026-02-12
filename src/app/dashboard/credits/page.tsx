import { Metadata } from 'next';
import Link from 'next/link';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { HelpTip } from '@/components/ui/help-tip';
import { CreditCard, Plus, ArrowUpRight, ArrowDownRight } from 'lucide-react';

export const metadata: Metadata = { title: 'Credits', robots: { index: false } };

export default async function CreditsPage() {
  const user = await requireAuth();

  const [balance, transactions] = await Promise.all([
    db.creditBalance.findUnique({ where: { userId: user.id } }),
    db.creditTransaction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  ]);

  const credits = balance?.balance ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Credits</h1>
        <Link href="/dashboard/credits/buy">
          <Button><Plus className="mr-2 h-4 w-4" /> Buy Credits</Button>
        </Link>
      </div>

      {/* Balance Card */}
      <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <CreditCard className="h-7 w-7 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                Current Balance
                <HelpTip text="Credits are used by your bots to perform actions like posting, replying, and engaging with content. You receive 100 free credits on signup. 100 credits = $1.00." />
              </p>
              <p className="text-3xl font-bold">{credits.toLocaleString()} credits</p>
              <p className="text-sm text-muted-foreground">${(credits / 100).toFixed(2)} value</p>
            </div>
          </div>
          {credits < 50 && (
            <div className="mt-4 rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
              Low balance! Your bots may pause if credits run out.{' '}
              <Link href="/dashboard/credits/buy" className="font-medium underline">Buy more</Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Credit Costs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Credit Costs</CardTitle>
          <CardDescription>How many credits each bot action uses</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { action: 'Generate Content', cost: 5, desc: 'AI creates a new post' },
              { action: 'Publish Post', cost: 2, desc: 'Post to a platform' },
              { action: 'Reply to Comment', cost: 3, desc: 'AI-generated reply' },
              { action: 'Like / Favourite', cost: 1, desc: 'Like or favourite a post' },
              { action: 'Boost / Repost', cost: 1, desc: 'Share or repost content' },
              { action: 'Scan Feeds', cost: 0, desc: 'Check RSS and trends' },
            ].map((item) => (
              <div key={item.action} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">{item.action}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
                <span className="text-sm font-bold text-primary">{item.cost}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No transactions yet.</p>
          ) : (
            <div className="space-y-2">
              {transactions.map((txn) => (
                <div key={txn.id} className="flex items-center justify-between py-3 border-b last:border-0">
                  <div className="flex items-center gap-3">
                    {txn.amount > 0 ? (
                      <ArrowUpRight className="h-5 w-5 text-green-500" />
                    ) : (
                      <ArrowDownRight className="h-5 w-5 text-red-500" />
                    )}
                    <div>
                      <p className="text-sm font-medium">{txn.description || txn.type}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(txn.createdAt).toLocaleDateString()} {new Date(txn.createdAt).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-medium ${txn.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {txn.amount > 0 ? '+' : ''}{txn.amount}
                    </p>
                    <p className="text-xs text-muted-foreground">bal: {txn.balance}</p>
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
