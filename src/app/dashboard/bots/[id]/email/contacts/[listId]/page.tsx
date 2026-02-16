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
  Users, Plus, Upload, Trash2, ArrowLeft, Mail,
} from 'lucide-react';
import { CONTACT_STATUS_CONFIG } from '@/lib/constants';
import { emailContactSchema } from '@/lib/validations';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Contact List',
  robots: { index: false },
};

// ============ SERVER ACTIONS ============

async function addContact(formData: FormData) {
  'use server';
  const user = await requireAuth();
  const botId = formData.get('botId') as string;
  const listId = formData.get('listId') as string;

  const bot = await db.bot.findFirst({ where: { id: botId, userId: user.id } });
  if (!bot) return;

  const raw = {
    email: (formData.get('email') as string || '').trim(),
    firstName: (formData.get('firstName') as string || '').trim() || undefined,
    lastName: (formData.get('lastName') as string || '').trim() || undefined,
  };

  const parsed = emailContactSchema.safeParse(raw);
  if (!parsed.success) {
    redirect(`/dashboard/bots/${botId}/email/contacts/${listId}?error=${encodeURIComponent(parsed.error.errors[0].message)}`);
  }

  try {
    await db.emailContact.create({
      data: {
        listId,
        email: parsed.data.email,
        firstName: parsed.data.firstName || null,
        lastName: parsed.data.lastName || null,
        consentedAt: new Date(),
        consentSource: 'manual',
      },
    });

    // Update contact count
    const count = await db.emailContact.count({ where: { listId } });
    await db.emailList.update({
      where: { id: listId },
      data: { contactCount: count },
    });

    redirect(`/dashboard/bots/${botId}/email/contacts/${listId}?success=Contact+added`);
  } catch (error) {
    if (error instanceof Error && error.message === 'NEXT_REDIRECT') throw error;
    redirect(`/dashboard/bots/${botId}/email/contacts/${listId}?error=${encodeURIComponent('Failed to add contact (may already exist)')}`);
  }
}

async function deleteContact(formData: FormData) {
  'use server';
  const user = await requireAuth();
  const botId = formData.get('botId') as string;
  const listId = formData.get('listId') as string;
  const contactId = formData.get('contactId') as string;

  const bot = await db.bot.findFirst({ where: { id: botId, userId: user.id } });
  if (!bot) return;

  try {
    await db.emailContact.delete({ where: { id: contactId } });

    const count = await db.emailContact.count({ where: { listId } });
    await db.emailList.update({
      where: { id: listId },
      data: { contactCount: count },
    });

    redirect(`/dashboard/bots/${botId}/email/contacts/${listId}?success=Contact+removed`);
  } catch (error) {
    if (error instanceof Error && error.message === 'NEXT_REDIRECT') throw error;
    redirect(`/dashboard/bots/${botId}/email/contacts/${listId}?error=${encodeURIComponent('Failed to remove contact')}`);
  }
}

async function importContacts(formData: FormData) {
  'use server';
  const user = await requireAuth();
  const botId = formData.get('botId') as string;
  const listId = formData.get('listId') as string;
  const csvText = formData.get('csvData') as string;

  const bot = await db.bot.findFirst({ where: { id: botId, userId: user.id } });
  if (!bot) return;

  if (!csvText || !csvText.trim()) {
    redirect(`/dashboard/bots/${botId}/email/contacts/${listId}?error=${encodeURIComponent('No CSV data provided')}`);
  }

  try {
    const lines = csvText.trim().split('\n').map(l => l.trim()).filter(l => l);

    // Detect header row
    const firstLine = lines[0].toLowerCase();
    const hasHeader = firstLine.includes('email') || firstLine.includes('name');
    const dataLines = hasHeader ? lines.slice(1) : lines;

    let imported = 0;
    let skipped = 0;

    for (const line of dataLines) {
      const parts = line.split(',').map(p => p.trim().replace(/^["']|["']$/g, ''));
      const email = parts[0];

      if (!email || !email.includes('@')) {
        skipped++;
        continue;
      }

      try {
        await db.emailContact.create({
          data: {
            listId,
            email: email.toLowerCase(),
            firstName: parts[1] || null,
            lastName: parts[2] || null,
            consentedAt: new Date(),
            consentSource: 'csv_import',
          },
        });
        imported++;
      } catch {
        skipped++;
      }
    }

    // Update count
    const count = await db.emailContact.count({ where: { listId } });
    await db.emailList.update({
      where: { id: listId },
      data: { contactCount: count },
    });

    redirect(`/dashboard/bots/${botId}/email/contacts/${listId}?success=${encodeURIComponent(`Imported ${imported} contacts, ${skipped} skipped`)}`);
  } catch (error) {
    if (error instanceof Error && error.message === 'NEXT_REDIRECT') throw error;
    redirect(`/dashboard/bots/${botId}/email/contacts/${listId}?error=${encodeURIComponent('Import failed')}`);
  }
}

// ============ PAGE ============

export default async function ContactListPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; listId: string }>;
  searchParams: Promise<{ error?: string; success?: string; page?: string; status?: string; engagement?: string }>;
}) {
  const user = await requireAuth();
  const { id, listId } = await params;
  const sp = await searchParams;

  const bot = await db.bot.findFirst({ where: { id, userId: user.id } });
  if (!bot) notFound();

  const list = await db.emailList.findFirst({
    where: { id: listId, botId: id },
  });
  if (!list) notFound();

  const page = Math.max(1, parseInt(sp.page || '1', 10) || 1);
  const pageSize = 50;

  // Build filter where clause
  const statusFilter = sp.status as string | undefined;
  const engagementFilter = sp.engagement as string | undefined;

  const whereClause: Record<string, unknown> = { listId };
  if (statusFilter && ['ACTIVE', 'UNSUBSCRIBED', 'BOUNCED', 'COMPLAINED'].includes(statusFilter)) {
    whereClause.status = statusFilter;
  }
  if (engagementFilter === 'opened') {
    whereClause.openCount = { gt: 0 };
  } else if (engagementFilter === 'clicked') {
    whereClause.clickCount = { gt: 0 };
  } else if (engagementFilter === 'inactive') {
    whereClause.openCount = 0;
    whereClause.clickCount = 0;
  }

  const [contacts, totalCount] = await Promise.all([
    db.emailContact.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: pageSize,
      skip: (page - 1) * pageSize,
    }),
    db.emailContact.count({ where: whereClause }),
  ]);

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/dashboard/bots/${id}/email?tab=contacts`}>
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-3 w-3 mr-1" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{list.name}</h1>
          <p className="text-muted-foreground text-sm">{totalCount} contacts</p>
        </div>
      </div>

      <BotNav botId={bot.id} activeTab="email" />

      {/* Status messages */}
      {sp.error && (
        <div className="bg-red-50 text-red-800 border border-red-200 rounded-lg p-3 text-sm">
          {sp.error}
        </div>
      )}
      {sp.success && (
        <div className="bg-green-50 text-green-800 border border-green-200 rounded-lg p-3 text-sm">
          {sp.success}
        </div>
      )}

      {/* Filters + Export */}
      <Card>
        <CardContent className="py-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground">Filter:</span>
            <div className="flex gap-1">
              {[
                { value: '', label: 'All' },
                { value: 'ACTIVE', label: 'Active' },
                { value: 'UNSUBSCRIBED', label: 'Unsubscribed' },
                { value: 'BOUNCED', label: 'Bounced' },
              ].map((f) => (
                <Link
                  key={f.value}
                  href={`/dashboard/bots/${id}/email/contacts/${listId}?status=${f.value}&engagement=${engagementFilter || ''}`}
                >
                  <span className={`px-2 py-1 text-xs rounded cursor-pointer ${
                    (statusFilter || '') === f.value ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
                  }`}>
                    {f.label}
                  </span>
                </Link>
              ))}
            </div>

            <span className="text-sm font-medium text-muted-foreground ml-2">Engagement:</span>
            <div className="flex gap-1">
              {[
                { value: '', label: 'All' },
                { value: 'opened', label: 'Opened' },
                { value: 'clicked', label: 'Clicked' },
                { value: 'inactive', label: 'Never engaged' },
              ].map((f) => (
                <Link
                  key={f.value}
                  href={`/dashboard/bots/${id}/email/contacts/${listId}?status=${statusFilter || ''}&engagement=${f.value}`}
                >
                  <span className={`px-2 py-1 text-xs rounded cursor-pointer ${
                    (engagementFilter || '') === f.value ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
                  }`}>
                    {f.label}
                  </span>
                </Link>
              ))}
            </div>

            <div className="ml-auto">
              <a
                href={`/api/email/contacts/export?listId=${encodeURIComponent(listId)}&botId=${encodeURIComponent(id)}`}
                download
              >
                <Button variant="outline" size="sm">
                  <ArrowLeft className="h-3 w-3 mr-1 rotate-[270deg]" />
                  Export CSV
                </Button>
              </a>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add single contact */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Contact
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form action={addContact} className="flex gap-3 items-end flex-wrap">
            <input type="hidden" name="botId" value={id} />
            <input type="hidden" name="listId" value={listId} />
            <div>
              <Label htmlFor="email">Email</Label>
              <Input name="email" id="email" type="email" placeholder="contact@example.com" required />
            </div>
            <div>
              <Label htmlFor="firstName">First Name</Label>
              <Input name="firstName" id="firstName" placeholder="John" />
            </div>
            <div>
              <Label htmlFor="lastName">Last Name</Label>
              <Input name="lastName" id="lastName" placeholder="Doe" />
            </div>
            <Button type="submit">Add</Button>
          </form>
        </CardContent>
      </Card>

      {/* CSV Import */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Import from CSV
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form action={importContacts} className="space-y-3">
            <input type="hidden" name="botId" value={id} />
            <input type="hidden" name="listId" value={listId} />
            <div>
              <Label htmlFor="csvData">Paste CSV data (email, firstName, lastName)</Label>
              <textarea
                name="csvData"
                id="csvData"
                rows={5}
                className="w-full mt-1 rounded-md border bg-background px-3 py-2 text-sm font-mono"
                placeholder={"email,firstName,lastName\njohn@example.com,John,Doe\njane@example.com,Jane,Smith"}
              />
              <p className="text-xs text-muted-foreground mt-1">
                One contact per line. Format: email,firstName,lastName. Header row is optional.
              </p>
            </div>
            <Button type="submit" variant="outline">
              <Upload className="h-3 w-3 mr-1" />
              Import
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Contact list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contacts ({totalCount})</CardTitle>
        </CardHeader>
        <CardContent>
          {contacts.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              No contacts yet. Add manually or import from CSV.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium">Email</th>
                    <th className="pb-2 font-medium">Name</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Opens</th>
                    <th className="pb-2 font-medium">Clicks</th>
                    <th className="pb-2 font-medium">Added</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((contact) => {
                    const cs = CONTACT_STATUS_CONFIG[contact.status] || { variant: 'secondary' as const, label: contact.status };
                    return (
                      <tr key={contact.id} className="border-b last:border-0">
                        <td className="py-2">{contact.email}</td>
                        <td className="py-2 text-muted-foreground">
                          {[contact.firstName, contact.lastName].filter(Boolean).join(' ') || '-'}
                        </td>
                        <td className="py-2">
                          <Badge variant={cs.variant}>{cs.label}</Badge>
                        </td>
                        <td className="py-2 text-muted-foreground">{contact.openCount}</td>
                        <td className="py-2 text-muted-foreground">{contact.clickCount}</td>
                        <td className="py-2 text-muted-foreground">
                          {new Date(contact.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-2">
                          <form action={deleteContact}>
                            <input type="hidden" name="botId" value={id} />
                            <input type="hidden" name="listId" value={listId} />
                            <input type="hidden" name="contactId" value={contact.id} />
                            <Button variant="ghost" size="sm" className="text-red-600 h-7 w-7 p-0">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </form>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              {page > 1 && (
                <Link href={`/dashboard/bots/${id}/email/contacts/${listId}?page=${page - 1}`}>
                  <Button variant="outline" size="sm">Previous</Button>
                </Link>
              )}
              <span className="px-3 py-1 text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              {page < totalPages && (
                <Link href={`/dashboard/bots/${id}/email/contacts/${listId}?page=${page + 1}`}>
                  <Button variant="outline" size="sm">Next</Button>
                </Link>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
