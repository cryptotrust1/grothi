import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { createBotSchema } from '@/lib/validations';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Bot } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Create Bot',
  robots: { index: false },
};

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
      safetyLevel: formData.get('safetyLevel') as string || 'MODERATE',
    };

    const result = createBotSchema.safeParse(data);
    if (!result.success) {
      redirect('/dashboard/bots/new?error=' + encodeURIComponent(result.error.errors[0].message));
    }

    const bot = await db.bot.create({
      data: {
        userId: currentUser.id,
        name: result.data.name,
        brandName: result.data.brandName,
        description: result.data.description,
        instructions: result.data.instructions,
        brandKnowledge: result.data.brandKnowledge,
        safetyLevel: result.data.safetyLevel as any,
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
              <CardTitle>Step 1: Bot Basics</CardTitle>
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

            <div className="space-y-2">
              <Label htmlFor="name">Bot Name *</Label>
              <Input id="name" name="name" placeholder="e.g., My Brand Bot" required />
              <p className="text-xs text-muted-foreground">A friendly name to identify your bot.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="brandName">Brand Name *</Label>
              <Input id="brandName" name="brandName" placeholder="e.g., AceChange.io" required />
              <p className="text-xs text-muted-foreground">The brand/product your bot will promote.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input id="description" name="description" placeholder="Short description of what this bot does" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="instructions">Bot Instructions *</Label>
              <textarea
                id="instructions"
                name="instructions"
                className="flex min-h-[150px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                placeholder="Tell your bot what to do. Example:&#10;&#10;You are a marketing assistant for AceChange.io, a cryptocurrency exchange platform. Your goal is to share educational content about crypto trading, promote our competitive rates, and engage with the crypto community in a helpful, professional manner."
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
                placeholder="Key facts about your brand that the bot should know:&#10;- Founded in 2024&#10;- 100+ supported cryptocurrencies&#10;- No KYC for small amounts&#10;- Available in 50+ countries"
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

            <Button type="submit" className="w-full">
              Create Bot & Add Platforms
            </Button>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}
