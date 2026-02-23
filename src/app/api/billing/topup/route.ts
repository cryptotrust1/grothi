import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { ensureStripeCustomer, createTopupCheckout } from '@/lib/stripe';
import { BILLING_LIMITS } from '@/lib/billing';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL('/auth/signin', req.url));
  }

  const formData = await req.formData();
  const packSlug = formData.get('packSlug') as string;
  const referralCode = formData.get('referralCode') as string | null;

  if (!packSlug) {
    return NextResponse.redirect(
      new URL('/dashboard/credits/buy?error=' + encodeURIComponent('Invalid pack'), req.url),
    );
  }

  // Rate limit: max N top-ups per day
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayPurchases = await db.topupPurchase.count({
    where: {
      userId: user.id,
      createdAt: { gte: todayStart },
    },
  });

  if (todayPurchases >= BILLING_LIMITS.MAX_TOPUPS_PER_DAY) {
    return NextResponse.redirect(
      new URL('/dashboard/credits/buy?error=' + encodeURIComponent(`Maximum ${BILLING_LIMITS.MAX_TOPUPS_PER_DAY} top-up purchases per day.`), req.url),
    );
  }

  // Check max balance limit
  const balance = await db.creditBalance.findUnique({ where: { userId: user.id } });
  if (balance && balance.balance >= BILLING_LIMITS.MAX_CREDIT_BALANCE) {
    return NextResponse.redirect(
      new URL('/dashboard/credits/buy?error=' + encodeURIComponent(`Maximum credit balance (${BILLING_LIMITS.MAX_CREDIT_BALANCE.toLocaleString()}) reached.`), req.url),
    );
  }

  try {
    const customerId = await ensureStripeCustomer(
      user.id,
      user.email,
      user.name,
      user.stripeCustomerId,
    );

    const session = await createTopupCheckout(
      customerId,
      packSlug,
      user.id,
      `${process.env.NEXTAUTH_URL}/dashboard/credits?success=` + encodeURIComponent('Credits purchased! Added to your account.'),
      `${process.env.NEXTAUTH_URL}/dashboard/credits/buy`,
      referralCode || undefined,
    );

    if (!session.url) {
      return NextResponse.redirect(
        new URL('/dashboard/credits/buy?error=' + encodeURIComponent('Failed to create checkout session'), req.url),
      );
    }

    return NextResponse.redirect(session.url, 303);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Top-up checkout error:', msg);
    return NextResponse.redirect(
      new URL('/dashboard/credits/buy?error=' + encodeURIComponent('Payment failed. Please try again.'), req.url),
    );
  }
}
