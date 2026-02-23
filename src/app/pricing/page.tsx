import { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Star, Bot, ArrowRight, Zap, Plus, RefreshCcw } from 'lucide-react';
import { SUBSCRIPTION_PLANS, TOPUP_PACKS, CREDIT_COSTS } from '@/lib/billing';

export const metadata: Metadata = {
  title: 'Pricing - AI Marketing Plans',
  description: 'Grothi subscription plans starting at $15/month. AI marketing bot with content generation, 17 platforms, image & video creation. Top up credits anytime. 100 free credits on signup.',
  alternates: { canonical: '/pricing' },
};

const actionCosts = [
  { action: 'AI Text Post', credits: CREDIT_COSTS.GENERATE_CONTENT, desc: 'Full post written by AI in your brand voice' },
  { action: 'AI Image Generation', credits: CREDIT_COSTS.GENERATE_IMAGE, desc: 'Platform-optimized image from text prompt' },
  { action: 'AI Video (Short)', credits: CREDIT_COSTS.GENERATE_VIDEO, desc: 'Short-form marketing video (5-15s)' },
  { action: 'AI Video (Medium)', credits: CREDIT_COSTS.GENERATE_VIDEO_LONG, desc: 'Medium video with transitions (30-60s)' },
  { action: 'Publish to Platform', credits: CREDIT_COSTS.POST, desc: 'Post to any connected social network' },
  { action: 'AI Reply', credits: CREDIT_COSTS.REPLY, desc: 'AI-crafted response to comments' },
  { action: 'Like / Favourite', credits: CREDIT_COSTS.FAVOURITE, desc: 'Engage with posts (free)' },
  { action: 'Boost / Repost', credits: CREDIT_COSTS.BOOST, desc: 'Amplify content from your community' },
  { action: 'AI Chat Message', credits: CREDIT_COSTS.AI_CHAT_MESSAGE, desc: 'Chat with AI marketing assistant' },
  { action: 'Send Email', credits: CREDIT_COSTS.SEND_EMAIL, desc: 'Send marketing email to 1 contact' },
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
            <Link href="/auth/signup"><Button size="sm" className="bg-secondary hover:bg-secondary/90 text-white">Start Free <ArrowRight className="ml-1.5 h-4 w-4" /></Button></Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="py-16 md:py-20 text-center px-4">
          <h1 className="text-4xl md:text-5xl font-bold">Simple, Transparent Pricing</h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Choose a plan that fits your business. All plans include the full platform.
            Need more credits? Top up anytime.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-4">
            <Badge variant="secondary" className="text-sm px-3 py-1">
              <Zap className="h-3 w-3 mr-1" /> 100 free credits on signup
            </Badge>
            <Badge variant="outline" className="text-sm px-3 py-1">
              Cancel anytime
            </Badge>
          </div>
        </section>

        {/* Subscription Plans */}
        <section className="pb-16 px-4">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 max-w-6xl mx-auto">
            {SUBSCRIPTION_PLANS.map((plan) => (
              <Card key={plan.slug} className={`flex flex-col ${plan.popular ? 'border-primary shadow-lg relative' : ''}`}>
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary"><Star className="h-3 w-3 mr-1" /> Most Popular</Badge>
                  </div>
                )}
                <CardHeader className="text-center pb-2">
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  <div className="mt-3">
                    <span className="text-4xl font-bold">${(plan.priceUsd / 100)}</span>
                    <span className="text-muted-foreground">/mo</span>
                  </div>
                  {plan.credits > 0 ? (
                    <p className="text-sm text-primary font-medium mt-1">
                      {plan.credits.toLocaleString()} credits/month
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground mt-1">
                      Platform access only
                    </p>
                  )}
                  {plan.allowRollover && (
                    <p className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-0.5">
                      <RefreshCcw className="h-3 w-3" />
                      Rollover up to {plan.maxRolloverCredits.toLocaleString()}
                    </p>
                  )}
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <ul className="space-y-2 mb-6 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <form action="/api/billing/subscribe" method="POST">
                    <input type="hidden" name="planSlug" value={plan.slug} />
                    <Button
                      type="submit"
                      variant={plan.popular ? 'default' : 'outline'}
                      className={`w-full ${plan.popular ? 'bg-secondary hover:bg-secondary/90 text-white' : ''}`}
                    >
                      Subscribe <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </form>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Top-up Packs */}
        <section className="py-16 bg-muted/30 px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-3">Need More Credits?</h2>
            <p className="text-center text-muted-foreground mb-8">
              Top up anytime. Purchased credits never expire and work with any plan.
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {TOPUP_PACKS.map((pack) => (
                <Card key={pack.slug} className={pack.popular ? 'border-primary' : ''}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{pack.name}</p>
                        <p className="text-sm text-primary">{pack.credits} credits</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold">${(pack.priceUsd / 100).toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">
                          ${(pack.priceUsd / pack.credits / 100).toFixed(3)}/credit
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <p className="text-center text-sm text-muted-foreground mt-4">
              <Link href="/auth/signup" className="text-primary hover:underline">Sign up</Link> to purchase top-up packs from your dashboard.
            </p>
          </div>
        </section>

        {/* Credit Costs */}
        <section className="py-16 px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-3">What Credits Buy</h2>
            <p className="text-center text-muted-foreground mb-8">
              Every action has a clear, fixed credit cost. No hidden fees.
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
                        {item.credits === 0 ? 'Free' : `${item.credits} credit${item.credits !== 1 ? 's' : ''}`}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* How FIFO Works */}
        <section className="py-16 bg-muted/30 px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-center mb-8">How Credits Work</h2>
            <div className="grid gap-6 md:grid-cols-3">
              <div className="text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <Plus className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">Top-up credits first</h3>
                <p className="text-sm text-muted-foreground">
                  Purchased top-up credits are consumed first and never expire.
                  They&apos;re always available regardless of your subscription status.
                </p>
              </div>
              <div className="text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <RefreshCcw className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">Rollover (Gold & Diamond)</h3>
                <p className="text-sm text-muted-foreground">
                  Unused subscription credits roll over to the next month on Gold and Diamond plans,
                  up to the plan maximum.
                </p>
              </div>
              <div className="text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <Zap className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">Subscription credits last</h3>
                <p className="text-sm text-muted-foreground">
                  Monthly subscription credits are used after top-ups and rollovers.
                  Unused credits on Bronze and Silver plans reset each billing cycle.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 text-center px-4">
          <h2 className="text-2xl md:text-3xl font-bold">Start with 100 free credits</h2>
          <p className="mt-4 text-muted-foreground max-w-md mx-auto">
            No credit card required. Try the full platform for free, then choose a plan
            when you&apos;re ready.
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
                <li><a href="mailto:support@grothi.com" className="hover:text-foreground transition-colors">support@grothi.com</a></li>
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
