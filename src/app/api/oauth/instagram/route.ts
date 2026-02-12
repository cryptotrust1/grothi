import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { SignJWT } from 'jose';

const FB_GRAPH_VERSION = 'v21.0';
const JWT_SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET || 'fallback-secret-change-me'
);

/**
 * GET /api/oauth/instagram?botId=xxx
 *
 * Initiates the Instagram OAuth flow via Meta's Facebook Login.
 * Instagram Business/Creator accounts are linked to Facebook Pages,
 * so we use the same Meta app but request Instagram-specific scopes.
 *
 * Official docs:
 * - https://developers.facebook.com/docs/instagram-platform/getting-started
 * - https://developers.facebook.com/docs/instagram-api/getting-started
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

  const appId = process.env.FACEBOOK_APP_ID;
  if (!appId) {
    return NextResponse.json(
      { error: 'Instagram OAuth not configured. FACEBOOK_APP_ID is missing.' },
      { status: 500 }
    );
  }

  const baseUrl = process.env.NEXTAUTH_URL || request.nextUrl.origin;
  const redirectUri = `${baseUrl}/api/oauth/instagram/callback`;

  // Signed state token for CSRF protection
  const state = await new SignJWT({ botId, userId: user.id })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('10m')
    .setIssuedAt()
    .sign(JWT_SECRET);

  // Required scopes for Instagram content publishing via Facebook Login:
  // - pages_show_list: list pages the user manages (needed to find linked IG account)
  // - instagram_basic: read Instagram profile info and media
  // - instagram_content_publish: create posts, reels, stories on Instagram
  // - pages_read_engagement: required dependency for page-related operations
  const scopes = [
    'pages_show_list',
    'pages_read_engagement',
    'instagram_basic',
    'instagram_content_publish',
  ].join(',');

  const authUrl = new URL(`https://www.facebook.com/${FB_GRAPH_VERSION}/dialog/oauth`);
  authUrl.searchParams.set('client_id', appId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('scope', scopes);
  authUrl.searchParams.set('response_type', 'code');

  return NextResponse.redirect(authUrl.toString());
}
