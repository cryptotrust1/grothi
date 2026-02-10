import { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { addCredits } from '@/lib/credits';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

export const metadata: Metadata = { title: 'Admin - Users', robots: { index: false } };

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;

  const users = await db.user.findMany({
    include: {
      creditBalance: true,
      _count: { select: { bots: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  async function handleAddBonus(formData: FormData) {
    'use server';

    await requireAdmin();
    const userId = formData.get('userId') as string;
    const credits = parseInt(formData.get('credits') as string, 10);

    if (!userId || isNaN(credits) || credits <= 0) {
      redirect('/admin/users?error=Invalid input');
    }

    await addCredits(userId, credits, 'BONUS', `Admin bonus: ${credits} credits`);
    redirect('/admin/users?success=Bonus credits added');
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Users ({users.length})</h1>

      {sp.success && (
        <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-800">{sp.success}</div>
      )}

      <Card>
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 font-medium">Name</th>
                  <th className="text-left py-2 font-medium">Email</th>
                  <th className="text-left py-2 font-medium">Role</th>
                  <th className="text-right py-2 font-medium">Credits</th>
                  <th className="text-right py-2 font-medium">Bots</th>
                  <th className="text-right py-2 font-medium">Joined</th>
                  <th className="text-right py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b last:border-0">
                    <td className="py-3">{u.name || '-'}</td>
                    <td className="py-3">{u.email}</td>
                    <td className="py-3">
                      <Badge variant={u.role === 'ADMIN' ? 'default' : 'secondary'}>{u.role}</Badge>
                    </td>
                    <td className="text-right py-3">{(u.creditBalance?.balance ?? 0).toLocaleString()}</td>
                    <td className="text-right py-3">{u._count.bots}</td>
                    <td className="text-right py-3 text-muted-foreground">{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td className="text-right py-3">
                      <form action={handleAddBonus} className="flex items-center gap-1 justify-end">
                        <input type="hidden" name="userId" value={u.id} />
                        <Input name="credits" type="number" placeholder="100" className="w-20 h-8 text-xs" />
                        <Button type="submit" size="sm" variant="outline" className="h-8 text-xs">+ Bonus</Button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
