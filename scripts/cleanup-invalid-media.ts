#!/usr/bin/env ts-node
/**
 * Cleanup script for invalid media records
 * 
 * This script:
 * 1. Finds media records with empty/null filePath that are not pending/processing
 * 2. Finds media records pointing to non-existent files
 * 3. Optionally deletes invalid records (dry-run by default)
 * 
 * Usage:
 *   npx ts-node scripts/cleanup-invalid-media.ts --dry-run  # Preview only
 *   npx ts-node scripts/cleanup-invalid-media.ts --execute  # Actually delete
 */

import { PrismaClient } from '@prisma/client';
import { existsSync } from 'fs';
import { join, resolve } from 'path';

const prisma = new PrismaClient();
const UPLOAD_DIR = join(process.cwd(), 'data', 'uploads');

interface CleanupOptions {
  dryRun: boolean;
  deleteOrphanDbRecords: boolean;
  deleteMissingFiles: boolean;
}

async function cleanupInvalidMedia(options: CleanupOptions) {
  console.log(`Starting cleanup (dryRun: ${options.dryRun})...\n`);

  const issues: Array<{
    id: string;
    botId: string;
    filename: string;
    issue: string;
    filePath?: string | null;
    generationStatus?: string | null;
  }> = [];

  // 1. Find records with empty filePath (using raw query for null safety)
  const emptyPathMedia = await prisma.media.findMany({
    where: {
      filePath: '',
    },
    select: {
      id: true,
      botId: true,
      filename: true,
      filePath: true,
      generationStatus: true,
      createdAt: true,
    },
  });

  for (const media of emptyPathMedia) {
    const issue =
      media.generationStatus === 'PENDING' || media.generationStatus === 'PROCESSING'
        ? 'Pending generation (OK - will be updated when done)'
        : 'Empty filePath (ORPHAN)';
    
    issues.push({
      id: media.id,
      botId: media.botId,
      filename: media.filename,
      issue,
      filePath: media.filePath,
      generationStatus: media.generationStatus,
    });
  }

  // 2. Find records with filePath but file doesn't exist on disk
  const allMedia = await prisma.media.findMany({
    where: {
      NOT: {
        filePath: '',
      },
    },
    select: {
      id: true,
      botId: true,
      filename: true,
      filePath: true,
      generationStatus: true,
    },
  });

  for (const media of allMedia) {
    if (!media.filePath) continue;

    const fullPath = resolve(join(UPLOAD_DIR, media.filePath));
    
    // Security check - ensure path is within UPLOAD_DIR
    if (!fullPath.startsWith(resolve(UPLOAD_DIR))) {
      issues.push({
        id: media.id,
        botId: media.botId,
        filename: media.filename,
        issue: 'Path traversal detected (CRITICAL)',
        filePath: media.filePath,
        generationStatus: media.generationStatus,
      });
      continue;
    }

    if (!existsSync(fullPath)) {
      issues.push({
        id: media.id,
        botId: media.botId,
        filename: media.filename,
        issue: 'File missing on disk (ORPHAN DB RECORD)',
        filePath: media.filePath,
        generationStatus: media.generationStatus,
      });
    }
  }

  // Report findings
  console.log(`Found ${issues.length} issue(s):\n`);
  
  const orphanRecords = issues.filter(i => i.issue.includes('ORPHAN') || i.issue.includes('CRITICAL'));
  const pendingRecords = issues.filter(i => i.issue.includes('Pending'));

  if (pendingRecords.length > 0) {
    console.log(`📋 Pending generations (OK): ${pendingRecords.length}`);
    pendingRecords.forEach(r => {
      console.log(`   - ${r.id} (${r.filename}) - ${r.generationStatus}`);
    });
    console.log();
  }

  if (orphanRecords.length > 0) {
    console.log(`⚠️  Orphan/Critical records to clean: ${orphanRecords.length}`);
    orphanRecords.forEach(r => {
      console.log(`   - ${r.id} (${r.filename})`);
      console.log(`     Issue: ${r.issue}`);
      console.log(`     Path: ${r.filePath || '(empty)'}`);
      console.log();
    });

    if (!options.dryRun && options.deleteOrphanDbRecords) {
      console.log('🗑️  Deleting orphan records...');
      const deleteIds = orphanRecords.map(r => r.id);
      
      // First, update any scheduled posts to remove media reference
      await prisma.scheduledPost.updateMany({
        where: { mediaId: { in: deleteIds } },
        data: { mediaId: null },
      });

      // Delete the media records
      const result = await prisma.media.deleteMany({
        where: { id: { in: deleteIds } },
      });
      console.log(`✅ Deleted ${result.count} orphan media records`);
    }
  } else {
    console.log('✅ No orphan records found');
  }

  console.log('\nCleanup completed.');
}

// Parse command line arguments
const args = process.argv.slice(2);
const options: CleanupOptions = {
  dryRun: !args.includes('--execute'),
  deleteOrphanDbRecords: args.includes('--execute') || args.includes('--delete-db'),
  deleteMissingFiles: args.includes('--delete-files'),
};

if (args.includes('--help')) {
  console.log(`
Usage: npx ts-node scripts/cleanup-invalid-media.ts [options]

Options:
  --dry-run       Preview changes without applying (default)
  --execute       Actually delete invalid records
  --help          Show this help message
`);
  process.exit(0);
}

cleanupInvalidMedia(options)
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
