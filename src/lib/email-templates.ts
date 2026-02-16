// Pre-built responsive HTML email templates
// Each template is mobile-responsive and CAN-SPAM compliant

export interface EmailTemplate {
  id: string;
  name: string;
  category: 'newsletter' | 'promotional' | 'welcome' | 'announcement' | 'product' | 'minimal';
  description: string;
  previewText: string;
  html: string;
}

function baseLayout(content: string, bgColor = '#f4f4f7'): string {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>{{subject}}</title>
<style>
  body, table, td { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
  body { margin: 0; padding: 0; width: 100%; background-color: ${bgColor}; }
  .wrapper { width: 100%; background-color: ${bgColor}; padding: 40px 0; }
  .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; }
  .header { padding: 30px 40px; }
  .content { padding: 0 40px 30px; }
  .footer { padding: 20px 40px; background-color: #f8f9fa; font-size: 12px; color: #999; text-align: center; }
  h1 { font-size: 24px; font-weight: 700; color: #1a1a2e; margin: 0 0 16px; line-height: 1.3; }
  h2 { font-size: 20px; font-weight: 600; color: #1a1a2e; margin: 0 0 12px; line-height: 1.3; }
  p { font-size: 16px; line-height: 1.6; color: #4a4a68; margin: 0 0 16px; }
  a { color: #6366f1; text-decoration: none; }
  .btn { display: inline-block; background-color: #6366f1; color: #ffffff !important; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px; }
  .btn:hover { background-color: #4f46e5; }
  .btn-outline { display: inline-block; border: 2px solid #6366f1; color: #6366f1 !important; padding: 10px 26px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px; background: transparent; }
  .divider { border: none; border-top: 1px solid #e5e7eb; margin: 24px 0; }
  .muted { color: #9ca3af; font-size: 14px; }
  .highlight { background-color: #f0f0ff; padding: 20px; border-radius: 6px; border-left: 4px solid #6366f1; margin: 20px 0; }
  img { max-width: 100%; height: auto; }
  @media only screen and (max-width: 620px) {
    .wrapper { padding: 20px 10px !important; }
    .container { width: 100% !important; }
    .header, .content, .footer { padding-left: 20px !important; padding-right: 20px !important; }
    h1 { font-size: 22px !important; }
  }
</style>
</head>
<body>
<div class="wrapper">
  <div class="container">
    ${content}
  </div>
</div>
</body>
</html>`;
}

export const EMAIL_TEMPLATES: EmailTemplate[] = [
  // ============ NEWSLETTER ============
  {
    id: 'newsletter-classic',
    name: 'Classic Newsletter',
    category: 'newsletter',
    description: 'Clean newsletter layout with header, articles, and CTA',
    previewText: 'Your latest news and updates',
    html: baseLayout(`
    <div class="header" style="background-color: #6366f1; text-align: center;">
      <h1 style="color: #ffffff; margin: 0;">{{brandName}}</h1>
      <p style="color: #c7d2fe; margin: 8px 0 0; font-size: 14px;">{{subject}}</p>
    </div>
    <div class="content">
      <h1>Hello {{firstName}},</h1>
      <p>Here are the latest updates and news we wanted to share with you this week.</p>

      <hr class="divider">

      <h2>Featured Article</h2>
      <p>Write your main article content here. Share insights, tips, or news that your subscribers will find valuable.</p>
      <p><a href="{{targetUrl}}" class="btn">Read More</a></p>

      <hr class="divider">

      <h2>Quick Updates</h2>
      <div class="highlight">
        <p style="margin: 0;"><strong>Update 1:</strong> Brief description of your first update or announcement.</p>
      </div>
      <div class="highlight">
        <p style="margin: 0;"><strong>Update 2:</strong> Brief description of your second update or announcement.</p>
      </div>

      <hr class="divider">

      <p class="muted">Thanks for reading! Reply to this email if you have any questions.</p>
    </div>
    <div class="footer">
      <p>You received this email because you subscribed to {{brandName}}.</p>
    </div>`),
  },

  {
    id: 'newsletter-minimal',
    name: 'Minimal Newsletter',
    category: 'newsletter',
    description: 'Simple text-focused newsletter',
    previewText: 'Your weekly digest',
    html: baseLayout(`
    <div class="header">
      <p class="muted" style="margin: 0;">{{brandName}} Newsletter</p>
    </div>
    <div class="content">
      <h1>{{subject}}</h1>
      <p>Hi {{firstName}},</p>
      <p>Welcome to this edition of our newsletter. Here is what you need to know:</p>

      <h2>1. First Topic</h2>
      <p>Describe your first topic here. Keep it concise and valuable.</p>

      <h2>2. Second Topic</h2>
      <p>Describe your second topic here. Include actionable insights.</p>

      <h2>3. Third Topic</h2>
      <p>Describe your third topic here. End with a clear takeaway.</p>

      <hr class="divider">

      <p>Until next time,<br><strong>{{brandName}} Team</strong></p>
    </div>
    <div class="footer">
      <p>You subscribed to updates from {{brandName}}.</p>
    </div>`),
  },

  // ============ WELCOME ============
  {
    id: 'welcome-friendly',
    name: 'Friendly Welcome',
    category: 'welcome',
    description: 'Warm welcome email for new subscribers',
    previewText: 'Welcome aboard!',
    html: baseLayout(`
    <div class="header" style="background-color: #6366f1; text-align: center; padding: 40px;">
      <h1 style="color: #ffffff; font-size: 28px;">Welcome to {{brandName}}!</h1>
    </div>
    <div class="content">
      <h1>Hey {{firstName}}, welcome aboard!</h1>
      <p>We are thrilled to have you with us. Here is what you can expect:</p>

      <div class="highlight">
        <p style="margin: 0 0 8px;"><strong>Regular Updates</strong><br>Stay informed with our latest news, tips, and insights delivered straight to your inbox.</p>
      </div>
      <div class="highlight">
        <p style="margin: 0 0 8px;"><strong>Exclusive Content</strong><br>Get access to content and offers available only to our email subscribers.</p>
      </div>
      <div class="highlight">
        <p style="margin: 0;"><strong>Community</strong><br>Join a community of like-minded people who share your interests.</p>
      </div>

      <p style="text-align: center; margin-top: 30px;">
        <a href="{{targetUrl}}" class="btn">Get Started</a>
      </p>

      <hr class="divider">

      <p>If you have any questions, just reply to this email. We are always happy to help.</p>
      <p>Best regards,<br><strong>{{brandName}} Team</strong></p>
    </div>
    <div class="footer">
      <p>You are receiving this because you signed up for {{brandName}}.</p>
    </div>`),
  },

  // ============ PROMOTIONAL ============
  {
    id: 'promo-offer',
    name: 'Special Offer',
    category: 'promotional',
    description: 'Promotional email with offer highlight and CTA',
    previewText: 'A special offer just for you',
    html: baseLayout(`
    <div class="header" style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); text-align: center; padding: 40px;">
      <p style="color: #c7d2fe; margin: 0; font-size: 14px; text-transform: uppercase; letter-spacing: 2px;">Limited Time Offer</p>
      <h1 style="color: #ffffff; font-size: 32px; margin: 12px 0 0;">{{subject}}</h1>
    </div>
    <div class="content">
      <p>Hi {{firstName}},</p>
      <p>We have something special for you. For a limited time, take advantage of this exclusive offer:</p>

      <div style="text-align: center; background: #f8f7ff; padding: 30px; border-radius: 8px; margin: 24px 0;">
        <p style="font-size: 48px; font-weight: 700; color: #6366f1; margin: 0;">20% OFF</p>
        <p style="font-size: 18px; color: #4a4a68; margin: 8px 0 0;">Use code: <strong>SAVE20</strong></p>
      </div>

      <p>Do not miss out on this opportunity. This offer expires soon.</p>

      <p style="text-align: center; margin: 30px 0;">
        <a href="{{targetUrl}}" class="btn" style="font-size: 18px; padding: 14px 32px;">Shop Now</a>
      </p>

      <hr class="divider">

      <p class="muted" style="text-align: center;">Offer valid while supplies last. Terms and conditions apply.</p>
    </div>
    <div class="footer">
      <p>You received this promotional email from {{brandName}}.</p>
    </div>`, '#f0f0ff'),
  },

  {
    id: 'promo-product',
    name: 'Product Launch',
    category: 'product',
    description: 'Product launch or feature announcement',
    previewText: 'Introducing something new',
    html: baseLayout(`
    <div class="header" style="text-align: center; padding: 40px; background-color: #1a1a2e;">
      <p style="color: #6366f1; margin: 0; font-size: 14px; text-transform: uppercase; letter-spacing: 2px;">Just Launched</p>
      <h1 style="color: #ffffff; font-size: 28px; margin: 12px 0 0;">{{subject}}</h1>
    </div>
    <div class="content">
      <p>Hi {{firstName}},</p>
      <p>We are excited to introduce our latest offering. Here is what makes it special:</p>

      <table style="width: 100%; margin: 24px 0;" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding: 12px 16px; background: #f8f9fa; border-radius: 6px; margin-bottom: 8px;">
            <strong>Feature 1</strong><br>
            <span class="muted">Description of your first key feature or benefit.</span>
          </td>
        </tr>
        <tr><td style="height: 8px;"></td></tr>
        <tr>
          <td style="padding: 12px 16px; background: #f8f9fa; border-radius: 6px;">
            <strong>Feature 2</strong><br>
            <span class="muted">Description of your second key feature or benefit.</span>
          </td>
        </tr>
        <tr><td style="height: 8px;"></td></tr>
        <tr>
          <td style="padding: 12px 16px; background: #f8f9fa; border-radius: 6px;">
            <strong>Feature 3</strong><br>
            <span class="muted">Description of your third key feature or benefit.</span>
          </td>
        </tr>
      </table>

      <p style="text-align: center;">
        <a href="{{targetUrl}}" class="btn">Learn More</a>
        &nbsp;&nbsp;
        <a href="{{targetUrl}}" class="btn-outline">Watch Demo</a>
      </p>
    </div>
    <div class="footer">
      <p>You are subscribed to product updates from {{brandName}}.</p>
    </div>`),
  },

  // ============ ANNOUNCEMENT ============
  {
    id: 'announcement-simple',
    name: 'Simple Announcement',
    category: 'announcement',
    description: 'Clean announcement with a single message',
    previewText: 'Important announcement',
    html: baseLayout(`
    <div class="header">
      <p class="muted" style="margin: 0;">{{brandName}}</p>
    </div>
    <div class="content">
      <h1>{{subject}}</h1>
      <p>Dear {{firstName}},</p>
      <p>We have an important announcement to share with you.</p>
      <p>Write your announcement content here. Be clear, concise, and direct about what is changing and how it affects your subscribers.</p>

      <div class="highlight">
        <p style="margin: 0;"><strong>Key Details:</strong></p>
        <ul style="margin: 8px 0 0; padding-left: 20px; color: #4a4a68;">
          <li>Detail or action item 1</li>
          <li>Detail or action item 2</li>
          <li>Detail or action item 3</li>
        </ul>
      </div>

      <p>If you have any questions or concerns, do not hesitate to reach out.</p>

      <p style="text-align: center; margin-top: 24px;">
        <a href="{{targetUrl}}" class="btn">Learn More</a>
      </p>

      <hr class="divider">

      <p>Best regards,<br><strong>{{brandName}} Team</strong></p>
    </div>
    <div class="footer">
      <p>This is an important update from {{brandName}}.</p>
    </div>`),
  },

  // ============ MINIMAL ============
  {
    id: 'minimal-plain',
    name: 'Plain Text Style',
    category: 'minimal',
    description: 'Looks like a personal email - highest deliverability',
    previewText: 'A personal message',
    html: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{{subject}}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 40px 20px; background: #ffffff; color: #333; font-size: 16px; line-height: 1.6; }
  .container { max-width: 580px; margin: 0 auto; }
  a { color: #6366f1; }
  .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #999; }
</style>
</head>
<body>
<div class="container">
  <p>Hi {{firstName}},</p>
  <p>Write your message here. This template mimics a personal email for maximum deliverability and engagement.</p>
  <p>Plain-text style emails often outperform designed emails because they feel more personal and authentic.</p>
  <p>Best,<br>{{brandName}}</p>
  <div class="footer">
    <p>Sent by {{brandName}}</p>
  </div>
</div>
</body>
</html>`,
  },

  {
    id: 'minimal-cta',
    name: 'Simple CTA',
    category: 'minimal',
    description: 'Minimal email with one clear call-to-action',
    previewText: 'Quick update',
    html: baseLayout(`
    <div class="content" style="padding: 40px; text-align: center;">
      <h1>{{subject}}</h1>
      <p>Hi {{firstName}}, we wanted to quickly let you know about something important.</p>
      <p>Write your brief message here. Keep it focused on a single action you want the reader to take.</p>
      <p style="margin-top: 30px;">
        <a href="{{targetUrl}}" class="btn">Take Action</a>
      </p>
    </div>
    <div class="footer">
      <p>From {{brandName}}</p>
    </div>`),
  },
];

export const TEMPLATE_CATEGORIES = [
  { value: 'newsletter', label: 'Newsletter', description: 'Regular updates and digests' },
  { value: 'welcome', label: 'Welcome', description: 'New subscriber onboarding' },
  { value: 'promotional', label: 'Promotional', description: 'Offers and discounts' },
  { value: 'product', label: 'Product', description: 'Launches and features' },
  { value: 'announcement', label: 'Announcement', description: 'Important updates' },
  { value: 'minimal', label: 'Minimal', description: 'Simple text-style emails' },
] as const;

/**
 * Apply merge tags to template HTML.
 * Replaces {{brandName}}, {{targetUrl}}, {{subject}}, etc.
 */
export function applyTemplateVars(
  html: string,
  vars: Record<string, string>,
): string {
  let result = html;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return result;
}
