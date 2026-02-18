/**
 * Tests for Instagram Graph API service (src/lib/instagram.ts).
 *
 * These tests mock the global fetch to avoid real API calls
 * and verify correct URL construction, error handling, and response parsing.
 */

import { encrypt } from '@/lib/encryption';

// Set test encryption key before importing instagram module
const TEST_KEY = 'a'.repeat(64);
process.env.ENCRYPTION_KEY = TEST_KEY;

import {
  decryptInstagramCredentials,
  validateToken,
  postImage,
  postCarousel,
  postReel,
  getMediaInsights,
  getAccountInsights,
  type InstagramCredentials,
} from '@/lib/instagram';

// ── Helpers ────────────────────────────────────────────────────

function makeCreds(): InstagramCredentials {
  return { accountId: '17841400000000', accessToken: 'EAAG_test_ig_token_abc123' };
}

function mockFetchSuccess(data: any, headers?: Record<string, string>) {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    json: async () => data,
    headers: new Headers(headers || {}),
  });
}

function mockFetchError(errorMessage: string, code = 100) {
  mockFetchSuccess({
    error: { message: errorMessage, type: 'OAuthException', code },
  });
}

/** Parse form-urlencoded body into a plain object. */
function parseFormBody(body: string): Record<string, string> {
  const params = new URLSearchParams(body);
  const obj: Record<string, string> = {};
  params.forEach((v, k) => { obj[k] = v; });
  return obj;
}

// ── Setup ──────────────────────────────────────────────────────

beforeAll(() => {
  process.env.ENCRYPTION_KEY = TEST_KEY;
});

beforeEach(() => {
  global.fetch = jest.fn();
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(() => {
  delete process.env.ENCRYPTION_KEY;
});

// ── Tests ──────────────────────────────────────────────────────

describe('decryptInstagramCredentials', () => {
  it('decrypts accountId and accessToken from encrypted credentials', () => {
    const encryptedCreds = {
      encryptedCredentials: {
        accountId: encrypt('17841400000000'),
        accessToken: encrypt('EAAGtoken123'),
      },
    };

    const result = decryptInstagramCredentials(encryptedCreds);
    expect(result.accountId).toBe('17841400000000');
    expect(result.accessToken).toBe('EAAGtoken123');
  });
});

describe('validateToken', () => {
  it('returns account info on valid token', async () => {
    mockFetchSuccess({ id: '17841400000000', username: 'testuser', followers_count: 1200 });

    const result = await validateToken(makeCreds());
    expect(result).toEqual({
      id: '17841400000000',
      username: 'testuser',
      followersCount: 1200,
    });
  });

  it('returns null on invalid token', async () => {
    mockFetchError('Invalid OAuth 2.0 Access Token', 190);

    const result = await validateToken(makeCreds());
    expect(result).toBeNull();
  });

  it('returns null on network error', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network failure'));

    const result = await validateToken(makeCreds());
    expect(result).toBeNull();
  });

  it('sends correct URL with fields and access_token', async () => {
    mockFetchSuccess({ id: '17841400000000', username: 'test' });
    const creds = makeCreds();
    await validateToken(creds);

    const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(calledUrl).toContain('/v22.0/17841400000000');
    expect(calledUrl).toContain('fields=id%2Cusername%2Cfollowers_count');
    expect(calledUrl).toContain('access_token=EAAG_test_ig_token_abc123');
  });
});

describe('postImage', () => {
  it('creates container and publishes successfully', async () => {
    // Step 1: Create container
    mockFetchSuccess({ id: 'container_123' });
    // Step 2: Check container status
    mockFetchSuccess({ status_code: 'FINISHED' });
    // Step 3: Publish
    mockFetchSuccess({ id: 'media_456' });

    const result = await postImage(makeCreds(), 'Test caption #hello', 'https://example.com/image.jpg');
    expect(result).toEqual({ success: true, mediaId: 'media_456' });
  });

  it('sends correct container creation request', async () => {
    mockFetchSuccess({ id: 'container_123' });
    mockFetchSuccess({ status_code: 'FINISHED' });
    mockFetchSuccess({ id: 'media_456' });

    await postImage(makeCreds(), 'My caption', 'https://cdn.example.com/photo.jpg');

    // Verify container creation call
    const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain('/v22.0/17841400000000/media');
    expect(options.method).toBe('POST');
    const body = parseFormBody(options.body);
    expect(body.image_url).toBe('https://cdn.example.com/photo.jpg');
    expect(body.caption).toBe('My caption');
    expect(body.access_token).toBe('EAAG_test_ig_token_abc123');
  });

  it('sends correct publish request with creation_id', async () => {
    mockFetchSuccess({ id: 'container_999' });
    mockFetchSuccess({ status_code: 'FINISHED' });
    mockFetchSuccess({ id: 'media_888' });

    await postImage(makeCreds(), 'Caption', 'https://example.com/img.jpg');

    // Verify publish call (3rd fetch call)
    const [url, options] = (global.fetch as jest.Mock).mock.calls[2];
    expect(url).toContain('/v22.0/17841400000000/media_publish');
    const body = parseFormBody(options.body);
    expect(body.creation_id).toBe('container_999');
  });

  it('returns error if container creation fails', async () => {
    mockFetchError('Invalid image URL', 100);

    const result = await postImage(makeCreds(), 'Test', 'https://example.com/bad.jpg');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Instagram error: Invalid image URL');
  });

  it('returns error if container processing fails', async () => {
    mockFetchSuccess({ id: 'container_123' });
    mockFetchSuccess({ status_code: 'ERROR', status: 'Image too small' });

    const result = await postImage(makeCreds(), 'Test', 'https://example.com/small.jpg');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Image too small');
  });

  it('returns error if publish fails', async () => {
    mockFetchSuccess({ id: 'container_123' });
    mockFetchSuccess({ status_code: 'FINISHED' });
    mockFetchError('Rate limit exceeded', 4);

    const result = await postImage(makeCreds(), 'Test', 'https://example.com/img.jpg');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Instagram rate limit reached. Posts will resume automatically.');
  });

  it('handles network errors', async () => {
    // Must reject all 3 attempts (initial + 2 retries) to exhaust retry logic
    (global.fetch as jest.Mock)
      .mockRejectedValueOnce(new Error('Connection refused'))
      .mockRejectedValueOnce(new Error('Connection refused'))
      .mockRejectedValueOnce(new Error('Connection refused'));

    const result = await postImage(makeCreds(), 'Test', 'https://example.com/img.jpg');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Connection refused');
  }, 30000);
});

describe('postCarousel', () => {
  it('rejects fewer than 2 images', async () => {
    const result = await postCarousel(makeCreds(), 'Caption', ['https://example.com/1.jpg']);
    expect(result.success).toBe(false);
    expect(result.error).toContain('2-10 images');
  });

  it('rejects more than 10 images', async () => {
    const urls = Array.from({ length: 11 }, (_, i) => `https://example.com/${i}.jpg`);
    const result = await postCarousel(makeCreds(), 'Caption', urls);
    expect(result.success).toBe(false);
    expect(result.error).toContain('2-10 images');
  });

  it('creates child containers, carousel, and publishes', async () => {
    // 2 child containers
    mockFetchSuccess({ id: 'child_1' });
    mockFetchSuccess({ id: 'child_2' });
    // 2 container status checks
    mockFetchSuccess({ status_code: 'FINISHED' });
    mockFetchSuccess({ status_code: 'FINISHED' });
    // Carousel container
    mockFetchSuccess({ id: 'carousel_1' });
    // Carousel status
    mockFetchSuccess({ status_code: 'FINISHED' });
    // Publish
    mockFetchSuccess({ id: 'published_1' });

    const result = await postCarousel(
      makeCreds(),
      'Carousel caption',
      ['https://example.com/1.jpg', 'https://example.com/2.jpg']
    );

    expect(result).toEqual({ success: true, mediaId: 'published_1' });

    // Verify child containers have is_carousel_item
    const firstChildBody = parseFormBody((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(firstChildBody.is_carousel_item).toBe('true');

    // Verify carousel container has children (comma-separated in form-urlencoded)
    const carouselBody = parseFormBody((global.fetch as jest.Mock).mock.calls[4][1].body);
    expect(carouselBody.media_type).toBe('CAROUSEL');
    expect(carouselBody.children).toBe('child_1,child_2');
  });
});

describe('postReel', () => {
  it('creates video container and publishes', async () => {
    mockFetchSuccess({ id: 'video_container_1' });
    mockFetchSuccess({ status_code: 'FINISHED' });
    mockFetchSuccess({ id: 'reel_media_1' });

    const result = await postReel(
      makeCreds(),
      'Reel caption',
      'https://example.com/video.mp4'
    );

    expect(result).toEqual({ success: true, mediaId: 'reel_media_1' });

    // Verify container uses REELS media_type
    const body = parseFormBody((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.media_type).toBe('REELS');
    expect(body.video_url).toBe('https://example.com/video.mp4');
  });
});

describe('getMediaInsights', () => {
  it('parses media metrics correctly', async () => {
    mockFetchSuccess({
      data: [
        { name: 'impressions', values: [{ value: 1500 }] },
        { name: 'reach', values: [{ value: 1200 }] },
        { name: 'likes', values: [{ value: 85 }] },
        { name: 'comments', values: [{ value: 12 }] },
        { name: 'saved', values: [{ value: 30 }] },
        { name: 'shares', values: [{ value: 8 }] },
      ],
    });

    const result = await getMediaInsights(makeCreds(), 'media_123');
    expect(result).toEqual({
      impressions: 1500,
      reach: 1200,
      likes: 85,
      comments: 12,
      saves: 30,
      shares: 8,
    });
  });

  it('uses correct endpoint and metrics', async () => {
    mockFetchSuccess({ data: [] });
    await getMediaInsights(makeCreds(), 'media_123');

    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain('/v22.0/media_123/insights');
    expect(url).toContain('metric=impressions%2Creach%2Clikes%2Ccomments%2Csaved%2Cshares');
  });

  it('returns null on error', async () => {
    mockFetchError('Media not found', 100);

    const result = await getMediaInsights(makeCreds(), 'invalid_id');
    expect(result).toBeNull();
  });

  it('returns null on network error', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Timeout'));

    const result = await getMediaInsights(makeCreds(), 'media_123');
    expect(result).toBeNull();
  });
});

describe('getAccountInsights', () => {
  it('parses account metrics correctly', async () => {
    mockFetchSuccess({
      data: [
        { name: 'impressions', values: [{ value: 5000 }, { value: 6000 }] },
        { name: 'reach', values: [{ value: 3000 }, { value: 4000 }] },
        { name: 'profile_views', values: [{ value: 100 }, { value: 150 }] },
      ],
    });

    const result = await getAccountInsights(makeCreds());
    expect(result).toEqual({
      impressions: 6000,
      reach: 4000,
      profileViews: 150,
    });
  });

  it('includes since/until timestamps when provided', async () => {
    mockFetchSuccess({ data: [] });
    const since = new Date('2026-01-01T00:00:00Z');
    const until = new Date('2026-01-31T23:59:59Z');

    await getAccountInsights(makeCreds(), since, until);

    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain(`since=${Math.floor(since.getTime() / 1000)}`);
    expect(url).toContain(`until=${Math.floor(until.getTime() / 1000)}`);
  });

  it('returns null on error', async () => {
    mockFetchError('Permission denied', 200);

    const result = await getAccountInsights(makeCreds());
    expect(result).toBeNull();
  });
});

describe('rate-limit awareness', () => {
  it('parses X-App-Usage header without throttling at low usage', async () => {
    mockFetchSuccess(
      { id: '17841400000000', username: 'test' },
      { 'x-app-usage': JSON.stringify({ call_count: 10, total_cputime: 5, total_time: 8 }) }
    );

    const result = await validateToken(makeCreds());
    expect(result).toBeTruthy();
  });
});
