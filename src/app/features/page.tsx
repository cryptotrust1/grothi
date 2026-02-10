import { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Bot, Brain, Globe, Shield, Zap, TrendingUp,
  CreditCard, Bell, BarChart3, Rss, Lock, ArrowRight,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Features',
  description: 'Discover all features of Grothi - AI content generation, multi-platform posting, self-learning, white-hat safety, and more.',
};

const features = [
  {
    icon: Brain,
    title: 'Self-Learning AI Engine',
    description: 'Your bot analyzes engagement metrics and adjusts its content strategy automatically. It learns what works for your audience and does more of it.',
  },
  {
    icon: Zap,
    title: 'Content Reactor',
    description: 'AI generates fresh, relevant content from RSS feeds, trending topics, and your brand knowledge base. Never run out of things to post.',
  },
  {
    icon: Globe,
    title: 'Multi-Platform Support',
    description: 'Post to Mastodon, Facebook, Telegram, Discord, Bluesky, Twitter, Reddit, and more. All from a single dashboard.',
  },
  {
    icon: Shield,
    title: 'White-Hat Safety',
    description: 'Constitutional AI safety guardrails review every piece of content before posting. Three safety levels to match your comfort.',
  },
  {
    icon: Lock,
    title: 'Ban Protection',
    description: 'Automatic detection of platform bans, suspensions, and rate limits. Emergency stop and instant alerts keep your accounts safe.',
  },
  {
    icon: BarChart3,
    title: 'Real-Time Analytics',
    description: 'Track likes, comments, shares, and engagement rates. See exactly how your bot is performing across all platforms.',
  },
  {
    icon: Rss,
    title: 'RSS Feed Integration',
    description: 'Connect up to 20 RSS feeds per bot. Your bot stays up-to-date with industry news and creates timely content.',
  },
  {
    icon: CreditCard,
    title: 'Pay Per Use',
    description: 'Credit-based pricing means you only pay for actions your bot takes. No monthly subscriptions or hidden fees.',
  },
  {
    icon: Bell,
    title: 'Smart Notifications',
    description: 'Get email alerts for important events: low credits, ban detection, daily performance summaries.',
  },
];

export default function FeaturesPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center space-x-2">
            <Bot className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold">Grothi</span>
          </Link>
          <nav className="hidden md:flex items-center space-x-6">
            <Link href="/features" className="text-sm font-medium">Features</Link>
            <Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground">Pricing</Link>
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
        <section className="py-16 text-center">
          <h1 className="text-4xl font-bold">Powerful Features for AI Marketing</h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Everything you need to automate your social media marketing with AI.
          </p>
        </section>

        <section className="pb-20 px-4">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
            {features.map((feature) => (
              <Card key={feature.title} className="border-0 shadow-md">
                <CardHeader>
                  <feature.icon className="h-10 w-10 text-primary mb-2" />
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="py-16 text-center bg-primary/5 px-4">
          <h2 className="text-2xl font-bold">Start Building Your Bot Today</h2>
          <p className="mt-4 text-muted-foreground">100 free credits. No credit card required.</p>
          <Link href="/auth/signup">
            <Button size="lg" className="mt-6">
              Get Started Free <ArrowRight className="ml-2 h-5 w-5" />
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
