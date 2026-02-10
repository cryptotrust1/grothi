import { Metadata } from 'next';
import Link from 'next/link';
import { requireAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Star, ArrowRight } from 'lucide-react';

export const metadata: Metadata = { title: 'Buy Credits', robots: { index: false } };

const plans = [
  { name: 'Starter', credits: 1000, bonus: 0, price: 10, priceId: 'price_starter' },
  { name: 'Growth', credits: 5000, bonus: 500, price: 45, priceId: 'price_growth', popular: true },
  { name: 'Pro', credits: 15000, bonus: 2000, price: 120, priceId: 'price_pro' },
  { name: 'Enterprise', credits: 50000, bonus: 10000, price: 350, priceId: 'price_enterprise' },
];

export default async function BuyCreditsPage() {
  const user = await requireAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Buy Credits</h1>
        <p className="text-muted-foreground">Choose a credit package. 1 credit = $0.01.</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map((plan) => (
          <Card key={plan.name} className={plan.popular ? 'border-primary shadow-lg relative' : ''}>
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge className="bg-primary"><Star className="h-3 w-3 mr-1" /> Best Value</Badge>
              </div>
            )}
            <CardHeader className="text-center">
              <CardTitle className="text-lg">{plan.name}</CardTitle>
              <div className="mt-3">
                <span className="text-4xl font-bold">${plan.price}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {plan.credits.toLocaleString()} credits
                {plan.bonus > 0 && (
                  <span className="text-secondary font-medium"> + {plan.bonus.toLocaleString()} free</span>
                )}
              </p>
            </CardHeader>
            <CardContent>
              <form action={`/api/stripe/checkout`} method="POST">
                <input type="hidden" name="priceId" value={plan.priceId} />
                <input type="hidden" name="credits" value={plan.credits + plan.bonus} />
                <Button
                  type="submit"
                  variant={plan.popular ? 'default' : 'outline'}
                  className="w-full"
                >
                  Buy Now <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </form>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="text-center text-sm text-muted-foreground">
        <p>Payments processed securely by Stripe. Credits are added instantly after payment.</p>
      </div>
    </div>
  );
}
