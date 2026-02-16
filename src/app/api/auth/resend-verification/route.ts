import { NextResponse } from 'next/server';
import { getCurrentUser, resendVerificationEmail } from '@/lib/auth';

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (user.emailVerified) {
      return NextResponse.json({ error: 'Email already verified' }, { status: 400 });
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
