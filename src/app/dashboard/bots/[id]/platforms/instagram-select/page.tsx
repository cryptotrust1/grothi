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
  title: 'Select Instagram Account',
  robots: { index: false },
};

const JWT_SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET || 'fallback-secret-change-me'
);

interface IGAccountInfo {
  igAccountId: string;
  igUsername: string;
  pageId: string;
  pageName: string;
  token: string;
}

export default async function InstagramSelectPage({
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
    redirect(`/dashboard/bots/${botId}/platforms?error=${encodeURIComponent('Missing account selection token. Please try connecting again.')}`);
  }

  let accounts: IGAccountInfo[] = [];
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.botId !== botId) {
      redirect(`/dashboard/bots/${botId}/platforms?error=${encodeURIComponent('Invalid token for this bot')}`);
    }
    accounts = payload.accounts as IGAccountInfo[];
  } catch {
    redirect(`/dashboard/bots/${botId}/platforms?error=${encodeURIComponent('Token expired. Please try connecting again.')}`);
  }

  if (!accounts || accounts.length === 0) {
    redirect(`/dashboard/bots/${botId}/platforms?error=${encodeURIComponent('No accounts found in token')}`);
  }

  async function handleSelectAccount(formData: FormData) {
    'use server';

    const currentUser = await requireAuth();
    const currentBot = await db.bot.findFirst({ where: { id: botId, userId: currentUser.id } });
    if (!currentBot) redirect('/dashboard/bots');

    const accountIndex = parseInt(formData.get('accountIndex') as string, 10);
    if (isNaN(accountIndex) || accountIndex < 0 || accountIndex >= accounts.length) {
      redirect(`/dashboard/bots/${botId}/platforms?error=${encodeURIComponent('Invalid account selection')}`);
    }

    const selected = accounts[accountIndex];

    const encryptedCredentials = {
      accountId: encrypt(selected.igAccountId),
      accessToken: encrypt(selected.token),
    };

    try {
      await db.platformConnection.upsert({
        where: { botId_platform: { botId, platform: 'INSTAGRAM' } },
        create: {
          botId,
          platform: 'INSTAGRAM',
          encryptedCredentials,
          config: {
            igUsername: selected.igUsername,
            pageName: selected.pageName,
            connectedVia: 'oauth',
          },
          status: 'CONNECTED',
        },
        update: {
          encryptedCredentials,
          config: {
            igUsername: selected.igUsername,
            pageName: selected.pageName,
            connectedVia: 'oauth',
          },
          status: 'CONNECTED',
          lastError: null,
        },
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to save connection';
      redirect(`/dashboard/bots/${botId}/platforms?error=${encodeURIComponent(message)}`);
    }

    redirect(`/dashboard/bots/${botId}/platforms?success=${encodeURIComponent(`Instagram @${selected.igUsername} connected successfully`)}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{bot.name} - Select Instagram Account</h1>
        <p className="text-sm text-muted-foreground mt-1">
          You have multiple Instagram Business accounts. Select the one to connect to this bot.
        </p>
        <BotNav botId={botId} activeTab="platforms" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {accounts.map((acct, index) => (
          <Card key={acct.igAccountId} className="hover:border-purple-400 transition-colors">
            <form action={handleSelectAccount}>
              <input type="hidden" name="accountIndex" value={index} />
              <CardHeader className="pb-2">
                <CardTitle className="text-base">@{acct.igUsername}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  via Facebook Page: {acct.pageName}
                </p>
              </CardHeader>
              <CardContent>
                <Button type="submit" size="sm" className="w-full">
                  Connect This Account
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
        and click &quot;Connect with Instagram&quot; again.
      </p>
    </div>
  );
}
