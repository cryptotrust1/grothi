/**
 * Dashboard counts cache
 * 
 * Problem: Dashboard shows multiple counts (DRAFT, SCHEDULED, PUBLISHED, FAILED)
 * which requires 4 separate count() queries per bot.
 * 
 * Solution: Cache counts with short TTL (30s) to reduce database load.
 * Cache is invalidated when posts are created/updated/deleted.
 */

import { db } from './db';
import type { PostStatus } from '@prisma/client';

interface CountsCacheEntry {
  counts: Record<PostStatus | 'ALL', number>;
  timestamp: number;
}

const cache = new Map<string, CountsCacheEntry>();
const TTL_MS = 10_000; // 10 seconds - very short TTL ensures fresh data without complex invalidation

/**
 * Get cached post counts for a bot
 * Returns all status counts in a single object
 */
export async function getCachedPostCounts(
  botId: string,
  source?: 'MANUAL' | 'AUTOPILOT'
): Promise<Record<PostStatus | 'ALL', number>> {
  const cacheKey = `${botId}:${source || 'ALL'}`;
  const now = Date.now();
  const cached = cache.get(cacheKey);

  if (cached && (now - cached.timestamp) < TTL_MS) {
    return cached.counts;
  }

  // Build where clause
  const where: Record<string, unknown> = { botId };
  if (source) {
    where.source = source;
  }

  // Use groupBy for efficient counting - single query instead of 4
  const groupedCounts = await db.scheduledPost.groupBy({
    by: ['status'],
    where,
    _count: { status: true },
  });

  // Build result object
  const counts: Record<string, number> = {
    DRAFT: 0,
    SCHEDULED: 0,
    PUBLISHING: 0,
    PUBLISHED: 0,
    FAILED: 0,
    CANCELLED: 0,
    ALL: 0,
  };

  let total = 0;
  for (const group of groupedCounts) {
    const count = group._count.status;
    counts[group.status] = count;
    total += count;
  }
  counts.ALL = total;

  // Update cache
  cache.set(cacheKey, { counts: counts as Record<PostStatus | 'ALL', number>, timestamp: now });

  return counts as Record<PostStatus | 'ALL', number>;
}

/**
 * Clear counts cache for a bot
 * Call this when posts are created/updated/deleted
 */
export function clearPostCountsCache(botId: string): void {
  // Clear all variants (with and without source filter)
  cache.delete(`${botId}:ALL`);
  cache.delete(`${botId}:MANUAL`);
  cache.delete(`${botId}:AUTOPILOT`);
}

/**
 * Update cache optimistically when a post is created
 */
export function incrementPostCount(
  botId: string,
  status: PostStatus,
  source?: 'MANUAL' | 'AUTOPILOT'
): void {
  const keys = [`${botId}:ALL`];
  if (source) {
    keys.push(`${botId}:${source}`);
  }

  for (const key of keys) {
    const cached = cache.get(key);
    if (cached) {
      cached.counts[status] = (cached.counts[status] || 0) + 1;
      cached.counts.ALL = (cached.counts.ALL || 0) + 1;
      cached.timestamp = Date.now();
    }
  }
}

/**
 * Update cache when post status changes
 */
export function updatePostCountStatus(
  botId: string,
  oldStatus: PostStatus,
  newStatus: PostStatus,
  source?: 'MANUAL' | 'AUTOPILOT'
): void {
  const keys = [`${botId}:ALL`];
  if (source) {
    keys.push(`${botId}:${source}`);
  }

  for (const key of keys) {
    const cached = cache.get(key);
    if (cached) {
      cached.counts[oldStatus] = Math.max(0, (cached.counts[oldStatus] || 0) - 1);
      cached.counts[newStatus] = (cached.counts[newStatus] || 0) + 1;
      cached.timestamp = Date.now();
    }
  }
}

/**
 * Get cache stats for debugging
 */
export function getCountsCacheStats(): { size: number; bots: string[] } {
  const bots = new Set<string>();
  cache.forEach((_, key) => {
    const botId = key.split(':')[0];
    bots.add(botId);
  });
  return {
    size: cache.size,
    bots: Array.from(bots),
  };
}
