/**
 * Tests for Threads API service (src/lib/threads.ts).
 *
 * These tests mock the global fetch to avoid real API calls
 * and verify correct URL construction, error handling, and response parsing.
 */

import { encrypt } from '@/lib/encryption';

// Set test encryption key before importing threads module
const TEST_KEY = 'a'.repeat(64);
process.env.ENCRYPTION_KEY = TEST_KEY;

import {
  decryptThreadsCredentials,
  validateToken,
  postText,
  postWithImage,
  postWithVideo,
  postCarousel,
  getPostInsights,
  isTokenNearExpiry,
  refreshToken,
  type ThreadsCredentials,
} from '@/lib/threads';

// ── Helpers ────────────────────────────────────────────────────

function makeCreds(): ThreadsCredentials {
  return { userId: '12345678', accessToken: 'THREADS_test_token_abc123' };
}

function mockFetchSuccess(data: any) {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    json: async () => data,
    headers: new Headers(),
    ok: true,
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

describe('decryptThreadsCredentials', () => {
  it('decrypts accessToken and reads userId from config', () => {
    const connection = {
      encryptedCredentials: {
        accessToken: encrypt('THREADS_real_token'),
      },
      config: {
        threadsUserId: '12345678',
        threadsUsername: 'testuser',
      },
    };

    const result = decryptThreadsCredentials(connection);
    expect(result.userId).toBe('12345678');
    expect(result.accessToken).toBe('THREADS_real_token');
  });

  it('handles missing config gracefully', () => {
    const connection = {
      encryptedCredentials: {
        accessToken: encrypt('THREADS_token'),
      },
      config: null,
    };

    const result = decryptThreadsCredentials(connection);
    expect(result.userId).toBe('');
    expect(result.accessToken).toBe('THREADS_token');
  });
});

describe('validateToken', () => {
  it('returns user info on valid token', async () => {
    mockFetchSuccess({ id: '12345678', username: 'testuser' });

    const result = await validateToken(makeCreds());
    expect(result).toEqual({ id: '12345678', username: 'testuser' });
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

  it('sends correct URL to Threads API', async () => {
    mockFetchSuccess({ id: '12345678', username: 'test' });
    await validateToken(makeCreds());

    const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(calledUrl).toContain('graph.threads.net/v1.0/me');
    expect(calledUrl).toContain('fields=id%2Cusername%2Cthreads_profile_picture_url');
    expect(calledUrl).toContain('access_token=THREADS_test_token_abc123');
  });
});

describe('postText', () => {
  it('creates container and publishes text successfully', async () => {
    // Step 1: Create container
    mockFetchSuccess({ id: 'container_text_1' });
    // Step 2: Check container status
    mockFetchSuccess({ status: 'FINISHED' });
    // Step 3: Publish
    mockFetchSuccess({ id: 'post_123' });

    const result = await postText(makeCreds(), 'Hello Threads!');
    expect(result).toEqual({ success: true, postId: 'post_123' });
  });

  it('sends correct container creation request', async () => {
    mockFetchSuccess({ id: 'container_1' });
    mockFetchSuccess({ status: 'FINISHED' });
    mockFetchSuccess({ id: 'post_1' });

    await postText(makeCreds(), 'My thread');

    // Verify container creation
    const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain('graph.threads.net/v1.0/me/threads');
    expect(options.method).toBe('POST');
    const body = parseFormBody(options.body);
    expect(body.media_type).toBe('TEXT');
    expect(body.text).toBe('My thread');
    expect(body.access_token).toBe('THREADS_test_token_abc123');
  });

  it('sends correct publish request with creation_id', async () => {
    mockFetchSuccess({ id: 'container_42' });
    mockFetchSuccess({ status: 'FINISHED' });
    mockFetchSuccess({ id: 'post_42' });

    await postText(makeCreds(), 'Test');

    // Verify publish call (3rd fetch call)
    const [url, options] = (global.fetch as jest.Mock).mock.calls[2];
    expect(url).toContain('graph.threads.net/v1.0/me/threads_publish');
    const body = parseFormBody(options.body);
    expect(body.creation_id).toBe('container_42');
  });

  it('rejects empty text', async () => {
    const result = await postText(makeCreds(), '');
    expect(result.success).toBe(false);
    expect(result.error).toContain('empty');
  });

  it('rejects text over 500 characters', async () => {
    const longText = 'x'.repeat(501);
    const result = await postText(makeCreds(), longText);
    expect(result.success).toBe(false);
    expect(result.error).toContain('500 characters');
  });

  it('returns error if container creation fails', async () => {
    mockFetchError('Rate limit exceeded', 4);

    const result = await postText(makeCreds(), 'Test');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Threads rate limit reached. Posts will resume automatically.');
  });

  it('returns error if container processing fails', async () => {
    mockFetchSuccess({ id: 'container_1' });
    mockFetchSuccess({ status: 'ERROR', error_message: 'Content policy violation' });

    const result = await postText(makeCreds(), 'Bad content');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Content policy violation');
  });

  it('handles network errors', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Connection timeout'));

    const result = await postText(makeCreds(), 'Test');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Connection timeout');
  });
});

describe('postWithImage', () => {
  it('creates image container and publishes', async () => {
    mockFetchSuccess({ id: 'img_container_1' });
    mockFetchSuccess({ status: 'FINISHED' });
    mockFetchSuccess({ id: 'img_post_1' });

    const result = await postWithImage(
      makeCreds(),
      'Image post!',
      'https://example.com/photo.jpg'
    );

    expect(result).toEqual({ success: true, postId: 'img_post_1' });

    // Verify IMAGE media_type
    const body = parseFormBody((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.media_type).toBe('IMAGE');
    expect(body.image_url).toBe('https://example.com/photo.jpg');
    expect(body.text).toBe('Image post!');
  });

  it('rejects text over 500 characters', async () => {
    const result = await postWithImage(makeCreds(), 'x'.repeat(501), 'https://example.com/img.jpg');
    expect(result.success).toBe(false);
    expect(result.error).toContain('500 characters');
  });
});

describe('postWithVideo', () => {
  it('creates video container and publishes', async () => {
    mockFetchSuccess({ id: 'vid_container_1' });
    mockFetchSuccess({ status: 'FINISHED' });
    mockFetchSuccess({ id: 'vid_post_1' });

    const result = await postWithVideo(
      makeCreds(),
      'Video post!',
      'https://example.com/video.mp4'
    );

    expect(result).toEqual({ success: true, postId: 'vid_post_1' });

    const body = parseFormBody((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.media_type).toBe('VIDEO');
    expect(body.video_url).toBe('https://example.com/video.mp4');
  });
});

describe('postCarousel', () => {
  it('rejects fewer than 2 items', async () => {
    const result = await postCarousel(makeCreds(), 'Caption', ['https://example.com/1.jpg']);
    expect(result.success).toBe(false);
    expect(result.error).toContain('2-20 items');
  });

  it('rejects more than 20 items', async () => {
    const urls = Array.from({ length: 21 }, (_, i) => `https://example.com/${i}.jpg`);
    const result = await postCarousel(makeCreds(), 'Caption', urls);
    expect(result.success).toBe(false);
    expect(result.error).toContain('2-20 items');
  });

  it('creates child containers, carousel, and publishes', async () => {
    // 2 child containers
    mockFetchSuccess({ id: 'child_1' });
    mockFetchSuccess({ id: 'child_2' });
    // 2 container status checks
    mockFetchSuccess({ status: 'FINISHED' });
    mockFetchSuccess({ status: 'FINISHED' });
    // Carousel container
    mockFetchSuccess({ id: 'carousel_1' });
    // Carousel status
    mockFetchSuccess({ status: 'FINISHED' });
    // Publish
    mockFetchSuccess({ id: 'carousel_post_1' });

    const result = await postCarousel(
      makeCreds(),
      'Carousel!',
      ['https://example.com/1.jpg', 'https://example.com/2.jpg']
    );

    expect(result).toEqual({ success: true, postId: 'carousel_post_1' });

    // Verify child container has is_carousel_item
    const childBody = parseFormBody((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(childBody.is_carousel_item).toBe('true');
    expect(childBody.media_type).toBe('IMAGE');

    // Verify carousel container has children (comma-separated in form-urlencoded)
    const carouselBody = parseFormBody((global.fetch as jest.Mock).mock.calls[4][1].body);
    expect(carouselBody.media_type).toBe('CAROUSEL');
    expect(carouselBody.children).toBe('child_1,child_2');
  });
});

describe('getPostInsights', () => {
  it('parses post metrics correctly', async () => {
    mockFetchSuccess({
      data: [
        { name: 'views', values: [{ value: 5000 }] },
        { name: 'likes', values: [{ value: 120 }] },
        { name: 'replies', values: [{ value: 25 }] },
        { name: 'reposts', values: [{ value: 8 }] },
        { name: 'quotes', values: [{ value: 3 }] },
      ],
    });

    const result = await getPostInsights(makeCreds(), 'post_123');
    expect(result).toEqual({
      views: 5000,
      likes: 120,
      replies: 25,
      reposts: 8,
      quotes: 3,
    });
  });

  it('uses correct Threads API endpoint', async () => {
    mockFetchSuccess({ data: [] });
    await getPostInsights(makeCreds(), 'post_123');

    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain('graph.threads.net/v1.0/post_123/insights');
    expect(url).toContain('metric=views%2Clikes%2Creplies%2Creposts%2Cquotes');
  });

  it('returns null on error', async () => {
    mockFetchError('Post not found', 100);

    const result = await getPostInsights(makeCreds(), 'invalid');
    expect(result).toBeNull();
  });
});

describe('isTokenNearExpiry', () => {
  it('returns false when token has plenty of time', () => {
    const config = {
      tokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
    };
    expect(isTokenNearExpiry(config)).toBe(false);
  });

  it('returns true when token expires within 10 days', () => {
    const config = {
      tokenExpiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days
    };
    expect(isTokenNearExpiry(config)).toBe(true);
  });

  it('returns true when token is already expired', () => {
    const config = {
      tokenExpiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // yesterday
    };
    expect(isTokenNearExpiry(config)).toBe(true);
  });

  it('returns true when tokenExpiresAt is not set (safe default: assume refresh needed)', () => {
    expect(isTokenNearExpiry({})).toBe(true);
  });
});

describe('refreshToken', () => {
  it('returns new token data on success', async () => {
    mockFetchSuccess({
      access_token: 'NEW_REFRESHED_TOKEN',
      expires_in: 5184000,
      token_type: 'bearer',
    });

    const result = await refreshToken('OLD_TOKEN');
    expect(result).toEqual({
      accessToken: 'NEW_REFRESHED_TOKEN',
      expiresIn: 5184000,
    });

    // Verify correct refresh URL
    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain('graph.threads.net/refresh_access_token');
    expect(url).toContain('grant_type=th_refresh_token');
    expect(url).toContain('access_token=OLD_TOKEN');
  });

  it('returns null on error', async () => {
    mockFetchSuccess({
      error: { message: 'Token cannot be refreshed yet', type: 'OAuthException', code: 100 },
    });

    const result = await refreshToken('OLD_TOKEN');
    expect(result).toBeNull();
  });

  it('returns null on network error', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    const result = await refreshToken('OLD_TOKEN');
    expect(result).toBeNull();
  });

  it('defaults to 60-day expiry when expires_in is missing', async () => {
    mockFetchSuccess({
      access_token: 'NEW_TOKEN',
    });

    const result = await refreshToken('OLD');
    expect(result?.expiresIn).toBe(5184000);
  });
});
