import { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Bot, ArrowRight } from 'lucide-react';

export const metadata: Metadata = {
  title: 'FAQ',
  description: 'Frequently asked questions about Grothi AI marketing bots - pricing, safety, platforms, and more.',
};

const faqs = [
  {
    q: 'What is Grothi?',
    a: 'Grothi is a SaaS platform where you create AI-powered marketing bots. Each bot can post content, engage with audiences, and grow your brand across multiple social media platforms - all autonomously.',
  },
  {
    q: 'How does the credit system work?',
    a: '1 credit = $0.01. Each action your bot takes costs a specific number of credits (e.g., posting costs 2 credits, AI content generation costs 5 credits). Buy credits when you need them - no monthly subscriptions.',
  },
  {
    q: 'Is it safe? Will my accounts get banned?',
    a: 'We take safety extremely seriously. Every bot action goes through Constitutional AI safety guardrails, platform compliance checks, and rate limiting. We also have automatic ban detection that pauses your bot instantly if any issue is detected.',
  },
  {
    q: 'What platforms are supported?',
    a: 'Currently: Mastodon, Facebook, Telegram, Discord, Moltbook, Bluesky, Twitter, Reddit, and Dev.to. We regularly add new platforms.',
  },
  {
    q: 'Do I need my own API keys?',
    a: 'Yes, you bring your own API keys for each platform and for the AI service (Anthropic Claude). This gives you full control and ensures your accounts are yours. All keys are encrypted with AES-256.',
  },
  {
    q: 'How does the AI learn?',
    a: 'Your bot tracks engagement metrics (likes, comments, shares) for every post. Over time, it learns which content types, topics, and posting times work best for your audience and adjusts its strategy.',
  },
  {
    q: 'What are the safety levels?',
    a: 'Conservative: Max 2 posts/day, no brand mentions, maximum safety. Moderate (default): 3-5 posts/day, careful brand mentions. Aggressive: Up to 10/day, more engagement, still white-hat.',
  },
  {
    q: 'Can I try it for free?',
    a: 'Yes! Every new account gets 100 free credits - enough for about 10-15 posts. No credit card required.',
  },
  {
    q: 'How do I get help?',
    a: 'Contact us at contact@grothi.com or use the contact form. We typically respond within 24 hours.',
  },
];

export default function FAQPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center space-x-2">
            <Bot className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold">Grothi</span>
          </Link>
          <nav className="hidden md:flex items-center space-x-6">
            <Link href="/features" className="text-sm text-muted-foreground hover:text-foreground">Features</Link>
            <Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground">Pricing</Link>
            <Link href="/about" className="text-sm text-muted-foreground hover:text-foreground">About</Link>
            <Link href="/faq" className="text-sm font-medium">FAQ</Link>
          </nav>
          <div className="flex items-center space-x-3">
            <Link href="/auth/signin"><Button variant="ghost" size="sm">Sign In</Button></Link>
            <Link href="/auth/signup"><Button size="sm">Get Started</Button></Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="py-16 text-center">
          <h1 className="text-4xl font-bold">Frequently Asked Questions</h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Everything you need to know about Grothi.
          </p>
        </section>

        <section className="pb-20 px-4 max-w-3xl mx-auto space-y-4">
          {faqs.map((faq, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <h3 className="font-semibold text-lg mb-2">{faq.q}</h3>
                <p className="text-muted-foreground">{faq.a}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="py-16 text-center bg-primary/5 px-4">
          <h2 className="text-2xl font-bold">Still have questions?</h2>
          <div className="mt-6 flex gap-4 justify-center">
            <Link href="/contact"><Button variant="outline">Contact Us</Button></Link>
            <Link href="/auth/signup"><Button>Get Started Free <ArrowRight className="ml-2 h-4 w-4" /></Button></Link>
          </div>
        </section>
      </main>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        &copy; {new Date().getFullYear()} Grothi. All rights reserved.
      </footer>
    </div>
  );
}
