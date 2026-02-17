import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyUnsubscribeSignature } from '@/lib/email';

/**
 * GET /api/email/unsubscribe?cid=<contactId>&lid=<listId>
 * One-click unsubscribe page (CAN-SPAM + GDPR compliant).
 * Marks contact as UNSUBSCRIBED and updates campaign stats.
 */
export async function GET(request: NextRequest) {
  const contactId = request.nextUrl.searchParams.get('cid');
  const listId = request.nextUrl.searchParams.get('lid');
  const sig = request.nextUrl.searchParams.get('sig');

  if (!contactId || !listId) {
    return new NextResponse(unsubscribePage('Invalid unsubscribe link.', false), {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  // Verify HMAC signature to prevent forged unsubscribes
  if (sig && !verifyUnsubscribeSignature(contactId, listId, sig)) {
    return new NextResponse(unsubscribePage('Invalid unsubscribe link.', false), {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  try {
    const contact = await db.emailContact.findFirst({
      where: { id: contactId, listId },
    });

    if (!contact) {
      return new NextResponse(unsubscribePage('Contact not found or already removed.', false), {
        status: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    if (contact.status === 'UNSUBSCRIBED') {
      return new NextResponse(unsubscribePage('You have already been unsubscribed.', true), {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // Mark as unsubscribed
    await db.emailContact.update({
      where: { id: contactId },
      data: { status: 'UNSUBSCRIBED' },
    });

    // Update list contact count
    const activeCount = await db.emailContact.count({
      where: { listId, status: 'ACTIVE' },
    });
    await db.emailList.update({
      where: { id: listId },
      data: { contactCount: activeCount },
    });

    // Record unsubscribe events on any sends for this contact
    const recentSends = await db.emailSend.findMany({
      where: { contactId },
      orderBy: { createdAt: 'desc' },
      take: 1,
    });

    for (const send of recentSends) {
      await db.emailEvent.create({
        data: {
          sendId: send.id,
          contactId,
          type: 'UNSUBSCRIBED',
        },
      });

      await db.emailCampaign.update({
        where: { id: send.campaignId },
        data: { totalUnsubscribed: { increment: 1 } },
      });
    }

    return new NextResponse(unsubscribePage('You have been successfully unsubscribed.', true), {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch {
    return new NextResponse(unsubscribePage('Something went wrong. Please try again later.', false), {
      status: 500,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
}

/**
 * POST handler for List-Unsubscribe-Post (one-click unsubscribe, RFC 8058)
 */
export async function POST(request: NextRequest) {
  return GET(request);
}

function unsubscribePage(message: string, success: boolean): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Unsubscribe</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f9fafb; }
    .card { background: white; border-radius: 12px; padding: 40px; max-width: 400px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .icon { font-size: 48px; margin-bottom: 16px; }
    h1 { font-size: 20px; color: #111; margin: 0 0 8px; }
    p { color: #666; font-size: 14px; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${success ? '&#9989;' : '&#10060;'}</div>
    <h1>${success ? 'Unsubscribed' : 'Error'}</h1>
    <p>${message}</p>
    ${success ? '<p style="margin-top:16px;color:#999;font-size:12px;">You will no longer receive emails from this list.</p>' : ''}
  </div>
</body>
</html>`;
}
