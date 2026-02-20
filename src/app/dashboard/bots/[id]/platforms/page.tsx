import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { encrypt } from '@/lib/encryption';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Globe, Info, ExternalLink, CheckCircle2, AlertCircle } from 'lucide-react';
import { BotNav } from '@/components/dashboard/bot-nav';
import { HelpTip } from '@/components/ui/help-tip';
import { SubmitButton } from '@/components/dashboard/platform-form-client';

export const metadata: Metadata = { title: 'Bot Platforms', robots: { index: false } };

const platformConfigs: Record<string, {
  name: string;
  category: 'social' | 'blog' | 'messaging' | 'decentralized';
  fields: { key: string; label: string; placeholder: string; optional?: boolean; helpText?: string }[];
  algTip: string;
  docsUrl?: string;
  oauthSupported?: boolean;
}> = {
  FACEBOOK: {
    name: 'Facebook',
    category: 'social',
    oauthSupported: true,
    fields: [
      { key: 'pageId', label: 'Page ID', placeholder: 'Your Facebook Page ID', helpText: 'Found in your Facebook Page\'s About section or Page Settings under "Page ID".' },
      { key: 'accessToken', label: 'Page Access Token', placeholder: 'Permanent page access token', helpText: 'A long-lived token generated via the Meta Graph API Explorer with pages_manage_posts permission.' },
    ],
    algTip: 'Links in post body reduce reach 70-80%. Bot puts links in first comment.',
    docsUrl: 'https://developers.facebook.com/docs/pages-api/getting-started',
  },
  INSTAGRAM: {
    name: 'Instagram',
    category: 'social',
    oauthSupported: true,
    fields: [
      { key: 'accountId', label: 'Business Account ID', placeholder: 'Instagram Business Account ID', helpText: 'Your Instagram Business or Creator account ID from the Meta Business Suite.' },
      { key: 'accessToken', label: 'Access Token', placeholder: 'Meta Graph API access token', helpText: 'Generated via the Meta Graph API Explorer with instagram_basic and instagram_content_publish permissions.' },
    ],
    algTip: 'Reels get 2-3x more reach than static posts. Carousels have highest saves.',
    docsUrl: 'https://developers.facebook.com/docs/instagram-platform/getting-started',
  },
  TWITTER: {
    name: 'X (Twitter)',
    category: 'social',
    oauthSupported: true,
    fields: [
      { key: 'apiKey', label: 'API Key', placeholder: 'Consumer API key', helpText: 'The API Key (Consumer Key) from your X Developer Portal app settings.' },
      { key: 'apiSecret', label: 'API Secret', placeholder: 'Consumer API secret', helpText: 'The API Secret (Consumer Secret) paired with your API Key.' },
      { key: 'accessToken', label: 'Access Token', placeholder: 'OAuth access token', helpText: 'OAuth 1.0a access token generated under "Keys and Tokens" in your app.' },
      { key: 'accessSecret', label: 'Access Secret', placeholder: 'OAuth access token secret', helpText: 'The secret paired with your OAuth access token.' },
    ],
    algTip: 'Replies and quote tweets drive more impressions than standalone posts.',
    docsUrl: 'https://developer.x.com/en/docs/authentication/oauth-2-0/authorization-code',
  },
  LINKEDIN: {
    name: 'LinkedIn',
    category: 'social',
    oauthSupported: true,
    fields: [
      { key: 'accessToken', label: 'Access Token', placeholder: 'OAuth2 access token', helpText: 'OAuth 2.0 token with w_member_social permission from the LinkedIn Developer Portal.' },
      { key: 'orgId', label: 'Organization ID', placeholder: 'Company page ID (optional)', optional: true, helpText: 'Your LinkedIn Company Page ID. Leave blank to post as your personal profile.' },
    ],
    algTip: 'Text-only posts outperform links. Dwell time boosts reach significantly.',
    docsUrl: 'https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow',
  },
  TIKTOK: {
    name: 'TikTok',
    category: 'social',
    oauthSupported: true,
    fields: [
      { key: 'accessToken', label: 'Creator Access Token', placeholder: 'TikTok Creator API token', helpText: 'Access token from the TikTok Developer Portal with video.publish scope.' },
    ],
    algTip: 'Watch time is the #1 ranking factor. First 3 seconds determine performance.',
    docsUrl: 'https://developers.tiktok.com/doc/content-posting-api-get-started',
  },
  MASTODON: {
    name: 'Mastodon',
    category: 'decentralized',
    fields: [
      { key: 'instanceUrl', label: 'Instance URL', placeholder: 'https://mastodon.social', helpText: 'The full URL of your Mastodon instance (e.g., https://mastodon.social).' },
      { key: 'accessToken', label: 'Access Token', placeholder: 'Your Mastodon access token', helpText: 'Create an application in Preferences > Development on your instance to get this token.' },
    ],
    algTip: 'No algorithm - chronological feed. Boosts are key for reach.',
    docsUrl: 'https://docs.joinmastodon.org/client/token/',
  },
  BLUESKY: {
    name: 'Bluesky',
    category: 'decentralized',
    fields: [
      { key: 'handle', label: 'Handle', placeholder: 'you.bsky.social', helpText: 'Your Bluesky handle, e.g., yourname.bsky.social.' },
      { key: 'appPassword', label: 'App Password', placeholder: 'Your Bluesky app password', helpText: 'Generate an App Password in Bluesky Settings > App Passwords. Do not use your main password.' },
    ],
    algTip: 'Custom feed generators can amplify reach. Engage with existing communities.',
    docsUrl: 'https://atproto.com/guides/applications',
  },
  TELEGRAM: {
    name: 'Telegram',
    category: 'messaging',
    fields: [
      { key: 'botToken', label: 'Bot Token', placeholder: 'Token from @BotFather', helpText: 'Create a bot via @BotFather on Telegram and copy the HTTP API token.' },
      { key: 'channelId', label: 'Channel ID', placeholder: '@yourchannel or -100...', optional: true, helpText: 'Your channel username (e.g., @yourchannel) or numeric ID. Add the bot as admin first.' },
    ],
    algTip: 'Rich media (photos, videos) get 2x more engagement than text-only.',
    docsUrl: 'https://core.telegram.org/bots#botfather',
  },
  DISCORD: {
    name: 'Discord',
    category: 'messaging',
    fields: [
      { key: 'botToken', label: 'Bot Token', placeholder: 'Your Discord bot token', helpText: 'Bot token from the Discord Developer Portal > Your App > Bot section.' },
      { key: 'channelId', label: 'Channel ID', placeholder: 'Target channel ID', helpText: 'Right-click a channel with Developer Mode enabled and select "Copy Channel ID".' },
    ],
    algTip: 'Embeds with images perform better. Use threads for longer discussions.',
    docsUrl: 'https://discord.com/developers/docs/getting-started',
  },
  THREADS: {
    name: 'Threads',
    category: 'social',
    oauthSupported: true,
    fields: [
      { key: 'accessToken', label: 'Access Token', placeholder: 'Threads API access token', helpText: 'Access token from the Meta Developer Portal with threads_basic and threads_content_publish permissions.' },
    ],
    algTip: 'Conversation starters and hot takes drive replies. Cross-post from Instagram.',
    docsUrl: 'https://developers.facebook.com/docs/threads/',
  },
  PINTEREST: {
    name: 'Pinterest',
    category: 'social',
    oauthSupported: true,
    fields: [
      { key: 'accessToken', label: 'Access Token', placeholder: 'Pinterest API access token', helpText: 'OAuth token from the Pinterest Developer Portal with pins:read and pins:write scopes.' },
      { key: 'boardId', label: 'Board ID', placeholder: 'Target board ID', optional: true, helpText: 'The board to pin to. Find it in the board URL. Leave blank for the default board.' },
    ],
    algTip: 'Vertical images (2:3) perform best. Keywords in description are critical for SEO.',
    docsUrl: 'https://developers.pinterest.com/docs/getting-started/set-up-authentication-and-authorization/',
  },
  REDDIT: {
    name: 'Reddit',
    category: 'social',
    fields: [
      { key: 'clientId', label: 'Client ID', placeholder: 'Reddit app client ID', helpText: 'Create a "script" app at reddit.com/prefs/apps to get this ID.' },
      { key: 'clientSecret', label: 'Client Secret', placeholder: 'Reddit app secret', helpText: 'The secret shown when you create your Reddit app.' },
      { key: 'username', label: 'Username', placeholder: 'Reddit username', helpText: 'Your Reddit account username (without the u/ prefix).' },
      { key: 'password', label: 'Password', placeholder: 'Reddit password', helpText: 'Your Reddit account password. Required for script-type OAuth apps.' },
    ],
    algTip: 'Self-promotion >10% triggers spam filters. Provide genuine value first.',
    docsUrl: 'https://www.reddit.com/wiki/api/',
  },
  MEDIUM: {
    name: 'Medium',
    category: 'blog',
    fields: [
      { key: 'integrationToken', label: 'Integration Token', placeholder: 'Medium integration token', helpText: 'Go to Medium Settings > Security and Applications > Integration Tokens to generate one.' },
    ],
    algTip: 'Long-form articles (7-10min read) perform best. Tags are crucial.',
    docsUrl: 'https://github.com/Medium/medium-api-docs',
  },
  DEVTO: {
    name: 'Dev.to',
    category: 'blog',
    fields: [
      { key: 'apiKey', label: 'API Key', placeholder: 'Dev.to API key', helpText: 'Generate an API key in your Dev.to Settings > Extensions > DEV Community API Keys.' },
    ],
    algTip: 'Technical tutorials and "how I built" posts drive highest engagement.',
    docsUrl: 'https://developers.forem.com/api',
  },
  YOUTUBE: {
    name: 'YouTube',
    category: 'social',
    oauthSupported: true,
    fields: [
      { key: 'refreshToken', label: 'Refresh Token', placeholder: 'OAuth2 refresh token', helpText: 'OAuth 2.0 refresh token from Google Cloud Console with YouTube Data API v3 enabled.' },
      { key: 'channelId', label: 'Channel ID', placeholder: 'Your YouTube channel ID', helpText: 'Found in YouTube Studio > Settings > Channel > Advanced settings, starts with "UC".' },
    ],
    algTip: 'Community posts boost visibility. Shorts algorithm favors watch completion.',
    docsUrl: 'https://developers.google.com/youtube/v3/guides/auth/server-side-web-apps',
  },
  NOSTR: {
    name: 'Nostr',
    category: 'decentralized',
    fields: [
      { key: 'privateKey', label: 'Private Key (nsec)', placeholder: 'Your Nostr nsec key', helpText: 'Your Nostr private key in nsec format. Never share this publicly.' },
      { key: 'relays', label: 'Relays (comma-separated)', placeholder: 'wss://relay.damus.io,wss://nos.lol', optional: true, helpText: 'Comma-separated list of relay WebSocket URLs your notes will be published to.' },
    ],
    algTip: 'Decentralized, no algorithm. Relay selection affects who sees your notes.',
    docsUrl: 'https://github.com/nostr-protocol/nips',
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

  // ── Server Actions ────────────────────────────────────────────────

  async function handleAddPlatform(formData: FormData) {
    'use server';

    console.log('[Platform Connect] Starting connection...');

    const currentUser = await requireAuth();
    console.log('[Platform Connect] User:', currentUser.id);

    const currentBot = await db.bot.findFirst({ where: { id, userId: currentUser.id } });
    if (!currentBot) {
      console.log('[Platform Connect] Bot not found or not owned by user');
      redirect('/dashboard/bots');
    }

    const platform = formData.get('platform') as string;
    console.log('[Platform Connect] Platform:', platform);
    const config = platformConfigs[platform];
    if (!config) {
      console.log('[Platform Connect] Invalid platform:', platform);
      redirect(`/dashboard/bots/${id}/platforms?error=Invalid platform`);
    }

    const credentials: Record<string, string> = {};
    const missingFields: string[] = [];

    for (const field of config.fields) {
      const raw = formData.get(field.key) as string;
      const value = raw?.trim() || '';

      if (!field.optional && !value) {
        missingFields.push(field.label);
      } else if (value) {
        credentials[field.key] = value;
      }
    }

    if (missingFields.length > 0) {
      console.log('[Platform Connect] Missing required fields:', missingFields);
      redirect(`/dashboard/bots/${id}/platforms?error=${encodeURIComponent(`Missing required fields: ${missingFields.join(', ')}`)}`);
    }

    if (Object.keys(credentials).length === 0) {
      console.log('[Platform Connect] No credentials provided');
      redirect(`/dashboard/bots/${id}/platforms?error=Please fill in at least one credential field`);
    }

    // Format validation
    for (const field of config.fields) {
      const value = credentials[field.key];
      if (!value) continue;

      if (field.key === 'instanceUrl' && !/^https?:\/\/.+\..+/.test(value)) {
        redirect(`/dashboard/bots/${id}/platforms?error=${encodeURIComponent(`${field.label} must be a valid URL (e.g. https://mastodon.social)`)}`);
      }
      if (field.key === 'channelId' && platform === 'DISCORD' && !/^\d{15,21}$/.test(value)) {
        redirect(`/dashboard/bots/${id}/platforms?error=${encodeURIComponent('Discord Channel ID must be a numeric ID (15-21 digits). Enable Developer Mode to copy it.')}`);
      }
      if (field.key === 'botToken' && platform === 'TELEGRAM' && !/^\d+:.+$/.test(value)) {
        redirect(`/dashboard/bots/${id}/platforms?error=${encodeURIComponent('Telegram Bot Token format is invalid. It should look like 123456:ABC-DEF...')}`);
      }
      if (field.key === 'relays' && platform === 'NOSTR') {
        const relays = value.split(',').map(r => r.trim()).filter(Boolean);
        const invalid = relays.find(r => !/^wss?:\/\/.+/.test(r));
        if (invalid) {
          redirect(`/dashboard/bots/${id}/platforms?error=${encodeURIComponent(`Invalid relay URL: ${invalid}. Relays must start with wss://`)}`);
        }
      }
      if (['accessToken', 'apiKey', 'apiSecret', 'accessSecret', 'clientSecret', 'integrationToken', 'refreshToken', 'appPassword', 'privateKey', 'botToken'].includes(field.key) && value.length < 10) {
        redirect(`/dashboard/bots/${id}/platforms?error=${encodeURIComponent(`${field.label} appears too short. Please check your credential.`)}`);
      }
    }

    console.log('[Platform Connect] Credentials validated, encrypting...');

    const encrypted: Record<string, string> = {};
    let errorMessage: string | null = null;

    try {
      for (const [key, value] of Object.entries(credentials)) {
        encrypted[key] = encrypt(value);
      }
    } catch (e) {
      console.error('[Platform Connect] Encryption failed:', e instanceof Error ? e.message : e);
      errorMessage = 'Encryption failed. Server configuration error — contact admin.';
    }

    if (errorMessage) {
      redirect(`/dashboard/bots/${id}/platforms?error=${encodeURIComponent(errorMessage)}`);
    }

    console.log('[Platform Connect] Encrypted, saving to database...');

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
          lastError: null,
        },
      });
    } catch (e) {
      console.error('[Platform Connect] Database error:', e instanceof Error ? e.message : e);
      errorMessage = 'Failed to save connection. Please try again.';
    }

    if (errorMessage) {
      redirect(`/dashboard/bots/${id}/platforms?error=${encodeURIComponent(errorMessage)}`);
    }

    console.log('[Platform Connect] Success:', config.name);
    redirect(`/dashboard/bots/${id}/platforms?success=${encodeURIComponent(config.name + ' connected successfully')}`);
  }

  async function handleDisconnect(formData: FormData) {
    'use server';

    console.log('[Platform Disconnect] Starting...');

    const currentUser = await requireAuth();
    console.log('[Platform Disconnect] User:', currentUser.id);

    const currentBot = await db.bot.findFirst({ where: { id, userId: currentUser.id } });
    if (!currentBot) {
      console.log('[Platform Disconnect] Bot not found');
      redirect('/dashboard/bots');
    }

    const platform = formData.get('platform') as string;
    console.log('[Platform Disconnect] Platform:', platform);
    const config = platformConfigs[platform];
    if (!config) {
      console.log('[Platform Disconnect] Invalid platform:', platform);
      redirect(`/dashboard/bots/${id}/platforms?error=Invalid platform`);
    }

    let errorMessage: string | null = null;
    try {
      await db.$transaction([
        db.platformConnection.delete({
          where: { botId_platform: { botId: id, platform: platform as any } },
        }),
        db.rLConfig.deleteMany({
          where: { botId: id, platform: platform as any },
        }),
        db.rLArmState.deleteMany({
          where: { botId: id, platform: platform as any },
        }),
      ]);
    } catch (e) {
      // If record not found, treat as already disconnected (success)
      const msg = e instanceof Error ? e.message : '';
      if (msg.includes('Record to delete does not exist') || msg.includes('RecordNotFound')) {
        console.log('[Platform Disconnect] Already disconnected:', platform);
      } else {
        console.error('[Platform Disconnect] Error:', msg || e);
        errorMessage = 'Failed to disconnect. Please try again.';
      }
    }

    if (errorMessage) {
      redirect(`/dashboard/bots/${id}/platforms?error=${encodeURIComponent(errorMessage)}`);
    }
    console.log('[Platform Disconnect] Success:', config.name);
    redirect(`/dashboard/bots/${id}/platforms?success=${encodeURIComponent(config.name + ' disconnected')}`);
  }

  // ── Data ──────────────────────────────────────────────────────────

  const connectedPlatforms = new Set(bot.platformConns.map((p) => p.platform));
  const connectedCount = bot.platformConns.filter(p => p.status === 'CONNECTED').length;
  const errorCount = bot.platformConns.filter(p => p.status === 'ERROR').length;

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{bot.name} - Platforms</h1>
        <p className="text-sm text-muted-foreground mt-1">Connect to 17 social networks. Each platform includes algorithm optimization tips.</p>
        <BotNav botId={id} activeTab="platforms" />
      </div>

      {/* Info banner */}
      <Card className="bg-blue-50/50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-sm space-y-2">
              <p className="font-medium text-blue-900">How platform connections work</p>
              <p className="text-blue-700"><strong>One-click OAuth</strong> &mdash; For major platforms (Facebook, Instagram, X, LinkedIn, TikTok, YouTube, Pinterest, Threads) just click &quot;Connect with ...&quot; and authorize access. No API keys needed.</p>
              <p className="text-blue-700"><strong>Manual credentials</strong> &mdash; For other platforms (Reddit, Telegram, Discord, Mastodon, etc.) enter your API keys or tokens. All credentials are encrypted with AES-256-GCM.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Status / error / success messages */}
      {sp.error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive flex items-start gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{sp.error}</span>
        </div>
      )}
      {sp.success && (
        <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-800 flex items-start gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{sp.success}</span>
        </div>
      )}

      {/* Quick status summary */}
      {bot.platformConns.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 text-sm">
            <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
            <span className="text-muted-foreground">{connectedCount} connected</span>
          </div>
          {errorCount > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
              <span className="text-muted-foreground">{errorCount} with errors</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm">
            <div className="h-2.5 w-2.5 rounded-full bg-gray-300" />
            <span className="text-muted-foreground">{17 - bot.platformConns.length} not connected</span>
          </div>
        </div>
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
                const conn = bot.platformConns.find((p) => p.platform === key);
                const connConfig = conn?.config && typeof conn.config === 'object' ? conn.config as Record<string, unknown> : null;
                const connectedViaOAuth = connConfig?.connectedVia === 'oauth';
                const oauthLabel = connectedViaOAuth
                  ? connConfig?.username ? `@${connConfig.username}`
                  : connConfig?.igUsername ? `@${connConfig.igUsername}`
                  : connConfig?.threadsUsername ? `@${connConfig.threadsUsername}`
                  : connConfig?.tiktokUsername ? `@${connConfig.tiktokUsername}`
                  : connConfig?.channelName ? `${connConfig.channelName}`
                  : connConfig?.profileName ? `${connConfig.profileName}`
                  : connConfig?.pageName ? `Page: ${connConfig.pageName}`
                  : connConfig?.displayName ? `${connConfig.displayName}`
                  : null
                  : null;

                return (
                  <Card key={key} className={isConnected ? 'border-green-300 bg-green-50/30' : ''}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{config.name}</CardTitle>
                        {isConnected && (
                          <Badge variant={conn?.status === 'ERROR' ? 'destructive' : 'success'} className="text-xs">
                            {conn?.status === 'ERROR' ? 'Error' : 'Connected'}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-blue-600 dark:text-blue-400">{config.algTip}</p>
                      {isConnected && oauthLabel && (
                        <p className="text-xs text-green-700">{oauthLabel}</p>
                      )}
                      {/* Enhanced Instagram account info */}
                      {isConnected && key === 'INSTAGRAM' && connConfig && (
                        <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                          {typeof connConfig.igName === 'string' && connConfig.igName && (
                            <p className="font-medium text-foreground">{connConfig.igName}</p>
                          )}
                          <p>
                            Type: {String(connConfig.accountType || 'unknown').replace('MEDIA_CREATOR', 'Creator').replace('BUSINESS', 'Business')}
                            {connConfig.igFollowers != null && ` · ${Number(connConfig.igFollowers).toLocaleString()} followers`}
                            {connConfig.igMediaCount != null && ` · ${Number(connConfig.igMediaCount).toLocaleString()} posts`}
                          </p>
                          {typeof connConfig.igBio === 'string' && connConfig.igBio && (
                            <p className="line-clamp-2 italic">{connConfig.igBio}</p>
                          )}
                        </div>
                      )}
                      {conn?.lastError && (
                        <p className="text-xs text-red-600 mt-1">Last error: {conn.lastError}</p>
                      )}
                      {conn?.updatedAt && (
                        <p className="text-xs text-muted-foreground">
                          {connectedViaOAuth ? 'Connected via OAuth' : 'Connected via API keys'} &middot; {new Date(conn.updatedAt).toLocaleDateString()}
                        </p>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-3">

                      {/* ── CONNECTED: show disconnect + update credentials ── */}
                      {isConnected && (
                        <>
                          {/* OAuth reconnect (if supported) */}
                          {config.oauthSupported && (
                            <a href={`/api/oauth/${key.toLowerCase()}?botId=${id}`}>
                              <Button type="button" size="sm" variant="outline" className="w-full">
                                Reconnect with {config.name}
                              </Button>
                            </a>
                          )}

                          {/* Update credentials - collapsible */}
                          <details className="text-xs">
                            <summary className="cursor-pointer text-muted-foreground hover:text-foreground font-medium py-1">
                              Update credentials
                            </summary>
                            <form action={handleAddPlatform} className="space-y-2 mt-2">
                              <input type="hidden" name="platform" value={key} />
                              {config.fields.map((field) => (
                                <div key={field.key} className="space-y-1">
                                  <div className="flex items-center gap-1">
                                    <Label className="text-xs">{field.label}{field.optional ? '' : ' *'}</Label>
                                    {field.helpText && <HelpTip text={field.helpText} side="right" />}
                                  </div>
                                  <Input
                                    name={field.key}
                                    type="password"
                                    autoComplete="off"
                                    placeholder={field.placeholder}
                                    required={!field.optional}
                                    minLength={field.optional ? undefined : 3}
                                    className="text-sm h-8"
                                  />
                                </div>
                              ))}
                              {config.docsUrl && (
                                <a href={config.docsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline mt-1">
                                  <ExternalLink className="h-3 w-3" /> How to get these credentials
                                </a>
                              )}
                              <SubmitButton variant="outline" className="w-full mt-1" pendingText="Saving...">
                                Save New Credentials
                              </SubmitButton>
                            </form>
                          </details>

                          {/* ── DISCONNECT ── plain HTML form, no JS dialog needed */}
                          <form action={handleDisconnect} className="pt-2 border-t">
                            <input type="hidden" name="platform" value={key} />
                            <SubmitButton variant="destructive" className="w-full" pendingText="Disconnecting...">
                              Disconnect {config.name}
                            </SubmitButton>
                          </form>
                        </>
                      )}

                      {/* ── NOT CONNECTED: show connect form ── */}
                      {!isConnected && (
                        <>
                          {/* OAuth one-click connect */}
                          {config.oauthSupported && (
                            <div className="space-y-2">
                              <a href={`/api/oauth/${key.toLowerCase()}?botId=${id}`}>
                                <Button type="button" size="sm" variant="default" className="w-full">
                                  Connect with {config.name}
                                </Button>
                              </a>
                              <p className="text-xs text-muted-foreground text-center">One-click — no API keys needed</p>
                              <details className="text-xs">
                                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                                  Or enter credentials manually
                                </summary>
                                <form action={handleAddPlatform} className="space-y-2 mt-2">
                                  <input type="hidden" name="platform" value={key} />
                                  {config.fields.map((field) => (
                                    <div key={field.key} className="space-y-1">
                                      <div className="flex items-center gap-1">
                                        <Label className="text-xs">{field.label}{field.optional ? '' : ' *'}</Label>
                                        {field.helpText && <HelpTip text={field.helpText} side="right" />}
                                      </div>
                                      <Input
                                        name={field.key}
                                        type="password"
                                        autoComplete="off"
                                        placeholder={field.placeholder}
                                        required={!field.optional}
                                        minLength={field.optional ? undefined : 3}
                                        className="text-sm h-8"
                                      />
                                    </div>
                                  ))}
                                  {config.docsUrl && (
                                    <a href={config.docsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline mt-1">
                                      <ExternalLink className="h-3 w-3" /> How to get these credentials
                                    </a>
                                  )}
                                  <SubmitButton variant="outline" className="w-full mt-1" pendingText="Connecting...">
                                    Save Manual Credentials
                                  </SubmitButton>
                                </form>
                              </details>
                            </div>
                          )}

                          {/* Manual-only platforms */}
                          {!config.oauthSupported && (
                            <form action={handleAddPlatform} className="space-y-2">
                              <input type="hidden" name="platform" value={key} />
                              {config.fields.map((field) => (
                                <div key={field.key} className="space-y-1">
                                  <div className="flex items-center gap-1">
                                    <Label className="text-xs">{field.label}{field.optional ? '' : ' *'}</Label>
                                    {field.helpText && <HelpTip text={field.helpText} side="right" />}
                                  </div>
                                  <Input
                                    name={field.key}
                                    type="password"
                                    autoComplete="off"
                                    placeholder={field.placeholder}
                                    required={!field.optional}
                                    minLength={field.optional ? undefined : 3}
                                    className="text-sm h-8"
                                  />
                                </div>
                              ))}
                              {config.docsUrl && (
                                <a href={config.docsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline mt-1">
                                  <ExternalLink className="h-3 w-3" /> How to get these credentials
                                </a>
                              )}
                              <SubmitButton variant="default" className="w-full mt-1" pendingText="Connecting...">
                                Connect
                              </SubmitButton>
                            </form>
                          )}
                        </>
                      )}

                    </CardContent>
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
