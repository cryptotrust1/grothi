import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getStripe, PRICING_PLANS } from '@/lib/stripe';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL('/auth/signin', req.url));
  }

  const formData = await req.formData();
  const priceId = formData.get('priceId') as string;
  const credits = parseInt(formData.get('credits') as string, 10);

  const plan = PRICING_PLANS.find((p) => `price_${p.id}` === priceId);
  if (!plan) {
    return NextResponse.redirect(new URL('/dashboard/credits/buy?error=Invalid plan', req.url));
  }

  // Ensure user has a Stripe customer ID
  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await getStripe().customers.create({
      email: user.email,
      name: user.name || undefined,
      metadata: { userId: user.id },
    });
    customerId = customer.id;
    await db.user.update({
      where: { id: user.id },
      data: { stripeCustomerId: customerId },
    });
  }

  const session = await getStripe().checkout.sessions.create({
    customer: customerId,
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: `${plan.name} - ${plan.credits + plan.bonus} Credits`,
            description: `${plan.credits} credits${plan.bonus > 0 ? ` + ${plan.bonus} bonus` : ''}`,
          },
          unit_amount: plan.priceUsd,
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: `${process.env.NEXTAUTH_URL}/dashboard/credits?success=Payment successful! Credits added.`,
    cancel_url: `${process.env.NEXTAUTH_URL}/dashboard/credits/buy`,
    metadata: {
      userId: user.id,
      credits: (plan.credits + plan.bonus).toString(),
      planId: plan.id,
    },
  });

  return NextResponse.redirect(session.url!, 303);
}
