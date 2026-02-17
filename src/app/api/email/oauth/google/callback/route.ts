import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { encrypt } from '@/lib/encryption';
import { verifyOAuthState } from '@/lib/oauth';

/**
 * Google OAuth2 callback handler.
 * Google redirects here after user grants consent.
 * Verifies state JWT, exchanges auth code for tokens, saves to EmailAccount.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const error = request.nextUrl.searchParams.get('error');

  const baseUrl = process.env.NEXTAUTH_URL || 'https://grothi.com';

  if (error || !code || !state) {
    return NextResponse.redirect(
      `${baseUrl}/dashboard?error=${encodeURIComponent(error || 'OAuth authorization failed')}`
    );
  }

  // Verify signed state token (CSRF protection)
  let botId: string;
  try {
    const statePayload = await verifyOAuthState(state);
    botId = statePayload.botId;
  } catch {
    return NextResponse.redirect(
      `${baseUrl}/dashboard?error=${encodeURIComponent('Invalid or expired OAuth state. Please try again.')}`
    );
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      `${baseUrl}/dashboard/bots/${encodeURIComponent(botId)}/email?error=${encodeURIComponent('Google OAuth not configured')}`
    );
  }

  try {
    // Exchange auth code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${baseUrl}/api/email/oauth/google/callback`,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errBody = await tokenResponse.text();
      console.error('[OAUTH] Google token exchange failed:', errBody);
      return NextResponse.redirect(
        `${baseUrl}/dashboard/bots/${encodeURIComponent(botId)}/email?error=${encodeURIComponent('Failed to exchange authorization code')}`
      );
    }

    const tokens = await tokenResponse.json();
    const { access_token, refresh_token, expires_in } = tokens;

    if (!access_token) {
      return NextResponse.redirect(
        `${baseUrl}/dashboard/bots/${encodeURIComponent(botId)}/email?error=${encodeURIComponent('No access token received')}`
      );
    }

    // Get user email from Google
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const userInfo = await userInfoResponse.json();
    const userEmail = userInfo.email || '';

    // Save to EmailAccount
    const tokenExpiry = new Date(Date.now() + (expires_in || 3600) * 1000);

    await db.emailAccount.upsert({
      where: { botId },
      create: {
        botId,
        provider: 'GOOGLE',
        authMethod: 'OAUTH2',
        email: userEmail,
        smtpHost: 'smtp.gmail.com',
        smtpPort: 465,
        smtpUser: userEmail,
        smtpPass: encrypt('oauth2'), // placeholder — OAuth uses tokens
        smtpSecure: true,
        oauthAccessToken: encrypt(access_token),
        oauthRefreshToken: refresh_token ? encrypt(refresh_token) : null,
        oauthTokenExpiry: tokenExpiry,
        oauthClientId: clientId,
        isVerified: true,
      },
      update: {
        provider: 'GOOGLE',
        authMethod: 'OAUTH2',
        email: userEmail,
        smtpHost: 'smtp.gmail.com',
        smtpPort: 465,
        smtpUser: userEmail,
        smtpSecure: true,
        oauthAccessToken: encrypt(access_token),
        oauthRefreshToken: refresh_token ? encrypt(refresh_token) : null,
        oauthTokenExpiry: tokenExpiry,
        oauthClientId: clientId,
        isVerified: true,
        lastError: null,
      },
    });

    return NextResponse.redirect(
      `${baseUrl}/dashboard/bots/${encodeURIComponent(botId)}/email?success=${encodeURIComponent('Google account connected via OAuth2!')}`
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[OAUTH] Google callback error:', msg);
    return NextResponse.redirect(
      `${baseUrl}/dashboard/bots/${encodeURIComponent(botId)}/email?error=${encodeURIComponent('OAuth error: ' + msg)}`
    );
  }
}
