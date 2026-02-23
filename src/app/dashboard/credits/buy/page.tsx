import { Metadata } from 'next';
import { requireAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Star, ArrowRight, Package, Zap } from 'lucide-react';
import { TOPUP_PACKS } from '@/lib/billing';

export const metadata: Metadata = { title: 'Buy Credits', robots: { index: false } };

export default async function BuyCreditsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAuth();
  const sp = await searchParams;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Top Up Credits</h1>
        <p className="text-muted-foreground">
          Purchase additional credits. Top-up credits never expire and are consumed first.
        </p>
      </div>

      {sp.error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
          {sp.error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TOPUP_PACKS.map((pack) => (
          <Card key={pack.slug} className={pack.popular ? 'border-primary shadow-lg relative' : ''}>
            {pack.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge className="bg-primary"><Star className="h-3 w-3 mr-1" /> Best Value</Badge>
              </div>
            )}
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-lg flex items-center justify-center gap-2">
                <Package className="h-4 w-4" />
                {pack.name}
              </CardTitle>
              <div className="mt-2">
                <span className="text-3xl font-bold">${(pack.priceUsd / 100).toFixed(2)}</span>
              </div>
              <p className="text-sm text-primary font-medium mt-1">
                <Zap className="h-3 w-3 inline mr-0.5" />
                {pack.credits} credits
              </p>
              <p className="text-xs text-muted-foreground">
                ${(pack.priceUsd / pack.credits / 100).toFixed(3)} per credit
              </p>
            </CardHeader>
            <CardContent>
              <form action="/api/billing/topup" method="POST">
                <input type="hidden" name="packSlug" value={pack.slug} />
                <Button
                  type="submit"
                  variant={pack.popular ? 'default' : 'outline'}
                  className="w-full"
                >
                  Buy Now <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </form>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="text-center space-y-2">
        <p className="text-sm text-muted-foreground">
          Payments processed securely by Stripe. Credits are added instantly after payment.
        </p>
        <p className="text-sm text-muted-foreground">
          Top-up credits never expire and are consumed first (before subscription credits).
        </p>
      </div>
    </div>
  );
}
