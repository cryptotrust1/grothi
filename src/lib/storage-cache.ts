/**
 * Storage usage cache for fast storage limit checks
 * 
 * Problem: Every upload/generate calculates SUM(fileSize) which is slow with many files
 * Solution: Cache storage usage per bot with TTL (time-to-live)
 * 
 * Cache invalidation:
 * - When media is uploaded (add to cache)
 * - When media is deleted (subtract from cache or clear)
 * - TTL expires (re-calculate)
 */

import { db } from './db';

interface CacheEntry {
  bytes: number;
  timestamp: number;
}

// Simple in-memory cache with TTL
const cache = new Map<string, CacheEntry>();
const TTL_MS = 60_000; // 1 minute cache TTL

/**
 * Get cached storage usage for a bot
 * Returns cached value if available and not expired, otherwise recalculates
 */
export async function getCachedStorageUsage(botId: string): Promise<number> {
  const now = Date.now();
  const cached = cache.get(botId);

  // Return cached value if not expired
  if (cached && (now - cached.timestamp) < TTL_MS) {
    return cached.bytes;
  }

  // Recalculate from database
  const result = await db.media.aggregate({
    where: { 
      botId,
      // Only count succeeded media (not pending/failed)
      OR: [
        { generationStatus: 'SUCCEEDED' },
        { generationStatus: null }, // Non-generated media (uploads)
      ],
    },
    _sum: { fileSize: true },
  });

  const bytes = result._sum.fileSize || 0;
  
  // Update cache
  cache.set(botId, { bytes, timestamp: now });
  
  return bytes;
}

/**
 * Update cache when media is added (optimistic update)
 */
export function addToStorageCache(botId: string, fileSize: number): void {
  const cached = cache.get(botId);
  if (cached) {
    cached.bytes += fileSize;
    cached.timestamp = Date.now();
  }
  // If not cached, it will be calculated on next get
}

/**
 * Update cache when media is deleted
 */
export function subtractFromStorageCache(botId: string, fileSize: number): void {
  const cached = cache.get(botId);
  if (cached) {
    cached.bytes = Math.max(0, cached.bytes - fileSize);
    cached.timestamp = Date.now();
  }
}

/**
 * Clear cache for a bot (force recalculation)
 */
export function clearStorageCache(botId: string): void {
  cache.delete(botId);
}

/**
 * Clear entire cache (useful for admin operations)
 */
export function clearAllStorageCache(): void {
  cache.clear();
}

/**
 * Get cache stats (for debugging)
 */
export function getStorageCacheStats(): { size: number; bots: string[] } {
  return {
    size: cache.size,
    bots: Array.from(cache.keys()),
  };
}
