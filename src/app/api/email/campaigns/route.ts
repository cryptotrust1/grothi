import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { sendCampaignEmail, checkDailyLimit, prepareCampaignHtml, sleep } from '@/lib/email';
import { createOAuthTransporter } from '@/lib/oauth';
import {
  analyzeSpamScore,
  getEffectiveDailyLimit,
  checkCampaignHealth,
  getSendDelay,
} from '@/lib/email-antispam';

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

      // Anti-spam: Check content spam score before sending
      const spamCheck = analyzeSpamScore(campaign.subject, campaign.htmlContent);
      if (spamCheck.level === 'blocked') {
        return NextResponse.json({
          error: 'Campaign blocked by spam filter. Fix these issues before sending.',
          spamScore: spamCheck.score,
          warnings: spamCheck.warnings,
        }, { status: 422 });
      }

      // Anti-spam: Check recent campaign health (bounce/complaint rates)
      const recentCampaigns = await db.emailCampaign.findMany({
        where: {
          accountId: campaign.accountId,
          status: 'SENT',
          sentAt: { gte: new Date(Date.now() - 30 * 86400000) }, // last 30 days
        },
        select: { totalSent: true, totalBounced: true, totalComplaints: true },
      });
      const healthCheck = checkCampaignHealth(recentCampaigns);
      if (!healthCheck.canSend) {
        return NextResponse.json({
          error: 'Sending paused due to poor sender reputation. Fix list quality before resuming.',
          warnings: healthCheck.warnings,
          bounceRate: healthCheck.bounceRate,
          complaintRate: healthCheck.complaintRate,
        }, { status: 422 });
      }

      // Anti-spam: Apply warm-up daily limit (account age based)
      const warmup = getEffectiveDailyLimit(campaign.account.dailyLimit, campaign.account.createdAt);

      // Check daily limit (using warm-up adjusted limit)
      const limitStatus = checkDailyLimit(
        campaign.account.sentToday,
        warmup.limit,
        campaign.account.lastResetAt,
      );

      if (!limitStatus.canSend) {
        const msg = warmup.isWarmupRestricted
          ? `Warm-up limit reached (day ${warmup.warmupDay}, max ${warmup.limit}/day). Your account is still building reputation.`
          : 'Daily sending limit reached';
        return NextResponse.json({ error: msg }, { status: 429 });
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

      // For OAuth2 accounts, create a reusable OAuth transporter
      let oauthTransporter: Awaited<ReturnType<typeof createOAuthTransporter>> | null = null;
      if (campaign.account.authMethod === 'OAUTH2' && campaign.account.oauthAccessToken && campaign.account.oauthRefreshToken) {
        try {
          oauthTransporter = await createOAuthTransporter({
            email: campaign.account.email,
            oauthAccessToken: campaign.account.oauthAccessToken,
            oauthRefreshToken: campaign.account.oauthRefreshToken,
            oauthTokenExpiry: campaign.account.oauthTokenExpiry!,
            provider: campaign.account.provider as 'GOOGLE' | 'MICROSOFT',
          });
          // Persist refreshed tokens if needed
          if (oauthTransporter.tokenRefreshed) {
            const { encrypt } = await import('@/lib/encryption');
            await db.emailAccount.update({
              where: { id: campaign.account.id },
              data: {
                oauthAccessToken: encrypt(oauthTransporter.accessToken),
                oauthTokenExpiry: oauthTransporter.expiresAt,
              },
            });
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'OAuth transporter error';
          console.error(`[CAMPAIGN] OAuth transporter failed: ${msg}`);
          await db.emailCampaign.update({
            where: { id: campaignId },
            data: { status: 'FAILED' },
          });
          return NextResponse.json({ error: `OAuth error: ${msg}` }, { status: 500 });
        }
      }

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
          transporter: oauthTransporter?.transporter,
          campaignId,
          botId: campaign.botId,
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

        // Anti-spam: Rate limiting based on account age (newer accounts = slower)
        if (contactsToSend.indexOf(contact) < contactsToSend.length - 1) {
          await sleep(getSendDelay(campaign.account.createdAt));
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
        // Include anti-spam feedback so the UI can display warnings
        ...(spamCheck.warnings.length > 0 ? {
          spamScore: spamCheck.score,
          spamLevel: spamCheck.level,
          spamWarnings: spamCheck.warnings,
        } : {}),
        ...(warmup.isWarmupRestricted ? {
          warmupDay: warmup.warmupDay,
          warmupLimit: warmup.limit,
        } : {}),
        ...(healthCheck.warnings.length > 0 ? {
          healthWarnings: healthCheck.warnings,
        } : {}),
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
