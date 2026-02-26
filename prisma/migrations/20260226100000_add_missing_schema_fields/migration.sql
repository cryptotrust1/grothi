-- Migration: Add all schema fields that were deployed via db push but lack migrations
-- This migration uses IF NOT EXISTS / DO $$ checks to be idempotent
-- (safe to run even if fields already exist from previous db push)

-- ══════════════════════════════════════════════════════════════
-- 1. MISSING ENUMS
-- ══════════════════════════════════════════════════════════════

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PostSource') THEN
    CREATE TYPE "PostSource" AS ENUM ('MANUAL', 'AUTOPILOT');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ApprovalMode') THEN
    CREATE TYPE "ApprovalMode" AS ENUM ('REVIEW_ALL', 'AUTO_APPROVE');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RLDimension') THEN
    CREATE TYPE "RLDimension" AS ENUM ('TIME_SLOT', 'CONTENT_TYPE', 'HASHTAG_PATTERN', 'TONE_STYLE');
  END IF;
END $$;

-- ══════════════════════════════════════════════════════════════
-- 2. SCHEDULEDPOST - Missing columns
-- ══════════════════════════════════════════════════════════════

-- source (PostSource enum, distinguishes manual vs autopilot posts)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ScheduledPost' AND column_name = 'source'
  ) THEN
    ALTER TABLE "ScheduledPost" ADD COLUMN "source" "PostSource" NOT NULL DEFAULT 'MANUAL';
  END IF;
END $$;

-- contentFormat (best content format from platform algorithm)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ScheduledPost' AND column_name = 'contentFormat'
  ) THEN
    ALTER TABLE "ScheduledPost" ADD COLUMN "contentFormat" TEXT;
  END IF;
END $$;

-- platformContent (per-platform content/media overrides, JSON)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ScheduledPost' AND column_name = 'platformContent'
  ) THEN
    ALTER TABLE "ScheduledPost" ADD COLUMN "platformContent" JSONB;
  END IF;
END $$;

-- toneStyle (RL content strategy)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ScheduledPost' AND column_name = 'toneStyle'
  ) THEN
    ALTER TABLE "ScheduledPost" ADD COLUMN "toneStyle" TEXT;
  END IF;
END $$;

-- hashtagPattern (RL content strategy)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ScheduledPost' AND column_name = 'hashtagPattern'
  ) THEN
    ALTER TABLE "ScheduledPost" ADD COLUMN "hashtagPattern" TEXT;
  END IF;
END $$;

-- contentType
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ScheduledPost' AND column_name = 'contentType'
  ) THEN
    ALTER TABLE "ScheduledPost" ADD COLUMN "contentType" TEXT;
  END IF;
END $$;

-- autoSchedule
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ScheduledPost' AND column_name = 'autoSchedule'
  ) THEN
    ALTER TABLE "ScheduledPost" ADD COLUMN "autoSchedule" BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- ══════════════════════════════════════════════════════════════
-- 3. BOT - Missing Autopilot columns
-- ══════════════════════════════════════════════════════════════

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Bot' AND column_name = 'autonomousEnabled'
  ) THEN
    ALTER TABLE "Bot" ADD COLUMN "autonomousEnabled" BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Bot' AND column_name = 'approvalMode'
  ) THEN
    ALTER TABLE "Bot" ADD COLUMN "approvalMode" "ApprovalMode" NOT NULL DEFAULT 'REVIEW_ALL';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Bot' AND column_name = 'planDuration'
  ) THEN
    ALTER TABLE "Bot" ADD COLUMN "planDuration" INTEGER NOT NULL DEFAULT 7;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Bot' AND column_name = 'contentMixMode'
  ) THEN
    ALTER TABLE "Bot" ADD COLUMN "contentMixMode" TEXT NOT NULL DEFAULT 'AI_RECOMMENDED';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Bot' AND column_name = 'lastPlanGeneratedAt'
  ) THEN
    ALTER TABLE "Bot" ADD COLUMN "lastPlanGeneratedAt" TIMESTAMP(3);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Bot' AND column_name = 'autopilotProductRotation'
  ) THEN
    ALTER TABLE "Bot" ADD COLUMN "autopilotProductRotation" BOOLEAN NOT NULL DEFAULT true;
  END IF;
END $$;

-- Bot AI engine state fields
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Bot' AND column_name = 'imagePreferences'
  ) THEN
    ALTER TABLE "Bot" ADD COLUMN "imagePreferences" JSONB;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Bot' AND column_name = 'creativePreferences'
  ) THEN
    ALTER TABLE "Bot" ADD COLUMN "creativePreferences" JSONB;
  END IF;
END $$;

-- ══════════════════════════════════════════════════════════════
-- 4. MEDIA - Missing columns
-- ══════════════════════════════════════════════════════════════

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Media' AND column_name = 'variants'
  ) THEN
    ALTER TABLE "Media" ADD COLUMN "variants" JSONB;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Media' AND column_name = 'platformCaptions'
  ) THEN
    ALTER TABLE "Media" ADD COLUMN "platformCaptions" JSONB;
  END IF;
END $$;

-- ══════════════════════════════════════════════════════════════
-- 5. USER - Missing security/verification fields
-- ══════════════════════════════════════════════════════════════

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'User' AND column_name = 'emailVerified'
  ) THEN
    ALTER TABLE "User" ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'User' AND column_name = 'isBlocked'
  ) THEN
    ALTER TABLE "User" ADD COLUMN "isBlocked" BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- ══════════════════════════════════════════════════════════════
-- 6. INDEXES for performance
-- ══════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS "ScheduledPost_source_idx" ON "ScheduledPost"("source");
CREATE INDEX IF NOT EXISTS "ScheduledPost_botId_source_idx" ON "ScheduledPost"("botId", "source");
CREATE INDEX IF NOT EXISTS "Bot_autonomousEnabled_idx" ON "Bot"("autonomousEnabled");
