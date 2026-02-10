import { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Mail, ArrowLeft } from 'lucide-react';

export const metadata: Metadata = { title: 'Admin - Contact Messages', robots: { index: false } };

export default async function AdminContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;

  const messages = await db.contactMessage.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  const unread = messages.filter((m) => !m.read).length;

  async function handleMarkRead(formData: FormData) {
    'use server';
    await requireAdmin();
    const msgId = formData.get('id') as string;
    await db.contactMessage.update({ where: { id: msgId }, data: { read: true } });
    redirect('/admin/contacts?success=Marked as read');
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Contact Messages</h1>
          <p className="text-sm text-muted-foreground">{unread} unread of {messages.length} total</p>
        </div>
        <Link href="/admin/users">
          <Button variant="outline" size="sm"><ArrowLeft className="mr-2 h-4 w-4" /> Admin</Button>
        </Link>
      </div>

      {sp.success && (
        <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-800">{sp.success}</div>
      )}

      {messages.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
            No contact messages yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {messages.map((msg) => (
            <Card key={msg.id} className={msg.read ? 'opacity-60' : ''}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{msg.name}</span>
                      <span className="text-sm text-muted-foreground">&lt;{msg.email}&gt;</span>
                      {!msg.read && <Badge variant="default" className="text-xs">New</Badge>}
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {new Date(msg.createdAt).toLocaleString()}
                    </p>
                  </div>
                  {!msg.read && (
                    <form action={handleMarkRead}>
                      <input type="hidden" name="id" value={msg.id} />
                      <Button variant="outline" size="sm">Mark Read</Button>
                    </form>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
