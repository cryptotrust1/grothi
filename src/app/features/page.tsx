import { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Bot, Brain, Globe, Shield, Zap, Lock, ArrowRight, Check,
  Sparkles, Image, Film, Clock, Calendar, BarChart3, Rss,
  FileText, AlertTriangle, CreditCard, Eye, Palette, MonitorSmartphone,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Features',
  description: 'Explore everything Grothi can do: AI content generation, image and video creation, multi-platform publishing, self-learning optimization, smart scheduling, and more.',
  openGraph: {
    title: 'Features | Grothi',
    description: 'AI content generation, image and video creation, 17-platform publishing, self-learning optimization, and enterprise-grade security.',
    url: 'https://grothi.com/features',
  },
  alternates: {
    canonical: '/features',
  },
};

const PLATFORMS = [
  'Facebook', 'Instagram', 'Twitter', 'LinkedIn', 'TikTok', 'YouTube',
  'Reddit', 'Pinterest', 'Threads', 'Bluesky', 'Mastodon', 'Discord',
  'Telegram', 'Medium', 'Dev.to', 'Nostr', 'Moltbook',
];

const coreFeatures = [
  {
    icon: Sparkles,
    color: 'text-primary',
    title: 'AI Content That Sounds Like You Wrote It',
    description: 'Your bot uses Claude AI to generate original posts, captions, and threads that match your brand voice. Feed it RSS sources and a description of your business, and it produces content that reads like it came from your team. No templates. No recycled filler. Every post is crafted for the specific platform it targets.',
    highlights: [
      'Writes in your brand voice and tone',
      'Draws from up to 20 RSS feeds for fresh material',
      'Adapts format and length per platform',
      'Generates threads, captions, long-form, and short-form',
    ],
  },
  {
    icon: Image,
    color: 'text-emerald-500',
    title: 'AI Images Sized for Every Platform',
    description: 'Grothi generates brand-aligned visuals using Flux AI, automatically sized for whichever platform you are targeting. Instagram squares, TikTok verticals, LinkedIn banners, Pinterest pins -- all produced without a designer. Define your style preferences once, and every image stays on-brand.',
    highlights: [
      'Platform-specific dimensions (1080x1080, 1080x1920, etc.)',
      'Brand-aligned style from your creative preferences',
      'Powered by Flux AI image generation',
      'Stored in your media library for reuse',
    ],
  },
  {
    icon: Film,
    color: 'text-violet-500',
    title: 'AI Video for TikTok, Reels, and Shorts',
    description: 'Short-form video is the fastest-growing content format, and your bot can produce it without a camera or editing software. Grothi uses dual video providers to create marketing clips in vertical, square, and landscape formats. Choose from quick tips, product demos, explainers, and more.',
    highlights: [
      'Vertical 9:16, square 1:1, and landscape 16:9',
      '5-second hooks to 5-minute deep dives',
      'Multiple video styles: demos, tips, storytelling',
      'Dual provider redundancy for reliable generation',
    ],
  },
  {
    icon: Globe,
    color: 'text-blue-500',
    title: 'One Dashboard, 17 Platforms',
    description: 'Connect Facebook, Instagram, TikTok, LinkedIn, Twitter, YouTube, Reddit, Pinterest, Threads, Bluesky, Mastodon, Discord, Telegram, Medium, Dev.to, Nostr, and Moltbook. Your bot adapts each piece of content to the rules, audience, and format that work best on each network.',
    highlights: [
      'All 17 platforms managed from one place',
      'Content reformatted per platform automatically',
      'Independent scheduling per network',
      'Connect and disconnect platforms anytime',
    ],
  },
  {
    icon: Brain,
    color: 'text-amber-500',
    title: 'A Self-Learning Engine That Gets Smarter',
    description: 'This is what separates Grothi from scheduling tools. After every post, your bot collects engagement data -- likes, comments, shares, saves, click-throughs -- and feeds it into a reinforcement learning algorithm. Over time, it identifies which topics, formats, tones, and posting times perform best for your specific audience, and shifts its strategy accordingly.',
    highlights: [
      'Reinforcement learning across four dimensions',
      'Tracks engagement signals per post and platform',
      'Automatically adjusts content type, tone, and timing',
      'Measurable improvement week over week',
    ],
  },
  {
    icon: Calendar,
    color: 'text-rose-500',
    title: 'Smart Scheduling That Knows When to Post',
    description: 'Your bot uses research-backed optimal posting times for each platform, then refines them based on your actual engagement data. View everything in a calendar or list, schedule posts manually, or let the auto-scheduler handle it. Every post goes out when your audience is most likely to see it.',
    highlights: [
      'Optimal posting times per platform built in',
      'Calendar view and list view with status filters',
      'Auto-scheduling based on engagement patterns',
      'Manual override for time-sensitive content',
    ],
  },
];

const additionalFeatures = [
  {
    icon: Palette,
    title: 'Media Library',
    description: 'Upload, organize, and reuse images and videos. AI-generated captions describe your media for each platform with the right tone and length.',
  },
  {
    icon: MonitorSmartphone,
    title: 'Platform-Specific Formatting',
    description: 'Character limits, hashtag strategies, image ratios, and content styles are all tailored per platform. Your bot never posts a LinkedIn essay to Twitter.',
  },
  {
    icon: Rss,
    title: 'RSS Feed Integration',
    description: 'Connect up to 20 RSS feeds per bot. Your bot monitors industry news, competitor blogs, and niche sources to generate timely, relevant content.',
  },
  {
    icon: Shield,
    title: 'Brand Safety Guardrails',
    description: 'Constitutional AI reviews every piece of content before it goes live. Three safety levels (conservative, moderate, aggressive) let you control how much freedom your bot has.',
  },
  {
    icon: AlertTriangle,
    title: 'Ban Detection and Auto-Pause',
    description: 'If a platform flags your account, your bot detects it immediately and pauses all activity. No more waking up to a suspended account.',
  },
  {
    icon: BarChart3,
    title: 'Analytics Dashboard',
    description: 'Track engagement rates, post performance, credit usage, and platform breakdown over time. Recharts-powered visualizations show exactly what is working.',
  },
  {
    icon: CreditCard,
    title: 'Credit-Based Pricing',
    description: 'Pay only for actions your bot takes. No monthly seat fees. No minimum commitments. Start with 100 free credits and scale as you grow.',
  },
  {
    icon: Clock,
    title: 'Post Scheduler with Calendar View',
    description: 'See your entire content calendar at a glance. Drag, create, and manage posts across platforms in a monthly grid or filtered list view.',
  },
  {
    icon: FileText,
    title: 'Per-Platform Content Strategy',
    description: 'Define different goals, tones, and content types for each platform. Your bot treats LinkedIn differently from TikTok because they are different audiences.',
  },
];

export default function FeaturesPage() {
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
            <Link href="/features" className="text-sm font-medium transition-colors">
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
              AI-powered from generation to optimization
            </Badge>
            <h1 className="mx-auto max-w-4xl text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl leading-[1.1]">
              Everything Your Bot Can Do
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg md:text-xl text-muted-foreground leading-relaxed">
              Grothi handles content creation, image and video generation, multi-platform publishing,
              audience engagement, and performance optimization. Here is a complete look at what you get.
            </p>
          </div>
        </section>

        {/* Core Capabilities */}
        <section className="py-20 md:py-24">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold">Core Capabilities</h2>
              <p className="mt-4 text-muted-foreground max-w-2xl mx-auto text-lg">
                Six pillars that make Grothi a full marketing team, not just a scheduling tool.
              </p>
            </div>
            <div className="grid gap-8 lg:grid-cols-2 max-w-6xl mx-auto">
              {coreFeatures.map((feature) => (
                <Card key={feature.title} className="border shadow-md hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start gap-4">
                      <div className="shrink-0 mt-1">
                        <feature.icon className={`h-10 w-10 ${feature.color}`} />
                      </div>
                      <div>
                        <CardTitle className="text-xl leading-tight">{feature.title}</CardTitle>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-muted-foreground leading-relaxed text-sm">
                      {feature.description}
                    </p>
                    <ul className="space-y-2">
                      {feature.highlights.map((item) => (
                        <li key={item} className="flex gap-2.5 text-sm">
                          <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Additional Features */}
        <section className="py-20 md:py-24 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold">And That&apos;s Not All</h2>
              <p className="mt-4 text-muted-foreground max-w-2xl mx-auto text-lg">
                Every detail has been thought through so your bot runs smoothly and your accounts stay safe.
              </p>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
              {additionalFeatures.map((feature) => (
                <Card key={feature.title} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <feature.icon className="h-8 w-8 text-primary mb-2" />
                    <CardTitle className="text-lg">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Platform Support */}
        <section className="py-20 md:py-24">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold">17 Platforms, One Dashboard</h2>
              <p className="mt-4 text-muted-foreground max-w-2xl mx-auto text-lg">
                Your bot publishes native content to every major social network and community platform.
                Connect the ones you use, ignore the rest.
              </p>
            </div>
            <div className="max-w-4xl mx-auto">
              <div className="flex flex-wrap justify-center gap-3">
                {PLATFORMS.map((platform) => (
                  <Badge
                    key={platform}
                    variant="secondary"
                    className="text-sm px-4 py-2 font-medium"
                  >
                    {platform}
                  </Badge>
                ))}
              </div>
              <p className="text-center text-sm text-muted-foreground mt-6">
                Each platform gets content formatted to its specific requirements -- character limits, image
                dimensions, hashtag conventions, and posting norms.
              </p>
            </div>
          </div>
        </section>

        {/* Security */}
        <section className="py-20 md:py-24 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="max-w-5xl mx-auto grid gap-12 lg:grid-cols-2 items-center">
              <div>
                <Badge variant="secondary" className="mb-4">Security</Badge>
                <h2 className="text-3xl md:text-4xl font-bold leading-tight">
                  Your Credentials Are Locked Down
                </h2>
                <p className="mt-4 text-muted-foreground leading-relaxed text-lg">
                  You are trusting us with access to your social accounts. We take that seriously.
                  Security is built into every layer of the platform, not bolted on as an afterthought.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <SecurityCard
                  icon={<Lock className="h-5 w-5" />}
                  title="AES-256-GCM Encryption"
                  desc="All API keys and platform credentials are encrypted at rest with military-grade encryption. Keys are never stored in plaintext."
                />
                <SecurityCard
                  icon={<Eye className="h-5 w-5" />}
                  title="Two-Factor Authentication"
                  desc="TOTP-based 2FA protects your account. Even if your password is compromised, your bots stay secure."
                />
                <SecurityCard
                  icon={<Shield className="h-5 w-5" />}
                  title="White-Hat Compliance"
                  desc="Constitutional AI guardrails review every post before publishing. Your bot never sends spam or fake engagement."
                />
                <SecurityCard
                  icon={<AlertTriangle className="h-5 w-5" />}
                  title="Ban Detection"
                  desc="Automatic monitoring detects platform bans, rate limits, and suspensions. Your bot pauses instantly to protect your account."
                />
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 md:py-28 bg-gradient-to-b from-primary/10 to-primary/5">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl md:text-4xl font-bold max-w-2xl mx-auto">
              Ready to Put Your Marketing on Autopilot?
            </h2>
            <p className="mt-6 text-muted-foreground max-w-lg mx-auto text-lg">
              Create your first bot in under 5 minutes. 100 free credits included, no credit card required.
            </p>
            <Link href="/auth/signup">
              <Button size="lg" className="mt-8 text-lg px-10 h-14 bg-secondary hover:bg-secondary/90 text-white">
                Start Free Trial <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <div className="mt-6 flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-secondary" /> 100 free credits</span>
              <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-secondary" /> No credit card</span>
              <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-secondary" /> Set up in 5 minutes</span>
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

// ============ COMPONENTS ============

function SecurityCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="p-4 rounded-lg border bg-background">
      <div className="flex items-center gap-2 mb-2">
        <div className="text-primary">{icon}</div>
        <span className="font-medium text-sm">{title}</span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
    </div>
  );
}
