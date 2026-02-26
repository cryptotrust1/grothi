import { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Info, Lightbulb, FileText, ImageIcon, Film, Smartphone, CheckCircle2, AlertCircle, ExternalLink, Brain, Target } from 'lucide-react';
import { HelpTip } from '@/components/ui/help-tip';
import { PLATFORM_NAMES, TONE_STYLES, HASHTAG_PATTERNS, CONTENT_TYPES, VIDEO_STYLES, VIDEO_LENGTHS, VIDEO_FORMATS } from '@/lib/constants';
import { PLATFORM_DEFAULTS } from '@/lib/platform-defaults';

export const metadata: Metadata = { title: 'Content Strategy', robots: { index: false } };

export default async function ContentStrategyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const user = await requireAuth();
  const { id } = await params;
  const sp = await searchParams;

  const bot = await db.bot.findFirst({
    where: { id, userId: user.id },
    include: { platformConns: true, contentPlans: true },
  });
  if (!bot) notFound();

  const connectedPlatforms = bot.platformConns
    .filter(p => p.status === 'CONNECTED')
    .map(p => p.platform);

  // Build lookup of existing plans
  const plansByPlatform = new Map(
    bot.contentPlans.map(p => [p.platform, p])
  );

  // Global content strategy settings from reactorState
  const reactorState = (bot.reactorState as Record<string, unknown>) || {};
  const contentTypes = (reactorState.contentTypes as string[]) || ['educational', 'engagement'];
  const selfLearning = (reactorState.selfLearning as boolean) ?? true;
  const toneStyles = (reactorState.toneStyles as string[]) || ['professional', 'casual'];
  const hashtagPatterns = (reactorState.hashtagPatterns as string[]) || ['moderate'];

  // ── Server Actions ────────────────────────────────────────────

  async function handleSaveGlobalStrategy(formData: FormData) {
    'use server';

    const currentUser = await requireAuth();
    const currentBot = await db.bot.findFirst({ where: { id, userId: currentUser.id } });
    if (!currentBot) redirect('/dashboard/bots');

    const currentReactor = (currentBot.reactorState as Record<string, unknown>) || {};

    const selectedTypes = CONTENT_TYPES
      .map((ct) => ct.value)
      .filter((v) => formData.get(`ct_${v}`) === 'on');

    const selectedTones = TONE_STYLES
      .map((t) => t.value)
      .filter((v) => formData.get(`tone_${v}`) === 'on');

    const selectedHashtags = HASHTAG_PATTERNS
      .map((h) => h.value)
      .filter((v) => formData.get(`ht_${v}`) === 'on');

    await db.bot.update({
      where: { id },
      data: {
        reactorState: {
          ...currentReactor,
          contentTypes: selectedTypes.length > 0 ? selectedTypes : ['educational'],
          toneStyles: selectedTones.length > 0 ? selectedTones : ['professional'],
          hashtagPatterns: selectedHashtags.length > 0 ? selectedHashtags : ['moderate'],
          selfLearning: formData.get('selfLearning') === 'on',
        },
      },
    });

    redirect(`/dashboard/bots/${id}/strategy?success=Global content settings saved`);
  }

  async function handleSaveStrategy(formData: FormData) {
    'use server';

    const currentUser = await requireAuth();
    const currentBot = await db.bot.findFirst({
      where: { id, userId: currentUser.id },
      include: { platformConns: true },
    });
    if (!currentBot) redirect('/dashboard/bots');

    const connected = currentBot.platformConns
      .filter(p => p.status === 'CONNECTED')
      .map(p => p.platform);

    let errorMessage: string | null = null;

    try {
      for (const platform of connected) {
        const prefix = `${platform}_`;
        const enabled = formData.get(`${prefix}enabled`) === 'on';
        const dailyTexts = Math.max(0, Math.min(20, parseInt(formData.get(`${prefix}dailyTexts`) as string) || 0));
        const dailyImages = Math.max(0, Math.min(20, parseInt(formData.get(`${prefix}dailyImages`) as string) || 0));
        const dailyVideos = Math.max(0, Math.min(10, parseInt(formData.get(`${prefix}dailyVideos`) as string) || 0));
        const dailyStories = Math.max(0, Math.min(10, parseInt(formData.get(`${prefix}dailyStories`) as string) || 0));

        const videoStyleOverride = (formData.get(`${prefix}videoStyle`) as string) || null;
        const videoLength = (formData.get(`${prefix}videoLength`) as string) || null;
        const videoFormat = (formData.get(`${prefix}videoFormat`) as string) || null;

        // Per-platform multi-select overrides
        const selectedContentTypes = CONTENT_TYPES
          .map((ct) => ct.value)
          .filter((v) => formData.get(`${prefix}ct_${v}`) === 'on');

        const selectedTones = TONE_STYLES
          .map((t) => t.value)
          .filter((v) => formData.get(`${prefix}tone_${v}`) === 'on');

        const selectedHashtagPatterns = HASHTAG_PATTERNS
          .map((h) => h.value)
          .filter((v) => formData.get(`${prefix}ht_${v}`) === 'on');

        const customHashtags = ((formData.get(`${prefix}customHashtags`) as string) || '').trim() || null;

        // Keep backward compatibility: set toneOverride to first selected tone (or null)
        const toneOverride = selectedTones.length === 1 ? selectedTones[0] : null;
        // Keep backward compatibility: set hashtagOverride to first selected pattern (or null)
        const hashtagOverride = selectedHashtagPatterns.length === 1 ? selectedHashtagPatterns[0] : null;

        const upsertData = {
          enabled,
          dailyTexts,
          dailyImages,
          dailyVideos,
          dailyStories,
          toneOverride,
          hashtagOverride,
          videoStyleOverride,
          videoLength,
          videoFormat,
          contentTypesOverride: selectedContentTypes.length > 0 ? selectedContentTypes : Prisma.DbNull,
          tonesOverride: selectedTones.length > 0 ? selectedTones : Prisma.DbNull,
          hashtagPatternsOverride: selectedHashtagPatterns.length > 0 ? selectedHashtagPatterns : Prisma.DbNull,
          customHashtags,
        };

        await db.platformContentPlan.upsert({
          where: { botId_platform: { botId: id, platform: platform as any } },
          create: { botId: id, platform: platform as any, ...upsertData },
          update: upsertData,
        });
      }
    } catch (e) {
      console.error('[Strategy Save]', e instanceof Error ? e.message : e);
      errorMessage = 'Failed to save strategy. Please try again.';
    }

    if (errorMessage) {
      redirect(`/dashboard/bots/${id}/strategy?error=${encodeURIComponent(errorMessage)}`);
    }
    redirect(`/dashboard/bots/${id}/strategy?success=Content strategy saved`);
  }

  async function handleApplyDefaults() {
    'use server';

    const currentUser = await requireAuth();
    const currentBot = await db.bot.findFirst({
      where: { id, userId: currentUser.id },
      include: { platformConns: true },
    });
    if (!currentBot) redirect('/dashboard/bots');

    const connected = currentBot.platformConns
      .filter(p => p.status === 'CONNECTED')
      .map(p => p.platform);

    try {
      for (const platform of connected) {
        const defaults = PLATFORM_DEFAULTS[platform];
        if (!defaults) continue;

        await db.platformContentPlan.upsert({
          where: { botId_platform: { botId: id, platform: platform as any } },
          create: {
            botId: id,
            platform: platform as any,
            enabled: true,
            dailyTexts: defaults.dailyTexts,
            dailyImages: defaults.dailyImages,
            dailyVideos: defaults.dailyVideos,
            dailyStories: defaults.dailyStories,
            hashtagOverride: defaults.hashtagOverride,
            videoStyleOverride: defaults.videoStyle,
            videoLength: defaults.videoLength,
            videoFormat: defaults.videoFormat,
            postingHours: defaults.postingHours,
          },
          update: {
            enabled: true,
            dailyTexts: defaults.dailyTexts,
            dailyImages: defaults.dailyImages,
            dailyVideos: defaults.dailyVideos,
            dailyStories: defaults.dailyStories,
            hashtagOverride: defaults.hashtagOverride,
            videoStyleOverride: defaults.videoStyle,
            videoLength: defaults.videoLength,
            videoFormat: defaults.videoFormat,
            postingHours: defaults.postingHours,
          },
        });
      }
    } catch (e) {
      console.error('[Apply Defaults]', e instanceof Error ? e.message : e);
      redirect(`/dashboard/bots/${id}/strategy?error=Failed to apply defaults`);
    }

    redirect(`/dashboard/bots/${id}/strategy?success=Recommended settings applied for ${connected.length} platforms`);
  }

  // ── Render ────────────────────────────────────────────────────

  const disconnectedPlatforms = Object.keys(PLATFORM_DEFAULTS).filter(
    p => !connectedPlatforms.includes(p as any)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{bot.name} - Content Strategy</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Define what and how often to post on each platform. The bot auto-generates content based on these settings.
        </p>
      </div>

      {/* Messages */}
      {sp.success && (
        <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-800 flex items-start gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{sp.success}</span>
        </div>
      )}
      {sp.error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive flex items-start gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{sp.error}</span>
        </div>
      )}

      {/* Info banner */}
      <Card className="bg-blue-50/50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-sm space-y-1">
              <p className="font-medium text-blue-900">How content strategy works</p>
              <p className="text-blue-700">Set a daily content plan for each connected platform. The bot auto-generates and schedules <strong>text posts</strong>, <strong>images</strong>, and <strong>videos</strong> based on your preferences. Each platform has its own optimal mix — use &quot;Apply Recommended&quot; to start with expert defaults.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Global Content Settings ── */}
      <form action={handleSaveGlobalStrategy}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5" /> Global Content Settings</CardTitle>
            <CardDescription>Content types, tones, and hashtags used across all platforms. Per-platform overrides below take priority.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="mb-3 block">Content Types</Label>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {CONTENT_TYPES.map((ct) => (
                  <label key={ct.value} className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
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
            <div>
              <Label className="mb-3 block">Tone Styles</Label>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {TONE_STYLES.map((t) => (
                  <label key={t.value} className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                    <input type="checkbox" name={`tone_${t.value}`} defaultChecked={toneStyles.includes(t.value)} className="mt-0.5 h-4 w-4 rounded border-input" />
                    <div>
                      <p className="text-sm font-medium">{t.label}</p>
                      <p className="text-xs text-muted-foreground">{t.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <Separator />
            <div>
              <Label className="mb-3 block">Hashtag Strategy</Label>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {HASHTAG_PATTERNS.map((h) => (
                  <label key={h.value} className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                    <input type="checkbox" name={`ht_${h.value}`} defaultChecked={hashtagPatterns.includes(h.value)} className="mt-0.5 h-4 w-4 rounded border-input" />
                    <div>
                      <p className="text-sm font-medium">{h.label}</p>
                      <p className="text-xs text-muted-foreground">{h.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <Separator />
            <label className="flex items-start gap-3 rounded-lg border p-4 cursor-pointer hover:bg-muted/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
              <input type="checkbox" name="selfLearning" defaultChecked={selfLearning} className="mt-0.5 h-4 w-4 rounded border-input" />
              <div>
                <p className="text-sm font-medium flex items-center gap-1.5"><Brain className="h-4 w-4" /> Self-Learning AI <HelpTip text="When enabled, the bot uses reinforcement learning to continuously improve its content strategy. It analyzes engagement metrics from each post and automatically adjusts timing, tone, hashtags, and content types to maximize performance on each platform." /></p>
                <p className="text-xs text-muted-foreground">
                  Uses reinforcement learning to optimize content. Learns from engagement metrics and adapts posting times,
                  content types, hashtags, and tone per platform. Used by Autopilot and the AI Suggestion button.
                </p>
              </div>
            </label>
            <Button type="submit" size="sm">Save Global Settings</Button>
          </CardContent>
        </Card>
      </form>

      <Separator />

      {/* ── Per-Platform Strategy ── */}
      <div>
        <h2 className="text-lg font-semibold mb-1">Per-Platform Content Plan</h2>
        <p className="text-sm text-muted-foreground mb-4">Set daily quotas and override tones/hashtags for each connected platform.</p>
      </div>

      {/* Apply defaults button */}
      {connectedPlatforms.length > 0 && (
        <div className="flex gap-3">
          <form action={handleApplyDefaults}>
            <Button type="submit" variant="outline" className="gap-2">
              <Lightbulb className="h-4 w-4" />
              Apply Recommended Settings
            </Button>
          </form>
          <p className="text-xs text-muted-foreground self-center">
            Pre-fills all platforms with expert marketing defaults. You can customize afterwards.
          </p>
        </div>
      )}

      {/* No platforms connected */}
      {connectedPlatforms.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">No platforms connected yet. Connect at least one platform to set up your content strategy.</p>
            <Link href={`/dashboard/bots/${id}/platforms`}>
              <Button>Connect Platforms</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Platform strategy cards */}
      {connectedPlatforms.length > 0 && (
        <form action={handleSaveStrategy} className="space-y-4">
          {connectedPlatforms.map((platform) => {
            const name = PLATFORM_NAMES[platform] || platform;
            const defaults = PLATFORM_DEFAULTS[platform];
            const plan = plansByPlatform.get(platform);
            const isEnabled = plan?.enabled ?? true;

            // Use saved plan values or defaults
            const dTexts = plan?.dailyTexts ?? defaults?.dailyTexts ?? 1;
            const dImages = plan?.dailyImages ?? defaults?.dailyImages ?? 1;
            const dVideos = plan?.dailyVideos ?? defaults?.dailyVideos ?? 0;
            const dStories = plan?.dailyStories ?? defaults?.dailyStories ?? 0;
            const tone = plan?.toneOverride ?? '';
            const hashtags = plan?.hashtagOverride ?? defaults?.hashtagOverride ?? '';
            const vidStyle = plan?.videoStyleOverride ?? defaults?.videoStyle ?? '';
            const vidLength = plan?.videoLength ?? defaults?.videoLength ?? '';
            const vidFormat = plan?.videoFormat ?? defaults?.videoFormat ?? '';

            const totalDaily = dTexts + dImages + dVideos + dStories;

            return (
              <Card key={platform} className={isEnabled ? '' : 'opacity-60'}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-base">{name}</CardTitle>
                      <Badge variant="success" className="text-xs">Connected</Badge>
                      {defaults?.weeklyMode && (
                        <Badge variant="secondary" className="text-xs">Weekly</Badge>
                      )}
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <span className="text-xs text-muted-foreground">Active</span>
                      <input
                        type="checkbox"
                        name={`${platform}_enabled`}
                        defaultChecked={isEnabled}
                        className="h-4 w-4 rounded"
                      />
                    </label>
                  </div>
                  {defaults?.tip && (
                    <p className="text-xs text-blue-600 mt-1">{defaults.tip}</p>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Daily quotas */}
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground mb-2 block">
                      {defaults?.weeklyMode ? 'Weekly' : 'Daily'} Content Plan ({totalDaily} total)
                    </Label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="space-y-1">
                        <label className="flex items-center gap-1.5 text-xs font-medium">
                          <FileText className="h-3.5 w-3.5 text-slate-500" /> Texts
                        </label>
                        <input
                          type="number"
                          name={`${platform}_dailyTexts`}
                          defaultValue={dTexts}
                          min={0}
                          max={20}
                          className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="flex items-center gap-1.5 text-xs font-medium">
                          <ImageIcon className="h-3.5 w-3.5 text-emerald-500" /> Images
                        </label>
                        <input
                          type="number"
                          name={`${platform}_dailyImages`}
                          defaultValue={dImages}
                          min={0}
                          max={20}
                          className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                        />
                      </div>
                      {defaults?.videoSupported !== false && (
                        <div className="space-y-1">
                          <label className="flex items-center gap-1.5 text-xs font-medium">
                            <Film className="h-3.5 w-3.5 text-violet-500" /> Videos
                          </label>
                          <input
                            type="number"
                            name={`${platform}_dailyVideos`}
                            defaultValue={dVideos}
                            min={0}
                            max={10}
                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                          />
                        </div>
                      )}
                      {defaults?.storiesSupported && (
                        <div className="space-y-1">
                          <label className="flex items-center gap-1.5 text-xs font-medium">
                            <Smartphone className="h-3.5 w-3.5 text-pink-500" /> Stories/Reels
                          </label>
                          <input
                            type="number"
                            name={`${platform}_dailyStories`}
                            defaultValue={dStories}
                            min={0}
                            max={10}
                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Per-Platform Content Types */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground block">Content Types (select which types to post on this platform)</Label>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {CONTENT_TYPES.map((ct) => {
                        const platformContentTypes = plan?.contentTypesOverride
                          ? (typeof plan.contentTypesOverride === 'string' ? JSON.parse(plan.contentTypesOverride as string) : plan.contentTypesOverride) as string[]
                          : null;
                        const isChecked = platformContentTypes
                          ? platformContentTypes.includes(ct.value)
                          : contentTypes.includes(ct.value);
                        return (
                          <label key={ct.value} className="flex items-center gap-2 rounded border px-2 py-1.5 cursor-pointer hover:bg-muted/50 has-[:checked]:border-primary/50 has-[:checked]:bg-primary/5 text-xs">
                            <input
                              type="checkbox"
                              name={`${platform}_ct_${ct.value}`}
                              defaultChecked={isChecked}
                              className="h-3.5 w-3.5 rounded"
                            />
                            <span>{ct.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Per-Platform Tone Styles */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground block">Tone Styles (select tones for this platform)</Label>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {TONE_STYLES.map((t) => {
                        const platformTones = plan?.tonesOverride
                          ? (typeof plan.tonesOverride === 'string' ? JSON.parse(plan.tonesOverride as string) : plan.tonesOverride) as string[]
                          : null;
                        const isChecked = platformTones
                          ? platformTones.includes(t.value)
                          : (tone ? tone === t.value : toneStyles.includes(t.value));
                        return (
                          <label key={t.value} className="flex items-center gap-2 rounded border px-2 py-1.5 cursor-pointer hover:bg-muted/50 has-[:checked]:border-primary/50 has-[:checked]:bg-primary/5 text-xs">
                            <input
                              type="checkbox"
                              name={`${platform}_tone_${t.value}`}
                              defaultChecked={isChecked}
                              className="h-3.5 w-3.5 rounded"
                            />
                            <span>{t.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Per-Platform Hashtag Strategy */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground block">Hashtag Strategy</Label>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {HASHTAG_PATTERNS.map((h) => {
                        const platformHashtags = plan?.hashtagPatternsOverride
                          ? (typeof plan.hashtagPatternsOverride === 'string' ? JSON.parse(plan.hashtagPatternsOverride as string) : plan.hashtagPatternsOverride) as string[]
                          : null;
                        const isChecked = platformHashtags
                          ? platformHashtags.includes(h.value)
                          : (hashtags ? hashtags === h.value : hashtagPatterns.includes(h.value));
                        return (
                          <label key={h.value} className="flex items-center gap-2 rounded border px-2 py-1.5 cursor-pointer hover:bg-muted/50 has-[:checked]:border-primary/50 has-[:checked]:bg-primary/5 text-xs">
                            <input
                              type="checkbox"
                              name={`${platform}_ht_${h.value}`}
                              defaultChecked={isChecked}
                              className="h-3.5 w-3.5 rounded"
                            />
                            <span>{h.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Per-Platform Custom Hashtags */}
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-muted-foreground">Custom Hashtags</Label>
                    <input
                      type="text"
                      name={`${platform}_customHashtags`}
                      defaultValue={(plan as Record<string, unknown>)?.customHashtags as string || ''}
                      placeholder="#brand #industry #niche — comma or space separated"
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground"
                    />
                    <p className="text-xs text-muted-foreground">
                      Custom hashtags always included in posts for this platform.
                    </p>
                  </div>

                  {/* Video options — only for video-supporting platforms */}
                  {defaults?.videoSupported && (dVideos > 0 || dStories > 0) && (
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Video Style</Label>
                        <select
                          name={`${platform}_videoStyle`}
                          defaultValue={vidStyle}
                          className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                        >
                          <option value="">Auto</option>
                          {VIDEO_STYLES.map(v => (
                            <option key={v.value} value={v.value}>{v.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Video Length</Label>
                        <select
                          name={`${platform}_videoLength`}
                          defaultValue={vidLength}
                          className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                        >
                          <option value="">Auto</option>
                          {VIDEO_LENGTHS.map(v => (
                            <option key={v.value} value={v.value}>{v.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Video Format</Label>
                        <select
                          name={`${platform}_videoFormat`}
                          defaultValue={vidFormat}
                          className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                        >
                          <option value="">Auto</option>
                          {VIDEO_FORMATS.map(v => (
                            <option key={v.value} value={v.value}>{v.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}

          <Button type="submit" size="lg" className="w-full sm:w-auto">
            Save Content Strategy
          </Button>
        </form>
      )}

      {/* Disconnected platforms */}
      {disconnectedPlatforms.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Not Connected</CardTitle>
            <CardDescription>Connect more platforms to expand your reach</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {disconnectedPlatforms.map(p => (
                <Link key={p} href={`/dashboard/bots/${id}/platforms`}>
                  <Badge variant="secondary" className="cursor-pointer hover:bg-muted gap-1">
                    {PLATFORM_NAMES[p] || p}
                    <ExternalLink className="h-3 w-3" />
                  </Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
