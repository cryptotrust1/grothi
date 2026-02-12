import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { addCredits } from '@/lib/credits';
import { db } from '@/lib/db';

const MAX_CREDITS_PER_TRANSACTION = 100000;

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature');

  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Webhook signature verification failed:', message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    const userId = session.metadata?.userId;
    const credits = parseInt(session.metadata?.credits || '0', 10);
    const planId = session.metadata?.planId;
    const paymentIntentId = session.payment_intent as string;

    if (isNaN(credits) || credits <= 0 || credits > MAX_CREDITS_PER_TRANSACTION) {
      console.error(`[Stripe] Invalid credit amount: ${credits} for user ${userId}`);
      return NextResponse.json({ received: true });
    }

    if (userId && paymentIntentId) {
      // Idempotency check - prevent duplicate credit additions
      const existing = await db.creditTransaction.findFirst({
        where: { stripePaymentId: paymentIntentId },
      });
      if (existing) {
        console.log(`[Stripe] Duplicate webhook for payment ${paymentIntentId}, skipping`);
        return NextResponse.json({ received: true });
      }

      await addCredits(
        userId,
        credits,
        'PURCHASE',
        `Purchased ${credits} credits (${planId} plan)`,
        paymentIntentId
      );

      console.log(`[Stripe] Added ${credits} credits to user ${userId}`);
    }
  }

  return NextResponse.json({ received: true });
}
