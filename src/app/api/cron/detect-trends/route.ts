/**
 * POST /api/cron/detect-trends
 *
 * Scans RSS feeds for viral trends and updates hype detection state.
 * Uses Welford's algorithm for spike detection and Berger's STEPPS framework.
 *
 * Called every 10 minutes by external cron.
 *
 * For each active bot:
 * 1. Fetches bot's configured RSS feeds + trend detection feeds
 * 2. Parses and extracts topics
 * 3. Detects spikes using z-score analysis
 * 4. Generates hype alerts for relevant trends
 * 5. Updates bot.algorithmConfig with new hype state
 * 6. Logs activity as DETECT_TREND action
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  parseRSSFeed,
  processRSSBatch,
  getHypeState,
  mergeHypeState,
  TREND_RSS_FEEDS,
} from '@/lib/hype-engine';
import type { RSSItem } from '@/lib/hype-engine';

const CRON_SECRET = process.env.CRON_SECRET;

/** Maximum number of bots to process per invocation */
const BATCH_SIZE = 20;

/** Timeout for individual RSS feed fetch (ms) */
const FETCH_TIMEOUT = 8000;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = authHeader?.replace('Bearer ', '');

  if (!CRON_SECRET || cronSecret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[detect-trends] Starting trend detection scan...');
  const startTime = Date.now();

  try {
    // Get active bots with RSS feeds configured
    const bots = await db.bot.findMany({
      where: {
        status: { in: ['ACTIVE', 'PAUSED'] },
      },
      select: {
        id: true,
        rssFeeds: true,
        keywords: true,
        instructions: true,
        brandName: true,
        goal: true,
        algorithmConfig: true,
        userId: true,
      },
      take: BATCH_SIZE,
    });

    if (bots.length === 0) {
      return NextResponse.json({ message: 'No bots to scan', duration: Date.now() - startTime });
    }

    let totalAlerts = 0;
    let totalTrends = 0;
    let botsProcessed = 0;

    for (const bot of bots) {
      try {
        // Build list of RSS feeds to scan
        const feedUrls: { url: string; name: string }[] = [];

        // Add bot's configured RSS feeds
        if (bot.rssFeeds && Array.isArray(bot.rssFeeds)) {
          for (const feed of bot.rssFeeds as { url: string; name?: string }[]) {
            if (feed.url) {
              feedUrls.push({ url: feed.url, name: feed.name || feed.url });
            }
          }
        }

        // Add general trend detection feeds (always include for broad trend awareness)
        for (const trendFeed of TREND_RSS_FEEDS) {
          feedUrls.push({ url: trendFeed.url, name: trendFeed.name });
        }

        if (feedUrls.length === 0) continue;

        // Fetch all feeds in parallel
        const allItems: RSSItem[] = [];
        const feedPromises = feedUrls.map(async (feed) => {
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

            const response = await fetch(feed.url, {
              signal: controller.signal,
              headers: {
                'User-Agent': 'Grothi/1.0 (+https://grothi.com)',
                'Accept': 'application/rss+xml, application/xml, text/xml, application/atom+xml',
              },
            });

            clearTimeout(timeout);

            if (!response.ok) {
              console.warn(`[detect-trends] Feed fetch failed: ${feed.name} (${response.status})`);
              return [];
            }

            const xml = await response.text();
            return parseRSSFeed(xml, feed.name);
          } catch (err) {
            // Network errors, timeouts — silently skip
            console.warn(`[detect-trends] Feed error: ${feed.name} - ${err instanceof Error ? err.message : 'Unknown'}`);
            return [];
          }
        });

        const results = await Promise.allSettled(feedPromises);
        for (const result of results) {
          if (result.status === 'fulfilled') {
            allItems.push(...result.value);
          }
        }

        if (allItems.length === 0) continue;

        // Process RSS batch through hype detection engine
        const currentState = getHypeState(bot.algorithmConfig);
        const botKeywords = Array.isArray(bot.keywords)
          ? (bot.keywords as string[])
          : [];

        const { updatedState, newTrends, newAlerts } = processRSSBatch(
          currentState,
          allItems,
          botKeywords,
          bot.instructions || '',
          bot.brandName,
          bot.goal
        );

        // Save updated hype state
        const updatedConfig = mergeHypeState(bot.algorithmConfig, updatedState);
        await db.bot.update({
          where: { id: bot.id },
          data: { algorithmConfig: updatedConfig as unknown as import('@prisma/client').Prisma.InputJsonValue },
        });

        // Log activity if trends were detected
        if (newAlerts.length > 0) {
          await db.botActivity.create({
            data: {
              botId: bot.id,
              platform: 'TWITTER', // Use TWITTER as default platform for trend scanning
              action: 'DETECT_TREND',
              content: `Detected ${newTrends.length} trends, generated ${newAlerts.length} alerts. Top: ${newAlerts[0]?.topic || 'N/A'} (score: ${newAlerts[0]?.hypeScore || 0})`,
              success: true,
              creditsUsed: 0,
            },
          });
        }

        totalAlerts += newAlerts.length;
        totalTrends += newTrends.length;
        botsProcessed++;

      } catch (botErr) {
        console.error(`[detect-trends] Error processing bot ${bot.id}:`, botErr);
        continue;
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[detect-trends] Complete. ${botsProcessed} bots, ${totalTrends} trends, ${totalAlerts} alerts. ${duration}ms`);

    return NextResponse.json({
      botsProcessed,
      totalTrends,
      totalAlerts,
      duration,
    });

  } catch (err) {
    console.error('[detect-trends] Fatal error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
