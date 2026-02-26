/**
 * Photo Editor — Core types, filter presets, adjustment definitions, and social media sizes.
 *
 * Based on features from leading photo editors (CapCut, Canva, Snapseed, VSCO,
 * Adobe Lightroom Mobile, PicsArt, Pixlr, Fotor):
 *
 * - 30+ filter presets with CSS filter implementations for real-time client-side preview
 * - 15 adjustment sliders (brightness, contrast, saturation, exposure, etc.)
 * - Crop presets with all standard social media sizes
 * - Text overlay with multiple fonts, sizes, colors, and alignment
 * - Transform operations (rotate, flip, perspective)
 * - Drawing tools (brush, shapes)
 * - Frames and borders
 * - Non-destructive editing: original image is never modified; all edits are stacked
 * - Undo/redo via command stack pattern
 *
 * All filter implementations use CSS filter() and Canvas 2D operations
 * that work in all modern browsers without any external library dependency.
 */

// ── Core Types ──────────────────────────────────────────────────────────────

export type PhotoTool =
  | 'select'
  | 'crop'
  | 'text'
  | 'draw'
  | 'shape'
  | 'sticker'
  | 'frame';

export type CropMode = 'free' | 'preset';

export interface CropState {
  x: number;
  y: number;
  width: number;
  height: number;
  aspectRatio: string | null; // null = free
}

export interface TextOverlay {
  id: string;
  text: string;
  x: number;        // % from left (0-100)
  y: number;        // % from top (0-100)
  fontSize: number;  // px
  fontFamily: string;
  color: string;
  backgroundColor: string; // 'transparent' or color
  bold: boolean;
  italic: boolean;
  underline: boolean;
  textAlign: 'left' | 'center' | 'right';
  rotation: number;  // degrees
  opacity: number;   // 0-1
  letterSpacing: number; // px
  lineHeight: number; // multiplier
  shadow: boolean;
  outline: boolean;
}

export interface DrawStroke {
  id: string;
  points: { x: number; y: number }[];
  color: string;
  width: number;
  opacity: number;
  tool: 'pen' | 'marker' | 'eraser';
}

export interface ShapeOverlay {
  id: string;
  type: 'rectangle' | 'circle' | 'line' | 'arrow' | 'triangle' | 'star';
  x: number;       // % from left
  y: number;       // % from top
  width: number;   // % of image width
  height: number;  // % of image height
  color: string;
  fillColor: string; // 'transparent' for outline only
  borderWidth: number;
  rotation: number;
  opacity: number;
}

export interface FrameConfig {
  id: string;
  name: string;
  type: 'border' | 'rounded' | 'shadow' | 'polaroid' | 'film' | 'vintage' | 'none';
  color: string;
  width: number; // px for borders
  radius: number; // px for rounded corners
}

export interface PhotoAdjustments {
  brightness: number;    // -100 to 100
  contrast: number;      // -100 to 100
  saturation: number;    // -100 to 100
  exposure: number;      // -100 to 100
  highlights: number;    // -100 to 100
  shadows: number;       // -100 to 100
  warmth: number;        // -100 to 100 (temperature)
  tint: number;          // -100 to 100
  sharpness: number;     // -100 to 100
  clarity: number;       // -100 to 100
  vignette: number;      // 0 to 100
  grain: number;         // 0 to 100
  fade: number;          // 0 to 100
  dehaze: number;        // -100 to 100
  vibrance: number;      // -100 to 100
}

export interface PhotoEditorState {
  // Source
  imageId: string | null;
  originalWidth: number;
  originalHeight: number;

  // Tool
  activeTool: PhotoTool;

  // Filter
  selectedFilterId: string;

  // Adjustments
  adjustments: PhotoAdjustments;

  // Crop
  crop: CropState | null;
  rotation: number;   // degrees
  flipH: boolean;
  flipV: boolean;

  // Overlays
  textOverlays: TextOverlay[];
  drawStrokes: DrawStroke[];
  shapes: ShapeOverlay[];
  selectedOverlayId: string | null;

  // Frame
  frame: FrameConfig | null;

  // History
  undoStack: PhotoEditCommand[];
  redoStack: PhotoEditCommand[];

  // Zoom
  zoom: number; // 0.1 to 5 (1 = fit to container)
  panX: number;
  panY: number;
}

// ── Command Pattern for Undo/Redo ───────────────────────────────────────────

export interface PhotoEditCommand {
  type: string;
  description: string;
  // Stores the minimal state diff needed to undo
  previousState: Partial<PhotoEditorState>;
}

// ── Photo Filter Definitions ────────────────────────────────────────────────

export type PhotoFilterCategory =
  | 'original'
  | 'natural'
  | 'portrait'
  | 'cinematic'
  | 'vintage'
  | 'mono'
  | 'cool'
  | 'warm'
  | 'vivid'
  | 'muted'
  | 'social'
  | 'beauty'
  | 'fun';

export const PHOTO_FILTER_CATEGORY_LABELS: Record<PhotoFilterCategory, string> = {
  original:  'Original',
  natural:   'Natural',
  portrait:  'Portrait',
  beauty:    'Beauty',
  cinematic: 'Cinematic',
  vintage:   'Vintage',
  mono:      'B&W',
  cool:      'Cool',
  warm:      'Warm',
  vivid:     'Vivid',
  muted:     'Muted',
  social:    'Social',
  fun:       'Fun',
};

export interface PhotoFilter {
  id: string;
  name: string;
  category: PhotoFilterCategory;
  /** CSS filter string for real-time preview on <canvas> or <img> */
  cssFilter: string;
  /** Canvas pixel manipulation for export (when CSS filter isn't enough) */
  canvasOps?: {
    /** Color matrix [r,g,b,a, r,g,b,a, r,g,b,a, r,g,b,a, r,g,b,a] (5x4 matrix in row order) */
    colorMatrix?: number[];
    /** Curves adjustments */
    curves?: { channel: 'r' | 'g' | 'b' | 'all'; points: [number, number][] };
  };
}

// 35 filter presets covering all major categories
export const PHOTO_FILTERS: PhotoFilter[] = [
  // ── Original ──
  { id: 'original', name: 'Original', category: 'original', cssFilter: '' },

  // ── Natural ──
  { id: 'natural', name: 'Natural', category: 'natural',
    cssFilter: 'brightness(1.03) contrast(1.05) saturate(1.08)' },
  { id: 'clarity', name: 'Clarity', category: 'natural',
    cssFilter: 'brightness(1.02) contrast(1.12)' },
  { id: 'soft_light', name: 'Soft Light', category: 'natural',
    cssFilter: 'brightness(1.06) contrast(0.95) saturate(0.95)' },
  { id: 'enhance', name: 'Enhance', category: 'natural',
    cssFilter: 'brightness(1.02) contrast(1.08) saturate(1.12)' },

  // ── Portrait ──
  { id: 'glow', name: 'Glow', category: 'portrait',
    cssFilter: 'brightness(1.1) contrast(0.92) saturate(0.9) blur(0.3px)' },
  { id: 'blush', name: 'Blush', category: 'portrait',
    cssFilter: 'brightness(1.05) contrast(0.98) saturate(1.15) sepia(0.08) hue-rotate(-5deg)' },
  { id: 'porcelain', name: 'Porcelain', category: 'portrait',
    cssFilter: 'brightness(1.08) contrast(0.95) saturate(0.85)' },
  { id: 'beauty', name: 'Beauty', category: 'portrait',
    cssFilter: 'brightness(1.05) contrast(1.0) saturate(1.05) sepia(0.05)' },

  // ── Cinematic ──
  { id: 'cine', name: 'Cinema', category: 'cinematic',
    cssFilter: 'contrast(1.18) saturate(0.82) brightness(0.96) sepia(0.1) hue-rotate(-5deg)' },
  { id: 'hollywood', name: 'Hollywood', category: 'cinematic',
    cssFilter: 'contrast(1.35) saturate(1.1) brightness(0.93) sepia(0.12)' },
  { id: 'nightfall', name: 'Nightfall', category: 'cinematic',
    cssFilter: 'brightness(0.82) contrast(1.25) saturate(0.75) hue-rotate(15deg)' },
  { id: 'teal_orange', name: 'Teal & Orange', category: 'cinematic',
    cssFilter: 'contrast(1.15) saturate(1.2) brightness(0.95) sepia(0.15) hue-rotate(-10deg)' },

  // ── Vintage ──
  { id: 'kodak', name: 'Kodak', category: 'vintage',
    cssFilter: 'sepia(0.3) contrast(1.05) saturate(0.85) brightness(1.03) hue-rotate(-5deg)' },
  { id: 'fuji', name: 'Fuji', category: 'vintage',
    cssFilter: 'saturate(0.9) contrast(1.02) brightness(1.02) hue-rotate(12deg)' },
  { id: 'vintage', name: 'Vintage', category: 'vintage',
    cssFilter: 'sepia(0.55) contrast(1.08) saturate(0.7) brightness(0.92)' },
  { id: 'polaroid', name: 'Polaroid', category: 'vintage',
    cssFilter: 'sepia(0.15) brightness(1.12) saturate(0.8) contrast(0.88)' },
  { id: 'retro', name: 'Retro', category: 'vintage',
    cssFilter: 'sepia(0.45) contrast(1.15) saturate(0.65) brightness(0.9)' },

  // ── Mono (B&W) ──
  { id: 'bw', name: 'B&W', category: 'mono',
    cssFilter: 'grayscale(1) contrast(1.1)' },
  { id: 'noir', name: 'Noir', category: 'mono',
    cssFilter: 'grayscale(1) contrast(1.6) brightness(0.85)' },
  { id: 'faded_bw', name: 'Faded', category: 'mono',
    cssFilter: 'grayscale(1) contrast(0.75) brightness(1.15)' },
  { id: 'silver', name: 'Silver', category: 'mono',
    cssFilter: 'grayscale(1) contrast(1.2) brightness(1.05) sepia(0.08) hue-rotate(180deg)' },

  // ── Cool ──
  { id: 'cool', name: 'Cool', category: 'cool',
    cssFilter: 'saturate(1.05) hue-rotate(15deg) brightness(0.97)' },
  { id: 'ice', name: 'Ice', category: 'cool',
    cssFilter: 'saturate(0.8) hue-rotate(30deg) brightness(1.05)' },
  { id: 'arctic', name: 'Arctic', category: 'cool',
    cssFilter: 'saturate(0.7) hue-rotate(25deg) brightness(0.88) contrast(1.1)' },

  // ── Warm ──
  { id: 'warm', name: 'Warm', category: 'warm',
    cssFilter: 'saturate(1.1) sepia(0.2) brightness(1.03) hue-rotate(-8deg)' },
  { id: 'golden_hour', name: 'Golden Hour', category: 'warm',
    cssFilter: 'saturate(1.35) sepia(0.45) contrast(1.08) brightness(1.05) hue-rotate(-12deg)' },
  { id: 'amber', name: 'Amber', category: 'warm',
    cssFilter: 'saturate(1.2) sepia(0.38) brightness(1.02) hue-rotate(-15deg)' },

  // ── Vivid ──
  { id: 'vivid', name: 'Vivid', category: 'vivid',
    cssFilter: 'saturate(1.9) contrast(1.15) brightness(1.03)' },
  { id: 'hdr', name: 'HDR', category: 'vivid',
    cssFilter: 'saturate(1.6) contrast(1.35) brightness(1.02)' },
  { id: 'pop', name: 'Pop', category: 'vivid',
    cssFilter: 'saturate(2.2) contrast(1.25) brightness(1.05)' },
  { id: 'neon', name: 'Neon', category: 'vivid',
    cssFilter: 'saturate(2.5) contrast(1.3) brightness(0.95) hue-rotate(20deg)' },

  // ── Muted ──
  { id: 'matte', name: 'Matte', category: 'muted',
    cssFilter: 'saturate(0.8) contrast(0.88) brightness(1.08)' },
  { id: 'fade', name: 'Fade', category: 'muted',
    cssFilter: 'saturate(0.7) contrast(0.78) brightness(1.15)' },
  { id: 'pastel', name: 'Pastel', category: 'muted',
    cssFilter: 'saturate(0.6) brightness(1.15) contrast(0.82)' },
  { id: 'dust', name: 'Dust', category: 'muted',
    cssFilter: 'saturate(0.65) contrast(0.9) brightness(1.05) sepia(0.12)' },

  // ── Beauty (skin smoothing, rejuvenation, glow) ──
  { id: 'skin_smooth', name: 'Skin Smooth', category: 'beauty',
    cssFilter: 'brightness(1.06) contrast(0.9) saturate(0.92) blur(0.4px)' },
  { id: 'soft_glow', name: 'Soft Glow', category: 'beauty',
    cssFilter: 'brightness(1.1) contrast(0.88) saturate(0.95) blur(0.5px) sepia(0.03)' },
  { id: 'fair_skin', name: 'Fair Skin', category: 'beauty',
    cssFilter: 'brightness(1.12) contrast(0.92) saturate(0.85) sepia(0.05)' },
  { id: 'warm_glow', name: 'Warm Glow', category: 'beauty',
    cssFilter: 'brightness(1.08) contrast(0.95) saturate(1.05) sepia(0.12) hue-rotate(-5deg) blur(0.3px)' },
  { id: 'rosy', name: 'Rosy', category: 'beauty',
    cssFilter: 'brightness(1.05) contrast(0.95) saturate(1.1) sepia(0.08) hue-rotate(-8deg)' },
  { id: 'fresh_face', name: 'Fresh Face', category: 'beauty',
    cssFilter: 'brightness(1.08) contrast(1.02) saturate(1.08) sepia(0.02)' },
  { id: 'dewy', name: 'Dewy', category: 'beauty',
    cssFilter: 'brightness(1.1) contrast(0.9) saturate(1.05) blur(0.3px)' },
  { id: 'flawless', name: 'Flawless', category: 'beauty',
    cssFilter: 'brightness(1.08) contrast(0.88) saturate(0.9) blur(0.5px) sepia(0.03)' },
  { id: 'rejuvenate', name: 'Rejuvenate', category: 'beauty',
    cssFilter: 'brightness(1.1) contrast(0.92) saturate(0.95) sepia(0.06) hue-rotate(-3deg) blur(0.4px)' },
  { id: 'radiant', name: 'Radiant', category: 'beauty',
    cssFilter: 'brightness(1.12) contrast(0.95) saturate(1.1) sepia(0.04) blur(0.2px)' },

  // ── Social (optimized for social platforms) ──
  { id: 'insta', name: 'Insta', category: 'social',
    cssFilter: 'contrast(1.1) saturate(1.3) brightness(1.05) sepia(0.1)' },
  { id: 'story', name: 'Story', category: 'social',
    cssFilter: 'contrast(1.05) saturate(1.2) brightness(1.08)' },
  { id: 'feed', name: 'Feed', category: 'social',
    cssFilter: 'contrast(1.12) saturate(1.15) brightness(1.02)' },
  { id: 'clarendon', name: 'Clarendon', category: 'social',
    cssFilter: 'contrast(1.2) saturate(1.35) brightness(1.05)' },
  { id: 'juno', name: 'Juno', category: 'social',
    cssFilter: 'contrast(1.05) saturate(1.4) brightness(1.02) sepia(0.08) hue-rotate(-5deg)' },
  { id: 'lark', name: 'Lark', category: 'social',
    cssFilter: 'contrast(0.9) saturate(0.85) brightness(1.12) sepia(0.05)' },
  { id: 'ludwig', name: 'Ludwig', category: 'social',
    cssFilter: 'contrast(1.05) saturate(0.9) brightness(1.05) sepia(0.08)' },
  { id: 'valencia', name: 'Valencia', category: 'social',
    cssFilter: 'contrast(1.08) saturate(1.1) brightness(1.08) sepia(0.15) hue-rotate(-5deg)' },

  // ── Fun (creative, funny, artistic effects) ──
  { id: 'invert', name: 'Invert', category: 'fun',
    cssFilter: 'invert(1)' },
  { id: 'x_ray', name: 'X-Ray', category: 'fun',
    cssFilter: 'invert(1) hue-rotate(180deg) contrast(1.2)' },
  { id: 'thermal', name: 'Thermal', category: 'fun',
    cssFilter: 'saturate(3) hue-rotate(180deg) contrast(1.3) brightness(0.9)' },
  { id: 'night_vision', name: 'Night Vision', category: 'fun',
    cssFilter: 'brightness(1.3) contrast(1.5) saturate(0.3) hue-rotate(90deg) sepia(0.3)' },
  { id: 'psychedelic', name: 'Psychedelic', category: 'fun',
    cssFilter: 'saturate(4) hue-rotate(90deg) contrast(1.2) brightness(1.1)' },
  { id: 'alien', name: 'Alien', category: 'fun',
    cssFilter: 'hue-rotate(120deg) saturate(1.8) contrast(1.15) brightness(0.95)' },
  { id: 'radioactive', name: 'Radioactive', category: 'fun',
    cssFilter: 'hue-rotate(80deg) saturate(2.5) contrast(1.3) brightness(1.05)' },
  { id: 'old_tv', name: 'Old TV', category: 'fun',
    cssFilter: 'grayscale(0.7) contrast(1.5) brightness(0.9) sepia(0.2)' },
  { id: 'comic', name: 'Comic', category: 'fun',
    cssFilter: 'saturate(2) contrast(1.8) brightness(1.05)' },
  { id: 'zombie', name: 'Zombie', category: 'fun',
    cssFilter: 'saturate(0.5) hue-rotate(60deg) contrast(1.3) brightness(0.85) sepia(0.2)' },
  { id: 'infrared', name: 'Infrared', category: 'fun',
    cssFilter: 'hue-rotate(-30deg) saturate(2.5) contrast(1.2) brightness(1.05) sepia(0.15)' },
  { id: 'underwater', name: 'Underwater', category: 'fun',
    cssFilter: 'hue-rotate(180deg) saturate(0.8) contrast(1.1) brightness(0.9) sepia(0.1)' },
];

// ── Adjustment Definitions ──────────────────────────────────────────────────

export interface PhotoAdjustmentDef {
  key: keyof PhotoAdjustments;
  label: string;
  min: number;
  max: number;
  default: number;
  step: number;
  icon?: string; // optional icon identifier
}

export const PHOTO_ADJUSTMENT_DEFS: PhotoAdjustmentDef[] = [
  { key: 'brightness',  label: 'Brightness',  min: -100, max: 100, default: 0, step: 1 },
  { key: 'contrast',    label: 'Contrast',    min: -100, max: 100, default: 0, step: 1 },
  { key: 'saturation',  label: 'Saturation',  min: -100, max: 100, default: 0, step: 1 },
  { key: 'exposure',    label: 'Exposure',    min: -100, max: 100, default: 0, step: 1 },
  { key: 'highlights',  label: 'Highlights',  min: -100, max: 100, default: 0, step: 1 },
  { key: 'shadows',     label: 'Shadows',     min: -100, max: 100, default: 0, step: 1 },
  { key: 'warmth',      label: 'Temperature', min: -100, max: 100, default: 0, step: 1 },
  { key: 'tint',        label: 'Tint',        min: -100, max: 100, default: 0, step: 1 },
  { key: 'vibrance',    label: 'Vibrance',    min: -100, max: 100, default: 0, step: 1 },
  { key: 'clarity',     label: 'Clarity',     min: -100, max: 100, default: 0, step: 1 },
  { key: 'sharpness',   label: 'Sharpness',   min: -100, max: 100, default: 0, step: 1 },
  { key: 'dehaze',      label: 'Dehaze',      min: -100, max: 100, default: 0, step: 1 },
  { key: 'vignette',    label: 'Vignette',    min:    0, max: 100, default: 0, step: 1 },
  { key: 'grain',       label: 'Grain',       min:    0, max: 100, default: 0, step: 1 },
  { key: 'fade',        label: 'Fade',        min:    0, max: 100, default: 0, step: 1 },
];

// ── Social Media Image Sizes ────────────────────────────────────────────────

export interface SocialMediaSize {
  value: string;         // aspect ratio or WxH
  label: string;
  width: number;
  height: number;
  desc: string;
  platforms: string;
}

export const CROP_PRESETS: SocialMediaSize[] = [
  // Common ratios
  { value: 'free',     label: 'Free',       width: 0,    height: 0,    desc: 'Freeform',      platforms: '' },
  { value: '1:1',      label: '1:1',        width: 1080, height: 1080, desc: 'Square',        platforms: 'Instagram, Facebook, Twitter' },
  { value: '4:5',      label: '4:5',        width: 1080, height: 1350, desc: 'Portrait',      platforms: 'Instagram Feed' },
  { value: '9:16',     label: '9:16',       width: 1080, height: 1920, desc: 'Vertical',      platforms: 'Stories, Reels, TikTok' },
  { value: '16:9',     label: '16:9',       width: 1920, height: 1080, desc: 'Landscape',     platforms: 'YouTube, LinkedIn, Twitter' },
  { value: '4:3',      label: '4:3',        width: 1440, height: 1080, desc: 'Classic',       platforms: 'Presentations' },
  { value: '3:2',      label: '3:2',        width: 1620, height: 1080, desc: 'Photo',         platforms: 'Photography' },
  // Platform-specific
  { value: 'ig-post',  label: 'IG Post',    width: 1080, height: 1080, desc: 'Instagram Post',  platforms: 'Instagram' },
  { value: 'ig-story', label: 'IG Story',   width: 1080, height: 1920, desc: 'Instagram Story', platforms: 'Instagram' },
  { value: 'ig-land',  label: 'IG Land.',   width: 1080, height: 566,  desc: 'IG Landscape',   platforms: 'Instagram' },
  { value: 'fb-post',  label: 'FB Post',    width: 1200, height: 630,  desc: 'Facebook Post',  platforms: 'Facebook' },
  { value: 'fb-story', label: 'FB Story',   width: 1080, height: 1920, desc: 'Facebook Story', platforms: 'Facebook' },
  { value: 'fb-cover', label: 'FB Cover',   width: 820,  height: 312,  desc: 'Facebook Cover', platforms: 'Facebook' },
  { value: 'tw-post',  label: 'X Post',     width: 1600, height: 900,  desc: 'Twitter/X Post', platforms: 'Twitter/X' },
  { value: 'tw-header',label: 'X Header',   width: 1500, height: 500,  desc: 'Twitter Header', platforms: 'Twitter/X' },
  { value: 'li-post',  label: 'LinkedIn',   width: 1200, height: 627,  desc: 'LinkedIn Post',  platforms: 'LinkedIn' },
  { value: 'li-cover', label: 'LI Cover',   width: 1584, height: 396,  desc: 'LinkedIn Cover', platforms: 'LinkedIn' },
  { value: 'pin',      label: 'Pinterest',  width: 1000, height: 1500, desc: 'Pinterest Pin',  platforms: 'Pinterest' },
  { value: 'tiktok',   label: 'TikTok',     width: 1080, height: 1920, desc: 'TikTok Photo',   platforms: 'TikTok' },
  { value: 'yt-thumb', label: 'YT Thumb',   width: 1280, height: 720,  desc: 'YouTube Thumb',  platforms: 'YouTube' },
  { value: 'yt-banner',label: 'YT Banner',  width: 2560, height: 1440, desc: 'YouTube Banner', platforms: 'YouTube' },
];

// ── Font Options ────────────────────────────────────────────────────────────

export const FONT_FAMILIES = [
  { value: 'Inter, sans-serif',               label: 'Inter' },
  { value: 'Arial, sans-serif',               label: 'Arial' },
  { value: 'Georgia, serif',                  label: 'Georgia' },
  { value: "'Times New Roman', serif",        label: 'Times' },
  { value: "'Courier New', monospace",        label: 'Courier' },
  { value: 'Verdana, sans-serif',             label: 'Verdana' },
  { value: "'Trebuchet MS', sans-serif",      label: 'Trebuchet' },
  { value: 'Impact, sans-serif',              label: 'Impact' },
  { value: "'Comic Sans MS', cursive",        label: 'Comic Sans' },
  { value: "'Lucida Console', monospace",     label: 'Lucida' },
];

export const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 36, 42, 48, 56, 64, 72, 84, 96];

// ── Color Palette ───────────────────────────────────────────────────────────

export const COLOR_PALETTE = [
  '#FFFFFF', '#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00',
  '#FF00FF', '#00FFFF', '#FF6600', '#9900FF', '#FF3399', '#33CC33',
  '#3399FF', '#FF9900', '#CC0066', '#006633', '#663300', '#333333',
  '#666666', '#999999', '#CCCCCC', '#F5F5F5',
  // Pastel
  '#FFE4E1', '#E0F0FF', '#E8FFE0', '#FFF8DC', '#F0E6FF', '#FFE8F0',
];

// ── Frame Presets ───────────────────────────────────────────────────────────

export const FRAME_PRESETS: FrameConfig[] = [
  { id: 'none',     name: 'None',      type: 'none',     color: '#000000', width: 0,  radius: 0  },
  { id: 'thin-w',   name: 'Thin White', type: 'border',   color: '#FFFFFF', width: 8,  radius: 0  },
  { id: 'thin-b',   name: 'Thin Black', type: 'border',   color: '#000000', width: 8,  radius: 0  },
  { id: 'medium-w', name: 'Medium White',type: 'border',  color: '#FFFFFF', width: 16, radius: 0  },
  { id: 'medium-b', name: 'Medium Black',type: 'border',  color: '#000000', width: 16, radius: 0  },
  { id: 'thick-w',  name: 'Thick White', type: 'border',  color: '#FFFFFF', width: 32, radius: 0  },
  { id: 'thick-b',  name: 'Thick Black', type: 'border',  color: '#000000', width: 32, radius: 0  },
  { id: 'round-sm', name: 'Rounded S',   type: 'rounded', color: '#FFFFFF', width: 0,  radius: 12 },
  { id: 'round-md', name: 'Rounded M',   type: 'rounded', color: '#FFFFFF', width: 0,  radius: 24 },
  { id: 'round-lg', name: 'Rounded L',   type: 'rounded', color: '#FFFFFF', width: 0,  radius: 48 },
  { id: 'polaroid', name: 'Polaroid',    type: 'polaroid', color: '#FFFFFF', width: 16, radius: 0  },
  { id: 'shadow',   name: 'Shadow',      type: 'shadow',  color: '#000000', width: 0,  radius: 0  },
  { id: 'vintage-f',name: 'Vintage',     type: 'vintage', color: '#F5E6D3', width: 20, radius: 0  },
  { id: 'film-f',   name: 'Film Strip',  type: 'film',    color: '#000000', width: 24, radius: 0  },
];

// ── Shape Presets ───────────────────────────────────────────────────────────

export const SHAPE_TYPES = [
  { value: 'rectangle', label: 'Rectangle' },
  { value: 'circle',    label: 'Circle' },
  { value: 'line',      label: 'Line' },
  { value: 'arrow',     label: 'Arrow' },
  { value: 'triangle',  label: 'Triangle' },
  { value: 'star',      label: 'Star' },
] as const;

// ── Export Format Config ────────────────────────────────────────────────────

export interface ExportFormat {
  value: string;
  label: string;
  mime: string;
  ext: string;
  supportsQuality: boolean;
}

export const EXPORT_FORMATS: ExportFormat[] = [
  { value: 'png',  label: 'PNG',  mime: 'image/png',  ext: 'png',  supportsQuality: false },
  { value: 'jpeg', label: 'JPEG', mime: 'image/jpeg', ext: 'jpg',  supportsQuality: true },
  { value: 'webp', label: 'WebP', mime: 'image/webp', ext: 'webp', supportsQuality: true },
];

// ── Drawing Tool Config ─────────────────────────────────────────────────────

export const BRUSH_SIZES = [2, 4, 6, 8, 12, 16, 24, 32];

// ── Utility Functions ───────────────────────────────────────────────────────

let _photoIdCounter = 0;
export function genPhotoId(prefix: string): string {
  return `${prefix}-${Date.now()}-${++_photoIdCounter}`;
}

/** Build CSS filter string from adjustment values */
export function buildCSSFilterFromAdjustments(adj: PhotoAdjustments): string {
  const parts: string[] = [];

  // Brightness: -100→50%, 0→100%, +100→150%
  const br = adj.brightness ?? 0;
  if (br !== 0) parts.push(`brightness(${(1 + br / 200).toFixed(3)})`);

  // Contrast: -100→50%, 0→100%, +100→200%
  const co = adj.contrast ?? 0;
  if (co !== 0) parts.push(`contrast(${(1 + co / 100).toFixed(3)})`);

  // Saturation: -100→0%, 0→100%, +100→200%
  const sa = adj.saturation ?? 0;
  if (sa !== 0) parts.push(`saturate(${(1 + sa / 100).toFixed(3)})`);

  // Exposure: similar to brightness but more aggressive
  const ex = adj.exposure ?? 0;
  if (ex !== 0) parts.push(`brightness(${(1 + ex / 150).toFixed(3)})`);

  // Warmth: uses sepia + hue-rotate to shift warm/cool
  const wm = adj.warmth ?? 0;
  if (wm > 0) {
    parts.push(`sepia(${(wm / 500).toFixed(3)})`);
  } else if (wm < 0) {
    parts.push(`hue-rotate(${Math.round(wm / 5)}deg)`);
  }

  // Vibrance: boosts undersaturated colors (approximation with saturate)
  const vib = adj.vibrance ?? 0;
  if (vib !== 0) parts.push(`saturate(${(1 + vib / 200).toFixed(3)})`);

  // Clarity: subtle contrast boost
  const cl = adj.clarity ?? 0;
  if (cl !== 0) parts.push(`contrast(${(1 + cl / 250).toFixed(3)})`);

  // Dehaze: contrast + saturation boost
  const dh = adj.dehaze ?? 0;
  if (dh > 0) {
    parts.push(`contrast(${(1 + dh / 300).toFixed(3)})`);
    parts.push(`saturate(${(1 + dh / 400).toFixed(3)})`);
  }

  // Fade: reduces contrast
  const fd = adj.fade ?? 0;
  if (fd > 0) parts.push(`contrast(${(1 - fd / 300).toFixed(3)})`);

  return parts.join(' ');
}

/** Combine a filter preset CSS with adjustment CSS */
export function buildCompositeCSSFilter(filterId: string, adj: PhotoAdjustments): string {
  const filter = PHOTO_FILTERS.find(f => f.id === filterId);
  const filterCSS = filter?.cssFilter ?? '';
  const adjCSS = buildCSSFilterFromAdjustments(adj);

  if (!filterCSS && !adjCSS) return 'none';
  return [filterCSS, adjCSS].filter(Boolean).join(' ');
}

/** Check if any adjustment is not at default */
export function hasActivePhotoAdjustments(adj: PhotoAdjustments): boolean {
  return PHOTO_ADJUSTMENT_DEFS.some(d => (adj[d.key] ?? 0) !== d.default);
}

/** Create default adjustment values */
export function createDefaultAdjustments(): PhotoAdjustments {
  return {
    brightness: 0, contrast: 0, saturation: 0, exposure: 0,
    highlights: 0, shadows: 0, warmth: 0, tint: 0,
    sharpness: 0, clarity: 0, vignette: 0, grain: 0,
    fade: 0, dehaze: 0, vibrance: 0,
  };
}

/** Create default editor state */
export function createDefaultPhotoEditorState(): PhotoEditorState {
  return {
    imageId: null,
    originalWidth: 0,
    originalHeight: 0,
    activeTool: 'select',
    selectedFilterId: 'original',
    adjustments: createDefaultAdjustments(),
    crop: null,
    rotation: 0,
    flipH: false,
    flipV: false,
    textOverlays: [],
    drawStrokes: [],
    shapes: [],
    selectedOverlayId: null,
    frame: null,
    undoStack: [],
    redoStack: [],
    zoom: 1,
    panX: 0,
    panY: 0,
  };
}

/** Create a default text overlay */
export function createDefaultTextOverlay(x: number, y: number): TextOverlay {
  return {
    id: genPhotoId('txt'),
    text: 'Your Text',
    x,
    y,
    fontSize: 32,
    fontFamily: 'Inter, sans-serif',
    color: '#FFFFFF',
    backgroundColor: 'transparent',
    bold: false,
    italic: false,
    underline: false,
    textAlign: 'center',
    rotation: 0,
    opacity: 1,
    letterSpacing: 0,
    lineHeight: 1.2,
    shadow: true,
    outline: false,
  };
}

/**
 * Apply vignette effect to canvas ImageData.
 * Uses radial gradient darkening from center.
 */
export function applyVignetteToImageData(
  imageData: ImageData,
  strength: number, // 0-100
): void {
  if (strength <= 0) return;
  const { data, width, height } = imageData;
  const cx = width / 2;
  const cy = height / 2;
  const maxDist = Math.sqrt(cx * cx + cy * cy);
  const factor = strength / 100;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy) / maxDist;
      // Smooth darkening curve
      const darken = 1 - factor * dist * dist;
      const idx = (y * width + x) * 4;
      data[idx]     = Math.round(data[idx] * darken);     // R
      data[idx + 1] = Math.round(data[idx + 1] * darken); // G
      data[idx + 2] = Math.round(data[idx + 2] * darken); // B
    }
  }
}

/**
 * Apply grain (noise) effect to canvas ImageData.
 */
export function applyGrainToImageData(
  imageData: ImageData,
  strength: number, // 0-100
): void {
  if (strength <= 0) return;
  const { data } = imageData;
  const amount = strength * 0.3; // Max 30 levels of noise

  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * amount;
    data[i]     = Math.min(255, Math.max(0, data[i] + noise));
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
  }
}

/**
 * Render text overlays onto a canvas context.
 */
export function renderTextOverlays(
  ctx: CanvasRenderingContext2D,
  overlays: TextOverlay[],
  canvasWidth: number,
  canvasHeight: number,
): void {
  for (const t of overlays) {
    ctx.save();
    const px = (t.x / 100) * canvasWidth;
    const py = (t.y / 100) * canvasHeight;

    ctx.translate(px, py);
    if (t.rotation !== 0) ctx.rotate((t.rotation * Math.PI) / 180);

    ctx.globalAlpha = t.opacity;
    ctx.textAlign = t.textAlign;
    ctx.textBaseline = 'middle';

    const fontStyle = [
      t.italic ? 'italic' : '',
      t.bold ? 'bold' : '',
      `${t.fontSize}px`,
      t.fontFamily,
    ].filter(Boolean).join(' ');
    ctx.font = fontStyle;

    if (t.letterSpacing !== 0) {
      (ctx as unknown as Record<string, unknown>).letterSpacing = `${t.letterSpacing}px`;
    }

    // Shadow
    if (t.shadow) {
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
    }

    // Background
    if (t.backgroundColor !== 'transparent') {
      const metrics = ctx.measureText(t.text);
      const tw = metrics.width;
      const th = t.fontSize * t.lineHeight;
      ctx.fillStyle = t.backgroundColor;
      const bgX = t.textAlign === 'center' ? -tw / 2 - 4 : t.textAlign === 'right' ? -tw - 4 : -4;
      ctx.fillRect(bgX, -th / 2, tw + 8, th);
    }

    // Outline
    if (t.outline) {
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.strokeText(t.text, 0, 0);
    }

    // Text
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, 0, 0);

    // Underline
    if (t.underline) {
      const metrics = ctx.measureText(t.text);
      const ulY = t.fontSize * 0.15;
      const startX = t.textAlign === 'center' ? -metrics.width / 2 : t.textAlign === 'right' ? -metrics.width : 0;
      ctx.strokeStyle = t.color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(startX, ulY);
      ctx.lineTo(startX + metrics.width, ulY);
      ctx.stroke();
    }

    ctx.restore();
  }
}

/**
 * Render shape overlays onto a canvas context.
 */
export function renderShapes(
  ctx: CanvasRenderingContext2D,
  shapes: ShapeOverlay[],
  canvasWidth: number,
  canvasHeight: number,
): void {
  for (const s of shapes) {
    ctx.save();
    const x = (s.x / 100) * canvasWidth;
    const y = (s.y / 100) * canvasHeight;
    const w = (s.width / 100) * canvasWidth;
    const h = (s.height / 100) * canvasHeight;

    ctx.translate(x + w / 2, y + h / 2);
    if (s.rotation !== 0) ctx.rotate((s.rotation * Math.PI) / 180);
    ctx.globalAlpha = s.opacity;

    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.borderWidth;
    ctx.fillStyle = s.fillColor === 'transparent' ? 'rgba(0,0,0,0)' : s.fillColor;

    switch (s.type) {
      case 'rectangle':
        if (s.fillColor !== 'transparent') ctx.fillRect(-w / 2, -h / 2, w, h);
        if (s.borderWidth > 0) ctx.strokeRect(-w / 2, -h / 2, w, h);
        break;
      case 'circle':
        ctx.beginPath();
        ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
        if (s.fillColor !== 'transparent') ctx.fill();
        if (s.borderWidth > 0) ctx.stroke();
        break;
      case 'triangle':
        ctx.beginPath();
        ctx.moveTo(0, -h / 2);
        ctx.lineTo(w / 2, h / 2);
        ctx.lineTo(-w / 2, h / 2);
        ctx.closePath();
        if (s.fillColor !== 'transparent') ctx.fill();
        if (s.borderWidth > 0) ctx.stroke();
        break;
      case 'line':
        ctx.beginPath();
        ctx.moveTo(-w / 2, 0);
        ctx.lineTo(w / 2, 0);
        ctx.stroke();
        break;
      case 'arrow':
        ctx.beginPath();
        ctx.moveTo(-w / 2, 0);
        ctx.lineTo(w / 2, 0);
        ctx.stroke();
        // Arrowhead
        ctx.beginPath();
        ctx.moveTo(w / 2, 0);
        ctx.lineTo(w / 2 - 10, -6);
        ctx.lineTo(w / 2 - 10, 6);
        ctx.closePath();
        ctx.fill();
        break;
      case 'star': {
        const outerR = Math.min(w, h) / 2;
        const innerR = outerR * 0.4;
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const r = i % 2 === 0 ? outerR : innerR;
          const angle = (Math.PI / 2) * -1 + (Math.PI / 5) * i;
          const px = Math.cos(angle) * r;
          const py = Math.sin(angle) * r;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        if (s.fillColor !== 'transparent') ctx.fill();
        if (s.borderWidth > 0) ctx.stroke();
        break;
      }
    }
    ctx.restore();
  }
}

/**
 * Render draw strokes onto a canvas context.
 */
export function renderDrawStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: DrawStroke[],
  canvasWidth: number,
  canvasHeight: number,
): void {
  for (const stroke of strokes) {
    if (stroke.points.length < 2) continue;
    ctx.save();
    ctx.globalAlpha = stroke.opacity;
    ctx.strokeStyle = stroke.tool === 'eraser' ? '#FFFFFF' : stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (stroke.tool === 'marker') {
      ctx.globalAlpha = stroke.opacity * 0.5;
      ctx.lineWidth = stroke.width * 2;
    }
    if (stroke.tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
    }

    ctx.beginPath();
    ctx.moveTo(
      (stroke.points[0].x / 100) * canvasWidth,
      (stroke.points[0].y / 100) * canvasHeight
    );
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(
        (stroke.points[i].x / 100) * canvasWidth,
        (stroke.points[i].y / 100) * canvasHeight
      );
    }
    ctx.stroke();
    ctx.restore();
  }
}

/**
 * Render frame/border onto a canvas.
 * Returns adjusted canvas dimensions if frame adds padding.
 */
export function getFrameDimensions(
  frame: FrameConfig | null,
  width: number,
  height: number,
): { totalWidth: number; totalHeight: number; offsetX: number; offsetY: number } {
  if (!frame || frame.type === 'none') {
    return { totalWidth: width, totalHeight: height, offsetX: 0, offsetY: 0 };
  }

  switch (frame.type) {
    case 'border':
    case 'vintage':
      return {
        totalWidth: width + frame.width * 2,
        totalHeight: height + frame.width * 2,
        offsetX: frame.width,
        offsetY: frame.width,
      };
    case 'polaroid':
      return {
        totalWidth: width + frame.width * 2,
        totalHeight: height + frame.width * 2 + frame.width * 3, // extra bottom
        offsetX: frame.width,
        offsetY: frame.width,
      };
    case 'film':
      return {
        totalWidth: width + frame.width * 2,
        totalHeight: height + frame.width * 2,
        offsetX: frame.width,
        offsetY: frame.width,
      };
    default:
      return { totalWidth: width, totalHeight: height, offsetX: 0, offsetY: 0 };
  }
}
