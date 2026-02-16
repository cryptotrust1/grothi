import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

/**
 * GET /api/email/contacts/export?listId=<id>&botId=<id>
 * Export contacts as CSV (GDPR data portability compliance).
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const listId = request.nextUrl.searchParams.get('listId');
    const botId = request.nextUrl.searchParams.get('botId');

    if (!listId || !botId) {
      return NextResponse.json({ error: 'listId and botId required' }, { status: 400 });
    }

    const bot = await db.bot.findFirst({ where: { id: botId, userId: user.id } });
    if (!bot) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const list = await db.emailList.findFirst({
      where: { id: listId, botId },
    });
    if (!list) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 });
    }

    const contacts = await db.emailContact.findMany({
      where: { listId },
      orderBy: { createdAt: 'asc' },
    });

    // Build CSV
    const headers = 'email,firstName,lastName,status,openCount,clickCount,consentedAt,consentSource,createdAt';
    const rows = contacts.map((c) =>
      [
        c.email,
        c.firstName || '',
        c.lastName || '',
        c.status,
        c.openCount,
        c.clickCount,
        c.consentedAt ? c.consentedAt.toISOString() : '',
        c.consentSource || '',
        c.createdAt.toISOString(),
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(','),
    );

    const csv = [headers, ...rows].join('\n');

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${list.name.replace(/[^a-zA-Z0-9]/g, '_')}_contacts.csv"`,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'NEXT_REDIRECT') throw error;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Export failed' },
      { status: 500 },
    );
  }
}
