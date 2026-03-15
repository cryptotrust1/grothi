// Email Designer Starter Templates
// Pre-designed EmailDesign objects for the template picker — Brevo-style gallery

import type { EmailDesign } from './email-designer-types';
import { generateId } from './email-designer-types';

export type TemplateCategory =
  | 'all'
  | 'newsletter'
  | 'welcome'
  | 'promotional'
  | 'ecommerce'
  | 'event'
  | 'seasonal'
  | 'notification'
  | 'minimal';

export interface EmailTemplate {
  id: string;
  name: string;
  description: string;
  category: Exclude<TemplateCategory, 'all'>;
  color: string; // accent color for the template card badge
  design: () => EmailDesign;
}

export const TEMPLATE_CATEGORIES: { id: TemplateCategory; label: string }[] = [
  { id: 'all', label: 'All Templates' },
  { id: 'newsletter', label: 'Newsletter' },
  { id: 'welcome', label: 'Welcome' },
  { id: 'promotional', label: 'Sales & Promo' },
  { id: 'ecommerce', label: 'E-commerce' },
  { id: 'event', label: 'Events' },
  { id: 'seasonal', label: 'Seasonal' },
  { id: 'notification', label: 'Notification' },
  { id: 'minimal', label: 'Minimal' },
];

// ============================================================
// TEMPLATE 1: Modern Newsletter
// ============================================================
function newsletterDesign(): EmailDesign {
  return {
    globalStyles: {
      bodyWidth: 600, backgroundColor: '#f0f0f5', contentBackgroundColor: '#ffffff',
      fontFamily: 'Arial, Helvetica, sans-serif', headingColor: '#1a1a2e', textColor: '#4a4a68',
      linkColor: '#6366f1', buttonBackgroundColor: '#6366f1', buttonTextColor: '#ffffff',
      buttonBorderRadius: 6, paddingTop: 40, paddingBottom: 40,
    },
    sections: [
      { id: generateId(), columns: [{ id: generateId(), width: 100, blocks: [
        { type: 'heading', id: generateId(), content: 'YOUR BRAND', level: 2, align: 'center', color: '#6366f1', paddingTop: 30, paddingBottom: 5, paddingLeft: 20, paddingRight: 20 },
        { type: 'divider', id: generateId(), color: '#e5e7eb', thickness: 1, width: 40, style: 'solid', paddingTop: 5, paddingBottom: 15 },
      ] }], backgroundColor: '', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 },
      { id: generateId(), columns: [{ id: generateId(), width: 100, blocks: [
        { type: 'heading', id: generateId(), content: 'Weekly Newsletter', level: 1, align: 'center', color: '', paddingTop: 20, paddingBottom: 10, paddingLeft: 20, paddingRight: 20 },
        { type: 'text', id: generateId(), content: '<p>Here\'s what\'s new this week. We\'ve been working on exciting updates and can\'t wait to share them with you.</p>', align: 'center', fontSize: 16, color: '#6b7280', lineHeight: 1.6, paddingTop: 0, paddingBottom: 20, paddingLeft: 40, paddingRight: 40 },
      ] }], backgroundColor: '', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 },
      { id: generateId(), columns: [{ id: generateId(), width: 100, blocks: [
        { type: 'image', id: generateId(), src: '', alt: 'Featured image', width: 100, align: 'center', link: '', borderRadius: 8, paddingTop: 0, paddingBottom: 20, paddingLeft: 20, paddingRight: 20 },
      ] }], backgroundColor: '', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 },
      { id: generateId(), columns: [{ id: generateId(), width: 100, blocks: [
        { type: 'heading', id: generateId(), content: 'Feature Story', level: 2, align: 'left', color: '', paddingTop: 10, paddingBottom: 5, paddingLeft: 20, paddingRight: 20 },
        { type: 'text', id: generateId(), content: '<p>Share your main story or update here. Keep it engaging and informative for your readers.</p>', align: 'left', fontSize: 16, color: '', lineHeight: 1.6, paddingTop: 0, paddingBottom: 10, paddingLeft: 20, paddingRight: 20 },
        { type: 'button', id: generateId(), text: 'Read More', url: '{{targetUrl}}', align: 'left', backgroundColor: '', textColor: '', borderRadius: 6, fontSize: 16, fullWidth: false, paddingTop: 5, paddingBottom: 20, paddingLeft: 20, paddingRight: 20 },
      ] }], backgroundColor: '', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 },
      { id: generateId(), columns: [{ id: generateId(), width: 100, blocks: [
        { type: 'divider', id: generateId(), color: '#e5e7eb', thickness: 1, width: 90, style: 'solid', paddingTop: 10, paddingBottom: 10 },
      ] }], backgroundColor: '', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 },
      { id: generateId(), columns: [
        { id: generateId(), width: 50, blocks: [
          { type: 'heading', id: generateId(), content: 'Quick Update', level: 3, align: 'left', color: '', paddingTop: 10, paddingBottom: 5, paddingLeft: 20, paddingRight: 10 },
          { type: 'text', id: generateId(), content: '<p>A shorter piece of content for secondary stories.</p>', align: 'left', fontSize: 14, color: '', lineHeight: 1.5, paddingTop: 0, paddingBottom: 10, paddingLeft: 20, paddingRight: 10 },
        ] },
        { id: generateId(), width: 50, blocks: [
          { type: 'heading', id: generateId(), content: 'Did You Know?', level: 3, align: 'left', color: '', paddingTop: 10, paddingBottom: 5, paddingLeft: 10, paddingRight: 20 },
          { type: 'text', id: generateId(), content: '<p>Share an interesting fact or tip with your readers.</p>', align: 'left', fontSize: 14, color: '', lineHeight: 1.5, paddingTop: 0, paddingBottom: 10, paddingLeft: 10, paddingRight: 20 },
        ] },
      ], backgroundColor: '#f9fafb', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 },
      { id: generateId(), columns: [{ id: generateId(), width: 100, blocks: [
        { type: 'divider', id: generateId(), color: '#e5e7eb', thickness: 1, width: 100, style: 'solid', paddingTop: 20, paddingBottom: 10 },
        { type: 'social', id: generateId(), networks: [
          { platform: 'facebook', url: '#', label: 'Facebook' },
          { platform: 'twitter', url: '#', label: 'Twitter' },
          { platform: 'instagram', url: '#', label: 'Instagram' },
        ], align: 'center', iconSize: 28, iconStyle: 'color', paddingTop: 10, paddingBottom: 10 },
        { type: 'text', id: generateId(), content: '<p style="font-size:12px;color:#9ca3af;">You received this email because you subscribed.<br/>{{unsubscribeLink}}</p>', align: 'center', fontSize: 12, color: '#9ca3af', lineHeight: 1.4, paddingTop: 5, paddingBottom: 20, paddingLeft: 20, paddingRight: 20 },
      ] }], backgroundColor: '', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 },
    ],
  };
}

// ============================================================
// TEMPLATE 2: Welcome Email — Purple gradient feel
// ============================================================
function welcomeDesign(): EmailDesign {
  return {
    globalStyles: {
      bodyWidth: 600, backgroundColor: '#eef2ff', contentBackgroundColor: '#ffffff',
      fontFamily: 'Arial, Helvetica, sans-serif', headingColor: '#1e1b4b', textColor: '#374151',
      linkColor: '#4f46e5', buttonBackgroundColor: '#4f46e5', buttonTextColor: '#ffffff',
      buttonBorderRadius: 8, paddingTop: 40, paddingBottom: 40,
    },
    sections: [
      { id: generateId(), columns: [{ id: generateId(), width: 100, blocks: [
        { type: 'spacer', id: generateId(), height: 10 },
        { type: 'heading', id: generateId(), content: 'Welcome!', level: 1, align: 'center', color: '#4f46e5', paddingTop: 30, paddingBottom: 5, paddingLeft: 20, paddingRight: 20 },
        { type: 'heading', id: generateId(), content: 'We\'re glad you\'re here', level: 2, align: 'center', color: '#374151', paddingTop: 5, paddingBottom: 10, paddingLeft: 20, paddingRight: 20 },
        { type: 'text', id: generateId(), content: '<p>Thank you for joining us! Here\'s what you can expect:</p>', align: 'center', fontSize: 16, color: '', lineHeight: 1.6, paddingTop: 0, paddingBottom: 15, paddingLeft: 40, paddingRight: 40 },
      ] }], backgroundColor: '', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 },
      { id: generateId(), columns: [
        { id: generateId(), width: 33, blocks: [
          { type: 'heading', id: generateId(), content: 'Learn', level: 3, align: 'center', color: '#4f46e5', paddingTop: 15, paddingBottom: 5, paddingLeft: 10, paddingRight: 10 },
          { type: 'text', id: generateId(), content: '<p>Access tutorials and resources to get started.</p>', align: 'center', fontSize: 14, color: '', lineHeight: 1.5, paddingTop: 0, paddingBottom: 15, paddingLeft: 10, paddingRight: 10 },
        ] },
        { id: generateId(), width: 34, blocks: [
          { type: 'heading', id: generateId(), content: 'Connect', level: 3, align: 'center', color: '#4f46e5', paddingTop: 15, paddingBottom: 5, paddingLeft: 10, paddingRight: 10 },
          { type: 'text', id: generateId(), content: '<p>Join our community and connect with others.</p>', align: 'center', fontSize: 14, color: '', lineHeight: 1.5, paddingTop: 0, paddingBottom: 15, paddingLeft: 10, paddingRight: 10 },
        ] },
        { id: generateId(), width: 33, blocks: [
          { type: 'heading', id: generateId(), content: 'Grow', level: 3, align: 'center', color: '#4f46e5', paddingTop: 15, paddingBottom: 5, paddingLeft: 10, paddingRight: 10 },
          { type: 'text', id: generateId(), content: '<p>Take your skills to the next level with us.</p>', align: 'center', fontSize: 14, color: '', lineHeight: 1.5, paddingTop: 0, paddingBottom: 15, paddingLeft: 10, paddingRight: 10 },
        ] },
      ], backgroundColor: '#f5f3ff', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 },
      { id: generateId(), columns: [{ id: generateId(), width: 100, blocks: [
        { type: 'button', id: generateId(), text: 'Get Started', url: '{{targetUrl}}', align: 'center', backgroundColor: '', textColor: '', borderRadius: 8, fontSize: 18, fullWidth: false, paddingTop: 25, paddingBottom: 30, paddingLeft: 20, paddingRight: 20 },
      ] }], backgroundColor: '', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 },
      { id: generateId(), columns: [{ id: generateId(), width: 100, blocks: [
        { type: 'text', id: generateId(), content: '<p style="font-size:12px;color:#9ca3af;">Questions? Reply to this email or visit our help center.<br/>{{unsubscribeLink}}</p>', align: 'center', fontSize: 12, color: '#9ca3af', lineHeight: 1.4, paddingTop: 15, paddingBottom: 20, paddingLeft: 20, paddingRight: 20 },
      ] }], backgroundColor: '', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 },
    ],
  };
}

// ============================================================
// TEMPLATE 3: Flash Sale — Bold red urgency
// ============================================================
function flashSaleDesign(): EmailDesign {
  return {
    globalStyles: {
      bodyWidth: 600, backgroundColor: '#fef2f2', contentBackgroundColor: '#ffffff',
      fontFamily: 'Arial, Helvetica, sans-serif', headingColor: '#1a1a2e', textColor: '#374151',
      linkColor: '#dc2626', buttonBackgroundColor: '#dc2626', buttonTextColor: '#ffffff',
      buttonBorderRadius: 6, paddingTop: 40, paddingBottom: 40,
    },
    sections: [
      { id: generateId(), columns: [{ id: generateId(), width: 100, blocks: [
        { type: 'heading', id: generateId(), content: 'FLASH SALE', level: 3, align: 'center', color: '#dc2626', paddingTop: 15, paddingBottom: 0, paddingLeft: 20, paddingRight: 20 },
        { type: 'heading', id: generateId(), content: 'Up to 50% Off', level: 1, align: 'center', color: '#1a1a2e', paddingTop: 5, paddingBottom: 5, paddingLeft: 20, paddingRight: 20 },
        { type: 'text', id: generateId(), content: '<p>Limited time only. Don\'t miss our biggest sale of the season!</p>', align: 'center', fontSize: 16, color: '#6b7280', lineHeight: 1.6, paddingTop: 0, paddingBottom: 15, paddingLeft: 40, paddingRight: 40 },
      ] }], backgroundColor: '', paddingTop: 10, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 },
      { id: generateId(), columns: [{ id: generateId(), width: 100, blocks: [
        { type: 'image', id: generateId(), src: '', alt: 'Sale banner', width: 100, align: 'center', link: '', borderRadius: 0, paddingTop: 0, paddingBottom: 0, paddingLeft: 0, paddingRight: 0 },
      ] }], backgroundColor: '', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 },
      { id: generateId(), columns: [
        { id: generateId(), width: 50, blocks: [
          { type: 'image', id: generateId(), src: '', alt: 'Product 1', width: 90, align: 'center', link: '', borderRadius: 8, paddingTop: 20, paddingBottom: 10, paddingLeft: 15, paddingRight: 5 },
          { type: 'heading', id: generateId(), content: 'Product Name', level: 3, align: 'center', color: '', paddingTop: 0, paddingBottom: 5, paddingLeft: 15, paddingRight: 5 },
          { type: 'text', id: generateId(), content: '<p><s>$99.99</s> <strong style="color:#dc2626;">$49.99</strong></p>', align: 'center', fontSize: 16, color: '', lineHeight: 1.4, paddingTop: 0, paddingBottom: 10, paddingLeft: 15, paddingRight: 5 },
          { type: 'button', id: generateId(), text: 'Shop Now', url: '{{targetUrl}}', align: 'center', backgroundColor: '', textColor: '', borderRadius: 6, fontSize: 14, fullWidth: false, paddingTop: 0, paddingBottom: 20, paddingLeft: 15, paddingRight: 5 },
        ] },
        { id: generateId(), width: 50, blocks: [
          { type: 'image', id: generateId(), src: '', alt: 'Product 2', width: 90, align: 'center', link: '', borderRadius: 8, paddingTop: 20, paddingBottom: 10, paddingLeft: 5, paddingRight: 15 },
          { type: 'heading', id: generateId(), content: 'Product Name', level: 3, align: 'center', color: '', paddingTop: 0, paddingBottom: 5, paddingLeft: 5, paddingRight: 15 },
          { type: 'text', id: generateId(), content: '<p><s>$79.99</s> <strong style="color:#dc2626;">$39.99</strong></p>', align: 'center', fontSize: 16, color: '', lineHeight: 1.4, paddingTop: 0, paddingBottom: 10, paddingLeft: 5, paddingRight: 15 },
          { type: 'button', id: generateId(), text: 'Shop Now', url: '{{targetUrl}}', align: 'center', backgroundColor: '', textColor: '', borderRadius: 6, fontSize: 14, fullWidth: false, paddingTop: 0, paddingBottom: 20, paddingLeft: 5, paddingRight: 15 },
        ] },
      ], backgroundColor: '', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 },
      { id: generateId(), columns: [{ id: generateId(), width: 100, blocks: [
        { type: 'divider', id: generateId(), color: '#fecaca', thickness: 2, width: 100, style: 'solid', paddingTop: 10, paddingBottom: 10 },
        { type: 'heading', id: generateId(), content: 'Hurry, sale ends soon!', level: 2, align: 'center', color: '#dc2626', paddingTop: 10, paddingBottom: 5, paddingLeft: 20, paddingRight: 20 },
        { type: 'button', id: generateId(), text: 'View All Deals', url: '{{targetUrl}}', align: 'center', backgroundColor: '#dc2626', textColor: '#ffffff', borderRadius: 6, fontSize: 18, fullWidth: false, paddingTop: 5, paddingBottom: 25, paddingLeft: 20, paddingRight: 20 },
      ] }], backgroundColor: '', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 },
      { id: generateId(), columns: [{ id: generateId(), width: 100, blocks: [
        { type: 'text', id: generateId(), content: '<p style="font-size:12px;color:#9ca3af;">This offer is valid for a limited time only. Terms apply.<br/>{{unsubscribeLink}}</p>', align: 'center', fontSize: 12, color: '#9ca3af', lineHeight: 1.4, paddingTop: 10, paddingBottom: 20, paddingLeft: 20, paddingRight: 20 },
      ] }], backgroundColor: '', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 },
    ],
  };
}

// ============================================================
// TEMPLATE 4: Product Launch — Dark & bold
// ============================================================
function productLaunchDesign(): EmailDesign {
  return {
    globalStyles: {
      bodyWidth: 600, backgroundColor: '#18181b', contentBackgroundColor: '#27272a',
      fontFamily: 'Helvetica, Arial, sans-serif', headingColor: '#ffffff', textColor: '#d4d4d8',
      linkColor: '#a78bfa', buttonBackgroundColor: '#8b5cf6', buttonTextColor: '#ffffff',
      buttonBorderRadius: 8, paddingTop: 40, paddingBottom: 40,
    },
    sections: [
      { id: generateId(), columns: [{ id: generateId(), width: 100, blocks: [
        { type: 'heading', id: generateId(), content: 'BRAND', level: 2, align: 'center', color: '#a78bfa', paddingTop: 25, paddingBottom: 15, paddingLeft: 20, paddingRight: 20 },
      ] }], backgroundColor: '', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 },
      { id: generateId(), columns: [{ id: generateId(), width: 100, blocks: [
        { type: 'heading', id: generateId(), content: 'NEW', level: 3, align: 'center', color: '#a78bfa', paddingTop: 20, paddingBottom: 0, paddingLeft: 20, paddingRight: 20 },
        { type: 'heading', id: generateId(), content: 'Introducing the Future', level: 1, align: 'center', color: '#ffffff', paddingTop: 5, paddingBottom: 10, paddingLeft: 20, paddingRight: 20 },
        { type: 'text', id: generateId(), content: '<p>We\'ve reimagined everything from the ground up. Faster, smarter, and more powerful than ever before.</p>', align: 'center', fontSize: 17, color: '#a1a1aa', lineHeight: 1.7, paddingTop: 0, paddingBottom: 15, paddingLeft: 40, paddingRight: 40 },
      ] }], backgroundColor: '', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 },
      { id: generateId(), columns: [{ id: generateId(), width: 100, blocks: [
        { type: 'image', id: generateId(), src: '', alt: 'Product hero', width: 90, align: 'center', link: '', borderRadius: 12, paddingTop: 10, paddingBottom: 25, paddingLeft: 20, paddingRight: 20 },
      ] }], backgroundColor: '', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 },
      { id: generateId(), columns: [
        { id: generateId(), width: 33, blocks: [
          { type: 'heading', id: generateId(), content: '10x Faster', level: 3, align: 'center', color: '#a78bfa', paddingTop: 15, paddingBottom: 5, paddingLeft: 10, paddingRight: 10 },
          { type: 'text', id: generateId(), content: '<p>Blazing performance that sets a new standard.</p>', align: 'center', fontSize: 13, color: '#a1a1aa', lineHeight: 1.5, paddingTop: 0, paddingBottom: 15, paddingLeft: 10, paddingRight: 10 },
        ] },
        { id: generateId(), width: 34, blocks: [
          { type: 'heading', id: generateId(), content: 'AI-Powered', level: 3, align: 'center', color: '#a78bfa', paddingTop: 15, paddingBottom: 5, paddingLeft: 10, paddingRight: 10 },
          { type: 'text', id: generateId(), content: '<p>Smart features that learn and adapt to you.</p>', align: 'center', fontSize: 13, color: '#a1a1aa', lineHeight: 1.5, paddingTop: 0, paddingBottom: 15, paddingLeft: 10, paddingRight: 10 },
        ] },
        { id: generateId(), width: 33, blocks: [
          { type: 'heading', id: generateId(), content: 'Seamless', level: 3, align: 'center', color: '#a78bfa', paddingTop: 15, paddingBottom: 5, paddingLeft: 10, paddingRight: 10 },
          { type: 'text', id: generateId(), content: '<p>Works perfectly across all your devices.</p>', align: 'center', fontSize: 13, color: '#a1a1aa', lineHeight: 1.5, paddingTop: 0, paddingBottom: 15, paddingLeft: 10, paddingRight: 10 },
        ] },
      ], backgroundColor: '#1f1f23', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 },
      { id: generateId(), columns: [{ id: generateId(), width: 100, blocks: [
        { type: 'button', id: generateId(), text: 'Pre-Order Now', url: '{{targetUrl}}', align: 'center', backgroundColor: '#8b5cf6', textColor: '#ffffff', borderRadius: 8, fontSize: 18, fullWidth: false, paddingTop: 25, paddingBottom: 10, paddingLeft: 20, paddingRight: 20 },
        { type: 'text', id: generateId(), content: '<p>Ships in 2 weeks. Early bird pricing available.</p>', align: 'center', fontSize: 14, color: '#71717a', lineHeight: 1.5, paddingTop: 5, paddingBottom: 25, paddingLeft: 20, paddingRight: 20 },
      ] }], backgroundColor: '', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 },
      { id: generateId(), columns: [{ id: generateId(), width: 100, blocks: [
        { type: 'social', id: generateId(), networks: [
          { platform: 'twitter', url: '#', label: 'Twitter' },
          { platform: 'instagram', url: '#', label: 'Instagram' },
          { platform: 'youtube', url: '#', label: 'YouTube' },
        ], align: 'center', iconSize: 24, iconStyle: 'light', paddingTop: 10, paddingBottom: 10 },
        { type: 'text', id: generateId(), content: '<p style="font-size:11px;">{{unsubscribeLink}}</p>', align: 'center', fontSize: 11, color: '#52525b', lineHeight: 1.4, paddingTop: 5, paddingBottom: 15, paddingLeft: 20, paddingRight: 20 },
      ] }], backgroundColor: '', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 },
    ],
  };
}

// ============================================================
// TEMPLATE 5: Event Invitation — Elegant teal
// ============================================================
function eventInvitationDesign(): EmailDesign {
  return {
    globalStyles: {
      bodyWidth: 600, backgroundColor: '#f0fdfa', contentBackgroundColor: '#ffffff',
      fontFamily: "'Trebuchet MS', sans-serif", headingColor: '#134e4a', textColor: '#374151',
      linkColor: '#0d9488', buttonBackgroundColor: '#0d9488', buttonTextColor: '#ffffff',
      buttonBorderRadius: 24, paddingTop: 40, paddingBottom: 40,
    },
    sections: [
      { id: generateId(), columns: [{ id: generateId(), width: 100, blocks: [
        { type: 'text', id: generateId(), content: '<p style="letter-spacing:3px;font-size:11px;text-transform:uppercase;color:#0d9488;">YOU\'RE INVITED</p>', align: 'center', fontSize: 11, color: '#0d9488', lineHeight: 1.4, paddingTop: 30, paddingBottom: 5, paddingLeft: 20, paddingRight: 20 },
        { type: 'heading', id: generateId(), content: 'Annual Summit 2026', level: 1, align: 'center', color: '#134e4a', paddingTop: 5, paddingBottom: 5, paddingLeft: 20, paddingRight: 20 },
        { type: 'divider', id: generateId(), color: '#99f6e4', thickness: 3, width: 25, style: 'solid', paddingTop: 5, paddingBottom: 15 },
      ] }], backgroundColor: '', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 },
      { id: generateId(), columns: [{ id: generateId(), width: 100, blocks: [
        { type: 'image', id: generateId(), src: '', alt: 'Event venue', width: 90, align: 'center', link: '', borderRadius: 12, paddingTop: 5, paddingBottom: 20, paddingLeft: 20, paddingRight: 20 },
      ] }], backgroundColor: '', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 },
      { id: generateId(), columns: [
        { id: generateId(), width: 33, blocks: [
          { type: 'heading', id: generateId(), content: 'When', level: 3, align: 'center', color: '#0d9488', paddingTop: 15, paddingBottom: 5, paddingLeft: 15, paddingRight: 5 },
          { type: 'text', id: generateId(), content: '<p><strong>March 28, 2026</strong><br/>9:00 AM - 5:00 PM</p>', align: 'center', fontSize: 14, color: '', lineHeight: 1.5, paddingTop: 0, paddingBottom: 15, paddingLeft: 15, paddingRight: 5 },
        ] },
        { id: generateId(), width: 34, blocks: [
          { type: 'heading', id: generateId(), content: 'Where', level: 3, align: 'center', color: '#0d9488', paddingTop: 15, paddingBottom: 5, paddingLeft: 5, paddingRight: 5 },
          { type: 'text', id: generateId(), content: '<p><strong>Grand Conference Hall</strong><br/>123 Main Street</p>', align: 'center', fontSize: 14, color: '', lineHeight: 1.5, paddingTop: 0, paddingBottom: 15, paddingLeft: 5, paddingRight: 5 },
        ] },
        { id: generateId(), width: 33, blocks: [
          { type: 'heading', id: generateId(), content: 'Price', level: 3, align: 'center', color: '#0d9488', paddingTop: 15, paddingBottom: 5, paddingLeft: 5, paddingRight: 15 },
          { type: 'text', id: generateId(), content: '<p><strong>Free</strong><br/>Limited seats</p>', align: 'center', fontSize: 14, color: '', lineHeight: 1.5, paddingTop: 0, paddingBottom: 15, paddingLeft: 5, paddingRight: 15 },
        ] },
      ], backgroundColor: '#f0fdfa', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 },
      { id: generateId(), columns: [{ id: generateId(), width: 100, blocks: [
        { type: 'text', id: generateId(), content: '<p>Join industry leaders, innovators, and visionaries for a full day of inspiring talks, workshops, and networking opportunities.</p>', align: 'center', fontSize: 16, color: '', lineHeight: 1.7, paddingTop: 15, paddingBottom: 10, paddingLeft: 40, paddingRight: 40 },
        { type: 'button', id: generateId(), text: 'RSVP Now', url: '{{targetUrl}}', align: 'center', backgroundColor: '', textColor: '', borderRadius: 24, fontSize: 16, fullWidth: false, paddingTop: 10, paddingBottom: 30, paddingLeft: 20, paddingRight: 20 },
      ] }], backgroundColor: '', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 },
      { id: generateId(), columns: [{ id: generateId(), width: 100, blocks: [
        { type: 'text', id: generateId(), content: '<p style="font-size:12px;color:#9ca3af;">Can\'t make it? Forward this to a friend who might be interested.<br/>{{unsubscribeLink}}</p>', align: 'center', fontSize: 12, color: '#9ca3af', lineHeight: 1.4, paddingTop: 10, paddingBottom: 20, paddingLeft: 20, paddingRight: 20 },
      ] }], backgroundColor: '', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 },
    ],
  };
}

// ============================================================
// TEMPLATE 6: Black Friday — Dark dramatic
// ============================================================
function blackFridayDesign(): EmailDesign {
  return {
    globalStyles: {
      bodyWidth: 600, backgroundColor: '#000000', contentBackgroundColor: '#111111',
      fontFamily: 'Arial, Helvetica, sans-serif', headingColor: '#ffffff', textColor: '#d1d5db',
      linkColor: '#fbbf24', buttonBackgroundColor: '#fbbf24', buttonTextColor: '#000000',
      buttonBorderRadius: 4, paddingTop: 30, paddingBottom: 30,
    },
    sections: [
      { id: generateId(), columns: [{ id: generateId(), width: 100, blocks: [
        { type: 'heading', id: generateId(), content: 'BLACK FRIDAY', level: 1, align: 'center', color: '#fbbf24', paddingTop: 40, paddingBottom: 5, paddingLeft: 20, paddingRight: 20 },
        { type: 'heading', id: generateId(), content: 'The Biggest Deals of the Year', level: 2, align: 'center', color: '#ffffff', paddingTop: 0, paddingBottom: 10, paddingLeft: 20, paddingRight: 20 },
        { type: 'text', id: generateId(), content: '<p>Save up to <strong style="color:#fbbf24;font-size:24px;">70%</strong> on everything. Today only.</p>', align: 'center', fontSize: 16, color: '#9ca3af', lineHeight: 1.6, paddingTop: 0, paddingBottom: 15, paddingLeft: 30, paddingRight: 30 },
        { type: 'button', id: generateId(), text: 'SHOP THE SALE', url: '{{targetUrl}}', align: 'center', backgroundColor: '#fbbf24', textColor: '#000000', borderRadius: 4, fontSize: 16, fullWidth: false, paddingTop: 10, paddingBottom: 25, paddingLeft: 20, paddingRight: 20 },
      ] }], backgroundColor: '', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 },
      { id: generateId(), columns: [{ id: generateId(), width: 100, blocks: [
        { type: 'divider', id: generateId(), color: '#333333', thickness: 1, width: 100, style: 'solid', paddingTop: 5, paddingBottom: 5 },
      ] }], backgroundColor: '', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 },
      { id: generateId(), columns: [
        { id: generateId(), width: 50, blocks: [
          { type: 'image', id: generateId(), src: '', alt: 'Deal 1', width: 90, align: 'center', link: '', borderRadius: 6, paddingTop: 15, paddingBottom: 8, paddingLeft: 15, paddingRight: 5 },
          { type: 'heading', id: generateId(), content: 'Best Seller', level: 3, align: 'center', color: '#fbbf24', paddingTop: 5, paddingBottom: 3, paddingLeft: 15, paddingRight: 5 },
          { type: 'text', id: generateId(), content: '<p style="font-size:20px;"><s style="color:#666;">$199</s> <strong style="color:#fff;">$59</strong></p>', align: 'center', fontSize: 20, color: '#ffffff', lineHeight: 1.3, paddingTop: 0, paddingBottom: 10, paddingLeft: 15, paddingRight: 5 },
          { type: 'button', id: generateId(), text: 'Grab Deal', url: '{{targetUrl}}', align: 'center', backgroundColor: '#fbbf24', textColor: '#000000', borderRadius: 4, fontSize: 13, fullWidth: false, paddingTop: 0, paddingBottom: 15, paddingLeft: 15, paddingRight: 5 },
        ] },
        { id: generateId(), width: 50, blocks: [
          { type: 'image', id: generateId(), src: '', alt: 'Deal 2', width: 90, align: 'center', link: '', borderRadius: 6, paddingTop: 15, paddingBottom: 8, paddingLeft: 5, paddingRight: 15 },
          { type: 'heading', id: generateId(), content: 'Top Pick', level: 3, align: 'center', color: '#fbbf24', paddingTop: 5, paddingBottom: 3, paddingLeft: 5, paddingRight: 15 },
          { type: 'text', id: generateId(), content: '<p style="font-size:20px;"><s style="color:#666;">$149</s> <strong style="color:#fff;">$44</strong></p>', align: 'center', fontSize: 20, color: '#ffffff', lineHeight: 1.3, paddingTop: 0, paddingBottom: 10, paddingLeft: 5, paddingRight: 15 },
          { type: 'button', id: generateId(), text: 'Grab Deal', url: '{{targetUrl}}', align: 'center', backgroundColor: '#fbbf24', textColor: '#000000', borderRadius: 4, fontSize: 13, fullWidth: false, paddingTop: 0, paddingBottom: 15, paddingLeft: 5, paddingRight: 15 },
        ] },
      ], backgroundColor: '#1a1a1a', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 },
      { id: generateId(), columns: [{ id: generateId(), width: 100, blocks: [
        { type: 'text', id: generateId(), content: '<p style="font-size:18px;"><strong style="color:#fbbf24;">Use code: BLACKFRIDAY</strong> for an extra 10% off</p>', align: 'center', fontSize: 18, color: '#d1d5db', lineHeight: 1.5, paddingTop: 20, paddingBottom: 5, paddingLeft: 20, paddingRight: 20 },
        { type: 'button', id: generateId(), text: 'Shop All Deals', url: '{{targetUrl}}', align: 'center', backgroundColor: '#fbbf24', textColor: '#000000', borderRadius: 4, fontSize: 18, fullWidth: true, paddingTop: 10, paddingBottom: 25, paddingLeft: 30, paddingRight: 30 },
      ] }], backgroundColor: '', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 },
      { id: generateId(), columns: [{ id: generateId(), width: 100, blocks: [
        { type: 'text', id: generateId(), content: '<p style="font-size:11px;color:#6b7280;">Sale ends midnight tonight. While supplies last.<br/>{{unsubscribeLink}}</p>', align: 'center', fontSize: 11, color: '#6b7280', lineHeight: 1.4, paddingTop: 10, paddingBottom: 15, paddingLeft: 20, paddingRight: 20 },
      ] }], backgroundColor: '', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 },
    ],
  };
}

// ============================================================
// TEMPLATE 7: E-commerce Order Confirmation
// ============================================================
function orderConfirmationDesign(): EmailDesign {
  return {
    globalStyles: {
      bodyWidth: 600, backgroundColor: '#f5f5f5', contentBackgroundColor: '#ffffff',
      fontFamily: 'Arial, Helvetica, sans-serif', headingColor: '#111827', textColor: '#374151',
      linkColor: '#2563eb', buttonBackgroundColor: '#2563eb', buttonTextColor: '#ffffff',
      buttonBorderRadius: 6, paddingTop: 30, paddingBottom: 30,
    },
    sections: [
      { id: generateId(), columns: [{ id: generateId(), width: 100, blocks: [
        { type: 'heading', id: generateId(), content: 'STORE NAME', level: 2, align: 'center', color: '#2563eb', paddingTop: 25, paddingBottom: 15, paddingLeft: 20, paddingRight: 20 },
      ] }], backgroundColor: '', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 },
      { id: generateId(), columns: [{ id: generateId(), width: 100, blocks: [
        { type: 'heading', id: generateId(), content: 'Order Confirmed!', level: 1, align: 'center', color: '#16a34a', paddingTop: 15, paddingBottom: 5, paddingLeft: 20, paddingRight: 20 },
        { type: 'text', id: generateId(), content: '<p>Hi {{firstName}}, thank you for your purchase! We\'re preparing your order and will notify you when it ships.</p>', align: 'center', fontSize: 16, color: '', lineHeight: 1.6, paddingTop: 5, paddingBottom: 15, paddingLeft: 30, paddingRight: 30 },
      ] }], backgroundColor: '', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 },
      { id: generateId(), columns: [{ id: generateId(), width: 100, blocks: [
        { type: 'text', id: generateId(), content: '<p><strong>Order Number:</strong> #123456<br/><strong>Order Date:</strong> March 14, 2026<br/><strong>Payment Method:</strong> Visa ending in 4242</p>', align: 'left', fontSize: 14, color: '', lineHeight: 1.8, paddingTop: 15, paddingBottom: 15, paddingLeft: 25, paddingRight: 25 },
      ] }], backgroundColor: '#f9fafb', paddingTop: 5, paddingRight: 20, paddingBottom: 5, paddingLeft: 20 },
      { id: generateId(), columns: [
        { id: generateId(), width: 67, blocks: [
          { type: 'heading', id: generateId(), content: 'Product Name Here', level: 3, align: 'left', color: '', paddingTop: 15, paddingBottom: 3, paddingLeft: 20, paddingRight: 10 },
          { type: 'text', id: generateId(), content: '<p>Size: M &middot; Color: Blue<br/>Qty: 1</p>', align: 'left', fontSize: 14, color: '#6b7280', lineHeight: 1.5, paddingTop: 0, paddingBottom: 10, paddingLeft: 20, paddingRight: 10 },
        ] },
        { id: generateId(), width: 33, blocks: [
          { type: 'text', id: generateId(), content: '<p style="font-size:18px;font-weight:bold;text-align:right;">$49.99</p>', align: 'right', fontSize: 18, color: '#111827', lineHeight: 1.5, paddingTop: 20, paddingBottom: 10, paddingLeft: 10, paddingRight: 20 },
        ] },
      ], backgroundColor: '', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 },
      { id: generateId(), columns: [{ id: generateId(), width: 100, blocks: [
        { type: 'divider', id: generateId(), color: '#e5e7eb', thickness: 1, width: 90, style: 'solid', paddingTop: 5, paddingBottom: 5 },
        { type: 'text', id: generateId(), content: '<p style="text-align:right;"><strong>Subtotal:</strong> $49.99<br/><strong>Shipping:</strong> $5.00<br/><strong style="font-size:16px;">Total: $54.99</strong></p>', align: 'right', fontSize: 14, color: '', lineHeight: 1.8, paddingTop: 5, paddingBottom: 15, paddingLeft: 20, paddingRight: 25 },
      ] }], backgroundColor: '', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 },
      { id: generateId(), columns: [{ id: generateId(), width: 100, blocks: [
        { type: 'button', id: generateId(), text: 'Track Your Order', url: '{{targetUrl}}', align: 'center', backgroundColor: '', textColor: '', borderRadius: 6, fontSize: 16, fullWidth: false, paddingTop: 10, paddingBottom: 25, paddingLeft: 20, paddingRight: 20 },
      ] }], backgroundColor: '', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 },
      { id: generateId(), columns: [{ id: generateId(), width: 100, blocks: [
        { type: 'text', id: generateId(), content: '<p style="font-size:12px;color:#9ca3af;">Need help? Contact our support team anytime.<br/>{{unsubscribeLink}}</p>', align: 'center', fontSize: 12, color: '#9ca3af', lineHeight: 1.4, paddingTop: 10, paddingBottom: 15, paddingLeft: 20, paddingRight: 20 },
      ] }], backgroundColor: '', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 },
    ],
  };
}

// ============================================================
// TEMPLATE 8: Feedback Survey — Warm orange
// ============================================================
function feedbackSurveyDesign(): EmailDesign {
  return {
    globalStyles: {
      bodyWidth: 600, backgroundColor: '#fff7ed', contentBackgroundColor: '#ffffff',
      fontFamily: 'Arial, Helvetica, sans-serif', headingColor: '#1a1a2e', textColor: '#374151',
      linkColor: '#ea580c', buttonBackgroundColor: '#ea580c', buttonTextColor: '#ffffff',
      buttonBorderRadius: 8, paddingTop: 40, paddingBottom: 40,
    },
    sections: [
      { id: generateId(), columns: [{ id: generateId(), width: 100, blocks: [
        { type: 'heading', id: generateId(), content: 'YOUR BRAND', level: 2, align: 'center', color: '#ea580c', paddingTop: 25, paddingBottom: 10, paddingLeft: 20, paddingRight: 20 },
      ] }], backgroundColor: '', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 },
      { id: generateId(), columns: [{ id: generateId(), width: 100, blocks: [
        { type: 'heading', id: generateId(), content: 'We\'d love your feedback!', level: 1, align: 'center', color: '', paddingTop: 15, paddingBottom: 10, paddingLeft: 20, paddingRight: 20 },
        { type: 'text', id: generateId(), content: '<p>Hi {{firstName}}, your opinion matters to us. Take 2 minutes to share your thoughts and help us improve.</p>', align: 'center', fontSize: 16, color: '#6b7280', lineHeight: 1.7, paddingTop: 0, paddingBottom: 15, paddingLeft: 35, paddingRight: 35 },
      ] }], backgroundColor: '', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 },
      { id: generateId(), columns: [{ id: generateId(), width: 100, blocks: [
        { type: 'text', id: generateId(), content: '<p style="font-size:32px;text-align:center;letter-spacing:15px;">&#x1F620; &#x1F641; &#x1F610; &#x1F642; &#x1F60D;</p>', align: 'center', fontSize: 32, color: '', lineHeight: 1.5, paddingTop: 10, paddingBottom: 10, paddingLeft: 20, paddingRight: 20 },
        { type: 'text', id: generateId(), content: '<p style="text-align:center;font-size:12px;color:#9ca3af;">How was your experience?</p>', align: 'center', fontSize: 12, color: '#9ca3af', lineHeight: 1.4, paddingTop: 0, paddingBottom: 15, paddingLeft: 20, paddingRight: 20 },
      ] }], backgroundColor: '#fff7ed', paddingTop: 5, paddingRight: 20, paddingBottom: 5, paddingLeft: 20 },
      { id: generateId(), columns: [{ id: generateId(), width: 100, blocks: [
        { type: 'button', id: generateId(), text: 'Take the Survey', url: '{{targetUrl}}', align: 'center', backgroundColor: '', textColor: '', borderRadius: 8, fontSize: 18, fullWidth: false, paddingTop: 15, paddingBottom: 10, paddingLeft: 20, paddingRight: 20 },
        { type: 'text', id: generateId(), content: '<p>It only takes 2 minutes. As a thank you, you\'ll get <strong>15% off</strong> your next order!</p>', align: 'center', fontSize: 14, color: '#6b7280', lineHeight: 1.5, paddingTop: 5, paddingBottom: 25, paddingLeft: 30, paddingRight: 30 },
      ] }], backgroundColor: '', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 },
      { id: generateId(), columns: [{ id: generateId(), width: 100, blocks: [
        { type: 'text', id: generateId(), content: '<p style="font-size:12px;color:#9ca3af;">Thank you for being a valued customer.<br/>{{unsubscribeLink}}</p>', align: 'center', fontSize: 12, color: '#9ca3af', lineHeight: 1.4, paddingTop: 10, paddingBottom: 20, paddingLeft: 20, paddingRight: 20 },
      ] }], backgroundColor: '', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 },
    ],
  };
}

// ============================================================
// TEMPLATE 9: Re-engagement — "We miss you"
// ============================================================
function reEngagementDesign(): EmailDesign {
  return {
    globalStyles: {
      bodyWidth: 600, backgroundColor: '#fdf2f8', contentBackgroundColor: '#ffffff',
      fontFamily: 'Arial, Helvetica, sans-serif', headingColor: '#1a1a2e', textColor: '#374151',
      linkColor: '#db2777', buttonBackgroundColor: '#db2777', buttonTextColor: '#ffffff',
      buttonBorderRadius: 24, paddingTop: 40, paddingBottom: 40,
    },
    sections: [
      { id: generateId(), columns: [{ id: generateId(), width: 100, blocks: [
        { type: 'spacer', id: generateId(), height: 15 },
        { type: 'heading', id: generateId(), content: 'We Miss You!', level: 1, align: 'center', color: '#db2777', paddingTop: 20, paddingBottom: 5, paddingLeft: 20, paddingRight: 20 },
        { type: 'divider', id: generateId(), color: '#fbcfe8', thickness: 3, width: 25, style: 'solid', paddingTop: 5, paddingBottom: 10 },
      ] }], backgroundColor: '', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 },
      { id: generateId(), columns: [{ id: generateId(), width: 100, blocks: [
        { type: 'text', id: generateId(), content: '<p>Hi {{firstName}},</p><p>It\'s been a while since we last saw you. We\'ve added new features and improvements we think you\'ll love.</p>', align: 'center', fontSize: 16, color: '', lineHeight: 1.7, paddingTop: 10, paddingBottom: 15, paddingLeft: 40, paddingRight: 40 },
      ] }], backgroundColor: '', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 },
      { id: generateId(), columns: [{ id: generateId(), width: 100, blocks: [
        { type: 'heading', id: generateId(), content: 'Here\'s what\'s new', level: 2, align: 'center', color: '', paddingTop: 10, paddingBottom: 10, paddingLeft: 20, paddingRight: 20 },
      ] }], backgroundColor: '', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 },
      { id: generateId(), columns: [
        { id: generateId(), width: 50, blocks: [
          { type: 'heading', id: generateId(), content: 'New Features', level: 3, align: 'center', color: '#db2777', paddingTop: 15, paddingBottom: 5, paddingLeft: 15, paddingRight: 5 },
          { type: 'text', id: generateId(), content: '<p>We\'ve rebuilt the dashboard with powerful new tools.</p>', align: 'center', fontSize: 14, color: '', lineHeight: 1.5, paddingTop: 0, paddingBottom: 15, paddingLeft: 15, paddingRight: 5 },
        ] },
        { id: generateId(), width: 50, blocks: [
          { type: 'heading', id: generateId(), content: 'Better Experience', level: 3, align: 'center', color: '#db2777', paddingTop: 15, paddingBottom: 5, paddingLeft: 5, paddingRight: 15 },
          { type: 'text', id: generateId(), content: '<p>Faster loading, smoother navigation, and more.</p>', align: 'center', fontSize: 14, color: '', lineHeight: 1.5, paddingTop: 0, paddingBottom: 15, paddingLeft: 5, paddingRight: 15 },
        ] },
      ], backgroundColor: '#fdf2f8', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 },
      { id: generateId(), columns: [{ id: generateId(), width: 100, blocks: [
        { type: 'text', id: generateId(), content: '<p>Come back and see for yourself. We\'ve got a special offer waiting:</p>', align: 'center', fontSize: 16, color: '', lineHeight: 1.6, paddingTop: 15, paddingBottom: 5, paddingLeft: 30, paddingRight: 30 },
        { type: 'heading', id: generateId(), content: '20% OFF with code COMEBACK', level: 2, align: 'center', color: '#db2777', paddingTop: 5, paddingBottom: 10, paddingLeft: 20, paddingRight: 20 },
        { type: 'button', id: generateId(), text: 'Come Back', url: '{{targetUrl}}', align: 'center', backgroundColor: '', textColor: '', borderRadius: 24, fontSize: 18, fullWidth: false, paddingTop: 5, paddingBottom: 30, paddingLeft: 20, paddingRight: 20 },
      ] }], backgroundColor: '', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 },
      { id: generateId(), columns: [{ id: generateId(), width: 100, blocks: [
        { type: 'text', id: generateId(), content: '<p style="font-size:12px;color:#9ca3af;">If you no longer wish to receive emails from us, {{unsubscribeLink}}</p>', align: 'center', fontSize: 12, color: '#9ca3af', lineHeight: 1.4, paddingTop: 10, paddingBottom: 20, paddingLeft: 20, paddingRight: 20 },
      ] }], backgroundColor: '', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 },
    ],
  };
}

// ============================================================
// TEMPLATE 10: Holiday / Seasonal — Winter theme
// ============================================================
function holidayDesign(): EmailDesign {
  return {
    globalStyles: {
      bodyWidth: 600, backgroundColor: '#1e293b', contentBackgroundColor: '#0f172a',
      fontFamily: 'Georgia, Times, serif', headingColor: '#f1f5f9', textColor: '#cbd5e1',
      linkColor: '#38bdf8', buttonBackgroundColor: '#38bdf8', buttonTextColor: '#0f172a',
      buttonBorderRadius: 8, paddingTop: 40, paddingBottom: 40,
    },
    sections: [
      { id: generateId(), columns: [{ id: generateId(), width: 100, blocks: [
        { type: 'text', id: generateId(), content: '<p style="font-size:28px;text-align:center;letter-spacing:5px;">&#x2744; &#x2744; &#x2744;</p>', align: 'center', fontSize: 28, color: '#38bdf8', lineHeight: 1.5, paddingTop: 25, paddingBottom: 5, paddingLeft: 20, paddingRight: 20 },
        { type: 'heading', id: generateId(), content: 'Happy Holidays!', level: 1, align: 'center', color: '#f1f5f9', paddingTop: 10, paddingBottom: 5, paddingLeft: 20, paddingRight: 20 },
        { type: 'text', id: generateId(), content: '<p style="font-style:italic;">Wishing you warmth, joy, and wonderful moments this holiday season.</p>', align: 'center', fontSize: 17, color: '#94a3b8', lineHeight: 1.7, paddingTop: 5, paddingBottom: 15, paddingLeft: 40, paddingRight: 40 },
      ] }], backgroundColor: '', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 },
      { id: generateId(), columns: [{ id: generateId(), width: 100, blocks: [
        { type: 'image', id: generateId(), src: '', alt: 'Holiday banner', width: 90, align: 'center', link: '', borderRadius: 12, paddingTop: 10, paddingBottom: 20, paddingLeft: 20, paddingRight: 20 },
      ] }], backgroundColor: '', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 },
      { id: generateId(), columns: [{ id: generateId(), width: 100, blocks: [
        { type: 'heading', id: generateId(), content: 'Holiday Special', level: 2, align: 'center', color: '#38bdf8', paddingTop: 10, paddingBottom: 5, paddingLeft: 20, paddingRight: 20 },
        { type: 'text', id: generateId(), content: '<p>This season, treat yourself or a loved one. Enjoy our exclusive holiday collection with free shipping on all orders.</p>', align: 'center', fontSize: 16, color: '', lineHeight: 1.7, paddingTop: 5, paddingBottom: 15, paddingLeft: 35, paddingRight: 35 },
        { type: 'button', id: generateId(), text: 'Shop Holiday Collection', url: '{{targetUrl}}', align: 'center', backgroundColor: '#38bdf8', textColor: '#0f172a', borderRadius: 8, fontSize: 16, fullWidth: false, paddingTop: 5, paddingBottom: 25, paddingLeft: 20, paddingRight: 20 },
      ] }], backgroundColor: '', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 },
      { id: generateId(), columns: [{ id: generateId(), width: 100, blocks: [
        { type: 'divider', id: generateId(), color: '#334155', thickness: 1, width: 80, style: 'solid', paddingTop: 10, paddingBottom: 10 },
        { type: 'text', id: generateId(), content: '<p style="font-style:italic;font-size:14px;">From our family to yours — thank you for being part of our journey.</p>', align: 'center', fontSize: 14, color: '#64748b', lineHeight: 1.6, paddingTop: 5, paddingBottom: 15, paddingLeft: 30, paddingRight: 30 },
        { type: 'social', id: generateId(), networks: [
          { platform: 'facebook', url: '#', label: 'Facebook' },
          { platform: 'instagram', url: '#', label: 'Instagram' },
          { platform: 'twitter', url: '#', label: 'Twitter' },
        ], align: 'center', iconSize: 24, iconStyle: 'light', paddingTop: 5, paddingBottom: 10 },
        { type: 'text', id: generateId(), content: '<p style="font-size:11px;">{{unsubscribeLink}}</p>', align: 'center', fontSize: 11, color: '#475569', lineHeight: 1.4, paddingTop: 5, paddingBottom: 15, paddingLeft: 20, paddingRight: 20 },
      ] }], backgroundColor: '', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 },
    ],
  };
}

// ============================================================
// TEMPLATE 11: Announcement — Clean green
// ============================================================
function announcementDesign(): EmailDesign {
  return {
    globalStyles: {
      bodyWidth: 600, backgroundColor: '#f0fdf4', contentBackgroundColor: '#ffffff',
      fontFamily: 'Arial, Helvetica, sans-serif', headingColor: '#14532d', textColor: '#374151',
      linkColor: '#16a34a', buttonBackgroundColor: '#16a34a', buttonTextColor: '#ffffff',
      buttonBorderRadius: 8, paddingTop: 40, paddingBottom: 40,
    },
    sections: [
      { id: generateId(), columns: [{ id: generateId(), width: 100, blocks: [
        { type: 'spacer', id: generateId(), height: 15 },
        { type: 'heading', id: generateId(), content: 'Exciting News!', level: 1, align: 'center', color: '#14532d', paddingTop: 20, paddingBottom: 10, paddingLeft: 20, paddingRight: 20 },
        { type: 'divider', id: generateId(), color: '#bbf7d0', thickness: 3, width: 30, style: 'solid', paddingTop: 0, paddingBottom: 15 },
      ] }], backgroundColor: '', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 },
      { id: generateId(), columns: [{ id: generateId(), width: 100, blocks: [
        { type: 'text', id: generateId(), content: '<p>We\'re thrilled to announce something big! This is a major milestone and we wanted you to be the first to know.</p>', align: 'left', fontSize: 16, color: '', lineHeight: 1.7, paddingTop: 10, paddingBottom: 10, paddingLeft: 40, paddingRight: 40 },
        { type: 'text', id: generateId(), content: '<p>Here\'s what this means for you:</p><ul><li>Benefit one — describe it here</li><li>Benefit two — describe it here</li><li>Benefit three — describe it here</li></ul>', align: 'left', fontSize: 16, color: '', lineHeight: 1.7, paddingTop: 0, paddingBottom: 15, paddingLeft: 40, paddingRight: 40 },
        { type: 'button', id: generateId(), text: 'Learn More', url: '{{targetUrl}}', align: 'center', backgroundColor: '', textColor: '', borderRadius: 8, fontSize: 18, fullWidth: false, paddingTop: 5, paddingBottom: 30, paddingLeft: 20, paddingRight: 20 },
      ] }], backgroundColor: '', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 },
      { id: generateId(), columns: [{ id: generateId(), width: 100, blocks: [
        { type: 'social', id: generateId(), networks: [
          { platform: 'facebook', url: '#', label: 'Facebook' },
          { platform: 'twitter', url: '#', label: 'Twitter' },
          { platform: 'linkedin', url: '#', label: 'LinkedIn' },
        ], align: 'center', iconSize: 28, iconStyle: 'color', paddingTop: 10, paddingBottom: 10 },
        { type: 'text', id: generateId(), content: '<p style="font-size:12px;color:#9ca3af;">{{unsubscribeLink}}</p>', align: 'center', fontSize: 12, color: '#9ca3af', lineHeight: 1.4, paddingTop: 5, paddingBottom: 20, paddingLeft: 20, paddingRight: 20 },
      ] }], backgroundColor: '', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 },
    ],
  };
}

// ============================================================
// TEMPLATE 12: Minimal — Serif elegance
// ============================================================
function minimalDesign(): EmailDesign {
  return {
    globalStyles: {
      bodyWidth: 600, backgroundColor: '#f9fafb', contentBackgroundColor: '#ffffff',
      fontFamily: 'Georgia, Times, serif', headingColor: '#111827', textColor: '#4b5563',
      linkColor: '#111827', buttonBackgroundColor: '#111827', buttonTextColor: '#ffffff',
      buttonBorderRadius: 0, paddingTop: 40, paddingBottom: 40,
    },
    sections: [
      { id: generateId(), columns: [{ id: generateId(), width: 100, blocks: [
        { type: 'heading', id: generateId(), content: 'Your Brand', level: 2, align: 'center', color: '#111827', paddingTop: 30, paddingBottom: 20, paddingLeft: 20, paddingRight: 20 },
      ] }], backgroundColor: '', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 },
      { id: generateId(), columns: [{ id: generateId(), width: 100, blocks: [
        { type: 'heading', id: generateId(), content: 'A simple message', level: 1, align: 'left', color: '', paddingTop: 10, paddingBottom: 10, paddingLeft: 40, paddingRight: 40 },
        { type: 'text', id: generateId(), content: '<p>Sometimes less is more. Write your message here with a clean, distraction-free layout.</p>', align: 'left', fontSize: 17, color: '', lineHeight: 1.8, paddingTop: 0, paddingBottom: 10, paddingLeft: 40, paddingRight: 40 },
        { type: 'text', id: generateId(), content: '<p>Add a second paragraph if needed. Keep it concise and clear.</p>', align: 'left', fontSize: 17, color: '', lineHeight: 1.8, paddingTop: 0, paddingBottom: 20, paddingLeft: 40, paddingRight: 40 },
        { type: 'button', id: generateId(), text: 'Read More', url: '{{targetUrl}}', align: 'left', backgroundColor: '', textColor: '', borderRadius: 0, fontSize: 16, fullWidth: false, paddingTop: 5, paddingBottom: 30, paddingLeft: 40, paddingRight: 40 },
      ] }], backgroundColor: '', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 },
      { id: generateId(), columns: [{ id: generateId(), width: 100, blocks: [
        { type: 'divider', id: generateId(), color: '#d1d5db', thickness: 1, width: 100, style: 'solid', paddingTop: 10, paddingBottom: 10 },
        { type: 'text', id: generateId(), content: '<p style="font-size:12px;color:#9ca3af;">{{unsubscribeLink}}</p>', align: 'center', fontSize: 12, color: '#9ca3af', lineHeight: 1.4, paddingTop: 5, paddingBottom: 20, paddingLeft: 20, paddingRight: 20 },
      ] }], backgroundColor: '', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 },
    ],
  };
}

// ============================================================
// TEMPLATE 13: E-commerce Product Showcase
// ============================================================
function productShowcaseDesign(): EmailDesign {
  return {
    globalStyles: {
      bodyWidth: 600, backgroundColor: '#f5f5f5', contentBackgroundColor: '#ffffff',
      fontFamily: 'Helvetica, Arial, sans-serif', headingColor: '#111827', textColor: '#374151',
      linkColor: '#059669', buttonBackgroundColor: '#059669', buttonTextColor: '#ffffff',
      buttonBorderRadius: 6, paddingTop: 40, paddingBottom: 40,
    },
    sections: [
      { id: generateId(), columns: [{ id: generateId(), width: 100, blocks: [
        { type: 'heading', id: generateId(), content: 'SHOP NAME', level: 2, align: 'center', color: '#059669', paddingTop: 25, paddingBottom: 10, paddingLeft: 20, paddingRight: 20 },
        { type: 'heading', id: generateId(), content: 'New Arrivals Just Dropped', level: 1, align: 'center', color: '', paddingTop: 5, paddingBottom: 5, paddingLeft: 20, paddingRight: 20 },
        { type: 'text', id: generateId(), content: '<p>Fresh styles for the new season. Be the first to shop our latest collection.</p>', align: 'center', fontSize: 16, color: '#6b7280', lineHeight: 1.6, paddingTop: 0, paddingBottom: 15, paddingLeft: 30, paddingRight: 30 },
      ] }], backgroundColor: '', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 },
      { id: generateId(), columns: [{ id: generateId(), width: 100, blocks: [
        { type: 'image', id: generateId(), src: '', alt: 'Collection hero', width: 100, align: 'center', link: '', borderRadius: 0, paddingTop: 0, paddingBottom: 0, paddingLeft: 0, paddingRight: 0 },
      ] }], backgroundColor: '', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 },
      { id: generateId(), columns: [
        { id: generateId(), width: 33, blocks: [
          { type: 'image', id: generateId(), src: '', alt: 'Item 1', width: 95, align: 'center', link: '', borderRadius: 6, paddingTop: 15, paddingBottom: 8, paddingLeft: 10, paddingRight: 5 },
          { type: 'text', id: generateId(), content: '<p><strong>Item Name</strong><br/>$39.99</p>', align: 'center', fontSize: 13, color: '', lineHeight: 1.4, paddingTop: 0, paddingBottom: 10, paddingLeft: 10, paddingRight: 5 },
        ] },
        { id: generateId(), width: 34, blocks: [
          { type: 'image', id: generateId(), src: '', alt: 'Item 2', width: 95, align: 'center', link: '', borderRadius: 6, paddingTop: 15, paddingBottom: 8, paddingLeft: 5, paddingRight: 5 },
          { type: 'text', id: generateId(), content: '<p><strong>Item Name</strong><br/>$49.99</p>', align: 'center', fontSize: 13, color: '', lineHeight: 1.4, paddingTop: 0, paddingBottom: 10, paddingLeft: 5, paddingRight: 5 },
        ] },
        { id: generateId(), width: 33, blocks: [
          { type: 'image', id: generateId(), src: '', alt: 'Item 3', width: 95, align: 'center', link: '', borderRadius: 6, paddingTop: 15, paddingBottom: 8, paddingLeft: 5, paddingRight: 10 },
          { type: 'text', id: generateId(), content: '<p><strong>Item Name</strong><br/>$59.99</p>', align: 'center', fontSize: 13, color: '', lineHeight: 1.4, paddingTop: 0, paddingBottom: 10, paddingLeft: 5, paddingRight: 10 },
        ] },
      ], backgroundColor: '', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 },
      { id: generateId(), columns: [{ id: generateId(), width: 100, blocks: [
        { type: 'button', id: generateId(), text: 'Shop All New Arrivals', url: '{{targetUrl}}', align: 'center', backgroundColor: '', textColor: '', borderRadius: 6, fontSize: 16, fullWidth: false, paddingTop: 15, paddingBottom: 10, paddingLeft: 20, paddingRight: 20 },
        { type: 'text', id: generateId(), content: '<p>Free shipping on orders over $50</p>', align: 'center', fontSize: 13, color: '#6b7280', lineHeight: 1.4, paddingTop: 0, paddingBottom: 25, paddingLeft: 20, paddingRight: 20 },
      ] }], backgroundColor: '', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 },
      { id: generateId(), columns: [{ id: generateId(), width: 100, blocks: [
        { type: 'divider', id: generateId(), color: '#e5e7eb', thickness: 1, width: 100, style: 'solid', paddingTop: 5, paddingBottom: 10 },
        { type: 'social', id: generateId(), networks: [
          { platform: 'instagram', url: '#', label: 'Instagram' },
          { platform: 'facebook', url: '#', label: 'Facebook' },
          { platform: 'pinterest', url: '#', label: 'Pinterest' },
        ], align: 'center', iconSize: 28, iconStyle: 'color', paddingTop: 5, paddingBottom: 10 },
        { type: 'text', id: generateId(), content: '<p style="font-size:12px;color:#9ca3af;">{{unsubscribeLink}}</p>', align: 'center', fontSize: 12, color: '#9ca3af', lineHeight: 1.4, paddingTop: 5, paddingBottom: 15, paddingLeft: 20, paddingRight: 20 },
      ] }], backgroundColor: '', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 },
    ],
  };
}

// ============================================================
// EXPORTS
// ============================================================

export const EMAIL_STARTER_TEMPLATES: EmailTemplate[] = [
  { id: 'newsletter', name: 'Modern Newsletter', description: 'Weekly newsletter with articles, 2-column layout, and social links', category: 'newsletter', color: '#6366f1', design: newsletterDesign },
  { id: 'welcome', name: 'Welcome Email', description: 'Onboarding email with 3-column benefits and CTA', category: 'welcome', color: '#4f46e5', design: welcomeDesign },
  { id: 'flash-sale', name: 'Flash Sale', description: 'Bold promotional email with product grid and urgency CTA', category: 'promotional', color: '#dc2626', design: flashSaleDesign },
  { id: 'product-launch', name: 'Product Launch', description: 'Dark & bold product announcement with feature highlights', category: 'notification', color: '#8b5cf6', design: productLaunchDesign },
  { id: 'event-invitation', name: 'Event Invitation', description: 'Elegant event invite with date, location, and RSVP', category: 'event', color: '#0d9488', design: eventInvitationDesign },
  { id: 'black-friday', name: 'Black Friday', description: 'Dark dramatic sale email with gold accents and deal grid', category: 'seasonal', color: '#fbbf24', design: blackFridayDesign },
  { id: 'order-confirmation', name: 'Order Confirmation', description: 'E-commerce order receipt with line items and tracking', category: 'ecommerce', color: '#2563eb', design: orderConfirmationDesign },
  { id: 'feedback-survey', name: 'Feedback Survey', description: 'Customer survey request with emoji rating and incentive', category: 'notification', color: '#ea580c', design: feedbackSurveyDesign },
  { id: 're-engagement', name: 'We Miss You', description: 'Win-back email with discount code and feature highlights', category: 'promotional', color: '#db2777', design: reEngagementDesign },
  { id: 'holiday', name: 'Holiday Season', description: 'Winter-themed dark email with seasonal collection promo', category: 'seasonal', color: '#38bdf8', design: holidayDesign },
  { id: 'announcement', name: 'Announcement', description: 'Clean announcement with bullet points and social footer', category: 'notification', color: '#16a34a', design: announcementDesign },
  { id: 'minimal', name: 'Minimal', description: 'Simple, elegant text-focused email with serif font', category: 'minimal', color: '#111827', design: minimalDesign },
  { id: 'product-showcase', name: 'Product Showcase', description: '3-column product grid with hero image and free shipping', category: 'ecommerce', color: '#059669', design: productShowcaseDesign },
];
