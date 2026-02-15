import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/email/track/click?sid=<sendId>&url=<destinationUrl>
 * Records the click event and redirects to the destination URL.
 */
export async function GET(request: NextRequest) {
  const sendId = request.nextUrl.searchParams.get('sid');
  const url = request.nextUrl.searchParams.get('url');

  if (!url) {
    return new NextResponse('Missing URL', { status: 400 });
  }

  // Validate URL to prevent open redirect
  let destinationUrl: URL;
  try {
    destinationUrl = new URL(url);
    if (!['http:', 'https:'].includes(destinationUrl.protocol)) {
      return new NextResponse('Invalid URL protocol', { status: 400 });
    }
  } catch {
    return new NextResponse('Invalid URL', { status: 400 });
  }

  if (sendId) {
    try {
      const send = await db.emailSend.findUnique({
        where: { id: sendId },
      });

      if (send) {
        // Record click if first click
        if (!send.clickedAt) {
          await db.emailSend.update({
            where: { id: sendId },
            data: { status: 'CLICKED', clickedAt: new Date() },
          });
        }

        // Create event with URL data
        await db.emailEvent.create({
          data: {
            sendId,
            contactId: send.contactId,
            type: 'CLICKED',
            data: { url: destinationUrl.toString() },
            ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
            userAgent: request.headers.get('user-agent') || null,
          },
        });

        // Update contact engagement
        await db.emailContact.update({
          where: { id: send.contactId },
          data: {
            lastClickAt: new Date(),
            clickCount: { increment: 1 },
          },
        });

        // Update campaign stats
        await db.emailCampaign.update({
          where: { id: send.campaignId },
          data: { totalClicked: { increment: 1 } },
        });
      }
    } catch {
      // Silently fail - still redirect
    }
  }

  return NextResponse.redirect(destinationUrl.toString(), 302);
}
