import { Metadata } from 'next';
import Link from 'next/link';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getCreditBreakdown } from '@/lib/credits';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { HelpTip } from '@/components/ui/help-tip';
import {
  CreditCard, Plus, ArrowUpRight, ArrowDownRight,
  Crown, Settings, RefreshCcw,
} from 'lucide-react';
import { CREDIT_COSTS } from '@/lib/billing';

export const metadata: Metadata = { title: 'Credits & Billing', robots: { index: false } };

export default async function CreditsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const user = await requireAuth();
  const sp = await searchParams;

  // Query existing tables (always safe)
  const [balance, breakdown, transactions] = await Promise.all([
    db.creditBalance.findUnique({ where: { userId: user.id } }),
    getCreditBreakdown(user.id),
    db.creditTransaction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  ]);

  // Subscription table may not exist if billing migration hasn't been applied yet
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let subscription: any = null;
  try {
    subscription = await db.subscription.findUnique({
      where: { userId: user.id },
      include: { plan: true },
    });
  } catch (error) {
    console.error('[credits] Subscription query failed (table may not exist):', error instanceof Error ? error.message : error);
  }

  const credits = balance?.balance ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Credits & Billing</h1>
        <div className="flex items-center gap-2">
          {user.stripeCustomerId && (
            <form action="/api/billing/portal" method="POST">
              <Button variant="outline" size="sm" type="submit">
                <Settings className="mr-2 h-4 w-4" /> Billing Portal
              </Button>
            </form>
          )}
          <Link href="/dashboard/credits/buy">
            <Button size="sm"><Plus className="mr-2 h-4 w-4" /> Top Up</Button>
          </Link>
        </div>
      </div>

      {sp.success && (
        <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-800">{sp.success}</div>
      )}
      {sp.error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">{sp.error}</div>
      )}

      {/* Subscription Card */}
      {subscription && subscription.status === 'ACTIVE' ? (
        <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100">
                  <Crown className="h-6 w-6 text-indigo-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-lg">{subscription.plan.name} Plan</p>
                    <Badge variant="outline" className="text-indigo-600 border-indigo-300">Active</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    ${(subscription.plan.priceUsd / 100).toFixed(0)}/month
                    {subscription.plan.credits > 0 && ` — ${subscription.plan.credits.toLocaleString()} credits/month`}
                  </p>
                  {subscription.cancelAtPeriodEnd && (
                    <p className="text-xs text-amber-600 mt-1">
                      Cancels on {subscription.currentPeriodEnd.toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
              <div className="text-right text-sm text-muted-foreground">
                <p>Period ends {subscription.currentPeriodEnd.toLocaleDateString()}</p>
                {subscription.plan.allowRollover && (
                  <p className="text-xs flex items-center justify-end gap-1 mt-0.5">
                    <RefreshCcw className="h-3 w-3" />
                    Rollover up to {subscription.plan.maxRolloverCredits.toLocaleString()}
                  </p>
                )}
              </div>
            </div>
            {subscription.creditsAllocatedThisPeriod > 0 && (
              <div className="mt-4 pt-3 border-t border-indigo-200">
                <div className="flex justify-between text-sm">
                  <span>Credits used this period</span>
                  <span className="font-medium">
                    {subscription.creditsUsedThisPeriod} / {subscription.creditsAllocatedThisPeriod}
                  </span>
                </div>
                <div className="mt-1.5 h-2 rounded-full bg-indigo-100 overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, (subscription.creditsUsedThisPeriod / subscription.creditsAllocatedThisPeriod) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-muted/30">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground mb-3">No active subscription</p>
            <Link href="/pricing">
              <Button variant="outline">
                <Crown className="mr-2 h-4 w-4" /> View Plans
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Balance Card */}
      <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <CreditCard className="h-7 w-7 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                Total Balance
                <HelpTip text="Credits are consumed in FIFO order: top-up credits first, then rollover, then subscription credits." />
              </p>
              <p className="text-3xl font-bold">{credits.toLocaleString()} credits</p>
            </div>
          </div>

          {/* Credit Breakdown */}
          {(breakdown.topup > 0 || breakdown.rollover > 0 || breakdown.subscription > 0 || breakdown.bonus > 0) && (
            <div className="mt-4 pt-3 border-t grid grid-cols-2 sm:grid-cols-4 gap-3">
              {breakdown.topup > 0 && (
                <div className="text-center p-2 rounded bg-green-50">
                  <p className="text-xs text-muted-foreground">Top-up</p>
                  <p className="font-semibold text-green-700">{breakdown.topup}</p>
                </div>
              )}
              {breakdown.rollover > 0 && (
                <div className="text-center p-2 rounded bg-blue-50">
                  <p className="text-xs text-muted-foreground">Rollover</p>
                  <p className="font-semibold text-blue-700">{breakdown.rollover}</p>
                </div>
              )}
              {breakdown.subscription > 0 && (
                <div className="text-center p-2 rounded bg-purple-50">
                  <p className="text-xs text-muted-foreground">Subscription</p>
                  <p className="font-semibold text-purple-700">{breakdown.subscription}</p>
                </div>
              )}
              {breakdown.bonus > 0 && (
                <div className="text-center p-2 rounded bg-amber-50">
                  <p className="text-xs text-muted-foreground">Bonus</p>
                  <p className="font-semibold text-amber-700">{breakdown.bonus}</p>
                </div>
              )}
            </div>
          )}

          {credits < 50 && (
            <div className="mt-4 rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
              Low balance! Your bots may pause if credits run out.{' '}
              <Link href="/dashboard/credits/buy" className="font-medium underline">Top up now</Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Credit Costs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Credit Costs</CardTitle>
          <CardDescription>How many credits each action uses</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { action: 'AI Text Post', cost: CREDIT_COSTS.GENERATE_CONTENT, desc: 'AI creates a new post' },
              { action: 'AI Image', cost: CREDIT_COSTS.GENERATE_IMAGE, desc: 'AI image from prompt' },
              { action: 'AI Video (Short)', cost: CREDIT_COSTS.GENERATE_VIDEO, desc: '5-15 second video' },
              { action: 'Publish Post', cost: CREDIT_COSTS.POST, desc: 'Post to 1 platform' },
              { action: 'AI Reply', cost: CREDIT_COSTS.REPLY, desc: 'AI-generated reply' },
              { action: 'Like', cost: CREDIT_COSTS.FAVOURITE, desc: 'Free engagement' },
              { action: 'AI Chat', cost: CREDIT_COSTS.AI_CHAT_MESSAGE, desc: 'Chat with AI assistant' },
              { action: 'Send Email', cost: CREDIT_COSTS.SEND_EMAIL, desc: 'Send 1 email' },
              { action: 'Boost / Repost', cost: CREDIT_COSTS.BOOST, desc: 'Amplify content' },
            ].map((item) => (
              <div key={item.action} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">{item.action}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
                <span className="text-sm font-bold text-primary">
                  {item.cost === 0 ? 'Free' : item.cost}
                </span>
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
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-muted-foreground">
                          {new Date(txn.createdAt).toLocaleDateString()} {new Date(txn.createdAt).toLocaleTimeString()}
                        </p>
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                          {txn.type}
                        </Badge>
                      </div>
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
