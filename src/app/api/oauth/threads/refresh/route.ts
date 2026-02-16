import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { decrypt, encrypt } from '@/lib/encryption';

/**
 * POST /api/oauth/threads/refresh
 *
 * Refreshes a Threads long-lived access token.
 * Threads tokens are valid for 60 days but can be refreshed after 24 hours.
 * A refreshed token gets a new 60-day expiry.
 *
 * This should be called periodically (e.g., every 50 days) to keep tokens alive.
 * If a token expires, the user must re-authorize via the full OAuth flow.
 *
 * Official docs: https://developers.facebook.com/docs/threads/get-started/long-lived-tokens#refresh-a-long-lived-token
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let botId: string;
  try {
    const body = await request.json();
    botId = body.botId;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!botId) {
    return NextResponse.json({ error: 'Missing botId' }, { status: 400 });
  }

  // Verify bot belongs to user
  const bot = await db.bot.findFirst({ where: { id: botId, userId: user.id } });
  if (!bot) {
    return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
  }

  // Get existing Threads connection
  const connection = await db.platformConnection.findUnique({
    where: { botId_platform: { botId, platform: 'THREADS' } },
  });

  if (!connection || connection.status !== 'CONNECTED') {
    return NextResponse.json(
      { error: 'No active Threads connection found' },
      { status: 404 }
    );
  }

  try {
    // Decrypt the current access token
    const credentials = connection.encryptedCredentials as Record<string, string>;
    const currentToken = decrypt(credentials.accessToken);

    // Refresh the long-lived token via Threads API
    // Docs: GET https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token&access_token={token}
    const refreshUrl = new URL('https://graph.threads.net/refresh_access_token');
    refreshUrl.searchParams.set('grant_type', 'th_refresh_token');
    refreshUrl.searchParams.set('access_token', currentToken);

    const refreshRes = await fetch(refreshUrl.toString());
    const refreshData = await refreshRes.json();

    if (refreshData.error || !refreshData.access_token) {
      const errorMsg =
        refreshData.error?.message ||
        refreshData.error_message ||
        'Failed to refresh token. User may need to reconnect.';

      // Mark connection as error
      await db.platformConnection.update({
        where: { id: connection.id },
        data: {
          status: 'ERROR',
          lastError: `Token refresh failed: ${errorMsg}`,
        },
      });

      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    // Store the new token
    const newEncryptedCredentials = {
      ...credentials,
      accessToken: encrypt(refreshData.access_token),
    };

    const config = (connection.config as Record<string, unknown>) || {};

    await db.platformConnection.update({
      where: { id: connection.id },
      data: {
        encryptedCredentials: newEncryptedCredentials,
        config: {
          ...config,
          tokenRefreshedAt: new Date().toISOString(),
          tokenExpiresAt: new Date(
            Date.now() + (refreshData.expires_in || 5184000) * 1000
          ).toISOString(),
        },
        lastError: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Threads token refreshed successfully',
      expiresIn: refreshData.expires_in || 5184000,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Token refresh failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
