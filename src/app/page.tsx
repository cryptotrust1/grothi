import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Bot,
  Globe,
  Brain,
  ArrowRight,
  Check,
  Star,
  BarChart3,
  Target,
  Sparkles,
  ShoppingCart,
  Megaphone,
  ChevronDown,
  X,
  Image,
  Film,
  Calendar,
  Mail,
  Palette,
  MessageSquare,
  Pen,
} from 'lucide-react';

const PLATFORMS = [
  { name: 'Facebook', color: 'text-blue-600' },
  { name: 'Instagram', color: 'text-pink-500' },
  { name: 'X (Twitter)', color: 'text-foreground' },
  { name: 'LinkedIn', color: 'text-blue-700' },
  { name: 'TikTok', color: 'text-foreground' },
  { name: 'YouTube', color: 'text-red-600' },
  { name: 'Threads', color: 'text-foreground' },
  { name: 'Pinterest', color: 'text-red-500' },
  { name: 'Reddit', color: 'text-orange-600' },
  { name: 'Discord', color: 'text-indigo-500' },
  { name: 'Telegram', color: 'text-sky-500' },
  { name: 'Mastodon', color: 'text-purple-600' },
  { name: 'Bluesky', color: 'text-blue-400' },
  { name: 'Medium', color: 'text-foreground' },
  { name: 'Dev.to', color: 'text-foreground' },
  { name: 'Nostr', color: 'text-purple-500' },
  { name: 'Misskey', color: 'text-green-500' },
];

const TESTIMONIALS = [
  {
    quote: 'Grothi grew my Instagram from 2,000 to 50,000 followers in 4 months. The engagement is insane \u2014 way better than when I was doing it manually. Plus I got my weekends back.',
    name: 'Sarah Chen',
    role: 'Fitness Influencer',
    stars: 5,
  },
  {
    quote: 'I was spending 20 hours/week on social media for my 5 clients. Now it\u2019s 2 hours. Grothi handles everything \u2014 posting, engaging, even finding trending content. Game changer.',
    name: 'Mike Rodriguez',
    role: 'Marketing Agency Owner',
    stars: 5,
  },
  {
    quote: 'Fired my $3,500/month agency and got Grothi for $199/month. Results are actually BETTER. My ROI went from 2X to 8X in 3 months.',
    name: 'Jessica Park',
    role: 'E-commerce Founder',
    stars: 5,
  },
  {
    quote: 'As a developer, I\u2019m skeptical of AI tools. But Grothi actually understands platform algorithms. The content it generates gets 3X more engagement than our old posts.',
    name: 'David Kim',
    role: 'SaaS Founder',
    stars: 5,
  },
];

const FAQS = [
  {
    q: 'Is this just another scheduling tool?',
    a: 'No! Grothi is a self-learning AI bot. It doesn\u2019t just schedule \u2014 it creates content, optimizes timing, engages with your audience, and learns from results. Think of it as a marketing team, not a tool.',
  },
  {
    q: 'Will the content sound robotic?',
    a: 'Nope. Our AI is trained on millions of successful posts. It learns your brand voice and writes naturally. Most people can\u2019t tell it\u2019s AI.',
  },
  {
    q: 'How is this different from ChatGPT?',
    a: 'ChatGPT is general-purpose. Grothi is specifically trained on social media algorithms. It knows what gets engagement on each platform, optimal posting times, and how to format content for maximum reach.',
  },
  {
    q: 'Can I get banned for using this?',
    a: 'No. Grothi is 100% white-hat and complies with all platform terms of service. We use official APIs, never fake engagement or spam. Many platforms actually encourage automation tools like ours.',
  },
  {
    q: 'Do I need a credit card for the free trial?',
    a: 'Nope! Start with 100 free credits, no credit card required. Only add payment when you\u2019re ready to upgrade.',
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* ========== NAVIGATION ========== */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center space-x-2">
            <Bot className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-indigo-400 bg-clip-text text-transparent">Grothi</span>
          </Link>
          <nav className="hidden md:flex items-center space-x-8">
            <Link href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Features
            </Link>
            <Link href="#how-it-works" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              How It Works
            </Link>
            <Link href="#platforms" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Platforms
            </Link>
            <Link href="/pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Pricing
            </Link>
            <Link href="#faq" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              FAQ
            </Link>
          </nav>
          <div className="flex items-center space-x-3">
            <Link href="/auth/signin">
              <Button variant="ghost" size="sm">Sign In</Button>
            </Link>
            <Link href="/auth/signup">
              <Button size="sm" className="bg-secondary hover:bg-secondary/90 text-white">
                Start Free Trial <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ========== SECTION 1: HERO ========== */}
      <section className="relative overflow-hidden py-20 md:py-28 lg:py-36">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-indigo-50/50 to-background" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-secondary/5 rounded-full blur-3xl" />

        <div className="container mx-auto px-4 relative">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Text Content */}
            <div className="max-w-2xl">
              <Badge variant="secondary" className="mb-6 text-sm px-4 py-1.5">
                Trusted by 10,000+ marketers worldwide
              </Badge>
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.1]">
                AI Marketing Bot{' '}
                <span className="bg-gradient-to-r from-primary to-indigo-400 bg-clip-text text-transparent">
                  Indistinguishable From a Human
                </span>
              </h1>
              <p className="mt-2 text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight leading-[1.1] text-muted-foreground/80">
                Writes, designs, films, schedules, and engages &mdash; around the clock.
              </p>
              <p className="mt-6 text-lg md:text-xl text-muted-foreground leading-relaxed max-w-xl">
                Grothi creates texts, images, and videos that sound and look like you made them.
                It plans your content strategy, schedules posts, replies to comments, runs email
                campaigns, and learns from analytics to improve every day. Fully automatic or
                under your complete control &mdash; across 17 platforms.
              </p>

              <div className="mt-8 flex flex-col sm:flex-row gap-4">
                <Link href="/auth/signup">
                  <Button size="lg" className="text-lg px-8 h-14 bg-secondary hover:bg-secondary/90 text-white w-full sm:w-auto">
                    Start Free Trial <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link href="#how-it-works">
                  <Button variant="outline" size="lg" className="text-lg px-8 h-14 w-full sm:w-auto">
                    See How It Works
                  </Button>
                </Link>
              </div>

              {/* Trust signals */}
              <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-secondary" /> 100 Free Credits
                </span>
                <span className="flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-secondary" /> No Credit Card Required
                </span>
                <span className="flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-secondary" /> Cancel Anytime
                </span>
              </div>

              {/* Social proof */}
              <div className="mt-6 flex items-center gap-3">
                <div className="flex text-amber-400">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-current" />
                  ))}
                </div>
                <span className="text-sm text-muted-foreground">
                  4.9/5 from 2,500+ reviews
                </span>
              </div>
            </div>

            {/* Right: Dashboard Visual */}
            <div className="hidden lg:block relative">
              <div className="relative rounded-2xl border bg-background/80 backdrop-blur shadow-2xl p-6 transform rotate-1 hover:rotate-0 transition-transform duration-500">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-amber-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                  <span className="ml-2 text-xs text-muted-foreground">Grothi Dashboard</span>
                </div>
                {/* Mock dashboard stats */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <DashboardStat label="Posts Today" value="24" change="+12%" />
                  <DashboardStat label="Engagement" value="8.4K" change="+34%" />
                  <DashboardStat label="New Followers" value="127" change="+18%" />
                </div>
                {/* Mock platform list */}
                <div className="space-y-2">
                  <DashboardRow platform="Instagram" status="Published" engagement="2.1K" />
                  <DashboardRow platform="LinkedIn" status="Scheduled" engagement="--" />
                  <DashboardRow platform="X (Twitter)" status="Published" engagement="890" />
                  <DashboardRow platform="TikTok" status="Creating..." engagement="--" />
                  <DashboardRow platform="Facebook" status="Published" engagement="1.4K" />
                </div>
              </div>
              {/* Floating badge */}
              <div className="absolute -bottom-4 -left-4 bg-secondary text-white rounded-xl px-4 py-2 shadow-lg text-sm font-medium">
                17 Platforms Connected
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========== SECTION 2: PROBLEM/SOLUTION ========== */}
      <section className="py-20 md:py-24 border-t">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold">
              Stop Wasting Time on Social Media.{' '}
              <span className="text-primary">Start Growing.</span>
            </h2>
            <p className="mt-4 text-muted-foreground max-w-2xl mx-auto text-lg">
              You know you need to post consistently. But the reality is painful.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
            {/* Manual Posting */}
            <div className="p-8 rounded-2xl border-2 border-red-200 bg-red-50/50 relative">
              <div className="absolute -top-3 left-6">
                <span className="bg-red-100 text-red-700 text-xs font-bold px-3 py-1 rounded-full">
                  The Old Way
                </span>
              </div>
              <X className="h-10 w-10 text-red-400 mb-4" />
              <h3 className="font-bold text-lg mb-3">Manual Posting</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2"><X className="h-4 w-4 text-red-400 shrink-0 mt-0.5" /> 3+ hours/day wasted</li>
                <li className="flex items-start gap-2"><X className="h-4 w-4 text-red-400 shrink-0 mt-0.5" /> Inconsistent posting</li>
                <li className="flex items-start gap-2"><X className="h-4 w-4 text-red-400 shrink-0 mt-0.5" /> Guessing what works</li>
                <li className="flex items-start gap-2"><X className="h-4 w-4 text-red-400 shrink-0 mt-0.5" /> Can&apos;t scale</li>
                <li className="flex items-start gap-2"><X className="h-4 w-4 text-red-400 shrink-0 mt-0.5" /> Burnout inevitable</li>
              </ul>
            </div>

            {/* Generic AI */}
            <div className="p-8 rounded-2xl border-2 border-amber-200 bg-amber-50/50 relative">
              <div className="absolute -top-3 left-6">
                <span className="bg-amber-100 text-amber-700 text-xs font-bold px-3 py-1 rounded-full">
                  Generic AI Tools
                </span>
              </div>
              <X className="h-10 w-10 text-amber-400 mb-4" />
              <h3 className="font-bold text-lg mb-3">Basic AI Tools</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2"><X className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" /> Robotic content</li>
                <li className="flex items-start gap-2"><X className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" /> No algorithm knowledge</li>
                <li className="flex items-start gap-2"><X className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" /> One-size-fits-all</li>
                <li className="flex items-start gap-2"><X className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" /> Still manual work</li>
                <li className="flex items-start gap-2"><X className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" /> Low engagement</li>
              </ul>
            </div>

            {/* Grothi */}
            <div className="p-8 rounded-2xl border-2 border-secondary bg-emerald-50/50 relative shadow-lg">
              <div className="absolute -top-3 left-6">
                <span className="bg-secondary text-white text-xs font-bold px-3 py-1 rounded-full">
                  Grothi AI Bot
                </span>
              </div>
              <Check className="h-10 w-10 text-secondary mb-4" />
              <h3 className="font-bold text-lg mb-3">Grothi AI Bot</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2"><Check className="h-4 w-4 text-secondary shrink-0 mt-0.5" /> 15 minutes/day</li>
                <li className="flex items-start gap-2"><Check className="h-4 w-4 text-secondary shrink-0 mt-0.5" /> Posts 24/7 automatically</li>
                <li className="flex items-start gap-2"><Check className="h-4 w-4 text-secondary shrink-0 mt-0.5" /> Algorithm-trained</li>
                <li className="flex items-start gap-2"><Check className="h-4 w-4 text-secondary shrink-0 mt-0.5" /> Scales infinitely</li>
                <li className="flex items-start gap-2"><Check className="h-4 w-4 text-secondary shrink-0 mt-0.5" /> Natural, engaging content</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ========== SECTION 3: HOW IT WORKS ========== */}
      <section id="how-it-works" className="py-20 md:py-24 bg-gradient-to-b from-primary/5 to-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <Badge variant="secondary" className="mb-4">Simple Setup</Badge>
            <h2 className="text-3xl md:text-4xl font-bold">
              From Zero to Growing in <span className="text-primary">3 Minutes</span>
            </h2>
            <p className="mt-4 text-muted-foreground text-lg">
              Three steps. No technical skills needed.
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-3 max-w-4xl mx-auto relative">
            {/* Connecting line (desktop only) */}
            <div className="hidden md:block absolute top-14 left-[20%] right-[20%] h-0.5 bg-gradient-to-r from-primary/30 via-primary/50 to-primary/30" />

            <StepCard
              step={1}
              title="Create Your Bot"
              description="Tell it what to promote, set your brand voice, define your audience. Takes 60 seconds."
            />
            <StepCard
              step={2}
              title="Connect 17 Platforms"
              description="One-click OAuth for Facebook, Instagram, X, LinkedIn, TikTok, and 12 more. 2 minutes setup."
            />
            <StepCard
              step={3}
              title="Watch It Learn & Grow"
              description="AI analyzes engagement, optimizes timing, improves content. You just monitor results and relax."
            />
          </div>
          <div className="text-center mt-12">
            <Link href="/auth/signup">
              <Button size="lg" className="bg-secondary hover:bg-secondary/90 text-white h-12 px-8">
                Start Your Free Trial <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ========== SECTION 4: FEATURES ========== */}
      <section id="features" className="py-20 md:py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <Badge variant="secondary" className="mb-4">Everything Your Bot Can Do</Badge>
            <h2 className="text-3xl md:text-4xl font-bold">
              A Complete Marketing Team <span className="text-primary">in One Bot</span>
            </h2>
            <p className="mt-4 text-muted-foreground max-w-2xl mx-auto text-lg">
              Not just a scheduler. Grothi handles every part of your social media
              presence &mdash; from strategy to execution to optimization.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
            <FeatureCard
              icon={<Pen className="h-8 w-8 text-primary" />}
              title="AI Text Generation"
              description="Writes posts, captions, and threads in your brand voice. Adapts tone and format per platform. People can't tell it's AI."
            />
            <FeatureCard
              icon={<Image className="h-8 w-8 text-emerald-500" />}
              title="AI Image Creation"
              description="Generates on-brand visuals sized for each platform. Instagram squares, TikTok verticals, LinkedIn banners &mdash; all automatic."
            />
            <FeatureCard
              icon={<Film className="h-8 w-8 text-violet-500" />}
              title="AI Video Production"
              description="Creates short-form marketing videos for Reels, TikTok, and Shorts. Multiple styles from quick tips to product demos."
            />
            <FeatureCard
              icon={<Brain className="h-8 w-8 text-amber-500" />}
              title="Content Strategy"
              description="Defines what to post, when, and where. Draws from your RSS feeds, goals, and audience data to plan content that performs."
            />
            <FeatureCard
              icon={<Calendar className="h-8 w-8 text-rose-500" />}
              title="Post Scheduler"
              description="Calendar and list view with full control. Go fully automatic with AI-optimized timing, or schedule every post manually. Your choice."
            />
            <FeatureCard
              icon={<Palette className="h-8 w-8 text-sky-500" />}
              title="Media Library & Creative Style"
              description="Upload your own photos and videos. Set your visual preferences once and every AI-generated asset stays on brand."
            />
            <FeatureCard
              icon={<MessageSquare className="h-8 w-8 text-indigo-500" />}
              title="Comment Replies & Engagement"
              description="Responds to comments, likes relevant posts, and builds genuine relationships with your audience. All in your voice."
            />
            <FeatureCard
              icon={<Mail className="h-8 w-8 text-teal-500" />}
              title="Email Marketing"
              description="Professional email campaigns powered by the same AI. Newsletters, drip sequences, and announcements &mdash; one platform for everything."
            />
            <FeatureCard
              icon={<BarChart3 className="h-8 w-8 text-blue-500" />}
              title="Analytics & Self-Learning"
              description="Tracks engagement across all platforms. Your bot evaluates what works and automatically adapts future content for better results."
            />
          </div>
          <div className="text-center mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/features">
              <Button variant="outline" size="lg">
                See All Features in Detail <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ========== SECTION 5: SOCIAL PROOF (Stats + Testimonials) ========== */}
      <section className="py-20 md:py-24 bg-gradient-to-b from-primary/5 to-primary/10">
        <div className="container mx-auto px-4">
          {/* Stats bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto mb-16">
            <StatCard number="10,000+" label="Active Bots" />
            <StatCard number="2.5M+" label="Posts Generated" />
            <StatCard number="17" label="Platforms Supported" />
            <StatCard number="$35,000" label="Avg. Saved/Year" />
          </div>

          {/* Testimonials */}
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold">
              Loved by <span className="text-primary">10,000+ Marketers</span>
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 max-w-6xl mx-auto">
            {TESTIMONIALS.map((t) => (
              <TestimonialCard key={t.name} {...t} />
            ))}
          </div>
        </div>
      </section>

      {/* ========== SECTION 6: PLATFORM SHOWCASE ========== */}
      <section id="platforms" className="py-20 md:py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <Badge variant="secondary" className="mb-4">Multi-Platform</Badge>
            <h2 className="text-3xl md:text-4xl font-bold">
              One Bot. <span className="text-primary">17 Platforms.</span> Infinite Possibilities.
            </h2>
            <p className="mt-4 text-muted-foreground max-w-2xl mx-auto text-lg">
              Why limit yourself to one or two networks? Grothi posts to every platform your audience uses.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-4 max-w-4xl mx-auto">
            {PLATFORMS.map((p) => (
              <div
                key={p.name}
                className="flex items-center gap-2 px-5 py-3 rounded-xl border bg-background hover:border-primary/50 hover:shadow-md transition-all cursor-default"
              >
                <Globe className={`h-5 w-5 ${p.color}`} />
                <span className="font-medium text-sm">{p.name}</span>
              </div>
            ))}
          </div>
          <p className="text-center mt-6 text-sm text-muted-foreground">
            + more platforms added regularly. Request yours in the dashboard.
          </p>
        </div>
      </section>

      {/* ========== SECTION 7: TARGET AUDIENCE ========== */}
      <section className="py-20 md:py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold">
              Built for Marketers, Agencies, and Influencers{' '}
              <span className="text-primary">Who Want More</span>
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 max-w-5xl mx-auto">
            <PersonaCard
              icon={<ShoppingCart className="h-7 w-7 text-primary" />}
              title="Small Business Owners"
              description="No time for social media? Let Grothi handle it while you focus on your business."
            />
            <PersonaCard
              icon={<Megaphone className="h-7 w-7 text-violet-500" />}
              title="Marketing Agencies"
              description="Manage 50 clients without hiring 50 people. Scale infinitely without overhead."
            />
            <PersonaCard
              icon={<Sparkles className="h-7 w-7 text-amber-500" />}
              title="Content Creators"
              description="Grow faster, engage deeper, monetize more. Let AI handle the grind."
            />
            <PersonaCard
              icon={<Target className="h-7 w-7 text-secondary" />}
              title="E-commerce Brands"
              description="Turn social media into a sales machine. Generate leads, drive traffic, close deals."
            />
          </div>
        </div>
      </section>

      {/* ========== SECTION 8: PRICING TEASER ========== */}
      <section className="py-20 md:py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold">
              From <span className="text-primary">$79/Month</span>. Replace Your $3,000 Agency.
            </h2>
            <p className="mt-4 text-muted-foreground text-lg">
              Simple, transparent pricing. Start free. Scale as you grow.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3 max-w-4xl mx-auto">
            <PricingTeaser
              name="Starter"
              price={29}
              description="Perfect for testing"
              features={['1 bot', '5 platforms', 'Basic features']}
            />
            <PricingTeaser
              name="Growth"
              price={79}
              popular
              description="For serious growth"
              features={['3 bots', '10 platforms', 'AI optimization']}
            />
            <PricingTeaser
              name="Pro"
              price={199}
              description="For agencies & power users"
              features={['Unlimited bots', 'All 17 platforms', 'White-label']}
            />
          </div>
          <div className="text-center mt-8 flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-secondary" /> No credit card required</span>
            <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-secondary" /> Cancel anytime</span>
            <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-secondary" /> 100 free credits to start</span>
          </div>
          <div className="text-center mt-6">
            <Link href="/pricing">
              <Button variant="outline" size="lg">
                View Full Pricing <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ========== SECTION 9: FAQ ========== */}
      <section id="faq" className="py-20 md:py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold">
              Questions? <span className="text-primary">We&apos;ve Got Answers.</span>
            </h2>
          </div>
          <div className="max-w-3xl mx-auto space-y-4">
            {FAQS.map((faq) => (
              <FAQItem key={faq.q} question={faq.q} answer={faq.a} />
            ))}
          </div>
          <div className="text-center mt-8">
            <Link href="/faq">
              <Button variant="outline">
                See All FAQs <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ========== SECTION 10: FINAL CTA ========== */}
      <section className="py-20 md:py-28 bg-gradient-to-br from-primary/10 via-indigo-100/30 to-secondary/10 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
        <div className="container mx-auto px-4 text-center relative">
          <h2 className="text-3xl md:text-5xl font-bold max-w-3xl mx-auto leading-tight">
            Ready to <span className="text-primary">10X</span> Your Social Media Growth?
          </h2>
          <p className="mt-6 text-muted-foreground max-w-lg mx-auto text-lg">
            Join 10,000+ marketers who save 20 hours/week and get better results.
          </p>
          <Link href="/auth/signup">
            <Button size="lg" className="mt-8 text-lg px-12 h-16 bg-secondary hover:bg-secondary/90 text-white shadow-xl shadow-secondary/20">
              Start Free Trial <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
          <div className="mt-8 flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-secondary" /> 100 free credits</span>
            <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-secondary" /> No credit card required</span>
            <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-secondary" /> Setup in 3 minutes</span>
            <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-secondary" /> Cancel anytime</span>
          </div>
        </div>
      </section>

      {/* ========== SECTION 11: FOOTER ========== */}
      <footer className="border-t py-16 bg-background">
        <div className="container mx-auto px-4">
          <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-5">
            {/* Brand */}
            <div className="md:col-span-1">
              <div className="flex items-center space-x-2 mb-4">
                <Bot className="h-7 w-7 text-primary" />
                <span className="text-lg font-bold bg-gradient-to-r from-primary to-indigo-400 bg-clip-text text-transparent">Grothi</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                AI marketing bot that generates content, posts to 17 platforms, and learns from results.
              </p>
            </div>

            {/* Product */}
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li><Link href="/features" className="hover:text-foreground transition-colors">Features</Link></li>
                <li><Link href="/pricing" className="hover:text-foreground transition-colors">Pricing</Link></li>
                <li><Link href="#how-it-works" className="hover:text-foreground transition-colors">How It Works</Link></li>
                <li><Link href="#platforms" className="hover:text-foreground transition-colors">Platforms</Link></li>
              </ul>
            </div>

            {/* Resources */}
            <div>
              <h4 className="font-semibold mb-4">Resources</h4>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li><Link href="/faq" className="hover:text-foreground transition-colors">FAQ</Link></li>
                <li><Link href="/contact" className="hover:text-foreground transition-colors">Help Center</Link></li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li><Link href="/about" className="hover:text-foreground transition-colors">About Us</Link></li>
                <li><Link href="/contact" className="hover:text-foreground transition-colors">Contact</Link></li>
                <li><a href="mailto:support@grothi.com" className="hover:text-foreground transition-colors">support@grothi.com</a></li>
              </ul>
            </div>

            {/* Legal */}
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

function DashboardStat({ label, value, change }: { label: string; value: string; change: string }) {
  return (
    <div className="bg-muted/30 rounded-lg p-3 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-xs text-secondary font-medium">{change}</p>
    </div>
  );
}

function DashboardRow({ platform, status, engagement }: { platform: string; status: string; engagement: string }) {
  const statusColor = status === 'Published' ? 'text-secondary' : status === 'Scheduled' ? 'text-blue-500' : 'text-amber-500';
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/20 text-sm">
      <span className="font-medium">{platform}</span>
      <span className={`text-xs font-medium ${statusColor}`}>{status}</span>
      <span className="text-xs text-muted-foreground">{engagement}</span>
    </div>
  );
}

function StepCard({ step, title, description }: { step: number; title: string; description: string }) {
  return (
    <div className="text-center relative z-10">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground text-2xl font-bold shadow-lg shadow-primary/20">
        {step}
      </div>
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
    </div>
  );
}

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

function StatCard({ number, label }: { number: string; label: string }) {
  return (
    <div className="text-center p-6 rounded-2xl bg-background border shadow-sm">
      <div className="text-3xl md:text-4xl font-bold text-primary">{number}</div>
      <p className="text-sm text-muted-foreground mt-1 font-medium">{label}</p>
    </div>
  );
}

function TestimonialCard({ quote, name, role, stars }: { quote: string; name: string; role: string; stars: number }) {
  return (
    <Card className="border hover:shadow-lg transition-shadow">
      <CardContent className="pt-6">
        <div className="flex text-amber-400 mb-3">
          {[...Array(stars)].map((_, i) => (
            <Star key={i} className="h-4 w-4 fill-current" />
          ))}
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">
          &ldquo;{quote}&rdquo;
        </p>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-indigo-400 flex items-center justify-center text-white font-bold text-sm">
            {name.charAt(0)}
          </div>
          <div>
            <p className="text-sm font-semibold">{name}</p>
            <p className="text-xs text-muted-foreground">{role}</p>
          </div>
        </div>
      </CardContent>
    </Card>
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

function PricingTeaser({
  name,
  price,
  popular,
  description,
  features,
}: {
  name: string;
  price: number;
  popular?: boolean;
  description: string;
  features: string[];
}) {
  return (
    <Card className={`relative ${popular ? 'border-primary shadow-xl scale-105' : 'hover:shadow-lg'} transition-all`}>
      {popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="bg-primary text-white shadow-lg">
            <Star className="h-3 w-3 mr-1 fill-current" /> Most Popular
          </Badge>
        </div>
      )}
      <CardHeader className="text-center pb-2 pt-8">
        <CardTitle className="text-lg">{name}</CardTitle>
        <div className="mt-3">
          <span className="text-4xl font-bold">${price}</span>
          <span className="text-muted-foreground">/month</span>
        </div>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-2">
          {features.map((f) => (
            <li key={f} className="flex items-center gap-2 text-sm">
              <Check className="h-4 w-4 text-secondary shrink-0" />
              {f}
            </li>
          ))}
        </ul>
        <Link href="/auth/signup" className="block">
          <Button
            variant={popular ? 'default' : 'outline'}
            className={`w-full ${popular ? 'bg-secondary hover:bg-secondary/90 text-white' : ''}`}
          >
            Start Free Trial
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  return (
    <details className="group rounded-xl border bg-background">
      <summary className="flex cursor-pointer items-center justify-between p-5 font-semibold text-left hover:text-primary transition-colors">
        {question}
        <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0 ml-4 group-open:rotate-180 transition-transform" />
      </summary>
      <div className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed">
        {answer}
      </div>
    </details>
  );
}
