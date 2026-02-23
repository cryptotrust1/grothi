import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createCustomerPortalSession } from '@/lib/stripe';

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL('/auth/signin', req.url));
  }

  if (!user.stripeCustomerId) {
    return NextResponse.redirect(
      new URL('/dashboard/credits?error=' + encodeURIComponent('No billing account found. Subscribe to a plan first.'), req.url),
    );
  }

  try {
    const session = await createCustomerPortalSession(
      user.stripeCustomerId,
      `${process.env.NEXTAUTH_URL}/dashboard/credits`,
    );

    return NextResponse.redirect(session.url, 303);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Customer portal error:', msg);
    return NextResponse.redirect(
      new URL('/dashboard/credits?error=' + encodeURIComponent('Failed to open billing portal. Please try again.'), req.url),
    );
  }
}
