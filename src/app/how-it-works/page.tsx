import { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Bot, Brain, Globe, ArrowRight, Check, Zap,
  Settings, Sparkles, BarChart3, RefreshCw,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'How It Works - Set Up Your AI Marketing Bot in 5 Minutes',
  description:
    'Learn how Grothi works in 4 simple steps: create your bot, connect platforms, let AI generate and publish content, and watch it learn and improve automatically.',
  keywords: [
    'how AI social media bot works',
    'AI marketing automation setup',
    'automated social media posting how to',
    'self-learning marketing bot',
  ],
  openGraph: {
    title: 'How It Works | Grothi',
    description: 'Create a bot, connect your platforms, and let AI handle your social media. Set up in under 5 minutes.',
    url: 'https://grothi.com/how-it-works',
  },
  alternates: {
    canonical: '/how-it-works',
  },
};

const steps = [
  {
    number: '01',
    icon: Settings,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    title: 'Create Your Bot',
    subtitle: 'Under 2 minutes',
    description:
      'Give your bot a name, describe your business and target audience, set your content goals, and choose a posting schedule. Your bot uses this information to generate content that sounds like it came from your team, not a machine.',
    details: [
      'Choose from 6 marketing goals (growth, engagement, sales, leads, brand, traffic)',
      'Set your brand voice and content tone',
      'Add up to 20 RSS feeds for content inspiration',
      'Pick a posting schedule from 11 presets or set custom timing',
      'Configure safety level (conservative, moderate, aggressive)',
    ],
  },
  {
    number: '02',
    icon: Globe,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    title: 'Connect Your Platforms',
    subtitle: '1-2 minutes per platform',
    description:
      'Link any combination of 17 social networks. Each platform connection uses your own API credentials, which are encrypted with AES-256-GCM before being stored. Your bot adapts content format, length, hashtags, and image dimensions for each platform automatically.',
    details: [
      'Facebook, Instagram, Twitter, LinkedIn, TikTok, YouTube',
      'Reddit, Pinterest, Threads, Bluesky, Mastodon',
      'Discord, Telegram, Medium, Dev.to, Nostr, Moltbook',
      'All credentials encrypted at rest with military-grade encryption',
      'Connect and disconnect platforms anytime without losing data',
    ],
  },
  {
    number: '03',
    icon: Sparkles,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    title: 'AI Creates and Publishes',
    subtitle: 'Fully automatic',
    description:
      'Your bot generates original posts using Claude AI, creates platform-optimized images with Flux AI, produces short-form videos, and publishes everything at the optimal time for each network. It also engages with your audience through replies and likes.',
    details: [
      'AI-written posts that match your brand voice and goals',
      'Images sized for each platform (1080x1080, 1080x1920, etc.)',
      'Short-form marketing videos in multiple formats',
      'Smart scheduling based on research-backed optimal posting times',
      'Automated engagement: replies, likes, and boosts',
    ],
  },
  {
    number: '04',
    icon: Brain,
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10',
    title: 'Watch It Learn and Improve',
    subtitle: 'Gets smarter every week',
    description:
      'After every post, your bot collects engagement data and feeds it into a reinforcement learning engine. It tracks what topics, formats, tones, and posting times drive the most engagement for your specific audience, and shifts its strategy automatically. No manual optimization required.',
    details: [
      'Reinforcement learning across 4 dimensions (time, content, tone, hashtags)',
      'Tracks likes, comments, shares, saves, and click-throughs',
      'Automatically shifts toward high-performing content patterns',
      'Measurable improvement visible in your analytics dashboard',
      'Adapts to algorithm changes and seasonal trends',
    ],
  },
];

const learningCycle = [
  { icon: Sparkles, label: 'Generate', desc: 'AI creates content based on your goals and past performance' },
  { icon: Globe, label: 'Publish', desc: 'Posts go out at optimal times across all connected platforms' },
  { icon: BarChart3, label: 'Measure', desc: 'Engagement data is collected: likes, shares, comments, saves' },
  { icon: RefreshCw, label: 'Optimize', desc: 'Reinforcement learning adjusts strategy for better results' },
];

export default function HowItWorksPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Navigation */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center space-x-2">
            <Bot className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-indigo-400 bg-clip-text text-transparent">Grothi</span>
          </Link>
          <nav className="hidden md:flex items-center space-x-6">
            <Link href="/features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Features
            </Link>
            <Link href="/how-it-works" className="text-sm font-medium">
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
              <Button size="sm" className="bg-secondary hover:bg-secondary/90 text-white">Start Free Trial <ArrowRight className="ml-1.5 h-4 w-4" /></Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-b from-primary/5 via-primary/[0.02] to-background py-20 md:py-28">
          <div className="container mx-auto px-4 text-center">
            <Badge variant="secondary" className="mb-6 text-sm px-4 py-1">
              4 steps to automated marketing
            </Badge>
            <h1 className="mx-auto max-w-4xl text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl leading-[1.1]">
              Set Up Your AI Marketing Bot in Under 5 Minutes
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg md:text-xl text-muted-foreground leading-relaxed">
              Create a bot, connect your platforms, and let AI handle content creation,
              publishing, engagement, and optimization. Here is exactly how it works.
            </p>
          </div>
        </section>

        {/* Steps */}
        <section className="py-20 md:py-24">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto space-y-16">
              {steps.map((step, index) => (
                <div key={step.number} className="relative">
                  {/* Connector line */}
                  {index < steps.length - 1 && (
                    <div className="hidden md:block absolute left-[2.75rem] top-[5.5rem] bottom-[-4rem] w-px bg-border" />
                  )}

                  <div className="grid gap-8 md:grid-cols-[5.5rem_1fr]">
                    {/* Step number */}
                    <div className="flex md:flex-col items-center md:items-start gap-4 md:gap-3">
                      <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${step.bgColor}`}>
                        <step.icon className={`h-7 w-7 ${step.color}`} />
                      </div>
                      <span className="text-sm font-medium text-muted-foreground">Step {step.number}</span>
                    </div>

                    {/* Content */}
                    <div>
                      <h2 className="text-2xl md:text-3xl font-bold">{step.title}</h2>
                      <p className="text-sm text-muted-foreground mt-1 mb-4">
                        <Zap className="h-3.5 w-3.5 inline mr-1" />
                        {step.subtitle}
                      </p>
                      <p className="text-muted-foreground leading-relaxed mb-6">
                        {step.description}
                      </p>
                      <Card className="border shadow-sm">
                        <CardContent className="pt-5 pb-5">
                          <ul className="space-y-3">
                            {step.details.map((detail) => (
                              <li key={detail} className="flex gap-3 text-sm">
                                <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                                <span className="text-muted-foreground">{detail}</span>
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* The Learning Cycle */}
        <section className="py-20 md:py-24 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <Badge variant="secondary" className="mb-4">Continuous improvement</Badge>
              <h2 className="text-3xl md:text-4xl font-bold">The Self-Learning Cycle</h2>
              <p className="mt-4 text-muted-foreground max-w-2xl mx-auto text-lg">
                Your bot does not just post and forget. Every piece of content feeds a reinforcement
                learning loop that makes your next post smarter than the last.
              </p>
            </div>
            <div className="max-w-4xl mx-auto">
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {learningCycle.map((item, i) => (
                  <div key={item.label} className="relative text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                      <item.icon className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="font-semibold text-lg mb-2">{item.label}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                    {i < learningCycle.length - 1 && (
                      <div className="hidden lg:block absolute top-8 -right-3">
                        <ArrowRight className="h-5 w-5 text-muted-foreground/40" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-center text-sm text-muted-foreground mt-8">
                This cycle runs automatically after every post. Over weeks, your bot develops a
                data-backed understanding of what works for your specific audience on each platform.
              </p>
            </div>
          </div>
        </section>

        {/* What Happens Behind the Scenes */}
        <section className="py-20 md:py-24">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-12">
                <h2 className="text-3xl md:text-4xl font-bold">What Happens Behind the Scenes</h2>
                <p className="mt-4 text-muted-foreground max-w-2xl mx-auto text-lg">
                  When your bot is active, here is what it does on a typical day.
                </p>
              </div>
              <Card className="border shadow-md">
                <CardContent className="pt-6">
                  <div className="space-y-4 text-sm">
                    {[
                      { time: '6:00 AM', action: 'Scans RSS feeds for fresh content ideas and trending topics' },
                      { time: '7:30 AM', action: 'Generates an AI-written post tailored to your brand voice and current goals' },
                      { time: '8:00 AM', action: 'Creates a platform-optimized image to accompany the post' },
                      { time: '9:00 AM', action: 'Publishes to LinkedIn and Twitter at their peak engagement windows' },
                      { time: '11:00 AM', action: 'Publishes the same content (reformatted) to Instagram and Facebook' },
                      { time: '1:00 PM', action: 'Replies to comments and mentions from the morning posts' },
                      { time: '3:00 PM', action: 'Engages with relevant content in your niche (likes, boosts)' },
                      { time: '6:00 PM', action: 'Publishes an evening post to TikTok and Threads' },
                      { time: '10:00 PM', action: 'Collects engagement metrics from all platforms' },
                      { time: '10:30 PM', action: 'Updates reinforcement learning model with today\'s performance data' },
                    ].map((item) => (
                      <div key={item.time} className="flex gap-4 items-start py-2 border-b last:border-0">
                        <span className="font-mono text-xs text-muted-foreground w-20 shrink-0 pt-0.5">{item.time}</span>
                        <span className="text-muted-foreground">{item.action}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              <p className="text-xs text-muted-foreground text-center mt-4">
                Actual timing varies based on your schedule settings and each platform&apos;s optimal posting windows.
                Your bot adapts this timeline based on what it learns about your audience.
              </p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 md:py-28 bg-gradient-to-b from-primary/10 to-primary/5">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl md:text-4xl font-bold max-w-2xl mx-auto">
              Ready to Let AI Handle Your Social Media?
            </h2>
            <p className="mt-6 text-muted-foreground max-w-lg mx-auto text-lg">
              Create your first bot in under 5 minutes. Start with 100 free credits.
              No credit card required, no commitment.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/auth/signup">
                <Button size="lg" className="text-lg px-8 h-14 bg-secondary hover:bg-secondary/90 text-white">
                  Create Your First Bot <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/features">
                <Button variant="outline" size="lg" className="text-lg px-8 h-12">
                  See All Features
                </Button>
              </Link>
            </div>
            <div className="mt-6 flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-secondary" /> 100 free credits</span>
              <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-secondary" /> No credit card</span>
              <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-secondary" /> Set up in 5 minutes</span>
              <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-secondary" /> 17 platforms</span>
            </div>
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
