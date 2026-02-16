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
import { db } from '@/lib/db';
import { healthCheckAllConnections } from '@/lib/facebook';

const CRON_SECRET = process.env.CRON_SECRET;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = authHeader?.replace('Bearer ', '');

  if (CRON_SECRET && cronSecret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Reset daily counters for all connections
  await db.platformConnection.updateMany({
    data: { postsToday: 0, repliesToday: 0 },
  });

  // Validate all Facebook connections
  const fbResult = await healthCheckAllConnections();

  return NextResponse.json({
    dailyCountersReset: true,
    facebook: fbResult,
  });
}
