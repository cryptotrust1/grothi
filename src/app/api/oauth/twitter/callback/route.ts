import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { encrypt } from '@/lib/encryption';

const JWT_SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET!
);

/**
 * GET /api/oauth/twitter/callback?code=...&state=...
 *
 * Handles the X (Twitter) OAuth 2.0 callback:
 * 1. Validates CSRF state and extracts PKCE code_verifier
 * 2. Exchanges authorization code + code_verifier for access/refresh tokens
 * 3. Fetches user info (/2/users/me) for the username
 * 4. Stores encrypted tokens in PlatformConnection
 *
 * Official docs:
 * - Token exchange: https://developer.twitter.com/en/docs/authentication/oauth-2-0/user-access-token
 * - User lookup: https://developer.twitter.com/en/docs/twitter-api/users/lookup/api-reference/get-users-me
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
    const errorDesc = request.nextUrl.searchParams.get('error_description') || 'Twitter authorization was denied';
    return NextResponse.redirect(
      new URL(`/dashboard?error=${encodeURIComponent(errorDesc)}`, origin)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL('/dashboard?error=' + encodeURIComponent('Missing authorization code'), origin)
    );
  }

  // Verify state and extract PKCE code_verifier
  let botId: string;
  let codeVerifier: string;
  try {
    const { payload } = await jwtVerify(state, JWT_SECRET);
    botId = payload.botId as string;
    codeVerifier = payload.codeVerifier as string;
    const stateUserId = payload.userId as string;

    if (stateUserId !== user.id) {
      return NextResponse.redirect(
        new URL('/dashboard?error=' + encodeURIComponent('Session mismatch'), origin)
      );
    }
  } catch {
    return NextResponse.redirect(
      new URL('/dashboard?error=' + encodeURIComponent('Invalid or expired state token. Please try again.'), origin)
    );
  }

  // Verify bot ownership
  const bot = await db.bot.findFirst({ where: { id: botId, userId: user.id } });
  if (!bot) {
    return NextResponse.redirect(
      new URL('/dashboard?error=' + encodeURIComponent('Bot not found'), origin)
    );
  }

  const clientId = process.env.TWITTER_CLIENT_ID;
  const clientSecret = process.env.TWITTER_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      new URL(`/dashboard/bots/${botId}/platforms?error=${encodeURIComponent('Twitter OAuth not configured on server')}`, origin)
    );
  }

  const redirectUri = `${origin}/api/oauth/twitter/callback`;

  try {
    // Step 1: Exchange authorization code for access + refresh tokens
    // X uses Basic Auth (client_id:client_secret) for confidential clients
    const tokenRes = await fetch('https://api.x.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }).toString(),
    });

    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      const msg = tokenData.error_description || tokenData.error || 'Failed to get access token';
      return NextResponse.redirect(
        new URL(`/dashboard/bots/${botId}/platforms?error=${encodeURIComponent(msg)}`, origin)
      );
    }

    const accessToken = tokenData.access_token as string;
    const refreshToken = tokenData.refresh_token as string | undefined;

    // Step 2: Fetch user info to get username
    const userRes = await fetch('https://api.x.com/2/users/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const userData = await userRes.json();

    const username = userData.data?.username || 'unknown';
    const xUserId = userData.data?.id || '';

    // Step 3: Store encrypted tokens
    const encryptedCredentials: Record<string, string> = {
      accessToken: encrypt(accessToken),
    };
    if (refreshToken) {
      encryptedCredentials.refreshToken = encrypt(refreshToken);
    }

    await db.platformConnection.upsert({
      where: { botId_platform: { botId, platform: 'TWITTER' } },
      create: {
        botId,
        platform: 'TWITTER',
        encryptedCredentials,
        config: { username, xUserId, connectedVia: 'oauth' },
        status: 'CONNECTED',
      },
      update: {
        encryptedCredentials,
        config: { username, xUserId, connectedVia: 'oauth' },
        status: 'CONNECTED',
        lastError: null,
      },
    });

    return NextResponse.redirect(
      new URL(
        `/dashboard/bots/${botId}/platforms?success=${encodeURIComponent(`X (@${username}) connected successfully`)}`,
        origin
      )
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Twitter OAuth failed';
    return NextResponse.redirect(
      new URL(
        `/dashboard/bots/${botId}/platforms?error=${encodeURIComponent(message)}`,
        origin
      )
    );
  }
}
