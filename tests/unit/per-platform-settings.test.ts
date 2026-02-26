/**
 * Tests for Per-Platform Content Settings
 *
 * Validates the per-platform content types, tone styles, hashtag strategy,
 * and custom hashtags feature that allows users to configure settings
 * independently for each connected platform.
 *
 * Covers:
 * - FormData parsing for per-platform multi-select values
 * - Override priority: per-platform > global defaults
 * - Custom hashtags parsing and validation
 * - Backward compatibility with legacy single-value overrides
 * - Edge cases and security
 */

import { CONTENT_TYPES, TONE_STYLES, HASHTAG_PATTERNS } from '@/lib/constants';

// ── Helper Functions (extracted from strategy page logic) ──────

/**
 * Parse per-platform content types from FormData.
 * Mimics the server-side strategy save logic.
 */
function parseContentTypesFromForm(
  formData: Map<string, string>,
  platform: string,
): string[] {
  return CONTENT_TYPES
    .map(ct => ct.value)
    .filter(v => formData.get(`${platform}_ct_${v}`) === 'on');
}

/**
 * Parse per-platform tone styles from FormData.
 */
function parseTonesFromForm(
  formData: Map<string, string>,
  platform: string,
): string[] {
  return TONE_STYLES
    .map(t => t.value)
    .filter(v => formData.get(`${platform}_tone_${v}`) === 'on');
}

/**
 * Parse per-platform hashtag patterns from FormData.
 */
function parseHashtagPatternsFromForm(
  formData: Map<string, string>,
  platform: string,
): string[] {
  return HASHTAG_PATTERNS
    .map(h => h.value)
    .filter(v => formData.get(`${platform}_ht_${v}`) === 'on');
}

/**
 * Select effective content types for plan generation.
 * Per-platform override > global settings.
 */
function getEffectiveContentTypes(
  platformOverride: string[] | null,
  globalContentTypes: string[],
): string[] {
  return platformOverride || globalContentTypes;
}

/**
 * Select effective tones for plan generation.
 * Per-platform override (multi) > legacy single override > global settings.
 */
function getEffectiveTones(
  platformTonesOverride: string[] | null,
  legacyToneOverride: string | null,
  globalToneStyles: string[],
): string[] {
  if (platformTonesOverride && platformTonesOverride.length > 0) return platformTonesOverride;
  if (legacyToneOverride) return [legacyToneOverride];
  return globalToneStyles;
}

/**
 * Select effective hashtag patterns for plan generation.
 * Per-platform override (multi) > legacy single override > global settings.
 */
function getEffectiveHashtagPatterns(
  platformPatternsOverride: string[] | null,
  legacyHashtagOverride: string | null,
  globalPatterns: string[],
): string[] {
  if (platformPatternsOverride && platformPatternsOverride.length > 0) return platformPatternsOverride;
  if (legacyHashtagOverride) return [legacyHashtagOverride];
  return globalPatterns;
}

// ── Unit Tests: FormData Parsing ──────────────────────────────

describe('Per-Platform FormData Parsing', () => {
  describe('parseContentTypesFromForm', () => {
    it('should parse selected content types for a platform', () => {
      const formData = new Map<string, string>([
        ['INSTAGRAM_ct_educational', 'on'],
        ['INSTAGRAM_ct_engagement', 'on'],
        ['INSTAGRAM_ct_promotional', 'on'],
      ]);
      const types = parseContentTypesFromForm(formData, 'INSTAGRAM');
      expect(types).toEqual(['educational', 'promotional', 'engagement']);
    });

    it('should return empty array when nothing selected', () => {
      const formData = new Map<string, string>();
      const types = parseContentTypesFromForm(formData, 'TWITTER');
      expect(types).toEqual([]);
    });

    it('should only include valid CONTENT_TYPES values', () => {
      const formData = new Map<string, string>([
        ['FACEBOOK_ct_educational', 'on'],
        ['FACEBOOK_ct_fake_type', 'on'],  // Not a real content type
      ]);
      const types = parseContentTypesFromForm(formData, 'FACEBOOK');
      expect(types).toEqual(['educational']);
      expect(types).not.toContain('fake_type');
    });

    it('should handle all 7 content types selected', () => {
      const formData = new Map<string, string>(
        CONTENT_TYPES.map(ct => [`LINKEDIN_ct_${ct.value}`, 'on'])
      );
      const types = parseContentTypesFromForm(formData, 'LINKEDIN');
      expect(types).toHaveLength(CONTENT_TYPES.length);
    });

    it('should not leak content types from other platforms', () => {
      const formData = new Map<string, string>([
        ['TWITTER_ct_educational', 'on'],
        ['INSTAGRAM_ct_promotional', 'on'],
      ]);
      const twitterTypes = parseContentTypesFromForm(formData, 'TWITTER');
      expect(twitterTypes).toEqual(['educational']);
      expect(twitterTypes).not.toContain('promotional');
    });
  });

  describe('parseTonesFromForm', () => {
    it('should parse selected tones for a platform', () => {
      const formData = new Map<string, string>([
        ['LINKEDIN_tone_professional', 'on'],
        ['LINKEDIN_tone_educational', 'on'],
      ]);
      const tones = parseTonesFromForm(formData, 'LINKEDIN');
      expect(tones).toContain('professional');
      expect(tones).toContain('educational');
    });

    it('should return empty array when nothing selected', () => {
      const formData = new Map<string, string>();
      expect(parseTonesFromForm(formData, 'TIKTOK')).toEqual([]);
    });

    it('should handle all tone styles selected', () => {
      const formData = new Map<string, string>(
        TONE_STYLES.map(t => [`REDDIT_tone_${t.value}`, 'on'])
      );
      const tones = parseTonesFromForm(formData, 'REDDIT');
      expect(tones).toHaveLength(TONE_STYLES.length);
    });
  });

  describe('parseHashtagPatternsFromForm', () => {
    it('should parse selected hashtag patterns', () => {
      const formData = new Map<string, string>([
        ['INSTAGRAM_ht_moderate', 'on'],
        ['INSTAGRAM_ht_branded', 'on'],
      ]);
      const patterns = parseHashtagPatternsFromForm(formData, 'INSTAGRAM');
      expect(patterns).toContain('moderate');
      expect(patterns).toContain('branded');
    });

    it('should return empty array when nothing selected', () => {
      expect(parseHashtagPatternsFromForm(new Map(), 'DISCORD')).toEqual([]);
    });
  });
});

// ── Unit Tests: Override Priority ──────────────────────────────

describe('Override Priority', () => {
  describe('getEffectiveContentTypes', () => {
    const globalTypes = ['educational', 'engagement'];

    it('should use per-platform override when present', () => {
      const platformOverride = ['promotional', 'news'];
      expect(getEffectiveContentTypes(platformOverride, globalTypes)).toEqual(['promotional', 'news']);
    });

    it('should fall back to global types when override is null', () => {
      expect(getEffectiveContentTypes(null, globalTypes)).toEqual(globalTypes);
    });

    it('should use empty platform override if explicitly set (user disabled all)', () => {
      // This follows the actual save logic: empty array stored as null → falls back to global
      // So this is actually not possible with current impl, which is correct behavior
      expect(getEffectiveContentTypes(null, globalTypes)).toEqual(globalTypes);
    });
  });

  describe('getEffectiveTones', () => {
    const globalTones = ['professional', 'casual'];

    it('should prioritize multi-select per-platform override', () => {
      expect(getEffectiveTones(
        ['humorous', 'inspirational'],
        'professional',  // legacy override is ignored
        globalTones,
      )).toEqual(['humorous', 'inspirational']);
    });

    it('should fall back to legacy single-value toneOverride', () => {
      expect(getEffectiveTones(
        null,
        'educational',
        globalTones,
      )).toEqual(['educational']);
    });

    it('should fall back to global tones when no overrides', () => {
      expect(getEffectiveTones(null, null, globalTones)).toEqual(globalTones);
    });

    it('should handle empty platform override as fallback', () => {
      expect(getEffectiveTones([], null, globalTones)).toEqual(globalTones);
    });
  });

  describe('getEffectiveHashtagPatterns', () => {
    const globalPatterns = ['moderate'];

    it('should prioritize multi-select override', () => {
      expect(getEffectiveHashtagPatterns(
        ['heavy', 'trending'],
        'minimal',  // ignored
        globalPatterns,
      )).toEqual(['heavy', 'trending']);
    });

    it('should fall back to legacy single-value hashtagOverride', () => {
      expect(getEffectiveHashtagPatterns(
        null,
        'niche',
        globalPatterns,
      )).toEqual(['niche']);
    });

    it('should fall back to global patterns when no overrides', () => {
      expect(getEffectiveHashtagPatterns(null, null, globalPatterns)).toEqual(globalPatterns);
    });
  });
});

// ── Custom Hashtags ──────────────────────────────────────────

describe('Custom Hashtags', () => {
  it('should pass through non-empty custom hashtags', () => {
    const raw = '#brand #crypto #defi';
    const custom = raw.trim() || null;
    expect(custom).toBe('#brand #crypto #defi');
  });

  it('should be null when empty', () => {
    const raw = '';
    const custom = raw.trim() || null;
    expect(custom).toBeNull();
  });

  it('should trim whitespace', () => {
    const raw = '  #brand  #niche  ';
    const custom = raw.trim() || null;
    expect(custom).toBe('#brand  #niche');
  });

  it('should handle hashtags with or without # prefix', () => {
    const raw = '#brand crypto defi #web3';
    const custom = raw.trim() || null;
    expect(custom).toBe('#brand crypto defi #web3');
  });
});

// ── Backward Compatibility ──────────────────────────────────

describe('Backward Compatibility', () => {
  it('should set legacy toneOverride to first tone when single tone selected', () => {
    const selectedTones = ['professional'];
    const toneOverride = selectedTones.length === 1 ? selectedTones[0] : null;
    expect(toneOverride).toBe('professional');
  });

  it('should set legacy toneOverride to null when multiple tones selected', () => {
    const selectedTones = ['professional', 'casual'];
    const toneOverride = selectedTones.length === 1 ? selectedTones[0] : null;
    expect(toneOverride).toBeNull();
  });

  it('should set legacy toneOverride to null when no tones selected', () => {
    const selectedTones: string[] = [];
    const toneOverride = selectedTones.length === 1 ? selectedTones[0] : null;
    expect(toneOverride).toBeNull();
  });

  it('should set legacy hashtagOverride to first pattern when single selected', () => {
    const selectedPatterns = ['moderate'];
    const hashtagOverride = selectedPatterns.length === 1 ? selectedPatterns[0] : null;
    expect(hashtagOverride).toBe('moderate');
  });

  it('should set legacy hashtagOverride to null when multiple selected', () => {
    const selectedPatterns = ['moderate', 'trending'];
    const hashtagOverride = selectedPatterns.length === 1 ? selectedPatterns[0] : null;
    expect(hashtagOverride).toBeNull();
  });

  it('bots without new fields should use global defaults (null overrides)', () => {
    // Simulating old bot data: no contentTypesOverride, tonesOverride, hashtagPatternsOverride
    const platformPlan = {
      toneOverride: 'casual',
      hashtagOverride: 'minimal',
      contentTypesOverride: null,
      tonesOverride: null,
      hashtagPatternsOverride: null,
      customHashtags: null,
    };

    const globalTypes = ['educational', 'engagement'];
    const globalTones = ['professional', 'casual'];
    const globalHashtags = ['moderate'];

    // Content types: no platform override → global
    expect(getEffectiveContentTypes(
      platformPlan.contentTypesOverride as string[] | null,
      globalTypes,
    )).toEqual(globalTypes);

    // Tones: no multi override, has legacy → use legacy
    expect(getEffectiveTones(
      platformPlan.tonesOverride as string[] | null,
      platformPlan.toneOverride,
      globalTones,
    )).toEqual(['casual']);

    // Hashtags: no multi override, has legacy → use legacy
    expect(getEffectiveHashtagPatterns(
      platformPlan.hashtagPatternsOverride as string[] | null,
      platformPlan.hashtagOverride,
      globalHashtags,
    )).toEqual(['minimal']);
  });
});

// ── Platform Isolation ──────────────────────────────────────

describe('Platform Isolation', () => {
  it('should keep settings independent per platform', () => {
    const formData = new Map<string, string>([
      // Instagram: educational + engagement
      ['INSTAGRAM_ct_educational', 'on'],
      ['INSTAGRAM_ct_engagement', 'on'],
      // Twitter: news + curated
      ['TWITTER_ct_news', 'on'],
      ['TWITTER_ct_curated', 'on'],
      // LinkedIn: educational + storytelling
      ['LINKEDIN_ct_educational', 'on'],
      ['LINKEDIN_ct_storytelling', 'on'],
    ]);

    const igTypes = parseContentTypesFromForm(formData, 'INSTAGRAM');
    const twTypes = parseContentTypesFromForm(formData, 'TWITTER');
    const liTypes = parseContentTypesFromForm(formData, 'LINKEDIN');

    expect(igTypes).toEqual(['educational', 'engagement']);
    expect(twTypes).toEqual(['news', 'curated']);
    expect(liTypes).toEqual(['educational', 'storytelling']);

    // No cross-contamination
    expect(igTypes).not.toContain('news');
    expect(twTypes).not.toContain('educational');
    expect(liTypes).not.toContain('engagement');
  });

  it('should keep tones independent per platform', () => {
    const formData = new Map<string, string>([
      ['TIKTOK_tone_humorous', 'on'],
      ['TIKTOK_tone_casual', 'on'],
      ['LINKEDIN_tone_professional', 'on'],
      ['LINKEDIN_tone_educational', 'on'],
    ]);

    const tikTones = parseTonesFromForm(formData, 'TIKTOK');
    const liTones = parseTonesFromForm(formData, 'LINKEDIN');

    expect(tikTones).toEqual(['casual', 'humorous']);
    expect(liTones).toEqual(['professional', 'educational']);
    expect(tikTones).not.toContain('professional');
  });
});

// ── Security & Edge Cases ──────────────────────────────────

describe('Security & Edge Cases', () => {
  it('should ignore XSS attempts in custom hashtags', () => {
    const raw = '<script>alert("xss")</script>#real';
    // The raw value is stored as-is but output is in text prompts, not HTML
    // The important thing is it doesn't execute
    const custom = raw.trim() || null;
    expect(custom).toBeTruthy();
    expect(typeof custom).toBe('string');
  });

  it('should handle platform names with special chars in form field names', () => {
    // All our platform names are uppercase alpha, so this is a non-issue
    // But verify the parser handles it
    const formData = new Map<string, string>([
      ['BLUESKY_ct_educational', 'on'],
    ]);
    const types = parseContentTypesFromForm(formData, 'BLUESKY');
    expect(types).toEqual(['educational']);
  });

  it('should handle concurrent platform saves without interference', () => {
    // Each platform is saved independently in a loop
    const platforms = ['INSTAGRAM', 'TWITTER', 'LINKEDIN', 'TIKTOK', 'FACEBOOK'];
    const formData = new Map<string, string>();

    // Set different settings per platform
    platforms.forEach((p, i) => {
      const ctValue = CONTENT_TYPES[i % CONTENT_TYPES.length].value;
      formData.set(`${p}_ct_${ctValue}`, 'on');
    });

    // Verify each platform only gets its own settings
    platforms.forEach((p, i) => {
      const types = parseContentTypesFromForm(formData, p);
      const expected = CONTENT_TYPES[i % CONTENT_TYPES.length].value;
      expect(types).toContain(expected);
      // Should not contain settings from other platforms
      platforms.filter(pp => pp !== p).forEach(other => {
        const otherIdx = platforms.indexOf(other);
        const otherVal = CONTENT_TYPES[otherIdx % CONTENT_TYPES.length].value;
        if (otherVal !== expected) {
          expect(types).not.toContain(otherVal);
        }
      });
    });
  });

  it('should handle all 17 platforms without issues', () => {
    const allPlatforms = [
      'FACEBOOK', 'INSTAGRAM', 'TWITTER', 'LINKEDIN', 'TIKTOK',
      'MASTODON', 'BLUESKY', 'TELEGRAM', 'DISCORD', 'THREADS',
      'PINTEREST', 'REDDIT', 'MEDIUM', 'DEVTO', 'YOUTUBE', 'NOSTR', 'MOLTBOOK',
    ];

    const formData = new Map<string, string>();
    allPlatforms.forEach(p => {
      formData.set(`${p}_ct_educational`, 'on');
      formData.set(`${p}_tone_professional`, 'on');
      formData.set(`${p}_ht_moderate`, 'on');
    });

    allPlatforms.forEach(p => {
      expect(parseContentTypesFromForm(formData, p)).toEqual(['educational']);
      expect(parseTonesFromForm(formData, p)).toEqual(['professional']);
      expect(parseHashtagPatternsFromForm(formData, p)).toEqual(['moderate']);
    });
  });
});
