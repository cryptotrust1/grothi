import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { encrypt } from '@/lib/encryption';

const JWT_SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET!
);

/**
 * GET /api/oauth/instagram/callback?code=...&state=...
 *
 * Handles the Instagram Direct Login OAuth callback:
 * 1. Validates CSRF state token
 * 2. Exchanges authorization code for short-lived token (api.instagram.com)
 * 3. Exchanges short-lived token for long-lived token (graph.instagram.com)
 * 4. Fetches Instagram user profile (graph.instagram.com/me)
 * 5. Saves encrypted credentials
 *
 * Official docs:
 * - Token exchange: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login
 * - Long-lived tokens: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login#4--get-a-long-lived-token
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
    const errorDesc = request.nextUrl.searchParams.get('error_description') || 'Instagram authorization was denied';
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

  const appId = process.env.INSTAGRAM_APP_ID;
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  if (!appId || !appSecret) {
    return NextResponse.redirect(
      new URL(`/dashboard/bots/${botId}/platforms?error=${encodeURIComponent('Instagram OAuth not configured on server')}`, origin)
    );
  }

  const redirectUri = `${origin}/api/oauth/instagram/callback`;

  try {
    // Step 1: Exchange authorization code for short-lived token
    // Instagram Direct Login uses api.instagram.com (NOT graph.facebook.com)
    // and requires application/x-www-form-urlencoded body
    const tokenRes = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code,
      }).toString(),
    });

    const tokenData = await tokenRes.json();

    if (tokenData.error_message || tokenData.error) {
      const msg = tokenData.error_message || tokenData.error?.message || 'Failed to get access token';
      return NextResponse.redirect(
        new URL(`/dashboard/bots/${botId}/platforms?error=${encodeURIComponent(msg)}`, origin)
      );
    }

    const shortLivedToken = tokenData.access_token as string;
    const igUserId = String(tokenData.user_id);

    if (!shortLivedToken || !igUserId) {
      return NextResponse.redirect(
        new URL(`/dashboard/bots/${botId}/platforms?error=${encodeURIComponent('Invalid token response from Instagram')}`, origin)
      );
    }

    // Step 2: Exchange for long-lived token (60 days, auto-refresh)
    // Uses graph.instagram.com with grant_type=ig_exchange_token
    const longLivedUrl = new URL('https://graph.instagram.com/access_token');
    longLivedUrl.searchParams.set('grant_type', 'ig_exchange_token');
    longLivedUrl.searchParams.set('client_secret', appSecret);
    longLivedUrl.searchParams.set('access_token', shortLivedToken);

    const longLivedRes = await fetch(longLivedUrl.toString());
    const longLivedData = await longLivedRes.json();

    if (longLivedData.error) {
      const msg = longLivedData.error.message || 'Failed to get long-lived token';
      return NextResponse.redirect(
        new URL(`/dashboard/bots/${botId}/platforms?error=${encodeURIComponent(msg)}`, origin)
      );
    }

    const longLivedToken = longLivedData.access_token as string;

    // Step 3: Fetch Instagram profile info
    const profileUrl = new URL('https://graph.instagram.com/me');
    profileUrl.searchParams.set('fields', 'user_id,username,name,profile_picture_url');
    profileUrl.searchParams.set('access_token', longLivedToken);

    const profileRes = await fetch(profileUrl.toString());
    const profileData = await profileRes.json();

    const igUsername = profileData.username || 'unknown';

    // Step 4: Save encrypted credentials
    const encryptedCredentials = {
      accountId: encrypt(igUserId),
      accessToken: encrypt(longLivedToken),
    };

    await db.platformConnection.upsert({
      where: { botId_platform: { botId, platform: 'INSTAGRAM' } },
      create: {
        botId,
        platform: 'INSTAGRAM',
        encryptedCredentials,
        config: {
          igUsername,
          connectedVia: 'instagram_direct_login',
        },
        status: 'CONNECTED',
      },
      update: {
        encryptedCredentials,
        config: {
          igUsername,
          connectedVia: 'instagram_direct_login',
        },
        status: 'CONNECTED',
        lastError: null,
      },
    });

    return NextResponse.redirect(
      new URL(
        `/dashboard/bots/${botId}/platforms?success=${encodeURIComponent(`Instagram @${igUsername} connected successfully`)}`,
        origin
      )
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Instagram OAuth failed';
    return NextResponse.redirect(
      new URL(
        `/dashboard/bots/${botId}/platforms?error=${encodeURIComponent(message)}`,
        origin
      )
    );
  }
}
