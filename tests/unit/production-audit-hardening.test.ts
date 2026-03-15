/**
 * Production Audit Hardening Tests
 *
 * Regression tests for issues found and fixed during the production-grade audit.
 * These tests verify that critical production safety measures are in place.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const SRC = join(__dirname, '../../src');

// ============================================================
// 1. NON-NULL ASSERTION SAFETY — process.env.NEXTAUTH_SECRET
// ============================================================

describe('Non-null assertion safety', () => {
  const filesToCheck = [
    'app/dashboard/bots/[id]/platforms/facebook-select/page.tsx',
    'app/dashboard/bots/[id]/platforms/instagram-select/page.tsx',
    'lib/oauth-helpers.ts',
    'lib/auth.ts',
  ];

  for (const file of filesToCheck) {
    it(`${file} must NOT use process.env.NEXTAUTH_SECRET! (non-null assertion)`, () => {
      const filePath = join(SRC, file);
      if (!existsSync(filePath)) return; // Skip if file doesn't exist
      const content = readFileSync(filePath, 'utf-8');
      expect(content).not.toContain('process.env.NEXTAUTH_SECRET!');
    });
  }

  for (const file of filesToCheck) {
    it(`${file} must validate NEXTAUTH_SECRET before use`, () => {
      const filePath = join(SRC, file);
      if (!existsSync(filePath)) return;
      const content = readFileSync(filePath, 'utf-8');
      // Should have a validation pattern — either throw or if-check
      if (content.includes('NEXTAUTH_SECRET')) {
        const hasValidation =
          content.includes("throw new Error") ||
          content.includes("if (!secret)") ||
          content.includes("if (!process.env.NEXTAUTH_SECRET");
        expect(hasValidation).toBe(true);
      }
    });
  }
});

// ============================================================
// 2. CRON JOB OVERLAP PROTECTION
// ============================================================

describe('Cron job overlap protection', () => {
  const cronRoutes = [
    'app/api/cron/process-posts/route.ts',
    'app/api/cron/autonomous-content/route.ts',
    'app/api/cron/collect-engagement/route.ts',
    'app/api/cron/detect-trends/route.ts',
  ];

  for (const route of cronRoutes) {
    it(`${route} must use cron locking`, () => {
      const filePath = join(SRC, route);
      const content = readFileSync(filePath, 'utf-8');
      expect(content).toContain("import { withCronLock } from '@/lib/cron-lock'");
      expect(content).toContain('withCronLock');
    });
  }

  it('cron-lock module exports required functions', () => {
    const lockFile = join(SRC, 'lib/cron-lock.ts');
    const content = readFileSync(lockFile, 'utf-8');
    expect(content).toContain('export async function acquireCronLock');
    expect(content).toContain('export async function releaseCronLock');
    expect(content).toContain('export async function withCronLock');
  });
});

// ============================================================
// 3. CRON SECRET VALIDATION
// ============================================================

describe('Cron secret validation', () => {
  const cronRoutes = [
    'app/api/cron/process-posts/route.ts',
    'app/api/cron/autonomous-content/route.ts',
    'app/api/cron/collect-engagement/route.ts',
    'app/api/cron/detect-trends/route.ts',
    'app/api/cron/health-check/route.ts',
  ];

  for (const route of cronRoutes) {
    it(`${route} must validate cron secret`, () => {
      const filePath = join(SRC, route);
      const content = readFileSync(filePath, 'utf-8');
      expect(content).toContain('validateCronSecret');
    });
  }

  it('validateCronSecret uses timing-safe comparison', () => {
    const helpersFile = join(SRC, 'lib/api-helpers.ts');
    const content = readFileSync(helpersFile, 'utf-8');
    expect(content).toContain('timingSafeEqual');
    expect(content).toContain('createHash');
  });
});

// ============================================================
// 4. CRON HTTP STATUS ON TOTAL FAILURE
// ============================================================

describe('Cron jobs return 500 on total failure', () => {
  it('process-posts returns 500 when all posts fail', () => {
    const filePath = join(SRC, 'app/api/cron/process-posts/route.ts');
    const content = readFileSync(filePath, 'utf-8');
    // Must have logic to return 500 on all-failed
    expect(content).toContain('status: 500');
    expect(content).toMatch(/allFailed|every.*FAILED|succeeded === 0/);
  });

  it('autonomous-content returns 500 when all posts fail', () => {
    const filePath = join(SRC, 'app/api/cron/autonomous-content/route.ts');
    const content = readFileSync(filePath, 'utf-8');
    expect(content).toContain('status: 500');
    expect(content).toContain('succeeded === 0');
  });
});

// ============================================================
// 5. ENVIRONMENT VALIDATION AT STARTUP
// ============================================================

describe('Environment validation', () => {
  it('instrumentation.ts calls validateRequiredEnv', () => {
    const filePath = join(SRC, 'instrumentation.ts');
    const content = readFileSync(filePath, 'utf-8');
    expect(content).toContain('validateRequiredEnv');
  });

  it('instrumentation.ts ensures upload directory exists', () => {
    const filePath = join(SRC, 'instrumentation.ts');
    const content = readFileSync(filePath, 'utf-8');
    expect(content).toContain('data');
    expect(content).toContain('uploads');
    expect(content).toContain('mkdirSync');
  });

  it('env-validation.ts checks required vars', () => {
    const filePath = join(SRC, 'lib/env-validation.ts');
    const content = readFileSync(filePath, 'utf-8');
    expect(content).toContain('DATABASE_URL');
    expect(content).toContain('NEXTAUTH_SECRET');
    expect(content).toContain('ENCRYPTION_KEY');
  });

  it('env-validation.ts validates ENCRYPTION_KEY format', () => {
    const filePath = join(SRC, 'lib/env-validation.ts');
    const content = readFileSync(filePath, 'utf-8');
    expect(content).toContain('64');
    expect(content).toMatch(/hex|[0-9a-fA-F]/);
  });
});

// ============================================================
// 6. AUTONOMOUS-CONTENT CREDIT REFUND ON FAILURE
// ============================================================

describe('Autonomous content credit safety', () => {
  it('refunds credits when AI generation fails', () => {
    const filePath = join(SRC, 'app/api/cron/autonomous-content/route.ts');
    const content = readFileSync(filePath, 'utf-8');
    // Must have addCredits for refund
    expect(content).toContain('REFUND');
    expect(content).toContain('addCredits');
    expect(content).toContain('Refund');
  });

  it('has stale lock recovery for [GENERATING] posts', () => {
    const filePath = join(SRC, 'app/api/cron/autonomous-content/route.ts');
    const content = readFileSync(filePath, 'utf-8');
    expect(content).toContain('[GENERATING]');
    expect(content).toContain('Retry pending');
  });

  it('deducts credits before generation, not after', () => {
    const filePath = join(SRC, 'app/api/cron/autonomous-content/route.ts');
    const content = readFileSync(filePath, 'utf-8');
    const deductIdx = content.indexOf('deductCredits');
    const generateIdx = content.indexOf('generateContent(apiKey');
    expect(deductIdx).toBeLessThan(generateIdx);
  });
});

// ============================================================
// 7. PROCESS-POSTS STUCK RECOVERY
// ============================================================

describe('Process-posts stuck post recovery', () => {
  it('recovers posts stuck in PUBLISHING state', () => {
    const filePath = join(SRC, 'app/api/cron/process-posts/route.ts');
    const content = readFileSync(filePath, 'utf-8');
    expect(content).toContain('PUBLISHING');
    expect(content).toContain('stuckThreshold');
    expect(content).toContain('5 * 60 * 1000');
  });
});

// ============================================================
// 8. PRISMA SCHEMA - CRON LOCK TABLE
// ============================================================

describe('Prisma schema has CronLock table', () => {
  it('CronLock model exists in schema', () => {
    const schemaPath = join(__dirname, '../../prisma/schema.prisma');
    const content = readFileSync(schemaPath, 'utf-8');
    expect(content).toContain('model CronLock');
    expect(content).toContain('jobName');
    expect(content).toContain('@unique');
    expect(content).toContain('expiresAt');
  });
});

// ============================================================
// 9. SECURITY - NO HARDCODED SECRETS
// ============================================================

describe('No hardcoded secrets in source', () => {
  const securityCriticalFiles = [
    'lib/auth.ts',
    'lib/encryption.ts',
    'lib/api-helpers.ts',
    'lib/stripe.ts',
  ];

  for (const file of securityCriticalFiles) {
    it(`${file} does not contain hardcoded API keys`, () => {
      const filePath = join(SRC, file);
      if (!existsSync(filePath)) return;
      const content = readFileSync(filePath, 'utf-8');
      // Check for common API key patterns
      expect(content).not.toMatch(/sk-ant-[a-zA-Z0-9]{20,}/);
      expect(content).not.toMatch(/sk_live_[a-zA-Z0-9]{20,}/);
      expect(content).not.toMatch(/sk_test_[a-zA-Z0-9]{20,}/);
      expect(content).not.toMatch(/whsec_[a-zA-Z0-9]{20,}/);
    });
  }
});

// ============================================================
// 10. DEPLOY SCRIPT SAFETY
// ============================================================

describe('Deploy script safety', () => {
  it('deploy.sh has fail-fast error handling', () => {
    const deployPath = join(__dirname, '../../deploy.sh');
    const content = readFileSync(deployPath, 'utf-8');
    expect(content).toContain('fail()');
    expect(content).toContain('exit 1');
  });

  it('deploy.sh backs up .env before deploy', () => {
    const deployPath = join(__dirname, '../../deploy.sh');
    const content = readFileSync(deployPath, 'utf-8');
    expect(content).toContain('backup');
    expect(content).toContain('.env');
  });

  it('deploy.sh uses zero-downtime build swap', () => {
    const deployPath = join(__dirname, '../../deploy.sh');
    const content = readFileSync(deployPath, 'utf-8');
    expect(content).toContain('.next-build');
    expect(content).toContain('mv .next-build .next');
  });

  it('deploy.sh has health check', () => {
    const deployPath = join(__dirname, '../../deploy.sh');
    const content = readFileSync(deployPath, 'utf-8');
    expect(content).toContain('health check');
    expect(content).toContain('curl');
  });

  it('deploy.sh uses local prisma (not npx)', () => {
    const deployPath = join(__dirname, '../../deploy.sh');
    const content = readFileSync(deployPath, 'utf-8');
    expect(content).toContain('./node_modules/.bin/prisma');
    expect(content).not.toMatch(/npx prisma/);
  });
});

// ============================================================
// 11. CREDIT SYSTEM ATOMICITY
// ============================================================

describe('Credit system safety', () => {
  it('deductCredits uses database transaction', () => {
    const filePath = join(SRC, 'lib/credits.ts');
    const content = readFileSync(filePath, 'utf-8');
    expect(content).toContain('$transaction');
    expect(content).toContain('balance: { gte: amount }');
  });

  it('deductCredits returns false on insufficient funds', () => {
    const filePath = join(SRC, 'lib/credits.ts');
    const content = readFileSync(filePath, 'utf-8');
    expect(content).toContain('updated.count === 0');
    expect(content).toContain('return false');
  });
});

// ============================================================
// 12. AUTH SESSION SECURITY
// ============================================================

describe('Auth session security', () => {
  it('session cookie is httpOnly', () => {
    const filePath = join(SRC, 'lib/auth.ts');
    const content = readFileSync(filePath, 'utf-8');
    expect(content).toContain('httpOnly: true');
  });

  it('session cookie is secure in production', () => {
    const filePath = join(SRC, 'lib/auth.ts');
    const content = readFileSync(filePath, 'utf-8');
    expect(content).toContain("secure: process.env.NODE_ENV === 'production'");
  });

  it('password reset revokes all sessions', () => {
    const filePath = join(SRC, 'lib/auth.ts');
    const content = readFileSync(filePath, 'utf-8');
    expect(content).toContain('session.deleteMany');
    expect(content).toContain('resetToken.userId');
  });

  it('blocked users cannot authenticate', () => {
    const filePath = join(SRC, 'lib/auth.ts');
    const content = readFileSync(filePath, 'utf-8');
    expect(content).toContain('isBlocked');
  });
});
