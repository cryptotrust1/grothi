import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { SignJWT } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET!
);

/**
 * GET /api/oauth/threads?botId=xxx
 *
 * Initiates the Threads OAuth 2.0 authorization flow.
 * Threads has its own OAuth endpoint separate from Facebook/Instagram.
 *
 * Official docs: https://developers.facebook.com/docs/threads/
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

  const appId = process.env.THREADS_APP_ID;
  if (!appId) {
    return NextResponse.json(
      { error: 'Threads OAuth not configured. THREADS_APP_ID is missing.' },
      { status: 500 }
    );
  }

  const baseUrl = process.env.NEXTAUTH_URL || request.nextUrl.origin;
  const redirectUri = `${baseUrl}/api/oauth/threads/callback`;

  const state = await new SignJWT({ botId, userId: user.id })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('10m')
    .setIssuedAt()
    .sign(JWT_SECRET);

  // Scopes:
  // - threads_basic: Read profile info
  // - threads_content_publish: Create posts on Threads
  const scopes = [
    'threads_basic',
    'threads_content_publish',
  ].join(',');

  const authUrl = new URL('https://threads.net/oauth/authorize');
  authUrl.searchParams.set('client_id', appId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', scopes);
  authUrl.searchParams.set('state', state);

  return NextResponse.redirect(authUrl.toString());
}
