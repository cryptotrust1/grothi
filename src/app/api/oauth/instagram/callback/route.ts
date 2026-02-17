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

interface IGAccount {
  igAccountId: string;
  igUsername: string;
  pageId: string;
  pageName: string;
  pageAccessToken: string;
}

/**
 * GET /api/oauth/instagram/callback?code=...&state=...
 *
 * Handles the Instagram OAuth callback via Meta's Facebook Login:
 * 1. Validates CSRF state token
 * 2. Exchanges code for user access token → long-lived token
 * 3. Fetches Pages via /me/accounts
 * 4. For each Page, checks for linked Instagram Business Account
 * 5. If 1 account → auto-connects; if multiple → shows picker
 *
 * Official docs:
 * - Instagram Graph API: https://developers.facebook.com/docs/instagram-api/getting-started
 * - Get IG account from Page: https://developers.facebook.com/docs/instagram-api/reference/page
 */
export async function GET(request: NextRequest) {
  const origin = process.env.NEXTAUTH_URL || request.nextUrl.origin;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL('/auth/signin', origin));
  }

  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const errorParam = request.nextUrl.searchParams.get('error');

  if (errorParam) {
    const errorDesc = request.nextUrl.searchParams.get('error_description') || 'Instagram authorization was denied';
    return NextResponse.redirect(
      new URL(`/dashboard?error=${encodeURIComponent(errorDesc)}`, origin)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL('/dashboard?error=' + encodeURIComponent('Missing authorization code'), origin)
    );
  }

  // Verify state token
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

  // Verify bot ownership
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
      new URL(`/dashboard/bots/${botId}/platforms?error=${encodeURIComponent('Instagram OAuth not configured on server')}`, origin)
    );
  }

  const redirectUri = `${origin}/api/oauth/instagram/callback`;

  try {
    // Step 1: Exchange authorization code for short-lived user access token
    const tokenUrl = new URL(`${GRAPH_BASE}/oauth/access_token`);
    tokenUrl.searchParams.set('client_id', appId);
    tokenUrl.searchParams.set('client_secret', appSecret);
    tokenUrl.searchParams.set('redirect_uri', redirectUri);
    tokenUrl.searchParams.set('code', code);

    const tokenRes = await fetch(tokenUrl.toString());
    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      const msg = tokenData.error.message || 'Failed to get access token';
      return NextResponse.redirect(
        new URL(`/dashboard/bots/${botId}/platforms?error=${encodeURIComponent(msg)}`, origin)
      );
    }

    // Step 2: Exchange for long-lived user access token
    const longLivedUrl = new URL(`${GRAPH_BASE}/oauth/access_token`);
    longLivedUrl.searchParams.set('grant_type', 'fb_exchange_token');
    longLivedUrl.searchParams.set('client_id', appId);
    longLivedUrl.searchParams.set('client_secret', appSecret);
    longLivedUrl.searchParams.set('fb_exchange_token', tokenData.access_token);

    const longLivedRes = await fetch(longLivedUrl.toString());
    const longLivedData = await longLivedRes.json();

    if (longLivedData.error) {
      const msg = longLivedData.error.message || 'Failed to get long-lived token';
      return NextResponse.redirect(
        new URL(`/dashboard/bots/${botId}/platforms?error=${encodeURIComponent(msg)}`, origin)
      );
    }

    const longLivedUserToken = longLivedData.access_token as string;

    // Step 3: Fetch Pages with their access tokens
    const pagesUrl = new URL(`${GRAPH_BASE}/me/accounts`);
    pagesUrl.searchParams.set('access_token', longLivedUserToken);
    pagesUrl.searchParams.set('fields', 'id,name,access_token');

    const pagesRes = await fetch(pagesUrl.toString());
    const pagesData = await pagesRes.json();

    if (pagesData.error) {
      const msg = pagesData.error.message || 'Failed to fetch pages';
      return NextResponse.redirect(
        new URL(`/dashboard/bots/${botId}/platforms?error=${encodeURIComponent(msg)}`, origin)
      );
    }

    const pages = pagesData.data || [];
    if (pages.length === 0) {
      return NextResponse.redirect(
        new URL(
          `/dashboard/bots/${botId}/platforms?error=${encodeURIComponent('No Facebook Pages found. Instagram Business accounts must be linked to a Facebook Page.')}`,
          origin
        )
      );
    }

    // Step 4: For each Page, check for a linked Instagram Business Account
    const igAccounts: IGAccount[] = [];

    for (const page of pages) {
      const igUrl = new URL(`${GRAPH_BASE}/${page.id}`);
      igUrl.searchParams.set('fields', 'instagram_business_account{id,username}');
      igUrl.searchParams.set('access_token', page.access_token);

      const igRes = await fetch(igUrl.toString());
      const igData = await igRes.json();

      if (igData.instagram_business_account) {
        igAccounts.push({
          igAccountId: igData.instagram_business_account.id,
          igUsername: igData.instagram_business_account.username || 'unknown',
          pageId: page.id,
          pageName: page.name,
          pageAccessToken: page.access_token,
        });
      }
    }

    if (igAccounts.length === 0) {
      return NextResponse.redirect(
        new URL(
          `/dashboard/bots/${botId}/platforms?error=${encodeURIComponent('No Instagram Business accounts found linked to your Facebook Pages. Make sure your Instagram account is a Business or Creator account and is linked to a Facebook Page.')}`,
          origin
        )
      );
    }

    // Step 5: Auto-connect if single account, otherwise show picker
    if (igAccounts.length === 1) {
      const acct = igAccounts[0];
      await saveInstagramConnection(botId, acct);

      return NextResponse.redirect(
        new URL(
          `/dashboard/bots/${botId}/platforms?success=${encodeURIComponent(`Instagram @${acct.igUsername} connected successfully`)}`,
          origin
        )
      );
    }

    // Multiple accounts: create picker token
    const pickerPayload = igAccounts.map((a) => ({
      igAccountId: a.igAccountId,
      igUsername: a.igUsername,
      pageId: a.pageId,
      pageName: a.pageName,
      token: a.pageAccessToken,
    }));

    const pickerToken = await new SignJWT({ botId, accounts: pickerPayload })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('10m')
      .setIssuedAt()
      .sign(JWT_SECRET);

    return NextResponse.redirect(
      new URL(
        `/dashboard/bots/${botId}/platforms/instagram-select?token=${encodeURIComponent(pickerToken)}`,
        origin
      )
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Instagram OAuth failed';
    return NextResponse.redirect(
      new URL(
        `/dashboard/bots/${botId}/platforms?error=${encodeURIComponent(message)}`,
        origin
      )
    );
  }
}

/**
 * Save an Instagram Business Account connection with encrypted credentials.
 * We store the Page Access Token (used for Instagram Graph API calls)
 * and the Instagram Business Account ID.
 */
async function saveInstagramConnection(botId: string, acct: IGAccount) {
  const encryptedCredentials = {
    accountId: encrypt(acct.igAccountId),
    accessToken: encrypt(acct.pageAccessToken),
  };

  await db.platformConnection.upsert({
    where: { botId_platform: { botId, platform: 'INSTAGRAM' } },
    create: {
      botId,
      platform: 'INSTAGRAM',
      encryptedCredentials,
      config: {
        igUsername: acct.igUsername,
        pageName: acct.pageName,
        connectedVia: 'oauth',
      },
      status: 'CONNECTED',
    },
    update: {
      encryptedCredentials,
      config: {
        igUsername: acct.igUsername,
        pageName: acct.pageName,
        connectedVia: 'oauth',
      },
      status: 'CONNECTED',
      lastError: null,
    },
  });
}
