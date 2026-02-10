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
import { Globe } from 'lucide-react';

export const metadata: Metadata = { title: 'Bot Platforms', robots: { index: false } };

const platformConfigs: Record<string, {
  name: string;
  category: 'social' | 'blog' | 'messaging' | 'decentralized';
  fields: { key: string; label: string; placeholder: string; optional?: boolean }[];
  algTip: string;
}> = {
  FACEBOOK: {
    name: 'Facebook',
    category: 'social',
    fields: [
      { key: 'pageId', label: 'Page ID', placeholder: 'Your Facebook Page ID' },
      { key: 'accessToken', label: 'Page Access Token', placeholder: 'Permanent page access token' },
    ],
    algTip: 'Links in post body reduce reach 70-80%. Bot puts links in first comment.',
  },
  INSTAGRAM: {
    name: 'Instagram',
    category: 'social',
    fields: [
      { key: 'accountId', label: 'Business Account ID', placeholder: 'Instagram Business Account ID' },
      { key: 'accessToken', label: 'Access Token', placeholder: 'Meta Graph API access token' },
    ],
    algTip: 'Reels get 2-3x more reach than static posts. Carousels have highest saves.',
  },
  TWITTER: {
    name: 'X (Twitter)',
    category: 'social',
    fields: [
      { key: 'apiKey', label: 'API Key', placeholder: 'Consumer API key' },
      { key: 'apiSecret', label: 'API Secret', placeholder: 'Consumer API secret' },
      { key: 'accessToken', label: 'Access Token', placeholder: 'OAuth access token' },
      { key: 'accessSecret', label: 'Access Secret', placeholder: 'OAuth access token secret' },
    ],
    algTip: 'Replies and quote tweets drive more impressions than standalone posts.',
  },
  LINKEDIN: {
    name: 'LinkedIn',
    category: 'social',
    fields: [
      { key: 'accessToken', label: 'Access Token', placeholder: 'OAuth2 access token' },
      { key: 'orgId', label: 'Organization ID', placeholder: 'Company page ID (optional)', optional: true },
    ],
    algTip: 'Text-only posts outperform links. Dwell time boosts reach significantly.',
  },
  TIKTOK: {
    name: 'TikTok',
    category: 'social',
    fields: [
      { key: 'accessToken', label: 'Creator Access Token', placeholder: 'TikTok Creator API token' },
    ],
    algTip: 'Watch time is the #1 ranking factor. First 3 seconds determine performance.',
  },
  MASTODON: {
    name: 'Mastodon',
    category: 'decentralized',
    fields: [
      { key: 'instanceUrl', label: 'Instance URL', placeholder: 'https://mastodon.social' },
      { key: 'accessToken', label: 'Access Token', placeholder: 'Your Mastodon access token' },
    ],
    algTip: 'No algorithm - chronological feed. Boosts are key for reach.',
  },
  BLUESKY: {
    name: 'Bluesky',
    category: 'decentralized',
    fields: [
      { key: 'handle', label: 'Handle', placeholder: 'you.bsky.social' },
      { key: 'appPassword', label: 'App Password', placeholder: 'Your Bluesky app password' },
    ],
    algTip: 'Custom feed generators can amplify reach. Engage with existing communities.',
  },
  TELEGRAM: {
    name: 'Telegram',
    category: 'messaging',
    fields: [
      { key: 'botToken', label: 'Bot Token', placeholder: 'Token from @BotFather' },
      { key: 'channelId', label: 'Channel ID', placeholder: '@yourchannel or -100...', optional: true },
    ],
    algTip: 'Rich media (photos, videos) get 2x more engagement than text-only.',
  },
  DISCORD: {
    name: 'Discord',
    category: 'messaging',
    fields: [
      { key: 'botToken', label: 'Bot Token', placeholder: 'Your Discord bot token' },
      { key: 'channelId', label: 'Channel ID', placeholder: 'Target channel ID' },
    ],
    algTip: 'Embeds with images perform better. Use threads for longer discussions.',
  },
  THREADS: {
    name: 'Threads',
    category: 'social',
    fields: [
      { key: 'accessToken', label: 'Access Token', placeholder: 'Threads API access token' },
    ],
    algTip: 'Conversation starters and hot takes drive replies. Cross-post from Instagram.',
  },
  PINTEREST: {
    name: 'Pinterest',
    category: 'social',
    fields: [
      { key: 'accessToken', label: 'Access Token', placeholder: 'Pinterest API access token' },
      { key: 'boardId', label: 'Board ID', placeholder: 'Target board ID', optional: true },
    ],
    algTip: 'Vertical images (2:3) perform best. Keywords in description are critical for SEO.',
  },
  REDDIT: {
    name: 'Reddit',
    category: 'social',
    fields: [
      { key: 'clientId', label: 'Client ID', placeholder: 'Reddit app client ID' },
      { key: 'clientSecret', label: 'Client Secret', placeholder: 'Reddit app secret' },
      { key: 'username', label: 'Username', placeholder: 'Reddit username' },
      { key: 'password', label: 'Password', placeholder: 'Reddit password' },
    ],
    algTip: 'Self-promotion >10% triggers spam filters. Provide genuine value first.',
  },
  MEDIUM: {
    name: 'Medium',
    category: 'blog',
    fields: [
      { key: 'integrationToken', label: 'Integration Token', placeholder: 'Medium integration token' },
    ],
    algTip: 'Long-form articles (7-10min read) perform best. Tags are crucial.',
  },
  DEVTO: {
    name: 'Dev.to',
    category: 'blog',
    fields: [
      { key: 'apiKey', label: 'API Key', placeholder: 'Dev.to API key' },
    ],
    algTip: 'Technical tutorials and "how I built" posts drive highest engagement.',
  },
  YOUTUBE: {
    name: 'YouTube',
    category: 'social',
    fields: [
      { key: 'refreshToken', label: 'Refresh Token', placeholder: 'OAuth2 refresh token' },
      { key: 'channelId', label: 'Channel ID', placeholder: 'Your YouTube channel ID' },
    ],
    algTip: 'Community posts boost visibility. Shorts algorithm favors watch completion.',
  },
  NOSTR: {
    name: 'Nostr',
    category: 'decentralized',
    fields: [
      { key: 'privateKey', label: 'Private Key (nsec)', placeholder: 'Your Nostr nsec key' },
      { key: 'relays', label: 'Relays (comma-separated)', placeholder: 'wss://relay.damus.io,wss://nos.lol', optional: true },
    ],
    algTip: 'Decentralized, no algorithm. Relay selection affects who sees your notes.',
  },
};

const categoryOrder = ['social', 'messaging', 'blog', 'decentralized'] as const;
const categoryLabels: Record<string, string> = {
  social: 'Social Media',
  messaging: 'Messaging & Chat',
  blog: 'Blogging Platforms',
  decentralized: 'Decentralized / Web3',
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

    redirect(`/dashboard/bots/${id}/platforms?success=${config.name} connected`);
  }

  const connectedPlatforms = new Set(bot.platformConns.map((p) => p.platform));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{bot.name} - Platforms</h1>
        <p className="text-sm text-muted-foreground mt-1">Connect to 17 social networks. Each platform includes algorithm optimization tips.</p>
        <div className="flex flex-wrap gap-4 mt-4 border-b pb-2">
          <Link href={`/dashboard/bots/${id}`} className="text-sm text-muted-foreground hover:text-foreground pb-2">Overview</Link>
          <Link href={`/dashboard/bots/${id}/activity`} className="text-sm text-muted-foreground hover:text-foreground pb-2">Activity</Link>
          <Link href={`/dashboard/bots/${id}/platforms`} className="text-sm font-medium border-b-2 border-primary pb-2">Platforms</Link>
          <Link href={`/dashboard/bots/${id}/analytics`} className="text-sm text-muted-foreground hover:text-foreground pb-2">Analytics</Link>
          <Link href={`/dashboard/bots/${id}/settings`} className="text-sm text-muted-foreground hover:text-foreground pb-2">Settings</Link>
        </div>
      </div>

      {sp.error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">{sp.error}</div>
      )}
      {sp.success && (
        <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-800">{sp.success}</div>
      )}

      {/* Connected Platforms Summary */}
      {bot.platformConns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Connected ({bot.platformConns.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {bot.platformConns.map((conn) => (
                <div key={conn.id} className="flex items-center gap-2 p-2 rounded-lg border">
                  <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium">{platformConfigs[conn.platform]?.name || conn.platform}</span>
                  <Badge variant={conn.status === 'CONNECTED' ? 'success' : conn.status === 'ERROR' ? 'destructive' : 'secondary'} className="text-xs ml-auto">
                    {conn.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Platforms by Category */}
      {categoryOrder.map((cat) => {
        const platforms = Object.entries(platformConfigs).filter(([, c]) => c.category === cat);
        if (platforms.length === 0) return null;

        return (
          <div key={cat}>
            <h2 className="text-lg font-semibold mb-3">{categoryLabels[cat]}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {platforms.map(([key, config]) => {
                const isConnected = connectedPlatforms.has(key as any);
                return (
                  <Card key={key} className={isConnected ? 'border-green-300 bg-green-50/30' : ''}>
                    <form action={handleAddPlatform}>
                      <input type="hidden" name="platform" value={key} />
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">{config.name}</CardTitle>
                          {isConnected && <Badge variant="success" className="text-xs">Connected</Badge>}
                        </div>
                        <p className="text-xs text-blue-600 dark:text-blue-400">{config.algTip}</p>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {config.fields.map((field) => (
                          <div key={field.key} className="space-y-1">
                            <Label className="text-xs">{field.label}{field.optional ? '' : ' *'}</Label>
                            <Input
                              name={field.key}
                              type="password"
                              placeholder={field.placeholder}
                              className="text-sm h-8"
                            />
                          </div>
                        ))}
                        <Button type="submit" size="sm" variant={isConnected ? 'outline' : 'default'} className="w-full mt-1">
                          {isConnected ? 'Update Credentials' : 'Connect'}
                        </Button>
                      </CardContent>
                    </form>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
