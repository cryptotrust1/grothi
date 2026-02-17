/**
 * Facebook Graph API v24.0 service for Grothi.
 *
 * Handles posting (text + image), feed reading, insights (v24.0 metrics),
 * token validation, and rate-limit awareness.
 */

import { decrypt } from './encryption';
import { db } from './db';
import type { PlatformConnection } from '@prisma/client';
import path from 'path';
import fs from 'fs/promises';

// ── Constants ──────────────────────────────────────────────────

const FB_GRAPH_VERSION = 'v24.0';
const GRAPH_BASE = `https://graph.facebook.com/${FB_GRAPH_VERSION}`;

/** Rate-limit threshold (percentage). Slow down when exceeded. */
const RATE_LIMIT_THRESHOLD = 60;

// ── Types ──────────────────────────────────────────────────────

export interface FacebookCredentials {
  pageId: string;
  accessToken: string;
}

export interface FacebookPostResult {
  success: boolean;
  postId?: string;
  error?: string;
}

export interface FacebookPageInfo {
  id: string;
  name: string;
  followers_count?: number;
}

interface GraphApiError {
  error: {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
  };
}

interface RateLimitInfo {
  callCount: number;
  totalCputime: number;
  totalTime: number;
  shouldThrottle: boolean;
}

// ── Credential Helpers ─────────────────────────────────────────

/**
 * Decrypt Facebook credentials stored in a PlatformConnection.
 */
export function decryptFacebookCredentials(
  connection: Pick<PlatformConnection, 'encryptedCredentials'>
): FacebookCredentials {
  const creds = connection.encryptedCredentials as Record<string, string>;
  return {
    pageId: decrypt(creds.pageId),
    accessToken: decrypt(creds.accessToken),
  };
}

/**
 * Get the decrypted Facebook credentials for a bot.
 * Returns null if no connected Facebook platform exists.
 */
export async function getFacebookCredentials(
  botId: string
): Promise<FacebookCredentials | null> {
  const conn = await db.platformConnection.findUnique({
    where: { botId_platform: { botId, platform: 'FACEBOOK' } },
  });

  if (!conn || conn.status !== 'CONNECTED') return null;

  try {
    return decryptFacebookCredentials(conn);
  } catch {
    // Mark connection as errored if decryption fails
    await db.platformConnection.update({
      where: { id: conn.id },
      data: { status: 'ERROR', lastError: 'Failed to decrypt credentials' },
    });
    return null;
  }
}

// ── Rate-Limit Parsing ─────────────────────────────────────────

function parseRateLimits(headers: Headers): RateLimitInfo {
  const raw = headers.get('x-app-usage') || headers.get('x-page-usage');
  if (!raw) {
    return { callCount: 0, totalCputime: 0, totalTime: 0, shouldThrottle: false };
  }

  try {
    const usage = JSON.parse(raw);
    const callCount = usage.call_count || 0;
    const totalCputime = usage.total_cputime || 0;
    const totalTime = usage.total_time || 0;
    const shouldThrottle =
      callCount > RATE_LIMIT_THRESHOLD ||
      totalCputime > RATE_LIMIT_THRESHOLD ||
      totalTime > RATE_LIMIT_THRESHOLD;
    return { callCount, totalCputime, totalTime, shouldThrottle };
  } catch {
    return { callCount: 0, totalCputime: 0, totalTime: 0, shouldThrottle: false };
  }
}

// ── Core API Call ──────────────────────────────────────────────

/** Timeout for individual API calls (30 seconds). */
const FETCH_TIMEOUT = 30_000;

async function graphFetch(
  url: string,
  options?: RequestInit
): Promise<{ data: any; rateLimits: RateLimitInfo }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);

    const rateLimits = parseRateLimits(res.headers);

    // Handle HTTP 429 explicitly
    if (res.status === 429) {
      if (rateLimits.shouldThrottle) {
        await new Promise((r) => setTimeout(r, 30_000));
      }
      const data = await res.json().catch(() => ({
        error: { message: 'Rate limit exceeded. Please wait a few minutes.', type: 'OAuthException', code: 429 },
      }));
      return { data, rateLimits };
    }

    const data = await res.json();

    // If rate limited, wait before returning
    if (rateLimits.shouldThrottle) {
      await new Promise((r) => setTimeout(r, 30_000));
    }

    return { data, rateLimits };
  } catch (e) {
    clearTimeout(timer);
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error('Facebook API request timed out (30s). Try again later.');
    }
    throw e;
  }
}

function isGraphError(data: any): data is GraphApiError {
  return data && typeof data === 'object' && 'error' in data;
}

/**
 * Check if a Graph API error indicates an invalid/expired token.
 * Error code 190 = invalid token, subcodes 458/463/467 = specific revocations.
 */
function isTokenError(data: any): boolean {
  if (!isGraphError(data)) return false;
  return data.error.code === 190;
}

/**
 * Transform raw Facebook Graph API errors into user-friendly messages.
 */
function friendlyFbError(data: GraphApiError): string {
  const err = data.error;
  const code = err.code;

  if (code === 190) return 'Facebook token expired. Please reconnect Facebook in Platforms.';
  if (code === 10 || code === 200) return 'Missing Facebook permissions. Please reconnect with full permissions.';
  if (code === 4 || code === 32) return 'Facebook rate limit reached. Posts will resume automatically.';
  if (code === 2) return 'Facebook is temporarily unavailable. The post will be retried.';
  if (code === 324) return 'Facebook could not process the image. The file may be corrupted or too large.';

  return `Facebook error: ${err.message}`;
}

// ── Token Validation ───────────────────────────────────────────

/**
 * Validate a Facebook Page Access Token by making a lightweight API call.
 * Returns page info on success, null on failure.
 */
export async function validateToken(
  creds: FacebookCredentials
): Promise<FacebookPageInfo | null> {
  const url = new URL(`${GRAPH_BASE}/${encodeURIComponent(creds.pageId)}`);
  url.searchParams.set('fields', 'id,name,followers_count');
  url.searchParams.set('access_token', creds.accessToken);

  try {
    const { data } = await graphFetch(url.toString());
    if (isGraphError(data)) return null;
    return data as FacebookPageInfo;
  } catch {
    return null;
  }
}

/**
 * Validate token and update connection status accordingly.
 */
export async function validateAndUpdateConnection(botId: string): Promise<boolean> {
  const conn = await db.platformConnection.findUnique({
    where: { botId_platform: { botId, platform: 'FACEBOOK' } },
  });
  if (!conn) return false;

  const creds = decryptFacebookCredentials(conn);
  const info = await validateToken(creds);

  if (info) {
    if (conn.status !== 'CONNECTED') {
      await db.platformConnection.update({
        where: { id: conn.id },
        data: { status: 'CONNECTED', lastError: null },
      });
    }
    return true;
  }

  await db.platformConnection.update({
    where: { id: conn.id },
    data: {
      status: 'ERROR',
      lastError: 'Token invalid or expired. Please reconnect Facebook.',
    },
  });
  return false;
}

// ── Posting ────────────────────────────────────────────────────

/**
 * Publish a text-only post to a Facebook Page.
 */
export async function postText(
  creds: FacebookCredentials,
  message: string
): Promise<FacebookPostResult> {
  const url = `${GRAPH_BASE}/${encodeURIComponent(creds.pageId)}/feed`;

  try {
    const { data } = await graphFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        access_token: creds.accessToken,
      }),
    });

    if (isGraphError(data)) {
      return { success: false, error: friendlyFbError(data) };
    }

    return { success: true, postId: data.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Network error';
    return { success: false, error: msg };
  }
}

/**
 * Publish a post with a single image (from local file path) to a Facebook Page.
 */
export async function postWithImage(
  creds: FacebookCredentials,
  message: string,
  imagePath: string
): Promise<FacebookPostResult> {
  const url = `${GRAPH_BASE}/${encodeURIComponent(creds.pageId)}/photos`;

  try {
    // Verify file exists before attempting to read (friendly error)
    try {
      await fs.access(imagePath);
    } catch {
      return { success: false, error: `Image file not found: ${path.basename(imagePath)}. It may have been deleted.` };
    }

    const fileBuffer = await fs.readFile(imagePath);
    const ext = path.extname(imagePath).toLowerCase().replace('.', '');
    const mimeMap: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
    };
    const mimeType = mimeMap[ext] || 'image/jpeg';

    const formData = new FormData();
    formData.append('source', new Blob([fileBuffer], { type: mimeType }), path.basename(imagePath));
    formData.append('caption', message);
    formData.append('published', 'true');
    formData.append('access_token', creds.accessToken);

    const { data } = await graphFetch(url, {
      method: 'POST',
      body: formData,
    });

    if (isGraphError(data)) {
      return { success: false, error: friendlyFbError(data) };
    }

    // Photos endpoint returns { id, post_id }
    return { success: true, postId: data.post_id || data.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Network error';
    return { success: false, error: msg };
  }
}

/**
 * Publish a video (from local file path) to a Facebook Page.
 * Uses the /{pageId}/videos endpoint.
 * Docs: https://developers.facebook.com/docs/video-api/guides/publishing
 */
export async function postWithVideo(
  creds: FacebookCredentials,
  message: string,
  videoPath: string
): Promise<FacebookPostResult> {
  const url = `${GRAPH_BASE}/${encodeURIComponent(creds.pageId)}/videos`;

  try {
    try {
      await fs.access(videoPath);
    } catch {
      return { success: false, error: `Video file not found: ${path.basename(videoPath)}. It may have been deleted.` };
    }

    const fileBuffer = await fs.readFile(videoPath);
    const ext = path.extname(videoPath).toLowerCase().replace('.', '');
    const videoMimeMap: Record<string, string> = {
      mp4: 'video/mp4',
      webm: 'video/webm',
      mov: 'video/quicktime',
    };
    const mimeType = videoMimeMap[ext] || 'video/mp4';

    const formData = new FormData();
    formData.append('source', new Blob([fileBuffer], { type: mimeType }), path.basename(videoPath));
    formData.append('description', message);
    formData.append('published', 'true');
    formData.append('access_token', creds.accessToken);

    const { data } = await graphFetch(url, {
      method: 'POST',
      body: formData,
    });

    if (isGraphError(data)) {
      return { success: false, error: friendlyFbError(data) };
    }

    return { success: true, postId: data.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Network error';
    return { success: false, error: msg };
  }
}

/**
 * Create a scheduled post on Facebook (server-side scheduling via Graph API).
 */
export async function postScheduled(
  creds: FacebookCredentials,
  message: string,
  publishTime: Date
): Promise<FacebookPostResult> {
  const url = `${GRAPH_BASE}/${encodeURIComponent(creds.pageId)}/feed`;

  const unixTimestamp = Math.floor(publishTime.getTime() / 1000);

  try {
    const { data } = await graphFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        published: false,
        scheduled_publish_time: unixTimestamp,
        access_token: creds.accessToken,
      }),
    });

    if (isGraphError(data)) {
      return { success: false, error: friendlyFbError(data) };
    }

    return { success: true, postId: data.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Network error';
    return { success: false, error: msg };
  }
}

// ── Reading Feed ───────────────────────────────────────────────

export interface FacebookFeedPost {
  id: string;
  message?: string;
  story?: string;
  created_time: string;
  attachments?: any;
  shares?: { count: number };
}

/**
 * Read the page's published posts.
 */
export async function readFeed(
  creds: FacebookCredentials,
  limit = 25
): Promise<{ posts: FacebookFeedPost[]; error?: string }> {
  const url = new URL(`${GRAPH_BASE}/${encodeURIComponent(creds.pageId)}/published_posts`);
  url.searchParams.set('fields', 'id,message,story,created_time,attachments,shares');
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('access_token', creds.accessToken);

  try {
    const { data } = await graphFetch(url.toString());

    if (isGraphError(data)) {
      if (isTokenError(data)) {
        return { posts: [], error: 'TOKEN_INVALID' };
      }
      return { posts: [], error: data.error.message };
    }

    return { posts: data.data || [] };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Network error';
    return { posts: [], error: msg };
  }
}

// ── Post Engagement ────────────────────────────────────────────

export interface PostEngagementData {
  likes: number;
  comments: number;
  shares: number;
}

/**
 * Fetch engagement counts for a specific post.
 */
export async function getPostEngagement(
  creds: FacebookCredentials,
  postId: string
): Promise<PostEngagementData | null> {
  const url = new URL(`${GRAPH_BASE}/${encodeURIComponent(postId)}`);
  url.searchParams.set(
    'fields',
    'likes.summary(total_count),comments.summary(total_count),shares'
  );
  url.searchParams.set('access_token', creds.accessToken);

  try {
    const { data } = await graphFetch(url.toString());
    if (isGraphError(data)) return null;

    return {
      likes: data.likes?.summary?.total_count || 0,
      comments: data.comments?.summary?.total_count || 0,
      shares: data.shares?.count || 0,
    };
  } catch {
    return null;
  }
}

// ── Page Insights (v24.0 compatible) ───────────────────────────

export interface PageInsights {
  pageMediaViews?: number;
  pageFollowers?: number;
  pageViewsTotal?: number;
  pageDailyFollows?: number;
}

/**
 * Fetch page-level insights using v24.0 compatible metrics.
 * NOTE: page_impressions and page_fans are deprecated as of Nov 2025.
 */
export async function getPageInsights(
  creds: FacebookCredentials,
  since?: Date,
  until?: Date
): Promise<PageInsights | null> {
  const url = new URL(`${GRAPH_BASE}/${encodeURIComponent(creds.pageId)}/insights`);
  url.searchParams.set(
    'metric',
    'page_media_view,page_followers,page_views_total,page_daily_follows_unique'
  );
  url.searchParams.set('period', 'day');
  url.searchParams.set('access_token', creds.accessToken);

  if (since) url.searchParams.set('since', String(Math.floor(since.getTime() / 1000)));
  if (until) url.searchParams.set('until', String(Math.floor(until.getTime() / 1000)));

  try {
    const { data } = await graphFetch(url.toString());
    if (isGraphError(data)) return null;

    const metrics = data.data as Array<{ name: string; values: Array<{ value: number }> }>;
    if (!metrics) return null;

    const result: PageInsights = {};
    for (const metric of metrics) {
      const latestValue = metric.values?.[metric.values.length - 1]?.value || 0;
      switch (metric.name) {
        case 'page_media_view':
          result.pageMediaViews = latestValue;
          break;
        case 'page_followers':
          result.pageFollowers = latestValue;
          break;
        case 'page_views_total':
          result.pageViewsTotal = latestValue;
          break;
        case 'page_daily_follows_unique':
          result.pageDailyFollows = latestValue;
          break;
      }
    }

    return result;
  } catch {
    return null;
  }
}

// ── Post Insights (v24.0 compatible) ───────────────────────────

export interface PostInsights {
  mediaViews?: number;
  engagedUsers?: number;
  clicks?: number;
}

/**
 * Fetch post-level insights using v24.0 compatible metrics.
 */
export async function getPostInsights(
  creds: FacebookCredentials,
  postId: string
): Promise<PostInsights | null> {
  const url = new URL(`${GRAPH_BASE}/${encodeURIComponent(postId)}/insights`);
  url.searchParams.set('metric', 'post_engaged_users,post_clicks');
  url.searchParams.set('access_token', creds.accessToken);

  try {
    const { data } = await graphFetch(url.toString());
    if (isGraphError(data)) return null;

    const metrics = data.data as Array<{ name: string; values: Array<{ value: number }> }>;
    if (!metrics) return null;

    const result: PostInsights = {};
    for (const metric of metrics) {
      const val = metric.values?.[0]?.value || 0;
      switch (metric.name) {
        case 'post_engaged_users':
          result.engagedUsers = val;
          break;
        case 'post_clicks':
          result.clicks = val;
          break;
      }
    }

    return result;
  } catch {
    return null;
  }
}

// ── Delete Post ────────────────────────────────────────────────

/**
 * Delete a post from the Facebook Page.
 */
export async function deletePost(
  creds: FacebookCredentials,
  postId: string
): Promise<{ success: boolean; error?: string }> {
  const url = new URL(`${GRAPH_BASE}/${encodeURIComponent(postId)}`);
  url.searchParams.set('access_token', creds.accessToken);

  try {
    const { data } = await graphFetch(url.toString(), { method: 'DELETE' });

    if (isGraphError(data)) {
      return { success: false, error: data.error.message };
    }

    return { success: data.success === true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Network error';
    return { success: false, error: msg };
  }
}

// ── Connection Health Check ────────────────────────────────────

/**
 * Run a health check on all Facebook connections.
 * Marks invalid tokens as ERROR with a descriptive message.
 * Returns count of valid/invalid connections.
 */
export async function healthCheckAllConnections(): Promise<{
  total: number;
  valid: number;
  invalid: number;
}> {
  const connections = await db.platformConnection.findMany({
    where: { platform: 'FACEBOOK', status: 'CONNECTED' },
  });

  let valid = 0;
  let invalid = 0;

  for (const conn of connections) {
    try {
      const creds = decryptFacebookCredentials(conn);
      const info = await validateToken(creds);

      if (info) {
        valid++;
      } else {
        invalid++;
        await db.platformConnection.update({
          where: { id: conn.id },
          data: {
            status: 'ERROR',
            lastError: 'Token invalid or expired. Please reconnect Facebook.',
          },
        });
      }
    } catch {
      invalid++;
      await db.platformConnection.update({
        where: { id: conn.id },
        data: {
          status: 'ERROR',
          lastError: 'Failed to validate credentials.',
        },
      });
    }

    // Small delay between validations to respect rate limits
    await new Promise((r) => setTimeout(r, 500));
  }

  return { total: connections.length, valid, invalid };
}
