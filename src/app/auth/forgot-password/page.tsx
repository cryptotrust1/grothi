import { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Bot } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Forgot Password',
  robots: { index: false },
};

export default function ForgotPasswordPage() {
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
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" placeholder="you@example.com" required />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <Button className="w-full">Send Reset Link</Button>
          <Link href="/auth/signin" className="text-sm text-primary hover:underline">
            Back to sign in
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
