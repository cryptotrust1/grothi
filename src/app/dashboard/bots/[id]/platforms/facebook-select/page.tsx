import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { jwtVerify } from 'jose';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { encrypt } from '@/lib/encryption';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BotNav } from '@/components/dashboard/bot-nav';

export const metadata: Metadata = {
  title: 'Select Facebook Page',
  robots: { index: false },
};

const JWT_SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET!
);

interface FBPageInfo {
  id: string;
  name: string;
  token: string;
  category: string;
}

export default async function FacebookSelectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const user = await requireAuth();
  const { id: botId } = await params;
  const sp = await searchParams;

  const bot = await db.bot.findFirst({
    where: { id: botId, userId: user.id },
  });
  if (!bot) notFound();

  const token = sp.token;
  if (!token) {
    redirect(`/dashboard/bots/${botId}/platforms?error=${encodeURIComponent('Missing page selection token. Please try connecting again.')}`);
  }

  // Verify and decode the pages token
  let pages: FBPageInfo[] = [];
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.botId !== botId) {
      redirect(`/dashboard/bots/${botId}/platforms?error=${encodeURIComponent('Invalid token for this bot')}`);
    }
    pages = payload.pages as FBPageInfo[];
  } catch {
    redirect(`/dashboard/bots/${botId}/platforms?error=${encodeURIComponent('Token expired. Please try connecting again.')}`);
  }

  if (!pages || pages.length === 0) {
    redirect(`/dashboard/bots/${botId}/platforms?error=${encodeURIComponent('No pages found in token')}`);
  }

  async function handleSelectPage(formData: FormData) {
    'use server';

    const currentUser = await requireAuth();
    const currentBot = await db.bot.findFirst({ where: { id: botId, userId: currentUser.id } });
    if (!currentBot) redirect('/dashboard/bots');

    const pageIndex = parseInt(formData.get('pageIndex') as string, 10);
    if (isNaN(pageIndex) || pageIndex < 0 || pageIndex >= pages.length) {
      redirect(`/dashboard/bots/${botId}/platforms?error=${encodeURIComponent('Invalid page selection')}`);
    }

    const selectedPage = pages[pageIndex];

    const encryptedCredentials = {
      pageId: encrypt(selectedPage.id),
      accessToken: encrypt(selectedPage.token),
    };

    try {
      await db.platformConnection.upsert({
        where: { botId_platform: { botId, platform: 'FACEBOOK' } },
        create: {
          botId,
          platform: 'FACEBOOK',
          encryptedCredentials,
          config: { pageName: selectedPage.name, connectedVia: 'oauth' },
          status: 'CONNECTED',
        },
        update: {
          encryptedCredentials,
          config: { pageName: selectedPage.name, connectedVia: 'oauth' },
          status: 'CONNECTED',
          lastError: null,
        },
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to save connection';
      redirect(`/dashboard/bots/${botId}/platforms?error=${encodeURIComponent(message)}`);
    }

    redirect(`/dashboard/bots/${botId}/platforms?success=${encodeURIComponent(`Facebook Page "${selectedPage.name}" connected successfully`)}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{bot.name} - Select Facebook Page</h1>
        <p className="text-sm text-muted-foreground mt-1">
          You manage multiple Facebook Pages. Select the one you want to connect to this bot.
        </p>
        <BotNav botId={botId} activeTab="platforms" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {pages.map((page, index) => (
          <Card key={page.id} className="hover:border-blue-400 transition-colors">
            <form action={handleSelectPage}>
              <input type="hidden" name="pageIndex" value={index} />
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{page.name}</CardTitle>
                {page.category && (
                  <p className="text-xs text-muted-foreground">{page.category}</p>
                )}
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-3">Page ID: {page.id}</p>
                <Button type="submit" size="sm" className="w-full">
                  Connect This Page
                </Button>
              </CardContent>
            </form>
          </Card>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        This token expires in 10 minutes. If it expires, go back to the{' '}
        <a href={`/dashboard/bots/${botId}/platforms`} className="text-blue-600 hover:underline">
          platforms page
        </a>{' '}
        and click &quot;Connect with Facebook&quot; again.
      </p>
    </div>
  );
}
