// TOTP-based 2FA (Google Authenticator compatible)
// Uses otpauth library + existing AES-256-GCM encryption

import * as OTPAuth from 'otpauth';
import QRCode from 'qrcode';
import { randomBytes } from 'crypto';
import { encrypt, decrypt } from './encryption';

const ISSUER = 'Grothi';

// ============ SECRET GENERATION ============

export function generateTotpSecret(): OTPAuth.Secret {
  return new OTPAuth.Secret({ size: 20 });
}

// ============ QR CODE ============

export async function generateQrCodeDataUrl(
  secret: OTPAuth.Secret,
  userEmail: string,
): Promise<string> {
  const totp = new OTPAuth.TOTP({
    issuer: ISSUER,
    label: userEmail,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret,
  });

  return QRCode.toDataURL(totp.toString(), {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 256,
  });
}

// ============ TOKEN VERIFICATION ============

export function verifyTotpToken(
  token: string,
  base32Secret: string,
  userEmail: string,
): boolean {
  const totp = new OTPAuth.TOTP({
    issuer: ISSUER,
    label: userEmail,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(base32Secret),
  });

  // window: 1 = accept previous, current, and next 30-second period
  const delta = totp.validate({ token, window: 1 });
  return delta !== null;
}

// ============ RECOVERY CODES ============

const RECOVERY_CODE_COUNT = 10;

export async function generateRecoveryCodes(): Promise<{
  plainCodes: string[];
  hashedCodes: string[];
}> {
  const { hash } = await import('bcryptjs');

  const plainCodes: string[] = [];
  const hashedCodes: string[] = [];

  for (let i = 0; i < RECOVERY_CODE_COUNT; i++) {
    const code = randomBytes(4).toString('hex').toUpperCase();
    const formatted = `${code.slice(0, 4)}-${code.slice(4, 8)}`;
    plainCodes.push(formatted);
    hashedCodes.push(await hash(formatted, 10));
  }

  return { plainCodes, hashedCodes };
}

export async function verifyRecoveryCode(
  inputCode: string,
  hashedCodes: string[],
): Promise<number> {
  const { compare } = await import('bcryptjs');
  const normalized = inputCode.trim().toUpperCase();

  for (let i = 0; i < hashedCodes.length; i++) {
    if (await compare(normalized, hashedCodes[i])) {
      return i;
    }
  }
  return -1;
}

// ============ ENCRYPTED STORAGE ============

export function encryptTotpSecret(base32Secret: string): string {
  return encrypt(base32Secret);
}

export function decryptTotpSecret(encryptedSecret: string): string {
  return decrypt(encryptedSecret);
}
