import { NextResponse } from 'next/server';
import { requireAdmin, cleanupExpiredTokens } from '@/lib/auth';

export async function POST() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const result = await cleanupExpiredTokens();

    return NextResponse.json({
      success: true,
      cleaned: result,
      message: `Cleaned ${result.sessions} sessions, ${result.verificationTokens} verification tokens, ${result.resetTokens} reset tokens`,
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Cleanup failed' },
      { status: 500 }
    );
  }
}
