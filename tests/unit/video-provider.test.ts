// Tests for video provider abstraction layer
// Tests the provider selection logic and API key resolution

// Mock Prisma before importing
const mockFindUnique = jest.fn();
jest.mock('@/lib/db', () => ({
  db: {
    systemSetting: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      upsert: jest.fn(),
    },
  },
}));

import { getActiveVideoProvider, getProviderApiKey } from '@/lib/video-provider';

describe('Video Provider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.REPLICATE_API_TOKEN;
    delete process.env.RUNWAYML_API_SECRET;
  });

  describe('getActiveVideoProvider()', () => {
    it('should default to replicate when no setting exists', async () => {
      mockFindUnique.mockResolvedValue(null);
      const provider = await getActiveVideoProvider();
      expect(provider).toBe('replicate');
    });

    it('should return runway when setting is runway', async () => {
      mockFindUnique.mockResolvedValue({ key: 'video_provider', value: 'runway' });
      const provider = await getActiveVideoProvider();
      expect(provider).toBe('runway');
    });

    it('should return replicate for unknown setting values', async () => {
      mockFindUnique.mockResolvedValue({ key: 'video_provider', value: 'unknown' });
      const provider = await getActiveVideoProvider();
      expect(provider).toBe('replicate');
    });
  });

  describe('getProviderApiKey()', () => {
    it('should return env token for replicate when DB has no key', async () => {
      mockFindUnique.mockResolvedValue(null);
      process.env.REPLICATE_API_TOKEN = 'r8_test123';
      const key = await getProviderApiKey('replicate');
      expect(key).toBe('r8_test123');
    });

    it('should prefer DB key over env for replicate', async () => {
      mockFindUnique.mockResolvedValue({ key: 'replicate_api_token', value: 'r8_from_db' });
      process.env.REPLICATE_API_TOKEN = 'r8_from_env';
      const key = await getProviderApiKey('replicate');
      expect(key).toBe('r8_from_db');
    });

    it('should return null when no key is configured for replicate', async () => {
      mockFindUnique.mockResolvedValue(null);
      const key = await getProviderApiKey('replicate');
      expect(key).toBeNull();
    });

    it('should return env token for runway when DB has no key', async () => {
      mockFindUnique.mockResolvedValue(null);
      process.env.RUNWAYML_API_SECRET = 'runway_test123';
      const key = await getProviderApiKey('runway');
      expect(key).toBe('runway_test123');
    });

    it('should return null for unknown provider', async () => {
      const key = await getProviderApiKey('unknown' as any);
      expect(key).toBeNull();
    });
  });
});
