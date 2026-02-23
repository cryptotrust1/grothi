import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getStripe } from '@/lib/stripe';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sub = await db.subscription.findUnique({
      where: { userId: user.id },
    });

    if (!sub || sub.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'No active subscription found.' }, { status: 404 });
    }

    if (!sub.stripeSubscriptionId) {
      // No Stripe subscription — just mark as cancelled
      await db.subscription.update({
        where: { id: sub.id },
        data: {
          cancelAtPeriodEnd: true,
          cancelledAt: new Date(),
        },
      });
      return NextResponse.json({ message: 'Subscription will be cancelled at end of period.' });
    }

    // Cancel at period end in Stripe (user keeps access until period ends)
    await getStripe().subscriptions.update(sub.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    await db.subscription.update({
      where: { id: sub.id },
      data: {
        cancelAtPeriodEnd: true,
        cancelledAt: new Date(),
      },
    });

    return NextResponse.json({
      message: `Subscription will be cancelled on ${sub.currentPeriodEnd.toLocaleDateString()}. You keep access until then.`,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Cancel subscription error:', msg);
    return NextResponse.json({ error: 'Failed to cancel subscription.' }, { status: 500 });
  }
}
