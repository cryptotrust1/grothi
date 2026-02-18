import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify, SignJWT } from 'jose';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { encrypt } from '@/lib/encryption';

const FB_GRAPH_VERSION = 'v24.0';
const GRAPH_BASE = `https://graph.facebook.com/${FB_GRAPH_VERSION}`;
const JWT_SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET!
);

interface FBPage {
  id: string;
  name: string;
  access_token: string;
  category: string;
}

/**
 * GET /api/oauth/facebook/callback?code=...&state=...
 *
 * Handles the Facebook OAuth callback:
 * 1. Validates CSRF state token
 * 2. Exchanges authorization code for user access token
 * 3. Exchanges short-lived token for long-lived token
 * 4. Fetches Pages the user manages via /me/accounts
 * 5. If 1 page → auto-connects; if multiple → shows page picker
 *
 * Official docs:
 * - Token exchange: https://developers.facebook.com/docs/facebook-login/guides/access-tokens/get-long-lived
 * - Pages API: https://developers.facebook.com/docs/pages-api/overview
 */
export async function GET(request: NextRequest) {
  // Use NEXTAUTH_URL for all redirects — behind Nginx reverse proxy,
  // origin resolves to localhost:3000 instead of grothi.com
  const origin = process.env.NEXTAUTH_URL || request.nextUrl.origin;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL('/auth/signin', origin));
  }

  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const errorParam = request.nextUrl.searchParams.get('error');

  // User denied permissions on Facebook
  if (errorParam) {
    const errorDesc = request.nextUrl.searchParams.get('error_description') || 'Facebook authorization was denied';
    return NextResponse.redirect(
      new URL(`/dashboard/bots/unknown/platforms?error=${encodeURIComponent(errorDesc)}`, origin)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL('/dashboard?error=' + encodeURIComponent('Missing authorization code'), origin)
    );
  }

  // Verify state token (CSRF protection)
  let botId: string;
  try {
    const { payload } = await jwtVerify(state, JWT_SECRET);
    botId = payload.botId as string;
    const stateUserId = payload.userId as string;

    if (stateUserId !== user.id) {
      return NextResponse.redirect(
        new URL('/dashboard?error=' + encodeURIComponent('Session mismatch'), origin)
      );
    }
  } catch {
    return NextResponse.redirect(
      new URL('/dashboard?error=' + encodeURIComponent('Invalid or expired state token. Please try again.'), origin)
    );
  }

  // Verify bot belongs to user
  const bot = await db.bot.findFirst({ where: { id: botId, userId: user.id } });
  if (!bot) {
    return NextResponse.redirect(
      new URL('/dashboard?error=' + encodeURIComponent('Bot not found'), origin)
    );
  }

  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  if (!appId || !appSecret) {
    return NextResponse.redirect(
      new URL(`/dashboard/bots/${botId}/platforms?error=${encodeURIComponent('Facebook OAuth not configured on server')}`, origin)
    );
  }

  const redirectUri = `${origin}/api/oauth/facebook/callback`;

  try {
    // 30-second timeout for all OAuth API calls
    const oauthController = new AbortController();
    const oauthTimeout = setTimeout(() => oauthController.abort(), 30000);

    // Step 1: Exchange authorization code for short-lived user access token
    const tokenUrl = new URL(`${GRAPH_BASE}/oauth/access_token`);
    tokenUrl.searchParams.set('client_id', appId);
    tokenUrl.searchParams.set('client_secret', appSecret);
    tokenUrl.searchParams.set('redirect_uri', redirectUri);
    tokenUrl.searchParams.set('code', code);

    const tokenRes = await fetch(tokenUrl.toString(), { signal: oauthController.signal });
    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      clearTimeout(oauthTimeout);
      const msg = tokenData.error.message || 'Failed to get access token';
      return NextResponse.redirect(
        new URL(`/dashboard/bots/${botId}/platforms?error=${encodeURIComponent(msg)}`, origin)
      );
    }

    const shortLivedToken = tokenData.access_token as string;
    if (!shortLivedToken) {
      clearTimeout(oauthTimeout);
      return NextResponse.redirect(
        new URL(`/dashboard/bots/${botId}/platforms?error=${encodeURIComponent('Invalid token response from Facebook')}`, origin)
      );
    }

    // Step 2: Exchange for long-lived user access token (60 days)
    // Page tokens derived from long-lived user tokens are permanent (never expire).
    // Docs: https://developers.facebook.com/docs/facebook-login/guides/access-tokens/get-long-lived
    const longLivedUrl = new URL(`${GRAPH_BASE}/oauth/access_token`);
    longLivedUrl.searchParams.set('grant_type', 'fb_exchange_token');
    longLivedUrl.searchParams.set('client_id', appId);
    longLivedUrl.searchParams.set('client_secret', appSecret);
    longLivedUrl.searchParams.set('fb_exchange_token', shortLivedToken);

    const longLivedRes = await fetch(longLivedUrl.toString(), { signal: oauthController.signal });
    const longLivedData = await longLivedRes.json();

    if (longLivedData.error) {
      clearTimeout(oauthTimeout);
      const msg = longLivedData.error.message || 'Failed to get long-lived token';
      return NextResponse.redirect(
        new URL(`/dashboard/bots/${botId}/platforms?error=${encodeURIComponent(msg)}`, origin)
      );
    }

    const longLivedUserToken = longLivedData.access_token as string;
    if (!longLivedUserToken) {
      clearTimeout(oauthTimeout);
      return NextResponse.redirect(
        new URL(`/dashboard/bots/${botId}/platforms?error=${encodeURIComponent('Invalid long-lived token response from Facebook')}`, origin)
      );
    }

    // Step 3: Fetch Pages the user manages
    // Page tokens returned here are automatically permanent when derived from long-lived user token
    const pagesUrl = new URL(`${GRAPH_BASE}/me/accounts`);
    pagesUrl.searchParams.set('access_token', longLivedUserToken);
    pagesUrl.searchParams.set('fields', 'id,name,access_token,category');

    const pagesRes = await fetch(pagesUrl.toString(), { signal: oauthController.signal });
    const pagesData = await pagesRes.json();
    clearTimeout(oauthTimeout);

    if (pagesData.error) {
      const msg = pagesData.error.message || 'Failed to fetch pages';
      return NextResponse.redirect(
        new URL(`/dashboard/bots/${botId}/platforms?error=${encodeURIComponent(msg)}`, origin)
      );
    }

    const pages: FBPage[] = pagesData.data || [];

    if (pages.length === 0) {
      return NextResponse.redirect(
        new URL(
          `/dashboard/bots/${botId}/platforms?error=${encodeURIComponent('No Facebook Pages found. You need to be an admin of at least one Facebook Page.')}`,
          origin
        )
      );
    }

    // Step 4: If exactly one page, auto-connect. Otherwise, show page picker.
    if (pages.length === 1) {
      const page = pages[0];
      await saveFacebookConnection(botId, page.id, page.access_token, page.name);

      return NextResponse.redirect(
        new URL(
          `/dashboard/bots/${botId}/platforms?success=${encodeURIComponent(`Facebook Page "${page.name}" connected successfully`)}`,
          origin
        )
      );
    }

    // Multiple pages: create a signed token with the pages info and redirect to picker
    const pagesPayload = pages.map((p) => ({
      id: p.id,
      name: p.name,
      token: p.access_token,
      category: p.category,
    }));

    const pickerToken = await new SignJWT({ botId, pages: pagesPayload })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('10m')
      .setIssuedAt()
      .sign(JWT_SECRET);

    return NextResponse.redirect(
      new URL(
        `/dashboard/bots/${botId}/platforms/facebook-select?token=${encodeURIComponent(pickerToken)}`,
        origin
      )
    );
  } catch (e) {
    const isTimeout = e instanceof DOMException && e.name === 'AbortError';
    const message = isTimeout
      ? 'Facebook OAuth timed out. Please try again.'
      : e instanceof Error ? e.message : 'Facebook OAuth failed';
    return NextResponse.redirect(
      new URL(
        `/dashboard/bots/${botId}/platforms?error=${encodeURIComponent(message)}`,
        origin
      )
    );
  }
}

/**
 * Save a Facebook Page connection to the database with encrypted credentials.
 */
async function saveFacebookConnection(
  botId: string,
  pageId: string,
  pageAccessToken: string,
  pageName: string
) {
  const encryptedCredentials = {
    pageId: encrypt(pageId),
    accessToken: encrypt(pageAccessToken),
  };

  await db.platformConnection.upsert({
    where: { botId_platform: { botId, platform: 'FACEBOOK' } },
    create: {
      botId,
      platform: 'FACEBOOK',
      encryptedCredentials,
      config: { pageName, connectedVia: 'oauth' },
      status: 'CONNECTED',
    },
    update: {
      encryptedCredentials,
      config: { pageName, connectedVia: 'oauth' },
      status: 'CONNECTED',
      lastError: null,
    },
  });
}
