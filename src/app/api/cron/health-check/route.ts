/**
 * POST /api/cron/health-check
 *
 * Daily health check for all platform connections.
 * Validates tokens and marks invalid ones as ERROR.
 * Also resets daily counters (postsToday, repliesToday).
 *
 * Called once per day by an external cron job.
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateCronSecret } from '@/lib/api-helpers';
import { db } from '@/lib/db';
import { healthCheckAllConnections as fbHealthCheck } from '@/lib/facebook';
import { healthCheckAllConnections as igHealthCheck } from '@/lib/instagram';
import { healthCheckAllConnections as threadsHealthCheck } from '@/lib/threads';
import { sendLowCreditWarningEmail, sendAIBudgetWarningEmail } from '@/lib/email';

/** Credits threshold below which we send admin warning (~$2 at $0.01/credit) */
const LOW_CREDIT_THRESHOLD = 200;

/** Estimated Anthropic API cost per content generation (~$0.006) */
const EST_COST_PER_GENERATION = 0.006;

export async function POST(request: NextRequest) {
  const cronError = validateCronSecret(request.headers.get('authorization'));
  if (cronError) return cronError;

  try {
    console.log('[health-check] Starting daily health check...');

    // Validate all platform connections (Facebook, Instagram, Threads)
    // Do this BEFORE resetting counters so we don't lose data if validation fails
    let fbResult: { total: number; valid: number; invalid: number } = { total: 0, valid: 0, invalid: 0 };
    let igResult: { total: number; valid: number; invalid: number; refreshed: number } = { total: 0, valid: 0, invalid: 0, refreshed: 0 };
    let threadsResult: { total: number; valid: number; invalid: number; refreshed: number } = { total: 0, valid: 0, invalid: 0, refreshed: 0 };

    try {
      fbResult = await fbHealthCheck();
      console.log(`[health-check] Facebook: ${fbResult.total} checked, ${fbResult.valid} valid, ${fbResult.invalid} invalid`);
    } catch (e) {
      console.error('[health-check] Facebook health check failed:', e instanceof Error ? e.message : e);
      fbResult = { total: 0, valid: 0, invalid: 1 };
    }

    try {
      igResult = await igHealthCheck();
      console.log(`[health-check] Instagram: ${igResult.total} checked, ${igResult.valid} valid, ${igResult.invalid} invalid, ${igResult.refreshed} refreshed`);
    } catch (e) {
      console.error('[health-check] Instagram health check failed:', e instanceof Error ? e.message : e);
      igResult = { total: 0, valid: 0, invalid: 1, refreshed: 0 };
    }

    try {
      threadsResult = await threadsHealthCheck();
      console.log(`[health-check] Threads: ${threadsResult.total} checked, ${threadsResult.valid} valid, ${threadsResult.invalid} invalid, ${threadsResult.refreshed} refreshed`);
    } catch (e) {
      console.error('[health-check] Threads health check failed:', e instanceof Error ? e.message : e);
      threadsResult = { total: 0, valid: 0, invalid: 1, refreshed: 0 };
    }

    // Reset daily counters only for connections not actively posting.
    // Connections with recent activity (last 30 min) are skipped to prevent
    // losing counter data for posts currently being published by process-posts cron.
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
    const resetResult = await db.platformConnection.updateMany({
      where: {
        OR: [
          { updatedAt: { lt: thirtyMinAgo } },
          { postsToday: 0, repliesToday: 0 }, // Already zero, safe to update
        ],
      },
      data: { postsToday: 0, repliesToday: 0 },
    });
    console.log(`[health-check] Reset daily counters for ${resetResult.count} connections`);

    // ── Credit Monitoring ──
    // Check all users with active autopilot bots for low credit balances
    const adminEmail = process.env.ADMIN_ALERT_EMAIL || process.env.CONTACT_NOTIFY_EMAIL || 'info@grothi.com';
    let creditWarningsSent = 0;

    try {
      // Find users with active autopilot bots whose credits are below threshold
      const usersWithAutopilot = await db.bot.findMany({
        where: { autonomousEnabled: true },
        select: {
          id: true,
          userId: true,
          user: { select: { id: true, email: true, name: true } },
        },
        distinct: ['userId'],
      });

      for (const botData of usersWithAutopilot) {
        const balance = await db.creditBalance.findUnique({
          where: { userId: botData.userId },
        });
        const currentBalance = balance?.balance ?? 0;

        if (currentBalance < LOW_CREDIT_THRESHOLD) {
          // Count active bots and pending posts for context
          const activeBots = await db.bot.count({
            where: { userId: botData.userId, autonomousEnabled: true },
          });
          const pendingPosts = await db.scheduledPost.count({
            where: {
              bot: { userId: botData.userId },
              source: 'AUTOPILOT',
              status: { in: ['DRAFT', 'SCHEDULED'] },
            },
          });

          await sendLowCreditWarningEmail(adminEmail, {
            userId: botData.userId,
            userEmail: botData.user.email,
            userName: botData.user.name || botData.user.email,
            currentBalance,
            threshold: LOW_CREDIT_THRESHOLD,
            activeBots,
            pendingPosts,
          });
          creditWarningsSent++;
          console.log(`[health-check] Low credit warning sent for ${botData.user.email} (${currentBalance} credits)`);
        }
      }
    } catch (e) {
      console.error('[health-check] Credit monitoring failed:', e instanceof Error ? e.message : e);
    }

    // ── AI Service Budget Check ──
    // Estimate daily AI cost based on recent generation activity
    let aiBudgetWarning = false;
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const generationsToday = await db.botActivity.count({
        where: {
          action: 'GENERATE_CONTENT',
          createdAt: { gte: todayStart },
          success: true,
        },
      });

      const estimatedDailyCost = generationsToday * EST_COST_PER_GENERATION;

      // Warn if daily cost exceeds $2 or if we're on track for >$5/day (at current rate)
      const hoursElapsed = Math.max(1, (Date.now() - todayStart.getTime()) / (1000 * 60 * 60));
      const projectedDailyCost = (estimatedDailyCost / hoursElapsed) * 24;

      if (projectedDailyCost > 5.0) {
        await sendAIBudgetWarningEmail(adminEmail, {
          service: 'Anthropic Claude API',
          estimatedBalanceUsd: -1, // Unknown — we track cost not balance
          warningThresholdUsd: 2.0,
          totalPostsToday: generationsToday,
          estimatedCostToday: estimatedDailyCost,
        });
        aiBudgetWarning = true;
        console.log(`[health-check] AI budget warning: $${estimatedDailyCost.toFixed(4)} spent today, projected $${projectedDailyCost.toFixed(2)}/day`);
      }
    } catch (e) {
      console.error('[health-check] AI budget check failed:', e instanceof Error ? e.message : e);
    }

    return NextResponse.json({
      dailyCountersReset: true,
      connectionsReset: resetResult.count,
      facebook: fbResult,
      instagram: igResult,
      threads: threadsResult,
      creditMonitoring: {
        warningsSent: creditWarningsSent,
        threshold: LOW_CREDIT_THRESHOLD,
      },
      aiBudgetWarning,
    });
  } catch (error) {
    console.error('[health-check] Unhandled error:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: 'Health check failed' },
      { status: 500 }
    );
  }
}
