import { Metadata } from 'next';
import Link from 'next/link';
import { verifyEmailToken } from '@/lib/auth';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bot, CheckCircle, XCircle } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Verify Email',
  robots: { index: false },
};

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const sp = await searchParams;
  const token = sp.token;

  let success = false;
  let errorMessage = '';

  if (token) {
    try {
      await verifyEmailToken(token);
      success = true;
    } catch (e) {
      errorMessage = e instanceof Error ? e.message : 'Verification failed';
    }
  } else {
    errorMessage = 'Missing verification token.';
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Link href="/" className="flex items-center justify-center space-x-2 mb-4">
            <Bot className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold">Grothi</span>
          </Link>
          {success ? (
            <>
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
              <CardTitle className="text-2xl">Email Verified!</CardTitle>
            </>
          ) : (
            <>
              <XCircle className="h-12 w-12 text-destructive mx-auto mb-2" />
              <CardTitle className="text-2xl">Verification Failed</CardTitle>
            </>
          )}
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {success ? (
            <p className="text-muted-foreground">
              Your email has been verified successfully. You can now enjoy all features of Grothi.
            </p>
          ) : (
            <>
              <p className="text-muted-foreground">
                {errorMessage}
              </p>
              <p className="text-sm text-muted-foreground">
                The link may have expired. Sign in to your account and request a new verification email from the dashboard, or contact <a href="mailto:support@grothi.com" className="text-primary hover:underline">support@grothi.com</a>.
              </p>
            </>
          )}
        </CardContent>
        <CardFooter className="flex flex-col space-y-2">
          <Link href={success ? '/dashboard' : '/auth/signin'} className="w-full">
            <Button className="w-full">{success ? 'Go to Dashboard' : 'Sign In & Resend'}</Button>
          </Link>
          {!success && (
            <Link href="/auth/forgot-password" className="text-sm text-primary hover:underline">
              Forgot your password?
            </Link>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
