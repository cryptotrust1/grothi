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

const IG_GRAPH_VERSION = 'v22.0';
const GRAPH_BASE = `https://graph.instagram.com/${IG_GRAPH_VERSION}`;

/** Max time to wait for an image container to finish processing (ms). */
const CONTAINER_POLL_TIMEOUT = 60_000;
/** Max time to wait for a video/reel container to finish processing (ms). */
const VIDEO_CONTAINER_POLL_TIMEOUT = 180_000;
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

    let data;
    try {
      data = await res.json();
    } catch {
      const text = await res.text().catch(() => '(empty body)');
      console.error('[instagram] Non-JSON API response:', {
        status: res.status,
        url: url.toString().substring(0, 100),
        body: text.substring(0, 500),
      });
      data = {
        error: {
          message: `Instagram returned non-JSON response (HTTP ${res.status}). May indicate API maintenance or WAF block.`,
          type: 'ParseError',
          code: 2,
        },
      };
    }

    // Enhanced logging: log full details on API errors for debugging
    if (isGraphError(data)) {
      const traceId = res.headers.get('x-fb-trace-id') || 'none';
      const wwwAuth = res.headers.get('www-authenticate') || 'none';
      console.error('[instagram] API error response details:', {
        httpStatus: res.status,
        traceId,
        wwwAuthenticate: wwwAuth,
        url: url.replace(/access_token=[^&]+/, 'access_token=***').substring(0, 150),
        method: options?.method || 'GET',
        errorCode: data.error.code,
        errorType: data.error.type,
        errorSubcode: data.error.error_subcode || 'none',
        errorMessage: data.error.message?.substring(0, 200),
      });
    }

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
 * Always logs the raw error for server-side debugging (visible in PM2 logs).
 */
function friendlyIgError(data: GraphApiError): string {
  const err = data.error;
  const code = err.code;
  const sub = err.error_subcode;

  // Always log the raw error for debugging
  console.error('[instagram] Graph API error:', JSON.stringify({
    code,
    subcode: sub,
    type: err.type,
    message: err.message,
  }));

  // Token errors
  if (code === 190) return 'Instagram token expired. Please reconnect Instagram in Platforms.';
  // Permission errors
  if (code === 10 || code === 200) return 'Missing Instagram permissions. Please reconnect with full permissions.';
  // Rate limit
  if (code === 4 || code === 32) return 'Instagram rate limit reached. Posts will resume automatically.';
  // Media errors
  if (code === 36003) return 'Instagram could not download the image. Make sure the image is publicly accessible.';
  // Generic API service error (code 2)
  // Persistent code 2 (not just temporary) usually means:
  // - App is in Development mode and instagram_business_content_publish is not approved
  // - Instagram account owner is not Admin/Developer on the Meta app
  // - App review is pending
  if (code === 2) return `Instagram API error (code 2): ${err.message}. If this persists, check Meta Developer Dashboard: App permissions and ensure instagram_business_content_publish is approved. If app is in Development mode, the IG account owner must be an App Admin/Developer.`;
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

/**
 * Check if a Graph API error is transient and worth retrying.
 * Code 1 = "Unknown error" — transient server issue.
 * Code 2 = "Temporary issue" — Meta recommends retrying.
 * Note: Code 4 (rate limit) is NOT retried here — it requires longer waits
 * and is handled by the 429/throttle logic in graphFetch.
 */
function isTransientError(data: any): boolean {
  if (!isGraphError(data)) return false;
  return data.error.code === 1 || data.error.code === 2;
}

/** Max retries for transient errors (code 1, 2). */
const TRANSIENT_MAX_RETRIES = 4;
/** Base delay between retries (ms). Uses exponential backoff: 5s, 10s, 20s, 40s. */
const TRANSIENT_RETRY_BASE_DELAY = 5_000;

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

// ── Token Refresh ──────────────────────────────────────────────

/** Days before token expiry to trigger a refresh. */
const TOKEN_REFRESH_WARNING_DAYS = 10;

/**
 * Refresh an Instagram long-lived token.
 * Instagram tokens can be refreshed to get a new 60-day expiry.
 * Uses ig_refresh_token grant type on graph.instagram.com.
 */
export async function refreshToken(
  currentToken: string
): Promise<{ accessToken: string; expiresIn: number } | null> {
  const url = new URL(`${GRAPH_BASE}/refresh_access_token`);
  url.searchParams.set('grant_type', 'ig_refresh_token');
  url.searchParams.set('access_token', currentToken);

  try {
    const { data } = await graphFetch(url.toString());

    if (isGraphError(data) || !data.access_token) {
      console.error('[instagram] Token refresh failed:', JSON.stringify(data));
      return null;
    }

    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in || 5184000, // Default 60 days
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[instagram] Token refresh error:', msg);
    return null;
  }
}

/**
 * Check if a token is nearing expiry based on config data.
 */
export function isTokenNearExpiry(config: Record<string, unknown>): boolean {
  const expiresAt = config.tokenExpiresAt ? new Date(config.tokenExpiresAt as string) : null;
  if (!expiresAt || isNaN(expiresAt.getTime())) return true;

  const warningThreshold = new Date(Date.now() + TOKEN_REFRESH_WARNING_DAYS * 24 * 60 * 60 * 1000);
  return expiresAt < warningThreshold;
}

// ── Image URL Pre-Validation ──────────────────────────────────

/**
 * Verify that an image/video URL is publicly accessible before
 * sending it to Instagram's Container API.
 *
 * Instagram's servers download media from the provided URL.
 * If Cloudflare bot protection, WAF rules, or server issues block
 * the fetch, the container creation fails with error code 2.
 *
 * This pre-check catches accessibility issues early with a clear error message.
 */
async function verifyMediaUrlAccessible(url: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);

    const res = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: {
        'User-Agent': 'facebookexternalhit/1.1',
      },
    });
    clearTimeout(timer);

    if (!res.ok) {
      return {
        ok: false,
        error: `Media URL returned HTTP ${res.status}. Instagram cannot download the image. Check Cloudflare/Nginx config.`,
      };
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.startsWith('image/') && !contentType.startsWith('video/')) {
      return {
        ok: false,
        error: `Media URL returned content-type "${contentType}" instead of image/video. Cloudflare may be returning a challenge page.`,
      };
    }

    console.log('[instagram] Media URL pre-check passed:', {
      url: url.substring(0, 80),
      status: res.status,
      contentType: contentType.substring(0, 50),
    });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    if (msg.includes('AbortError') || msg.includes('aborted')) {
      return { ok: false, error: 'Media URL timed out (15s). Server may be unreachable from itself.' };
    }
    return { ok: false, error: `Media URL not accessible: ${msg}` };
  }
}

/** Calculate exponential backoff delay: base * 2^(attempt-1). */
function getRetryDelay(attempt: number): number {
  return TRANSIENT_RETRY_BASE_DELAY * Math.pow(2, attempt - 1);
}

// ── Container Status Check ─────────────────────────────────────

/**
 * Poll the container status until it finishes or times out.
 * Instagram containers go through IN_PROGRESS → FINISHED before they can be published.
 * Videos/reels get an extended timeout (180s) since processing takes longer.
 */
async function waitForContainer(
  containerId: string,
  accessToken: string,
  isVideo = false
): Promise<{ status: ContainerStatus; error?: string }> {
  const timeout = isVideo ? VIDEO_CONTAINER_POLL_TIMEOUT : CONTAINER_POLL_TIMEOUT;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
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
  // Pre-validate: check URL accessibility from this server (diagnostic only).
  // NOTE: NOT a hard failure — server checking its own URL through Cloudflare
  // is unreliable. With MEDIA_DIRECT_BASE, images bypass Cloudflare entirely.
  const urlCheck = await verifyMediaUrlAccessible(imageUrl);
  if (!urlCheck.ok) {
    console.warn('[instagram] postImage: media URL pre-check FAILED (will try Instagram API anyway):', urlCheck.error);
  }

  for (let attempt = 0; attempt <= TRANSIENT_MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        const delay = getRetryDelay(attempt);
        console.log(`[instagram] postImage: retry ${attempt}/${TRANSIENT_MAX_RETRIES}, waiting ${delay}ms`);
        await new Promise((r) => setTimeout(r, delay));
      }
      console.log(`[instagram] postImage: step 1/3 — creating container for ${imageUrl.substring(0, 100)}`);
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
        // Retry on transient errors (code 2)
        if (isTransientError(containerData) && attempt < TRANSIENT_MAX_RETRIES) {
          console.warn('[instagram] Transient error creating container, will retry:', containerData.error.message);
          continue;
        }
        return { success: false, error: friendlyIgError(containerData) };
      }

      const containerId = containerData.id;
      if (!containerId) {
        console.error('[instagram] postImage: no container ID in response:', JSON.stringify(containerData));
        return { success: false, error: 'No container ID returned from Instagram' };
      }

      console.log(`[instagram] postImage: step 2/3 — container created (id=${containerId}), polling status...`);

      // Step 2: Wait for container to finish processing
      const containerStatus = await waitForContainer(containerId, creds.accessToken);
      console.log(`[instagram] postImage: container status=${containerStatus.status}${containerStatus.error ? `, error=${containerStatus.error}` : ''}`);
      if (containerStatus.status !== 'FINISHED') {
        return { success: false, error: containerStatus.error || 'Container processing failed' };
      }

      // Step 3: Publish the container
      console.log(`[instagram] postImage: step 3/3 — publishing container ${containerId}...`);
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
        if (isTransientError(publishData) && attempt < TRANSIENT_MAX_RETRIES) {
          console.warn('[instagram] Transient error at PUBLISH step, will retry:', publishData.error.message);
          continue;
        }
        return { success: false, error: friendlyIgError(publishData) };
      }

      console.log(`[instagram] postImage: SUCCESS — mediaId=${publishData.id}`);
      return { success: true, mediaId: publishData.id };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Network error';
      if (attempt < TRANSIENT_MAX_RETRIES) {
        console.warn(`[instagram] postImage error, will retry: ${msg}`);
        continue;
      }
      return { success: false, error: msg };
    }
  }

  return { success: false, error: 'Instagram publishing failed after retries' };
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

  // Pre-validate: check URL accessibility (diagnostic only, not a hard failure)
  for (const url of imageUrls) {
    const urlCheck = await verifyMediaUrlAccessible(url);
    if (!urlCheck.ok) {
      console.warn('[instagram] postCarousel: media URL pre-check FAILED (will try anyway):', urlCheck.error);
    }
  }

  for (let attempt = 0; attempt <= TRANSIENT_MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        const delay = getRetryDelay(attempt);
        console.log(`[instagram] postCarousel: retry ${attempt}/${TRANSIENT_MAX_RETRIES}, waiting ${delay}ms`);
        await new Promise((r) => setTimeout(r, delay));
      }

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
          if (isTransientError(containerData) && attempt < TRANSIENT_MAX_RETRIES) {
            console.warn('[instagram] Transient error creating carousel item, will retry:', containerData.error.message);
            childContainerIds.length = 0; // Reset for retry
            break;
          }
          return { success: false, error: `Carousel item failed: ${friendlyIgError(containerData)}` };
        }

        childContainerIds.push(containerData.id);
      }

      // If we broke out of the inner loop due to transient error, retry
      if (childContainerIds.length !== imageUrls.length) continue;

      // Step 2: Wait for all child containers to finish
      let childFailed = false;
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
        if (isTransientError(carouselData) && attempt < TRANSIENT_MAX_RETRIES) {
          console.warn('[instagram] Transient error creating carousel container, will retry:', carouselData.error.message);
          continue;
        }
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
        if (isTransientError(publishData) && attempt < TRANSIENT_MAX_RETRIES) {
          console.warn('[instagram] Transient error publishing carousel, will retry:', publishData.error.message);
          continue;
        }
        return { success: false, error: friendlyIgError(publishData) };
      }

      return { success: true, mediaId: publishData.id };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Network error';
      if (attempt < TRANSIENT_MAX_RETRIES) {
        console.warn(`[instagram] postCarousel error, will retry: ${msg}`);
        continue;
      }
      return { success: false, error: msg };
    }
  }

  return { success: false, error: 'Instagram carousel publishing failed after retries' };
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
  // Pre-validate: check URL accessibility (diagnostic only, not a hard failure)
  const urlCheck = await verifyMediaUrlAccessible(videoUrl);
  if (!urlCheck.ok) {
    console.warn('[instagram] postReel: media URL pre-check FAILED (will try Instagram API anyway):', urlCheck.error);
  }

  for (let attempt = 0; attempt <= TRANSIENT_MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        const delay = getRetryDelay(attempt);
        console.log(`[instagram] postReel: retry ${attempt}/${TRANSIENT_MAX_RETRIES}, waiting ${delay}ms`);
        await new Promise((r) => setTimeout(r, delay));
      }
      console.log(`[instagram] postReel: step 1/3 — creating container for ${videoUrl.substring(0, 100)}`);
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
        if (isTransientError(containerData) && attempt < TRANSIENT_MAX_RETRIES) {
          console.warn('[instagram] Transient error creating reel container, will retry:', containerData.error.message);
          continue;
        }
        return { success: false, error: friendlyIgError(containerData) };
      }

      const containerId = containerData.id;
      if (!containerId) {
        console.error('[instagram] postReel: no container ID in response:', JSON.stringify(containerData));
        return { success: false, error: 'No container ID returned from Instagram' };
      }

      console.log(`[instagram] postReel: step 2/3 — container created (id=${containerId}), polling status...`);

      // Step 2: Wait for video processing (uses extended timeout)
      const containerStatus = await waitForContainer(containerId, creds.accessToken, true);
      console.log(`[instagram] postReel: container status=${containerStatus.status}${containerStatus.error ? `, error=${containerStatus.error}` : ''}`);
      if (containerStatus.status !== 'FINISHED') {
        return { success: false, error: containerStatus.error || 'Video processing failed' };
      }

      // Step 3: Publish
      console.log(`[instagram] postReel: step 3/3 — publishing container ${containerId}...`);
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
        if (isTransientError(publishData) && attempt < TRANSIENT_MAX_RETRIES) {
          console.warn('[instagram] Transient error at PUBLISH step for reel, will retry:', publishData.error.message);
          continue;
        }
        return { success: false, error: friendlyIgError(publishData) };
      }

      console.log(`[instagram] postReel: SUCCESS — mediaId=${publishData.id}`);
      return { success: true, mediaId: publishData.id };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Network error';
      if (attempt < TRANSIENT_MAX_RETRIES) {
        console.warn(`[instagram] postReel error, will retry: ${msg}`);
        continue;
      }
      return { success: false, error: msg };
    }
  }

  return { success: false, error: 'Instagram reel publishing failed after retries' };
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
 * Also checks for token expiry and attempts refresh if needed.
 */
export async function healthCheckAllConnections(): Promise<{
  total: number;
  valid: number;
  invalid: number;
  refreshed: number;
}> {
  const connections = await db.platformConnection.findMany({
    where: { platform: 'INSTAGRAM', status: 'CONNECTED' },
  });

  let valid = 0;
  let invalid = 0;
  let refreshed = 0;

  for (const conn of connections) {
    try {
      const creds = decryptInstagramCredentials(conn);
      const config = (conn.config || {}) as Record<string, unknown>;

      // Check if token needs refresh
      if (isTokenNearExpiry(config)) {
        const newTokenData = await refreshToken(creds.accessToken);
        if (newTokenData) {
          const { encrypt } = await import('./encryption');
          await db.platformConnection.update({
            where: { id: conn.id },
            data: {
              encryptedCredentials: {
                accountId: (conn.encryptedCredentials as Record<string, string>).accountId,
                accessToken: encrypt(newTokenData.accessToken),
              },
              config: {
                ...config,
                tokenRefreshedAt: new Date().toISOString(),
                tokenExpiresAt: new Date(
                  Date.now() + newTokenData.expiresIn * 1000
                ).toISOString(),
              },
            },
          });
          refreshed++;
          valid++;
          console.log(`[instagram] Token refreshed for connection ${conn.id}`);
          continue;
        }
      }

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

  return { total: connections.length, valid, invalid, refreshed };
}

// ── Token Debugging / Diagnostics ──────────────────────────────

export interface TokenDebugInfo {
  isValid: boolean;
  appId?: string;
  userId?: string;
  type?: string;
  scopes?: string[];
  expiresAt?: string;
  error?: string;
}

/**
 * Debug an Instagram access token.
 *
 * Instagram Direct Login tokens (instagram_business_* scopes) CANNOT be
 * introspected via graph.facebook.com/debug_token — that endpoint only
 * works with Facebook Login tokens. Instead we validate by calling
 * graph.instagram.com/me and checking if the token can read the profile.
 *
 * For tokens obtained via Facebook Login (legacy flow), we also try
 * graph.facebook.com/debug_token as a secondary check.
 */
export async function debugToken(accessToken: string): Promise<TokenDebugInfo> {
  try {
    // Primary check: call graph.instagram.com/me to validate the token
    // This works for both Instagram Direct Login and Facebook Login tokens
    const meUrl = new URL(`${GRAPH_BASE}/me`);
    meUrl.searchParams.set('fields', 'user_id,username,name,account_type,profile_picture_url,followers_count,media_count');
    meUrl.searchParams.set('access_token', accessToken);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    const res = await fetch(meUrl.toString(), { signal: controller.signal });
    clearTimeout(timer);

    const json = await res.json();

    console.log('[instagram] debugToken /me response:', {
      httpStatus: res.status,
      hasError: !!json.error,
      hasId: !!json.id || !!json.user_id,
      username: json.username || 'N/A',
      accountType: json.account_type || 'N/A',
      traceId: res.headers.get('x-fb-trace-id') || 'none',
    });

    if (json.error) {
      const errCode = json.error.code;
      const errMsg = json.error.message || JSON.stringify(json.error);
      let hint = '';

      if (errCode === 190) {
        hint = ' Token is expired or has been invalidated. Reconnect Instagram.';
      } else if (errCode === 10) {
        hint = ' Missing permissions or wrong account type (must be Business/Creator).';
      } else if (errCode === 4) {
        hint = ' Rate limit reached. Wait a few minutes and try again.';
      } else if (errCode === 100) {
        hint = ' Invalid parameter. The token format may be corrupted.';
      }

      return {
        isValid: false,
        error: `Instagram /me API error (HTTP ${res.status}, code ${errCode}): ${errMsg}${hint}`,
      };
    }

    const userId = json.user_id || json.id || '';
    // Instagram Direct Login tokens don't expose scopes via /me.
    // We infer: if /me works → instagram_business_basic is present.
    // We'll test content_publish separately via a container creation test.
    const scopes = ['instagram_business_basic (confirmed via /me)'];

    return {
      isValid: true,
      appId: process.env.INSTAGRAM_APP_ID || 'N/A',
      userId: String(userId),
      type: json.account_type || 'instagram_user',
      scopes,
      expiresAt: undefined, // /me doesn't return expiry; we track it in config.tokenExpiresAt
    };
  } catch (e) {
    const isTimeout = e instanceof Error && e.name === 'AbortError';
    const msg = isTimeout
      ? 'Request timed out (15s). Instagram API may be slow or unreachable.'
      : e instanceof Error ? e.message : 'Unknown error';
    return { isValid: false, error: `Token validation failed: ${msg}` };
  }
}

/**
 * Run comprehensive Instagram diagnostics for a bot connection.
 *
 * Steps:
 * 1. Check connection exists and decrypt credentials
 * 2. Validate token via graph.instagram.com/me (proper for Instagram Direct Login)
 * 3. Test account read via /{accountId} endpoint
 * 4. Test container creation (publishing permission check)
 * 5. Generate actionable recommendations
 */
export async function runDiagnostics(botId: string): Promise<{
  connection: { status: string; config: unknown } | null;
  tokenDebug: TokenDebugInfo | null;
  accountInfo: { id: string; username?: string } | null;
  publishPermission: boolean;
  testContainerResult: { success: boolean; error?: string; httpStatus?: number; rawResponse?: unknown } | null;
  recommendations: string[];
}> {
  const recommendations: string[] = [];

  // Step 1: Get connection
  const conn = await db.platformConnection.findUnique({
    where: { botId_platform: { botId, platform: 'INSTAGRAM' } },
  });

  if (!conn) {
    return {
      connection: null,
      tokenDebug: null,
      accountInfo: null,
      publishPermission: false,
      testContainerResult: null,
      recommendations: ['No Instagram connection found. Connect Instagram first.'],
    };
  }

  let creds: InstagramCredentials;
  try {
    creds = decryptInstagramCredentials(conn);
  } catch {
    return {
      connection: { status: conn.status, config: conn.config },
      tokenDebug: null,
      accountInfo: null,
      publishPermission: false,
      testContainerResult: null,
      recommendations: ['Failed to decrypt credentials. Reconnect Instagram.'],
    };
  }

  // Sanity check: ensure decrypted values look valid
  const tokenPreview = creds.accessToken ? `${creds.accessToken.substring(0, 10)}...len=${creds.accessToken.length}` : 'EMPTY';
  console.log('[instagram-diag] Starting diagnostics for bot:', botId);
  console.log('[instagram-diag] Account ID:', creds.accountId);
  console.log('[instagram-diag] Token preview:', tokenPreview);

  if (!creds.accessToken || creds.accessToken.length < 20) {
    recommendations.push(
      `Token appears invalid or corrupted (length: ${creds.accessToken?.length || 0}). ` +
      'Reconnect Instagram to get a fresh token.'
    );
  }

  if (!creds.accountId || creds.accountId === 'undefined' || creds.accountId === 'null') {
    recommendations.push(
      `Account ID is invalid: "${creds.accountId}". ` +
      'This means the OAuth flow failed to capture the Instagram user ID. Reconnect Instagram.'
    );
  }

  // Step 2: Validate token via /me endpoint
  // This is the correct way to validate Instagram Direct Login tokens.
  // (graph.facebook.com/debug_token does NOT work with Instagram Platform tokens)
  const tokenDebug = await debugToken(creds.accessToken);
  console.log('[instagram-diag] Token debug result:', JSON.stringify(tokenDebug));

  if (!tokenDebug.isValid) {
    recommendations.push(`Token validation failed: ${tokenDebug.error || 'Unknown reason'}. Reconnect Instagram in Platform settings.`);
  } else {
    // Token works for /me, so instagram_business_basic is confirmed
    recommendations.push(`Token is VALID. Account: @${tokenDebug.userId ? tokenDebug.userId : 'unknown'}, Type: ${tokenDebug.type || 'unknown'}`);
  }

  // Step 3: Validate account read via /{accountId} endpoint
  const accountInfo = await validateToken(creds);
  console.log('[instagram-diag] Account info:', accountInfo ? JSON.stringify(accountInfo) : 'null');

  if (!accountInfo) {
    // Try a raw fetch to get the actual error message
    try {
      const rawUrl = new URL(`${GRAPH_BASE}/${encodeURIComponent(creds.accountId)}`);
      rawUrl.searchParams.set('fields', 'id,username');
      rawUrl.searchParams.set('access_token', creds.accessToken);
      const rawRes = await fetch(rawUrl.toString());
      const rawJson = await rawRes.json();
      console.log('[instagram-diag] Raw account read response:', JSON.stringify(rawJson));

      if (rawJson.error) {
        recommendations.push(
          `Account read failed (code ${rawJson.error.code}): ${rawJson.error.message}. ` +
          `HTTP ${rawRes.status}. Account ID used: ${creds.accountId}`
        );
      } else {
        recommendations.push(`Account read returned unexpected response: ${JSON.stringify(rawJson).substring(0, 200)}`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      recommendations.push(`Account read request failed: ${msg}`);
    }
  }

  // Step 4: Test container creation with a known public image
  // This tests if instagram_business_content_publish permission works
  let testContainerResult: { success: boolean; error?: string; httpStatus?: number; rawResponse?: unknown } | null = null;
  // We consider publish permission confirmed only if container creation succeeds
  let publishPermission = false;

  try {
    // Use a well-known, always-accessible JPEG image (not SVG - Instagram rejects SVGs)
    const testImageUrl = 'https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png';
    const containerUrl = `${GRAPH_BASE}/${encodeURIComponent(creds.accountId)}/media`;

    console.log('[instagram-diag] Testing container creation...');
    console.log('[instagram-diag] Container URL:', containerUrl);
    console.log('[instagram-diag] Test image URL:', testImageUrl);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);

    const res = await fetch(containerUrl, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        image_url: testImageUrl,
        caption: 'Grothi diagnostic test - will be deleted',
        access_token: creds.accessToken,
      }).toString(),
    });
    clearTimeout(timer);

    const httpStatus = res.status;
    const rawResponse = await res.json().catch(() => ({}));

    console.log('[instagram-diag] Test container HTTP status:', httpStatus);
    console.log('[instagram-diag] Test container response:', JSON.stringify(rawResponse));
    console.log('[instagram-diag] Test container headers:', {
      traceId: res.headers.get('x-fb-trace-id'),
      wwwAuth: res.headers.get('www-authenticate'),
      contentType: res.headers.get('content-type'),
    });

    if (rawResponse.error) {
      const errCode = rawResponse.error.code;
      const errSubcode = rawResponse.error.error_subcode;
      const errType = rawResponse.error.type;
      const errMsg = rawResponse.error.message;

      testContainerResult = {
        success: false,
        error: `Code ${errCode}${errSubcode ? ` (subcode ${errSubcode})` : ''}: ${errMsg}`,
        httpStatus,
        rawResponse,
      };

      // Provide specific recommendations based on error code
      if (errCode === 2) {
        if (tokenDebug.isValid) {
          // Token works for /me but container creation fails → publish permission issue
          recommendations.push(
            'PUBLISH PERMISSION ISSUE: Token can read the profile (instagram_business_basic works) ' +
            'but container creation fails with error code 2. This specifically means ' +
            'instagram_business_content_publish is not working. Possible causes: ' +
            '1) The permission is not properly added in Meta Developer Dashboard > Use Cases > Instagram API > Permissions. ' +
            '2) The app needs App Review for this permission (currently "Ready for testing" is NOT the same as "Approved"). ' +
            '3) In Development mode: the Instagram account owner must be listed as Admin/Developer in the App Roles. ' +
            '4) The Instagram account @' + (tokenDebug.userId || 'unknown') + ' may need to be a Business account (not Creator).'
          );
        } else {
          recommendations.push(
            'Both token validation AND container creation fail. The token is completely broken. ' +
            'Disconnect and reconnect Instagram. If the issue persists, check: ' +
            '1) The Instagram App ID and Secret are correct in server .env ' +
            '2) The Instagram app is not suspended in Meta Developer Dashboard ' +
            '3) The Instagram account is not restricted/checkpointed by Instagram'
          );
        }
      } else if (errCode === 190) {
        recommendations.push('Token expired or revoked (code 190). Reconnect Instagram.');
      } else if (errCode === 10) {
        recommendations.push(
          `Permission error (code 10): ${errMsg}. ` +
          'The app needs the instagram_business_content_publish permission approved.'
        );
      } else if (errCode === 9 && errSubcode === 2207042) {
        recommendations.push('Post limit reached (25 posts per 24 hours). Wait and try again.');
      } else if (errCode === 100) {
        recommendations.push(`Invalid parameter (code 100): ${errMsg}. Check if Account ID "${creds.accountId}" is correct.`);
      } else {
        recommendations.push(`Container creation failed with code ${errCode}: ${errMsg}. Type: ${errType || 'unknown'}.`);
      }
    } else if (rawResponse.id) {
      testContainerResult = {
        success: true,
        httpStatus,
        rawResponse,
      };
      publishPermission = true;
      recommendations.push(
        'Container creation SUCCEEDED! instagram_business_content_publish permission is working. ' +
        'Container ID: ' + rawResponse.id + '. If individual posts still fail, the issue is with specific image URLs.'
      );
    }
  } catch (e) {
    const isTimeout = e instanceof Error && e.name === 'AbortError';
    const msg = isTimeout
      ? 'Container creation timed out (30s). Instagram API may be slow.'
      : e instanceof Error ? e.message : 'Unknown error';
    testContainerResult = { success: false, error: msg };
  }

  // Final summary recommendation
  if (tokenDebug.isValid && accountInfo && publishPermission) {
    recommendations.push('ALL CHECKS PASSED. Instagram integration is working correctly.');
  }

  return {
    connection: { status: conn.status, config: conn.config },
    tokenDebug,
    accountInfo,
    publishPermission,
    testContainerResult,
    recommendations,
  };
}
