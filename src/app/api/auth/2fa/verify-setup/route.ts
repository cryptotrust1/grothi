import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { verifyTotpToken, decryptTotpSecret, generateRecoveryCodes } from '@/lib/totp';

// POST /api/auth/2fa/verify-setup — Verify code to confirm setup, returns recovery codes
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (user.twoFactorEnabled) {
    return NextResponse.json({ error: '2FA is already enabled' }, { status: 400 });
  }

  if (!user.twoFactorSecret) {
    return NextResponse.json({ error: 'No 2FA setup in progress. Call /api/auth/2fa/setup first.' }, { status: 400 });
  }

  let body: { token?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { token } = body;
  if (!token || typeof token !== 'string' || !/^\d{6}$/.test(token)) {
    return NextResponse.json({ error: 'Token must be a 6-digit number' }, { status: 400 });
  }

  const secret = decryptTotpSecret(user.twoFactorSecret);
  const isValid = verifyTotpToken(token, secret, user.email);

  if (!isValid) {
    return NextResponse.json({ error: 'Invalid verification code. Please try again.' }, { status: 400 });
  }

  // Generate recovery codes
  const { plainCodes, hashedCodes } = await generateRecoveryCodes();

  await db.user.update({
    where: { id: user.id },
    data: {
      twoFactorEnabled: true,
      twoFactorRecoveryCodes: hashedCodes,
    },
  });

  return NextResponse.json({
    success: true,
    recoveryCodes: plainCodes,
  });
}
