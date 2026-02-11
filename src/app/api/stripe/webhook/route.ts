import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { addCredits } from '@/lib/credits';

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

    if (userId && credits > 0) {
      await addCredits(
        userId,
        credits,
        'PURCHASE',
        `Purchased ${credits} credits (${planId} plan)`,
        session.payment_intent as string
      );

      console.log(`[Stripe] Added ${credits} credits to user ${userId}`);
    }
  }

  return NextResponse.json({ received: true });
}
