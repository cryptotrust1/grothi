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
  { key: 'activity', label: 'Activity', path: '/activity' },
  { key: 'platforms', label: 'Platforms', path: '/platforms' },
  { key: 'media', label: 'Media', path: '/media' },
  { key: 'scheduler', label: 'Scheduler', path: '/scheduler' },
  { key: 'image-style', label: 'Image Style', path: '/image-style' },
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

// ============ ALL PLATFORM TYPES (for filters) ============
export const ALL_PLATFORMS = [
  'FACEBOOK', 'INSTAGRAM', 'TWITTER', 'LINKEDIN', 'TIKTOK',
  'MASTODON', 'BLUESKY', 'TELEGRAM', 'DISCORD', 'THREADS',
  'PINTEREST', 'REDDIT', 'MEDIUM', 'DEVTO', 'YOUTUBE', 'NOSTR', 'MOLTBOOK',
] as const;

// ============ ACTION TYPES (for filters) ============
export const ACTION_TYPES = [
  'POST', 'REPLY', 'FAVOURITE', 'BOOST', 'SCAN_FEEDS',
  'COLLECT_METRICS', 'GENERATE_CONTENT', 'SAFETY_BLOCK',
] as const;
