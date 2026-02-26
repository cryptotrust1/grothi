/**
 * Tests for Target Audience Profile and Global Language Setting
 *
 * Validates:
 * - POST_LANGUAGES constant completeness and format
 * - Audience profile FormData parsing and field collection
 * - Pain point / desire merging logic
 * - Field length security limits (2000 chars)
 * - Language directive injection into AI system prompt
 * - Audience profile injection into AI system prompt
 * - Default/fallback behavior when fields are empty
 * - Edge cases: XSS prevention, empty profiles, partial data
 */

import { POST_LANGUAGES } from '@/lib/constants';

// ── Audience Profile Parsing (mirrors strategy page server action) ────

/** All audience profile fields as defined in the strategy page */
const AUDIENCE_PROFILE_FIELDS = [
  'audienceName', 'summary', 'transformation', 'ageRange', 'gender', 'location', 'languages',
  'occupation', 'incomeLevel', 'education',
  'interests', 'values', 'lifestyle', 'onlineBehavior', 'contentPreferences',
  'painPoint1', 'painPoint2', 'painPoint3',
  'desire1', 'desire2', 'desire3',
  'followMotivation', 'aspirationalIdentity', 'biggestFear',
  'buyingTriggers', 'decisionFactors', 'purchaseStage',
  'trustBarriers', 'priceSensitivity',
  'wordsTheyUse', 'wordsToAvoid', 'commonQuestions', 'objections',
  'communicationStyle', 'emotionalHooks', 'avoidTopics',
  'competitors', 'influencers', 'brandRelationship',
] as const;

/**
 * Parse audience profile from FormData (mirrors handleSaveAudienceProfile logic).
 */
function parseAudienceProfile(formData: Map<string, string>): Record<string, string> {
  const profile: Record<string, string> = {};

  for (const field of AUDIENCE_PROFILE_FIELDS) {
    const val = (formData.get(`ap_${field}`) || '').trim();
    if (val.length > 0) {
      profile[field] = val.slice(0, 2000);
    }
  }

  // Merge pain points and desires
  const painPoints = [profile.painPoint1, profile.painPoint2, profile.painPoint3].filter(Boolean).join('; ');
  const desires = [profile.desire1, profile.desire2, profile.desire3].filter(Boolean).join('; ');
  if (painPoints) profile.painPoints = painPoints;
  if (desires) profile.desires = desires;

  return profile;
}

/**
 * Build audience profile section for AI system prompt
 * (mirrors autonomous-content route logic).
 */
function buildAudiencePromptSection(ap: Record<string, unknown>): string[] {
  if (!ap || Object.keys(ap).length === 0) return [];

  const parts: string[] = ['=== TARGET AUDIENCE PROFILE ==='];

  if (ap.audienceName) parts.push(`Audience name: ${ap.audienceName}`);
  if (ap.summary) parts.push(`Audience summary: ${ap.summary}`);
  if (ap.transformation) parts.push(`TRANSFORMATION: ${ap.transformation} — Every piece of content should move them along this journey.`);

  // Demographics
  if (ap.ageRange) parts.push(`Age range: ${ap.ageRange}`);
  if (ap.gender) parts.push(`Gender: ${ap.gender}`);
  if (ap.location) parts.push(`Location: ${ap.location}`);
  if (ap.languages) parts.push(`Languages spoken: ${ap.languages}`);
  if (ap.occupation) parts.push(`Occupation/Industry: ${ap.occupation}`);
  if (ap.incomeLevel) parts.push(`Income level: ${ap.incomeLevel}`);
  if (ap.education) parts.push(`Education: ${ap.education}`);

  // Psychographics
  if (ap.interests) parts.push(`\nInterests & Hobbies: ${ap.interests}`);
  if (ap.values) parts.push(`Core values: ${ap.values}`);
  if (ap.lifestyle) parts.push(`Lifestyle: ${ap.lifestyle}`);
  if (ap.onlineBehavior) parts.push(`Online behavior: ${ap.onlineBehavior}`);
  if (ap.contentPreferences) parts.push(`Content preferences: ${ap.contentPreferences}`);
  if (ap.followMotivation) parts.push(`Primary reason they follow accounts: ${ap.followMotivation}`);

  // Core psychology
  if (ap.painPoints) parts.push(`\nPAIN POINTS (problems they face — address these directly): ${ap.painPoints}`);
  if (ap.desires) parts.push(`DESIRES (what they want to achieve — speak to these aspirations): ${ap.desires}`);
  if (ap.biggestFear) parts.push(`BIGGEST FEAR (what keeps them up at night): ${ap.biggestFear}`);
  if (ap.aspirationalIdentity) parts.push(`ASPIRATIONAL IDENTITY (who they want to become): ${ap.aspirationalIdentity}`);
  if (ap.objections) parts.push(`OBJECTIONS (why they hesitate to buy/follow): ${ap.objections}`);
  if (ap.commonQuestions) parts.push(`QUESTIONS THEY ASK (use these as content inspiration): ${ap.commonQuestions}`);

  // Vocabulary
  if (ap.wordsTheyUse) parts.push(`\nWORDS & PHRASES TO USE (their actual vocabulary): ${ap.wordsTheyUse}`);
  if (ap.wordsToAvoid) parts.push(`WORDS & PHRASES TO AVOID (will make content feel inauthentic): ${ap.wordsToAvoid}`);

  // Buying psychology
  if (ap.buyingTriggers) parts.push(`\nBUYING TRIGGERS (what makes them take action): ${ap.buyingTriggers}`);
  if (ap.decisionFactors) parts.push(`DECISION STYLE: ${ap.decisionFactors}`);
  if (ap.purchaseStage) parts.push(`PURCHASE STAGE: ${ap.purchaseStage}`);
  if (ap.priceSensitivity) parts.push(`PRICE SENSITIVITY: ${ap.priceSensitivity}`);
  if (ap.trustBarriers) parts.push(`TRUST BARRIERS: ${ap.trustBarriers}`);

  // Competitive context
  if (ap.brandRelationship) parts.push(`\nRelationship with brand: ${ap.brandRelationship}`);
  if (ap.competitors) parts.push(`Competitors they follow: ${ap.competitors}`);
  if (ap.influencers) parts.push(`Influencers they trust: ${ap.influencers}`);

  // Communication strategy
  if (ap.communicationStyle) parts.push(`\nHow to communicate with them: ${ap.communicationStyle}`);
  if (ap.emotionalHooks) parts.push(`Emotional hooks that work: ${ap.emotionalHooks}`);
  if (ap.avoidTopics) parts.push(`Topics/approaches to AVOID: ${ap.avoidTopics}`);

  // Purchase stage mapping
  if (ap.purchaseStage) {
    const stageDirectives: Record<string, string> = {
      unaware: 'Audience is UNAWARE of their problem. Focus on curiosity-driven content.',
      problem_aware: 'Audience KNOWS they have a problem but not the solution.',
      exploring: 'Audience is EXPLORING solutions. Provide educational content.',
      comparing: 'Audience is COMPARING options. Use social proof and differentiators.',
      ready_to_buy: 'Audience is READY TO BUY. Use clear CTAs and urgency.',
      existing_customer: 'Audience is ALREADY A CUSTOMER. Focus on community and loyalty.',
    };
    const directive = stageDirectives[ap.purchaseStage as string];
    if (directive) {
      parts.push(`\nCONTENT STRATEGY FOR PURCHASE STAGE: ${directive}`);
    }
  }

  parts.push('');
  parts.push('INSTRUCTIONS: Use this audience profile to create content that deeply resonates with these specific people.');
  parts.push('Address their pain points, speak to their desires, use their vocabulary (not corporate language), and trigger the psychological factors that drive them to engage, follow, and buy.');
  if (ap.wordsTheyUse) {
    const topWords = (ap.wordsTheyUse as string).split(/[,;\n|]+/).map(w => w.trim()).filter(Boolean).slice(0, 5);
    parts.push(`CRITICAL: Naturally incorporate their language: ${topWords.map(w => `"${w}"`).join(', ')}`);
  }
  if (ap.wordsToAvoid) {
    parts.push(`NEVER use these words/phrases: ${ap.wordsToAvoid}`);
  }
  parts.push('');

  return parts;
}

/**
 * Build language directive for AI system prompt
 * (mirrors autonomous-content route logic).
 */
function buildLanguageDirective(langCode: string): string[] {
  if (!langCode || langCode === 'en') return [];

  const langNames: Record<string, string> = {
    sk: 'Slovak', cs: 'Czech', de: 'German', es: 'Spanish', fr: 'French',
    it: 'Italian', pt: 'Portuguese', nl: 'Dutch', pl: 'Polish', hu: 'Hungarian',
    ro: 'Romanian', bg: 'Bulgarian', hr: 'Croatian', sl: 'Slovenian', uk: 'Ukrainian',
    ru: 'Russian', tr: 'Turkish', ar: 'Arabic', zh: 'Chinese', ja: 'Japanese',
    ko: 'Korean', hi: 'Hindi', sv: 'Swedish', da: 'Danish', fi: 'Finnish',
    no: 'Norwegian', el: 'Greek', he: 'Hebrew', th: 'Thai', vi: 'Vietnamese',
    id: 'Indonesian', ms: 'Malay',
  };
  const langName = langNames[langCode] || langCode;

  return [
    `=== LANGUAGE REQUIREMENT (MANDATORY) ===`,
    `You MUST write the ENTIRE post in ${langName} (${langCode}). Every word, hashtag description, and call-to-action must be in ${langName}.`,
    `Do NOT mix languages. Do NOT write in English unless the user's language IS English.`,
    '',
  ];
}

// ══════════════════════════════════════════════════════════════
// TEST SUITE: POST_LANGUAGES Constant
// ══════════════════════════════════════════════════════════════

describe('POST_LANGUAGES constant', () => {
  test('contains at least 30 languages', () => {
    expect(POST_LANGUAGES.length).toBeGreaterThanOrEqual(30);
  });

  test('has English as the first language', () => {
    expect(POST_LANGUAGES[0]).toEqual({ value: 'en', label: 'English' });
  });

  test('every language has a unique value code', () => {
    const values = POST_LANGUAGES.map(l => l.value);
    expect(new Set(values).size).toBe(values.length);
  });

  test('every language has a non-empty label', () => {
    for (const lang of POST_LANGUAGES) {
      expect(lang.label.length).toBeGreaterThan(0);
    }
  });

  test('all value codes are 2-letter ISO 639-1 codes', () => {
    for (const lang of POST_LANGUAGES) {
      expect(lang.value).toMatch(/^[a-z]{2}$/);
    }
  });

  test('includes core European languages', () => {
    const codes = POST_LANGUAGES.map(l => l.value);
    expect(codes).toContain('en');
    expect(codes).toContain('de');
    expect(codes).toContain('fr');
    expect(codes).toContain('es');
    expect(codes).toContain('it');
    expect(codes).toContain('nl');
    expect(codes).toContain('pl');
  });

  test('includes Slovak and Czech (primary user base)', () => {
    const codes = POST_LANGUAGES.map(l => l.value);
    expect(codes).toContain('sk');
    expect(codes).toContain('cs');
  });

  test('includes Asian languages', () => {
    const codes = POST_LANGUAGES.map(l => l.value);
    expect(codes).toContain('zh');
    expect(codes).toContain('ja');
    expect(codes).toContain('ko');
  });

  test('non-English labels include native name in parentheses', () => {
    const sk = POST_LANGUAGES.find(l => l.value === 'sk');
    expect(sk?.label).toContain('Slovenčina');
    const de = POST_LANGUAGES.find(l => l.value === 'de');
    expect(de?.label).toContain('Deutsch');
    const ja = POST_LANGUAGES.find(l => l.value === 'ja');
    expect(ja?.label).toContain('日本語');
  });
});

// ══════════════════════════════════════════════════════════════
// TEST SUITE: Audience Profile Parsing
// ══════════════════════════════════════════════════════════════

describe('Audience profile parsing', () => {
  test('collects basic fields from FormData', () => {
    const form = new Map<string, string>();
    form.set('ap_audienceName', 'Tech Entrepreneurs');
    form.set('ap_summary', 'Early-stage startup founders');
    form.set('ap_occupation', 'SaaS & Tech');

    const profile = parseAudienceProfile(form);
    expect(profile.audienceName).toBe('Tech Entrepreneurs');
    expect(profile.summary).toBe('Early-stage startup founders');
    expect(profile.occupation).toBe('SaaS & Tech');
  });

  test('trims whitespace from all fields', () => {
    const form = new Map<string, string>();
    form.set('ap_audienceName', '  Tech Entrepreneurs  ');
    form.set('ap_summary', '\n\tBusy founders\n');

    const profile = parseAudienceProfile(form);
    expect(profile.audienceName).toBe('Tech Entrepreneurs');
    expect(profile.summary).toBe('Busy founders');
  });

  test('skips empty and whitespace-only fields', () => {
    const form = new Map<string, string>();
    form.set('ap_audienceName', 'Gamers');
    form.set('ap_summary', '');
    form.set('ap_location', '   ');
    form.set('ap_gender', '\t\n');

    const profile = parseAudienceProfile(form);
    expect(profile.audienceName).toBe('Gamers');
    expect(profile).not.toHaveProperty('summary');
    expect(profile).not.toHaveProperty('location');
    expect(profile).not.toHaveProperty('gender');
  });

  test('skips fields not in FormData at all', () => {
    const form = new Map<string, string>();
    form.set('ap_audienceName', 'Test');
    // Most fields are simply absent

    const profile = parseAudienceProfile(form);
    expect(Object.keys(profile).length).toBe(1);
    expect(profile.audienceName).toBe('Test');
  });

  test('enforces 2000 character limit per field', () => {
    const form = new Map<string, string>();
    const longText = 'a'.repeat(3000);
    form.set('ap_summary', longText);

    const profile = parseAudienceProfile(form);
    expect(profile.summary.length).toBe(2000);
  });

  test('accepts exactly 2000 characters without truncation', () => {
    const form = new Map<string, string>();
    form.set('ap_summary', 'b'.repeat(2000));

    const profile = parseAudienceProfile(form);
    expect(profile.summary.length).toBe(2000);
  });

  test('merges pain points into combined painPoints field', () => {
    const form = new Map<string, string>();
    form.set('ap_painPoint1', 'No time for marketing');
    form.set('ap_painPoint2', 'Content ideas dry up fast');
    form.set('ap_painPoint3', 'Zero engagement on posts');

    const profile = parseAudienceProfile(form);
    expect(profile.painPoints).toBe('No time for marketing; Content ideas dry up fast; Zero engagement on posts');
    // Individual fields should still exist
    expect(profile.painPoint1).toBe('No time for marketing');
    expect(profile.painPoint2).toBe('Content ideas dry up fast');
    expect(profile.painPoint3).toBe('Zero engagement on posts');
  });

  test('merges desires into combined desires field', () => {
    const form = new Map<string, string>();
    form.set('ap_desire1', 'Grow to 10K followers');
    form.set('ap_desire2', 'Automate marketing');

    const profile = parseAudienceProfile(form);
    expect(profile.desires).toBe('Grow to 10K followers; Automate marketing');
  });

  test('pain point merge skips empty entries', () => {
    const form = new Map<string, string>();
    form.set('ap_painPoint1', 'No time');
    form.set('ap_painPoint2', '');
    form.set('ap_painPoint3', 'Low reach');

    const profile = parseAudienceProfile(form);
    expect(profile.painPoints).toBe('No time; Low reach');
    expect(profile).not.toHaveProperty('painPoint2');
  });

  test('no painPoints field when all pain points are empty', () => {
    const form = new Map<string, string>();
    form.set('ap_audienceName', 'Test');

    const profile = parseAudienceProfile(form);
    expect(profile).not.toHaveProperty('painPoints');
  });

  test('no desires field when all desires are empty', () => {
    const form = new Map<string, string>();
    form.set('ap_audienceName', 'Test');

    const profile = parseAudienceProfile(form);
    expect(profile).not.toHaveProperty('desires');
  });

  test('collects all possible fields', () => {
    const form = new Map<string, string>();
    for (const field of AUDIENCE_PROFILE_FIELDS) {
      form.set(`ap_${field}`, `value_for_${field}`);
    }

    const profile = parseAudienceProfile(form);
    // All base fields + 2 merged fields (painPoints, desires)
    expect(Object.keys(profile).length).toBe(AUDIENCE_PROFILE_FIELDS.length + 2);
  });

  test('includes transformation field in collected data', () => {
    const form = new Map<string, string>();
    form.set('ap_transformation', 'FROM overwhelmed solopreneur TO confident brand owner');

    const profile = parseAudienceProfile(form);
    expect(profile.transformation).toBe('FROM overwhelmed solopreneur TO confident brand owner');
  });

  test('does not include removed companySize or followReasons fields', () => {
    expect(AUDIENCE_PROFILE_FIELDS).not.toContain('companySize');
    expect(AUDIENCE_PROFILE_FIELDS).not.toContain('followReasons');
  });

  test('ignores fields not prefixed with ap_', () => {
    const form = new Map<string, string>();
    form.set('audienceName', 'Not Prefixed');
    form.set('ap_audienceName', 'Correct');
    form.set('xss_payload', '<script>alert(1)</script>');

    const profile = parseAudienceProfile(form);
    expect(profile.audienceName).toBe('Correct');
    expect(Object.keys(profile).length).toBe(1);
  });
});

// ══════════════════════════════════════════════════════════════
// TEST SUITE: Language Directive for AI Prompt
// ══════════════════════════════════════════════════════════════

describe('Language directive for AI prompt', () => {
  test('returns empty array for English', () => {
    expect(buildLanguageDirective('en')).toEqual([]);
  });

  test('returns empty array for empty string', () => {
    expect(buildLanguageDirective('')).toEqual([]);
  });

  test('generates directive for Slovak', () => {
    const parts = buildLanguageDirective('sk');
    expect(parts.length).toBeGreaterThan(0);
    expect(parts[0]).toContain('LANGUAGE REQUIREMENT');
    expect(parts[1]).toContain('Slovak');
    expect(parts[1]).toContain('sk');
    expect(parts[1]).toContain('MUST write the ENTIRE post');
  });

  test('generates directive for all supported non-English languages', () => {
    const nonEnglish = POST_LANGUAGES.filter(l => l.value !== 'en');
    for (const lang of nonEnglish) {
      const parts = buildLanguageDirective(lang.value);
      expect(parts.length).toBeGreaterThan(0);
      expect(parts[0]).toContain('MANDATORY');
    }
  });

  test('includes anti-mixing instruction', () => {
    const parts = buildLanguageDirective('de');
    const joined = parts.join('\n');
    expect(joined).toContain('Do NOT mix languages');
    expect(joined).toContain('Do NOT write in English');
  });

  test('handles unknown language code gracefully', () => {
    const parts = buildLanguageDirective('xx');
    expect(parts.length).toBeGreaterThan(0);
    // Falls back to using the code itself
    expect(parts[1]).toContain('xx');
  });

  test('German directive mentions German/Deutsch', () => {
    const parts = buildLanguageDirective('de');
    expect(parts[1]).toContain('German');
    expect(parts[1]).toContain('de');
  });

  test('Chinese directive mentions Chinese', () => {
    const parts = buildLanguageDirective('zh');
    expect(parts[1]).toContain('Chinese');
  });

  test('Arabic directive mentions Arabic', () => {
    const parts = buildLanguageDirective('ar');
    expect(parts[1]).toContain('Arabic');
  });
});

// ══════════════════════════════════════════════════════════════
// TEST SUITE: Audience Profile AI Prompt Injection
// ══════════════════════════════════════════════════════════════

describe('Audience profile AI prompt injection', () => {
  test('returns empty array for empty profile', () => {
    expect(buildAudiencePromptSection({})).toEqual([]);
  });

  test('returns empty array for null/undefined', () => {
    expect(buildAudiencePromptSection(null as unknown as Record<string, unknown>)).toEqual([]);
  });

  test('includes header for non-empty profile', () => {
    const parts = buildAudiencePromptSection({ summary: 'Tech founders' });
    expect(parts[0]).toBe('=== TARGET AUDIENCE PROFILE ===');
  });

  test('includes demographic fields when present', () => {
    const ap = {
      ageRange: '25-34',
      gender: 'mixed',
      location: 'USA',
      education: 'bachelors',
    };
    const joined = buildAudiencePromptSection(ap).join('\n');
    expect(joined).toContain('Age range: 25-34');
    expect(joined).toContain('Gender: mixed');
    expect(joined).toContain('Location: USA');
    expect(joined).toContain('Education: bachelors');
  });

  test('includes psychographic fields when present', () => {
    const ap = {
      interests: 'technology, startups',
      values: 'innovation, freedom',
      lifestyle: 'remote workers',
    };
    const joined = buildAudiencePromptSection(ap).join('\n');
    expect(joined).toContain('Interests & Hobbies: technology, startups');
    expect(joined).toContain('Core values: innovation, freedom');
    expect(joined).toContain('Lifestyle: remote workers');
  });

  test('includes pain points and desires', () => {
    const ap = {
      painPoints: 'No time for marketing; Content ideas dry up',
      desires: 'Grow followers; Save time',
    };
    const joined = buildAudiencePromptSection(ap).join('\n');
    expect(joined).toContain('PAIN POINTS');
    expect(joined).toContain('No time for marketing');
    expect(joined).toContain('DESIRES');
    expect(joined).toContain('Grow followers');
  });

  test('includes buying psychology fields', () => {
    const ap = {
      buyingTriggers: 'Free trial, case studies',
      decisionFactors: 'ROI, ease of use',
      purchaseStage: 'exploring',
      priceSensitivity: 'moderate',
      trustBarriers: 'Skeptical of AI tools',
    };
    const joined = buildAudiencePromptSection(ap).join('\n');
    expect(joined).toContain('BUYING TRIGGERS (what makes them take action): Free trial');
    expect(joined).toContain('DECISION STYLE: ROI');
    expect(joined).toContain('PURCHASE STAGE: exploring');
    expect(joined).toContain('PRICE SENSITIVITY: moderate');
    expect(joined).toContain('TRUST BARRIERS: Skeptical');
  });

  test('includes communication fields', () => {
    const ap = {
      communicationStyle: 'Direct, no fluff',
      emotionalHooks: 'FOMO, authority',
      avoidTopics: 'politics, religion',
    };
    const joined = buildAudiencePromptSection(ap).join('\n');
    expect(joined).toContain('How to communicate with them: Direct, no fluff');
    expect(joined).toContain('Emotional hooks that work: FOMO, authority');
    expect(joined).toContain('Topics/approaches to AVOID: politics, religion');
  });

  test('includes competitive landscape', () => {
    const ap = {
      competitors: 'Buffer, Hootsuite',
      influencers: 'Gary Vee, Alex Hormozi',
      brandRelationship: 'New to the brand',
    };
    const joined = buildAudiencePromptSection(ap).join('\n');
    expect(joined).toContain('Competitors they follow: Buffer, Hootsuite');
    expect(joined).toContain('Influencers they trust: Gary Vee');
    expect(joined).toContain('Relationship with brand: New');
  });

  test('ends with AI instruction', () => {
    const ap = { summary: 'Test audience' };
    const parts = buildAudiencePromptSection(ap);
    const joined = parts.join('\n');
    expect(joined).toContain('INSTRUCTIONS');
    expect(joined).toContain('deeply resonates');
    expect(joined).toContain('vocabulary');
  });

  test('skips missing fields without placeholder text', () => {
    const ap = {
      summary: 'Startup founders',
      // Most fields intentionally missing
    };
    const joined = buildAudiencePromptSection(ap).join('\n');
    expect(joined).toContain('Audience summary: Startup founders');
    expect(joined).not.toContain('Age range:');
    expect(joined).not.toContain('Gender:');
    expect(joined).not.toContain('PAIN POINTS');
  });

  test('handles full profile with all fields', () => {
    const ap = {
      audienceName: 'Tech Entrepreneurs',
      summary: 'Tech-savvy entrepreneurs aged 25-34',
      transformation: 'FROM overwhelmed solopreneur TO confident brand owner',
      ageRange: '25-34',
      gender: 'mixed',
      location: 'Global',
      languages: 'English, Slovak',
      occupation: 'SaaS founders',
      incomeLevel: '$50K-$100K',
      education: 'bachelors',
      interests: 'startups, AI, marketing',
      values: 'innovation, efficiency',
      lifestyle: 'remote first',
      onlineBehavior: 'Active on Twitter and LinkedIn',
      contentPreferences: 'short tips, data-driven',
      followMotivation: 'learn new skills, stay updated',
      painPoints: 'No time; Low engagement; Too many platforms',
      desires: 'Grow audience; Automate marketing; Build brand',
      biggestFear: 'Falling behind competitors',
      aspirationalIdentity: 'Successful entrepreneur with passive income',
      objections: 'Tried tools before that failed',
      commonQuestions: 'How do I grow my followers?',
      wordsTheyUse: 'side hustle, passive income, scale',
      wordsToAvoid: 'get rich quick, guru',
      buyingTriggers: 'Free trial, social proof',
      decisionFactors: 'research',
      purchaseStage: 'exploring',
      priceSensitivity: 'moderate',
      trustBarriers: 'Skeptical of AI tools',
      brandRelationship: 'Evaluating',
      competitors: 'Buffer, Hootsuite',
      influencers: 'Gary Vee',
      communicationStyle: 'Direct, no fluff',
      emotionalHooks: 'FOMO, authority, aspiration',
      avoidTopics: 'politics',
    };
    const parts = buildAudiencePromptSection(ap);
    // Should have at least 25 lines for a full profile
    expect(parts.length).toBeGreaterThanOrEqual(25);

    const joined = parts.join('\n');
    // Verify all sections present
    expect(joined).toContain('TARGET AUDIENCE PROFILE');
    expect(joined).toContain('Audience name: Tech Entrepreneurs');
    expect(joined).toContain('Audience summary');
    expect(joined).toContain('TRANSFORMATION');
    expect(joined).toContain('Age range');
    expect(joined).toContain('PAIN POINTS');
    expect(joined).toContain('DESIRES');
    expect(joined).toContain('BIGGEST FEAR');
    expect(joined).toContain('ASPIRATIONAL IDENTITY');
    expect(joined).toContain('WORDS & PHRASES TO USE');
    expect(joined).toContain('WORDS & PHRASES TO AVOID');
    expect(joined).toContain('BUYING TRIGGERS');
    expect(joined).toContain('PURCHASE STAGE');
    expect(joined).toContain('CONTENT STRATEGY FOR PURCHASE STAGE');
    expect(joined).toContain('INSTRUCTIONS');
    // Vocabulary enforcement
    expect(joined).toContain('CRITICAL: Naturally incorporate');
    expect(joined).toContain('NEVER use these words');
  });

  test('includes vocabulary in prompt when present', () => {
    const ap = {
      wordsTheyUse: 'side hustle, content game, growth hacking',
      wordsToAvoid: 'get rich quick, guru, easy money',
    };
    const joined = buildAudiencePromptSection(ap).join('\n');
    expect(joined).toContain('WORDS & PHRASES TO USE');
    expect(joined).toContain('side hustle');
    expect(joined).toContain('WORDS & PHRASES TO AVOID');
    expect(joined).toContain('get rich quick');
    // Enforcement instructions
    expect(joined).toContain('CRITICAL: Naturally incorporate');
    expect(joined).toContain('NEVER use these words');
  });

  test('includes transformation statement when present', () => {
    const ap = {
      transformation: 'FROM frustrated marketer TO automated growth machine',
    };
    const joined = buildAudiencePromptSection(ap).join('\n');
    expect(joined).toContain('TRANSFORMATION: FROM frustrated marketer');
    expect(joined).toContain('Every piece of content should move them along this journey');
  });

  test('purchase stage exploring generates educational content directive', () => {
    const ap = { purchaseStage: 'exploring' };
    const joined = buildAudiencePromptSection(ap).join('\n');
    expect(joined).toContain('CONTENT STRATEGY FOR PURCHASE STAGE');
    expect(joined).toContain('EXPLORING solutions');
    expect(joined).toContain('educational content');
  });

  test('purchase stage ready_to_buy generates urgency directive', () => {
    const ap = { purchaseStage: 'ready_to_buy' };
    const joined = buildAudiencePromptSection(ap).join('\n');
    expect(joined).toContain('READY TO BUY');
    expect(joined).toContain('CTA');
  });

  test('purchase stage unaware generates curiosity directive', () => {
    const ap = { purchaseStage: 'unaware' };
    const joined = buildAudiencePromptSection(ap).join('\n');
    expect(joined).toContain('UNAWARE');
    expect(joined).toContain('curiosity');
  });

  test('includes biggestFear and aspirationalIdentity in prompt', () => {
    const ap = {
      biggestFear: 'Falling behind competitors who use AI',
      aspirationalIdentity: 'Industry thought leader with 100K followers',
    };
    const joined = buildAudiencePromptSection(ap).join('\n');
    expect(joined).toContain('BIGGEST FEAR');
    expect(joined).toContain('Falling behind competitors');
    expect(joined).toContain('ASPIRATIONAL IDENTITY');
    expect(joined).toContain('thought leader');
  });

  test('includes followMotivation and commonQuestions in prompt', () => {
    const ap = {
      followMotivation: 'learn new skills, stay updated on trends',
      commonQuestions: 'How do I grow followers? Is AI content detectable?',
    };
    const joined = buildAudiencePromptSection(ap).join('\n');
    expect(joined).toContain('Primary reason they follow accounts');
    expect(joined).toContain('learn new skills');
    expect(joined).toContain('QUESTIONS THEY ASK');
    expect(joined).toContain('How do I grow followers');
  });
});

// ══════════════════════════════════════════════════════════════
// TEST SUITE: Integration — Language + Audience in System Prompt
// ══════════════════════════════════════════════════════════════

describe('Language + Audience integration', () => {
  test('language directive comes before audience profile', () => {
    const systemParts: string[] = [];

    // Simulate the order from autonomous-content route
    systemParts.push('You are an expert social media growth strategist.');
    systemParts.push('Brand instructions...');

    // Language first
    const langParts = buildLanguageDirective('sk');
    if (langParts.length > 0) systemParts.push(...langParts);

    // Then audience
    const apParts = buildAudiencePromptSection({ summary: 'Slovak entrepreneurs' });
    if (apParts.length > 0) systemParts.push(...apParts);

    const joined = systemParts.join('\n');
    const langIdx = joined.indexOf('LANGUAGE REQUIREMENT');
    const apIdx = joined.indexOf('TARGET AUDIENCE PROFILE');
    expect(langIdx).toBeGreaterThan(-1);
    expect(apIdx).toBeGreaterThan(-1);
    expect(langIdx).toBeLessThan(apIdx);
  });

  test('English language produces no directive, audience profile still works', () => {
    const langParts = buildLanguageDirective('en');
    expect(langParts).toEqual([]);

    const apParts = buildAudiencePromptSection({ summary: 'English speakers' });
    expect(apParts.length).toBeGreaterThan(0);
    expect(apParts.join('\n')).toContain('English speakers');
  });

  test('both absent produces minimal prompt', () => {
    const langParts = buildLanguageDirective('en');
    const apParts = buildAudiencePromptSection({});
    expect(langParts.length).toBe(0);
    expect(apParts.length).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════
// TEST SUITE: Language Setting Validation
// ══════════════════════════════════════════════════════════════

describe('Language setting validation', () => {
  test('valid language codes are accepted', () => {
    const validCodes = POST_LANGUAGES.map(l => l.value) as readonly string[];
    expect(validCodes.includes('en')).toBe(true);
    expect(validCodes.includes('sk')).toBe(true);
    expect(validCodes.includes('zh')).toBe(true);
  });

  test('invalid language codes fall back to en', () => {
    const validLanguages = POST_LANGUAGES.map(l => l.value) as readonly string[];
    const rawLang = 'invalid_lang';
    const result = validLanguages.includes(rawLang) ? rawLang : 'en';
    expect(result).toBe('en');
  });

  test('empty string falls back to en', () => {
    const validLanguages = POST_LANGUAGES.map(l => l.value) as readonly string[];
    const rawLang = '';
    const result = validLanguages.includes(rawLang) ? rawLang : 'en';
    expect(result).toBe('en');
  });

  test('language code extraction from reactorState defaults to en', () => {
    const reactorState: Record<string, unknown> = {};
    const postLanguage = (reactorState.postLanguage as string) || 'en';
    expect(postLanguage).toBe('en');
  });

  test('language code extraction from reactorState uses stored value', () => {
    const reactorState: Record<string, unknown> = { postLanguage: 'de' };
    const postLanguage = (reactorState.postLanguage as string) || 'en';
    expect(postLanguage).toBe('de');
  });
});

// ══════════════════════════════════════════════════════════════
// TEST SUITE: Security & Edge Cases
// ══════════════════════════════════════════════════════════════

describe('Security and edge cases', () => {
  test('HTML tags in audience fields are preserved as-is (stored, not executed)', () => {
    const form = new Map<string, string>();
    form.set('ap_summary', '<script>alert("xss")</script>Business owners');

    const profile = parseAudienceProfile(form);
    // The raw value is stored — HTML escaping happens at render time in React
    expect(profile.summary).toContain('<script>');
    expect(profile.summary).toContain('Business owners');
  });

  test('extremely long single field is truncated', () => {
    const form = new Map<string, string>();
    form.set('ap_summary', 'x'.repeat(10000));

    const profile = parseAudienceProfile(form);
    expect(profile.summary.length).toBe(2000);
  });

  test('Unicode characters in audience fields are preserved', () => {
    const form = new Map<string, string>();
    form.set('ap_audienceName', 'Českí podnikatelia');
    form.set('ap_wordsTheyUse', '发展, 创新, 效率');
    form.set('ap_location', 'القاهرة');

    const profile = parseAudienceProfile(form);
    expect(profile.audienceName).toBe('Českí podnikatelia');
    expect(profile.wordsTheyUse).toBe('发展, 创新, 效率');
    expect(profile.location).toBe('القاهرة');
  });

  test('newlines in textarea fields are preserved', () => {
    const form = new Map<string, string>();
    form.set('ap_interests', 'Line 1\nLine 2\nLine 3');

    const profile = parseAudienceProfile(form);
    expect(profile.interests).toBe('Line 1\nLine 2\nLine 3');
  });

  test('audience profile from reactorState handles missing key', () => {
    const reactorState: Record<string, unknown> = { postLanguage: 'en' };
    const ap = (reactorState.audienceProfile as Record<string, unknown>) || {};
    expect(ap).toEqual({});
    expect(buildAudiencePromptSection(ap)).toEqual([]);
  });

  test('audience profile from reactorState handles existing data', () => {
    const reactorState: Record<string, unknown> = {
      audienceProfile: {
        summary: 'Startup founders in tech',
        painPoints: 'Time management; Low reach',
      },
    };
    const ap = (reactorState.audienceProfile as Record<string, unknown>) || {};
    const parts = buildAudiencePromptSection(ap);
    expect(parts.join('\n')).toContain('Startup founders in tech');
    expect(parts.join('\n')).toContain('Time management; Low reach');
  });

  test('all 33 language name mappings are complete', () => {
    // The language name mapping in the AI route should cover all POST_LANGUAGES except English
    const langNames: Record<string, string> = {
      sk: 'Slovak', cs: 'Czech', de: 'German', es: 'Spanish', fr: 'French',
      it: 'Italian', pt: 'Portuguese', nl: 'Dutch', pl: 'Polish', hu: 'Hungarian',
      ro: 'Romanian', bg: 'Bulgarian', hr: 'Croatian', sl: 'Slovenian', uk: 'Ukrainian',
      ru: 'Russian', tr: 'Turkish', ar: 'Arabic', zh: 'Chinese', ja: 'Japanese',
      ko: 'Korean', hi: 'Hindi', sv: 'Swedish', da: 'Danish', fi: 'Finnish',
      no: 'Norwegian', el: 'Greek', he: 'Hebrew', th: 'Thai', vi: 'Vietnamese',
      id: 'Indonesian', ms: 'Malay',
    };

    const nonEnglish = POST_LANGUAGES.filter(l => l.value !== 'en');
    for (const lang of nonEnglish) {
      expect(langNames[lang.value]).toBeDefined();
      expect(langNames[lang.value].length).toBeGreaterThan(0);
    }
  });
});

// ══════════════════════════════════════════════════════════════
// TEST SUITE: Stress Tests — Second Audit Verification
// ══════════════════════════════════════════════════════════════

describe('Stress tests — second audit', () => {
  test('brandRelationship field is included in AUDIENCE_PROFILE_FIELDS', () => {
    expect(AUDIENCE_PROFILE_FIELDS).toContain('brandRelationship');
  });

  test('brandRelationship appears in prompt when set', () => {
    const ap = { brandRelationship: 'engaged' };
    const joined = buildAudiencePromptSection(ap).join('\n');
    expect(joined).toContain('Relationship with brand: engaged');
  });

  test('brandRelationship is omitted from prompt when empty', () => {
    const ap = { summary: 'Test audience' };
    const joined = buildAudiencePromptSection(ap).join('\n');
    expect(joined).not.toContain('Relationship with brand');
  });

  test('vocabulary split handles semicolons', () => {
    const ap = { wordsTheyUse: 'side hustle; passive income; scale; growth hacking; content game; marketing' };
    const joined = buildAudiencePromptSection(ap).join('\n');
    expect(joined).toContain('"side hustle"');
    expect(joined).toContain('"passive income"');
    expect(joined).toContain('"content game"');
    // Only top 5 should appear in CRITICAL line
    expect(joined).not.toContain('"marketing"');
  });

  test('vocabulary split handles newlines', () => {
    const ap = { wordsTheyUse: 'growth\nautomation\nscaling\nbrand\nROI\nextra' };
    const joined = buildAudiencePromptSection(ap).join('\n');
    expect(joined).toContain('"growth"');
    expect(joined).toContain('"ROI"');
    // 6th word should not appear in CRITICAL enforcement
    expect(joined).not.toContain('"extra"');
  });

  test('vocabulary split handles pipes', () => {
    const ap = { wordsTheyUse: 'hustle|grind|build|ship|launch|scale' };
    const joined = buildAudiencePromptSection(ap).join('\n');
    expect(joined).toContain('"hustle"');
    expect(joined).toContain('"launch"');
    expect(joined).not.toContain('"scale"');
  });

  test('vocabulary split handles mixed delimiters', () => {
    const ap = { wordsTheyUse: 'hustle, grind; build\nship | launch, scale' };
    const joined = buildAudiencePromptSection(ap).join('\n');
    expect(joined).toContain('"hustle"');
    expect(joined).toContain('"grind"');
    expect(joined).toContain('"build"');
    expect(joined).toContain('"ship"');
    expect(joined).toContain('"launch"');
    // 6th should be excluded from CRITICAL enforcement
    expect(joined).not.toContain('"scale"');
  });

  test('vocabulary split handles trailing/leading delimiters', () => {
    const ap = { wordsTheyUse: ',, hustle, grind, ,,' };
    const joined = buildAudiencePromptSection(ap).join('\n');
    expect(joined).toContain('"hustle"');
    expect(joined).toContain('"grind"');
    // Empty strings from split should be filtered
    expect(joined).not.toContain('""');
  });

  test('empty profile produces zero-length prompt section', () => {
    expect(buildAudiencePromptSection({}).length).toBe(0);
  });

  test('profile with only whitespace-value fields produces zero-length prompt section', () => {
    // After parsing, whitespace-only values would already be excluded
    // So an "empty-looking" profile object would simply be {}
    const ap = {};
    expect(buildAudiencePromptSection(ap).length).toBe(0);
  });

  test('every purchase stage value generates a directive', () => {
    const stages = ['unaware', 'problem_aware', 'exploring', 'comparing', 'ready_to_buy', 'existing_customer'];
    for (const stage of stages) {
      const joined = buildAudiencePromptSection({ purchaseStage: stage }).join('\n');
      expect(joined).toContain('CONTENT STRATEGY FOR PURCHASE STAGE');
    }
  });

  test('unknown purchase stage does not generate a directive', () => {
    const joined = buildAudiencePromptSection({ purchaseStage: 'unknown_stage' }).join('\n');
    expect(joined).toContain('PURCHASE STAGE: unknown_stage');
    expect(joined).not.toContain('CONTENT STRATEGY FOR PURCHASE STAGE');
  });

  test('all 39 fields exist in AUDIENCE_PROFILE_FIELDS', () => {
    expect(AUDIENCE_PROFILE_FIELDS.length).toBe(39);
    // Verify key fields are present
    const expected = [
      'audienceName', 'summary', 'transformation', 'ageRange', 'gender', 'location', 'languages',
      'occupation', 'incomeLevel', 'education',
      'interests', 'values', 'lifestyle', 'onlineBehavior', 'contentPreferences',
      'painPoint1', 'painPoint2', 'painPoint3',
      'desire1', 'desire2', 'desire3',
      'followMotivation', 'aspirationalIdentity', 'biggestFear',
      'buyingTriggers', 'decisionFactors', 'purchaseStage',
      'trustBarriers', 'priceSensitivity',
      'wordsTheyUse', 'wordsToAvoid', 'commonQuestions', 'objections',
      'communicationStyle', 'emotionalHooks', 'avoidTopics',
      'competitors', 'influencers', 'brandRelationship',
    ];
    expect([...AUDIENCE_PROFILE_FIELDS]).toEqual(expected);
  });

  test('no removed fields remain (companySize, followReasons, fears, socialPlatforms)', () => {
    const fields = [...AUDIENCE_PROFILE_FIELDS];
    expect(fields).not.toContain('companySize');
    expect(fields).not.toContain('followReasons');
    expect(fields).not.toContain('fears');
    expect(fields).not.toContain('socialPlatforms');
  });

  test('emoji input in fields is preserved', () => {
    const form = new Map<string, string>();
    form.set('ap_emotionalHooks', '🔥 FOMO — competitors ahead 💪 Motivation');
    const profile = parseAudienceProfile(form);
    expect(profile.emotionalHooks).toBe('🔥 FOMO — competitors ahead 💪 Motivation');
  });

  test('multiline textarea content preserved through full pipeline', () => {
    const form = new Map<string, string>();
    form.set('ap_commonQuestions', 'How do I grow?\nIs AI content detectable?\nWhat platforms work best?');
    const profile = parseAudienceProfile(form);
    const parts = buildAudiencePromptSection(profile);
    const joined = parts.join('\n');
    expect(joined).toContain('How do I grow?');
    expect(joined).toContain('Is AI content detectable?');
  });

  test('select dropdown values are AI-readable', () => {
    const ap = {
      gender: 'mostly_female',
      incomeLevel: 'affluent',
      education: 'master',
      decisionFactors: 'research',
      priceSensitivity: 'very_sensitive',
      brandRelationship: 'churned',
    };
    const joined = buildAudiencePromptSection(ap).join('\n');
    expect(joined).toContain('Gender: mostly_female');
    expect(joined).toContain('Income level: affluent');
    expect(joined).toContain('Education: master');
    expect(joined).toContain('DECISION STYLE: research');
    expect(joined).toContain('PRICE SENSITIVITY: very_sensitive');
    expect(joined).toContain('Relationship with brand: churned');
  });

  test('wordsToAvoid enforcement appears twice in prompt (sandwich technique)', () => {
    const ap = { wordsToAvoid: 'guru, get rich quick' };
    const joined = buildAudiencePromptSection(ap).join('\n');
    // First mention in vocabulary section
    expect(joined).toContain('WORDS & PHRASES TO AVOID');
    // Second mention as NEVER enforcement
    expect(joined).toContain('NEVER use these words/phrases');
  });

  test('wordsTheyUse enforcement appears twice in prompt (sandwich technique)', () => {
    const ap = { wordsTheyUse: 'hustle, grind, build' };
    const joined = buildAudiencePromptSection(ap).join('\n');
    // First mention in vocabulary section
    expect(joined).toContain('WORDS & PHRASES TO USE');
    // Second mention as CRITICAL enforcement
    expect(joined).toContain('CRITICAL: Naturally incorporate');
  });

  test('extremely long pain point field is truncated at 2000 chars', () => {
    const form = new Map<string, string>();
    form.set('ap_painPoint1', 'x'.repeat(5000));
    form.set('ap_painPoint2', 'y'.repeat(3000));
    const profile = parseAudienceProfile(form);
    expect(profile.painPoint1.length).toBe(2000);
    expect(profile.painPoint2.length).toBe(2000);
    // Merged field combines truncated versions
    expect(profile.painPoints.length).toBe(2000 + 2 + 2000); // '; ' separator
  });

  test('backward compatibility: old profile without new fields works', () => {
    // Simulates a profile saved before transformation, audienceName were added
    const oldProfile: Record<string, unknown> = {
      summary: 'Old profile',
      painPoints: 'Old pain points',
      occupation: 'Tech',
    };
    const parts = buildAudiencePromptSection(oldProfile);
    const joined = parts.join('\n');
    expect(joined).toContain('Audience summary: Old profile');
    expect(joined).toContain('PAIN POINTS');
    expect(joined).not.toContain('Audience name:');
    expect(joined).not.toContain('TRANSFORMATION:');
  });
});
