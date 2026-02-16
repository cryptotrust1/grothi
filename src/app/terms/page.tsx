import { Metadata } from 'next';
import Link from 'next/link';
import { Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Terms of Service',
};

export default function TermsPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center space-x-2">
            <Bot className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold">Grothi</span>
          </Link>
          <div className="flex items-center space-x-3">
            <Link href="/auth/signin"><Button variant="ghost" size="sm">Sign In</Button></Link>
            <Link href="/auth/signup"><Button size="sm">Get Started</Button></Link>
          </div>
        </div>
      </header>

      <main className="flex-1 py-16 px-4">
        <div className="max-w-3xl mx-auto prose prose-slate">
          <h1 className="text-3xl font-bold mb-8">Terms of Service</h1>
          <p className="text-muted-foreground mb-6">Last updated: February 2026</p>

          <h2 className="text-xl font-semibold mt-8 mb-4">1. Acceptance of Terms</h2>
          <p className="text-muted-foreground mb-4">
            By accessing or using Grothi (&quot;the Service&quot;), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-4">2. Description of Service</h2>
          <p className="text-muted-foreground mb-4">
            Grothi provides a platform for creating and managing AI-powered marketing bots. Users provide their own API keys and are responsible for their bot&apos;s actions on third-party platforms.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-4">3. User Responsibilities</h2>
          <p className="text-muted-foreground mb-4">
            You are responsible for: maintaining your account security, providing valid API keys, ensuring your bot&apos;s content complies with target platform rules, and monitoring your bot&apos;s activity.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-4">4. White-Hat Policy</h2>
          <p className="text-muted-foreground mb-4">
            All bots must operate within white-hat marketing principles. Spam, harassment, impersonation, and any form of malicious activity are strictly prohibited and will result in immediate account termination.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-4">5. Credits and Payments</h2>
          <p className="text-muted-foreground mb-4">
            Credits are non-refundable once used. Unused credits do not expire. Pricing may change with 30 days notice. All payments are processed securely through Stripe.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-4">6. Limitation of Liability</h2>
          <p className="text-muted-foreground mb-4">
            Grothi is not responsible for actions taken by your bot on third-party platforms, including account suspensions or bans. We provide safety guardrails but cannot guarantee 100% compliance with all platform rules.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-4">7. Contact</h2>
          <p className="text-muted-foreground mb-4">
            For questions about these terms, contact us at <a href="mailto:support@grothi.com" className="text-primary hover:underline">support@grothi.com</a>.
          </p>
        </div>
      </main>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        &copy; {new Date().getFullYear()} Grothi. All rights reserved.
      </footer>
    </div>
  );
}
