import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Bot,
  Shield,
  Zap,
  TrendingUp,
  Globe,
  Brain,
  CreditCard,
  ArrowRight,
  Check,
  Star,
} from 'lucide-react';

export default function LandingPage() {
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
            <Link href="/pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Pricing
            </Link>
            <Link href="/about" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              About
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
              <Button size="sm">
                Get Started <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-primary/5 to-background py-20 md:py-32">
        <div className="container mx-auto px-4 text-center">
          <Badge variant="secondary" className="mb-4">
            AI-Powered Marketing on Autopilot
          </Badge>
          <h1 className="mx-auto max-w-4xl text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            Your AI Marketing Bot,{' '}
            <span className="text-primary">Working 24/7</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Create a self-learning AI bot that posts engaging content across all your social media
            platforms. White-hat only, ban-protected, and fully autonomous.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/auth/signup">
              <Button size="lg" className="text-lg px-8">
                Start Free <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/features">
              <Button variant="outline" size="lg" className="text-lg px-8">
                See How It Works
              </Button>
            </Link>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            100 free credits on signup. No credit card required.
          </p>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold">Everything You Need for AI Marketing</h2>
            <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
              Powerful features that make your marketing effortless and effective.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={<Brain className="h-10 w-10 text-primary" />}
              title="Self-Learning AI"
              description="Your bot learns from engagement metrics and continuously improves its content strategy."
            />
            <FeatureCard
              icon={<Globe className="h-10 w-10 text-primary" />}
              title="Multi-Platform"
              description="Post to Mastodon, Facebook, Telegram, Discord, Bluesky, and more from one dashboard."
            />
            <FeatureCard
              icon={<Shield className="h-10 w-10 text-secondary" />}
              title="White-Hat Only"
              description="Constitutional AI safety guardrails ensure every post is compliant and brand-safe."
            />
            <FeatureCard
              icon={<Zap className="h-10 w-10 text-accent" />}
              title="Content Reactor"
              description="AI generates fresh content from RSS feeds, trending topics, and your brand knowledge."
            />
            <FeatureCard
              icon={<TrendingUp className="h-10 w-10 text-primary" />}
              title="Real-Time Analytics"
              description="Track engagement, measure ROI, and watch your bot improve in real-time."
            />
            <FeatureCard
              icon={<CreditCard className="h-10 w-10 text-secondary" />}
              title="Pay Per Use"
              description="Credit-based pricing. Only pay for what your bot actually does. No monthly fees."
            />
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold">Up and Running in 5 Minutes</h2>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            <StepCard
              step={1}
              title="Create Your Bot"
              description="Name it, tell it what to promote, and set your brand knowledge base."
            />
            <StepCard
              step={2}
              title="Connect Platforms"
              description="Add your API keys for each social network. Test connection instantly."
            />
            <StepCard
              step={3}
              title="Launch & Relax"
              description="Your bot starts posting, engaging, and learning. Monitor everything from your dashboard."
            />
          </div>
        </div>
      </section>

      {/* Pricing Preview */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold">Simple, Credit-Based Pricing</h2>
            <p className="mt-4 text-muted-foreground">
              1 credit = $0.01. Buy what you need, when you need it.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 max-w-5xl mx-auto">
            <PricingCard name="Starter" credits={1000} price={10} />
            <PricingCard name="Growth" credits={5500} price={45} popular />
            <PricingCard name="Pro" credits={17000} price={120} />
            <PricingCard name="Enterprise" credits={60000} price={350} />
          </div>
          <div className="text-center mt-8">
            <Link href="/pricing">
              <Button variant="outline">View Full Pricing Details</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold">Ready to Automate Your Marketing?</h2>
          <p className="mt-4 text-muted-foreground max-w-lg mx-auto">
            Join hundreds of businesses using AI to grow their social media presence.
          </p>
          <Link href="/auth/signup">
            <Button size="lg" className="mt-8 text-lg px-8">
              Get Started Free <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="grid gap-8 md:grid-cols-4">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <Bot className="h-6 w-6 text-primary" />
                <span className="font-bold">Grothi</span>
              </div>
              <p className="text-sm text-muted-foreground">
                AI-Powered Marketing on Autopilot. White-hat, self-learning bots for your brand.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/features" className="hover:text-foreground">Features</Link></li>
                <li><Link href="/pricing" className="hover:text-foreground">Pricing</Link></li>
                <li><Link href="/faq" className="hover:text-foreground">FAQ</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/about" className="hover:text-foreground">About</Link></li>
                <li><Link href="/contact" className="hover:text-foreground">Contact</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/terms" className="hover:text-foreground">Terms of Service</Link></li>
                <li><Link href="/privacy" className="hover:text-foreground">Privacy Policy</Link></li>
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

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="mb-2">{icon}</div>
        <CardTitle className="text-xl">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function StepCard({ step, title, description }: { step: number; title: string; description: string }) {
  return (
    <div className="text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground text-xl font-bold">
        {step}
      </div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
}

function PricingCard({ name, credits, price, popular }: { name: string; credits: number; price: number; popular?: boolean }) {
  return (
    <Card className={popular ? 'border-primary shadow-lg relative' : ''}>
      {popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="bg-primary"><Star className="h-3 w-3 mr-1" /> Most Popular</Badge>
        </div>
      )}
      <CardHeader className="text-center">
        <CardTitle className="text-lg">{name}</CardTitle>
        <div className="mt-2">
          <span className="text-3xl font-bold">${price}</span>
        </div>
        <p className="text-sm text-muted-foreground">
          {credits.toLocaleString()} credits
        </p>
      </CardHeader>
      <CardContent className="text-center">
        <Link href="/auth/signup">
          <Button variant={popular ? 'default' : 'outline'} className="w-full">
            Get Started
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
