import { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { encrypt } from '@/lib/encryption';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Globe, Plus, Trash2 } from 'lucide-react';

export const metadata: Metadata = { title: 'Bot Platforms', robots: { index: false } };

const platformConfigs: Record<string, { name: string; fields: { key: string; label: string; placeholder: string }[] }> = {
  MASTODON: {
    name: 'Mastodon',
    fields: [
      { key: 'instanceUrl', label: 'Instance URL', placeholder: 'https://mastodon.social' },
      { key: 'accessToken', label: 'Access Token', placeholder: 'Your Mastodon access token' },
    ],
  },
  FACEBOOK: {
    name: 'Facebook',
    fields: [
      { key: 'pageId', label: 'Page ID', placeholder: 'Your Facebook Page ID' },
      { key: 'accessToken', label: 'Page Access Token', placeholder: 'Your permanent page access token' },
    ],
  },
  TELEGRAM: {
    name: 'Telegram',
    fields: [
      { key: 'botToken', label: 'Bot Token', placeholder: 'Your Telegram bot token from @BotFather' },
      { key: 'channelId', label: 'Channel ID (optional)', placeholder: '@yourchannel or -100...' },
    ],
  },
  DISCORD: {
    name: 'Discord',
    fields: [
      { key: 'botToken', label: 'Bot Token', placeholder: 'Your Discord bot token' },
      { key: 'channelId', label: 'Channel ID', placeholder: 'Target channel ID' },
    ],
  },
  BLUESKY: {
    name: 'Bluesky',
    fields: [
      { key: 'handle', label: 'Handle', placeholder: 'you.bsky.social' },
      { key: 'appPassword', label: 'App Password', placeholder: 'Your Bluesky app password' },
    ],
  },
};

export default async function BotPlatformsPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const user = await requireAuth();
  const { id } = await params;
  const sp = await searchParams;

  const bot = await db.bot.findFirst({
    where: { id, userId: user.id },
    include: { platformConns: true },
  });
  if (!bot) notFound();

  async function handleAddPlatform(formData: FormData) {
    'use server';

    const currentUser = await requireAuth();
    const currentBot = await db.bot.findFirst({ where: { id, userId: currentUser.id } });
    if (!currentBot) redirect('/dashboard/bots');

    const platform = formData.get('platform') as string;
    const config = platformConfigs[platform];
    if (!config) {
      redirect(`/dashboard/bots/${id}/platforms?error=Invalid platform`);
    }

    const credentials: Record<string, string> = {};
    for (const field of config.fields) {
      const value = formData.get(field.key) as string;
      if (value) credentials[field.key] = value;
    }

    if (Object.keys(credentials).length === 0) {
      redirect(`/dashboard/bots/${id}/platforms?error=Please fill in the credentials`);
    }

    const encrypted: Record<string, string> = {};
    for (const [key, value] of Object.entries(credentials)) {
      encrypted[key] = encrypt(value);
    }

    try {
      await db.platformConnection.upsert({
        where: { botId_platform: { botId: id, platform: platform as any } },
        create: {
          botId: id,
          platform: platform as any,
          encryptedCredentials: encrypted,
          status: 'CONNECTED',
        },
        update: {
          encryptedCredentials: encrypted,
          status: 'CONNECTED',
        },
      });
    } catch (e: any) {
      redirect(`/dashboard/bots/${id}/platforms?error=${encodeURIComponent(e.message)}`);
    }

    redirect(`/dashboard/bots/${id}/platforms?success=Platform connected`);
  }

  const connectedPlatforms = new Set(bot.platformConns.map((p) => p.platform));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{bot.name} - Platforms</h1>
        <div className="flex gap-4 mt-4 border-b pb-2">
          <Link href={`/dashboard/bots/${id}`} className="text-sm text-muted-foreground hover:text-foreground pb-2">Overview</Link>
          <Link href={`/dashboard/bots/${id}/activity`} className="text-sm text-muted-foreground hover:text-foreground pb-2">Activity</Link>
          <Link href={`/dashboard/bots/${id}/platforms`} className="text-sm font-medium border-b-2 border-primary pb-2">Platforms</Link>
          <Link href={`/dashboard/bots/${id}/settings`} className="text-sm text-muted-foreground hover:text-foreground pb-2">Settings</Link>
        </div>
      </div>

      {sp.error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">{sp.error}</div>
      )}
      {sp.success && (
        <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-800">{sp.success}</div>
      )}

      {/* Connected Platforms */}
      {bot.platformConns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Connected Platforms</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {bot.platformConns.map((conn) => (
              <div key={conn.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div className="flex items-center gap-3">
                  <Globe className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">{platformConfigs[conn.platform]?.name || conn.platform}</span>
                  <Badge variant={conn.status === 'CONNECTED' ? 'success' : 'destructive'}>{conn.status}</Badge>
                </div>
                <span className="text-xs text-muted-foreground">{conn.postsToday} posts today</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Add Platform */}
      <Card>
        <CardHeader>
          <CardTitle>Add Platform</CardTitle>
          <CardDescription>Connect a social media platform to your bot.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            {Object.entries(platformConfigs).map(([key, config]) => (
              <Card key={key} className={connectedPlatforms.has(key as any) ? 'border-green-200 bg-green-50/50' : ''}>
                <form action={handleAddPlatform}>
                  <input type="hidden" name="platform" value={key} />
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{config.name}</CardTitle>
                      {connectedPlatforms.has(key as any) && <Badge variant="success">Connected</Badge>}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {config.fields.map((field) => (
                      <div key={field.key} className="space-y-1">
                        <Label className="text-xs">{field.label}</Label>
                        <Input name={field.key} type="password" placeholder={field.placeholder} className="text-sm" />
                      </div>
                    ))}
                    <Button type="submit" size="sm" variant={connectedPlatforms.has(key as any) ? 'outline' : 'default'} className="w-full">
                      {connectedPlatforms.has(key as any) ? 'Update' : 'Connect'}
                    </Button>
                  </CardContent>
                </form>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
