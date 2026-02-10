import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Palette, Sparkles, Type, Image, Layout, Smile } from 'lucide-react';
import { BotNav } from '@/components/dashboard/bot-nav';

export const metadata: Metadata = { title: 'Image Style Preferences', robots: { index: false } };

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

export default async function ImageStylePage({
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

  const prefs = (bot.imagePreferences as Record<string, unknown>) || {};
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

  async function handleSavePreferences(formData: FormData) {
    'use server';

    const currentUser = await requireAuth();
    const currentBot = await db.bot.findFirst({ where: { id, userId: currentUser.id } });
    if (!currentBot) redirect('/dashboard/bots');

    // Parse brand colors
    const colorsRaw = (formData.get('brandColors') as string) || '#3B82F6,#10B981';
    const colors = colorsRaw.split(',').map(c => c.trim()).filter(c => /^#[0-9A-Fa-f]{6}$/.test(c)).slice(0, 6);

    // Parse visual styles
    const selectedStyles = VISUAL_STYLES.map(s => s.value).filter(v => formData.get(`style_${v}`) === 'on');

    // Parse image types
    const selectedTypes = IMAGE_TYPES.map(t => t.value).filter(v => formData.get(`type_${v}`) === 'on');

    const preferences = {
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
    };

    await db.bot.update({
      where: { id },
      data: { imagePreferences: preferences },
    });

    redirect(`/dashboard/bots/${id}/image-style?success=Image style preferences saved`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{bot.name} - Image Style</h1>
        <p className="text-sm text-muted-foreground mt-1">Define your visual brand identity. AI uses these preferences when generating images and captions.</p>
        <BotNav botId={id} activeTab="image-style" />
      </div>

      {sp.success && <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-800">{sp.success}</div>}
      {sp.error && <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">{sp.error}</div>}

      <form action={handleSavePreferences}>
        {/* Brand Colors */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Palette className="h-5 w-5" /> Brand Colors</CardTitle>
            <CardDescription>Enter your brand colors as hex codes (comma-separated, up to 6 colors)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              name="brandColors"
              defaultValue={brandColors.join(', ')}
              placeholder="#3B82F6, #10B981, #F59E0B"
            />
            <div className="flex gap-2">
              {brandColors.map((color, i) => (
                <div
                  key={i}
                  className="h-8 w-8 rounded-full border shadow-sm"
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">AI will use these colors as the primary palette when generating images and selecting filters.</p>
          </CardContent>
        </Card>

        {/* Visual Style */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Layout className="h-5 w-5" /> Visual Style</CardTitle>
            <CardDescription>Select one or more visual styles that match your brand (select multiple)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {VISUAL_STYLES.map((s) => (
                <label key={s.value} className="flex items-start gap-2 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                  <input
                    type="checkbox"
                    name={`style_${s.value}`}
                    defaultChecked={visualStyles.includes(s.value)}
                    className="mt-0.5 h-4 w-4"
                  />
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
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Image className="h-5 w-5" /> Preferred Image Types</CardTitle>
            <CardDescription>What kind of images should the AI create or suggest?</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {IMAGE_TYPES.map((t) => (
                <label key={t.value} className="flex items-start gap-2 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                  <input
                    type="checkbox"
                    name={`type_${t.value}`}
                    defaultChecked={imageTypes.includes(t.value)}
                    className="mt-0.5 h-4 w-4"
                  />
                  <div>
                    <p className="text-sm font-medium">{t.label}</p>
                    <p className="text-xs text-muted-foreground">{t.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Tone & Mood */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Smile className="h-5 w-5" /> Tone & Mood</CardTitle>
            <CardDescription>The overall feeling your visual content should convey</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Primary Tone</Label>
              <select name="tone" defaultValue={tone} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                {TONES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Text Overlay & Logo */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Type className="h-5 w-5" /> Text & Branding</CardTitle>
            <CardDescription>How should text and your logo appear on generated images?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Text Overlay</Label>
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

            <div className="grid gap-4 sm:grid-cols-2">
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
          </CardContent>
        </Card>

        {/* Content Subjects */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5" /> Content Subjects</CardTitle>
            <CardDescription>Guide AI on what to include or avoid in generated images</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Preferred Subjects & Themes</Label>
              <textarea
                name="subjects"
                defaultValue={subjects}
                placeholder={"e.g., Technology, cryptocurrency, charts, people using phones, modern offices, blockchain graphics, team collaboration"}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <p className="text-xs text-muted-foreground">Describe subjects, themes, or scenes you want the AI to incorporate.</p>
            </div>

            <div className="space-y-2">
              <Label>Topics to Avoid</Label>
              <textarea
                name="avoidTopics"
                defaultValue={avoidTopics}
                placeholder={"e.g., Gambling, violence, political content, competitors' logos"}
                className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <p className="text-xs text-muted-foreground">Things that should never appear in AI-generated content.</p>
            </div>

            <div className="space-y-2">
              <Label>Custom Instructions for AI</Label>
              <textarea
                name="customInstructions"
                defaultValue={customInstructions}
                placeholder={"e.g., Always use a gradient background. Include our tagline 'Trade Smarter' when possible. Avoid stock-photo-looking images."}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <p className="text-xs text-muted-foreground">Any additional creative direction for the AI.</p>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 flex gap-3">
          <Button type="submit" size="lg">Save Image Preferences</Button>
        </div>
      </form>
    </div>
  );
}
