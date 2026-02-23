import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { ensureStripeCustomer, createSubscriptionCheckout } from '@/lib/stripe';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL('/auth/signin', req.url));
  }

  const formData = await req.formData();
  const planSlug = formData.get('planSlug') as string;
  const referralCode = formData.get('referralCode') as string | null;

  if (!planSlug) {
    return NextResponse.redirect(
      new URL('/pricing?error=' + encodeURIComponent('Invalid plan'), req.url),
    );
  }

  // Check if user already has an active subscription
  const existingSub = await db.subscription.findUnique({
    where: { userId: user.id },
    include: { plan: true },
  });

  if (existingSub && existingSub.status === 'ACTIVE' && !existingSub.cancelAtPeriodEnd) {
    // User wants to change plan — redirect to Stripe Customer Portal
    if (user.stripeCustomerId) {
      const { createCustomerPortalSession } = await import('@/lib/stripe');
      const session = await createCustomerPortalSession(
        user.stripeCustomerId,
        `${process.env.NEXTAUTH_URL}/dashboard/credits`,
      );
      return NextResponse.redirect(session.url, 303);
    }
  }

  try {
    const customerId = await ensureStripeCustomer(
      user.id,
      user.email,
      user.name,
      user.stripeCustomerId,
    );

    const session = await createSubscriptionCheckout(
      customerId,
      planSlug,
      user.id,
      `${process.env.NEXTAUTH_URL}/dashboard/credits?success=` + encodeURIComponent('Subscription activated! Credits will be added shortly.'),
      `${process.env.NEXTAUTH_URL}/pricing`,
      referralCode || undefined,
    );

    if (!session.url) {
      return NextResponse.redirect(
        new URL('/pricing?error=' + encodeURIComponent('Failed to create checkout session'), req.url),
      );
    }

    return NextResponse.redirect(session.url, 303);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Subscription checkout error:', msg);
    return NextResponse.redirect(
      new URL('/pricing?error=' + encodeURIComponent('Failed to start subscription. Please try again.'), req.url),
    );
  }
}
