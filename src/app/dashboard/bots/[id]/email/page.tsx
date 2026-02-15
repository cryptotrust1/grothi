import { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { encrypt } from '@/lib/encryption';
import { testSmtpConnection, checkDailyLimit } from '@/lib/email';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { BotNav } from '@/components/dashboard/bot-nav';
import {
  Mail, Users, Send, BarChart3, Settings, Plus,
  CheckCircle2, AlertCircle, ArrowRight, FileText,
} from 'lucide-react';
import {
  EMAIL_PROVIDERS,
  CAMPAIGN_STATUS_CONFIG,
  CONTACT_STATUS_CONFIG,
} from '@/lib/constants';
import { emailAccountSchema } from '@/lib/validations';

export const metadata: Metadata = {
  title: 'Email Marketing',
  robots: { index: false },
};

// ============ SERVER ACTIONS ============

async function saveEmailAccount(formData: FormData) {
  'use server';
  const user = await requireAuth();
  const botId = formData.get('botId') as string;

  const bot = await db.bot.findFirst({ where: { id: botId, userId: user.id } });
  if (!bot) return;

  const raw = {
    provider: formData.get('provider') as string,
    email: formData.get('email') as string,
    fromName: (formData.get('fromName') as string) || undefined,
    smtpHost: formData.get('smtpHost') as string,
    smtpPort: parseInt(formData.get('smtpPort') as string, 10) || 587,
    smtpUser: formData.get('smtpUser') as string,
    smtpPass: formData.get('smtpPass') as string,
    smtpSecure: formData.get('smtpSecure') === 'true',
    dailyLimit: parseInt(formData.get('dailyLimit') as string, 10) || 2000,
  };

  const parsed = emailAccountSchema.safeParse(raw);
  if (!parsed.success) {
    redirect(`/dashboard/bots/${botId}/email?error=${encodeURIComponent(parsed.error.errors[0].message)}`);
  }

  const data = parsed.data;
  const encryptedPass = encrypt(data.smtpPass);

  try {
    // Test connection before saving
    const testResult = await testSmtpConnection({
      smtpHost: data.smtpHost,
      smtpPort: data.smtpPort,
      smtpUser: data.smtpUser,
      smtpPass: encryptedPass,
      smtpSecure: data.smtpSecure,
    });

    await db.emailAccount.upsert({
      where: { botId },
      create: {
        botId,
        provider: data.provider as 'GOOGLE' | 'MICROSOFT' | 'SENDGRID' | 'MAILGUN' | 'AMAZON_SES' | 'POSTMARK' | 'CUSTOM',
        email: data.email,
        fromName: data.fromName || null,
        smtpHost: data.smtpHost,
        smtpPort: data.smtpPort,
        smtpUser: data.smtpUser,
        smtpPass: encryptedPass,
        smtpSecure: data.smtpSecure,
        dailyLimit: data.dailyLimit,
        isVerified: testResult.success,
        lastError: testResult.success ? null : testResult.error || null,
      },
      update: {
        provider: data.provider as 'GOOGLE' | 'MICROSOFT' | 'SENDGRID' | 'MAILGUN' | 'AMAZON_SES' | 'POSTMARK' | 'CUSTOM',
        email: data.email,
        fromName: data.fromName || null,
        smtpHost: data.smtpHost,
        smtpPort: data.smtpPort,
        smtpUser: data.smtpUser,
        smtpPass: encryptedPass,
        smtpSecure: data.smtpSecure,
        dailyLimit: data.dailyLimit,
        isVerified: testResult.success,
        lastError: testResult.success ? null : testResult.error || null,
      },
    });

    if (testResult.success) {
      redirect(`/dashboard/bots/${botId}/email?success=Account+connected+successfully`);
    } else {
      redirect(`/dashboard/bots/${botId}/email?error=${encodeURIComponent('Saved but connection failed: ' + (testResult.error || 'Unknown error'))}`);
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'NEXT_REDIRECT') throw error;
    redirect(`/dashboard/bots/${botId}/email?error=${encodeURIComponent('Failed to save account')}`);
  }
}

async function createList(formData: FormData) {
  'use server';
  const user = await requireAuth();
  const botId = formData.get('botId') as string;
  const name = (formData.get('name') as string || '').trim();
  const description = (formData.get('description') as string || '').trim();

  if (!name) {
    redirect(`/dashboard/bots/${botId}/email?error=${encodeURIComponent('List name is required')}`);
  }

  const bot = await db.bot.findFirst({ where: { id: botId, userId: user.id } });
  if (!bot) return;

  try {
    await db.emailList.create({
      data: { botId, name, description: description || null },
    });
    redirect(`/dashboard/bots/${botId}/email?success=List+created`);
  } catch (error) {
    if (error instanceof Error && error.message === 'NEXT_REDIRECT') throw error;
    redirect(`/dashboard/bots/${botId}/email?error=${encodeURIComponent('Failed to create list')}`);
  }
}

async function deleteList(formData: FormData) {
  'use server';
  const user = await requireAuth();
  const botId = formData.get('botId') as string;
  const listId = formData.get('listId') as string;

  const bot = await db.bot.findFirst({ where: { id: botId, userId: user.id } });
  if (!bot) return;

  try {
    await db.emailList.delete({
      where: { id: listId, botId },
    });
    redirect(`/dashboard/bots/${botId}/email?success=List+deleted`);
  } catch (error) {
    if (error instanceof Error && error.message === 'NEXT_REDIRECT') throw error;
    redirect(`/dashboard/bots/${botId}/email?error=${encodeURIComponent('Failed to delete list')}`);
  }
}

// ============ PAGE ============

export default async function EmailMarketingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string; tab?: string }>;
}) {
  const user = await requireAuth();
  const { id } = await params;
  const sp = await searchParams;

  const bot = await db.bot.findFirst({
    where: { id, userId: user.id },
    include: {
      emailAccount: true,
      emailLists: {
        include: { _count: { select: { contacts: true } } },
        orderBy: { createdAt: 'desc' },
      },
      emailCampaigns: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  });

  if (!bot) notFound();

  const account = bot.emailAccount;
  const lists = bot.emailLists;
  const campaigns = bot.emailCampaigns;
  const activeTab = sp.tab || (account ? 'overview' : 'setup');

  // Calculate stats
  const totalContacts = lists.reduce((sum, l) => sum + l._count.contacts, 0);
  const totalCampaigns = campaigns.length;
  const sentCampaigns = campaigns.filter(c => c.status === 'SENT').length;
  const totalSent = campaigns.reduce((sum, c) => sum + c.totalSent, 0);
  const totalOpened = campaigns.reduce((sum, c) => sum + c.totalOpened, 0);
  const avgOpenRate = totalSent > 0 ? ((totalOpened / totalSent) * 100).toFixed(1) : '0';

  // Check daily limit
  let dailyStatus = null;
  if (account) {
    dailyStatus = checkDailyLimit(account.sentToday, account.dailyLimit, account.lastResetAt);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{bot.name} - Email Marketing</h1>
        <p className="text-muted-foreground mt-1">
          Send campaigns, manage contacts, and track email performance
        </p>
      </div>

      <BotNav botId={bot.id} activeTab="email" />

      {/* Status messages */}
      {sp.error && (
        <div className="bg-red-50 text-red-800 border border-red-200 rounded-lg p-3 text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {sp.error}
        </div>
      )}
      {sp.success && (
        <div className="bg-green-50 text-green-800 border border-green-200 rounded-lg p-3 text-sm flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {sp.success}
        </div>
      )}

      {/* Sub-navigation tabs */}
      <div className="flex gap-2 border-b pb-2">
        {account && (
          <Link
            href={`/dashboard/bots/${bot.id}/email?tab=overview`}
            className={`px-3 py-1.5 text-sm rounded-md ${activeTab === 'overview' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
          >
            Overview
          </Link>
        )}
        <Link
          href={`/dashboard/bots/${bot.id}/email?tab=setup`}
          className={`px-3 py-1.5 text-sm rounded-md ${activeTab === 'setup' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
        >
          {account ? 'Account' : 'Setup Account'}
        </Link>
        {account && (
          <>
            <Link
              href={`/dashboard/bots/${bot.id}/email?tab=contacts`}
              className={`px-3 py-1.5 text-sm rounded-md ${activeTab === 'contacts' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
            >
              Contacts
            </Link>
            <Link
              href={`/dashboard/bots/${bot.id}/email?tab=campaigns`}
              className={`px-3 py-1.5 text-sm rounded-md ${activeTab === 'campaigns' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
            >
              Campaigns
            </Link>
          </>
        )}
      </div>

      {/* ============ OVERVIEW TAB ============ */}
      {activeTab === 'overview' && account && (
        <div className="space-y-6">
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Users className="h-4 w-4" />
                  Contacts
                </div>
                <p className="text-2xl font-bold mt-1">{totalContacts}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Send className="h-4 w-4" />
                  Campaigns Sent
                </div>
                <p className="text-2xl font-bold mt-1">{sentCampaigns}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Mail className="h-4 w-4" />
                  Emails Sent
                </div>
                <p className="text-2xl font-bold mt-1">{totalSent.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <BarChart3 className="h-4 w-4" />
                  Avg Open Rate
                </div>
                <p className="text-2xl font-bold mt-1">{avgOpenRate}%</p>
              </CardContent>
            </Card>
          </div>

          {/* Account status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Email Account
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{account.email}</p>
                  <p className="text-sm text-muted-foreground">
                    {EMAIL_PROVIDERS.find(p => p.value === account.provider)?.label || account.provider}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {account.isVerified ? (
                    <Badge variant="success">Connected</Badge>
                  ) : (
                    <Badge variant="destructive">Connection Error</Badge>
                  )}
                  {dailyStatus && (
                    <span className="text-sm text-muted-foreground">
                      {dailyStatus.remaining}/{account.dailyLimit} remaining today
                    </span>
                  )}
                </div>
              </div>
              {account.lastError && (
                <p className="text-sm text-red-600 mt-2">{account.lastError}</p>
              )}
            </CardContent>
          </Card>

          {/* Quick actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link href={`/dashboard/bots/${bot.id}/email?tab=contacts`}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                <CardContent className="pt-4 pb-4 flex items-center gap-3">
                  <Users className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">Manage Contacts</p>
                    <p className="text-sm text-muted-foreground">{totalContacts} contacts in {lists.length} lists</p>
                  </div>
                  <ArrowRight className="h-4 w-4 ml-auto" />
                </CardContent>
              </Card>
            </Link>
            <Link href={`/dashboard/bots/${bot.id}/email?tab=campaigns`}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                <CardContent className="pt-4 pb-4 flex items-center gap-3">
                  <FileText className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">Campaigns</p>
                    <p className="text-sm text-muted-foreground">{totalCampaigns} campaigns</p>
                  </div>
                  <ArrowRight className="h-4 w-4 ml-auto" />
                </CardContent>
              </Card>
            </Link>
            <Link href={`/dashboard/bots/${bot.id}/email?tab=setup`}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                <CardContent className="pt-4 pb-4 flex items-center gap-3">
                  <Settings className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">Account Settings</p>
                    <p className="text-sm text-muted-foreground">SMTP, limits, sender info</p>
                  </div>
                  <ArrowRight className="h-4 w-4 ml-auto" />
                </CardContent>
              </Card>
            </Link>
          </div>

          {/* Recent campaigns */}
          {campaigns.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent Campaigns</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {campaigns.slice(0, 5).map((campaign) => {
                    const sc = CAMPAIGN_STATUS_CONFIG[campaign.status] || { variant: 'secondary' as const, label: campaign.status };
                    return (
                      <div key={campaign.id} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div>
                          <p className="font-medium text-sm">{campaign.name}</p>
                          <p className="text-xs text-muted-foreground">{campaign.subject}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant={sc.variant as 'success' | 'warning' | 'destructive' | 'secondary' | 'default'}>
                            {sc.label}
                          </Badge>
                          {campaign.totalSent > 0 && (
                            <span className="text-xs text-muted-foreground">
                              {campaign.totalOpened}/{campaign.totalSent} opened
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ============ SETUP TAB ============ */}
      {activeTab === 'setup' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="h-4 w-4" />
              {account ? 'Update Email Account' : 'Connect Email Account'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-blue-50 text-blue-800 rounded-lg p-3 text-sm mb-6">
              <p className="font-medium mb-1">How it works</p>
              <p>
                Connect your own email server (Gmail, Outlook, or custom SMTP).
                Grothi sends emails through your server - you maintain full control
                and professional sender identity (name@yourcompany.com).
              </p>
            </div>

            <form action={saveEmailAccount} className="space-y-4">
              <input type="hidden" name="botId" value={bot.id} />

              {/* Provider select */}
              <div>
                <Label htmlFor="provider">Email Provider</Label>
                <select
                  name="provider"
                  id="provider"
                  className="w-full mt-1 rounded-md border bg-background px-3 py-2 text-sm"
                  defaultValue={account?.provider || 'GOOGLE'}
                >
                  {EMAIL_PROVIDERS.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>

              {/* Email + From Name */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email">Sender Email</Label>
                  <Input
                    name="email"
                    id="email"
                    type="email"
                    placeholder="you@yourcompany.com"
                    defaultValue={account?.email || ''}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="fromName">From Name (optional)</Label>
                  <Input
                    name="fromName"
                    id="fromName"
                    placeholder="Your Company Name"
                    defaultValue={account?.fromName || ''}
                  />
                </div>
              </div>

              {/* SMTP Settings */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="smtpHost">SMTP Host</Label>
                  <Input
                    name="smtpHost"
                    id="smtpHost"
                    placeholder="smtp.gmail.com"
                    defaultValue={account?.smtpHost || ''}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="smtpPort">SMTP Port</Label>
                  <Input
                    name="smtpPort"
                    id="smtpPort"
                    type="number"
                    placeholder="587"
                    defaultValue={account?.smtpPort || 587}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="dailyLimit">Daily Limit</Label>
                  <Input
                    name="dailyLimit"
                    id="dailyLimit"
                    type="number"
                    placeholder="2000"
                    defaultValue={account?.dailyLimit || 2000}
                  />
                </div>
              </div>

              {/* Credentials */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="smtpUser">SMTP Username</Label>
                  <Input
                    name="smtpUser"
                    id="smtpUser"
                    placeholder="your-email@gmail.com"
                    defaultValue={account?.smtpUser || ''}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="smtpPass">SMTP Password / App Password</Label>
                  <Input
                    name="smtpPass"
                    id="smtpPass"
                    type="password"
                    placeholder={account ? '(unchanged - enter new to update)' : 'App Password or SMTP password'}
                    required={!account}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    For Gmail: Use an App Password (Settings &gt; Security &gt; App Passwords)
                  </p>
                </div>
              </div>

              <input type="hidden" name="smtpSecure" value="false" />

              <div className="flex gap-3">
                <Button type="submit">
                  {account ? 'Update & Test Connection' : 'Connect & Test'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ============ CONTACTS TAB ============ */}
      {activeTab === 'contacts' && account && (
        <div className="space-y-6">
          {/* Create new list */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Create Contact List
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form action={createList} className="flex gap-3 items-end">
                <input type="hidden" name="botId" value={bot.id} />
                <div className="flex-1">
                  <Label htmlFor="listName">List Name</Label>
                  <Input name="name" id="listName" placeholder="e.g. Newsletter Subscribers" required />
                </div>
                <div className="flex-1">
                  <Label htmlFor="listDesc">Description (optional)</Label>
                  <Input name="description" id="listDesc" placeholder="Main email list" />
                </div>
                <Button type="submit">Create List</Button>
              </form>
            </CardContent>
          </Card>

          {/* Existing lists */}
          {lists.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No contact lists yet. Create one above to get started.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {lists.map((list) => (
                <Card key={list.id}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{list.name}</p>
                        {list.description && (
                          <p className="text-sm text-muted-foreground">{list.description}</p>
                        )}
                        <p className="text-sm text-muted-foreground mt-1">
                          {list._count.contacts} contacts
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Link href={`/dashboard/bots/${bot.id}/email/contacts/${list.id}`}>
                          <Button variant="outline" size="sm">
                            <Users className="h-3 w-3 mr-1" />
                            Manage
                          </Button>
                        </Link>
                        <form action={deleteList}>
                          <input type="hidden" name="botId" value={bot.id} />
                          <input type="hidden" name="listId" value={list.id} />
                          <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                            Delete
                          </Button>
                        </form>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============ CAMPAIGNS TAB ============ */}
      {activeTab === 'campaigns' && account && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Campaigns</h2>
            {lists.length > 0 ? (
              <Link href={`/dashboard/bots/${bot.id}/email/campaigns/new`}>
                <Button>
                  <Plus className="h-4 w-4 mr-1" />
                  New Campaign
                </Button>
              </Link>
            ) : (
              <p className="text-sm text-muted-foreground">
                Create a contact list first before creating campaigns.
              </p>
            )}
          </div>

          {campaigns.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No campaigns yet. Create your first email campaign.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {campaigns.map((campaign) => {
                const sc = CAMPAIGN_STATUS_CONFIG[campaign.status] || { variant: 'secondary' as const, label: campaign.status };
                const openRate = campaign.totalSent > 0
                  ? ((campaign.totalOpened / campaign.totalSent) * 100).toFixed(1)
                  : '0';
                const clickRate = campaign.totalSent > 0
                  ? ((campaign.totalClicked / campaign.totalSent) * 100).toFixed(1)
                  : '0';

                return (
                  <Card key={campaign.id}>
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{campaign.name}</p>
                            <Badge variant={sc.variant as 'success' | 'warning' | 'destructive' | 'secondary' | 'default'}>
                              {sc.label}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{campaign.subject}</p>
                          {campaign.totalSent > 0 && (
                            <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                              <span>Sent: {campaign.totalSent.toLocaleString()}</span>
                              <span>Opens: {openRate}%</span>
                              <span>Clicks: {clickRate}%</span>
                              <span>Bounces: {campaign.totalBounced}</span>
                            </div>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {campaign.sentAt
                            ? new Date(campaign.sentAt).toLocaleDateString()
                            : campaign.scheduledAt
                              ? `Scheduled: ${new Date(campaign.scheduledAt).toLocaleDateString()}`
                              : 'Draft'}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* No account prompt */}
      {!account && activeTab !== 'setup' && (
        <Card>
          <CardContent className="py-8 text-center">
            <Mail className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <h3 className="font-semibold mb-1">Connect your email account first</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Set up your SMTP connection to start sending email campaigns.
            </p>
            <Link href={`/dashboard/bots/${bot.id}/email?tab=setup`}>
              <Button>Set Up Email Account</Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
