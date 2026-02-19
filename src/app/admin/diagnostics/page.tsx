import { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { DiagnosticsClient } from './client';

export const metadata: Metadata = { title: 'Admin - Instagram Diagnostics', robots: { index: false } };

export default async function DiagnosticsPage() {
  await requireAdmin();

  // Get all bots that have Instagram connections
  const bots = await db.bot.findMany({
    where: {
      platformConns: {
        some: { platform: 'INSTAGRAM' },
      },
    },
    include: {
      user: { select: { email: true, name: true } },
      platformConns: {
        where: { platform: 'INSTAGRAM' },
        select: { status: true, config: true, updatedAt: true },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const botOptions = bots.map((bot) => ({
    id: bot.id,
    name: bot.name,
    brandName: bot.brandName || '',
    userEmail: bot.user.email,
    igStatus: bot.platformConns[0]?.status || 'NONE',
    igUsername: (bot.platformConns[0]?.config as Record<string, unknown>)?.username as string || 'unknown',
    igUpdatedAt: bot.platformConns[0]?.updatedAt?.toISOString() || '',
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Instagram Diagnostics</h1>
        <p className="text-muted-foreground mt-1">
          Run comprehensive diagnostics on Instagram connections to debug publishing issues.
        </p>
      </div>
      <DiagnosticsClient bots={botOptions} />
    </div>
  );
}
