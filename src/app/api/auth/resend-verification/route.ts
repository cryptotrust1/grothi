import { NextResponse } from 'next/server';
import { getCurrentUser, resendVerificationEmail } from '@/lib/auth';
import { createRateLimiter } from '@/lib/rate-limit';

/** Max 3 resend requests per 15 minutes per user to prevent email spam. */
const resendLimiter = createRateLimiter({ maxRequests: 3, windowMs: 15 * 60 * 1000 });

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (user.emailVerified) {
      return NextResponse.json({ error: 'Email already verified' }, { status: 400 });
    }

    const rateCheck = resendLimiter.check(user.id);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait before requesting another verification email.' },
        { status: 429 }
      );
    }

    await resendVerificationEmail(user.id, user.email, user.name || 'there');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Resend verification error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send verification email' },
      { status: 500 }
    );
  }
}
