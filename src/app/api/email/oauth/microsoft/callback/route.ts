import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { encrypt } from '@/lib/encryption';
import { verifyOAuthState } from '@/lib/oauth';

/**
 * Microsoft OAuth2 callback handler.
 * Microsoft redirects here after user grants consent.
 * Verifies state JWT, exchanges auth code for tokens, saves to EmailAccount.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const error = request.nextUrl.searchParams.get('error');
  const errorDescription = request.nextUrl.searchParams.get('error_description');

  const baseUrl = process.env.NEXTAUTH_URL || 'https://grothi.com';

  if (error || !code || !state) {
    return NextResponse.redirect(
      `${baseUrl}/dashboard?error=${encodeURIComponent(errorDescription || error || 'OAuth authorization failed')}`
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

  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      `${baseUrl}/dashboard/bots/${encodeURIComponent(botId)}/email?error=${encodeURIComponent('Microsoft OAuth not configured')}`
    );
  }

  try {
    // Exchange auth code for tokens
    const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${baseUrl}/api/email/oauth/microsoft/callback`,
        grant_type: 'authorization_code',
        scope: 'https://outlook.office.com/SMTP.Send offline_access openid email',
      }),
    });

    if (!tokenResponse.ok) {
      const errBody = await tokenResponse.text();
      console.error('[OAUTH] Microsoft token exchange failed:', errBody);
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

    // Get user email from Microsoft Graph
    const userInfoResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const userInfo = await userInfoResponse.json();
    const userEmail = userInfo.mail || userInfo.userPrincipalName || '';

    // Save to EmailAccount
    const tokenExpiry = new Date(Date.now() + (expires_in || 3600) * 1000);

    await db.emailAccount.upsert({
      where: { botId },
      create: {
        botId,
        provider: 'MICROSOFT',
        authMethod: 'OAUTH2',
        email: userEmail,
        smtpHost: 'smtp.office365.com',
        smtpPort: 587,
        smtpUser: userEmail,
        smtpPass: encrypt('oauth2'), // placeholder — OAuth uses tokens
        smtpSecure: false,
        oauthAccessToken: encrypt(access_token),
        oauthRefreshToken: refresh_token ? encrypt(refresh_token) : null,
        oauthTokenExpiry: tokenExpiry,
        oauthClientId: clientId,
        isVerified: true,
      },
      update: {
        provider: 'MICROSOFT',
        authMethod: 'OAUTH2',
        email: userEmail,
        smtpHost: 'smtp.office365.com',
        smtpPort: 587,
        smtpUser: userEmail,
        smtpSecure: false,
        oauthAccessToken: encrypt(access_token),
        oauthRefreshToken: refresh_token ? encrypt(refresh_token) : null,
        oauthTokenExpiry: tokenExpiry,
        oauthClientId: clientId,
        isVerified: true,
        lastError: null,
      },
    });

    return NextResponse.redirect(
      `${baseUrl}/dashboard/bots/${encodeURIComponent(botId)}/email?success=${encodeURIComponent('Microsoft account connected via OAuth2!')}`
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[OAUTH] Microsoft callback error:', msg);
    return NextResponse.redirect(
      `${baseUrl}/dashboard/bots/${encodeURIComponent(botId)}/email?error=${encodeURIComponent('OAuth error: ' + msg)}`
    );
  }
}
