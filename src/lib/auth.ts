import { db } from './db';
import { compare, hash } from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { addCredits, WELCOME_BONUS_CREDITS } from './credits';

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

  return user;
}

export async function signIn(email: string, password: string) {
  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    throw new Error('Invalid email or password');
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    throw new Error('Invalid email or password');
  }

  await createSession(user.id);

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
