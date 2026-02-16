import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { deductCredits, getActionCost } from '@/lib/credits';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BotNav } from '@/components/dashboard/bot-nav';
import { ArrowLeft, Send, FileText, Sparkles } from 'lucide-react';
import { emailCampaignSchema } from '@/lib/validations';
import { EMAIL_TEMPLATES, TEMPLATE_CATEGORIES, applyTemplateVars } from '@/lib/email-templates';
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

  const templateId = formData.get('templateId') as string;
  let htmlContent = (formData.get('htmlContent') as string || '').trim();

  // If a template was selected, use it and apply vars
  if (templateId && !htmlContent) {
    const template = EMAIL_TEMPLATES.find(t => t.id === templateId);
    if (template) {
      htmlContent = applyTemplateVars(template.html, {
        brandName: bot.brandName,
        targetUrl: bot.targetUrl || 'https://example.com',
        subject: (formData.get('subject') as string || '').trim(),
      });
    }
  }

  const subjectB = (formData.get('subjectB') as string || '').trim() || undefined;
  const abTestPercent = subjectB ? parseInt(formData.get('abTestPercent') as string, 10) || 20 : undefined;

  const raw = {
    name: (formData.get('name') as string || '').trim(),
    subject: (formData.get('subject') as string || '').trim(),
    subjectB,
    abTestPercent,
    preheader: (formData.get('preheader') as string || '').trim() || undefined,
    fromName: (formData.get('fromName') as string || '').trim() || undefined,
    listId: formData.get('listId') as string,
    htmlContent,
    textContent: (formData.get('textContent') as string || '').trim() || undefined,
  };

  const parsed = emailCampaignSchema.safeParse(raw);
  if (!parsed.success) {
    redirect(`/dashboard/bots/${botId}/email/campaigns/new?error=${encodeURIComponent(parsed.error.errors[0].message)}`);
  }

  const data = parsed.data;

  const list = await db.emailList.findFirst({
    where: { id: data.listId, botId },
  });
  if (!list) {
    redirect(`/dashboard/bots/${botId}/email/campaigns/new?error=${encodeURIComponent('Invalid contact list')}`);
  }

  // Scheduled sending
  const scheduledAtRaw = (formData.get('scheduledAt') as string || '').trim();
  let scheduledAt: Date | null = null;
  if (scheduledAtRaw) {
    scheduledAt = new Date(scheduledAtRaw);
    if (isNaN(scheduledAt.getTime()) || scheduledAt <= new Date()) {
      scheduledAt = null; // Invalid or in the past → save as draft
    }
  }

  try {
    const campaign = await db.emailCampaign.create({
      data: {
        botId,
        accountId: bot.emailAccount.id,
        listId: data.listId,
        name: data.name,
        subject: data.subject,
        subjectB: data.subjectB || null,
        abTestPercent: data.subjectB ? (data.abTestPercent || 20) : null,
        preheader: data.preheader || null,
        fromName: data.fromName || bot.emailAccount.fromName || null,
        htmlContent: data.htmlContent,
        textContent: data.textContent || null,
        status: scheduledAt ? 'SCHEDULED' : 'DRAFT',
        scheduledAt,
      },
    });

    const successMsg = scheduledAt
      ? `Campaign scheduled for ${scheduledAt.toLocaleString()}. The email jobs runner will send it automatically.`
      : 'Campaign created as draft. Send a test email before launching!';
    redirect(`/dashboard/bots/${botId}/email/campaigns/${campaign.id}?success=${encodeURIComponent(successMsg)}`);
  } catch (error) {
    if (error instanceof Error && error.message === 'NEXT_REDIRECT') throw error;
    redirect(`/dashboard/bots/${botId}/email/campaigns/new?error=${encodeURIComponent('Failed to create campaign')}`);
  }
}

async function generateWithAI(formData: FormData) {
  'use server';
  const user = await requireAuth();
  const botId = formData.get('botId') as string;
  const topic = (formData.get('aiTopic') as string || '').trim();
  const tone = (formData.get('aiTone') as string || 'professional').trim();

  if (!topic) {
    redirect(`/dashboard/bots/${botId}/email/campaigns/new?error=${encodeURIComponent('Please describe what the email should be about')}`);
  }

  const bot = await db.bot.findFirst({
    where: { id: botId, userId: user.id },
  });
  if (!bot) return;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    redirect(`/dashboard/bots/${botId}/email/campaigns/new?error=${encodeURIComponent('AI generation not configured (ANTHROPIC_API_KEY missing)')}`);
  }

  // Deduct credits BEFORE calling the API
  const cost = await getActionCost('GENERATE_CONTENT');
  const deducted = await deductCredits(user.id, cost, 'AI email campaign generation', botId);
  if (!deducted) {
    redirect(`/dashboard/bots/${botId}/email/campaigns/new?error=${encodeURIComponent('Insufficient credits. You need ' + cost + ' credits for AI generation.')}`);
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: `Generate an email marketing campaign for the brand "${bot.brandName}".

Topic: ${topic}
Tone: ${tone}
Brand instructions: ${bot.instructions}

Respond with ONLY a JSON object (no markdown, no code blocks) with these exact keys:
{
  "subject": "Email subject line (under 60 chars)",
  "preheader": "Preheader preview text (under 100 chars)",
  "html": "Complete responsive HTML email body (use inline CSS, max-width 600px, include {{firstName}} merge tag, professional design)",
  "text": "Plain text version of the email"
}`,
        }],
      }),
    });

    if (!response.ok) {
      redirect(`/dashboard/bots/${botId}/email/campaigns/new?error=${encodeURIComponent('AI generation failed')}`);
    }

    const result = await response.json();
    const textContent = result.content?.[0]?.text || '';

    let parsed: { subject?: string; preheader?: string; html?: string; text?: string };
    try {
      parsed = JSON.parse(textContent);
    } catch {
      redirect(`/dashboard/bots/${botId}/email/campaigns/new?error=${encodeURIComponent('AI returned invalid response. Try again.')}`);
      return;
    }

    // Redirect with generated content in query params (URL-encoded)
    const params = new URLSearchParams({
      aiSubject: parsed.subject || '',
      aiPreheader: parsed.preheader || '',
      aiHtml: parsed.html || '',
      aiText: parsed.text || '',
    });

    redirect(`/dashboard/bots/${botId}/email/campaigns/new?${params.toString()}`);
  } catch (error) {
    if (error instanceof Error && error.message === 'NEXT_REDIRECT') throw error;
    redirect(`/dashboard/bots/${botId}/email/campaigns/new?error=${encodeURIComponent('AI generation failed')}`);
  }
}

// ============ PAGE ============

export default async function NewCampaignPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    error?: string;
    template?: string;
    aiSubject?: string;
    aiPreheader?: string;
    aiHtml?: string;
    aiText?: string;
  }>;
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
  const selectedTemplateId = sp.template || '';
  const selectedTemplate = EMAIL_TEMPLATES.find(t => t.id === selectedTemplateId);

  // Pre-fill from AI generation or template
  let defaultHtml = '';
  let defaultSubject = sp.aiSubject || '';
  let defaultPreheader = sp.aiPreheader || '';
  let defaultText = sp.aiText || '';

  if (sp.aiHtml) {
    defaultHtml = sp.aiHtml;
  } else if (selectedTemplate) {
    defaultHtml = applyTemplateVars(selectedTemplate.html, {
      brandName: bot.brandName,
      targetUrl: bot.targetUrl || 'https://example.com',
      subject: '{{subject}}',
    });
  }

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

      {/* AI Content Generation */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            AI Content Generation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form action={generateWithAI} className="space-y-3">
            <input type="hidden" name="botId" value={id} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <Label htmlFor="aiTopic">What should the email be about?</Label>
                <Input
                  name="aiTopic"
                  id="aiTopic"
                  placeholder="e.g. February newsletter about our new product launch and upcoming webinar"
                />
              </div>
              <div>
                <Label htmlFor="aiTone">Tone</Label>
                <select
                  name="aiTone"
                  id="aiTone"
                  className="w-full mt-1 rounded-md border bg-background px-3 py-2 text-sm"
                >
                  <option value="professional">Professional</option>
                  <option value="casual">Casual & Friendly</option>
                  <option value="urgent">Urgent</option>
                  <option value="inspirational">Inspirational</option>
                  <option value="humorous">Humorous</option>
                </select>
              </div>
            </div>
            <Button type="submit" variant="outline">
              <Sparkles className="h-3 w-3 mr-1" />
              Generate with AI
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Template Picker */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Choose a Template
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {EMAIL_TEMPLATES.map((template) => (
              <Link
                key={template.id}
                href={`/dashboard/bots/${id}/email/campaigns/new?template=${template.id}`}
              >
                <div className={`border rounded-lg p-3 cursor-pointer transition-colors hover:border-primary/50 ${
                  selectedTemplateId === template.id ? 'border-primary bg-primary/5' : ''
                }`}>
                  <p className="font-medium text-sm">{template.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">{template.description}</p>
                  <span className="inline-block mt-2 text-xs bg-muted px-2 py-0.5 rounded">
                    {TEMPLATE_CATEGORIES.find(c => c.value === template.category)?.label || template.category}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      <form action={createCampaign} className="space-y-6">
        <input type="hidden" name="botId" value={id} />
        <input type="hidden" name="templateId" value={selectedTemplateId} />

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
                <Input
                  name="subject"
                  id="subject"
                  placeholder="e.g. Your weekly update is here"
                  defaultValue={defaultSubject}
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Keep it under 60 characters. Avoid ALL CAPS and excessive punctuation.
                </p>
              </div>
              <div>
                <Label htmlFor="preheader">Preheader Text (optional)</Label>
                <Input
                  name="preheader"
                  id="preheader"
                  placeholder="Brief preview text shown after subject"
                  defaultValue={defaultPreheader}
                />
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

        {/* A/B Testing */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">A/B Testing (optional)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Test two subject lines to find which performs better. The test group receives
              variant A or B randomly. After enough data, the winning subject is used for the rest.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="subjectB">Subject Line B (variant)</Label>
                <Input
                  name="subjectB"
                  id="subjectB"
                  placeholder="e.g. Don't miss our latest update!"
                />
              </div>
              <div>
                <Label htmlFor="abTestPercent">Test sample size (%)</Label>
                <select
                  name="abTestPercent"
                  id="abTestPercent"
                  className="w-full mt-1 rounded-md border bg-background px-3 py-2 text-sm"
                >
                  <option value="10">10% (5% per variant)</option>
                  <option value="20" selected>20% (10% per variant)</option>
                  <option value="30">30% (15% per variant)</option>
                  <option value="50">50% (25% per variant)</option>
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  Leave Subject B empty to skip A/B testing.
                </p>
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
              <p className="font-medium mb-1">Merge Tags</p>
              <p>
                Use these tags for personalization:{' '}
                <code className="bg-blue-100 px-1 rounded">{'{{firstName}}'}</code>{' '}
                <code className="bg-blue-100 px-1 rounded">{'{{lastName}}'}</code>{' '}
                <code className="bg-blue-100 px-1 rounded">{'{{email}}'}</code>{' '}
                <code className="bg-blue-100 px-1 rounded">{'{{brandName}}'}</code>.
                Unsubscribe link is added automatically.
              </p>
            </div>
            <div>
              <Label htmlFor="htmlContent">HTML Content</Label>
              <textarea
                name="htmlContent"
                id="htmlContent"
                rows={20}
                className="w-full mt-1 rounded-md border bg-background px-3 py-2 text-sm font-mono"
                defaultValue={defaultHtml}
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
                defaultValue={defaultText}
                placeholder="Plain text fallback for email clients that don't support HTML"
              />
            </div>
          </CardContent>
        </Card>

        {/* Scheduling */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Schedule (optional)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Set a date and time to automatically send this campaign. Leave empty to save as draft.
            </p>
            <div className="max-w-xs">
              <Label htmlFor="scheduledAt">Send At</Label>
              <Input
                name="scheduledAt"
                id="scheduledAt"
                type="datetime-local"
                min={new Date().toISOString().slice(0, 16)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                The email jobs runner checks every minute for scheduled campaigns.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit">
            <Send className="h-4 w-4 mr-1" />
            Save Campaign
          </Button>
          <Link href={`/dashboard/bots/${id}/email?tab=campaigns`}>
            <Button variant="outline" type="button">Cancel</Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
