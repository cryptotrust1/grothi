import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { encrypt } from '@/lib/encryption';

const JWT_SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET!
);

/**
 * GET /api/oauth/pinterest/callback?code=...&state=...
 *
 * Handles the Pinterest OAuth 2.0 callback:
 * 1. Validates CSRF state token
 * 2. Exchanges authorization code for access + refresh tokens (Basic Auth)
 * 3. Fetches user account info
 * 4. Stores encrypted tokens in PlatformConnection
 *
 * Official docs: https://developers.pinterest.com/docs/getting-started/set-up-authentication-and-authorization/
 */
export async function GET(request: NextRequest) {
  const origin = process.env.NEXTAUTH_URL || request.nextUrl.origin;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL('/auth/signin', origin));
  }

  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const errorParam = request.nextUrl.searchParams.get('error');

  if (errorParam) {
    const errorDesc = request.nextUrl.searchParams.get('error_description') || 'Pinterest authorization was denied';
    return NextResponse.redirect(
      new URL(`/dashboard?error=${encodeURIComponent(errorDesc)}`, origin)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL('/dashboard?error=' + encodeURIComponent('Missing authorization code'), origin)
    );
  }

  let botId: string;
  try {
    const { payload } = await jwtVerify(state, JWT_SECRET);
    botId = payload.botId as string;
    if (payload.userId !== user.id) {
      return NextResponse.redirect(
        new URL('/dashboard?error=' + encodeURIComponent('Session mismatch'), origin)
      );
    }
  } catch {
    return NextResponse.redirect(
      new URL('/dashboard?error=' + encodeURIComponent('Invalid or expired state token. Please try again.'), origin)
    );
  }

  const bot = await db.bot.findFirst({ where: { id: botId, userId: user.id } });
  if (!bot) {
    return NextResponse.redirect(
      new URL('/dashboard?error=' + encodeURIComponent('Bot not found'), origin)
    );
  }

  const appId = process.env.PINTEREST_APP_ID;
  const appSecret = process.env.PINTEREST_APP_SECRET;
  if (!appId || !appSecret) {
    return NextResponse.redirect(
      new URL(`/dashboard/bots/${botId}/platforms?error=${encodeURIComponent('Pinterest OAuth not configured on server')}`, origin)
    );
  }

  const redirectUri = `${origin}/api/oauth/pinterest/callback`;

  try {
    // Step 1: Exchange code for tokens (Pinterest uses Basic Auth)
    const tokenRes = await fetch('https://api.pinterest.com/v5/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${appId}:${appSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }).toString(),
    });

    const tokenData = await tokenRes.json();

    if (tokenData.error || !tokenData.access_token) {
      const msg = tokenData.message || tokenData.error || 'Failed to get access token';
      return NextResponse.redirect(
        new URL(`/dashboard/bots/${botId}/platforms?error=${encodeURIComponent(msg)}`, origin)
      );
    }

    const accessToken = tokenData.access_token as string;
    const refreshToken = tokenData.refresh_token as string | undefined;

    // Step 2: Fetch user info
    const userRes = await fetch('https://api.pinterest.com/v5/user_account', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    let username = 'Pinterest User';
    if (userRes.ok) {
      const userData = await userRes.json();
      username = userData.username || userData.business_name || 'Pinterest User';
    }

    // Step 3: Store encrypted tokens
    const encryptedCredentials: Record<string, string> = {
      accessToken: encrypt(accessToken),
    };
    if (refreshToken) {
      encryptedCredentials.refreshToken = encrypt(refreshToken);
    }

    await db.platformConnection.upsert({
      where: { botId_platform: { botId, platform: 'PINTEREST' } },
      create: {
        botId,
        platform: 'PINTEREST',
        encryptedCredentials,
        config: { username, connectedVia: 'oauth' },
        status: 'CONNECTED',
      },
      update: {
        encryptedCredentials,
        config: { username, connectedVia: 'oauth' },
        status: 'CONNECTED',
        lastError: null,
      },
    });

    return NextResponse.redirect(
      new URL(
        `/dashboard/bots/${botId}/platforms?success=${encodeURIComponent(`Pinterest (${username}) connected successfully`)}`,
        origin
      )
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Pinterest OAuth failed';
    return NextResponse.redirect(
      new URL(
        `/dashboard/bots/${botId}/platforms?error=${encodeURIComponent(message)}`,
        origin
      )
    );
  }
}
