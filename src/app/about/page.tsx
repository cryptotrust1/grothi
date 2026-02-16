import { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Bot, Shield, Brain, Lock, Eye, ArrowRight, Check,
  Zap, CreditCard,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'About',
  description: 'Grothi was built by people who ran social media for businesses and got tired of tools that schedule but don\'t think. Learn our story.',
  openGraph: {
    title: 'About | Grothi',
    description: 'Built for marketers, by people who understand marketing. Learn how Grothi became the AI marketing bot platform.',
    url: 'https://grothi.com/about',
  },
  alternates: {
    canonical: '/about',
  },
};

const differentiators = [
  {
    icon: Zap,
    color: 'text-primary',
    title: 'Not a Scheduler. A Marketing Team Replacement.',
    description: 'Hootsuite, Buffer, and Later help you queue up posts you already wrote. Grothi writes the posts, generates the images, creates the videos, publishes them, engages with your audience, and then learns from the results to do it better next time. The gap between a scheduling tool and Grothi is the gap between a calendar and an employee.',
  },
  {
    icon: Brain,
    color: 'text-amber-500',
    title: 'Self-Learning AI That Improves Over Time',
    description: 'Every post your bot publishes generates data. What got liked, shared, saved, ignored. Our reinforcement learning engine tracks all of it and adjusts your bot\'s content strategy accordingly. Most tools give you analytics and leave the optimization to you. Grothi does the optimization itself, automatically, continuously.',
  },
  {
    icon: Shield,
    color: 'text-green-600',
    title: 'White-Hat Only. No Exceptions.',
    description: 'We do not offer fake followers, artificial engagement, or spam tactics. Every piece of content your bot produces goes through Constitutional AI safety guardrails before it touches a platform. We built ban detection and automatic pause because we believe your accounts should be safer with Grothi than without it.',
  },
  {
    icon: CreditCard,
    color: 'text-violet-500',
    title: 'Pay for What You Use, Not a Monthly Seat',
    description: 'Traditional SaaS tools charge per seat, per month, whether you use the product or not. Grothi uses credit-based pricing: you pay for actions your bot actually takes. Run five bots during a product launch, scale back to one during a quiet month. Your cost matches your usage.',
  },
];

const commitments = [
  {
    icon: Lock,
    title: 'Security',
    description: 'Every API key and platform credential is encrypted with AES-256-GCM before it touches our database. We use TOTP-based two-factor authentication, and your encryption keys are never stored alongside your data. Your credentials are safer in Grothi than in a spreadsheet or password manager.',
  },
  {
    icon: Shield,
    title: 'Safety',
    description: 'Constitutional AI guardrails review every post, reply, and caption your bot generates. Three safety levels let you control how much creative freedom your bot has. Ban detection monitors for platform flags and pauses activity instantly. We built these systems because reputation damage is worse than a missed post.',
  },
  {
    icon: Eye,
    title: 'Transparency',
    description: 'You see every action your bot takes. Every post, every reply, every like, every content generation. The activity log shows what happened, when, on which platform, and what the outcome was. There are no black boxes. If your bot does something, you can trace it.',
  },
];

export default function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Navigation */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center space-x-2">
            <Bot className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold">Grothi</span>
          </Link>
          <nav className="hidden md:flex items-center space-x-6">
            <Link href="/features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Features
            </Link>
            <Link href="/how-it-works" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              How It Works
            </Link>
            <Link href="/use-cases" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Use Cases
            </Link>
            <Link href="/pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Pricing
            </Link>
            <Link href="/faq" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              FAQ
            </Link>
          </nav>
          <div className="flex items-center space-x-3">
            <Link href="/auth/signin">
              <Button variant="ghost" size="sm">Sign In</Button>
            </Link>
            <Link href="/auth/signup">
              <Button size="sm">Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-b from-primary/5 via-primary/[0.02] to-background py-20 md:py-28">
          <div className="container mx-auto px-4 text-center">
            <Badge variant="secondary" className="mb-6 text-sm px-4 py-1">
              Our Story
            </Badge>
            <h1 className="mx-auto max-w-4xl text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl leading-[1.1]">
              Built for Marketers, By People Who Understand Marketing
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg md:text-xl text-muted-foreground leading-relaxed">
              Grothi exists because the tools we had weren&apos;t enough.
              We needed something that didn&apos;t just schedule -- it thought.
            </p>
          </div>
        </section>

        {/* Our Story */}
        <section className="py-20 md:py-24">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto space-y-6">
              <h2 className="text-3xl md:text-4xl font-bold">How Grothi Started</h2>
              <p className="text-muted-foreground leading-relaxed text-lg">
                Grothi was born from the day-to-day reality of running social media for businesses. We managed
                accounts across half a dozen platforms, wrote hundreds of posts a month, tracked engagement
                manually, and constantly tried to figure out what was working and what wasn&apos;t.
              </p>
              <p className="text-muted-foreground leading-relaxed text-lg">
                We tried every scheduling tool on the market. They helped us queue up content, but that was
                about it. We still had to write every post ourselves. We still had to analyze performance
                manually. We still had to guess at optimal posting times. The tools saved us clicks,
                but they didn&apos;t save us thinking.
              </p>
              <p className="text-muted-foreground leading-relaxed text-lg">
                So we built something different. Grothi doesn&apos;t just post your content -- it generates
                the content, creates the visuals, publishes at the right times, engages with your audience,
                and then learns from every interaction to improve its next move. It&apos;s the marketing
                team member we wished we had: one that works around the clock, never forgets a platform,
                and gets measurably better every week.
              </p>
            </div>
          </div>
        </section>

        {/* What Makes Us Different */}
        <section className="py-20 md:py-24 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold">What Makes Grothi Different</h2>
              <p className="mt-4 text-muted-foreground max-w-2xl mx-auto text-lg">
                Four things we got right that the rest of the market got wrong.
              </p>
            </div>
            <div className="grid gap-8 md:grid-cols-2 max-w-5xl mx-auto">
              {differentiators.map((item) => (
                <Card key={item.title} className="border shadow-sm">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <div className="shrink-0 mt-1">
                        <item.icon className={`h-8 w-8 ${item.color}`} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Our Commitment */}
        <section className="py-20 md:py-24">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold">Our Commitment to You</h2>
              <p className="mt-4 text-muted-foreground max-w-2xl mx-auto text-lg">
                Three promises we make to every user, from day one.
              </p>
            </div>
            <div className="grid gap-8 md:grid-cols-3 max-w-5xl mx-auto">
              {commitments.map((item) => (
                <div key={item.title} className="text-center">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                    <item.icon className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-3">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Values Strip */}
        <section className="py-16 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { label: 'Platforms Supported', value: '17' },
                  { label: 'Safety Guardrails', value: 'Constitutional AI' },
                  { label: 'Encryption Standard', value: 'AES-256-GCM' },
                  { label: 'Pricing Model', value: 'Pay-Per-Use' },
                ].map((stat) => (
                  <div key={stat.label} className="text-center p-4">
                    <div className="text-2xl font-bold text-primary">{stat.value}</div>
                    <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 md:py-28 bg-gradient-to-b from-primary/10 to-primary/5">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl md:text-4xl font-bold max-w-2xl mx-auto">
              See What Your Bot Can Do
            </h2>
            <p className="mt-6 text-muted-foreground max-w-lg mx-auto text-lg">
              Create your first bot in under 5 minutes. Start with 100 free credits.
              No credit card needed, no commitment required.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/auth/signup">
                <Button size="lg" className="text-lg px-8 h-12">
                  Start Automating Free <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/features">
                <Button variant="outline" size="lg" className="text-lg px-8 h-12">
                  Explore Features
                </Button>
              </Link>
            </div>
            <div className="mt-6 flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-primary" /> 100 free credits</span>
              <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-primary" /> No credit card</span>
              <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-primary" /> White-hat only</span>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-12 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-4">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <Bot className="h-6 w-6 text-primary" />
                <span className="font-bold">Grothi</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                AI marketing bots that generate content, post to 17 platforms, and learn from results.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/features" className="hover:text-foreground transition-colors">Features</Link></li>
                <li><Link href="/how-it-works" className="hover:text-foreground transition-colors">How It Works</Link></li>
                <li><Link href="/pricing" className="hover:text-foreground transition-colors">Pricing</Link></li>
                <li><Link href="/use-cases" className="hover:text-foreground transition-colors">Use Cases</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/about" className="hover:text-foreground transition-colors">About</Link></li>
                <li><Link href="/faq" className="hover:text-foreground transition-colors">FAQ</Link></li>
                <li><Link href="/contact" className="hover:text-foreground transition-colors">Contact</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link></li>
                <li><Link href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 border-t pt-8 text-center text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} Grothi. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
