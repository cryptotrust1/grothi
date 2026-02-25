/**
 * API Request Timeout and Error Handling
 * 
 * CRITICAL FOR PRODUCTION:
 * - Prevents long-running requests from blocking server
 * - Returns proper 504 Gateway Timeout
 * - Logs slow requests for monitoring
 */

import { NextRequest, NextResponse } from 'next/server';

interface TimeoutConfig {
  timeoutMs: number;
  endpointName: string;
}

/**
 * Wraps an API handler with timeout protection
 * 
 * Usage:
 *   export const POST = withTimeout(
 *     async (request) => { ... },
 *     { timeoutMs: 30000, endpointName: 'api/media' }
 *   );
 */
export function withTimeout<T extends (req: NextRequest, ...args: unknown[]) => Promise<Response>>(
  handler: T,
  config: TimeoutConfig
): (req: NextRequest, ...args: unknown[]) => Promise<Response> {
  return async (request: NextRequest, ...args: unknown[]) => {
    const startTime = Date.now();
    const { timeoutMs, endpointName } = config;
    
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeoutMs);
    
    try {
      // Race between handler and timeout
      const result = await Promise.race([
        handler(request, ...args),
        new Promise<never>((_, reject) => {
          controller.signal.addEventListener('abort', () => {
            reject(new Error('TIMEOUT'));
          });
        }),
      ]);
      
      clearTimeout(timeoutId);
      
      // Log slow requests (warning if > 50% of timeout)
      const duration = Date.now() - startTime;
      if (duration > timeoutMs * 0.5) {
        console.warn(`[SLOW REQUEST] ${endpointName} took ${duration}ms (timeout: ${timeoutMs}ms)`);
      }
      
      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.message === 'TIMEOUT') {
        console.error(`[TIMEOUT] ${endpointName} exceeded ${timeoutMs}ms`);
        return NextResponse.json(
          { 
            error: 'Request timeout', 
            message: `The request took too long to complete. Maximum allowed: ${timeoutMs}ms`,
            endpoint: endpointName,
          },
          { status: 504 }
        );
      }
      
      // Re-throw other errors
      throw error;
    }
  };
}

/**
 * Recommended timeout configs by endpoint type
 */
export const TIMEOUT_CONFIGS = {
  // Fast operations (CRUD)
  DEFAULT: { timeoutMs: 10_000, endpointName: 'api' },
  
  // Medium operations (listings with filters)
  LISTING: { timeoutMs: 15_000, endpointName: 'api/listing' },
  
  // Slow operations (file uploads, AI generation)
  UPLOAD: { timeoutMs: 120_000, endpointName: 'api/upload' },
  AI_GENERATION: { timeoutMs: 300_000, endpointName: 'api/ai' },
  
  // Cron jobs (background processing)
  CRON: { timeoutMs: 60_000, endpointName: 'api/cron' },
  
  // External API calls
  EXTERNAL_API: { timeoutMs: 30_000, endpointName: 'api/external' },
} as const;

/**
 * Request size limits by endpoint type
 * Prevents memory exhaustion from large payloads
 */
export const SIZE_LIMITS = {
  // JSON API requests
  JSON: 1024 * 1024,        // 1MB
  
  // Form data (text posts)
  FORM: 5 * 1024 * 1024,    // 5MB
  
  // Image uploads
  IMAGE: 15 * 1024 * 1024,  // 15MB
  
  // Video uploads
  VIDEO: 55 * 1024 * 1024,  // 55MB
} as const;

/**
 * Validates request size before processing
 */
export function validateRequestSize(
  request: NextRequest,
  maxSize: number,
  endpointName: string
): { valid: boolean; response?: NextResponse } {
  const contentLength = request.headers.get('content-length');
  
  if (contentLength) {
    const size = parseInt(contentLength, 10);
    if (size > maxSize) {
      console.warn(`[SIZE LIMIT] ${endpointName}: ${size} bytes exceeds ${maxSize}`);
      return {
        valid: false,
        response: NextResponse.json(
          {
            error: 'Request too large',
            message: `Maximum size: ${Math.round(maxSize / 1024 / 1024)}MB`,
            endpoint: endpointName,
          },
          { status: 413 }
        ),
      };
    }
  }
  
  return { valid: true };
}
