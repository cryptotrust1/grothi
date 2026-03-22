import {
  fingerprintContent,
  computeEngagementScore,
  computeAgeAdjustedScore,
  ENGAGEMENT_WEIGHTS,
  DIMENSION_ARMS,
} from '@/lib/rl-engine';

describe('RL Engine', () => {
  // ── Content Fingerprinting ─────────────────────────────────

  describe('fingerprintContent', () => {
    it('detects educational content', () => {
      const result = fingerprintContent('Here are 5 tips to improve your social media strategy. Learn how to grow your audience with these proven techniques.');
      expect(result.contentType).toBe('educational');
    });

    it('detects promotional content', () => {
      const result = fingerprintContent('SALE! Buy now and get 50% discount. Limited time offer. Link in bio!');
      expect(result.contentType).toBe('promotional');
    });

    it('detects engagement content', () => {
      const result = fingerprintContent('What do you think about the new update? Comment below and share your opinion!');
      expect(result.contentType).toBe('engagement');
    });

    it('detects storytelling content', () => {
      const result = fingerprintContent('I remember when it all started. My journey began 5 years ago when I was looking back at my experience...');
      expect(result.contentType).toBe('storytelling');
    });

    it('detects news content', () => {
      const result = fingerprintContent('BREAKING: New update released today. According to the official announcement confirmed by the source...');
      expect(result.contentType).toBe('news');
    });

    it('detects professional tone', () => {
      const result = fingerprintContent('Furthermore, we are pleased to announce our strategy to leverage industry insights and optimize performance.');
      expect(result.toneStyle).toBe('professional');
    });

    it('detects casual tone', () => {
      const result = fingerprintContent('hey guys!! gonna share some cool stuff tbh this is kinda amazing lol');
      expect(result.toneStyle).toBe('casual');
    });

    it('detects humorous tone', () => {
      const result = fingerprintContent('lol this meme is so funny haha. Plot twist: the joke is on us rofl');
      expect(result.toneStyle).toBe('humorous');
    });

    it('detects inspirational tone', () => {
      const result = fingerprintContent('Believe in your dreams. You can achieve greatness. Never give up on your passion and purpose!');
      expect(result.toneStyle).toBe('inspirational');
    });

    it('detects provocative tone', () => {
      const result = fingerprintContent('Unpopular opinion: this is completely overrated. Hot take: stop believing this myth.');
      expect(result.toneStyle).toBe('provocative');
    });

    // Hashtag patterns
    it('detects no hashtags', () => {
      const result = fingerprintContent('A post without any hashtags at all.');
      expect(result.hashtagPattern).toBe('none');
    });

    it('detects minimal hashtags (1-2)', () => {
      const result = fingerprintContent('Great content here #marketing #tips');
      expect(result.hashtagPattern).toBe('minimal');
    });

    it('detects moderate hashtags (3-5)', () => {
      const result = fingerprintContent('Check this out #marketing #social #media #tips #growth');
      expect(result.hashtagPattern).toBe('niche');
    });

    it('detects heavy hashtags (6+)', () => {
      const result = fingerprintContent('#a #b #c #d #e #f #g #h #i #j #k');
      expect(result.hashtagPattern).toBe('heavy');
    });

    it('returns confidence between 0 and 1', () => {
      const result = fingerprintContent('Some generic text here.');
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('returns higher confidence for signal-rich content', () => {
      const weak = fingerprintContent('Hello.');
      const strong = fingerprintContent('Here are 10 tips to learn how to improve your strategy. This educational guide explains step by step how to understand the data.');
      expect(strong.confidence).toBeGreaterThan(weak.confidence);
    });

    it('returns valid content types from DIMENSION_ARMS', () => {
      const inputs = [
        'Buy now discount sale!',
        'What do you think? Comment below!',
        'Here are 5 tips to learn...',
        'Breaking news update today!',
      ];
      for (const input of inputs) {
        const result = fingerprintContent(input);
        expect(DIMENSION_ARMS.CONTENT_TYPE).toContain(result.contentType);
        expect(DIMENSION_ARMS.TONE_STYLE).toContain(result.toneStyle);
        expect(DIMENSION_ARMS.HASHTAG_PATTERN).toContain(result.hashtagPattern);
      }
    });
  });

  // ── Engagement Score ───────────────────────────────────────

  describe('computeEngagementScore', () => {
    it('computes base score from likes, comments, shares, saves', () => {
      const score = computeEngagementScore(
        { likes: 10, comments: 5, shares: 2, saves: 3 },
        'FACEBOOK'
      );
      // Facebook platform weights: L*1 + C*3 + S*6 + saves*2 = 10+15+12+6 = 43
      // Facebook bonus: shares * 2 = 2*2 = 4
      expect(score).toBe(47);
    });

    it('handles zero metrics', () => {
      const score = computeEngagementScore(
        { likes: 0, comments: 0, shares: 0, saves: 0 },
        'TWITTER'
      );
      expect(score).toBe(0);
    });

    it('applies platform-specific weights for Instagram saves', () => {
      const score = computeEngagementScore(
        { likes: 0, comments: 0, shares: 0, saves: 10 },
        'INSTAGRAM'
      );
      // Instagram platform weights: saves*6 = 60, bonus: saves*1 = 10
      expect(score).toBe(70);
    });

    it('applies watch time bonus for TikTok', () => {
      const score = computeEngagementScore(
        { likes: 0, comments: 0, shares: 0, saves: 0, watchTimeSec: 100 },
        'TIKTOK'
      );
      // bonus: 100 * 0.5 = 50
      expect(score).toBe(50);
    });
  });

  // ── Time-Decayed Scoring ───────────────────────────────────

  describe('computeAgeAdjustedScore', () => {
    it('returns raw score for very old posts (saturation ~1)', () => {
      const oldDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days
      const adjusted = computeAgeAdjustedScore(100, oldDate, 'FACEBOOK');
      // After 30 days, saturation is ~1, so adjusted ≈ raw
      expect(adjusted).toBeCloseTo(100, 0);
    });

    it('amplifies score for newer posts', () => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const adjusted = computeAgeAdjustedScore(10, oneHourAgo, 'FACEBOOK');
      // Facebook halflife = 6h, 1h old → saturation = 1 - e^(-1/6) ≈ 0.154
      // adjusted = 10 / 0.154 ≈ 65
      expect(adjusted).toBeGreaterThan(10);
      expect(adjusted).toBeLessThan(200);
    });

    it('respects platform halflife differences', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const twitterScore = computeAgeAdjustedScore(10, twoHoursAgo, 'TWITTER');
      const pinterestScore = computeAgeAdjustedScore(10, twoHoursAgo, 'PINTEREST');
      // Twitter halflife = 0.5h, Pinterest = 168h
      // Twitter should be closer to raw (post is old relative to halflife)
      // Pinterest should be much amplified (post is very new relative to halflife)
      expect(twitterScore).toBeLessThan(pinterestScore);
    });

    it('does not amplify very fresh posts beyond 10x', () => {
      const justNow = new Date(Date.now() - 60 * 1000); // 1 minute ago
      const adjusted = computeAgeAdjustedScore(10, justNow, 'PINTEREST');
      // Clamp to 0.1 minimum saturation → max 10x amplification
      expect(adjusted).toBeLessThanOrEqual(100);
    });

    it('does not modify score for sub-6-minute posts', () => {
      const veryFresh = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes
      const adjusted = computeAgeAdjustedScore(10, veryFresh, 'FACEBOOK');
      // ageHours ≈ 0.083, which is < 0.1 → returns raw score
      expect(adjusted).toBe(10);
    });
  });

  // ── Constants Validation ───────────────────────────────────

  describe('DIMENSION_ARMS', () => {
    it('has 24 time slots (0-23)', () => {
      expect(DIMENSION_ARMS.TIME_SLOT).toHaveLength(24);
      expect(DIMENSION_ARMS.TIME_SLOT[0]).toBe('0');
      expect(DIMENSION_ARMS.TIME_SLOT[23]).toBe('23');
    });

    it('has 7 content types', () => {
      expect(DIMENSION_ARMS.CONTENT_TYPE).toHaveLength(7);
      expect(DIMENSION_ARMS.CONTENT_TYPE).toContain('educational');
      expect(DIMENSION_ARMS.CONTENT_TYPE).toContain('promotional');
    });

    it('has 7 hashtag patterns', () => {
      expect(DIMENSION_ARMS.HASHTAG_PATTERN).toHaveLength(7);
      expect(DIMENSION_ARMS.HASHTAG_PATTERN).toContain('none');
      expect(DIMENSION_ARMS.HASHTAG_PATTERN).toContain('branded');
    });

    it('has 6 tone styles', () => {
      expect(DIMENSION_ARMS.TONE_STYLE).toHaveLength(6);
      expect(DIMENSION_ARMS.TONE_STYLE).toContain('professional');
      expect(DIMENSION_ARMS.TONE_STYLE).toContain('provocative');
    });
  });

  describe('ENGAGEMENT_WEIGHTS', () => {
    it('values comments higher than likes', () => {
      expect(ENGAGEMENT_WEIGHTS.comments).toBeGreaterThan(ENGAGEMENT_WEIGHTS.likes);
    });

    it('values shares highest', () => {
      expect(ENGAGEMENT_WEIGHTS.shares).toBeGreaterThan(ENGAGEMENT_WEIGHTS.comments);
      expect(ENGAGEMENT_WEIGHTS.shares).toBeGreaterThan(ENGAGEMENT_WEIGHTS.saves);
    });
  });
});
