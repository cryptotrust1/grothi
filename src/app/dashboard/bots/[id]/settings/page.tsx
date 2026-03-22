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
import { Rss, Clock, Trash2, Target, Key, ArrowRight, Brain, Zap, AlertTriangle } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { HelpTip } from '@/components/ui/help-tip';
import { AlertMessage } from '@/components/ui/alert-message';
import { BotGoal } from '@prisma/client';
import { TIMEZONES, GOAL_OPTIONS, SAFETY_LEVEL_OPTIONS, RSS_ADAPTATION_MODES, RSS_FRESHNESS_OPTIONS, POST_LANGUAGES } from '@/lib/constants';
import { parseKeywords } from '@/lib/utils';
import { DEFAULT_RSS_SETTINGS, type RssIntelligenceSettings } from '@/lib/rss-intelligence';

export const metadata: Metadata = { title: 'Bot Settings', robots: { index: false } };

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
  const maxPostsPerDay = (reactorState.maxPostsPerDay as number) || 10;
  const keywords = Array.isArray(bot.keywords) ? (bot.keywords as string[]) : [];

  // Global post language
  const postLanguage = (reactorState.postLanguage as string) || 'en';

  // RSS Intelligence settings
  const rssIntelligence = (reactorState.rssIntelligence as Record<string, unknown>) || {};
  const rssAdaptationMode = (rssIntelligence.adaptationMode as string) || DEFAULT_RSS_SETTINGS.adaptationMode;
  const rssFreshnessWindow = (rssIntelligence.freshnessHoursWindow as number) || DEFAULT_RSS_SETTINGS.freshnessHoursWindow;
  const rssMaxArticles = (rssIntelligence.maxArticlesPerFeed as number) || DEFAULT_RSS_SETTINGS.maxArticlesPerFeed;
  const rssExtractTopics = typeof rssIntelligence.extractTopics === 'boolean' ? rssIntelligence.extractTopics : DEFAULT_RSS_SETTINGS.extractTopics;
  const rssLearnInsights = typeof rssIntelligence.learnAudienceInsights === 'boolean' ? rssIntelligence.learnAudienceInsights : DEFAULT_RSS_SETTINGS.learnAudienceInsights;
  const rssSignificantKeywords = Array.isArray(rssIntelligence.significantEventKeywords)
    ? (rssIntelligence.significantEventKeywords as string[]).join(', ')
    : '';

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

    const currentReactor = (currentBot.reactorState as Record<string, unknown>) || {};

    // Parse RSS Intelligence settings
    const validModes = ['always', 'sometimes', 'significant_only', 'never'];
    const rawRssMode = formData.get('rssAdaptationMode') as string;
    const rssMode = validModes.includes(rawRssMode) ? rawRssMode : 'sometimes';

    const rawFreshness = parseInt(formData.get('rssFreshnessWindow') as string, 10);
    const rssFreshness = isNaN(rawFreshness) ? 48 : Math.max(1, Math.min(168, rawFreshness));

    const rawMaxArt = parseInt(formData.get('rssMaxArticles') as string, 10);
    const rssMaxArt = isNaN(rawMaxArt) ? 5 : Math.max(1, Math.min(20, rawMaxArt));

    const rssExtract = formData.get('rssExtractTopics') === 'on';
    const rssLearn = formData.get('rssLearnInsights') === 'on';

    const sigKeywordsRaw = (formData.get('rssSignificantKeywords') as string) || '';
    const sigKeywords = sigKeywordsRaw
      .split(',')
      .map(k => k.trim())
      .filter(k => k.length > 0)
      .slice(0, 50);

    const rssIntelligenceData = {
      adaptationMode: rssMode,
      maxArticlesPerFeed: rssMaxArt,
      freshnessHoursWindow: rssFreshness,
      extractTopics: rssExtract,
      learnAudienceInsights: rssLearn,
      significantEventKeywords: sigKeywords,
    };

    // Parse language setting
    const validLanguages = POST_LANGUAGES.map(l => l.value) as string[];
    const rawLang = formData.get('postLanguage') as string;
    const postLang = validLanguages.includes(rawLang) ? rawLang : 'en';

    const keywordsArr = parseKeywords((formData.get('keywords') as string) || '');

    // Validate enum fields server-side using constants
    const validSafetyLevels = SAFETY_LEVEL_OPTIONS.map(s => s.value) as string[];
    const validGoals = GOAL_OPTIONS.map(g => g.value) as string[];

    const rawSafety = formData.get('safetyLevel') as string;
    const safetyLevel = validSafetyLevels.includes(rawSafety) ? rawSafety : currentBot.safetyLevel;

    const rawGoal = formData.get('goal') as string;
    const goal = validGoals.includes(rawGoal) ? rawGoal : currentBot.goal;

    const rawTimezone = (formData.get('timezone') as string) || 'UTC';
    const timezone = TIMEZONES.includes(rawTimezone) ? rawTimezone : 'UTC';

    // Validate integer bounds
    const rawMaxPosts = parseInt(formData.get('maxPostsPerDay') as string, 10);
    const maxPostsPerDay = isNaN(rawMaxPosts) ? 10 : Math.max(1, Math.min(50, rawMaxPosts));

    await db.bot.update({
      where: { id },
      data: {
        name: (formData.get('name') as string) || currentBot.name,
        brandName: (formData.get('brandName') as string) || currentBot.brandName,
        description: formData.get('description') as string,
        instructions: ((formData.get('instructions') as string) || currentBot.instructions).slice(0, 5000),
        brandKnowledge: formData.get('brandKnowledge') as string,
        safetyLevel: safetyLevel as 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE',
        goal: goal as BotGoal,
        targetUrl: (formData.get('targetUrl') as string) || null,
        keywords: keywordsArr.length > 0 ? keywordsArr : [],
        utmSource: (formData.get('utmSource') as string) || 'grothi',
        utmMedium: (formData.get('utmMedium') as string) || 'social',
        timezone,
        rssFeeds: feeds,
        reactorState: {
          ...currentReactor,
          maxPostsPerDay,
          postLanguage: postLang,
          rssIntelligence: rssIntelligenceData,
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
    const ownedBot = await db.bot.findFirst({ where: { id, userId: currentUser.id } });
    if (!ownedBot) redirect('/dashboard/bots?error=' + encodeURIComponent('Bot not found'));

    // Clean up media files from disk before DB cascade deletes records
    try {
      const { join } = await import('path');
      const { rm } = await import('fs/promises');
      const uploadDir = join(process.cwd(), 'data', 'uploads', id);
      await rm(uploadDir, { recursive: true, force: true });
    } catch {
      // Best effort — files may not exist
    }

    await db.bot.delete({ where: { id } });
    redirect('/dashboard/bots');
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{bot.name} - Settings</h1>
      </div>

      {sp.success && <AlertMessage type="success" message={sp.success} />}
      {sp.error && <AlertMessage type="error" message={sp.error} />}

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
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Description</Label>
                <Input name="description" defaultValue={bot.description || ''} placeholder="Short description" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Label>Post Language</Label>
                  <HelpTip text="All posts generated by this bot will be written in this language. This applies globally to all platforms, autopilot content, and AI suggestions." />
                </div>
                <select name="postLanguage" defaultValue={postLanguage} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  {POST_LANGUAGES.map((lang) => <option key={lang.value} value={lang.value}>{lang.label}</option>)}
                </select>
              </div>
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
                {GOAL_OPTIONS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
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

        {/* Scheduling & Limits */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" /> Scheduling & Limits</CardTitle>
            <CardDescription>Control posting frequency and safety</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
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
                  {SAFETY_LEVEL_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Label>Max Posts / Day</Label>
                  <HelpTip text="The maximum number of new posts the bot can create per day across all connected platforms. Higher values consume more credits. Recommended: 5-15 for most use cases." />
                </div>
                <Input name="maxPostsPerDay" type="number" min={1} max={50} defaultValue={maxPostsPerDay} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Content Strategy Link */}
        <Card className="mt-6 bg-muted/30">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Content Strategy & AI Learning</p>
                <p className="text-xs text-muted-foreground">Content types, tones, hashtags, per-platform plans, and self-learning settings are managed in the dedicated Content Strategy page.</p>
              </div>
              <Link href={`/dashboard/bots/${id}/strategy`}>
                <Button variant="outline" size="sm" className="gap-1.5">
                  Content Strategy <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* RSS Feed Intelligence */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Rss className="h-5 w-5" /> RSS Feed Intelligence</CardTitle>
            <CardDescription>AI-powered content intelligence from industry feeds. The bot reads these feeds before generating posts to keep content current, relevant, and trend-aware.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Feed URLs</Label>
              <textarea
                name="rssFeeds"
                defaultValue={rssFeeds.join('\n')}
                placeholder={"https://blog.example.com/feed\nhttps://news.example.com/rss\nhttps://industry-news.com/rss.xml"}
                className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <p className="text-xs text-muted-foreground">
                {rssFeeds.length} feed{rssFeeds.length !== 1 ? 's' : ''} configured. One URL per line (max 20).
              </p>
            </div>

            <Separator />

            {/* AI Content Adaptation Mode */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-purple-600" />
                <Label>Content Adaptation Mode</Label>
                <HelpTip text="Controls how the AI uses RSS feed content when generating posts. 'Always' means every post references current trends. 'Sometimes' creates a natural mix. 'Significant Events Only' watches for major news matching your keywords." />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {RSS_ADAPTATION_MODES.map((mode) => (
                  <label key={mode.value} className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                    <input
                      type="radio"
                      name="rssAdaptationMode"
                      value={mode.value}
                      defaultChecked={rssAdaptationMode === mode.value}
                      className="mt-0.5 h-4 w-4"
                    />
                    <div>
                      <p className="text-sm font-medium">{mode.label}</p>
                      <p className="text-xs text-muted-foreground">{mode.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <Separator />

            {/* Significant Event Keywords */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <Label>Significant Event Keywords</Label>
                <HelpTip text="Comma-separated keywords that trigger 'significant event' detection. When the AI finds these in RSS articles, it will always incorporate the event into posts. Useful for product launches, market crashes, regulatory changes, etc." />
              </div>
              <Input
                name="rssSignificantKeywords"
                defaultValue={rssSignificantKeywords}
                placeholder="launch, breaking, partnership, regulation, acquisition, hack, outage"
              />
              <p className="text-xs text-muted-foreground">
                Comma-separated. When these keywords appear in RSS articles, the AI treats it as a significant event.
              </p>
            </div>

            {/* Advanced RSS Settings */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label className="text-xs">Freshness Window</Label>
                <select
                  name="rssFreshnessWindow"
                  defaultValue={rssFreshnessWindow}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                >
                  {RSS_FRESHNESS_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">How far back to look for articles</p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Articles Per Feed</Label>
                <Input
                  name="rssMaxArticles"
                  type="number"
                  min={1}
                  max={20}
                  defaultValue={rssMaxArticles}
                />
                <p className="text-xs text-muted-foreground">Max articles to analyze (1-20)</p>
              </div>
              <div className="space-y-2 self-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="rssExtractTopics"
                    defaultChecked={rssExtractTopics}
                    className="h-4 w-4 rounded"
                  />
                  <span className="text-xs">Extract trending topics</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="rssLearnInsights"
                    defaultChecked={rssLearnInsights}
                    className="h-4 w-4 rounded"
                  />
                  <span className="text-xs">Learn audience insights</span>
                </label>
              </div>
            </div>

            {/* How RSS Intelligence Works */}
            <div className="rounded-lg bg-purple-50/50 border border-purple-200 p-4 text-sm space-y-2">
              <p className="font-medium flex items-center gap-1.5 text-purple-900"><Zap className="h-4 w-4" /> How RSS Intelligence works</p>
              <ul className="text-xs text-purple-700 space-y-1 list-disc list-inside">
                <li>Before each post, the AI reads your RSS feeds for current news and trends</li>
                <li>Posts stay current by referencing real events, not just generic content</li>
                <li>The AI learns about your industry topics, audience pain points, and market dynamics</li>
                <li>Significant event detection ensures major news is never missed</li>
                <li>Topic extraction identifies what your audience is discussing right now</li>
              </ul>
            </div>
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
