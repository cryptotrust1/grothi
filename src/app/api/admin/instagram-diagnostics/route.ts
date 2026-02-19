import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { runDiagnostics } from '@/lib/instagram';

/**
 * GET /api/admin/instagram-diagnostics?botId=xxx
 *
 * Admin-only endpoint that runs comprehensive Instagram diagnostics:
 * - Token validity and scopes
 * - Account info
 * - Publish permission check
 * - Test container creation
 * - Actionable recommendations
 */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const botId = request.nextUrl.searchParams.get('botId');
  if (!botId) {
    return NextResponse.json({ error: 'Missing botId parameter' }, { status: 400 });
  }

  try {
    const result = await runDiagnostics(botId);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
