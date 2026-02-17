/**
 * Threads API service for Grothi.
 *
 * Handles content publishing (text, image, carousel), token management,
 * post insights, and rate-limit awareness.
 *
 * Threads publishing uses a 2-step "Container" model (same pattern as Instagram):
 *   1. Create a media container
 *   2. Publish the container
 *
 * Unlike Instagram, Threads supports text-only posts.
 *
 * Docs: https://developers.facebook.com/docs/threads/posts
 */

import { decrypt } from './encryption';
import { db } from './db';
import type { PlatformConnection } from '@prisma/client';

// ── Constants ──────────────────────────────────────────────────

const THREADS_API_VERSION = 'v1.0';
const THREADS_BASE = `https://graph.threads.net/${THREADS_API_VERSION}`;

/** Max time to wait for a container to finish processing (ms). */
const CONTAINER_POLL_TIMEOUT = 60_000;
/** Interval between container status checks (ms). */
const CONTAINER_POLL_INTERVAL = 3_000;

/** Days before token expiry to trigger a refresh warning. */
const TOKEN_REFRESH_WARNING_DAYS = 10;

// ── Types ──────────────────────────────────────────────────────

export interface ThreadsCredentials {
  /** Threads user ID. */
  userId: string;
  /** Long-lived access token (60-day expiry, refreshable). */
  accessToken: string;
}

export interface ThreadsPostResult {
  success: boolean;
  postId?: string;
  error?: string;
}

export interface ThreadsPostInsights {
  views?: number;
  likes?: number;
  replies?: number;
  reposts?: number;
  quotes?: number;
}

interface ThreadsApiError {
  error: {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
}

type ContainerStatus = 'FINISHED' | 'IN_PROGRESS' | 'ERROR' | 'EXPIRED';

// ── Credential Helpers ─────────────────────────────────────────

/**
 * Decrypt Threads credentials stored in a PlatformConnection.
 * The userId is stored in config (not encrypted), accessToken is encrypted.
 */
export function decryptThreadsCredentials(
  connection: Pick<PlatformConnection, 'encryptedCredentials' | 'config'>
): ThreadsCredentials {
  const creds = connection.encryptedCredentials as Record<string, string>;
  const config = (connection.config || {}) as Record<string, unknown>;

  return {
    userId: (config.threadsUserId as string) || '',
    accessToken: decrypt(creds.accessToken),
  };
}

/**
 * Get the decrypted Threads credentials for a bot.
 * Returns null if no connected Threads platform exists.
 */
export async function getThreadsCredentials(
  botId: string
): Promise<ThreadsCredentials | null> {
  const conn = await db.platformConnection.findUnique({
    where: { botId_platform: { botId, platform: 'THREADS' } },
  });

  if (!conn || conn.status !== 'CONNECTED') return null;

  try {
    return decryptThreadsCredentials(conn);
  } catch {
    await db.platformConnection.update({
      where: { id: conn.id },
      data: { status: 'ERROR', lastError: 'Failed to decrypt credentials' },
    });
    return null;
  }
}

// ── Core API Call ──────────────────────────────────────────────

async function threadsFetch(
  url: string,
  options?: RequestInit
): Promise<{ data: any }> {
  const res = await fetch(url, options);
  const data = await res.json();
  return { data };
}

function isApiError(data: any): data is ThreadsApiError {
  return data && typeof data === 'object' && 'error' in data;
}

/**
 * Check if a Threads API error indicates an invalid/expired token.
 */
function isTokenError(data: any): boolean {
  if (!isApiError(data)) return false;
  return data.error.code === 190;
}

// ── Token Validation & Management ──────────────────────────────

/**
 * Validate a Threads access token by fetching user profile.
 */
export async function validateToken(
  creds: ThreadsCredentials
): Promise<{ id: string; username?: string } | null> {
  // Use 'me' endpoint - most reliable, resolves via access_token
  const url = new URL(`${THREADS_BASE}/me`);
  url.searchParams.set('fields', 'id,username,threads_profile_picture_url');
  url.searchParams.set('access_token', creds.accessToken);

  try {
    const { data } = await threadsFetch(url.toString());
    if (isApiError(data)) return null;
    return { id: data.id, username: data.username };
  } catch {
    return null;
  }
}

/**
 * Validate token and update connection status accordingly.
 */
export async function validateAndUpdateConnection(botId: string): Promise<boolean> {
  const conn = await db.platformConnection.findUnique({
    where: { botId_platform: { botId, platform: 'THREADS' } },
  });
  if (!conn) return false;

  const creds = decryptThreadsCredentials(conn);
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
      lastError: 'Token invalid or expired. Please reconnect Threads.',
    },
  });
  return false;
}

/**
 * Check if the token is nearing expiry and needs refresh.
 * Returns true if token expires within TOKEN_REFRESH_WARNING_DAYS days.
 */
export function isTokenNearExpiry(config: Record<string, unknown>): boolean {
  const expiresAt = config.tokenExpiresAt ? new Date(config.tokenExpiresAt as string) : null;
  if (!expiresAt) return false;

  const warningThreshold = new Date(Date.now() + TOKEN_REFRESH_WARNING_DAYS * 24 * 60 * 60 * 1000);
  return expiresAt < warningThreshold;
}

/**
 * Refresh the Threads long-lived token.
 * Tokens can be refreshed after 24 hours and get a new 60-day expiry.
 */
export async function refreshToken(
  currentToken: string
): Promise<{ accessToken: string; expiresIn: number } | null> {
  const url = new URL('https://graph.threads.net/refresh_access_token');
  url.searchParams.set('grant_type', 'th_refresh_token');
  url.searchParams.set('access_token', currentToken);

  try {
    const res = await fetch(url.toString());
    const data = await res.json();

    if (data.error || !data.access_token) {
      return null;
    }

    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in || 5184000, // Default 60 days
    };
  } catch {
    return null;
  }
}

// ── Container Status Check ─────────────────────────────────────

/**
 * Poll the container status until it finishes or times out.
 */
async function waitForContainer(
  containerId: string,
  accessToken: string
): Promise<{ status: ContainerStatus; error?: string }> {
  const startTime = Date.now();

  while (Date.now() - startTime < CONTAINER_POLL_TIMEOUT) {
    const url = new URL(`${THREADS_BASE}/${encodeURIComponent(containerId)}`);
    url.searchParams.set('fields', 'status,error_message');
    url.searchParams.set('access_token', accessToken);

    const { data } = await threadsFetch(url.toString());

    if (isApiError(data)) {
      return { status: 'ERROR', error: data.error.message };
    }

    const status = (data.status || 'IN_PROGRESS') as ContainerStatus;

    if (status === 'FINISHED') {
      return { status: 'FINISHED' };
    }

    if (status === 'ERROR' || status === 'EXPIRED') {
      return { status, error: data.error_message || 'Container processing failed' };
    }

    await new Promise((r) => setTimeout(r, CONTAINER_POLL_INTERVAL));
  }

  return { status: 'ERROR', error: 'Container processing timed out' };
}

// ── Publishing: Text Post ──────────────────────────────────────

/**
 * Publish a text-only post to Threads.
 *
 * Flow:
 * 1. Create text container
 * 2. Wait for container to finish
 * 3. Publish the container
 */
export async function postText(
  creds: ThreadsCredentials,
  text: string
): Promise<ThreadsPostResult> {
  if (!text || text.length === 0) {
    return { success: false, error: 'Text cannot be empty' };
  }

  if (text.length > 500) {
    return { success: false, error: 'Threads posts are limited to 500 characters' };
  }

  try {
    // Step 1: Create text container
    // Use 'me' per official Threads API docs (resolves via access_token)
    const containerUrl = `${THREADS_BASE}/me/threads`;

    const { data: containerData } = await threadsFetch(containerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        media_type: 'TEXT',
        text,
        access_token: creds.accessToken,
      }).toString(),
    });

    if (isApiError(containerData)) {
      console.error('[threads] Container creation failed:', JSON.stringify(containerData.error));
      return { success: false, error: containerData.error.message };
    }

    const containerId = containerData.id;
    if (!containerId) {
      return { success: false, error: 'No container ID returned from Threads' };
    }

    // Step 2: Wait for container
    const containerStatus = await waitForContainer(containerId, creds.accessToken);
    if (containerStatus.status !== 'FINISHED') {
      return { success: false, error: containerStatus.error || 'Container processing failed' };
    }

    // Step 3: Publish
    const publishUrl = `${THREADS_BASE}/me/threads_publish`;

    const { data: publishData } = await threadsFetch(publishUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        creation_id: containerId,
        access_token: creds.accessToken,
      }).toString(),
    });

    if (isApiError(publishData)) {
      console.error('[threads] Publish failed:', JSON.stringify(publishData.error));
      return { success: false, error: publishData.error.message };
    }

    return { success: true, postId: publishData.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Network error';
    return { success: false, error: msg };
  }
}

// ── Publishing: Image Post ─────────────────────────────────────

/**
 * Publish a post with a single image to Threads.
 *
 * Flow:
 * 1. Create image container with image_url + text
 * 2. Wait for container to finish
 * 3. Publish the container
 */
export async function postWithImage(
  creds: ThreadsCredentials,
  text: string,
  imageUrl: string
): Promise<ThreadsPostResult> {
  if (text.length > 500) {
    return { success: false, error: 'Threads posts are limited to 500 characters' };
  }

  try {
    // Step 1: Create image container (use 'me' per official Threads API docs)
    const containerUrl = `${THREADS_BASE}/me/threads`;

    const { data: containerData } = await threadsFetch(containerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        media_type: 'IMAGE',
        image_url: imageUrl,
        text,
        access_token: creds.accessToken,
      }).toString(),
    });

    if (isApiError(containerData)) {
      console.error('[threads] Image container creation failed:', JSON.stringify(containerData.error));
      return { success: false, error: containerData.error.message };
    }

    const containerId = containerData.id;
    if (!containerId) {
      return { success: false, error: 'No container ID returned from Threads' };
    }

    // Step 2: Wait for container
    const containerStatus = await waitForContainer(containerId, creds.accessToken);
    if (containerStatus.status !== 'FINISHED') {
      return { success: false, error: containerStatus.error || 'Container processing failed' };
    }

    // Step 3: Publish
    const publishUrl = `${THREADS_BASE}/me/threads_publish`;

    const { data: publishData } = await threadsFetch(publishUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        creation_id: containerId,
        access_token: creds.accessToken,
      }).toString(),
    });

    if (isApiError(publishData)) {
      console.error('[threads] Image publish failed:', JSON.stringify(publishData.error));
      return { success: false, error: publishData.error.message };
    }

    return { success: true, postId: publishData.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Network error';
    return { success: false, error: msg };
  }
}

// ── Publishing: Video Post ─────────────────────────────────────

/**
 * Publish a post with a video to Threads.
 */
export async function postWithVideo(
  creds: ThreadsCredentials,
  text: string,
  videoUrl: string
): Promise<ThreadsPostResult> {
  if (text.length > 500) {
    return { success: false, error: 'Threads posts are limited to 500 characters' };
  }

  try {
    const containerUrl = `${THREADS_BASE}/me/threads`;

    const { data: containerData } = await threadsFetch(containerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        media_type: 'VIDEO',
        video_url: videoUrl,
        text,
        access_token: creds.accessToken,
      }).toString(),
    });

    if (isApiError(containerData)) {
      console.error('[threads] Video container creation failed:', JSON.stringify(containerData.error));
      return { success: false, error: containerData.error.message };
    }

    const containerId = containerData.id;
    if (!containerId) {
      return { success: false, error: 'No container ID returned from Threads' };
    }

    const containerStatus = await waitForContainer(containerId, creds.accessToken);
    if (containerStatus.status !== 'FINISHED') {
      return { success: false, error: containerStatus.error || 'Video processing failed' };
    }

    const publishUrl = `${THREADS_BASE}/me/threads_publish`;

    const { data: publishData } = await threadsFetch(publishUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        creation_id: containerId,
        access_token: creds.accessToken,
      }).toString(),
    });

    if (isApiError(publishData)) {
      console.error('[threads] Video publish failed:', JSON.stringify(publishData.error));
      return { success: false, error: publishData.error.message };
    }

    return { success: true, postId: publishData.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Network error';
    return { success: false, error: msg };
  }
}

// ── Publishing: Carousel (Multiple Images) ────────────────────

/**
 * Publish a carousel post (2-20 items) to Threads.
 *
 * Flow:
 * 1. Create a container for each image
 * 2. Wait for all containers
 * 3. Create carousel container referencing all item containers
 * 4. Wait for carousel container
 * 5. Publish
 */
export async function postCarousel(
  creds: ThreadsCredentials,
  text: string,
  imageUrls: string[]
): Promise<ThreadsPostResult> {
  if (imageUrls.length < 2 || imageUrls.length > 20) {
    return { success: false, error: 'Threads carousel requires 2-20 items' };
  }

  if (text.length > 500) {
    return { success: false, error: 'Threads posts are limited to 500 characters' };
  }

  try {
    // Step 1: Create containers for each image
    const childContainerIds: string[] = [];

    for (const imageUrl of imageUrls) {
      const containerUrl = `${THREADS_BASE}/me/threads`;

      const { data: containerData } = await threadsFetch(containerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          media_type: 'IMAGE',
          image_url: imageUrl,
          is_carousel_item: 'true',
          access_token: creds.accessToken,
        }).toString(),
      });

      if (isApiError(containerData)) {
        console.error('[threads] Carousel item creation failed:', JSON.stringify(containerData.error));
        return { success: false, error: `Carousel item failed: ${containerData.error.message}` };
      }

      childContainerIds.push(containerData.id);
    }

    // Step 2: Wait for all child containers
    for (const childId of childContainerIds) {
      const status = await waitForContainer(childId, creds.accessToken);
      if (status.status !== 'FINISHED') {
        return { success: false, error: `Carousel item processing failed: ${status.error}` };
      }
    }

    // Step 3: Create carousel container
    const carouselUrl = `${THREADS_BASE}/me/threads`;

    const { data: carouselData } = await threadsFetch(carouselUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        media_type: 'CAROUSEL',
        children: childContainerIds.join(','),
        text,
        access_token: creds.accessToken,
      }).toString(),
    });

    if (isApiError(carouselData)) {
      console.error('[threads] Carousel container creation failed:', JSON.stringify(carouselData.error));
      return { success: false, error: carouselData.error.message };
    }

    // Step 4: Wait for carousel container
    const carouselStatus = await waitForContainer(carouselData.id, creds.accessToken);
    if (carouselStatus.status !== 'FINISHED') {
      return { success: false, error: carouselStatus.error || 'Carousel processing failed' };
    }

    // Step 5: Publish
    const publishUrl = `${THREADS_BASE}/me/threads_publish`;

    const { data: publishData } = await threadsFetch(publishUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        creation_id: carouselData.id,
        access_token: creds.accessToken,
      }).toString(),
    });

    if (isApiError(publishData)) {
      console.error('[threads] Carousel publish failed:', JSON.stringify(publishData.error));
      return { success: false, error: publishData.error.message };
    }

    return { success: true, postId: publishData.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Network error';
    return { success: false, error: msg };
  }
}

// ── Post Insights ──────────────────────────────────────────────

/**
 * Fetch insights for a published Threads post.
 */
export async function getPostInsights(
  creds: ThreadsCredentials,
  postId: string
): Promise<ThreadsPostInsights | null> {
  const url = new URL(`${THREADS_BASE}/${encodeURIComponent(postId)}/insights`);
  url.searchParams.set('metric', 'views,likes,replies,reposts,quotes');
  url.searchParams.set('access_token', creds.accessToken);

  try {
    const { data } = await threadsFetch(url.toString());
    if (isApiError(data)) return null;

    const metrics = data.data as Array<{ name: string; values: Array<{ value: number }> }>;
    if (!metrics) return null;

    const result: ThreadsPostInsights = {};
    for (const metric of metrics) {
      const val = metric.values?.[0]?.value || 0;
      switch (metric.name) {
        case 'views':
          result.views = val;
          break;
        case 'likes':
          result.likes = val;
          break;
        case 'replies':
          result.replies = val;
          break;
        case 'reposts':
          result.reposts = val;
          break;
        case 'quotes':
          result.quotes = val;
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
 * Run a health check on all Threads connections.
 * Also checks for token expiry and attempts refresh if needed.
 */
export async function healthCheckAllConnections(): Promise<{
  total: number;
  valid: number;
  invalid: number;
  refreshed: number;
}> {
  const connections = await db.platformConnection.findMany({
    where: { platform: 'THREADS', status: 'CONNECTED' },
  });

  let valid = 0;
  let invalid = 0;
  let refreshed = 0;

  for (const conn of connections) {
    try {
      const creds = decryptThreadsCredentials(conn);
      const config = (conn.config || {}) as Record<string, unknown>;

      // Check if token needs refresh
      if (isTokenNearExpiry(config)) {
        const newTokenData = await refreshToken(creds.accessToken);
        if (newTokenData) {
          // Store refreshed token - import encrypt dynamically to avoid circular deps
          const { encrypt } = await import('./encryption');
          await db.platformConnection.update({
            where: { id: conn.id },
            data: {
              encryptedCredentials: {
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
            lastError: 'Token invalid or expired. Please reconnect Threads.',
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
