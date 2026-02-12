import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { SignJWT } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET!
);

/**
 * GET /api/oauth/pinterest?botId=xxx
 *
 * Initiates the Pinterest OAuth 2.0 authorization flow.
 *
 * Official docs: https://developers.pinterest.com/docs/getting-started/set-up-authentication-and-authorization/
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

  const clientId = process.env.PINTEREST_APP_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: 'Pinterest OAuth not configured. PINTEREST_APP_ID is missing.' },
      { status: 500 }
    );
  }

  const baseUrl = process.env.NEXTAUTH_URL || request.nextUrl.origin;
  const redirectUri = `${baseUrl}/api/oauth/pinterest/callback`;

  const state = await new SignJWT({ botId, userId: user.id })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('10m')
    .setIssuedAt()
    .sign(JWT_SECRET);

  // Scopes for creating and managing Pins:
  // - user_accounts:read: Read user profile
  // - pins:read: Read pins
  // - pins:write: Create/update/delete pins
  // - boards:read: Read boards (to list available boards)
  // - boards:write: Create boards if needed
  const scopes = [
    'user_accounts:read',
    'pins:read',
    'pins:write',
    'boards:read',
    'boards:write',
  ].join(',');

  const authUrl = new URL('https://www.pinterest.com/oauth/');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', scopes);
  authUrl.searchParams.set('state', state);

  return NextResponse.redirect(authUrl.toString());
}
