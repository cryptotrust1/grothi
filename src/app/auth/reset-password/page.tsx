import { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { resetPasswordWithToken } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Bot, CheckCircle } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Reset Password',
  robots: { index: false },
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string; success?: string }>;
}) {
  const sp = await searchParams;

  if (!sp.token && !sp.success) {
    redirect('/auth/forgot-password');
  }

  if (sp.success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Link href="/" className="flex items-center justify-center space-x-2 mb-4">
              <Bot className="h-8 w-8 text-primary" />
              <span className="text-xl font-bold">Grothi</span>
            </Link>
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
            <CardTitle className="text-2xl">Password Reset!</CardTitle>
            <CardDescription>
              Your password has been changed successfully. You can now sign in with your new password.
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex justify-center">
            <Link href="/auth/signin">
              <Button>Sign In</Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  async function handleReset(formData: FormData) {
    'use server';

    const token = formData.get('token') as string;
    const password = formData.get('password') as string;
    const confirmPassword = formData.get('confirmPassword') as string;

    if (!token) {
      redirect('/auth/forgot-password');
    }

    if (!password || password.length < 8) {
      redirect('/auth/reset-password?token=' + encodeURIComponent(token) + '&error=' + encodeURIComponent('Password must be at least 8 characters'));
    }

    if (password !== confirmPassword) {
      redirect('/auth/reset-password?token=' + encodeURIComponent(token) + '&error=' + encodeURIComponent('Passwords do not match'));
    }

    if (!/[A-Z]/.test(password) || !/\d/.test(password)) {
      redirect('/auth/reset-password?token=' + encodeURIComponent(token) + '&error=' + encodeURIComponent('Password must contain at least 1 uppercase letter and 1 number'));
    }

    try {
      await resetPasswordWithToken(token, password);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Reset failed';
      redirect('/auth/reset-password?token=' + encodeURIComponent(token) + '&error=' + encodeURIComponent(msg));
    }

    redirect('/auth/reset-password?success=1');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Link href="/" className="flex items-center justify-center space-x-2 mb-4">
            <Bot className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold">Grothi</span>
          </Link>
          <CardTitle className="text-2xl">Set new password</CardTitle>
          <CardDescription>
            Choose a new password for your account.
          </CardDescription>
        </CardHeader>
        <form action={handleReset}>
          <input type="hidden" name="token" value={sp.token || ''} />
          <CardContent className="space-y-4">
            {sp.error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">{sp.error}</div>
            )}
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <Input id="password" name="password" type="password" autoComplete="new-password" placeholder="••••••••" required />
              <p className="text-xs text-muted-foreground">
                Min 8 characters, 1 uppercase, 1 number
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" placeholder="••••••••" required />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full">Reset Password</Button>
            <Link href="/auth/signin" className="text-sm text-primary hover:underline">
              Back to sign in
            </Link>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
