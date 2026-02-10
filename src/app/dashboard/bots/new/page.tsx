import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { createBotSchema } from '@/lib/validations';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Bot, Target, Key } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Create Bot',
  robots: { index: false },
};

const GOALS = [
  { value: 'TRAFFIC', label: 'Drive Traffic', desc: 'Maximize visits to your website' },
  { value: 'SALES', label: 'Increase Sales', desc: 'Promote products and drive conversions' },
  { value: 'ENGAGEMENT', label: 'Boost Engagement', desc: 'Grow likes, comments, shares' },
  { value: 'BRAND_AWARENESS', label: 'Brand Awareness', desc: 'Increase brand visibility and reach' },
  { value: 'LEADS', label: 'Generate Leads', desc: 'Collect signups and contact info' },
  { value: 'COMMUNITY', label: 'Build Community', desc: 'Grow and nurture your audience' },
];

export default async function NewBotPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireAuth();
  const params = await searchParams;

  async function handleCreateBot(formData: FormData) {
    'use server';

    const currentUser = await requireAuth();

    const data = {
      name: formData.get('name') as string,
      brandName: formData.get('brandName') as string,
      description: formData.get('description') as string,
      instructions: formData.get('instructions') as string,
      brandKnowledge: formData.get('brandKnowledge') as string,
      safetyLevel: (formData.get('safetyLevel') as string) || 'MODERATE',
      goal: (formData.get('goal') as string) || 'ENGAGEMENT',
      targetUrl: formData.get('targetUrl') as string,
      keywords: formData.get('keywords') as string,
    };

    const result = createBotSchema.safeParse(data);
    if (!result.success) {
      redirect('/dashboard/bots/new?error=' + encodeURIComponent(result.error.errors[0].message));
    }

    // Parse keywords from comma-separated string
    const keywordsRaw = (formData.get('keywords') as string) || '';
    const keywordsArr = keywordsRaw
      .split(',')
      .map((k) => k.trim().toLowerCase())
      .filter((k) => k.length > 0)
      .slice(0, 50);

    const bot = await db.bot.create({
      data: {
        userId: currentUser.id,
        name: result.data.name,
        brandName: result.data.brandName,
        description: result.data.description,
        instructions: result.data.instructions,
        brandKnowledge: result.data.brandKnowledge,
        safetyLevel: result.data.safetyLevel as any,
        goal: result.data.goal as any,
        targetUrl: result.data.targetUrl || null,
        keywords: keywordsArr.length > 0 ? keywordsArr : [],
        reactorState: {
          selfLearning: true,
          contentTypes: ['educational', 'engagement'],
          maxPostsPerDay: 10,
          maxRepliesPerDay: 20,
        },
      },
    });

    redirect(`/dashboard/bots/${bot.id}/platforms`);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Create New Bot</h1>
        <p className="text-muted-foreground">Set up your AI marketing bot in a few steps.</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Step 1: Bot Identity</CardTitle>
              <CardDescription>Name your bot and define what it promotes.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <form action={handleCreateBot}>
          <CardContent className="space-y-6">
            {params.error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                {params.error}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Bot Name *</Label>
                <Input id="name" name="name" placeholder="e.g., My Brand Bot" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="brandName">Brand Name *</Label>
                <Input id="brandName" name="brandName" placeholder="e.g., AceChange.io" required />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input id="description" name="description" placeholder="Short description of what this bot does" />
            </div>

            {/* Goal Selection */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                <Label>Primary Goal *</Label>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {GOALS.map((g) => (
                  <label key={g.value} className="flex items-start gap-2 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                    <input
                      type="radio"
                      name="goal"
                      value={g.value}
                      defaultChecked={g.value === 'ENGAGEMENT'}
                      className="mt-0.5"
                    />
                    <div>
                      <p className="text-sm font-medium">{g.label}</p>
                      <p className="text-xs text-muted-foreground">{g.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="targetUrl">Target Website URL</Label>
              <Input id="targetUrl" name="targetUrl" type="url" placeholder="https://your-website.com" />
              <p className="text-xs text-muted-foreground">The website your bot will drive traffic to. UTM tracking links will be auto-generated.</p>
            </div>

            {/* Keywords */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Key className="h-4 w-4" />
                <Label htmlFor="keywords">Keywords</Label>
              </div>
              <Input
                id="keywords"
                name="keywords"
                placeholder="crypto, exchange, bitcoin, trading, low fees"
              />
              <p className="text-xs text-muted-foreground">Comma-separated keywords for content optimization and SEO (max 50).</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="instructions">Bot Instructions *</Label>
              <textarea
                id="instructions"
                name="instructions"
                className="flex min-h-[150px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                placeholder={"You are a marketing assistant for AceChange.io, a cryptocurrency exchange platform. Your goal is to share educational content about crypto trading, promote our competitive rates, and engage with the crypto community in a helpful, professional manner."}
                required
              />
              <p className="text-xs text-muted-foreground">
                These instructions guide your bot&apos;s content creation and engagement style.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="brandKnowledge">Brand Knowledge Base</Label>
              <textarea
                id="brandKnowledge"
                name="brandKnowledge"
                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                placeholder={"Key facts about your brand that the bot should know:\n- Founded in 2024\n- 100+ supported cryptocurrencies\n- No KYC for small amounts\n- Available in 50+ countries"}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="safetyLevel">Safety Level</Label>
              <select
                id="safetyLevel"
                name="safetyLevel"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                defaultValue="MODERATE"
              >
                <option value="CONSERVATIVE">Conservative - Max 2 posts/day, maximum safety</option>
                <option value="MODERATE">Moderate (Recommended) - 3-5 posts/day, balanced</option>
                <option value="AGGRESSIVE">Aggressive - Up to 10 posts/day, more engagement</option>
              </select>
            </div>

            <Button type="submit" className="w-full" size="lg">
              Create Bot & Add Platforms
            </Button>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}
