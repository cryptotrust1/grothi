import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { SignJWT } from 'jose';
import { randomBytes, createHash } from 'crypto';

const JWT_SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET!
);

/**
 * GET /api/oauth/twitter?botId=xxx
 *
 * Initiates the X (Twitter) OAuth 2.0 Authorization Code Flow with PKCE.
 * PKCE is mandatory for all X OAuth 2.0 flows.
 *
 * Official docs: https://developer.twitter.com/en/docs/authentication/oauth-2-0/authorization-code
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

  const clientId = process.env.TWITTER_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: 'Twitter OAuth not configured. TWITTER_CLIENT_ID is missing.' },
      { status: 500 }
    );
  }

  const baseUrl = process.env.NEXTAUTH_URL || request.nextUrl.origin;
  const redirectUri = `${baseUrl}/api/oauth/twitter/callback`;

  // PKCE: Generate code_verifier (43-128 chars, URL-safe random string)
  const codeVerifier = randomBytes(32).toString('base64url');

  // PKCE: code_challenge = BASE64URL(SHA256(code_verifier))
  const codeChallenge = createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');

  // Create signed state with botId, userId, and code_verifier for callback
  const state = await new SignJWT({
    botId,
    userId: user.id,
    codeVerifier,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('10m')
    .setIssuedAt()
    .sign(JWT_SECRET);

  // Scopes needed for posting tweets and reading user info:
  // - tweet.read: Read tweets
  // - tweet.write: Post and delete tweets
  // - users.read: Read user profile info
  // - offline.access: Get refresh token (access tokens expire in 2h)
  const scopes = [
    'tweet.read',
    'tweet.write',
    'users.read',
    'offline.access',
  ].join(' ');

  const authUrl = new URL('https://twitter.com/i/oauth2/authorize');
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', scopes);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  return NextResponse.redirect(authUrl.toString());
}
