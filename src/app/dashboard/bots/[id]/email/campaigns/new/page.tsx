import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BotNav } from '@/components/dashboard/bot-nav';
import { ArrowLeft, Send } from 'lucide-react';
import { emailCampaignSchema } from '@/lib/validations';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'New Email Campaign',
  robots: { index: false },
};

// ============ SERVER ACTIONS ============

async function createCampaign(formData: FormData) {
  'use server';
  const user = await requireAuth();
  const botId = formData.get('botId') as string;

  const bot = await db.bot.findFirst({
    where: { id: botId, userId: user.id },
    include: { emailAccount: true },
  });
  if (!bot || !bot.emailAccount) return;

  const raw = {
    name: (formData.get('name') as string || '').trim(),
    subject: (formData.get('subject') as string || '').trim(),
    preheader: (formData.get('preheader') as string || '').trim() || undefined,
    fromName: (formData.get('fromName') as string || '').trim() || undefined,
    listId: formData.get('listId') as string,
    htmlContent: (formData.get('htmlContent') as string || '').trim(),
    textContent: (formData.get('textContent') as string || '').trim() || undefined,
  };

  const parsed = emailCampaignSchema.safeParse(raw);
  if (!parsed.success) {
    redirect(`/dashboard/bots/${botId}/email/campaigns/new?error=${encodeURIComponent(parsed.error.errors[0].message)}`);
  }

  const data = parsed.data;

  // Verify list belongs to this bot
  const list = await db.emailList.findFirst({
    where: { id: data.listId, botId },
  });
  if (!list) {
    redirect(`/dashboard/bots/${botId}/email/campaigns/new?error=${encodeURIComponent('Invalid contact list')}`);
  }

  try {
    const campaign = await db.emailCampaign.create({
      data: {
        botId,
        accountId: bot.emailAccount.id,
        listId: data.listId,
        name: data.name,
        subject: data.subject,
        preheader: data.preheader || null,
        fromName: data.fromName || bot.emailAccount.fromName || null,
        htmlContent: data.htmlContent,
        textContent: data.textContent || null,
        status: 'DRAFT',
      },
    });

    redirect(`/dashboard/bots/${botId}/email?tab=campaigns&success=${encodeURIComponent('Campaign created as draft')}`);
  } catch (error) {
    if (error instanceof Error && error.message === 'NEXT_REDIRECT') throw error;
    redirect(`/dashboard/bots/${botId}/email/campaigns/new?error=${encodeURIComponent('Failed to create campaign')}`);
  }
}

// ============ PAGE ============

export default async function NewCampaignPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
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
      },
    },
  });

  if (!bot) notFound();
  if (!bot.emailAccount) {
    redirect(`/dashboard/bots/${id}/email?tab=setup&error=${encodeURIComponent('Set up email account first')}`);
  }

  const lists = bot.emailLists;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/dashboard/bots/${id}/email?tab=campaigns`}>
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-3 w-3 mr-1" />
            Back
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">New Email Campaign</h1>
      </div>

      <BotNav botId={bot.id} activeTab="email" />

      {sp.error && (
        <div className="bg-red-50 text-red-800 border border-red-200 rounded-lg p-3 text-sm">
          {sp.error}
        </div>
      )}

      <form action={createCampaign} className="space-y-6">
        <input type="hidden" name="botId" value={id} />

        {/* Campaign basics */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Campaign Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Campaign Name (internal)</Label>
              <Input name="name" id="name" placeholder="e.g. February Newsletter" required />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="subject">Subject Line</Label>
                <Input name="subject" id="subject" placeholder="e.g. Your weekly update is here" required />
                <p className="text-xs text-muted-foreground mt-1">
                  Keep it under 60 characters. Avoid ALL CAPS and excessive punctuation.
                </p>
              </div>
              <div>
                <Label htmlFor="preheader">Preheader Text (optional)</Label>
                <Input name="preheader" id="preheader" placeholder="Brief preview text shown after subject" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="fromName">From Name (optional)</Label>
                <Input
                  name="fromName"
                  id="fromName"
                  placeholder={bot.emailAccount.fromName || 'Your name or company'}
                />
              </div>
              <div>
                <Label htmlFor="listId">Send To</Label>
                <select
                  name="listId"
                  id="listId"
                  className="w-full mt-1 rounded-md border bg-background px-3 py-2 text-sm"
                  required
                >
                  <option value="">Select a contact list</option>
                  {lists.map((list) => (
                    <option key={list.id} value={list.id}>
                      {list.name} ({list._count.contacts} contacts)
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Email content */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Email Content</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-50 text-blue-800 rounded-lg p-3 text-sm">
              <p className="font-medium mb-1">HTML Email</p>
              <p>
                Write or paste your HTML email content below. Use merge tags like
                {' '}{'{{firstName}}'}, {'{{lastName}}'}, {'{{email}}'} for personalization.
                An unsubscribe link is automatically added to every email.
              </p>
            </div>
            <div>
              <Label htmlFor="htmlContent">HTML Content</Label>
              <textarea
                name="htmlContent"
                id="htmlContent"
                rows={15}
                className="w-full mt-1 rounded-md border bg-background px-3 py-2 text-sm font-mono"
                placeholder={`<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h1>Hello {{firstName}},</h1>
  <p>Your content here...</p>
  <p>Best regards,<br>${bot.brandName}</p>
</body>
</html>`}
                required
              />
            </div>
            <div>
              <Label htmlFor="textContent">Plain Text Version (optional but recommended)</Label>
              <textarea
                name="textContent"
                id="textContent"
                rows={5}
                className="w-full mt-1 rounded-md border bg-background px-3 py-2 text-sm"
                placeholder="Plain text fallback for email clients that don't support HTML"
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit">
            <Send className="h-4 w-4 mr-1" />
            Save as Draft
          </Button>
          <Link href={`/dashboard/bots/${id}/email?tab=campaigns`}>
            <Button variant="outline" type="button">Cancel</Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
