/**
 * Media-Platform Compatibility Tests
 *
 * Tests the logic that determines which media items are compatible
 * with specific platform + content format combinations in the autopilot.
 *
 * Coverage:
 * 1. Unit tests — compatibility logic for each platform
 * 2. Format-specific tests — Reels, Stories, Videos, Text posts
 * 3. Edge cases — null formats, unknown platforms
 * 4. Sort/filter behavior
 */

// ── Replicate the compatibility function from autopilot-post-manager.tsx ──

interface MediaItem {
  id: string;
  type: string;
  filename: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  duration: number | null;
}

function getMediaCompatibility(
  media: MediaItem,
  platform: string,
  contentFormat: string | null,
  postType: string | null,
): { compatible: boolean; reason: string | null; recommended: boolean } {
  const isVideo = media.type === 'VIDEO';
  const isImage = media.type === 'IMAGE';
  const format = (contentFormat || '').toLowerCase();
  const pType = (postType || '').toLowerCase();

  const needsVideo =
    format.includes('reel') ||
    format.includes('short video') ||
    format.includes('vertical video') ||
    pType === 'reel' ||
    pType === 'story';

  const textOnly =
    format.includes('thread') ||
    format.includes('question') ||
    format.includes('poll') ||
    format.includes('ama') ||
    format.includes('discussion');

  if (platform === 'TIKTOK') {
    if (isImage) return { compatible: false, reason: 'TikTok requires video content', recommended: false };
    return { compatible: true, reason: null, recommended: true };
  }

  if (needsVideo) {
    if (isImage) {
      return { compatible: false, reason: `${contentFormat || 'This format'} requires video`, recommended: false };
    }
    return { compatible: true, reason: null, recommended: true };
  }

  if (textOnly && platform === 'THREADS') {
    return { compatible: true, reason: isVideo ? 'Video not typical for text posts' : null, recommended: isImage };
  }

  if (platform === 'INSTAGRAM' && pType !== 'reel' && pType !== 'story') {
    return { compatible: true, reason: isVideo ? 'Will auto-convert to Reel' : null, recommended: isImage };
  }

  if (platform === 'YOUTUBE') {
    if (isImage) return { compatible: true, reason: 'YouTube is primarily video', recommended: false };
    return { compatible: true, reason: null, recommended: true };
  }

  if (platform === 'PINTEREST') {
    return { compatible: true, reason: isVideo ? 'Images perform better on Pinterest' : null, recommended: isImage };
  }

  if (platform === 'MEDIUM' || platform === 'DEVTO') {
    if (isVideo) return { compatible: false, reason: 'Articles use images only', recommended: false };
    return { compatible: true, reason: null, recommended: true };
  }

  return { compatible: true, reason: null, recommended: true };
}

// ── Test Data ──

const VIDEO_MP4: MediaItem = {
  id: 'vid_001', type: 'VIDEO', filename: 'promo-reel.mp4',
  mimeType: 'video/mp4', width: 1080, height: 1920, duration: 30,
};

const VIDEO_SHORT: MediaItem = {
  id: 'vid_002', type: 'VIDEO', filename: 'quick-clip.mp4',
  mimeType: 'video/mp4', width: 1080, height: 1920, duration: 15,
};

const IMAGE_JPG: MediaItem = {
  id: 'img_001', type: 'IMAGE', filename: 'product-photo.jpg',
  mimeType: 'image/jpeg', width: 1080, height: 1080, duration: null,
};

const IMAGE_PNG: MediaItem = {
  id: 'img_002', type: 'IMAGE', filename: 'infographic.png',
  mimeType: 'image/png', width: 1080, height: 1350, duration: null,
};

// ═══════════════════════════════════════════════════════════════
// 1. INSTAGRAM
// ═══════════════════════════════════════════════════════════════

describe('Media Compatibility — Instagram', () => {
  test('Reels format: video is compatible + recommended', () => {
    const result = getMediaCompatibility(VIDEO_MP4, 'INSTAGRAM', 'Reels (15-60s)', null);
    expect(result.compatible).toBe(true);
    expect(result.recommended).toBe(true);
    expect(result.reason).toBeNull();
  });

  test('Reels format: image is NOT compatible', () => {
    const result = getMediaCompatibility(IMAGE_JPG, 'INSTAGRAM', 'Reels (15-60s)', null);
    expect(result.compatible).toBe(false);
    expect(result.reason).toContain('requires video');
  });

  test('Feed post (no reel): image is recommended', () => {
    const result = getMediaCompatibility(IMAGE_JPG, 'INSTAGRAM', 'Carousel', null);
    expect(result.compatible).toBe(true);
    expect(result.recommended).toBe(true);
  });

  test('Feed post: video is compatible but shows conversion note', () => {
    const result = getMediaCompatibility(VIDEO_MP4, 'INSTAGRAM', 'Carousel', null);
    expect(result.compatible).toBe(true);
    expect(result.reason).toBe('Will auto-convert to Reel');
  });

  test('Story postType: video is required', () => {
    const result = getMediaCompatibility(IMAGE_JPG, 'INSTAGRAM', null, 'story');
    expect(result.compatible).toBe(false);
    expect(result.reason).toContain('requires video');
  });

  test('Reel postType: video is required', () => {
    const result = getMediaCompatibility(IMAGE_JPG, 'INSTAGRAM', null, 'reel');
    expect(result.compatible).toBe(false);
  });

  test('Reel postType: video is perfect', () => {
    const result = getMediaCompatibility(VIDEO_MP4, 'INSTAGRAM', null, 'reel');
    expect(result.compatible).toBe(true);
    expect(result.recommended).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// 2. FACEBOOK
// ═══════════════════════════════════════════════════════════════

describe('Media Compatibility — Facebook', () => {
  test('Reels (vertical video) format: video is recommended', () => {
    const result = getMediaCompatibility(VIDEO_MP4, 'FACEBOOK', 'Reels (vertical video)', null);
    expect(result.compatible).toBe(true);
    expect(result.recommended).toBe(true);
  });

  test('Reels (vertical video) format: image is NOT compatible', () => {
    const result = getMediaCompatibility(IMAGE_JPG, 'FACEBOOK', 'Reels (vertical video)', null);
    expect(result.compatible).toBe(false);
    expect(result.reason).toContain('requires video');
  });

  test('Standard post: both image and video are compatible', () => {
    const imgResult = getMediaCompatibility(IMAGE_JPG, 'FACEBOOK', null, null);
    expect(imgResult.compatible).toBe(true);
    expect(imgResult.recommended).toBe(true);

    const vidResult = getMediaCompatibility(VIDEO_MP4, 'FACEBOOK', null, null);
    expect(vidResult.compatible).toBe(true);
    expect(vidResult.recommended).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// 3. THREADS
// ═══════════════════════════════════════════════════════════════

describe('Media Compatibility — Threads', () => {
  test('Question/poll format: image is recommended', () => {
    const result = getMediaCompatibility(IMAGE_JPG, 'THREADS', 'Question/poll', null);
    expect(result.compatible).toBe(true);
    expect(result.recommended).toBe(true);
  });

  test('Question/poll format: video has warning but is compatible', () => {
    const result = getMediaCompatibility(VIDEO_MP4, 'THREADS', 'Question/poll', null);
    expect(result.compatible).toBe(true);
    expect(result.recommended).toBe(false);
    expect(result.reason).toBe('Video not typical for text posts');
  });

  test('Thread format: image is compatible', () => {
    const result = getMediaCompatibility(IMAGE_JPG, 'THREADS', 'Thread', null);
    expect(result.compatible).toBe(true);
    expect(result.recommended).toBe(true);
  });

  test('Standard post (no format): both types compatible', () => {
    const imgResult = getMediaCompatibility(IMAGE_JPG, 'THREADS', null, null);
    expect(imgResult.compatible).toBe(true);

    const vidResult = getMediaCompatibility(VIDEO_MP4, 'THREADS', null, null);
    expect(vidResult.compatible).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// 4. TIKTOK
// ═══════════════════════════════════════════════════════════════

describe('Media Compatibility — TikTok', () => {
  test('video is always compatible and recommended', () => {
    const result = getMediaCompatibility(VIDEO_MP4, 'TIKTOK', 'Short video', null);
    expect(result.compatible).toBe(true);
    expect(result.recommended).toBe(true);
  });

  test('image is NEVER compatible on TikTok', () => {
    const result = getMediaCompatibility(IMAGE_JPG, 'TIKTOK', null, null);
    expect(result.compatible).toBe(false);
    expect(result.reason).toBe('TikTok requires video content');
  });

  test('image with any format is still incompatible on TikTok', () => {
    const result = getMediaCompatibility(IMAGE_PNG, 'TIKTOK', 'Short video', null);
    expect(result.compatible).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// 5. YOUTUBE
// ═══════════════════════════════════════════════════════════════

describe('Media Compatibility — YouTube', () => {
  test('video is recommended', () => {
    const result = getMediaCompatibility(VIDEO_MP4, 'YOUTUBE', 'Long-form 8-15min', null);
    expect(result.compatible).toBe(true);
    expect(result.recommended).toBe(true);
  });

  test('image is compatible but not recommended', () => {
    const result = getMediaCompatibility(IMAGE_JPG, 'YOUTUBE', null, null);
    expect(result.compatible).toBe(true);
    expect(result.recommended).toBe(false);
    expect(result.reason).toBe('YouTube is primarily video');
  });
});

// ═══════════════════════════════════════════════════════════════
// 6. PINTEREST
// ═══════════════════════════════════════════════════════════════

describe('Media Compatibility — Pinterest', () => {
  test('image is recommended', () => {
    const result = getMediaCompatibility(IMAGE_JPG, 'PINTEREST', 'Idea Pin', null);
    expect(result.compatible).toBe(true);
    expect(result.recommended).toBe(true);
  });

  test('video is compatible but not recommended', () => {
    const result = getMediaCompatibility(VIDEO_MP4, 'PINTEREST', null, null);
    expect(result.compatible).toBe(true);
    expect(result.recommended).toBe(false);
    expect(result.reason).toBe('Images perform better on Pinterest');
  });
});

// ═══════════════════════════════════════════════════════════════
// 7. MEDIUM / DEVTO
// ═══════════════════════════════════════════════════════════════

describe('Media Compatibility — Medium/DevTo', () => {
  test('Medium: image is compatible and recommended', () => {
    const result = getMediaCompatibility(IMAGE_JPG, 'MEDIUM', 'Featured Image', null);
    expect(result.compatible).toBe(true);
    expect(result.recommended).toBe(true);
  });

  test('Medium: video is NOT compatible', () => {
    const result = getMediaCompatibility(VIDEO_MP4, 'MEDIUM', null, null);
    expect(result.compatible).toBe(false);
    expect(result.reason).toBe('Articles use images only');
  });

  test('DevTo: image is compatible and recommended', () => {
    const result = getMediaCompatibility(IMAGE_PNG, 'DEVTO', 'Cover Image', null);
    expect(result.compatible).toBe(true);
    expect(result.recommended).toBe(true);
  });

  test('DevTo: video is NOT compatible', () => {
    const result = getMediaCompatibility(VIDEO_MP4, 'DEVTO', null, null);
    expect(result.compatible).toBe(false);
    expect(result.reason).toBe('Articles use images only');
  });
});

// ═══════════════════════════════════════════════════════════════
// 8. GENERIC PLATFORMS (Twitter, LinkedIn, Mastodon, etc.)
// ═══════════════════════════════════════════════════════════════

describe('Media Compatibility — Generic Platforms', () => {
  const genericPlatforms = ['TWITTER', 'LINKEDIN', 'MASTODON', 'BLUESKY', 'TELEGRAM', 'DISCORD', 'REDDIT'];

  test.each(genericPlatforms)('%s: image is compatible + recommended for standard posts', (platform) => {
    const result = getMediaCompatibility(IMAGE_JPG, platform, null, null);
    expect(result.compatible).toBe(true);
    expect(result.recommended).toBe(true);
  });

  test.each(genericPlatforms)('%s: video is compatible + recommended for standard posts', (platform) => {
    const result = getMediaCompatibility(VIDEO_MP4, platform, null, null);
    expect(result.compatible).toBe(true);
    expect(result.recommended).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// 9. FORMAT-SPECIFIC PATTERNS
// ═══════════════════════════════════════════════════════════════

describe('Media Compatibility — Video-Required Formats', () => {
  const videoFormats = [
    'Reels (15-60s)',
    'Short video (15-60s)',
    'Reels (vertical video)',
    'Vertical video',
  ];

  test.each(videoFormats)('format "%s": video is compatible, image is NOT', (format) => {
    const vidResult = getMediaCompatibility(VIDEO_MP4, 'FACEBOOK', format, null);
    expect(vidResult.compatible).toBe(true);
    expect(vidResult.recommended).toBe(true);

    const imgResult = getMediaCompatibility(IMAGE_JPG, 'FACEBOOK', format, null);
    expect(imgResult.compatible).toBe(false);
    expect(imgResult.reason).toContain('requires video');
  });
});

describe('Media Compatibility — Text-Based Formats on Threads', () => {
  const textFormats = ['Question/poll', 'Thread', 'Discussion', 'AMA'];

  test.each(textFormats)('format "%s": image recommended, video has warning', (format) => {
    const imgResult = getMediaCompatibility(IMAGE_JPG, 'THREADS', format, null);
    expect(imgResult.compatible).toBe(true);
    expect(imgResult.recommended).toBe(true);

    const vidResult = getMediaCompatibility(VIDEO_MP4, 'THREADS', format, null);
    expect(vidResult.compatible).toBe(true);
    expect(vidResult.recommended).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// 10. EDGE CASES
// ═══════════════════════════════════════════════════════════════

describe('Media Compatibility — Edge Cases', () => {
  test('null contentFormat and null postType: defaults to compatible', () => {
    const result = getMediaCompatibility(IMAGE_JPG, 'FACEBOOK', null, null);
    expect(result.compatible).toBe(true);
  });

  test('empty string contentFormat: defaults to compatible', () => {
    const result = getMediaCompatibility(VIDEO_MP4, 'INSTAGRAM', '', null);
    expect(result.compatible).toBe(true);
  });

  test('unknown platform: defaults to compatible for both types', () => {
    const imgResult = getMediaCompatibility(IMAGE_JPG, 'UNKNOWN_PLATFORM', null, null);
    expect(imgResult.compatible).toBe(true);
    expect(imgResult.recommended).toBe(true);

    const vidResult = getMediaCompatibility(VIDEO_MP4, 'UNKNOWN_PLATFORM', null, null);
    expect(vidResult.compatible).toBe(true);
  });

  test('case insensitive format matching', () => {
    // The function lowercases format before checking
    const result = getMediaCompatibility(IMAGE_JPG, 'FACEBOOK', 'REELS (VERTICAL VIDEO)', null);
    expect(result.compatible).toBe(false);
    expect(result.reason).toContain('requires video');
  });

  test('postType takes precedence for reel/story detection', () => {
    // Even without contentFormat, postType='reel' triggers video requirement
    const result = getMediaCompatibility(IMAGE_JPG, 'INSTAGRAM', null, 'reel');
    expect(result.compatible).toBe(false);
  });

  test('both contentFormat and postType set: both checked', () => {
    const result = getMediaCompatibility(VIDEO_MP4, 'INSTAGRAM', 'Reels (15-60s)', 'reel');
    expect(result.compatible).toBe(true);
    expect(result.recommended).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// 11. HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function getMediaLabel(media: MediaItem): string {
  const name = media.filename;
  const base = name.replace(/\.[^.]+$/, '');
  return base.length > 20 ? base.substring(0, 18) + '...' : base;
}

describe('Helper Functions', () => {
  describe('formatDuration', () => {
    test('formats 0 seconds', () => expect(formatDuration(0)).toBe('0:00'));
    test('formats 30 seconds', () => expect(formatDuration(30)).toBe('0:30'));
    test('formats 60 seconds', () => expect(formatDuration(60)).toBe('1:00'));
    test('formats 90 seconds', () => expect(formatDuration(90)).toBe('1:30'));
    test('formats 5 minutes', () => expect(formatDuration(300)).toBe('5:00'));
    test('formats 10:45', () => expect(formatDuration(645)).toBe('10:45'));
    test('handles fractional seconds', () => expect(formatDuration(30.7)).toBe('0:30'));
  });

  describe('getMediaLabel', () => {
    test('strips extension', () => {
      const m = { ...IMAGE_JPG, filename: 'photo.jpg' };
      expect(getMediaLabel(m)).toBe('photo');
    });

    test('truncates long names', () => {
      const m = { ...IMAGE_JPG, filename: 'very-long-filename-that-exceeds-twenty-chars.png' };
      // 18 chars + "..." = 21 total — keeps it compact
      expect(getMediaLabel(m).length).toBeLessThanOrEqual(21);
      expect(getMediaLabel(m)).toContain('...');
    });

    test('handles name without extension', () => {
      const m = { ...IMAGE_JPG, filename: 'noext' };
      expect(getMediaLabel(m)).toBe('noext');
    });

    test('handles multiple dots in filename', () => {
      const m = { ...IMAGE_JPG, filename: 'my.photo.v2.jpg' };
      expect(getMediaLabel(m)).toBe('my.photo.v2');
    });
  });
});
