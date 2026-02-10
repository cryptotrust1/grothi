import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-12-18.acacia',
});

export const PRICING_PLANS = [
  { id: 'starter', name: 'Starter', credits: 1000, bonus: 0, priceUsd: 1000 },
  { id: 'growth', name: 'Growth', credits: 5000, bonus: 500, priceUsd: 4500 },
  { id: 'pro', name: 'Pro', credits: 15000, bonus: 2000, priceUsd: 12000 },
  { id: 'enterprise', name: 'Enterprise', credits: 50000, bonus: 10000, priceUsd: 35000 },
];
