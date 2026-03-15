import { db } from './db';
import type { ActionType, CreditSource } from '@prisma/client';
import { CREDIT_COSTS, BILLING_LIMITS } from './billing';

// ============ DEFAULT ACTION COSTS ============
// Kept for backward compatibility — getActionCost checks DB override first

const DEFAULT_ACTION_COSTS: Record<string, number> = {
  GENERATE_CONTENT: CREDIT_COSTS.GENERATE_CONTENT,
  POST: CREDIT_COSTS.POST,
  REPLY: CREDIT_COSTS.REPLY,
  FAVOURITE: CREDIT_COSTS.FAVOURITE,
  BOOST: CREDIT_COSTS.BOOST,
  SCAN_FEEDS: CREDIT_COSTS.SCAN_FEEDS,
  COLLECT_METRICS: CREDIT_COSTS.COLLECT_METRICS,
  GENERATE_IMAGE: CREDIT_COSTS.GENERATE_IMAGE,
  GENERATE_VIDEO: CREDIT_COSTS.GENERATE_VIDEO,
  SAFETY_BLOCK: CREDIT_COSTS.SAFETY_BLOCK,
  BAN_DETECTED: CREDIT_COSTS.BAN_DETECTED,
  SEND_EMAIL: CREDIT_COSTS.SEND_EMAIL,
  GENERATE_EMAIL: CREDIT_COSTS.GENERATE_EMAIL,
};

export async function getActionCost(actionType: ActionType): Promise<number> {
  const customCost = await db.actionCost.findUnique({
    where: { actionType },
  });
  return customCost?.credits ?? DEFAULT_ACTION_COSTS[actionType] ?? 1;
}

// ============ BALANCE QUERIES ============

export async function getUserBalance(userId: string): Promise<number> {
  const balance = await db.creditBalance.findUnique({
    where: { userId },
  });
  return balance?.balance ?? 0;
}

export async function hasEnoughCredits(userId: string, amount: number): Promise<boolean> {
  const balance = await getUserBalance(userId);
  return balance >= amount;
}

/**
 * Get detailed credit breakdown from ledger.
 * Returns how many credits are from each source.
 */
export async function getCreditBreakdown(userId: string): Promise<{
  total: number;
  topup: number;
  rollover: number;
  subscription: number;
  bonus: number;
}> {
  try {
    const now = new Date();
    const entries = await db.creditLedger.findMany({
      where: {
        userId,
        remaining: { gt: 0 },
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: now } },
        ],
      },
      select: { source: true, remaining: true },
    });

    const breakdown = { total: 0, topup: 0, rollover: 0, subscription: 0, bonus: 0 };
    for (const entry of entries) {
      breakdown.total += entry.remaining;
      switch (entry.source) {
        case 'TOPUP': breakdown.topup += entry.remaining; break;
        case 'ROLLOVER': breakdown.rollover += entry.remaining; break;
        case 'SUBSCRIPTION': breakdown.subscription += entry.remaining; break;
        case 'BONUS': breakdown.bonus += entry.remaining; break;
      }
    }
    return breakdown;
  } catch (error) {
    // CreditLedger table may not exist yet if billing migration hasn't been applied
    console.error('[credits] getCreditBreakdown failed (CreditLedger may not exist):', error instanceof Error ? error.message : error);
    return { total: 0, topup: 0, rollover: 0, subscription: 0, bonus: 0 };
  }
}

// ============ FIFO CREDIT DEDUCTION ============
// Priority: TOPUP → ROLLOVER → SUBSCRIPTION → BONUS

const DEDUCTION_PRIORITY: CreditSource[] = ['TOPUP', 'ROLLOVER', 'SUBSCRIPTION', 'BONUS'];

/**
 * Deduct credits using FIFO ordering.
 * Consumes from ledger entries in priority: TOPUP > ROLLOVER > SUBSCRIPTION > BONUS.
 * Within each priority, consumes oldest entries first.
 *
 * Also decrements CreditBalance.balance and logs a CreditTransaction.
 *
 * @returns true if deduction succeeded, false if insufficient credits.
 */
export async function deductCredits(
  userId: string,
  amount: number,
  description: string,
  botId?: string
): Promise<boolean> {
  if (amount <= 0) return true;

  // Core transaction: deduct balance + log (uses existing tables)
  // Uses Serializable isolation to guarantee no concurrent deductions
  // can both succeed when balance is barely sufficient.
  const success = await db.$transaction(async (tx) => {
    // 1. Atomically check and deduct balance (prevents race conditions)
    const updated = await tx.creditBalance.updateMany({
      where: {
        userId,
        balance: { gte: amount },
      },
      data: {
        balance: { decrement: amount },
      },
    });

    // If no rows updated, user didn't have enough credits
    if (updated.count === 0) {
      return false;
    }

    // 2. Get the new balance for transaction record
    const newBalanceRecord = await tx.creditBalance.findUnique({
      where: { userId },
      select: { balance: true },
    });

    // 3. Log transaction
    await tx.creditTransaction.create({
      data: {
        userId,
        type: 'USAGE',
        amount: -amount,
        balance: newBalanceRecord?.balance ?? 0,
        description,
        botId,
      },
    });

    return true;
  });

  if (!success) return false;

  // Non-critical: FIFO deduction from ledger + subscription counter
  // These use new tables that may not exist yet
  try {
    await db.$transaction(async (tx) => {
      const now = new Date();
      let remaining = amount;

      for (const source of DEDUCTION_PRIORITY) {
        if (remaining <= 0) break;

        const entries = await tx.creditLedger.findMany({
          where: {
            userId,
            source,
            remaining: { gt: 0 },
            OR: [
              { expiresAt: null },
              { expiresAt: { gt: now } },
            ],
          },
          orderBy: { createdAt: 'asc' },
        });

        for (const entry of entries) {
          if (remaining <= 0) break;

          const consume = Math.min(remaining, entry.remaining);
          await tx.creditLedger.update({
            where: { id: entry.id },
            data: { remaining: entry.remaining - consume },
          });
          remaining -= consume;
        }
      }

      // Update subscription usage counter if active
      await tx.subscription.updateMany({
        where: { userId, status: 'ACTIVE' },
        data: { creditsUsedThisPeriod: { increment: amount } },
      });
    });
  } catch (error) {
    console.error('[credits] FIFO ledger deduction failed (tables may not exist):', error instanceof Error ? error.message : error);
  }

  return true;
}

// ============ CREDIT ADDITION ============

/**
 * Add credits to a user's account.
 * Creates both a CreditBalance increment and a CreditLedger entry.
 */
export async function addCredits(
  userId: string,
  amount: number,
  type: 'PURCHASE' | 'BONUS' | 'REFUND' | 'SUBSCRIPTION' | 'TOPUP' | 'ROLLOVER',
  description: string,
  stripePaymentId?: string,
  options?: {
    source?: CreditSource;
    expiresAt?: Date | null;
    subscriptionId?: string;
    topupPurchaseId?: string;
  }
): Promise<number> {
  if (amount <= 0) return await getUserBalance(userId);

  // Core transaction: update balance + log transaction (uses existing tables)
  const newBalance = await db.$transaction(async (tx) => {
    // 1. Update aggregate balance
    const balance = await tx.creditBalance.upsert({
      where: { userId },
      create: { userId, balance: amount },
      update: { balance: { increment: amount } },
    });

    // 2. Log transaction
    await tx.creditTransaction.create({
      data: {
        userId,
        type,
        amount,
        balance: balance.balance,
        description,
        stripePaymentId,
      },
    });

    return balance.balance;
  });

  // 3. Create ledger entry for FIFO tracking (non-critical, table may not exist yet)
  try {
    const source = options?.source ?? mapTxnTypeToSource(type);
    await db.creditLedger.create({
      data: {
        userId,
        source,
        amount,
        remaining: amount,
        expiresAt: options?.expiresAt ?? null,
        subscriptionId: options?.subscriptionId,
        topupPurchaseId: options?.topupPurchaseId,
        description,
      },
    });
  } catch (error) {
    console.error('[credits] CreditLedger entry failed (table may not exist):', error instanceof Error ? error.message : error);
  }

  return newBalance;
}

function mapTxnTypeToSource(type: string): CreditSource {
  switch (type) {
    case 'SUBSCRIPTION': return 'SUBSCRIPTION';
    case 'TOPUP':
    case 'PURCHASE': return 'TOPUP';
    case 'ROLLOVER': return 'ROLLOVER';
    default: return 'BONUS';
  }
}

// ============ SUBSCRIPTION CREDIT ALLOCATION ============

/**
 * Allocate monthly credits for a subscription renewal.
 * Called when Stripe invoice.paid fires for a subscription.
 *
 * Handles rollover for Gold/Diamond plans.
 */
export async function allocateSubscriptionCredits(
  userId: string,
  subscriptionId: string,
  monthlyCredits: number,
  allowRollover: boolean,
  maxRolloverCredits: number,
  periodEnd: Date,
  stripeInvoiceId?: string,
): Promise<void> {
  await db.$transaction(async (tx) => {
    // 1. Handle rollover from previous period
    if (allowRollover && maxRolloverCredits > 0) {
      // Sum up remaining SUBSCRIPTION credits from previous period
      const prevEntries = await tx.creditLedger.findMany({
        where: {
          userId,
          source: 'SUBSCRIPTION',
          remaining: { gt: 0 },
          subscriptionId,
        },
      });

      let rolloverAmount = 0;
      for (const entry of prevEntries) {
        rolloverAmount += entry.remaining;
        // Zero out old subscription entries
        await tx.creditLedger.update({
          where: { id: entry.id },
          data: { remaining: 0 },
        });
      }

      // Also zero out old ROLLOVER entries
      const prevRollovers = await tx.creditLedger.findMany({
        where: {
          userId,
          source: 'ROLLOVER',
          remaining: { gt: 0 },
        },
      });

      for (const entry of prevRollovers) {
        rolloverAmount += entry.remaining;
        await tx.creditLedger.update({
          where: { id: entry.id },
          data: { remaining: 0 },
        });
      }

      // Cap rollover at max allowed
      rolloverAmount = Math.min(rolloverAmount, maxRolloverCredits);

      if (rolloverAmount > 0) {
        // Create rollover ledger entry (expires at end of next period)
        await tx.creditLedger.create({
          data: {
            userId,
            source: 'ROLLOVER',
            amount: rolloverAmount,
            remaining: rolloverAmount,
            expiresAt: periodEnd,
            subscriptionId,
            description: `Rollover from previous period (${rolloverAmount} credits)`,
          },
        });

        // Log rollover transaction
        await tx.creditTransaction.create({
          data: {
            userId,
            type: 'ROLLOVER',
            amount: rolloverAmount,
            balance: 0, // Will be updated below
            description: `Credit rollover: ${rolloverAmount} credits`,
          },
        });
      }
    } else {
      // No rollover — expire old subscription credits
      await tx.creditLedger.updateMany({
        where: {
          userId,
          source: 'SUBSCRIPTION',
          remaining: { gt: 0 },
          subscriptionId,
        },
        data: { remaining: 0 },
      });

      // Also expire old rollover entries
      await tx.creditLedger.updateMany({
        where: {
          userId,
          source: 'ROLLOVER',
          remaining: { gt: 0 },
        },
        data: { remaining: 0 },
      });
    }

    // 2. Add new subscription credits
    if (monthlyCredits > 0) {
      await tx.creditLedger.create({
        data: {
          userId,
          source: 'SUBSCRIPTION',
          amount: monthlyCredits,
          remaining: monthlyCredits,
          expiresAt: periodEnd,
          subscriptionId,
          description: `Monthly subscription credits (${monthlyCredits})`,
        },
      });
    }

    // 3. Recalculate total balance from all ledger entries
    const now = new Date();
    const allEntries = await tx.creditLedger.findMany({
      where: {
        userId,
        remaining: { gt: 0 },
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: now } },
        ],
      },
      select: { remaining: true },
    });

    const totalBalance = allEntries.reduce((sum, e) => sum + e.remaining, 0);

    await tx.creditBalance.upsert({
      where: { userId },
      create: { userId, balance: totalBalance },
      update: { balance: totalBalance },
    });

    // 4. Log subscription credit allocation (stripePaymentId used as idempotency key)
    if (monthlyCredits > 0) {
      await tx.creditTransaction.create({
        data: {
          userId,
          type: 'SUBSCRIPTION',
          amount: monthlyCredits,
          balance: totalBalance,
          description: `Monthly subscription: +${monthlyCredits} credits`,
          stripePaymentId: stripeInvoiceId,
        },
      });
    }

    // 5. Reset subscription period counters
    await tx.subscription.updateMany({
      where: { userId, id: subscriptionId },
      data: {
        creditsAllocatedThisPeriod: monthlyCredits,
        creditsUsedThisPeriod: 0,
      },
    });
  });
}

// ============ EXPIRE CREDITS ============

/**
 * Expire all ledger entries past their expiresAt date.
 * Called by a scheduled cron job (e.g., daily at 3 AM).
 */
export async function expireCredits(): Promise<number> {
  const now = new Date();

  // Find all expired entries with remaining credits
  const expired = await db.creditLedger.findMany({
    where: {
      expiresAt: { lte: now },
      remaining: { gt: 0 },
    },
  });

  if (expired.length === 0) return 0;

  // Group by userId to handle each user atomically
  const byUser: Record<string, typeof expired> = {};
  for (const entry of expired) {
    if (!byUser[entry.userId]) byUser[entry.userId] = [];
    byUser[entry.userId].push(entry);
  }

  let totalExpired = 0;

  for (const userId of Object.keys(byUser)) {
    const entries = byUser[userId];
    const userTotal = entries.reduce((sum: number, e: { remaining: number }) => sum + e.remaining, 0);

    try {
      await db.$transaction(async (tx) => {
        // Zero out all expired entries for this user
        for (const entry of entries) {
          await tx.creditLedger.update({
            where: { id: entry.id },
            data: { remaining: 0 },
          });
        }

        // Decrement balance atomically (prevent negative by clamping)
        const balance = await tx.creditBalance.findUnique({ where: { userId } });
        const currentBalance = balance?.balance ?? 0;
        const deductAmount = Math.min(userTotal, currentBalance);

        if (deductAmount > 0) {
          const updated = await tx.creditBalance.update({
            where: { userId },
            data: { balance: { decrement: deductAmount } },
          });

          // Log expiration with accurate balance
          await tx.creditTransaction.create({
            data: {
              userId,
              type: 'EXPIRED',
              amount: -deductAmount,
              balance: updated.balance,
              description: `Credits expired: ${deductAmount} credits (${entries.length} ledger entries)`,
            },
          });
        }
      });

      totalExpired += userTotal;
    } catch (error) {
      console.error(`[credits] Failed to expire credits for user ${userId}:`, error instanceof Error ? error.message : error);
    }
  }

  return totalExpired;
}

// ============ RECONCILE BALANCE ============

/**
 * Recalculate a user's CreditBalance from their ledger entries.
 * Used for admin correction / debugging.
 */
export async function reconcileBalance(userId: string): Promise<number> {
  const now = new Date();
  const entries = await db.creditLedger.findMany({
    where: {
      userId,
      remaining: { gt: 0 },
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: now } },
      ],
    },
    select: { remaining: true },
  });

  const total = entries.reduce((sum, e) => sum + e.remaining, 0);

  await db.creditBalance.upsert({
    where: { userId },
    create: { userId, balance: total },
    update: { balance: total },
  });

  return total;
}

// ============ CONSTANTS ============

export const WELCOME_BONUS_CREDITS = BILLING_LIMITS.WELCOME_BONUS;
