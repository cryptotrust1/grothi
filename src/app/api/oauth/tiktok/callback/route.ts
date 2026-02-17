import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { encrypt } from '@/lib/encryption';

const JWT_SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET!
);

/**
 * GET /api/oauth/tiktok/callback?code=...&state=...
 *
 * Handles the TikTok OAuth 2.0 callback:
 * 1. Validates CSRF state token
 * 2. Exchanges authorization code for access + refresh tokens
 * 3. Fetches user info via /v2/user/info/
 * 4. Stores encrypted tokens in PlatformConnection
 *
 * Official docs:
 * - Token exchange: https://developers.tiktok.com/doc/oauth-user-access-token-management
 * - User info: https://developers.tiktok.com/doc/tiktok-api-v2-get-user-info/
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
    const errorDesc = request.nextUrl.searchParams.get('error_description') || 'TikTok authorization was denied';
    return NextResponse.redirect(
      new URL(`/dashboard?error=${encodeURIComponent(errorDesc)}`, origin)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL('/dashboard?error=' + encodeURIComponent('Missing authorization code'), origin)
    );
  }

  // Verify state token
  let botId: string;
  try {
    const { payload } = await jwtVerify(state, JWT_SECRET);
    botId = payload.botId as string;
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

  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  if (!clientKey || !clientSecret) {
    return NextResponse.redirect(
      new URL(`/dashboard/bots/${botId}/platforms?error=${encodeURIComponent('TikTok OAuth not configured on server')}`, origin)
    );
  }

  const redirectUri = `${origin}/api/oauth/tiktok/callback`;

  try {
    // Step 1: Exchange authorization code for access + refresh tokens
    // TikTok uses JSON body for token exchange
    const tokenRes = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }).toString(),
    });

    const tokenData = await tokenRes.json();

    if (tokenData.error || !tokenData.access_token) {
      const msg = tokenData.error_description || tokenData.error || 'Failed to get access token';
      return NextResponse.redirect(
        new URL(`/dashboard/bots/${botId}/platforms?error=${encodeURIComponent(msg)}`, origin)
      );
    }

    const accessToken = tokenData.access_token as string;
    const refreshToken = tokenData.refresh_token as string | undefined;
    const openId = tokenData.open_id as string | undefined;

    // Step 2: Fetch user info for display name
    let displayName = 'TikTok User';
    let tiktokUsername = '';

    const userInfoRes = await fetch(
      'https://open.tiktokapis.com/v2/user/info/?fields=display_name,username',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (userInfoRes.ok) {
      const userInfoData = await userInfoRes.json();
      const userData = userInfoData.data?.user;
      if (userData) {
        displayName = userData.display_name || 'TikTok User';
        tiktokUsername = userData.username || '';
      }
    }

    // Step 3: Store encrypted tokens
    const encryptedCredentials: Record<string, string> = {
      accessToken: encrypt(accessToken),
    };
    if (refreshToken) {
      encryptedCredentials.refreshToken = encrypt(refreshToken);
    }

    await db.platformConnection.upsert({
      where: { botId_platform: { botId, platform: 'TIKTOK' } },
      create: {
        botId,
        platform: 'TIKTOK',
        encryptedCredentials,
        config: {
          displayName,
          tiktokUsername,
          openId: openId || '',
          connectedVia: 'oauth',
        },
        status: 'CONNECTED',
      },
      update: {
        encryptedCredentials,
        config: {
          displayName,
          tiktokUsername,
          openId: openId || '',
          connectedVia: 'oauth',
        },
        status: 'CONNECTED',
        lastError: null,
      },
    });

    const label = tiktokUsername ? `@${tiktokUsername}` : displayName;
    return NextResponse.redirect(
      new URL(
        `/dashboard/bots/${botId}/platforms?success=${encodeURIComponent(`TikTok (${label}) connected successfully`)}`,
        origin
      )
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : 'TikTok OAuth failed';
    return NextResponse.redirect(
      new URL(
        `/dashboard/bots/${botId}/platforms?error=${encodeURIComponent(message)}`,
        origin
      )
    );
  }
}
