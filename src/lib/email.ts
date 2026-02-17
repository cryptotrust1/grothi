import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import crypto from 'crypto';
import { decrypt } from './encryption';

// ============ CAMPAIGN EMAIL (user SMTP via encrypted credentials) ============

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
    requireTLS: !config.smtpSecure, // Enforce STARTTLS when not using implicit TLS
    auth: {
      user: config.smtpUser,
      pass: decrypt(config.smtpPass),
    },
    tls: {
      minVersion: 'TLSv1.2',
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

interface SendCampaignEmailOptions {
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
 * Send a single campaign email via user's SMTP.
 * Automatically adds CAN-SPAM compliant unsubscribe header.
 * Injects tracking pixel for open tracking if provided.
 */
export async function sendCampaignEmail(options: SendCampaignEmailOptions) {
  const transporter = createTransporter(options.config);

  const headers: Record<string, string> = {};

  // CAN-SPAM: List-Unsubscribe header (one-click unsubscribe)
  // RFC 8058: include both HTTPS URL and mailto: for maximum compatibility (Gmail requires both)
  if (options.unsubscribeUrl) {
    headers['List-Unsubscribe'] = `<${options.unsubscribeUrl}>, <mailto:${options.from}?subject=unsubscribe>`;
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
 * Prepare a campaign email for sending.
 * Handles personalization (merge tags), click tracking, open tracking pixel,
 * and CAN-SPAM unsubscribe footer. This is the single source of truth for
 * email preparation — used by the API route, server actions, and job runner.
 */
export function prepareCampaignHtml(options: {
  html: string;
  text?: string | null;
  contact: { id: string; email: string; firstName?: string | null; lastName?: string | null };
  sendId: string;
  listId: string;
  brandName: string;
  baseUrl: string;
  physicalAddress?: string | null;
}): { html: string; text: string | undefined; unsubscribeUrl: string; trackingPixelUrl: string } {
  const { contact, sendId, listId, brandName, baseUrl } = options;

  // Personalize HTML
  let html = options.html;
  html = html.replace(/\{\{firstName\}\}/g, contact.firstName || '');
  html = html.replace(/\{\{lastName\}\}/g, contact.lastName || '');
  html = html.replace(/\{\{email\}\}/g, contact.email);
  html = html.replace(/\{\{brandName\}\}/g, brandName);

  // Tracking
  const trackingPixelUrl = getTrackingPixelUrl(sendId, baseUrl);
  html = wrapLinksForTracking(html, sendId, baseUrl);

  // CAN-SPAM compliant footer with HMAC-signed unsubscribe URL
  const unsubscribeUrl = getSignedUnsubscribeUrl(contact.id, listId, baseUrl);
  html += `<div style="margin-top:20px;padding-top:15px;border-top:1px solid #eee;font-size:12px;color:#999;text-align:center;">`;
  html += `<p>You received this because you subscribed to ${brandName}.</p>`;
  if (options.physicalAddress) {
    html += `<p>${options.physicalAddress.replace(/\n/g, '<br>')}</p>`;
  }
  html += `<p><a href="${unsubscribeUrl}" style="color:#999;">Unsubscribe</a></p>`;
  html += `</div>`;

  // Personalize text version
  let text: string | undefined;
  if (options.text) {
    text = options.text;
    text = text.replace(/\{\{firstName\}\}/g, contact.firstName || '');
    text = text.replace(/\{\{lastName\}\}/g, contact.lastName || '');
    text = text.replace(/\{\{email\}\}/g, contact.email);
    text += `\n\nUnsubscribe: ${unsubscribeUrl}`;
  }

  return { html, text, unsubscribeUrl, trackingPixelUrl };
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

// ============ HMAC-SIGNED UNSUBSCRIBE URLs ============

function getHmacSecret(): string {
  return process.env.NEXTAUTH_SECRET || process.env.ENCRYPTION_KEY || '';
}

/**
 * Generate an HMAC-signed unsubscribe URL.
 * Prevents forged unsubscribes by requiring a valid signature.
 */
export function getSignedUnsubscribeUrl(contactId: string, listId: string, baseUrl: string): string {
  const data = `${contactId}:${listId}`;
  const sig = crypto
    .createHmac('sha256', getHmacSecret())
    .update(data)
    .digest('hex')
    .slice(0, 16); // 16 hex chars = 64 bits, sufficient for anti-tampering

  return `${baseUrl}/api/email/unsubscribe?cid=${encodeURIComponent(contactId)}&lid=${encodeURIComponent(listId)}&sig=${sig}`;
}

/**
 * Verify an HMAC signature on an unsubscribe URL.
 */
export function verifyUnsubscribeSignature(contactId: string, listId: string, signature: string): boolean {
  const data = `${contactId}:${listId}`;
  const expected = crypto
    .createHmac('sha256', getHmacSecret())
    .update(data)
    .digest('hex')
    .slice(0, 16);

  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

/**
 * Delay helper for rate limiting between email sends.
 * Default: 100ms between emails (~600/min, safe for most SMTP providers).
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============ TRANSACTIONAL EMAIL (system SMTP via env vars) ============

// Cached transporter — created once, reused for all transactional emails.
// Nodemailer handles connection pooling and reconnects internally.
let cachedTransporter: Transporter | null = null;
let smtpChecked = false;

function getSystemTransporter(): Transporter | null {
  if (cachedTransporter) return cachedTransporter;
  if (smtpChecked) return null; // Already checked, SMTP not configured

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  smtpChecked = true;

  if (!host || !user || !pass) {
    const missing = [!host && 'SMTP_HOST', !user && 'SMTP_USER', !pass && 'SMTP_PASS'].filter(Boolean);
    if (process.env.NODE_ENV === 'production') {
      console.error(`[EMAIL] CRITICAL: SMTP not configured in production. Missing: ${missing.join(', ')}. Transactional emails will NOT be sent.`);
    } else {
      console.warn(`[EMAIL] SMTP not configured (missing: ${missing.join(', ')}). Emails will be logged to console.`);
    }
    return null;
  }

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    requireTLS: port !== 465, // Enforce STARTTLS on port 587
    auth: { user, pass },
    tls: {
      minVersion: 'TLSv1.2',
    },
    pool: true,
    maxConnections: 3,
    maxMessages: 100,
  });

  // Non-blocking: verify SMTP connection on first use
  cachedTransporter.verify()
    .then(() => console.log(`[EMAIL] SMTP connected: ${host}:${port} as ${user}`))
    .catch((err) => {
      console.error(`[EMAIL] SMTP verify failed: ${err instanceof Error ? err.message : err}. Will retry on next email send.`);
      cachedTransporter = null;
      smtpChecked = false; // Allow retry on next send attempt
    });

  return cachedTransporter;
}

function getEmailFrom(): string {
  return process.env.EMAIL_FROM || 'Grothi <noreply@grothi.com>';
}

function getAppUrl(): string {
  return process.env.NEXTAUTH_URL || 'https://grothi.com';
}

async function sendTransactionalEmail(to: string, subject: string, html: string, text?: string) {
  const transporter = getSystemTransporter();

  if (!transporter) {
    console.error(`[EMAIL] NOT SENT (SMTP not configured) To: ${to} | Subject: ${subject} — Check SMTP_HOST, SMTP_USER, SMTP_PASS env vars`);
    return { success: false, reason: 'SMTP not configured' };
  }

  try {
    const result = await transporter.sendMail({
      from: getEmailFrom(),
      to,
      subject,
      html,
      text: text || subject,
      headers: {
        'X-PM-Message-Stream': 'outbound', // Postmark: explicit transactional stream
      },
    });
    console.log(`[EMAIL] Sent: "${subject}" -> ${to} (${result.messageId})`);
    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[EMAIL] FAILED: "${subject}" -> ${to} | Error: ${msg}`);
    // Reset cached transporter on auth/connection errors so next attempt reconnects
    if (msg.includes('auth') || msg.includes('connect') || msg.includes('ECONNR')) {
      cachedTransporter = null;
      smtpChecked = false;
    }
    return { success: false, reason: msg };
  }
}

// ============ EMAIL TEMPLATES ============

function baseLayout(content: string) {
  const appUrl = getAppUrl();
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: #f4f4f5; color: #18181b; }
    .container { max-width: 560px; margin: 0 auto; padding: 40px 20px; }
    .card { background: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .logo { font-size: 24px; font-weight: 700; color: #6366f1; text-decoration: none; }
    .btn { display: inline-block; background: #6366f1; color: #ffffff !important; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; }
    .footer { text-align: center; margin-top: 24px; font-size: 12px; color: #a1a1aa; }
    h2 { margin: 0 0 16px 0; font-size: 20px; }
    p { margin: 0 0 16px 0; line-height: 1.6; color: #3f3f46; font-size: 14px; }
    .code { background: #f4f4f5; border: 1px solid #e4e4e7; border-radius: 8px; padding: 16px; text-align: center; font-size: 32px; font-weight: 700; letter-spacing: 4px; color: #18181b; margin: 16px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div style="text-align: center; margin-bottom: 24px;">
      <a href="${appUrl}" class="logo">Grothi</a>
    </div>
    <div class="card">
      ${content}
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} Grothi. All rights reserved.</p>
      <p><a href="${appUrl}" style="color: #a1a1aa;">grothi.com</a></p>
    </div>
  </div>
</body>
</html>`;
}

// ============ TRANSACTIONAL EMAIL FUNCTIONS ============

export async function sendWelcomeEmail(to: string, name: string) {
  const appUrl = getAppUrl();
  const html = baseLayout(`
    <h2>Welcome to Grothi, ${escapeHtml(name)}!</h2>
    <p>Your account has been created and you've received <strong>100 free credits</strong> to get started.</p>
    <p>Here's what you can do next:</p>
    <ul style="color: #3f3f46; font-size: 14px; line-height: 2;">
      <li>Create your first AI marketing bot</li>
      <li>Connect your social media platforms</li>
      <li>Let your bot generate and post content automatically</li>
    </ul>
    <p style="text-align: center; margin-top: 24px;">
      <a href="${appUrl}/dashboard" class="btn">Go to Dashboard</a>
    </p>
  `);

  return sendTransactionalEmail(to, 'Welcome to Grothi — Your AI Marketing Bot', html,
    `Welcome to Grothi, ${name}! You've received 100 free credits. Get started at ${appUrl}/dashboard`
  );
}

export async function sendEmailVerificationEmail(to: string, name: string, token: string) {
  const verifyUrl = `${getAppUrl()}/auth/verify-email?token=${encodeURIComponent(token)}`;

  const html = baseLayout(`
    <h2>Verify your email address</h2>
    <p>Hi ${escapeHtml(name)},</p>
    <p>Please verify your email address by clicking the button below:</p>
    <p style="text-align: center; margin: 24px 0;">
      <a href="${verifyUrl}" class="btn">Verify Email</a>
    </p>
    <p style="font-size: 12px; color: #a1a1aa;">
      If you didn't create an account on Grothi, you can safely ignore this email.
      This link expires in 24 hours.
    </p>
    <p style="font-size: 12px; color: #a1a1aa;">
      Or copy and paste this URL: ${verifyUrl}
    </p>
  `);

  return sendTransactionalEmail(to, 'Verify your email — Grothi', html,
    `Hi ${name}, verify your email: ${verifyUrl}`
  );
}

export async function sendPasswordResetEmail(to: string, name: string, token: string) {
  const resetUrl = `${getAppUrl()}/auth/reset-password?token=${encodeURIComponent(token)}`;

  const html = baseLayout(`
    <h2>Reset your password</h2>
    <p>Hi ${escapeHtml(name)},</p>
    <p>We received a request to reset your password. Click the button below to choose a new password:</p>
    <p style="text-align: center; margin: 24px 0;">
      <a href="${resetUrl}" class="btn">Reset Password</a>
    </p>
    <p style="font-size: 12px; color: #a1a1aa;">
      If you didn't request a password reset, you can safely ignore this email. Your password won't change.
      This link expires in 1 hour.
    </p>
    <p style="font-size: 12px; color: #a1a1aa;">
      Or copy and paste this URL: ${resetUrl}
    </p>
  `);

  return sendTransactionalEmail(to, 'Reset your password — Grothi', html,
    `Hi ${name}, reset your password: ${resetUrl}`
  );
}

export async function sendContactNotificationEmail(name: string, email: string, message: string) {
  const adminEmail = process.env.CONTACT_NOTIFY_EMAIL || 'support@grothi.com';

  const html = baseLayout(`
    <h2>New Contact Message</h2>
    <p><strong>From:</strong> ${escapeHtml(name)} (${escapeHtml(email)})</p>
    <div style="background: #f4f4f5; border-radius: 8px; padding: 16px; margin: 16px 0;">
      <p style="white-space: pre-wrap; margin: 0;">${escapeHtml(message)}</p>
    </div>
    <p style="font-size: 12px; color: #a1a1aa;">
      You can also view this message in the <a href="${getAppUrl()}/admin/contacts" style="color: #6366f1;">admin panel</a>.
    </p>
  `);

  return sendTransactionalEmail(adminEmail, `[Grothi Contact] Message from ${name}`, html,
    `New contact from ${name} (${email}): ${message}`
  );
}

export async function sendContactConfirmationEmail(to: string, name: string) {
  const html = baseLayout(`
    <h2>We received your message</h2>
    <p>Hi ${escapeHtml(name)},</p>
    <p>Thank you for reaching out to Grothi. We've received your message and will get back to you within 24 hours.</p>
    <p>If you have an urgent question, you can reply to this email or contact us at <a href="mailto:support@grothi.com" style="color: #6366f1;">support@grothi.com</a>.</p>
  `);

  return sendTransactionalEmail(to, 'We received your message — Grothi', html,
    `Hi ${name}, we received your message. We'll get back to you within 24 hours. — Grothi Team`
  );
}

// ============ HELPERS ============

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
