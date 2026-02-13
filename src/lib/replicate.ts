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

// Model identifiers — can be swapped without code changes
export const MODELS = {
  // Image generation: Flux 1.1 Pro (best quality/speed balance)
  IMAGE: 'black-forest-labs/flux-1.1-pro' as const,
  // Video generation: Minimax video-01-live (best for short social videos)
  VIDEO: 'minimax/video-01-live' as const,
};

// Platform-specific image dimensions
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
