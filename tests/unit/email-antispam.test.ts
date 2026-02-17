import {
  analyzeSpamScore,
  getWarmupDailyLimit,
  getEffectiveDailyLimit,
  checkCampaignHealth,
  evaluateContactEngagement,
  getSendDelay,
  getSendingPace,
} from '@/lib/email-antispam';

describe('Email Anti-Spam Module', () => {
  // ============ SPAM SCORE ANALYSIS ============

  describe('analyzeSpamScore', () => {
    it('returns safe score for clean content', () => {
      const result = analyzeSpamScore(
        'Monthly newsletter from Grothi',
        '<html><body><h1>Hello {{firstName}},</h1><p>Here is your monthly update with the latest features and tips for your marketing bots.</p></body></html>',
      );
      expect(result.level).toBe('safe');
      expect(result.score).toBeLessThan(3);
    });

    it('flags empty subject as high risk', () => {
      const result = analyzeSpamScore('', '<p>Body content</p>');
      expect(result.score).toBeGreaterThanOrEqual(3);
      expect(result.warnings).toContainEqual(expect.stringContaining('Empty subject'));
    });

    it('flags ALL CAPS subject', () => {
      const result = analyzeSpamScore('BUY NOW FREE OFFER', '<p>Regular body text with enough content for analysis purposes.</p>');
      expect(result.score).toBeGreaterThan(3);
      expect(result.warnings).toContainEqual(expect.stringContaining('ALL CAPS'));
    });

    it('flags excessive exclamation marks in subject', () => {
      const result = analyzeSpamScore('Amazing deal!!!', '<p>Check out our latest products and services today.</p>');
      expect(result.warnings).toContainEqual(expect.stringContaining('exclamation'));
    });

    it('flags RE:/FW: prefix on new emails', () => {
      const result = analyzeSpamScore('RE: Your order', '<p>Body text with enough content here.</p>');
      expect(result.warnings).toContainEqual(expect.stringContaining('RE:/FW:'));
    });

    it('flags URL shorteners in content', () => {
      const result = analyzeSpamScore(
        'Click to see',
        '<p>Visit us at <a href="https://bit.ly/abc123">this link</a> for more info about our products.</p>',
      );
      expect(result.warnings).toContainEqual(expect.stringContaining('URL shortener'));
    });

    it('flags JavaScript in HTML', () => {
      const result = analyzeSpamScore(
        'Newsletter',
        '<html><body><script>alert("hi")</script><p>Content</p></body></html>',
      );
      expect(result.warnings).toContainEqual(expect.stringContaining('JavaScript'));
    });

    it('flags forms in HTML', () => {
      const result = analyzeSpamScore(
        'Newsletter',
        '<html><body><form action="/submit"><input type="text" /></form><p>Sign up today and get started</p></body></html>',
      );
      expect(result.warnings).toContainEqual(expect.stringContaining('form'));
    });

    it('flags hidden text (font-size: 0)', () => {
      const result = analyzeSpamScore(
        'Newsletter',
        '<p>Visible text</p><p style="font-size: 0">Hidden keywords spam</p>',
      );
      expect(result.warnings).toContainEqual(expect.stringContaining('Zero-size font'));
    });

    it('detects spam trigger words and returns them in details', () => {
      const result = analyzeSpamScore(
        'Limited time offer',
        '<p>Act now to earn money with our risk-free guarantee! This is not spam!</p>',
      );
      expect(result.details.triggerWords.length).toBeGreaterThan(0);
      expect(result.score).toBeGreaterThan(5);
    });

    it('blocks extremely spammy content (score >= 8)', () => {
      const result = analyzeSpamScore(
        'FREE!!! CLICK HERE NOW!!! EARN MONEY!!!',
        '<html><body><script>x</script><p style="font-size:0">hidden</p><p>CONGRATULATIONS YOU ARE A WINNER! Act now for your cash bonus! This is not spam! Click here to earn money with no obligation risk free! Double your income guaranteed!</p><a href="https://bit.ly/spam">CLICK</a></body></html>',
      );
      expect(result.level).toBe('blocked');
      expect(result.score).toBeGreaterThanOrEqual(8);
    });

    it('handles subject length warnings', () => {
      const longSubject = 'A'.repeat(80);
      const result = analyzeSpamScore(longSubject, '<p>Regular content with sufficient text for proper analysis.</p>');
      expect(result.warnings).toContainEqual(expect.stringContaining('too long'));
    });

    it('flags images without alt text', () => {
      const result = analyzeSpamScore(
        'Newsletter',
        '<p>Check this out</p><img src="photo.jpg"><img src="banner.jpg">',
      );
      expect(result.warnings).toContainEqual(expect.stringContaining('missing alt text'));
    });
  });

  // ============ WARM-UP DAILY LIMITS ============

  describe('getWarmupDailyLimit', () => {
    it('returns 50 for day 1 accounts', () => {
      const result = getWarmupDailyLimit(new Date());
      expect(result).toBe(50);
    });

    it('returns 200 for day 5 accounts', () => {
      const fiveDaysAgo = new Date(Date.now() - 5 * 86400000);
      expect(getWarmupDailyLimit(fiveDaysAgo)).toBe(200);
    });

    it('returns 500 for day 10 accounts', () => {
      const tenDaysAgo = new Date(Date.now() - 10 * 86400000);
      expect(getWarmupDailyLimit(tenDaysAgo)).toBe(500);
    });

    it('returns 1000 for day 18 accounts', () => {
      const eighteenDaysAgo = new Date(Date.now() - 18 * 86400000);
      expect(getWarmupDailyLimit(eighteenDaysAgo)).toBe(1000);
    });

    it('returns 2000 for day 25 accounts', () => {
      const twentyFiveDaysAgo = new Date(Date.now() - 25 * 86400000);
      expect(getWarmupDailyLimit(twentyFiveDaysAgo)).toBe(2000);
    });

    it('returns 5000 for day 35 accounts', () => {
      const thirtyFiveDaysAgo = new Date(Date.now() - 35 * 86400000);
      expect(getWarmupDailyLimit(thirtyFiveDaysAgo)).toBe(5000);
    });

    it('returns Infinity for mature accounts (43+ days)', () => {
      const fiftyDaysAgo = new Date(Date.now() - 50 * 86400000);
      expect(getWarmupDailyLimit(fiftyDaysAgo)).toBe(Infinity);
    });
  });

  describe('getEffectiveDailyLimit', () => {
    it('returns warm-up limit when lower than user limit', () => {
      const newAccount = new Date(); // day 1 = 50/day warm-up
      const result = getEffectiveDailyLimit(2000, newAccount);
      expect(result.limit).toBe(50);
      expect(result.isWarmupRestricted).toBe(true);
      expect(result.warmupDay).toBe(1);
    });

    it('returns user limit when lower than warm-up limit', () => {
      const matureAccount = new Date(Date.now() - 50 * 86400000);
      const result = getEffectiveDailyLimit(500, matureAccount);
      expect(result.limit).toBe(500);
      expect(result.isWarmupRestricted).toBe(false);
    });

    it('returns user limit for mature accounts with high limits', () => {
      const matureAccount = new Date(Date.now() - 60 * 86400000);
      const result = getEffectiveDailyLimit(10000, matureAccount);
      expect(result.limit).toBe(10000);
      expect(result.isWarmupRestricted).toBe(false);
    });
  });

  // ============ CAMPAIGN HEALTH CHECKS ============

  describe('checkCampaignHealth', () => {
    it('allows sending with clean history', () => {
      const result = checkCampaignHealth([
        { totalSent: 1000, totalBounced: 2, totalComplaints: 0 },
      ]);
      expect(result.canSend).toBe(true);
      expect(result.action).toBe('allow');
    });

    it('allows sending with no history', () => {
      const result = checkCampaignHealth([]);
      expect(result.canSend).toBe(true);
    });

    it('pauses when bounce rate exceeds 2%', () => {
      const result = checkCampaignHealth([
        { totalSent: 1000, totalBounced: 30, totalComplaints: 0 },
      ]);
      expect(result.canSend).toBe(false);
      expect(result.action).toBe('pause');
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('warns when bounce rate exceeds 0.5%', () => {
      const result = checkCampaignHealth([
        { totalSent: 1000, totalBounced: 8, totalComplaints: 0 },
      ]);
      expect(result.canSend).toBe(true);
      expect(result.action).toBe('warn');
    });

    it('pauses when complaint rate exceeds 0.1%', () => {
      const result = checkCampaignHealth([
        { totalSent: 10000, totalBounced: 0, totalComplaints: 15 },
      ]);
      expect(result.canSend).toBe(false);
      expect(result.action).toBe('pause');
    });

    it('warns when complaint rate exceeds 0.05%', () => {
      const result = checkCampaignHealth([
        { totalSent: 10000, totalBounced: 0, totalComplaints: 6 },
      ]);
      expect(result.canSend).toBe(true);
      expect(result.action).toBe('warn');
    });

    it('aggregates stats from multiple campaigns', () => {
      const result = checkCampaignHealth([
        { totalSent: 500, totalBounced: 5, totalComplaints: 0 },
        { totalSent: 500, totalBounced: 20, totalComplaints: 0 },
      ]);
      // 25/1000 = 2.5% bounce rate → pause
      expect(result.canSend).toBe(false);
      expect(result.bounceRate).toBe(2.5);
    });
  });

  // ============ ENGAGEMENT-BASED SUNSET ============

  describe('evaluateContactEngagement', () => {
    const baseContact = {
      lastOpenAt: null,
      lastClickAt: null,
      createdAt: new Date(),
      openCount: 0,
      clickCount: 0,
    };

    it('marks recently engaged contacts as active', () => {
      const contact = {
        ...baseContact,
        lastOpenAt: new Date(Date.now() - 5 * 86400000), // 5 days ago
      };
      const result = evaluateContactEngagement(contact);
      expect(result.segment).toBe('active');
      expect(result.action).toBe('keep');
    });

    it('marks 60-day-old engagement as lapsing', () => {
      const contact = {
        ...baseContact,
        lastOpenAt: new Date(Date.now() - 60 * 86400000),
      };
      const result = evaluateContactEngagement(contact);
      expect(result.segment).toBe('lapsing');
      expect(result.action).toBe('reduce_frequency');
    });

    it('marks 120-day-old engagement as at risk', () => {
      const contact = {
        ...baseContact,
        lastClickAt: new Date(Date.now() - 120 * 86400000),
      };
      const result = evaluateContactEngagement(contact);
      expect(result.segment).toBe('at_risk');
      expect(result.action).toBe('re_engage');
    });

    it('marks 200-day-old engagement as inactive', () => {
      const contact = {
        ...baseContact,
        lastOpenAt: new Date(Date.now() - 200 * 86400000),
      };
      const result = evaluateContactEngagement(contact);
      expect(result.segment).toBe('inactive');
      expect(result.action).toBe('suppress');
    });

    it('marks 400-day-old engagement as dead', () => {
      const contact = {
        ...baseContact,
        createdAt: new Date(Date.now() - 400 * 86400000),
      };
      const result = evaluateContactEngagement(contact);
      expect(result.segment).toBe('dead');
    });

    it('uses creation date when no engagement exists', () => {
      const contact = {
        ...baseContact,
        createdAt: new Date(Date.now() - 100 * 86400000), // created 100 days ago, never opened
      };
      const result = evaluateContactEngagement(contact);
      expect(result.segment).toBe('at_risk');
    });

    it('uses most recent engagement (click > open)', () => {
      const contact = {
        ...baseContact,
        lastOpenAt: new Date(Date.now() - 100 * 86400000),
        lastClickAt: new Date(Date.now() - 10 * 86400000), // clicked recently
      };
      const result = evaluateContactEngagement(contact);
      expect(result.segment).toBe('active');
    });
  });

  // ============ SENDING RATE LIMITS ============

  describe('getSendDelay', () => {
    it('returns 200ms for new accounts (< 7 days)', () => {
      expect(getSendDelay(new Date())).toBe(200);
    });

    it('returns 150ms for 10-day accounts', () => {
      expect(getSendDelay(new Date(Date.now() - 10 * 86400000))).toBe(150);
    });

    it('returns 100ms for 20-day accounts', () => {
      expect(getSendDelay(new Date(Date.now() - 20 * 86400000))).toBe(100);
    });

    it('returns 50ms for mature accounts (30+ days)', () => {
      expect(getSendDelay(new Date(Date.now() - 30 * 86400000))).toBe(50);
    });
  });

  describe('getSendingPace', () => {
    it('returns small batches for new accounts', () => {
      const pace = getSendingPace(new Date());
      expect(pace.batchSize).toBe(10);
      expect(pace.perEmailDelayMs).toBe(200);
    });

    it('returns larger batches for mature accounts', () => {
      const pace = getSendingPace(new Date(Date.now() - 30 * 86400000));
      expect(pace.batchSize).toBe(50);
      expect(pace.perEmailDelayMs).toBe(50);
    });
  });
});
