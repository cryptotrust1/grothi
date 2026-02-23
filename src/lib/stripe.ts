import Stripe from 'stripe';
import { SUBSCRIPTION_PLANS, TOPUP_PACKS } from './billing';

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    _stripe = new Stripe(key);
  }
  return _stripe;
}

// Legacy credit pack plans (kept for backward compatibility with existing purchases)
export const PRICING_PLANS = [
  { id: 'starter', name: 'Starter', credits: 1000, bonus: 0, priceUsd: 1000 },
  { id: 'growth', name: 'Growth', credits: 5000, bonus: 500, priceUsd: 4500 },
  { id: 'pro', name: 'Pro', credits: 15000, bonus: 2000, priceUsd: 12000 },
  { id: 'enterprise', name: 'Enterprise', credits: 50000, bonus: 10000, priceUsd: 35000 },
];

// ============ STRIPE HELPERS ============

/**
 * Ensure a user has a Stripe customer ID.
 * Creates one if missing and saves it to the DB.
 */
export async function ensureStripeCustomer(
  userId: string,
  email: string,
  name?: string | null,
  stripeCustomerId?: string | null,
): Promise<string> {
  if (stripeCustomerId) return stripeCustomerId;

  const { db } = await import('./db');
  const customer = await getStripe().customers.create({
    email,
    name: name || undefined,
    metadata: { userId },
  });

  await db.user.update({
    where: { id: userId },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}

/**
 * Create a Stripe Checkout session for a subscription plan.
 */
export async function createSubscriptionCheckout(
  customerId: string,
  planSlug: string,
  userId: string,
  successUrl: string,
  cancelUrl: string,
  referralCode?: string,
): Promise<Stripe.Checkout.Session> {
  const { db } = await import('./db');

  // Find the subscription plan in our DB
  const plan = await db.subscriptionPlan.findUnique({
    where: { slug: planSlug },
  });

  if (!plan || !plan.stripePriceId || !plan.isActive) {
    throw new Error(`Subscription plan "${planSlug}" not found or not configured`);
  }

  const metadata: Record<string, string> = {
    userId,
    planSlug: plan.slug,
    planId: plan.id,
    type: 'subscription',
  };

  if (referralCode) {
    metadata.referralCode = referralCode;
  }

  return await getStripe().checkout.sessions.create({
    customer: customerId,
    payment_method_types: ['card'],
    line_items: [{
      price: plan.stripePriceId,
      quantity: 1,
    }],
    mode: 'subscription',
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata,
    subscription_data: {
      metadata,
    },
  });
}

/**
 * Create a Stripe Checkout session for a top-up pack (one-time payment).
 */
export async function createTopupCheckout(
  customerId: string,
  packSlug: string,
  userId: string,
  successUrl: string,
  cancelUrl: string,
  referralCode?: string,
): Promise<Stripe.Checkout.Session> {
  const { db } = await import('./db');

  // Find the top-up pack in our DB
  const pack = await db.topupPack.findUnique({
    where: { slug: packSlug },
  });

  if (!pack || !pack.isActive) {
    throw new Error(`Top-up pack "${packSlug}" not found or not active`);
  }

  const metadata: Record<string, string> = {
    userId,
    packSlug: pack.slug,
    packId: pack.id,
    credits: pack.credits.toString(),
    type: 'topup',
  };

  if (referralCode) {
    metadata.referralCode = referralCode;
  }

  // Use inline price if no Stripe Price ID configured
  if (pack.stripePriceId) {
    return await getStripe().checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{
        price: pack.stripePriceId,
        quantity: 1,
      }],
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata,
    });
  }

  return await getStripe().checkout.sessions.create({
    customer: customerId,
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'usd',
        product_data: {
          name: `${pack.name} - ${pack.credits} Credits`,
          description: `${pack.credits} top-up credits for Grothi`,
        },
        unit_amount: pack.priceUsd,
      },
      quantity: 1,
    }],
    mode: 'payment',
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata,
  });
}

/**
 * Get or create Stripe Customer Portal session.
 */
export async function createCustomerPortalSession(
  customerId: string,
  returnUrl: string,
): Promise<Stripe.BillingPortal.Session> {
  return await getStripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
}
