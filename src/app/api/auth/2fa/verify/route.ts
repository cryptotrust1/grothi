import { NextResponse } from 'next/server';
import { verify2FAAndCreateSession } from '@/lib/auth';
import { twoFactorLimiter } from '@/lib/rate-limit';

// POST /api/auth/2fa/verify — Verify TOTP code during sign-in
//
// SECURITY (CWE-307): Without rate limiting, an attacker who intercepts a
// 5-minute pending token can brute-force all 1,000,000 TOTP codes online.
// Rate limit is keyed on pendingToken (first 16 chars as proxy ID) so it
// doesn't reveal the actual user ID to unauthenticated callers.
export async function POST(request: Request) {
  let body: { pendingToken?: string; code?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { pendingToken, code } = body;

  if (!pendingToken || typeof pendingToken !== 'string') {
    return NextResponse.json({ error: 'Missing pending token' }, { status: 400 });
  }

  if (!code || typeof code !== 'string') {
    return NextResponse.json({ error: 'Missing verification code' }, { status: 400 });
  }

  // Rate limit keyed on the pending token (unique per login attempt).
  // 5 attempts per 15 min is sufficient: TOTP window is only 30 seconds
  // and the pending token itself expires in 5 minutes.
  const rateKey = `2fa-verify:${pendingToken.slice(0, 32)}`;
  const rateCheck = twoFactorLimiter.check(rateKey);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Too many verification attempts. Please sign in again.' },
      { status: 429 }
    );
  }

  try {
    await verify2FAAndCreateSession(pendingToken, code);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Verification failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
