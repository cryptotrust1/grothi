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
  postingSchedule: z.string().optional(),
  timezone: z.string().default('UTC'),
  rssFeeds: z.array(z.string().url()).max(20).optional(),
});

export const updateBotSchema = createBotSchema.partial();

export const platformConnectionSchema = z.object({
  platform: z.enum([
    'MASTODON', 'FACEBOOK', 'TELEGRAM', 'MOLTBOOK',
    'DISCORD', 'TWITTER', 'BLUESKY', 'REDDIT', 'DEVTO',
  ]),
  credentials: z.record(z.string()),
  config: z.record(z.any()).optional(),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type CreateBotInput = z.infer<typeof createBotSchema>;
export type UpdateBotInput = z.infer<typeof updateBotSchema>;
export type PlatformConnectionInput = z.infer<typeof platformConnectionSchema>;
