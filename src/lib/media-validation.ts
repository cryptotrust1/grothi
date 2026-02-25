/**
 * Media validation utilities
 * Prevents EISDIR and other file system errors by validating media records
 */

import { Media, GenerationStatus } from '@prisma/client';

export interface MediaValidationResult {
  valid: boolean;
  error?: string;
  statusCode: number;
}

/**
 * Validates if a media record can be served (has valid filePath and succeeded status)
 */
export function validateMediaForServing(media: Media): MediaValidationResult {
  // Check if filePath exists and is not empty
  if (!media.filePath || media.filePath.trim() === '') {
    // For async generations (video), return appropriate status
    if (media.generationStatus === GenerationStatus.PENDING) {
      return {
        valid: false,
        error: 'Media is pending generation',
        statusCode: 202, // Accepted
      };
    }
    if (media.generationStatus === GenerationStatus.PROCESSING) {
      return {
        valid: false,
        error: 'Media is being processed',
        statusCode: 202, // Accepted
      };
    }
    if (media.generationStatus === GenerationStatus.FAILED) {
      return {
        valid: false,
        error: 'Media generation failed',
        statusCode: 410, // Gone
      };
    }
    if (media.generationStatus === GenerationStatus.CANCELLED) {
      return {
        valid: false,
        error: 'Media generation was cancelled',
        statusCode: 410, // Gone
      };
    }
    // Unknown/invalid state
    return {
      valid: false,
      error: 'Media file path is missing',
      statusCode: 404,
    };
  }

  // For async media, only allow access when SUCCEEDED
  if (media.generationStatus && media.generationStatus !== GenerationStatus.SUCCEEDED) {
    return {
      valid: false,
      error: `Media is ${media.generationStatus.toLowerCase()}`,
      statusCode: 202,
    };
  }

  // Validate filePath format (should not contain path traversal)
  if (media.filePath.includes('..') || media.filePath.startsWith('/')) {
    return {
      valid: false,
      error: 'Invalid file path format',
      statusCode: 400,
    };
  }

  return { valid: true, statusCode: 200 };
}

/**
 * Validates if a media record can be deleted
 */
export function validateMediaForDeletion(media: Media): MediaValidationResult {
  // Allow deletion of pending/processing/failed media even without filePath
  if (
    !media.filePath ||
    media.filePath.trim() === '' ||
    media.generationStatus === GenerationStatus.PENDING ||
    media.generationStatus === GenerationStatus.PROCESSING ||
    media.generationStatus === GenerationStatus.FAILED ||
    media.generationStatus === GenerationStatus.CANCELLED
  ) {
    return { valid: true, statusCode: 200 };
  }

  // Validate filePath format
  if (media.filePath.includes('..') || media.filePath.startsWith('/')) {
    return {
      valid: false,
      error: 'Invalid file path format',
      statusCode: 400,
    };
  }

  return { valid: true, statusCode: 200 };
}

/**
 * Sanitizes filename for safe filesystem storage
 */
export function sanitizeFilename(filename: string): string {
  // Remove path traversal attempts and unsafe characters
  return filename
    .replace(/[\\/:*?"<>|]/g, '_') // Windows reserved chars
    .replace(/\.\./g, '_') // Path traversal
    .replace(/^\.+/, '') // Leading dots
    .trim() || 'unnamed';
}

/**
 * Generates a safe file path for new media uploads
 */
export function generateFilePath(
  botId: string,
  uuid: string,
  extension: string
): string {
  // Validate inputs
  if (!botId || !uuid) {
    throw new Error('botId and uuid are required');
  }
  
  // Sanitize extension
  const safeExt = extension.replace(/^\.+/, '').replace(/[^a-zA-Z0-9]/g, '');
  
  return `${botId}/${uuid}.${safeExt}`;
}
