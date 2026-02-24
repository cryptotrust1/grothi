import { SignJWT, jwtVerify } from 'jose';

/**
 * Shared OAuth helpers for state token generation and verification.
 * Used by all OAuth routes (Facebook, Instagram, Threads, LinkedIn, etc.)
 */

function getJwtSecret(): Uint8Array {
  return new TextEncoder().encode(process.env.NEXTAUTH_SECRET!);
}

/**
 * Create a signed JWT state token for OAuth CSRF protection.
 * Contains botId + userId, expires in 10 minutes.
 * Optional extraClaims can be passed for platform-specific data (e.g. PKCE codeVerifier for Twitter).
 */
export async function createOAuthStateToken(
  botId: string,
  userId: string,
  expiresIn: string = '10m',
  extraClaims: Record<string, unknown> = {}
): Promise<string> {
  return await new SignJWT({ botId, userId, ...extraClaims })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(expiresIn)
    .setIssuedAt()
    .sign(getJwtSecret());
}

/**
 * Verify an OAuth state token returned from the callback.
 * Returns botId on success, or an error message on failure.
 */
export async function verifyOAuthStateToken(
  state: string,
  currentUserId: string
): Promise<{ botId: string; error?: never } | { botId?: never; error: string }> {
  try {
    const { payload } = await jwtVerify(state, getJwtSecret());
    const botId = payload.botId as string;
    const stateUserId = payload.userId as string;

    if (stateUserId !== currentUserId) {
      return { error: 'Session mismatch' };
    }

    return { botId };
  } catch {
    return { error: 'Invalid or expired state token. Please try again.' };
  }
}
