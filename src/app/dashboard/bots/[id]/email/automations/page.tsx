import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { BotNav } from '@/components/dashboard/bot-nav';
import {
  ArrowLeft, Plus, Zap, Mail, Clock, Trash2,
  Play, Pause, UserPlus, RefreshCw, ListOrdered,
} from 'lucide-react';
import { emailAutomationSchema, emailAutomationStepSchema } from '@/lib/validations';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Email Automations',
  robots: { index: false },
};

const AUTOMATION_TYPES = [
  {
    value: 'WELCOME',
    label: 'Welcome Series',
    description: 'Automatically send emails when a new contact is added to a list',
    icon: UserPlus,
  },
  {
    value: 'RE_ENGAGEMENT',
    label: 'Re-engagement',
    description: 'Win back contacts who have not opened emails in a while',
    icon: RefreshCw,
  },
  {
    value: 'DRIP',
    label: 'Drip Sequence',
    description: 'Send a series of emails on a set schedule',
    icon: ListOrdered,
  },
] as const;

// ============ SERVER ACTIONS ============

async function createAutomation(formData: FormData) {
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
    type: formData.get('type') as string,
    triggerListId: (formData.get('triggerListId') as string) || undefined,
    triggerConfig: formData.get('type') === 'RE_ENGAGEMENT'
      ? { delayDays: parseInt(formData.get('delayDays') as string, 10) || 30 }
      : undefined,
  };

  const parsed = emailAutomationSchema.safeParse(raw);
  if (!parsed.success) {
    redirect(`/dashboard/bots/${botId}/email/automations?error=${encodeURIComponent(parsed.error.errors[0].message)}`);
  }

  try {
    await db.emailAutomation.create({
      data: {
        botId,
        name: parsed.data.name,
        type: parsed.data.type as 'WELCOME' | 'RE_ENGAGEMENT' | 'DRIP',
        triggerListId: parsed.data.triggerListId || null,
        triggerConfig: parsed.data.triggerConfig || undefined,
      },
    });
    redirect(`/dashboard/bots/${botId}/email/automations?success=Automation+created`);
  } catch (error) {
    if (error instanceof Error && error.message === 'NEXT_REDIRECT') throw error;
    redirect(`/dashboard/bots/${botId}/email/automations?error=${encodeURIComponent('Failed to create automation')}`);
  }
}

async function addStep(formData: FormData) {
  'use server';
  const user = await requireAuth();
  const botId = formData.get('botId') as string;
  const automationId = formData.get('automationId') as string;

  const bot = await db.bot.findFirst({ where: { id: botId, userId: user.id } });
  if (!bot) return;

  const raw = {
    subject: (formData.get('subject') as string || '').trim(),
    htmlContent: (formData.get('htmlContent') as string || '').trim(),
    textContent: (formData.get('textContent') as string || '').trim() || undefined,
    delayDays: parseInt(formData.get('delayDays') as string, 10) || 0,
    delayHours: parseInt(formData.get('delayHours') as string, 10) || 0,
  };

  const parsed = emailAutomationStepSchema.safeParse(raw);
  if (!parsed.success) {
    redirect(`/dashboard/bots/${botId}/email/automations?error=${encodeURIComponent(parsed.error.errors[0].message)}`);
  }

  const stepCount = await db.emailAutomationStep.count({ where: { automationId } });

  try {
    await db.emailAutomationStep.create({
      data: {
        automationId,
        stepOrder: stepCount + 1,
        subject: parsed.data.subject,
        htmlContent: parsed.data.htmlContent,
        textContent: parsed.data.textContent || null,
        delayDays: parsed.data.delayDays,
        delayHours: parsed.data.delayHours,
      },
    });
    redirect(`/dashboard/bots/${botId}/email/automations?success=Step+added`);
  } catch (error) {
    if (error instanceof Error && error.message === 'NEXT_REDIRECT') throw error;
    redirect(`/dashboard/bots/${botId}/email/automations?error=${encodeURIComponent('Failed to add step')}`);
  }
}

async function toggleAutomation(formData: FormData) {
  'use server';
  const user = await requireAuth();
  const botId = formData.get('botId') as string;
  const automationId = formData.get('automationId') as string;

  const bot = await db.bot.findFirst({ where: { id: botId, userId: user.id } });
  if (!bot) return;

  const automation = await db.emailAutomation.findFirst({
    where: { id: automationId, botId },
    include: { _count: { select: { steps: true } } },
  });
  if (!automation) return;

  if (!automation.isActive && automation._count.steps === 0) {
    redirect(`/dashboard/bots/${botId}/email/automations?error=${encodeURIComponent('Add at least one step before activating')}`);
  }

  try {
    await db.emailAutomation.update({
      where: { id: automationId },
      data: { isActive: !automation.isActive },
    });
    redirect(`/dashboard/bots/${botId}/email/automations?success=${automation.isActive ? 'Automation+paused' : 'Automation+activated'}`);
  } catch (error) {
    if (error instanceof Error && error.message === 'NEXT_REDIRECT') throw error;
    redirect(`/dashboard/bots/${botId}/email/automations?error=${encodeURIComponent('Failed to update automation')}`);
  }
}

async function deleteAutomation(formData: FormData) {
  'use server';
  const user = await requireAuth();
  const botId = formData.get('botId') as string;
  const automationId = formData.get('automationId') as string;

  const bot = await db.bot.findFirst({ where: { id: botId, userId: user.id } });
  if (!bot) return;

  try {
    await db.emailAutomation.delete({ where: { id: automationId, botId } });
    redirect(`/dashboard/bots/${botId}/email/automations?success=Automation+deleted`);
  } catch (error) {
    if (error instanceof Error && error.message === 'NEXT_REDIRECT') throw error;
    redirect(`/dashboard/bots/${botId}/email/automations?error=${encodeURIComponent('Failed to delete')}`);
  }
}

async function deleteStep(formData: FormData) {
  'use server';
  const user = await requireAuth();
  const botId = formData.get('botId') as string;
  const stepId = formData.get('stepId') as string;

  const bot = await db.bot.findFirst({ where: { id: botId, userId: user.id } });
  if (!bot) return;

  try {
    await db.emailAutomationStep.delete({ where: { id: stepId } });
    redirect(`/dashboard/bots/${botId}/email/automations?success=Step+removed`);
  } catch (error) {
    if (error instanceof Error && error.message === 'NEXT_REDIRECT') throw error;
    redirect(`/dashboard/bots/${botId}/email/automations?error=${encodeURIComponent('Failed to remove step')}`);
  }
}

// ============ PAGE ============

export default async function AutomationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string; expand?: string }>;
}) {
  const user = await requireAuth();
  const { id } = await params;
  const sp = await searchParams;

  const bot = await db.bot.findFirst({
    where: { id, userId: user.id },
    include: {
      emailAccount: true,
      emailLists: true,
      emailAutomations: {
        include: {
          steps: { orderBy: { stepOrder: 'asc' } },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!bot) notFound();

  const automations = bot.emailAutomations;
  const lists = bot.emailLists;
  const expandedId = sp.expand || '';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/dashboard/bots/${id}/email`}>
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-3 w-3 mr-1" />
            Email Marketing
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Email Automations</h1>
      </div>

      <BotNav botId={bot.id} activeTab="email" />

      {sp.error && (
        <div className="bg-red-50 text-red-800 border border-red-200 rounded-lg p-3 text-sm">{sp.error}</div>
      )}
      {sp.success && (
        <div className="bg-green-50 text-green-800 border border-green-200 rounded-lg p-3 text-sm">{sp.success}</div>
      )}

      {!bot.emailAccount && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <p>Set up your email account first before creating automations.</p>
            <Link href={`/dashboard/bots/${id}/email?tab=setup`}>
              <Button className="mt-3">Set Up Email Account</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {bot.emailAccount && (
        <>
          {/* Create new automation */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Create Automation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form action={createAutomation} className="space-y-4">
                <input type="hidden" name="botId" value={id} />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="name">Automation Name</Label>
                    <Input name="name" id="name" placeholder="e.g. Welcome Series" required />
                  </div>
                  <div>
                    <Label htmlFor="type">Type</Label>
                    <select
                      name="type"
                      id="type"
                      className="w-full mt-1 rounded-md border bg-background px-3 py-2 text-sm"
                      required
                    >
                      {AUTOMATION_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="triggerListId">Trigger List (optional)</Label>
                    <select
                      name="triggerListId"
                      id="triggerListId"
                      className="w-full mt-1 rounded-md border bg-background px-3 py-2 text-sm"
                    >
                      <option value="">All lists</option>
                      {lists.map((l) => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <Button type="submit">Create Automation</Button>
              </form>
            </CardContent>
          </Card>

          {/* Automation type descriptions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {AUTOMATION_TYPES.map((t) => {
              const Icon = t.icon;
              return (
                <Card key={t.value}>
                  <CardContent className="pt-4 pb-4 flex items-start gap-3">
                    <Icon className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">{t.label}</p>
                      <p className="text-xs text-muted-foreground mt-1">{t.description}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Existing automations */}
          {automations.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Zap className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No automations yet. Create one above to get started.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {automations.map((auto) => {
                const typeInfo = AUTOMATION_TYPES.find(t => t.value === auto.type);
                const isExpanded = expandedId === auto.id;

                return (
                  <Card key={auto.id}>
                    <CardContent className="py-4">
                      {/* Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{auto.name}</p>
                              {auto.isActive ? (
                                <Badge variant="success">Active</Badge>
                              ) : (
                                <Badge variant="secondary">Paused</Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {typeInfo?.label} - {auto.steps.length} step{auto.steps.length !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Link href={`/dashboard/bots/${id}/email/automations?expand=${isExpanded ? '' : auto.id}`}>
                            <Button variant="outline" size="sm">
                              {isExpanded ? 'Collapse' : 'Expand'}
                            </Button>
                          </Link>
                          <form action={toggleAutomation}>
                            <input type="hidden" name="botId" value={id} />
                            <input type="hidden" name="automationId" value={auto.id} />
                            <Button variant="outline" size="sm">
                              {auto.isActive ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                            </Button>
                          </form>
                          <form action={deleteAutomation}>
                            <input type="hidden" name="botId" value={id} />
                            <input type="hidden" name="automationId" value={auto.id} />
                            <Button variant="outline" size="sm" className="text-red-600">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </form>
                        </div>
                      </div>

                      {/* Expanded: Steps */}
                      {isExpanded && (
                        <div className="mt-4 space-y-4">
                          {/* Existing steps */}
                          {auto.steps.length > 0 && (
                            <div className="space-y-2">
                              {auto.steps.map((step, idx) => (
                                <div key={step.id} className="flex items-start gap-3 border rounded-lg p-3 bg-muted/20">
                                  <div className="flex flex-col items-center">
                                    <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                                      {idx + 1}
                                    </div>
                                    {idx < auto.steps.length - 1 && (
                                      <div className="w-0.5 h-6 bg-border mt-1" />
                                    )}
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex items-center justify-between">
                                      <p className="font-medium text-sm">{step.subject}</p>
                                      <form action={deleteStep}>
                                        <input type="hidden" name="botId" value={id} />
                                        <input type="hidden" name="stepId" value={step.id} />
                                        <Button variant="ghost" size="sm" className="text-red-600 h-6 w-6 p-0">
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      </form>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                      <Clock className="h-3 w-3" />
                                      {step.delayDays > 0 || step.delayHours > 0 ? (
                                        <span>
                                          Wait {step.delayDays > 0 ? `${step.delayDays}d` : ''}{step.delayHours > 0 ? ` ${step.delayHours}h` : ''} after {idx === 0 ? 'trigger' : 'previous step'}
                                        </span>
                                      ) : (
                                        <span>{idx === 0 ? 'Send immediately' : 'Send immediately after previous'}</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Add step form */}
                          <div className="border-t pt-4">
                            <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                              <Plus className="h-3 w-3" />
                              Add Step #{auto.steps.length + 1}
                            </h4>
                            <form action={addStep} className="space-y-3">
                              <input type="hidden" name="botId" value={id} />
                              <input type="hidden" name="automationId" value={auto.id} />

                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div>
                                  <Label>Subject Line</Label>
                                  <Input name="subject" placeholder="Welcome to our community!" required />
                                </div>
                                <div>
                                  <Label>Delay (days)</Label>
                                  <Input name="delayDays" type="number" defaultValue={auto.steps.length === 0 ? '0' : '3'} min="0" />
                                </div>
                                <div>
                                  <Label>Delay (hours)</Label>
                                  <Input name="delayHours" type="number" defaultValue="0" min="0" max="23" />
                                </div>
                              </div>

                              <div>
                                <Label>HTML Content</Label>
                                <textarea
                                  name="htmlContent"
                                  rows={6}
                                  className="w-full mt-1 rounded-md border bg-background px-3 py-2 text-sm font-mono"
                                  placeholder={`<h1>Hello {{firstName}},</h1>\n<p>Welcome! Here's what you need to know...</p>`}
                                  required
                                />
                              </div>

                              <Button type="submit" variant="outline" size="sm">
                                <Plus className="h-3 w-3 mr-1" />
                                Add Step
                              </Button>
                            </form>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
