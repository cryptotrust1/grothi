import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { SignJWT } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET!
);

/**
 * GET /api/oauth/youtube?botId=xxx
 *
 * Initiates the Google/YouTube OAuth 2.0 authorization flow.
 * Uses Google's OAuth 2.0 for Web Server Applications.
 *
 * Official docs: https://developers.google.com/youtube/v3/guides/auth/server-side-web-apps
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

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    const errorMsg = encodeURIComponent('YouTube OAuth is not yet configured. Please use manual credentials for now, or contact support.');
    return NextResponse.redirect(new URL(botId ? `/dashboard/bots/${botId}/platforms?error=${errorMsg}` : `/dashboard?error=${errorMsg}`, request.nextUrl.origin));
  }

  const baseUrl = process.env.NEXTAUTH_URL || request.nextUrl.origin;
  const redirectUri = `${baseUrl}/api/oauth/youtube/callback`;

  const state = await new SignJWT({ botId, userId: user.id })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('10m')
    .setIssuedAt()
    .sign(JWT_SECRET);

  // Scopes:
  // - youtube.upload: Upload videos
  // - youtube.force-ssl: Manage YouTube account (community posts, comments, etc.)
  const scopes = [
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube.force-ssl',
  ].join(' ');

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', scopes);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('access_type', 'offline'); // Get refresh token
  authUrl.searchParams.set('prompt', 'consent'); // Always show consent to get refresh token

  return NextResponse.redirect(authUrl.toString());
}
