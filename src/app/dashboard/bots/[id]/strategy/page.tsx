import { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Info, Lightbulb, FileText, ImageIcon, Film, Smartphone, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';
import { BotNav } from '@/components/dashboard/bot-nav';
import { HelpTip } from '@/components/ui/help-tip';
import { PLATFORM_NAMES, TONE_STYLES, HASHTAG_PATTERNS, VIDEO_STYLES, VIDEO_LENGTHS, VIDEO_FORMATS } from '@/lib/constants';
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

  // ── Server Actions ────────────────────────────────────────────

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

        const toneOverride = (formData.get(`${prefix}tone`) as string) || null;
        const hashtagOverride = (formData.get(`${prefix}hashtags`) as string) || null;
        const videoStyleOverride = (formData.get(`${prefix}videoStyle`) as string) || null;
        const videoLength = (formData.get(`${prefix}videoLength`) as string) || null;
        const videoFormat = (formData.get(`${prefix}videoFormat`) as string) || null;

        await db.platformContentPlan.upsert({
          where: { botId_platform: { botId: id, platform: platform as any } },
          create: {
            botId: id,
            platform: platform as any,
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
          },
          update: {
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
          },
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
        <BotNav botId={id} activeTab="strategy" />
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

                  {/* Style overrides */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Tone</Label>
                      <select
                        name={`${platform}_tone`}
                        defaultValue={tone}
                        className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                      >
                        <option value="">Use bot default</option>
                        {TONE_STYLES.map(t => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Hashtags</Label>
                      <select
                        name={`${platform}_hashtags`}
                        defaultValue={hashtags}
                        className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                      >
                        <option value="">Use bot default</option>
                        {HASHTAG_PATTERNS.map(h => (
                          <option key={h.value} value={h.value}>{h.label}</option>
                        ))}
                      </select>
                    </div>
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
