import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { decrypt } from '@/lib/encryption';
import crypto from 'crypto';

/**
 * Shopify abandoned checkout webhook handler.
 *
 * Shopify sends a POST to this endpoint when a checkout is created/updated.
 * We verify the HMAC signature, find the matching EcommerceConnection,
 * and upsert an AbandonedCart record for downstream recovery automation.
 *
 * Webhook topics: checkouts/create, checkouts/update
 *
 * Important: Always return 200 for unrecoverable conditions (unknown shop,
 * invalid signature) to prevent Shopify from retrying indefinitely and
 * eventually removing the webhook subscription after 19 consecutive failures.
 */

interface ShopifyLineItem {
  title?: string;
  price?: string;
  quantity?: number;
  image?: { src?: string } | null;
  product_id?: number;
  variant_id?: number;
}

interface ShopifyCheckoutPayload {
  id: number;
  email?: string;
  customer?: {
    first_name?: string;
    last_name?: string;
  };
  total_price?: string;
  currency?: string;
  line_items?: ShopifyLineItem[];
  abandoned_checkout_url?: string;
  created_at?: string;
}

function verifyShopifyHmac(rawBody: string, secret: string, headerHmac: string): boolean {
  const computed = crypto
    .createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest('base64');

  // Decode both from base64 to binary before comparison
  const computedBuf = Buffer.from(computed, 'base64');
  const headerBuf = Buffer.from(headerHmac, 'base64');

  // timingSafeEqual requires equal-length buffers
  if (computedBuf.length !== headerBuf.length) return false;

  return crypto.timingSafeEqual(computedBuf, headerBuf);
}

export async function POST(req: NextRequest) {
  // Read raw body for HMAC verification
  const rawBody = await req.text();

  const hmacHeader = req.headers.get('x-shopify-hmac-sha256');
  const shopDomain = req.headers.get('x-shopify-shop-domain');

  if (!hmacHeader || !shopDomain) {
    // Return 200 to prevent Shopify retries on permanently invalid requests
    console.error('[Shopify Webhook] Missing required Shopify headers');
    return NextResponse.json({ ok: true, skipped: 'missing headers' });
  }

  // Find the EcommerceConnection by shopDomain
  const connection = await db.ecommerceConnection.findFirst({
    where: {
      shopDomain: shopDomain,
      platform: 'SHOPIFY',
      isActive: true,
    },
  });

  if (!connection) {
    // Return 200 — unknown shop is unrecoverable, retries won't help
    console.error(`[Shopify Webhook] No active connection found for shop: ${shopDomain}`);
    return NextResponse.json({ ok: true, skipped: 'unknown shop' });
  }

  // Verify webhook signature
  if (!connection.webhookSecret) {
    console.error(`[Shopify Webhook] No webhook secret configured for connection: ${connection.id}`);
    return NextResponse.json({ ok: true, skipped: 'no webhook secret' });
  }

  let decryptedSecret: string;
  try {
    decryptedSecret = decrypt(connection.webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[Shopify Webhook] Failed to decrypt webhook secret: ${message}`);
    return NextResponse.json({ ok: true, skipped: 'decrypt error' });
  }

  if (!verifyShopifyHmac(rawBody, decryptedSecret, hmacHeader)) {
    // Return 200 — invalid signature is unrecoverable
    console.error(`[Shopify Webhook] HMAC verification failed for shop: ${shopDomain}`);
    return NextResponse.json({ ok: true, skipped: 'invalid signature' });
  }

  // Parse the checkout payload
  let payload: ShopifyCheckoutPayload;
  try {
    payload = JSON.parse(rawBody) as ShopifyCheckoutPayload;
  } catch {
    return NextResponse.json({ ok: true, skipped: 'invalid json' });
  }

  if (!payload.id || !payload.email) {
    // No email means we can't send recovery — skip silently
    console.log('[Shopify Webhook] Skipping checkout without email (guest checkout in progress)');
    return NextResponse.json({ ok: true, skipped: 'no email' });
  }

  // Map line items to our cart items format
  const cartItems = (payload.line_items || []).map((item) => ({
    name: item.title || 'Unknown item',
    price: parseFloat(item.price || '0'),
    quantity: item.quantity || 1,
    imageUrl: item.image?.src || null,
    productUrl: payload.abandoned_checkout_url || null,
  }));

  const customerName = [
    payload.customer?.first_name,
    payload.customer?.last_name,
  ]
    .filter(Boolean)
    .join(' ') || null;

  const cartTotal = parseFloat(payload.total_price || '0');
  const abandonedAt = payload.created_at
    ? new Date(payload.created_at)
    : new Date();

  // Upsert the abandoned cart record
  try {
    await db.abandonedCart.upsert({
      where: {
        connectionId_externalId: {
          connectionId: connection.id,
          externalId: String(payload.id),
        },
      },
      create: {
        connectionId: connection.id,
        externalId: String(payload.id),
        customerEmail: payload.email,
        customerName,
        cartTotal,
        currency: payload.currency || 'USD',
        cartItems,
        abandonedAt,
      },
      update: {
        customerEmail: payload.email,
        customerName,
        cartTotal,
        currency: payload.currency || 'USD',
        cartItems,
        abandonedAt,
      },
    });

    console.log(
      `[Shopify Webhook] Upserted abandoned cart ${payload.id} for ${payload.email} (shop: ${shopDomain})`
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[Shopify Webhook] Failed to upsert abandoned cart: ${message}`);
    // Return 500 for transient DB errors so Shopify retries
    return NextResponse.json(
      { error: 'Failed to process webhook' },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
