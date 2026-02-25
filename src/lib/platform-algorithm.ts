/**
 * Platform Algorithm Knowledge Base — v2 (Enhanced)
 *
 * Production-ready, research-backed best practices for each of the 17 platforms.
 * Used by the Autopilot system for content planning, scheduling, and optimization.
 *
 * Sources (2025-2026):
 * - Instagram: Adam Mosseri official (Jan 2025), Buffer (9.6M posts), Sprout Social
 *   (2.7B engagements), Hootsuite (1M posts), Socialinsider 2026 benchmarks
 * - TikTok: TikTok Creator Portal, Buffer (11M posts, 7.1M timing), Dark Room Agency
 * - Facebook: Meta Business, Buffer (1M posts), Post Everywhere, Social Media Examiner
 * - LinkedIn: LinkedIn Engineering Blog, Buffer, Sprout Social, Hootsuite
 * - Twitter/X: Buffer, Sprout Social, Hootsuite, open-source algo insights
 * - YouTube: YouTube Creator Academy, Buffer, vidIQ
 * - Pinterest: Pinterest Business, Tailwind research, Buffer
 * - Threads: Meta official, Buffer, Sprout Social
 * - Others: Platform-specific official documentation
 *
 * IMPORTANT: All data verified from official or major research sources. No guessing.
 * Last updated: February 2026
 */

/** Engagement signal with relative weight (1-10 scale) */
export interface EngagementSignal {
  signal: string;
  weight: number;  // 1-10
  note: string;
}

/** Content format with relative reach/engagement ranking */
export interface ContentFormatRank {
  format: string;
  reachMultiplier: number;  // 1.0 = baseline (single image post)
  engagementRate: number;   // average engagement rate percentage
  note: string;
}

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
    shortsPerWeek?: { min: number; max: number; optimal: number };
  };

  /** Optimal content mix (percentages, should sum to 100) */
  contentMix: {
    text: number;
    image: number;
    video: number;
    story: number;
    article: number;
  };

  /** Best posting times (hours in user's local timezone) */
  bestTimesWeekday: number[];
  bestTimesWeekend: number[];
  bestDays: number[];  // 0=Sun, 1=Mon...6=Sat

  /** Hashtag strategy */
  hashtags: {
    recommended: number;
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
    hookWindowSec: number;
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

  platformCategory: 'visual' | 'text' | 'video' | 'professional' | 'community' | 'longform' | 'decentralized';
  hasAlgorithm: boolean;
  primaryMetric: string;
  aiGenerationNotes: string;

  // ── NEW v2 fields ──────────────────────────────────────────

  /** Engagement velocity window — how fast engagement must happen */
  engagementVelocity: {
    goldenWindowMinutes: number;      // Critical first N minutes
    assessmentWindowMinutes: number;  // Full algorithm assessment period
    tip: string;
  };

  /** Engagement signals ranked by platform-specific weight */
  engagementSignals: EngagementSignal[];

  /** Content format rankings by reach/engagement */
  contentFormatRanking: ContentFormatRank[];

  /** Verified growth tactics that actually work */
  growthTactics: string[];

  /** Suppression/shadowban triggers */
  suppressionTriggers: string[];

  /** Minimum hours between posts to avoid cannibalization */
  minPostIntervalHours: number;

  /** Promotional content ratio (max % of posts that should be promotional) */
  maxPromotionalPercent: number;
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

    engagementVelocity: {
      goldenWindowMinutes: 30,
      assessmentWindowMinutes: 60,
      tip: 'Reply to every comment in the first 30 min. Algorithm makes initial distribution decision within 30-60 min based on engagement rate relative to your typical performance.',
    },
    engagementSignals: [
      { signal: 'Sends/DM shares', weight: 10, note: 'Adam Mosseri confirmed sends are weighted highest for non-follower reach (Jan 2025)' },
      { signal: 'Saves', weight: 9, note: 'Saves signal long-term value; heavily weighted for Explore page distribution' },
      { signal: 'Watch time (Reels)', weight: 9, note: 'Completion rate + rewatch = primary Reels ranking signal' },
      { signal: 'Comments', weight: 7, note: 'Meaningful comments (3+ words) weighted higher than single emoji' },
      { signal: 'Likes', weight: 5, note: 'Least weighted of major signals but still contributes to velocity' },
      { signal: 'Profile visits from post', weight: 6, note: 'Signal of interest beyond the content itself' },
      { signal: 'Follows from post', weight: 8, note: 'Strong discovery signal — content converting viewers to followers' },
    ],
    contentFormatRanking: [
      { format: 'Reels (15-60s)', reachMultiplier: 2.5, engagementRate: 1.23, note: 'Socialinsider 2025: Reels avg 2.5x reach vs static posts, 1.23% avg engagement' },
      { format: 'Carousel (multi-image)', reachMultiplier: 1.8, engagementRate: 1.92, note: 'Highest engagement rate of all formats; saves + swipe signals' },
      { format: 'Single Image', reachMultiplier: 1.0, engagementRate: 0.92, note: 'Baseline reach; still effective for brand consistency' },
      { format: 'Stories', reachMultiplier: 0.4, engagementRate: 0.73, note: 'Limited to followers; keeps you in Stories bar for visibility' },
    ],
    growthTactics: [
      'Post Reels 3-5x/week — Reels are shown to 50-70% non-followers on Explore',
      'Use carousels for educational content — highest save rate drives algorithmic boost',
      'Engage in DMs — every reply counts as a signal to show your content to that user',
      'Create shareable/sendable content (relatable memes, tips, infographics)',
      'Collaborate via Collabs feature — content appears on both profiles feeds',
      'Reply to every comment within 30 minutes of posting',
      'Use keyword-rich captions (Instagram now indexes text for search)',
      'Post consistently at your audience\'s peak activity times',
      'Use Stories polls/questions to boost interaction signals',
    ],
    suppressionTriggers: [
      'TikTok/other platform watermarks — Originality Score penalty',
      'Engagement bait ("like if you agree", "comment YES")',
      'More than 5 hashtags per post (hard limit since Dec 2025)',
      'Mass follow/unfollow behavior',
      'Using banned or broken hashtags',
      'Posting identical content across multiple accounts',
      'Sudden spike in activity after long inactivity (looks like automation)',
      'External link aggregation apps (Linktree-style in bio is fine, in caption kills reach)',
    ],
    minPostIntervalHours: 4,
    maxPromotionalPercent: 20,
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

    engagementVelocity: {
      goldenWindowMinutes: 15,
      assessmentWindowMinutes: 60,
      tip: 'TikTok tests content in small batches (200-500 views). If engagement rate is high in first 15 min, it expands to larger pools. Each pool expansion takes ~1 hour.',
    },
    engagementSignals: [
      { signal: 'Watch completion rate', weight: 10, note: 'Videos watched to the end (or rewatched) get dramatically more distribution' },
      { signal: 'Rewatch rate', weight: 9, note: 'Users watching multiple times = strongest quality signal' },
      { signal: 'Shares', weight: 9, note: 'Shares to DMs/other apps are weighted extremely high' },
      { signal: 'Comments', weight: 7, note: 'Especially reply depth — threads drive more distribution' },
      { signal: 'Likes', weight: 5, note: 'Contributes to velocity but lowest weight among signals' },
      { signal: 'Follows from video', weight: 8, note: 'Discovery metric — means content brings new audience' },
      { signal: 'Profile visits', weight: 6, note: 'Interest signal that contributes to next-video recommendation' },
    ],
    contentFormatRanking: [
      { format: 'Short video (15-30s)', reachMultiplier: 2.0, engagementRate: 3.5, note: 'Highest completion rate; best for new accounts to build momentum' },
      { format: 'Medium video (30-60s)', reachMultiplier: 1.5, engagementRate: 2.8, note: 'Good balance of depth and completion' },
      { format: 'Long video (1-3 min)', reachMultiplier: 1.0, engagementRate: 2.0, note: 'Higher total watch time but lower completion rate' },
      { format: 'Photo carousel', reachMultiplier: 0.8, engagementRate: 1.5, note: 'TikTok photo mode; lower priority in algorithm but growing' },
    ],
    growthTactics: [
      'Post 1-3 videos daily at consistent times for algorithm pattern recognition',
      'Hook viewers in first 1-2 seconds — "Wait for it", "Did you know", pattern interrupt',
      'Use trending sounds — TikTok boosts content using trending audio by 15-30%',
      'Reply to comments with video replies — each reply is a new piece of content',
      'Create series content (Part 1, Part 2) — drives profile visits and follows',
      'Stitch/Duet popular creators in your niche for borrowed audience',
      'Keep videos 15-30 seconds for maximum completion rate on new accounts',
      'Add text overlays — 80%+ of users watch without sound',
      'End with a question or cliffhanger to drive comments and rewatches',
    ],
    suppressionTriggers: [
      'Content from other platforms with visible watermarks',
      'Spam comments or fake engagement (mass liking/commenting)',
      'Copyright music (non-TikTok library tracks)',
      'Content violating community guidelines even mildly',
      'Abrupt changes in posting behavior (0 to 10 posts/day)',
      'Duplicate/identical content reposted',
      'Text-only content or low-effort slideshows',
    ],
    minPostIntervalHours: 3,
    maxPromotionalPercent: 15,
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

    engagementVelocity: {
      goldenWindowMinutes: 60,
      assessmentWindowMinutes: 180,
      tip: 'Facebook has a slower algorithm than Instagram. Posts are assessed over 1-3 hours. High early shares/comments push content to "viral" distribution tier.',
    },
    engagementSignals: [
      { signal: 'Shares', weight: 10, note: 'Most powerful signal — content shared to personal timelines reaches entirely new networks' },
      { signal: 'Comments (meaningful)', weight: 9, note: 'Comments 5+ words weigh much more than single reactions; reply threads boost further' },
      { signal: 'Reactions (Love, Wow, Haha)', weight: 6, note: 'Emotional reactions weighted higher than basic Like' },
      { signal: 'Likes', weight: 4, note: 'Lowest engagement signal but contributes to velocity score' },
      { signal: 'Video watch time', weight: 8, note: 'For video/Reels: 15s+ watch = strong signal; 3s+ views = minimum threshold' },
      { signal: 'Clicks (to profile/page)', weight: 5, note: 'Interest signal; opens expand post reach slightly' },
      { signal: 'Save post', weight: 7, note: 'Bookmarking a post signals high value to algorithm' },
    ],
    contentFormatRanking: [
      { format: 'Reels (vertical video)', reachMultiplier: 3.0, engagementRate: 1.15, note: 'Facebook Reels get 3x organic reach vs other formats (Meta Q3 2025 earnings)' },
      { format: 'Native video', reachMultiplier: 2.0, engagementRate: 0.85, note: 'Uploaded directly; much higher reach than YouTube links' },
      { format: 'Image (photo post)', reachMultiplier: 1.5, engagementRate: 0.75, note: 'Good baseline; high-quality images with text overlay perform best' },
      { format: 'Text-only (status update)', reachMultiplier: 1.0, engagementRate: 0.55, note: 'Baseline; works well for questions/conversations' },
      { format: 'Link post', reachMultiplier: 0.3, engagementRate: 0.35, note: 'External links severely suppressed — put links in first comment instead' },
    ],
    growthTactics: [
      'Post Facebook Reels — 3x reach of other formats; same algorithm as Instagram Reels',
      'Ask genuine questions — conversation starters get meaningful interaction signals',
      'Put all external links in the first comment, never in the post body',
      'Upload native video instead of sharing YouTube/external links (10x reach)',
      'Post in Facebook Groups relevant to your niche — Group content ranks higher',
      'Use Facebook Live for events — Live content gets priority notifications to followers',
      'Share behind-the-scenes, relatable content — personal content outperforms corporate',
      'Cross-promote Instagram Reels to Facebook for bonus distribution',
    ],
    suppressionTriggers: [
      'External links in post body (70-80% reach reduction)',
      'Engagement bait phrases ("Tag a friend", "Share if you agree")',
      'Clickbait headlines that overpromise',
      'Posting more than 2x per day (content cannibalizes itself)',
      'Buying likes/followers (Facebook detects and penalizes)',
      'Repetitive content — same text/image posted multiple times',
      'Content flagged by users or fact-checkers',
      'Mass auto-posting across multiple Groups simultaneously',
    ],
    minPostIntervalHours: 6,
    maxPromotionalPercent: 20,
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

    engagementVelocity: {
      goldenWindowMinutes: 60,
      assessmentWindowMinutes: 480,
      tip: 'LinkedIn algorithm has a "golden hour" — first 60 min engagement determines distribution. But LinkedIn content has a long tail — posts can resurface 3-7 days later if engagement continues.',
    },
    engagementSignals: [
      { signal: 'Dwell time (reading)', weight: 10, note: 'Time spent reading post is the #1 signal — longer posts that are formatted well score highest' },
      { signal: 'Comments', weight: 9, note: 'First 60 min comments are critical; reply to every single one immediately' },
      { signal: 'Shares/Reposts', weight: 8, note: 'Shared to someone\'s network = massive distribution expansion' },
      { signal: 'Reactions', weight: 5, note: 'Quick signal but lower weight than dwell time or comments' },
      { signal: '"See more" clicks', weight: 7, note: 'Expanding a post = explicit interest signal to algorithm' },
      { signal: 'Follows from post', weight: 8, note: 'Strong discovery signal; indicates valuable content' },
      { signal: 'External link clicks', weight: 3, note: 'LinkedIn deprioritizes posts with links — but clicks on links in comments still count' },
    ],
    contentFormatRanking: [
      { format: 'Document/Carousel (PDF)', reachMultiplier: 3.0, engagementRate: 3.2, note: 'Swipe-through PDFs get 3x reach; high dwell time from multiple slides' },
      { format: 'Text-only post', reachMultiplier: 2.0, engagementRate: 2.1, note: 'Well-formatted text posts with hook get strong dwell time' },
      { format: 'Image + text', reachMultiplier: 1.5, engagementRate: 1.8, note: 'Infographics and charts with explanatory text' },
      { format: 'Poll', reachMultiplier: 2.5, engagementRate: 3.5, note: 'Polls get massive engagement; each vote = interaction signal' },
      { format: 'Native video', reachMultiplier: 1.2, engagementRate: 1.5, note: 'Video still underperforms text on LinkedIn in 2025-2026' },
      { format: 'Link post', reachMultiplier: 0.4, engagementRate: 0.8, note: 'External links severely penalized — put in first comment' },
      { format: 'Article (LinkedIn native)', reachMultiplier: 1.0, engagementRate: 1.0, note: 'LinkedIn Articles get moderate reach; best for long-form SEO' },
    ],
    growthTactics: [
      'Post text-only or carousel posts — these formats get 2-3x reach on LinkedIn',
      'Write a compelling first line (hook before "see more" fold) — determines if post expands',
      'Reply to EVERY comment within the first 60 minutes (golden hour)',
      'Format with line breaks and short paragraphs — wall of text kills dwell time',
      'Share personal stories and lessons learned — personal outperforms corporate 5:1',
      'End every post with a genuine question to drive comments',
      'Comment on 5-10 posts from others in your niche daily (builds visibility)',
      'Post Mon-Fri only; Tue-Thu are peak days',
      'Use document/carousel posts for step-by-step guides and frameworks',
      'Tag relevant people (sparingly, 1-2 max) — their network sees the post',
    ],
    suppressionTriggers: [
      'External links in post body (use first comment instead)',
      'Posting on weekends (60-80% less distribution)',
      'More than 2 posts per day (self-cannibalization)',
      'Engagement pods (LinkedIn actively detects artificial engagement patterns)',
      'More than 5 hashtags',
      'Editing a post within first 10 min (resets algorithm assessment)',
      'Tagging more than 5 people (looks spammy)',
      'Political/controversial content without professional relevance',
      'Connection request spam after posting',
    ],
    minPostIntervalHours: 8,
    maxPromotionalPercent: 15,
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

    engagementVelocity: {
      goldenWindowMinutes: 20,
      assessmentWindowMinutes: 90,
      tip: 'X/Twitter algorithm is the fastest — first 20 minutes of engagement determine reach. Tweets that get replies in first 5 min see 2-3x more distribution.',
    },
    engagementSignals: [
      { signal: 'Replies', weight: 10, note: 'Replies are the most weighted signal; reply threads = conversation = high algorithmic value' },
      { signal: 'Retweets/Reposts', weight: 9, note: 'Amplification to other networks; strongest growth signal' },
      { signal: 'Quote tweets', weight: 8, note: 'Adds context; weighted higher than plain retweets' },
      { signal: 'Likes', weight: 5, note: 'Quick signal; lower weight but contributes to velocity' },
      { signal: 'Bookmarks', weight: 7, note: 'Private saves; strong signal of value (added as ranking signal 2024)' },
      { signal: 'Follows from tweet', weight: 8, note: 'Discovery metric; means content is converting' },
      { signal: 'Link clicks', weight: 4, note: 'Lower weight; X deprioritizes tweets with external links' },
    ],
    contentFormatRanking: [
      { format: 'Thread (3-7 tweets)', reachMultiplier: 2.5, engagementRate: 1.8, note: 'Threads get 2.5x more impressions than single tweets; each tweet = new chance to engage' },
      { format: 'Tweet with image', reachMultiplier: 1.8, engagementRate: 1.5, note: 'Images increase engagement 150% over text-only' },
      { format: 'Tweet with poll', reachMultiplier: 2.0, engagementRate: 2.5, note: 'Polls drive massive engagement; each vote counts as interaction' },
      { format: 'Text-only tweet', reachMultiplier: 1.0, engagementRate: 0.8, note: 'Baseline; bold opinions/hot takes can outperform other formats' },
      { format: 'Tweet with video', reachMultiplier: 1.5, engagementRate: 1.2, note: 'Native video gets moderate boost; outperforms YouTube links' },
      { format: 'Tweet with link', reachMultiplier: 0.5, engagementRate: 0.5, note: 'External links significantly suppressed — put link in reply thread' },
    ],
    growthTactics: [
      'Post threads (3-7 tweets) for 2.5x more impressions than single tweets',
      'Reply to large accounts in your niche within minutes of their posts',
      'Use quote tweets to add context — more discoverable than plain retweets',
      'Ask questions and create polls to drive reply velocity',
      'Post 3-5x per day at consistent peak hours',
      'Create "saves-worthy" content — bookmarks are a major ranking signal',
      'Join trending conversations with relevant, insightful takes',
      'Use images whenever possible (150% engagement boost)',
      'Short, punchy tweets (under 100 chars) get more retweets',
    ],
    suppressionTriggers: [
      'External links in main tweet body (put in reply instead)',
      'More than 2-3 hashtags per tweet',
      'Automated mass-tweeting behavior',
      'Identical content posted repeatedly',
      'Mass follow/unfollow behavior',
      'Engagement in pods or artificial boost groups',
      'Replying to many tweets in rapid succession (spam detection)',
      'Using forbidden shortened URLs or spam domains',
    ],
    minPostIntervalHours: 2,
    maxPromotionalPercent: 20,
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

    engagementVelocity: {
      goldenWindowMinutes: 120,
      assessmentWindowMinutes: 2880,  // 48 hours
      tip: 'YouTube has a slow but long-lived algorithm. First 48 hours determine initial distribution. But successful videos can get pushed weeks/months later through suggested and browse.',
    },
    engagementSignals: [
      { signal: 'Watch time (total)', weight: 10, note: 'Total minutes watched is the #1 ranking factor for long-form' },
      { signal: 'Click-through rate (CTR)', weight: 9, note: 'Thumbnail + title CTR from impressions; 5-10% is good, 10%+ is excellent' },
      { signal: 'Average view duration', weight: 9, note: 'What % of the video people watch; 50%+ is strong' },
      { signal: 'Likes', weight: 5, note: 'Contributes to engagement score but secondary to watch metrics' },
      { signal: 'Comments', weight: 6, note: 'Comments signal active engagement; reply to drive more' },
      { signal: 'Shares', weight: 7, note: 'Shared off-platform is a strong signal of value' },
      { signal: 'Subscribes from video', weight: 8, note: 'New subscriber from video = strong discovery signal' },
      { signal: 'Session watch time', weight: 9, note: 'Does your video lead to more YouTube watching? Rewarded heavily.' },
    ],
    contentFormatRanking: [
      { format: 'YouTube Shorts (15-60s)', reachMultiplier: 3.0, engagementRate: 3.5, note: 'Shorts get massive reach to non-subscribers; best for growth' },
      { format: 'Long-form (8-15 min)', reachMultiplier: 1.5, engagementRate: 1.2, note: 'Best for watch time and ad revenue; builds deep audience' },
      { format: 'Long-form (15-30 min)', reachMultiplier: 1.0, engagementRate: 0.9, note: 'High total watch time but lower completion rate' },
      { format: 'Community post', reachMultiplier: 0.8, engagementRate: 2.0, note: 'Keeps channel active between uploads; polls get high engagement' },
      { format: 'Live stream', reachMultiplier: 1.2, engagementRate: 2.5, note: 'Priority notifications to subscribers; high engagement during live' },
    ],
    growthTactics: [
      'Post 1 long-form video + 3-5 Shorts per week (ideal mix for growth)',
      'Optimize thumbnails — CTR is the gateway metric; test different designs',
      'Write SEO-optimized titles and descriptions (YouTube is a search engine)',
      'Hook viewers in first 30 seconds — average view duration starts from second 1',
      'Use end screens and cards to drive more watch time per session',
      'Reply to comments in first 2 hours — boosts engagement signals',
      'Use Community posts between uploads to keep audience engaged',
      'Create series/playlists — drives binge watching and session time',
      'Add timestamps in description — improves SEO and user experience',
      'Post Shorts from long-form clips to funnel viewers to full videos',
    ],
    suppressionTriggers: [
      'Clickbait thumbnails/titles that don\'t deliver (low retention = penalty)',
      'Reused content from other channels',
      'Content violating advertiser-friendly guidelines (demonetization)',
      'Sudden change in niche (algorithm confused about audience)',
      'No description, tags, or SEO optimization',
      'Low-quality audio (more important than video quality)',
      'Begging for likes/subscribes excessively',
      'Copyright strikes or community guideline violations',
    ],
    minPostIntervalHours: 24,
    maxPromotionalPercent: 25,
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

    engagementVelocity: {
      goldenWindowMinutes: 60,
      assessmentWindowMinutes: 10080,  // 7 days — Pinterest is evergreen
      tip: 'Pinterest is evergreen — pins can gain traction weeks or months after posting. First hour engagement helps initial distribution, but long-term SEO matters more than velocity.',
    },
    engagementSignals: [
      { signal: 'Saves (re-pins)', weight: 10, note: 'Saves are the #1 signal — each save distributes to another user\'s followers' },
      { signal: 'Outbound clicks', weight: 9, note: 'Link clicks are highly valued — Pinterest drives traffic to websites' },
      { signal: 'Close-up (zoom)', weight: 7, note: 'User zooming into a pin = strong interest signal' },
      { signal: 'Keyword relevance', weight: 8, note: 'Pinterest is a search engine; keyword match in description/title is critical' },
      { signal: 'Freshness', weight: 6, note: 'New original pins weighted higher than re-pins of existing content' },
      { signal: 'Domain authority', weight: 7, note: 'Pins linking to authoritative domains rank higher' },
    ],
    contentFormatRanking: [
      { format: 'Idea Pin (multi-page)', reachMultiplier: 2.5, engagementRate: 2.0, note: 'Idea Pins get priority in feed; multi-page = more engagement signals' },
      { format: 'Video Pin (6-60s)', reachMultiplier: 2.0, engagementRate: 1.8, note: 'Auto-play in feed; stops scroll; growing priority' },
      { format: 'Standard Pin (vertical image)', reachMultiplier: 1.0, engagementRate: 1.0, note: 'Baseline; 2:3 aspect ratio mandatory for best display' },
      { format: 'Product Pin (shopping)', reachMultiplier: 1.5, engagementRate: 1.5, note: 'Shoppable pins get bonus distribution in Shopping tab' },
    ],
    growthTactics: [
      'Pin 3-5 fresh, original pins daily (consistency > volume)',
      'Write keyword-rich descriptions — Pinterest is a visual search engine',
      'Use 2:3 vertical images (1000x1500px) — required for optimal display',
      'Create Idea Pins for educational/step-by-step content (priority in feed)',
      'Pin seasonal content 45-60 days before events/holidays',
      'Use keyword-rich board titles and descriptions for SEO',
      'Include clear CTA and website link on every pin',
      'Claim your website for domain authority boost',
      'Use Pinterest Trends tool to find rising keywords in your niche',
    ],
    suppressionTriggers: [
      'Horizontal images (poor mobile display, lower distribution)',
      'Missing or generic pin descriptions',
      'Spammy re-pinning of same content to many boards',
      'Broken destination links (404 errors = trust penalty)',
      'Low-quality or pixelated images',
      'Too many pins per day from same domain (>25)',
      'Copyright-infringing images',
    ],
    minPostIntervalHours: 2,
    maxPromotionalPercent: 40,  // Pinterest is inherently commercial/shopping-oriented
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

    engagementVelocity: {
      goldenWindowMinutes: 30,
      assessmentWindowMinutes: 120,
      tip: 'Threads shares the Instagram algorithm DNA. First 30 min engagement determines reach tier. Cross-posting from Instagram gives an initial distribution boost.',
    },
    engagementSignals: [
      { signal: 'Replies', weight: 10, note: 'Reply depth is the #1 signal — conversation threads get priority distribution' },
      { signal: 'Likes', weight: 6, note: 'Quick engagement signal; lower weight than replies' },
      { signal: 'Reposts', weight: 8, note: 'Amplification to new networks; strong growth signal' },
      { signal: 'Quotes', weight: 8, note: 'Quote posts add context; valued higher than plain reposts' },
      { signal: 'Follows from thread', weight: 9, note: 'New follower from a thread = strong discovery signal' },
      { signal: 'Cross-platform engagement', weight: 5, note: 'Instagram connection adds trust signal' },
    ],
    contentFormatRanking: [
      { format: 'Text-only (hot take/opinion)', reachMultiplier: 2.0, engagementRate: 2.5, note: 'Short, opinion-driven text posts get highest reply rates' },
      { format: 'Text with image', reachMultiplier: 1.5, engagementRate: 1.8, note: 'Visual enhancement helps stop the scroll' },
      { format: 'Question/poll', reachMultiplier: 2.5, engagementRate: 3.0, note: 'Questions drive massive reply engagement' },
      { format: 'Cross-posted from Instagram', reachMultiplier: 1.3, engagementRate: 1.2, note: 'Meta boosts cross-platform activity between IG and Threads' },
      { format: 'Long text (300+ chars)', reachMultiplier: 0.8, engagementRate: 1.0, note: 'Threads rewards brevity; shorter posts perform better' },
    ],
    growthTactics: [
      'Post 2-3x daily — Threads rewards consistent high-frequency posting',
      'Create conversation starters — questions and hot takes drive the most replies',
      'Reply to trending threads early to get visibility',
      'Cross-post from Instagram for initial distribution boost',
      'Keep posts under 200 characters for best engagement rates',
      'Join active discussions — Threads favors conversational users',
      'Use topic tags (not hashtags) for categorization',
      'Share unique perspectives/opinions — Threads is opinion-first platform',
    ],
    suppressionTriggers: [
      'Traditional hashtag-heavy posts (Threads uses topic tags)',
      'Long-form content exceeding 500 characters',
      'Purely promotional/sales content without value',
      'Auto-posted content without platform-native optimization',
      'Spam replying to many accounts rapidly',
      'Content with external links (lower priority)',
    ],
    minPostIntervalHours: 3,
    maxPromotionalPercent: 15,
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

    engagementVelocity: {
      goldenWindowMinutes: 60,
      assessmentWindowMinutes: 60,
      tip: 'No algorithm — pure chronological. Posting at peak times is the ONLY way to maximize visibility. Boosts extend reach beyond your followers.',
    },
    engagementSignals: [
      { signal: 'Boosts (retoots)', weight: 10, note: 'Only way to reach beyond your followers — boosts are the primary growth mechanism' },
      { signal: 'Favourites (likes)', weight: 5, note: 'Shows appreciation but does not extend reach' },
      { signal: 'Replies', weight: 7, note: 'Thread conversations show up in followers\' timelines' },
      { signal: 'Hashtag relevance', weight: 9, note: 'Hashtags are THE discovery mechanism on Mastodon — no algorithm to replace them' },
    ],
    contentFormatRanking: [
      { format: 'Text + image with alt text', reachMultiplier: 1.5, engagementRate: 2.0, note: 'Alt text is culturally expected; image posts get more boosts' },
      { format: 'Text-only with hashtags', reachMultiplier: 1.0, engagementRate: 1.0, note: 'Baseline; hashtags provide discoverability' },
      { format: 'Thread (multi-post)', reachMultiplier: 1.3, engagementRate: 1.5, note: 'Threaded posts show depth; each post can be individually boosted' },
      { format: 'Poll', reachMultiplier: 1.8, engagementRate: 2.5, note: 'Polls drive engagement; each vote = interaction' },
    ],
    growthTactics: [
      'Use relevant CamelCase hashtags in every post (#OpenSource, #WebDev)',
      'Always include alt text on images (community norm; expected)',
      'Boost/retoot others\' content — community reciprocity drives growth',
      'Engage in conversations — reply to others in your niche',
      'Use Content Warnings (CW) appropriately — community norm',
      'Post at peak times — chronological feed means timing is critical',
      'Join relevant instances for your niche — local timeline = free discovery',
    ],
    suppressionTriggers: [
      'Missing alt text on images (community will report/unfollow)',
      'Cross-posting from Twitter without optimization',
      'Ignoring content warning conventions',
      'Overtly promotional/commercial content',
      'Not engaging with replies or community',
      'Using non-CamelCase hashtags (accessibility issue)',
    ],
    minPostIntervalHours: 3,
    maxPromotionalPercent: 10,
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

    engagementVelocity: {
      goldenWindowMinutes: 30,
      assessmentWindowMinutes: 60,
      tip: 'Chronological by default but custom feed generators can surface older content. Posting at peak activity times is critical for maximum visibility.',
    },
    engagementSignals: [
      { signal: 'Reposts', weight: 10, note: 'Amplification to new audiences — primary growth mechanism' },
      { signal: 'Replies', weight: 9, note: 'Conversation depth highly valued by community' },
      { signal: 'Likes', weight: 5, note: 'Signal of appreciation but does not extend reach significantly' },
      { signal: 'Follows from post', weight: 8, note: 'New follower = content resonated with new audience' },
      { signal: 'Custom feed inclusion', weight: 7, note: 'Being included in popular custom feeds = massive ongoing reach' },
    ],
    contentFormatRanking: [
      { format: 'Text-only (opinion/take)', reachMultiplier: 1.5, engagementRate: 2.0, note: 'Short, conversational posts perform best' },
      { format: 'Text with image', reachMultiplier: 1.3, engagementRate: 1.5, note: 'Visual content helps stop the scroll' },
      { format: 'Thread/conversation', reachMultiplier: 1.8, engagementRate: 2.5, note: 'Conversations get spread through custom feeds' },
      { format: 'Quote post', reachMultiplier: 1.5, engagementRate: 1.8, note: 'Adding context to others posts drives engagement' },
    ],
    growthTactics: [
      'Engage consistently — reply to others, join conversations',
      'Post 3-5x daily; Bluesky rewards high-frequency authentic posters',
      'Get included in popular custom feed generators for your niche',
      'Be an early commenter on trending discussions',
      'Share unique takes — Bluesky values originality over polish',
      'Cross-promote from other platforms to bring your audience',
    ],
    suppressionTriggers: [
      'Automated/bot-like posting patterns',
      'Purely promotional content',
      'Spam replies to many users',
      'Content violating community standards',
    ],
    minPostIntervalHours: 2,
    maxPromotionalPercent: 15,
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

    engagementVelocity: {
      goldenWindowMinutes: 30,
      assessmentWindowMinutes: 60,
      tip: 'Push-based platform — no algorithm. Timing is everything. Members receive notifications immediately. Best open rates within 30 min of posting.',
    },
    engagementSignals: [
      { signal: 'Message views', weight: 8, note: 'View count is the primary metric for channel health' },
      { signal: 'Reactions', weight: 9, note: 'Emoji reactions = main engagement mechanism; gauge audience preferences' },
      { signal: 'Forwards/shares', weight: 10, note: 'Forwarded messages reach new audiences — primary growth mechanism' },
      { signal: 'Replies (in groups)', weight: 7, note: 'Discussion depth shows community health' },
      { signal: 'Poll votes', weight: 8, note: 'Polls drive high interaction rates' },
    ],
    contentFormatRanking: [
      { format: 'Photo + formatted text', reachMultiplier: 2.0, engagementRate: 2.5, note: 'Rich media gets 2x more engagement than text-only' },
      { format: 'Poll', reachMultiplier: 2.5, engagementRate: 3.0, note: 'Polls drive highest interaction rates on Telegram' },
      { format: 'Text with Markdown formatting', reachMultiplier: 1.0, engagementRate: 1.0, note: 'Baseline; use bold, italic, and code blocks' },
      { format: 'Video/GIF', reachMultiplier: 1.8, engagementRate: 2.0, note: 'Auto-play; good for tutorials and demos' },
      { format: 'Document/file', reachMultiplier: 0.8, engagementRate: 0.7, note: 'Useful for resources but lower engagement' },
    ],
    growthTactics: [
      'Post at consistent times — subscribers learn your schedule',
      'Use rich media (photos, infographics) — 2x engagement vs text',
      'Run polls regularly — highest engagement format on Telegram',
      'Keep messages concise and well-formatted with Markdown',
      'Pin important messages for new subscriber discovery',
      'Cross-promote your channel in related Telegram groups',
      'Use reactions to gauge audience preferences and adapt content',
    ],
    suppressionTriggers: [
      'Too many messages per day (causes mass unfollows)',
      'Walls of unformatted text',
      'Excessive use of @everyone or silent notifications',
      'Spam content or repetitive messages',
    ],
    minPostIntervalHours: 4,
    maxPromotionalPercent: 25,
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

    engagementVelocity: {
      goldenWindowMinutes: 30,
      assessmentWindowMinutes: 60,
      tip: 'Chronological — no algorithm within channels. Posting when community is most active is critical. Server Discovery algorithm evaluates overall server activity.',
    },
    engagementSignals: [
      { signal: 'Reactions (emoji)', weight: 9, note: 'Primary engagement mechanism; custom server emojis drive community identity' },
      { signal: 'Thread engagement', weight: 8, note: 'Threads keep conversations organized and signal active community' },
      { signal: 'Message replies', weight: 7, note: 'Discussion depth shows healthy community' },
      { signal: 'Server activity', weight: 10, note: 'For Server Discovery: active servers with regular engagement rank higher' },
      { signal: 'Event participation', weight: 6, note: 'Scheduled events drive recurring engagement' },
    ],
    contentFormatRanking: [
      { format: 'Embed with image', reachMultiplier: 1.5, engagementRate: 2.0, note: 'Rich embeds with previews get more clicks and reactions' },
      { format: 'Announcement with @mentions', reachMultiplier: 2.0, engagementRate: 2.5, note: 'Pings drive immediate attention but use sparingly' },
      { format: 'Text message', reachMultiplier: 1.0, engagementRate: 1.0, note: 'Baseline; conversational messages' },
      { format: 'Thread discussion', reachMultiplier: 1.3, engagementRate: 1.8, note: 'Organized discussions drive deeper engagement' },
      { format: 'Event/scheduled activity', reachMultiplier: 1.5, engagementRate: 3.0, note: 'Events drive highest recurring engagement' },
    ],
    growthTactics: [
      'Host regular events (AMA, game nights, Q&A) to drive recurring engagement',
      'Use rich embeds with images for announcements',
      'Create topic-specific channels — organized servers attract more members',
      'Engage with community — Discord is about conversation, not broadcasting',
      'Use threads for longer discussions to keep channels clean',
      'Create custom roles and reaction roles for community identity',
    ],
    suppressionTriggers: [
      'Excessive @everyone or @here pings (causes mass muting)',
      'Auto-posting without community context',
      'Purely promotional content without value',
      'Spam in multiple channels simultaneously',
      'Not moderating community (toxic environment drives members away)',
    ],
    minPostIntervalHours: 4,
    maxPromotionalPercent: 15,
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

    engagementVelocity: {
      goldenWindowMinutes: 60,
      assessmentWindowMinutes: 360,
      tip: 'Reddit uses "hot" ranking — upvotes in first hour determine if post reaches front page of subreddit. Post at 6-8 AM EST for maximum US audience during peak hours.',
    },
    engagementSignals: [
      { signal: 'Upvote velocity', weight: 10, note: 'Upvotes per minute in first hour is THE ranking signal for hot sort' },
      { signal: 'Comment count', weight: 9, note: 'More comments = more engaging content; drives post higher in hot' },
      { signal: 'Comment depth (replies)', weight: 8, note: 'Deep reply chains signal genuine discussion' },
      { signal: 'Upvote ratio', weight: 7, note: 'High upvote:downvote ratio = quality content signal' },
      { signal: 'Awards/Gold', weight: 6, note: 'Premium awards boost visibility significantly' },
      { signal: 'Cross-post engagement', weight: 5, note: 'Content cross-posted to other subreddits multiplies reach' },
    ],
    contentFormatRanking: [
      { format: 'Text post (discussion)', reachMultiplier: 1.5, engagementRate: 2.0, note: 'Genuine questions/discussions get highest engagement per subreddit' },
      { format: 'Image post', reachMultiplier: 2.0, engagementRate: 1.5, note: 'Images get quick upvotes; good for r/all potential' },
      { format: 'Link post (to own content)', reachMultiplier: 0.5, engagementRate: 0.5, note: 'Self-promotion is heavily penalized unless genuinely valuable' },
      { format: 'Video (native upload)', reachMultiplier: 1.3, engagementRate: 1.2, note: 'Reddit video player; growing but underperforms images' },
      { format: 'AMA/discussion', reachMultiplier: 3.0, engagementRate: 4.0, note: 'Ask Me Anything posts drive massive engagement in relevant subreddits' },
    ],
    growthTactics: [
      'Follow the 10:1 rule — 10 community posts for every 1 self-promotion',
      'Build karma in target subreddits before posting your content',
      'Write compelling, honest titles — titles determine click-through',
      'Post at 6-8 AM EST on Monday-Wednesday for maximum visibility',
      'Engage in comments — Reddit rewards authentic participation',
      'Follow each subreddit\'s specific rules strictly',
      'Cross-post relevant content to related subreddits (not simultaneously)',
      'Use text posts for discussions — they invite more engagement',
    ],
    suppressionTriggers: [
      'Overt self-promotion (triggers spam filters and moderator action)',
      'More than 10% promotional content from your account',
      'Ignoring subreddit rules (instant ban in many subreddits)',
      'New account posting immediately (need karma first)',
      'Cross-posting identical content to many subreddits at once',
      'Vote manipulation (using multiple accounts)',
      'Shortened URLs or affiliate links without disclosure',
      'Not disclosing affiliations when relevant',
    ],
    minPostIntervalHours: 8,
    maxPromotionalPercent: 10,
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

    engagementVelocity: {
      goldenWindowMinutes: 120,
      assessmentWindowMinutes: 1440,  // 24 hours
      tip: 'Medium algorithm distributes content over 24 hours. First 2 hours of claps/reads determine if article gets pushed to topic pages and email digests.',
    },
    engagementSignals: [
      { signal: 'Read completion rate', weight: 10, note: 'Readers who scroll to end = strongest quality signal' },
      { signal: 'Read time', weight: 9, note: 'Total time spent reading; 7-10 min articles perform best' },
      { signal: 'Claps (up to 50 per reader)', weight: 7, note: 'Multiple claps from one reader = strong approval signal' },
      { signal: 'Highlights', weight: 8, note: 'Highlighted passages = readers found specific value' },
      { signal: 'Responses (comments)', weight: 7, note: 'Thoughtful responses drive continued distribution' },
      { signal: 'Follows from article', weight: 8, note: 'New follower = content converted reader to subscriber' },
    ],
    contentFormatRanking: [
      { format: 'Long-form article (7-10 min read)', reachMultiplier: 2.0, engagementRate: 2.5, note: 'Sweet spot for Medium algorithm; enough depth to show value' },
      { format: 'Tutorial/How-to (10+ min)', reachMultiplier: 1.5, engagementRate: 2.0, note: 'Step-by-step guides with images perform well' },
      { format: 'Listicle (5-7 min)', reachMultiplier: 1.3, engagementRate: 1.5, note: 'Scannable format; good completion rates' },
      { format: 'Short post (under 3 min)', reachMultiplier: 0.5, engagementRate: 0.5, note: 'Low read time = low priority in Medium algorithm' },
    ],
    growthTactics: [
      'Aim for 7-10 minute read articles — the algorithm\'s sweet spot',
      'Publish in established Medium publications for wider distribution',
      'Write compelling headlines and subtitles (determines CTR from email digest)',
      'Use images/charts every 200-300 words to break up text',
      'Include a featured image for better presentation in feeds',
      'Post 1-2 quality articles per week (quality > frequency)',
      'Use all 5 tags strategically — match topic pages you want to appear on',
      'Engage with other writers in your niche (clap, respond, follow)',
    ],
    suppressionTriggers: [
      'Short, low-effort posts (under 3 min read)',
      'Articles without featured images',
      'Missing tags (no distribution to topic pages)',
      'Clickbait headlines that don\'t deliver',
      'Republished content without canonical URL',
      'Excessive self-promotion links in articles',
    ],
    minPostIntervalHours: 24,
    maxPromotionalPercent: 20,
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

    engagementVelocity: {
      goldenWindowMinutes: 120,
      assessmentWindowMinutes: 1440,
      tip: 'Dev.to promotes articles on the feed based on reactions in the first few hours. Getting featured on the front page or weekly email drives massive views.',
    },
    engagementSignals: [
      { signal: 'Hearts/Reactions (❤️ 🦄 🔖)', weight: 10, note: 'Three reaction types: heart (like), unicorn (amazing), reading list (save). All contribute.' },
      { signal: 'Comments', weight: 8, note: 'Discussion depth drives visibility and community engagement' },
      { signal: 'Bookmarks (🔖)', weight: 9, note: 'Saved to reading list = high-value content signal' },
      { signal: 'Reading time', weight: 7, note: 'Longer reads with high completion = quality content' },
      { signal: 'Follows from article', weight: 8, note: 'New follower = content resonated with developer audience' },
    ],
    contentFormatRanking: [
      { format: 'Tutorial with code examples', reachMultiplier: 2.5, engagementRate: 3.0, note: 'Step-by-step tutorials with working code = highest engagement' },
      { format: '"How I built..." story', reachMultiplier: 2.0, engagementRate: 2.5, note: 'Personal build stories resonate strongly with developer community' },
      { format: 'Listicle/tips article', reachMultiplier: 1.5, engagementRate: 1.8, note: '"10 things I learned" format performs well' },
      { format: 'Opinion/discussion piece', reachMultiplier: 1.0, engagementRate: 1.5, note: 'Hot takes drive comments but lower save rate' },
    ],
    growthTactics: [
      'Write tutorials with working code examples — highest engagement on dev.to',
      'Use "How I built..." format for project stories',
      'Include cover images — increases CTR significantly',
      'Post 1-2 articles per week consistently',
      'Use all 4 tags strategically (#javascript, #webdev, #tutorial, #react)',
      'Engage in comments — dev.to rewards community participation',
      'Cross-post from your blog with canonical URLs (good for SEO)',
      'Write beginner-friendly content — largest audience segment',
    ],
    suppressionTriggers: [
      'Non-technical content (dev.to is for developers)',
      'Articles without code examples or practical value',
      'Missing cover images (lower CTR in feed)',
      'Excessive self-promotion or product pitches',
      'Articles behind paywalls (dev.to values open access)',
      'Duplicate content without canonical URLs',
    ],
    minPostIntervalHours: 24,
    maxPromotionalPercent: 15,
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

    engagementVelocity: {
      goldenWindowMinutes: 60,
      assessmentWindowMinutes: 60,
      tip: 'No central algorithm. Relay selection determines reach. Post when your target audience relays are most active.',
    },
    engagementSignals: [
      { signal: 'Zaps (Lightning tips)', weight: 10, note: 'Lightning micropayments are the strongest engagement signal in Nostr culture' },
      { signal: 'Reposts', weight: 9, note: 'Relay-based amplification; reposts reach new relay audiences' },
      { signal: 'Reactions', weight: 6, note: 'Like equivalents; show appreciation but limited reach expansion' },
      { signal: 'Replies', weight: 7, note: 'Conversation threads visible to relay audiences' },
      { signal: 'Relay inclusion', weight: 8, note: 'Being on popular relays = more visibility' },
    ],
    contentFormatRanking: [
      { format: 'Short note (tweet-length)', reachMultiplier: 1.5, engagementRate: 2.0, note: 'Quick thoughts and opinions; Nostr native format' },
      { format: 'Note with image', reachMultiplier: 1.3, engagementRate: 1.5, note: 'Visual content gets more engagement' },
      { format: 'Long-form article', reachMultiplier: 1.0, engagementRate: 1.0, note: 'NIP-23 long-form; smaller audience but dedicated readers' },
      { format: 'Thread (multiple notes)', reachMultiplier: 1.2, engagementRate: 1.3, note: 'Multi-note threads for longer discussions' },
    ],
    growthTactics: [
      'Connect to multiple popular relays for maximum distribution',
      'Earn zaps by providing genuine value — financial engagement = social proof',
      'Focus on crypto, tech, privacy, and decentralization topics',
      'Engage authentically — Nostr community values non-corporate voices',
      'Use relevant hashtags for relay-based content discovery',
      'Cross-promote your Nostr npub on other platforms',
    ],
    suppressionTriggers: [
      'Overtly commercial content not aligned with community values',
      'Content perceived as corporate marketing',
      'Spam-like posting patterns',
      'Controversial content unrelated to Nostr values',
    ],
    minPostIntervalHours: 3,
    maxPromotionalPercent: 10,
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

    engagementVelocity: {
      goldenWindowMinutes: 60,
      assessmentWindowMinutes: 180,
      tip: 'Emerging platform — consistent posting and community engagement are the primary growth drivers.',
    },
    engagementSignals: [
      { signal: 'Likes', weight: 7, note: 'Primary engagement metric' },
      { signal: 'Comments', weight: 9, note: 'Comments drive visibility in the feed' },
      { signal: 'Shares', weight: 10, note: 'Shared content reaches new audiences' },
      { signal: 'Follows from post', weight: 8, note: 'New follower = content resonated' },
    ],
    contentFormatRanking: [
      { format: 'Image + text', reachMultiplier: 1.5, engagementRate: 1.8, note: 'Visual content with text gets best engagement' },
      { format: 'Text-only', reachMultiplier: 1.0, engagementRate: 1.0, note: 'Baseline format' },
      { format: 'Article/long-form', reachMultiplier: 1.2, engagementRate: 1.3, note: 'In-depth content for interested audiences' },
    ],
    growthTactics: [
      'Post consistently — daily posting builds visibility on emerging platforms',
      'Mix text and image posts for variety and engagement',
      'Engage with community through comments and shares',
      'Be an early adopter — first-mover advantage on newer platforms',
      'Cross-promote from larger platforms to bring your audience',
    ],
    suppressionTriggers: [
      'Spam or repetitive content',
      'Low-quality images or content',
      'Excessive self-promotion without value',
    ],
    minPostIntervalHours: 4,
    maxPromotionalPercent: 20,
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
 * v2: Now includes engagement signals, growth tactics, and suppression triggers.
 */
export function getContentGenerationContext(platform: string): string {
  const config = PLATFORM_ALGORITHM[platform];
  if (!config) return '';

  const lines: string[] = [
    `Platform: ${config.name}`,
    `Primary metric: ${config.primaryMetric}`,
    `Category: ${config.platformCategory}`,
    `Algorithm: ${config.hasAlgorithm ? 'Yes (algorithmic feed)' : 'Chronological'}`,
    '',
    '=== RANKING FACTORS (by importance) ===',
    ...config.rankingFactors.map((f, i) => `${i + 1}. ${f}`),
    '',
    '=== TOP ENGAGEMENT SIGNALS ===',
    ...config.engagementSignals
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 5)
      .map(s => `- ${s.signal} (weight: ${s.weight}/10) — ${s.note}`),
    '',
    '=== BEST CONTENT FORMATS (by reach) ===',
    ...config.contentFormatRanking
      .sort((a, b) => b.reachMultiplier - a.reachMultiplier)
      .map(f => `- ${f.format}: ${f.reachMultiplier}x reach, ${f.engagementRate}% engagement — ${f.note}`),
    '',
    '=== CONTENT TIPS ===',
    ...config.contentTips.map(tip => `- ${tip}`),
    '',
    '=== GROWTH TACTICS ===',
    ...config.growthTactics.slice(0, 5).map(t => `- ${t}`),
    '',
    '=== AVOID (suppression triggers) ===',
    ...config.avoid.map(item => `- ${item}`),
    ...config.suppressionTriggers.slice(0, 3).map(t => `- SUPPRESS: ${t}`),
    '',
    `Caption: ${config.caption.optimalLength.min}-${config.caption.optimalLength.max} chars optimal, max ${config.caption.maxLength}`,
    `Hashtags: ${config.hashtags.recommended} recommended (${config.hashtags.note})`,
    `Tone: ${config.bestTones.join(', ')}`,
    `Engagement velocity: First ${config.engagementVelocity.goldenWindowMinutes} min are critical — ${config.engagementVelocity.tip}`,
    `Max promotional: ${config.maxPromotionalPercent}% of posts should be promotional`,
    '',
    config.aiGenerationNotes,
  ];

  return lines.join('\n');
}

/**
 * Get the best content format for a platform based on reach multiplier.
 * Returns the format with the highest reach potential.
 */
export function getBestContentFormat(platform: string): ContentFormatRank | null {
  const config = PLATFORM_ALGORITHM[platform];
  if (!config || config.contentFormatRanking.length === 0) return null;

  return config.contentFormatRanking.reduce((best, current) =>
    current.reachMultiplier > best.reachMultiplier ? current : best
  );
}

/**
 * Get the minimum hours between posts for a platform.
 * Used by the plan generator to space posts properly.
 */
export function getMinPostInterval(platform: string): number {
  const config = PLATFORM_ALGORITHM[platform];
  return config?.minPostIntervalHours || 4;
}

/**
 * Check if a post content type exceeds the promotional limit for a platform.
 * Returns true if adding another promotional post would exceed the limit.
 */
export function wouldExceedPromoLimit(
  platform: string,
  totalPostsPlanned: number,
  promoPostsPlanned: number,
): boolean {
  const config = PLATFORM_ALGORITHM[platform];
  if (!config) return false;

  const promoPercent = ((promoPostsPlanned + 1) / (totalPostsPlanned + 1)) * 100;
  return promoPercent > config.maxPromotionalPercent;
}

/**
 * Get the engagement velocity tip for a platform.
 * Used by the UI to show users when to engage after posting.
 */
export function getEngagementVelocityTip(platform: string): string {
  const config = PLATFORM_ALGORITHM[platform];
  if (!config) return 'Engage with comments quickly after posting.';
  return `Critical: Engage within the first ${config.engagementVelocity.goldenWindowMinutes} minutes. ${config.engagementVelocity.tip}`;
}

/**
 * Get growth tactics for a platform.
 * Used by the Autopilot UI to show actionable tips.
 */
export function getGrowthTactics(platform: string): string[] {
  const config = PLATFORM_ALGORITHM[platform];
  return config?.growthTactics || [];
}

/**
 * Get suppression triggers for a platform.
 * Used by the content generator to ensure we don't trigger algorithm penalties.
 */
export function getSuppressionTriggers(platform: string): string[] {
  const config = PLATFORM_ALGORITHM[platform];
  return config?.suppressionTriggers || [];
}
