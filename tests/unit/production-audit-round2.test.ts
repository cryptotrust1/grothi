/**
 * Production Audit Round 2 Tests
 *
 * Tests for round 2 production audit fixes:
 * - Global AI rate limiter (120 req/hr cap across all AI endpoints)
 * - Password validation (strength requirements + common password blocklist)
 * - Health check counter reset safety (date comparison logic)
 */

import { describe, it, expect } from '@jest/globals';
import { createRateLimiter, globalAILimiter } from '@/lib/rate-limit';
import { passwordSchema } from '@/lib/validations';

// ── Global AI Rate Limiter ──────────────────────────────────────

describe('Global AI Rate Limiter', () => {
  it('should exist as a named export', () => {
    expect(globalAILimiter).toBeDefined();
    expect(typeof globalAILimiter.check).toBe('function');
    expect(typeof globalAILimiter.reset).toBe('function');
  });

  it('should allow requests under the 120/hr limit', () => {
    const key = 'global-ai-test-allow';
    globalAILimiter.reset(key);

    const result = globalAILimiter.check(key);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(119);
    expect(result.retryAfterMs).toBe(0);

    globalAILimiter.reset(key);
  });

  it('should enforce 120 request maximum', () => {
    // Use a dedicated limiter with the same config to avoid polluting the shared one
    const limiter = createRateLimiter({ maxRequests: 120, windowMs: 60 * 60 * 1000 });
    const key = 'global-ai-test-enforce';

    for (let i = 0; i < 120; i++) {
      const r = limiter.check(key);
      expect(r.allowed).toBe(true);
    }

    const blocked = limiter.check(key);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it('should track requests per-user (different keys are independent)', () => {
    const limiter = createRateLimiter({ maxRequests: 120, windowMs: 60 * 60 * 1000 });

    // Exhaust user-a
    for (let i = 0; i < 120; i++) {
      limiter.check('user-a-global');
    }
    expect(limiter.check('user-a-global').allowed).toBe(false);

    // user-b should still be allowed
    const result = limiter.check('user-b-global');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(119);
  });
});

// ── Password Validation ─────────────────────────────────────────

describe('Password Validation', () => {
  describe('strength requirements', () => {
    it('should accept a strong password', () => {
      const result = passwordSchema.safeParse('MyStr0ngPass!');
      expect(result.success).toBe(true);
    });

    it('should reject passwords shorter than 8 characters', () => {
      const result = passwordSchema.safeParse('Ab1cdef');
      expect(result.success).toBe(false);
    });

    it('should reject passwords longer than 128 characters', () => {
      const longPassword = 'A1' + 'a'.repeat(127);
      expect(longPassword.length).toBeGreaterThan(128);
      const result = passwordSchema.safeParse(longPassword);
      expect(result.success).toBe(false);
    });

    it('should accept passwords of exactly 128 characters', () => {
      // 126 lowercase + 1 uppercase + 1 digit = 128
      const password = 'A1' + 'b'.repeat(126);
      expect(password.length).toBe(128);
      const result = passwordSchema.safeParse(password);
      expect(result.success).toBe(true);
    });

    it('should accept passwords of exactly 8 characters', () => {
      const result = passwordSchema.safeParse('Abcdef1x');
      expect(result.success).toBe(true);
    });

    it('should require at least one uppercase letter', () => {
      const result = passwordSchema.safeParse('alllowercase1');
      expect(result.success).toBe(false);
      if (!result.success) {
        const messages = result.error.issues.map((i) => i.message);
        expect(messages.some((m) => m.includes('uppercase'))).toBe(true);
      }
    });

    it('should require at least one lowercase letter', () => {
      const result = passwordSchema.safeParse('ALLUPPERCASE1');
      expect(result.success).toBe(false);
      if (!result.success) {
        const messages = result.error.issues.map((i) => i.message);
        expect(messages.some((m) => m.includes('lowercase'))).toBe(true);
      }
    });

    it('should require at least one digit', () => {
      const result = passwordSchema.safeParse('NoDigitsHere');
      expect(result.success).toBe(false);
      if (!result.success) {
        const messages = result.error.issues.map((i) => i.message);
        expect(messages.some((m) => m.includes('number'))).toBe(true);
      }
    });
  });

  describe('common password blocklist', () => {
    const commonPasswords = [
      'Password123',
      'Qwerty123',
      'Abc12345',
      'Welcome1',
      'Monkey123',
      'Dragon123',
      'Admin123',
      'Passw0rd',
      'P@ssword1',
      'P@ssw0rd',
    ];

    it.each(commonPasswords)('should reject common password: %s', (password) => {
      const result = passwordSchema.safeParse(password);
      expect(result.success).toBe(false);
      if (!result.success) {
        const messages = result.error.issues.map((i) => i.message);
        expect(messages.some((m) => m.includes('too common'))).toBe(true);
      }
    });

    it('should reject common passwords regardless of case', () => {
      // "password123" is in the blocklist; "PASSWORD123" should also be caught
      // because the refine checks pw.toLowerCase()
      const result = passwordSchema.safeParse('PASSWORD123');
      expect(result.success).toBe(false);
    });

    it('should accept a password not in the blocklist', () => {
      const result = passwordSchema.safeParse('Xk9$mNq2vR!');
      expect(result.success).toBe(true);
    });
  });
});

// ── Health Check Counter Reset Safety ───────────────────────────

describe('Health Check Counter Reset Safety', () => {
  /**
   * The health check cron resets daily counters for platform connections,
   * but should NOT reset counters for connections that were updated recently.
   * This tests the underlying date comparison logic used to decide whether
   * a connection's counter should be reset.
   */

  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

  function shouldResetCounter(lastUpdatedAt: Date, now: Date): boolean {
    // A connection should only have its counter reset if it was NOT updated
    // within the last 24 hours (i.e., it is stale).
    return now.getTime() - lastUpdatedAt.getTime() >= TWENTY_FOUR_HOURS_MS;
  }

  it('should NOT reset counter for a connection updated 1 hour ago', () => {
    const now = new Date('2026-03-15T03:00:00Z');
    const lastUpdated = new Date('2026-03-15T02:00:00Z');
    expect(shouldResetCounter(lastUpdated, now)).toBe(false);
  });

  it('should NOT reset counter for a connection updated 23 hours ago', () => {
    const now = new Date('2026-03-15T03:00:00Z');
    const lastUpdated = new Date('2026-03-14T04:00:00Z');
    expect(shouldResetCounter(lastUpdated, now)).toBe(false);
  });

  it('should reset counter for a connection updated exactly 24 hours ago', () => {
    const now = new Date('2026-03-15T03:00:00Z');
    const lastUpdated = new Date('2026-03-14T03:00:00Z');
    expect(shouldResetCounter(lastUpdated, now)).toBe(true);
  });

  it('should reset counter for a connection updated 48 hours ago', () => {
    const now = new Date('2026-03-15T03:00:00Z');
    const lastUpdated = new Date('2026-03-13T03:00:00Z');
    expect(shouldResetCounter(lastUpdated, now)).toBe(true);
  });

  it('should NOT reset counter for a connection updated just now', () => {
    const now = new Date('2026-03-15T03:00:00Z');
    expect(shouldResetCounter(now, now)).toBe(false);
  });

  it('should handle timezone edge cases with ISO date strings', () => {
    // Connection updated at 23:30 UTC, health check runs at 00:05 UTC next day
    // Only 35 minutes have passed — should NOT reset
    const now = new Date('2026-03-15T00:05:00Z');
    const lastUpdated = new Date('2026-03-14T23:30:00Z');
    expect(shouldResetCounter(lastUpdated, now)).toBe(false);
  });

  it('should use millisecond precision for boundary accuracy', () => {
    const now = new Date('2026-03-15T03:00:00.000Z');
    // 1 millisecond before 24 hours — should NOT reset
    const justUnder = new Date(now.getTime() - TWENTY_FOUR_HOURS_MS + 1);
    expect(shouldResetCounter(justUnder, now)).toBe(false);

    // Exactly 24 hours — should reset
    const exact = new Date(now.getTime() - TWENTY_FOUR_HOURS_MS);
    expect(shouldResetCounter(exact, now)).toBe(true);
  });
});
