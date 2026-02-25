import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { verifyTotpToken, decryptTotpSecret } from '@/lib/totp';
import { twoFactorLimiter } from '@/lib/rate-limit';

// POST /api/auth/2fa/disable — Disable 2FA (requires current code)
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Rate limit: prevents brute-force of the 6-digit TOTP code on disable
  const rateCheck = twoFactorLimiter.check(user.id);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Too many 2FA attempts. Please wait 15 minutes before trying again.' },
      { status: 429 }
    );
  }

  if (!user.twoFactorEnabled || !user.twoFactorSecret) {
    return NextResponse.json({ error: '2FA is not enabled' }, { status: 400 });
  }

  let body: { token?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { token } = body;
  if (!token || typeof token !== 'string' || !/^\d{6}$/.test(token)) {
    return NextResponse.json({ error: 'A valid 6-digit code is required' }, { status: 400 });
  }

  const secret = decryptTotpSecret(user.twoFactorSecret);
  const isValid = verifyTotpToken(token, secret, user.email);

  if (!isValid) {
    return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 });
  }

  // Disable 2FA and revoke ALL active sessions in a single transaction.
  // This forces re-authentication so any stolen session token becomes useless
  // after the 2FA change — an attacker cannot silently downgrade security.
  await db.$transaction([
    db.user.update({
      where: { id: user.id },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorRecoveryCodes: undefined,
      },
    }),
    db.session.deleteMany({ where: { userId: user.id } }),
  ]);

  return NextResponse.json({
    success: true,
    message: 'Two-factor authentication disabled. Please sign in again.',
  });
}
