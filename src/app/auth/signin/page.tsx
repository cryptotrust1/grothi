import { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getCurrentUser, signIn } from '@/lib/auth';
import { signInSchema } from '@/lib/validations';
import { signInLimiter, getClientIp } from '@/lib/rate-limit';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Bot } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Sign In',
  robots: { index: false },
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; registered?: string; pending2fa?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect('/dashboard');

  const params = await searchParams;

  // If we have a pending 2FA token, show the 2FA verification form
  if (params.pending2fa) {
    return <TwoFactorForm pendingToken={params.pending2fa} error={params.error} />;
  }

  async function handleSignIn(formData: FormData) {
    'use server';

    // Rate limit: max 10 attempts per 15 minutes per IP
    const headersList = await headers();
    const clientIp = getClientIp(headersList);
    const rateResult = signInLimiter.check(clientIp);
    if (!rateResult.allowed) {
      const minutes = Math.ceil(rateResult.retryAfterMs / 60_000);
      redirect('/auth/signin?error=' + encodeURIComponent(
        `Too many sign in attempts. Please try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`
      ));
    }

    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    const result = signInSchema.safeParse({ email, password });
    if (!result.success) {
      redirect('/auth/signin?error=' + encodeURIComponent(result.error.errors[0].message));
    }

    let errorMessage: string | null = null;
    try {
      const signInResult = await signIn(email, password);

      if (signInResult.requires2FA) {
        // Redirect to 2FA step with pending token
        redirect('/auth/signin?pending2fa=' + encodeURIComponent(signInResult.pendingToken));
      }
    } catch (e) {
      errorMessage = e instanceof Error ? e.message : 'Sign in failed';
    }

    if (errorMessage) {
      redirect('/auth/signin?error=' + encodeURIComponent(errorMessage));
    }
    redirect('/dashboard');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Link href="/" className="flex items-center justify-center space-x-2 mb-4">
            <Bot className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold">Grothi</span>
          </Link>
          <CardTitle className="text-2xl">Welcome back</CardTitle>
          <CardDescription>Sign in to your account to continue</CardDescription>
        </CardHeader>
        <form action={handleSignIn}>
          <CardContent className="space-y-4">
            {params.registered && (
              <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-800">
                Account created successfully! Please sign in.
              </div>
            )}
            {params.error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                {params.error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link href="/auth/forgot-password" className="text-sm text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
              <Input id="password" name="password" type="password" autoComplete="current-password" placeholder="••••••••" required />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full">Sign In</Button>
            <p className="text-sm text-muted-foreground text-center">
              Don&apos;t have an account?{' '}
              <Link href="/auth/signup" className="text-primary hover:underline">
                Sign up
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

// ============ 2FA VERIFICATION FORM ============

function TwoFactorForm({ pendingToken, error }: { pendingToken: string; error?: string }) {
  async function handleVerify2FA(formData: FormData) {
    'use server';

    const code = formData.get('code') as string;
    const token = formData.get('pendingToken') as string;

    if (!code || !token) {
      redirect('/auth/signin?pending2fa=' + encodeURIComponent(token) + '&error=' + encodeURIComponent('Please enter a code'));
    }

    try {
      const { verify2FAAndCreateSession } = await import('@/lib/auth');
      await verify2FAAndCreateSession(token, code.trim());
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Verification failed';
      redirect('/auth/signin?pending2fa=' + encodeURIComponent(token) + '&error=' + encodeURIComponent(msg));
    }

    redirect('/dashboard');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Link href="/" className="flex items-center justify-center space-x-2 mb-4">
            <Bot className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold">Grothi</span>
          </Link>
          <CardTitle className="text-2xl">Two-Factor Authentication</CardTitle>
          <CardDescription>
            Enter the 6-digit code from your authenticator app, or a recovery code.
          </CardDescription>
        </CardHeader>
        <form action={handleVerify2FA}>
          <input type="hidden" name="pendingToken" value={pendingToken} />
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="code">Verification Code</Label>
              <Input
                id="code"
                name="code"
                type="text"
                autoComplete="one-time-code"
                placeholder="123456 or XXXX-XXXX"
                required
                autoFocus
                className="text-center text-lg tracking-widest"
              />
              <p className="text-xs text-muted-foreground">
                Open Google Authenticator and enter the 6-digit code, or use a recovery code.
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full">Verify</Button>
            <Link href="/auth/signin" className="text-sm text-muted-foreground hover:text-foreground text-center">
              Back to sign in
            </Link>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
