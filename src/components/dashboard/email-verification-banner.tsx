'use client';

import { useState } from 'react';
import { Mail, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmailVerificationBannerProps {
  userId: string;
  email: string;
  name: string;
}

export function EmailVerificationBanner({ userId, email, name }: EmailVerificationBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  if (dismissed) return null;

  async function handleResend() {
    setSending(true);
    setError('');

    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, email, name }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to send');
      }

      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send verification email');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-amber-800">
          <Mail className="h-4 w-4 shrink-0" />
          <span>
            {sent
              ? 'Verification email sent! Check your inbox.'
              : 'Please verify your email address to access all features.'}
          </span>
          {error && <span className="text-destructive">{error}</span>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!sent && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleResend}
              disabled={sending}
              className="text-amber-800 border-amber-300 hover:bg-amber-100"
            >
              {sending ? 'Sending...' : 'Resend Email'}
            </Button>
          )}
          <button
            onClick={() => setDismissed(true)}
            className="text-amber-600 hover:text-amber-800"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
