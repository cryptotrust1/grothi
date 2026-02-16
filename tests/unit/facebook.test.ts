/**
 * Tests for Facebook Graph API service (src/lib/facebook.ts).
 *
 * These tests mock the global fetch to avoid real API calls
 * and verify correct URL construction, error handling, and response parsing.
 */

import { encrypt } from '@/lib/encryption';

// Set test encryption key before importing facebook module
const TEST_KEY = 'a'.repeat(64);
process.env.ENCRYPTION_KEY = TEST_KEY;

import {
  decryptFacebookCredentials,
  validateToken,
  postText,
  postWithImage,
  postScheduled,
  readFeed,
  getPostEngagement,
  getPageInsights,
  getPostInsights,
  deletePost,
  type FacebookCredentials,
} from '@/lib/facebook';

// ── Helpers ────────────────────────────────────────────────────

function makeCreds(): FacebookCredentials {
  return { pageId: '123456789', accessToken: 'EAAG_test_token_abc123' };
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

describe('decryptFacebookCredentials', () => {
  it('decrypts pageId and accessToken from encrypted credentials', () => {
    const encryptedCreds = {
      encryptedCredentials: {
        pageId: encrypt('123456'),
        accessToken: encrypt('EAAGtoken123'),
      },
    };

    const result = decryptFacebookCredentials(encryptedCreds);
    expect(result.pageId).toBe('123456');
    expect(result.accessToken).toBe('EAAGtoken123');
  });
});

describe('validateToken', () => {
  it('returns page info on valid token', async () => {
    mockFetchSuccess({ id: '123', name: 'My Page', followers_count: 500 });

    const result = await validateToken(makeCreds());
    expect(result).toEqual({ id: '123', name: 'My Page', followers_count: 500 });
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
    mockFetchSuccess({ id: '123', name: 'Test' });
    const creds = makeCreds();
    await validateToken(creds);

    const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(calledUrl).toContain('/v24.0/123456789');
    expect(calledUrl).toContain('fields=id%2Cname%2Cfollowers_count');
    expect(calledUrl).toContain('access_token=EAAG_test_token_abc123');
  });
});

describe('postText', () => {
  it('posts text successfully', async () => {
    mockFetchSuccess({ id: '123_456' });

    const result = await postText(makeCreds(), 'Hello World!');
    expect(result).toEqual({ success: true, postId: '123_456' });
  });

  it('sends POST request to /{pageId}/feed', async () => {
    mockFetchSuccess({ id: '123_456' });
    await postText(makeCreds(), 'Test');

    const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain('/v24.0/123456789/feed');
    expect(options.method).toBe('POST');
    const body = JSON.parse(options.body);
    expect(body.message).toBe('Test');
    expect(body.access_token).toBe('EAAG_test_token_abc123');
  });

  it('returns error on API failure', async () => {
    mockFetchError('Permission denied', 200);

    const result = await postText(makeCreds(), 'Test');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Permission denied');
  });

  it('handles network errors', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Connection refused'));

    const result = await postText(makeCreds(), 'Test');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Connection refused');
  });
});

describe('postScheduled', () => {
  it('creates a scheduled post with unix timestamp', async () => {
    mockFetchSuccess({ id: '123_789' });
    const futureDate = new Date('2026-03-01T12:00:00Z');

    const result = await postScheduled(makeCreds(), 'Scheduled post', futureDate);
    expect(result.success).toBe(true);

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.published).toBe(false);
    expect(body.scheduled_publish_time).toBe(Math.floor(futureDate.getTime() / 1000));
  });
});

describe('readFeed', () => {
  it('returns posts on success', async () => {
    const posts = [
      { id: '1', message: 'Post 1', created_time: '2026-01-01T00:00:00Z' },
      { id: '2', message: 'Post 2', created_time: '2026-01-02T00:00:00Z' },
    ];
    mockFetchSuccess({ data: posts });

    const result = await readFeed(makeCreds());
    expect(result.posts).toHaveLength(2);
    expect(result.posts[0].message).toBe('Post 1');
    expect(result.error).toBeUndefined();
  });

  it('returns TOKEN_INVALID on error code 190', async () => {
    mockFetchError('Invalid token', 190);

    const result = await readFeed(makeCreds());
    expect(result.posts).toHaveLength(0);
    expect(result.error).toBe('TOKEN_INVALID');
  });

  it('uses published_posts endpoint', async () => {
    mockFetchSuccess({ data: [] });
    await readFeed(makeCreds(), 10);

    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain('/published_posts');
    expect(url).toContain('limit=10');
  });
});

describe('getPostEngagement', () => {
  it('returns engagement counts', async () => {
    mockFetchSuccess({
      likes: { summary: { total_count: 42 } },
      comments: { summary: { total_count: 7 } },
      shares: { count: 3 },
    });

    const result = await getPostEngagement(makeCreds(), '123_456');
    expect(result).toEqual({ likes: 42, comments: 7, shares: 3 });
  });

  it('handles missing shares field', async () => {
    mockFetchSuccess({
      likes: { summary: { total_count: 10 } },
      comments: { summary: { total_count: 2 } },
    });

    const result = await getPostEngagement(makeCreds(), '123_456');
    expect(result).toEqual({ likes: 10, comments: 2, shares: 0 });
  });

  it('returns null on error', async () => {
    mockFetchError('Post not found', 100);

    const result = await getPostEngagement(makeCreds(), 'invalid');
    expect(result).toBeNull();
  });
});

describe('getPageInsights', () => {
  it('parses v24.0 metrics correctly', async () => {
    mockFetchSuccess({
      data: [
        { name: 'page_media_view', values: [{ value: 1200 }] },
        { name: 'page_followers', values: [{ value: 500 }] },
        { name: 'page_views_total', values: [{ value: 300 }] },
        { name: 'page_daily_follows_unique', values: [{ value: 15 }] },
      ],
    });

    const result = await getPageInsights(makeCreds());
    expect(result).toEqual({
      pageMediaViews: 1200,
      pageFollowers: 500,
      pageViewsTotal: 300,
      pageDailyFollows: 15,
    });
  });

  it('uses v24.0 compatible metric names (not deprecated ones)', async () => {
    mockFetchSuccess({ data: [] });
    await getPageInsights(makeCreds());

    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    // Should use new v24.0 metrics
    expect(url).toContain('page_media_view');
    expect(url).toContain('page_followers');
    // Should NOT use deprecated metrics
    expect(url).not.toContain('page_impressions');
    expect(url).not.toContain('page_fans');
  });

  it('includes since/until timestamps when provided', async () => {
    mockFetchSuccess({ data: [] });
    const since = new Date('2026-01-01T00:00:00Z');
    const until = new Date('2026-01-31T23:59:59Z');

    await getPageInsights(makeCreds(), since, until);

    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain(`since=${Math.floor(since.getTime() / 1000)}`);
    expect(url).toContain(`until=${Math.floor(until.getTime() / 1000)}`);
  });
});

describe('getPostInsights', () => {
  it('parses post-level metrics', async () => {
    mockFetchSuccess({
      data: [
        { name: 'post_engaged_users', values: [{ value: 85 }] },
        { name: 'post_clicks', values: [{ value: 120 }] },
      ],
    });

    const result = await getPostInsights(makeCreds(), '123_456');
    expect(result).toEqual({ engagedUsers: 85, clicks: 120 });
  });

  it('uses v24.0 compatible post metrics', async () => {
    mockFetchSuccess({ data: [] });
    await getPostInsights(makeCreds(), '123_456');

    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain('post_engaged_users');
    expect(url).toContain('post_clicks');
    // Should NOT use deprecated metrics
    expect(url).not.toContain('post_impressions');
  });
});

describe('deletePost', () => {
  it('deletes a post successfully', async () => {
    mockFetchSuccess({ success: true });

    const result = await deletePost(makeCreds(), '123_456');
    expect(result.success).toBe(true);
  });

  it('sends DELETE request', async () => {
    mockFetchSuccess({ success: true });
    await deletePost(makeCreds(), '123_456');

    const [, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(options.method).toBe('DELETE');
  });

  it('returns error on failure', async () => {
    mockFetchError('Post not found', 100);

    const result = await deletePost(makeCreds(), 'invalid');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Post not found');
  });
});

describe('rate-limit awareness', () => {
  it('parses X-App-Usage header', async () => {
    // When rate limits are below threshold, should not add delay
    mockFetchSuccess(
      { id: '123', name: 'Test' },
      { 'x-app-usage': JSON.stringify({ call_count: 10, total_cputime: 5, total_time: 8 }) }
    );

    const result = await validateToken(makeCreds());
    expect(result).toBeTruthy();
  });
});
