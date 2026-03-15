/**
 * RSS Feed Intelligence System
 *
 * Fetches, parses, and analyzes RSS feed content to provide
 * AI-powered content intelligence for autopilot post generation.
 *
 * The system:
 * 1. Fetches RSS feeds configured by the user
 * 2. Extracts recent articles, headlines, and trends
 * 3. Builds a context summary for the AI content generator
 * 4. Supports adaptation modes: always, sometimes, significant_only, never
 */

/** RSS adaptation modes */
export type RssAdaptationMode = 'always' | 'sometimes' | 'significant_only' | 'never';

/** RSS intelligence settings stored in bot.reactorState */
export interface RssIntelligenceSettings {
  /** How often to adapt content based on RSS feeds */
  adaptationMode: RssAdaptationMode;
  /** Maximum number of articles to analyze per feed */
  maxArticlesPerFeed: number;
  /** How many hours back to look for articles (freshness window) */
  freshnessHoursWindow: number;
  /** Whether to extract keywords/topics from feed content */
  extractTopics: boolean;
  /** Whether to learn about audience pain points from content */
  learnAudienceInsights: boolean;
  /** Keywords that trigger "significant event" detection */
  significantEventKeywords: string[];
}

/** Default RSS intelligence settings */
export const DEFAULT_RSS_SETTINGS: RssIntelligenceSettings = {
  adaptationMode: 'sometimes',
  maxArticlesPerFeed: 5,
  freshnessHoursWindow: 48,
  extractTopics: true,
  learnAudienceInsights: true,
  significantEventKeywords: [],
};

/** Parsed RSS article */
export interface RssArticle {
  title: string;
  link: string;
  description: string;
  pubDate: Date | null;
  source: string; // Feed URL
}

/** RSS intelligence context for AI content generation */
export interface RssContext {
  /** Whether RSS context should be applied to this post */
  shouldApply: boolean;
  /** Summary of current trends and news from RSS feeds */
  trendsSummary: string;
  /** Key topics extracted from recent articles */
  topics: string[];
  /** Whether a significant event was detected */
  significantEvent: boolean;
  /** The significant event description if detected */
  significantEventDesc: string | null;
  /** Raw articles for reference */
  articles: RssArticle[];
}

/**
 * Parse RSS/Atom XML into articles.
 * Supports both RSS 2.0 and Atom 1.0 formats.
 */
export function parseRssFeed(xml: string, sourceUrl: string): RssArticle[] {
  const articles: RssArticle[] = [];

  // RSS 2.0: <item> elements
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    const title = extractTag(itemXml, 'title');
    const link = extractTag(itemXml, 'link');
    const description = stripHtml(extractTag(itemXml, 'description'));
    const pubDateStr = extractTag(itemXml, 'pubDate');
    const pubDate = pubDateStr ? new Date(pubDateStr) : null;

    if (title) {
      articles.push({
        title: stripHtml(title).slice(0, 500),
        link: link || '',
        description: description.slice(0, 1000),
        pubDate: pubDate && !isNaN(pubDate.getTime()) ? pubDate : null,
        source: sourceUrl,
      });
    }
  }

  // Atom 1.0: <entry> elements (if no RSS items found)
  if (articles.length === 0) {
    const entryRegex = /<entry[^>]*>([\s\S]*?)<\/entry>/gi;
    while ((match = entryRegex.exec(xml)) !== null) {
      const entryXml = match[1];
      const title = extractTag(entryXml, 'title');
      // Atom links: <link href="..." />
      const linkMatch = /<link[^>]*href=["']([^"']*)["'][^>]*\/?\s*>/i.exec(entryXml);
      const link = linkMatch ? linkMatch[1] : '';
      const summary = stripHtml(extractTag(entryXml, 'summary') || extractTag(entryXml, 'content'));
      const updatedStr = extractTag(entryXml, 'updated') || extractTag(entryXml, 'published');
      const pubDate = updatedStr ? new Date(updatedStr) : null;

      if (title) {
        articles.push({
          title: stripHtml(title).slice(0, 500),
          link,
          description: summary.slice(0, 1000),
          pubDate: pubDate && !isNaN(pubDate.getTime()) ? pubDate : null,
          source: sourceUrl,
        });
      }
    }
  }

  return articles;
}

/**
 * Fetch and parse a single RSS feed URL.
 * Returns empty array on failure (non-blocking).
 */
/**
 * Check if a hostname resolves to a private/internal IP address.
 * Prevents SSRF attacks via user-controlled RSS feed URLs.
 */
function isPrivateUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    const hostname = parsed.hostname;

    // Block obvious private hostnames
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname === '0.0.0.0' ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal')
    ) {
      return true;
    }

    // Block private IP ranges
    const parts = hostname.split('.');
    if (parts.length === 4 && parts.every(p => /^\d+$/.test(p))) {
      const octets = parts.map(Number);
      if (
        octets[0] === 10 ||                                          // 10.0.0.0/8
        (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) || // 172.16.0.0/12
        (octets[0] === 192 && octets[1] === 168) ||                  // 192.168.0.0/16
        (octets[0] === 169 && octets[1] === 254) ||                  // 169.254.0.0/16 (link-local / cloud metadata)
        octets[0] === 127 ||                                          // 127.0.0.0/8
        octets[0] === 0                                               // 0.0.0.0/8
      ) {
        return true;
      }
    }

    // Block non-standard ports that might target internal services
    const port = parsed.port ? parseInt(parsed.port, 10) : (parsed.protocol === 'https:' ? 443 : 80);
    if (port !== 80 && port !== 443 && port !== 8080 && port !== 8443) {
      return true;
    }

    return false;
  } catch {
    return true; // Block malformed URLs
  }
}

export async function fetchRssFeed(
  feedUrl: string,
  maxArticles: number = 5,
  timeoutMs: number = 10_000,
): Promise<RssArticle[]> {
  try {
    // SSRF protection: block requests to private/internal IPs
    if (isPrivateUrl(feedUrl)) {
      console.warn(`[RSS] Blocked private/internal URL: ${feedUrl}`);
      return [];
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(feedUrl, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Grothi-Bot/1.0 (RSS Intelligence)',
        'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`[RSS] Feed ${feedUrl} returned ${response.status}`);
      return [];
    }

    const xml = await response.text();
    const articles = parseRssFeed(xml, feedUrl);

    // Sort by date (newest first) and limit
    articles.sort((a, b) => {
      if (!a.pubDate && !b.pubDate) return 0;
      if (!a.pubDate) return 1;
      if (!b.pubDate) return -1;
      return b.pubDate.getTime() - a.pubDate.getTime();
    });

    return articles.slice(0, maxArticles);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.warn(`[RSS] Failed to fetch ${feedUrl}: ${msg}`);
    return [];
  }
}

/**
 * Fetch all RSS feeds for a bot and build intelligence context.
 */
export async function buildRssContext(
  feedUrls: string[],
  settings: RssIntelligenceSettings,
): Promise<RssContext> {
  // If adaptation is disabled, skip entirely
  if (settings.adaptationMode === 'never' || feedUrls.length === 0) {
    return {
      shouldApply: false,
      trendsSummary: '',
      topics: [],
      significantEvent: false,
      significantEventDesc: null,
      articles: [],
    };
  }

  // Fetch all feeds in parallel
  const feedPromises = feedUrls.map(url =>
    fetchRssFeed(url, settings.maxArticlesPerFeed)
  );
  const feedResults = await Promise.all(feedPromises);
  const allArticles = feedResults.flat();

  // Filter by freshness window
  const cutoff = new Date(Date.now() - settings.freshnessHoursWindow * 60 * 60 * 1000);
  const freshArticles = allArticles.filter(a => {
    if (!a.pubDate) return true; // Include articles without dates
    return a.pubDate >= cutoff;
  });

  if (freshArticles.length === 0) {
    return {
      shouldApply: false,
      trendsSummary: 'No recent articles found in RSS feeds.',
      topics: [],
      significantEvent: false,
      significantEventDesc: null,
      articles: [],
    };
  }

  // Detect significant events
  let significantEvent = false;
  let significantEventDesc: string | null = null;

  if (settings.significantEventKeywords.length > 0) {
    const keywords = settings.significantEventKeywords.map(k => k.toLowerCase());
    for (const article of freshArticles) {
      const text = `${article.title} ${article.description}`.toLowerCase();
      const matchedKeywords = keywords.filter(k => text.includes(k));
      if (matchedKeywords.length > 0) {
        significantEvent = true;
        significantEventDesc = `Significant event detected: "${article.title}" (matched: ${matchedKeywords.join(', ')})`;
        break;
      }
    }
  }

  // Determine if context should be applied based on mode
  let shouldApply = false;
  switch (settings.adaptationMode) {
    case 'always':
      shouldApply = true;
      break;
    case 'sometimes':
      // Apply ~50% of the time, or always if significant event
      shouldApply = significantEvent || Math.random() < 0.5;
      break;
    case 'significant_only':
      shouldApply = significantEvent;
      break;
    default:
      shouldApply = false;
  }

  // Extract topics from article titles and descriptions
  const topics = extractTopicsFromArticles(freshArticles);

  // Build trends summary
  const trendsSummary = buildTrendsSummary(freshArticles, topics);

  return {
    shouldApply,
    trendsSummary,
    topics,
    significantEvent,
    significantEventDesc,
    articles: freshArticles,
  };
}

/**
 * Extract key topics from articles using frequency analysis.
 */
export function extractTopicsFromArticles(articles: RssArticle[]): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
    'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these',
    'those', 'it', 'its', 'not', 'no', 'how', 'what', 'when', 'where',
    'who', 'which', 'than', 'more', 'most', 'very', 'just', 'about',
    'also', 'new', 'like', 'get', 'make', 'one', 'two', 'all', 'your',
    'you', 'we', 'they', 'our', 'his', 'her', 'their', 'my', 'up', 'out',
    'so', 'if', 'as', 'into', 'over', 'after', 'before', 'between',
  ]);

  const wordFreq: Record<string, number> = {};

  for (const article of articles) {
    const text = `${article.title} ${article.description}`;
    const words = text.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3 && !stopWords.has(w));

    // Count unique words per article to avoid single article domination
    const seen = new Set<string>();
    for (const word of words) {
      if (!seen.has(word)) {
        wordFreq[word] = (wordFreq[word] || 0) + 1;
        seen.add(word);
      }
    }
  }

  // Return top topics that appear in multiple articles
  return Object.entries(wordFreq)
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([word]) => word);
}

/**
 * Build a concise trends summary from articles for AI prompt injection.
 */
export function buildTrendsSummary(articles: RssArticle[], topics: string[]): string {
  const parts: string[] = [];

  // Headlines summary
  const headlines = articles.slice(0, 8).map(a => `- ${a.title}`);
  if (headlines.length > 0) {
    parts.push('CURRENT NEWS & TRENDS FROM INDUSTRY FEEDS:');
    parts.push(...headlines);
  }

  // Trending topics
  if (topics.length > 0) {
    parts.push('');
    parts.push(`TRENDING TOPICS: ${topics.join(', ')}`);
  }

  // Key insights from descriptions
  const insights = articles
    .slice(0, 5)
    .filter(a => a.description.length > 50)
    .map(a => `- ${a.description.slice(0, 200)}`);

  if (insights.length > 0) {
    parts.push('');
    parts.push('KEY INSIGHTS:');
    parts.push(...insights);
  }

  return parts.join('\n');
}

/**
 * Format RSS context as an AI prompt section.
 */
export function formatRssContextForPrompt(context: RssContext): string {
  if (!context.shouldApply || !context.trendsSummary) return '';

  const parts: string[] = [
    '=== RSS FEED INTELLIGENCE (CURRENT INDUSTRY CONTEXT) ===',
    context.trendsSummary,
    '',
    'INSTRUCTIONS: Use this context to make the post timely and relevant.',
    'Reference current trends, news, or topics naturally — do NOT copy headlines verbatim.',
    'The goal is to show expertise and awareness of current industry developments.',
  ];

  if (context.significantEvent && context.significantEventDesc) {
    parts.push('');
    parts.push(`⚠ SIGNIFICANT EVENT: ${context.significantEventDesc}`);
    parts.push('Consider incorporating this event into the post if relevant to the brand.');
  }

  if (context.topics.length > 0) {
    parts.push('');
    parts.push('Audience pain points and interests to address:');
    parts.push(`Topics people are discussing: ${context.topics.slice(0, 10).join(', ')}`);
  }

  return parts.join('\n');
}

/**
 * Load RSS intelligence settings from bot's reactorState.
 */
export function loadRssSettings(reactorState: Record<string, unknown>): RssIntelligenceSettings {
  const stored = reactorState.rssIntelligence as Record<string, unknown> | undefined;
  if (!stored) return { ...DEFAULT_RSS_SETTINGS };

  return {
    adaptationMode: validateAdaptationMode(stored.adaptationMode as string),
    maxArticlesPerFeed: clampInt(stored.maxArticlesPerFeed as number, 1, 20, DEFAULT_RSS_SETTINGS.maxArticlesPerFeed),
    freshnessHoursWindow: clampInt(stored.freshnessHoursWindow as number, 1, 168, DEFAULT_RSS_SETTINGS.freshnessHoursWindow),
    extractTopics: typeof stored.extractTopics === 'boolean' ? stored.extractTopics : DEFAULT_RSS_SETTINGS.extractTopics,
    learnAudienceInsights: typeof stored.learnAudienceInsights === 'boolean' ? stored.learnAudienceInsights : DEFAULT_RSS_SETTINGS.learnAudienceInsights,
    significantEventKeywords: Array.isArray(stored.significantEventKeywords)
      ? (stored.significantEventKeywords as string[]).filter(k => typeof k === 'string' && k.length > 0).slice(0, 50)
      : DEFAULT_RSS_SETTINGS.significantEventKeywords,
  };
}

// ── Helpers ──────────────────────────────────────────────────

function extractTag(xml: string, tag: string): string {
  // Handle CDATA
  const cdataRegex = new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`, 'i');
  const cdataMatch = cdataRegex.exec(xml);
  if (cdataMatch) return cdataMatch[1].trim();

  // Handle regular content
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const match = regex.exec(xml);
  return match ? match[1].trim() : '';
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function validateAdaptationMode(mode: string | undefined): RssAdaptationMode {
  const valid: RssAdaptationMode[] = ['always', 'sometimes', 'significant_only', 'never'];
  return valid.includes(mode as RssAdaptationMode) ? (mode as RssAdaptationMode) : DEFAULT_RSS_SETTINGS.adaptationMode;
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || isNaN(value)) return fallback;
  return Math.max(min, Math.min(max, Math.round(value)));
}
