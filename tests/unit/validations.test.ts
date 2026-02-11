import {
  signUpSchema,
  signInSchema,
  createBotSchema,
  platformConnectionSchema,
} from '@/lib/validations';

describe('Validation Schemas', () => {
  describe('signUpSchema', () => {
    it('accepts valid signup data', () => {
      const result = signUpSchema.safeParse({
        name: 'John Doe',
        email: 'john@example.com',
        password: 'SecurePass1',
      });
      expect(result.success).toBe(true);
    });

    it('rejects short name', () => {
      const result = signUpSchema.safeParse({
        name: 'J',
        email: 'john@example.com',
        password: 'SecurePass1',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid email', () => {
      const result = signUpSchema.safeParse({
        name: 'John Doe',
        email: 'not-an-email',
        password: 'SecurePass1',
      });
      expect(result.success).toBe(false);
    });

    it('rejects short password', () => {
      const result = signUpSchema.safeParse({
        name: 'John Doe',
        email: 'john@example.com',
        password: 'Sh1',
      });
      expect(result.success).toBe(false);
    });

    it('rejects password without uppercase', () => {
      const result = signUpSchema.safeParse({
        name: 'John Doe',
        email: 'john@example.com',
        password: 'lowercase1',
      });
      expect(result.success).toBe(false);
    });

    it('rejects password without number', () => {
      const result = signUpSchema.safeParse({
        name: 'John Doe',
        email: 'john@example.com',
        password: 'NoNumberHere',
      });
      expect(result.success).toBe(false);
    });

    it('rejects missing fields', () => {
      const result = signUpSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('signInSchema', () => {
    it('accepts valid signin data', () => {
      const result = signInSchema.safeParse({
        email: 'john@example.com',
        password: 'anypassword',
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty password', () => {
      const result = signInSchema.safeParse({
        email: 'john@example.com',
        password: '',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid email', () => {
      const result = signInSchema.safeParse({
        email: 'invalid',
        password: 'password',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('createBotSchema', () => {
    const validBot = {
      name: 'TestBot',
      brandName: 'TestBrand',
      instructions: 'This is a test bot with enough characters to pass validation',
    };

    it('accepts valid bot data', () => {
      const result = createBotSchema.safeParse(validBot);
      expect(result.success).toBe(true);
    });

    it('applies defaults for optional fields', () => {
      const result = createBotSchema.safeParse(validBot);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.safetyLevel).toBe('MODERATE');
        expect(result.data.goal).toBe('ENGAGEMENT');
        expect(result.data.timezone).toBe('UTC');
      }
    });

    it('rejects short bot name', () => {
      const result = createBotSchema.safeParse({ ...validBot, name: 'X' });
      expect(result.success).toBe(false);
    });

    it('rejects long bot name', () => {
      const result = createBotSchema.safeParse({
        ...validBot,
        name: 'A'.repeat(51),
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty brand name', () => {
      const result = createBotSchema.safeParse({ ...validBot, brandName: '' });
      expect(result.success).toBe(false);
    });

    it('rejects short instructions', () => {
      const result = createBotSchema.safeParse({
        ...validBot,
        instructions: 'Short',
      });
      expect(result.success).toBe(false);
    });

    it('validates safety level enum', () => {
      const result = createBotSchema.safeParse({
        ...validBot,
        safetyLevel: 'INVALID',
      });
      expect(result.success).toBe(false);
    });

    it('accepts valid safety levels', () => {
      for (const level of ['CONSERVATIVE', 'MODERATE', 'AGGRESSIVE']) {
        const result = createBotSchema.safeParse({
          ...validBot,
          safetyLevel: level,
        });
        expect(result.success).toBe(true);
      }
    });

    it('validates goal enum', () => {
      for (const goal of ['TRAFFIC', 'SALES', 'ENGAGEMENT', 'BRAND_AWARENESS', 'LEADS', 'COMMUNITY']) {
        const result = createBotSchema.safeParse({ ...validBot, goal });
        expect(result.success).toBe(true);
      }
    });

    it('rejects invalid goal', () => {
      const result = createBotSchema.safeParse({ ...validBot, goal: 'INVALID' });
      expect(result.success).toBe(false);
    });

    it('accepts valid target URL', () => {
      const result = createBotSchema.safeParse({
        ...validBot,
        targetUrl: 'https://example.com',
      });
      expect(result.success).toBe(true);
    });

    it('accepts empty target URL', () => {
      const result = createBotSchema.safeParse({
        ...validBot,
        targetUrl: '',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid target URL', () => {
      const result = createBotSchema.safeParse({
        ...validBot,
        targetUrl: 'not-a-url',
      });
      expect(result.success).toBe(false);
    });

    it('validates RSS feeds are URLs', () => {
      const result = createBotSchema.safeParse({
        ...validBot,
        rssFeeds: ['https://example.com/feed', 'https://blog.com/rss'],
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid RSS feeds', () => {
      const result = createBotSchema.safeParse({
        ...validBot,
        rssFeeds: ['not-a-url'],
      });
      expect(result.success).toBe(false);
    });

    it('rejects too many RSS feeds', () => {
      const feeds = Array.from({ length: 21 }, (_, i) => `https://feed${i}.com/rss`);
      const result = createBotSchema.safeParse({
        ...validBot,
        rssFeeds: feeds,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('platformConnectionSchema', () => {
    it('accepts valid platform connection', () => {
      const result = platformConnectionSchema.safeParse({
        platform: 'FACEBOOK',
        credentials: { pageId: '123', accessToken: 'abc' },
      });
      expect(result.success).toBe(true);
    });

    it('validates all 17 platform types', () => {
      const platforms = [
        'MASTODON', 'FACEBOOK', 'TELEGRAM', 'MOLTBOOK',
        'DISCORD', 'TWITTER', 'BLUESKY', 'REDDIT', 'DEVTO',
        'LINKEDIN', 'INSTAGRAM', 'TIKTOK', 'PINTEREST',
        'THREADS', 'MEDIUM', 'YOUTUBE', 'NOSTR',
      ];
      for (const platform of platforms) {
        const result = platformConnectionSchema.safeParse({
          platform,
          credentials: { token: 'abc' },
        });
        expect(result.success).toBe(true);
      }
    });

    it('rejects invalid platform', () => {
      const result = platformConnectionSchema.safeParse({
        platform: 'INVALID',
        credentials: { token: 'abc' },
      });
      expect(result.success).toBe(false);
    });

    it('requires credentials', () => {
      const result = platformConnectionSchema.safeParse({
        platform: 'FACEBOOK',
      });
      expect(result.success).toBe(false);
    });
  });
});
