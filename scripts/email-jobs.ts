/**
 * Email Jobs Runner
 *
 * Standalone script to process:
 * 1. Scheduled campaigns (scheduledAt <= now)
 * 2. Automation enrollments (welcome, re-engagement, drip)
 * 3. Retry failed sends (up to 3 retries)
 * 4. A/B test winner computation
 * 5. Auto list cleaning (bounce/inactive)
 *
 * Run via cron every minute: * * * * * cd /home/acechange-bot/grothi && node scripts/email-jobs.js
 * Or via PM2: pm2 start scripts/email-jobs.js --name grothi-email-jobs --cron "* * * * *" --no-autorestart
 */

import { PrismaClient } from '@prisma/client';
import type { Transporter } from 'nodemailer';
import {
  createTransporter,
  sendCampaignEmail,
  prepareCampaignHtml,
  checkDailyLimit,
} from '../src/lib/email';
import { createOAuthTransporter } from '../src/lib/oauth';
import { encrypt } from '../src/lib/encryption';
import { deductCredits, getActionCost, hasEnoughCredits } from '../src/lib/credits';
import {
  analyzeSpamScore,
  getEffectiveDailyLimit,
  checkCampaignHealth,
  getSendingPace,
  evaluateContactEngagement,
} from '../src/lib/email-antispam';

const db = new PrismaClient();
const BASE_URL = process.env.NEXTAUTH_URL || 'https://grothi.com';
const MAX_RETRIES = 3;

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] [EMAIL-JOBS] ${msg}`);
}

function logError(msg: string) {
  console.error(`[${new Date().toISOString()}] [EMAIL-JOBS] ERROR: ${msg}`);
}

// ============ 1. SCHEDULED CAMPAIGNS ============

async function processScheduledCampaigns() {
  const now = new Date();

  const campaigns = await db.emailCampaign.findMany({
    where: {
      status: 'SCHEDULED',
      scheduledAt: { lte: now },
    },
    include: {
      account: true,
      list: true,
      bot: true,
    },
  });

  if (campaigns.length === 0) return;

  log(`Found ${campaigns.length} scheduled campaign(s) to send`);

  for (const campaign of campaigns) {
    try {
      await sendScheduledCampaign(campaign);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logError(`Campaign ${campaign.id} failed: ${msg}`);
      await db.emailCampaign.update({
        where: { id: campaign.id },
        data: { status: 'FAILED' },
      });
    }
  }
}

async function sendScheduledCampaign(campaign: Awaited<ReturnType<typeof db.emailCampaign.findFirst>> & {
  account: Awaited<ReturnType<typeof db.emailAccount.findFirst>>;
  bot: Awaited<ReturnType<typeof db.bot.findFirst>>;
}) {
  if (!campaign || !campaign.account || !campaign.bot) return;

  const contacts = await db.emailContact.findMany({
    where: { listId: campaign.listId, status: 'ACTIVE' },
  });

  if (contacts.length === 0) {
    log(`Campaign ${campaign.id}: no active contacts, marking SENT`);
    await db.emailCampaign.update({
      where: { id: campaign.id },
      data: { status: 'SENT', completedAt: new Date() },
    });
    return;
  }

  // Check credits
  const emailCost = await getActionCost('SEND_EMAIL');
  const totalCost = contacts.length * emailCost;
  const userId = campaign.bot.userId;

  if (!(await hasEnoughCredits(userId, totalCost))) {
    logError(`Campaign ${campaign.id}: insufficient credits (need ${totalCost})`);
    await db.emailCampaign.update({
      where: { id: campaign.id },
      data: { status: 'FAILED' },
    });
    return;
  }

  // Anti-spam: Check content spam score before sending
  const spamCheck = analyzeSpamScore(campaign.subject, campaign.htmlContent);
  if (spamCheck.level === 'blocked') {
    logError(`Campaign ${campaign.id}: blocked by spam filter (score ${spamCheck.score}): ${spamCheck.warnings.join('; ')}`);
    await db.emailCampaign.update({
      where: { id: campaign.id },
      data: { status: 'FAILED' },
    });
    return;
  }
  if (spamCheck.warnings.length > 0) {
    log(`Campaign ${campaign.id} spam warnings: ${spamCheck.warnings.join('; ')}`);
  }

  // Anti-spam: Check recent campaign health (bounce/complaint rates)
  const recentCampaigns = await db.emailCampaign.findMany({
    where: {
      accountId: campaign.account.id,
      status: 'SENT',
      sentAt: { gte: new Date(Date.now() - 30 * 86400000) },
    },
    select: { totalSent: true, totalBounced: true, totalComplaints: true },
  });
  const healthCheck = checkCampaignHealth(recentCampaigns);
  if (!healthCheck.canSend) {
    logError(`Campaign ${campaign.id}: sending paused due to poor health — ${healthCheck.warnings.join('; ')}`);
    // Don't mark as FAILED — keep SCHEDULED so it can resume after cleanup
    return;
  }

  // Anti-spam: Apply warm-up daily limit (account age based)
  const warmup = getEffectiveDailyLimit(campaign.account.dailyLimit, campaign.account.createdAt);
  if (warmup.isWarmupRestricted) {
    log(`Campaign ${campaign.id}: warm-up day ${warmup.warmupDay}, limit ${warmup.limit}/day`);
  }

  // Check daily limit with warm-up adjusted value
  const limitCheck = checkDailyLimit(
    campaign.account.sentToday,
    warmup.limit,
    campaign.account.lastResetAt,
  );

  if (limitCheck.needsReset) {
    await db.emailAccount.update({
      where: { id: campaign.account.id },
      data: { sentToday: 0, lastResetAt: new Date() },
    });
  }

  const maxToSend = Math.min(contacts.length, limitCheck.needsReset ? warmup.limit : limitCheck.remaining);

  if (maxToSend === 0) {
    logError(`Campaign ${campaign.id}: daily limit reached (warm-up day ${warmup.warmupDay}, limit ${warmup.limit})`);
    return; // Keep SCHEDULED, will retry next run
  }

  await db.emailCampaign.update({
    where: { id: campaign.id },
    data: { status: 'SENDING', sentAt: new Date() },
  });

  const contactsToSend = contacts.slice(0, maxToSend);
  const smtpConfig = {
    smtpHost: campaign.account.smtpHost,
    smtpPort: campaign.account.smtpPort,
    smtpUser: campaign.account.smtpUser,
    smtpPass: campaign.account.smtpPass,
    smtpSecure: campaign.account.smtpSecure,
  };

  // Anti-spam: Get account-age-based sending pace
  const pace = getSendingPace(campaign.account.createdAt);

  // Create OAuth transporter for OAuth2 accounts
  let oauthTransporterInstance: Transporter | undefined;
  if (campaign.account.authMethod === 'OAUTH2' && campaign.account.oauthAccessToken && campaign.account.oauthRefreshToken) {
    try {
      const oauthResult = await createOAuthTransporter({
        email: campaign.account.email,
        oauthAccessToken: campaign.account.oauthAccessToken,
        oauthRefreshToken: campaign.account.oauthRefreshToken,
        oauthTokenExpiry: campaign.account.oauthTokenExpiry!,
        provider: campaign.account.provider as 'GOOGLE' | 'MICROSOFT',
      });
      oauthTransporterInstance = oauthResult.transporter;
      if (oauthResult.tokenRefreshed) {
        await db.emailAccount.update({
          where: { id: campaign.account.id },
          data: {
            oauthAccessToken: encrypt(oauthResult.accessToken),
            oauthTokenExpiry: oauthResult.expiresAt,
          },
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      logError(`Campaign ${campaign.id}: OAuth transporter failed: ${msg}`);
      await db.emailCampaign.update({
        where: { id: campaign.id },
        data: { status: 'FAILED' },
      });
      return;
    }
  }

  // A/B test split
  const hasAbTest = !!(campaign.subjectB && campaign.abTestPercent);
  let sent = 0;
  let failed = 0;

  // Process in batches (pace is account-age-based for warm-up)
  for (let i = 0; i < contactsToSend.length; i += pace.batchSize) {
    const batch = contactsToSend.slice(i, i + pace.batchSize);

    for (let j = 0; j < batch.length; j++) {
      const contact = batch[j];
      // Determine variant for A/B test
      let subject = campaign.subject;
      let variant: string | null = null;

      if (hasAbTest) {
        // Simple alternating split
        const contactIndex = contactsToSend.indexOf(contact);
        if (contactIndex % 2 === 0) {
          variant = 'A';
          subject = campaign.subject;
        } else {
          variant = 'B';
          subject = campaign.subjectB!;
        }
      }

      const result = await sendOneEmail(campaign, contact, smtpConfig, subject, variant, oauthTransporterInstance);
      if (result) sent++;
      else failed++;

      // Anti-spam: Per-email delay based on account age
      if (j < batch.length - 1) {
        await sleep(pace.perEmailDelayMs);
      }
    }

    // Delay between batches to avoid rate limiting
    if (i + pace.batchSize < contactsToSend.length) {
      await sleep(pace.batchDelayMs);
    }
  }

  // Update daily count
  await db.emailAccount.update({
    where: { id: campaign.account.id },
    data: { sentToday: { increment: sent } },
  });

  // Deduct credits
  if (sent > 0) {
    await deductCredits(userId, sent * emailCost, `Campaign "${campaign.name}" — ${sent} emails`, campaign.botId);
  }

  // Determine A/B winner
  let abWinner: string | null = null;
  if (hasAbTest) {
    abWinner = 'PENDING';
  }

  await db.emailCampaign.update({
    where: { id: campaign.id },
    data: {
      status: failed === contactsToSend.length ? 'FAILED' : 'SENT',
      completedAt: new Date(),
      totalSent: sent,
      totalBounced: failed,
      creditsUsed: sent * emailCost,
      ...(abWinner ? { abWinner } : {}),
    },
  });

  log(`Campaign ${campaign.id} "${campaign.name}": ${sent} sent, ${failed} failed`);
}

async function sendOneEmail(
  campaign: { id: string; htmlContent: string; textContent: string | null; fromName: string | null; listId: string; bot: { brandName: string } | null; account: { email: string; fromName: string | null; physicalAddress: string | null } | null },
  contact: { id: string; email: string; firstName: string | null; lastName: string | null },
  smtpConfig: { smtpHost: string; smtpPort: number; smtpUser: string; smtpPass: string; smtpSecure: boolean },
  subject: string,
  variant: string | null,
  oauthTransporter?: import('nodemailer').Transporter,
): Promise<boolean> {
  const brandName = campaign.bot?.brandName || 'Newsletter';

  const emailSend = await db.emailSend.create({
    data: { campaignId: campaign.id, contactId: contact.id, status: 'QUEUED', variant },
  });

  // Prepare email using shared helper (personalization, tracking, unsubscribe)
  const prepared = prepareCampaignHtml({
    html: campaign.htmlContent,
    text: campaign.textContent,
    contact,
    sendId: emailSend.id,
    listId: campaign.listId,
    brandName,
    baseUrl: BASE_URL,
    physicalAddress: campaign.account?.physicalAddress,
  });

  const result = await sendCampaignEmail({
    config: smtpConfig,
    from: campaign.account?.email || '',
    fromName: campaign.fromName || campaign.account?.fromName || undefined,
    to: contact.email,
    subject,
    html: prepared.html,
    text: prepared.text,
    unsubscribeUrl: prepared.unsubscribeUrl,
    trackingPixelUrl: prepared.trackingPixelUrl,
    transporter: oauthTransporter,
    campaignId: campaign.id,
  });

  if (result.success) {
    await db.emailSend.update({
      where: { id: emailSend.id },
      data: { status: 'SENT', messageId: result.messageId, sentAt: new Date() },
    });
    await db.emailEvent.create({
      data: { sendId: emailSend.id, contactId: contact.id, type: 'SENT' },
    });
    return true;
  } else {
    await db.emailSend.update({
      where: { id: emailSend.id },
      data: { status: 'FAILED', error: result.error },
    });
    return false;
  }
}

// ============ 2. AUTOMATION ENROLLMENTS ============

async function processAutomationEnrollments() {
  // Find contacts that were recently added to lists with active WELCOME automations
  // and haven't been enrolled yet
  await enrollNewContactsInWelcome();

  // Find contacts eligible for RE_ENGAGEMENT
  await enrollInactiveContactsForReEngagement();

  // Process pending automation steps
  await processAutomationSteps();
}

async function enrollNewContactsInWelcome() {
  const welcomeAutomations = await db.emailAutomation.findMany({
    where: { isActive: true, type: 'WELCOME' },
    include: { steps: { orderBy: { stepOrder: 'asc' } } },
  });

  for (const automation of welcomeAutomations) {
    if (automation.steps.length === 0) continue;

    // Find contacts added in the last hour that aren't enrolled
    const recentContacts = await db.emailContact.findMany({
      where: {
        status: 'ACTIVE',
        createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
        ...(automation.triggerListId ? { listId: automation.triggerListId } : {}),
        enrollments: {
          none: { automationId: automation.id },
        },
      },
      take: 100,
    });

    if (recentContacts.length === 0) continue;

    log(`Welcome automation "${automation.name}": enrolling ${recentContacts.length} new contact(s)`);

    const firstStep = automation.steps[0];
    const delayMs = (firstStep.delayDays * 86400 + firstStep.delayHours * 3600) * 1000;
    const nextStepAt = new Date(Date.now() + delayMs);

    for (const contact of recentContacts) {
      try {
        await db.automationEnrollment.create({
          data: {
            automationId: automation.id,
            contactId: contact.id,
            currentStep: 0,
            nextStepAt: delayMs === 0 ? new Date() : nextStepAt,
          },
        });
      } catch {
        // Unique constraint violation — already enrolled
      }
    }
  }
}

async function enrollInactiveContactsForReEngagement() {
  const reEngagementAutomations = await db.emailAutomation.findMany({
    where: { isActive: true, type: 'RE_ENGAGEMENT' },
    include: { steps: { orderBy: { stepOrder: 'asc' } } },
  });

  for (const automation of reEngagementAutomations) {
    if (automation.steps.length === 0) continue;

    const config = automation.triggerConfig as { delayDays?: number } | null;
    const inactiveDays = config?.delayDays || 30;
    const cutoff = new Date(Date.now() - inactiveDays * 86400000);

    const inactiveContacts = await db.emailContact.findMany({
      where: {
        status: 'ACTIVE',
        ...(automation.triggerListId ? { listId: automation.triggerListId } : {}),
        OR: [
          { lastOpenAt: null, createdAt: { lte: cutoff } },
          { lastOpenAt: { lte: cutoff } },
        ],
        enrollments: {
          none: { automationId: automation.id },
        },
      },
      take: 50,
    });

    if (inactiveContacts.length === 0) continue;

    log(`Re-engagement automation "${automation.name}": enrolling ${inactiveContacts.length} inactive contact(s)`);

    const firstStep = automation.steps[0];
    const delayMs = (firstStep.delayDays * 86400 + firstStep.delayHours * 3600) * 1000;

    for (const contact of inactiveContacts) {
      try {
        await db.automationEnrollment.create({
          data: {
            automationId: automation.id,
            contactId: contact.id,
            currentStep: 0,
            nextStepAt: delayMs === 0 ? new Date() : new Date(Date.now() + delayMs),
          },
        });
      } catch {
        // Already enrolled
      }
    }
  }
}

async function processAutomationSteps() {
  const now = new Date();

  const pendingEnrollments = await db.automationEnrollment.findMany({
    where: {
      completed: false,
      cancelled: false,
      nextStepAt: { lte: now },
    },
    include: {
      automation: {
        include: {
          bot: { include: { emailAccount: true } },
          steps: { orderBy: { stepOrder: 'asc' } },
        },
      },
      contact: true,
    },
    take: 100,
  });

  if (pendingEnrollments.length === 0) return;

  log(`Processing ${pendingEnrollments.length} automation step(s)`);

  for (const enrollment of pendingEnrollments) {
    const { automation, contact } = enrollment;
    const account = automation.bot?.emailAccount;

    if (!account || !automation.bot) {
      await db.automationEnrollment.update({
        where: { id: enrollment.id },
        data: { cancelled: true },
      });
      continue;
    }

    // Contact unsubscribed/bounced?
    if (contact.status !== 'ACTIVE') {
      await db.automationEnrollment.update({
        where: { id: enrollment.id },
        data: { cancelled: true },
      });
      continue;
    }

    const stepIndex = enrollment.currentStep;
    const step = automation.steps[stepIndex];

    if (!step) {
      // All steps completed
      await db.automationEnrollment.update({
        where: { id: enrollment.id },
        data: { completed: true },
      });
      continue;
    }

    // Check daily limit
    const limitCheck = checkDailyLimit(account.sentToday, account.dailyLimit, account.lastResetAt);
    if (limitCheck.needsReset) {
      await db.emailAccount.update({
        where: { id: account.id },
        data: { sentToday: 0, lastResetAt: new Date() },
      });
    }
    if (!limitCheck.needsReset && !limitCheck.canSend) {
      continue; // Skip, will retry next run
    }

    // Check credits
    const emailCost = await getActionCost('SEND_EMAIL');
    if (!(await hasEnoughCredits(automation.bot.userId, emailCost))) {
      log(`Automation "${automation.name}": insufficient credits for user ${automation.bot.userId}`);
      continue;
    }

    // Prepare email using shared helper
    const smtpConfig = {
      smtpHost: account.smtpHost,
      smtpPort: account.smtpPort,
      smtpUser: account.smtpUser,
      smtpPass: account.smtpPass,
      smtpSecure: account.smtpSecure,
    };

    const prepared = prepareCampaignHtml({
      html: step.htmlContent,
      text: step.textContent,
      contact: { ...contact, id: contact.id },
      sendId: `auto-${enrollment.id}-${stepIndex}`,
      listId: contact.listId,
      brandName: automation.bot.brandName,
      baseUrl: BASE_URL,
      physicalAddress: account.physicalAddress,
    });

    try {
      const result = await sendCampaignEmail({
        config: smtpConfig,
        from: account.email,
        fromName: account.fromName || undefined,
        to: contact.email,
        subject: step.subject,
        html: prepared.html,
        text: prepared.text,
        unsubscribeUrl: prepared.unsubscribeUrl,
      });

      if (result.success) {
        // Deduct credits
        await deductCredits(
          automation.bot.userId,
          emailCost,
          `Automation "${automation.name}" step ${stepIndex + 1}`,
          automation.botId,
        );

        // Update daily count
        await db.emailAccount.update({
          where: { id: account.id },
          data: { sentToday: { increment: 1 } },
        });

        // Advance to next step
        const nextStepIndex = stepIndex + 1;
        const nextStep = automation.steps[nextStepIndex];

        if (nextStep) {
          const delayMs = (nextStep.delayDays * 86400 + nextStep.delayHours * 3600) * 1000;
          await db.automationEnrollment.update({
            where: { id: enrollment.id },
            data: {
              currentStep: nextStepIndex,
              lastStepAt: new Date(),
              nextStepAt: new Date(Date.now() + delayMs),
            },
          });
        } else {
          // Last step completed
          await db.automationEnrollment.update({
            where: { id: enrollment.id },
            data: {
              currentStep: nextStepIndex,
              lastStepAt: new Date(),
              completed: true,
            },
          });
        }

        log(`Automation "${automation.name}" step ${stepIndex + 1} sent to ${contact.email}`);
      } else {
        logError(`Automation "${automation.name}" step ${stepIndex + 1} failed for ${contact.email}: ${result.error}`);
        // Don't advance — will retry on next run
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logError(`Automation step error: ${msg}`);
    }
  }
}

// ============ 3. RETRY FAILED SENDS ============

async function retryFailedSends() {
  const failedSends = await db.emailSend.findMany({
    where: {
      status: 'FAILED',
      retries: { lt: MAX_RETRIES },
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // last 24h only
    },
    include: {
      campaign: {
        include: {
          account: true,
          bot: true,
        },
      },
      contact: true,
    },
    take: 50,
  });

  if (failedSends.length === 0) return;

  log(`Retrying ${failedSends.length} failed send(s)`);

  for (const send of failedSends) {
    const { campaign, contact } = send;
    const account = campaign.account;

    if (!account || contact.status !== 'ACTIVE') {
      await db.emailSend.update({
        where: { id: send.id },
        data: { retries: MAX_RETRIES }, // Don't retry again
      });
      continue;
    }

    // Check daily limit
    const limitCheck = checkDailyLimit(account.sentToday, account.dailyLimit, account.lastResetAt);
    if (!limitCheck.canSend && !limitCheck.needsReset) continue;

    if (limitCheck.needsReset) {
      await db.emailAccount.update({
        where: { id: account.id },
        data: { sentToday: 0, lastResetAt: new Date() },
      });
    }

    const smtpConfig = {
      smtpHost: account.smtpHost,
      smtpPort: account.smtpPort,
      smtpUser: account.smtpUser,
      smtpPass: account.smtpPass,
      smtpSecure: account.smtpSecure,
    };

    const brandName = campaign.bot?.brandName || 'Newsletter';

    // Prepare email using shared helper (personalization, tracking, unsubscribe)
    const prepared = prepareCampaignHtml({
      html: campaign.htmlContent,
      text: campaign.textContent,
      contact,
      sendId: send.id,
      listId: campaign.listId,
      brandName,
      baseUrl: BASE_URL,
      physicalAddress: campaign.account?.physicalAddress,
    });

    // Determine subject (A/B test variant)
    let subject = campaign.subject;
    if (send.variant === 'B' && campaign.subjectB) {
      subject = campaign.subjectB;
    }

    const result = await sendCampaignEmail({
      config: smtpConfig,
      from: account.email,
      fromName: campaign.fromName || account.fromName || undefined,
      to: contact.email,
      subject,
      html: prepared.html,
      text: prepared.text,
      unsubscribeUrl: prepared.unsubscribeUrl,
      trackingPixelUrl: prepared.trackingPixelUrl,
    });

    if (result.success) {
      await db.emailSend.update({
        where: { id: send.id },
        data: {
          status: 'SENT',
          messageId: result.messageId,
          sentAt: new Date(),
          error: null,
          retries: send.retries + 1,
        },
      });
      await db.emailEvent.create({
        data: { sendId: send.id, contactId: contact.id, type: 'SENT' },
      });
      await db.emailAccount.update({
        where: { id: account.id },
        data: { sentToday: { increment: 1 } },
      });
      await db.emailCampaign.update({
        where: { id: campaign.id },
        data: { totalSent: { increment: 1 }, totalBounced: { decrement: 1 } },
      });

      log(`Retry success: send ${send.id} to ${contact.email} (attempt ${send.retries + 1})`);
    } else {
      await db.emailSend.update({
        where: { id: send.id },
        data: { retries: send.retries + 1, error: result.error },
      });

      // Detect hard bounce patterns
      const errorLower = (result.error || '').toLowerCase();
      if (
        errorLower.includes('user unknown') ||
        errorLower.includes('mailbox not found') ||
        errorLower.includes('does not exist') ||
        errorLower.includes('invalid recipient') ||
        errorLower.includes('550 5.1.1')
      ) {
        // Mark contact as bounced
        await db.emailContact.update({
          where: { id: contact.id },
          data: { status: 'BOUNCED' },
        });
        await db.emailSend.update({
          where: { id: send.id },
          data: { status: 'BOUNCED', bouncedAt: new Date(), retries: MAX_RETRIES },
        });
        log(`Hard bounce detected: ${contact.email} marked as BOUNCED`);
      }
    }
  }
}

// ============ 4. A/B TEST WINNER COMPUTATION ============

async function computeAbTestWinners() {
  const pendingCampaigns = await db.emailCampaign.findMany({
    where: {
      abWinner: 'PENDING',
      status: 'SENT',
      subjectB: { not: null },
    },
    include: {
      sends: { select: { variant: true, openedAt: true, status: true } },
    },
  });

  for (const campaign of pendingCampaigns) {
    const aSends = campaign.sends.filter(s => s.variant === 'A' && s.status !== 'FAILED');
    const bSends = campaign.sends.filter(s => s.variant === 'B' && s.status !== 'FAILED');

    const aOpened = aSends.filter(s => s.openedAt).length;
    const bOpened = bSends.filter(s => s.openedAt).length;

    // Need at least 5 total opens to determine winner
    if (aOpened + bOpened < 5) continue;

    const aRate = aSends.length > 0 ? aOpened / aSends.length : 0;
    const bRate = bSends.length > 0 ? bOpened / bSends.length : 0;

    const winner = aRate >= bRate ? 'A' : 'B';

    await db.emailCampaign.update({
      where: { id: campaign.id },
      data: { abWinner: winner },
    });

    log(`A/B test winner for campaign ${campaign.id}: Variant ${winner} (A: ${(aRate * 100).toFixed(1)}%, B: ${(bRate * 100).toFixed(1)}%)`);
  }
}

// ============ 5. AUTO LIST CLEANING ============

async function autoListCleaning() {
  // Mark contacts as BOUNCED if they have 3+ failed sends
  const bouncedContacts = await db.$queryRaw<{ contactId: string; failCount: number }[]>`
    SELECT "contactId", COUNT(*) as "failCount"
    FROM "EmailSend"
    WHERE status = 'BOUNCED'
    GROUP BY "contactId"
    HAVING COUNT(*) >= 3
  `;

  for (const { contactId } of bouncedContacts) {
    const contact = await db.emailContact.findUnique({ where: { id: contactId } });
    if (contact && contact.status === 'ACTIVE') {
      await db.emailContact.update({
        where: { id: contactId },
        data: { status: 'BOUNCED' },
      });
      // Update list count
      await db.emailList.update({
        where: { id: contact.listId },
        data: { contactCount: { decrement: 1 } },
      });
      log(`Auto-cleaned: ${contact.email} marked BOUNCED (3+ bounce events)`);
    }
  }
}

// ============ 6. ENGAGEMENT-BASED SUNSET POLICY ============

/**
 * Automatically suppress contacts that have not engaged in 180+ days.
 * This prevents sending to inactive addresses which damages sender reputation.
 *
 * Sunset policy:
 * - 181-365 days inactive → mark as UNSUBSCRIBED (sunset)
 * - 365+ days inactive    → mark as UNSUBSCRIBED (dead contact)
 *
 * Only processes ACTIVE contacts. Runs daily (not every minute) to avoid
 * excessive DB queries — the main() function calls this only once per hour.
 */
async function engagementSunset() {
  // Find contacts inactive for 180+ days that are still ACTIVE
  const sunsetCutoff = new Date(Date.now() - 180 * 86400000); // 180 days ago
  const deadCutoff = new Date(Date.now() - 365 * 86400000);   // 365 days ago

  // Dead contacts (365+ days, never engaged since creation)
  const deadContacts = await db.emailContact.findMany({
    where: {
      status: 'ACTIVE',
      OR: [
        // Never opened/clicked AND created > 365 days ago
        { lastOpenAt: null, lastClickAt: null, createdAt: { lte: deadCutoff } },
        // Last engagement > 365 days ago
        { lastOpenAt: { lte: deadCutoff }, lastClickAt: null },
        { lastClickAt: { lte: deadCutoff }, lastOpenAt: null },
        // Both last engagement dates > 365 days ago
        { lastOpenAt: { lte: deadCutoff }, lastClickAt: { lte: deadCutoff } },
      ],
    },
    take: 200, // Process in batches to limit DB load
  });

  let suppressedCount = 0;

  for (const contact of deadContacts) {
    const engagement = evaluateContactEngagement(contact);
    if (engagement.segment === 'dead' || engagement.segment === 'inactive') {
      await db.emailContact.update({
        where: { id: contact.id },
        data: { status: 'UNSUBSCRIBED' },
      });
      await db.emailList.update({
        where: { id: contact.listId },
        data: { contactCount: { decrement: 1 } },
      });
      suppressedCount++;
    }
  }

  // Inactive contacts (180-365 days) — suppress from regular campaigns
  const inactiveContacts = await db.emailContact.findMany({
    where: {
      status: 'ACTIVE',
      OR: [
        { lastOpenAt: null, lastClickAt: null, createdAt: { lte: sunsetCutoff, gt: deadCutoff } },
        { lastOpenAt: { lte: sunsetCutoff, gt: deadCutoff }, lastClickAt: null },
        { lastClickAt: { lte: sunsetCutoff, gt: deadCutoff }, lastOpenAt: null },
      ],
    },
    take: 200,
  });

  for (const contact of inactiveContacts) {
    const engagement = evaluateContactEngagement(contact);
    if (engagement.segment === 'inactive') {
      await db.emailContact.update({
        where: { id: contact.id },
        data: { status: 'UNSUBSCRIBED' },
      });
      await db.emailList.update({
        where: { id: contact.listId },
        data: { contactCount: { decrement: 1 } },
      });
      suppressedCount++;
    }
  }

  if (suppressedCount > 0) {
    log(`Engagement sunset: suppressed ${suppressedCount} inactive contact(s)`);
  }
}

// ============ MAIN ============

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  log('Starting email jobs run...');

  try {
    await processScheduledCampaigns();
  } catch (error) {
    logError(`Scheduled campaigns: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    await processAutomationEnrollments();
  } catch (error) {
    logError(`Automations: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    await retryFailedSends();
  } catch (error) {
    logError(`Retry failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    await computeAbTestWinners();
  } catch (error) {
    logError(`A/B winners: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    await autoListCleaning();
  } catch (error) {
    logError(`List cleaning: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Run engagement sunset once per hour (minute 0 only) to avoid excessive DB queries
  if (new Date().getMinutes() === 0) {
    try {
      await engagementSunset();
    } catch (error) {
      logError(`Engagement sunset: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  log('Email jobs run complete.');
  await db.$disconnect();
}

main().catch((error) => {
  logError(`Fatal: ${error instanceof Error ? error.message : String(error)}`);
  db.$disconnect();
  process.exit(1);
});
