import { Metadata } from 'next';
import Link from 'next/link';
import { Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Privacy Policy',
};

export default function PrivacyPage() {
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
          <h1 className="text-3xl font-bold mb-8">Privacy Policy</h1>
          <p className="text-muted-foreground mb-6">Last updated: February 2026</p>

          <h2 className="text-xl font-semibold mt-8 mb-4">1. Information We Collect</h2>
          <p className="text-muted-foreground mb-4">
            We collect: your email address, name, and password hash for account creation. API keys you provide (encrypted with AES-256-GCM). Bot activity logs and engagement metrics.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-4">2. How We Use Your Data</h2>
          <p className="text-muted-foreground mb-4">
            Your data is used to: operate your bots, process payments, send notifications, improve our service, and generate analytics visible only to you.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-4">3. API Key Security</h2>
          <p className="text-muted-foreground mb-4">
            All API keys are encrypted using AES-256-GCM before storage. They are decrypted only at runtime when needed by bot workers, never transmitted to the frontend, and displayed only in masked format (e.g., sk-...1234).
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-4">4. Data Sharing</h2>
          <p className="text-muted-foreground mb-4">
            We do not sell your data. We share data only with: Stripe (payment processing) and the social media platforms you connect (via your own API keys).
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-4">5. Your Rights (GDPR)</h2>
          <p className="text-muted-foreground mb-4">
            You have the right to: access your data, export your data (JSON format), request deletion of your account and all associated data, and withdraw consent at any time.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-4">6. Cookies</h2>
          <p className="text-muted-foreground mb-4">
            We use essential cookies only (session token). No tracking cookies, no analytics cookies, no third-party cookies.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-4">7. Contact</h2>
          <p className="text-muted-foreground mb-4">
            For privacy-related questions, contact us at <a href="mailto:support@grothi.com" className="text-primary hover:underline">support@grothi.com</a>.
          </p>
        </div>
      </main>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        &copy; {new Date().getFullYear()} Grothi. All rights reserved.
      </footer>
    </div>
  );
}
