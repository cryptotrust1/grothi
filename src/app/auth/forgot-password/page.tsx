import { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Bot } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Forgot Password',
  robots: { index: false },
};

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const sp = await searchParams;

  async function handleResetRequest(formData: FormData) {
    'use server';

    const email = (formData.get('email') as string)?.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      redirect('/auth/forgot-password?error=Please enter a valid email address');
    }

    // Check if user exists (don't reveal whether they do to prevent enumeration)
    const user = await db.user.findUnique({ where: { email }, select: { id: true } });

    if (user) {
      // TODO: Send actual password reset email when SMTP is configured
      // For now, admin can reset passwords via the admin panel
      // In production: generate a reset token, save it, send email with reset link
      console.log(`Password reset requested for user ${user.id} (${email})`);
    }

    // Always show success to prevent email enumeration
    redirect('/auth/forgot-password?sent=1');
  }

  if (sp.sent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Link href="/" className="flex items-center justify-center space-x-2 mb-4">
              <Bot className="h-8 w-8 text-primary" />
              <span className="text-xl font-bold">Grothi</span>
            </Link>
            <CardTitle className="text-2xl">Check your email</CardTitle>
            <CardDescription>
              If an account exists with that email, we&apos;ll send you a password reset link. Please check your inbox and spam folder.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
              <p className="font-medium">Email service not yet configured</p>
              <p className="mt-1">Password reset emails are not yet active. Please contact the administrator at <a href="mailto:admin@grothi.com" className="underline font-medium">admin@grothi.com</a> to reset your password.</p>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Link href="/auth/signin" className="text-sm text-primary hover:underline">
              Back to sign in
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Link href="/" className="flex items-center justify-center space-x-2 mb-4">
            <Bot className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold">Grothi</span>
          </Link>
          <CardTitle className="text-2xl">Reset your password</CardTitle>
          <CardDescription>
            Enter your email and we&apos;ll send you a reset link.
          </CardDescription>
        </CardHeader>
        <form action={handleResetRequest}>
          <CardContent className="space-y-4">
            {sp.error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">{sp.error}</div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" placeholder="you@example.com" required />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full">Send Reset Link</Button>
            <Link href="/auth/signin" className="text-sm text-primary hover:underline">
              Back to sign in
            </Link>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
