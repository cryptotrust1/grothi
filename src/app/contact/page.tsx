import { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Bot, Mail } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Get in touch with the Grothi team. We typically respond within 24 hours.',
};

export default function ContactPage() {
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
            <Link href="/faq" className="text-sm text-muted-foreground hover:text-foreground">FAQ</Link>
          </nav>
          <div className="flex items-center space-x-3">
            <Link href="/auth/signin"><Button variant="ghost" size="sm">Sign In</Button></Link>
            <Link href="/auth/signup"><Button size="sm">Get Started</Button></Link>
          </div>
        </div>
      </header>

      <main className="flex-1 py-16 px-4">
        <div className="max-w-lg mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold">Contact Us</h1>
            <p className="mt-4 text-muted-foreground">
              Have a question? We&apos;d love to hear from you.
            </p>
          </div>

          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" placeholder="Your name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="you@example.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="message">Message</Label>
                <textarea
                  id="message"
                  className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder="How can we help?"
                />
              </div>
              <Button className="w-full">Send Message</Button>
            </CardContent>
          </Card>

          <div className="mt-8 text-center">
            <p className="text-muted-foreground flex items-center justify-center gap-2">
              <Mail className="h-4 w-4" /> contact@grothi.com
            </p>
          </div>
        </div>
      </main>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        &copy; {new Date().getFullYear()} Grothi. All rights reserved.
      </footer>
    </div>
  );
}
