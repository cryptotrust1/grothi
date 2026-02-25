/**
 * Next.js Middleware - Global Request Protection
 * 
 * CRITICAL FOR PRODUCTION:
 * - Global rate limiting (DDoS protection)
 * - Request size validation
 * - Path-based security headers
 * - IP blocking capability
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getClientIp } from './lib/rate-limit';

// Simple in-memory IP blocking (use Redis in production)
const blockedIps = new Set<string>();

// Rate limiting store (use Redis in production for distributed systems)
const requestCounts = new Map<string, { count: number; resetTime: number }>();

const GLOBAL_RATE_LIMIT = {
  maxRequests: 200,        // 200 requests
  windowMs: 60 * 1000,     // per minute
};

/**
 * Checks global rate limit for an IP
 * This is a first line of defense before application-level rate limiting
 */
function checkGlobalRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const key = `global:${ip}`;
  const entry = requestCounts.get(key);
  
  if (!entry || now > entry.resetTime) {
    // New window
    requestCounts.set(key, {
      count: 1,
      resetTime: now + GLOBAL_RATE_LIMIT.windowMs,
    });
    return { allowed: true };
  }
  
  if (entry.count >= GLOBAL_RATE_LIMIT.maxRequests) {
    return { 
      allowed: false, 
      retryAfter: Math.ceil((entry.resetTime - now) / 1000),
    };
  }
  
  entry.count++;
  return { allowed: true };
}

/**
 * Cleans up expired rate limit entries (runs periodically)
 */
function cleanupRateLimits(): void {
  const now = Date.now();
  requestCounts.forEach((entry, key) => {
    if (now > entry.resetTime) {
      requestCounts.delete(key);
    }
  });
}

// Cleanup every 5 minutes
setInterval(cleanupRateLimits, 5 * 60 * 1000);

export async function middleware(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const path = request.nextUrl.pathname;
  
  // 1. Check blocked IPs
  if (blockedIps.has(ip)) {
    console.warn(`[BLOCKED IP] ${ip} attempted access to ${path}`);
    return new NextResponse('Access denied', { status: 403 });
  }
  
  // 2. Skip middleware for static assets
  if (
    path.startsWith('/_next/') ||
    path.startsWith('/static/') ||
    path.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2)$/)
  ) {
    return NextResponse.next();
  }
  
  // 3. Global rate limiting (only for API routes and dynamic pages)
  if (path.startsWith('/api/') || path.startsWith('/dashboard/')) {
    const rateLimit = checkGlobalRateLimit(ip);
    
    if (!rateLimit.allowed) {
      console.warn(`[RATE LIMITED] ${ip} exceeded global limit on ${path}`);
      return new NextResponse(
        JSON.stringify({
          error: 'Too many requests',
          message: `Global rate limit exceeded. Retry after ${rateLimit.retryAfter}s`,
          retryAfter: rateLimit.retryAfter,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(rateLimit.retryAfter),
          },
        }
      );
    }
  }
  
  // 4. Request size validation for API routes
  if (path.startsWith('/api/')) {
    const contentLength = request.headers.get('content-length');
    const contentType = request.headers.get('content-type') || '';
    
    if (contentLength) {
      const size = parseInt(contentLength, 10);
      
      // Different limits for different content types
      let maxSize = 1 * 1024 * 1024; // 1MB default for JSON
      
      if (contentType.includes('multipart/form-data')) {
        maxSize = 55 * 1024 * 1024; // 55MB for file uploads
      } else if (contentType.includes('application/json')) {
        maxSize = 5 * 1024 * 1024; // 5MB for JSON
      }
      
      if (size > maxSize) {
        console.warn(`[SIZE LIMIT] ${ip} sent ${size} bytes to ${path}`);
        return new NextResponse(
          JSON.stringify({
            error: 'Request too large',
            message: `Maximum size: ${Math.round(maxSize / 1024 / 1024)}MB`,
          }),
          {
            status: 413,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    }
  }
  
  // 5. Add security headers (in addition to next.config.js)
  const response = NextResponse.next();
  
  // Add request ID for tracing
  const requestId = crypto.randomUUID();
  response.headers.set('X-Request-ID', requestId);
  
  return response;
}

/**
 * Configure which paths the middleware runs on
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};

/**
 * Block an IP address (call this from admin endpoints)
 */
export function blockIp(ip: string): void {
  blockedIps.add(ip);
  console.log(`[IP BLOCKED] ${ip}`);
}

/**
 * Unblock an IP address
 */
export function unblockIp(ip: string): void {
  blockedIps.delete(ip);
  console.log(`[IP UNBLOCKED] ${ip}`);
}

/**
 * Get list of blocked IPs
 */
export function getBlockedIps(): string[] {
  return Array.from(blockedIps);
}
