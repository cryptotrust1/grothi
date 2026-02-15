import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { sendEmail, checkDailyLimit, wrapLinksForTracking, getTrackingPixelUrl } from '@/lib/email';

/**
 * POST /api/email/campaigns
 * Send a campaign (change status from DRAFT to SENDING, then send emails)
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    let body: { campaignId: string; action: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const { campaignId, action } = body;

    if (!campaignId || !action) {
      return NextResponse.json({ error: 'campaignId and action required' }, { status: 400 });
    }

    const campaign = await db.emailCampaign.findFirst({
      where: { id: campaignId },
      include: {
        bot: true,
        account: true,
        list: {
          include: {
            contacts: {
              where: { status: 'ACTIVE' },
            },
          },
        },
      },
    });

    if (!campaign || campaign.bot.userId !== user.id) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Send now
    if (action === 'send') {
      if (campaign.status !== 'DRAFT' && campaign.status !== 'SCHEDULED') {
        return NextResponse.json({ error: 'Campaign already sent or in progress' }, { status: 400 });
      }

      const contacts = campaign.list.contacts;
      if (contacts.length === 0) {
        return NextResponse.json({ error: 'No active contacts in this list' }, { status: 400 });
      }

      // Check daily limit
      const limitStatus = checkDailyLimit(
        campaign.account.sentToday,
        campaign.account.dailyLimit,
        campaign.account.lastResetAt,
      );

      if (!limitStatus.canSend) {
        return NextResponse.json({ error: 'Daily sending limit reached' }, { status: 429 });
      }

      const maxToSend = Math.min(contacts.length, limitStatus.remaining);

      // Update campaign status
      await db.emailCampaign.update({
        where: { id: campaignId },
        data: { status: 'SENDING', sentAt: new Date() },
      });

      // Determine base URL
      const baseUrl = process.env.NEXTAUTH_URL || 'https://grothi.com';

      let sent = 0;
      let failed = 0;
      const contactsToSend = contacts.slice(0, maxToSend);

      for (const contact of contactsToSend) {
        // Create send record
        const emailSend = await db.emailSend.create({
          data: {
            campaignId,
            contactId: contact.id,
            status: 'QUEUED',
          },
        });

        // Personalize content
        let html = campaign.htmlContent;
        html = html.replace(/\{\{firstName\}\}/g, contact.firstName || '');
        html = html.replace(/\{\{lastName\}\}/g, contact.lastName || '');
        html = html.replace(/\{\{email\}\}/g, contact.email);

        // Add tracking pixel
        const trackingPixelUrl = getTrackingPixelUrl(emailSend.id, baseUrl);

        // Wrap links for click tracking
        html = wrapLinksForTracking(html, emailSend.id, baseUrl);

        // Add unsubscribe footer
        const unsubscribeUrl = `${baseUrl}/api/email/unsubscribe?cid=${encodeURIComponent(contact.id)}&lid=${encodeURIComponent(campaign.listId)}`;
        html += `<div style="margin-top:20px;padding-top:15px;border-top:1px solid #eee;font-size:12px;color:#999;text-align:center;">`;
        html += `<p>You received this because you subscribed to ${campaign.bot.brandName}.</p>`;
        html += `<p><a href="${unsubscribeUrl}" style="color:#999;">Unsubscribe</a></p>`;
        html += `</div>`;

        // Personalize text version
        let text = campaign.textContent || '';
        if (text) {
          text = text.replace(/\{\{firstName\}\}/g, contact.firstName || '');
          text = text.replace(/\{\{lastName\}\}/g, contact.lastName || '');
          text = text.replace(/\{\{email\}\}/g, contact.email);
          text += `\n\nUnsubscribe: ${unsubscribeUrl}`;
        }

        const smtpConfig = {
          smtpHost: campaign.account.smtpHost,
          smtpPort: campaign.account.smtpPort,
          smtpUser: campaign.account.smtpUser,
          smtpPass: campaign.account.smtpPass,
          smtpSecure: campaign.account.smtpSecure,
        };

        const result = await sendEmail({
          config: smtpConfig,
          from: campaign.account.email,
          fromName: campaign.fromName || campaign.account.fromName || undefined,
          to: contact.email,
          subject: campaign.subject,
          html,
          text: text || undefined,
          unsubscribeUrl,
          trackingPixelUrl,
        });

        if (result.success) {
          await db.emailSend.update({
            where: { id: emailSend.id },
            data: {
              status: 'SENT',
              messageId: result.messageId,
              sentAt: new Date(),
            },
          });

          await db.emailEvent.create({
            data: {
              sendId: emailSend.id,
              contactId: contact.id,
              type: 'SENT',
            },
          });

          sent++;
        } else {
          await db.emailSend.update({
            where: { id: emailSend.id },
            data: {
              status: 'FAILED',
              error: result.error,
            },
          });
          failed++;
        }
      }

      // Reset daily counter if needed
      const limitCheck = checkDailyLimit(
        campaign.account.sentToday,
        campaign.account.dailyLimit,
        campaign.account.lastResetAt,
      );

      await db.emailAccount.update({
        where: { id: campaign.account.id },
        data: {
          sentToday: limitCheck.needsReset ? sent : campaign.account.sentToday + sent,
          lastResetAt: limitCheck.needsReset ? new Date() : undefined,
        },
      });

      // Update campaign stats
      await db.emailCampaign.update({
        where: { id: campaignId },
        data: {
          status: failed === contactsToSend.length ? 'FAILED' : 'SENT',
          completedAt: new Date(),
          totalSent: sent,
          totalBounced: failed,
        },
      });

      return NextResponse.json({
        success: true,
        sent,
        failed,
        total: contactsToSend.length,
      });
    }

    // Cancel
    if (action === 'cancel') {
      if (campaign.status === 'SENT' || campaign.status === 'SENDING') {
        return NextResponse.json({ error: 'Cannot cancel a campaign that is already sending/sent' }, { status: 400 });
      }

      await db.emailCampaign.update({
        where: { id: campaignId },
        data: { status: 'CANCELLED' },
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action. Use "send" or "cancel".' }, { status: 400 });
  } catch (error) {
    if (error instanceof Error && error.message === 'NEXT_REDIRECT') throw error;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 },
    );
  }
}
