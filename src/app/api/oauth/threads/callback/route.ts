import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { encrypt } from '@/lib/encryption';

const JWT_SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET || 'fallback-secret-change-me'
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
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL('/auth/signin', request.nextUrl.origin));
  }

  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const errorParam = request.nextUrl.searchParams.get('error');

  if (errorParam) {
    const errorDesc = request.nextUrl.searchParams.get('error_description') || 'Threads authorization was denied';
    return NextResponse.redirect(
      new URL(`/dashboard?error=${encodeURIComponent(errorDesc)}`, request.nextUrl.origin)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL('/dashboard?error=' + encodeURIComponent('Missing authorization code'), request.nextUrl.origin)
    );
  }

  let botId: string;
  try {
    const { payload } = await jwtVerify(state, JWT_SECRET);
    botId = payload.botId as string;
    if (payload.userId !== user.id) {
      return NextResponse.redirect(
        new URL('/dashboard?error=' + encodeURIComponent('Session mismatch'), request.nextUrl.origin)
      );
    }
  } catch {
    return NextResponse.redirect(
      new URL('/dashboard?error=' + encodeURIComponent('Invalid or expired state token. Please try again.'), request.nextUrl.origin)
    );
  }

  const bot = await db.bot.findFirst({ where: { id: botId, userId: user.id } });
  if (!bot) {
    return NextResponse.redirect(
      new URL('/dashboard?error=' + encodeURIComponent('Bot not found'), request.nextUrl.origin)
    );
  }

  const appId = process.env.THREADS_APP_ID;
  const appSecret = process.env.THREADS_APP_SECRET;
  if (!appId || !appSecret) {
    return NextResponse.redirect(
      new URL(`/dashboard/bots/${botId}/platforms?error=${encodeURIComponent('Threads OAuth not configured on server')}`, request.nextUrl.origin)
    );
  }

  const baseUrl = process.env.NEXTAUTH_URL || request.nextUrl.origin;
  const redirectUri = `${baseUrl}/api/oauth/threads/callback`;

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
        new URL(`/dashboard/bots/${botId}/platforms?error=${encodeURIComponent(msg)}`, request.nextUrl.origin)
      );
    }

    const shortLivedToken = tokenData.access_token as string;
    const threadsUserId = tokenData.user_id as string | undefined;

    // Step 2: Exchange for long-lived token (60 days)
    const longLivedUrl = new URL('https://graph.threads.net/access_token');
    longLivedUrl.searchParams.set('grant_type', 'th_exchange_token');
    longLivedUrl.searchParams.set('client_secret', appSecret);
    longLivedUrl.searchParams.set('access_token', shortLivedToken);

    const longLivedRes = await fetch(longLivedUrl.toString());
    const longLivedData = await longLivedRes.json();

    const accessToken = longLivedData.access_token || shortLivedToken;

    // Step 3: Fetch Threads user profile
    let threadsUsername = 'Threads User';
    if (threadsUserId) {
      const profileRes = await fetch(
        `https://graph.threads.net/v1.0/${threadsUserId}?fields=username,threads_profile_picture_url&access_token=${encodeURIComponent(accessToken)}`
      );
      if (profileRes.ok) {
        const profileData = await profileRes.json();
        threadsUsername = profileData.username || 'Threads User';
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
          threadsUserId: threadsUserId || '',
          connectedVia: 'oauth',
        },
        status: 'CONNECTED',
      },
      update: {
        encryptedCredentials,
        config: {
          threadsUsername,
          threadsUserId: threadsUserId || '',
          connectedVia: 'oauth',
        },
        status: 'CONNECTED',
        lastError: null,
      },
    });

    return NextResponse.redirect(
      new URL(
        `/dashboard/bots/${botId}/platforms?success=${encodeURIComponent(`Threads (@${threadsUsername}) connected successfully`)}`,
        request.nextUrl.origin
      )
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Threads OAuth failed';
    return NextResponse.redirect(
      new URL(
        `/dashboard/bots/${botId}/platforms?error=${encodeURIComponent(message)}`,
        request.nextUrl.origin
      )
    );
  }
}
