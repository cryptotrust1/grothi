// Email Designer Starter Templates
// Pre-designed EmailDesign objects for the template picker

import type { EmailDesign } from './email-designer-types';
import { generateId } from './email-designer-types';

export interface EmailTemplate {
  id: string;
  name: string;
  description: string;
  category: 'newsletter' | 'welcome' | 'promotional' | 'announcement' | 'minimal';
  design: () => EmailDesign; // factory to generate fresh IDs each time
}

// Helper to create blocks with unique IDs at call time
function ids() {
  return { s: generateId(), c: generateId(), b: generateId() };
}

function newsletterDesign(): EmailDesign {
  return {
    globalStyles: {
      bodyWidth: 600,
      backgroundColor: '#f4f4f7',
      contentBackgroundColor: '#ffffff',
      fontFamily: 'Arial, Helvetica, sans-serif',
      headingColor: '#1a1a2e',
      textColor: '#4a4a68',
      linkColor: '#6366f1',
      buttonBackgroundColor: '#6366f1',
      buttonTextColor: '#ffffff',
      buttonBorderRadius: 6,
      paddingTop: 40,
      paddingBottom: 40,
    },
    sections: [
      // Header
      {
        id: generateId(), columns: [{
          id: generateId(), width: 100, blocks: [
            { type: 'heading', id: generateId(), content: 'Your Brand', level: 2, align: 'center', color: '#6366f1', paddingTop: 30, paddingBottom: 5, paddingLeft: 20, paddingRight: 20 },
            { type: 'divider', id: generateId(), color: '#e5e7eb', thickness: 1, width: 40, style: 'solid', paddingTop: 5, paddingBottom: 15 },
          ],
        }], backgroundColor: '', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0,
      },
      // Hero
      {
        id: generateId(), columns: [{
          id: generateId(), width: 100, blocks: [
            { type: 'heading', id: generateId(), content: 'Weekly Newsletter', level: 1, align: 'center', color: '', paddingTop: 20, paddingBottom: 10, paddingLeft: 20, paddingRight: 20 },
            { type: 'text', id: generateId(), content: '<p>Here\'s what\'s new this week. We\'ve been working on exciting updates and can\'t wait to share them with you.</p>', align: 'center', fontSize: 16, color: '#6b7280', lineHeight: 1.6, paddingTop: 0, paddingBottom: 20, paddingLeft: 40, paddingRight: 40 },
          ],
        }], backgroundColor: '', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0,
      },
      // Image
      {
        id: generateId(), columns: [{
          id: generateId(), width: 100, blocks: [
            { type: 'image', id: generateId(), src: '', alt: 'Featured image', width: 100, align: 'center', link: '', borderRadius: 8, paddingTop: 0, paddingBottom: 20, paddingLeft: 20, paddingRight: 20 },
          ],
        }], backgroundColor: '', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0,
      },
      // Article 1
      {
        id: generateId(), columns: [{
          id: generateId(), width: 100, blocks: [
            { type: 'heading', id: generateId(), content: 'Feature Story', level: 2, align: 'left', color: '', paddingTop: 10, paddingBottom: 5, paddingLeft: 20, paddingRight: 20 },
            { type: 'text', id: generateId(), content: '<p>Share your main story or update here. Keep it engaging and informative for your readers. Add details that matter most to your audience.</p>', align: 'left', fontSize: 16, color: '', lineHeight: 1.6, paddingTop: 0, paddingBottom: 10, paddingLeft: 20, paddingRight: 20 },
            { type: 'button', id: generateId(), text: 'Read More', url: '{{targetUrl}}', align: 'left', backgroundColor: '', textColor: '', borderRadius: 6, fontSize: 16, fullWidth: false, paddingTop: 5, paddingBottom: 20, paddingLeft: 20, paddingRight: 20 },
          ],
        }], backgroundColor: '', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0,
      },
      // Divider
      {
        id: generateId(), columns: [{
          id: generateId(), width: 100, blocks: [
            { type: 'divider', id: generateId(), color: '#e5e7eb', thickness: 1, width: 90, style: 'solid', paddingTop: 10, paddingBottom: 10 },
          ],
        }], backgroundColor: '', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0,
      },
      // Two articles side by side
      {
        id: generateId(), columns: [
          {
            id: generateId(), width: 50, blocks: [
              { type: 'heading', id: generateId(), content: 'Quick Update', level: 3, align: 'left', color: '', paddingTop: 10, paddingBottom: 5, paddingLeft: 20, paddingRight: 10 },
              { type: 'text', id: generateId(), content: '<p>A shorter piece of content for secondary stories or updates.</p>', align: 'left', fontSize: 14, color: '', lineHeight: 1.5, paddingTop: 0, paddingBottom: 10, paddingLeft: 20, paddingRight: 10 },
            ],
          },
          {
            id: generateId(), width: 50, blocks: [
              { type: 'heading', id: generateId(), content: 'Did You Know?', level: 3, align: 'left', color: '', paddingTop: 10, paddingBottom: 5, paddingLeft: 10, paddingRight: 20 },
              { type: 'text', id: generateId(), content: '<p>Share an interesting fact, tip, or piece of trivia with your readers.</p>', align: 'left', fontSize: 14, color: '', lineHeight: 1.5, paddingTop: 0, paddingBottom: 10, paddingLeft: 10, paddingRight: 20 },
            ],
          },
        ], backgroundColor: '#f9fafb', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0,
      },
      // Footer
      {
        id: generateId(), columns: [{
          id: generateId(), width: 100, blocks: [
            { type: 'divider', id: generateId(), color: '#e5e7eb', thickness: 1, width: 100, style: 'solid', paddingTop: 20, paddingBottom: 10 },
            { type: 'social', id: generateId(), networks: [
              { platform: 'facebook', url: '#', label: 'Facebook' },
              { platform: 'twitter', url: '#', label: 'Twitter' },
              { platform: 'instagram', url: '#', label: 'Instagram' },
            ], align: 'center', iconSize: 28, iconStyle: 'color', paddingTop: 10, paddingBottom: 10 },
            { type: 'text', id: generateId(), content: '<p style="font-size:12px;color:#9ca3af;">You received this email because you subscribed to our newsletter.<br/>{{unsubscribeLink}}</p>', align: 'center', fontSize: 12, color: '#9ca3af', lineHeight: 1.4, paddingTop: 5, paddingBottom: 20, paddingLeft: 20, paddingRight: 20 },
          ],
        }], backgroundColor: '', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0,
      },
    ],
  };
}

function welcomeDesign(): EmailDesign {
  return {
    globalStyles: {
      bodyWidth: 600,
      backgroundColor: '#eef2ff',
      contentBackgroundColor: '#ffffff',
      fontFamily: 'Arial, Helvetica, sans-serif',
      headingColor: '#1e1b4b',
      textColor: '#374151',
      linkColor: '#4f46e5',
      buttonBackgroundColor: '#4f46e5',
      buttonTextColor: '#ffffff',
      buttonBorderRadius: 8,
      paddingTop: 40,
      paddingBottom: 40,
    },
    sections: [
      // Logo area
      {
        id: generateId(), columns: [{
          id: generateId(), width: 100, blocks: [
            { type: 'spacer', id: generateId(), height: 20 },
            { type: 'heading', id: generateId(), content: 'Welcome!', level: 1, align: 'center', color: '#4f46e5', paddingTop: 30, paddingBottom: 5, paddingLeft: 20, paddingRight: 20 },
          ],
        }], backgroundColor: '', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0,
      },
      // Welcome message
      {
        id: generateId(), columns: [{
          id: generateId(), width: 100, blocks: [
            { type: 'heading', id: generateId(), content: 'We\'re glad you\'re here', level: 2, align: 'center', color: '', paddingTop: 10, paddingBottom: 10, paddingLeft: 20, paddingRight: 20 },
            { type: 'text', id: generateId(), content: '<p>Thank you for joining us! We\'re excited to have you on board. Here\'s what you can expect from us:</p>', align: 'center', fontSize: 16, color: '', lineHeight: 1.6, paddingTop: 0, paddingBottom: 15, paddingLeft: 40, paddingRight: 40 },
          ],
        }], backgroundColor: '', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0,
      },
      // 3 benefits
      {
        id: generateId(), columns: [
          {
            id: generateId(), width: 33, blocks: [
              { type: 'heading', id: generateId(), content: 'Learn', level: 3, align: 'center', color: '#4f46e5', paddingTop: 15, paddingBottom: 5, paddingLeft: 10, paddingRight: 10 },
              { type: 'text', id: generateId(), content: '<p>Access tutorials and resources to get started.</p>', align: 'center', fontSize: 14, color: '', lineHeight: 1.5, paddingTop: 0, paddingBottom: 15, paddingLeft: 10, paddingRight: 10 },
            ],
          },
          {
            id: generateId(), width: 34, blocks: [
              { type: 'heading', id: generateId(), content: 'Connect', level: 3, align: 'center', color: '#4f46e5', paddingTop: 15, paddingBottom: 5, paddingLeft: 10, paddingRight: 10 },
              { type: 'text', id: generateId(), content: '<p>Join our community and connect with others.</p>', align: 'center', fontSize: 14, color: '', lineHeight: 1.5, paddingTop: 0, paddingBottom: 15, paddingLeft: 10, paddingRight: 10 },
            ],
          },
          {
            id: generateId(), width: 33, blocks: [
              { type: 'heading', id: generateId(), content: 'Grow', level: 3, align: 'center', color: '#4f46e5', paddingTop: 15, paddingBottom: 5, paddingLeft: 10, paddingRight: 10 },
              { type: 'text', id: generateId(), content: '<p>Take your skills to the next level with us.</p>', align: 'center', fontSize: 14, color: '', lineHeight: 1.5, paddingTop: 0, paddingBottom: 15, paddingLeft: 10, paddingRight: 10 },
            ],
          },
        ], backgroundColor: '#f5f3ff', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0,
      },
      // CTA
      {
        id: generateId(), columns: [{
          id: generateId(), width: 100, blocks: [
            { type: 'text', id: generateId(), content: '<p>Ready to get started? Click the button below to explore your account.</p>', align: 'center', fontSize: 16, color: '', lineHeight: 1.6, paddingTop: 20, paddingBottom: 10, paddingLeft: 40, paddingRight: 40 },
            { type: 'button', id: generateId(), text: 'Get Started', url: '{{targetUrl}}', align: 'center', backgroundColor: '', textColor: '', borderRadius: 8, fontSize: 18, fullWidth: false, paddingTop: 5, paddingBottom: 30, paddingLeft: 20, paddingRight: 20 },
          ],
        }], backgroundColor: '', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0,
      },
      // Footer
      {
        id: generateId(), columns: [{
          id: generateId(), width: 100, blocks: [
            { type: 'text', id: generateId(), content: '<p style="font-size:12px;color:#9ca3af;">Questions? Reply to this email or visit our help center.<br/>{{unsubscribeLink}}</p>', align: 'center', fontSize: 12, color: '#9ca3af', lineHeight: 1.4, paddingTop: 15, paddingBottom: 20, paddingLeft: 20, paddingRight: 20 },
          ],
        }], backgroundColor: '', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0,
      },
    ],
  };
}

function promotionalDesign(): EmailDesign {
  return {
    globalStyles: {
      bodyWidth: 600,
      backgroundColor: '#fef2f2',
      contentBackgroundColor: '#ffffff',
      fontFamily: 'Arial, Helvetica, sans-serif',
      headingColor: '#1a1a2e',
      textColor: '#374151',
      linkColor: '#dc2626',
      buttonBackgroundColor: '#dc2626',
      buttonTextColor: '#ffffff',
      buttonBorderRadius: 6,
      paddingTop: 40,
      paddingBottom: 40,
    },
    sections: [
      // Promo banner
      {
        id: generateId(), columns: [{
          id: generateId(), width: 100, blocks: [
            { type: 'heading', id: generateId(), content: 'SPECIAL OFFER', level: 3, align: 'center', color: '#dc2626', paddingTop: 15, paddingBottom: 0, paddingLeft: 20, paddingRight: 20 },
            { type: 'heading', id: generateId(), content: 'Up to 50% Off', level: 1, align: 'center', color: '#1a1a2e', paddingTop: 5, paddingBottom: 5, paddingLeft: 20, paddingRight: 20 },
            { type: 'text', id: generateId(), content: '<p>Limited time only. Don\'t miss out on our biggest sale of the season!</p>', align: 'center', fontSize: 16, color: '#6b7280', lineHeight: 1.6, paddingTop: 0, paddingBottom: 15, paddingLeft: 40, paddingRight: 40 },
          ],
        }], backgroundColor: '', paddingTop: 10, paddingRight: 0, paddingBottom: 0, paddingLeft: 0,
      },
      // Hero image
      {
        id: generateId(), columns: [{
          id: generateId(), width: 100, blocks: [
            { type: 'image', id: generateId(), src: '', alt: 'Sale banner', width: 100, align: 'center', link: '', borderRadius: 0, paddingTop: 0, paddingBottom: 0, paddingLeft: 0, paddingRight: 0 },
          ],
        }], backgroundColor: '', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0,
      },
      // Products (2 columns)
      {
        id: generateId(), columns: [
          {
            id: generateId(), width: 50, blocks: [
              { type: 'image', id: generateId(), src: '', alt: 'Product 1', width: 90, align: 'center', link: '', borderRadius: 8, paddingTop: 20, paddingBottom: 10, paddingLeft: 15, paddingRight: 5 },
              { type: 'heading', id: generateId(), content: 'Product Name', level: 3, align: 'center', color: '', paddingTop: 0, paddingBottom: 5, paddingLeft: 15, paddingRight: 5 },
              { type: 'text', id: generateId(), content: '<p><s>$99.99</s> <strong style="color:#dc2626;">$49.99</strong></p>', align: 'center', fontSize: 16, color: '', lineHeight: 1.4, paddingTop: 0, paddingBottom: 10, paddingLeft: 15, paddingRight: 5 },
              { type: 'button', id: generateId(), text: 'Shop Now', url: '{{targetUrl}}', align: 'center', backgroundColor: '', textColor: '', borderRadius: 6, fontSize: 14, fullWidth: false, paddingTop: 0, paddingBottom: 20, paddingLeft: 15, paddingRight: 5 },
            ],
          },
          {
            id: generateId(), width: 50, blocks: [
              { type: 'image', id: generateId(), src: '', alt: 'Product 2', width: 90, align: 'center', link: '', borderRadius: 8, paddingTop: 20, paddingBottom: 10, paddingLeft: 5, paddingRight: 15 },
              { type: 'heading', id: generateId(), content: 'Product Name', level: 3, align: 'center', color: '', paddingTop: 0, paddingBottom: 5, paddingLeft: 5, paddingRight: 15 },
              { type: 'text', id: generateId(), content: '<p><s>$79.99</s> <strong style="color:#dc2626;">$39.99</strong></p>', align: 'center', fontSize: 16, color: '', lineHeight: 1.4, paddingTop: 0, paddingBottom: 10, paddingLeft: 5, paddingRight: 15 },
              { type: 'button', id: generateId(), text: 'Shop Now', url: '{{targetUrl}}', align: 'center', backgroundColor: '', textColor: '', borderRadius: 6, fontSize: 14, fullWidth: false, paddingTop: 0, paddingBottom: 20, paddingLeft: 5, paddingRight: 15 },
            ],
          },
        ], backgroundColor: '', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0,
      },
      // CTA
      {
        id: generateId(), columns: [{
          id: generateId(), width: 100, blocks: [
            { type: 'divider', id: generateId(), color: '#fecaca', thickness: 2, width: 100, style: 'solid', paddingTop: 10, paddingBottom: 10 },
            { type: 'heading', id: generateId(), content: 'Hurry, sale ends soon!', level: 2, align: 'center', color: '#dc2626', paddingTop: 10, paddingBottom: 5, paddingLeft: 20, paddingRight: 20 },
            { type: 'button', id: generateId(), text: 'View All Deals', url: '{{targetUrl}}', align: 'center', backgroundColor: '#dc2626', textColor: '#ffffff', borderRadius: 6, fontSize: 18, fullWidth: false, paddingTop: 5, paddingBottom: 25, paddingLeft: 20, paddingRight: 20 },
          ],
        }], backgroundColor: '', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0,
      },
      // Footer
      {
        id: generateId(), columns: [{
          id: generateId(), width: 100, blocks: [
            { type: 'text', id: generateId(), content: '<p style="font-size:12px;color:#9ca3af;">This offer is valid for a limited time only. Terms apply.<br/>{{unsubscribeLink}}</p>', align: 'center', fontSize: 12, color: '#9ca3af', lineHeight: 1.4, paddingTop: 10, paddingBottom: 20, paddingLeft: 20, paddingRight: 20 },
          ],
        }], backgroundColor: '', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0,
      },
    ],
  };
}

function announcementDesign(): EmailDesign {
  return {
    globalStyles: {
      bodyWidth: 600,
      backgroundColor: '#f0fdf4',
      contentBackgroundColor: '#ffffff',
      fontFamily: 'Arial, Helvetica, sans-serif',
      headingColor: '#14532d',
      textColor: '#374151',
      linkColor: '#16a34a',
      buttonBackgroundColor: '#16a34a',
      buttonTextColor: '#ffffff',
      buttonBorderRadius: 8,
      paddingTop: 40,
      paddingBottom: 40,
    },
    sections: [
      // Badge + heading
      {
        id: generateId(), columns: [{
          id: generateId(), width: 100, blocks: [
            { type: 'spacer', id: generateId(), height: 15 },
            { type: 'heading', id: generateId(), content: 'Exciting News!', level: 1, align: 'center', color: '#14532d', paddingTop: 20, paddingBottom: 10, paddingLeft: 20, paddingRight: 20 },
            { type: 'divider', id: generateId(), color: '#bbf7d0', thickness: 3, width: 30, style: 'solid', paddingTop: 0, paddingBottom: 15 },
          ],
        }], backgroundColor: '', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0,
      },
      // Announcement body
      {
        id: generateId(), columns: [{
          id: generateId(), width: 100, blocks: [
            { type: 'text', id: generateId(), content: '<p>We\'re thrilled to announce something big! This is a major milestone for our company and we wanted you to be the first to know.</p>', align: 'left', fontSize: 16, color: '', lineHeight: 1.7, paddingTop: 10, paddingBottom: 10, paddingLeft: 40, paddingRight: 40 },
            { type: 'text', id: generateId(), content: '<p>Here\'s what this means for you:</p><ul><li>Benefit one — describe it here</li><li>Benefit two — describe it here</li><li>Benefit three — describe it here</li></ul>', align: 'left', fontSize: 16, color: '', lineHeight: 1.7, paddingTop: 0, paddingBottom: 15, paddingLeft: 40, paddingRight: 40 },
            { type: 'button', id: generateId(), text: 'Learn More', url: '{{targetUrl}}', align: 'center', backgroundColor: '', textColor: '', borderRadius: 8, fontSize: 18, fullWidth: false, paddingTop: 5, paddingBottom: 30, paddingLeft: 20, paddingRight: 20 },
          ],
        }], backgroundColor: '', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0,
      },
      // Footer
      {
        id: generateId(), columns: [{
          id: generateId(), width: 100, blocks: [
            { type: 'social', id: generateId(), networks: [
              { platform: 'facebook', url: '#', label: 'Facebook' },
              { platform: 'twitter', url: '#', label: 'Twitter' },
              { platform: 'linkedin', url: '#', label: 'LinkedIn' },
            ], align: 'center', iconSize: 28, iconStyle: 'color', paddingTop: 10, paddingBottom: 10 },
            { type: 'text', id: generateId(), content: '<p style="font-size:12px;color:#9ca3af;">{{unsubscribeLink}}</p>', align: 'center', fontSize: 12, color: '#9ca3af', lineHeight: 1.4, paddingTop: 5, paddingBottom: 20, paddingLeft: 20, paddingRight: 20 },
          ],
        }], backgroundColor: '', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0,
      },
    ],
  };
}

function minimalDesign(): EmailDesign {
  return {
    globalStyles: {
      bodyWidth: 600,
      backgroundColor: '#f9fafb',
      contentBackgroundColor: '#ffffff',
      fontFamily: 'Georgia, Times, serif',
      headingColor: '#111827',
      textColor: '#4b5563',
      linkColor: '#111827',
      buttonBackgroundColor: '#111827',
      buttonTextColor: '#ffffff',
      buttonBorderRadius: 0,
      paddingTop: 40,
      paddingBottom: 40,
    },
    sections: [
      // Header
      {
        id: generateId(), columns: [{
          id: generateId(), width: 100, blocks: [
            { type: 'heading', id: generateId(), content: 'Your Brand', level: 2, align: 'center', color: '#111827', paddingTop: 30, paddingBottom: 20, paddingLeft: 20, paddingRight: 20 },
          ],
        }], backgroundColor: '', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0,
      },
      // Content
      {
        id: generateId(), columns: [{
          id: generateId(), width: 100, blocks: [
            { type: 'heading', id: generateId(), content: 'A simple message', level: 1, align: 'left', color: '', paddingTop: 10, paddingBottom: 10, paddingLeft: 40, paddingRight: 40 },
            { type: 'text', id: generateId(), content: '<p>Sometimes less is more. Write your message here with a clean, distraction-free layout. Focus on what matters most to your readers.</p>', align: 'left', fontSize: 17, color: '', lineHeight: 1.8, paddingTop: 0, paddingBottom: 10, paddingLeft: 40, paddingRight: 40 },
            { type: 'text', id: generateId(), content: '<p>Add a second paragraph if needed. Keep it concise and clear.</p>', align: 'left', fontSize: 17, color: '', lineHeight: 1.8, paddingTop: 0, paddingBottom: 20, paddingLeft: 40, paddingRight: 40 },
            { type: 'button', id: generateId(), text: 'Read More', url: '{{targetUrl}}', align: 'left', backgroundColor: '', textColor: '', borderRadius: 0, fontSize: 16, fullWidth: false, paddingTop: 5, paddingBottom: 30, paddingLeft: 40, paddingRight: 40 },
          ],
        }], backgroundColor: '', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0,
      },
      // Footer
      {
        id: generateId(), columns: [{
          id: generateId(), width: 100, blocks: [
            { type: 'divider', id: generateId(), color: '#d1d5db', thickness: 1, width: 100, style: 'solid', paddingTop: 10, paddingBottom: 10 },
            { type: 'text', id: generateId(), content: '<p style="font-size:12px;color:#9ca3af;">{{unsubscribeLink}}</p>', align: 'center', fontSize: 12, color: '#9ca3af', lineHeight: 1.4, paddingTop: 5, paddingBottom: 20, paddingLeft: 20, paddingRight: 20 },
          ],
        }], backgroundColor: '', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0,
      },
    ],
  };
}

export const EMAIL_STARTER_TEMPLATES: EmailTemplate[] = [
  {
    id: 'newsletter',
    name: 'Newsletter',
    description: 'Weekly newsletter with articles, images, and social links',
    category: 'newsletter',
    design: newsletterDesign,
  },
  {
    id: 'welcome',
    name: 'Welcome Email',
    description: 'Onboarding email for new subscribers with 3-column benefits',
    category: 'welcome',
    design: welcomeDesign,
  },
  {
    id: 'promotional',
    name: 'Sale / Promo',
    description: 'Promotional email with product grid and urgency CTA',
    category: 'promotional',
    design: promotionalDesign,
  },
  {
    id: 'announcement',
    name: 'Announcement',
    description: 'Clean announcement with bullet points and social footer',
    category: 'announcement',
    design: announcementDesign,
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Simple, elegant text-focused email with serif font',
    category: 'minimal',
    design: minimalDesign,
  },
];
