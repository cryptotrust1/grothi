/**
 * Admin Health Check Endpoint
 * 
 * Returns comprehensive system health status
 * Use this for monitoring dashboards (e.g., UptimeRobot, Pingdom)
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkDatabaseHealth, getConnectionStats } from '@/lib/db-monitor';
import { getStorageCacheStats } from '@/lib/storage-cache';
import { getCountsCacheStats } from '@/lib/counts-cache';
import { db } from '@/lib/db';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  services: {
    database: {
      status: 'healthy' | 'unhealthy';
      responseTime: number;
      connections?: number;
      error?: string;
    };
    redis?: {
      status: 'healthy' | 'unhealthy';
      error?: string;
    };
  };
  metrics: {
    storageCacheSize: number;
    countsCacheSize: number;
    dbConnections: {
      active: number;
      idle: number;
      total: number;
    };
  };
}

export async function GET(request: NextRequest) {
  // Optional: require API key for detailed health checks
  const apiKey = request.headers.get('x-api-key');
  const isDetailed = apiKey === process.env.HEALTH_API_KEY;
  
  const startTime = Date.now();
  const health: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.NEXT_PUBLIC_APP_VERSION || 'unknown',
    services: {
      database: { status: 'unhealthy', responseTime: 0 },
    },
    metrics: {
      storageCacheSize: 0,
      countsCacheSize: 0,
      dbConnections: { active: 0, idle: 0, total: 0 },
    },
  };
  
  // Check database
  const dbHealth = await checkDatabaseHealth();
  health.services.database = {
    status: dbHealth.healthy ? 'healthy' : 'unhealthy',
    responseTime: dbHealth.responseTime,
    error: dbHealth.error,
  };
  
  if (!dbHealth.healthy) {
    health.status = 'unhealthy';
  } else if (dbHealth.responseTime > 1000) {
    health.status = 'degraded';
  }
  
  // Detailed checks (only with API key)
  if (isDetailed) {
    // Connection stats
    const connStats = await getConnectionStats();
    health.metrics.dbConnections = connStats;
    
    // Cache stats
    const storageStats = getStorageCacheStats();
    const countsStats = getCountsCacheStats();
    health.metrics.storageCacheSize = storageStats.size;
    health.metrics.countsCacheSize = countsStats.size;
    
    // Check Redis if configured
    if (process.env.REDIS_URL) {
      try {
        const Redis = (await import('ioredis')).default;
        const redis = new Redis(process.env.REDIS_URL, {
          maxRetriesPerRequest: 1,
          connectTimeout: 5000,
        });
        await redis.ping();
        await redis.quit();
        health.services.redis = { status: 'healthy' };
      } catch (error) {
        health.services.redis = {
          status: 'unhealthy',
          error: error instanceof Error ? error.message : 'Redis connection failed',
        };
        health.status = 'degraded';
      }
    }
    
    // Check for stuck posts (potential issue)
    try {
      const stuckPosts = await db.scheduledPost.count({
        where: { status: 'PUBLISHING', updatedAt: { lt: new Date(Date.now() - 10 * 60 * 1000) } },
      });
      if (stuckPosts > 10) {
        health.status = 'degraded';
      }
    } catch {
      // Ignore errors in this check
    }
  }
  
  const responseTime = Date.now() - startTime;
  
  return NextResponse.json(health, {
    status: health.status === 'unhealthy' ? 503 : 200,
    headers: {
      'X-Response-Time': String(responseTime),
      'Cache-Control': 'no-store',
    },
  });
}

/**
 * Simple health check for load balancers
 * Returns 200 if database is accessible
 */
export async function HEAD() {
  const dbHealth = await checkDatabaseHealth();
  
  return new NextResponse(null, {
    status: dbHealth.healthy ? 200 : 503,
    headers: {
      'X-DB-Response-Time': String(dbHealth.responseTime),
    },
  });
}
