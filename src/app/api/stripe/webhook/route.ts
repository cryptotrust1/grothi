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
      // Verify user exists before adding credits
      const userExists = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
      if (!userExists) {
        console.error(`[Stripe] User ${userId} not found for payment ${paymentIntentId}`);
        return NextResponse.json({ received: true });
      }

      // Idempotency check - prevent duplicate credit additions
      const existing = await db.creditTransaction.findFirst({
        where: { stripePaymentId: paymentIntentId },
      });
      if (existing) {
        console.log(`[Stripe] Duplicate webhook for payment ${paymentIntentId}, skipping`);
        return NextResponse.json({ received: true });
      }

      try {
        await addCredits(
          userId,
          credits,
          'PURCHASE',
          `Purchased ${credits} credits (${planId} plan)`,
          paymentIntentId
        );
        console.log(`[Stripe] Added ${credits} credits to user ${userId}`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[Stripe] Failed to add credits for user ${userId}, payment ${paymentIntentId}:`, msg);
        // Return 500 so Stripe retries this webhook
        return NextResponse.json({ error: 'Credit addition failed' }, { status: 500 });
      }
    }
  } else if (event.type === 'charge.refunded') {
    // Handle refunds — remove credits that were added for this payment
    const charge = event.data.object;
    const paymentIntentId = charge.payment_intent as string;

    if (paymentIntentId) {
      const originalTxn = await db.creditTransaction.findFirst({
        where: { stripePaymentId: paymentIntentId, type: 'PURCHASE' },
      });

      if (originalTxn) {
        // Deduct the refunded credits
        const refundAmount = originalTxn.amount; // positive number
        try {
          const balance = await db.creditBalance.findUnique({ where: { userId: originalTxn.userId } });
          const currentBalance = balance?.balance ?? 0;
          const deductAmount = Math.min(refundAmount, currentBalance); // Don't go below zero

          if (deductAmount > 0) {
            await db.$transaction(async (tx) => {
              const updated = await tx.creditBalance.update({
                where: { userId: originalTxn.userId },
                data: { balance: { decrement: deductAmount } },
              });
              await tx.creditTransaction.create({
                data: {
                  userId: originalTxn.userId,
                  type: 'USAGE',
                  amount: -deductAmount,
                  balance: updated.balance,
                  description: `Refund: ${deductAmount} credits revoked (payment ${paymentIntentId})`,
                  stripePaymentId: `refund_${paymentIntentId}`,
                },
              });
            });
            console.log(`[Stripe] Refund processed: removed ${deductAmount} credits from user ${originalTxn.userId}`);
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          console.error(`[Stripe] Refund credit removal failed for ${paymentIntentId}:`, msg);
        }
      } else {
        console.warn(`[Stripe] Refund received for unknown payment ${paymentIntentId}`);
      }
    }
  } else if (event.type === 'charge.dispute.created') {
    // Log dispute for admin attention
    const charge = event.data.object;
    const paymentIntentId = charge.payment_intent as string;
    console.error(`[Stripe] DISPUTE created for payment ${paymentIntentId}. Manual review required.`);
  }

  return NextResponse.json({ received: true });
}
