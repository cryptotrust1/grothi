/**
 * Instagram Content Validation Module
 *
 * Pre-validates ALL content BEFORE sending to Instagram API.
 * Checks image/video format, dimensions, aspect ratio, file size,
 * caption length, hashtag count, and post type requirements.
 *
 * Based on verified Instagram API specifications (Feb 2026):
 * - Images: JPEG only, 320-1440px width, 4:5 to 1.91:1 ratio, max 8MB, sRGB
 * - Reels: MP4/MOV, H.264+AAC, 3s-15min, max 300MB, 9:16 recommended
 * - Stories: JPEG (image) or MP4/MOV (video), 9:16 recommended, max 60s video
 * - Carousel: 2-10 items, same image requirements, mixed video supported
 * - Captions: max 2200 chars, max 30 hashtags, max 20 @mentions
 *
 * Sources:
 * - https://www.ayrshare.com/docs/media-guidelines/instagram
 * - https://support.buffer.com/article/622-instagrams-accepted-aspect-ratio-ranges
 * - https://getlate.dev/instagram/errors
 */

// ── Types ──────────────────────────────────────────────────────

export type InstagramPostType = 'feed' | 'reel' | 'story' | 'carousel';

export interface ValidationIssue {
  field: string;
  severity: 'error' | 'warning';
  message: string;
  /** Suggestion to fix the issue */
  fix?: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

export interface ImageMeta {
  width: number;
  height: number;
  /** File size in bytes */
  sizeBytes: number;
  /** MIME type (e.g. image/jpeg) */
  mimeType: string;
  /** Original filename */
  filename?: string;
}

export interface VideoMeta {
  width?: number;
  height?: number;
  /** Duration in seconds */
  durationSeconds?: number;
  /** File size in bytes */
  sizeBytes: number;
  /** MIME type (e.g. video/mp4) */
  mimeType: string;
  /** Frames per second */
  fps?: number;
  /** Original filename */
  filename?: string;
}

export interface CaptionMeta {
  text: string;
}

// ── Constants (verified specifications) ────────────────────────

/** Image specs */
const IMAGE_MIN_WIDTH = 320;
const IMAGE_MAX_WIDTH = 1440;
const IMAGE_MIN_ASPECT = 0.8;     // 4:5
const IMAGE_MAX_ASPECT = 1.91;    // 1.91:1
const IMAGE_MAX_SIZE_BYTES = 8 * 1024 * 1024; // 8 MB
const IMAGE_ALLOWED_MIMES = ['image/jpeg', 'image/jpg'];

/** Video/Reel specs */
const REEL_MIN_DURATION = 3;
const REEL_MAX_DURATION = 900;      // 15 minutes
const REEL_TAB_MAX_DURATION = 90;   // Reels tab eligibility
const REEL_MAX_SIZE_BYTES = 300 * 1024 * 1024; // 300 MB
const REEL_MAX_WIDTH = 1920;
const REEL_MAX_HEIGHT = 3600;
const REEL_MIN_FPS = 23;
const REEL_MAX_FPS = 60;
const VIDEO_ALLOWED_MIMES = ['video/mp4', 'video/quicktime', 'video/mov'];

/** Story specs */
const STORY_VIDEO_MAX_DURATION = 60;  // 60 seconds
const STORY_VIDEO_MAX_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB
const STORY_IMAGE_MAX_SIZE_BYTES = IMAGE_MAX_SIZE_BYTES; // 8 MB

/** Carousel specs */
const CAROUSEL_MIN_ITEMS = 2;
const CAROUSEL_MAX_ITEMS = 10;
const CAROUSEL_VIDEO_MAX_DURATION = 60; // 60 seconds per item
const CAROUSEL_VIDEO_MAX_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB per item

/** Caption specs */
const CAPTION_MAX_LENGTH = 2200;
const CAPTION_MAX_HASHTAGS = 30;
const CAPTION_MAX_MENTIONS = 20;

/** Recommended dimensions for optimal quality */
export const RECOMMENDED_DIMENSIONS = {
  feed_square: { width: 1080, height: 1080, label: 'Square (1:1)' },
  feed_portrait: { width: 1080, height: 1350, label: 'Portrait (4:5)' },
  feed_landscape: { width: 1080, height: 566, label: 'Landscape (1.91:1)' },
  reel: { width: 1080, height: 1920, label: 'Reel/Story (9:16)' },
  story: { width: 1080, height: 1920, label: 'Story (9:16)' },
} as const;

// ── Helper Functions ───────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getAspectRatio(width: number, height: number): number {
  return width / height;
}

function formatRatio(ratio: number): string {
  return ratio.toFixed(2);
}

/**
 * Count hashtags in text. A hashtag is # followed by alphanumeric/underscore characters.
 * Handles Unicode letters for international hashtags.
 */
export function countHashtags(text: string): number {
  const matches = text.match(/(?:^|\s)#[a-zA-Z0-9_\u00C0-\u024F\u1E00-\u1EFF]+/g);
  return matches ? matches.length : 0;
}

/**
 * Count @mentions in text.
 */
export function countMentions(text: string): number {
  const matches = text.match(/(?:^|\s)@[a-zA-Z0-9_.]+/g);
  return matches ? matches.length : 0;
}

/**
 * Count characters using grapheme clusters (proper Unicode counting).
 * Emojis and combined characters count correctly.
 */
export function countCharacters(text: string): number {
  // Use Intl.Segmenter for proper grapheme counting if available
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
    return Array.from(segmenter.segment(text)).length;
  }
  // Fallback: Array.from handles most multi-byte chars
  return Array.from(text).length;
}

// ── Image Validation ───────────────────────────────────────────

export function validateImage(
  meta: ImageMeta,
  postType: 'feed' | 'story' | 'carousel' = 'feed'
): ValidationResult {
  const issues: ValidationIssue[] = [];

  // Format check
  if (!IMAGE_ALLOWED_MIMES.includes(meta.mimeType.toLowerCase())) {
    issues.push({
      field: 'format',
      severity: 'error',
      message: `Instagram only accepts JPEG images. Your file is ${meta.mimeType}.`,
      fix: 'Convert the image to JPEG format before uploading. PNG, WebP, GIF, and other formats are not accepted by the Instagram API.',
    });
  }

  // File size check
  const maxSize = postType === 'story' ? STORY_IMAGE_MAX_SIZE_BYTES : IMAGE_MAX_SIZE_BYTES;
  if (meta.sizeBytes > maxSize) {
    issues.push({
      field: 'fileSize',
      severity: 'error',
      message: `Image is too large: ${formatBytes(meta.sizeBytes)}. Maximum is ${formatBytes(maxSize)}.`,
      fix: 'Reduce the image quality or resize it to smaller dimensions. Recommended max width is 1440px.',
    });
  }

  // Dimension checks
  if (meta.width < IMAGE_MIN_WIDTH) {
    issues.push({
      field: 'dimensions',
      severity: 'warning',
      message: `Image width (${meta.width}px) is below minimum (${IMAGE_MIN_WIDTH}px). Instagram will upscale it, which may look blurry.`,
      fix: `Use an image at least ${IMAGE_MIN_WIDTH}px wide. Recommended: 1080px.`,
    });
  }

  if (meta.width > IMAGE_MAX_WIDTH) {
    issues.push({
      field: 'dimensions',
      severity: 'warning',
      message: `Image width (${meta.width}px) exceeds maximum (${IMAGE_MAX_WIDTH}px). Instagram will downscale it.`,
      fix: `Resize to max ${IMAGE_MAX_WIDTH}px wide for best quality control.`,
    });
  }

  // Aspect ratio check
  const ratio = getAspectRatio(meta.width, meta.height);

  if (postType === 'story') {
    // Stories should be 9:16 (0.5625)
    if (ratio < 0.5 || ratio > 0.6) {
      issues.push({
        field: 'aspectRatio',
        severity: 'warning',
        message: `Story aspect ratio is ${formatRatio(ratio)}. Instagram Stories are best at 9:16 (0.56).`,
        fix: 'Resize to 1080x1920px (9:16) for full-screen Stories display.',
      });
    }
  } else {
    // Feed and carousel: 4:5 to 1.91:1
    if (ratio < IMAGE_MIN_ASPECT) {
      issues.push({
        field: 'aspectRatio',
        severity: 'error',
        message: `Aspect ratio ${formatRatio(ratio)} is too tall. Instagram requires minimum 4:5 (${formatRatio(IMAGE_MIN_ASPECT)}).`,
        fix: `Crop the image to at least 4:5 ratio. For ${meta.width}px width, max height is ${Math.floor(meta.width / IMAGE_MIN_ASPECT)}px.`,
      });
    } else if (ratio > IMAGE_MAX_ASPECT) {
      issues.push({
        field: 'aspectRatio',
        severity: 'error',
        message: `Aspect ratio ${formatRatio(ratio)} is too wide. Instagram requires maximum 1.91:1 (${formatRatio(IMAGE_MAX_ASPECT)}).`,
        fix: `Crop the image to at most 1.91:1 ratio. For ${meta.width}px width, min height is ${Math.floor(meta.width / IMAGE_MAX_ASPECT)}px.`,
      });
    }
  }

  return {
    valid: issues.every((i) => i.severity !== 'error'),
    issues,
  };
}

// ── Video Validation ───────────────────────────────────────────

export function validateVideo(
  meta: VideoMeta,
  postType: 'reel' | 'story' | 'carousel' = 'reel'
): ValidationResult {
  const issues: ValidationIssue[] = [];

  // Format check
  if (!VIDEO_ALLOWED_MIMES.includes(meta.mimeType.toLowerCase())) {
    issues.push({
      field: 'format',
      severity: 'error',
      message: `Instagram only accepts MP4 and MOV videos. Your file is ${meta.mimeType}.`,
      fix: 'Convert the video to MP4 format with H.264 video codec and AAC audio codec.',
    });
  }

  // File size check
  let maxSize: number;
  if (postType === 'reel') {
    maxSize = REEL_MAX_SIZE_BYTES;
  } else if (postType === 'story') {
    maxSize = STORY_VIDEO_MAX_SIZE_BYTES;
  } else {
    maxSize = CAROUSEL_VIDEO_MAX_SIZE_BYTES;
  }

  if (meta.sizeBytes > maxSize) {
    issues.push({
      field: 'fileSize',
      severity: 'error',
      message: `Video is too large: ${formatBytes(meta.sizeBytes)}. Maximum for ${postType} is ${formatBytes(maxSize)}.`,
      fix: 'Reduce video quality, resolution, or duration. Re-encode with lower bitrate (recommended: 3500-5000 kbps).',
    });
  }

  // Duration check
  if (meta.durationSeconds !== undefined) {
    let maxDuration: number;
    if (postType === 'story') {
      maxDuration = STORY_VIDEO_MAX_DURATION;
    } else if (postType === 'carousel') {
      maxDuration = CAROUSEL_VIDEO_MAX_DURATION;
    } else {
      maxDuration = REEL_MAX_DURATION;
    }

    if (meta.durationSeconds < REEL_MIN_DURATION) {
      issues.push({
        field: 'duration',
        severity: 'error',
        message: `Video is too short: ${meta.durationSeconds.toFixed(1)}s. Minimum is ${REEL_MIN_DURATION} seconds.`,
        fix: `Extend the video to at least ${REEL_MIN_DURATION} seconds.`,
      });
    } else if (meta.durationSeconds > maxDuration) {
      issues.push({
        field: 'duration',
        severity: 'error',
        message: `Video is too long: ${meta.durationSeconds.toFixed(1)}s. Maximum for ${postType} is ${maxDuration} seconds.`,
        fix: `Trim the video to under ${maxDuration} seconds.`,
      });
    }

    // Reels tab eligibility warning
    if (postType === 'reel' && meta.durationSeconds > REEL_TAB_MAX_DURATION) {
      issues.push({
        field: 'duration',
        severity: 'warning',
        message: `Video is ${meta.durationSeconds.toFixed(0)}s. Only Reels under ${REEL_TAB_MAX_DURATION}s with 9:16 ratio appear in the Reels tab.`,
        fix: 'For maximum reach, keep Reels between 5-90 seconds in 9:16 vertical format.',
      });
    }
  }

  // Dimension checks
  if (meta.width !== undefined && meta.height !== undefined) {
    if (meta.width > REEL_MAX_WIDTH) {
      issues.push({
        field: 'dimensions',
        severity: 'warning',
        message: `Video width (${meta.width}px) exceeds maximum (${REEL_MAX_WIDTH}px). Instagram will downscale.`,
        fix: `Re-encode to max ${REEL_MAX_WIDTH}px wide.`,
      });
    }
    if (meta.height > REEL_MAX_HEIGHT) {
      issues.push({
        field: 'dimensions',
        severity: 'warning',
        message: `Video height (${meta.height}px) exceeds maximum (${REEL_MAX_HEIGHT}px).`,
        fix: `Re-encode to max ${REEL_MAX_HEIGHT}px tall.`,
      });
    }

    // Aspect ratio guidance
    const ratio = getAspectRatio(meta.width, meta.height);
    if (postType === 'reel' && (ratio < 0.5 || ratio > 0.6)) {
      issues.push({
        field: 'aspectRatio',
        severity: 'warning',
        message: `Reel aspect ratio is ${formatRatio(ratio)}. Instagram Reels get 2-3x more reach at 9:16 (0.56).`,
        fix: 'Re-encode to 1080x1920px (9:16 vertical) for maximum engagement.',
      });
    }

    if (postType === 'story' && (ratio < 0.5 || ratio > 0.6)) {
      issues.push({
        field: 'aspectRatio',
        severity: 'warning',
        message: `Story aspect ratio is ${formatRatio(ratio)}. Stories are displayed full-screen at 9:16.`,
        fix: 'Resize to 1080x1920px (9:16) for full-screen display.',
      });
    }
  }

  // Frame rate check
  if (meta.fps !== undefined) {
    if (meta.fps < REEL_MIN_FPS) {
      issues.push({
        field: 'frameRate',
        severity: 'error',
        message: `Frame rate (${meta.fps} FPS) is too low. Instagram requires minimum ${REEL_MIN_FPS} FPS.`,
        fix: `Re-encode the video at ${REEL_MIN_FPS}+ FPS. Recommended: 30 FPS.`,
      });
    } else if (meta.fps > REEL_MAX_FPS) {
      issues.push({
        field: 'frameRate',
        severity: 'error',
        message: `Frame rate (${meta.fps} FPS) exceeds maximum (${REEL_MAX_FPS} FPS).`,
        fix: `Re-encode the video at ${REEL_MAX_FPS} FPS or lower.`,
      });
    }
  }

  return {
    valid: issues.every((i) => i.severity !== 'error'),
    issues,
  };
}

// ── Caption Validation ─────────────────────────────────────────

export function validateCaption(
  meta: CaptionMeta,
  postType: InstagramPostType = 'feed'
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const { text } = meta;

  // Stories don't support captions via the API
  if (postType === 'story') {
    if (text && text.trim().length > 0) {
      issues.push({
        field: 'caption',
        severity: 'warning',
        message: 'Instagram Stories do not support captions via the API. Your text will be ignored.',
        fix: 'Remove the caption for Story posts, or add text as an overlay on the image/video before uploading.',
      });
    }
    return { valid: true, issues };
  }

  if (!text || text.trim().length === 0) {
    // Empty caption is valid for all types except we might want a warning
    return { valid: true, issues: [] };
  }

  // Character count
  const charCount = countCharacters(text);
  if (charCount > CAPTION_MAX_LENGTH) {
    issues.push({
      field: 'captionLength',
      severity: 'error',
      message: `Caption is ${charCount} characters. Instagram maximum is ${CAPTION_MAX_LENGTH}.`,
      fix: `Shorten the caption by ${charCount - CAPTION_MAX_LENGTH} characters.`,
    });
  } else if (charCount > CAPTION_MAX_LENGTH - 100) {
    issues.push({
      field: 'captionLength',
      severity: 'warning',
      message: `Caption is ${charCount}/${CAPTION_MAX_LENGTH} characters. Very close to the limit.`,
    });
  }

  // Hashtag count
  const hashtagCount = countHashtags(text);
  if (hashtagCount > CAPTION_MAX_HASHTAGS) {
    issues.push({
      field: 'hashtags',
      severity: 'error',
      message: `Caption has ${hashtagCount} hashtags. Instagram maximum is ${CAPTION_MAX_HASHTAGS}.`,
      fix: `Remove ${hashtagCount - CAPTION_MAX_HASHTAGS} hashtag(s). Instagram recommends 3-5 targeted hashtags for best reach.`,
    });
  } else if (hashtagCount > 15) {
    issues.push({
      field: 'hashtags',
      severity: 'warning',
      message: `Caption has ${hashtagCount} hashtags. Instagram recommends 3-5 for optimal reach. Using many hashtags may trigger spam filters.`,
    });
  }

  // Mention count
  const mentionCount = countMentions(text);
  if (mentionCount > CAPTION_MAX_MENTIONS) {
    issues.push({
      field: 'mentions',
      severity: 'error',
      message: `Caption has ${mentionCount} @mentions. Instagram maximum is ${CAPTION_MAX_MENTIONS}.`,
      fix: `Remove ${mentionCount - CAPTION_MAX_MENTIONS} mention(s).`,
    });
  }

  return {
    valid: issues.every((i) => i.severity !== 'error'),
    issues,
  };
}

// ── Carousel Validation ────────────────────────────────────────

export function validateCarousel(
  items: Array<{ type: 'image' | 'video'; meta: ImageMeta | VideoMeta }>
): ValidationResult {
  const issues: ValidationIssue[] = [];

  // Item count
  if (items.length < CAROUSEL_MIN_ITEMS) {
    issues.push({
      field: 'itemCount',
      severity: 'error',
      message: `Carousel needs at least ${CAROUSEL_MIN_ITEMS} items. You have ${items.length}.`,
      fix: `Add ${CAROUSEL_MIN_ITEMS - items.length} more image(s) or video(s).`,
    });
  } else if (items.length > CAROUSEL_MAX_ITEMS) {
    issues.push({
      field: 'itemCount',
      severity: 'error',
      message: `Carousel maximum is ${CAROUSEL_MAX_ITEMS} items. You have ${items.length}.`,
      fix: `Remove ${items.length - CAROUSEL_MAX_ITEMS} item(s).`,
    });
  }

  // Validate each item
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const label = `Item ${i + 1}`;

    let itemResult: ValidationResult;
    if (item.type === 'image') {
      itemResult = validateImage(item.meta as ImageMeta, 'carousel');
    } else {
      itemResult = validateVideo(item.meta as VideoMeta, 'carousel');
    }

    for (const issue of itemResult.issues) {
      issues.push({
        ...issue,
        field: `${label}: ${issue.field}`,
      });
    }
  }

  return {
    valid: issues.every((i) => i.severity !== 'error'),
    issues,
  };
}

// ── Full Post Validation ───────────────────────────────────────

export interface PostValidationInput {
  postType: InstagramPostType;
  caption?: string;
  /** For feed/story posts with a single image */
  image?: ImageMeta;
  /** For reel/story posts with video */
  video?: VideoMeta;
  /** For carousel posts with multiple items */
  carouselItems?: Array<{ type: 'image' | 'video'; meta: ImageMeta | VideoMeta }>;
}

/**
 * Validate an entire Instagram post before publishing.
 * Returns all errors and warnings with actionable fix suggestions.
 */
export function validatePost(input: PostValidationInput): ValidationResult {
  const issues: ValidationIssue[] = [];

  // Validate media requirements per post type
  switch (input.postType) {
    case 'feed': {
      if (!input.image) {
        issues.push({
          field: 'media',
          severity: 'error',
          message: 'Feed posts require an image. Instagram does not support text-only posts.',
          fix: 'Upload a JPEG image (recommended: 1080x1080px or 1080x1350px).',
        });
      } else {
        const imgResult = validateImage(input.image, 'feed');
        issues.push(...imgResult.issues);
      }
      break;
    }

    case 'reel': {
      if (!input.video) {
        issues.push({
          field: 'media',
          severity: 'error',
          message: 'Reels require a video file.',
          fix: 'Upload an MP4 video (recommended: 1080x1920px, 9:16 ratio, 5-90 seconds).',
        });
      } else {
        const vidResult = validateVideo(input.video, 'reel');
        issues.push(...vidResult.issues);
      }
      break;
    }

    case 'story': {
      if (!input.image && !input.video) {
        issues.push({
          field: 'media',
          severity: 'error',
          message: 'Stories require an image or video.',
          fix: 'Upload a JPEG image or MP4 video (recommended: 1080x1920px, 9:16 ratio).',
        });
      } else if (input.video) {
        const vidResult = validateVideo(input.video, 'story');
        issues.push(...vidResult.issues);
      } else if (input.image) {
        const imgResult = validateImage(input.image, 'story');
        issues.push(...imgResult.issues);
      }
      break;
    }

    case 'carousel': {
      if (!input.carouselItems || input.carouselItems.length === 0) {
        issues.push({
          field: 'media',
          severity: 'error',
          message: 'Carousel posts require 2-10 images or videos.',
          fix: 'Select 2-10 media items from your library.',
        });
      } else {
        const carResult = validateCarousel(input.carouselItems);
        issues.push(...carResult.issues);
      }
      break;
    }
  }

  // Validate caption
  if (input.caption !== undefined) {
    const capResult = validateCaption({ text: input.caption }, input.postType);
    issues.push(...capResult.issues);
  }

  return {
    valid: issues.every((i) => i.severity !== 'error'),
    issues,
  };
}

// ── Error Code Mapping ─────────────────────────────────────────

/**
 * Map Instagram API error codes to user-friendly messages with fix suggestions.
 * Based on verified error codes from Meta's API.
 */
export function getErrorExplanation(
  errorCode: number,
  errorSubcode?: number,
  errorMessage?: string
): { title: string; explanation: string; fix: string } {
  const code = errorCode;
  const sub = errorSubcode;

  if (code === 36003 && sub === 2207009) {
    return {
      title: 'Invalid Aspect Ratio',
      explanation: 'The image aspect ratio is outside Instagram\'s accepted range.',
      fix: 'Resize the image to fit between 4:5 (portrait) and 1.91:1 (landscape). Recommended: 1080x1080 (square) or 1080x1350 (portrait).',
    };
  }

  if (code === 36000 && sub === 2207004) {
    return {
      title: 'Image Too Large',
      explanation: 'The image file exceeds Instagram\'s 8MB size limit.',
      fix: 'Compress the image or reduce its resolution. Maximum recommended width is 1440px.',
    };
  }

  if (code === 36001 && sub === 2207005) {
    return {
      title: 'Unsupported Image Format',
      explanation: 'Instagram only accepts JPEG images via the API.',
      fix: 'Convert your image to JPEG format. PNG, WebP, GIF, and other formats are not accepted.',
    };
  }

  if (code === 352 && sub === 2207026) {
    return {
      title: 'Unsupported Video Format',
      explanation: 'The video format, codec, or encoding is not compatible with Instagram.',
      fix: 'Re-encode the video as MP4 with H.264 video codec and AAC audio. Use: ffmpeg -i input -c:v libx264 -c:a aac -movflags faststart output.mp4',
    };
  }

  if (sub === 2207001) {
    return {
      title: 'Server Error',
      explanation: 'Instagram\'s server encountered an error processing this content. This can be triggered by anti-spam systems.',
      fix: 'Wait a few minutes and try again. If this persists, modify the caption slightly (Instagram may detect duplicate content).',
    };
  }

  if (sub === 2207006) {
    return {
      title: 'Media Expired',
      explanation: 'The media container expired before publishing. Containers must be published within 24 hours.',
      fix: 'Create a new post and publish it promptly. Do not leave scheduled posts in PUBLISHING state.',
    };
  }

  if (code === 9007 && sub === 2207027) {
    return {
      title: 'Media Not Ready',
      explanation: 'Instagram is still processing the media. This is common for videos and high-resolution images.',
      fix: 'The system will automatically retry. If this persists, try uploading a smaller file.',
    };
  }

  if (code === 25 && sub === 2207050) {
    return {
      title: 'Account Restricted',
      explanation: 'The Instagram account is inactive, checkpointed, or restricted by Instagram.',
      fix: 'Open the Instagram app on your phone and resolve any account issues (security checks, terms acceptance).',
    };
  }

  if (code === 9 && sub === 2207042) {
    return {
      title: 'Posting Limit Reached',
      explanation: 'Instagram limits publishing to 50 posts per 24 hours.',
      fix: 'Wait before publishing more posts. The limit resets on a rolling 24-hour window.',
    };
  }

  if (code === 4 && sub === 2207051) {
    return {
      title: 'Spam Detected',
      explanation: 'Instagram flagged this content as potential spam.',
      fix: 'Vary your content and captions. Avoid identical posts, excessive hashtags, or posting too quickly.',
    };
  }

  if (code === 190) {
    return {
      title: 'Token Expired',
      explanation: 'The Instagram access token has expired or been revoked.',
      fix: 'Reconnect Instagram in Platform settings to get a fresh token.',
    };
  }

  if (code === 10) {
    return {
      title: 'Permission Denied',
      explanation: 'The app does not have the required Instagram permissions.',
      fix: 'Check Meta Developer Dashboard: ensure instagram_business_content_publish permission is approved.',
    };
  }

  if (code === 100) {
    return {
      title: 'Invalid Parameter',
      explanation: errorMessage || 'One of the parameters in the API request is invalid.',
      fix: 'Check that the media URL is publicly accessible and the image/video meets Instagram\'s specifications.',
    };
  }

  if (code === 2) {
    return {
      title: 'Unexpected Error',
      explanation: 'Instagram returned a generic server error. This usually masks a permission or configuration issue.',
      fix: 'Run Instagram diagnostics in Admin > Diagnostics to identify the specific issue.',
    };
  }

  return {
    title: `Error ${code}${sub ? ` (${sub})` : ''}`,
    explanation: errorMessage || 'An unknown Instagram API error occurred.',
    fix: 'Check the Instagram API documentation or run diagnostics for more details.',
  };
}
