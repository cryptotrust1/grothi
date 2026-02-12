// Official image specifications for each platform (2026)
export const PLATFORM_IMAGE_SPECS: Record<string, {
  name: string;
  formats: {
    label: string;
    width: number;
    height: number;
    aspect: string;
    use: string;
  }[];
  maxFileSize: string;
  supportedFormats: string[];
}> = {
  FACEBOOK: {
    name: 'Facebook',
    formats: [
      { label: 'Post Image', width: 1200, height: 630, aspect: '1.91:1', use: 'Link posts, shared images' },
      { label: 'Square Post', width: 1200, height: 1200, aspect: '1:1', use: 'Engagement posts' },
      { label: 'Story', width: 1080, height: 1920, aspect: '9:16', use: 'Stories and Reels' },
    ],
    maxFileSize: '8MB',
    supportedFormats: ['JPEG', 'PNG', 'GIF', 'WebP'],
  },
  INSTAGRAM: {
    name: 'Instagram',
    formats: [
      { label: 'Square', width: 1080, height: 1080, aspect: '1:1', use: 'Standard feed post' },
      { label: 'Portrait', width: 1080, height: 1350, aspect: '4:5', use: 'Best engagement for feed' },
      { label: 'Story/Reel', width: 1080, height: 1920, aspect: '9:16', use: 'Stories and Reels' },
      { label: 'Landscape', width: 1080, height: 608, aspect: '1.91:1', use: 'Landscape photos' },
    ],
    maxFileSize: '8MB',
    supportedFormats: ['JPEG', 'PNG'],
  },
  TWITTER: {
    name: 'X (Twitter)',
    formats: [
      { label: 'Tweet Image', width: 1200, height: 675, aspect: '16:9', use: 'Standard tweet image' },
      { label: 'Large Image', width: 1600, height: 900, aspect: '16:9', use: 'High quality' },
    ],
    maxFileSize: '5MB',
    supportedFormats: ['JPEG', 'PNG', 'GIF', 'WebP'],
  },
  LINKEDIN: {
    name: 'LinkedIn',
    formats: [
      { label: 'Post Image', width: 1200, height: 627, aspect: '1.91:1', use: 'Shared content' },
      { label: 'Square Post', width: 1200, height: 1200, aspect: '1:1', use: 'Engagement posts' },
    ],
    maxFileSize: '10MB',
    supportedFormats: ['JPEG', 'PNG', 'GIF'],
  },
  TIKTOK: {
    name: 'TikTok',
    formats: [
      { label: 'Video/Photo', width: 1080, height: 1920, aspect: '9:16', use: 'Standard content' },
    ],
    maxFileSize: '10MB',
    supportedFormats: ['JPEG', 'PNG', 'WebP'],
  },
  PINTEREST: {
    name: 'Pinterest',
    formats: [
      { label: 'Standard Pin', width: 1000, height: 1500, aspect: '2:3', use: 'Best performing' },
      { label: 'Square Pin', width: 1000, height: 1000, aspect: '1:1', use: 'Alternative format' },
    ],
    maxFileSize: '20MB',
    supportedFormats: ['JPEG', 'PNG'],
  },
  YOUTUBE: {
    name: 'YouTube',
    formats: [
      { label: 'Thumbnail', width: 1280, height: 720, aspect: '16:9', use: 'Video thumbnails' },
      { label: 'Community', width: 1200, height: 675, aspect: '16:9', use: 'Community posts' },
    ],
    maxFileSize: '2MB',
    supportedFormats: ['JPEG', 'PNG', 'GIF'],
  },
  MASTODON: {
    name: 'Mastodon',
    formats: [
      { label: 'Post Image', width: 1200, height: 675, aspect: '16:9', use: 'Standard post' },
    ],
    maxFileSize: '8MB',
    supportedFormats: ['JPEG', 'PNG', 'GIF', 'WebP'],
  },
  BLUESKY: {
    name: 'Bluesky',
    formats: [
      { label: 'Post Image', width: 1200, height: 675, aspect: '16:9', use: 'Standard post' },
    ],
    maxFileSize: '1MB',
    supportedFormats: ['JPEG', 'PNG'],
  },
  TELEGRAM: {
    name: 'Telegram',
    formats: [
      { label: 'Photo', width: 1280, height: 720, aspect: '16:9', use: 'Channel photo' },
      { label: 'Square', width: 1080, height: 1080, aspect: '1:1', use: 'Square photo' },
    ],
    maxFileSize: '10MB',
    supportedFormats: ['JPEG', 'PNG', 'GIF', 'WebP'],
  },
  THREADS: {
    name: 'Threads',
    formats: [
      { label: 'Post Image', width: 1080, height: 1080, aspect: '1:1', use: 'Standard post' },
      { label: 'Portrait', width: 1080, height: 1350, aspect: '4:5', use: 'Portrait post' },
    ],
    maxFileSize: '8MB',
    supportedFormats: ['JPEG', 'PNG'],
  },
  DISCORD: {
    name: 'Discord',
    formats: [
      { label: 'Embed Image', width: 1200, height: 675, aspect: '16:9', use: 'Embedded content' },
    ],
    maxFileSize: '8MB',
    supportedFormats: ['JPEG', 'PNG', 'GIF', 'WebP'],
  },
  REDDIT: {
    name: 'Reddit',
    formats: [
      { label: 'Post Image', width: 1200, height: 628, aspect: '1.91:1', use: 'Link preview' },
    ],
    maxFileSize: '20MB',
    supportedFormats: ['JPEG', 'PNG', 'GIF'],
  },
  MEDIUM: {
    name: 'Medium',
    formats: [
      { label: 'Featured Image', width: 1400, height: 788, aspect: '16:9', use: 'Article header' },
    ],
    maxFileSize: '5MB',
    supportedFormats: ['JPEG', 'PNG', 'GIF'],
  },
  DEVTO: {
    name: 'Dev.to',
    formats: [
      { label: 'Cover Image', width: 1000, height: 420, aspect: '2.38:1', use: 'Article cover' },
    ],
    maxFileSize: '5MB',
    supportedFormats: ['JPEG', 'PNG'],
  },
  NOSTR: {
    name: 'Nostr',
    formats: [
      { label: 'Post Image', width: 1200, height: 675, aspect: '16:9', use: 'Standard note image' },
    ],
    maxFileSize: '5MB',
    supportedFormats: ['JPEG', 'PNG', 'GIF', 'WebP'],
  },
  MOLTBOOK: {
    name: 'Moltbook',
    formats: [
      { label: 'Post Image', width: 1200, height: 630, aspect: '1.91:1', use: 'Standard post' },
      { label: 'Square Post', width: 1080, height: 1080, aspect: '1:1', use: 'Square format' },
    ],
    maxFileSize: '8MB',
    supportedFormats: ['JPEG', 'PNG', 'GIF'],
  },
};

// Optimal posting times by platform (in hours, UTC)
export const OPTIMAL_POSTING_TIMES: Record<string, { weekday: number[]; weekend: number[] }> = {
  FACEBOOK: { weekday: [9, 13, 16], weekend: [10, 14] },
  INSTAGRAM: { weekday: [8, 11, 14, 17], weekend: [9, 12] },
  TWITTER: { weekday: [8, 12, 17, 21], weekend: [9, 15] },
  LINKEDIN: { weekday: [7, 10, 12], weekend: [] },
  TIKTOK: { weekday: [7, 10, 19, 22], weekend: [9, 12, 19] },
  PINTEREST: { weekday: [14, 20, 21], weekend: [14, 20] },
  YOUTUBE: { weekday: [12, 15, 17], weekend: [10, 14] },
  MASTODON: { weekday: [8, 12, 18], weekend: [10, 15] },
  BLUESKY: { weekday: [8, 12, 17], weekend: [10, 14] },
  TELEGRAM: { weekday: [9, 12, 18], weekend: [11, 16] },
  THREADS: { weekday: [8, 12, 17], weekend: [9, 14] },
  DISCORD: { weekday: [14, 18, 21], weekend: [12, 16, 20] },
  REDDIT: { weekday: [6, 8, 12], weekend: [8, 11] },
  MEDIUM: { weekday: [7, 10], weekend: [9] },
  DEVTO: { weekday: [8, 14], weekend: [10] },
  NOSTR: { weekday: [9, 14, 20], weekend: [10, 16] },
  MOLTBOOK: { weekday: [8, 12, 17], weekend: [10, 14] },
};
