import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { SignJWT } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET!
);

/**
 * GET /api/oauth/linkedin?botId=xxx
 *
 * Initiates the LinkedIn OAuth 2.0 3-legged authorization flow.
 * Uses "Share on LinkedIn" product scopes to post on behalf of the user.
 *
 * Official docs: https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const botId = request.nextUrl.searchParams.get('botId');
  if (!botId) {
    return NextResponse.json({ error: 'Missing botId' }, { status: 400 });
  }

  const clientId = process.env.LINKEDIN_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: 'LinkedIn OAuth not configured. LINKEDIN_CLIENT_ID is missing.' },
      { status: 500 }
    );
  }

  const baseUrl = process.env.NEXTAUTH_URL || request.nextUrl.origin;
  const redirectUri = `${baseUrl}/api/oauth/linkedin/callback`;

  // Signed state token for CSRF protection
  const state = await new SignJWT({ botId, userId: user.id })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('10m')
    .setIssuedAt()
    .sign(JWT_SECRET);

  // Scopes:
  // - openid: OpenID Connect (required for Sign In with LinkedIn)
  // - profile: Basic profile info
  // - w_member_social: Post, comment, like on behalf of the member
  const scopes = [
    'openid',
    'profile',
    'w_member_social',
  ].join(' ');

  const authUrl = new URL('https://www.linkedin.com/oauth/v2/authorization');
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('scope', scopes);

  return NextResponse.redirect(authUrl.toString());
}
