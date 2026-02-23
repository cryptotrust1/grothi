import { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Bot,
  ArrowRight,
  Check,
  Star,
  DollarSign,
  Clock,
  TrendingUp,
  Users,
  Zap,
  Pen,
  Calendar,
  MessageSquare,
  Mail,
  Brain,
  PiggyBank,
  ShoppingCart,
  Megaphone,
  Sparkles,
  Target,
  Briefcase,
  Crown,
} from 'lucide-react';
import { SUBSCRIPTION_PLANS } from '@/lib/billing';

export const metadata: Metadata = {
  title: 'Affiliate Program - Earn 30% Recurring Commission',
  description: 'Join the Grothi affiliate program. Earn 30% recurring commission for 10 years on every referral. 15% on top-up purchases. Free to join, no minimum payout.',
  alternates: { canonical: '/affiliate' },
  openGraph: {
    title: 'Grothi Affiliate Program | 30% Recurring for 10 Years',
    description: 'Earn 30% recurring commission promoting the most advanced AI marketing bot. 10-year cookie duration. Free to join.',
    url: 'https://grothi.com/affiliate',
  },
};

export default function AffiliatePage() {
  const plans = SUBSCRIPTION_PLANS.map((p) => ({
    ...p,
    monthlyCommission: ((p.priceUsd * 0.3) / 100).toFixed(2),
    yearlyCommission: (((p.priceUsd * 0.3) / 100) * 12).toFixed(0),
  }));

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center space-x-2">
            <Bot className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-indigo-400 bg-clip-text text-transparent">Grothi</span>
          </Link>
          <nav className="hidden md:flex items-center space-x-6">
            <Link href="/features" className="text-sm text-muted-foreground hover:text-foreground">Features</Link>
            <Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground">Pricing</Link>
            <Link href="/faq" className="text-sm text-muted-foreground hover:text-foreground">FAQ</Link>
            <Link href="/affiliate" className="text-sm font-medium">Affiliate</Link>
          </nav>
          <div className="flex items-center space-x-3">
            <Link href="/auth/signin"><Button variant="ghost" size="sm">Sign In</Button></Link>
            <Link href="/auth/signup"><Button size="sm" className="bg-secondary hover:bg-secondary/90 text-white">Start Free <ArrowRight className="ml-1.5 h-4 w-4" /></Button></Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* ══════ HERO ══════ */}
        <section className="relative overflow-hidden py-20 md:py-28">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-indigo-50/50 to-background" />
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-secondary/5 rounded-full blur-3xl" />

          <div className="container mx-auto px-4 relative text-center">
            <Badge variant="secondary" className="mb-6 text-sm px-4 py-1.5">
              Affiliate Partner Program
            </Badge>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.1] max-w-4xl mx-auto">
              Earn{' '}
              <span className="bg-gradient-to-r from-primary to-indigo-400 bg-clip-text text-transparent">
                30% Recurring
              </span>{' '}
              for 10 Years
            </h1>
            <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Promote the most advanced AI marketing bot on the market. Your referrals love it.
              You earn every month. For a decade.
            </p>

            {/* 3 big stats */}
            <div className="mt-12 grid grid-cols-3 gap-6 max-w-2xl mx-auto">
              <div className="p-6 rounded-2xl bg-background border shadow-sm">
                <div className="text-4xl md:text-5xl font-bold text-primary">30%</div>
                <p className="text-sm text-muted-foreground mt-1 font-medium">Recurring Commission</p>
              </div>
              <div className="p-6 rounded-2xl bg-background border shadow-sm">
                <div className="text-4xl md:text-5xl font-bold text-primary">10 YRS</div>
                <p className="text-sm text-muted-foreground mt-1 font-medium">Cookie Duration</p>
              </div>
              <div className="p-6 rounded-2xl bg-background border shadow-sm">
                <div className="text-4xl md:text-5xl font-bold text-primary">15%</div>
                <p className="text-sm text-muted-foreground mt-1 font-medium">On Top-Up Purchases</p>
              </div>
            </div>

            <div className="mt-8">
              <Link href="/auth/signup">
                <Button size="lg" className="text-lg px-8 h-14 bg-secondary hover:bg-secondary/90 text-white">
                  Join the Affiliate Program <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <p className="mt-3 text-sm text-muted-foreground">
                Free to join &middot; No minimum payout &middot; Earn from the first referral
              </p>
            </div>
          </div>
        </section>

        {/* ══════ WHAT YOU'RE PROMOTING ══════ */}
        <section className="py-20 md:py-24 border-t">
          <div className="container mx-auto px-4">
            <div className="text-center mb-14">
              <Badge variant="secondary" className="mb-4">What You&apos;re Promoting</Badge>
              <h2 className="text-3xl md:text-4xl font-bold">
                Grothi in <span className="text-primary">60 Seconds</span>
              </h2>
              <p className="mt-4 text-muted-foreground max-w-2xl mx-auto text-lg">
                A self-learning marketing bot that handles social media for businesses, creators, and agencies.
              </p>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
              <FeatureCard
                icon={<Pen className="h-8 w-8 text-primary" />}
                title="Creates Content"
                description="Writes posts, generates images and videos in the user's brand voice and visual style. No manual work needed."
              />
              <FeatureCard
                icon={<Calendar className="h-8 w-8 text-rose-500" />}
                title="Schedules & Posts"
                description="Posts to 17 platforms automatically with optimized timing. Full calendar control or complete autopilot."
              />
              <FeatureCard
                icon={<MessageSquare className="h-8 w-8 text-indigo-500" />}
                title="Engages Audience"
                description="Replies to comments, likes posts, builds community. In the user's voice and personality."
              />
              <FeatureCard
                icon={<Mail className="h-8 w-8 text-teal-500" />}
                title="Email Campaigns"
                description="Newsletters, sequences, announcements. All from the same platform that knows their brand."
              />
              <FeatureCard
                icon={<Brain className="h-8 w-8 text-amber-500" />}
                title="Learns Daily"
                description="Tracks what works, adapts content. Gets smarter every day. Users see improving results over time."
              />
              <FeatureCard
                icon={<PiggyBank className="h-8 w-8 text-secondary" />}
                title="Saves $35K/Year"
                description="Replaces $3,000-5,000/month agency costs or 20+ hours/week of manual work. Starting at $15/month."
              />
            </div>
          </div>
        </section>

        {/* ══════ WHY IT SELLS ══════ */}
        <section className="py-20 md:py-24 bg-gradient-to-b from-primary/5 to-background">
          <div className="container mx-auto px-4">
            <div className="text-center mb-14">
              <Badge variant="secondary" className="mb-4">Your Advantage</Badge>
              <h2 className="text-3xl md:text-4xl font-bold">
                Why This Is the <span className="text-primary">Easiest Sell</span> You&apos;ll Ever Make
              </h2>
            </div>
            <div className="grid gap-8 md:grid-cols-2 max-w-4xl mx-auto">
              <ReasonCard
                step="01"
                title="Everyone Needs This"
                description="Every business, creator, and influencer needs to post consistently — but most can't afford a marketing team. That's millions of potential customers."
              />
              <ReasonCard
                step="02"
                title="It Actually Works"
                description="Grothi learns each user's brand, creates original content, engages their community, and improves daily. Users save 20+ hours/week. Happy users don't cancel."
              />
              <ReasonCard
                step="03"
                title="One Simple Pitch"
                description={`"What if your social media ran itself — in your voice, your style — while you focused on your business?" That's it. That's the conversation.`}
              />
              <ReasonCard
                step="04"
                title="Low Churn = Steady Income"
                description="Grothi gets better the longer someone uses it. Users who stay 3 months rarely leave. Your 30% commission keeps flowing month after month."
              />
            </div>
          </div>
        </section>

        {/* ══════ COMMISSION DETAILS ══════ */}
        <section className="py-20 md:py-24">
          <div className="container mx-auto px-4">
            <div className="text-center mb-14">
              <Badge variant="secondary" className="mb-4">Your Commission</Badge>
              <h2 className="text-3xl md:text-4xl font-bold">
                How You <span className="text-primary">Get Paid</span>
              </h2>
              <p className="mt-4 text-muted-foreground text-lg">
                Industry-leading rates with the longest tracking windows on the market.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
              <Card className="border-2 hover:border-primary/50 transition-colors">
                <CardContent className="pt-8 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                    <DollarSign className="h-8 w-8 text-primary" />
                  </div>
                  <div className="text-5xl font-bold text-primary">30%</div>
                  <p className="font-semibold mt-2 text-lg">Recurring Commission</p>
                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                    A full 30% of every subscription payment your referral makes. Every month. For 10 years.
                    Most programs offer 10-20% for 1-2 years.
                  </p>
                </CardContent>
              </Card>
              <Card className="border-2 hover:border-primary/50 transition-colors">
                <CardContent className="pt-8 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                    <Clock className="h-8 w-8 text-primary" />
                  </div>
                  <div className="text-5xl font-bold text-primary">10 YRS</div>
                  <p className="font-semibold mt-2 text-lg">Cookie Duration</p>
                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                    Your affiliate link is stored for 10 full years. Someone clicks today and signs up in 2029?
                    You still get the commission. Industry standard is 30-90 days.
                  </p>
                </CardContent>
              </Card>
              <Card className="border-2 hover:border-primary/50 transition-colors">
                <CardContent className="pt-8 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                    <Zap className="h-8 w-8 text-primary" />
                  </div>
                  <div className="text-5xl font-bold text-primary">15%</div>
                  <p className="font-semibold mt-2 text-lg">Top-Up Purchases</p>
                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                    When your referrals buy additional credit packs ($1.99-$99.99), you earn 15% on every purchase.
                    Active users buy credits regularly — it&apos;s bonus income on top of subscriptions.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* ══════ PLANS & YOUR EARNINGS ══════ */}
        <section className="py-20 md:py-24 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="text-center mb-14">
              <h2 className="text-3xl md:text-4xl font-bold">
                What You Earn <span className="text-primary">Per Referral</span>
              </h2>
              <p className="mt-4 text-muted-foreground text-lg">
                Four subscription tiers. Every tier = 30% recurring commission for you.
              </p>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 max-w-6xl mx-auto">
              {plans.map((plan) => (
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
                    {plan.credits > 0 && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {plan.credits.toLocaleString()} credits/month
                      </p>
                    )}
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col">
                    <ul className="space-y-2 mb-6 flex-1">
                      {plan.features.slice(0, 5).map((f) => (
                        <li key={f} className="flex items-start gap-2 text-sm">
                          <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="border-t pt-4 text-center">
                      <p className="text-sm text-muted-foreground">You earn</p>
                      <p className="text-2xl font-bold text-secondary">${plan.monthlyCommission}/mo</p>
                      <p className="text-xs text-muted-foreground">${plan.yearlyCommission}/year per referral</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <p className="text-center mt-8 text-sm font-medium text-primary">
              You earn 30% recurring on every plan — for 10 years.
              Plus 15% on every top-up credit purchase.
            </p>
          </div>
        </section>

        {/* ══════ EARNINGS TABLE ══════ */}
        <section className="py-20 md:py-24">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold">
                Realistic <span className="text-primary">Earnings at Scale</span>
              </h2>
            </div>
            <div className="max-w-4xl mx-auto">
              <Card>
                <CardContent className="pt-6 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-2 font-semibold">Referrals</th>
                        <th className="text-left py-3 px-2 font-semibold">Plan Mix</th>
                        <th className="text-right py-3 px-2 font-semibold">Monthly</th>
                        <th className="text-right py-3 px-2 font-semibold">Annual</th>
                        <th className="text-right py-3 px-2 font-semibold">10-Year</th>
                      </tr>
                    </thead>
                    <tbody>
                      <EarningsRow refs={10} mix="3B, 4S, 2G, 1D" monthly={348} />
                      <EarningsRow refs={25} mix="5B, 10S, 7G, 3D" monthly={665} />
                      <EarningsRow refs={50} mix="8B, 18S, 15G, 9D" monthly={1543} />
                      <EarningsRow refs={100} mix="15B, 35S, 30G, 20D" monthly={3087} />
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </div>

            {/* Quick math highlight */}
            <div className="mt-10 max-w-3xl mx-auto">
              <div className="rounded-2xl border-2 border-primary/20 bg-primary/5 p-8 text-center">
                <p className="text-sm text-muted-foreground mb-2">Quick Math</p>
                <p className="text-lg font-medium">
                  Just 10 businesses on Gold ($89/mo) =
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-6">
                  <div>
                    <div className="text-3xl font-bold text-primary">$267/mo</div>
                    <p className="text-xs text-muted-foreground">Passive Income</p>
                  </div>
                  <div className="text-2xl text-muted-foreground/30 font-light self-center">&rarr;</div>
                  <div>
                    <div className="text-3xl font-bold text-primary">$3,204/yr</div>
                    <p className="text-xs text-muted-foreground">Annual</p>
                  </div>
                  <div className="text-2xl text-muted-foreground/30 font-light self-center">&rarr;</div>
                  <div>
                    <div className="text-3xl font-bold text-primary">$32,040</div>
                    <p className="text-xs text-muted-foreground">Over 10 Years</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══════ TARGET AUDIENCES ══════ */}
        <section className="py-20 md:py-24 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="text-center mb-14">
              <h2 className="text-3xl md:text-4xl font-bold">
                Who Needs <span className="text-primary">Grothi?</span>
              </h2>
              <p className="mt-4 text-muted-foreground text-lg">
                Everyone who posts on social media is a potential customer.
              </p>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
              <PersonaCard
                icon={<ShoppingCart className="h-7 w-7 text-primary" />}
                title="Small Business Owners"
                description="No time for social media, can't afford an agency. Grothi handles it all for $29-89/month."
              />
              <PersonaCard
                icon={<Megaphone className="h-7 w-7 text-violet-500" />}
                title="Marketing Agencies"
                description="Manage 50 clients without hiring 50 people. Diamond plan with white-label = agency goldmine."
              />
              <PersonaCard
                icon={<Sparkles className="h-7 w-7 text-amber-500" />}
                title="Content Creators"
                description="Focus on creating what they love. Grothi handles scheduling, engaging, and optimizing."
              />
              <PersonaCard
                icon={<Target className="h-7 w-7 text-secondary" />}
                title="E-Commerce Brands"
                description="Auto-generate product content, lifestyle shots, marketing copy. Social becomes a sales machine."
              />
              <PersonaCard
                icon={<Briefcase className="h-7 w-7 text-sky-500" />}
                title="Freelancers"
                description="Offer social media management as a service using Grothi. One subscription, multiple clients."
              />
              <PersonaCard
                icon={<Crown className="h-7 w-7 text-rose-500" />}
                title="Influencers"
                description="Grow faster on 17 platforms simultaneously. Focus on authenticity while Grothi handles the volume."
              />
            </div>
          </div>
        </section>

        {/* ══════ WHAT YOU GET + 3 STEPS ══════ */}
        <section className="py-20 md:py-24">
          <div className="container mx-auto px-4">
            <div className="text-center mb-14">
              <Badge variant="secondary" className="mb-4">Get Started</Badge>
              <h2 className="text-3xl md:text-4xl font-bold">
                Ready to <span className="text-primary">Start Earning?</span>
              </h2>
            </div>

            <div className="grid gap-12 lg:grid-cols-2 max-w-5xl mx-auto items-start">
              {/* What you get */}
              <div>
                <h3 className="text-xl font-bold mb-6">What You Get as a Partner</h3>
                <ul className="space-y-3">
                  {[
                    'Personal dashboard with real-time click & conversion tracking',
                    'Unique referral link active for 10 years in visitor\'s browser',
                    'Monthly payments directly to your bank or PayPal',
                    'Co-branded marketing materials and landing pages',
                    'Dedicated affiliate manager for top performers',
                    'No minimum payout — earn from the very first referral',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-secondary shrink-0 mt-0.5" />
                      <span className="text-sm">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* 3 steps */}
              <div>
                <h3 className="text-xl font-bold mb-6">3 Steps. 2 Minutes.</h3>
                <div className="space-y-6">
                  <StepCard
                    step={1}
                    title="Sign Up"
                    description="Register free at grothi.com/affiliate. Takes 2 minutes."
                  />
                  <StepCard
                    step={2}
                    title="Share"
                    description="Get your unique link. Share with your audience, blog, or network."
                  />
                  <StepCard
                    step={3}
                    title="Earn"
                    description="30% recurring commission for 10 years per referral. Done."
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══════ FINAL CTA ══════ */}
        <section className="py-20 md:py-28 bg-gradient-to-br from-primary/10 via-indigo-100/30 to-secondary/10 relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
          <div className="container mx-auto px-4 text-center relative">
            <h2 className="text-3xl md:text-5xl font-bold max-w-3xl mx-auto leading-tight">
              Start Earning <span className="text-primary">30% Recurring</span> Today
            </h2>
            <p className="mt-6 text-muted-foreground max-w-lg mx-auto text-lg">
              Free to join. No minimum payout. Commissions for 10 years per referral.
            </p>
            <Link href="/auth/signup">
              <Button size="lg" className="mt-8 text-lg px-12 h-16 bg-secondary hover:bg-secondary/90 text-white shadow-xl shadow-secondary/20">
                Join Now — It&apos;s Free <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <p className="mt-4 text-sm text-muted-foreground">
              <a href="mailto:affiliate@grothi.com" className="hover:text-foreground transition-colors underline">
                affiliate@grothi.com
              </a>
            </p>
            <p className="mt-8 text-xs text-muted-foreground max-w-md mx-auto">
              Commission rates per Grothi Affiliate Agreement. All prices excl. tax. Annual billing saves 20%.
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
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
                <li><Link href="/affiliate" className="hover:text-foreground transition-colors">Affiliate Program</Link></li>
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

// ============ HELPER COMPONENTS ============

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <Card className="border hover:border-primary/30 hover:shadow-lg transition-all duration-300 group">
      <CardHeader className="pb-2">
        <div className="mb-2 group-hover:scale-110 transition-transform duration-300">{icon}</div>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
      </CardContent>
    </Card>
  );
}

function ReasonCard({ step, title, description }: { step: string; title: string; description: string }) {
  return (
    <div className="flex gap-5 p-6 rounded-2xl border bg-background hover:border-primary/50 hover:shadow-lg transition-all duration-300">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground text-lg font-bold shadow-lg shadow-primary/20">
        {step}
      </div>
      <div>
        <h3 className="font-bold text-lg mb-1">{title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

function StepCard({ step, title, description }: { step: number; title: string; description: string }) {
  return (
    <div className="flex gap-4 items-start">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold shadow-md">
        {step}
      </div>
      <div>
        <h4 className="font-semibold">{title}</h4>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function PersonaCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="p-6 rounded-2xl border bg-background hover:border-primary/50 hover:shadow-lg transition-all duration-300">
      <div className="mb-4">{icon}</div>
      <h3 className="font-bold text-lg mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}

function EarningsRow({ refs, mix, monthly }: { refs: number; mix: string; monthly: number }) {
  const annual = monthly * 12;
  const decade = annual * 10;
  return (
    <tr className="border-b last:border-0 hover:bg-muted/50">
      <td className="py-3 px-2 font-medium">{refs} Refs</td>
      <td className="py-3 px-2 text-muted-foreground">{mix}</td>
      <td className="py-3 px-2 text-right font-semibold text-secondary">${monthly.toLocaleString()}/mo</td>
      <td className="py-3 px-2 text-right">${annual.toLocaleString()}/yr</td>
      <td className="py-3 px-2 text-right font-semibold">${decade.toLocaleString()}</td>
    </tr>
  );
}
