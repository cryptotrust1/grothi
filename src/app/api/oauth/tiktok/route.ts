import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { SignJWT } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET!
);

/**
 * GET /api/oauth/tiktok?botId=xxx
 *
 * Initiates the TikTok OAuth 2.0 authorization flow.
 * Uses TikTok Login Kit v2 to get user authorization for content posting.
 *
 * Official docs:
 * - Login Kit: https://developers.tiktok.com/doc/login-kit-manage-user-access-tokens/
 * - Content Posting: https://developers.tiktok.com/doc/content-posting-api-get-started
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

  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  if (!clientKey) {
    return NextResponse.json(
      { error: 'TikTok OAuth not configured. TIKTOK_CLIENT_KEY is missing.' },
      { status: 500 }
    );
  }

  const baseUrl = process.env.NEXTAUTH_URL || request.nextUrl.origin;
  const redirectUri = `${baseUrl}/api/oauth/tiktok/callback`;

  // Signed state token for CSRF protection
  const state = await new SignJWT({ botId, userId: user.id })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('10m')
    .setIssuedAt()
    .sign(JWT_SECRET);

  // Scopes:
  // - user.info.basic: Read basic user info (display name, avatar)
  // - video.publish: Post videos/photos to the user's TikTok account
  const scopes = [
    'user.info.basic',
    'video.publish',
  ].join(',');

  const authUrl = new URL('https://www.tiktok.com/v2/auth/authorize/');
  authUrl.searchParams.set('client_key', clientKey);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', scopes);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('state', state);

  return NextResponse.redirect(authUrl.toString());
}
