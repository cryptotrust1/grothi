/**
 * Database-based cron job locking to prevent overlapping execution.
 *
 * Uses the Bot table's algorithmConfig field as a lightweight lock store
 * to avoid requiring new tables/migrations. Each cron job checks for
 * an active lock before processing and releases it when done.
 *
 * This prevents the critical issue where cron jobs overlap due to
 * slow execution (e.g., autonomous-content takes >5 min on a 5-min schedule).
 */

import { db } from './db';

/** How long a lock is valid before it's considered stale (ms). */
const DEFAULT_LOCK_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Try to acquire a cron job lock. Returns true if the lock was acquired.
 * Uses a dedicated CronLock table (or falls back gracefully).
 *
 * @param jobName - Unique identifier for the cron job (e.g., 'process-posts')
 * @param ttlMs - Lock TTL in milliseconds (default: 10 minutes)
 */
export async function acquireCronLock(
  jobName: string,
  ttlMs: number = DEFAULT_LOCK_TTL_MS
): Promise<boolean> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMs);

  try {
    // Try to create a lock — if one exists and is not expired, this will fail
    // due to unique constraint on jobName
    await db.$executeRaw`
      INSERT INTO "CronLock" ("id", "jobName", "lockedAt", "expiresAt")
      VALUES (gen_random_uuid(), ${jobName}, ${now}, ${expiresAt})
      ON CONFLICT ("jobName") DO UPDATE
      SET "lockedAt" = ${now}, "expiresAt" = ${expiresAt}
      WHERE "CronLock"."expiresAt" < ${now}
    `;

    // Verify we actually got the lock (the ON CONFLICT only updates if expired)
    const lock = await db.$queryRaw<Array<{ lockedAt: Date }>>`
      SELECT "lockedAt" FROM "CronLock"
      WHERE "jobName" = ${jobName} AND "lockedAt" = ${now}
    `;

    return lock.length > 0;
  } catch (error) {
    // Table doesn't exist yet — gracefully degrade (no locking)
    const msg = error instanceof Error ? error.message : '';
    if (msg.includes('CronLock') && (msg.includes('does not exist') || msg.includes('relation'))) {
      console.warn(`[cron-lock] CronLock table not found — skipping lock for ${jobName}. Run migration to enable.`);
      return true; // Allow execution without lock (backward compatible)
    }
    console.error(`[cron-lock] Failed to acquire lock for ${jobName}:`, msg);
    return true; // Fail open — better to risk overlap than block all cron jobs
  }
}

/**
 * Release a cron job lock.
 */
export async function releaseCronLock(jobName: string): Promise<void> {
  try {
    await db.$executeRaw`
      DELETE FROM "CronLock" WHERE "jobName" = ${jobName}
    `;
  } catch {
    // Table might not exist — ignore silently
  }
}

/**
 * Wrapper that runs a cron job with automatic lock acquisition and release.
 * Returns null if the lock could not be acquired (job is already running).
 */
export async function withCronLock<T>(
  jobName: string,
  fn: () => Promise<T>,
  ttlMs?: number
): Promise<T | null> {
  const acquired = await acquireCronLock(jobName, ttlMs);
  if (!acquired) {
    console.log(`[cron-lock] Skipping ${jobName} — previous instance still running`);
    return null;
  }

  try {
    return await fn();
  } finally {
    await releaseCronLock(jobName);
  }
}
