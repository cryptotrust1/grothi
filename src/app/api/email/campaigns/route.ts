import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { sendCampaignEmail, checkDailyLimit, prepareCampaignHtml, sleep } from '@/lib/email';

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

      const smtpConfig = {
        smtpHost: campaign.account.smtpHost,
        smtpPort: campaign.account.smtpPort,
        smtpUser: campaign.account.smtpUser,
        smtpPass: campaign.account.smtpPass,
        smtpSecure: campaign.account.smtpSecure,
      };

      for (const contact of contactsToSend) {
        // Create send record
        const emailSend = await db.emailSend.create({
          data: {
            campaignId,
            contactId: contact.id,
            status: 'QUEUED',
          },
        });

        // Prepare email using shared helper (personalization, tracking, unsubscribe)
        const prepared = prepareCampaignHtml({
          html: campaign.htmlContent,
          text: campaign.textContent,
          contact,
          sendId: emailSend.id,
          listId: campaign.listId,
          brandName: campaign.bot.brandName,
          baseUrl,
          physicalAddress: campaign.account.physicalAddress,
        });

        const result = await sendCampaignEmail({
          config: smtpConfig,
          from: campaign.account.email,
          fromName: campaign.fromName || campaign.account.fromName || undefined,
          to: contact.email,
          subject: campaign.subject,
          html: prepared.html,
          text: prepared.text,
          unsubscribeUrl: prepared.unsubscribeUrl,
          trackingPixelUrl: prepared.trackingPixelUrl,
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

          // NOTE: softBounceCount is NOT reset here. SMTP acceptance != delivery.
          // The counter is reset only when a DELIVERED webhook event arrives,
          // confirming actual mailbox delivery. See webhooks/route.ts.

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

        // Rate limiting: 100ms between sends (~600/min) to avoid SMTP throttling
        if (contactsToSend.indexOf(contact) < contactsToSend.length - 1) {
          await sleep(100);
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
