import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Palette, Sparkles, Type, Image, Layout, Smile, Info, Film } from 'lucide-react';
import { BotNav } from '@/components/dashboard/bot-nav';
import { HelpTip } from '@/components/ui/help-tip';
import { VIDEO_STYLES } from '@/lib/constants';

export const metadata: Metadata = { title: 'Creative Style', robots: { index: false } };

const VISUAL_STYLES = [
  { value: 'minimalist', label: 'Minimalist', desc: 'Clean, simple, lots of whitespace' },
  { value: 'bold', label: 'Bold & Vibrant', desc: 'Bright colors, strong contrast, eye-catching' },
  { value: 'corporate', label: 'Corporate', desc: 'Professional, polished, business-focused' },
  { value: 'playful', label: 'Playful', desc: 'Fun, colorful, casual vibe' },
  { value: 'elegant', label: 'Elegant', desc: 'Luxury feel, sophisticated, refined' },
  { value: 'tech', label: 'Tech/Modern', desc: 'Futuristic, gradients, tech-forward' },
  { value: 'organic', label: 'Organic/Natural', desc: 'Earth tones, natural textures, warm' },
  { value: 'retro', label: 'Retro/Vintage', desc: 'Nostalgic, classic aesthetics' },
];

const IMAGE_TYPES = [
  { value: 'photos', label: 'Photography', desc: 'Real photos, stock imagery' },
  { value: 'illustrations', label: 'Illustrations', desc: 'Hand-drawn or digital art style' },
  { value: 'flat_design', label: 'Flat Design', desc: 'Simple shapes, solid colors' },
  { value: '3d_renders', label: '3D Renders', desc: 'Three-dimensional objects and scenes' },
  { value: 'infographics', label: 'Infographics', desc: 'Data visualization, charts, diagrams' },
  { value: 'abstract', label: 'Abstract', desc: 'Shapes, patterns, non-representational' },
];

const TONES = [
  { value: 'professional', label: 'Professional' },
  { value: 'casual', label: 'Casual & Friendly' },
  { value: 'exciting', label: 'Exciting & Dynamic' },
  { value: 'calming', label: 'Calming & Trustworthy' },
  { value: 'luxurious', label: 'Luxurious & Premium' },
  { value: 'educational', label: 'Educational & Informative' },
  { value: 'humorous', label: 'Humorous & Witty' },
  { value: 'inspirational', label: 'Inspirational & Motivating' },
];

const TEXT_OVERLAY_OPTIONS = [
  { value: 'always', label: 'Always', desc: 'Include text/headlines on every image' },
  { value: 'sometimes', label: 'Sometimes', desc: 'Only when it adds value' },
  { value: 'never', label: 'Never', desc: 'Images only, no text overlay' },
];

const LOGO_PLACEMENT_OPTIONS = [
  { value: 'bottom_right', label: 'Bottom Right' },
  { value: 'bottom_left', label: 'Bottom Left' },
  { value: 'top_right', label: 'Top Right' },
  { value: 'top_left', label: 'Top Left' },
  { value: 'center', label: 'Center (watermark)' },
  { value: 'none', label: 'No Logo' },
];

const VIDEO_PACING_OPTIONS = [
  { value: 'fast', label: 'Fast', desc: 'Quick cuts, high energy — TikTok, Reels' },
  { value: 'medium', label: 'Medium', desc: 'Balanced pacing — most platforms' },
  { value: 'slow', label: 'Slow', desc: 'Cinematic, thoughtful — YouTube, LinkedIn' },
];

const VIDEO_MUSIC_OPTIONS = [
  { value: 'upbeat', label: 'Upbeat & Energetic' },
  { value: 'chill', label: 'Chill & Relaxed' },
  { value: 'corporate', label: 'Corporate & Professional' },
  { value: 'cinematic', label: 'Cinematic & Epic' },
  { value: 'none', label: 'No Music' },
];

export default async function CreativeStylePage({
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

  // Load from both old imagePreferences and new creativePreferences (merge)
  const oldPrefs = (bot.imagePreferences as Record<string, unknown>) || {};
  const newPrefs = (bot.creativePreferences as Record<string, unknown>) || {};
  const prefs = { ...oldPrefs, ...newPrefs };

  const brandColors = (prefs.brandColors as string[]) || ['#3B82F6', '#10B981'];
  const visualStyles = (prefs.visualStyles as string[]) || ['minimalist'];
  const imageTypes = (prefs.imageTypes as string[]) || ['photos'];
  const tone = (prefs.tone as string) || 'professional';
  const textOverlay = (prefs.textOverlay as string) || 'sometimes';
  const logoPlacement = (prefs.logoPlacement as string) || 'bottom_right';
  const subjects = (prefs.subjects as string) || '';
  const avoidTopics = (prefs.avoidTopics as string) || '';
  const fontStyle = (prefs.fontStyle as string) || 'modern';
  const customInstructions = (prefs.customInstructions as string) || '';

  // Video preferences
  const videoStyle = (prefs.videoStyle as string) || 'quick_tips';
  const videoPacing = (prefs.videoPacing as string) || 'medium';
  const videoTextOverlays = (prefs.videoTextOverlays as string) || 'sometimes';
  const videoMusicStyle = (prefs.videoMusicStyle as string) || 'upbeat';
  const videoCustomInstructions = (prefs.videoCustomInstructions as string) || '';

  async function handleSavePreferences(formData: FormData) {
    'use server';

    const currentUser = await requireAuth();
    const currentBot = await db.bot.findFirst({ where: { id, userId: currentUser.id } });
    if (!currentBot) redirect('/dashboard/bots');

    const colorsRaw = (formData.get('brandColors') as string) || '#3B82F6,#10B981';
    const colors = colorsRaw.split(',').map(c => c.trim()).filter(c => /^#[0-9A-Fa-f]{6}$/.test(c)).slice(0, 6);
    const selectedStyles = VISUAL_STYLES.map(s => s.value).filter(v => formData.get(`style_${v}`) === 'on');
    const selectedTypes = IMAGE_TYPES.map(t => t.value).filter(v => formData.get(`type_${v}`) === 'on');

    const preferences = {
      // Image preferences
      brandColors: colors.length > 0 ? colors : ['#3B82F6'],
      visualStyles: selectedStyles.length > 0 ? selectedStyles : ['minimalist'],
      imageTypes: selectedTypes.length > 0 ? selectedTypes : ['photos'],
      tone: (formData.get('tone') as string) || 'professional',
      textOverlay: (formData.get('textOverlay') as string) || 'sometimes',
      logoPlacement: (formData.get('logoPlacement') as string) || 'bottom_right',
      fontStyle: (formData.get('fontStyle') as string) || 'modern',
      subjects: (formData.get('subjects') as string) || '',
      avoidTopics: (formData.get('avoidTopics') as string) || '',
      customInstructions: (formData.get('customInstructions') as string) || '',
      // Video preferences
      videoStyle: (formData.get('videoStyle') as string) || 'quick_tips',
      videoPacing: (formData.get('videoPacing') as string) || 'medium',
      videoTextOverlays: (formData.get('videoTextOverlays') as string) || 'sometimes',
      videoMusicStyle: (formData.get('videoMusicStyle') as string) || 'upbeat',
      videoCustomInstructions: (formData.get('videoCustomInstructions') as string) || '',
    };

    await db.bot.update({
      where: { id },
      data: {
        imagePreferences: preferences,
        creativePreferences: preferences,
      },
    });

    redirect(`/dashboard/bots/${id}/creative-style?success=Creative style preferences saved`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{bot.name} - Creative Style</h1>
        <p className="text-sm text-muted-foreground mt-1">Define your visual brand identity for images and videos. AI uses these preferences when generating content.</p>
        <BotNav botId={id} activeTab="creative-style" />
      </div>

      {sp.success && <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-800">{sp.success}</div>}
      {sp.error && <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">{sp.error}</div>}

      {/* How it works */}
      <Card className="bg-blue-50/50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-sm space-y-1">
              <p className="font-medium text-blue-900">How creative style works</p>
              <p className="text-blue-700">These settings guide the AI when generating <strong>images</strong> and <strong>videos</strong> for your posts. Your brand colors, visual style, and tone ensure on-brand content across all platforms.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <form action={handleSavePreferences}>
        {/* ── IMAGE SECTION ── */}
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
          <Image className="h-5 w-5" /> Image Preferences
        </h2>

        {/* Brand Colors */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Palette className="h-5 w-5" /> Brand Colors</CardTitle>
            <CardDescription>Hex codes, comma-separated (up to 6)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input name="brandColors" defaultValue={brandColors.join(', ')} placeholder="#3B82F6, #10B981, #F59E0B" />
            <div className="flex gap-2">
              {brandColors.map((color, i) => (
                <div key={i} className="h-8 w-8 rounded-full border shadow-sm" style={{ backgroundColor: color }} title={color} />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Visual Style */}
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Layout className="h-5 w-5" /> Visual Style</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {VISUAL_STYLES.map((s) => (
                <label key={s.value} className="flex items-start gap-2 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                  <input type="checkbox" name={`style_${s.value}`} defaultChecked={visualStyles.includes(s.value)} className="mt-0.5 h-4 w-4" />
                  <div>
                    <p className="text-sm font-medium">{s.label}</p>
                    <p className="text-xs text-muted-foreground">{s.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Image Types */}
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Image className="h-5 w-5" /> Preferred Image Types</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {IMAGE_TYPES.map((t) => (
                <label key={t.value} className="flex items-start gap-2 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                  <input type="checkbox" name={`type_${t.value}`} defaultChecked={imageTypes.includes(t.value)} className="mt-0.5 h-4 w-4" />
                  <div>
                    <p className="text-sm font-medium">{t.label}</p>
                    <p className="text-xs text-muted-foreground">{t.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Tone & Mood + Text & Branding */}
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Smile className="h-5 w-5" /> Tone, Text & Branding</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Primary Tone</Label>
                <select name="tone" defaultValue={tone} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  {TONES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Logo Placement</Label>
                <select name="logoPlacement" defaultValue={logoPlacement} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  {LOGO_PLACEMENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Font Style</Label>
                <select name="fontStyle" defaultValue={fontStyle} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="modern">Modern Sans-serif</option>
                  <option value="classic">Classic Serif</option>
                  <option value="handwritten">Handwritten</option>
                  <option value="monospace">Monospace/Tech</option>
                  <option value="display">Display/Bold</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Text Overlay on Images</Label>
              <div className="grid gap-2 sm:grid-cols-3">
                {TEXT_OVERLAY_OPTIONS.map((o) => (
                  <label key={o.value} className="flex items-start gap-2 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                    <input type="radio" name="textOverlay" value={o.value} defaultChecked={textOverlay === o.value} className="mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">{o.label}</p>
                      <p className="text-xs text-muted-foreground">{o.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Content Subjects */}
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5" /> Content Subjects</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Preferred Subjects & Themes</Label>
              <textarea name="subjects" defaultValue={subjects} placeholder="e.g., Technology, cryptocurrency, charts, people using phones" className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </div>
            <div className="space-y-2">
              <Label>Topics to Avoid</Label>
              <textarea name="avoidTopics" defaultValue={avoidTopics} placeholder="e.g., Gambling, violence, political content" className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </div>
            <div className="space-y-2">
              <Label>Custom Instructions for AI</Label>
              <textarea name="customInstructions" defaultValue={customInstructions} placeholder="e.g., Always use a gradient background. Include our tagline when possible." className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </div>
          </CardContent>
        </Card>

        <Separator className="my-8" />

        {/* ── VIDEO SECTION ── */}
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
          <Film className="h-5 w-5" /> Video Preferences
        </h2>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Default Video Style</CardTitle>
            <CardDescription>How should AI-generated videos look and feel?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="mb-3 block">Video Style</Label>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {VIDEO_STYLES.map((v) => (
                  <label key={v.value} className="flex items-start gap-2 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                    <input type="radio" name="videoStyle" value={v.value} defaultChecked={videoStyle === v.value} className="mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">{v.label}</p>
                      <p className="text-xs text-muted-foreground">{v.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Pacing</Label>
                <select name="videoPacing" defaultValue={videoPacing} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  {VIDEO_PACING_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label} — {p.desc}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Music Style</Label>
                <select name="videoMusicStyle" defaultValue={videoMusicStyle} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  {VIDEO_MUSIC_OPTIONS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Text Overlays on Video</Label>
                <select name="videoTextOverlays" defaultValue={videoTextOverlays} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  {TEXT_OVERLAY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label} — {o.desc}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Custom Video Instructions</Label>
              <textarea name="videoCustomInstructions" defaultValue={videoCustomInstructions} placeholder="e.g., Always start with a hook question. Use brand colors for text overlays. End with a call to action." className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
              <p className="text-xs text-muted-foreground">Additional creative direction specific to video generation.</p>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 flex gap-3">
          <Button type="submit" size="lg">Save Creative Style</Button>
        </div>
      </form>
    </div>
  );
}
