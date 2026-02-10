import { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const metadata: Metadata = { title: 'Admin - Bots', robots: { index: false } };

const statusVariant: Record<string, 'success' | 'warning' | 'destructive' | 'secondary'> = {
  ACTIVE: 'success', PAUSED: 'secondary', STOPPED: 'secondary', ERROR: 'destructive', NO_CREDITS: 'warning',
};

export default async function AdminBotsPage() {
  await requireAdmin();

  const bots = await db.bot.findMany({
    include: {
      user: { select: { email: true, name: true } },
      platformConns: { select: { platform: true, status: true } },
      _count: { select: { activities: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">All Bots ({bots.length})</h1>

      <Card>
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 font-medium">Bot Name</th>
                  <th className="text-left py-2 font-medium">Brand</th>
                  <th className="text-left py-2 font-medium">Owner</th>
                  <th className="text-left py-2 font-medium">Status</th>
                  <th className="text-left py-2 font-medium">Safety</th>
                  <th className="text-right py-2 font-medium">Platforms</th>
                  <th className="text-right py-2 font-medium">Actions</th>
                  <th className="text-right py-2 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {bots.map((bot) => (
                  <tr key={bot.id} className="border-b last:border-0">
                    <td className="py-3 font-medium">{bot.name}</td>
                    <td className="py-3">{bot.brandName}</td>
                    <td className="py-3 text-muted-foreground">{bot.user.email}</td>
                    <td className="py-3">
                      <Badge variant={statusVariant[bot.status] || 'secondary'}>{bot.status}</Badge>
                    </td>
                    <td className="py-3">
                      <Badge variant="outline">{bot.safetyLevel}</Badge>
                    </td>
                    <td className="text-right py-3">{bot.platformConns.length}</td>
                    <td className="text-right py-3">{bot._count.activities}</td>
                    <td className="text-right py-3 text-muted-foreground">
                      {new Date(bot.createdAt).toLocaleDateString()}
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
