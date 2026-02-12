import { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Rss, Clock, Brain, Trash2, Target, Key, BarChart3, Link2 } from 'lucide-react';
import { BotNav } from '@/components/dashboard/bot-nav';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { HelpTip } from '@/components/ui/help-tip';
import { SCHEDULE_PRESETS, TIMEZONES, CONTENT_TYPES } from '@/lib/constants';

export const metadata: Metadata = { title: 'Bot Settings', robots: { index: false } };

const GOALS = [
  { value: 'TRAFFIC', label: 'Drive Traffic' },
  { value: 'SALES', label: 'Increase Sales' },
  { value: 'ENGAGEMENT', label: 'Boost Engagement' },
  { value: 'BRAND_AWARENESS', label: 'Brand Awareness' },
  { value: 'LEADS', label: 'Generate Leads' },
  { value: 'COMMUNITY', label: 'Build Community' },
];

export default async function BotSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const user = await requireAuth();
  const { id } = await params;
  const sp = await searchParams;

  const bot = await db.bot.findFirst({ where: { id, userId: user.id } });
  if (!bot) notFound();

  const rssFeeds = Array.isArray(bot.rssFeeds) ? (bot.rssFeeds as string[]) : [];
  const reactorState = (bot.reactorState as Record<string, unknown>) || {};
  const contentTypes = (reactorState.contentTypes as string[]) || ['educational', 'engagement'];
  const selfLearning = (reactorState.selfLearning as boolean) ?? true;
  const maxPostsPerDay = (reactorState.maxPostsPerDay as number) || 10;
  const maxRepliesPerDay = (reactorState.maxRepliesPerDay as number) || 20;
  const keywords = Array.isArray(bot.keywords) ? (bot.keywords as string[]) : [];

  async function handleUpdate(formData: FormData) {
    'use server';

    const currentUser = await requireAuth();
    const currentBot = await db.bot.findFirst({ where: { id, userId: currentUser.id } });
    if (!currentBot) redirect('/dashboard/bots');

    const feedsRaw = (formData.get('rssFeeds') as string) || '';
    const feeds = feedsRaw
      .split('\n')
      .map((f) => f.trim())
      .filter((f) => f.length > 0 && (f.startsWith('http://') || f.startsWith('https://')));

    const selectedTypes = CONTENT_TYPES
      .map((ct) => ct.value)
      .filter((v) => formData.get(`ct_${v}`) === 'on');

    const currentReactor = (currentBot.reactorState as Record<string, unknown>) || {};

    const keywordsRaw = (formData.get('keywords') as string) || '';
    const keywordsArr = keywordsRaw
      .split(',')
      .map((k) => k.trim().toLowerCase())
      .filter((k) => k.length > 0)
      .slice(0, 50);

    await db.bot.update({
      where: { id },
      data: {
        name: (formData.get('name') as string) || currentBot.name,
        brandName: (formData.get('brandName') as string) || currentBot.brandName,
        description: formData.get('description') as string,
        instructions: (formData.get('instructions') as string) || currentBot.instructions,
        brandKnowledge: formData.get('brandKnowledge') as string,
        safetyLevel: (formData.get('safetyLevel') as 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE') || currentBot.safetyLevel,
        goal: (formData.get('goal') as any) || currentBot.goal,
        targetUrl: (formData.get('targetUrl') as string) || null,
        keywords: keywordsArr.length > 0 ? keywordsArr : [],
        utmSource: (formData.get('utmSource') as string) || 'grothi',
        utmMedium: (formData.get('utmMedium') as string) || 'social',
        gaPropertyId: (formData.get('gaPropertyId') as string) || null,
        postingSchedule: formData.get('postingSchedule') as string,
        timezone: (formData.get('timezone') as string) || 'UTC',
        rssFeeds: feeds,
        reactorState: {
          ...currentReactor,
          contentTypes: selectedTypes.length > 0 ? selectedTypes : ['educational'],
          selfLearning: formData.get('selfLearning') === 'on',
          maxPostsPerDay: parseInt(formData.get('maxPostsPerDay') as string) || 10,
          maxRepliesPerDay: parseInt(formData.get('maxRepliesPerDay') as string) || 20,
        },
      },
    });

    redirect(`/dashboard/bots/${id}/settings?success=Settings saved`);
  }

  async function handleToggleStatus() {
    'use server';
    const currentUser = await requireAuth();
    const currentBot = await db.bot.findFirst({ where: { id, userId: currentUser.id } });
    if (!currentBot) redirect('/dashboard/bots');
    const newStatus = currentBot.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    await db.bot.update({ where: { id }, data: { status: newStatus } });
    redirect(`/dashboard/bots/${id}/settings?success=Bot ${newStatus.toLowerCase()}`);
  }

  async function handleDelete() {
    'use server';
    const currentUser = await requireAuth();
    await db.bot.delete({ where: { id } });
    redirect('/dashboard/bots');
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{bot.name} - Settings</h1>
        <BotNav botId={id} activeTab="settings" />
      </div>

      {sp.success && <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-800">{sp.success}</div>}
      {sp.error && <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">{sp.error}</div>}

      {/* Bot Status */}
      <Card>
        <CardHeader>
          <CardTitle>Bot Status</CardTitle>
          <CardDescription>Pause or activate the bot to control automated actions</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <div>
            <span className="font-medium">Current status: </span>
            <Badge variant={bot.status === 'ACTIVE' ? 'success' : 'secondary'}>{bot.status}</Badge>
          </div>
          <ConfirmDialog
            title={bot.status === 'ACTIVE' ? 'Pause Bot' : 'Activate Bot'}
            description={bot.status === 'ACTIVE'
              ? 'Pausing the bot will stop all automated posting, replies, and engagement actions. You can reactivate it at any time.'
              : 'Activating the bot will resume automated posting, replies, and engagement actions based on your configured schedule.'}
            confirmLabel={bot.status === 'ACTIVE' ? 'Pause Bot' : 'Activate Bot'}
            variant={bot.status === 'ACTIVE' ? 'destructive' : 'default'}
            formAction={handleToggleStatus}
            trigger={
              <Button variant={bot.status === 'ACTIVE' ? 'outline' : 'default'} size="sm">
                {bot.status === 'ACTIVE' ? 'Pause Bot' : 'Activate Bot'}
              </Button>
            }
          />
        </CardContent>
      </Card>

      <form action={handleUpdate}>
        {/* Core Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Bot Configuration</CardTitle>
            <CardDescription>Basic identity and behavior</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Bot Name</Label>
                <Input name="name" defaultValue={bot.name} />
              </div>
              <div className="space-y-2">
                <Label>Brand Name</Label>
                <Input name="brandName" defaultValue={bot.brandName} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input name="description" defaultValue={bot.description || ''} placeholder="Short description" />
            </div>
            <div className="space-y-2">
              <Label>Instructions</Label>
              <p className="text-xs text-muted-foreground">Tell the bot how to write. Include tone, style, topics, and rules.</p>
              <textarea name="instructions" defaultValue={bot.instructions} className="flex min-h-[150px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </div>
            <div className="space-y-2">
              <Label>Brand Knowledge</Label>
              <p className="text-xs text-muted-foreground">Facts about your brand. The bot uses this to stay on-brand.</p>
              <textarea name="brandKnowledge" defaultValue={bot.brandKnowledge || ''} className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </div>
          </CardContent>
        </Card>

        {/* Goal & Keywords */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5" /> Goal & Keywords</CardTitle>
            <CardDescription>Define what the bot optimizes for and target keywords</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Primary Goal</Label>
              <select name="goal" defaultValue={bot.goal} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                {GOALS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
              </select>
              <p className="text-xs text-muted-foreground">The bot adapts its content strategy based on this goal.</p>
            </div>
            <div className="space-y-2">
              <Label>Target Website URL</Label>
              <Input name="targetUrl" type="url" defaultValue={bot.targetUrl || ''} placeholder="https://your-website.com" />
              <p className="text-xs text-muted-foreground">The bot auto-generates UTM tracking links pointing to this URL.</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Key className="h-4 w-4" />
                <Label>Keywords</Label>
              </div>
              <Input name="keywords" defaultValue={keywords.join(', ')} placeholder="crypto, exchange, bitcoin, trading" />
              <p className="text-xs text-muted-foreground">Comma-separated. Used for content optimization, hashtag generation, and SEO (max 50).</p>
            </div>

            <Separator />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Label>UTM Source</Label>
                  <HelpTip text="Identifies the traffic source in Google Analytics. Typically set to your tool name (e.g. 'grothi'). Appears as ?utm_source= in all links the bot shares." />
                </div>
                <Input name="utmSource" defaultValue={bot.utmSource || 'grothi'} placeholder="grothi" />
                <p className="text-xs text-muted-foreground">Appears as utm_source in tracking links</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Label>UTM Medium</Label>
                  <HelpTip text="Identifies the marketing medium in Google Analytics. Typically 'social' for social media posts. Appears as ?utm_medium= in all links the bot shares." />
                </div>
                <Input name="utmMedium" defaultValue={bot.utmMedium || 'social'} placeholder="social" />
                <p className="text-xs text-muted-foreground">Appears as utm_medium in tracking links</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Google Analytics */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" /> Google Analytics Integration</CardTitle>
            <CardDescription>Connect your GA4 property to track bot-driven traffic and optimize strategy</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Label>GA4 Measurement ID</Label>
                <HelpTip text="Found in Google Analytics under Admin > Data Streams. Starts with 'G-' followed by alphanumeric characters. Enables the bot to learn which content drives the most conversions." />
              </div>
              <Input name="gaPropertyId" defaultValue={bot.gaPropertyId || ''} placeholder="G-XXXXXXXXXX" />
              <p className="text-xs text-muted-foreground">
                Your Google Analytics 4 Measurement ID. The bot uses this data to learn which content drives the most traffic and conversions to your site.
              </p>
            </div>
            <div className="rounded-lg bg-muted/50 p-4 text-sm space-y-2">
              <p className="font-medium">How it works:</p>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                <li>Every link the bot shares includes UTM parameters for tracking</li>
                <li>Example: <code className="bg-background px-1 rounded">?utm_source={bot.utmSource || 'grothi'}&utm_medium=social&utm_campaign={bot.name.toLowerCase().replace(/\s+/g, '-')}</code></li>
                <li>The Content Reactor uses analytics data to optimize content strategy</li>
                <li>Track which posts drive the most traffic, conversions, and revenue</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Scheduling & Limits */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" /> Scheduling & Limits</CardTitle>
            <CardDescription>Control posting frequency and safety</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Posting Schedule</Label>
                <select name="postingSchedule" defaultValue={bot.postingSchedule || ''} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  {SCHEDULE_PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Timezone</Label>
                <select name="timezone" defaultValue={bot.timezone} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Label>Safety Level</Label>
                  <HelpTip text="Controls how aggressively the bot engages. Conservative avoids risky content and limits frequency. Moderate balances reach with safety. Aggressive maximizes visibility but may trigger spam filters on some platforms." />
                </div>
                <select name="safetyLevel" defaultValue={bot.safetyLevel} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="CONSERVATIVE">Conservative - Safe</option>
                  <option value="MODERATE">Moderate - Balanced</option>
                  <option value="AGGRESSIVE">Aggressive - Max reach</option>
                </select>
              </div>
            </div>
            <Separator />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Label>Max Posts / Day</Label>
                  <HelpTip text="The maximum number of new posts the bot can create per day across all connected platforms. Higher values consume more credits. Recommended: 5-15 for most use cases." />
                </div>
                <Input name="maxPostsPerDay" type="number" min={1} max={50} defaultValue={maxPostsPerDay} />
              </div>
              <div className="space-y-2">
                <Label>Max Replies / Day</Label>
                <Input name="maxRepliesPerDay" type="number" min={0} max={100} defaultValue={maxRepliesPerDay} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Content Strategy */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Brain className="h-5 w-5" /> Content Strategy</CardTitle>
            <CardDescription>Choose content types and enable AI self-learning</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="mb-3 block">Content Types to Generate</Label>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {CONTENT_TYPES.map((ct) => (
                  <label key={ct.value} className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50">
                    <input type="checkbox" name={`ct_${ct.value}`} defaultChecked={contentTypes.includes(ct.value)} className="mt-0.5 h-4 w-4 rounded border-input" />
                    <div>
                      <p className="text-sm font-medium">{ct.label}</p>
                      <p className="text-xs text-muted-foreground">{ct.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <Separator />
            <label className="flex items-start gap-3 rounded-lg border p-4 cursor-pointer hover:bg-muted/50">
              <input type="checkbox" name="selfLearning" defaultChecked={selfLearning} className="mt-0.5 h-4 w-4 rounded border-input" />
              <div>
                <p className="text-sm font-medium flex items-center gap-1.5">Content Reactor - Self-Learning AI <HelpTip text="When enabled, the bot uses reinforcement learning to continuously improve its content strategy. It analyzes engagement metrics from each post and automatically adjusts timing, tone, hashtags, and content types to maximize performance on each platform." /></p>
                <p className="text-xs text-muted-foreground">
                  Uses reinforcement learning (epsilon-greedy exploration) to optimize content. Learns from engagement
                  metrics: likes (1pt), comments (3pt), shares (5pt). Adapts posting times, content types, hashtags,
                  and tone per platform. Algorithm knowledge: avoids spam triggers, optimizes for each platform&apos;s
                  ranking signals (dwell time on LinkedIn, watch time on TikTok, saves on Instagram).
                </p>
              </div>
            </label>
          </CardContent>
        </Card>

        {/* RSS Feeds */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Rss className="h-5 w-5" /> RSS Feed Sources</CardTitle>
            <CardDescription>Content inspiration and curation. One URL per line (max 20).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <textarea
              name="rssFeeds"
              defaultValue={rssFeeds.join('\n')}
              placeholder={"https://blog.example.com/feed\nhttps://news.example.com/rss"}
              className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <p className="text-xs text-muted-foreground">
              {rssFeeds.length} feed{rssFeeds.length !== 1 ? 's' : ''} configured.
              Bot scans for trending topics and curates relevant content.
            </p>
          </CardContent>
        </Card>

        <div className="mt-6">
          <Button type="submit" size="lg">Save All Settings</Button>
        </div>
      </form>

      {/* Danger Zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2"><Trash2 className="h-5 w-5" /> Danger Zone</CardTitle>
          <CardDescription>Irreversible actions that permanently affect your bot</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Delete this bot</p>
              <p className="text-sm text-muted-foreground">Permanently delete this bot and all its data.</p>
            </div>
            <ConfirmDialog
              title="Delete Bot"
              description="This will permanently delete this bot and all its data including platform connections, activity history, media, and scheduled posts. This action cannot be undone."
              confirmLabel="Delete Bot"
              variant="destructive"
              formAction={handleDelete}
              trigger={<Button variant="destructive" size="sm">Delete Bot</Button>}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
