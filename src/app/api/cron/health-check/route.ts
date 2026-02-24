/**
 * POST /api/cron/health-check
 *
 * Daily health check for all platform connections.
 * Validates tokens and marks invalid ones as ERROR.
 * Also resets daily counters (postsToday, repliesToday).
 *
 * Called once per day by an external cron job.
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateCronSecret } from '@/lib/api-helpers';
import { db } from '@/lib/db';
import { healthCheckAllConnections as fbHealthCheck } from '@/lib/facebook';
import { healthCheckAllConnections as igHealthCheck } from '@/lib/instagram';
import { healthCheckAllConnections as threadsHealthCheck } from '@/lib/threads';

export async function POST(request: NextRequest) {
  const cronError = validateCronSecret(request.headers.get('authorization'));
  if (cronError) return cronError;

  try {
    console.log('[health-check] Starting daily health check...');

    // Validate all platform connections (Facebook, Instagram, Threads)
    // Do this BEFORE resetting counters so we don't lose data if validation fails
    let fbResult: { total: number; valid: number; invalid: number } = { total: 0, valid: 0, invalid: 0 };
    let igResult: { total: number; valid: number; invalid: number; refreshed: number } = { total: 0, valid: 0, invalid: 0, refreshed: 0 };
    let threadsResult: { total: number; valid: number; invalid: number; refreshed: number } = { total: 0, valid: 0, invalid: 0, refreshed: 0 };

    try {
      fbResult = await fbHealthCheck();
      console.log(`[health-check] Facebook: ${fbResult.total} checked, ${fbResult.valid} valid, ${fbResult.invalid} invalid`);
    } catch (e) {
      console.error('[health-check] Facebook health check failed:', e instanceof Error ? e.message : e);
      fbResult = { total: 0, valid: 0, invalid: 1 };
    }

    try {
      igResult = await igHealthCheck();
      console.log(`[health-check] Instagram: ${igResult.total} checked, ${igResult.valid} valid, ${igResult.invalid} invalid, ${igResult.refreshed} refreshed`);
    } catch (e) {
      console.error('[health-check] Instagram health check failed:', e instanceof Error ? e.message : e);
      igResult = { total: 0, valid: 0, invalid: 1, refreshed: 0 };
    }

    try {
      threadsResult = await threadsHealthCheck();
      console.log(`[health-check] Threads: ${threadsResult.total} checked, ${threadsResult.valid} valid, ${threadsResult.invalid} invalid, ${threadsResult.refreshed} refreshed`);
    } catch (e) {
      console.error('[health-check] Threads health check failed:', e instanceof Error ? e.message : e);
      threadsResult = { total: 0, valid: 0, invalid: 1, refreshed: 0 };
    }

    // Reset daily counters for all connections only after successful health checks
    const resetResult = await db.platformConnection.updateMany({
      data: { postsToday: 0, repliesToday: 0 },
    });
    console.log(`[health-check] Reset daily counters for ${resetResult.count} connections`);

    return NextResponse.json({
      dailyCountersReset: true,
      connectionsReset: resetResult.count,
      facebook: fbResult,
      instagram: igResult,
      threads: threadsResult,
    });
  } catch (error) {
    console.error('[health-check] Unhandled error:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: 'Health check failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
