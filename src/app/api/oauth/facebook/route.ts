import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { SignJWT } from 'jose';

const FB_GRAPH_VERSION = 'v21.0';
const JWT_SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET || 'fallback-secret-change-me'
);

/**
 * GET /api/oauth/facebook?botId=xxx
 *
 * Initiates the Facebook OAuth flow. Redirects the user to Meta's
 * authorization dialog with the required scopes for Page management.
 *
 * Official docs: https://developers.facebook.com/docs/facebook-login/guides/advanced/manual-flow
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
      { error: 'Facebook OAuth not configured. FACEBOOK_APP_ID is missing.' },
      { status: 500 }
    );
  }

  // Build the callback URL
  const baseUrl = process.env.NEXTAUTH_URL || request.nextUrl.origin;
  const redirectUri = `${baseUrl}/api/oauth/facebook/callback`;

  // Create a signed state token with botId + userId for CSRF protection
  const state = await new SignJWT({ botId, userId: user.id })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('10m')
    .setIssuedAt()
    .sign(JWT_SECRET);

  // Required scopes for posting to Pages:
  // - pages_show_list: list pages the user manages
  // - pages_read_engagement: read page engagement (required by pages_manage_posts)
  // - pages_manage_posts: create/edit/delete posts on pages
  const scopes = [
    'pages_show_list',
    'pages_read_engagement',
    'pages_manage_posts',
  ].join(',');

  const authUrl = new URL(`https://www.facebook.com/${FB_GRAPH_VERSION}/dialog/oauth`);
  authUrl.searchParams.set('client_id', appId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('scope', scopes);
  authUrl.searchParams.set('response_type', 'code');

  return NextResponse.redirect(authUrl.toString());
}
