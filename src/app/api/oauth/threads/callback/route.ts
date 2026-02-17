import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { encrypt } from '@/lib/encryption';

const JWT_SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET!
);

/**
 * GET /api/oauth/threads/callback?code=...&state=...
 *
 * Handles the Threads OAuth 2.0 callback:
 * 1. Validates CSRF state token
 * 2. Exchanges authorization code for short-lived access token
 * 3. Exchanges short-lived token for long-lived token (60 days)
 * 4. Fetches Threads user profile
 * 5. Stores encrypted tokens in PlatformConnection
 *
 * Official docs: https://developers.facebook.com/docs/threads/
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
    const errorDesc = request.nextUrl.searchParams.get('error_description') || 'Threads authorization was denied';
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

  const appId = process.env.THREADS_APP_ID;
  const appSecret = process.env.THREADS_APP_SECRET;
  if (!appId || !appSecret) {
    return NextResponse.redirect(
      new URL(`/dashboard/bots/${botId}/platforms?error=${encodeURIComponent('Threads OAuth not configured on server')}`, origin)
    );
  }

  const redirectUri = `${origin}/api/oauth/threads/callback`;

  try {
    // Step 1: Exchange code for short-lived access token
    const tokenRes = await fetch('https://graph.threads.net/oauth/access_token', {
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

    if (tokenData.error || !tokenData.access_token) {
      const msg = tokenData.error_message || tokenData.error?.message || 'Failed to get access token';
      return NextResponse.redirect(
        new URL(`/dashboard/bots/${botId}/platforms?error=${encodeURIComponent(msg)}`, origin)
      );
    }

    const shortLivedToken = tokenData.access_token as string;
    // user_id from token exchange may be a number - ensure string conversion
    const tokenUserId = tokenData.user_id != null ? String(tokenData.user_id) : '';

    // Step 2: Exchange for long-lived token (60 days)
    const longLivedUrl = new URL('https://graph.threads.net/access_token');
    longLivedUrl.searchParams.set('grant_type', 'th_exchange_token');
    longLivedUrl.searchParams.set('client_secret', appSecret);
    longLivedUrl.searchParams.set('access_token', shortLivedToken);

    const longLivedRes = await fetch(longLivedUrl.toString());
    const longLivedData = await longLivedRes.json();

    const accessToken = longLivedData.access_token || shortLivedToken;
    const tokenExpiresIn = longLivedData.expires_in || 5184000; // Default 60 days

    // Step 3: Fetch Threads user profile using 'me' endpoint (most reliable)
    let threadsUsername = 'Threads User';
    let threadsUserId = tokenUserId;

    const profileRes = await fetch(
      `https://graph.threads.net/v1.0/me?fields=id,username,threads_profile_picture_url&access_token=${encodeURIComponent(accessToken)}`
    );
    if (profileRes.ok) {
      const profileData = await profileRes.json();
      threadsUsername = profileData.username || 'Threads User';
      // Use the ID from profile response as the definitive user ID
      if (profileData.id) {
        threadsUserId = String(profileData.id);
      }
    }

    // Step 4: Store encrypted tokens
    const encryptedCredentials: Record<string, string> = {
      accessToken: encrypt(accessToken),
    };

    await db.platformConnection.upsert({
      where: { botId_platform: { botId, platform: 'THREADS' } },
      create: {
        botId,
        platform: 'THREADS',
        encryptedCredentials,
        config: {
          threadsUsername,
          threadsUserId,
          connectedVia: 'oauth',
          tokenRefreshedAt: new Date().toISOString(),
          tokenExpiresAt: new Date(Date.now() + tokenExpiresIn * 1000).toISOString(),
        },
        status: 'CONNECTED',
      },
      update: {
        encryptedCredentials,
        config: {
          threadsUsername,
          threadsUserId,
          connectedVia: 'oauth',
          tokenRefreshedAt: new Date().toISOString(),
          tokenExpiresAt: new Date(Date.now() + tokenExpiresIn * 1000).toISOString(),
        },
        status: 'CONNECTED',
        lastError: null,
      },
    });

    return NextResponse.redirect(
      new URL(
        `/dashboard/bots/${botId}/platforms?success=${encodeURIComponent(`Threads (@${threadsUsername}) connected successfully`)}`,
        origin
      )
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Threads OAuth failed';
    return NextResponse.redirect(
      new URL(
        `/dashboard/bots/${botId}/platforms?error=${encodeURIComponent(message)}`,
        origin
      )
    );
  }
}
