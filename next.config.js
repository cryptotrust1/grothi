/** @type {import('next').NextConfig} */
const nextConfig = {
  // Support building to a temp directory for zero-downtime deploys
  distDir: process.env.NEXT_BUILD_DIR || '.next',
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '55mb',
    },
  },
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  async headers() {
    // Content-Security-Policy notes:
    // - 'unsafe-inline' on script-src is required for JSON-LD structured data and inline GA4 init
    // - 'unsafe-inline' on style-src is required for Tailwind/shadcn runtime styles
    // - object-src 'none' blocks all plugin/Flash exploitation vectors
    // - base-uri 'self' prevents <base> tag injection attacks
    // - frame-ancestors 'none' redundantly mirrors X-Frame-Options (belt-and-suspenders)
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://js.stripe.com https://www.googletagmanager.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https:",
      "media-src 'self' blob:",
      "connect-src 'self' https://api.stripe.com https://www.google-analytics.com https://region1.google-analytics.com",
      "frame-src https://js.stripe.com https://hooks.stripe.com",
      "object-src 'none'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
    ].join('; ');

    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: 'Permissions-Policy', value: 'geolocation=(), microphone=(), camera=(), payment=()' },
        ],
      },
      // Static assets: cache forever (hashed filenames = immutable)
      {
        source: '/_next/static/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      // Dashboard pages: never cache (always fresh after deploy)
      {
        source: '/dashboard/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
        ],
      },
      // Auth pages: never cache
      {
        source: '/auth/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
        ],
      },
      // API routes: never cache
      {
        source: '/api/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
        ],
      },
      // Public pages: short cache to prevent stale HTML after deploy
      {
        source: '/:path((?!_next|dashboard|auth|api|admin).*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=300, s-maxage=300, stale-while-revalidate=60' },
        ],
      },
      // Admin pages: never cache
      {
        source: '/admin/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
