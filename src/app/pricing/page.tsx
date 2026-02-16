import { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Star, Bot, ArrowRight, Zap, HelpCircle } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Pricing - Pay Per Use, No Monthly Fees',
  description: 'Grothi credit-based pricing. Pay only for what your AI marketing bot uses. Starting at $10 for 1,000 credits. No monthly subscriptions, no hidden fees. 100 free credits on signup.',
  alternates: { canonical: '/pricing' },
};

const plans = [
  {
    name: 'Starter',
    credits: 1000,
    price: 10,
    bonus: 0,
    perCredit: '$0.010',
    desc: 'Try the platform with a small budget',
    features: ['~200 AI-generated posts', '~333 image generations', 'All 17 platforms', 'Full analytics'],
  },
  {
    name: 'Growth',
    credits: 5000,
    price: 45,
    bonus: 500,
    perCredit: '$0.0082',
    popular: true,
    desc: 'For businesses posting daily across platforms',
    features: ['~1,100 AI-generated posts', '~1,833 image generations', '500 bonus credits', 'Priority support'],
  },
  {
    name: 'Pro',
    credits: 15000,
    price: 120,
    bonus: 2000,
    perCredit: '$0.0071',
    desc: 'For agencies and multi-bot operations',
    features: ['~3,400 AI-generated posts', '~5,666 image generations', '2,000 bonus credits', 'Unlimited bots'],
  },
  {
    name: 'Enterprise',
    credits: 50000,
    price: 350,
    bonus: 10000,
    perCredit: '$0.0058',
    desc: 'High-volume social media operations',
    features: ['~12,000 AI-generated posts', '~20,000 image generations', '10,000 bonus credits', 'Bulk discount'],
  },
];

const actionCosts = [
  { action: 'AI Content Generation', credits: 5, desc: 'Full post written by AI in your brand voice' },
  { action: 'AI Image Generation', credits: 3, desc: 'Platform-optimized image from text prompt' },
  { action: 'AI Video Generation', credits: 8, desc: 'Short-form marketing video (5-6 seconds)' },
  { action: 'Post to Platform', credits: 2, desc: 'Publish to any connected social network' },
  { action: 'Reply to Mention', credits: 3, desc: 'AI-crafted response to comments and mentions' },
  { action: 'Like / Favourite', credits: 1, desc: 'Engage with relevant posts in your niche' },
  { action: 'Boost / Repost', credits: 1, desc: 'Amplify content from your community' },
  { action: 'RSS Feed Scan', credits: 2, desc: 'Scan RSS feeds for fresh content ideas' },
  { action: 'Metrics Collection', credits: 1, desc: 'Gather engagement data for self-learning' },
];

export default function PricingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center space-x-2">
            <Bot className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-indigo-400 bg-clip-text text-transparent">Grothi</span>
          </Link>
          <nav className="hidden md:flex items-center space-x-6">
            <Link href="/features" className="text-sm text-muted-foreground hover:text-foreground">Features</Link>
            <Link href="/how-it-works" className="text-sm text-muted-foreground hover:text-foreground">How It Works</Link>
            <Link href="/use-cases" className="text-sm text-muted-foreground hover:text-foreground">Use Cases</Link>
            <Link href="/pricing" className="text-sm font-medium">Pricing</Link>
            <Link href="/faq" className="text-sm text-muted-foreground hover:text-foreground">FAQ</Link>
          </nav>
          <div className="flex items-center space-x-3">
            <Link href="/auth/signin"><Button variant="ghost" size="sm">Sign In</Button></Link>
            <Link href="/auth/signup"><Button size="sm" className="bg-secondary hover:bg-secondary/90 text-white">Start Free Trial <ArrowRight className="ml-1.5 h-4 w-4" /></Button></Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="py-16 md:py-20 text-center px-4">
          <h1 className="text-4xl md:text-5xl font-bold">Pay For What You Use</h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Credit-based pricing. Buy once, use anytime. No monthly subscriptions,
            no contracts, no surprise charges.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-4">
            <Badge variant="secondary" className="text-sm px-3 py-1">
              <Zap className="h-3 w-3 mr-1" /> 100 free credits on signup
            </Badge>
            <Badge variant="outline" className="text-sm px-3 py-1">
              1 credit = $0.01
            </Badge>
          </div>
        </section>

        {/* Plans */}
        <section className="pb-16 px-4">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 max-w-6xl mx-auto">
            {plans.map((plan) => (
              <Card key={plan.name} className={`flex flex-col ${plan.popular ? 'border-primary shadow-lg relative' : ''}`}>
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
                      <span className="text-primary font-medium"> + {plan.bonus.toLocaleString()} free</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">{plan.perCredit} per credit</p>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <p className="text-xs text-muted-foreground text-center mb-4">{plan.desc}</p>
                  <ul className="space-y-2 mb-6 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Link href="/auth/signup">
                    <Button variant={plan.popular ? 'default' : 'outline'} className={`w-full ${plan.popular ? 'bg-secondary hover:bg-secondary/90 text-white' : ''}`}>
                      Start Free Trial <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* What Credits Buy */}
        <section className="py-16 bg-muted/30 px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-3">What Your Credits Buy</h2>
            <p className="text-center text-muted-foreground mb-8">
              Every action your bot takes costs a clear, fixed number of credits.
              No per-seat fees, no per-platform fees, no hidden charges.
            </p>
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-0">
                  {actionCosts.map((item) => (
                    <div key={item.action} className="flex items-center justify-between py-3 border-b last:border-0 gap-4">
                      <div className="min-w-0">
                        <span className="text-sm font-medium">{item.action}</span>
                        <p className="text-xs text-muted-foreground">{item.desc}</p>
                      </div>
                      <Badge variant="outline" className="shrink-0">
                        {item.credits} credit{item.credits !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Example calculation */}
        <section className="py-16 px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold text-center mb-3">How Far Do Credits Go?</h2>
            <p className="text-center text-muted-foreground mb-8">
              A real-world example: one bot posting to 5 platforms daily.
            </p>
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between py-2 border-b">
                    <span>1 AI-generated post per day</span>
                    <span className="text-muted-foreground">5 credits/day</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span>Posted to 5 platforms</span>
                    <span className="text-muted-foreground">10 credits/day</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span>1 AI image per day</span>
                    <span className="text-muted-foreground">3 credits/day</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span>5 engagement actions (likes, replies)</span>
                    <span className="text-muted-foreground">5-15 credits/day</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span>Metrics collection</span>
                    <span className="text-muted-foreground">1 credit/day</span>
                  </div>
                  <div className="flex justify-between py-2 font-semibold border-t-2">
                    <span>Daily total</span>
                    <span>~24-34 credits/day</span>
                  </div>
                  <div className="flex justify-between py-2 font-semibold text-primary">
                    <span>Monthly total (30 days)</span>
                    <span>~720-1,020 credits/month</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-4 text-center">
                  That&apos;s about $7-10/month for a fully automated social media presence across 5 platforms.
                  The Starter plan ($10) covers a full month.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Why pay-per-use */}
        <section className="py-16 bg-muted/30 px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-center mb-8">Why Pay-Per-Use Instead of Monthly?</h2>
            <div className="grid gap-6 md:grid-cols-3">
              <div className="text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <HelpCircle className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">No wasted spend</h3>
                <p className="text-sm text-muted-foreground">
                  Monthly plans charge you whether you post 1 time or 100.
                  Credits only get used when your bot actually does something.
                </p>
              </div>
              <div className="text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <Zap className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">Scale up or down instantly</h3>
                <p className="text-sm text-muted-foreground">
                  Running a campaign? Buy more credits. Quiet month? Use fewer.
                  No plan changes, no downgrades, no cancellation.
                </p>
              </div>
              <div className="text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <Check className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">Credits never expire</h3>
                <p className="text-sm text-muted-foreground">
                  Bought credits stay in your account until you use them.
                  No &quot;use it or lose it&quot; monthly reset.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 text-center px-4">
          <h2 className="text-2xl md:text-3xl font-bold">Start with 100 free credits</h2>
          <p className="mt-4 text-muted-foreground max-w-md mx-auto">
            That&apos;s enough for about 15-20 AI-generated posts. No credit card needed.
            See what your bot can do before spending anything.
          </p>
          <Link href="/auth/signup">
            <Button size="lg" className="mt-6 bg-secondary hover:bg-secondary/90 text-white">
              Create Free Account <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </section>
      </main>

      <footer className="border-t py-16 bg-background">
        <div className="container mx-auto px-4">
          <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-5">
            <div className="md:col-span-1">
              <div className="flex items-center space-x-2 mb-4">
                <Bot className="h-7 w-7 text-primary" />
                <span className="text-lg font-bold bg-gradient-to-r from-primary to-indigo-400 bg-clip-text text-transparent">Grothi</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                AI marketing bot that generates content, posts to 17 platforms, and learns from results.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li><Link href="/features" className="hover:text-foreground transition-colors">Features</Link></li>
                <li><Link href="/pricing" className="hover:text-foreground transition-colors">Pricing</Link></li>
                <li><Link href="/how-it-works" className="hover:text-foreground transition-colors">How It Works</Link></li>
                <li><Link href="/use-cases" className="hover:text-foreground transition-colors">Use Cases</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Resources</h4>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li><Link href="/faq" className="hover:text-foreground transition-colors">FAQ</Link></li>
                <li><Link href="/contact" className="hover:text-foreground transition-colors">Help Center</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li><Link href="/about" className="hover:text-foreground transition-colors">About Us</Link></li>
                <li><Link href="/contact" className="hover:text-foreground transition-colors">Contact</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li><Link href="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link></li>
                <li><Link href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-12 border-t pt-8 text-center text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} Grothi. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
