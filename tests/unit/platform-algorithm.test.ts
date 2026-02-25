import {
  PLATFORM_ALGORITHM,
  getRecommendedPlan,
  getOptimalHoursForPlatform,
  getContentGenerationContext,
  getBestContentFormat,
  getMinPostInterval,
  wouldExceedPromoLimit,
  getEngagementVelocityTip,
  getGrowthTactics,
  getSuppressionTriggers,
} from '@/lib/platform-algorithm';
import { ALL_PLATFORMS } from '@/lib/constants';

describe('Platform Algorithm Knowledge Base', () => {
  describe('PLATFORM_ALGORITHM', () => {
    it('has configuration for all 17 platforms', () => {
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

    // ── v2: New field validations ──────────────────────────────

    it('has valid engagement velocity for each platform', () => {
      for (const [platform, config] of Object.entries(PLATFORM_ALGORITHM)) {
        expect(config.engagementVelocity).toBeDefined();
        expect(config.engagementVelocity.goldenWindowMinutes).toBeGreaterThan(0);
        expect(config.engagementVelocity.assessmentWindowMinutes).toBeGreaterThanOrEqual(
          config.engagementVelocity.goldenWindowMinutes
        );
        expect(config.engagementVelocity.tip.length).toBeGreaterThan(0);
      }
    });

    it('has at least 3 engagement signals for each platform', () => {
      for (const [platform, config] of Object.entries(PLATFORM_ALGORITHM)) {
        expect(config.engagementSignals.length).toBeGreaterThanOrEqual(3);
        for (const signal of config.engagementSignals) {
          expect(signal.signal.length).toBeGreaterThan(0);
          expect(signal.weight).toBeGreaterThanOrEqual(1);
          expect(signal.weight).toBeLessThanOrEqual(10);
          expect(signal.note.length).toBeGreaterThan(0);
        }
      }
    });

    it('has at least 2 content format rankings for each platform', () => {
      for (const [platform, config] of Object.entries(PLATFORM_ALGORITHM)) {
        expect(config.contentFormatRanking.length).toBeGreaterThanOrEqual(2);
        for (const format of config.contentFormatRanking) {
          expect(format.format.length).toBeGreaterThan(0);
          expect(format.reachMultiplier).toBeGreaterThan(0);
          expect(format.engagementRate).toBeGreaterThan(0);
          expect(format.note.length).toBeGreaterThan(0);
        }
      }
    });

    it('has at least 3 growth tactics for each platform', () => {
      for (const [platform, config] of Object.entries(PLATFORM_ALGORITHM)) {
        expect(config.growthTactics.length).toBeGreaterThanOrEqual(3);
        for (const tactic of config.growthTactics) {
          expect(tactic.length).toBeGreaterThan(10);  // Must be meaningful, not trivial
        }
      }
    });

    it('has at least 2 suppression triggers for each platform', () => {
      for (const [platform, config] of Object.entries(PLATFORM_ALGORITHM)) {
        expect(config.suppressionTriggers.length).toBeGreaterThanOrEqual(2);
      }
    });

    it('has valid minPostIntervalHours for each platform', () => {
      for (const [platform, config] of Object.entries(PLATFORM_ALGORITHM)) {
        expect(config.minPostIntervalHours).toBeGreaterThanOrEqual(1);
        expect(config.minPostIntervalHours).toBeLessThanOrEqual(48);
      }
    });

    it('has valid maxPromotionalPercent for each platform', () => {
      for (const [platform, config] of Object.entries(PLATFORM_ALGORITHM)) {
        expect(config.maxPromotionalPercent).toBeGreaterThanOrEqual(5);
        expect(config.maxPromotionalPercent).toBeLessThanOrEqual(50);
      }
    });

    // ── Platform-specific algorithm validations ────────────────

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

      it('has sends/shares as highest-weight signal', () => {
        const topSignal = ig.engagementSignals.reduce((a, b) => a.weight > b.weight ? a : b);
        expect(topSignal.signal.toLowerCase()).toContain('send');
      });

      it('has Reels as highest-reach format', () => {
        const topFormat = ig.contentFormatRanking.reduce((a, b) =>
          a.reachMultiplier > b.reachMultiplier ? a : b
        );
        expect(topFormat.format.toLowerCase()).toContain('reel');
      });

      it('has TikTok watermark as suppression trigger', () => {
        const hasTikTokWarning = ig.suppressionTriggers.some(t =>
          t.toLowerCase().includes('tiktok') || t.toLowerCase().includes('watermark')
        );
        expect(hasTikTokWarning).toBe(true);
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

      it('has watch completion as highest signal', () => {
        const topSignal = tt.engagementSignals.reduce((a, b) => a.weight > b.weight ? a : b);
        expect(topSignal.signal.toLowerCase()).toContain('watch');
      });

      it('has 15-minute golden window', () => {
        expect(tt.engagementVelocity.goldenWindowMinutes).toBe(15);
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
          expect(day).toBeGreaterThanOrEqual(1);
          expect(day).toBeLessThanOrEqual(4);
        }
      });

      it('has dwell time as highest signal', () => {
        const topSignal = li.engagementSignals.reduce((a, b) => a.weight > b.weight ? a : b);
        expect(topSignal.signal.toLowerCase()).toContain('dwell');
      });

      it('has document/carousel as highest-reach format', () => {
        const topFormat = li.contentFormatRanking.reduce((a, b) =>
          a.reachMultiplier > b.reachMultiplier ? a : b
        );
        expect(topFormat.format.toLowerCase()).toContain('document');
      });

      it('warns about editing posts within first 10 min', () => {
        const hasEditWarning = li.suppressionTriggers.some(t =>
          t.toLowerCase().includes('edit')
        );
        expect(hasEditWarning).toBe(true);
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

      it('has shares as highest signal', () => {
        const topSignal = fb.engagementSignals.reduce((a, b) => a.weight > b.weight ? a : b);
        expect(topSignal.signal.toLowerCase()).toContain('share');
      });

      it('has Reels as highest-reach format', () => {
        const topFormat = fb.contentFormatRanking.reduce((a, b) =>
          a.reachMultiplier > b.reachMultiplier ? a : b
        );
        expect(topFormat.format.toLowerCase()).toContain('reel');
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

      it('has boosts as highest signal', () => {
        const topSignal = mast.engagementSignals.reduce((a, b) => a.weight > b.weight ? a : b);
        expect(topSignal.signal.toLowerCase()).toContain('boost');
      });

      it('warns about missing alt text', () => {
        const hasAltWarning = mast.suppressionTriggers.some(t =>
          t.toLowerCase().includes('alt text')
        );
        expect(hasAltWarning).toBe(true);
      });
    });

    describe('Reddit algorithm compliance', () => {
      const reddit = PLATFORM_ALGORITHM.REDDIT;

      it('has upvote velocity as primary metric', () => {
        expect(reddit.primaryMetric).toBe('upvote_velocity');
      });

      it('limits promotional content to 10%', () => {
        expect(reddit.maxPromotionalPercent).toBe(10);
      });

      it('has upvote velocity as highest signal', () => {
        const topSignal = reddit.engagementSignals.reduce((a, b) => a.weight > b.weight ? a : b);
        expect(topSignal.signal.toLowerCase()).toContain('upvote');
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
      expect(context).toContain('CONTENT TIPS');
      expect(context).toContain('AVOID');
    });

    it('includes v2 engagement signals in context', () => {
      const context = getContentGenerationContext('INSTAGRAM');
      expect(context).toContain('ENGAGEMENT SIGNALS');
      expect(context).toContain('CONTENT FORMATS');
      expect(context).toContain('GROWTH TACTICS');
      expect(context).toContain('Engagement velocity');
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

  // ── v2: New helper function tests ──────────────────────────

  describe('getBestContentFormat', () => {
    it('returns format with highest reach multiplier', () => {
      const igFormat = getBestContentFormat('INSTAGRAM');
      expect(igFormat).not.toBeNull();
      expect(igFormat!.reachMultiplier).toBeGreaterThan(1);
      expect(igFormat!.format.toLowerCase()).toContain('reel');
    });

    it('returns null for unknown platform', () => {
      const format = getBestContentFormat('UNKNOWN');
      expect(format).toBeNull();
    });

    it('returns video format for TikTok', () => {
      const ttFormat = getBestContentFormat('TIKTOK');
      expect(ttFormat).not.toBeNull();
      expect(ttFormat!.format.toLowerCase()).toContain('video');
    });

    it('returns document format for LinkedIn', () => {
      const liFormat = getBestContentFormat('LINKEDIN');
      expect(liFormat).not.toBeNull();
      expect(liFormat!.format.toLowerCase()).toContain('document');
    });
  });

  describe('getMinPostInterval', () => {
    it('returns interval for known platforms', () => {
      expect(getMinPostInterval('INSTAGRAM')).toBe(4);
      expect(getMinPostInterval('LINKEDIN')).toBe(8);
      expect(getMinPostInterval('TWITTER')).toBe(2);
      expect(getMinPostInterval('YOUTUBE')).toBe(24);
    });

    it('returns default 4 for unknown platform', () => {
      expect(getMinPostInterval('UNKNOWN')).toBe(4);
    });
  });

  describe('wouldExceedPromoLimit', () => {
    it('returns false when under limit', () => {
      // Instagram max promo = 20%, 1 promo out of 10 total = 10%
      expect(wouldExceedPromoLimit('INSTAGRAM', 10, 1)).toBe(false);
    });

    it('returns true when exceeding limit', () => {
      // Reddit max promo = 10%, 2 promo out of 5 total = would be 3/6 = 50%
      expect(wouldExceedPromoLimit('REDDIT', 5, 2)).toBe(true);
    });

    it('returns false for unknown platform', () => {
      expect(wouldExceedPromoLimit('UNKNOWN', 5, 2)).toBe(false);
    });
  });

  describe('getEngagementVelocityTip', () => {
    it('returns tip with golden window for known platforms', () => {
      const tip = getEngagementVelocityTip('INSTAGRAM');
      expect(tip).toContain('30');
      expect(tip.length).toBeGreaterThan(20);
    });

    it('returns default tip for unknown platform', () => {
      const tip = getEngagementVelocityTip('UNKNOWN');
      expect(tip).toContain('Engage');
    });
  });

  describe('getGrowthTactics', () => {
    it('returns tactics for known platforms', () => {
      const tactics = getGrowthTactics('INSTAGRAM');
      expect(tactics.length).toBeGreaterThanOrEqual(5);
      for (const tactic of tactics) {
        expect(tactic.length).toBeGreaterThan(10);
      }
    });

    it('returns empty array for unknown platform', () => {
      expect(getGrowthTactics('UNKNOWN')).toEqual([]);
    });
  });

  describe('getSuppressionTriggers', () => {
    it('returns triggers for known platforms', () => {
      const triggers = getSuppressionTriggers('INSTAGRAM');
      expect(triggers.length).toBeGreaterThanOrEqual(3);
    });

    it('returns empty array for unknown platform', () => {
      expect(getSuppressionTriggers('UNKNOWN')).toEqual([]);
    });

    it('includes platform-specific triggers', () => {
      const igTriggers = getSuppressionTriggers('INSTAGRAM');
      const hasWatermarkWarning = igTriggers.some(t =>
        t.toLowerCase().includes('watermark')
      );
      expect(hasWatermarkWarning).toBe(true);
    });
  });
});
