import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
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

// ============ TRANSACTIONAL EMAIL (system SMTP via env vars) ============

function getSystemTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.warn('SMTP not configured — emails will be logged to console only');
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

const EMAIL_FROM = process.env.EMAIL_FROM || 'Grothi <noreply@grothi.com>';
const APP_URL = process.env.NEXTAUTH_URL || 'https://grothi.com';

async function sendTransactionalEmail(to: string, subject: string, html: string, text?: string) {
  const transporter = getSystemTransporter();

  if (!transporter) {
    console.log(`[EMAIL] To: ${to}`);
    console.log(`[EMAIL] Subject: ${subject}`);
    console.log(`[EMAIL] Body (text): ${text || '(html only)'}`);
    return { success: false, reason: 'SMTP not configured' };
  }

  try {
    await transporter.sendMail({
      from: EMAIL_FROM,
      to,
      subject,
      html,
      text: text || subject,
    });
    return { success: true };
  } catch (error) {
    console.error('[EMAIL] Send failed:', error instanceof Error ? error.message : error);
    return { success: false, reason: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ============ EMAIL TEMPLATES ============

function baseLayout(content: string) {
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
      <a href="${APP_URL}" class="logo">Grothi</a>
    </div>
    <div class="card">
      ${content}
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} Grothi. All rights reserved.</p>
      <p><a href="${APP_URL}" style="color: #a1a1aa;">grothi.com</a></p>
    </div>
  </div>
</body>
</html>`;
}

// ============ TRANSACTIONAL EMAIL FUNCTIONS ============

export async function sendWelcomeEmail(to: string, name: string) {
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
      <a href="${APP_URL}/dashboard" class="btn">Go to Dashboard</a>
    </p>
  `);

  return sendTransactionalEmail(to, 'Welcome to Grothi — Your AI Marketing Bot', html,
    `Welcome to Grothi, ${name}! You've received 100 free credits. Get started at ${APP_URL}/dashboard`
  );
}

export async function sendEmailVerificationEmail(to: string, name: string, token: string) {
  const verifyUrl = `${APP_URL}/auth/verify-email?token=${encodeURIComponent(token)}`;

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
  const resetUrl = `${APP_URL}/auth/reset-password?token=${encodeURIComponent(token)}`;

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
      You can also view this message in the <a href="${APP_URL}/admin/contacts" style="color: #6366f1;">admin panel</a>.
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
