import { PLATFORM_IMAGE_SPECS, OPTIMAL_POSTING_TIMES } from '@/lib/platform-specs';
import { ALL_PLATFORMS } from '@/lib/constants';

describe('Platform Image Specs', () => {
  it('defines specs for major platforms', () => {
    const expectedPlatforms = [
      'FACEBOOK', 'INSTAGRAM', 'TWITTER', 'LINKEDIN', 'TIKTOK',
      'PINTEREST', 'YOUTUBE', 'MASTODON', 'BLUESKY', 'TELEGRAM',
      'THREADS', 'DISCORD', 'REDDIT', 'MEDIUM', 'DEVTO',
    ];
    for (const platform of expectedPlatforms) {
      expect(PLATFORM_IMAGE_SPECS[platform]).toBeDefined();
    }
  });

  it('each platform has a name', () => {
    for (const [key, spec] of Object.entries(PLATFORM_IMAGE_SPECS)) {
      expect(spec.name).toBeTruthy();
      expect(typeof spec.name).toBe('string');
    }
  });

  it('each platform has at least one format', () => {
    for (const [key, spec] of Object.entries(PLATFORM_IMAGE_SPECS)) {
      expect(spec.formats.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('each format has valid dimensions', () => {
    for (const [key, spec] of Object.entries(PLATFORM_IMAGE_SPECS)) {
      for (const format of spec.formats) {
        expect(format.width).toBeGreaterThan(0);
        expect(format.height).toBeGreaterThan(0);
        expect(format.aspect).toBeTruthy();
        expect(format.label).toBeTruthy();
        expect(format.use).toBeTruthy();
      }
    }
  });

  it('each platform has supported formats', () => {
    for (const spec of Object.values(PLATFORM_IMAGE_SPECS)) {
      expect(spec.supportedFormats.length).toBeGreaterThanOrEqual(1);
      for (const format of spec.supportedFormats) {
        expect(['JPEG', 'PNG', 'GIF', 'WebP']).toContain(format);
      }
    }
  });

  it('each platform has a max file size', () => {
    for (const spec of Object.values(PLATFORM_IMAGE_SPECS)) {
      expect(spec.maxFileSize).toMatch(/^\d+MB$/);
    }
  });
});

describe('Optimal Posting Times', () => {
  it('defines times for major platforms', () => {
    const expectedPlatforms = [
      'FACEBOOK', 'INSTAGRAM', 'TWITTER', 'LINKEDIN', 'TIKTOK',
      'MASTODON', 'BLUESKY', 'TELEGRAM',
    ];
    for (const platform of expectedPlatforms) {
      expect(OPTIMAL_POSTING_TIMES[platform]).toBeDefined();
    }
  });

  it('each platform has weekday and weekend arrays', () => {
    for (const [key, times] of Object.entries(OPTIMAL_POSTING_TIMES)) {
      expect(Array.isArray(times.weekday)).toBe(true);
      expect(Array.isArray(times.weekend)).toBe(true);
    }
  });

  it('hours are within valid range (0-23)', () => {
    for (const [key, times] of Object.entries(OPTIMAL_POSTING_TIMES)) {
      for (const hour of [...times.weekday, ...times.weekend]) {
        expect(hour).toBeGreaterThanOrEqual(0);
        expect(hour).toBeLessThanOrEqual(23);
      }
    }
  });

  it('weekday hours are sorted ascending', () => {
    for (const [key, times] of Object.entries(OPTIMAL_POSTING_TIMES)) {
      for (let i = 1; i < times.weekday.length; i++) {
        expect(times.weekday[i]).toBeGreaterThan(times.weekday[i - 1]);
      }
    }
  });
});
