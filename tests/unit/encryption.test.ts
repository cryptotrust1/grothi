/**
 * Encryption Security Tests
 * AES-256-GCM encryption validation
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { encrypt, decrypt, maskApiKey } from '@/lib/encryption';

// Set a test encryption key (64 hex characters = 32 bytes)
const TEST_KEY = 'a'.repeat(64);

beforeAll(() => {
  process.env.ENCRYPTION_KEY = TEST_KEY;
});

describe('Encryption System', () => {
  describe('AES-256-GCM Encryption', () => {
    it('should encrypt and decrypt data correctly', () => {
      const plaintext = 'sensitive-api-key-12345';
      
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });

    it('should produce different ciphertexts for same plaintext (IV randomization)', () => {
      const plaintext = 'test-data';
      
      const encrypted1 = encrypt(plaintext);
      const encrypted2 = encrypt(plaintext);
      
      expect(encrypted1).not.toBe(encrypted2);
      
      // Both should decrypt to same value
      expect(decrypt(encrypted1)).toBe(plaintext);
      expect(decrypt(encrypted2)).toBe(plaintext);
    });

    it('should handle empty string', () => {
      const plaintext = '';
      
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });

    it('should handle unicode characters', () => {
      const plaintext = '日本語テキスト 🎉 ñoño';
      
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });

    it('should handle very long strings', () => {
      const plaintext = 'a'.repeat(10000);
      
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });

    it('should fail to decrypt tampered ciphertext', () => {
      const plaintext = 'test-data';
      const encrypted = encrypt(plaintext);
      
      // Tamper with the encrypted data
      const parts = encrypted.split(':');
      parts[2] = parts[2].slice(0, -2) + 'ff'; // Modify last bytes
      const tampered = parts.join(':');
      
      expect(() => decrypt(tampered)).toThrow();
    });

    it('should fail to decrypt with wrong format', () => {
      expect(() => decrypt('invalid-format')).toThrow();
      expect(() => decrypt('a:b')).toThrow(); // Only 2 parts
    });

    it('should produce ciphertext in correct format (iv:authTag:encrypted)', () => {
      const plaintext = 'test';
      const encrypted = encrypt(plaintext);
      
      const parts = encrypted.split(':');
      expect(parts).toHaveLength(3);
      
      // IV should be 32 hex chars (16 bytes)
      expect(parts[0]).toHaveLength(32);
      // Auth tag should be 32 hex chars (16 bytes)
      expect(parts[1]).toHaveLength(32);
      // Encrypted data should be hex
      expect(parts[2]).toMatch(/^[0-9a-f]+$/);
    });
  });

  describe('API Key Masking', () => {
    it('should mask middle of long API keys', () => {
      const key = 'test_key_abcdefghijklmnopqrstuvwxyz123';
      const masked = maskApiKey(key);
      
      // Funkcia vracia prvé 4 znaky + ... + posledné 4 znaky
      expect(masked).toBe('test...z123');
      expect(masked).not.toContain('bcdefghijklmnopqrstuv');
    });

    it('should handle short keys (<= 8 chars)', () => {
      expect(maskApiKey('abc')).toBe('****');
      expect(maskApiKey('abcdefgh')).toBe('****');
    });

    it('should handle very short keys', () => {
      expect(maskApiKey('ab')).toBe('****');
      expect(maskApiKey('a')).toBe('****');
      expect(maskApiKey('')).toBe('****');
    });

    it('should show first and last 4 chars for normal keys (> 8 chars)', () => {
      const key = '1234567890abcdef';
      const masked = maskApiKey(key);
      
      expect(masked).toBe('1234...cdef');
      expect(masked).toContain('...');
    });
  });
});

describe('Encryption key validation', () => {
  it('throws if ENCRYPTION_KEY is missing', () => {
    const savedKey = process.env.ENCRYPTION_KEY;
    delete process.env.ENCRYPTION_KEY;
    expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY must be a 64-character hex string');
    process.env.ENCRYPTION_KEY = savedKey;
  });

  it('throws if ENCRYPTION_KEY is wrong length', () => {
    const savedKey = process.env.ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY = 'tooshort';
    expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY must be a 64-character hex string');
    process.env.ENCRYPTION_KEY = savedKey;
  });
});
