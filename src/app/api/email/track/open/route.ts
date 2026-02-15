import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// 1x1 transparent GIF pixel
const TRACKING_PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);

/**
 * GET /api/email/track/open?sid=<sendId>
 * Returns a 1x1 transparent GIF and records the open event.
 * This is the standard email open tracking technique.
 */
export async function GET(request: NextRequest) {
  const sendId = request.nextUrl.searchParams.get('sid');

  if (sendId) {
    try {
      const send = await db.emailSend.findUnique({
        where: { id: sendId },
      });

      if (send && !send.openedAt) {
        // Record first open
        await db.emailSend.update({
          where: { id: sendId },
          data: { status: 'OPENED', openedAt: new Date() },
        });

        // Create event
        await db.emailEvent.create({
          data: {
            sendId,
            contactId: send.contactId,
            type: 'OPENED',
            ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
            userAgent: request.headers.get('user-agent') || null,
          },
        });

        // Update contact engagement
        await db.emailContact.update({
          where: { id: send.contactId },
          data: {
            lastOpenAt: new Date(),
            openCount: { increment: 1 },
          },
        });

        // Update campaign stats
        await db.emailCampaign.update({
          where: { id: send.campaignId },
          data: { totalOpened: { increment: 1 } },
        });
      }
    } catch {
      // Silently fail - don't break the email display
    }
  }

  return new NextResponse(TRACKING_PIXEL, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Content-Length': TRACKING_PIXEL.length.toString(),
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  });
}
