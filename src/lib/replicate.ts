// Lazy-loaded Replicate client for AI image and video generation
// Similar to stripe.ts pattern — no key needed for build

import Replicate from 'replicate';

let replicateInstance: Replicate | null = null;

export function getReplicate(): Replicate {
  if (!replicateInstance) {
    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) {
      throw new Error('REPLICATE_API_TOKEN environment variable is not set');
    }
    replicateInstance = new Replicate({ auth: token });
  }
  return replicateInstance;
}

// Model identifiers — per official Replicate documentation
// https://replicate.com/black-forest-labs/flux-1.1-pro
// https://replicate.com/minimax/video-01
// https://replicate.com/minimax/video-01-live
export const MODELS = {
  // Text-to-image: Flux 1.1 Pro (best quality/speed balance)
  IMAGE: 'black-forest-labs/flux-1.1-pro' as const,
  // Text-to-video: Minimax video-01
  VIDEO: 'minimax/video-01' as const,
  // Image-to-video: Minimax video-01-live (supports first_frame_image)
  VIDEO_I2V: 'minimax/video-01-live' as const,
};

// Flux 1.1 Pro valid aspect_ratio values (from Replicate API schema)
// https://replicate.com/black-forest-labs/flux-1.1-pro/api/schema
// Valid: "1:1", "16:9", "2:3", "3:2", "4:5", "5:4", "9:16", "3:4", "4:3"
export const PLATFORM_ASPECT_RATIOS: Record<string, string> = {
  INSTAGRAM: '1:1',
  FACEBOOK: '16:9',
  TWITTER: '16:9',
  LINKEDIN: '16:9',
  TIKTOK: '9:16',
  YOUTUBE: '16:9',
  PINTEREST: '2:3',
  THREADS: '1:1',
  REDDIT: '16:9',
  TELEGRAM: '16:9',
  DISCORD: '16:9',
  MEDIUM: '16:9',
  DEVTO: '16:9',
  MASTODON: '16:9',
  BLUESKY: '16:9',
  NOSTR: '16:9',
};

// Platform-specific image dimensions (for DB record + display info)
export const PLATFORM_IMAGE_DIMENSIONS: Record<string, { width: number; height: number }> = {
  FACEBOOK: { width: 1200, height: 630 },
  INSTAGRAM: { width: 1080, height: 1080 },
  TWITTER: { width: 1200, height: 675 },
  LINKEDIN: { width: 1200, height: 627 },
  TIKTOK: { width: 1080, height: 1920 },
  YOUTUBE: { width: 1280, height: 720 },
  PINTEREST: { width: 1000, height: 1500 },
  THREADS: { width: 1080, height: 1080 },
  REDDIT: { width: 1200, height: 628 },
  TELEGRAM: { width: 1280, height: 720 },
  DISCORD: { width: 1200, height: 675 },
  MEDIUM: { width: 1400, height: 788 },
  DEVTO: { width: 1000, height: 420 },
  MASTODON: { width: 1200, height: 675 },
  BLUESKY: { width: 1200, height: 675 },
  NOSTR: { width: 1200, height: 675 },
};

// Credit costs for AI generation
export const GENERATION_COSTS = {
  GENERATE_IMAGE: 3,
  GENERATE_VIDEO: 8,
};
