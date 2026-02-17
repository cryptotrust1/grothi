/**
 * Instagram Graph API service for Grothi.
 *
 * Handles content publishing (single image, carousel, reels),
 * token validation, media insights, and rate-limit awareness.
 *
 * Instagram publishing uses a 2-step "Container" model:
 *   1. Create a media container (upload reference)
 *   2. Publish the container
 *
 * Uses the Instagram Graph API (graph.instagram.com) with Instagram
 * Direct Login tokens.
 * Requires: instagram_business_basic, instagram_business_content_publish
 *
 * Docs: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login
 */

import { decrypt } from './encryption';
import { db } from './db';
import type { PlatformConnection } from '@prisma/client';
import path from 'path';
import fs from 'fs/promises';

// ── Constants ──────────────────────────────────────────────────

const IG_GRAPH_VERSION = 'v21.0';
const GRAPH_BASE = `https://graph.instagram.com/${IG_GRAPH_VERSION}`;

/** Max time to wait for a container to finish processing (ms). */
const CONTAINER_POLL_TIMEOUT = 60_000;
/** Interval between container status checks (ms). */
const CONTAINER_POLL_INTERVAL = 3_000;

/** Rate-limit threshold (percentage). Slow down when exceeded. */
const RATE_LIMIT_THRESHOLD = 60;

// ── Types ──────────────────────────────────────────────────────

export interface InstagramCredentials {
  /** Instagram Business Account ID (ig-user-id). */
  accountId: string;
  /** Page Access Token (used for IG Graph API calls). */
  accessToken: string;
}

export interface InstagramPostResult {
  success: boolean;
  mediaId?: string;
  error?: string;
}

export interface InstagramMediaInsights {
  impressions?: number;
  reach?: number;
  likes?: number;
  comments?: number;
  saves?: number;
  shares?: number;
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

type ContainerStatus = 'FINISHED' | 'IN_PROGRESS' | 'ERROR' | 'EXPIRED';

// ── Credential Helpers ─────────────────────────────────────────

/**
 * Decrypt Instagram credentials stored in a PlatformConnection.
 */
export function decryptInstagramCredentials(
  connection: Pick<PlatformConnection, 'encryptedCredentials'>
): InstagramCredentials {
  const creds = connection.encryptedCredentials as Record<string, string>;
  return {
    accountId: decrypt(creds.accountId),
    accessToken: decrypt(creds.accessToken),
  };
}

/**
 * Get the decrypted Instagram credentials for a bot.
 * Returns null if no connected Instagram platform exists.
 */
export async function getInstagramCredentials(
  botId: string
): Promise<InstagramCredentials | null> {
  const conn = await db.platformConnection.findUnique({
    where: { botId_platform: { botId, platform: 'INSTAGRAM' } },
  });

  if (!conn || conn.status !== 'CONNECTED') return null;

  try {
    return decryptInstagramCredentials(conn);
  } catch {
    await db.platformConnection.update({
      where: { id: conn.id },
      data: { status: 'ERROR', lastError: 'Failed to decrypt credentials' },
    });
    return null;
  }
}

// ── Rate-Limit Parsing ─────────────────────────────────────────

function parseRateLimits(headers: Headers): RateLimitInfo {
  const raw = headers.get('x-app-usage') || headers.get('x-business-use-case-usage');
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

    if (rateLimits.shouldThrottle) {
      await new Promise((r) => setTimeout(r, 30_000));
    }

    return { data, rateLimits };
  } catch (e) {
    clearTimeout(timer);
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error('Instagram API request timed out (30s). Try again later.');
    }
    throw e;
  }
}

function isGraphError(data: any): data is GraphApiError {
  return data && typeof data === 'object' && 'error' in data;
}

/**
 * Transform raw Instagram Graph API errors into user-friendly messages.
 */
function friendlyIgError(data: GraphApiError): string {
  const err = data.error;
  const code = err.code;
  const sub = err.error_subcode;

  // Token errors
  if (code === 190) return 'Instagram token expired. Please reconnect Instagram in Platforms.';
  // Permission errors
  if (code === 10 || code === 200) return 'Missing Instagram permissions. Please reconnect with full permissions.';
  // Rate limit
  if (code === 4 || code === 32) return 'Instagram rate limit reached. Posts will resume automatically.';
  // Media errors
  if (code === 36003) return 'Instagram could not download the image. Make sure the image is publicly accessible.';
  // Generic API service error (code 2)
  if (code === 2) return 'Instagram is temporarily unavailable. The post will be retried.';
  // Duplicate post
  if (sub === 2207051) return 'Duplicate post detected. Instagram rejected identical content.';

  // Fallback: include the raw message but prefix with context
  return `Instagram error: ${err.message}`;
}

/**
 * Check if a Graph API error indicates an invalid/expired token.
 */
function isTokenError(data: any): boolean {
  if (!isGraphError(data)) return false;
  return data.error.code === 190;
}

// ── Token Validation ───────────────────────────────────────────

/**
 * Validate an Instagram access token by fetching account info.
 */
export async function validateToken(
  creds: InstagramCredentials
): Promise<{ id: string; username?: string; followersCount?: number } | null> {
  const url = new URL(`${GRAPH_BASE}/${encodeURIComponent(creds.accountId)}`);
  url.searchParams.set('fields', 'id,username,followers_count');
  url.searchParams.set('access_token', creds.accessToken);

  try {
    const { data } = await graphFetch(url.toString());
    if (isGraphError(data)) return null;
    return {
      id: data.id,
      username: data.username,
      followersCount: data.followers_count,
    };
  } catch {
    return null;
  }
}

/**
 * Validate token and update connection status accordingly.
 */
export async function validateAndUpdateConnection(botId: string): Promise<boolean> {
  const conn = await db.platformConnection.findUnique({
    where: { botId_platform: { botId, platform: 'INSTAGRAM' } },
  });
  if (!conn) return false;

  const creds = decryptInstagramCredentials(conn);
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
      lastError: 'Token invalid or expired. Please reconnect Instagram.',
    },
  });
  return false;
}

// ── Container Status Check ─────────────────────────────────────

/**
 * Poll the container status until it finishes or times out.
 * Instagram containers go through IN_PROGRESS → FINISHED before they can be published.
 */
async function waitForContainer(
  containerId: string,
  accessToken: string
): Promise<{ status: ContainerStatus; error?: string }> {
  const startTime = Date.now();

  while (Date.now() - startTime < CONTAINER_POLL_TIMEOUT) {
    const url = new URL(`${GRAPH_BASE}/${encodeURIComponent(containerId)}`);
    url.searchParams.set('fields', 'status_code,status');
    url.searchParams.set('access_token', accessToken);

    const { data } = await graphFetch(url.toString());

    if (isGraphError(data)) {
      return { status: 'ERROR', error: data.error.message };
    }

    const status = (data.status_code || data.status || 'IN_PROGRESS') as ContainerStatus;

    if (status === 'FINISHED') {
      return { status: 'FINISHED' };
    }

    if (status === 'ERROR' || status === 'EXPIRED') {
      return { status, error: data.status || 'Container processing failed' };
    }

    // Wait before polling again
    await new Promise((r) => setTimeout(r, CONTAINER_POLL_INTERVAL));
  }

  return { status: 'ERROR', error: 'Container processing timed out' };
}

// ── Publishing: Single Image ───────────────────────────────────

/**
 * Publish a single image post to Instagram.
 *
 * Instagram requires a publicly accessible image URL for the container API.
 * For local files, we upload via the Graph API's resumable upload endpoint,
 * or use a signed URL if the server is accessible.
 *
 * Flow:
 * 1. Create media container with image_url + caption
 * 2. Wait for container to finish processing
 * 3. Publish the container
 */
export async function postImage(
  creds: InstagramCredentials,
  caption: string,
  imageUrl: string
): Promise<InstagramPostResult> {
  try {
    // Step 1: Create media container
    const containerUrl = `${GRAPH_BASE}/${encodeURIComponent(creds.accountId)}/media`;

    // Instagram Graph API requires form-urlencoded (not JSON)
    const { data: containerData } = await graphFetch(containerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        image_url: imageUrl,
        caption,
        access_token: creds.accessToken,
      }).toString(),
    });

    if (isGraphError(containerData)) {
      return { success: false, error: friendlyIgError(containerData) };
    }

    const containerId = containerData.id;
    if (!containerId) {
      return { success: false, error: 'No container ID returned from Instagram' };
    }

    // Step 2: Wait for container to finish processing
    const containerStatus = await waitForContainer(containerId, creds.accessToken);
    if (containerStatus.status !== 'FINISHED') {
      return { success: false, error: containerStatus.error || 'Container processing failed' };
    }

    // Step 3: Publish the container
    const publishUrl = `${GRAPH_BASE}/${encodeURIComponent(creds.accountId)}/media_publish`;

    const { data: publishData } = await graphFetch(publishUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        creation_id: containerId,
        access_token: creds.accessToken,
      }).toString(),
    });

    if (isGraphError(publishData)) {
      return { success: false, error: friendlyIgError(publishData) };
    }

    return { success: true, mediaId: publishData.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Network error';
    return { success: false, error: msg };
  }
}

// ── Publishing: Carousel (Multiple Images) ────────────────────

/**
 * Publish a carousel post (2-10 images) to Instagram.
 *
 * Flow:
 * 1. Create a container for each image (is_carousel_item=true)
 * 2. Wait for all containers to finish
 * 3. Create a carousel container referencing all image containers
 * 4. Wait for carousel container
 * 5. Publish the carousel container
 */
export async function postCarousel(
  creds: InstagramCredentials,
  caption: string,
  imageUrls: string[]
): Promise<InstagramPostResult> {
  if (imageUrls.length < 2 || imageUrls.length > 10) {
    return { success: false, error: 'Carousel requires 2-10 images' };
  }

  try {
    // Step 1: Create containers for each image
    const childContainerIds: string[] = [];

    for (const imageUrl of imageUrls) {
      const containerUrl = `${GRAPH_BASE}/${encodeURIComponent(creds.accountId)}/media`;

      const { data: containerData } = await graphFetch(containerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          image_url: imageUrl,
          is_carousel_item: 'true',
          access_token: creds.accessToken,
        }).toString(),
      });

      if (isGraphError(containerData)) {
        return { success: false, error: `Carousel item failed: ${friendlyIgError(containerData)}` };
      }

      childContainerIds.push(containerData.id);
    }

    // Step 2: Wait for all child containers to finish
    for (const childId of childContainerIds) {
      const status = await waitForContainer(childId, creds.accessToken);
      if (status.status !== 'FINISHED') {
        return { success: false, error: `Carousel item processing failed: ${status.error}` };
      }
    }

    // Step 3: Create carousel container
    const carouselUrl = `${GRAPH_BASE}/${encodeURIComponent(creds.accountId)}/media`;

    const { data: carouselData } = await graphFetch(carouselUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        media_type: 'CAROUSEL',
        caption,
        children: childContainerIds.join(','),
        access_token: creds.accessToken,
      }).toString(),
    });

    if (isGraphError(carouselData)) {
      return { success: false, error: friendlyIgError(carouselData) };
    }

    // Step 4: Wait for carousel container
    const carouselStatus = await waitForContainer(carouselData.id, creds.accessToken);
    if (carouselStatus.status !== 'FINISHED') {
      return { success: false, error: carouselStatus.error || 'Carousel processing failed' };
    }

    // Step 5: Publish
    const publishUrl = `${GRAPH_BASE}/${encodeURIComponent(creds.accountId)}/media_publish`;

    const { data: publishData } = await graphFetch(publishUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        creation_id: carouselData.id,
        access_token: creds.accessToken,
      }).toString(),
    });

    if (isGraphError(publishData)) {
      return { success: false, error: friendlyIgError(publishData) };
    }

    return { success: true, mediaId: publishData.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Network error';
    return { success: false, error: msg };
  }
}

// ── Publishing: Reel (Video) ──────────────────────────────────

/**
 * Publish a Reel (video) to Instagram.
 *
 * Flow same as image but with media_type=REELS and video_url.
 */
export async function postReel(
  creds: InstagramCredentials,
  caption: string,
  videoUrl: string
): Promise<InstagramPostResult> {
  try {
    // Step 1: Create video container
    const containerUrl = `${GRAPH_BASE}/${encodeURIComponent(creds.accountId)}/media`;

    const { data: containerData } = await graphFetch(containerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        media_type: 'REELS',
        video_url: videoUrl,
        caption,
        access_token: creds.accessToken,
      }).toString(),
    });

    if (isGraphError(containerData)) {
      return { success: false, error: friendlyIgError(containerData) };
    }

    const containerId = containerData.id;
    if (!containerId) {
      return { success: false, error: 'No container ID returned from Instagram' };
    }

    // Step 2: Wait for video processing (may take longer than images)
    const containerStatus = await waitForContainer(containerId, creds.accessToken);
    if (containerStatus.status !== 'FINISHED') {
      return { success: false, error: containerStatus.error || 'Video processing failed' };
    }

    // Step 3: Publish
    const publishUrl = `${GRAPH_BASE}/${encodeURIComponent(creds.accountId)}/media_publish`;

    const { data: publishData } = await graphFetch(publishUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        creation_id: containerId,
        access_token: creds.accessToken,
      }).toString(),
    });

    if (isGraphError(publishData)) {
      return { success: false, error: friendlyIgError(publishData) };
    }

    return { success: true, mediaId: publishData.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Network error';
    return { success: false, error: msg };
  }
}

// ── Publishing: Local File Helper ─────────────────────────────

/**
 * Publish a local image file to Instagram.
 *
 * Instagram's Container API requires a publicly accessible URL.
 * This function constructs the URL from the server's base URL + media serve endpoint.
 * The file must be accessible via /api/media/{mediaId} endpoint.
 *
 * If a direct public URL is provided (starts with http), it will be used as-is.
 */
export async function postLocalImage(
  creds: InstagramCredentials,
  caption: string,
  filePath: string,
  mediaId?: string
): Promise<InstagramPostResult> {
  // If filePath is already a URL, use it directly
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
    return postImage(creds, caption, filePath);
  }

  // For local files, we need a public URL
  // Use the media serve endpoint if we have a media ID
  if (mediaId) {
    const baseUrl = process.env.NEXTAUTH_URL || 'https://grothi.com';
    const publicUrl = `${baseUrl}/api/media/${encodeURIComponent(mediaId)}`;
    return postImage(creds, caption, publicUrl);
  }

  // No public URL available - verify file exists at least
  const absPath = path.isAbsolute(filePath)
    ? filePath
    : path.join(process.cwd(), filePath);

  try {
    await fs.access(absPath);
  } catch {
    return { success: false, error: `File not found: ${filePath}` };
  }

  return {
    success: false,
    error: 'Instagram requires a publicly accessible image URL. Please ensure your media is accessible via the /api/media endpoint.',
  };
}

// ── Media Insights ─────────────────────────────────────────────

/**
 * Fetch insights for a published Instagram media post.
 */
export async function getMediaInsights(
  creds: InstagramCredentials,
  mediaId: string
): Promise<InstagramMediaInsights | null> {
  const url = new URL(`${GRAPH_BASE}/${encodeURIComponent(mediaId)}/insights`);
  url.searchParams.set('metric', 'impressions,reach,likes,comments,saved,shares');
  url.searchParams.set('access_token', creds.accessToken);

  try {
    const { data } = await graphFetch(url.toString());
    if (isGraphError(data)) return null;

    const metrics = data.data as Array<{ name: string; values: Array<{ value: number }> }>;
    if (!metrics) return null;

    const result: InstagramMediaInsights = {};
    for (const metric of metrics) {
      const val = metric.values?.[0]?.value || 0;
      switch (metric.name) {
        case 'impressions':
          result.impressions = val;
          break;
        case 'reach':
          result.reach = val;
          break;
        case 'likes':
          result.likes = val;
          break;
        case 'comments':
          result.comments = val;
          break;
        case 'saved':
          result.saves = val;
          break;
        case 'shares':
          result.shares = val;
          break;
      }
    }

    return result;
  } catch {
    return null;
  }
}

// ── Account Insights ───────────────────────────────────────────

export interface InstagramAccountInsights {
  impressions?: number;
  reach?: number;
  profileViews?: number;
  followersCount?: number;
}

/**
 * Fetch account-level insights for an Instagram Business account.
 */
export async function getAccountInsights(
  creds: InstagramCredentials,
  since?: Date,
  until?: Date
): Promise<InstagramAccountInsights | null> {
  const url = new URL(`${GRAPH_BASE}/${encodeURIComponent(creds.accountId)}/insights`);
  url.searchParams.set('metric', 'impressions,reach,profile_views');
  url.searchParams.set('period', 'day');
  url.searchParams.set('access_token', creds.accessToken);

  if (since) url.searchParams.set('since', String(Math.floor(since.getTime() / 1000)));
  if (until) url.searchParams.set('until', String(Math.floor(until.getTime() / 1000)));

  try {
    const { data } = await graphFetch(url.toString());
    if (isGraphError(data)) return null;

    const metrics = data.data as Array<{ name: string; values: Array<{ value: number }> }>;
    if (!metrics) return null;

    const result: InstagramAccountInsights = {};
    for (const metric of metrics) {
      const latestValue = metric.values?.[metric.values.length - 1]?.value || 0;
      switch (metric.name) {
        case 'impressions':
          result.impressions = latestValue;
          break;
        case 'reach':
          result.reach = latestValue;
          break;
        case 'profile_views':
          result.profileViews = latestValue;
          break;
      }
    }

    return result;
  } catch {
    return null;
  }
}

// ── Connection Health Check ────────────────────────────────────

/**
 * Run a health check on all Instagram connections.
 */
export async function healthCheckAllConnections(): Promise<{
  total: number;
  valid: number;
  invalid: number;
}> {
  const connections = await db.platformConnection.findMany({
    where: { platform: 'INSTAGRAM', status: 'CONNECTED' },
  });

  let valid = 0;
  let invalid = 0;

  for (const conn of connections) {
    try {
      const creds = decryptInstagramCredentials(conn);
      const info = await validateToken(creds);

      if (info) {
        valid++;
      } else {
        invalid++;
        await db.platformConnection.update({
          where: { id: conn.id },
          data: {
            status: 'ERROR',
            lastError: 'Token invalid or expired. Please reconnect Instagram.',
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

    await new Promise((r) => setTimeout(r, 500));
  }

  return { total: connections.length, valid, invalid };
}
