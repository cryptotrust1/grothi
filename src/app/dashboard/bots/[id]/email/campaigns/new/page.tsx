import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { emailCampaignSchema } from '@/lib/validations';
import CampaignCreator from '@/components/dashboard/campaign-creator';

export const metadata: Metadata = {
  title: 'New Email Campaign',
  robots: { index: false },
};

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

  // Server action for creating the campaign
  async function createCampaign(formData: FormData) {
    'use server';
    const currentUser = await requireAuth();
    const botId = formData.get('botId') as string;

    const currentBot = await db.bot.findFirst({
      where: { id: botId, userId: currentUser.id },
      include: { emailAccount: true },
    });
    if (!currentBot || !currentBot.emailAccount) return;

    const htmlContent = (formData.get('htmlContent') as string || '').trim();
    const designJson = (formData.get('designJson') as string || '').trim();

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

    const scheduledAtRaw = (formData.get('scheduledAt') as string || '').trim();
    let scheduledAt: Date | null = null;
    if (scheduledAtRaw) {
      scheduledAt = new Date(scheduledAtRaw);
      if (isNaN(scheduledAt.getTime()) || scheduledAt <= new Date()) {
        scheduledAt = null;
      }
    }

    try {
      const campaign = await db.emailCampaign.create({
        data: {
          botId,
          accountId: currentBot.emailAccount.id,
          listId: data.listId,
          name: data.name,
          subject: data.subject,
          subjectB: data.subjectB || null,
          abTestPercent: data.subjectB ? (data.abTestPercent || 20) : null,
          preheader: data.preheader || null,
          fromName: data.fromName || currentBot.emailAccount.fromName || null,
          htmlContent: data.htmlContent,
          textContent: data.textContent || null,
          designJson: designJson || null,
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

  return (
    <CampaignCreator
      botId={id}
      brandName={bot.brandName}
      lists={bot.emailLists.map(l => ({
        id: l.id,
        name: l.name,
        _count: l._count,
      }))}
      emailAccount={{
        fromName: bot.emailAccount.fromName,
        fromEmail: bot.emailAccount.email || bot.emailAccount.smtpUser || '',
      }}
      createCampaignAction={createCampaign}
      error={sp.error}
    />
  );
}
