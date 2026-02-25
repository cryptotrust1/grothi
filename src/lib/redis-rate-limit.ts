/**
 * Redis-based distributed rate limiter
 * 
 * CRITICAL FOR PRODUCTION:
 * - Works across multiple server instances (PM2 cluster mode)
 * - Survives server restarts
 * - Centralized rate limiting state
 * 
 * Falls back to in-memory limiter if Redis is unavailable
 */

import Redis from 'ioredis';
import { createRateLimiter as createMemoryLimiter } from './rate-limit';

// Redis client singleton
let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;
  
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.warn('[redis-rate-limit] REDIS_URL not set, using in-memory fallback');
    return null;
  }
  
  try {
    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });
    
    redis.on('error', (err) => {
      console.error('[redis-rate-limit] Redis error:', err.message);
    });
    
    return redis;
  } catch (error) {
    console.error('[redis-rate-limit] Failed to connect to Redis:', error);
    return null;
  }
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

interface RateLimiterConfig {
  maxRequests: number;
  windowMs: number;
  keyPrefix?: string;
}

/**
 * Create a Redis-based rate limiter
 * Falls back to in-memory if Redis unavailable
 */
export function createRateLimiter(config: RateLimiterConfig) {
  const { maxRequests, windowMs, keyPrefix = 'ratelimit' } = config;
  const redisClient = getRedis();
  
  // Fallback to memory-based limiter if Redis unavailable
  if (!redisClient) {
    console.warn(`[rate-limit] Using in-memory fallback for ${keyPrefix}`);
    return createMemoryLimiter({ maxRequests, windowMs });
  }
  
  return {
    async check(key: string): Promise<RateLimitResult> {
      const now = Date.now();
      const windowStart = now - windowMs;
      const redisKey = `${keyPrefix}:${key}`;
      
      try {
        // Redis sorted set: score = timestamp, member = unique request ID
        const pipeline = redisClient.pipeline();
        
        // Remove old entries outside the window
        pipeline.zremrangebyscore(redisKey, 0, windowStart);
        
        // Count current entries in window
        pipeline.zcard(redisKey);
        
        // Add current request
        pipeline.zadd(redisKey, now, `${now}-${Math.random()}`);
        
        // Set expiry on the key
        pipeline.pexpire(redisKey, windowMs);
        
        const results = await pipeline.exec();
        
        if (!results) {
          throw new Error('Pipeline failed');
        }
        
        const currentCount = results[1][1] as number;
        
        if (currentCount >= maxRequests) {
          // Get oldest entry for retry-after calculation
          const oldest = await redisClient.zrange(redisKey, 0, 0, 'WITHSCORES');
          const oldestTimestamp = oldest[1] ? parseInt(oldest[1], 10) : now;
          const retryAfterMs = oldestTimestamp + windowMs - now;
          
          return {
            allowed: false,
            remaining: 0,
            retryAfterMs: Math.max(0, retryAfterMs),
          };
        }
        
        return {
          allowed: true,
          remaining: Math.max(0, maxRequests - currentCount - 1),
          retryAfterMs: 0,
        };
      } catch (error) {
        console.error('[redis-rate-limit] Error, falling back to memory:', error);
        // Fallback to memory limiter on error
        const memoryLimiter = createMemoryLimiter({ maxRequests, windowMs });
        return memoryLimiter.check(key);
      }
    },
    
    async reset(key: string): Promise<void> {
      const redisKey = `${keyPrefix}:${key}`;
      try {
        await redisClient.del(redisKey);
      } catch (error) {
        console.error('[redis-rate-limit] Reset error:', error);
      }
    },
  };
}

// Pre-configured limiters for production scale
export const globalRateLimiter = createRateLimiter({
  maxRequests: 100,        // 100 requests
  windowMs: 60 * 1000,     // per minute
  keyPrefix: 'global:ip',
});

export const apiRateLimiter = createRateLimiter({
  maxRequests: 60,         // 60 API calls
  windowMs: 60 * 1000,     // per minute
  keyPrefix: 'api:user',
});

export const uploadRateLimiter = createRateLimiter({
  maxRequests: 10,         // 10 uploads
  windowMs: 60 * 1000,     // per minute
  keyPrefix: 'upload:user',
});

export const aiGenerationRateLimiter = createRateLimiter({
  maxRequests: 60,         // 60 AI generations
  windowMs: 60 * 60 * 1000, // per hour
  keyPrefix: 'ai:user',
});
