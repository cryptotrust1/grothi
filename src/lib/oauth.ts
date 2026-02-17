import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { SignJWT, jwtVerify } from 'jose';
import { encrypt, decrypt } from './encryption';

// ============ CONFIGURATION ============

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_SCOPES = ['https://mail.google.com/'];

const MICROSOFT_AUTH_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
const MICROSOFT_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
const MICROSOFT_SCOPES = ['https://outlook.office.com/SMTP.Send', 'offline_access', 'openid', 'email'];

// ============ ENVIRONMENT HELPERS ============

function getGoogleCredentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables are required');
  }
  return { clientId, clientSecret };
}

function getMicrosoftCredentials() {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET environment variables are required');
  }
  return { clientId, clientSecret };
}

function getBaseUrl(): string {
  return process.env.NEXTAUTH_URL || 'https://grothi.com';
}

function getJwtSecret() {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error('NEXTAUTH_SECRET environment variable is required');
  return new TextEncoder().encode(secret);
}

/**
 * Create a signed JWT state token for CSRF protection.
 * Contains botId and userId, expires in 10 minutes.
 */
export async function createOAuthState(botId: string, userId: string): Promise<string> {
  return new SignJWT({ botId, userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('10m')
    .setIssuedAt()
    .sign(getJwtSecret());
}

/**
 * Verify and decode a signed JWT state token.
 * Throws if expired, tampered, or invalid.
 */
export async function verifyOAuthState(state: string): Promise<{ botId: string; userId: string }> {
  const { payload } = await jwtVerify(state, getJwtSecret());
  const botId = payload.botId as string;
  const userId = payload.userId as string;
  if (!botId || !userId) throw new Error('Invalid state token payload');
  return { botId, userId };
}

// ============ TOKEN TYPES ============

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export interface OAuthAccount {
  email: string;
  oauthAccessToken: string;   // encrypted
  oauthRefreshToken: string;  // encrypted
  oauthTokenExpiry: Date;
  provider: 'GOOGLE' | 'MICROSOFT';
}

// ============ OAUTH URL GENERATION ============

/**
 * Generate Google OAuth2 consent URL for Gmail SMTP access.
 * State parameter is a signed JWT for CSRF protection.
 */
export function getGoogleOAuthUrl(signedState: string): string {
  const { clientId } = getGoogleCredentials();
  const redirectUri = `${getBaseUrl()}/api/email/oauth/google/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GOOGLE_SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state: signedState,
  });

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

/**
 * Generate Microsoft OAuth2 consent URL for Outlook SMTP access.
 * State parameter is a signed JWT for CSRF protection.
 */
export function getMicrosoftOAuthUrl(signedState: string): string {
  const { clientId } = getMicrosoftCredentials();
  const redirectUri = `${getBaseUrl()}/api/email/oauth/microsoft/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: MICROSOFT_SCOPES.join(' '),
    response_mode: 'query',
    state: signedState,
  });

  return `${MICROSOFT_AUTH_URL}?${params.toString()}`;
}

// ============ TOKEN EXCHANGE ============

/**
 * Exchange a Google authorization code for access and refresh tokens.
 * Called from the OAuth callback route after user grants consent.
 */
export async function exchangeGoogleCode(code: string): Promise<OAuthTokens> {
  const { clientId, clientSecret } = getGoogleCredentials();
  const redirectUri = `${getBaseUrl()}/api/email/oauth/google/callback`;

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Google token exchange failed (${response.status}): ${errorBody}`);
  }

  const data = await response.json();

  if (!data.access_token || !data.refresh_token) {
    throw new Error('Google token exchange did not return required tokens');
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + (data.expires_in || 3600) * 1000),
  };
}

/**
 * Exchange a Microsoft authorization code for access and refresh tokens.
 * Called from the OAuth callback route after user grants consent.
 */
export async function exchangeMicrosoftCode(code: string): Promise<OAuthTokens> {
  const { clientId, clientSecret } = getMicrosoftCredentials();
  const redirectUri = `${getBaseUrl()}/api/email/oauth/microsoft/callback`;

  const response = await fetch(MICROSOFT_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Microsoft token exchange failed (${response.status}): ${errorBody}`);
  }

  const data = await response.json();

  if (!data.access_token || !data.refresh_token) {
    throw new Error('Microsoft token exchange did not return required tokens');
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + (data.expires_in || 3600) * 1000),
  };
}

// ============ TOKEN REFRESH ============

/**
 * Refresh an expired Google access token using the stored refresh token.
 * Returns new access token and updated expiry. Refresh token remains the same.
 */
export async function refreshGoogleToken(refreshToken: string): Promise<{ accessToken: string; expiresAt: Date }> {
  const { clientId, clientSecret } = getGoogleCredentials();

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Google token refresh failed (${response.status}): ${errorBody}`);
  }

  const data = await response.json();

  if (!data.access_token) {
    throw new Error('Google token refresh did not return an access token');
  }

  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + (data.expires_in || 3600) * 1000),
  };
}

/**
 * Refresh an expired Microsoft access token using the stored refresh token.
 * Returns new access token and updated expiry. Refresh token remains the same.
 */
export async function refreshMicrosoftToken(refreshToken: string): Promise<{ accessToken: string; expiresAt: Date }> {
  const { clientId, clientSecret } = getMicrosoftCredentials();

  const response = await fetch(MICROSOFT_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      scope: MICROSOFT_SCOPES.join(' '),
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Microsoft token refresh failed (${response.status}): ${errorBody}`);
  }

  const data = await response.json();

  if (!data.access_token) {
    throw new Error('Microsoft token refresh did not return an access token');
  }

  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + (data.expires_in || 3600) * 1000),
  };
}

// ============ ENCRYPTION HELPERS ============

/**
 * Encrypt OAuth tokens for secure database storage.
 */
export function encryptTokens(tokens: OAuthTokens): {
  encryptedAccessToken: string;
  encryptedRefreshToken: string;
  expiresAt: Date;
} {
  return {
    encryptedAccessToken: encrypt(tokens.accessToken),
    encryptedRefreshToken: encrypt(tokens.refreshToken),
    expiresAt: tokens.expiresAt,
  };
}

/**
 * Decrypt stored OAuth tokens for use.
 */
export function decryptTokens(encrypted: {
  accessToken: string;
  refreshToken: string;
  tokenExpiry: Date;
}): { accessToken: string; refreshToken: string; expiresAt: Date } {
  return {
    accessToken: decrypt(encrypted.accessToken),
    refreshToken: decrypt(encrypted.refreshToken),
    expiresAt: encrypted.tokenExpiry,
  };
}

// ============ NODEMAILER TRANSPORTER ============

/** Buffer time (5 minutes) before actual expiry to trigger a proactive refresh. */
const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000;

/**
 * Create a nodemailer transporter using OAuth2 credentials.
 *
 * Automatically refreshes the access token if it is expired or about to expire.
 * For Google: uses smtp.gmail.com:465 (SSL) with XOAUTH2.
 * For Microsoft: uses smtp.office365.com:587 (STARTTLS) with XOAUTH2.
 *
 * @param account - Object containing email, encrypted OAuth tokens, expiry, and provider.
 * @returns An object with the transporter and the (possibly refreshed) access token + expiry.
 */
export async function createOAuthTransporter(account: OAuthAccount): Promise<{
  transporter: Transporter;
  accessToken: string;
  expiresAt: Date;
  tokenRefreshed: boolean;
}> {
  // Decrypt stored tokens
  const accessToken = decrypt(account.oauthAccessToken);
  const refreshToken = decrypt(account.oauthRefreshToken);
  const expiresAt = new Date(account.oauthTokenExpiry);

  let currentAccessToken = accessToken;
  let currentExpiresAt = expiresAt;
  let tokenRefreshed = false;

  // Check if token is expired or about to expire
  const now = Date.now();
  if (currentExpiresAt.getTime() - now < TOKEN_EXPIRY_BUFFER_MS) {
    try {
      const refreshed = account.provider === 'GOOGLE'
        ? await refreshGoogleToken(refreshToken)
        : await refreshMicrosoftToken(refreshToken);

      currentAccessToken = refreshed.accessToken;
      currentExpiresAt = refreshed.expiresAt;
      tokenRefreshed = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to refresh ${account.provider} OAuth token: ${message}`);
    }
  }

  // Build provider-specific transport config
  let transporter: Transporter;

  if (account.provider === 'GOOGLE') {
    transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        type: 'OAuth2',
        user: account.email,
        accessToken: currentAccessToken,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
  } else {
    // MICROSOFT
    transporter = nodemailer.createTransport({
      host: 'smtp.office365.com',
      port: 587,
      secure: false,
      requireTLS: true,
      auth: {
        type: 'OAuth2',
        user: account.email,
        accessToken: currentAccessToken,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
  }

  return {
    transporter,
    accessToken: currentAccessToken,
    expiresAt: currentExpiresAt,
    tokenRefreshed,
  };
}
