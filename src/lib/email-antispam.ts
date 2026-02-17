/**
 * Email Anti-Spam Module
 *
 * Comprehensive spam prevention for outgoing emails:
 * 1. Content spam score analysis (subject + body)
 * 2. Warm-up daily limits based on account age
 * 3. Bounce/complaint rate health checks (auto-pause)
 * 4. Engagement-based contact sunset recommendations
 *
 * Based on industry standards:
 * - Gmail Postmaster: complaint rate < 0.1%, target < 0.02%
 * - Hard bounce rate < 2%
 * - RFC 8058 one-click unsubscribe
 * - SpamAssassin-style content scoring
 */

// ============ SPAM TRIGGER WORDS (weight-based scoring) ============

interface SpamWord {
  pattern: RegExp;
  weight: number;
  category: string;
}

/**
 * Weighted spam trigger words.
 * Weight 0.5-1.0 = mild risk (flag for review)
 * Weight 1.0-2.0 = moderate risk
 * Weight 2.0+     = high risk (likely spam filter trigger)
 */
const SPAM_TRIGGER_WORDS: SpamWord[] = [
  // Urgency / Pressure (high weight - ISPs penalize these heavily)
  { pattern: /\bact now\b/i, weight: 1.5, category: 'urgency' },
  { pattern: /\blimited time\b/i, weight: 1.5, category: 'urgency' },
  { pattern: /\burgent\b/i, weight: 1.5, category: 'urgency' },
  { pattern: /\bexpires?\s*(today|soon|now)\b/i, weight: 1.5, category: 'urgency' },
  { pattern: /\blast chance\b/i, weight: 1.5, category: 'urgency' },
  { pattern: /\bdon'?t miss\b/i, weight: 1.0, category: 'urgency' },
  { pattern: /\bhurry\b/i, weight: 1.0, category: 'urgency' },
  { pattern: /\bonly\s+\d+\s+(left|remaining)\b/i, weight: 1.0, category: 'urgency' },
  { pattern: /\bbefore it'?s too late\b/i, weight: 1.0, category: 'urgency' },

  // Financial / Money (moderate-high weight)
  { pattern: /\bfree\b/i, weight: 1.0, category: 'financial' },
  { pattern: /\bearn\s+money\b/i, weight: 2.0, category: 'financial' },
  { pattern: /\bcash\s*(bonus|prize|back)\b/i, weight: 2.0, category: 'financial' },
  { pattern: /\bno\s*(cost|fee|charge)\b/i, weight: 1.5, category: 'financial' },
  { pattern: /\bdouble your\b/i, weight: 2.0, category: 'financial' },
  { pattern: /\blowest price\b/i, weight: 1.0, category: 'financial' },
  { pattern: /\b(credit card|debit card)\b/i, weight: 1.0, category: 'financial' },
  { pattern: /\bmake\s+money\b/i, weight: 2.0, category: 'financial' },
  { pattern: /\b\$\$\$\b/, weight: 2.0, category: 'financial' },

  // Guarantees / Promises (moderate weight)
  { pattern: /\b100%\s*(guaranteed|free|safe)\b/i, weight: 1.5, category: 'guarantee' },
  { pattern: /\brisk[- ]free\b/i, weight: 1.5, category: 'guarantee' },
  { pattern: /\bno\s*obligation\b/i, weight: 1.0, category: 'guarantee' },
  { pattern: /\bsatisfaction\s*guaranteed\b/i, weight: 1.0, category: 'guarantee' },
  { pattern: /\bno\s*questions?\s*asked\b/i, weight: 1.5, category: 'guarantee' },

  // Deceptive / Misleading (high weight)
  { pattern: /\bthis is not spam\b/i, weight: 3.0, category: 'deceptive' },
  { pattern: /\byou have been selected\b/i, weight: 2.0, category: 'deceptive' },
  { pattern: /\bcongratulations\b/i, weight: 1.5, category: 'deceptive' },
  { pattern: /\byou('re| are) a winner\b/i, weight: 2.5, category: 'deceptive' },
  { pattern: /\bclick\s*(here|below)\b/i, weight: 1.0, category: 'deceptive' },
  { pattern: /\bas\s+seen\s+on\b/i, weight: 1.0, category: 'deceptive' },
  { pattern: /\bdear\s+(friend|sir|madam)\b/i, weight: 1.5, category: 'deceptive' },

  // Exaggeration (mild-moderate weight)
  { pattern: /\bamazing\s+(deal|offer)\b/i, weight: 1.0, category: 'exaggeration' },
  { pattern: /\bincredible\s+(deal|offer|savings)\b/i, weight: 1.0, category: 'exaggeration' },
  { pattern: /\bonce in a lifetime\b/i, weight: 1.5, category: 'exaggeration' },
  { pattern: /\byou won'?t believe\b/i, weight: 1.0, category: 'exaggeration' },
  { pattern: /\bunbelievable\b/i, weight: 0.5, category: 'exaggeration' },

  // Medical / Pharma (high weight)
  { pattern: /\bweight\s*loss\b/i, weight: 2.0, category: 'medical' },
  { pattern: /\bcure\s+(for|your)\b/i, weight: 2.0, category: 'medical' },
  { pattern: /\bmiracle\b/i, weight: 1.5, category: 'medical' },
  { pattern: /\banti[- ]aging\b/i, weight: 1.5, category: 'medical' },

  // Call to action (mild weight alone but compounds)
  { pattern: /\bbuy\s+now\b/i, weight: 1.0, category: 'cta' },
  { pattern: /\border\s+now\b/i, weight: 1.0, category: 'cta' },
  { pattern: /\bsign up free\b/i, weight: 0.5, category: 'cta' },
  { pattern: /\bspecial\s+promotion\b/i, weight: 1.0, category: 'cta' },
  { pattern: /\bapply now\b/i, weight: 0.5, category: 'cta' },
];

// ============ URL SHORTENER DOMAINS (penalized by spam filters) ============

const URL_SHORTENERS = [
  'bit.ly', 'tinyurl.com', 'goo.gl', 't.co', 'ow.ly', 'is.gd',
  'buff.ly', 'adf.ly', 'bit.do', 'mcaf.ee', 'su.pr', 'db.tt',
  'qr.ae', 'cur.lv', 'ity.im', 'lnkd.in', 'rebrand.ly',
];

// ============ SPAM SCORE ANALYSIS ============

export interface SpamCheckResult {
  score: number;
  level: 'safe' | 'review' | 'warning' | 'blocked';
  warnings: string[];
  details: {
    subjectScore: number;
    contentScore: number;
    structureScore: number;
    triggerWords: { word: string; weight: number; category: string }[];
  };
}

/**
 * Check subject line for spam signals.
 * Returns partial score + warnings.
 */
function checkSubjectLine(subject: string): { score: number; warnings: string[] } {
  const warnings: string[] = [];
  let score = 0;

  // Empty subject
  if (!subject || subject.trim().length === 0) {
    warnings.push('Empty subject line - will likely be marked as spam');
    score += 3.0;
    return { score, warnings };
  }

  // Length check
  if (subject.length > 78) {
    warnings.push(`Subject too long (${subject.length} chars) - may be truncated. Keep under 60 chars`);
    score += 0.5;
  } else if (subject.length > 60) {
    warnings.push(`Subject is ${subject.length} chars - aim for under 60 for best display`);
    score += 0.2;
  }

  // ALL CAPS detection
  const alphaChars = subject.replace(/[^a-zA-Z]/g, '');
  const upperChars = subject.replace(/[^A-Z]/g, '');
  if (alphaChars.length > 3) {
    const capsRatio = upperChars.length / alphaChars.length;
    if (capsRatio >= 1.0) {
      warnings.push('Subject is ALL CAPS - major spam signal');
      score += 2.5;
    } else if (capsRatio > 0.5) {
      warnings.push('Subject has >50% uppercase - avoid excessive caps');
      score += 1.0;
    }
  }

  // Excessive exclamation marks
  const exclamationCount = (subject.match(/!/g) || []).length;
  if (exclamationCount > 2) {
    warnings.push(`${exclamationCount} exclamation marks in subject - use at most 1`);
    score += exclamationCount * 0.5;
  } else if (exclamationCount > 1) {
    warnings.push('Multiple exclamation marks - use at most 1');
    score += 0.5;
  }

  // Excessive question marks
  const questionCount = (subject.match(/\?/g) || []).length;
  if (questionCount > 2) {
    warnings.push('Too many question marks in subject');
    score += 0.5;
  }

  // Fake RE:/FW: prefixes
  if (/^(re|fw|fwd)\s*:/i.test(subject)) {
    warnings.push('RE:/FW: prefix on non-reply emails is deceptive and penalized by spam filters');
    score += 2.0;
  }

  // Excessive special characters
  const specialCount = (subject.match(/[$@#%^&*~]/g) || []).length;
  if (specialCount > 3) {
    warnings.push('Excessive special characters in subject line');
    score += 0.5;
  }

  // Check spam trigger words in subject (higher weight than body)
  for (const trigger of SPAM_TRIGGER_WORDS) {
    if (trigger.pattern.test(subject)) {
      // Subject triggers get 1.5x weight
      score += trigger.weight * 1.5;
    }
  }

  return { score, warnings };
}

/**
 * Check HTML content for spam signals.
 * Returns partial score + warnings.
 */
function checkHtmlContent(html: string): {
  score: number;
  warnings: string[];
  triggerWords: { word: string; weight: number; category: string }[];
} {
  const warnings: string[] = [];
  const triggerWords: { word: string; weight: number; category: string }[] = [];
  let score = 0;

  // Strip HTML tags to get text content
  const textContent = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const htmlLength = html.length;
  const textLength = textContent.length;

  // Empty content
  if (textLength < 20) {
    warnings.push('Email has very little text content - image-only emails are penalized');
    score += 2.0;
  }

  // Text-to-HTML ratio (aim for > 40% text after tag removal)
  if (htmlLength > 0 && textLength > 0) {
    const textRatio = textLength / htmlLength;
    if (textRatio < 0.2) {
      warnings.push(`Low text-to-HTML ratio (${(textRatio * 100).toFixed(0)}%) - include more text content`);
      score += 1.5;
    } else if (textRatio < 0.3) {
      warnings.push(`Text-to-HTML ratio (${(textRatio * 100).toFixed(0)}%) is below recommended 40%`);
      score += 0.5;
    }
  }

  // Email size check (Gmail clips at 102KB)
  if (htmlLength > 102400) {
    warnings.push(`Email HTML is ${(htmlLength / 1024).toFixed(0)}KB - Gmail clips at 102KB which hurts engagement`);
    score += 0.5;
  }

  // Hidden text detection (CSS tricks used by spammers)
  if (/display\s*:\s*none/i.test(html) && !/tracking|pixel|open/i.test(html.substring(html.indexOf('display:none') - 100, html.indexOf('display:none') + 100))) {
    // Allow tracking pixel with display:none, flag others
    const displayNoneCount = (html.match(/display\s*:\s*none/gi) || []).length;
    if (displayNoneCount > 1) {
      warnings.push('Hidden text detected (display:none) - spam filters flag this');
      score += 1.5;
    }
  }

  // Font-size: 0 (hidden text)
  if (/font-size\s*:\s*0/i.test(html)) {
    warnings.push('Zero-size font detected - spam filters heavily penalize hidden text');
    score += 2.0;
  }

  // Color hiding (white text on white background)
  if (/color\s*:\s*(#fff(fff)?|white|rgb\(255\s*,\s*255\s*,\s*255\))/i.test(html)) {
    // Could be legitimate (white text on dark bg), so just flag mildly
    score += 0.3;
  }

  // JavaScript in email (always bad)
  if (/<script\b/i.test(html)) {
    warnings.push('JavaScript detected in email HTML - will be stripped by all clients and triggers spam filters');
    score += 3.0;
  }

  // Forms in email
  if (/<form\b/i.test(html)) {
    warnings.push('HTML form detected - most email clients block forms');
    score += 1.5;
  }

  // URL shorteners
  for (const shortener of URL_SHORTENERS) {
    const regex = new RegExp(`https?://(www\\.)?${shortener.replace(/\./g, '\\.')}`, 'i');
    if (regex.test(html)) {
      warnings.push(`URL shortener (${shortener}) detected - use full branded URLs`);
      score += 2.0;
      break; // Only penalize once
    }
  }

  // Image count (excessive images without text)
  const imageCount = (html.match(/<img\b/gi) || []).length;
  if (imageCount > 15) {
    warnings.push(`${imageCount} images in email - too many images increases spam likelihood`);
    score += 1.0;
  }

  // Images without alt text
  const imagesWithoutAlt = (html.match(/<img(?![^>]*\balt\s*=)[^>]*>/gi) || []).length;
  if (imagesWithoutAlt > 0) {
    warnings.push(`${imagesWithoutAlt} image(s) missing alt text - required for accessibility and deliverability`);
    score += imagesWithoutAlt * 0.3;
  }

  // Link count vs text ratio
  const linkCount = (html.match(/<a\s+[^>]*href/gi) || []).length;
  const wordCount = textContent.split(/\s+/).filter(w => w.length > 0).length;
  if (wordCount > 0 && linkCount > 0) {
    const wordsPerLink = wordCount / linkCount;
    if (wordsPerLink < 20) {
      warnings.push(`High link density (${linkCount} links for ${wordCount} words) - aim for 1 link per 50+ words`);
      score += 0.5;
    }
  }

  // ALL CAPS blocks in body
  const capsBlocks = textContent.match(/\b[A-Z]{5,}\b/g) || [];
  if (capsBlocks.length > 3) {
    warnings.push('Multiple ALL CAPS words in email body');
    score += 0.5;
  }

  // Check spam trigger words in body
  for (const trigger of SPAM_TRIGGER_WORDS) {
    const matches = textContent.match(trigger.pattern);
    if (matches) {
      score += trigger.weight;
      triggerWords.push({
        word: matches[0],
        weight: trigger.weight,
        category: trigger.category,
      });
    }
  }

  return { score, warnings, triggerWords };
}

/**
 * Full spam score analysis of an email campaign.
 *
 * Score thresholds:
 * - 0-3: SAFE (green light)
 * - 3-5: REVIEW (yellow - proceed with caution, show warnings)
 * - 5-8: WARNING (orange - strongly recommend changes)
 * - 8+:  BLOCKED (red - prevent sending, must fix)
 */
export function analyzeSpamScore(subject: string, htmlContent: string): SpamCheckResult {
  const subjectCheck = checkSubjectLine(subject);
  const contentCheck = checkHtmlContent(htmlContent);

  const totalScore = subjectCheck.score + contentCheck.score;
  const allWarnings = [...subjectCheck.warnings, ...contentCheck.warnings];

  let level: SpamCheckResult['level'];
  if (totalScore >= 8) {
    level = 'blocked';
  } else if (totalScore >= 5) {
    level = 'warning';
  } else if (totalScore >= 3) {
    level = 'review';
  } else {
    level = 'safe';
  }

  return {
    score: Math.round(totalScore * 10) / 10,
    level,
    warnings: allWarnings,
    details: {
      subjectScore: Math.round(subjectCheck.score * 10) / 10,
      contentScore: Math.round(contentCheck.score * 10) / 10,
      structureScore: 0,
      triggerWords: contentCheck.triggerWords,
    },
  };
}

// ============ WARM-UP DAILY LIMITS ============

/**
 * Warm-up sending schedule based on account age.
 * Returns the recommended maximum daily send limit for the account.
 *
 * This follows industry-standard warm-up schedules:
 * - Days 1-3:    50/day   (build initial reputation)
 * - Days 4-7:    200/day  (gradual increase)
 * - Days 8-14:   500/day  (moderate volume)
 * - Days 15-21:  1000/day (approaching normal)
 * - Days 22-28:  2000/day (near full capacity)
 * - Days 29-42:  5000/day (established sender)
 * - Days 43+:    No warm-up limit (use account's configured dailyLimit)
 *
 * The returned value is the WARM-UP cap. If the user configured a lower
 * dailyLimit, that takes precedence.
 */
export function getWarmupDailyLimit(accountCreatedAt: Date): number {
  const ageMs = Date.now() - new Date(accountCreatedAt).getTime();
  const ageDays = Math.floor(ageMs / 86400000);

  if (ageDays < 3) return 50;
  if (ageDays < 7) return 200;
  if (ageDays < 14) return 500;
  if (ageDays < 21) return 1000;
  if (ageDays < 28) return 2000;
  if (ageDays < 42) return 5000;

  // Account is warmed up — no artificial cap
  return Infinity;
}

/**
 * Calculate the effective daily limit, considering warm-up restrictions.
 * Returns the lower of: warm-up limit, user-configured limit.
 */
export function getEffectiveDailyLimit(
  accountDailyLimit: number,
  accountCreatedAt: Date,
): { limit: number; isWarmupRestricted: boolean; warmupDay: number } {
  const ageMs = Date.now() - new Date(accountCreatedAt).getTime();
  const warmupDay = Math.floor(ageMs / 86400000) + 1;
  const warmupLimit = getWarmupDailyLimit(accountCreatedAt);

  const effectiveLimit = Math.min(accountDailyLimit, warmupLimit);
  const isWarmupRestricted = warmupLimit < accountDailyLimit;

  return { limit: effectiveLimit, isWarmupRestricted, warmupDay };
}

// ============ CAMPAIGN HEALTH CHECKS ============

interface CampaignStats {
  totalSent: number;
  totalBounced: number;
  totalComplaints: number;
}

export interface HealthCheckResult {
  canSend: boolean;
  warnings: string[];
  bounceRate: number;
  complaintRate: number;
  action: 'allow' | 'warn' | 'pause';
}

/**
 * Check recent campaign health to decide if sending should continue.
 *
 * Thresholds (industry standard):
 * - Bounce rate > 2%:       PAUSE (immediate risk of ISP block)
 * - Bounce rate > 0.5%:     WARN (approaching danger zone)
 * - Complaint rate > 0.1%:  PAUSE (Gmail/Yahoo explicit threshold)
 * - Complaint rate > 0.05%: WARN (approaching danger)
 */
export function checkCampaignHealth(recentCampaigns: CampaignStats[]): HealthCheckResult {
  const warnings: string[] = [];

  // Aggregate recent campaign stats
  const totalSent = recentCampaigns.reduce((s, c) => s + c.totalSent, 0);
  const totalBounced = recentCampaigns.reduce((s, c) => s + c.totalBounced, 0);
  const totalComplaints = recentCampaigns.reduce((s, c) => s + c.totalComplaints, 0);

  if (totalSent === 0) {
    return { canSend: true, warnings: [], bounceRate: 0, complaintRate: 0, action: 'allow' };
  }

  const bounceRate = (totalBounced / totalSent) * 100;
  const complaintRate = (totalComplaints / totalSent) * 100;
  let action: HealthCheckResult['action'] = 'allow';

  // Bounce rate checks
  if (bounceRate > 5) {
    warnings.push(`CRITICAL: Bounce rate ${bounceRate.toFixed(2)}% is dangerously high (>5%). Sending is paused to protect your sender reputation. Clean your contact list before resuming.`);
    action = 'pause';
  } else if (bounceRate > 2) {
    warnings.push(`HIGH: Bounce rate ${bounceRate.toFixed(2)}% exceeds 2% threshold. ISPs will start throttling your emails. Sending is paused — clean your list.`);
    action = 'pause';
  } else if (bounceRate > 0.5) {
    warnings.push(`Bounce rate ${bounceRate.toFixed(2)}% is above recommended 0.5%. Consider cleaning your contact list.`);
    if (action !== 'pause') action = 'warn';
  }

  // Complaint rate checks (Gmail publishes 0.1% as their threshold)
  if (complaintRate > 0.3) {
    warnings.push(`CRITICAL: Spam complaint rate ${complaintRate.toFixed(3)}% is extremely high. Your domain may be blacklisted. Sending is paused.`);
    action = 'pause';
  } else if (complaintRate > 0.1) {
    warnings.push(`HIGH: Spam complaint rate ${complaintRate.toFixed(3)}% exceeds Gmail's 0.1% threshold. Sending is paused to prevent domain blacklisting.`);
    action = 'pause';
  } else if (complaintRate > 0.05) {
    warnings.push(`Spam complaint rate ${complaintRate.toFixed(3)}% is approaching Gmail's 0.1% threshold. Review your email content and list quality.`);
    if (action !== 'pause') action = 'warn';
  }

  return {
    canSend: action !== 'pause',
    warnings,
    bounceRate,
    complaintRate,
    action,
  };
}

// ============ ENGAGEMENT-BASED SUNSET POLICY ============

export interface SunsetRecommendation {
  contactId: string;
  email: string;
  daysSinceEngagement: number;
  action: 'keep' | 'reduce_frequency' | 're_engage' | 'suppress';
}

/**
 * Evaluate a contact's engagement and recommend an action.
 *
 * Sunset policy (industry standard):
 * - Active (engaged in last 30 days):     Full sending frequency
 * - Lapsing (31-90 days):                 Reduce frequency by 50%
 * - At Risk (91-180 days):                Send re-engagement campaign
 * - Inactive (181-365 days):              Suppress from regular campaigns
 * - Dead (365+ days):                     Remove permanently
 */
export function evaluateContactEngagement(contact: {
  lastOpenAt: Date | null;
  lastClickAt: Date | null;
  createdAt: Date;
  openCount: number;
  clickCount: number;
}): { segment: 'active' | 'lapsing' | 'at_risk' | 'inactive' | 'dead'; daysSinceEngagement: number; action: string } {
  const now = Date.now();

  // Last engagement = most recent of open or click
  let lastEngagementAt: number;
  if (contact.lastOpenAt || contact.lastClickAt) {
    const openTime = contact.lastOpenAt ? new Date(contact.lastOpenAt).getTime() : 0;
    const clickTime = contact.lastClickAt ? new Date(contact.lastClickAt).getTime() : 0;
    lastEngagementAt = Math.max(openTime, clickTime);
  } else {
    // Never engaged — use creation date
    lastEngagementAt = new Date(contact.createdAt).getTime();
  }

  const daysSinceEngagement = Math.floor((now - lastEngagementAt) / 86400000);

  if (daysSinceEngagement <= 30) {
    return { segment: 'active', daysSinceEngagement, action: 'keep' };
  }
  if (daysSinceEngagement <= 90) {
    return { segment: 'lapsing', daysSinceEngagement, action: 'reduce_frequency' };
  }
  if (daysSinceEngagement <= 180) {
    return { segment: 'at_risk', daysSinceEngagement, action: 're_engage' };
  }
  if (daysSinceEngagement <= 365) {
    return { segment: 'inactive', daysSinceEngagement, action: 'suppress' };
  }

  return { segment: 'dead', daysSinceEngagement, action: 'remove' };
}

// ============ SENDING RATE LIMITS ============

/**
 * Calculate the delay between individual email sends (in ms).
 *
 * Rate limiting per send prevents overwhelming SMTP servers and
 * ISP throttling. The delay increases for newer accounts.
 *
 * - Days 1-7:   200ms between sends (~300/min, gentle on new accounts)
 * - Days 8-14:  150ms between sends (~400/min)
 * - Days 15-28: 100ms between sends (~600/min)
 * - Days 29+:   50ms between sends  (~1200/min, mature accounts)
 */
export function getSendDelay(accountCreatedAt: Date): number {
  const ageDays = Math.floor((Date.now() - new Date(accountCreatedAt).getTime()) / 86400000);

  if (ageDays < 7) return 200;
  if (ageDays < 14) return 150;
  if (ageDays < 28) return 100;
  return 50;
}

/**
 * Calculate batch size and delay for campaign sending.
 * Newer accounts use smaller batches with longer delays.
 */
export function getSendingPace(accountCreatedAt: Date): {
  batchSize: number;
  batchDelayMs: number;
  perEmailDelayMs: number;
} {
  const ageDays = Math.floor((Date.now() - new Date(accountCreatedAt).getTime()) / 86400000);

  if (ageDays < 7) {
    return { batchSize: 10, batchDelayMs: 5000, perEmailDelayMs: 200 };
  }
  if (ageDays < 14) {
    return { batchSize: 25, batchDelayMs: 3000, perEmailDelayMs: 150 };
  }
  if (ageDays < 28) {
    return { batchSize: 50, batchDelayMs: 2000, perEmailDelayMs: 100 };
  }
  return { batchSize: 50, batchDelayMs: 2000, perEmailDelayMs: 50 };
}
