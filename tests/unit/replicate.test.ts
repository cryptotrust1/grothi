import {
  MODELS,
  PLATFORM_ASPECT_RATIOS,
  PLATFORM_IMAGE_DIMENSIONS,
  GENERATION_COSTS,
} from '@/lib/replicate';

describe('Replicate Configuration', () => {
  describe('MODELS', () => {
    it('should have correct image model identifier', () => {
      expect(MODELS.IMAGE).toBe('black-forest-labs/flux-1.1-pro');
    });

    it('should have correct video model identifier', () => {
      expect(MODELS.VIDEO).toBe('minimax/video-01');
    });

    it('should have correct image-to-video model identifier', () => {
      expect(MODELS.VIDEO_I2V).toBe('minimax/video-01-live');
    });

    it('should have all required model types', () => {
      expect(MODELS).toHaveProperty('IMAGE');
      expect(MODELS).toHaveProperty('VIDEO');
      expect(MODELS).toHaveProperty('VIDEO_I2V');
    });
  });

  describe('PLATFORM_ASPECT_RATIOS', () => {
    const VALID_FLUX_RATIOS = ['1:1', '16:9', '2:3', '3:2', '4:5', '5:4', '9:16', '3:4', '4:3'];

    it('should have aspect ratios for all major platforms', () => {
      const requiredPlatforms = [
        'INSTAGRAM', 'FACEBOOK', 'TWITTER', 'LINKEDIN',
        'TIKTOK', 'YOUTUBE', 'PINTEREST', 'THREADS',
      ];
      for (const p of requiredPlatforms) {
        expect(PLATFORM_ASPECT_RATIOS).toHaveProperty(p);
      }
    });

    it('should only use valid Flux 1.1 Pro aspect ratios', () => {
      for (const [platform, ratio] of Object.entries(PLATFORM_ASPECT_RATIOS)) {
        expect(VALID_FLUX_RATIOS).toContain(ratio);
      }
    });

    it('should use 1:1 for Instagram', () => {
      expect(PLATFORM_ASPECT_RATIOS.INSTAGRAM).toBe('1:1');
    });

    it('should use 9:16 for TikTok (vertical)', () => {
      expect(PLATFORM_ASPECT_RATIOS.TIKTOK).toBe('9:16');
    });

    it('should use 16:9 for YouTube (landscape)', () => {
      expect(PLATFORM_ASPECT_RATIOS.YOUTUBE).toBe('16:9');
    });

    it('should use 2:3 for Pinterest (tall vertical)', () => {
      expect(PLATFORM_ASPECT_RATIOS.PINTEREST).toBe('2:3');
    });
  });

  describe('PLATFORM_IMAGE_DIMENSIONS', () => {
    it('should have dimensions for all platforms with aspect ratios', () => {
      for (const platform of Object.keys(PLATFORM_ASPECT_RATIOS)) {
        expect(PLATFORM_IMAGE_DIMENSIONS).toHaveProperty(platform);
      }
    });

    it('should have valid width and height for each platform', () => {
      for (const [platform, dims] of Object.entries(PLATFORM_IMAGE_DIMENSIONS)) {
        expect(dims.width).toBeGreaterThan(0);
        expect(dims.height).toBeGreaterThan(0);
        expect(Number.isInteger(dims.width)).toBe(true);
        expect(Number.isInteger(dims.height)).toBe(true);
      }
    });

    it('should have correct Instagram dimensions (1080x1080)', () => {
      expect(PLATFORM_IMAGE_DIMENSIONS.INSTAGRAM).toEqual({ width: 1080, height: 1080 });
    });

    it('should have correct TikTok dimensions (1080x1920 vertical)', () => {
      expect(PLATFORM_IMAGE_DIMENSIONS.TIKTOK).toEqual({ width: 1080, height: 1920 });
    });

    it('should have correct Facebook dimensions (1200x630)', () => {
      expect(PLATFORM_IMAGE_DIMENSIONS.FACEBOOK).toEqual({ width: 1200, height: 630 });
    });
  });

  describe('GENERATION_COSTS', () => {
    it('should have image generation cost', () => {
      expect(GENERATION_COSTS.GENERATE_IMAGE).toBe(3);
    });

    it('should have video generation cost', () => {
      expect(GENERATION_COSTS.GENERATE_VIDEO).toBe(8);
    });

    it('should have video cost higher than image cost', () => {
      expect(GENERATION_COSTS.GENERATE_VIDEO).toBeGreaterThan(GENERATION_COSTS.GENERATE_IMAGE);
    });

    it('should have positive costs', () => {
      expect(GENERATION_COSTS.GENERATE_IMAGE).toBeGreaterThan(0);
      expect(GENERATION_COSTS.GENERATE_VIDEO).toBeGreaterThan(0);
    });
  });
});
