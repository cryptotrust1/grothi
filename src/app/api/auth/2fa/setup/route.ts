import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { generateTotpSecret, generateQrCodeDataUrl, encryptTotpSecret } from '@/lib/totp';

// POST /api/auth/2fa/setup — Generate secret + QR code
export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (user.twoFactorEnabled) {
    return NextResponse.json({ error: '2FA is already enabled' }, { status: 400 });
  }

  const secret = generateTotpSecret();
  const qrCodeDataUrl = await generateQrCodeDataUrl(secret, user.email);

  // Store encrypted secret (not yet enabled — user must verify first)
  await db.user.update({
    where: { id: user.id },
    data: { twoFactorSecret: encryptTotpSecret(secret.base32) },
  });

  return NextResponse.json({
    qrCodeDataUrl,
    secret: secret.base32,
  });
}
