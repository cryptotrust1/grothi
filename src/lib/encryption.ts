import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be a 64-character hex string');
  }
  if (!/^[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error('ENCRYPTION_KEY must contain only valid hex characters (0-9, a-f)');
  }
  return Buffer.from(key, 'hex');
}

export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decrypt(encryptedData: string): string {
  const key = getEncryptionKey();
  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format (expected iv:authTag:ciphertext)');
  }
  const [ivHex, authTagHex, encrypted] = parts;

  // Validate IV and authTag are valid hex of correct length
  if (!/^[0-9a-fA-F]{32}$/.test(ivHex)) {
    throw new Error('Invalid encrypted data: IV must be 32 hex characters (16 bytes)');
  }
  if (!/^[0-9a-fA-F]{32}$/.test(authTagHex)) {
    throw new Error('Invalid encrypted data: auth tag must be 32 hex characters (16 bytes)');
  }
  if (encrypted.length > 0 && !/^[0-9a-fA-F]+$/.test(encrypted)) {
    throw new Error('Invalid encrypted data: ciphertext must be hex-encoded');
  }

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

export function maskApiKey(key: string): string {
  if (key.length <= 8) return '****';
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}
