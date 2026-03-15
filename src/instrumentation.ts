/**
 * Next.js instrumentation hook — runs once at server startup.
 * Used for fail-fast environment validation and directory checks.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { validateRequiredEnv } = await import('./lib/env-validation');
    validateRequiredEnv();

    // Ensure media upload directory exists
    const path = await import('path');
    const fs = await import('fs');
    const uploadDir = path.join(process.cwd(), 'data', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
      console.log(`[startup] Created media upload directory: ${uploadDir}`);
    }
  }
}
