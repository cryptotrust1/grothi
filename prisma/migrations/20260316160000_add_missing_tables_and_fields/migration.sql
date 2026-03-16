-- Migration: Create missing tables (PostEngagement, RLArmState, RLConfig) and add missing columns
-- Uses IF NOT EXISTS / DO $$ checks to be idempotent (safe if tables/columns already exist from db push)

-- ══════════════════════════════════════════════════════════════
-- 1. MISSING ENUMS
-- ══════════════════════════════════════════════════════════════

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RLDimension') THEN
    CREATE TYPE "RLDimension" AS ENUM ('TIME_SLOT', 'CONTENT_TYPE', 'HASHTAG_PATTERN', 'TONE_STYLE');
  END IF;
END $$;

-- ══════════════════════════════════════════════════════════════
-- 2. CREATE TABLE: PostEngagement
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "PostEngagement" (
  "id" TEXT NOT NULL,
  "botId" TEXT NOT NULL,
  "platform" "PlatformType" NOT NULL,
  "scheduledPostId" TEXT,
  "activityId" TEXT,
  "externalPostId" TEXT,
  "likes" INTEGER NOT NULL DEFAULT 0,
  "comments" INTEGER NOT NULL DEFAULT 0,
  "shares" INTEGER NOT NULL DEFAULT 0,
  "saves" INTEGER NOT NULL DEFAULT 0,
  "dwellTimeMs" INTEGER,
  "watchTimeSec" DOUBLE PRECISION,
  "impressions" INTEGER,
  "reach" INTEGER,
  "clickthroughs" INTEGER,
  "engagementScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "contentType" TEXT,
  "timeSlot" INTEGER,
  "dayOfWeek" INTEGER,
  "hashtagPattern" TEXT,
  "toneStyle" TEXT,
  "collectedAt" TIMESTAMP(3),
  "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PostEngagement_pkey" PRIMARY KEY ("id")
);

-- PostEngagement indexes
CREATE INDEX IF NOT EXISTS "PostEngagement_botId_platform_idx" ON "PostEngagement"("botId", "platform");
CREATE INDEX IF NOT EXISTS "PostEngagement_botId_contentType_idx" ON "PostEngagement"("botId", "contentType");

-- PostEngagement foreign key
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'PostEngagement_botId_fkey'
  ) THEN
    ALTER TABLE "PostEngagement" ADD CONSTRAINT "PostEngagement_botId_fkey"
      FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ══════════════════════════════════════════════════════════════
-- 3. CREATE TABLE: RLArmState
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "RLArmState" (
  "id" TEXT NOT NULL,
  "botId" TEXT NOT NULL,
  "platform" "PlatformType" NOT NULL,
  "dimension" "RLDimension" NOT NULL,
  "armKey" TEXT NOT NULL,
  "pulls" INTEGER NOT NULL DEFAULT 0,
  "totalReward" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "avgReward" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "lastReward" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "maxReward" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "ewmaReward" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "variance" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RLArmState_pkey" PRIMARY KEY ("id")
);

-- RLArmState unique constraint + indexes
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'RLArmState_botId_platform_dimension_armKey_key'
  ) THEN
    ALTER TABLE "RLArmState" ADD CONSTRAINT "RLArmState_botId_platform_dimension_armKey_key"
      UNIQUE ("botId", "platform", "dimension", "armKey");
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "RLArmState_botId_platform_dimension_idx" ON "RLArmState"("botId", "platform", "dimension");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'RLArmState_botId_fkey'
  ) THEN
    ALTER TABLE "RLArmState" ADD CONSTRAINT "RLArmState_botId_fkey"
      FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ══════════════════════════════════════════════════════════════
-- 4. CREATE TABLE: RLConfig
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "RLConfig" (
  "id" TEXT NOT NULL,
  "botId" TEXT NOT NULL,
  "platform" "PlatformType" NOT NULL,
  "epsilon" DOUBLE PRECISION NOT NULL DEFAULT 0.2,
  "epsilonMin" DOUBLE PRECISION NOT NULL DEFAULT 0.05,
  "epsilonDecay" DOUBLE PRECISION NOT NULL DEFAULT 0.995,
  "totalEpisodes" INTEGER NOT NULL DEFAULT 0,
  "ewmaAlpha" DOUBLE PRECISION NOT NULL DEFAULT 0.3,
  "lastPostAt" TIMESTAMP(3),
  "postsInLastHour" INTEGER NOT NULL DEFAULT 0,
  "postsInLast24Hours" INTEGER NOT NULL DEFAULT 0,
  "consecutiveSameType" INTEGER NOT NULL DEFAULT 0,
  "lastContentType" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RLConfig_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'RLConfig_botId_platform_key'
  ) THEN
    ALTER TABLE "RLConfig" ADD CONSTRAINT "RLConfig_botId_platform_key"
      UNIQUE ("botId", "platform");
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "RLConfig_botId_idx" ON "RLConfig"("botId");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'RLConfig_botId_fkey'
  ) THEN
    ALTER TABLE "RLConfig" ADD CONSTRAINT "RLConfig_botId_fkey"
      FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ══════════════════════════════════════════════════════════════
-- 5. PlatformContentPlan - Missing columns
-- ══════════════════════════════════════════════════════════════

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'PlatformContentPlan' AND column_name = 'videoLength'
  ) THEN
    ALTER TABLE "PlatformContentPlan" ADD COLUMN "videoLength" TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'PlatformContentPlan' AND column_name = 'videoFormat'
  ) THEN
    ALTER TABLE "PlatformContentPlan" ADD COLUMN "videoFormat" TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'PlatformContentPlan' AND column_name = 'videoStyleOverride'
  ) THEN
    ALTER TABLE "PlatformContentPlan" ADD COLUMN "videoStyleOverride" TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'PlatformContentPlan' AND column_name = 'postingHours'
  ) THEN
    ALTER TABLE "PlatformContentPlan" ADD COLUMN "postingHours" JSONB;
  END IF;
END $$;

-- ══════════════════════════════════════════════════════════════
-- 6. User - Missing 2FA columns
-- ══════════════════════════════════════════════════════════════

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'User' AND column_name = 'twoFactorEnabled'
  ) THEN
    ALTER TABLE "User" ADD COLUMN "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'User' AND column_name = 'twoFactorSecret'
  ) THEN
    ALTER TABLE "User" ADD COLUMN "twoFactorSecret" TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'User' AND column_name = 'twoFactorRecoveryCodes'
  ) THEN
    ALTER TABLE "User" ADD COLUMN "twoFactorRecoveryCodes" JSONB;
  END IF;
END $$;

-- ══════════════════════════════════════════════════════════════
-- 7. ScheduledPost - Missing indexes
-- ══════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS "ScheduledPost_botId_source_status_idx" ON "ScheduledPost"("botId", "source", "status");
CREATE INDEX IF NOT EXISTS "ScheduledPost_status_updatedAt_idx" ON "ScheduledPost"("status", "updatedAt");
CREATE INDEX IF NOT EXISTS "ScheduledPost_status_publishedAt_idx" ON "ScheduledPost"("status", "publishedAt");
