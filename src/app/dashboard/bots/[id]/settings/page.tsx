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
import { Rss, Clock, Shield, Brain, Trash2 } from 'lucide-react';

export const metadata: Metadata = { title: 'Bot Settings', robots: { index: false } };

const SCHEDULE_PRESETS = [
  { value: '', label: 'Custom' },
  { value: '0 */1 * * *', label: 'Every hour' },
  { value: '0 */2 * * *', label: 'Every 2 hours' },
  { value: '0 */3 * * *', label: 'Every 3 hours' },
  { value: '0 */4 * * *', label: 'Every 4 hours' },
  { value: '0 */6 * * *', label: 'Every 6 hours' },
  { value: '0 */8 * * *', label: 'Every 8 hours' },
  { value: '0 */12 * * *', label: 'Every 12 hours' },
  { value: '0 9 * * *', label: 'Once daily (9 AM)' },
  { value: '0 9,18 * * *', label: 'Twice daily (9 AM, 6 PM)' },
  { value: '0 9,13,18 * * *', label: '3x daily (9 AM, 1 PM, 6 PM)' },
];

const TIMEZONES = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Prague', 'Europe/Bratislava',
  'Europe/Helsinki', 'Europe/Moscow', 'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Singapore',
  'Australia/Sydney', 'Pacific/Auckland',
];

const CONTENT_TYPES = [
  { value: 'educational', label: 'Educational Posts', desc: 'Tips, tutorials, how-tos' },
  { value: 'promotional', label: 'Promotional', desc: 'Product features, offers' },
  { value: 'engagement', label: 'Engagement', desc: 'Questions, polls, discussions' },
  { value: 'news', label: 'News & Updates', desc: 'Industry news, trending topics' },
  { value: 'curated', label: 'Curated Content', desc: 'Shared articles, RSS feeds' },
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

  async function handleUpdate(formData: FormData) {
    'use server';

    const currentUser = await requireAuth();
    const currentBot = await db.bot.findFirst({ where: { id, userId: currentUser.id } });
    if (!currentBot) redirect('/dashboard/bots');

    // Parse RSS feeds (newline-separated)
    const feedsRaw = (formData.get('rssFeeds') as string) || '';
    const feeds = feedsRaw
      .split('\n')
      .map((f) => f.trim())
      .filter((f) => f.length > 0 && (f.startsWith('http://') || f.startsWith('https://')));

    // Parse content types
    const selectedTypes = CONTENT_TYPES
      .map((ct) => ct.value)
      .filter((v) => formData.get(`ct_${v}`) === 'on');

    // Parse reactor config
    const currentReactor = (currentBot.reactorState as Record<string, unknown>) || {};

    await db.bot.update({
      where: { id },
      data: {
        name: (formData.get('name') as string) || currentBot.name,
        brandName: (formData.get('brandName') as string) || currentBot.brandName,
        description: formData.get('description') as string,
        instructions: (formData.get('instructions') as string) || currentBot.instructions,
        brandKnowledge: formData.get('brandKnowledge') as string,
        safetyLevel: (formData.get('safetyLevel') as 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE') || currentBot.safetyLevel,
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
        <div className="flex gap-4 mt-4 border-b pb-2">
          <Link href={`/dashboard/bots/${id}`} className="text-sm text-muted-foreground hover:text-foreground pb-2">Overview</Link>
          <Link href={`/dashboard/bots/${id}/activity`} className="text-sm text-muted-foreground hover:text-foreground pb-2">Activity</Link>
          <Link href={`/dashboard/bots/${id}/platforms`} className="text-sm text-muted-foreground hover:text-foreground pb-2">Platforms</Link>
          <Link href={`/dashboard/bots/${id}/analytics`} className="text-sm text-muted-foreground hover:text-foreground pb-2">Analytics</Link>
          <Link href={`/dashboard/bots/${id}/settings`} className="text-sm font-medium border-b-2 border-primary pb-2">Settings</Link>
        </div>
      </div>

      {sp.success && (
        <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-800">{sp.success}</div>
      )}
      {sp.error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">{sp.error}</div>
      )}

      {/* Bot Status Control */}
      <Card>
        <CardHeader>
          <CardTitle>Bot Status</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <div>
            <span className="font-medium">Current status: </span>
            <Badge variant={bot.status === 'ACTIVE' ? 'success' : 'secondary'}>{bot.status}</Badge>
          </div>
          <form action={handleToggleStatus}>
            <Button variant={bot.status === 'ACTIVE' ? 'outline' : 'default'} size="sm">
              {bot.status === 'ACTIVE' ? 'Pause Bot' : 'Activate Bot'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <form action={handleUpdate}>
        {/* Core Bot Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Bot Configuration</CardTitle>
            <CardDescription>Basic identity and behavior of your bot</CardDescription>
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
              <Input name="description" defaultValue={bot.description || ''} placeholder="Short description of your bot" />
            </div>

            <div className="space-y-2">
              <Label>Instructions</Label>
              <p className="text-xs text-muted-foreground">Tell the bot how to write content. Include tone, style, topics to focus on, and any rules.</p>
              <textarea
                name="instructions"
                defaultValue={bot.instructions}
                className="flex min-h-[150px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div className="space-y-2">
              <Label>Brand Knowledge</Label>
              <p className="text-xs text-muted-foreground">Information about your brand, products, services, FAQs. The bot uses this to stay on-brand.</p>
              <textarea
                name="brandKnowledge"
                defaultValue={bot.brandKnowledge || ''}
                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </CardContent>
        </Card>

        {/* Scheduling & Limits */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" /> Scheduling & Limits</CardTitle>
            <CardDescription>Control when and how often your bot posts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Posting Schedule</Label>
                <select
                  name="postingSchedule"
                  defaultValue={bot.postingSchedule || ''}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {SCHEDULE_PRESETS.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">How often the bot creates new posts</p>
              </div>
              <div className="space-y-2">
                <Label>Timezone</Label>
                <select
                  name="timezone"
                  defaultValue={bot.timezone}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Safety Level</Label>
                <select
                  name="safetyLevel"
                  defaultValue={bot.safetyLevel}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="CONSERVATIVE">Conservative - Safe, minimal risk</option>
                  <option value="MODERATE">Moderate - Balanced approach</option>
                  <option value="AGGRESSIVE">Aggressive - Maximum reach</option>
                </select>
              </div>
            </div>

            <Separator />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Max Posts / Day</Label>
                <Input
                  name="maxPostsPerDay"
                  type="number"
                  min={1}
                  max={50}
                  defaultValue={maxPostsPerDay}
                />
                <p className="text-xs text-muted-foreground">Maximum new posts per day (1-50)</p>
              </div>
              <div className="space-y-2">
                <Label>Max Replies / Day</Label>
                <Input
                  name="maxRepliesPerDay"
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={maxRepliesPerDay}
                />
                <p className="text-xs text-muted-foreground">Maximum replies/interactions per day (0-100)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Content Strategy */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Brain className="h-5 w-5" /> Content Strategy</CardTitle>
            <CardDescription>Choose content types and enable self-learning</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="mb-3 block">Content Types to Generate</Label>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {CONTENT_TYPES.map((ct) => (
                  <label key={ct.value} className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50">
                    <input
                      type="checkbox"
                      name={`ct_${ct.value}`}
                      defaultChecked={contentTypes.includes(ct.value)}
                      className="mt-0.5 h-4 w-4 rounded border-input"
                    />
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
              <input
                type="checkbox"
                name="selfLearning"
                defaultChecked={selfLearning}
                className="mt-0.5 h-4 w-4 rounded border-input"
              />
              <div>
                <p className="text-sm font-medium">Content Reactor - Self-Learning AI</p>
                <p className="text-xs text-muted-foreground">
                  Bot automatically learns from engagement metrics (likes, comments, shares) and adapts its content
                  strategy over time. Uses reinforcement learning to optimize what works best on each platform.
                </p>
              </div>
            </label>
          </CardContent>
        </Card>

        {/* RSS Feeds */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Rss className="h-5 w-5" /> RSS Feed Sources</CardTitle>
            <CardDescription>Add RSS feeds for content inspiration and curation. One URL per line.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <textarea
              name="rssFeeds"
              defaultValue={rssFeeds.join('\n')}
              placeholder={"https://blog.example.com/feed\nhttps://news.example.com/rss"}
              className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <p className="text-xs text-muted-foreground">
              {rssFeeds.length} feed{rssFeeds.length !== 1 ? 's' : ''} configured (max 20).
              The bot scans these for trending topics and content ideas.
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
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Delete this bot</p>
              <p className="text-sm text-muted-foreground">Permanently delete this bot and all its data. This cannot be undone.</p>
            </div>
            <form action={handleDelete}>
              <Button variant="destructive" size="sm">Delete Bot</Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
