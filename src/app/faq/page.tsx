import { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bot, ArrowRight, Check } from 'lucide-react';

export const metadata: Metadata = {
  title: 'FAQ',
  description: 'Frequently asked questions about Grothi: pricing, platforms, safety, AI learning, credits, security, and how it compares to Hootsuite and Buffer.',
  openGraph: {
    title: 'FAQ | Grothi',
    description: 'Everything you need to know about Grothi AI marketing bots -- pricing, platforms, safety, credits, and more.',
    url: 'https://grothi.com/faq',
  },
  alternates: {
    canonical: '/faq',
  },
};

const faqs = [
  {
    q: 'What is Grothi?',
    a: 'Grothi is an AI marketing bot platform. You create a bot, describe your business and audience, connect your social media accounts, and the bot takes over. It generates original content using Claude AI, creates images with Flux AI, produces short-form videos, publishes posts to your connected platforms, engages with your audience through replies and likes, and learns from engagement data to improve its strategy over time. It runs 24/7 across up to 17 platforms from a single dashboard.',
  },
  {
    q: 'How is Grothi different from Hootsuite or Buffer?',
    a: 'Hootsuite and Buffer are scheduling tools. You write the content, and they help you queue it up across platforms. Grothi generates the content for you -- text posts, images, and videos -- publishes it, engages with your audience, and then uses reinforcement learning to figure out what works best and adjust its approach. It also supports 17 platforms (more than most schedulers), includes ban detection and safety guardrails, and uses pay-per-use pricing instead of monthly subscriptions. The difference is the gap between a calendar app and having someone on your team.',
  },
  {
    q: 'What platforms are supported?',
    a: 'Grothi supports 17 platforms: Facebook, Instagram, Twitter (X), LinkedIn, TikTok, YouTube, Reddit, Pinterest, Threads, Bluesky, Mastodon, Discord, Telegram, Medium, Dev.to, Nostr, and Moltbook. Your bot formats content specifically for each platform -- different character limits, image dimensions, hashtag conventions, and posting styles. You can connect any combination of these and add or remove platforms at any time.',
  },
  {
    q: 'How does the credit system work?',
    a: 'Grothi uses credit-based pricing where 1 credit equals $0.01. Every action your bot takes costs a specific number of credits. You buy credits in advance and they are deducted as your bot works. There is no monthly subscription -- you pay for what you use. Every new account gets 100 free credits on signup (no credit card required), which is enough to test out content generation and posting across a few platforms.',
  },
  {
    q: 'What does each action cost?',
    a: 'AI content generation costs 5 credits per post. Publishing to a platform costs 2 credits. Replying to a mention costs 3 credits. Liking or favouriting costs 1 credit. AI image generation costs 3 credits. AI video generation costs 8 credits. These costs mean that a typical cycle of generating a post and publishing it to one platform costs 7 credits, or $0.07.',
  },
  {
    q: 'Is my account safe from bans?',
    a: 'We built Grothi with account safety as a core priority, not an afterthought. Every piece of content your bot generates passes through Constitutional AI safety guardrails before publishing. The platform enforces rate limiting to stay within each network\'s acceptable use thresholds. Built-in ban detection monitors for platform flags, suspensions, and rate limit warnings, and automatically pauses your bot if any issue is detected. Three safety levels (conservative, moderate, aggressive) let you control how actively your bot operates. White-hat practices only -- no fake engagement, no spam, no purchased followers.',
  },
  {
    q: 'How does the AI learn?',
    a: 'Your bot uses a reinforcement learning engine that operates across four dimensions: posting time, content type, tone and style, and hashtag strategy. After each post is published, the bot collects engagement data -- likes, comments, shares, saves, click-throughs -- and uses it to update its internal model of what works for your specific audience. Over time, it shifts its strategy toward the combinations that drive the highest engagement. This happens automatically, continuously, without any manual intervention from you.',
  },
  {
    q: 'Do I need my own API keys?',
    a: 'Yes. Grothi uses a bring-your-own-key (BYOK) model. You provide your own API credentials for the platforms you want to connect and for the AI services. This means you own your accounts, you control your access, and there is no shared credential risk between users. All API keys are encrypted with AES-256-GCM before being stored in our database. Keys are never stored in plaintext and are only decrypted at the moment they are needed for an API call.',
  },
  {
    q: 'Can I generate images and videos?',
    a: 'Yes. Grothi generates images using Flux AI with platform-specific dimensions -- Instagram squares (1080x1080), TikTok verticals (1080x1920), LinkedIn banners, Pinterest pins, and more. You define your visual style preferences once, and every generated image stays on brand. For video, Grothi uses dual video providers to create short-form marketing clips in vertical (9:16), square (1:1), and landscape (16:9) formats. Video styles include quick tips, product demos, explainers, storytelling, and more.',
  },
  {
    q: 'What if I run out of credits?',
    a: 'If your credit balance hits zero, your bot pauses automatically. No actions are taken, no charges are incurred, and your connected accounts are unaffected. You can top up your credits at any time through the dashboard, and your bot will resume where it left off. There are no penalties or account restrictions for running out of credits.',
  },
  {
    q: 'How many bots can I create?',
    a: 'There is no limit on the number of bots you can create. Each bot operates independently with its own connected platforms, content strategy, creative style preferences, posting schedule, and learning data. This makes Grothi practical for agencies managing multiple clients, businesses with distinct brands, or anyone who wants separate strategies for different audiences.',
  },
  {
    q: 'Is there a free trial?',
    a: 'Every new account receives 100 free credits on signup. No credit card is required to create an account or to use those credits. That is enough to generate several pieces of content, publish posts, and see how the platform works before spending anything. If you decide it is not for you, there is nothing to cancel.',
  },
  {
    q: 'How do I cancel?',
    a: 'There is no subscription to cancel. Grothi uses pay-per-use pricing. You buy credits when you need them, and your bot uses them as it works. If you want to stop, just stop buying credits. Your bot will pause when the balance reaches zero. Your account, data, and settings remain available if you decide to come back later.',
  },
  {
    q: 'Is my data secure?',
    a: 'All API keys and platform credentials are encrypted with AES-256-GCM, a military-grade encryption standard. The platform supports TOTP-based two-factor authentication. Your data is not shared with third parties. Session tokens use httpOnly, secure cookies with 30-day expiration. Passwords are hashed with bcrypt using 12 salt rounds. We treat your credentials as if they were our own.',
  },
];

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map((faq) => ({
    '@type': 'Question',
    name: faq.q,
    acceptedAnswer: {
      '@type': 'Answer',
      text: faq.a,
    },
  })),
};

export default function FAQPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* JSON-LD FAQPage Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

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
            <Link href="/faq" className="text-sm font-medium transition-colors">
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
              14 questions answered
            </Badge>
            <h1 className="mx-auto max-w-4xl text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl leading-[1.1]">
              Frequently Asked Questions
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg md:text-xl text-muted-foreground leading-relaxed">
              Everything you need to know about how Grothi works, what it costs,
              and how it keeps your accounts safe.
            </p>
          </div>
        </section>

        {/* FAQ List */}
        <section className="py-20 md:py-24">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto space-y-5">
              {faqs.map((faq, i) => (
                <Card key={i} className="border shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="pt-6 pb-6">
                    <h3 className="font-semibold text-lg mb-3">{faq.q}</h3>
                    <p className="text-muted-foreground leading-relaxed text-sm">{faq.a}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Quick Reference */}
        <section className="py-16 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto">
              <h2 className="text-2xl font-bold text-center mb-8">Quick Reference</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="p-4 rounded-lg border bg-background">
                  <h4 className="font-semibold text-sm mb-3">Action Costs</h4>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex justify-between"><span>AI Content Generation</span><span className="font-medium text-foreground">5 credits</span></li>
                    <li className="flex justify-between"><span>Post to Platform</span><span className="font-medium text-foreground">2 credits</span></li>
                    <li className="flex justify-between"><span>Reply to Mention</span><span className="font-medium text-foreground">3 credits</span></li>
                    <li className="flex justify-between"><span>Like / Favourite</span><span className="font-medium text-foreground">1 credit</span></li>
                    <li className="flex justify-between"><span>AI Image Generation</span><span className="font-medium text-foreground">3 credits</span></li>
                    <li className="flex justify-between"><span>AI Video Generation</span><span className="font-medium text-foreground">8 credits</span></li>
                  </ul>
                </div>
                <div className="p-4 rounded-lg border bg-background">
                  <h4 className="font-semibold text-sm mb-3">Key Facts</h4>
                  <ul className="space-y-2 text-sm">
                    <li className="flex gap-2.5">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">1 credit = $0.01</span>
                    </li>
                    <li className="flex gap-2.5">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">100 free credits on signup</span>
                    </li>
                    <li className="flex gap-2.5">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">No credit card required</span>
                    </li>
                    <li className="flex gap-2.5">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">17 platforms supported</span>
                    </li>
                    <li className="flex gap-2.5">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">Unlimited bots per account</span>
                    </li>
                    <li className="flex gap-2.5">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">AES-256-GCM encryption</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 md:py-28 bg-gradient-to-b from-primary/10 to-primary/5">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl md:text-4xl font-bold max-w-2xl mx-auto">
              Still Have Questions?
            </h2>
            <p className="mt-6 text-muted-foreground max-w-lg mx-auto text-lg">
              Reach out to us directly, or create a free account and see for yourself.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/auth/signup">
                <Button size="lg" className="text-lg px-8 h-12">
                  Start Automating Free <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/contact">
                <Button variant="outline" size="lg" className="text-lg px-8 h-12">
                  Contact Us
                </Button>
              </Link>
            </div>
            <div className="mt-6 flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-primary" /> 100 free credits</span>
              <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-primary" /> No credit card</span>
              <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-primary" /> Nothing to cancel</span>
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
