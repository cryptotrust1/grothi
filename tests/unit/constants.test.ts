import {
  PLATFORM_NAMES,
  BOT_STATUS_CONFIG,
  POST_STATUS_COLORS,
  GOAL_LABELS,
  BOT_NAV_TABS,
  TIMEZONES,
  SCHEDULE_PRESETS,
  CONTENT_TYPES,
  ALL_PLATFORMS,
  ACTION_TYPES,
  PLATFORM_REQUIREMENTS,
} from '@/lib/constants';

describe('Constants', () => {
  describe('PLATFORM_NAMES', () => {
    it('contains all 17 platforms', () => {
      expect(Object.keys(PLATFORM_NAMES)).toHaveLength(17);
    });

    it('has human-readable names for all platforms', () => {
      expect(PLATFORM_NAMES.FACEBOOK).toBe('Facebook');
      expect(PLATFORM_NAMES.TWITTER).toBe('X (Twitter)');
      expect(PLATFORM_NAMES.MASTODON).toBe('Mastodon');
      expect(PLATFORM_NAMES.TELEGRAM).toBe('Telegram');
      expect(PLATFORM_NAMES.DEVTO).toBe('Dev.to');
    });

    it('has no empty or undefined values', () => {
      for (const [key, value] of Object.entries(PLATFORM_NAMES)) {
        expect(value).toBeTruthy();
        expect(typeof value).toBe('string');
      }
    });
  });

  describe('BOT_STATUS_CONFIG', () => {
    it('defines all 5 bot statuses', () => {
      const statuses = ['ACTIVE', 'PAUSED', 'STOPPED', 'ERROR', 'NO_CREDITS'];
      for (const status of statuses) {
        expect(BOT_STATUS_CONFIG[status]).toBeDefined();
        expect(BOT_STATUS_CONFIG[status].variant).toBeDefined();
        expect(BOT_STATUS_CONFIG[status].label).toBeDefined();
      }
    });

    it('uses valid badge variants', () => {
      const validVariants = ['success', 'warning', 'destructive', 'secondary'];
      for (const config of Object.values(BOT_STATUS_CONFIG)) {
        expect(validVariants).toContain(config.variant);
      }
    });
  });

  describe('POST_STATUS_COLORS', () => {
    it('defines all 6 post statuses', () => {
      const statuses = ['DRAFT', 'SCHEDULED', 'PUBLISHING', 'PUBLISHED', 'FAILED', 'CANCELLED'];
      for (const status of statuses) {
        expect(POST_STATUS_COLORS[status]).toBeDefined();
        expect(typeof POST_STATUS_COLORS[status]).toBe('string');
      }
    });

    it('all values contain CSS classes', () => {
      for (const classes of Object.values(POST_STATUS_COLORS)) {
        expect(classes).toMatch(/^bg-/);
        expect(classes).toMatch(/text-/);
      }
    });
  });

  describe('GOAL_LABELS', () => {
    it('defines all 6 goals', () => {
      const goals = ['TRAFFIC', 'SALES', 'ENGAGEMENT', 'BRAND_AWARENESS', 'LEADS', 'COMMUNITY'];
      for (const goal of goals) {
        expect(GOAL_LABELS[goal]).toBeDefined();
        expect(typeof GOAL_LABELS[goal]).toBe('string');
      }
    });
  });

  describe('BOT_NAV_TABS', () => {
    it('has 11 tabs', () => {
      expect(BOT_NAV_TABS).toHaveLength(11);
    });

    it('first tab is overview with empty path', () => {
      expect(BOT_NAV_TABS[0].key).toBe('overview');
      expect(BOT_NAV_TABS[0].path).toBe('');
    });

    it('each tab has key, label, and path', () => {
      for (const tab of BOT_NAV_TABS) {
        expect(tab.key).toBeDefined();
        expect(tab.label).toBeDefined();
        expect(typeof tab.path).toBe('string');
      }
    });

    it('all tabs have unique keys', () => {
      const keys = BOT_NAV_TABS.map(t => t.key);
      expect(new Set(keys).size).toBe(keys.length);
    });

    it('paths start with / except overview', () => {
      for (const tab of BOT_NAV_TABS) {
        if (tab.key !== 'overview') {
          expect(tab.path.startsWith('/')).toBe(true);
        }
      }
    });
  });

  describe('TIMEZONES', () => {
    it('contains UTC', () => {
      expect(TIMEZONES).toContain('UTC');
    });

    it('contains common timezones', () => {
      expect(TIMEZONES).toContain('America/New_York');
      expect(TIMEZONES).toContain('Europe/London');
      expect(TIMEZONES).toContain('Europe/Prague');
      expect(TIMEZONES).toContain('Asia/Tokyo');
    });

    it('UTC is first', () => {
      expect(TIMEZONES[0]).toBe('UTC');
    });
  });

  describe('SCHEDULE_PRESETS', () => {
    it('first preset is Custom with empty value', () => {
      expect(SCHEDULE_PRESETS[0].value).toBe('');
      expect(SCHEDULE_PRESETS[0].label).toBe('Custom');
    });

    it('all cron values use valid format', () => {
      for (const preset of SCHEDULE_PRESETS) {
        if (preset.value) {
          const parts = preset.value.split(' ');
          expect(parts).toHaveLength(5);
        }
      }
    });
  });

  describe('ALL_PLATFORMS', () => {
    it('contains all 17 platforms', () => {
      expect(ALL_PLATFORMS).toHaveLength(17);
    });

    it('matches PLATFORM_NAMES keys', () => {
      const nameKeys = Object.keys(PLATFORM_NAMES).sort();
      const allPlatforms = [...ALL_PLATFORMS].sort();
      expect(allPlatforms).toEqual(nameKeys);
    });
  });

  describe('ACTION_TYPES', () => {
    it('contains expected action types', () => {
      expect(ACTION_TYPES).toContain('POST');
      expect(ACTION_TYPES).toContain('REPLY');
      expect(ACTION_TYPES).toContain('FAVOURITE');
      expect(ACTION_TYPES).toContain('BOOST');
      expect(ACTION_TYPES).toContain('SCAN_FEEDS');
      expect(ACTION_TYPES).toContain('GENERATE_CONTENT');
      expect(ACTION_TYPES).toContain('SAFETY_BLOCK');
    });
  });

  describe('PLATFORM_REQUIREMENTS', () => {
    it('has requirements for all 17 platforms', () => {
      expect(Object.keys(PLATFORM_REQUIREMENTS)).toHaveLength(17);
    });

    it('matches ALL_PLATFORMS entries', () => {
      const reqKeys = Object.keys(PLATFORM_REQUIREMENTS).sort();
      const allPlatforms = [...ALL_PLATFORMS].sort();
      expect(reqKeys).toEqual(allPlatforms);
    });

    it('each platform has all required fields', () => {
      for (const [key, req] of Object.entries(PLATFORM_REQUIREMENTS)) {
        expect(req.name).toBeTruthy();
        expect(typeof req.mediaRequired).toBe('boolean');
        expect(typeof req.textOnly).toBe('boolean');
        expect(typeof req.maxCharacters).toBe('number');
        expect(req.maxCharacters).toBeGreaterThan(0);
        expect(Array.isArray(req.supportedMediaTypes)).toBe(true);
        expect(Array.isArray(req.imageFormats)).toBe(true);
        expect(Array.isArray(req.videoFormats)).toBe(true);
        expect(typeof req.maxImageSizeMB).toBe('number');
        expect(typeof req.maxVideoSizeMB).toBe('number');
        expect(Array.isArray(req.recommendedDimensions)).toBe(true);
        expect(req.recommendedDimensions.length).toBeGreaterThan(0);
        expect(typeof req.note).toBe('string');
        expect(req.note.length).toBeGreaterThan(0);
      }
    });

    it('mediaRequired and textOnly are mutually exclusive', () => {
      for (const [key, req] of Object.entries(PLATFORM_REQUIREMENTS)) {
        if (req.mediaRequired) {
          expect(req.textOnly).toBe(false);
        }
      }
    });

    it('Instagram requires media', () => {
      expect(PLATFORM_REQUIREMENTS.INSTAGRAM.mediaRequired).toBe(true);
      expect(PLATFORM_REQUIREMENTS.INSTAGRAM.textOnly).toBe(false);
    });

    it('TikTok requires media', () => {
      expect(PLATFORM_REQUIREMENTS.TIKTOK.mediaRequired).toBe(true);
      expect(PLATFORM_REQUIREMENTS.TIKTOK.textOnly).toBe(false);
    });

    it('Pinterest requires media', () => {
      expect(PLATFORM_REQUIREMENTS.PINTEREST.mediaRequired).toBe(true);
      expect(PLATFORM_REQUIREMENTS.PINTEREST.textOnly).toBe(false);
    });

    it('YouTube requires media', () => {
      expect(PLATFORM_REQUIREMENTS.YOUTUBE.mediaRequired).toBe(true);
      expect(PLATFORM_REQUIREMENTS.YOUTUBE.textOnly).toBe(false);
    });

    it('Facebook supports text-only', () => {
      expect(PLATFORM_REQUIREMENTS.FACEBOOK.mediaRequired).toBe(false);
      expect(PLATFORM_REQUIREMENTS.FACEBOOK.textOnly).toBe(true);
    });

    it('Threads supports text-only', () => {
      expect(PLATFORM_REQUIREMENTS.THREADS.mediaRequired).toBe(false);
      expect(PLATFORM_REQUIREMENTS.THREADS.textOnly).toBe(true);
    });

    it('character limits match known platform limits', () => {
      expect(PLATFORM_REQUIREMENTS.TWITTER.maxCharacters).toBe(280);
      expect(PLATFORM_REQUIREMENTS.THREADS.maxCharacters).toBe(500);
      expect(PLATFORM_REQUIREMENTS.INSTAGRAM.maxCharacters).toBe(2200);
      expect(PLATFORM_REQUIREMENTS.FACEBOOK.maxCharacters).toBe(63206);
      expect(PLATFORM_REQUIREMENTS.MASTODON.maxCharacters).toBe(500);
      expect(PLATFORM_REQUIREMENTS.BLUESKY.maxCharacters).toBe(300);
    });

    it('recommended dimensions have valid values', () => {
      for (const req of Object.values(PLATFORM_REQUIREMENTS)) {
        for (const dim of req.recommendedDimensions) {
          expect(dim.width).toBeGreaterThan(0);
          expect(dim.height).toBeGreaterThan(0);
          expect(dim.aspect).toBeTruthy();
          expect(dim.label).toBeTruthy();
        }
      }
    });

    it('Instagram only supports JPEG and PNG', () => {
      expect(PLATFORM_REQUIREMENTS.INSTAGRAM.imageFormats).toEqual(['JPEG', 'PNG']);
    });

    it('Bluesky has 1MB image limit', () => {
      expect(PLATFORM_REQUIREMENTS.BLUESKY.maxImageSizeMB).toBe(1);
    });
  });
});
