import { encrypt, decrypt, maskApiKey } from '@/lib/encryption';

// Set a test encryption key (64 hex characters = 32 bytes)
const TEST_KEY = 'a'.repeat(64);

beforeAll(() => {
  process.env.ENCRYPTION_KEY = TEST_KEY;
});

afterAll(() => {
  delete process.env.ENCRYPTION_KEY;
});

describe('Encryption', () => {
  describe('encrypt/decrypt', () => {
    it('encrypts and decrypts a simple string', () => {
      const plaintext = 'hello world';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('encrypted format contains three colon-separated parts', () => {
      const encrypted = encrypt('test');
      const parts = encrypted.split(':');
      expect(parts).toHaveLength(3);
      // IV (32 hex chars = 16 bytes), authTag (32 hex chars), ciphertext
      expect(parts[0]).toHaveLength(32);
      expect(parts[1]).toHaveLength(32);
      expect(parts[2].length).toBeGreaterThan(0);
    });

    it('produces different ciphertexts for the same input', () => {
      const text = 'same input';
      const enc1 = encrypt(text);
      const enc2 = encrypt(text);
      // Due to random IV, ciphertexts should differ
      expect(enc1).not.toBe(enc2);
      // But both should decrypt to the same value
      expect(decrypt(enc1)).toBe(text);
      expect(decrypt(enc2)).toBe(text);
    });

    it('handles empty string', () => {
      const encrypted = encrypt('');
      expect(decrypt(encrypted)).toBe('');
    });

    it('handles special characters', () => {
      const special = 'API_KEY=abc123!@#$%^&*()_+=<>?,./';
      const encrypted = encrypt(special);
      expect(decrypt(encrypted)).toBe(special);
    });

    it('handles Unicode characters', () => {
      const unicode = 'Ahoj svete! Dobrý deň 🤖';
      const encrypted = encrypt(unicode);
      expect(decrypt(encrypted)).toBe(unicode);
    });

    it('handles long strings', () => {
      const longText = 'x'.repeat(10000);
      const encrypted = encrypt(longText);
      expect(decrypt(encrypted)).toBe(longText);
    });

    it('throws on tampered ciphertext', () => {
      const encrypted = encrypt('secret');
      const parts = encrypted.split(':');
      // Tamper with the ciphertext
      parts[2] = parts[2].slice(0, -2) + 'ff';
      expect(() => decrypt(parts.join(':'))).toThrow();
    });

    it('throws on tampered auth tag', () => {
      const encrypted = encrypt('secret');
      const parts = encrypted.split(':');
      parts[1] = '0'.repeat(32);
      expect(() => decrypt(parts.join(':'))).toThrow();
    });
  });

  describe('maskApiKey', () => {
    it('masks a normal API key', () => {
      expect(maskApiKey('sk_live_abcdefghijklmnop')).toBe('sk_l...mnop');
    });

    it('masks short keys completely', () => {
      expect(maskApiKey('short')).toBe('****');
    });

    it('masks very short keys', () => {
      expect(maskApiKey('ab')).toBe('****');
    });

    it('masks keys with exactly 8 characters', () => {
      expect(maskApiKey('12345678')).toBe('****');
    });

    it('masks keys with 9 characters', () => {
      expect(maskApiKey('123456789')).toBe('1234...6789');
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
