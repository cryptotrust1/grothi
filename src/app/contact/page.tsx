import { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { db } from '@/lib/db';
import { contactFormLimiter, getClientIp } from '@/lib/rate-limit';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Bot, Mail, CheckCircle, ArrowRight } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Get in touch with the Grothi team. We typically respond within 24 hours.',
};

// ── Spam detection patterns ─────────────────────────────────────

/** Common spam phrases found in bot submissions. */
const SPAM_PHRASES = [
  /\b(viagra|cialis|pharmacy|pills)\b/i,
  /\b(crypto|bitcoin|forex)\s+(invest|trading|profit)/i,
  /\b(earn|make)\s+\$?\d+.*\b(per|a)\s+(day|hour|week)\b/i,
  /\b(work\s+from\s+home|make\s+money\s+online)\b/i,
  /\bSEO\s+(service|company|agency|expert)/i,
  /\b(web\s+design|website\s+development)\s+(service|company|agency)/i,
  /\b(backlink|link\s+building)\b/i,
  /\bincreas(e|ing)\s+(your\s+)?(traffic|ranking|sales)\b/i,
  /\bI\s+(noticed|visited|found)\s+(your|the)\s+(website|site)\b/i,
  /\b(dear\s+)?(sir|madam|webmaster|admin)\b/i,
  /\b(unsubscribe|opt[\s-]out|remove\s+me)\b/i,
  /\bfree\s+(trial|quote|consultation|estimate)\b/i,
];

/** Detect excessive URLs in message (bots often include many links). */
const URL_PATTERN = /https?:\/\/[^\s]+/gi;

/** Max URLs allowed in a contact message. */
const MAX_URLS = 2;

/** Minimum time in seconds between page load and form submission.
 *  Humans take at least 5-10 seconds; bots submit instantly. */
const MIN_SUBMIT_TIME_SEC = 3;

/**
 * Check if message content is likely spam.
 * Returns a reason string if spam, null if clean.
 */
function detectSpam(name: string, email: string, message: string): string | null {
  const fullText = `${name} ${email} ${message}`;

  // Check spam phrases
  for (const pattern of SPAM_PHRASES) {
    if (pattern.test(fullText)) {
      return 'Message flagged as spam';
    }
  }

  // Check excessive URLs
  const urls = message.match(URL_PATTERN) || [];
  if (urls.length > MAX_URLS) {
    return 'Too many links in message';
  }

  // Check if message is mostly non-Latin characters mixed with Latin (common spam pattern)
  // But allow fully non-Latin messages (legitimate international users)
  const latinChars = (message.match(/[a-zA-Z]/g) || []).length;
  const totalChars = message.replace(/\s/g, '').length;
  if (totalChars > 20 && latinChars > 0 && latinChars < totalChars * 0.2) {
    // Less than 20% Latin but some Latin present — suspicious mixed script
    // Don't flag fully non-Latin (0 Latin chars)
  }

  // Check for repeated characters (bots sometimes fill "aaaaaaa")
  if (/(.)\1{10,}/.test(message)) {
    return 'Invalid message content';
  }

  // Check for very long single words (encoded data or gibberish)
  if (/\S{100,}/.test(message)) {
    return 'Invalid message content';
  }

  return null;
}

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const sp = await searchParams;

  // Generate a timestamp token for the form (anti-bot timing check)
  const formLoadedAt = Math.floor(Date.now() / 1000);

  async function handleSubmit(formData: FormData) {
    'use server';

    // ── Anti-spam layer 1: Honeypot ──────────────────────────
    // Hidden field that real users never fill in. Bots auto-fill all fields.
    const honeypot = formData.get('website') as string;
    if (honeypot) {
      // Silently "succeed" — don't reveal to bot that it was detected
      redirect('/contact?sent=1');
    }

    // ── Anti-spam layer 2: Time-based check ──────────────────
    // Reject submissions faster than MIN_SUBMIT_TIME_SEC from page load
    const loadedAt = parseInt(formData.get('_t') as string, 10);
    const now = Math.floor(Date.now() / 1000);
    if (!isNaN(loadedAt) && (now - loadedAt) < MIN_SUBMIT_TIME_SEC) {
      // Too fast — likely a bot. Silently "succeed".
      redirect('/contact?sent=1');
    }

    // ── Anti-spam layer 3: Rate limiting per IP ──────────────
    const headersList = await headers();
    const clientIp = getClientIp(headersList);

    const rateResult = contactFormLimiter.check(clientIp);
    if (!rateResult.allowed) {
      const minutes = Math.ceil(rateResult.retryAfterMs / 60_000);
      redirect('/contact?error=' + encodeURIComponent(
        `Too many messages. Please try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`
      ));
    }

    // ── Basic validation ─────────────────────────────────────
    const name = (formData.get('name') as string)?.trim();
    const email = (formData.get('email') as string)?.trim();
    const message = (formData.get('message') as string)?.trim();

    if (!name || !email || !message) {
      redirect('/contact?error=' + encodeURIComponent('Please fill in all fields'));
    }

    if (name.length > 100) {
      redirect('/contact?error=' + encodeURIComponent('Name is too long'));
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      redirect('/contact?error=' + encodeURIComponent('Please enter a valid email'));
    }

    if (email.length > 254) {
      redirect('/contact?error=' + encodeURIComponent('Email address is too long'));
    }

    if (message.length < 10) {
      redirect('/contact?error=' + encodeURIComponent('Message must be at least 10 characters'));
    }

    if (message.length > 5000) {
      redirect('/contact?error=' + encodeURIComponent('Message is too long (max 5000 characters)'));
    }

    // ── Anti-spam layer 4: Content analysis ──────────────────
    const spamReason = detectSpam(name, email, message);
    if (spamReason) {
      // Silently "succeed" to not inform the bot
      console.log(`[contact] Spam blocked from ${clientIp}: ${spamReason}`);
      redirect('/contact?sent=1');
    }

    // ── Anti-spam layer 5: Duplicate check ───────────────────
    // Block exact duplicate submissions within 1 hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const duplicate = await db.contactMessage.findFirst({
      where: {
        email,
        message,
        createdAt: { gte: oneHourAgo },
      },
      select: { id: true },
    });

    if (duplicate) {
      // Already submitted — redirect as success
      redirect('/contact?sent=1');
    }

    // ── Save and send ────────────────────────────────────────
    try {
      await db.contactMessage.create({
        data: { name, email, message },
      });

      // Send email notifications (non-blocking)
      const { sendContactNotificationEmail, sendContactConfirmationEmail } = await import('@/lib/email');
      sendContactNotificationEmail(name, email, message).catch((err) => {
        console.error('Failed to send contact notification:', err);
      });
      sendContactConfirmationEmail(email, name).catch((err) => {
        console.error('Failed to send contact confirmation:', err);
      });
    } catch (error) {
      console.error('Contact form error:', error);
      redirect('/contact?error=' + encodeURIComponent('Failed to send message. Please try again.'));
    }

    redirect('/contact?sent=1');
  }

  return (
    <div className="flex flex-col min-h-screen">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center space-x-2">
            <Bot className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-indigo-400 bg-clip-text text-transparent">Grothi</span>
          </Link>
          <nav className="hidden md:flex items-center space-x-6">
            <Link href="/features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Features</Link>
            <Link href="/how-it-works" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">How It Works</Link>
            <Link href="/pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
            <Link href="/faq" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">FAQ</Link>
          </nav>
          <div className="flex items-center space-x-3">
            <Link href="/auth/signin"><Button variant="ghost" size="sm">Sign In</Button></Link>
            <Link href="/auth/signup"><Button size="sm" className="bg-secondary hover:bg-secondary/90 text-white">Start Free Trial <ArrowRight className="ml-1.5 h-4 w-4" /></Button></Link>
          </div>
        </div>
      </header>

      <main className="flex-1 py-16 px-4">
        <div className="max-w-lg mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold">Contact Us</h1>
            <p className="mt-4 text-muted-foreground">
              Have a question? We&apos;d love to hear from you. We typically respond within 24 hours.
            </p>
          </div>

          {sp.sent ? (
            <Card>
              <CardContent className="pt-6 text-center space-y-4">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
                <h2 className="text-xl font-semibold">Message Sent!</h2>
                <p className="text-muted-foreground">
                  Thank you for reaching out. We&apos;ll get back to you as soon as possible.
                </p>
                <Link href="/contact">
                  <Button variant="outline" className="mt-4">Send Another Message</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <>
              {sp.error && (
                <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive mb-4">
                  {sp.error}
                </div>
              )}
              <Card>
                <form action={handleSubmit}>
                  <CardContent className="pt-6 space-y-4">
                    {/* Honeypot field — hidden from real users, bots auto-fill it */}
                    <div className="absolute opacity-0 -z-10" style={{ position: 'absolute', left: '-9999px' }} aria-hidden="true">
                      <label htmlFor="website">Website</label>
                      <input type="text" id="website" name="website" tabIndex={-1} autoComplete="off" />
                    </div>
                    {/* Timestamp for timing check */}
                    <input type="hidden" name="_t" value={formLoadedAt} />

                    <div className="space-y-2">
                      <Label htmlFor="name">Name</Label>
                      <Input id="name" name="name" placeholder="Your name" required maxLength={100} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" name="email" type="email" placeholder="you@example.com" required maxLength={254} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="message">Message</Label>
                      <textarea
                        id="message"
                        name="message"
                        className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        placeholder="How can we help?"
                        required
                        maxLength={5000}
                      />
                    </div>
                    <Button type="submit" className="w-full">Send Message</Button>
                  </CardContent>
                </form>
              </Card>
            </>
          )}

          <div className="mt-8 text-center">
            <p className="text-muted-foreground flex items-center justify-center gap-2">
              <Mail className="h-4 w-4" /> <a href="mailto:support@grothi.com" className="hover:text-foreground transition-colors">support@grothi.com</a>
            </p>
          </div>
        </div>
      </main>

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
