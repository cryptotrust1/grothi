/**
 * Deep Audit Fixes — Regression tests for Round 4 (deep audit).
 * Tests for: ownership checks, password validation, SSRF protection,
 * pagination, concurrency guards, file cleanup, rate limiting, input validation.
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

beforeAll(() => {
  process.env.ENCRYPTION_KEY = 'a'.repeat(64);
  process.env.NEXTAUTH_SECRET = 'test-secret-for-oauth';
});

// ============================================================
// 1. CRITICAL: Bot delete ownership check
// ============================================================
describe('Bot delete ownership check', () => {
  it('handleDelete in bot settings should verify ownership before deleting', () => {
    const filePath = path.join(process.cwd(), 'src/app/dashboard/bots/[id]/settings/page.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Extract the full handleDelete function body (up to the final closing brace)
    const deleteMatch = content.match(/async function handleDelete\(\)[\s\S]*?db\.bot\.delete[\s\S]*?redirect\('\/dashboard\/bots'\)/);
    expect(deleteMatch).not.toBeNull();

    const deleteBody = deleteMatch![0];

    // Must check ownership (findFirst with userId)
    expect(deleteBody).toMatch(/findFirst[\s\S]*userId[\s\S]*currentUser\.id/);

    // Ownership check must come before delete
    const findFirstIdx = deleteBody.indexOf('findFirst');
    const deleteIdx = deleteBody.indexOf('db.bot.delete');
    expect(findFirstIdx).toBeGreaterThan(0);
    expect(deleteIdx).toBeGreaterThan(0);
    expect(findFirstIdx).toBeLessThan(deleteIdx);
  });

  it('handleDelete should clean up media files from disk', () => {
    const filePath = path.join(process.cwd(), 'src/app/dashboard/bots/[id]/settings/page.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    const deleteMatch = content.match(/async function handleDelete\(\)[^}]*\{[\s\S]*?redirect\('\/dashboard\/bots'\)/);
    expect(deleteMatch).not.toBeNull();

    // Must reference file cleanup (rm, uploads, etc.)
    expect(deleteMatch![0]).toContain('uploads');
    expect(deleteMatch![0]).toMatch(/rm|unlink/);
  });
});

// ============================================================
// 2. CRITICAL: Account delete clears session + files
// ============================================================
describe('Account delete cleanup', () => {
  it('handleDeleteAccount should call signOut before deleting user', () => {
    const filePath = path.join(process.cwd(), 'src/app/dashboard/settings/page.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    const deleteMatch = content.match(/async function handleDeleteAccount\(\)[^}]*\{[\s\S]*?redirect\('\/'\)/);
    expect(deleteMatch).not.toBeNull();
    const body = deleteMatch![0];

    // Must call signOut
    expect(body).toContain('signOut');

    // signOut must come before user delete
    const signOutIdx = body.indexOf('signOut');
    const deleteIdx = body.indexOf('db.user.delete');
    expect(signOutIdx).toBeLessThan(deleteIdx);
  });

  it('handleDeleteAccount should clean up media files', () => {
    const filePath = path.join(process.cwd(), 'src/app/dashboard/settings/page.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    const deleteMatch = content.match(/async function handleDeleteAccount\(\)[^}]*\{[\s\S]*?redirect\('\/'\)/);
    expect(deleteMatch).not.toBeNull();

    expect(deleteMatch![0]).toContain('uploads');
    expect(deleteMatch![0]).toMatch(/rm|unlink/);
  });

  it('settings page should import signOut from auth', () => {
    const filePath = path.join(process.cwd(), 'src/app/dashboard/settings/page.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toMatch(/import.*signOut.*from.*auth/);
  });
});

// ============================================================
// 3. CRITICAL: Password change uses Zod validation
// ============================================================
describe('Password change Zod validation', () => {
  it('handleChangePassword should use passwordSchema for validation', () => {
    const filePath = path.join(process.cwd(), 'src/app/dashboard/settings/page.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Must import passwordSchema
    expect(content).toMatch(/import.*passwordSchema.*from.*validations/);

    // Must call safeParse
    const changeMatch = content.match(/async function handleChangePassword[\s\S]*?redirect\('\/dashboard\/settings\?success/);
    expect(changeMatch).not.toBeNull();
    expect(changeMatch![0]).toContain('passwordSchema.safeParse');
  });

  it('passwordSchema should enforce uppercase, lowercase, number, and common password check', () => {
    const { passwordSchema } = require('@/lib/validations');

    // Too short
    expect(passwordSchema.safeParse('Ab1').success).toBe(false);

    // No uppercase
    expect(passwordSchema.safeParse('abcdefg1').success).toBe(false);

    // No lowercase
    expect(passwordSchema.safeParse('ABCDEFG1').success).toBe(false);

    // No number
    expect(passwordSchema.safeParse('Abcdefgh').success).toBe(false);

    // Common password
    expect(passwordSchema.safeParse('Password123').success).toBe(false);

    // Valid password
    expect(passwordSchema.safeParse('MyStr0ngP@ss!').success).toBe(true);
  });
});

// ============================================================
// 4. HIGH: Sessions invalidated on password change
// ============================================================
describe('Session invalidation on password change', () => {
  it('handleChangePassword should delete all sessions after password update', () => {
    const filePath = path.join(process.cwd(), 'src/app/dashboard/settings/page.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    const changeMatch = content.match(/async function handleChangePassword[\s\S]*?redirect\('\/dashboard\/settings\?success/);
    expect(changeMatch).not.toBeNull();
    const body = changeMatch![0];

    // Must delete all sessions
    expect(body).toMatch(/session\.deleteMany/);

    // Must create new session after invalidation
    expect(body).toContain('createSession');
  });
});

// ============================================================
// 5. HIGH: SSRF protection on RSS feeds
// ============================================================
describe('SSRF protection in RSS feeds', () => {
  it('rss-intelligence.ts should contain private IP blocking logic', () => {
    const filePath = path.join(process.cwd(), 'src/lib/rss-intelligence.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Must have isPrivateUrl function or equivalent
    expect(content).toMatch(/isPrivateUrl|privateIp|ssrf|internal/i);

    // Must block localhost
    expect(content).toContain('localhost');

    // Must block 10.x.x.x range
    expect(content).toMatch(/10\b/);

    // Must block 169.254.x.x (cloud metadata)
    expect(content).toContain('169');
    expect(content).toContain('254');

    // Must block 192.168.x.x
    expect(content).toContain('192');
  });

  it('fetchRssFeed should check URLs before fetching', () => {
    const filePath = path.join(process.cwd(), 'src/lib/rss-intelligence.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    // The private URL check must come before the fetch call
    const funcBody = content.slice(content.indexOf('export async function fetchRssFeed'));
    const checkIdx = funcBody.indexOf('isPrivateUrl');
    const fetchIdx = funcBody.indexOf('fetch(feedUrl');
    expect(checkIdx).toBeGreaterThan(0);
    expect(checkIdx).toBeLessThan(fetchIdx);
  });

  it('isPrivateUrl should block known private ranges', () => {
    // Test the logic by reading the function
    const filePath = path.join(process.cwd(), 'src/lib/rss-intelligence.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Must block 172.16-31.x.x
    expect(content).toContain('172');
    expect(content).toMatch(/16.*31|octets\[1\]\s*>=\s*16/);

    // Must block 127.x.x.x
    expect(content).toContain('127');

    // Must block ::1
    expect(content).toContain('::1');
  });
});

// ============================================================
// 6. HIGH: Admin bots page pagination
// ============================================================
describe('Admin bots page pagination', () => {
  it('should use skip/take for bounded queries', () => {
    const filePath = path.join(process.cwd(), 'src/app/admin/bots/page.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    expect(content).toContain('skip:');
    expect(content).toContain('take:');
    expect(content).toMatch(/PAGE_SIZE\s*=\s*\d+/);
  });

  it('should have pagination UI', () => {
    const filePath = path.join(process.cwd(), 'src/app/admin/bots/page.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    expect(content).toContain('totalPages');
    expect(content).toContain('Previous');
    expect(content).toContain('Next');
  });

  it('should count total bots for pagination', () => {
    const filePath = path.join(process.cwd(), 'src/app/admin/bots/page.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    expect(content).toMatch(/db\.bot\.count/);
  });
});

// ============================================================
// 7. HIGH: Generate plan concurrency guard
// ============================================================
describe('Generate plan concurrency guard', () => {
  it('should check lastPlanGeneratedAt before creating new plan', () => {
    const filePath = path.join(process.cwd(), 'src/app/api/autonomous/generate-plan/route.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    expect(content).toContain('lastPlanGeneratedAt');
    expect(content).toMatch(/RATE_LIMITED|429/);
  });

  it('should set lastPlanGeneratedAt as optimistic lock', () => {
    const filePath = path.join(process.cwd(), 'src/app/api/autonomous/generate-plan/route.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Should update lastPlanGeneratedAt before generating
    const guardMatch = content.match(/lastPlanGeneratedAt[\s\S]*?Determine duration/);
    expect(guardMatch).not.toBeNull();
    expect(guardMatch![0]).toContain('db.bot.update');
  });
});

// ============================================================
// 8. HIGH: Orphan media file cleanup on dimension check failure
// ============================================================
describe('Media file cleanup on validation failure', () => {
  it('should import unlink from fs/promises', () => {
    const filePath = path.join(process.cwd(), 'src/app/api/media/route.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    expect(content).toMatch(/import.*unlink.*from.*fs\/promises/);
  });

  it('should delete file when dimensions are too large', () => {
    const filePath = path.join(process.cwd(), 'src/app/api/media/route.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Find the dimension check block
    const dimBlock = content.match(/MAX_DIMENSION[\s\S]*?Invalid image dimensions/);
    expect(dimBlock).not.toBeNull();

    // Must call unlink before returning 400
    expect(dimBlock![0]).toMatch(/unlink\(filePath\)/);
  });
});

// ============================================================
// 9. MEDIUM: Rate limiting on public email form
// ============================================================
describe('Email form rate limiting', () => {
  it('should have rate limiter for form submissions', () => {
    const filePath = path.join(process.cwd(), 'src/app/api/email/forms/[formId]/route.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    expect(content).toMatch(/createRateLimiter|rateLimiter|rateLimit/);
    expect(content).toContain('429');
  });

  it('should not leak error details on public endpoints', () => {
    const filePath = path.join(process.cwd(), 'src/app/api/email/forms/[formId]/route.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Should NOT expose error.message in JSON responses to clients
    // (console.error logging with error.message is fine — it stays server-side)
    expect(content).not.toMatch(/NextResponse\.json\(\s*\{[^}]*error\.message/);

    // Should use generic error messages in responses
    expect(content).toContain('An error occurred');
  });
});

// ============================================================
// 10. MEDIUM: Scheduled posts PATCH validation
// ============================================================
describe('Scheduled posts PATCH validation', () => {
  it('should validate platforms array in PATCH', () => {
    const filePath = path.join(process.cwd(), 'src/app/api/scheduled-posts/[id]/route.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    expect(content).toContain('ALL_PLATFORMS');
    expect(content).toMatch(/Invalid platforms/);
  });

  it('should validate content length in PATCH', () => {
    const filePath = path.join(process.cwd(), 'src/app/api/scheduled-posts/[id]/route.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    expect(content).toMatch(/10.?000|10000/);
  });
});
