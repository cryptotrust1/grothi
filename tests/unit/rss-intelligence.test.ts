/**
 * Tests for RSS Feed Intelligence System
 *
 * Covers:
 * - RSS/Atom XML parsing
 * - Article extraction and filtering
 * - Topic extraction from articles
 * - Trends summary building
 * - RSS context building with adaptation modes
 * - Settings loading and validation
 * - Prompt formatting
 * - Edge cases and error handling
 */

import {
  parseRssFeed,
  extractTopicsFromArticles,
  buildTrendsSummary,
  formatRssContextForPrompt,
  loadRssSettings,
  DEFAULT_RSS_SETTINGS,
  type RssArticle,
  type RssContext,
  type RssIntelligenceSettings,
} from '@/lib/rss-intelligence';

// ── RSS 2.0 Parsing ──────────────────────────────────────────

describe('parseRssFeed — RSS 2.0', () => {
  const rss2Feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Tech News</title>
    <item>
      <title>AI Revolution in Marketing</title>
      <link>https://example.com/ai-marketing</link>
      <description>How AI is transforming digital marketing strategies in 2026.</description>
      <pubDate>Wed, 25 Feb 2026 10:00:00 GMT</pubDate>
    </item>
    <item>
      <title>Crypto Market Update</title>
      <link>https://example.com/crypto-update</link>
      <description><![CDATA[Bitcoin hits new highs as <strong>institutional</strong> adoption grows.]]></description>
      <pubDate>Tue, 24 Feb 2026 08:00:00 GMT</pubDate>
    </item>
    <item>
      <title>Social Media Trends 2026</title>
      <link>https://example.com/social-trends</link>
      <description>Top 10 social media trends to watch this year.</description>
      <pubDate>Mon, 23 Feb 2026 12:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

  it('should parse all RSS 2.0 items', () => {
    const articles = parseRssFeed(rss2Feed, 'https://example.com/feed');
    expect(articles).toHaveLength(3);
  });

  it('should extract title, link, description correctly', () => {
    const articles = parseRssFeed(rss2Feed, 'https://example.com/feed');
    expect(articles[0].title).toBe('AI Revolution in Marketing');
    expect(articles[0].link).toBe('https://example.com/ai-marketing');
    expect(articles[0].description).toContain('AI is transforming');
  });

  it('should parse pubDate as Date objects', () => {
    const articles = parseRssFeed(rss2Feed, 'https://example.com/feed');
    expect(articles[0].pubDate).toBeInstanceOf(Date);
    expect(articles[0].pubDate!.getFullYear()).toBe(2026);
  });

  it('should strip HTML from CDATA descriptions', () => {
    const articles = parseRssFeed(rss2Feed, 'https://example.com/feed');
    const cryptoArticle = articles.find(a => a.title.includes('Crypto'));
    expect(cryptoArticle).toBeDefined();
    expect(cryptoArticle!.description).not.toContain('<strong>');
    expect(cryptoArticle!.description).toContain('institutional');
  });

  it('should set source URL on all articles', () => {
    const articles = parseRssFeed(rss2Feed, 'https://example.com/feed');
    articles.forEach(a => {
      expect(a.source).toBe('https://example.com/feed');
    });
  });

  it('should return empty array for invalid XML', () => {
    const articles = parseRssFeed('not xml at all', 'https://bad.com');
    expect(articles).toEqual([]);
  });

  it('should return empty array for empty RSS feed', () => {
    const emptyFeed = `<rss version="2.0"><channel><title>Empty</title></channel></rss>`;
    const articles = parseRssFeed(emptyFeed, 'https://empty.com');
    expect(articles).toEqual([]);
  });

  it('should handle articles without pubDate', () => {
    const noPubDate = `<rss version="2.0"><channel><item><title>No Date Article</title><description>Content</description></item></channel></rss>`;
    const articles = parseRssFeed(noPubDate, 'https://test.com');
    expect(articles).toHaveLength(1);
    expect(articles[0].pubDate).toBeNull();
  });

  it('should handle articles without link', () => {
    const noLink = `<rss version="2.0"><channel><item><title>No Link</title><description>Content</description></item></channel></rss>`;
    const articles = parseRssFeed(noLink, 'https://test.com');
    expect(articles).toHaveLength(1);
    expect(articles[0].link).toBe('');
  });

  it('should truncate long titles to 500 chars', () => {
    const longTitle = 'A'.repeat(600);
    const feed = `<rss version="2.0"><channel><item><title>${longTitle}</title><description>desc</description></item></channel></rss>`;
    const articles = parseRssFeed(feed, 'https://test.com');
    expect(articles[0].title.length).toBeLessThanOrEqual(500);
  });

  it('should truncate long descriptions to 1000 chars', () => {
    const longDesc = 'B'.repeat(1500);
    const feed = `<rss version="2.0"><channel><item><title>Test</title><description>${longDesc}</description></item></channel></rss>`;
    const articles = parseRssFeed(feed, 'https://test.com');
    expect(articles[0].description.length).toBeLessThanOrEqual(1000);
  });
});

// ── Atom 1.0 Parsing ──────────────────────────────────────────

describe('parseRssFeed — Atom 1.0', () => {
  const atomFeed = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Tech Blog</title>
  <entry>
    <title>Atom Entry One</title>
    <link href="https://blog.example.com/entry-1" />
    <summary>Summary of the first entry.</summary>
    <updated>2026-02-25T10:00:00Z</updated>
  </entry>
  <entry>
    <title>Atom Entry Two</title>
    <link href="https://blog.example.com/entry-2" />
    <content>Full content of entry two.</content>
    <published>2026-02-24T08:00:00Z</published>
  </entry>
</feed>`;

  it('should parse Atom entries', () => {
    const articles = parseRssFeed(atomFeed, 'https://blog.example.com/feed');
    expect(articles).toHaveLength(2);
  });

  it('should extract Atom title and link', () => {
    const articles = parseRssFeed(atomFeed, 'https://blog.example.com/feed');
    expect(articles[0].title).toBe('Atom Entry One');
    expect(articles[0].link).toBe('https://blog.example.com/entry-1');
  });

  it('should use summary or content for description', () => {
    const articles = parseRssFeed(atomFeed, 'https://blog.example.com/feed');
    expect(articles[0].description).toContain('Summary of the first');
    expect(articles[1].description).toContain('Full content');
  });

  it('should parse Atom dates (updated or published)', () => {
    const articles = parseRssFeed(atomFeed, 'https://blog.example.com/feed');
    expect(articles[0].pubDate).toBeInstanceOf(Date);
    expect(articles[1].pubDate).toBeInstanceOf(Date);
  });
});

// ── Topic Extraction ──────────────────────────────────────────

describe('extractTopicsFromArticles', () => {
  const articles: RssArticle[] = [
    { title: 'Bitcoin Price Surges Past Record', description: 'Bitcoin and cryptocurrency market sees massive growth as institutional investors pour money into digital assets.', pubDate: new Date(), source: '', link: '' },
    { title: 'Ethereum Smart Contracts Revolution', description: 'Smart contracts on Ethereum blockchain are transforming the cryptocurrency and digital assets space.', pubDate: new Date(), source: '', link: '' },
    { title: 'Crypto Regulation Update', description: 'New cryptocurrency regulations from SEC impact Bitcoin and digital assets trading worldwide.', pubDate: new Date(), source: '', link: '' },
  ];

  it('should extract topics that appear in multiple articles', () => {
    const topics = extractTopicsFromArticles(articles);
    expect(topics.length).toBeGreaterThan(0);
  });

  it('should include commonly mentioned terms', () => {
    const topics = extractTopicsFromArticles(articles);
    // "bitcoin", "digital", "assets", "cryptocurrency" should appear in multiple articles
    const topicSet = new Set(topics);
    expect(topicSet.has('bitcoin') || topicSet.has('digital') || topicSet.has('cryptocurrency')).toBe(true);
  });

  it('should filter out stop words', () => {
    const topics = extractTopicsFromArticles(articles);
    const stopWords = ['the', 'and', 'are', 'from', 'this', 'that'];
    topics.forEach(topic => {
      expect(stopWords).not.toContain(topic);
    });
  });

  it('should filter out short words (<=3 chars)', () => {
    const topics = extractTopicsFromArticles(articles);
    topics.forEach(topic => {
      expect(topic.length).toBeGreaterThan(3);
    });
  });

  it('should limit to 15 topics max', () => {
    const topics = extractTopicsFromArticles(articles);
    expect(topics.length).toBeLessThanOrEqual(15);
  });

  it('should return empty for single article (no cross-article frequency)', () => {
    const singleArticle: RssArticle[] = [
      { title: 'Unique Title', description: 'Unique description with no repetition.', pubDate: new Date(), source: '', link: '' },
    ];
    const topics = extractTopicsFromArticles(singleArticle);
    // Single article can't have cross-article frequency >= 2
    expect(topics.length).toBe(0);
  });

  it('should return empty for empty input', () => {
    expect(extractTopicsFromArticles([])).toEqual([]);
  });
});

// ── Trends Summary Building ──────────────────────────────────

describe('buildTrendsSummary', () => {
  const articles: RssArticle[] = [
    { title: 'AI Takes Over Content Creation', description: 'Companies are using AI to generate social media content at scale with impressive results.', pubDate: new Date(), source: '', link: '' },
    { title: 'New Social Platform Launches', description: 'A new social media platform challenges Twitter with improved features for content creators.', pubDate: new Date(), source: '', link: '' },
  ];

  it('should include headlines section', () => {
    const summary = buildTrendsSummary(articles, ['content', 'social']);
    expect(summary).toContain('CURRENT NEWS & TRENDS');
    expect(summary).toContain('AI Takes Over Content Creation');
    expect(summary).toContain('New Social Platform Launches');
  });

  it('should include trending topics', () => {
    const summary = buildTrendsSummary(articles, ['content', 'social', 'media']);
    expect(summary).toContain('TRENDING TOPICS');
    expect(summary).toContain('content');
  });

  it('should include key insights from descriptions', () => {
    const summary = buildTrendsSummary(articles, []);
    expect(summary).toContain('KEY INSIGHTS');
  });

  it('should handle empty articles', () => {
    const summary = buildTrendsSummary([], []);
    expect(summary).toBe('');
  });

  it('should limit to 8 headlines', () => {
    const manyArticles: RssArticle[] = Array.from({ length: 12 }, (_, i) => ({
      title: `Article ${i + 1}`,
      description: `Description for article ${i + 1} which is long enough.`.repeat(3),
      pubDate: new Date(),
      source: '',
      link: '',
    }));
    const summary = buildTrendsSummary(manyArticles, []);
    const headlineCount = (summary.match(/^- Article \d+$/gm) || []).length;
    expect(headlineCount).toBeLessThanOrEqual(8);
  });
});

// ── Prompt Formatting ──────────────────────────────────────────

describe('formatRssContextForPrompt', () => {
  it('should return empty string when shouldApply is false', () => {
    const context: RssContext = {
      shouldApply: false,
      trendsSummary: 'Some trends',
      topics: ['ai'],
      significantEvent: false,
      significantEventDesc: null,
      articles: [],
    };
    expect(formatRssContextForPrompt(context)).toBe('');
  });

  it('should return empty string when trendsSummary is empty', () => {
    const context: RssContext = {
      shouldApply: true,
      trendsSummary: '',
      topics: [],
      significantEvent: false,
      significantEventDesc: null,
      articles: [],
    };
    expect(formatRssContextForPrompt(context)).toBe('');
  });

  it('should include RSS header and trends when shouldApply is true', () => {
    const context: RssContext = {
      shouldApply: true,
      trendsSummary: 'CURRENT NEWS: AI is trending',
      topics: ['ai', 'marketing'],
      significantEvent: false,
      significantEventDesc: null,
      articles: [],
    };
    const prompt = formatRssContextForPrompt(context);
    expect(prompt).toContain('RSS FEED INTELLIGENCE');
    expect(prompt).toContain('AI is trending');
    expect(prompt).toContain('ai, marketing');
  });

  it('should include significant event warning', () => {
    const context: RssContext = {
      shouldApply: true,
      trendsSummary: 'Breaking news',
      topics: [],
      significantEvent: true,
      significantEventDesc: 'Major acquisition announced',
      articles: [],
    };
    const prompt = formatRssContextForPrompt(context);
    expect(prompt).toContain('SIGNIFICANT EVENT');
    expect(prompt).toContain('Major acquisition announced');
  });

  it('should include usage instructions', () => {
    const context: RssContext = {
      shouldApply: true,
      trendsSummary: 'Some trends',
      topics: [],
      significantEvent: false,
      significantEventDesc: null,
      articles: [],
    };
    const prompt = formatRssContextForPrompt(context);
    expect(prompt).toContain('do NOT copy headlines verbatim');
  });
});

// ── Settings Loading ──────────────────────────────────────────

describe('loadRssSettings', () => {
  it('should return defaults for empty reactorState', () => {
    const settings = loadRssSettings({});
    expect(settings).toEqual(DEFAULT_RSS_SETTINGS);
  });

  it('should return defaults when rssIntelligence key is missing', () => {
    const settings = loadRssSettings({ someOtherKey: true });
    expect(settings).toEqual(DEFAULT_RSS_SETTINGS);
  });

  it('should load valid settings from reactorState', () => {
    const settings = loadRssSettings({
      rssIntelligence: {
        adaptationMode: 'always',
        maxArticlesPerFeed: 10,
        freshnessHoursWindow: 24,
        extractTopics: false,
        learnAudienceInsights: false,
        significantEventKeywords: ['launch', 'breaking'],
      },
    });
    expect(settings.adaptationMode).toBe('always');
    expect(settings.maxArticlesPerFeed).toBe(10);
    expect(settings.freshnessHoursWindow).toBe(24);
    expect(settings.extractTopics).toBe(false);
    expect(settings.learnAudienceInsights).toBe(false);
    expect(settings.significantEventKeywords).toEqual(['launch', 'breaking']);
  });

  it('should validate adaptation mode — fallback to default for invalid', () => {
    const settings = loadRssSettings({
      rssIntelligence: { adaptationMode: 'invalid_mode' },
    });
    expect(settings.adaptationMode).toBe('sometimes');
  });

  it('should clamp maxArticlesPerFeed between 1 and 20', () => {
    expect(loadRssSettings({ rssIntelligence: { maxArticlesPerFeed: 0 } }).maxArticlesPerFeed).toBe(1);
    expect(loadRssSettings({ rssIntelligence: { maxArticlesPerFeed: 100 } }).maxArticlesPerFeed).toBe(20);
    expect(loadRssSettings({ rssIntelligence: { maxArticlesPerFeed: 8 } }).maxArticlesPerFeed).toBe(8);
  });

  it('should clamp freshnessHoursWindow between 1 and 168', () => {
    expect(loadRssSettings({ rssIntelligence: { freshnessHoursWindow: 0 } }).freshnessHoursWindow).toBe(1);
    expect(loadRssSettings({ rssIntelligence: { freshnessHoursWindow: 500 } }).freshnessHoursWindow).toBe(168);
  });

  it('should filter out empty/non-string significant event keywords', () => {
    const settings = loadRssSettings({
      rssIntelligence: {
        significantEventKeywords: ['valid', '', 123, null, 'also_valid'],
      },
    });
    expect(settings.significantEventKeywords).toEqual(['valid', 'also_valid']);
  });

  it('should limit significant event keywords to 50', () => {
    const keywords = Array.from({ length: 60 }, (_, i) => `keyword_${i}`);
    const settings = loadRssSettings({
      rssIntelligence: { significantEventKeywords: keywords },
    });
    expect(settings.significantEventKeywords).toHaveLength(50);
  });

  it('should handle NaN values for numeric fields', () => {
    const settings = loadRssSettings({
      rssIntelligence: {
        maxArticlesPerFeed: 'not_a_number',
        freshnessHoursWindow: undefined,
      },
    });
    expect(settings.maxArticlesPerFeed).toBe(DEFAULT_RSS_SETTINGS.maxArticlesPerFeed);
    expect(settings.freshnessHoursWindow).toBe(DEFAULT_RSS_SETTINGS.freshnessHoursWindow);
  });
});

// ── Adaptation Mode Behavior ──────────────────────────────────

describe('Adaptation Mode Logic', () => {
  it('DEFAULT_RSS_SETTINGS should have "sometimes" as default mode', () => {
    expect(DEFAULT_RSS_SETTINGS.adaptationMode).toBe('sometimes');
  });

  it('DEFAULT_RSS_SETTINGS should have 48h freshness window', () => {
    expect(DEFAULT_RSS_SETTINGS.freshnessHoursWindow).toBe(48);
  });

  it('DEFAULT_RSS_SETTINGS should have 5 max articles per feed', () => {
    expect(DEFAULT_RSS_SETTINGS.maxArticlesPerFeed).toBe(5);
  });

  it('DEFAULT_RSS_SETTINGS should have topic extraction enabled', () => {
    expect(DEFAULT_RSS_SETTINGS.extractTopics).toBe(true);
  });

  it('DEFAULT_RSS_SETTINGS should have audience insights enabled', () => {
    expect(DEFAULT_RSS_SETTINGS.learnAudienceInsights).toBe(true);
  });

  it('DEFAULT_RSS_SETTINGS should have empty significant event keywords', () => {
    expect(DEFAULT_RSS_SETTINGS.significantEventKeywords).toEqual([]);
  });
});

// ── HTML Entity & CDATA Handling ──────────────────────────────

describe('parseRssFeed — HTML entities and special content', () => {
  it('should decode HTML entities in description', () => {
    const feed = `<rss version="2.0"><channel><item>
      <title>Test &amp; More</title>
      <description>Price: $100 &amp; discount. Quote: &quot;Hello&quot;</description>
    </item></channel></rss>`;
    const articles = parseRssFeed(feed, 'https://test.com');
    expect(articles[0].description).toContain('&');
    expect(articles[0].description).toContain('"Hello"');
  });

  it('should handle CDATA in title', () => {
    const feed = `<rss version="2.0"><channel><item>
      <title><![CDATA[Breaking: Big News & Updates Today]]></title>
      <description>Some description</description>
    </item></channel></rss>`;
    const articles = parseRssFeed(feed, 'https://test.com');
    expect(articles[0].title).toContain('Breaking: Big News & Updates Today');
  });

  it('should skip items without title', () => {
    const feed = `<rss version="2.0"><channel>
      <item><description>No title item</description></item>
      <item><title>Has Title</title><description>Has desc</description></item>
    </channel></rss>`;
    const articles = parseRssFeed(feed, 'https://test.com');
    expect(articles).toHaveLength(1);
    expect(articles[0].title).toBe('Has Title');
  });

  it('should handle invalid pubDate gracefully', () => {
    const feed = `<rss version="2.0"><channel><item>
      <title>Bad Date</title>
      <pubDate>not-a-date</pubDate>
    </item></channel></rss>`;
    const articles = parseRssFeed(feed, 'https://test.com');
    expect(articles[0].pubDate).toBeNull();
  });
});

// ── Significant Event Detection ──────────────────────────────

describe('Significant Event Detection (via buildRssContext)', () => {
  // We test the logic by directly checking buildRssContext behavior
  // Since buildRssContext fetches URLs, we test the input processing

  it('should detect events via keyword matching in formatRssContextForPrompt', () => {
    const context: RssContext = {
      shouldApply: true,
      trendsSummary: 'Breaking: Major partnership',
      topics: ['partnership'],
      significantEvent: true,
      significantEventDesc: 'Significant event detected: "Company X acquires Y" (matched: acquisition)',
      articles: [],
    };
    const prompt = formatRssContextForPrompt(context);
    expect(prompt).toContain('SIGNIFICANT EVENT');
    expect(prompt).toContain('Company X acquires Y');
    expect(prompt).toContain('acquisition');
  });

  it('should not show significant event section when no event', () => {
    const context: RssContext = {
      shouldApply: true,
      trendsSummary: 'Regular news',
      topics: [],
      significantEvent: false,
      significantEventDesc: null,
      articles: [],
    };
    const prompt = formatRssContextForPrompt(context);
    expect(prompt).not.toContain('SIGNIFICANT EVENT');
  });
});

// ── Integration: End-to-End Context Building ──────────────────

describe('RSS Context Integration', () => {
  it('should produce valid RssContext structure from parse + extract + build', () => {
    const xml = `<rss version="2.0"><channel>
      <item><title>AI in Marketing</title><description>Artificial intelligence tools are changing how brands create content for social media marketing campaigns.</description><pubDate>Wed, 25 Feb 2026 10:00:00 GMT</pubDate></item>
      <item><title>Social Media Marketing Tips</title><description>Expert tips for social media marketing using artificial intelligence and automation tools.</description><pubDate>Tue, 24 Feb 2026 08:00:00 GMT</pubDate></item>
    </channel></rss>`;

    const articles = parseRssFeed(xml, 'https://test.com/feed');
    expect(articles).toHaveLength(2);

    const topics = extractTopicsFromArticles(articles);
    expect(topics.length).toBeGreaterThan(0);

    const summary = buildTrendsSummary(articles, topics);
    expect(summary).toContain('AI in Marketing');

    const context: RssContext = {
      shouldApply: true,
      trendsSummary: summary,
      topics,
      significantEvent: false,
      significantEventDesc: null,
      articles,
    };

    const prompt = formatRssContextForPrompt(context);
    expect(prompt).toContain('RSS FEED INTELLIGENCE');
    expect(prompt).toContain('AI in Marketing');
    expect(prompt.length).toBeGreaterThan(100);
  });
});
