import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { SignJWT } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET!
);

/**
 * GET /api/oauth/instagram?botId=xxx
 *
 * Initiates the Instagram OAuth flow via Instagram Business Login (Direct Login).
 * Uses the Instagram App (separate from Facebook App) with instagram_business_* scopes.
 *
 * Official docs:
 * - https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login
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

  const baseUrl = process.env.NEXTAUTH_URL || request.nextUrl.origin;

  const appId = process.env.INSTAGRAM_APP_ID;
  if (!appId) {
    const errorMsg = encodeURIComponent('Instagram OAuth is not yet configured. Please add INSTAGRAM_APP_ID to env vars.');
    return NextResponse.redirect(new URL(`/dashboard/bots/${botId}/platforms?error=${errorMsg}`, baseUrl));
  }

  const redirectUri = `${baseUrl}/api/oauth/instagram/callback`;

  // Signed state token for CSRF protection
  const state = await new SignJWT({ botId, userId: user.id })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('10m')
    .setIssuedAt()
    .sign(JWT_SECRET);

  // Instagram Business Login scopes (api.instagram.com/oauth/authorize):
  // - instagram_business_basic: read profile info and media
  // - instagram_business_content_publish: create posts on Instagram
  //
  // NOTE: Do NOT use these scopes with facebook.com/dialog/oauth — that's Facebook Login.
  const scopes = [
    'instagram_business_basic',
    'instagram_business_content_publish',
  ].join(',');

  // Instagram Direct Login uses api.instagram.com, NOT facebook.com
  const authUrl = new URL('https://api.instagram.com/oauth/authorize');
  authUrl.searchParams.set('client_id', appId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('scope', scopes);
  authUrl.searchParams.set('response_type', 'code');
  // enable_fb_login=0 ensures only Instagram login, not Facebook
  authUrl.searchParams.set('enable_fb_login', '0');

  return NextResponse.redirect(authUrl.toString());
}
