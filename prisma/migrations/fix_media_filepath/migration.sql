-- Migration: Fix media filePath handling
-- Changes:
-- 1. Make filePath nullable to support pending generations
-- 2. Add GenerationStatus enum
-- 3. Clean up invalid records

-- Create the GenerationStatus enum type
CREATE TYPE "GenerationStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- Convert generationStatus from String to GenerationStatus enum
ALTER TABLE "Media" ALTER COLUMN "generationStatus" TYPE "GenerationStatus" 
  USING CASE 
    WHEN "generationStatus" IS NULL THEN NULL
    WHEN "generationStatus" = 'PENDING' THEN 'PENDING'::"GenerationStatus"
    WHEN "generationStatus" = 'PROCESSING' THEN 'PROCESSING'::"GenerationStatus"
    WHEN "generationStatus" = 'SUCCEEDED' THEN 'SUCCEEDED'::"GenerationStatus"
    WHEN "generationStatus" = 'FAILED' THEN 'FAILED'::"GenerationStatus"
    WHEN "generationStatus" = 'CANCELLED' THEN 'CANCELLED'::"GenerationStatus"
    ELSE NULL
  END;

-- Make filePath nullable (it was required before)
ALTER TABLE "Media" ALTER COLUMN "filePath" DROP NOT NULL;

-- Delete orphan records that have empty filePath and are not pending/processing
DELETE FROM "Media" 
WHERE ("filePath" IS NULL OR "filePath" = '') 
  AND "generationStatus" NOT IN ('PENDING', 'PROCESSING');

-- Create index for faster queries on generation status
CREATE INDEX IF NOT EXISTS "Media_generationStatus_idx" ON "Media"("generationStatus");
