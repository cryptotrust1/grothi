/** @type {import('next').NextConfig} */
const nextConfig = {
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
    return [
      {
        source: '/(.*)',
        headers: [
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
