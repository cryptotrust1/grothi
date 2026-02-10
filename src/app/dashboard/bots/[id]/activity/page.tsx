import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const metadata: Metadata = { title: 'Bot Activity', robots: { index: false } };

const platformNames: Record<string, string> = {
  MASTODON: 'Mastodon', FACEBOOK: 'Facebook', TELEGRAM: 'Telegram',
  MOLTBOOK: 'Moltbook', DISCORD: 'Discord', TWITTER: 'Twitter',
  BLUESKY: 'Bluesky', REDDIT: 'Reddit', DEVTO: 'Dev.to',
};

export default async function BotActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth();
  const { id } = await params;

  const bot = await db.bot.findFirst({ where: { id, userId: user.id } });
  if (!bot) notFound();

  const activities = await db.botActivity.findMany({
    where: { botId: bot.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{bot.name} - Activity</h1>
        <div className="flex gap-4 mt-4 border-b pb-2">
          <Link href={`/dashboard/bots/${bot.id}`} className="text-sm text-muted-foreground hover:text-foreground pb-2">Overview</Link>
          <Link href={`/dashboard/bots/${bot.id}/activity`} className="text-sm font-medium border-b-2 border-primary pb-2">Activity</Link>
          <Link href={`/dashboard/bots/${bot.id}/platforms`} className="text-sm text-muted-foreground hover:text-foreground pb-2">Platforms</Link>
          <Link href={`/dashboard/bots/${bot.id}/settings`} className="text-sm text-muted-foreground hover:text-foreground pb-2">Settings</Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Activity Log</CardTitle>
        </CardHeader>
        <CardContent>
          {activities.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No activity yet.</p>
          ) : (
            <div className="space-y-3">
              {activities.map((a) => (
                <div key={a.id} className="flex items-start gap-4 py-3 border-b last:border-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline">{a.action}</Badge>
                      <span className="text-xs text-muted-foreground">{platformNames[a.platform] || a.platform}</span>
                      {a.contentType && <span className="text-xs text-muted-foreground">({a.contentType})</span>}
                    </div>
                    {a.content && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{a.content}</p>}
                    {a.error && <p className="text-sm text-destructive mt-1">{a.error}</p>}
                    {(a.likes !== null || a.comments !== null) && (
                      <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                        {a.likes !== null && <span>{a.likes} likes</span>}
                        {a.comments !== null && <span>{a.comments} comments</span>}
                        {a.shares !== null && <span>{a.shares} shares</span>}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {a.success ? (
                      <Badge variant="success" className="text-xs">OK</Badge>
                    ) : (
                      <Badge variant="destructive" className="text-xs">Failed</Badge>
                    )}
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(a.createdAt).toLocaleDateString()} {new Date(a.createdAt).toLocaleTimeString()}
                    </span>
                    {a.creditsUsed > 0 && (
                      <span className="text-xs text-muted-foreground">-{a.creditsUsed} credits</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
