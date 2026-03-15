/**
 * Startup environment variable validation.
 * Call validateRequiredEnv() early in the app lifecycle to fail fast
 * instead of crashing at random points when env vars are accessed.
 */

const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'NEXTAUTH_SECRET',
  'ENCRYPTION_KEY',
] as const;

const OPTIONAL_BUT_IMPORTANT = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'ANTHROPIC_API_KEY',
  'CRON_SECRET',
] as const;

export function validateRequiredEnv(): void {
  const missing: string[] = [];

  for (const key of REQUIRED_ENV_VARS) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
      `The application cannot start without these. Check your .env file.`
    );
  }

  // Validate ENCRYPTION_KEY format (must be 64 hex chars)
  const encKey = process.env.ENCRYPTION_KEY!;
  if (encKey.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(encKey)) {
    throw new Error('ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)');
  }

  // Warn about missing optional vars
  const warnings: string[] = [];
  for (const key of OPTIONAL_BUT_IMPORTANT) {
    if (!process.env[key]) {
      warnings.push(key);
    }
  }

  if (warnings.length > 0) {
    console.warn(
      `[env] Warning: Optional env vars not set: ${warnings.join(', ')}. ` +
      `Some features will be disabled.`
    );
  }
}
