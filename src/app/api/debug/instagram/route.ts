/**
 * GET /api/debug/instagram?botId=xxx
 *
 * Admin-only diagnostic endpoint for Instagram API issues.
 * Runs comprehensive checks:
 * - Token validity and permissions (via Meta debug_token API)
 * - Account info verification
 * - Test container creation with a known public image
 * - Actionable recommendations
 *
 * This endpoint does NOT publish anything — the test container
 * is created but never published (it auto-expires).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { runDiagnostics } from '@/lib/instagram';

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const botId = request.nextUrl.searchParams.get('botId');
  if (!botId) {
    return NextResponse.json({ error: 'Missing botId query parameter' }, { status: 400 });
  }

  try {
    const results = await runDiagnostics(botId);
    return NextResponse.json(results, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
