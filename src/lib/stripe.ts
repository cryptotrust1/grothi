import Stripe from 'stripe';

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

export const PRICING_PLANS = [
  { id: 'starter', name: 'Starter', credits: 1000, bonus: 0, priceUsd: 1000 },
  { id: 'growth', name: 'Growth', credits: 5000, bonus: 500, priceUsd: 4500 },
  { id: 'pro', name: 'Pro', credits: 15000, bonus: 2000, priceUsd: 12000 },
  { id: 'enterprise', name: 'Enterprise', credits: 50000, bonus: 10000, priceUsd: 35000 },
];
