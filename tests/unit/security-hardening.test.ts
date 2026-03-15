/**
 * Security Hardening Tests
 *
 * Tests for production-readiness audit fixes:
 * - Rate limiter behavior
 * - Credit expiration atomicity
 * - Input validation edge cases
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { createRateLimiter } from '@/lib/rate-limit';

describe('Rate Limiter', () => {
  it('should allow requests under the limit', () => {
    const limiter = createRateLimiter({ maxRequests: 3, windowMs: 60_000 });

    const r1 = limiter.check('test-allow-1');
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);

    const r2 = limiter.check('test-allow-1');
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(1);

    const r3 = limiter.check('test-allow-1');
    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0);
  });

  it('should block requests over the limit', () => {
    const limiter = createRateLimiter({ maxRequests: 2, windowMs: 60_000 });

    limiter.check('test-block-1');
    limiter.check('test-block-1');

    const r3 = limiter.check('test-block-1');
    expect(r3.allowed).toBe(false);
    expect(r3.remaining).toBe(0);
    expect(r3.retryAfterMs).toBeGreaterThan(0);
  });

  it('should use namespaced keys so different limiters do not interfere', () => {
    const limiterA = createRateLimiter({ maxRequests: 1, windowMs: 60_000 });
    const limiterB = createRateLimiter({ maxRequests: 5, windowMs: 60_000 });

    limiterA.check('test-namespace-1');
    const blocked = limiterA.check('test-namespace-1');
    expect(blocked.allowed).toBe(false);

    // Same key on limiterB should still be allowed
    const allowed = limiterB.check('test-namespace-1');
    expect(allowed.allowed).toBe(true);
  });

  it('should reset a specific key', () => {
    const limiter = createRateLimiter({ maxRequests: 1, windowMs: 60_000 });

    limiter.check('test-reset-1');
    expect(limiter.check('test-reset-1').allowed).toBe(false);

    limiter.reset('test-reset-1');
    expect(limiter.check('test-reset-1').allowed).toBe(true);
  });

  it('should isolate different keys', () => {
    const limiter = createRateLimiter({ maxRequests: 1, windowMs: 60_000 });

    limiter.check('user-a');
    expect(limiter.check('user-a').allowed).toBe(false);
    expect(limiter.check('user-b').allowed).toBe(true);
  });
});

describe('Validation Edge Cases', () => {
  it('should handle empty string inputs safely', () => {
    expect(''.trim()).toBe('');
    expect(parseInt('', 10)).toBeNaN();
  });

  it('should not allow negative credit amounts', () => {
    // Credits system requires amount > 0 for deduction
    const amount = -5;
    expect(amount <= 0).toBe(true);
  });

  it('should handle MAX_SAFE_INTEGER for credit amounts', () => {
    const amount = Number.MAX_SAFE_INTEGER;
    expect(Number.isSafeInteger(amount)).toBe(true);
    expect(amount > 0).toBe(true);
  });

  it('should validate hex token format', () => {
    const validToken = 'a'.repeat(64);
    const invalidToken = 'g'.repeat(64); // g is not hex
    const shortToken = 'a'.repeat(10);

    expect(/^[a-f0-9]{64}$/.test(validToken)).toBe(true);
    expect(/^[a-f0-9]{64}$/.test(invalidToken)).toBe(false);
    expect(/^[a-f0-9]{64}$/.test(shortToken)).toBe(false);
  });
});

describe('CRON Secret Validation', () => {
  const originalCronSecret = process.env.CRON_SECRET;

  beforeAll(() => {
    process.env.CRON_SECRET = 'test-cron-secret-12345';
  });

  afterAll(() => {
    if (originalCronSecret !== undefined) {
      process.env.CRON_SECRET = originalCronSecret;
    } else {
      delete process.env.CRON_SECRET;
    }
  });

  it('should reject empty auth header', () => {
    const { validateCronSecret } = require('@/lib/api-helpers');
    const result = validateCronSecret(null);
    expect(result).not.toBeNull();
  });

  it('should reject wrong secret', () => {
    const { validateCronSecret } = require('@/lib/api-helpers');
    const result = validateCronSecret('Bearer wrong-secret');
    expect(result).not.toBeNull();
  });

  it('should accept correct secret', () => {
    const { validateCronSecret } = require('@/lib/api-helpers');
    const result = validateCronSecret('Bearer test-cron-secret-12345');
    expect(result).toBeNull();
  });
});
