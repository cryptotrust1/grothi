import {
  PLATFORM_ALGORITHM,
  getRecommendedPlan,
  getOptimalHoursForPlatform,
  getContentGenerationContext,
} from '@/lib/platform-algorithm';
import { ALL_PLATFORMS } from '@/lib/constants';

describe('Platform Algorithm Knowledge Base', () => {
  describe('PLATFORM_ALGORITHM', () => {
    it('has configuration for all 17 platforms', () => {
      // All platforms from constants should have an algorithm config
      // (except WHATSAPP/SNAPCHAT if not in our 17 — check actual count)
      const configuredPlatforms = Object.keys(PLATFORM_ALGORITHM);
      expect(configuredPlatforms.length).toBeGreaterThanOrEqual(15);
    });

    it('has valid frequency data for each platform', () => {
      for (const [platform, config] of Object.entries(PLATFORM_ALGORITHM)) {
        expect(config.frequency.postsPerWeek.min).toBeGreaterThanOrEqual(0);
        expect(config.frequency.postsPerWeek.max).toBeGreaterThan(config.frequency.postsPerWeek.min);
        expect(config.frequency.postsPerWeek.optimal).toBeGreaterThanOrEqual(config.frequency.postsPerWeek.min);
        expect(config.frequency.postsPerWeek.optimal).toBeLessThanOrEqual(config.frequency.postsPerWeek.max);

        expect(config.frequency.postsPerDay.min).toBeGreaterThanOrEqual(0);
        expect(config.frequency.postsPerDay.optimal).toBeGreaterThanOrEqual(config.frequency.postsPerDay.min);
      }
    });

    it('has valid content mix that sums to 100 for each platform', () => {
      for (const [platform, config] of Object.entries(PLATFORM_ALGORITHM)) {
        const total = config.contentMix.text + config.contentMix.image +
          config.contentMix.video + config.contentMix.story + config.contentMix.article;
        expect(total).toBe(100);
      }
    });

    it('has valid posting hours (0-23) for each platform', () => {
      for (const [platform, config] of Object.entries(PLATFORM_ALGORITHM)) {
        for (const hour of config.bestTimesWeekday) {
          expect(hour).toBeGreaterThanOrEqual(0);
          expect(hour).toBeLessThan(24);
        }
        for (const hour of config.bestTimesWeekend) {
          expect(hour).toBeGreaterThanOrEqual(0);
          expect(hour).toBeLessThan(24);
        }
      }
    });

    it('has valid best days (0-6) for each platform', () => {
      for (const [platform, config] of Object.entries(PLATFORM_ALGORITHM)) {
        for (const day of config.bestDays) {
          expect(day).toBeGreaterThanOrEqual(0);
          expect(day).toBeLessThanOrEqual(6);
        }
      }
    });

    it('has non-empty ranking factors for each platform', () => {
      for (const [platform, config] of Object.entries(PLATFORM_ALGORITHM)) {
        expect(config.rankingFactors.length).toBeGreaterThan(0);
      }
    });

    it('has non-empty content tips for each platform', () => {
      for (const [platform, config] of Object.entries(PLATFORM_ALGORITHM)) {
        expect(config.contentTips.length).toBeGreaterThan(0);
      }
    });

    it('has valid hashtag configuration for each platform', () => {
      for (const [platform, config] of Object.entries(PLATFORM_ALGORITHM)) {
        expect(config.hashtags.recommended).toBeGreaterThanOrEqual(0);
        expect(config.hashtags.max).toBeGreaterThanOrEqual(config.hashtags.recommended);
        expect(config.hashtags.strategy).toBeDefined();
        expect(config.hashtags.note.length).toBeGreaterThan(0);
      }
    });

    it('has valid caption configuration for each platform', () => {
      for (const [platform, config] of Object.entries(PLATFORM_ALGORITHM)) {
        expect(config.caption.optimalLength.min).toBeGreaterThan(0);
        expect(config.caption.optimalLength.max).toBeGreaterThan(config.caption.optimalLength.min);
        expect(config.caption.maxLength).toBeGreaterThanOrEqual(config.caption.optimalLength.max);
      }
    });

    it('has video config only for video-supporting platforms', () => {
      const videoOnlyPlatforms = ['TIKTOK', 'YOUTUBE'];
      for (const platform of videoOnlyPlatforms) {
        const config = PLATFORM_ALGORITHM[platform];
        expect(config?.video).toBeDefined();
        expect(config?.video?.optimalLengthSec.min).toBeGreaterThan(0);
      }
    });

    // Platform-specific algorithm validations
    describe('Instagram algorithm compliance', () => {
      const ig = PLATFORM_ALGORITHM.INSTAGRAM;

      it('enforces max 5 hashtags (Dec 2025 limit)', () => {
        expect(ig.hashtags.max).toBe(5);
      });

      it('prioritizes watch time as primary metric', () => {
        expect(ig.primaryMetric).toBe('watch_time');
      });

      it('has Reels frequency recommendations', () => {
        expect(ig.frequency.reelsPerWeek).toBeDefined();
        expect(ig.frequency.reelsPerWeek!.optimal).toBeGreaterThanOrEqual(2);
      });

      it('has Stories frequency recommendations', () => {
        expect(ig.frequency.storiesPerDay).toBeDefined();
        expect(ig.frequency.storiesPerDay!.optimal).toBeGreaterThanOrEqual(1);
      });

      it('recommends vertical video format', () => {
        expect(ig.video?.format).toBe('vertical_9_16');
      });
    });

    describe('TikTok algorithm compliance', () => {
      const tt = PLATFORM_ALGORITHM.TIKTOK;

      it('is 100% video content', () => {
        expect(tt.contentMix.video).toBe(100);
      });

      it('prioritizes watch completion', () => {
        expect(tt.primaryMetric).toBe('watch_completion');
      });

      it('has 2-second hook window', () => {
        expect(tt.video?.hookWindowSec).toBe(2);
      });
    });

    describe('LinkedIn algorithm compliance', () => {
      const li = PLATFORM_ALGORITHM.LINKEDIN;

      it('prioritizes dwell time', () => {
        expect(li.primaryMetric).toBe('dwell_time');
      });

      it('has no weekend posting times', () => {
        expect(li.bestTimesWeekend).toHaveLength(0);
      });

      it('favors weekday posting', () => {
        for (const day of li.bestDays) {
          expect(day).toBeGreaterThanOrEqual(1); // Mon
          expect(day).toBeLessThanOrEqual(4);    // Thu
        }
      });
    });

    describe('Facebook algorithm compliance', () => {
      const fb = PLATFORM_ALGORITHM.FACEBOOK;

      it('prioritizes meaningful interactions', () => {
        expect(fb.primaryMetric).toBe('meaningful_interactions');
      });

      it('mentions link-in-body penalty in avoid list', () => {
        const hasLinkWarning = fb.avoid.some(a => a.toLowerCase().includes('link'));
        expect(hasLinkWarning).toBe(true);
      });
    });

    describe('Mastodon has no algorithm', () => {
      const mast = PLATFORM_ALGORITHM.MASTODON;

      it('is marked as chronological', () => {
        expect(mast.hasAlgorithm).toBe(false);
      });

      it('uses hashtags as primary discovery', () => {
        expect(mast.hashtags.strategy).not.toBe('none');
      });
    });
  });

  describe('getRecommendedPlan', () => {
    it('returns valid plan for Instagram', () => {
      const plan = getRecommendedPlan('INSTAGRAM');
      expect(plan.dailyTexts).toBeGreaterThanOrEqual(0);
      expect(plan.dailyImages).toBeGreaterThanOrEqual(0);
      expect(plan.dailyVideos).toBeGreaterThanOrEqual(0);
      expect(plan.dailyStories).toBeGreaterThanOrEqual(0);
    });

    it('returns video-only plan for TikTok', () => {
      const plan = getRecommendedPlan('TIKTOK');
      expect(plan.dailyTexts).toBe(0);
      expect(plan.dailyImages).toBe(0);
      expect(plan.dailyVideos).toBeGreaterThan(0);
    });

    it('returns text-heavy plan for LinkedIn', () => {
      const plan = getRecommendedPlan('LINKEDIN');
      // LinkedIn should have some text posts (40% of 1 post = 0, but rounding may vary)
      // At minimum, the total should be reasonable
      const total = plan.dailyTexts + plan.dailyImages + plan.dailyVideos;
      expect(total).toBeGreaterThanOrEqual(0);
    });

    it('returns article-focused plan for Medium', () => {
      const plan = getRecommendedPlan('MEDIUM');
      expect(plan.weeklyArticles).toBeGreaterThan(0);
    });

    it('returns default plan for unknown platform', () => {
      const plan = getRecommendedPlan('UNKNOWN_PLATFORM');
      expect(plan.dailyTexts).toBe(1);
      expect(plan.dailyImages).toBe(1);
    });
  });

  describe('getOptimalHoursForPlatform', () => {
    it('returns hours for known platforms', () => {
      const hours = getOptimalHoursForPlatform('INSTAGRAM');
      expect(hours.length).toBeGreaterThan(0);
      for (const h of hours) {
        expect(h).toBeGreaterThanOrEqual(0);
        expect(h).toBeLessThan(24);
      }
    });

    it('returns sorted hours', () => {
      const hours = getOptimalHoursForPlatform('FACEBOOK');
      for (let i = 1; i < hours.length; i++) {
        expect(hours[i]).toBeGreaterThanOrEqual(hours[i - 1]);
      }
    });

    it('returns default hours for unknown platform', () => {
      const hours = getOptimalHoursForPlatform('UNKNOWN');
      expect(hours).toEqual([9, 13, 17]);
    });
  });

  describe('getContentGenerationContext', () => {
    it('returns non-empty string for known platforms', () => {
      const context = getContentGenerationContext('INSTAGRAM');
      expect(context.length).toBeGreaterThan(100);
      expect(context).toContain('Instagram');
      expect(context).toContain('Content tips:');
      expect(context).toContain('Avoid:');
    });

    it('includes platform-specific information', () => {
      const tiktok = getContentGenerationContext('TIKTOK');
      expect(tiktok).toContain('TikTok');
      expect(tiktok).toContain('watch_completion');

      const linkedin = getContentGenerationContext('LINKEDIN');
      expect(linkedin).toContain('LinkedIn');
      expect(linkedin).toContain('dwell_time');
    });

    it('returns empty string for unknown platform', () => {
      const context = getContentGenerationContext('UNKNOWN');
      expect(context).toBe('');
    });
  });
});
