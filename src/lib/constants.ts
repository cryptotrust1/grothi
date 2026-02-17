// Shared constants used across the Grothi platform
// Single source of truth - all pages import from here

// ============ PLATFORM NAMES ============
export const PLATFORM_NAMES: Record<string, string> = {
  MASTODON: 'Mastodon',
  FACEBOOK: 'Facebook',
  TELEGRAM: 'Telegram',
  MOLTBOOK: 'Moltbook',
  DISCORD: 'Discord',
  TWITTER: 'X (Twitter)',
  BLUESKY: 'Bluesky',
  REDDIT: 'Reddit',
  DEVTO: 'Dev.to',
  LINKEDIN: 'LinkedIn',
  INSTAGRAM: 'Instagram',
  TIKTOK: 'TikTok',
  PINTEREST: 'Pinterest',
  THREADS: 'Threads',
  MEDIUM: 'Medium',
  YOUTUBE: 'YouTube',
  NOSTR: 'Nostr',
};

// ============ STATUS CONFIGS ============
export const BOT_STATUS_CONFIG: Record<string, {
  variant: 'success' | 'warning' | 'destructive' | 'secondary';
  label: string;
}> = {
  ACTIVE: { variant: 'success', label: 'Active' },
  PAUSED: { variant: 'secondary', label: 'Paused' },
  STOPPED: { variant: 'secondary', label: 'Stopped' },
  ERROR: { variant: 'destructive', label: 'Error' },
  NO_CREDITS: { variant: 'warning', label: 'No Credits' },
};

export const POST_STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  SCHEDULED: 'bg-blue-100 text-blue-800',
  PUBLISHING: 'bg-yellow-100 text-yellow-800',
  PUBLISHED: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-gray-100 text-gray-500',
};

// ============ GOAL LABELS ============
export const GOAL_LABELS: Record<string, string> = {
  TRAFFIC: 'Drive Traffic',
  SALES: 'Increase Sales',
  ENGAGEMENT: 'Boost Engagement',
  BRAND_AWARENESS: 'Brand Awareness',
  LEADS: 'Generate Leads',
  COMMUNITY: 'Build Community',
};

// ============ BOT NAVIGATION TABS ============
export const BOT_NAV_TABS = [
  { key: 'overview', label: 'Overview', path: '' },
  { key: 'post', label: 'New Post', path: '/post' },
  { key: 'activity', label: 'Activity', path: '/activity' },
  { key: 'platforms', label: 'Platforms', path: '/platforms' },
  { key: 'email', label: 'Email Marketing', path: '/email' },
  { key: 'strategy', label: 'Content Strategy', path: '/strategy' },
  { key: 'media', label: 'Media', path: '/media' },
  { key: 'scheduler', label: 'Scheduler', path: '/scheduler' },
  { key: 'creative-style', label: 'Creative Style', path: '/creative-style' },
  { key: 'analytics', label: 'Analytics', path: '/analytics' },
  { key: 'settings', label: 'Settings', path: '/settings' },
] as const;

// ============ TIMEZONES ============
export const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Prague',
  'Europe/Bratislava',
  'Europe/Helsinki',
  'Europe/Moscow',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Singapore',
  'Australia/Sydney',
  'Pacific/Auckland',
];

// ============ SCHEDULE PRESETS ============
export const SCHEDULE_PRESETS = [
  { value: '', label: 'Custom' },
  { value: '0 */1 * * *', label: 'Every hour' },
  { value: '0 */2 * * *', label: 'Every 2 hours' },
  { value: '0 */3 * * *', label: 'Every 3 hours' },
  { value: '0 */4 * * *', label: 'Every 4 hours' },
  { value: '0 */6 * * *', label: 'Every 6 hours' },
  { value: '0 */8 * * *', label: 'Every 8 hours' },
  { value: '0 */12 * * *', label: 'Every 12 hours' },
  { value: '0 9 * * *', label: 'Once daily (9 AM)' },
  { value: '0 9,18 * * *', label: 'Twice daily (9 AM, 6 PM)' },
  { value: '0 9,13,18 * * *', label: '3x daily (9 AM, 1 PM, 6 PM)' },
];

// ============ CONTENT TYPES ============
export const CONTENT_TYPES = [
  { value: 'educational', label: 'Educational Posts', desc: 'Tips, tutorials, how-tos' },
  { value: 'promotional', label: 'Promotional', desc: 'Product features, offers' },
  { value: 'engagement', label: 'Engagement', desc: 'Questions, polls, discussions' },
  { value: 'news', label: 'News & Updates', desc: 'Industry news, trending topics' },
  { value: 'curated', label: 'Curated Content', desc: 'Shared articles, RSS feeds' },
  { value: 'storytelling', label: 'Brand Stories', desc: 'Behind-the-scenes, case studies' },
  { value: 'ugc', label: 'UGC Prompts', desc: 'Encourage user-generated content' },
];

// ============ TONE STYLES (RL dimension) ============
export const TONE_STYLES = [
  { value: 'professional', label: 'Professional', desc: 'Formal, authoritative, data-driven' },
  { value: 'casual', label: 'Casual', desc: 'Friendly, conversational, approachable' },
  { value: 'humorous', label: 'Humorous', desc: 'Witty, fun, entertaining' },
  { value: 'inspirational', label: 'Inspirational', desc: 'Motivating, uplifting, visionary' },
  { value: 'educational', label: 'Educational', desc: 'Informative, step-by-step, detailed' },
  { value: 'provocative', label: 'Provocative', desc: 'Bold, contrarian, debate-starting' },
];

// ============ HASHTAG PATTERNS (RL dimension) ============
export const HASHTAG_PATTERNS = [
  { value: 'none', label: 'No Hashtags', desc: 'Clean text, no tags' },
  { value: 'minimal', label: 'Minimal (1-2)', desc: 'Subtle, focused tags' },
  { value: 'moderate', label: 'Moderate (3-5)', desc: 'Balanced visibility' },
  { value: 'heavy', label: 'Heavy (6-10)', desc: 'Maximum discoverability' },
  { value: 'trending', label: 'Trending', desc: 'Use viral/trending tags' },
  { value: 'niche', label: 'Niche', desc: 'Industry-specific deep tags' },
  { value: 'branded', label: 'Branded', desc: 'Custom brand hashtags' },
];

// ============ VIDEO STYLES ============
export const VIDEO_STYLES = [
  { value: 'quick_tips', label: 'Quick Tips', desc: 'Fast-paced educational clips' },
  { value: 'product_demo', label: 'Product Demo', desc: 'Showcase features and benefits' },
  { value: 'storytelling', label: 'Storytelling', desc: 'Narrative-driven, emotional' },
  { value: 'behind_scenes', label: 'Behind the Scenes', desc: 'Authentic, raw, personal' },
  { value: 'testimonial', label: 'Testimonial', desc: 'Customer stories, social proof' },
  { value: 'trending', label: 'Trending/Meme', desc: 'Current trends, viral formats' },
  { value: 'explainer', label: 'Explainer', desc: 'Concept breakdowns, how-it-works' },
  { value: 'slideshow', label: 'Slideshow', desc: 'Image carousel with transitions' },
];

export const VIDEO_LENGTHS = [
  { value: 'short_5_15s', label: '5-15 seconds', desc: 'Quick hooks — TikTok, Reels, Shorts' },
  { value: 'medium_30_60s', label: '30-60 seconds', desc: 'Tips, demos, explainers' },
  { value: 'long_2_5min', label: '2-5 minutes', desc: 'Tutorials, deep dives, YouTube' },
];

export const VIDEO_FORMATS = [
  { value: 'vertical_9_16', label: 'Vertical 9:16', desc: 'TikTok, Reels, Shorts, Stories' },
  { value: 'square_1_1', label: 'Square 1:1', desc: 'Facebook, Instagram feed, LinkedIn' },
  { value: 'landscape_16_9', label: 'Landscape 16:9', desc: 'YouTube, Twitter, LinkedIn' },
];

// ============ RL DIMENSIONS (for display) ============
export const RL_DIMENSION_LABELS: Record<string, string> = {
  TIME_SLOT: 'Posting Time',
  CONTENT_TYPE: 'Content Type',
  HASHTAG_PATTERN: 'Hashtag Strategy',
  TONE_STYLE: 'Tone & Style',
};

// ============ PLATFORM REQUIREMENTS (content creation rules) ============
// Based on official API documentation from each platform (2026)
// Used to validate posts before submission and show requirements in UI

export interface PlatformRequirement {
  /** Platform display name */
  name: string;
  /** Whether media (image/video) is required — text-only posts will fail */
  mediaRequired: boolean;
  /** Whether text-only posts are supported */
  textOnly: boolean;
  /** Max character count for post text */
  maxCharacters: number;
  /** Supported media types */
  supportedMediaTypes: ('IMAGE' | 'VIDEO' | 'GIF')[];
  /** Accepted image file formats */
  imageFormats: string[];
  /** Accepted video file formats */
  videoFormats: string[];
  /** Max image file size in MB */
  maxImageSizeMB: number;
  /** Max video file size in MB */
  maxVideoSizeMB: number;
  /** Recommended image dimensions (first is preferred) */
  recommendedDimensions: { width: number; height: number; aspect: string; label: string }[];
  /** Short note about requirements shown to the user */
  note: string;
}

export const PLATFORM_REQUIREMENTS: Record<string, PlatformRequirement> = {
  FACEBOOK: {
    name: 'Facebook',
    mediaRequired: false,
    textOnly: true,
    maxCharacters: 63206,
    supportedMediaTypes: ['IMAGE', 'VIDEO', 'GIF'],
    imageFormats: ['JPEG', 'PNG', 'GIF', 'WebP'],
    videoFormats: ['MP4', 'MOV'],
    maxImageSizeMB: 8,
    maxVideoSizeMB: 1024,
    recommendedDimensions: [
      { width: 1200, height: 630, aspect: '1.91:1', label: 'Post Image' },
      { width: 1200, height: 1200, aspect: '1:1', label: 'Square' },
      { width: 1080, height: 1920, aspect: '9:16', label: 'Story/Reel' },
    ],
    note: 'Supports text, images, and videos. Posts with images get 2-3x more engagement.',
  },
  INSTAGRAM: {
    name: 'Instagram',
    mediaRequired: true,
    textOnly: false,
    maxCharacters: 2200,
    supportedMediaTypes: ['IMAGE', 'VIDEO'],
    imageFormats: ['JPEG', 'PNG'],
    videoFormats: ['MP4', 'MOV'],
    maxImageSizeMB: 8,
    maxVideoSizeMB: 100,
    recommendedDimensions: [
      { width: 1080, height: 1350, aspect: '4:5', label: 'Portrait (best)' },
      { width: 1080, height: 1080, aspect: '1:1', label: 'Square' },
      { width: 1080, height: 1920, aspect: '9:16', label: 'Reel/Story' },
      { width: 1080, height: 608, aspect: '1.91:1', label: 'Landscape' },
    ],
    note: 'Image or video REQUIRED. Text-only posts not supported. JPEG/PNG only.',
  },
  THREADS: {
    name: 'Threads',
    mediaRequired: false,
    textOnly: true,
    maxCharacters: 500,
    supportedMediaTypes: ['IMAGE', 'VIDEO'],
    imageFormats: ['JPEG', 'PNG'],
    videoFormats: ['MP4', 'MOV'],
    maxImageSizeMB: 8,
    maxVideoSizeMB: 100,
    recommendedDimensions: [
      { width: 1080, height: 1080, aspect: '1:1', label: 'Square' },
      { width: 1080, height: 1350, aspect: '4:5', label: 'Portrait' },
    ],
    note: 'Supports text-only and media posts. Max 500 characters.',
  },
  TWITTER: {
    name: 'X (Twitter)',
    mediaRequired: false,
    textOnly: true,
    maxCharacters: 280,
    supportedMediaTypes: ['IMAGE', 'VIDEO', 'GIF'],
    imageFormats: ['JPEG', 'PNG', 'GIF', 'WebP'],
    videoFormats: ['MP4', 'MOV'],
    maxImageSizeMB: 5,
    maxVideoSizeMB: 512,
    recommendedDimensions: [
      { width: 1200, height: 675, aspect: '16:9', label: 'Tweet Image' },
      { width: 1600, height: 900, aspect: '16:9', label: 'Large Image' },
    ],
    note: 'Max 280 characters. Up to 4 images or 1 video per tweet.',
  },
  LINKEDIN: {
    name: 'LinkedIn',
    mediaRequired: false,
    textOnly: true,
    maxCharacters: 3000,
    supportedMediaTypes: ['IMAGE', 'VIDEO'],
    imageFormats: ['JPEG', 'PNG', 'GIF'],
    videoFormats: ['MP4'],
    maxImageSizeMB: 10,
    maxVideoSizeMB: 200,
    recommendedDimensions: [
      { width: 1200, height: 627, aspect: '1.91:1', label: 'Post Image' },
      { width: 1200, height: 1200, aspect: '1:1', label: 'Square' },
    ],
    note: 'Professional tone recommended. Posts with images get higher engagement.',
  },
  TIKTOK: {
    name: 'TikTok',
    mediaRequired: true,
    textOnly: false,
    maxCharacters: 2200,
    supportedMediaTypes: ['IMAGE', 'VIDEO'],
    imageFormats: ['JPEG', 'PNG', 'WebP'],
    videoFormats: ['MP4', 'MOV', 'WebM'],
    maxImageSizeMB: 10,
    maxVideoSizeMB: 287,
    recommendedDimensions: [
      { width: 1080, height: 1920, aspect: '9:16', label: 'Vertical (required)' },
    ],
    note: 'Video or image REQUIRED. Vertical 9:16 format preferred. Text-only not supported.',
  },
  PINTEREST: {
    name: 'Pinterest',
    mediaRequired: true,
    textOnly: false,
    maxCharacters: 500,
    supportedMediaTypes: ['IMAGE', 'VIDEO'],
    imageFormats: ['JPEG', 'PNG'],
    videoFormats: ['MP4', 'MOV'],
    maxImageSizeMB: 20,
    maxVideoSizeMB: 2048,
    recommendedDimensions: [
      { width: 1000, height: 1500, aspect: '2:3', label: 'Standard Pin' },
      { width: 1000, height: 1000, aspect: '1:1', label: 'Square Pin' },
    ],
    note: 'Image REQUIRED. 2:3 vertical pins perform best. Text-only not supported.',
  },
  YOUTUBE: {
    name: 'YouTube',
    mediaRequired: true,
    textOnly: false,
    maxCharacters: 5000,
    supportedMediaTypes: ['VIDEO'],
    imageFormats: [],
    videoFormats: ['MP4', 'MOV', 'AVI', 'WMV', 'FLV', 'WebM'],
    maxImageSizeMB: 2,
    maxVideoSizeMB: 12288,
    recommendedDimensions: [
      { width: 1920, height: 1080, aspect: '16:9', label: 'Full HD' },
      { width: 1080, height: 1920, aspect: '9:16', label: 'Shorts' },
    ],
    note: 'Video REQUIRED. Supports Shorts (9:16) and regular videos (16:9).',
  },
  MASTODON: {
    name: 'Mastodon',
    mediaRequired: false,
    textOnly: true,
    maxCharacters: 500,
    supportedMediaTypes: ['IMAGE', 'VIDEO', 'GIF'],
    imageFormats: ['JPEG', 'PNG', 'GIF', 'WebP'],
    videoFormats: ['MP4', 'WebM'],
    maxImageSizeMB: 8,
    maxVideoSizeMB: 40,
    recommendedDimensions: [
      { width: 1200, height: 675, aspect: '16:9', label: 'Post Image' },
    ],
    note: 'Max 500 characters. Supports text, images, video, and GIFs.',
  },
  BLUESKY: {
    name: 'Bluesky',
    mediaRequired: false,
    textOnly: true,
    maxCharacters: 300,
    supportedMediaTypes: ['IMAGE'],
    imageFormats: ['JPEG', 'PNG'],
    videoFormats: [],
    maxImageSizeMB: 1,
    maxVideoSizeMB: 0,
    recommendedDimensions: [
      { width: 1200, height: 675, aspect: '16:9', label: 'Post Image' },
    ],
    note: 'Max 300 characters. Images only (max 1MB). No video support.',
  },
  TELEGRAM: {
    name: 'Telegram',
    mediaRequired: false,
    textOnly: true,
    maxCharacters: 4096,
    supportedMediaTypes: ['IMAGE', 'VIDEO', 'GIF'],
    imageFormats: ['JPEG', 'PNG', 'GIF', 'WebP'],
    videoFormats: ['MP4'],
    maxImageSizeMB: 10,
    maxVideoSizeMB: 50,
    recommendedDimensions: [
      { width: 1280, height: 720, aspect: '16:9', label: 'Photo' },
      { width: 1080, height: 1080, aspect: '1:1', label: 'Square' },
    ],
    note: 'Supports text, photos, videos, and GIFs. Markdown formatting supported.',
  },
  DISCORD: {
    name: 'Discord',
    mediaRequired: false,
    textOnly: true,
    maxCharacters: 2000,
    supportedMediaTypes: ['IMAGE', 'VIDEO', 'GIF'],
    imageFormats: ['JPEG', 'PNG', 'GIF', 'WebP'],
    videoFormats: ['MP4', 'WebM', 'MOV'],
    maxImageSizeMB: 8,
    maxVideoSizeMB: 8,
    recommendedDimensions: [
      { width: 1200, height: 675, aspect: '16:9', label: 'Embed Image' },
    ],
    note: 'Max 2000 characters. Supports embeds, images, and short videos.',
  },
  REDDIT: {
    name: 'Reddit',
    mediaRequired: false,
    textOnly: true,
    maxCharacters: 40000,
    supportedMediaTypes: ['IMAGE', 'VIDEO', 'GIF'],
    imageFormats: ['JPEG', 'PNG', 'GIF'],
    videoFormats: ['MP4'],
    maxImageSizeMB: 20,
    maxVideoSizeMB: 1024,
    recommendedDimensions: [
      { width: 1200, height: 628, aspect: '1.91:1', label: 'Link Preview' },
    ],
    note: 'Supports text, image, video, and link posts. Check subreddit rules.',
  },
  MEDIUM: {
    name: 'Medium',
    mediaRequired: false,
    textOnly: true,
    maxCharacters: 100000,
    supportedMediaTypes: ['IMAGE'],
    imageFormats: ['JPEG', 'PNG', 'GIF'],
    videoFormats: [],
    maxImageSizeMB: 5,
    maxVideoSizeMB: 0,
    recommendedDimensions: [
      { width: 1400, height: 788, aspect: '16:9', label: 'Featured Image' },
    ],
    note: 'Long-form content platform. Featured image recommended.',
  },
  DEVTO: {
    name: 'Dev.to',
    mediaRequired: false,
    textOnly: true,
    maxCharacters: 100000,
    supportedMediaTypes: ['IMAGE'],
    imageFormats: ['JPEG', 'PNG'],
    videoFormats: [],
    maxImageSizeMB: 5,
    maxVideoSizeMB: 0,
    recommendedDimensions: [
      { width: 1000, height: 420, aspect: '2.38:1', label: 'Cover Image' },
    ],
    note: 'Developer-focused platform. Markdown supported. Cover image recommended.',
  },
  NOSTR: {
    name: 'Nostr',
    mediaRequired: false,
    textOnly: true,
    maxCharacters: 10000,
    supportedMediaTypes: ['IMAGE'],
    imageFormats: ['JPEG', 'PNG', 'GIF', 'WebP'],
    videoFormats: [],
    maxImageSizeMB: 5,
    maxVideoSizeMB: 0,
    recommendedDimensions: [
      { width: 1200, height: 675, aspect: '16:9', label: 'Post Image' },
    ],
    note: 'Decentralized protocol. Text notes with optional image attachments.',
  },
  MOLTBOOK: {
    name: 'Moltbook',
    mediaRequired: false,
    textOnly: true,
    maxCharacters: 5000,
    supportedMediaTypes: ['IMAGE', 'GIF'],
    imageFormats: ['JPEG', 'PNG', 'GIF'],
    videoFormats: [],
    maxImageSizeMB: 8,
    maxVideoSizeMB: 0,
    recommendedDimensions: [
      { width: 1200, height: 630, aspect: '1.91:1', label: 'Post Image' },
      { width: 1080, height: 1080, aspect: '1:1', label: 'Square' },
    ],
    note: 'Supports text and image posts.',
  },
};

// ============ ALL PLATFORM TYPES (for filters) ============
export const ALL_PLATFORMS = [
  'FACEBOOK', 'INSTAGRAM', 'TWITTER', 'LINKEDIN', 'TIKTOK',
  'MASTODON', 'BLUESKY', 'TELEGRAM', 'DISCORD', 'THREADS',
  'PINTEREST', 'REDDIT', 'MEDIUM', 'DEVTO', 'YOUTUBE', 'NOSTR', 'MOLTBOOK',
] as const;

// ============ ACTION TYPES (for filters) ============
export const ACTION_TYPES = [
  'POST', 'REPLY', 'FAVOURITE', 'BOOST', 'SCAN_FEEDS',
  'COLLECT_METRICS', 'GENERATE_CONTENT', 'GENERATE_IMAGE', 'GENERATE_VIDEO',
  'SAFETY_BLOCK', 'BAN_DETECTED', 'SEND_EMAIL', 'GENERATE_EMAIL',
] as const;

// ============ EMAIL MARKETING ============

export const EMAIL_PROVIDERS = [
  { value: 'GOOGLE', label: 'Google Workspace / Gmail', host: 'smtp.gmail.com', port: 587, secure: false, dailyLimit: 2000 },
  { value: 'MICROSOFT', label: 'Microsoft 365 / Outlook', host: 'smtp.office365.com', port: 587, secure: false, dailyLimit: 10000 },
  { value: 'SENDGRID', label: 'SendGrid', host: 'smtp.sendgrid.net', port: 587, secure: false, dailyLimit: 50000 },
  { value: 'MAILGUN', label: 'Mailgun', host: 'smtp.mailgun.org', port: 587, secure: false, dailyLimit: 50000 },
  { value: 'AMAZON_SES', label: 'Amazon SES', host: '', port: 587, secure: false, dailyLimit: 50000 },
  { value: 'POSTMARK', label: 'Postmark', host: 'smtp.postmarkapp.com', port: 587, secure: false, dailyLimit: 10000 },
  { value: 'CUSTOM', label: 'Custom SMTP Server', host: '', port: 587, secure: false, dailyLimit: 500 },
] as const;

export const CAMPAIGN_STATUS_CONFIG: Record<string, {
  variant: 'success' | 'warning' | 'destructive' | 'secondary' | 'default';
  label: string;
}> = {
  DRAFT: { variant: 'secondary', label: 'Draft' },
  SCHEDULED: { variant: 'default', label: 'Scheduled' },
  SENDING: { variant: 'warning', label: 'Sending' },
  SENT: { variant: 'success', label: 'Sent' },
  PAUSED: { variant: 'secondary', label: 'Paused' },
  CANCELLED: { variant: 'secondary', label: 'Cancelled' },
  FAILED: { variant: 'destructive', label: 'Failed' },
};

export const CONTACT_STATUS_CONFIG: Record<string, {
  variant: 'success' | 'warning' | 'destructive' | 'secondary';
  label: string;
}> = {
  ACTIVE: { variant: 'success', label: 'Active' },
  UNSUBSCRIBED: { variant: 'secondary', label: 'Unsubscribed' },
  BOUNCED: { variant: 'destructive', label: 'Bounced' },
  COMPLAINED: { variant: 'destructive', label: 'Complained' },
};

export const EMAIL_DELIVERABILITY_THRESHOLDS = {
  deliverabilityRate: { good: 95, warning: 90 },
  openRate: { good: 15, warning: 10 },
  clickRate: { good: 2, warning: 1 },
  bounceRate: { bad: 5, warning: 3 },
  spamRate: { bad: 0.1, warning: 0.05 },
} as const;
