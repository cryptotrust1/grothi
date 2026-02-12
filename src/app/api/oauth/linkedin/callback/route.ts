import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { encrypt } from '@/lib/encryption';

const JWT_SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET || 'fallback-secret-change-me'
);

/**
 * GET /api/oauth/linkedin/callback?code=...&state=...
 *
 * Handles the LinkedIn OAuth 2.0 callback:
 * 1. Validates CSRF state token
 * 2. Exchanges authorization code for access token
 * 3. Fetches user profile info via /v2/userinfo (OpenID Connect)
 * 4. Stores encrypted access token in PlatformConnection
 *
 * Official docs:
 * - Token exchange: https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow
 * - UserInfo: https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2
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
    const errorDesc = request.nextUrl.searchParams.get('error_description') || 'LinkedIn authorization was denied';
    return NextResponse.redirect(
      new URL(`/dashboard?error=${encodeURIComponent(errorDesc)}`, request.nextUrl.origin)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL('/dashboard?error=' + encodeURIComponent('Missing authorization code'), request.nextUrl.origin)
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
        new URL('/dashboard?error=' + encodeURIComponent('Session mismatch'), request.nextUrl.origin)
      );
    }
  } catch {
    return NextResponse.redirect(
      new URL('/dashboard?error=' + encodeURIComponent('Invalid or expired state token. Please try again.'), request.nextUrl.origin)
    );
  }

  // Verify bot ownership
  const bot = await db.bot.findFirst({ where: { id: botId, userId: user.id } });
  if (!bot) {
    return NextResponse.redirect(
      new URL('/dashboard?error=' + encodeURIComponent('Bot not found'), request.nextUrl.origin)
    );
  }

  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      new URL(`/dashboard/bots/${botId}/platforms?error=${encodeURIComponent('LinkedIn OAuth not configured on server')}`, request.nextUrl.origin)
    );
  }

  const baseUrl = process.env.NEXTAUTH_URL || request.nextUrl.origin;
  const redirectUri = `${baseUrl}/api/oauth/linkedin/callback`;

  try {
    // Step 1: Exchange authorization code for access token
    const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
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

    // Step 2: Fetch user profile info via OpenID Connect userinfo endpoint
    const userInfoRes = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    let profileName = 'LinkedIn User';
    let linkedInSub = '';
    if (userInfoRes.ok) {
      const userInfo = await userInfoRes.json();
      profileName = userInfo.name || `${userInfo.given_name || ''} ${userInfo.family_name || ''}`.trim() || 'LinkedIn User';
      linkedInSub = userInfo.sub || '';
    }

    // Step 3: Store encrypted tokens
    const encryptedCredentials: Record<string, string> = {
      accessToken: encrypt(accessToken),
    };
    if (refreshToken) {
      encryptedCredentials.refreshToken = encrypt(refreshToken);
    }

    await db.platformConnection.upsert({
      where: { botId_platform: { botId, platform: 'LINKEDIN' } },
      create: {
        botId,
        platform: 'LINKEDIN',
        encryptedCredentials,
        config: { profileName, linkedInSub, connectedVia: 'oauth' },
        status: 'CONNECTED',
      },
      update: {
        encryptedCredentials,
        config: { profileName, linkedInSub, connectedVia: 'oauth' },
        status: 'CONNECTED',
        lastError: null,
      },
    });

    return NextResponse.redirect(
      new URL(
        `/dashboard/bots/${botId}/platforms?success=${encodeURIComponent(`LinkedIn (${profileName}) connected successfully`)}`,
        request.nextUrl.origin
      )
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : 'LinkedIn OAuth failed';
    return NextResponse.redirect(
      new URL(
        `/dashboard/bots/${botId}/platforms?error=${encodeURIComponent(message)}`,
        request.nextUrl.origin
      )
    );
  }
}
