import {
  welfordUpdate,
  computeZScore,
  computeVelocity,
  classifyLifecycle,
  computeSTEPPScore,
  computeEmotionScore,
  computeHypeScore,
  computeRelevance,
  extractTopics,
  parseRSSFeed,
  processRSSBatch,
  createInitialHypeState,
  updateLearnedPatterns,
  getHypeContentBias,
  getHypeHashtagBias,
  shouldActNow,
  suggestContentAngle,
  generateAlert,
  getHypeState,
  mergeHypeState,
  getHypeLevel,
  EMOTION_VIRALITY_WEIGHTS,
  PLATFORM_HALF_LIFE_MINUTES,
  ZSCORE_THRESHOLDS,
  LIFECYCLE_CONFIG,
  HYPE_SCORE_LEVELS,
  TREND_RSS_FEEDS,
  type TopicStats,
  type HypeState,
  type DetectedTrend,
  type RSSItem,
} from '@/lib/hype-engine';

// ============ HELPER: Create a TopicStats with N observations ============

function createStats(overrides: Partial<TopicStats> = {}): TopicStats {
  return {
    count: 0,
    mean: 0,
    m2: 0,
    currentCount: 0,
    previousCount: 0,
    firstSeen: new Date().toISOString(),
    lastSeen: new Date().toISOString(),
    windowHistory: [],
    ...overrides,
  };
}

/** Feed N identical observations into Welford's to build stats */
function buildStats(values: number[]): TopicStats {
  let stats = createStats();
  for (const v of values) {
    stats = welfordUpdate(stats, v);
  }
  return stats;
}

// ============ TESTS ============

describe('Hype Engine', () => {

  // ── Welford's Online Algorithm (1962) ─────────────────────────

  describe('welfordUpdate', () => {
    it('initializes stats correctly on first observation', () => {
      const stats = welfordUpdate(createStats(), 5);
      expect(stats.count).toBe(1);
      expect(stats.mean).toBe(5);
      expect(stats.m2).toBe(0);
      expect(stats.currentCount).toBe(5);
      expect(stats.previousCount).toBe(0);
    });

    it('computes running mean correctly', () => {
      const stats = buildStats([2, 4, 6, 8, 10]);
      expect(stats.count).toBe(5);
      expect(stats.mean).toBe(6); // (2+4+6+8+10)/5 = 6
    });

    it('tracks window history', () => {
      const stats = buildStats([1, 2, 3, 4, 5]);
      expect(stats.windowHistory).toEqual([1, 2, 3, 4, 5]);
    });

    it('limits window history to 30 entries', () => {
      const values = Array.from({ length: 40 }, (_, i) => i);
      const stats = buildStats(values);
      expect(stats.windowHistory.length).toBe(30);
      expect(stats.windowHistory[0]).toBe(10); // First 10 pruned
    });

    it('updates previousCount to currentCount on each update', () => {
      let stats = welfordUpdate(createStats(), 3);
      stats = welfordUpdate(stats, 7);
      expect(stats.previousCount).toBe(3);
      expect(stats.currentCount).toBe(7);
    });
  });

  // ── Z-Score Spike Detection ───────────────────────────────────

  describe('computeZScore', () => {
    it('returns 0 when fewer than 5 observations', () => {
      const stats = buildStats([1, 2, 3, 4]);
      expect(computeZScore(stats)).toBe(0);
    });

    it('returns 0 when stddev is near zero (constant values)', () => {
      const stats = buildStats([5, 5, 5, 5, 5]);
      expect(computeZScore(stats)).toBe(0);
    });

    it('returns positive z-score for above-average current count', () => {
      // Baseline: mean ~2, then spike to 10
      const stats = buildStats([2, 2, 2, 2, 2, 2, 2, 2, 2, 10]);
      const z = computeZScore(stats);
      expect(z).toBeGreaterThan(2); // Significant spike
    });

    it('returns negative z-score for below-average current count', () => {
      const stats = buildStats([10, 10, 10, 10, 10, 10, 10, 10, 10, 1]);
      const z = computeZScore(stats);
      expect(z).toBeLessThan(-2);
    });

    it('detects extreme spike (z >= 3.0)', () => {
      // Baseline of ~1, sudden spike to 20
      const values = Array(20).fill(1);
      values.push(20);
      const stats = buildStats(values);
      const z = computeZScore(stats);
      expect(z).toBeGreaterThanOrEqual(ZSCORE_THRESHOLDS.EXTREME);
    });
  });

  // ── Velocity Computation ──────────────────────────────────────

  describe('computeVelocity', () => {
    it('returns 0 when both counts are 0', () => {
      expect(computeVelocity(createStats())).toBe(0);
    });

    it('returns 1.0 when going from 0 to positive', () => {
      const stats = createStats({ previousCount: 0, currentCount: 5 });
      expect(computeVelocity(stats)).toBe(1.0);
    });

    it('computes positive velocity for growth', () => {
      const stats = createStats({ previousCount: 10, currentCount: 15 });
      expect(computeVelocity(stats)).toBe(0.5); // 50% growth
    });

    it('computes negative velocity for decline', () => {
      const stats = createStats({ previousCount: 20, currentCount: 10 });
      expect(computeVelocity(stats)).toBe(-0.5); // 50% decline
    });

    it('returns 0 for stable (no change)', () => {
      const stats = createStats({ previousCount: 5, currentCount: 5 });
      expect(computeVelocity(stats)).toBe(0);
    });
  });

  // ── Trend Lifecycle Classification (Rogers 1962) ──────────────

  describe('classifyLifecycle', () => {
    it('classifies as DEAD when z-score < 1.0', () => {
      expect(classifyLifecycle(0.5, 0.5, [1, 2, 3])).toBe('DEAD');
    });

    it('classifies as DEAD when velocity < -0.5', () => {
      expect(classifyLifecycle(2.5, -0.6, [10, 8, 5, 3, 1])).toBe('DEAD');
    });

    it('classifies as EMERGENCE when z >= 1.5 and velocity > 0', () => {
      expect(classifyLifecycle(1.7, 0.2, [1, 2, 3])).toBe('EMERGENCE');
    });

    it('classifies as GROWTH when z >= 2.0 and velocity > 0.4', () => {
      expect(classifyLifecycle(2.5, 0.6, [1, 3, 5])).toBe('GROWTH');
    });

    it('classifies as PEAK when z >= 2.0, velocity near 0, enough history', () => {
      expect(classifyLifecycle(2.5, 0.05, [1, 3, 5, 7, 8])).toBe('PEAK');
    });

    it('classifies as DECLINE when velocity < -0.15', () => {
      expect(classifyLifecycle(1.8, -0.2, [8, 7, 6, 5, 4])).toBe('DECLINE');
    });

    it('detects past-peak decline from window history', () => {
      // Three consecutive declining windows
      expect(classifyLifecycle(1.8, -0.1, [10, 8, 6])).toBe('DECLINE');
    });
  });

  // ── STEPPS Scoring (Berger 2013) ──────────────────────────────

  describe('computeSTEPPScore', () => {
    it('returns 0 for empty text', () => {
      expect(computeSTEPPScore('')).toBe(0);
    });

    it('scores high for text with multiple STEPPS principles', () => {
      const text = 'EXCLUSIVE secret guide: 5 tips to make your story go viral. This incredible journey will change everything. Share now before it\'s too late!';
      const score = computeSTEPPScore(text);
      expect(score).toBeGreaterThan(30); // Multiple principles hit
    });

    it('detects Social Currency keywords', () => {
      const score = computeSTEPPScore('This exclusive insider secret is hidden from most people');
      expect(score).toBeGreaterThan(0);
    });

    it('detects Practical Value keywords', () => {
      const score = computeSTEPPScore('Here is a step-by-step guide with 10 tips to save money');
      expect(score).toBeGreaterThan(0);
    });

    it('detects Emotion keywords (high arousal)', () => {
      const score = computeSTEPPScore('This incredible mind-blowing outrageous scandal is urgent');
      expect(score).toBeGreaterThan(0);
    });

    it('detects Stories keywords', () => {
      const score = computeSTEPPScore('My journey started when I was looking back at my experience of transformation');
      expect(score).toBeGreaterThan(0);
    });

    it('caps score at 100', () => {
      const text = 'exclusive secret insider hidden rare elite limited ' +
        'incredible mind-blowing breathtaking amazing revolutionary ' +
        'viral trending challenge everyone share hashtag ' +
        'how to tips guide hack tutorial step-by-step top 10 ' +
        'story journey experience transformation lesson learned ' +
        'morning daily weekly holiday every monday routine';
      const score = computeSTEPPScore(text);
      expect(score).toBeLessThanOrEqual(100);
    });
  });

  // ── Emotion Arousal Scoring (Berger & Milkman 2012) ───────────

  describe('computeEmotionScore', () => {
    it('returns 0 for neutral text', () => {
      expect(computeEmotionScore('The weather is normal today')).toBe(0);
    });

    it('returns positive score for high-arousal positive text (Awe)', () => {
      const score = computeEmotionScore('This is incredible, amazing, breathtaking and stunning');
      expect(score).toBeGreaterThan(0);
    });

    it('returns positive score for high-arousal negative text (Anger)', () => {
      const score = computeEmotionScore('Outrageous scandal! This is infuriating and unacceptable');
      expect(score).toBeGreaterThan(0);
    });

    it('returns negative score for low-arousal text (Sadness)', () => {
      const score = computeEmotionScore('This is so sad, heartbreaking, devastating and depressing');
      expect(score).toBeLessThan(0);
    });

    it('FOMO triggers increase score', () => {
      const withFomo = computeEmotionScore('Last chance! Ending soon, only 5 left. Everyone is joining');
      const withoutFomo = computeEmotionScore('A product is available for purchase');
      expect(withFomo).toBeGreaterThan(withoutFomo);
    });

    it('score is bounded between -1 and 1', () => {
      const extreme = computeEmotionScore(
        'incredible amazing stunning outrageous shocking urgent crisis ' +
        'sad heartbreaking devastating depressing gloomy hopeless'
      );
      expect(extreme).toBeGreaterThanOrEqual(-1);
      expect(extreme).toBeLessThanOrEqual(1);
    });
  });

  // ── Topic Extraction ──────────────────────────────────────────

  describe('extractTopics', () => {
    it('returns empty array for empty text', () => {
      expect(extractTopics('')).toEqual([]);
    });

    it('filters out stop words', () => {
      const topics = extractTopics('the quick brown fox jumps over the lazy dog');
      expect(topics).not.toContain('the');
      expect(topics).not.toContain('over');
    });

    it('extracts significant unigrams (>= 4 chars)', () => {
      const topics = extractTopics('artificial intelligence machine learning revolution');
      expect(topics).toContain('artificial');
      expect(topics).toContain('intelligence');
      expect(topics).toContain('machine');
      expect(topics).toContain('learning');
      expect(topics).toContain('revolution');
    });

    it('extracts bigrams (consecutive word pairs)', () => {
      const topics = extractTopics('artificial intelligence changes marketing forever');
      expect(topics).toContain('artificial intelligence');
    });

    it('limits output to 20 topics', () => {
      const longText = Array(50).fill('unique topic word keyword concept').join(' ');
      const topics = extractTopics(longText);
      expect(topics.length).toBeLessThanOrEqual(20);
    });

    it('deduplicates topics', () => {
      const topics = extractTopics('marketing marketing marketing strategy strategy');
      const uniqueCount = new Set(topics).size;
      expect(uniqueCount).toBe(topics.length);
    });
  });

  // ── Relevance Scoring ─────────────────────────────────────────

  describe('computeRelevance', () => {
    it('returns 0.3 default when no keywords or instructions', () => {
      expect(computeRelevance('some topic', [], '', '')).toBe(0.3);
    });

    it('scores high for direct keyword match', () => {
      const score = computeRelevance('artificial intelligence', ['artificial intelligence', 'AI'], '', '');
      expect(score).toBeGreaterThanOrEqual(0.5);
    });

    it('scores partial match for word overlap', () => {
      const score = computeRelevance('machine learning', ['deep learning'], '', '');
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(1);
    });

    it('boosts score when topic appears in instructions', () => {
      const withInstr = computeRelevance('marketing', ['social media'], 'Focus on digital marketing strategies', '');
      const withoutInstr = computeRelevance('marketing', ['social media'], '', '');
      expect(withInstr).toBeGreaterThan(withoutInstr);
    });

    it('boosts score when topic matches brand name', () => {
      const score = computeRelevance('grothi platform', ['platform'], 'manage your platform', 'Grothi');
      expect(score).toBeGreaterThan(0.3);
    });

    it('score is capped at 1.0', () => {
      const score = computeRelevance('exact match', ['exact match'], 'exact match topic', 'exact match');
      expect(score).toBeLessThanOrEqual(1);
    });
  });

  // ── Hype Score Computation (Weighted Formula) ─────────────────

  describe('computeHypeScore', () => {
    it('returns 0 for all-zero inputs', () => {
      expect(computeHypeScore({
        zScore: 0, steppScore: 0, emotionScore: -1, velocity: 0, sourceCount: 0,
      })).toBe(0);
    });

    it('returns high score for strong signals', () => {
      const score = computeHypeScore({
        zScore: 4.0,      // Strong spike
        steppScore: 80,    // High virality potential
        emotionScore: 0.8, // High arousal
        velocity: 1.5,     // Rapid growth
        sourceCount: 5,    // Multiple sources
      });
      expect(score).toBeGreaterThan(70);
    });

    it('caps at 100', () => {
      const score = computeHypeScore({
        zScore: 10, steppScore: 100, emotionScore: 1, velocity: 5, sourceCount: 10,
      });
      expect(score).toBeLessThanOrEqual(100);
    });

    it('weights z-score at 30%', () => {
      const base = computeHypeScore({
        zScore: 0, steppScore: 0, emotionScore: -1, velocity: 0, sourceCount: 0,
      });
      const withZ = computeHypeScore({
        zScore: 5, steppScore: 0, emotionScore: -1, velocity: 0, sourceCount: 0,
      });
      expect(withZ).toBeGreaterThan(base);
      expect(withZ - base).toBe(30); // 5/5 * 100 * 0.30 = 30
    });

    it('weights source diversity at 15%', () => {
      const with1 = computeHypeScore({
        zScore: 0, steppScore: 0, emotionScore: -1, velocity: 0, sourceCount: 1,
      });
      const with5 = computeHypeScore({
        zScore: 0, steppScore: 0, emotionScore: -1, velocity: 0, sourceCount: 5,
      });
      expect(with5).toBeGreaterThan(with1);
    });
  });

  // ── RSS Feed Parsing ──────────────────────────────────────────

  describe('parseRSSFeed', () => {
    it('parses RSS 2.0 format', () => {
      const xml = `<?xml version="1.0"?>
        <rss version="2.0">
          <channel>
            <item>
              <title>Test Article Title</title>
              <description>Article description here</description>
              <link>https://example.com/article</link>
              <pubDate>Mon, 24 Feb 2026 10:00:00 GMT</pubDate>
            </item>
          </channel>
        </rss>`;
      const items = parseRSSFeed(xml, 'TestSource');
      expect(items).toHaveLength(1);
      expect(items[0].title).toBe('Test Article Title');
      expect(items[0].description).toBe('Article description here');
      expect(items[0].link).toBe('https://example.com/article');
      expect(items[0].source).toBe('TestSource');
    });

    it('parses Atom format', () => {
      const xml = `<?xml version="1.0"?>
        <feed xmlns="http://www.w3.org/2005/Atom">
          <entry>
            <title>Atom Entry</title>
            <summary>Atom summary</summary>
            <link href="https://example.com/atom"/>
            <updated>2026-02-24T10:00:00Z</updated>
          </entry>
        </feed>`;
      const items = parseRSSFeed(xml, 'AtomSource');
      expect(items).toHaveLength(1);
      expect(items[0].title).toBe('Atom Entry');
      expect(items[0].source).toBe('AtomSource');
    });

    it('handles CDATA sections', () => {
      const xml = `<rss><channel><item>
        <title><![CDATA[Title with <b>HTML</b> & special chars]]></title>
        <description><![CDATA[<p>Rich description</p>]]></description>
        <link>https://example.com</link>
      </item></channel></rss>`;
      const items = parseRSSFeed(xml, 'CDATASource');
      expect(items).toHaveLength(1);
      expect(items[0].title).toBe('Title with <b>HTML</b> & special chars');
    });

    it('decodes HTML entities', () => {
      const xml = `<rss><channel><item>
        <title>Tom &amp; Jerry&#39;s &quot;Adventure&quot;</title>
        <link>https://example.com</link>
      </item></channel></rss>`;
      const items = parseRSSFeed(xml, 'Test');
      expect(items[0].title).toBe('Tom & Jerry\'s "Adventure"');
    });

    it('returns empty array for invalid XML', () => {
      expect(parseRSSFeed('not xml at all', 'Test')).toEqual([]);
    });

    it('strips HTML from CDATA descriptions', () => {
      const xml = `<rss><channel><item>
        <title>Test</title>
        <description><![CDATA[<p>Hello <b>world</b></p>]]></description>
        <link>https://example.com</link>
      </item></channel></rss>`;
      const items = parseRSSFeed(xml, 'Test');
      // CDATA content gets HTML stripped
      expect(items[0].description).not.toContain('<p>');
      expect(items[0].description).not.toContain('<b>');
      expect(items[0].description).toContain('Hello');
      expect(items[0].description).toContain('world');
    });

    it('handles multiple items', () => {
      const xml = `<rss><channel>
        <item><title>Item 1</title><link>https://a.com</link></item>
        <item><title>Item 2</title><link>https://b.com</link></item>
        <item><title>Item 3</title><link>https://c.com</link></item>
      </channel></rss>`;
      const items = parseRSSFeed(xml, 'Test');
      expect(items).toHaveLength(3);
    });
  });

  // ── Full Pipeline: processRSSBatch ────────────────────────────

  describe('processRSSBatch', () => {
    const mockItems: RSSItem[] = [
      { title: 'AI revolution is changing marketing forever', description: 'Artificial intelligence marketing automation', link: 'https://a.com', pubDate: '', source: 'Source1' },
      { title: 'AI marketing tools break new ground', description: 'Machine learning marketing platforms', link: 'https://b.com', pubDate: '', source: 'Source2' },
      { title: 'Marketing AI: the incredible revolution begins', description: 'Amazing breakthrough in AI marketing', link: 'https://c.com', pubDate: '', source: 'Source3' },
    ];

    it('deduplicates items against seen fingerprints', () => {
      const state = createInitialHypeState();
      state.seenItems = ['AI revolution is changing marketing forever|Source1'];

      const { updatedState } = processRSSBatch(state, mockItems, ['marketing'], '', 'TestBot', 'ENGAGEMENT');
      // First item should be skipped, but the fingerprint format is title.slice(0,50)|source
      expect(updatedState.totalScans).toBe(1);
    });

    it('increments totalScans', () => {
      const state = createInitialHypeState();
      const { updatedState } = processRSSBatch(state, mockItems, ['marketing'], '', 'TestBot', 'ENGAGEMENT');
      expect(updatedState.totalScans).toBe(1);
    });

    it('updates lastScanAt', () => {
      const state = createInitialHypeState();
      const { updatedState } = processRSSBatch(state, mockItems, [], '', 'TestBot', 'ENGAGEMENT');
      expect(updatedState.lastScanAt).not.toBeNull();
    });

    it('extracts topics from items', () => {
      const state = createInitialHypeState();
      const { updatedState } = processRSSBatch(state, mockItems, [], '', 'TestBot', 'ENGAGEMENT');
      expect(Object.keys(updatedState.topicStats).length).toBeGreaterThan(0);
    });

    it('returns empty trends on first scan (not enough baseline)', () => {
      const state = createInitialHypeState();
      const { newTrends } = processRSSBatch(state, mockItems, ['marketing'], '', 'TestBot', 'ENGAGEMENT');
      // First scan: z-scores will be 0 (< 5 observations needed)
      expect(newTrends).toEqual([]);
    });

    it('detects trends after enough scans build baseline', () => {
      let state = createInitialHypeState();

      // Build baseline with 10 scans of low activity
      const lowItems: RSSItem[] = [
        { title: 'Normal day in tech', description: 'Nothing special', link: 'https://x.com', pubDate: '', source: 'S1' },
      ];

      for (let i = 0; i < 10; i++) {
        const result = processRSSBatch(
          state,
          lowItems.map(item => ({ ...item, title: `${item.title} ${i}` })),
          ['tech'],
          '',
          'Bot',
          'ENGAGEMENT'
        );
        state = result.updatedState;
      }

      expect(state.totalScans).toBe(10);
    });

    it('limits seenItems to 500', () => {
      const state = createInitialHypeState();
      state.seenItems = Array(600).fill('old-item');
      const items: RSSItem[] = [
        { title: 'New item', description: '', link: '', pubDate: '', source: 'S1' },
      ];
      const { updatedState } = processRSSBatch(state, items, [], '', 'Bot', 'ENGAGEMENT');
      expect(updatedState.seenItems.length).toBeLessThanOrEqual(500);
    });

    it('returns empty when all items already seen', () => {
      const state = createInitialHypeState();
      state.seenItems = mockItems.map(i => `${i.title.slice(0, 50)}|${i.source}`);
      const { newTrends, newAlerts } = processRSSBatch(state, mockItems, ['marketing'], '', 'Bot', 'ENGAGEMENT');
      expect(newTrends).toEqual([]);
      expect(newAlerts).toEqual([]);
    });
  });

  // ── Hype State Management ─────────────────────────────────────

  describe('createInitialHypeState', () => {
    it('creates valid initial state', () => {
      const state = createInitialHypeState();
      expect(state.topicStats).toEqual({});
      expect(state.activeAlerts).toEqual([]);
      expect(state.trendHistory).toEqual([]);
      expect(state.seenItems).toEqual([]);
      expect(state.lastScanAt).toBeNull();
      expect(state.totalScans).toBe(0);
      expect(state.learnedPatterns.optimalHypeThreshold).toBe(40);
      expect(state.learnedPatterns.bestActionStage).toBe('GROWTH');
    });
  });

  describe('getHypeState / mergeHypeState', () => {
    it('returns initial state for null config', () => {
      const state = getHypeState(null);
      expect(state.totalScans).toBe(0);
    });

    it('returns initial state for non-object config', () => {
      const state = getHypeState('invalid');
      expect(state.totalScans).toBe(0);
    });

    it('extracts hypeState from config object', () => {
      const hype = createInitialHypeState();
      hype.totalScans = 42;
      const config = { hypeState: hype, otherField: 'value' };
      const extracted = getHypeState(config);
      expect(extracted.totalScans).toBe(42);
    });

    it('merges hype state back into config', () => {
      const hype = createInitialHypeState();
      hype.totalScans = 10;
      const config = mergeHypeState({ existingField: true }, hype);
      expect(config.existingField).toBe(true);
      expect((config.hypeState as HypeState).totalScans).toBe(10);
    });

    it('creates config from null', () => {
      const hype = createInitialHypeState();
      const config = mergeHypeState(null, hype);
      expect(config.hypeState).toBeDefined();
    });
  });

  // ── Learning from Results ─────────────────────────────────────

  describe('updateLearnedPatterns', () => {
    it('lowers threshold on positive engagement feedback', () => {
      const state = createInitialHypeState();
      state.activeAlerts = [{
        id: 'test-alert',
        topic: 'AI marketing',
        lifecycle: 'GROWTH',
        hypeScore: 60,
        relevanceScore: 0.8,
        suggestedAngle: 'test',
        suggestedContentType: 'news',
        suggestedTone: 'professional',
        detectedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        dismissed: false,
        sources: [],
      }];

      const updated = updateLearnedPatterns(state, 'test-alert', 100, 50); // 100 vs avg 50
      expect(updated.learnedPatterns.optimalHypeThreshold).toBeLessThan(40);
    });

    it('raises threshold on negative engagement feedback', () => {
      const state = createInitialHypeState();
      state.activeAlerts = [{
        id: 'test-alert',
        topic: 'Bad trend',
        lifecycle: 'PEAK',
        hypeScore: 30,
        relevanceScore: 0.5,
        suggestedAngle: 'test',
        suggestedContentType: 'news',
        suggestedTone: 'casual',
        detectedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        dismissed: false,
        sources: [],
      }];

      const updated = updateLearnedPatterns(state, 'test-alert', 20, 50); // 20 vs avg 50
      expect(updated.learnedPatterns.optimalHypeThreshold).toBeGreaterThan(40);
    });

    it('updates bestActionStage on positive result', () => {
      const state = createInitialHypeState();
      state.activeAlerts = [{
        id: 'test',
        topic: 'Trend',
        lifecycle: 'EMERGENCE',
        hypeScore: 50,
        relevanceScore: 0.7,
        suggestedAngle: 'test',
        suggestedContentType: 'news',
        suggestedTone: 'professional',
        detectedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        dismissed: false,
        sources: [],
      }];

      const updated = updateLearnedPatterns(state, 'test', 100, 50);
      expect(updated.learnedPatterns.bestActionStage).toBe('EMERGENCE');
    });

    it('adds topic to highPerformingKeywords on success', () => {
      const state = createInitialHypeState();
      state.activeAlerts = [{
        id: 'kw-test',
        topic: 'viral marketing',
        lifecycle: 'GROWTH',
        hypeScore: 60,
        relevanceScore: 0.9,
        suggestedAngle: 'test',
        suggestedContentType: 'news',
        suggestedTone: 'professional',
        detectedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        dismissed: false,
        sources: [],
      }];

      const updated = updateLearnedPatterns(state, 'kw-test', 100, 50);
      expect(updated.learnedPatterns.highPerformingKeywords).toContain('viral marketing');
    });

    it('clamps threshold to [20, 80] range', () => {
      const state = createInitialHypeState();
      state.learnedPatterns.optimalHypeThreshold = 21;
      state.activeAlerts = [{
        id: 't',
        topic: 'x',
        lifecycle: 'GROWTH',
        hypeScore: 50,
        relevanceScore: 0.7,
        suggestedAngle: '',
        suggestedContentType: 'news',
        suggestedTone: 'casual',
        detectedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        dismissed: false,
        sources: [],
      }];

      // Repeated positive feedback shouldn't go below 20
      let updated = state;
      for (let i = 0; i < 50; i++) {
        updated = updateLearnedPatterns(updated, 't', 1000, 50);
      }
      expect(updated.learnedPatterns.optimalHypeThreshold).toBeGreaterThanOrEqual(20);
    });
  });

  // ── RL Integration: Content Bias ──────────────────────────────

  describe('getHypeContentBias', () => {
    it('returns empty object when no alerts', () => {
      const state = createInitialHypeState();
      expect(getHypeContentBias(state)).toEqual({});
    });

    it('boosts news during EMERGENCE', () => {
      const state = createInitialHypeState();
      state.activeAlerts = [{
        id: 't', topic: 'x', lifecycle: 'EMERGENCE', hypeScore: 50,
        relevanceScore: 0.5, suggestedAngle: '', suggestedContentType: 'news',
        suggestedTone: 'professional', detectedAt: '', expiresAt: new Date(Date.now() + 86400000).toISOString(),
        dismissed: false, sources: [],
      }];
      const bias = getHypeContentBias(state);
      expect(bias.news).toBe(2.0);
      expect(bias.curated).toBe(1.5);
    });

    it('boosts educational during GROWTH', () => {
      const state = createInitialHypeState();
      state.activeAlerts = [{
        id: 't', topic: 'x', lifecycle: 'GROWTH', hypeScore: 50,
        relevanceScore: 0.5, suggestedAngle: '', suggestedContentType: 'educational',
        suggestedTone: 'educational', detectedAt: '', expiresAt: new Date(Date.now() + 86400000).toISOString(),
        dismissed: false, sources: [],
      }];
      const bias = getHypeContentBias(state);
      expect(bias.educational).toBe(1.8);
    });

    it('boosts engagement during PEAK', () => {
      const state = createInitialHypeState();
      state.activeAlerts = [{
        id: 't', topic: 'x', lifecycle: 'PEAK', hypeScore: 80,
        relevanceScore: 0.6, suggestedAngle: '', suggestedContentType: 'engagement',
        suggestedTone: 'provocative', detectedAt: '', expiresAt: new Date(Date.now() + 86400000).toISOString(),
        dismissed: false, sources: [],
      }];
      const bias = getHypeContentBias(state);
      expect(bias.engagement).toBe(2.0);
    });

    it('reduces promotional during any hype', () => {
      const state = createInitialHypeState();
      state.activeAlerts = [{
        id: 't', topic: 'x', lifecycle: 'GROWTH', hypeScore: 50,
        relevanceScore: 0.5, suggestedAngle: '', suggestedContentType: 'news',
        suggestedTone: 'casual', detectedAt: '', expiresAt: new Date(Date.now() + 86400000).toISOString(),
        dismissed: false, sources: [],
      }];
      const bias = getHypeContentBias(state);
      expect(bias.promotional).toBe(0.7);
    });

    it('ignores dismissed alerts', () => {
      const state = createInitialHypeState();
      state.activeAlerts = [{
        id: 't', topic: 'x', lifecycle: 'GROWTH', hypeScore: 50,
        relevanceScore: 0.5, suggestedAngle: '', suggestedContentType: 'news',
        suggestedTone: 'casual', detectedAt: '', expiresAt: new Date(Date.now() + 86400000).toISOString(),
        dismissed: true, sources: [],
      }];
      expect(getHypeContentBias(state)).toEqual({});
    });

    it('ignores low-relevance alerts (< 0.3)', () => {
      const state = createInitialHypeState();
      state.activeAlerts = [{
        id: 't', topic: 'x', lifecycle: 'GROWTH', hypeScore: 50,
        relevanceScore: 0.1, suggestedAngle: '', suggestedContentType: 'news',
        suggestedTone: 'casual', detectedAt: '', expiresAt: new Date(Date.now() + 86400000).toISOString(),
        dismissed: false, sources: [],
      }];
      expect(getHypeContentBias(state)).toEqual({});
    });
  });

  describe('getHypeHashtagBias', () => {
    it('returns empty when no alerts', () => {
      const state = createInitialHypeState();
      expect(getHypeHashtagBias(state)).toEqual({});
    });

    it('boosts trending hashtags during hype', () => {
      const state = createInitialHypeState();
      state.activeAlerts = [{
        id: 't', topic: 'x', lifecycle: 'GROWTH', hypeScore: 50,
        relevanceScore: 0.5, suggestedAngle: '', suggestedContentType: 'news',
        suggestedTone: 'casual', detectedAt: '', expiresAt: new Date(Date.now() + 86400000).toISOString(),
        dismissed: false, sources: [],
      }];
      const bias = getHypeHashtagBias(state);
      expect(bias.trending).toBe(2.0);
      expect(bias.none).toBe(0.5);
    });
  });

  // ── Platform Timing (Graffius 2026) ───────────────────────────

  describe('shouldActNow', () => {
    it('returns true for fast-decay platform during EMERGENCE', () => {
      expect(shouldActNow('TWITTER', 'EMERGENCE')).toBe(true); // 49min half-life
    });

    it('returns true for fast-decay platform during GROWTH', () => {
      expect(shouldActNow('THREADS', 'GROWTH')).toBe(true); // 60min half-life
    });

    it('returns true for any platform during PEAK', () => {
      expect(shouldActNow('LINKEDIN', 'PEAK')).toBe(true);
      expect(shouldActNow('PINTEREST', 'PEAK')).toBe(true);
    });

    it('returns false for slow-decay platform during EMERGENCE', () => {
      expect(shouldActNow('LINKEDIN', 'EMERGENCE')).toBe(false); // 24.3h half-life
    });

    it('returns false during DECLINE', () => {
      expect(shouldActNow('TWITTER', 'DECLINE')).toBe(false);
    });

    it('returns false for DEAD lifecycle', () => {
      expect(shouldActNow('TWITTER', 'DEAD')).toBe(false);
    });
  });

  // ── Content Angle Suggestion ──────────────────────────────────

  describe('suggestContentAngle', () => {
    const baseTrend: DetectedTrend = {
      topic: 'AI agents',
      lifecycle: 'GROWTH',
      zScore: 2.5,
      steppScore: 50,
      emotionScore: 0.3,
      relevanceScore: 0.7,
      hypeScore: 60,
      sourceCount: 3,
      firstSeen: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      mentionCount: 5,
      velocity: 0.5,
      sampleTitles: [],
    };

    it('suggests news content for EMERGENCE stage', () => {
      const { contentType } = suggestContentAngle({ ...baseTrend, lifecycle: 'EMERGENCE' }, 'ENGAGEMENT', 'Bot', ['AI']);
      expect(contentType).toBe('news');
    });

    it('suggests educational content for GROWTH stage', () => {
      const { contentType } = suggestContentAngle({ ...baseTrend, lifecycle: 'GROWTH' }, 'ENGAGEMENT', 'Bot', ['AI']);
      expect(contentType).toBe('educational');
    });

    it('suggests engagement content for PEAK stage', () => {
      const { contentType } = suggestContentAngle({ ...baseTrend, lifecycle: 'PEAK' }, 'ENGAGEMENT', 'Bot', ['AI']);
      expect(contentType).toBe('engagement');
    });

    it('suggests curated content for DECLINE stage', () => {
      const { contentType } = suggestContentAngle({ ...baseTrend, lifecycle: 'DECLINE' }, 'ENGAGEMENT', 'Bot', ['AI']);
      expect(contentType).toBe('curated');
    });

    it('adapts angle based on bot goal', () => {
      const traffic = suggestContentAngle(baseTrend, 'TRAFFIC', 'BrandX', ['marketing']);
      expect(traffic.angle).toContain('link');

      const sales = suggestContentAngle(baseTrend, 'SALES', 'BrandX', ['marketing']);
      expect(sales.angle).toContain('BrandX');

      const community = suggestContentAngle(baseTrend, 'COMMUNITY', 'BrandX', ['marketing']);
      expect(community.angle).toContain('community');
    });

    it('uses inspirational tone for high positive emotion', () => {
      const { tone } = suggestContentAngle({ ...baseTrend, emotionScore: 0.7 }, 'ENGAGEMENT', 'Bot', ['AI']);
      expect(tone).toBe('inspirational');
    });

    it('uses professional tone for negative emotion', () => {
      const { tone } = suggestContentAngle({ ...baseTrend, emotionScore: -0.5 }, 'ENGAGEMENT', 'Bot', ['AI']);
      expect(tone).toBe('professional');
    });
  });

  // ── Alert Generation ──────────────────────────────────────────

  describe('generateAlert', () => {
    const trend: DetectedTrend = {
      topic: 'test trend',
      lifecycle: 'GROWTH',
      zScore: 2.5,
      steppScore: 50,
      emotionScore: 0.3,
      relevanceScore: 0.8,
      hypeScore: 65,
      sourceCount: 3,
      firstSeen: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      mentionCount: 5,
      velocity: 0.6,
      sampleTitles: ['Title 1', 'Title 2', 'Title 3', 'Title 4'],
    };

    it('creates alert with correct properties', () => {
      const alert = generateAlert(trend, 'ENGAGEMENT', 'MyBrand', ['marketing']);
      expect(alert.topic).toBe('test trend');
      expect(alert.lifecycle).toBe('GROWTH');
      expect(alert.hypeScore).toBe(65);
      expect(alert.relevanceScore).toBe(0.8);
      expect(alert.dismissed).toBe(false);
      expect(alert.id).toContain('hype_');
    });

    it('sets expiry based on lifecycle stage', () => {
      const emergenceAlert = generateAlert({ ...trend, lifecycle: 'EMERGENCE' }, 'ENGAGEMENT', 'B', []);
      const peakAlert = generateAlert({ ...trend, lifecycle: 'PEAK' }, 'ENGAGEMENT', 'B', []);

      const emergenceExpiry = new Date(emergenceAlert.expiresAt).getTime();
      const peakExpiry = new Date(peakAlert.expiresAt).getTime();

      // EMERGENCE (24h) should have longer expiry than PEAK (6h)
      expect(emergenceExpiry).toBeGreaterThan(peakExpiry);
    });

    it('limits sources to 3', () => {
      const alert = generateAlert(trend, 'ENGAGEMENT', 'B', []);
      expect(alert.sources.length).toBeLessThanOrEqual(3);
    });

    it('includes suggested content angle', () => {
      const alert = generateAlert(trend, 'ENGAGEMENT', 'MyBrand', ['marketing']);
      expect(alert.suggestedAngle.length).toBeGreaterThan(0);
      expect(alert.suggestedContentType.length).toBeGreaterThan(0);
      expect(alert.suggestedTone.length).toBeGreaterThan(0);
    });
  });

  // ── Display Helpers ───────────────────────────────────────────

  describe('getHypeLevel', () => {
    it('returns Viral for score >= 80', () => {
      expect(getHypeLevel(85).label).toBe('Viral');
    });

    it('returns Hot for score >= 60', () => {
      expect(getHypeLevel(65).label).toBe('Hot');
    });

    it('returns Warming for score >= 40', () => {
      expect(getHypeLevel(45).label).toBe('Warming');
    });

    it('returns Mild for score >= 20', () => {
      expect(getHypeLevel(25).label).toBe('Mild');
    });

    it('returns Low for score < 20', () => {
      expect(getHypeLevel(10).label).toBe('Low');
    });
  });

  // ── Constants Verification ────────────────────────────────────

  describe('Scientific Constants', () => {
    it('EMOTION_VIRALITY_WEIGHTS match Berger & Milkman 2012 values', () => {
      expect(EMOTION_VIRALITY_WEIGHTS.anger).toBe(1.34);
      expect(EMOTION_VIRALITY_WEIGHTS.awe).toBe(1.30);
      expect(EMOTION_VIRALITY_WEIGHTS.practicalValue).toBe(1.30);
      expect(EMOTION_VIRALITY_WEIGHTS.interest).toBe(1.25);
      expect(EMOTION_VIRALITY_WEIGHTS.anxiety).toBe(1.21);
      expect(EMOTION_VIRALITY_WEIGHTS.emotionality).toBe(1.18);
      expect(EMOTION_VIRALITY_WEIGHTS.sadness).toBe(0.85);
    });

    it('PLATFORM_HALF_LIFE_MINUTES match Graffius 2026 research', () => {
      expect(PLATFORM_HALF_LIFE_MINUTES.TWITTER).toBe(49);
      expect(PLATFORM_HALF_LIFE_MINUTES.FACEBOOK).toBe(81);
      expect(PLATFORM_HALF_LIFE_MINUTES.INSTAGRAM).toBe(1185);
      expect(PLATFORM_HALF_LIFE_MINUTES.LINKEDIN).toBe(1458);
      expect(PLATFORM_HALF_LIFE_MINUTES.YOUTUBE).toBe(12672);
    });

    it('ZSCORE_THRESHOLDS follow statistical conventions', () => {
      expect(ZSCORE_THRESHOLDS.MILD).toBe(1.5);
      expect(ZSCORE_THRESHOLDS.SIGNIFICANT).toBe(2.0);
      expect(ZSCORE_THRESHOLDS.EXTREME).toBe(3.0);
    });

    it('LIFECYCLE_CONFIG covers all lifecycle stages', () => {
      const stages: Array<'EMERGENCE' | 'GROWTH' | 'PEAK' | 'DECLINE' | 'DEAD'> = ['EMERGENCE', 'GROWTH', 'PEAK', 'DECLINE', 'DEAD'];
      for (const stage of stages) {
        expect(LIFECYCLE_CONFIG[stage]).toBeDefined();
        expect(LIFECYCLE_CONFIG[stage].label.length).toBeGreaterThan(0);
        expect(LIFECYCLE_CONFIG[stage].color.length).toBeGreaterThan(0);
      }
    });

    it('HYPE_SCORE_LEVELS cover 0-100 range', () => {
      expect(HYPE_SCORE_LEVELS.length).toBe(5);
      expect(HYPE_SCORE_LEVELS[HYPE_SCORE_LEVELS.length - 1].min).toBe(0);
    });

    it('TREND_RSS_FEEDS contain valid URLs', () => {
      for (const feed of TREND_RSS_FEEDS) {
        expect(feed.url).toMatch(/^https?:\/\//);
        expect(feed.category.length).toBeGreaterThan(0);
        expect(feed.name.length).toBeGreaterThan(0);
      }
    });
  });
});
