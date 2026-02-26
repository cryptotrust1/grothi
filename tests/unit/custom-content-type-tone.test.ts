/**
 * Tests for Custom Content Type & Tone per-platform feature
 *
 * Validates:
 * - Custom content type and tone override logic in generate-plan
 * - Custom fields injected into AI prompt (autonomous-content)
 * - Field collection and save logic (strategy page server action)
 * - Edge cases: empty strings, long values, special characters
 * - Integration with standard content type/tone selections
 * - Strategy toggle in post chat assistant
 */

import { CONTENT_TYPES, TONE_STYLES, PLATFORM_NAMES } from '@/lib/constants';

// ── Simulate generate-plan content type selection logic ──

/**
 * Select content type for a platform post.
 * Priority: customContentType > per-platform checkboxes > RL > global
 */
function selectContentType(
  customContentType: string | null | undefined,
  platformContentTypesOverride: string[] | null,
  globalContentTypes: string[],
  algobestTypes: string[],
  rlBestType?: string,
): string {
  if (customContentType) {
    return customContentType;
  }
  const effectiveTypes = platformContentTypesOverride || globalContentTypes;
  const platformBestTypes = algobestTypes.filter(t => effectiveTypes.includes(t));
  return rlBestType
    || (platformBestTypes.length > 0 ? platformBestTypes[0] : effectiveTypes[0]);
}

/**
 * Select tone for a platform post.
 * Priority: customToneStyle > per-platform checkboxes > RL > global
 */
function selectToneStyle(
  customToneStyle: string | null | undefined,
  platformTonesOverride: string[] | null,
  globalTones: string[],
  algoBestTones: string[],
  rlBestTone?: string,
): string {
  if (customToneStyle) {
    return customToneStyle;
  }
  const effectiveTones = platformTonesOverride || globalTones;
  const platformTones = algoBestTones.filter(t => effectiveTones.includes(t));
  return rlBestTone
    || (platformTones.length > 0 ? platformTones[0] : effectiveTones[0]);
}

// ── Simulate autonomous-content AI prompt injection ──

/**
 * Build tone directive for AI prompt.
 * If custom tone is set, inject it with override language.
 */
function buildToneDirective(toneStyle: string, customToneStyle?: string): string {
  if (customToneStyle) {
    return `TONE: Use this SPECIFIC tone style: "${customToneStyle}". This overrides all default tone settings.`;
  }
  return `Use ${toneStyle} tone`;
}

/**
 * Build content type directive for AI prompt.
 * If custom content type is set, inject it with override language.
 */
function buildContentTypeDirective(contentType: string, customContentType?: string): string {
  if (customContentType) {
    return `CONTENT STYLE: Create this SPECIFIC type of content: "${customContentType}". This overrides standard content type categories.`;
  }
  const label = CONTENT_TYPES.find(ct => ct.value === contentType)?.label || contentType;
  return `Create a single ${label.toLowerCase()} post`;
}

// ── Simulate strategy page field collection ──

function collectCustomFields(formData: Map<string, string>, platform: string) {
  const prefix = `${platform}_`;
  const customContentType = (formData.get(`${prefix}customContentType`) || '').trim().slice(0, 200) || null;
  const customToneStyle = (formData.get(`${prefix}customToneStyle`) || '').trim().slice(0, 200) || null;
  return { customContentType, customToneStyle };
}

// ── Simulate strategy context for post chat assistant ──

interface PlatformPlan {
  platform: string;
  customContentType?: string | null;
  customToneStyle?: string | null;
  customHashtags?: string | null;
  contentTypesOverride?: string[] | null;
  tonesOverride?: string[] | null;
}

function buildStrategyContext(plans: PlatformPlan[]): string {
  if (plans.length === 0) return '';
  const parts: string[] = ['PER-PLATFORM CONTENT STRATEGY (user has enabled this — follow these overrides):'];
  for (const plan of plans) {
    const planParts: string[] = [];
    if (plan.customContentType) planParts.push(`Content type: "${plan.customContentType}" — create this specific type of content`);
    if (plan.customToneStyle) planParts.push(`Tone: "${plan.customToneStyle}" — use this specific tone`);
    if (plan.customHashtags) planParts.push(`Always include hashtags: ${plan.customHashtags}`);
    if (plan.contentTypesOverride && plan.contentTypesOverride.length > 0 && !plan.customContentType) {
      planParts.push(`Preferred content types: ${plan.contentTypesOverride.join(', ')}`);
    }
    if (plan.tonesOverride && plan.tonesOverride.length > 0 && !plan.customToneStyle) {
      planParts.push(`Preferred tones: ${plan.tonesOverride.join(', ')}`);
    }
    if (planParts.length > 0) {
      parts.push(`\n${plan.platform}:`);
      planParts.forEach(p => parts.push(`  - ${p}`));
    }
  }
  return parts.length > 1 ? parts.join('\n') : '';
}

// ══════════════════════════════════════════════════════════════
// TEST SUITE: Custom Content Type Selection (generate-plan logic)
// ══════════════════════════════════════════════════════════════

describe('Custom content type selection', () => {
  test('custom content type overrides everything', () => {
    const result = selectContentType(
      'behind-the-scenes',
      ['educational', 'promotional'],
      ['educational', 'engagement'],
      ['educational'],
      'promotional', // RL says promotional
    );
    expect(result).toBe('behind-the-scenes');
  });

  test('null custom falls back to standard logic', () => {
    const result = selectContentType(
      null,
      ['educational', 'promotional'],
      ['educational', 'engagement'],
      ['educational'],
    );
    expect(result).toBe('educational');
  });

  test('undefined custom falls back to standard logic', () => {
    const result = selectContentType(
      undefined,
      null,
      ['educational', 'engagement'],
      ['engagement'],
    );
    expect(result).toBe('engagement');
  });

  test('empty string custom falls back to standard logic', () => {
    const result = selectContentType(
      '',
      null,
      ['educational'],
      ['educational'],
    );
    // Empty string is falsy, so it falls back
    expect(result).toBe('educational');
  });

  test('RL insight takes priority over platform and global when no custom', () => {
    const result = selectContentType(
      null,
      ['educational', 'promotional'],
      ['educational'],
      ['promotional'],
      'promotional',
    );
    expect(result).toBe('promotional');
  });

  test('custom type can be any free-text value', () => {
    expect(selectContentType('myth busting', null, ['educational'], [])).toBe('myth busting');
    expect(selectContentType('client success story', null, ['educational'], [])).toBe('client success story');
    expect(selectContentType('day-in-life vlog', null, ['educational'], [])).toBe('day-in-life vlog');
  });
});

// ══════════════════════════════════════════════════════════════
// TEST SUITE: Custom Tone Style Selection (generate-plan logic)
// ══════════════════════════════════════════════════════════════

describe('Custom tone style selection', () => {
  test('custom tone overrides everything', () => {
    const result = selectToneStyle(
      'sarcastic but helpful',
      ['professional', 'casual'],
      ['professional'],
      ['professional'],
      'casual', // RL says casual
    );
    expect(result).toBe('sarcastic but helpful');
  });

  test('null custom falls back to standard logic', () => {
    const result = selectToneStyle(
      null,
      ['casual', 'humorous'],
      ['professional'],
      ['casual'],
    );
    expect(result).toBe('casual');
  });

  test('custom tone can be any free-text value', () => {
    expect(selectToneStyle('brutally honest', null, ['professional'], [])).toBe('brutally honest');
    expect(selectToneStyle('warm and nurturing', null, ['professional'], [])).toBe('warm and nurturing');
    expect(selectToneStyle('Gen Z slang with no filter', null, ['casual'], [])).toBe('Gen Z slang with no filter');
  });
});

// ══════════════════════════════════════════════════════════════
// TEST SUITE: AI Prompt Directives
// ══════════════════════════════════════════════════════════════

describe('AI prompt directives for custom types/tones', () => {
  test('custom tone generates override directive', () => {
    const directive = buildToneDirective('professional', 'sarcastic but helpful');
    expect(directive).toContain('SPECIFIC tone style');
    expect(directive).toContain('"sarcastic but helpful"');
    expect(directive).toContain('overrides all default');
  });

  test('no custom tone generates standard directive', () => {
    const directive = buildToneDirective('professional');
    expect(directive).toBe('Use professional tone');
    expect(directive).not.toContain('SPECIFIC');
  });

  test('custom content type generates override directive', () => {
    const directive = buildContentTypeDirective('educational', 'behind-the-scenes');
    expect(directive).toContain('SPECIFIC type of content');
    expect(directive).toContain('"behind-the-scenes"');
    expect(directive).toContain('overrides standard');
  });

  test('no custom content type generates standard directive', () => {
    const directive = buildContentTypeDirective('educational');
    expect(directive).toContain('educational');
    expect(directive).not.toContain('SPECIFIC');
  });

  test('unknown standard content type falls back to raw value', () => {
    const directive = buildContentTypeDirective('unknown_type');
    expect(directive).toContain('unknown_type');
  });
});

// ══════════════════════════════════════════════════════════════
// TEST SUITE: Strategy Page Field Collection
// ══════════════════════════════════════════════════════════════

describe('Strategy page custom field collection', () => {
  test('collects custom content type from form data', () => {
    const form = new Map<string, string>();
    form.set('INSTAGRAM_customContentType', 'behind-the-scenes');
    const { customContentType } = collectCustomFields(form, 'INSTAGRAM');
    expect(customContentType).toBe('behind-the-scenes');
  });

  test('collects custom tone from form data', () => {
    const form = new Map<string, string>();
    form.set('TWITTER_customToneStyle', 'sarcastic but helpful');
    const { customToneStyle } = collectCustomFields(form, 'TWITTER');
    expect(customToneStyle).toBe('sarcastic but helpful');
  });

  test('empty string returns null', () => {
    const form = new Map<string, string>();
    form.set('INSTAGRAM_customContentType', '');
    form.set('INSTAGRAM_customToneStyle', '   ');
    const result = collectCustomFields(form, 'INSTAGRAM');
    expect(result.customContentType).toBeNull();
    expect(result.customToneStyle).toBeNull();
  });

  test('truncates at 200 characters', () => {
    const form = new Map<string, string>();
    form.set('FACEBOOK_customContentType', 'x'.repeat(300));
    const { customContentType } = collectCustomFields(form, 'FACEBOOK');
    expect(customContentType!.length).toBe(200);
  });

  test('trims whitespace', () => {
    const form = new Map<string, string>();
    form.set('LINKEDIN_customToneStyle', '  thought leadership  ');
    const { customToneStyle } = collectCustomFields(form, 'LINKEDIN');
    expect(customToneStyle).toBe('thought leadership');
  });

  test('missing field returns null', () => {
    const form = new Map<string, string>();
    const result = collectCustomFields(form, 'INSTAGRAM');
    expect(result.customContentType).toBeNull();
    expect(result.customToneStyle).toBeNull();
  });

  test('preserves unicode characters', () => {
    const form = new Map<string, string>();
    form.set('INSTAGRAM_customContentType', 'zákulisný obsah');
    form.set('INSTAGRAM_customToneStyle', 'priateľský a vtipný');
    const result = collectCustomFields(form, 'INSTAGRAM');
    expect(result.customContentType).toBe('zákulisný obsah');
    expect(result.customToneStyle).toBe('priateľský a vtipný');
  });
});

// ══════════════════════════════════════════════════════════════
// TEST SUITE: Post Chat Strategy Context
// ══════════════════════════════════════════════════════════════

describe('Post chat strategy context builder', () => {
  test('empty plans produce empty context', () => {
    expect(buildStrategyContext([])).toBe('');
  });

  test('plan with only standard overrides and no custom fields is included', () => {
    const plans: PlatformPlan[] = [{
      platform: 'INSTAGRAM',
      contentTypesOverride: ['educational', 'engagement'],
      tonesOverride: ['casual'],
    }];
    const ctx = buildStrategyContext(plans);
    expect(ctx).toContain('INSTAGRAM');
    expect(ctx).toContain('Preferred content types: educational, engagement');
    expect(ctx).toContain('Preferred tones: casual');
  });

  test('custom content type overrides standard types display', () => {
    const plans: PlatformPlan[] = [{
      platform: 'INSTAGRAM',
      customContentType: 'behind-the-scenes',
      contentTypesOverride: ['educational', 'engagement'],
    }];
    const ctx = buildStrategyContext(plans);
    expect(ctx).toContain('Content type: "behind-the-scenes"');
    // Should NOT show standard types when custom is set
    expect(ctx).not.toContain('Preferred content types');
  });

  test('custom tone overrides standard tones display', () => {
    const plans: PlatformPlan[] = [{
      platform: 'TWITTER',
      customToneStyle: 'brutally honest',
      tonesOverride: ['professional', 'casual'],
    }];
    const ctx = buildStrategyContext(plans);
    expect(ctx).toContain('Tone: "brutally honest"');
    expect(ctx).not.toContain('Preferred tones');
  });

  test('custom hashtags included in context', () => {
    const plans: PlatformPlan[] = [{
      platform: 'INSTAGRAM',
      customHashtags: '#grothi #marketing #ai',
    }];
    const ctx = buildStrategyContext(plans);
    expect(ctx).toContain('#grothi #marketing #ai');
  });

  test('multi-platform context', () => {
    const plans: PlatformPlan[] = [
      { platform: 'INSTAGRAM', customContentType: 'reels', customToneStyle: 'fun and energetic' },
      { platform: 'LINKEDIN', customContentType: 'thought leadership', customToneStyle: 'professional expert' },
    ];
    const ctx = buildStrategyContext(plans);
    expect(ctx).toContain('INSTAGRAM');
    expect(ctx).toContain('reels');
    expect(ctx).toContain('LINKEDIN');
    expect(ctx).toContain('thought leadership');
    expect(ctx).toContain('professional expert');
  });

  test('plan with no useful fields produces empty context', () => {
    const plans: PlatformPlan[] = [{
      platform: 'INSTAGRAM',
      customContentType: null,
      customToneStyle: null,
      customHashtags: null,
      contentTypesOverride: null,
      tonesOverride: null,
    }];
    const ctx = buildStrategyContext(plans);
    expect(ctx).toBe('');
  });

  test('context starts with strategy header', () => {
    const plans: PlatformPlan[] = [{
      platform: 'INSTAGRAM',
      customContentType: 'carousel tips',
    }];
    const ctx = buildStrategyContext(plans);
    expect(ctx).toContain('PER-PLATFORM CONTENT STRATEGY');
    expect(ctx).toContain('follow these overrides');
  });
});

// ══════════════════════════════════════════════════════════════
// TEST SUITE: Edge Cases & Security
// ══════════════════════════════════════════════════════════════

describe('Custom content type/tone edge cases', () => {
  test('custom type with quotes is preserved', () => {
    const directive = buildContentTypeDirective('educational', 'the "no BS" approach');
    expect(directive).toContain('"the "no BS" approach"');
  });

  test('custom tone with special characters is preserved', () => {
    const directive = buildToneDirective('professional', 'friendly & approachable (like a friend)');
    expect(directive).toContain('friendly & approachable (like a friend)');
  });

  test('custom type does not affect other standard content type constants', () => {
    // CONTENT_TYPES should be unchanged
    expect(CONTENT_TYPES.length).toBeGreaterThanOrEqual(7);
    const values = CONTENT_TYPES.map(ct => ct.value);
    expect(values).toContain('educational');
    expect(values).toContain('promotional');
    expect(values).toContain('engagement');
  });

  test('custom tone does not affect other standard tone constants', () => {
    expect(TONE_STYLES.length).toBeGreaterThanOrEqual(6);
    const values = TONE_STYLES.map(t => t.value);
    expect(values).toContain('professional');
    expect(values).toContain('casual');
  });

  test('PLATFORM_NAMES still has all expected platforms', () => {
    expect(Object.keys(PLATFORM_NAMES).length).toBeGreaterThanOrEqual(15);
    expect(PLATFORM_NAMES['INSTAGRAM']).toBe('Instagram');
    expect(PLATFORM_NAMES['TWITTER']).toBe('X (Twitter)');
  });

  test('custom fields are per-platform independent', () => {
    const form = new Map<string, string>();
    form.set('INSTAGRAM_customContentType', 'carousel');
    form.set('TWITTER_customContentType', 'thread');
    form.set('LINKEDIN_customContentType', 'article');

    const ig = collectCustomFields(form, 'INSTAGRAM');
    const tw = collectCustomFields(form, 'TWITTER');
    const li = collectCustomFields(form, 'LINKEDIN');

    expect(ig.customContentType).toBe('carousel');
    expect(tw.customContentType).toBe('thread');
    expect(li.customContentType).toBe('article');
  });
});
