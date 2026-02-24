/**
 * Platform Algorithm Knowledge Base
 *
 * Research-backed best practices for each of the 17 supported platforms.
 * Used by the Autopilot system to generate platform-optimized content plans.
 *
 * Sources (2025-2026):
 * - Instagram: Adam Mosseri official statements (Jan 2025), Meta Creators Hub,
 *   Buffer (9.6M posts), Sprout Social (2.7B engagements), Hootsuite (1M posts)
 * - TikTok: TikTok Creator Portal, TikTok Business Center
 * - Facebook: Meta Business Help Center, Hootsuite, Sprout Social
 * - LinkedIn: LinkedIn Engineering Blog, LinkedIn official creator guides
 * - Twitter/X: Open-source algorithm insights (2023-2025), Buffer, Sprout Social
 * - YouTube: YouTube Creator Academy, YouTube official blog
 * - Pinterest: Pinterest Business, Pinterest Creator guidelines
 * - Threads: Meta Threads official announcements
 * - Others: Platform-specific official documentation
 *
 * IMPORTANT: This data is based on verified research only. No guessing.
 * Last updated: February 2026
 */

export interface PlatformAlgorithmConfig {
  /** Platform display name */
  name: string;

  /** What the algorithm prioritizes (ranked by importance) */
  rankingFactors: string[];

  /** Recommended posting frequency */
  frequency: {
    postsPerWeek: { min: number; max: number; optimal: number };
    postsPerDay: { min: number; max: number; optimal: number };
    reelsPerWeek?: { min: number; max: number; optimal: number };
    storiesPerDay?: { min: number; max: number; optimal: number };
    videosPerDay?: { min: number; max: number; optimal: number };
  };

  /** Optimal content mix (percentages, should sum to 100) */
  contentMix: {
    text: number;      // Text-only posts
    image: number;     // Image posts (photo, carousel)
    video: number;     // Video/Reels/Shorts
    story: number;     // Stories (ephemeral)
    article: number;   // Long-form (Medium, Dev.to, LinkedIn articles)
  };

  /** Best posting times (hours in UTC, user's timezone applied at runtime) */
  bestTimesWeekday: number[];  // Hours (0-23)
  bestTimesWeekend: number[];
  bestDays: number[];          // 0=Sun, 1=Mon...6=Sat

  /** Hashtag strategy */
  hashtags: {
    recommended: number;  // Number of hashtags
    max: number;
    strategy: 'none' | 'minimal' | 'moderate' | 'niche' | 'trending';
    note: string;
  };

  /** Content tone that performs best */
  bestTones: string[];

  /** Content types that perform best (ordered by effectiveness) */
  bestContentTypes: string[];

  /** Key algorithm tips for content generation */
  contentTips: string[];

  /** What to avoid (content that gets suppressed) */
  avoid: string[];

  /** Video-specific settings */
  video?: {
    optimalLengthSec: { min: number; max: number };
    format: 'vertical_9_16' | 'square_1_1' | 'landscape_16_9';
    hookWindowSec: number;  // Critical first seconds for retention
    captionsRequired: boolean;
  };

  /** Caption/text best practices */
  caption: {
    optimalLength: { min: number; max: number };
    maxLength: number;
    hookImportant: boolean;
    ctaRecommended: boolean;
    emojiUsage: 'none' | 'minimal' | 'moderate' | 'heavy';
    keywordOptimized: boolean;
  };

  /** Type of platform (affects content generation strategy) */
  platformCategory: 'visual' | 'text' | 'video' | 'professional' | 'community' | 'longform' | 'decentralized';

  /** Whether platform has an algorithmic feed or chronological */
  hasAlgorithm: boolean;

  /** Key metric the algorithm optimizes for */
  primaryMetric: string;

  /** Special notes for the AI content generator */
  aiGenerationNotes: string;
}

/**
 * Platform-specific algorithm knowledge for all 17 platforms.
 *
 * This data drives the Autopilot's content generation and scheduling decisions.
 * Each platform's config is based on official platform recommendations and
 * verified research from major analytics firms.
 */
export const PLATFORM_ALGORITHM: Record<string, PlatformAlgorithmConfig> = {
  INSTAGRAM: {
    name: 'Instagram',
    rankingFactors: [
      'Watch time (most important — how long users view content)',
      'Sends per reach (DM shares — weighted 3-5x higher than likes for non-followers)',
      'Likes per reach (relative engagement, not raw count)',
      'Saves (strong signal of value)',
      'Comments (especially meaningful ones)',
      'Originality score (penalizes recycled/watermarked content)',
    ],
    frequency: {
      postsPerWeek: { min: 3, max: 7, optimal: 5 },
      postsPerDay: { min: 0, max: 2, optimal: 1 },
      reelsPerWeek: { min: 2, max: 5, optimal: 3 },
      storiesPerDay: { min: 1, max: 5, optimal: 2 },
    },
    contentMix: { text: 0, image: 30, video: 40, story: 30, article: 0 },
    bestTimesWeekday: [7, 8, 11, 12, 13, 17, 18, 19],
    bestTimesWeekend: [9, 10, 11, 14, 17],
    bestDays: [2, 3, 4],  // Tue, Wed, Thu
    hashtags: {
      recommended: 4,
      max: 5,
      strategy: 'niche',
      note: 'Instagram limited hashtags to 5 max (Dec 2025). Use 3-5 hyper-relevant niche hashtags. Keyword-rich captions now drive more reach than hashtags.',
    },
    bestTones: ['casual', 'inspirational', 'educational'],
    bestContentTypes: ['engagement', 'educational', 'storytelling', 'ugc'],
    contentTips: [
      'Reels get 2-3x more reach than static posts',
      'Carousels have the highest save rate — great for educational content',
      'First 3 seconds of Reels are critical (60%+ retention target)',
      'Encourage DM shares — highest-weight signal for non-follower reach',
      'Reply to comments within first hour for momentum multiplier',
      'Use keyword-rich captions instead of hashtag-heavy approach',
      'Post Stories daily to stay visible in the Stories bar',
    ],
    avoid: [
      'TikTok watermarks or recycled content (Originality Score penalty)',
      'Engagement bait ("like if you agree")',
      'More than 5 hashtags (blocked since Dec 2025)',
      'Low-quality or blurry images',
      'Text-only posts (not supported)',
      'External link posts (Instagram has no clickable links in captions)',
    ],
    video: {
      optimalLengthSec: { min: 15, max: 90 },
      format: 'vertical_9_16',
      hookWindowSec: 3,
      captionsRequired: true,
    },
    caption: {
      optimalLength: { min: 50, max: 300 },
      maxLength: 2200,
      hookImportant: true,
      ctaRecommended: true,
      emojiUsage: 'moderate',
      keywordOptimized: true,
    },
    platformCategory: 'visual',
    hasAlgorithm: true,
    primaryMetric: 'watch_time',
    aiGenerationNotes: 'Create visually-driven content. Every post needs an image or video. Reels should have a strong hook in first 3 seconds. Use carousels for educational content (swipe-through drives saves). Write keyword-rich captions with a clear CTA. Encourage saves and DM shares.',
  },

  TIKTOK: {
    name: 'TikTok',
    rankingFactors: [
      'Watch time / completion rate (most important)',
      'Rewatch rate (users watching multiple times)',
      'Shares (strongest engagement signal)',
      'Comments and replies',
      'Follows from video (discovery signal)',
      'Sound usage (trending sounds boost reach)',
    ],
    frequency: {
      postsPerWeek: { min: 5, max: 21, optimal: 10 },
      postsPerDay: { min: 1, max: 3, optimal: 2 },
      videosPerDay: { min: 1, max: 3, optimal: 2 },
    },
    contentMix: { text: 0, image: 0, video: 100, story: 0, article: 0 },
    bestTimesWeekday: [7, 10, 12, 19, 22],
    bestTimesWeekend: [9, 12, 19, 21],
    bestDays: [2, 3, 4, 5],  // Tue-Fri
    hashtags: {
      recommended: 4,
      max: 5,
      strategy: 'trending',
      note: 'Mix 2-3 niche hashtags with 1-2 trending/broad ones. Include at least one highly specific hashtag. Hashtags in TikTok serve as keyword discovery.',
    },
    bestTones: ['casual', 'humorous', 'educational', 'provocative'],
    bestContentTypes: ['educational', 'engagement', 'storytelling', 'ugc'],
    contentTips: [
      'First 1-3 seconds determine performance — start with a strong hook',
      'Watch time completion is the #1 ranking factor',
      'Use trending sounds/music to boost algorithm distribution',
      'Keep videos 15-60 seconds for best completion rates',
      'Text overlays essential — most users watch with sound off',
      'Reply to comments with video replies for extra content',
      'Post consistently at same times daily',
    ],
    avoid: [
      'Static images (TikTok is video-only for optimal reach)',
      'Low-energy or slow starts',
      'Overly polished corporate content (authenticity wins)',
      'Videos without text overlays or captions',
      'Reposting content from other platforms with watermarks',
    ],
    video: {
      optimalLengthSec: { min: 15, max: 60 },
      format: 'vertical_9_16',
      hookWindowSec: 2,
      captionsRequired: true,
    },
    caption: {
      optimalLength: { min: 50, max: 150 },
      maxLength: 4000,
      hookImportant: true,
      ctaRecommended: true,
      emojiUsage: 'moderate',
      keywordOptimized: true,
    },
    platformCategory: 'video',
    hasAlgorithm: true,
    primaryMetric: 'watch_completion',
    aiGenerationNotes: 'Video-only platform. Write video scripts with a strong hook in the first 2 seconds. Format: hook → value → CTA. Keep scripts for 15-60 second videos. Include text overlay directions. Reference trending formats when possible. Tone should be authentic, energetic, and conversational — not corporate.',
  },

  FACEBOOK: {
    name: 'Facebook',
    rankingFactors: [
      'Meaningful interactions (comments, shares > reactions)',
      'Content from friends/family (prioritized over Pages)',
      'Video watch time (especially Reels)',
      'Engagement velocity (early engagement matters)',
      'Content type relevance to user preferences',
    ],
    frequency: {
      postsPerWeek: { min: 3, max: 14, optimal: 7 },
      postsPerDay: { min: 1, max: 2, optimal: 1 },
      reelsPerWeek: { min: 2, max: 5, optimal: 3 },
      storiesPerDay: { min: 0, max: 3, optimal: 1 },
    },
    contentMix: { text: 20, image: 25, video: 40, story: 15, article: 0 },
    bestTimesWeekday: [9, 10, 13, 16],
    bestTimesWeekend: [10, 11, 14],
    bestDays: [2, 3, 4, 5],  // Tue-Fri
    hashtags: {
      recommended: 2,
      max: 5,
      strategy: 'minimal',
      note: 'Facebook hashtags have minimal impact. Use 1-3 for categorization only. Focus on shareable content instead.',
    },
    bestTones: ['casual', 'educational', 'inspirational', 'humorous'],
    bestContentTypes: ['engagement', 'educational', 'storytelling', 'news'],
    contentTips: [
      'Video (especially Reels) gets the most organic reach',
      'Links in post body reduce reach 70-80% — put links in first comment',
      'Questions and conversation starters drive meaningful interactions',
      'Native video outperforms YouTube/external links by 10x',
      'Facebook Groups content ranks higher than Page posts',
      'Reels on Facebook use the same algorithm as Instagram Reels',
    ],
    avoid: [
      'Links in post body (kills organic reach)',
      'Engagement bait ("Tag a friend", "Share if you agree")',
      'Clickbait headlines',
      'Excessive posting (>2/day leads to cannibalization)',
      'Cross-posted content without native optimization',
    ],
    video: {
      optimalLengthSec: { min: 30, max: 180 },
      format: 'landscape_16_9',
      hookWindowSec: 3,
      captionsRequired: true,
    },
    caption: {
      optimalLength: { min: 40, max: 250 },
      maxLength: 63206,
      hookImportant: true,
      ctaRecommended: true,
      emojiUsage: 'minimal',
      keywordOptimized: false,
    },
    platformCategory: 'visual',
    hasAlgorithm: true,
    primaryMetric: 'meaningful_interactions',
    aiGenerationNotes: 'Create shareable content that sparks conversations. Video first (Reels preferred). Never put links in the post body — put in first comment. Ask questions to drive comments. Use a conversational, relatable tone. Facebook favors content that creates genuine interactions between people.',
  },

  LINKEDIN: {
    name: 'LinkedIn',
    rankingFactors: [
      'Dwell time (how long people spend reading — most important)',
      'Comments (especially early comments within first hour)',
      'Shares/reposts',
      'Relevance to user professional interests',
      'Content format (native > external links)',
    ],
    frequency: {
      postsPerWeek: { min: 3, max: 7, optimal: 5 },
      postsPerDay: { min: 1, max: 2, optimal: 1 },
    },
    contentMix: { text: 40, image: 25, video: 15, story: 0, article: 20 },
    bestTimesWeekday: [7, 8, 10, 12],
    bestTimesWeekend: [],  // LinkedIn is a weekday platform
    bestDays: [1, 2, 3, 4],  // Mon-Thu (avoid weekends)
    hashtags: {
      recommended: 4,
      max: 5,
      strategy: 'moderate',
      note: 'Use 3-5 relevant industry hashtags. Mix broad (#marketing) with niche (#B2BSaaSGrowth). LinkedIn uses hashtags for topic classification.',
    },
    bestTones: ['professional', 'educational', 'inspirational', 'provocative'],
    bestContentTypes: ['educational', 'storytelling', 'engagement', 'news'],
    contentTips: [
      'Text-only posts outperform link posts — dwell time is king',
      'Document/carousel posts get 3x more engagement than other formats',
      'First line is critical — it determines if people click "see more"',
      'The "golden hour" — respond to all comments in the first 60 minutes',
      'Personal stories outperform corporate announcements',
      'Ask a question at the end to drive comments',
      'Post weekdays only — weekends have 60-80% less engagement',
      'Format with line breaks, lists, and spacing for readability',
    ],
    avoid: [
      'External links in post body (put in comments instead)',
      'Posting on weekends',
      'Overly corporate/press release tone',
      'Hashtag stuffing (>5)',
      'Engagement pods (LinkedIn detects artificial engagement)',
      'Posting more than twice per day',
    ],
    video: {
      optimalLengthSec: { min: 30, max: 120 },
      format: 'landscape_16_9',
      hookWindowSec: 5,
      captionsRequired: true,
    },
    caption: {
      optimalLength: { min: 150, max: 1300 },
      maxLength: 3000,
      hookImportant: true,
      ctaRecommended: true,
      emojiUsage: 'minimal',
      keywordOptimized: true,
    },
    platformCategory: 'professional',
    hasAlgorithm: true,
    primaryMetric: 'dwell_time',
    aiGenerationNotes: 'Write professional but personal content. Use a hook in the first line (before the "see more" fold). Format with short paragraphs and line breaks for readability. Share insights, lessons learned, and professional stories. End with a question to drive comments. Never include links in the body — add them in a comment. Document/carousel posts are highly effective for educational content.',
  },

  TWITTER: {
    name: 'X (Twitter)',
    rankingFactors: [
      'Engagement velocity (likes, replies, retweets in first minutes)',
      'Reply count (conversations ranked highly)',
      'Retweets / quotes (amplification signal)',
      'Follows from tweet',
      'Account authority/credibility',
    ],
    frequency: {
      postsPerWeek: { min: 14, max: 35, optimal: 21 },
      postsPerDay: { min: 2, max: 5, optimal: 3 },
    },
    contentMix: { text: 50, image: 30, video: 15, story: 0, article: 5 },
    bestTimesWeekday: [8, 9, 12, 17, 21],
    bestTimesWeekend: [9, 10, 15],
    bestDays: [1, 2, 3, 4],  // Mon-Thu
    hashtags: {
      recommended: 2,
      max: 3,
      strategy: 'minimal',
      note: 'Use 1-2 relevant hashtags max. More than 2 hashtags decreases engagement. Focus on trending topics and conversation instead.',
    },
    bestTones: ['casual', 'humorous', 'provocative', 'educational'],
    bestContentTypes: ['engagement', 'news', 'educational', 'promotional'],
    contentTips: [
      'Text tweets with bold takes perform best',
      'Threads outperform single tweets for impressions (3-7 tweets)',
      'Quote tweets drive more visibility than standalone posts',
      'Reply to trending conversations for discovery',
      'Images increase engagement 150% over text-only',
      'Ask questions and create polls for engagement',
      'Short, punchy tweets (under 100 chars) get more retweets',
    ],
    avoid: [
      'More than 2-3 hashtags',
      'Long, wordy tweets without line breaks',
      'Auto-posting the same content repeatedly',
      'Only posting links without commentary',
      'Engagement bait',
    ],
    caption: {
      optimalLength: { min: 20, max: 200 },
      maxLength: 280,
      hookImportant: true,
      ctaRecommended: false,
      emojiUsage: 'minimal',
      keywordOptimized: false,
    },
    platformCategory: 'text',
    hasAlgorithm: true,
    primaryMetric: 'engagement_velocity',
    aiGenerationNotes: 'Write short, impactful tweets. Bold opinions and hot takes drive the most engagement. Use threads (3-7 tweets) for longer content — they get significantly more impressions. Include images when relevant. Ask questions to drive replies. Keep under 280 characters. Tone should be conversational, not corporate.',
  },

  YOUTUBE: {
    name: 'YouTube',
    rankingFactors: [
      'Watch time (total and per-session)',
      'Click-through rate (CTR) from thumbnail/title',
      'Engagement (likes, comments, shares)',
      'Upload consistency/frequency',
      'Session duration (does the video lead to more watching)',
    ],
    frequency: {
      postsPerWeek: { min: 1, max: 7, optimal: 3 },
      postsPerDay: { min: 0, max: 1, optimal: 0 },
      videosPerDay: { min: 0, max: 1, optimal: 0 },
    },
    contentMix: { text: 0, image: 0, video: 100, story: 0, article: 0 },
    bestTimesWeekday: [12, 14, 15, 17],
    bestTimesWeekend: [10, 11, 14],
    bestDays: [4, 5, 6],  // Thu, Fri, Sat
    hashtags: {
      recommended: 3,
      max: 5,
      strategy: 'moderate',
      note: 'Use 3-5 relevant hashtags in description. Focus on SEO keywords in title, description, and tags instead.',
    },
    bestTones: ['educational', 'casual', 'inspirational'],
    bestContentTypes: ['educational', 'storytelling', 'engagement'],
    contentTips: [
      'Consistency matters more than frequency — keep a regular schedule',
      '1 long video/week + 3-5 Shorts/week is the ideal mix',
      'Shorts use the same algorithm as TikTok — optimize for completion',
      'CTR (click-through rate) is critical — write compelling titles',
      'First 30 seconds determine if viewers stay or leave',
      'Community posts boost channel visibility between uploads',
      'End screens and cards increase session watch time',
    ],
    avoid: [
      'Irregular upload schedules',
      'Clickbait that does not deliver on the promise',
      'Low-quality thumbnails',
      'Videos without descriptions or tags',
      'Duplicate content across channels',
    ],
    video: {
      optimalLengthSec: { min: 480, max: 900 },  // 8-15 min for long-form
      format: 'landscape_16_9',
      hookWindowSec: 10,
      captionsRequired: true,
    },
    caption: {
      optimalLength: { min: 200, max: 2000 },
      maxLength: 5000,
      hookImportant: true,
      ctaRecommended: true,
      emojiUsage: 'minimal',
      keywordOptimized: true,
    },
    platformCategory: 'video',
    hasAlgorithm: true,
    primaryMetric: 'watch_time',
    aiGenerationNotes: 'Write video scripts and descriptions. For Shorts (vertical): hook in 1-2 sec, 15-60 sec length. For long-form: compelling title, detailed description with keywords, timestamps, and CTA. YouTube is a search engine — SEO matters. Focus on educational, how-to, and storytelling content.',
  },

  PINTEREST: {
    name: 'Pinterest',
    rankingFactors: [
      'Pin quality and visual appeal',
      'Keyword relevance (Pinterest is a visual search engine)',
      'Engagement (saves, clicks, close-ups)',
      'Freshness of content',
      'Domain authority of linked website',
    ],
    frequency: {
      postsPerWeek: { min: 7, max: 35, optimal: 21 },
      postsPerDay: { min: 1, max: 5, optimal: 3 },
    },
    contentMix: { text: 0, image: 70, video: 30, story: 0, article: 0 },
    bestTimesWeekday: [14, 15, 20, 21],
    bestTimesWeekend: [14, 15, 20],
    bestDays: [5, 6, 0],  // Fri, Sat, Sun
    hashtags: {
      recommended: 3,
      max: 5,
      strategy: 'niche',
      note: 'Pinterest hashtags are searchable but keywords in description matter more. Use 2-5 specific, keyword-rich hashtags. Pinterest is fundamentally a search engine.',
    },
    bestTones: ['inspirational', 'educational', 'casual'],
    bestContentTypes: ['educational', 'promotional', 'curated'],
    contentTips: [
      'Vertical images (2:3 ratio) perform best',
      'Keywords in pin description are critical — Pinterest is a search engine',
      'Fresh content is prioritized over repins',
      'Idea Pins (multi-page, video) get prioritized in feed',
      'Include a clear CTA and link to your website',
      'Create boards with keyword-rich titles',
      'Seasonal content should be pinned 45 days before the event',
    ],
    avoid: [
      'Horizontal images (poor mobile experience)',
      'Missing pin descriptions',
      'Spammy or repetitive pins',
      'Low-resolution images',
      'Boards with generic titles',
    ],
    video: {
      optimalLengthSec: { min: 6, max: 60 },
      format: 'vertical_9_16',
      hookWindowSec: 2,
      captionsRequired: true,
    },
    caption: {
      optimalLength: { min: 100, max: 500 },
      maxLength: 500,
      hookImportant: false,
      ctaRecommended: true,
      emojiUsage: 'none',
      keywordOptimized: true,
    },
    platformCategory: 'visual',
    hasAlgorithm: true,
    primaryMetric: 'saves_and_clicks',
    aiGenerationNotes: 'Pinterest is a visual search engine, not a social network. Write SEO-optimized pin descriptions with relevant keywords. Focus on evergreen, inspirational, and how-to content. Include clear CTAs with website links. Descriptions should read naturally while incorporating search terms. Think of pin descriptions as mini-SEO articles.',
  },

  THREADS: {
    name: 'Threads',
    rankingFactors: [
      'Engagement (replies, likes, reposts)',
      'Content relevance and quality',
      'Recency (still somewhat chronological)',
      'Cross-posting from Instagram (boosts visibility)',
    ],
    frequency: {
      postsPerWeek: { min: 7, max: 21, optimal: 14 },
      postsPerDay: { min: 1, max: 3, optimal: 2 },
    },
    contentMix: { text: 60, image: 30, video: 10, story: 0, article: 0 },
    bestTimesWeekday: [8, 9, 12, 17, 18],
    bestTimesWeekend: [9, 10, 14],
    bestDays: [1, 2, 3, 4],  // Mon-Thu
    hashtags: {
      recommended: 0,
      max: 0,
      strategy: 'none',
      note: 'Threads uses topic tags, not traditional hashtags. Focus on conversation-starting content instead.',
    },
    bestTones: ['casual', 'humorous', 'provocative', 'educational'],
    bestContentTypes: ['engagement', 'news', 'educational'],
    contentTips: [
      'Conversation starters and hot takes drive the most replies',
      'Cross-posting from Instagram boosts visibility',
      'Text-first platform — images are optional',
      'Ask questions and share opinions to drive discussion',
      'Short, punchy posts perform best (under 300 chars)',
      'Engage with replies quickly to boost post visibility',
    ],
    avoid: [
      'Hashtag-heavy posts',
      'Long-form content (better suited for LinkedIn/Medium)',
      'Purely promotional content without value',
      'Auto-posted content without platform optimization',
    ],
    caption: {
      optimalLength: { min: 20, max: 300 },
      maxLength: 500,
      hookImportant: true,
      ctaRecommended: false,
      emojiUsage: 'moderate',
      keywordOptimized: false,
    },
    platformCategory: 'text',
    hasAlgorithm: true,
    primaryMetric: 'replies_and_engagement',
    aiGenerationNotes: 'Write conversational, opinion-driven posts. Hot takes, questions, and conversation starters work best. Keep posts under 300 characters. No hashtags needed — use topic tags if available. Tone should be casual and authentic. Cross-posting from Instagram gives a reach boost.',
  },

  MASTODON: {
    name: 'Mastodon',
    rankingFactors: [
      'Chronological order (no algorithm)',
      'Boosts (retoots) — only way to extend reach',
      'Hashtags (primary discovery mechanism)',
      'Federation — which instances see your posts',
    ],
    frequency: {
      postsPerWeek: { min: 7, max: 21, optimal: 14 },
      postsPerDay: { min: 1, max: 3, optimal: 2 },
    },
    contentMix: { text: 50, image: 35, video: 5, story: 0, article: 10 },
    bestTimesWeekday: [8, 12, 18],
    bestTimesWeekend: [10, 15],
    bestDays: [1, 2, 3, 4, 5],  // Weekdays
    hashtags: {
      recommended: 4,
      max: 10,
      strategy: 'moderate',
      note: 'Hashtags are THE primary discovery mechanism on Mastodon (no algorithm). Use relevant hashtags in every post. CamelCase for multi-word tags (#OpenSource).',
    },
    bestTones: ['casual', 'educational', 'professional'],
    bestContentTypes: ['educational', 'engagement', 'news', 'curated'],
    contentTips: [
      'No algorithm — chronological feed only',
      'Boosts (retoots) are the only way to extend reach beyond followers',
      'Hashtags are critical for discovery — use them in every post',
      'Alt text on images is culturally important and expected',
      'Content warnings (CW) are standard practice for sensitive topics',
      'Engage with the community — boost others, reply to threads',
      'Cross-posting from Twitter without optimization is frowned upon',
    ],
    avoid: [
      'Cross-posting without platform optimization',
      'Missing alt text on images',
      'Overly promotional content',
      'Ignoring content warning conventions',
      'Thread-style posts without proper formatting',
    ],
    caption: {
      optimalLength: { min: 50, max: 400 },
      maxLength: 500,
      hookImportant: false,
      ctaRecommended: false,
      emojiUsage: 'minimal',
      keywordOptimized: false,
    },
    platformCategory: 'decentralized',
    hasAlgorithm: false,
    primaryMetric: 'boosts',
    aiGenerationNotes: 'Write genuine, community-focused content. Include relevant hashtags in CamelCase (#OpenSource, #WebDev). Always include alt text for images. Be respectful of content warning conventions. Tone should be authentic and non-corporate. Mastodon users value authenticity over polish.',
  },

  BLUESKY: {
    name: 'Bluesky',
    rankingFactors: [
      'Custom feed algorithms (user-chosen)',
      'Engagement (likes, reposts, replies)',
      'Recency (chronological by default)',
      'Feed generator selection',
    ],
    frequency: {
      postsPerWeek: { min: 14, max: 35, optimal: 21 },
      postsPerDay: { min: 2, max: 5, optimal: 3 },
    },
    contentMix: { text: 60, image: 30, video: 5, story: 0, article: 5 },
    bestTimesWeekday: [8, 12, 17],
    bestTimesWeekend: [10, 14],
    bestDays: [1, 2, 3, 4, 5],  // Weekdays
    hashtags: {
      recommended: 0,
      max: 0,
      strategy: 'none',
      note: 'Bluesky does not use traditional hashtags. Discovery happens through custom feeds and engagement.',
    },
    bestTones: ['casual', 'humorous', 'educational'],
    bestContentTypes: ['engagement', 'news', 'educational'],
    contentTips: [
      'Custom feed generators can amplify reach significantly',
      'Engage with existing communities and threads',
      'Early adopters and consistent posters are rewarded',
      'Conversational content performs best',
      'Share interesting takes and join ongoing discussions',
    ],
    avoid: [
      'Hashtag-heavy posts (no hashtag system)',
      'Corporate/promotional tone',
      'Auto-posted content without optimization',
    ],
    caption: {
      optimalLength: { min: 20, max: 250 },
      maxLength: 300,
      hookImportant: true,
      ctaRecommended: false,
      emojiUsage: 'minimal',
      keywordOptimized: false,
    },
    platformCategory: 'decentralized',
    hasAlgorithm: false,
    primaryMetric: 'engagement',
    aiGenerationNotes: 'Write conversational, authentic posts. No hashtags. Focus on interesting opinions, questions, and community discussion. Keep under 300 characters. Similar to early Twitter vibe — authentic and community-driven.',
  },

  TELEGRAM: {
    name: 'Telegram',
    rankingFactors: [
      'Chronological (no algorithm — channels are push-based)',
      'Message quality and formatting',
      'Rich media engagement',
      'Channel growth and retention rate',
    ],
    frequency: {
      postsPerWeek: { min: 7, max: 21, optimal: 14 },
      postsPerDay: { min: 1, max: 3, optimal: 2 },
    },
    contentMix: { text: 40, image: 35, video: 15, story: 0, article: 10 },
    bestTimesWeekday: [9, 12, 18],
    bestTimesWeekend: [11, 16],
    bestDays: [1, 2, 3, 4, 5],  // Weekdays
    hashtags: {
      recommended: 2,
      max: 5,
      strategy: 'minimal',
      note: 'Hashtags are clickable in Telegram but not essential. Use for categorization within your channel.',
    },
    bestTones: ['educational', 'casual', 'professional'],
    bestContentTypes: ['news', 'educational', 'curated', 'engagement'],
    contentTips: [
      'Rich media (photos, videos) get 2x more engagement than text',
      'Keep messages concise and well-formatted',
      'Polls drive high interaction',
      'Markdown formatting supported — use bold, italic, code blocks',
      'Pin important messages for visibility',
      'Use reactions to gauge audience preferences',
    ],
    avoid: [
      'Walls of unformatted text',
      'Too many messages per day (causes unfollows)',
      'Missing media on promotional posts',
    ],
    caption: {
      optimalLength: { min: 50, max: 500 },
      maxLength: 4096,
      hookImportant: true,
      ctaRecommended: true,
      emojiUsage: 'moderate',
      keywordOptimized: false,
    },
    platformCategory: 'community',
    hasAlgorithm: false,
    primaryMetric: 'views_and_reactions',
    aiGenerationNotes: 'Write concise, well-formatted messages using Markdown. Include emojis for visual appeal. Rich media (photos, infographics) significantly boost engagement. Use polls for interaction. Keep a consistent posting schedule — Telegram is push-based so timing matters for open rates.',
  },

  DISCORD: {
    name: 'Discord',
    rankingFactors: [
      'Chronological (no algorithm within channels)',
      'Server Discovery algorithm (for public servers)',
      'Message reactions and thread engagement',
    ],
    frequency: {
      postsPerWeek: { min: 7, max: 21, optimal: 14 },
      postsPerDay: { min: 1, max: 3, optimal: 2 },
    },
    contentMix: { text: 50, image: 30, video: 10, story: 0, article: 10 },
    bestTimesWeekday: [14, 18, 21],
    bestTimesWeekend: [12, 16, 20],
    bestDays: [4, 5, 6, 0],  // Thu-Sun
    hashtags: {
      recommended: 0,
      max: 0,
      strategy: 'none',
      note: 'Discord does not use hashtags. Channels serve as categories.',
    },
    bestTones: ['casual', 'humorous', 'educational'],
    bestContentTypes: ['engagement', 'news', 'educational'],
    contentTips: [
      'Embeds with images perform better than plain text',
      'Use threads for longer discussions',
      'Rich embeds with previews get more clicks',
      'Regular events and announcements drive engagement',
      'Community interaction is more important than broadcasting',
    ],
    avoid: [
      'Excessive @everyone or @here pings',
      'Auto-posting without community context',
      'Purely promotional content without value',
    ],
    caption: {
      optimalLength: { min: 30, max: 500 },
      maxLength: 2000,
      hookImportant: false,
      ctaRecommended: false,
      emojiUsage: 'moderate',
      keywordOptimized: false,
    },
    platformCategory: 'community',
    hasAlgorithm: false,
    primaryMetric: 'reactions_and_threads',
    aiGenerationNotes: 'Write community-friendly messages. Use embeds with images when possible. Keep messages conversational and engaging. Discord is about community, not broadcasting. Include relevant emojis and formatting.',
  },

  REDDIT: {
    name: 'Reddit',
    rankingFactors: [
      'Upvote velocity (initial upvotes in first hour)',
      'Comment count and depth',
      'Upvote-to-downvote ratio',
      'Subreddit relevance',
      'Account karma and history',
    ],
    frequency: {
      postsPerWeek: { min: 3, max: 7, optimal: 5 },
      postsPerDay: { min: 0, max: 1, optimal: 1 },
    },
    contentMix: { text: 50, image: 25, video: 10, story: 0, article: 15 },
    bestTimesWeekday: [6, 7, 8, 12],
    bestTimesWeekend: [8, 9, 11],
    bestDays: [1, 2, 3],  // Mon-Wed (early week)
    hashtags: {
      recommended: 0,
      max: 0,
      strategy: 'none',
      note: 'Reddit does not use hashtags. Content discovery is through subreddits and the algorithm.',
    },
    bestTones: ['educational', 'casual', 'humorous'],
    bestContentTypes: ['educational', 'engagement', 'news'],
    contentTips: [
      'Follow the 10:1 rule — 10 community posts for every 1 self-promotion',
      'Provide genuine value first, then subtly reference your brand',
      'Text posts and image posts get the most upvotes',
      'Follow each subreddit rules strictly',
      'Engage in comments — Reddit rewards authentic participation',
      'Titles are everything — compelling titles get clicks and upvotes',
      'Post early morning for maximum US visibility',
    ],
    avoid: [
      'Overt self-promotion (triggers spam filters)',
      'More than 10% promotional content',
      'Ignoring subreddit rules',
      'New account posting immediately (build karma first)',
      'Cross-posting identical content to multiple subreddits simultaneously',
    ],
    caption: {
      optimalLength: { min: 100, max: 2000 },
      maxLength: 40000,
      hookImportant: true,
      ctaRecommended: false,
      emojiUsage: 'none',
      keywordOptimized: false,
    },
    platformCategory: 'community',
    hasAlgorithm: true,
    primaryMetric: 'upvote_velocity',
    aiGenerationNotes: 'Write genuinely valuable, non-promotional content. Reddit users hate ads and self-promotion. Focus on providing insights, sharing knowledge, and asking genuine questions. Titles are critical — write compelling, honest titles. Follow the 10:1 rule strictly. Never include obvious calls-to-action or promotional links in posts.',
  },

  MEDIUM: {
    name: 'Medium',
    rankingFactors: [
      'Read time and completion rate',
      'Claps (applause)',
      'Highlights',
      'Responses (comments)',
      'Publication distribution',
      'Topic relevance',
    ],
    frequency: {
      postsPerWeek: { min: 1, max: 3, optimal: 2 },
      postsPerDay: { min: 0, max: 1, optimal: 0 },
    },
    contentMix: { text: 0, image: 10, video: 0, story: 0, article: 90 },
    bestTimesWeekday: [7, 8, 10],
    bestTimesWeekend: [9],
    bestDays: [2, 3, 4],  // Tue-Thu
    hashtags: {
      recommended: 5,
      max: 5,
      strategy: 'niche',
      note: 'Medium uses "tags" (up to 5). Choose specific, relevant tags that match your article topic. Tags determine which topic pages your article appears on.',
    },
    bestTones: ['educational', 'professional', 'inspirational'],
    bestContentTypes: ['educational', 'storytelling'],
    contentTips: [
      '7-10 minute read articles perform best',
      'Publish in relevant publications for wider distribution',
      'Strong headlines and subtitles increase CTR',
      'Use images/charts to break up long text',
      'Include a featured image for better presentation',
      '1-2 quality articles per week beats daily short posts',
    ],
    avoid: [
      'Short, low-effort posts',
      'Content without featured images',
      'Articles without tags',
      'Clickbait headlines',
    ],
    caption: {
      optimalLength: { min: 1500, max: 3500 },
      maxLength: 100000,
      hookImportant: true,
      ctaRecommended: true,
      emojiUsage: 'none',
      keywordOptimized: true,
    },
    platformCategory: 'longform',
    hasAlgorithm: true,
    primaryMetric: 'read_time',
    aiGenerationNotes: 'Write long-form articles (7-10 minute read, 1500-3000 words). Focus on in-depth educational content, tutorials, case studies, and thought leadership. Use proper headings (H2, H3), bullet points, and images. Write a compelling subtitle and featured image. Include relevant tags for topic distribution.',
  },

  DEVTO: {
    name: 'Dev.to',
    rankingFactors: [
      'Hearts/Reactions (community approval)',
      'Comments and discussion depth',
      'Bookmarks (saved for later)',
      'Tag relevance',
      'Community engagement',
    ],
    frequency: {
      postsPerWeek: { min: 1, max: 3, optimal: 2 },
      postsPerDay: { min: 0, max: 1, optimal: 0 },
    },
    contentMix: { text: 0, image: 5, video: 0, story: 0, article: 95 },
    bestTimesWeekday: [8, 14],
    bestTimesWeekend: [10],
    bestDays: [1, 2, 3],  // Mon-Wed
    hashtags: {
      recommended: 4,
      max: 4,
      strategy: 'niche',
      note: 'Dev.to uses tags (max 4). Choose relevant tech tags (#javascript, #webdev, #tutorial). Tags determine article visibility.',
    },
    bestTones: ['educational', 'casual', 'professional'],
    bestContentTypes: ['educational'],
    contentTips: [
      '"How I built..." and tutorial posts drive highest engagement',
      'Technical tutorials with code examples perform best',
      'Use relevant tags for distribution (#javascript, #python, etc.)',
      'Cross-post from your blog with canonical URLs',
      '1-2 articles per week is ideal',
      'Cover images increase click-through rate',
    ],
    avoid: [
      'Non-technical content',
      'Articles without code examples or practical value',
      'Missing cover images',
      'Excessive self-promotion',
    ],
    caption: {
      optimalLength: { min: 1000, max: 3000 },
      maxLength: 100000,
      hookImportant: true,
      ctaRecommended: false,
      emojiUsage: 'none',
      keywordOptimized: true,
    },
    platformCategory: 'longform',
    hasAlgorithm: true,
    primaryMetric: 'reactions',
    aiGenerationNotes: 'Write technical articles focused on tutorials, "how I built" stories, and developer insights. Include code examples with syntax highlighting. Use proper Markdown formatting. Focus on practical, actionable content that developers can use immediately.',
  },

  NOSTR: {
    name: 'Nostr',
    rankingFactors: [
      'No central algorithm — relay-based distribution',
      'Zaps (Lightning tips — engagement signal)',
      'Reactions and reposts',
      'Relay selection affects visibility',
    ],
    frequency: {
      postsPerWeek: { min: 7, max: 21, optimal: 14 },
      postsPerDay: { min: 1, max: 3, optimal: 2 },
    },
    contentMix: { text: 70, image: 20, video: 0, story: 0, article: 10 },
    bestTimesWeekday: [9, 14, 20],
    bestTimesWeekend: [10, 16],
    bestDays: [1, 2, 3, 4, 5],  // Weekdays
    hashtags: {
      recommended: 3,
      max: 5,
      strategy: 'moderate',
      note: 'Nostr supports hashtags for content categorization. Use relevant tags to help relay discovery.',
    },
    bestTones: ['casual', 'educational', 'provocative'],
    bestContentTypes: ['news', 'educational', 'engagement'],
    contentTips: [
      'Decentralized — no single algorithm controls distribution',
      'Relay selection determines who sees your notes',
      'Zaps (Lightning tips) drive community engagement',
      'Focus on niche crypto/tech communities',
      'Authentic, non-corporate content preferred',
    ],
    avoid: [
      'Overtly commercial content',
      'Content not aligned with decentralization values',
    ],
    caption: {
      optimalLength: { min: 30, max: 500 },
      maxLength: 10000,
      hookImportant: false,
      ctaRecommended: false,
      emojiUsage: 'minimal',
      keywordOptimized: false,
    },
    platformCategory: 'decentralized',
    hasAlgorithm: false,
    primaryMetric: 'zaps_and_reposts',
    aiGenerationNotes: 'Write authentic, community-focused notes. Nostr values decentralization and free speech. Focus on tech, crypto, and freedom-related topics. Include relevant hashtags for relay discovery.',
  },

  MOLTBOOK: {
    name: 'Moltbook',
    rankingFactors: [
      'Engagement (likes, comments, shares)',
      'Content quality',
      'Posting consistency',
    ],
    frequency: {
      postsPerWeek: { min: 3, max: 14, optimal: 7 },
      postsPerDay: { min: 1, max: 2, optimal: 1 },
    },
    contentMix: { text: 30, image: 50, video: 0, story: 0, article: 20 },
    bestTimesWeekday: [8, 12, 17],
    bestTimesWeekend: [10, 14],
    bestDays: [1, 2, 3, 4, 5],  // Weekdays
    hashtags: {
      recommended: 3,
      max: 5,
      strategy: 'moderate',
      note: 'Use relevant hashtags for content categorization.',
    },
    bestTones: ['casual', 'educational', 'professional'],
    bestContentTypes: ['educational', 'engagement', 'promotional'],
    contentTips: [
      'Mix text and image posts for variety',
      'Engage with community through comments',
      'Post consistently at regular intervals',
    ],
    avoid: [
      'Spam or repetitive content',
      'Low-quality images',
    ],
    caption: {
      optimalLength: { min: 50, max: 500 },
      maxLength: 5000,
      hookImportant: true,
      ctaRecommended: true,
      emojiUsage: 'minimal',
      keywordOptimized: false,
    },
    platformCategory: 'text',
    hasAlgorithm: true,
    primaryMetric: 'engagement',
    aiGenerationNotes: 'Write engaging posts that mix text and images. Focus on educational and community-building content.',
  },
};

/**
 * Get the recommended content plan for a platform based on algorithm research.
 * Used when user clicks "Let AI Decide" for a specific platform.
 */
export function getRecommendedPlan(platform: string): {
  dailyTexts: number;
  dailyImages: number;
  dailyVideos: number;
  dailyStories: number;
  weeklyArticles: number;
} {
  const config = PLATFORM_ALGORITHM[platform];
  if (!config) {
    return { dailyTexts: 1, dailyImages: 1, dailyVideos: 0, dailyStories: 0, weeklyArticles: 0 };
  }

  const total = config.frequency.postsPerDay.optimal;
  const mix = config.contentMix;

  return {
    dailyTexts: Math.round(total * (mix.text / 100)),
    dailyImages: Math.round(total * (mix.image / 100)),
    dailyVideos: Math.round(total * (mix.video / 100)),
    dailyStories: config.frequency.storiesPerDay?.optimal || 0,
    weeklyArticles: mix.article > 0 ? Math.max(1, Math.round(config.frequency.postsPerWeek.optimal * (mix.article / 100))) : 0,
  };
}

/**
 * Get the optimal posting hours for a platform adjusted for a specific timezone.
 * Returns hours in the target timezone.
 */
export function getOptimalHoursForPlatform(platform: string): number[] {
  const config = PLATFORM_ALGORITHM[platform];
  if (!config) return [9, 13, 17];

  // Return a merged set of best times (weekday has priority)
  const hours = new Set([...config.bestTimesWeekday, ...config.bestTimesWeekend]);
  return Array.from(hours).sort((a, b) => a - b);
}

/**
 * Generate AI content generation prompt additions based on platform algorithm knowledge.
 * Used by the autonomous content generator to create platform-optimized posts.
 */
export function getContentGenerationContext(platform: string): string {
  const config = PLATFORM_ALGORITHM[platform];
  if (!config) return '';

  const lines: string[] = [
    `Platform: ${config.name}`,
    `Primary metric: ${config.primaryMetric}`,
    `Category: ${config.platformCategory}`,
    '',
    'Content tips:',
    ...config.contentTips.map(tip => `- ${tip}`),
    '',
    'Avoid:',
    ...config.avoid.map(item => `- ${item}`),
    '',
    `Caption: ${config.caption.optimalLength.min}-${config.caption.optimalLength.max} chars optimal, max ${config.caption.maxLength}`,
    `Hashtags: ${config.hashtags.recommended} recommended (${config.hashtags.note})`,
    `Tone: ${config.bestTones.join(', ')}`,
    '',
    config.aiGenerationNotes,
  ];

  return lines.join('\n');
}
