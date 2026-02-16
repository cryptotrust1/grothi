import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { sendCampaignEmail, checkDailyLimit, wrapLinksForTracking, getTrackingPixelUrl } from '@/lib/email';
import { hasEnoughCredits, deductCredits } from '@/lib/credits';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { BotNav } from '@/components/dashboard/bot-nav';
import {
  ArrowLeft, Send, Mail, Users, MousePointer, AlertTriangle,
  Eye, BarChart3, Clock, Ban, TestTube,
} from 'lucide-react';
import { CAMPAIGN_STATUS_CONFIG, CONTACT_STATUS_CONFIG } from '@/lib/constants';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Campaign Details',
  robots: { index: false },
};

// ============ SERVER ACTIONS ============

async function sendTestEmail(formData: FormData) {
  'use server';
  const user = await requireAuth();
  const botId = formData.get('botId') as string;
  const campaignId = formData.get('campaignId') as string;
  const testEmail = (formData.get('testEmail') as string || '').trim();

  if (!testEmail || !testEmail.includes('@')) {
    redirect(`/dashboard/bots/${botId}/email/campaigns/${campaignId}?error=${encodeURIComponent('Valid email required')}`);
  }

  const campaign = await db.emailCampaign.findFirst({
    where: { id: campaignId },
    include: { bot: true, account: true },
  });

  if (!campaign || campaign.bot.userId !== user.id) return;

  const smtpConfig = {
    smtpHost: campaign.account.smtpHost,
    smtpPort: campaign.account.smtpPort,
    smtpUser: campaign.account.smtpUser,
    smtpPass: campaign.account.smtpPass,
    smtpSecure: campaign.account.smtpSecure,
  };

  // Personalize with test data
  let html = campaign.htmlContent;
  html = html.replace(/\{\{firstName\}\}/g, 'Test');
  html = html.replace(/\{\{lastName\}\}/g, 'User');
  html = html.replace(/\{\{email\}\}/g, testEmail);
  html = html.replace(/\{\{brandName\}\}/g, campaign.bot.brandName);

  try {
    const result = await sendCampaignEmail({
      config: smtpConfig,
      from: campaign.account.email,
      fromName: campaign.fromName || campaign.account.fromName || undefined,
      to: testEmail,
      subject: `[TEST] ${campaign.subject}`,
      html,
      text: campaign.textContent || undefined,
    });

    if (result.success) {
      redirect(`/dashboard/bots/${botId}/email/campaigns/${campaignId}?success=${encodeURIComponent('Test email sent to ' + testEmail)}`);
    } else {
      redirect(`/dashboard/bots/${botId}/email/campaigns/${campaignId}?error=${encodeURIComponent('Send failed: ' + (result.error || 'Unknown'))}`);
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'NEXT_REDIRECT') throw error;
    redirect(`/dashboard/bots/${botId}/email/campaigns/${campaignId}?error=${encodeURIComponent('Send failed')}`);
  }
}

async function sendCampaign(formData: FormData) {
  'use server';
  const user = await requireAuth();
  const botId = formData.get('botId') as string;
  const campaignId = formData.get('campaignId') as string;

  const campaign = await db.emailCampaign.findFirst({
    where: { id: campaignId },
    include: {
      bot: true,
      account: true,
      list: {
        include: {
          contacts: { where: { status: 'ACTIVE' } },
        },
      },
    },
  });

  if (!campaign || campaign.bot.userId !== user.id) return;

  if (campaign.status !== 'DRAFT' && campaign.status !== 'SCHEDULED') {
    redirect(`/dashboard/bots/${botId}/email/campaigns/${campaignId}?error=${encodeURIComponent('Campaign already sent or in progress')}`);
  }

  const contacts = campaign.list.contacts;
  if (contacts.length === 0) {
    redirect(`/dashboard/bots/${botId}/email/campaigns/${campaignId}?error=${encodeURIComponent('No active contacts in list')}`);
  }

  // Check credits (1 credit per email)
  const creditsNeeded = contacts.length;
  const hasCredits = await hasEnoughCredits(user.id, creditsNeeded);
  if (!hasCredits) {
    redirect(`/dashboard/bots/${botId}/email/campaigns/${campaignId}?error=${encodeURIComponent(`Not enough credits. Need ${creditsNeeded} credits to send to ${contacts.length} contacts.`)}`);
  }

  const limitStatus = checkDailyLimit(
    campaign.account.sentToday,
    campaign.account.dailyLimit,
    campaign.account.lastResetAt,
  );

  if (!limitStatus.canSend) {
    redirect(`/dashboard/bots/${botId}/email/campaigns/${campaignId}?error=${encodeURIComponent('Daily sending limit reached. Try again tomorrow.')}`);
  }

  const maxToSend = Math.min(contacts.length, limitStatus.remaining);
  const baseUrl = process.env.NEXTAUTH_URL || 'https://grothi.com';

  await db.emailCampaign.update({
    where: { id: campaignId },
    data: { status: 'SENDING', sentAt: new Date() },
  });

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

  // A/B Test: split contacts into variant groups
  const hasAbTest = !!(campaign.subjectB && campaign.abTestPercent);
  let variantAContacts: typeof contactsToSend = [];
  let variantBContacts: typeof contactsToSend = [];

  if (hasAbTest) {
    // Shuffle contacts for random A/B split
    const shuffled = [...contactsToSend].sort(() => Math.random() - 0.5);
    const splitIndex = Math.ceil(shuffled.length / 2);
    variantAContacts = shuffled.slice(0, splitIndex);
    variantBContacts = shuffled.slice(splitIndex);
  }

  // Helper: send one email with variant tracking
  async function sendOne(
    contact: (typeof contactsToSend)[0],
    subject: string,
    variant: string | null,
  ) {
    const emailSend = await db.emailSend.create({
      data: { campaignId, contactId: contact.id, status: 'QUEUED', variant },
    });

    let html = campaign.htmlContent;
    html = html.replace(/\{\{firstName\}\}/g, contact.firstName || '');
    html = html.replace(/\{\{lastName\}\}/g, contact.lastName || '');
    html = html.replace(/\{\{email\}\}/g, contact.email);
    html = html.replace(/\{\{brandName\}\}/g, campaign.bot.brandName);

    const trackingPixelUrl = getTrackingPixelUrl(emailSend.id, baseUrl);
    html = wrapLinksForTracking(html, emailSend.id, baseUrl);

    const unsubscribeUrl = `${baseUrl}/api/email/unsubscribe?cid=${encodeURIComponent(contact.id)}&lid=${encodeURIComponent(campaign.listId)}`;
    html += `<div style="margin-top:20px;padding-top:15px;border-top:1px solid #eee;font-size:12px;color:#999;text-align:center;">`;
    html += `<p>You received this because you subscribed to ${campaign.bot.brandName}.</p>`;
    html += `<p><a href="${unsubscribeUrl}" style="color:#999;">Unsubscribe</a></p>`;
    html += `</div>`;

    let text = campaign.textContent || '';
    if (text) {
      text = text.replace(/\{\{firstName\}\}/g, contact.firstName || '');
      text = text.replace(/\{\{lastName\}\}/g, contact.lastName || '');
      text = text.replace(/\{\{email\}\}/g, contact.email);
      text += `\n\nUnsubscribe: ${unsubscribeUrl}`;
    }

    const result = await sendCampaignEmail({
      config: smtpConfig,
      from: campaign.account.email,
      fromName: campaign.fromName || campaign.account.fromName || undefined,
      to: contact.email,
      subject,
      html,
      text: text || undefined,
      unsubscribeUrl,
      trackingPixelUrl,
    });

    if (result.success) {
      await db.emailSend.update({
        where: { id: emailSend.id },
        data: { status: 'SENT', messageId: result.messageId, sentAt: new Date() },
      });
      await db.emailEvent.create({
        data: { sendId: emailSend.id, contactId: contact.id, type: 'SENT' },
      });
      sent++;
    } else {
      await db.emailSend.update({
        where: { id: emailSend.id },
        data: { status: 'FAILED', error: result.error },
      });
      failed++;
    }
  }

  if (hasAbTest) {
    // Send variant A (original subject)
    for (const contact of variantAContacts) {
      await sendOne(contact, campaign.subject, 'A');
    }
    // Send variant B (alternate subject)
    for (const contact of variantBContacts) {
      await sendOne(contact, campaign.subjectB!, 'B');
    }
  } else {
    // Normal send — no A/B test
    for (const contact of contactsToSend) {
      await sendOne(contact, campaign.subject, null);
    }
  }

  // Update daily counter
  const resetCheck = checkDailyLimit(campaign.account.sentToday, campaign.account.dailyLimit, campaign.account.lastResetAt);
  await db.emailAccount.update({
    where: { id: campaign.account.id },
    data: {
      sentToday: resetCheck.needsReset ? sent : campaign.account.sentToday + sent,
      lastResetAt: resetCheck.needsReset ? new Date() : undefined,
    },
  });

  // Deduct credits for successfully sent emails
  if (sent > 0) {
    await deductCredits(
      user.id,
      sent,
      `Email campaign: ${campaign.name} (${sent} emails)`,
      botId,
    );
  }

  // Determine A/B test winner (initial — based on sent count, updated later by open tracking)
  let abWinnerValue: string | null = null;
  if (hasAbTest) {
    // Count successful sends per variant
    const variantStats = await db.emailSend.groupBy({
      by: ['variant'],
      where: { campaignId, status: 'SENT' },
      _count: { id: true },
    });
    const sentA = variantStats.find(v => v.variant === 'A')?._count.id || 0;
    const sentB = variantStats.find(v => v.variant === 'B')?._count.id || 0;
    // Initial winner: set to null, will be determined by open rates later
    // For now store "PENDING" — the analytics page or cron can compute once opens come in
    abWinnerValue = 'PENDING';
    if (sentA === 0 && sentB > 0) abWinnerValue = 'B';
    if (sentB === 0 && sentA > 0) abWinnerValue = 'A';
  }

  await db.emailCampaign.update({
    where: { id: campaignId },
    data: {
      status: failed === contactsToSend.length ? 'FAILED' : 'SENT',
      completedAt: new Date(),
      totalSent: sent,
      totalBounced: failed,
      creditsUsed: sent,
      ...(abWinnerValue ? { abWinner: abWinnerValue } : {}),
    },
  });

  redirect(`/dashboard/bots/${botId}/email/campaigns/${campaignId}?success=${encodeURIComponent(`Campaign sent: ${sent} delivered, ${failed} failed`)}`);
}

async function cancelCampaign(formData: FormData) {
  'use server';
  const user = await requireAuth();
  const botId = formData.get('botId') as string;
  const campaignId = formData.get('campaignId') as string;

  const campaign = await db.emailCampaign.findFirst({
    where: { id: campaignId },
    include: { bot: true },
  });

  if (!campaign || campaign.bot.userId !== user.id) return;

  if (campaign.status === 'DRAFT' || campaign.status === 'SCHEDULED') {
    await db.emailCampaign.update({
      where: { id: campaignId },
      data: { status: 'CANCELLED' },
    });
  }

  redirect(`/dashboard/bots/${botId}/email/campaigns/${campaignId}?success=Campaign+cancelled`);
}

// ============ PAGE ============

export default async function CampaignDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; campaignId: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const user = await requireAuth();
  const { id, campaignId } = await params;
  const sp = await searchParams;

  const bot = await db.bot.findFirst({ where: { id, userId: user.id } });
  if (!bot) notFound();

  const campaign = await db.emailCampaign.findFirst({
    where: { id: campaignId, botId: id },
    include: {
      account: true,
      list: true,
      sends: {
        include: { contact: true },
        orderBy: { createdAt: 'desc' },
        take: 100,
      },
    },
  });

  if (!campaign) notFound();

  const sc = CAMPAIGN_STATUS_CONFIG[campaign.status] || { variant: 'secondary' as const, label: campaign.status };
  const openRate = campaign.totalSent > 0 ? ((campaign.totalOpened / campaign.totalSent) * 100).toFixed(1) : '0';
  const clickRate = campaign.totalSent > 0 ? ((campaign.totalClicked / campaign.totalSent) * 100).toFixed(1) : '0';
  const bounceRate = campaign.totalSent > 0 ? ((campaign.totalBounced / campaign.totalSent) * 100).toFixed(1) : '0';
  const unsubRate = campaign.totalSent > 0 ? ((campaign.totalUnsubscribed / campaign.totalSent) * 100).toFixed(1) : '0';

  const isDraft = campaign.status === 'DRAFT' || campaign.status === 'SCHEDULED';

  // A/B test per-variant stats
  let abStats: { variantA: { sent: number; opened: number; clicked: number }; variantB: { sent: number; opened: number; clicked: number }; winner: string | null } | null = null;
  if (campaign.subjectB && campaign.totalSent > 0) {
    const sends = campaign.sends;
    const aSends = sends.filter(s => s.variant === 'A');
    const bSends = sends.filter(s => s.variant === 'B');
    const aSent = aSends.filter(s => s.status !== 'FAILED' && s.status !== 'QUEUED').length;
    const bSent = bSends.filter(s => s.status !== 'FAILED' && s.status !== 'QUEUED').length;
    const aOpened = aSends.filter(s => s.openedAt).length;
    const bOpened = bSends.filter(s => s.openedAt).length;
    const aClicked = aSends.filter(s => s.clickedAt).length;
    const bClicked = bSends.filter(s => s.clickedAt).length;

    const aOpenRate = aSent > 0 ? aOpened / aSent : 0;
    const bOpenRate = bSent > 0 ? bOpened / bSent : 0;

    // Determine winner by open rate (need at least 5 opens total)
    let winner: string | null = null;
    if (aOpened + bOpened >= 5) {
      winner = aOpenRate >= bOpenRate ? 'A' : 'B';
    }

    // Update winner in DB if changed
    if (winner && campaign.abWinner !== winner) {
      await db.emailCampaign.update({ where: { id: campaignId }, data: { abWinner: winner } });
    }

    abStats = {
      variantA: { sent: aSent, opened: aOpened, clicked: aClicked },
      variantB: { sent: bSent, opened: bOpened, clicked: bClicked },
      winner,
    };
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/dashboard/bots/${id}/email?tab=campaigns`}>
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-3 w-3 mr-1" />
            Campaigns
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{campaign.name}</h1>
            <Badge variant={sc.variant as 'success' | 'warning' | 'destructive' | 'secondary' | 'default'}>
              {sc.label}
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">{campaign.subject}</p>
        </div>
      </div>

      <BotNav botId={bot.id} activeTab="email" />

      {sp.error && (
        <div className="bg-red-50 text-red-800 border border-red-200 rounded-lg p-3 text-sm">{sp.error}</div>
      )}
      {sp.success && (
        <div className="bg-green-50 text-green-800 border border-green-200 rounded-lg p-3 text-sm">{sp.success}</div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs"><Send className="h-3 w-3" />Sent</div>
            <p className="text-2xl font-bold mt-1">{campaign.totalSent.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs"><Eye className="h-3 w-3" />Opened</div>
            <p className="text-2xl font-bold mt-1">{campaign.totalOpened.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">{openRate}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs"><MousePointer className="h-3 w-3" />Clicked</div>
            <p className="text-2xl font-bold mt-1">{campaign.totalClicked.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">{clickRate}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs"><AlertTriangle className="h-3 w-3" />Bounced</div>
            <p className="text-2xl font-bold mt-1">{campaign.totalBounced}</p>
            <p className="text-xs text-muted-foreground">{bounceRate}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs"><Ban className="h-3 w-3" />Unsubscribed</div>
            <p className="text-2xl font-bold mt-1">{campaign.totalUnsubscribed}</p>
            <p className="text-xs text-muted-foreground">{unsubRate}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Actions for draft campaigns */}
      {isDraft && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Campaign Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Send test */}
            <div className="border rounded-lg p-4">
              <h3 className="font-medium text-sm flex items-center gap-2 mb-3">
                <TestTube className="h-4 w-4" />
                Send Test Email
              </h3>
              <form action={sendTestEmail} className="flex gap-3 items-end">
                <input type="hidden" name="botId" value={id} />
                <input type="hidden" name="campaignId" value={campaignId} />
                <div className="flex-1">
                  <Label htmlFor="testEmail">Test recipient</Label>
                  <Input
                    name="testEmail"
                    id="testEmail"
                    type="email"
                    placeholder="your-email@example.com"
                    defaultValue={campaign.account.email}
                  />
                </div>
                <Button type="submit" variant="outline">
                  <TestTube className="h-3 w-3 mr-1" />
                  Send Test
                </Button>
              </form>
            </div>

            {/* Send campaign */}
            <div className="flex gap-3">
              <form action={sendCampaign}>
                <input type="hidden" name="botId" value={id} />
                <input type="hidden" name="campaignId" value={campaignId} />
                <Button type="submit" className="bg-green-600 hover:bg-green-700">
                  <Send className="h-4 w-4 mr-1" />
                  Send Campaign Now
                </Button>
              </form>
              <form action={cancelCampaign}>
                <input type="hidden" name="botId" value={id} />
                <input type="hidden" name="campaignId" value={campaignId} />
                <Button type="submit" variant="outline" className="text-red-600">
                  Cancel Campaign
                </Button>
              </form>
            </div>

            <p className="text-xs text-muted-foreground">
              Sending to: {campaign.list.name} ({campaign.list.contactCount} active contacts)
            </p>
          </CardContent>
        </Card>
      )}

      {/* Campaign details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Campaign Info</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">From</p>
              <p className="font-medium">{campaign.fromName || campaign.account.email}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Contact List</p>
              <p className="font-medium">{campaign.list.name}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Created</p>
              <p className="font-medium">{new Date(campaign.createdAt).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Sent At</p>
              <p className="font-medium">
                {campaign.sentAt ? new Date(campaign.sentAt).toLocaleString() : 'Not yet'}
              </p>
            </div>
          </div>
          {campaign.preheader && (
            <div className="mt-3 text-sm">
              <p className="text-muted-foreground">Preheader</p>
              <p>{campaign.preheader}</p>
            </div>
          )}
          {campaign.subjectB && (
            <div className="mt-4 border-t pt-4">
              <h4 className="font-medium text-sm mb-2">A/B Test Results</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className={`rounded-lg p-3 ${abStats?.winner === 'A' ? 'bg-green-50 border border-green-200' : 'bg-muted/30'}`}>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">Variant A</p>
                    {abStats?.winner === 'A' && (
                      <Badge variant="success">Winner</Badge>
                    )}
                  </div>
                  <p className="text-sm mt-1">{campaign.subject}</p>
                  {abStats && (
                    <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Sent</span>
                        <p className="font-medium">{abStats.variantA.sent}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Opened</span>
                        <p className="font-medium">{abStats.variantA.opened} ({abStats.variantA.sent > 0 ? ((abStats.variantA.opened / abStats.variantA.sent) * 100).toFixed(1) : '0'}%)</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Clicked</span>
                        <p className="font-medium">{abStats.variantA.clicked} ({abStats.variantA.sent > 0 ? ((abStats.variantA.clicked / abStats.variantA.sent) * 100).toFixed(1) : '0'}%)</p>
                      </div>
                    </div>
                  )}
                </div>
                <div className={`rounded-lg p-3 ${abStats?.winner === 'B' ? 'bg-green-50 border border-green-200' : 'bg-muted/30'}`}>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">Variant B</p>
                    {abStats?.winner === 'B' && (
                      <Badge variant="success">Winner</Badge>
                    )}
                  </div>
                  <p className="text-sm mt-1">{campaign.subjectB}</p>
                  {abStats && (
                    <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Sent</span>
                        <p className="font-medium">{abStats.variantB.sent}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Opened</span>
                        <p className="font-medium">{abStats.variantB.opened} ({abStats.variantB.sent > 0 ? ((abStats.variantB.opened / abStats.variantB.sent) * 100).toFixed(1) : '0'}%)</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Clicked</span>
                        <p className="font-medium">{abStats.variantB.clicked} ({abStats.variantB.sent > 0 ? ((abStats.variantB.clicked / abStats.variantB.sent) * 100).toFixed(1) : '0'}%)</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {!abStats?.winner && campaign.totalSent > 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  Winner will be determined after at least 5 opens are tracked.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Deliverability health */}
      {campaign.totalSent > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Deliverability Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <HealthMetric
                label="Open Rate"
                value={`${openRate}%`}
                status={parseFloat(openRate) >= 15 ? 'good' : parseFloat(openRate) >= 10 ? 'warning' : 'bad'}
                target="15-25%"
              />
              <HealthMetric
                label="Click Rate"
                value={`${clickRate}%`}
                status={parseFloat(clickRate) >= 2 ? 'good' : parseFloat(clickRate) >= 1 ? 'warning' : 'bad'}
                target="2-5%"
              />
              <HealthMetric
                label="Bounce Rate"
                value={`${bounceRate}%`}
                status={parseFloat(bounceRate) <= 3 ? 'good' : parseFloat(bounceRate) <= 5 ? 'warning' : 'bad'}
                target="< 5%"
              />
              <HealthMetric
                label="Unsubscribe"
                value={`${unsubRate}%`}
                status={parseFloat(unsubRate) <= 0.5 ? 'good' : parseFloat(unsubRate) <= 1 ? 'warning' : 'bad'}
                target="< 0.5%"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Individual sends */}
      {campaign.sends.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Individual Sends ({campaign.sends.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium">Contact</th>
                    <th className="pb-2 font-medium">Status</th>
                    {campaign.subjectB && <th className="pb-2 font-medium">Variant</th>}
                    <th className="pb-2 font-medium">Opened</th>
                    <th className="pb-2 font-medium">Clicked</th>
                    <th className="pb-2 font-medium">Sent At</th>
                  </tr>
                </thead>
                <tbody>
                  {campaign.sends.map((send) => {
                    const sendStatusColors: Record<string, string> = {
                      QUEUED: 'bg-gray-100 text-gray-800',
                      SENT: 'bg-blue-100 text-blue-800',
                      DELIVERED: 'bg-blue-100 text-blue-800',
                      OPENED: 'bg-green-100 text-green-800',
                      CLICKED: 'bg-emerald-100 text-emerald-800',
                      BOUNCED: 'bg-red-100 text-red-800',
                      COMPLAINED: 'bg-red-100 text-red-800',
                      FAILED: 'bg-red-100 text-red-800',
                    };
                    return (
                      <tr key={send.id} className="border-b last:border-0">
                        <td className="py-2">{send.contact.email}</td>
                        <td className="py-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${sendStatusColors[send.status] || 'bg-gray-100'}`}>
                            {send.status}
                          </span>
                        </td>
                        {campaign.subjectB && (
                          <td className="py-2">
                            {send.variant && (
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${send.variant === 'A' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>
                                {send.variant}
                              </span>
                            )}
                          </td>
                        )}
                        <td className="py-2 text-muted-foreground">
                          {send.openedAt ? new Date(send.openedAt).toLocaleString() : '-'}
                        </td>
                        <td className="py-2 text-muted-foreground">
                          {send.clickedAt ? new Date(send.clickedAt).toLocaleString() : '-'}
                        </td>
                        <td className="py-2 text-muted-foreground">
                          {send.sentAt ? new Date(send.sentAt).toLocaleString() : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function HealthMetric({ label, value, status, target }: {
  label: string;
  value: string;
  status: 'good' | 'warning' | 'bad';
  target: string;
}) {
  const colors = {
    good: 'text-green-600 bg-green-50',
    warning: 'text-yellow-600 bg-yellow-50',
    bad: 'text-red-600 bg-red-50',
  };

  return (
    <div className={`rounded-lg p-3 ${colors[status]}`}>
      <p className="text-xs font-medium opacity-75">{label}</p>
      <p className="text-lg font-bold">{value}</p>
      <p className="text-xs opacity-60">Target: {target}</p>
    </div>
  );
}
