import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { verifyTotpToken, decryptTotpSecret } from '@/lib/totp';

// POST /api/auth/2fa/disable — Disable 2FA (requires current code)
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

  await db.user.update({
    where: { id: user.id },
    data: {
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorRecoveryCodes: undefined,
    },
  });

  return NextResponse.json({ success: true });
}
