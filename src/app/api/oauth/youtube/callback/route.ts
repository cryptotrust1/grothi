import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { encrypt } from '@/lib/encryption';

const JWT_SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET!
);

/**
 * GET /api/oauth/youtube/callback?code=...&state=...
 *
 * Handles the YouTube/Google OAuth 2.0 callback:
 * 1. Validates CSRF state token
 * 2. Exchanges authorization code for access + refresh tokens
 * 3. Fetches YouTube channel info
 * 4. Stores encrypted tokens in PlatformConnection
 *
 * Official docs: https://developers.google.com/youtube/v3/guides/auth/server-side-web-apps
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
    const errorDesc = request.nextUrl.searchParams.get('error_description') || 'YouTube authorization was denied';
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

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      new URL(`/dashboard/bots/${botId}/platforms?error=${encodeURIComponent('YouTube OAuth not configured on server')}`, request.nextUrl.origin)
    );
  }

  const baseUrl = process.env.NEXTAUTH_URL || request.nextUrl.origin;
  const redirectUri = `${baseUrl}/api/oauth/youtube/callback`;

  try {
    // Step 1: Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
    });

    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      const msg = tokenData.error_description || tokenData.error || 'Failed to get access token';
      return NextResponse.redirect(
        new URL(`/dashboard/bots/${botId}/platforms?error=${encodeURIComponent(msg)}`, request.nextUrl.origin)
      );
    }

    const accessToken = tokenData.access_token as string;
    const refreshToken = tokenData.refresh_token as string | undefined;

    // Step 2: Fetch YouTube channel info
    const channelRes = await fetch(
      'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    let channelName = 'YouTube Channel';
    let channelId = '';
    if (channelRes.ok) {
      const channelData = await channelRes.json();
      const channel = channelData.items?.[0];
      if (channel) {
        channelName = channel.snippet?.title || 'YouTube Channel';
        channelId = channel.id || '';
      }
    }

    // Step 3: Store encrypted tokens
    // We store the refresh token (long-lived) as the primary credential.
    // Access tokens expire in ~1 hour but can be refreshed.
    const encryptedCredentials: Record<string, string> = {
      accessToken: encrypt(accessToken),
    };
    if (refreshToken) {
      encryptedCredentials.refreshToken = encrypt(refreshToken);
    }
    if (channelId) {
      encryptedCredentials.channelId = encrypt(channelId);
    }

    await db.platformConnection.upsert({
      where: { botId_platform: { botId, platform: 'YOUTUBE' } },
      create: {
        botId,
        platform: 'YOUTUBE',
        encryptedCredentials,
        config: { channelName, channelId, connectedVia: 'oauth' },
        status: 'CONNECTED',
      },
      update: {
        encryptedCredentials,
        config: { channelName, channelId, connectedVia: 'oauth' },
        status: 'CONNECTED',
        lastError: null,
      },
    });

    return NextResponse.redirect(
      new URL(
        `/dashboard/bots/${botId}/platforms?success=${encodeURIComponent(`YouTube (${channelName}) connected successfully`)}`,
        request.nextUrl.origin
      )
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : 'YouTube OAuth failed';
    return NextResponse.redirect(
      new URL(
        `/dashboard/bots/${botId}/platforms?error=${encodeURIComponent(message)}`,
        request.nextUrl.origin
      )
    );
  }
}
