import { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Star, Bot, ArrowRight } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Simple, credit-based pricing. Pay only for what your AI marketing bot uses. No monthly fees.',
};

const plans = [
  { name: 'Starter', credits: 1000, price: 10, bonus: 0, perCredit: '$0.010' },
  { name: 'Growth', credits: 5000, price: 45, bonus: 500, perCredit: '$0.0082', popular: true },
  { name: 'Pro', credits: 15000, price: 120, bonus: 2000, perCredit: '$0.0071' },
  { name: 'Enterprise', credits: 50000, price: 350, bonus: 10000, perCredit: '$0.0058' },
];

const actionCosts = [
  { action: 'AI Content Generation (Claude)', credits: 5 },
  { action: 'Post to Platform', credits: 2 },
  { action: 'Reply to Mention', credits: 3 },
  { action: 'Like/Favourite', credits: 1 },
  { action: 'Boost/Repost', credits: 1 },
  { action: 'RSS Feed Scan', credits: 2 },
  { action: 'Metrics Collection', credits: 1 },
  { action: 'Daily Report', credits: 3 },
];

export default function PricingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center space-x-2">
            <Bot className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold">Grothi</span>
          </Link>
          <nav className="hidden md:flex items-center space-x-6">
            <Link href="/features" className="text-sm text-muted-foreground hover:text-foreground">Features</Link>
            <Link href="/pricing" className="text-sm font-medium">Pricing</Link>
            <Link href="/about" className="text-sm text-muted-foreground hover:text-foreground">About</Link>
            <Link href="/faq" className="text-sm text-muted-foreground hover:text-foreground">FAQ</Link>
          </nav>
          <div className="flex items-center space-x-3">
            <Link href="/auth/signin"><Button variant="ghost" size="sm">Sign In</Button></Link>
            <Link href="/auth/signup"><Button size="sm">Get Started</Button></Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="py-16 text-center">
          <h1 className="text-4xl font-bold">Simple, Credit-Based Pricing</h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            1 credit = $0.01. Buy what you need, use it when you want. No subscriptions, no hidden fees.
          </p>
          <Badge variant="secondary" className="mt-4">100 free credits on signup</Badge>
        </section>

        {/* Plans */}
        <section className="pb-16 px-4">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 max-w-6xl mx-auto">
            {plans.map((plan) => (
              <Card key={plan.name} className={plan.popular ? 'border-primary shadow-lg relative' : ''}>
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary"><Star className="h-3 w-3 mr-1" /> Most Popular</Badge>
                  </div>
                )}
                <CardHeader className="text-center pb-2">
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
                  <p className="text-xs text-muted-foreground">{plan.perCredit} per credit</p>
                </CardHeader>
                <CardContent className="text-center">
                  <Link href="/auth/signup">
                    <Button variant={plan.popular ? 'default' : 'outline'} className="w-full">
                      Get Started <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Action Costs */}
        <section className="py-16 bg-muted/30 px-4">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-center mb-8">What Credits Buy</h2>
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {actionCosts.map((item) => (
                    <div key={item.action} className="flex justify-between items-center py-2 border-b last:border-0">
                      <span className="text-sm">{item.action}</span>
                      <Badge variant="outline">{item.credits} credit{item.credits !== 1 ? 's' : ''}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 text-center px-4">
          <h2 className="text-2xl font-bold">Ready to Get Started?</h2>
          <p className="mt-4 text-muted-foreground">
            Sign up now and get 100 free credits to try out your first bot.
          </p>
          <Link href="/auth/signup">
            <Button size="lg" className="mt-6">
              Create Free Account <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </section>
      </main>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        &copy; {new Date().getFullYear()} Grothi. All rights reserved.
      </footer>
    </div>
  );
}
