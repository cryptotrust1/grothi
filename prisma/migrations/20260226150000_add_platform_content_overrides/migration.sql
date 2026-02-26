-- AlterTable: Add per-platform content strategy overrides
ALTER TABLE "PlatformContentPlan" ADD COLUMN "contentTypesOverride" JSONB;
ALTER TABLE "PlatformContentPlan" ADD COLUMN "tonesOverride" JSONB;
ALTER TABLE "PlatformContentPlan" ADD COLUMN "hashtagPatternsOverride" JSONB;
ALTER TABLE "PlatformContentPlan" ADD COLUMN "customHashtags" TEXT;
