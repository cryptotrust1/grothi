import { db } from './db';
import { compare, hash } from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { addCredits, WELCOME_BONUS_CREDITS } from './credits';
import { randomBytes } from 'crypto';

function getJwtSecret() {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('NEXTAUTH_SECRET environment variable is required');
  }
  return new TextEncoder().encode(secret);
}

const JWT_SECRET = getJwtSecret();

const SESSION_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days

export async function hashPassword(password: string): Promise<string> {
  return hash(password, 12);
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return compare(password, hashedPassword);
}

export async function createSession(userId: string): Promise<string> {
  const token = await new SignJWT({ userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('30d')
    .setIssuedAt()
    .sign(JWT_SECRET);

  const expiresAt = new Date(Date.now() + SESSION_DURATION);

  await db.session.create({
    data: {
      userId,
      token,
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set('session-token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: expiresAt,
    path: '/',
  });

  return token;
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get('session-token')?.value;

  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const userId = payload.userId as string;

    const session = await db.session.findFirst({
      where: {
        token,
        userId,
        expiresAt: { gt: new Date() },
      },
      include: {
        user: {
          include: {
            creditBalance: true,
          },
        },
      },
    });

    if (!session) return null;
    if (session.user.isBlocked) return null;
    return session.user;
  } catch {
    return null;
  }
}

export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/signin');
  return user;
}

export async function requireAdmin() {
  const user = await requireAuth();
  if (user.role !== 'ADMIN') redirect('/dashboard');
  return user;
}

export async function signUp(email: string, password: string, name: string) {
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    throw new Error('Email already registered');
  }

  const passwordHash = await hashPassword(password);

  const user = await db.user.create({
    data: {
      email,
      passwordHash,
      name,
    },
  });

  // Give welcome bonus credits
  await addCredits(user.id, WELCOME_BONUS_CREDITS, 'BONUS', 'Welcome bonus - 100 free credits');

  await createSession(user.id);

  // Send welcome email + verification email (non-blocking)
  sendVerificationAndWelcomeEmails(user.id, email, name || 'there').catch((err) => {
    console.error('Failed to send welcome/verification emails:', err);
  });

  return user;
}

async function sendVerificationAndWelcomeEmails(userId: string, email: string, name: string) {
  const { sendWelcomeEmail, sendEmailVerificationEmail } = await import('./email');

  // Generate verification token
  const token = randomBytes(32).toString('hex');
  await db.emailVerificationToken.create({
    data: {
      userId,
      token,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    },
  });

  await sendWelcomeEmail(email, name);
  await sendEmailVerificationEmail(email, name, token);
}

export async function createPasswordResetToken(email: string): Promise<boolean> {
  const user = await db.user.findUnique({ where: { email }, select: { id: true, name: true } });
  if (!user) return false;

  // Invalidate existing tokens
  await db.passwordResetToken.updateMany({
    where: { userId: user.id, used: false },
    data: { used: true },
  });

  const token = randomBytes(32).toString('hex');
  await db.passwordResetToken.create({
    data: {
      userId: user.id,
      token,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    },
  });

  const { sendPasswordResetEmail } = await import('./email');
  await sendPasswordResetEmail(email, user.name || 'there', token);
  return true;
}

export async function resetPasswordWithToken(token: string, newPassword: string) {
  const resetToken = await db.passwordResetToken.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!resetToken || resetToken.used || resetToken.expiresAt < new Date()) {
    throw new Error('Invalid or expired reset link. Please request a new one.');
  }

  const passwordHash = await hashPassword(newPassword);

  await db.$transaction([
    db.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash },
    }),
    db.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { used: true },
    }),
    // Revoke all existing sessions to prevent session hijacking
    db.session.deleteMany({
      where: { userId: resetToken.userId },
    }),
  ]);

  return resetToken.user;
}

export async function verifyEmailToken(token: string) {
  const verificationToken = await db.emailVerificationToken.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!verificationToken || verificationToken.expiresAt < new Date()) {
    throw new Error('Invalid or expired verification link.');
  }

  await db.$transaction([
    db.user.update({
      where: { id: verificationToken.userId },
      data: { emailVerified: true },
    }),
    db.emailVerificationToken.delete({
      where: { id: verificationToken.id },
    }),
  ]);

  return verificationToken.user;
}

export async function signIn(email: string, password: string) {
  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    throw new Error('Invalid email or password');
  }

  if (user.isBlocked) {
    throw new Error('Your account has been suspended. Contact support for assistance.');
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    throw new Error('Invalid email or password');
  }

  // If 2FA is enabled, return a short-lived pending token instead of full session
  if (user.twoFactorEnabled) {
    const pendingToken = await new SignJWT({ userId: user.id, pending2fa: true })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('5m')
      .setIssuedAt()
      .sign(getJwtSecret());

    return { requires2FA: true as const, pendingToken, user: null };
  }

  await createSession(user.id);

  return { requires2FA: false as const, pendingToken: null, user };
}

export async function verify2FAAndCreateSession(pendingToken: string, totpCode: string) {
  const { payload } = await jwtVerify(pendingToken, getJwtSecret());
  if (!payload.pending2fa) {
    throw new Error('Invalid pending token');
  }

  const userId = payload.userId as string;
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
    throw new Error('Invalid state');
  }

  const { verifyTotpToken, decryptTotpSecret, verifyRecoveryCode } = await import('./totp');
  const secret = decryptTotpSecret(user.twoFactorSecret);

  // Try as 6-digit TOTP code
  if (/^\d{6}$/.test(totpCode)) {
    const isValid = verifyTotpToken(totpCode, secret, user.email);
    if (!isValid) {
      throw new Error('Invalid verification code');
    }
  } else {
    // Try as recovery code (XXXX-XXXX format)
    const storedHashes = (user.twoFactorRecoveryCodes as string[]) || [];
    const matchIndex = await verifyRecoveryCode(totpCode, storedHashes);
    if (matchIndex === -1) {
      throw new Error('Invalid verification code');
    }

    // Remove used recovery code
    const updatedHashes = [...storedHashes];
    updatedHashes.splice(matchIndex, 1);
    await db.user.update({
      where: { id: userId },
      data: { twoFactorRecoveryCodes: updatedHashes },
    });
  }

  await createSession(userId);
  return user;
}

export async function signOut() {
  const cookieStore = await cookies();
  const token = cookieStore.get('session-token')?.value;

  if (token) {
    await db.session.deleteMany({ where: { token } });
  }

  cookieStore.delete('session-token');
}

/**
 * Clean up expired tokens and sessions from the database.
 * Should be called periodically (e.g., via cron or admin action).
 */
export async function cleanupExpiredTokens(): Promise<{
  sessions: number;
  verificationTokens: number;
  resetTokens: number;
}> {
  const now = new Date();

  const [sessions, verificationTokens, resetTokens] = await db.$transaction([
    db.session.deleteMany({
      where: { expiresAt: { lt: now } },
    }),
    db.emailVerificationToken.deleteMany({
      where: { expiresAt: { lt: now } },
    }),
    db.passwordResetToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: now } },
          { used: true, createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        ],
      },
    }),
  ]);

  return {
    sessions: sessions.count,
    verificationTokens: verificationTokens.count,
    resetTokens: resetTokens.count,
  };
}

/**
 * Resend email verification for a given user.
 * Invalidates existing tokens before creating a new one.
 */
export async function resendVerificationEmail(userId: string, email: string, name: string) {
  // Delete existing verification tokens for this user
  await db.emailVerificationToken.deleteMany({
    where: { userId },
  });

  const token = randomBytes(32).toString('hex');
  await db.emailVerificationToken.create({
    data: {
      userId,
      token,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    },
  });

  const { sendEmailVerificationEmail } = await import('./email');
  await sendEmailVerificationEmail(email, name || 'there', token);
}
