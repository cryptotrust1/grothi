import { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Bot,
  ShoppingCart,
  Users,
  Megaphone,
  Building2,
  ArrowRight,
  Check,
  AlertCircle,
  Lightbulb,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Use Cases - AI Social Media Automation for Business',
  description:
    'See how businesses use Grothi for AI social media automation. Use cases for ecommerce, content creators, influencers, marketing agencies, and small businesses.',
  keywords: [
    'AI social media automation for business',
    'social media bot for ecommerce',
    'AI marketing for influencers',
    'social media automation agency',
    'AI marketing bot for small business',
  ],
};

const useCases = [
  {
    icon: ShoppingCart,
    iconColor: 'text-primary',
    title: 'E-commerce & Online Stores',
    problem:
      'You need consistent product visibility across multiple platforms to drive sales, but hiring a full marketing team is out of budget. Manually posting product photos, writing descriptions, running seasonal campaigns, and keeping up with trends on five different platforms takes hours every day -- time you should be spending on inventory, fulfillment, and customer support.',
    solution:
      'Create a Grothi bot trained on your product catalog and brand voice. It generates product-focused content tailored for each platform -- carousel posts for Instagram, shoppable pins for Pinterest, short videos for TikTok, and product announcements for Facebook and Twitter. Set it once and your entire product line gets consistent, daily exposure without lifting a finger.',
    benefits: [
      'Daily product posts across all shopping-relevant platforms automatically',
      'Seasonal and holiday campaigns generated and scheduled ahead of time',
      'Cross-platform consistency in branding, pricing, and product messaging',
      'Hashtag optimization tailored to each platform for maximum product discovery',
      'Engagement with potential customers through automated replies and likes',
    ],
    platforms: ['Instagram', 'Facebook', 'Pinterest', 'TikTok', 'Twitter'],
  },
  {
    icon: Users,
    iconColor: 'text-violet-500',
    title: 'Content Creators & Influencers',
    problem:
      'Creating great content is your full-time job. But distributing that content across every platform -- reformatting it, writing platform-specific captions, posting at optimal times, and engaging with comments -- eats into the time you should spend actually creating. You know cross-platform presence drives growth, but you can only be in so many places at once.',
    solution:
      'Your Grothi bot takes your core content and adapts it for every platform automatically. A YouTube video becomes a TikTok teaser, an Instagram Reel, a Twitter thread, and a Threads post -- each with platform-native formatting and captions. The bot maintains your posting schedule even when you are on a creative break, so your audience never goes cold.',
    benefits: [
      'Cross-platform growth without cross-platform effort',
      'Consistent branding and voice across TikTok, Instagram, YouTube, and more',
      'Automated posting schedule that keeps your audience engaged daily',
      'More time freed up for actual content creation and collaborations',
      'Engagement automation that replies and interacts with your community',
    ],
    platforms: ['TikTok', 'Instagram', 'YouTube', 'Twitter', 'Threads'],
  },
  {
    icon: Megaphone,
    iconColor: 'text-amber-500',
    title: 'Marketing Agencies & Freelancers',
    problem:
      'Managing social media for multiple clients means juggling dozens of accounts, each with different brand guidelines, posting schedules, content strategies, and platform preferences. Context-switching between clients is exhausting and error-prone -- one wrong post on the wrong account can damage a client relationship. Scaling your services means hiring more people, which cuts into margins.',
    solution:
      'Create one Grothi bot per client, all managed from a single dashboard. Each bot is configured with the client\'s brand voice, goals, and target platforms. You get a bird\'s-eye view of all client activity, performance metrics, and content calendars in one place. Scale from 5 clients to 50 without adding headcount.',
    benefits: [
      'One bot per client with individual brand voice and strategy settings',
      'Single dashboard to monitor and manage all client accounts',
      'Scale your agency operations without proportionally scaling your team',
      'Consistent, reliable results across every client account',
      'Detailed analytics and reports you can share directly with clients',
    ],
    platforms: ['All 17 supported platforms'],
  },
  {
    icon: Building2,
    iconColor: 'text-emerald-500',
    title: 'Small & Medium Businesses',
    problem:
      'You know your business needs a social media presence -- your customers expect it, your competitors have it, and it drives real leads. But you are running the business. You do not have a marketing department, and you do not have 6+ hours a week to write posts, design graphics, and respond to comments. The result: an outdated Facebook page and an Instagram account that has not posted in months.',
    solution:
      'Set up a Grothi bot in under 5 minutes. Tell it what your business does, who your customers are, and what you want to achieve. The bot handles daily posting, audience engagement, and content creation across your key platforms. You get a professional social media presence that looks like you hired a full-time marketer -- without the salary.',
    benefits: [
      'Professional social media presence without a marketing hire',
      'Daily posts and engagement that keep your brand visible and relevant',
      'AI-generated content that matches your business tone and goals',
      'Set it up once and let it run -- minimal ongoing time investment',
      'Track performance with simple analytics to see what is working',
    ],
    platforms: ['Facebook', 'LinkedIn', 'Instagram', 'Twitter'],
  },
];

export default function UseCasesPage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
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
            <Link href="/how-it-works" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              How It Works
            </Link>
            <Link href="/use-cases" className="text-sm font-medium">
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
        <section className="py-16 md:py-20 text-center bg-gradient-to-b from-primary/5 to-background">
          <div className="container mx-auto px-4">
            <Badge variant="secondary" className="mb-6">Real solutions for real businesses</Badge>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight max-w-3xl mx-auto">
              AI Social Media Automation for Every Business
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Whether you sell products online, create content, run an agency, or manage a local business
              -- Grothi adapts to your goals and handles social media so you can focus on what you do best.
            </p>
          </div>
        </section>

        {/* Use Cases */}
        <section className="py-16 md:py-20">
          <div className="container mx-auto px-4 max-w-5xl space-y-20">
            {useCases.map((useCase, index) => (
              <div key={useCase.title} className="space-y-8">
                {/* Title Bar */}
                <div className="flex items-center gap-4">
                  <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-muted ${useCase.iconColor}`}>
                    <useCase.icon className="h-7 w-7" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Use Case {index + 1}</p>
                    <h2 className="text-2xl md:text-3xl font-bold">{useCase.title}</h2>
                  </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  {/* Problem */}
                  <Card className="border-destructive/20">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-5 w-5 text-destructive/70" />
                        <CardTitle className="text-lg">The Problem</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {useCase.problem}
                      </p>
                    </CardContent>
                  </Card>

                  {/* Solution */}
                  <Card className="border-primary/20">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <Lightbulb className="h-5 w-5 text-primary" />
                        <CardTitle className="text-lg">The Grothi Solution</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {useCase.solution}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Benefits + Platforms */}
                <Card>
                  <CardContent className="pt-6">
                    <div className="grid gap-6 md:grid-cols-[1fr_auto]">
                      <div>
                        <h3 className="font-semibold mb-4">What you get</h3>
                        <ul className="space-y-3">
                          {useCase.benefits.map((benefit) => (
                            <li key={benefit} className="flex gap-3 text-sm">
                              <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                              <span>{benefit}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="md:border-l md:pl-6 md:min-w-[180px]">
                        <h3 className="font-semibold mb-4">Key platforms</h3>
                        <div className="flex flex-wrap gap-2">
                          {useCase.platforms.map((platform) => (
                            <Badge key={platform} variant="outline" className="text-xs">
                              {platform}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Separator between use cases (not after last) */}
                {index < useCases.length - 1 && (
                  <div className="border-b pt-4" />
                )}
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 md:py-20 bg-gradient-to-b from-primary/10 to-primary/5">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl md:text-4xl font-bold max-w-2xl mx-auto">
              Ready to Automate Your Social Media?
            </h2>
            <p className="mt-6 text-muted-foreground max-w-lg mx-auto text-lg leading-relaxed">
              Set up your first bot in under 5 minutes. Start with 100 free credits.
              No credit card required. No commitment.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/auth/signup">
                <Button size="lg" className="text-lg px-8 h-14 bg-secondary hover:bg-secondary/90 text-white">
                  Start Free Trial <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/pricing">
                <Button variant="outline" size="lg" className="text-lg px-8 h-12">
                  View Pricing
                </Button>
              </Link>
            </div>
            <div className="mt-6 flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-secondary" /> 100 free credits</span>
              <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-secondary" /> No credit card</span>
              <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-secondary" /> 17 platforms</span>
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
