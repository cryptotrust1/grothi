import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { decrypt } from './encryption';

interface SmtpConfig {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string; // encrypted
  smtpSecure: boolean;
}

/**
 * Create a nodemailer transporter from encrypted SMTP config.
 * Password is decrypted at runtime using AES-256-GCM.
 */
export function createTransporter(config: SmtpConfig): Transporter {
  return nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure,
    auth: {
      user: config.smtpUser,
      pass: decrypt(config.smtpPass),
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
}

/**
 * Test SMTP connection. Returns success/error.
 * Used during email account setup to verify credentials.
 */
export async function testSmtpConnection(config: SmtpConfig): Promise<{ success: boolean; error?: string }> {
  try {
    const transporter = createTransporter(config);
    await transporter.verify();
    transporter.close();
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

interface SendEmailOptions {
  config: SmtpConfig;
  from: string;
  fromName?: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
  unsubscribeUrl?: string;
  trackingPixelUrl?: string;
}

/**
 * Send a single email via SMTP.
 * Automatically adds CAN-SPAM compliant unsubscribe header.
 * Injects tracking pixel for open tracking if provided.
 */
export async function sendEmail(options: SendEmailOptions) {
  const transporter = createTransporter(options.config);

  const headers: Record<string, string> = {};

  // CAN-SPAM: List-Unsubscribe header (one-click unsubscribe)
  if (options.unsubscribeUrl) {
    headers['List-Unsubscribe'] = `<${options.unsubscribeUrl}>`;
    headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
  }

  // Inject tracking pixel for open tracking
  let html = options.html;
  if (options.trackingPixelUrl) {
    html += `<img src="${options.trackingPixelUrl}" width="1" height="1" alt="" style="display:none" />`;
  }

  const fromAddress = options.fromName
    ? `"${options.fromName}" <${options.from}>`
    : options.from;

  try {
    const result = await transporter.sendMail({
      from: fromAddress,
      to: options.to,
      subject: options.subject,
      html,
      text: options.text,
      headers,
    });

    transporter.close();

    return {
      success: true as const,
      messageId: result.messageId,
      accepted: result.accepted as string[],
      rejected: result.rejected as string[],
    };
  } catch (error) {
    transporter.close();
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Send failed',
    };
  }
}

/**
 * Wrap links in email HTML for click tracking.
 * Replaces href URLs with tracking redirect URLs.
 */
export function wrapLinksForTracking(
  html: string,
  sendId: string,
  baseUrl: string,
): string {
  return html.replace(
    /href="(https?:\/\/[^"]+)"/gi,
    (match, url) => {
      // Don't wrap unsubscribe links
      if (url.includes('/unsubscribe')) return match;
      const trackUrl = `${baseUrl}/api/email/track/click?sid=${encodeURIComponent(sendId)}&url=${encodeURIComponent(url)}`;
      return `href="${trackUrl}"`;
    },
  );
}

/**
 * Generate a 1x1 transparent GIF tracking pixel URL.
 */
export function getTrackingPixelUrl(sendId: string, baseUrl: string): string {
  return `${baseUrl}/api/email/track/open?sid=${encodeURIComponent(sendId)}`;
}

/**
 * Check if daily sending limit has been reached.
 * Resets counter if last reset was on a previous day.
 */
export function checkDailyLimit(
  sentToday: number,
  dailyLimit: number,
  lastResetAt: Date,
): { canSend: boolean; remaining: number; needsReset: boolean } {
  const now = new Date();
  const lastReset = new Date(lastResetAt);
  const needsReset =
    now.getUTCFullYear() !== lastReset.getUTCFullYear() ||
    now.getUTCMonth() !== lastReset.getUTCMonth() ||
    now.getUTCDate() !== lastReset.getUTCDate();

  const currentSent = needsReset ? 0 : sentToday;
  const remaining = dailyLimit - currentSent;

  return {
    canSend: remaining > 0,
    remaining: Math.max(0, remaining),
    needsReset,
  };
}
