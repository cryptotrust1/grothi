import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { addCredits, allocateSubscriptionCredits } from '@/lib/credits';
import { db } from '@/lib/db';
import { AFFILIATE_RATES } from '@/lib/billing';

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

  try {
    // Cast Stripe objects to Record<string, unknown> for our handler functions.
    // Stripe types don't have index signatures, but our handlers access fields dynamically.
    const obj = event.data.object as unknown as Record<string, unknown>;

    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(obj);
        break;

      case 'invoice.paid':
        await handleInvoicePaid(obj);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(obj);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(obj);
        break;

      case 'charge.refunded':
        await handleRefund(obj);
        break;

      case 'charge.dispute.created': {
        const paymentIntentId = obj.payment_intent as string;
        console.error(`[Stripe] DISPUTE created for payment ${paymentIntentId}. Manual review required.`);
        break;
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[Stripe] Webhook handler error for ${event.type}:`, message);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

// ============ CHECKOUT COMPLETED ============

async function handleCheckoutCompleted(session: Record<string, unknown>) {
  const metadata = (session.metadata ?? {}) as Record<string, string>;
  const type = metadata.type;

  if (type === 'topup') {
    await handleTopupPurchase(session, metadata);
  } else if (type === 'subscription') {
    await handleNewSubscription(session, metadata);
  } else {
    // Legacy credit pack purchase (backward compatibility)
    await handleLegacyPurchase(session, metadata);
  }
}

async function handleTopupPurchase(
  session: Record<string, unknown>,
  metadata: Record<string, string>,
) {
  const userId = metadata.userId;
  const packId = metadata.packId;
  const credits = parseInt(metadata.credits || '0', 10);
  const paymentIntentId = session.payment_intent as string;

  if (!userId || !packId || isNaN(credits) || credits <= 0 || credits > MAX_CREDITS_PER_TRANSACTION) {
    console.error(`[Stripe] Invalid topup metadata:`, metadata);
    return;
  }

  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) {
    console.error(`[Stripe] User ${userId} not found for topup`);
    return;
  }

  // Idempotency check
  if (paymentIntentId) {
    const existing = await db.creditTransaction.findFirst({
      where: { stripePaymentId: paymentIntentId },
    });
    if (existing) {
      console.log(`[Stripe] Duplicate topup webhook for payment ${paymentIntentId}, skipping`);
      return;
    }
  }

  const pack = await db.topupPack.findUnique({ where: { id: packId } });

  // Use pack's official credit amount instead of metadata to prevent tampering
  const verifiedCredits = pack ? pack.credits : credits;
  if (pack && verifiedCredits !== credits) {
    console.warn(`[Stripe] Credit mismatch: metadata=${credits}, pack=${pack.credits}. Using pack value.`);
  }

  const amountPaid = (session.amount_total as number) || pack?.priceUsd || 0;

  const purchase = await db.topupPurchase.create({
    data: {
      userId,
      packId,
      credits: verifiedCredits,
      amountPaid,
      stripePaymentId: paymentIntentId,
    },
  });

  // Top-up credits never expire
  await addCredits(
    userId,
    verifiedCredits,
    'TOPUP',
    `Top-up: +${verifiedCredits} credits (${pack?.name || 'Pack'})`,
    paymentIntentId,
    { source: 'TOPUP', topupPurchaseId: purchase.id },
  );

  console.log(`[Stripe] Top-up: added ${verifiedCredits} credits to user ${userId}`);

  // Affiliate commission
  await processAffiliateCommission(userId, amountPaid, 'TOPUP', paymentIntentId);
}

async function handleNewSubscription(
  session: Record<string, unknown>,
  metadata: Record<string, string>,
) {
  const userId = metadata.userId;
  const planId = metadata.planId;
  const planSlug = metadata.planSlug;
  const stripeSubscriptionId = (session.subscription as string) || undefined;
  const checkoutSessionId = (session.id as string) || undefined;

  if (!userId || !planId) {
    console.error(`[Stripe] Missing subscription metadata:`, metadata);
    return;
  }

  // Validate planId exists in database
  const plan = await db.subscriptionPlan.findUnique({ where: { id: planId } });
  if (!plan || !plan.isActive) {
    console.error(`[Stripe] Invalid or inactive plan ${planId} for user ${userId}`);
    return;
  }

  // Idempotency check: prevent duplicate processing of the same checkout session
  if (checkoutSessionId) {
    const existingTxn = await db.creditTransaction.findFirst({
      where: { stripePaymentId: checkoutSessionId },
    });
    if (existingTxn) {
      console.log(`[Stripe] Duplicate subscription webhook for session ${checkoutSessionId}, skipping`);
      return;
    }
  }

  // Verify user exists before creating subscription
  const userExists = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!userExists) {
    console.error(`[Stripe] User ${userId} not found for subscription`);
    return;
  }

  // Check if subscription already exists
  const existing = await db.subscription.findUnique({ where: { userId } });
  if (existing) {
    await db.subscription.update({
      where: { userId },
      data: {
        planId,
        status: 'ACTIVE',
        stripeSubscriptionId,
      },
    });
    console.log(`[Stripe] Updated subscription for user ${userId} to plan ${planSlug}`);
    return;
  }

  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  await db.subscription.create({
    data: {
      userId,
      planId,
      status: 'ACTIVE',
      stripeSubscriptionId,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    },
  });

  console.log(`[Stripe] Created subscription for user ${userId}, plan ${planSlug}`);

  // Affiliate commission for new subscription
  const amountTotal = (session.amount_total as number) || 0;
  if (amountTotal > 0) {
    await processAffiliateCommission(userId, amountTotal, 'SUBSCRIPTION_NEW');
  }
}

async function handleLegacyPurchase(
  session: Record<string, unknown>,
  metadata: Record<string, string>,
) {
  const userId = metadata.userId;
  const credits = parseInt(metadata.credits || '0', 10);
  const planId = metadata.planId;
  const paymentIntentId = session.payment_intent as string;

  if (isNaN(credits) || credits <= 0 || credits > MAX_CREDITS_PER_TRANSACTION) {
    console.error(`[Stripe] Invalid legacy credit amount: ${credits} for user ${userId}`);
    return;
  }

  if (!userId || !paymentIntentId) return;

  const userExists = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!userExists) {
    console.error(`[Stripe] User ${userId} not found for payment ${paymentIntentId}`);
    return;
  }

  const existing = await db.creditTransaction.findFirst({
    where: { stripePaymentId: paymentIntentId },
  });
  if (existing) {
    console.log(`[Stripe] Duplicate webhook for payment ${paymentIntentId}, skipping`);
    return;
  }

  await addCredits(
    userId,
    credits,
    'PURCHASE',
    `Purchased ${credits} credits (${planId} plan)`,
    paymentIntentId,
    { source: 'TOPUP' },
  );
  console.log(`[Stripe] Legacy: added ${credits} credits to user ${userId}`);
}

// ============ INVOICE PAID (Subscription Renewal) ============

async function handleInvoicePaid(invoice: Record<string, unknown>) {
  const subscriptionId = invoice.subscription as string;
  if (!subscriptionId) return;

  // Idempotency: skip if we already processed this invoice
  const invoiceId = invoice.id as string;
  if (invoiceId) {
    const existing = await db.creditTransaction.findFirst({
      where: { stripePaymentId: `inv_${invoiceId}` },
    });
    if (existing) {
      console.log(`[Stripe] Duplicate invoice.paid for ${invoiceId}, skipping`);
      return;
    }
  }

  const sub = await db.subscription.findFirst({
    where: { stripeSubscriptionId: subscriptionId },
    include: {
      plan: true,
      user: { select: { id: true } },
    },
  });

  if (!sub) {
    console.warn(`[Stripe] invoice.paid for unknown subscription ${subscriptionId}`);
    return;
  }

  const periodEnd = invoice.period_end
    ? new Date((invoice.period_end as number) * 1000)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const periodStart = invoice.period_start
    ? new Date((invoice.period_start as number) * 1000)
    : new Date();

  await db.subscription.update({
    where: { id: sub.id },
    data: {
      status: 'ACTIVE',
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      stripeCurrentPeriodStart: periodStart,
      stripeCurrentPeriodEnd: periodEnd,
    },
  });

  // Allocate monthly credits and record idempotency key
  if (sub.plan.credits > 0) {
    await allocateSubscriptionCredits(
      sub.userId,
      sub.id,
      sub.plan.credits,
      sub.plan.allowRollover,
      sub.plan.maxRolloverCredits,
      periodEnd,
      invoiceId ? `inv_${invoiceId}` : undefined,
    );
    console.log(`[Stripe] Allocated ${sub.plan.credits} credits for user ${sub.userId} (${sub.plan.name} plan)`);
  }

  // Recurring affiliate commission
  const amountPaid = (invoice.amount_paid as number) || 0;
  if (amountPaid > 0) {
    await processAffiliateCommission(
      sub.userId,
      amountPaid,
      'SUBSCRIPTION_RECURRING',
      invoice.payment_intent as string,
    );
  }
}

// ============ SUBSCRIPTION UPDATED ============

async function handleSubscriptionUpdated(subscription: Record<string, unknown>) {
  const stripeSubId = subscription.id as string;
  const status = subscription.status as string;
  const cancelAtPeriodEnd = subscription.cancel_at_period_end as boolean;

  const sub = await db.subscription.findFirst({
    where: { stripeSubscriptionId: stripeSubId },
  });

  if (!sub) {
    console.warn(`[Stripe] subscription.updated for unknown ${stripeSubId}`);
    return;
  }

  let ourStatus: 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'TRIALING' | 'PAUSED' = 'ACTIVE';
  switch (status) {
    case 'active': ourStatus = 'ACTIVE'; break;
    case 'past_due': ourStatus = 'PAST_DUE'; break;
    case 'canceled': ourStatus = 'CANCELLED'; break;
    case 'trialing': ourStatus = 'TRIALING'; break;
    case 'paused': ourStatus = 'PAUSED'; break;
  }

  // Check for plan change
  const items = (subscription.items as Record<string, unknown>)?.data as Array<Record<string, unknown>> | undefined;
  const newPriceId = items?.[0]?.price ? (items[0].price as Record<string, unknown>).id as string : undefined;

  const updateData: Record<string, unknown> = {
    status: ourStatus,
    cancelAtPeriodEnd: cancelAtPeriodEnd || false,
  };

  if (cancelAtPeriodEnd) {
    updateData.cancelledAt = new Date();
  }

  if (newPriceId) {
    const newPlan = await db.subscriptionPlan.findFirst({
      where: { stripePriceId: newPriceId },
    });
    if (newPlan && newPlan.id !== sub.planId) {
      updateData.planId = newPlan.id;
      console.log(`[Stripe] Plan change for sub ${sub.id}: ${sub.planId} → ${newPlan.id}`);
    }
  }

  await db.subscription.update({
    where: { id: sub.id },
    data: updateData,
  });
}

// ============ SUBSCRIPTION DELETED ============

async function handleSubscriptionDeleted(subscription: Record<string, unknown>) {
  const stripeSubId = subscription.id as string;

  const sub = await db.subscription.findFirst({
    where: { stripeSubscriptionId: stripeSubId },
  });

  if (!sub) {
    console.warn(`[Stripe] subscription.deleted for unknown ${stripeSubId}`);
    return;
  }

  await db.subscription.update({
    where: { id: sub.id },
    data: {
      status: 'CANCELLED',
      cancelledAt: new Date(),
    },
  });

  console.log(`[Stripe] Subscription cancelled for sub ${sub.id}`);
}

// ============ REFUND ============

async function handleRefund(charge: Record<string, unknown>) {
  const paymentIntentId = charge.payment_intent as string;
  if (!paymentIntentId) return;

  // Idempotency: check if this refund was already processed
  const existingRefund = await db.creditTransaction.findFirst({
    where: { stripePaymentId: `refund_${paymentIntentId}` },
  });
  if (existingRefund) {
    console.log(`[Stripe] Duplicate refund webhook for payment ${paymentIntentId}, skipping`);
    return;
  }

  const originalTxn = await db.creditTransaction.findFirst({
    where: {
      stripePaymentId: paymentIntentId,
      type: { in: ['PURCHASE', 'TOPUP'] },
    },
  });

  if (!originalTxn) {
    console.warn(`[Stripe] Refund received for unknown payment ${paymentIntentId}`);
    return;
  }

  const refundAmount = originalTxn.amount;

  // Atomic: read balance + clamp + deduct inside single transaction to prevent race condition
  const deducted = await db.$transaction(async (tx) => {
    const balance = await tx.creditBalance.findUnique({ where: { userId: originalTxn.userId } });
    const currentBalance = balance?.balance ?? 0;
    const deductAmount = Math.min(refundAmount, currentBalance);

    if (deductAmount <= 0) return 0;

    const updated = await tx.creditBalance.update({
      where: { userId: originalTxn.userId },
      data: { balance: { decrement: deductAmount } },
    });
    await tx.creditTransaction.create({
      data: {
        userId: originalTxn.userId,
        type: 'REFUND',
        amount: -deductAmount,
        balance: updated.balance,
        description: `Refund: ${deductAmount} credits revoked (payment ${paymentIntentId})`,
        stripePaymentId: `refund_${paymentIntentId}`,
      },
    });
    return deductAmount;
  });

  if (deducted > 0) {
    console.log(`[Stripe] Refund: removed ${deducted} credits from user ${originalTxn.userId}`);
  }

  // Revoke pending affiliate commissions
  await db.affiliateCommission.updateMany({
    where: { stripePaymentId: paymentIntentId, status: 'PENDING' },
    data: { status: 'REFUNDED' },
  });
}

// ============ AFFILIATE COMMISSION ============

async function processAffiliateCommission(
  userId: string,
  amountCents: number,
  type: 'SUBSCRIPTION_NEW' | 'SUBSCRIPTION_RECURRING' | 'TOPUP',
  stripePaymentId?: string,
): Promise<void> {
  if (amountCents <= 0) return;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { referredByCode: true },
  });

  if (!user?.referredByCode) return;

  const affiliate = await db.affiliate.findUnique({
    where: { code: user.referredByCode },
    select: { id: true, isActive: true },
  });

  if (!affiliate?.isActive) return;

  const rate = type === 'TOPUP'
    ? AFFILIATE_RATES.TOPUP
    : AFFILIATE_RATES.SUBSCRIPTION;
  const commission = Math.round(amountCents * rate);

  if (commission <= 0) return;

  await db.$transaction(async (tx) => {
    await tx.affiliateCommission.create({
      data: {
        affiliateId: affiliate.id,
        type,
        amount: commission,
        sourceAmount: amountCents,
        rate,
        referredUserId: userId,
        stripePaymentId,
        status: 'PENDING',
        description: `${type} commission: $${(commission / 100).toFixed(2)} from $${(amountCents / 100).toFixed(2)}`,
      },
    });

    await tx.affiliate.update({
      where: { id: affiliate.id },
      data: {
        totalEarnings: { increment: commission },
        pendingBalance: { increment: commission },
      },
    });
  });

  console.log(`[Affiliate] Commission: $${(commission / 100).toFixed(2)} for affiliate ${affiliate.id} (${type})`);
}
