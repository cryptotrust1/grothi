import { NextResponse } from 'next/server';
import { verify2FAAndCreateSession } from '@/lib/auth';

// POST /api/auth/2fa/verify — Verify TOTP code during sign-in
export async function POST(request: Request) {
  let body: { pendingToken?: string; code?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { pendingToken, code } = body;

  if (!pendingToken || typeof pendingToken !== 'string') {
    return NextResponse.json({ error: 'Missing pending token' }, { status: 400 });
  }

  if (!code || typeof code !== 'string') {
    return NextResponse.json({ error: 'Missing verification code' }, { status: 400 });
  }

  try {
    await verify2FAAndCreateSession(pendingToken, code);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Verification failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
