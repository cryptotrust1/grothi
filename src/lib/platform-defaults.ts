// Per-platform content strategy defaults based on top marketing best practices (2025-2026)
// These are pre-filled when a user connects a platform and can be customized.

export interface PlatformDefault {
  dailyTexts: number;
  dailyImages: number;
  dailyVideos: number;
  dailyStories: number;
  videoLength: string | null;
  videoFormat: string | null;
  videoStyle: string | null;
  hashtagOverride: string | null;
  postingHours: number[];
  tip: string;
  videoSupported: boolean;
  storiesSupported: boolean;
  // For weekly platforms (Medium, Dev.to) — postsPerWeek instead of daily
  weeklyMode?: boolean;
  postsPerWeek?: number;
}

/**
 * Marketing best-practice defaults per platform.
 *
 * Sources: HubSpot, Hootsuite, Sprout Social, Buffer, Later, SocialBee research (2025-2026).
 *
 * Key principles applied:
 * - Facebook: Video-first (Reels). Links in body kill reach. 1-2 posts/day optimal.
 * - Instagram: Reels get 2-3x reach over static. 3-7 Stories/day. Carousels for saves.
 * - Twitter/X: High-volume text. 3-5 tweets/day. Threads outperform single tweets.
 * - LinkedIn: 1-2 posts/day max. Text-only or document posts outperform links. Dwell time matters.
 * - TikTok: 1-3 videos/day. First 3 seconds = hook. Watch completion is #1 factor.
 * - YouTube: 1 long video/week + 3-5 Shorts/week. Consistency > frequency.
 * - Pinterest: 3-5 pins/day. Vertical 2:3. Keywords in description = SEO critical.
 * - Threads: Text-first. 2-3/day. Conversation starters work best. No hashtags yet.
 * - Reddit: 1 genuine post/day max. >10% self-promo = spam filters.
 * - Telegram: 2-3/day. Rich media gets 2x engagement vs text.
 * - Discord: 2-3 messages/day. Embeds with images perform better.
 * - Medium: 1-2 articles/week. 7-10 min read optimal. Tags matter.
 * - Dev.to: 1-2 articles/week. "How I built" posts = highest engagement.
 * - Mastodon: Chronological, no algorithm. 2-3/day. Boosts = reach.
 * - Bluesky: Chronological. 3-5/day. Custom feeds amplify reach.
 * - Nostr: Decentralized. 2-3 notes/day. Relay selection matters.
 */
export const PLATFORM_DEFAULTS: Record<string, PlatformDefault> = {
  FACEBOOK: {
    dailyTexts: 1,
    dailyImages: 1,
    dailyVideos: 1,
    dailyStories: 1,
    videoLength: 'medium_30_60s',
    videoFormat: 'landscape_16_9',
    videoStyle: 'quick_tips',
    hashtagOverride: 'minimal',
    postingHours: [9, 13, 16],
    tip: 'Video (especially Reels) gets the most reach. Links in post body reduce reach 70-80% — the bot puts links in the first comment instead.',
    videoSupported: true,
    storiesSupported: true,
  },
  INSTAGRAM: {
    dailyTexts: 0,
    dailyImages: 1,
    dailyVideos: 1,
    dailyStories: 2,
    videoLength: 'short_5_15s',
    videoFormat: 'vertical_9_16',
    videoStyle: 'quick_tips',
    hashtagOverride: 'heavy',
    postingHours: [8, 11, 14, 17],
    tip: 'Reels get 2-3x more reach than static posts. Carousels have the highest save rate. Post 3-7 Stories/day to stay visible in the Stories bar.',
    videoSupported: true,
    storiesSupported: true,
  },
  TWITTER: {
    dailyTexts: 3,
    dailyImages: 1,
    dailyVideos: 0,
    dailyStories: 0,
    videoLength: 'short_5_15s',
    videoFormat: 'landscape_16_9',
    videoStyle: null,
    hashtagOverride: 'minimal',
    postingHours: [8, 12, 17, 21],
    tip: 'Text tweets with bold takes perform best. Threads outperform single tweets for impressions. Replies and quote tweets drive more visibility than standalone posts.',
    videoSupported: true,
    storiesSupported: false,
  },
  LINKEDIN: {
    dailyTexts: 1,
    dailyImages: 1,
    dailyVideos: 1,
    dailyStories: 0,
    videoLength: 'medium_30_60s',
    videoFormat: 'landscape_16_9',
    videoStyle: 'explainer',
    hashtagOverride: 'moderate',
    postingHours: [7, 10, 12],
    tip: 'Text-only posts outperform link posts. Dwell time (how long people read) boosts reach significantly. Document (carousel) posts get 3x engagement. Post weekdays only.',
    videoSupported: true,
    storiesSupported: false,
  },
  TIKTOK: {
    dailyTexts: 0,
    dailyImages: 0,
    dailyVideos: 2,
    dailyStories: 0,
    videoLength: 'short_5_15s',
    videoFormat: 'vertical_9_16',
    videoStyle: 'trending',
    hashtagOverride: 'heavy',
    postingHours: [7, 10, 19, 22],
    tip: 'Watch time is the #1 ranking factor. The first 3 seconds determine performance. Post 1-3 videos/day. Use trending sounds and hooks.',
    videoSupported: true,
    storiesSupported: false,
  },
  YOUTUBE: {
    dailyTexts: 0,
    dailyImages: 0,
    dailyVideos: 1,
    dailyStories: 1,
    videoLength: 'long_2_5min',
    videoFormat: 'landscape_16_9',
    videoStyle: 'explainer',
    hashtagOverride: 'moderate',
    postingHours: [12, 15, 17],
    tip: 'Consistency matters more than frequency. 1 long video/week + 3-5 Shorts/week is ideal. Community posts boost channel visibility. Shorts uses the same algorithm as TikTok.',
    videoSupported: true,
    storiesSupported: true,
  },
  PINTEREST: {
    dailyTexts: 0,
    dailyImages: 3,
    dailyVideos: 1,
    dailyStories: 0,
    videoLength: 'short_5_15s',
    videoFormat: 'vertical_9_16',
    videoStyle: 'slideshow',
    hashtagOverride: 'heavy',
    postingHours: [14, 20, 21],
    tip: 'Vertical images (2:3) perform best. Keywords in pin description are critical for SEO — Pinterest is a search engine. Idea Pins (video) get prioritized in feed.',
    videoSupported: true,
    storiesSupported: false,
  },
  THREADS: {
    dailyTexts: 2,
    dailyImages: 1,
    dailyVideos: 0,
    dailyStories: 0,
    videoLength: null,
    videoFormat: null,
    videoStyle: null,
    hashtagOverride: 'none',
    postingHours: [8, 12, 17],
    tip: 'Conversation starters and hot takes drive the most replies. Cross-posting from Instagram boosts visibility. No hashtag support yet — focus on engaging text.',
    videoSupported: false,
    storiesSupported: false,
  },
  REDDIT: {
    dailyTexts: 1,
    dailyImages: 0,
    dailyVideos: 0,
    dailyStories: 0,
    videoLength: null,
    videoFormat: null,
    videoStyle: null,
    hashtagOverride: 'none',
    postingHours: [6, 8, 12],
    tip: 'Self-promotion over 10% of posts triggers spam filters. Provide genuine value first. Text posts and image posts get the most upvotes. Follow subreddit rules strictly.',
    videoSupported: false,
    storiesSupported: false,
  },
  TELEGRAM: {
    dailyTexts: 2,
    dailyImages: 1,
    dailyVideos: 0,
    dailyStories: 0,
    videoLength: null,
    videoFormat: null,
    videoStyle: null,
    hashtagOverride: 'none',
    postingHours: [9, 12, 18],
    tip: 'Rich media (photos, videos) get 2x more engagement than text-only messages. Keep messages concise. Polls drive interaction.',
    videoSupported: false,
    storiesSupported: false,
  },
  DISCORD: {
    dailyTexts: 2,
    dailyImages: 1,
    dailyVideos: 0,
    dailyStories: 0,
    videoLength: null,
    videoFormat: null,
    videoStyle: null,
    hashtagOverride: 'none',
    postingHours: [14, 18, 21],
    tip: 'Embeds with images perform better than plain text. Use threads for longer discussions. Rich embeds with previews get more clicks.',
    videoSupported: false,
    storiesSupported: false,
  },
  MEDIUM: {
    dailyTexts: 0,
    dailyImages: 1,
    dailyVideos: 0,
    dailyStories: 0,
    videoLength: null,
    videoFormat: null,
    videoStyle: null,
    hashtagOverride: 'none',
    postingHours: [7, 10],
    tip: 'Long-form articles (7-10 min read) perform best. Tags are crucial for distribution. Publish 1-2 quality articles per week rather than daily short posts.',
    videoSupported: false,
    storiesSupported: false,
    weeklyMode: true,
    postsPerWeek: 2,
  },
  DEVTO: {
    dailyTexts: 0,
    dailyImages: 1,
    dailyVideos: 0,
    dailyStories: 0,
    videoLength: null,
    videoFormat: null,
    videoStyle: null,
    hashtagOverride: 'moderate',
    postingHours: [8, 14],
    tip: 'Technical tutorials and "how I built" posts drive the highest engagement. Use relevant tags. 1-2 articles per week is ideal. Cross-post from your blog with canonical URLs.',
    videoSupported: false,
    storiesSupported: false,
    weeklyMode: true,
    postsPerWeek: 2,
  },
  MASTODON: {
    dailyTexts: 2,
    dailyImages: 1,
    dailyVideos: 0,
    dailyStories: 0,
    videoLength: null,
    videoFormat: null,
    videoStyle: null,
    hashtagOverride: 'moderate',
    postingHours: [8, 12, 18],
    tip: 'No algorithm — chronological feed only. Boosts (retoots) are the only way to extend reach. Use hashtags — they are the main discovery mechanism. Alt text on images is culturally important.',
    videoSupported: false,
    storiesSupported: false,
  },
  BLUESKY: {
    dailyTexts: 3,
    dailyImages: 1,
    dailyVideos: 0,
    dailyStories: 0,
    videoLength: null,
    videoFormat: null,
    videoStyle: null,
    hashtagOverride: 'none',
    postingHours: [8, 12, 17],
    tip: 'Custom feed generators can amplify reach. Engage with existing communities. The platform rewards early adopters and consistent posters. No hashtag system — discovery via feeds.',
    videoSupported: false,
    storiesSupported: false,
  },
  NOSTR: {
    dailyTexts: 2,
    dailyImages: 0,
    dailyVideos: 0,
    dailyStories: 0,
    videoLength: null,
    videoFormat: null,
    videoStyle: null,
    hashtagOverride: 'none',
    postingHours: [9, 14, 20],
    tip: 'Decentralized with no algorithm. Relay selection affects who sees your notes. Zaps (Lightning tips) drive engagement. Focus on niche communities.',
    videoSupported: false,
    storiesSupported: false,
  },
};
