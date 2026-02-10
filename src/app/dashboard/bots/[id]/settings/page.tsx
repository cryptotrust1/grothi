import { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

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

  async function handleUpdate(formData: FormData) {
    'use server';

    const currentUser = await requireAuth();
    const currentBot = await db.bot.findFirst({ where: { id, userId: currentUser.id } });
    if (!currentBot) redirect('/dashboard/bots');

    await db.bot.update({
      where: { id },
      data: {
        name: formData.get('name') as string || currentBot.name,
        brandName: formData.get('brandName') as string || currentBot.brandName,
        description: formData.get('description') as string,
        instructions: formData.get('instructions') as string || currentBot.instructions,
        brandKnowledge: formData.get('brandKnowledge') as string,
        safetyLevel: (formData.get('safetyLevel') as any) || currentBot.safetyLevel,
        postingSchedule: formData.get('postingSchedule') as string,
        timezone: formData.get('timezone') as string || 'UTC',
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

      {/* Settings Form */}
      <Card>
        <CardHeader>
          <CardTitle>Bot Configuration</CardTitle>
        </CardHeader>
        <form action={handleUpdate}>
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
              <Input name="description" defaultValue={bot.description || ''} />
            </div>

            <div className="space-y-2">
              <Label>Instructions</Label>
              <textarea
                name="instructions"
                defaultValue={bot.instructions}
                className="flex min-h-[150px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div className="space-y-2">
              <Label>Brand Knowledge</Label>
              <textarea
                name="brandKnowledge"
                defaultValue={bot.brandKnowledge || ''}
                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Safety Level</Label>
                <select name="safetyLevel" defaultValue={bot.safetyLevel} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="CONSERVATIVE">Conservative</option>
                  <option value="MODERATE">Moderate</option>
                  <option value="AGGRESSIVE">Aggressive</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Posting Schedule</Label>
                <Input name="postingSchedule" defaultValue={bot.postingSchedule || ''} placeholder="e.g., every 3h" />
              </div>
              <div className="space-y-2">
                <Label>Timezone</Label>
                <Input name="timezone" defaultValue={bot.timezone} placeholder="UTC" />
              </div>
            </div>

            <Button type="submit">Save Settings</Button>
          </CardContent>
        </form>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Delete this bot</p>
              <p className="text-sm text-muted-foreground">This action cannot be undone. All data will be lost.</p>
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
