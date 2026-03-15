import { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { Prisma, PlatformType } from '@prisma/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Info, Lightbulb, FileText, ImageIcon, Film, Smartphone, CheckCircle2, AlertCircle, ExternalLink, Brain, Target, Users, Heart, ShieldAlert, MessageCircle, TrendingUp } from 'lucide-react';
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

  // Audience profile
  const audienceProfile = (reactorState.audienceProfile as Record<string, string>) || {};

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

  async function handleSaveAudienceProfile(formData: FormData) {
    'use server';

    const currentUser = await requireAuth();
    const currentBot = await db.bot.findFirst({ where: { id, userId: currentUser.id } });
    if (!currentBot) redirect('/dashboard/bots');

    const currentReactor = (currentBot.reactorState as Record<string, unknown>) || {};

    // Collect all audience profile fields — trimmed, empty strings become absent
    const fields = [
      'audienceName', 'summary', 'transformation', 'ageRange', 'gender', 'location', 'languages',
      'occupation', 'incomeLevel', 'education',
      'interests', 'values', 'lifestyle', 'onlineBehavior', 'contentPreferences',
      'painPoint1', 'painPoint2', 'painPoint3',
      'desire1', 'desire2', 'desire3',
      'followMotivation', 'aspirationalIdentity', 'biggestFear',
      'buyingTriggers', 'decisionFactors', 'purchaseStage',
      'trustBarriers', 'priceSensitivity',
      'wordsTheyUse', 'wordsToAvoid', 'commonQuestions', 'objections',
      'communicationStyle', 'emotionalHooks', 'avoidTopics',
      'competitors', 'influencers', 'brandRelationship',
    ] as const;

    const profile: Record<string, string> = {};
    for (const field of fields) {
      const val = ((formData.get(`ap_${field}`) as string) || '').trim();
      if (val.length > 0) {
        // Limit each field to 2000 chars for security
        profile[field] = val.slice(0, 2000);
      }
    }

    // Merge pain points and desires into combined fields for AI consumption
    const painPoints = [profile.painPoint1, profile.painPoint2, profile.painPoint3].filter(Boolean).join('; ');
    const desires = [profile.desire1, profile.desire2, profile.desire3].filter(Boolean).join('; ');
    if (painPoints) profile.painPoints = painPoints;
    if (desires) profile.desires = desires;

    await db.bot.update({
      where: { id },
      data: {
        reactorState: {
          ...currentReactor,
          audienceProfile: profile,
        },
      },
    });

    redirect(`/dashboard/bots/${id}/strategy?success=Audience profile saved`);
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
        const customContentType = ((formData.get(`${prefix}customContentType`) as string) || '').trim().slice(0, 200) || null;
        const customToneStyle = ((formData.get(`${prefix}customToneStyle`) as string) || '').trim().slice(0, 200) || null;

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
          customContentType,
          customToneStyle,
        };

        await db.platformContentPlan.upsert({
          where: { botId_platform: { botId: id, platform: platform as PlatformType } },
          create: { botId: id, platform: platform as PlatformType, ...upsertData },
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
          where: { botId_platform: { botId: id, platform: platform as PlatformType } },
          create: {
            botId: id,
            platform: platform as PlatformType,
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
    p => !connectedPlatforms.includes(p as PlatformType)
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

      {/* ── Target Audience Profile ── */}
      <form action={handleSaveAudienceProfile}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Target Audience Profile</CardTitle>
            <CardDescription>
              Define your ideal audience so the AI creates content that deeply resonates. The more specific you are, the better the AI targets your followers and potential customers.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">

            {/* Tier 1: Essential — always visible */}
            <div className="rounded-lg bg-amber-50/50 border border-amber-200 p-3 text-sm">
              <p className="font-medium text-amber-900 flex items-center gap-1.5"><TrendingUp className="h-4 w-4" /> These fields have the highest impact on content quality</p>
              <p className="text-xs text-amber-700 mt-1">Pain points and audience vocabulary are the most important — they drive 80% of content relevance.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Audience Name</Label>
                <input type="text" name="ap_audienceName" defaultValue={audienceProfile.audienceName || ''} placeholder='e.g. "Tech-Savvy Entrepreneurs"' className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
              </div>
              <div className="space-y-2">
                <Label>Industry / Niche</Label>
                <input type="text" name="ap_occupation" defaultValue={audienceProfile.occupation || ''} placeholder="e.g. SaaS, crypto, fitness, fashion" className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Audience Summary</Label>
              <textarea name="ap_summary" defaultValue={audienceProfile.summary || ''} placeholder="Describe your ideal follower/customer in 2-3 sentences. Who are they? What do they do? What matters to them?" className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground" />
            </div>

            {/* Transformation Statement — StoryBrand framework */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
                <Label>Transformation Statement</Label>
                <HelpTip text="The single most powerful framing for your content. Complete this sentence: 'My audience wants to go FROM [current frustrating state] TO [desired dream state].' This gives the AI the emotional core of every post. Based on Donald Miller's StoryBrand framework." />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <input type="text" name="ap_transformation" defaultValue={audienceProfile.transformation || ''} placeholder="FROM [current state] → TO [desired state], e.g. 'FROM overwhelmed solopreneur posting randomly → TO confident brand with automated growth'" className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
              </div>
            </div>

            {/* Pain Points — the highest-impact field */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-red-500" />
                <Label>Top 3 Pain Points</Label>
                <HelpTip text="The specific problems your audience faces. This is the #1 factor that drives content relevance. Be as specific as possible — 'I waste 3 hours per week on manual social media posting' is better than 'social media is hard'." />
              </div>
              <input type="text" name="ap_painPoint1" defaultValue={audienceProfile.painPoint1 || ''} placeholder="1. Biggest pain point (e.g. 'I waste 3 hours/day posting manually to 5 platforms')" className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
              <input type="text" name="ap_painPoint2" defaultValue={audienceProfile.painPoint2 || ''} placeholder="2. Second pain point (e.g. 'I don't know what to post — I run out of ideas')" className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
              <input type="text" name="ap_painPoint3" defaultValue={audienceProfile.painPoint3 || ''} placeholder="3. Third pain point (e.g. 'My posts get no engagement, I feel invisible')" className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
            </div>

            {/* Desires / Goals */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Heart className="h-4 w-4 text-pink-500" />
                <Label>Top 3 Goals & Desires</Label>
                <HelpTip text="What your audience wants to achieve. What does success look like for them? What's their dream outcome?" />
              </div>
              <input type="text" name="ap_desire1" defaultValue={audienceProfile.desire1 || ''} placeholder="1. Primary goal (e.g. 'Grow to 10K followers and monetize my audience')" className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
              <input type="text" name="ap_desire2" defaultValue={audienceProfile.desire2 || ''} placeholder="2. Secondary goal (e.g. 'Build a personal brand that attracts clients')" className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
              <input type="text" name="ap_desire3" defaultValue={audienceProfile.desire3 || ''} placeholder="3. Third goal (e.g. 'Save time and automate repetitive marketing tasks')" className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
            </div>

            {/* Audience Language — critical for authentic voice */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-blue-500" />
                <Label>Audience Vocabulary</Label>
                <HelpTip text="The exact words and phrases your audience uses. This is injected directly into AI content to make it sound authentic and relatable. Think about how they talk in DMs, comments, and reviews." />
              </div>
              <div className="space-y-2">
                <textarea name="ap_wordsTheyUse" defaultValue={audienceProfile.wordsTheyUse || ''} placeholder="Words/phrases they use: e.g. 'side hustle', 'passive income', 'scale my business', 'content game', 'engagement rate'" className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground" />
                <textarea name="ap_wordsToAvoid" defaultValue={audienceProfile.wordsToAvoid || ''} placeholder="Words/phrases to AVOID: e.g. 'get rich quick', 'guru', 'easy money', 'guaranteed results'" className="flex min-h-[50px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground" />
              </div>
            </div>

            <Separator />

            {/* Tier 2: Demographics & Psychographics */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Demographics & Identity</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1">
                  <Label className="text-xs">Age Range</Label>
                  <select name="ap_ageRange" defaultValue={audienceProfile.ageRange || ''} className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
                    <option value="">Not specified</option>
                    <option value="13-17">13-17 (Gen Alpha)</option>
                    <option value="18-24">18-24 (Gen Z)</option>
                    <option value="25-34">25-34 (Millennials)</option>
                    <option value="35-44">35-44 (Millennials/Gen X)</option>
                    <option value="45-54">45-54 (Gen X)</option>
                    <option value="55-64">55-64 (Boomers)</option>
                    <option value="65+">65+ (Seniors)</option>
                    <option value="18-34">18-34 (Young adults)</option>
                    <option value="25-44">25-44 (Core working age)</option>
                    <option value="35-55">35-55 (Established professionals)</option>
                    <option value="all">All ages</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Gender</Label>
                  <select name="ap_gender" defaultValue={audienceProfile.gender || ''} className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
                    <option value="">Not specified</option>
                    <option value="mostly_male">Mostly male</option>
                    <option value="mostly_female">Mostly female</option>
                    <option value="mixed">Mixed / All genders</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Income Level</Label>
                  <select name="ap_incomeLevel" defaultValue={audienceProfile.incomeLevel || ''} className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
                    <option value="">Not specified</option>
                    <option value="budget">Budget-conscious</option>
                    <option value="middle">Middle income</option>
                    <option value="affluent">Affluent</option>
                    <option value="premium">Premium / Luxury</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Education</Label>
                  <select name="ap_education" defaultValue={audienceProfile.education || ''} className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
                    <option value="">Not specified</option>
                    <option value="high_school">High school</option>
                    <option value="some_college">Some college</option>
                    <option value="bachelor">Bachelor&apos;s degree</option>
                    <option value="master">Master&apos;s / MBA</option>
                    <option value="phd">PhD / Doctorate</option>
                    <option value="mixed">Mixed levels</option>
                  </select>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 mt-3">
                <div className="space-y-1">
                  <Label className="text-xs">Location / Region</Label>
                  <input type="text" name="ap_location" defaultValue={audienceProfile.location || ''} placeholder="e.g. USA, Europe, Slovakia, worldwide" className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Languages Spoken</Label>
                  <input type="text" name="ap_languages" defaultValue={audienceProfile.languages || ''} placeholder="e.g. English, Slovak, German" className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
                </div>
              </div>
            </div>

            <Separator />

            {/* Psychographics & Behavior */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Psychographics & Online Behavior</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">Interests & Hobbies</Label>
                  <textarea name="ap_interests" defaultValue={audienceProfile.interests || ''} placeholder="What are they passionate about? e.g. technology, crypto, fitness, travel, self-improvement" className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Values & Beliefs</Label>
                  <textarea name="ap_values" defaultValue={audienceProfile.values || ''} placeholder="What values drive their decisions? e.g. innovation, freedom, security, sustainability, community" className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Lifestyle</Label>
                  <textarea name="ap_lifestyle" defaultValue={audienceProfile.lifestyle || ''} placeholder="How do they live? e.g. busy entrepreneurs, remote workers, college students, parents" className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Online Behavior</Label>
                  <textarea name="ap_onlineBehavior" defaultValue={audienceProfile.onlineBehavior || ''} placeholder="How do they use social media? e.g. scroll during commute, research products, lurk in communities" className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground" />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 mt-3">
                <div className="space-y-1">
                  <Label className="text-xs">Why They Follow Accounts</Label>
                  <HelpTip text="People follow accounts for multiple reasons. List all that apply — this determines the ideal content mix between educational, entertaining, and inspirational posts." />
                  <input type="text" name="ap_followMotivation" defaultValue={audienceProfile.followMotivation || ''} placeholder="e.g. learn new skills, stay updated, entertainment, community, deals, inspiration" className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Content Preferences</Label>
                  <input type="text" name="ap_contentPreferences" defaultValue={audienceProfile.contentPreferences || ''} placeholder="e.g. short tips, long guides, memes, data-driven, behind-the-scenes" className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
                </div>
              </div>
            </div>

            <Separator />

            {/* Buying Psychology */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Buying Psychology & Decision Making</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">Aspirational Identity</Label>
                  <textarea name="ap_aspirationalIdentity" defaultValue={audienceProfile.aspirationalIdentity || ''} placeholder="Who do they want to become? e.g. 'A successful entrepreneur with passive income and freedom to travel'" className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Biggest Fear / Frustration</Label>
                  <textarea name="ap_biggestFear" defaultValue={audienceProfile.biggestFear || ''} placeholder="What keeps them up at night? e.g. 'Falling behind competitors', 'Wasting money on things that don't work'" className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground" />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 mt-3">
                <div className="space-y-1">
                  <Label className="text-xs">Purchase Stage</Label>
                  <select name="ap_purchaseStage" defaultValue={audienceProfile.purchaseStage || ''} className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
                    <option value="">Mixed / Unknown</option>
                    <option value="unaware">Unaware of the problem</option>
                    <option value="problem_aware">Aware of the problem</option>
                    <option value="exploring">Exploring solutions</option>
                    <option value="comparing">Comparing options</option>
                    <option value="ready_to_buy">Ready to buy</option>
                    <option value="existing_customer">Already a customer</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Decision Style</Label>
                  <select name="ap_decisionFactors" defaultValue={audienceProfile.decisionFactors || ''} className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
                    <option value="">Not specified</option>
                    <option value="impulsive">Impulsive — decides fast</option>
                    <option value="research">Research-heavy — compares everything</option>
                    <option value="peer">Peer-influenced — asks friends</option>
                    <option value="authority">Authority-influenced — trusts experts</option>
                    <option value="price">Price-driven — cheapest wins</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Price Sensitivity</Label>
                  <select name="ap_priceSensitivity" defaultValue={audienceProfile.priceSensitivity || ''} className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
                    <option value="">Not specified</option>
                    <option value="very_sensitive">Very price-sensitive</option>
                    <option value="moderate">Moderate — wants value</option>
                    <option value="low">Low — quality matters more</option>
                    <option value="not_a_factor">Price is not a factor</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 mt-3">
                <div className="space-y-1">
                  <Label className="text-xs">Trust Barriers (why they hesitate)</Label>
                  <textarea name="ap_trustBarriers" defaultValue={audienceProfile.trustBarriers || ''} placeholder="e.g. 'Skeptical of automation tools', 'Need to see real results first', 'Worried about looking inauthentic'" className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Buying Triggers (what makes them act)</Label>
                  <textarea name="ap_buyingTriggers" defaultValue={audienceProfile.buyingTriggers || ''} placeholder="e.g. 'Free trial', 'Case study with real numbers', 'Recommendation from trusted influencer', 'Limited-time offer'" className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground" />
                </div>
              </div>
            </div>

            <Separator />

            {/* Communication Strategy */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Communication & Competitive Context</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">Common Questions They Ask</Label>
                  <textarea name="ap_commonQuestions" defaultValue={audienceProfile.commonQuestions || ''} placeholder="Questions your audience frequently asks, e.g. 'How do I grow my followers?', 'Is AI content detectable?'" className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Their Objections (in their own words)</Label>
                  <textarea name="ap_objections" defaultValue={audienceProfile.objections || ''} placeholder="e.g. 'I don't have time for this', 'I've tried tools before and they didn't work', 'It's too expensive'" className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">How to Communicate With Them</Label>
                  <textarea name="ap_communicationStyle" defaultValue={audienceProfile.communicationStyle || ''} placeholder="e.g. 'Be direct, no fluff. Use data and examples. Avoid hype language. Show don't tell.'" className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Emotional Hooks That Work</Label>
                  <textarea name="ap_emotionalHooks" defaultValue={audienceProfile.emotionalHooks || ''} placeholder="e.g. 'FOMO — competitors are ahead', 'Freedom — work from anywhere', 'Authority — expert-backed'" className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground" />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 mt-3">
                <div className="space-y-1">
                  <Label className="text-xs">Relationship with Brand</Label>
                  <select name="ap_brandRelationship" defaultValue={audienceProfile.brandRelationship || ''} className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
                    <option value="">Not specified</option>
                    <option value="unaware">Unaware — never heard of us</option>
                    <option value="aware">Aware — has seen our content</option>
                    <option value="engaged">Engaged — follows us / interacts</option>
                    <option value="customer">Customer — has purchased</option>
                    <option value="loyal">Loyal — repeat customer / advocate</option>
                    <option value="churned">Churned — used to be a customer</option>
                    <option value="mixed">Mixed — all stages</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Topics/Approaches to Avoid</Label>
                  <input type="text" name="ap_avoidTopics" defaultValue={audienceProfile.avoidTopics || ''} placeholder="e.g. politics, religion, clickbait" className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Competitors They Follow</Label>
                  <input type="text" name="ap_competitors" defaultValue={audienceProfile.competitors || ''} placeholder="e.g. Buffer, Hootsuite, Later" className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Influencers They Trust</Label>
                  <input type="text" name="ap_influencers" defaultValue={audienceProfile.influencers || ''} placeholder="e.g. Gary Vee, Alex Hormozi" className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
                </div>
              </div>
            </div>

            {/* How This Works explainer */}
            <div className="rounded-lg bg-blue-50/50 border border-blue-200 p-4 text-sm space-y-2">
              <p className="font-medium text-blue-900 flex items-center gap-1.5"><Brain className="h-4 w-4" /> How Audience Intelligence works</p>
              <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
                <li><strong>Pain points</strong> drive problem-aware content that makes people stop scrolling</li>
                <li><strong>Audience vocabulary</strong> is injected into AI prompts so content uses their exact words</li>
                <li><strong>Transformation statement</strong> gives every post emotional direction (FROM → TO)</li>
                <li><strong>Desires & aspirations</strong> create emotional resonance and inspire action</li>
                <li><strong>Purchase stage</strong> automatically adapts content strategy (educational → social proof → CTA)</li>
                <li><strong>Buying psychology</strong> helps the AI craft posts that move people from awareness to purchase</li>
                <li><strong>Follow motivation</strong> determines the ideal content mix (educational vs entertaining vs inspirational)</li>
              </ul>
            </div>

            <Button type="submit" size="sm">Save Audience Profile</Button>
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
                    <div className="mt-2">
                      <Label className="text-xs text-muted-foreground">Custom Content Type (overrides standard selections when filled)</Label>
                      <input
                        type="text"
                        name={`${platform}_customContentType`}
                        defaultValue={(plan as Record<string, unknown>)?.customContentType as string || ''}
                        placeholder="e.g. behind-the-scenes, client success story, myth busting, day-in-life..."
                        className="flex h-8 w-full rounded-md border border-input bg-background px-3 text-xs placeholder:text-muted-foreground mt-1"
                        maxLength={200}
                      />
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
                    <div className="mt-2">
                      <Label className="text-xs text-muted-foreground">Custom Tone Style (overrides standard selections when filled)</Label>
                      <input
                        type="text"
                        name={`${platform}_customToneStyle`}
                        defaultValue={(plan as Record<string, unknown>)?.customToneStyle as string || ''}
                        placeholder="e.g. sarcastic but helpful, brutally honest, warm and nurturing..."
                        className="flex h-8 w-full rounded-md border border-input bg-background px-3 text-xs placeholder:text-muted-foreground mt-1"
                        maxLength={200}
                      />
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
