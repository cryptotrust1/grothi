import { z } from 'zod';

export const signUpSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

export const signInSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const createBotSchema = z.object({
  name: z.string().min(2, 'Bot name must be at least 2 characters').max(50),
  description: z.string().max(200).optional(),
  brandName: z.string().min(1, 'Brand name is required').max(100),
  instructions: z.string().min(10, 'Instructions must be at least 10 characters').max(5000),
  brandKnowledge: z.string().max(10000).optional(),
  safetyLevel: z.enum(['CONSERVATIVE', 'MODERATE', 'AGGRESSIVE']).default('MODERATE'),
  goal: z.enum(['TRAFFIC', 'SALES', 'ENGAGEMENT', 'BRAND_AWARENESS', 'LEADS', 'COMMUNITY']).default('ENGAGEMENT'),
  targetUrl: z.string().url().optional().or(z.literal('')),
  keywords: z.string().max(2000).optional(),
  postingSchedule: z.string().optional(),
  timezone: z.string().default('UTC'),
  rssFeeds: z.array(z.string().url()).max(20).optional(),
});

export const updateBotSchema = createBotSchema.partial();

export const platformConnectionSchema = z.object({
  platform: z.enum([
    'MASTODON', 'FACEBOOK', 'TELEGRAM', 'MOLTBOOK',
    'DISCORD', 'TWITTER', 'BLUESKY', 'REDDIT', 'DEVTO',
    'LINKEDIN', 'INSTAGRAM', 'TIKTOK', 'PINTEREST',
    'THREADS', 'MEDIUM', 'YOUTUBE', 'NOSTR',
  ]),
  credentials: z.record(z.string()),
  config: z.record(z.any()).optional(),
});

// ============ EMAIL MARKETING ============

export const emailAccountSchema = z.object({
  provider: z.enum(['GOOGLE', 'MICROSOFT', 'SENDGRID', 'MAILGUN', 'AMAZON_SES', 'POSTMARK', 'CUSTOM']),
  email: z.string().email('Invalid email address'),
  fromName: z.string().max(100).optional(),
  smtpHost: z.string().min(1, 'SMTP host is required').max(255),
  smtpPort: z.coerce.number().int().min(1).max(65535).default(587),
  smtpUser: z.string().min(1, 'SMTP username is required').max(255),
  smtpPass: z.string().min(1, 'SMTP password is required'),
  smtpSecure: z.boolean().default(false),
  dailyLimit: z.coerce.number().int().min(1).max(100000).default(2000),
});

export const emailListSchema = z.object({
  name: z.string().min(1, 'List name is required').max(100),
  description: z.string().max(500).optional(),
});

export const emailContactSchema = z.object({
  email: z.string().email('Invalid email address'),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
});

export const emailContactImportSchema = z.object({
  contacts: z.array(emailContactSchema).min(1, 'At least one contact required').max(10000),
  consentSource: z.string().min(1, 'Consent source is required').max(100),
});

export const emailCampaignSchema = z.object({
  name: z.string().min(1, 'Campaign name is required').max(200),
  subject: z.string().min(1, 'Subject line is required').max(200),
  subjectB: z.string().max(200).optional(),
  abTestPercent: z.coerce.number().int().min(5).max(50).optional(),
  preheader: z.string().max(200).optional(),
  fromName: z.string().max(100).optional(),
  listId: z.string().min(1, 'Select a contact list'),
  htmlContent: z.string().min(1, 'Email content is required'),
  textContent: z.string().optional(),
  scheduledAt: z.string().datetime().optional(),
});

export const emailAutomationSchema = z.object({
  name: z.string().min(1, 'Automation name is required').max(200),
  type: z.enum(['WELCOME', 'RE_ENGAGEMENT', 'DRIP']),
  triggerListId: z.string().optional(),
  triggerConfig: z.record(z.any()).optional(),
});

export const emailAutomationStepSchema = z.object({
  subject: z.string().min(1, 'Subject line is required').max(200),
  htmlContent: z.string().min(1, 'Email content is required'),
  textContent: z.string().optional(),
  delayDays: z.coerce.number().int().min(0).max(365).default(0),
  delayHours: z.coerce.number().int().min(0).max(23).default(0),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type CreateBotInput = z.infer<typeof createBotSchema>;
export type UpdateBotInput = z.infer<typeof updateBotSchema>;
export type PlatformConnectionInput = z.infer<typeof platformConnectionSchema>;
export type EmailAccountInput = z.infer<typeof emailAccountSchema>;
export type EmailListInput = z.infer<typeof emailListSchema>;
export type EmailContactInput = z.infer<typeof emailContactSchema>;
export type EmailContactImportInput = z.infer<typeof emailContactImportSchema>;
export type EmailCampaignInput = z.infer<typeof emailCampaignSchema>;
export type EmailAutomationInput = z.infer<typeof emailAutomationSchema>;
export type EmailAutomationStepInput = z.infer<typeof emailAutomationStepSchema>;
