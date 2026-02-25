/**
 * Database Connection Monitoring & Health Checks
 * 
 * CRITICAL FOR PRODUCTION:
 * - Monitors connection pool health
 * - Implements retry logic with exponential backoff
 * - Alerts on connection exhaustion
 */

import { db } from './db';

interface HealthCheckResult {
  healthy: boolean;
  responseTime: number;
  activeConnections?: number;
  error?: string;
}

/**
 * Performs a lightweight database health check
 * Should be called periodically (e.g., every 30 seconds)
 */
export async function checkDatabaseHealth(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  
  try {
    // Lightweight query - just check connection
    await db.$queryRaw`SELECT 1 as health`;
    
    const responseTime = Date.now() - startTime;
    
    // Warning if response time > 1 second
    if (responseTime > 1000) {
      console.warn(`[DB HEALTH] Slow response: ${responseTime}ms`);
    }
    
    return {
      healthy: true,
      responseTime,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[DB HEALTH] Check failed:', message);
    
    return {
      healthy: false,
      responseTime: Date.now() - startTime,
      error: message,
    };
  }
}

/**
 * Executes a database operation with retry logic
 * 
 * Usage:
 *   const result = await withRetry(() => db.user.findMany({ ... }));
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    operationName?: string;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelayMs = 100,
    maxDelayMs = 5000,
    operationName = 'db-operation',
  } = options;
  
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Don't retry on certain errors
      if (isNonRetryableError(lastError)) {
        throw lastError;
      }
      
      if (attempt < maxRetries) {
        // Exponential backoff with jitter
        const delay = Math.min(
          baseDelayMs * Math.pow(2, attempt) + Math.random() * 100,
          maxDelayMs
        );
        
        console.warn(
          `[DB RETRY] ${operationName} attempt ${attempt + 1}/${maxRetries + 1} ` +
          `failed: ${lastError.message}. Retrying in ${Math.round(delay)}ms...`
        );
        
        await sleep(delay);
      }
    }
  }
  
  console.error(`[DB RETRY] ${operationName} failed after ${maxRetries + 1} attempts`);
  throw lastError;
}

/**
 * Determines if an error should not be retried
 */
function isNonRetryableError(error: Error): boolean {
  const nonRetryablePatterns = [
    'P2002', // Unique constraint violation
    'P2025', // Record not found
    'P2003', // Foreign key constraint failed
    'P2014', // Required relation violation
  ];
  
  return nonRetryablePatterns.some(pattern => error.message.includes(pattern));
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Monitors connection pool statistics
 * Call this periodically to track connection usage
 */
export async function getConnectionStats(): Promise<{
  active: number;
  idle: number;
  total: number;
}> {
  try {
    // This is PostgreSQL specific
    const result = await db.$queryRaw<[{ count: bigint }]>`
      SELECT count(*) as count 
      FROM pg_stat_activity 
      WHERE datname = current_database()
    `;
    
    const active = Number(result[0]?.count || 0);
    
    return {
      active,
      idle: 0, // Not directly available from Prisma
      total: active,
    };
  } catch (error) {
    console.error('[DB STATS] Failed to get connection stats:', error);
    return { active: 0, idle: 0, total: 0 };
  }
}

/**
 * Middleware to check DB health before processing request
 * Returns 503 if database is unhealthy
 */
export async function requireDatabaseHealth(): Promise<{
  healthy: boolean;
  error?: string;
}> {
  const health = await checkDatabaseHealth();
  
  if (!health.healthy) {
    return {
      healthy: false,
      error: 'Database unavailable. Please try again later.',
    };
  }
  
  return { healthy: true };
}

// Connection monitoring interval (for logging/metrics)
let monitoringInterval: NodeJS.Timeout | null = null;

export function startConnectionMonitoring(intervalMs = 30000): void {
  if (monitoringInterval) return;
  
  monitoringInterval = setInterval(async () => {
    const stats = await getConnectionStats();
    const health = await checkDatabaseHealth();
    
    // Log if connections are high (> 80% of max)
    if (stats.active > 80) {
      console.warn(`[DB MONITOR] High connection count: ${stats.active} active`);
    }
    
    // Log if health check is slow
    if (health.responseTime > 500) {
      console.warn(`[DB MONITOR] Slow health check: ${health.responseTime}ms`);
    }
  }, intervalMs);
}

export function stopConnectionMonitoring(): void {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
  }
}
