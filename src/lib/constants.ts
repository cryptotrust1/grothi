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
  'SAFETY_BLOCK', 'BAN_DETECTED',
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
