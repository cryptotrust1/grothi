/**
 * In-memory rate limiter for protecting public endpoints.
 *
 * Uses a sliding window approach with automatic cleanup.
 * No external dependencies (Redis etc.) — suitable for single-server deployments.
 *
 * Usage:
 *   const limiter = createRateLimiter({ maxRequests: 5, windowMs: 60_000 });
 *   const result = limiter.check(clientIp);
 *   if (!result.allowed) { // reject request }
 */

interface RateLimitEntry {
  timestamps: number[];
}

interface RateLimiterConfig {
  /** Maximum requests allowed within the time window. */
  maxRequests: number;
  /** Time window in milliseconds. */
  windowMs: number;
}

interface RateLimitResult {
  allowed: boolean;
  /** Remaining requests in the current window. */
  remaining: number;
  /** Milliseconds until the window resets (0 if allowed). */
  retryAfterMs: number;
}

interface RateLimiter {
  check: (key: string) => RateLimitResult;
  reset: (key: string) => void;
}

const store = new Map<string, RateLimitEntry>();

// Cleanup stale entries every 5 minutes to prevent memory leak
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

function ensureCleanup(windowMs: number) {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    store.forEach((entry, key) => {
      // Remove entries with no timestamps in the last 2x window
      entry.timestamps = entry.timestamps.filter((t: number) => now - t < windowMs * 2);
      if (entry.timestamps.length === 0) {
        store.delete(key);
      }
    });
  }, 5 * 60 * 1000);
  // Don't block process exit
  if (cleanupInterval && typeof cleanupInterval === 'object' && 'unref' in cleanupInterval) {
    cleanupInterval.unref();
  }
}

/**
 * Create a rate limiter instance with the given config.
 * Multiple limiters can coexist with different configs (they share the store
 * but use namespaced keys).
 */
export function createRateLimiter(config: RateLimiterConfig): RateLimiter {
  const { maxRequests, windowMs } = config;
  ensureCleanup(windowMs);

  return {
    check(key: string): RateLimitResult {
      const now = Date.now();
      const namespacedKey = `${maxRequests}:${windowMs}:${key}`;

      let entry = store.get(namespacedKey);
      if (!entry) {
        entry = { timestamps: [] };
        store.set(namespacedKey, entry);
      }

      // Remove timestamps outside the window
      entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

      if (entry.timestamps.length >= maxRequests) {
        // Rate limited
        const oldestInWindow = entry.timestamps[0];
        const retryAfterMs = oldestInWindow + windowMs - now;
        return {
          allowed: false,
          remaining: 0,
          retryAfterMs: Math.max(0, retryAfterMs),
        };
      }

      // Allow and record
      entry.timestamps.push(now);
      return {
        allowed: true,
        remaining: maxRequests - entry.timestamps.length,
        retryAfterMs: 0,
      };
    },

    reset(key: string): void {
      const namespacedKey = `${maxRequests}:${windowMs}:${key}`;
      store.delete(namespacedKey);
    },
  };
}

// ── Pre-configured limiters for common use cases ──────────────

/** Contact form: max 3 submissions per hour per IP. */
export const contactFormLimiter = createRateLimiter({
  maxRequests: 3,
  windowMs: 60 * 60 * 1000, // 1 hour
});

/** Sign in: max 10 attempts per 15 minutes per IP. */
export const signInLimiter = createRateLimiter({
  maxRequests: 10,
  windowMs: 15 * 60 * 1000, // 15 minutes
});

/** Sign up: max 5 accounts per hour per IP. */
export const signUpLimiter = createRateLimiter({
  maxRequests: 5,
  windowMs: 60 * 60 * 1000, // 1 hour
});

/** Forgot password: max 3 requests per 15 minutes per IP. */
export const forgotPasswordLimiter = createRateLimiter({
  maxRequests: 3,
  windowMs: 15 * 60 * 1000, // 15 minutes
});

// ── IP extraction helper ──────────────────────────────────────

/**
 * Extract client IP from Next.js headers.
 * Checks Cloudflare, standard proxy headers, then falls back to 'unknown'.
 */
export function getClientIp(headersList: Headers): string {
  // Cloudflare
  const cfIp = headersList.get('cf-connecting-ip');
  if (cfIp) return cfIp;

  // Standard proxy
  const forwarded = headersList.get('x-forwarded-for');
  if (forwarded) {
    // x-forwarded-for can be "client, proxy1, proxy2" — take the first
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }

  // Nginx
  const realIp = headersList.get('x-real-ip');
  if (realIp) return realIp;

  return 'unknown';
}
