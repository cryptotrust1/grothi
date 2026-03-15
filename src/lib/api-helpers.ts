import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { timingSafeEqual, createHash } from 'crypto';

/**
 * Shared API response helpers to eliminate duplicate error response patterns.
 * Used across 40+ API routes.
 */

// ============ STANDARD ERROR RESPONSES ============

export const apiError = {
  unauthorized: () =>
    NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),

  notFound: (resource: string = 'Resource') =>
    NextResponse.json({ error: `${resource} not found` }, { status: 404 }),

  badRequest: (message: string = 'Invalid request') =>
    NextResponse.json({ error: message }, { status: 400 }),

  insufficientCredits: (cost?: number) =>
    NextResponse.json(
      { error: cost ? `Not enough credits. You need ${cost} credits for this action.` : 'Insufficient credits' },
      { status: 402 }
    ),

  serverError: (message: string = 'Internal server error') =>
    NextResponse.json({ error: message }, { status: 500 }),

  storageLimitExceeded: (usedMB: string, limitMB: number) =>
    NextResponse.json(
      { error: `Storage limit exceeded. This bot uses ${usedMB} MB of ${limitMB} MB allowed.` },
      { status: 413 }
    ),
};

// ============ AUTH + BOT OWNERSHIP CHECK ============

/**
 * Authenticate the current user and verify bot ownership in one call.
 * Returns { user, bot } on success, or { response } with an error response.
 */
export async function requireAuthAndBot(botId: string): Promise<
  | { user: { id: string; email: string; role: string }; bot: { id: string; userId: string; [key: string]: unknown }; response?: never }
  | { user?: never; bot?: never; response: NextResponse }
> {
  const user = await getCurrentUser();
  if (!user) {
    return { response: apiError.unauthorized() };
  }

  const bot = await db.bot.findFirst({ where: { id: botId, userId: user.id } });
  if (!bot) {
    return { response: apiError.notFound('Bot') };
  }

  return { user, bot: bot as { id: string; userId: string; [key: string]: unknown } };
}

// ============ CRON SECRET VALIDATION ============

/**
 * Validate the CRON_SECRET from the Authorization header.
 * Returns null on success, or an error response on failure.
 */
export function validateCronSecret(authHeader: string | null): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET;
  const token = authHeader?.replace('Bearer ', '');

  if (!cronSecret || !token) {
    return apiError.unauthorized();
  }

  // Use timing-safe comparison to prevent timing-based secret enumeration attacks.
  // Both buffers must have the same length — hash both to a fixed 32-byte digest.
  const expected = createHash('sha256').update(cronSecret).digest();
  const actual   = createHash('sha256').update(token).digest();

  if (!timingSafeEqual(expected, actual)) {
    return apiError.unauthorized();
  }

  return null;
}
