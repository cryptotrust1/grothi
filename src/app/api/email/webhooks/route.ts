import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * Unified bounce/complaint webhook handler.
 *
 * Supports multiple providers via ?provider= query param:
 *   POST /api/email/webhooks?provider=sendgrid
 *   POST /api/email/webhooks?provider=postmark
 *   POST /api/email/webhooks?provider=ses
 *   POST /api/email/webhooks?provider=mailgun
 *   POST /api/email/webhooks?provider=generic  (messageId-based)
 *
 * Each provider sends different JSON shapes. We normalize to:
 *   { email, eventType, messageId?, bounceType?, timestamp }
 */

interface NormalizedEvent {
  email: string;
  eventType: 'bounce' | 'complaint' | 'delivered';
  messageId?: string;
  bounceType?: 'hard' | 'soft';
  timestamp?: Date;
  raw?: unknown;
}

// ============ PROVIDER PARSERS ============

function parseSendGrid(body: unknown): NormalizedEvent[] {
  // SendGrid sends an array of events
  if (!Array.isArray(body)) return [];

  return body
    .filter((e): e is Record<string, unknown> => typeof e === 'object' && e !== null)
    .flatMap((event): NormalizedEvent[] => {
      const sgEvent = String(event.event || '');
      let eventType: NormalizedEvent['eventType'] | null = null;
      let bounceType: 'hard' | 'soft' | undefined;

      if (sgEvent === 'bounce' || sgEvent === 'dropped') {
        eventType = 'bounce';
        bounceType = sgEvent === 'bounce' ? 'hard' : 'soft';
      } else if (sgEvent === 'spamreport') {
        eventType = 'complaint';
      } else if (sgEvent === 'delivered') {
        eventType = 'delivered';
      }

      if (!eventType) return [];

      const email = String(event.email || '');
      if (!email) return [];

      return [{
        email,
        eventType,
        messageId: event.sg_message_id ? String(event.sg_message_id).split('.')[0] : undefined,
        bounceType,
        timestamp: event.timestamp ? new Date(Number(event.timestamp) * 1000) : undefined,
        raw: event,
      }];
    });
}

function parsePostmark(body: unknown): NormalizedEvent[] {
  if (typeof body !== 'object' || body === null) return [];

  const event = body as Record<string, unknown>;
  const recordType = String(event.RecordType || '');

  let eventType: NormalizedEvent['eventType'] | null = null;
  let bounceType: 'hard' | 'soft' | undefined;

  if (recordType === 'Bounce') {
    eventType = 'bounce';
    const typeCode = Number(event.TypeCode || 0);
    bounceType = typeCode === 1 ? 'hard' : 'soft'; // 1 = HardBounce
  } else if (recordType === 'SpamComplaint') {
    eventType = 'complaint';
  } else if (recordType === 'Delivery') {
    eventType = 'delivered';
  }

  if (!eventType) return [];

  return [{
    email: String(event.Email || ''),
    eventType,
    messageId: event.MessageID ? String(event.MessageID) : undefined,
    bounceType,
    timestamp: event.BouncedAt ? new Date(String(event.BouncedAt)) : undefined,
    raw: event,
  }].filter(e => e.email.length > 0);
}

function parseAmazonSES(body: unknown): NormalizedEvent[] {
  if (typeof body !== 'object' || body === null) return [];

  const snsMessage = body as Record<string, unknown>;

  // SES sends via SNS — may need to confirm subscription
  if (snsMessage.Type === 'SubscriptionConfirmation') {
    console.log('[WEBHOOK] SES SNS subscription confirmation. SubscribeURL:', snsMessage.SubscribeURL);
    return [];
  }

  // Parse the actual message
  let message: Record<string, unknown>;
  try {
    message = typeof snsMessage.Message === 'string'
      ? JSON.parse(snsMessage.Message)
      : snsMessage.Message as Record<string, unknown>;
  } catch {
    return [];
  }

  if (!message) return [];

  const notifType = String(message.notificationType || '');
  const events: NormalizedEvent[] = [];

  if (notifType === 'Bounce') {
    const bounce = message.bounce as Record<string, unknown> | undefined;
    const recipients = bounce?.bouncedRecipients as Array<{ emailAddress: string }> | undefined;
    const bounceType = String(bounce?.bounceType || '') === 'Permanent' ? 'hard' as const : 'soft' as const;

    if (recipients) {
      for (const r of recipients) {
        events.push({
          email: r.emailAddress,
          eventType: 'bounce',
          bounceType,
          timestamp: bounce?.timestamp ? new Date(String(bounce.timestamp)) : undefined,
          raw: message,
        });
      }
    }
  } else if (notifType === 'Complaint') {
    const complaint = message.complaint as Record<string, unknown> | undefined;
    const recipients = complaint?.complainedRecipients as Array<{ emailAddress: string }> | undefined;

    if (recipients) {
      for (const r of recipients) {
        events.push({
          email: r.emailAddress,
          eventType: 'complaint',
          timestamp: complaint?.timestamp ? new Date(String(complaint.timestamp)) : undefined,
          raw: message,
        });
      }
    }
  }

  return events;
}

function parseMailgun(body: unknown): NormalizedEvent[] {
  if (typeof body !== 'object' || body === null) return [];

  const event = body as Record<string, unknown>;
  const eventData = (event['event-data'] || event) as Record<string, unknown>;
  const mgEvent = String(eventData.event || '');

  let eventType: NormalizedEvent['eventType'] | null = null;
  let bounceType: 'hard' | 'soft' | undefined;

  if (mgEvent === 'failed') {
    eventType = 'bounce';
    const severity = String(eventData.severity || '');
    bounceType = severity === 'permanent' ? 'hard' : 'soft';
  } else if (mgEvent === 'complained') {
    eventType = 'complaint';
  } else if (mgEvent === 'delivered') {
    eventType = 'delivered';
  }

  if (!eventType) return [];

  const recipient = String(eventData.recipient || '');
  const headers = eventData.message as Record<string, unknown> | undefined;
  const messageId = headers?.headers as Record<string, unknown> | undefined;

  return [{
    email: recipient,
    eventType,
    messageId: messageId?.['message-id'] ? String(messageId['message-id']) : undefined,
    bounceType,
    timestamp: eventData.timestamp ? new Date(Number(eventData.timestamp) * 1000) : undefined,
    raw: event,
  }].filter(e => e.email.length > 0);
}

function parseGeneric(body: unknown): NormalizedEvent[] {
  if (typeof body !== 'object' || body === null) return [];

  const event = body as Record<string, unknown>;
  const email = String(event.email || event.recipient || '');
  const type = String(event.event || event.type || event.eventType || '');

  let eventType: NormalizedEvent['eventType'] | null = null;
  let bounceType: 'hard' | 'soft' | undefined;

  if (['bounce', 'hard_bounce', 'soft_bounce'].includes(type)) {
    eventType = 'bounce';
    bounceType = type === 'soft_bounce' ? 'soft' : 'hard';
  } else if (['complaint', 'spam', 'spamreport'].includes(type)) {
    eventType = 'complaint';
  }

  if (!eventType || !email) return [];

  return [{
    email,
    eventType,
    messageId: event.messageId ? String(event.messageId) : undefined,
    bounceType,
    raw: event,
  }];
}

// ============ EVENT PROCESSOR ============

async function processEvents(events: NormalizedEvent[]) {
  let processed = 0;

  for (const event of events) {
    try {
      // Find contact(s) by email
      const contacts = await db.emailContact.findMany({
        where: { email: event.email.toLowerCase(), status: 'ACTIVE' },
      });

      if (contacts.length === 0) continue;

      for (const contact of contacts) {
        if (event.eventType === 'bounce' && event.bounceType === 'hard') {
          // Hard bounce: mark contact as BOUNCED immediately
          await db.emailContact.update({
            where: { id: contact.id },
            data: { status: 'BOUNCED' },
          });

          // Update list contact count
          await db.emailList.update({
            where: { id: contact.listId },
            data: { contactCount: { decrement: 1 } },
          });

          // Find matching EmailSend by messageId or most recent
          const send = event.messageId
            ? await db.emailSend.findFirst({ where: { messageId: event.messageId } })
            : await db.emailSend.findFirst({
                where: { contactId: contact.id, status: 'SENT' },
                orderBy: { sentAt: 'desc' },
              });

          if (send) {
            await db.emailSend.update({
              where: { id: send.id },
              data: { status: 'BOUNCED', bouncedAt: new Date() },
            });
            await db.emailEvent.create({
              data: {
                sendId: send.id,
                contactId: contact.id,
                type: 'BOUNCED',
                data: event.raw ? JSON.parse(JSON.stringify(event.raw)) : undefined,
              },
            });
            await db.emailCampaign.update({
              where: { id: send.campaignId },
              data: { totalBounced: { increment: 1 } },
            });
          }

          processed++;
        } else if (event.eventType === 'bounce' && event.bounceType === 'soft') {
          // Soft bounce: increment counter, auto-suppress after 3 consecutive
          const SOFT_BOUNCE_THRESHOLD = 3;
          const updated = await db.emailContact.update({
            where: { id: contact.id },
            data: { softBounceCount: { increment: 1 } },
          });

          const send = event.messageId
            ? await db.emailSend.findFirst({ where: { messageId: event.messageId } })
            : await db.emailSend.findFirst({
                where: { contactId: contact.id, status: 'SENT' },
                orderBy: { sentAt: 'desc' },
              });

          if (send) {
            await db.emailEvent.create({
              data: {
                sendId: send.id,
                contactId: contact.id,
                type: 'BOUNCED',
                data: { ...(event.raw ? JSON.parse(JSON.stringify(event.raw)) : {}), softBounce: true },
              },
            });
          }

          // Auto-suppress after threshold consecutive soft bounces
          if (updated.softBounceCount >= SOFT_BOUNCE_THRESHOLD) {
            await db.emailContact.update({
              where: { id: contact.id },
              data: { status: 'BOUNCED' },
            });
            await db.emailList.update({
              where: { id: contact.listId },
              data: { contactCount: { decrement: 1 } },
            });
            if (send) {
              await db.emailSend.update({
                where: { id: send.id },
                data: { status: 'BOUNCED', bouncedAt: new Date() },
              });
              await db.emailCampaign.update({
                where: { id: send.campaignId },
                data: { totalBounced: { increment: 1 } },
              });
            }
            console.log(`[WEBHOOK] Contact ${contact.email} auto-suppressed after ${SOFT_BOUNCE_THRESHOLD} soft bounces`);
          }

          processed++;
        } else if (event.eventType === 'complaint') {
          // Spam complaint: mark contact as COMPLAINED
          await db.emailContact.update({
            where: { id: contact.id },
            data: { status: 'COMPLAINED' },
          });

          await db.emailList.update({
            where: { id: contact.listId },
            data: { contactCount: { decrement: 1 } },
          });

          const send = event.messageId
            ? await db.emailSend.findFirst({ where: { messageId: event.messageId } })
            : await db.emailSend.findFirst({
                where: { contactId: contact.id, status: { in: ['SENT', 'DELIVERED', 'OPENED'] } },
                orderBy: { sentAt: 'desc' },
              });

          if (send) {
            await db.emailSend.update({
              where: { id: send.id },
              data: { status: 'COMPLAINED' },
            });
            await db.emailEvent.create({
              data: {
                sendId: send.id,
                contactId: contact.id,
                type: 'COMPLAINED',
                data: event.raw ? JSON.parse(JSON.stringify(event.raw)) : undefined,
              },
            });
            await db.emailCampaign.update({
              where: { id: send.campaignId },
              data: { totalComplaints: { increment: 1 } },
            });
          }

          processed++;
        } else if (event.eventType === 'delivered') {
          const send = event.messageId
            ? await db.emailSend.findFirst({ where: { messageId: event.messageId } })
            : null;

          if (send && send.status === 'SENT') {
            await db.emailSend.update({
              where: { id: send.id },
              data: { status: 'DELIVERED' },
            });
            await db.emailEvent.create({
              data: {
                sendId: send.id,
                contactId: contact.id,
                type: 'DELIVERED',
              },
            });

            // Reset soft bounce counter on confirmed delivery.
            // This is the correct place — DELIVERED webhook confirms mailbox
            // accepted the message, unlike SMTP acceptance which only means
            // the relay accepted it.
            if (contact.softBounceCount > 0) {
              await db.emailContact.update({
                where: { id: contact.id },
                data: { softBounceCount: 0 },
              });
            }
          }

          processed++;
        }
      }
    } catch (error) {
      console.error(`[WEBHOOK] Error processing event for ${event.email}:`, error instanceof Error ? error.message : error);
    }
  }

  return processed;
}

// ============ ROUTE HANDLER ============

export async function POST(request: NextRequest) {
  const provider = request.nextUrl.searchParams.get('provider') || 'generic';

  // Webhook secret validation (optional but recommended)
  const webhookSecret = process.env.EMAIL_WEBHOOK_SECRET;
  if (webhookSecret) {
    const authHeader = request.headers.get('authorization') || request.headers.get('x-webhook-secret') || '';
    if (authHeader !== `Bearer ${webhookSecret}` && authHeader !== webhookSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  let events: NormalizedEvent[];

  switch (provider) {
    case 'sendgrid':
      events = parseSendGrid(body);
      break;
    case 'postmark':
      events = parsePostmark(body);
      break;
    case 'ses':
    case 'amazon':
      events = parseAmazonSES(body);
      break;
    case 'mailgun':
      events = parseMailgun(body);
      break;
    default:
      events = parseGeneric(body);
  }

  if (events.length === 0) {
    return NextResponse.json({ ok: true, processed: 0 });
  }

  const processed = await processEvents(events);

  console.log(`[WEBHOOK] ${provider}: processed ${processed}/${events.length} events`);

  return NextResponse.json({ ok: true, processed, total: events.length });
}

// SES SNS subscription confirmation needs GET
export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'ok',
    message: 'Email webhook endpoint active',
    providers: ['sendgrid', 'postmark', 'ses', 'mailgun', 'generic'],
    usage: 'POST /api/email/webhooks?provider=<provider>',
  });
}
