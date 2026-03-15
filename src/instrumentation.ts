/**
 * Next.js instrumentation hook — runs once at server startup.
 * Used for fail-fast environment validation.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { validateRequiredEnv } = await import('./lib/env-validation');
    validateRequiredEnv();
  }
}
