/**
 * Production Audit Round 3 — Regression tests for fixes applied during audit.
 */

import { describe, it, expect, beforeAll } from '@jest/globals';

// Set up test encryption key
beforeAll(() => {
  process.env.ENCRYPTION_KEY = 'a'.repeat(64);
  process.env.NEXTAUTH_SECRET = 'test-secret-for-oauth';
});

describe('Encryption format validation', () => {
  it('should reject encrypted data with fewer than 3 parts', () => {
    const { decrypt } = require('@/lib/encryption');
    expect(() => decrypt('onlyonepart')).toThrow('Invalid encrypted data format');
    expect(() => decrypt('two:parts')).toThrow('Invalid encrypted data format');
  });

  it('should reject encrypted data with more than 3 parts', () => {
    const { decrypt } = require('@/lib/encryption');
    // 4 parts should fail (format expects exactly iv:authTag:ciphertext)
    expect(() => decrypt('a:b:c:d')).toThrow('Invalid encrypted data format');
  });

  it('should still decrypt valid data correctly', () => {
    const { encrypt, decrypt } = require('@/lib/encryption');
    const original = 'test-api-key-123';
    const encrypted = encrypt(original);
    expect(decrypt(encrypted)).toBe(original);
  });
});

describe('OAuth helpers env validation', () => {
  it('should throw if NEXTAUTH_SECRET is missing', () => {
    const savedSecret = process.env.NEXTAUTH_SECRET;
    delete process.env.NEXTAUTH_SECRET;

    // Clear module cache to force re-evaluation
    jest.resetModules();
    const { createOAuthStateToken } = require('@/lib/oauth-helpers');

    expect(createOAuthStateToken('bot1', 'user1')).rejects.toThrow('NEXTAUTH_SECRET');
    process.env.NEXTAUTH_SECRET = savedSecret;
  });
});

describe('Env validation utility', () => {
  it('should pass when all required env vars are set', () => {
    const savedDbUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

    jest.resetModules();
    const { validateRequiredEnv } = require('@/lib/env-validation');
    expect(() => validateRequiredEnv()).not.toThrow();

    if (savedDbUrl) {
      process.env.DATABASE_URL = savedDbUrl;
    } else {
      delete process.env.DATABASE_URL;
    }
  });

  it('should throw when ENCRYPTION_KEY is missing', () => {
    const savedKey = process.env.ENCRYPTION_KEY;
    const savedDbUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    delete process.env.ENCRYPTION_KEY;

    jest.resetModules();
    const { validateRequiredEnv } = require('@/lib/env-validation');
    expect(() => validateRequiredEnv()).toThrow('Missing required environment variables');

    process.env.ENCRYPTION_KEY = savedKey;
    if (savedDbUrl) {
      process.env.DATABASE_URL = savedDbUrl;
    } else {
      delete process.env.DATABASE_URL;
    }
  });

  it('should throw when ENCRYPTION_KEY has wrong format', () => {
    const savedKey = process.env.ENCRYPTION_KEY;
    const savedDbUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.ENCRYPTION_KEY = 'not-hex-and-too-short';

    jest.resetModules();
    const { validateRequiredEnv } = require('@/lib/env-validation');
    expect(() => validateRequiredEnv()).toThrow('ENCRYPTION_KEY must be exactly 64 hex characters');

    process.env.ENCRYPTION_KEY = savedKey;
    if (savedDbUrl) {
      process.env.DATABASE_URL = savedDbUrl;
    } else {
      delete process.env.DATABASE_URL;
    }
  });
});
