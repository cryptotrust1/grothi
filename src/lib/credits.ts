import { db } from './db';
import type { ActionType } from '@prisma/client';

const DEFAULT_ACTION_COSTS: Record<string, number> = {
  GENERATE_CONTENT: 5,
  POST: 2,
  REPLY: 3,
  FAVOURITE: 1,
  BOOST: 1,
  SCAN_FEEDS: 2,
  COLLECT_METRICS: 1,
  GENERATE_IMAGE: 3,
  GENERATE_VIDEO: 8,
  SAFETY_BLOCK: 0,
  BAN_DETECTED: 0,
  SEND_EMAIL: 1,
  GENERATE_EMAIL: 3,
};

export async function getActionCost(actionType: ActionType): Promise<number> {
  const customCost = await db.actionCost.findUnique({
    where: { actionType },
  });
  return customCost?.credits ?? DEFAULT_ACTION_COSTS[actionType] ?? 1;
}

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

export async function deductCredits(
  userId: string,
  amount: number,
  description: string,
  botId?: string
): Promise<boolean> {
  return await db.$transaction(async (tx) => {
    // Atomically check and deduct credits using update with where condition
    // This prevents race conditions - only succeeds if balance >= amount
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

    // Get the new balance for transaction record
    const newBalanceRecord = await tx.creditBalance.findUnique({
      where: { userId },
      select: { balance: true },
    });

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
}

export async function addCredits(
  userId: string,
  amount: number,
  type: 'PURCHASE' | 'BONUS' | 'REFUND' | 'SUBSCRIPTION',
  description: string,
  stripePaymentId?: string
): Promise<number> {
  return await db.$transaction(async (tx) => {
    const balance = await tx.creditBalance.upsert({
      where: { userId },
      create: { userId, balance: amount },
      update: { balance: { increment: amount } },
    });

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
}

export const WELCOME_BONUS_CREDITS = 100;
