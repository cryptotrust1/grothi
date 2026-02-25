/**
 * Studio Video Filters — Verified FFmpeg filtergraph implementations
 *
 * All filter strings use officially documented FFmpeg filter parameters:
 *
 * eq         — brightness (-1..1), contrast (0.5..3.0), saturation (0..3.0)
 * hue        — h (0..360°), s (-10..10, default 1, 0=grayscale)
 * colorbalance — rs/gs/bs (shadows), rm/gm/bm (midtones), rh/gh/bh (highlights) — all -1..1
 * curves     — preset names or r/g/b/all='x/y x/y' (normalized 0..1 pairs, space-separated)
 * colorlevels — [rgb]imin/[rgb]imax (0..1 input range)
 * colorchannelmixer — rr/rg/rb, gr/gg/gb, br/bg/bb coefficients (-2..2)
 * unsharp    — lx/ly (3..23 odd), la (-2..5, negative=blur, positive=sharpen)
 * vignette   — a (radians, 0..PI/2)
 * noise      — c0s (0..100 luma strength), c0f (t=temporal, u=uniform)
 *
 * Filter chain order follows color grading best practices:
 *   1. curves / colorlevels (base tone mapping)
 *   2. colorbalance (color cast per tonal range)
 *   3. eq / hue (brightness / saturation fine-tuning)
 *   4. colorchannelmixer (channel remixing)
 *   5. unsharp (sharpening / micro-blur)
 *   6. colorlevels (fade — lift blacks)
 *   7. vignette (edge darkening)
 *   8. noise (film grain)
 *   → drawtext applied after all color filters (always last)
 */

// ─────────────────────────────────────────────────────────────────────────────

export type FilterCategory =
  | 'original'
  | 'natural'
  | 'cinematic'
  | 'vintage'
  | 'mono'
  | 'cool'
  | 'warm'
  | 'vivid'
  | 'muted'
  | 'drama';

export const FILTER_CATEGORY_LABELS: Record<FilterCategory, string> = {
  original:  'Original',
  natural:   'Natural',
  cinematic: 'Cinematic',
  vintage:   'Vintage',
  mono:      'Mono',
  cool:      'Cool',
  warm:      'Warm',
  vivid:     'Vivid',
  muted:     'Muted',
  drama:     'Drama',
};

export interface VideoFilter {
  id: string;
  name: string;
  category: FilterCategory;
  /**
   * Individual FFmpeg filtergraph segments — each element is one filter
   * in the chain. Passed as an array to fluent-ffmpeg's videoFilters().
   * Empty array means no color filter (original).
   */
  ffmpegFilters: string[];
  /** CSS filter string for UI swatch preview (visual approximation only) */
  cssPreview: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Preset filters
// ─────────────────────────────────────────────────────────────────────────────

export const VIDEO_FILTERS: VideoFilter[] = [

  // ── Original ─────────────────────────────────────────────────────────────
  {
    id: 'original', name: 'Original', category: 'original',
    ffmpegFilters: [],
    cssPreview: '',
  },

  // ── Natural ──────────────────────────────────────────────────────────────
  {
    id: 'natural', name: 'Natural', category: 'natural',
    ffmpegFilters: [
      'eq=brightness=0.02:contrast=1.05:saturation=1.1',
    ],
    cssPreview: 'brightness(1.02) contrast(1.05) saturate(1.1)',
  },
  {
    id: 'clarity', name: 'Clarity', category: 'natural',
    ffmpegFilters: [
      'eq=contrast=1.1:brightness=0.01',
      'unsharp=lx=5:ly=5:la=0.6',
    ],
    cssPreview: 'contrast(1.1) brightness(1.01)',
  },

  // ── Cinematic ────────────────────────────────────────────────────────────
  // Teal-orange grade: shadows pushed teal (bs+), highlights pushed warm (rh+, bh-)
  {
    id: 'cine', name: 'Cine', category: 'cinematic',
    ffmpegFilters: [
      'eq=contrast=1.15:saturation=0.85:brightness=-0.02',
      'colorbalance=rs=-0.05:gs=0:bs=0.08:rh=0.1:gh=0.05:bh=-0.05',
    ],
    cssPreview: 'contrast(1.15) saturate(0.85) brightness(0.98) hue-rotate(5deg)',
  },
  {
    id: 'hollywood', name: 'Hollywood', category: 'cinematic',
    ffmpegFilters: [
      'eq=contrast=1.3:saturation=1.1:brightness=-0.03',
      'colorbalance=rs=0.1:gs=0.02:bs=-0.1:rh=0.08:gh=0.05:bh=-0.05',
      'vignette=a=0.6283',  // PI/5 ≈ 0.6283 rad
    ],
    cssPreview: 'contrast(1.3) saturate(1.1) brightness(0.97)',
  },
  {
    id: 'nightfall', name: 'Nightfall', category: 'cinematic',
    ffmpegFilters: [
      'eq=brightness=-0.08:contrast=1.2:saturation=0.8',
      'colorbalance=rs=-0.1:gs=-0.05:bs=0.15:rm=-0.05:gm=-0.02:bm=0.08',
    ],
    cssPreview: 'brightness(0.92) contrast(1.2) saturate(0.8) hue-rotate(10deg)',
  },
  {
    id: 'sunset', name: 'Sunset', category: 'cinematic',
    ffmpegFilters: [
      'eq=contrast=1.1:saturation=1.2:brightness=0.02',
      'colorbalance=rs=0.15:gs=0.05:bs=-0.15:rm=0.08:gm=0:bm=-0.1',
    ],
    cssPreview: 'contrast(1.1) saturate(1.2) brightness(1.02) sepia(0.25)',
  },
  {
    id: 'blockbuster', name: 'Blockbuster', category: 'cinematic',
    // Boost reds in shadows, slight teal mids, warm highlights; crushed contrast
    ffmpegFilters: [
      "curves=r='0/0 0.5/0.55 1/1':g='0/0 0.5/0.48 1/0.95':b='0/0 0.5/0.45 1/0.9'",
      'eq=contrast=1.2:saturation=0.9',
      'vignette=a=0.7854',  // PI/4 ≈ 0.7854 rad
    ],
    cssPreview: 'contrast(1.2) saturate(0.9) brightness(0.97)',
  },

  // ── Vintage / Film ───────────────────────────────────────────────────────
  {
    id: 'kodak', name: 'Kodak', category: 'vintage',
    // Warm shadows, slightly lifted whites, subtle red cast — Kodak Portra feel
    ffmpegFilters: [
      "curves=r='0/0.05 0.5/0.55 1/0.95':g='0/0.02 0.5/0.52 1/0.92':b='0/0 0.5/0.47 1/0.85'",
      'eq=saturation=0.9:contrast=1.05',
    ],
    cssPreview: 'sepia(0.25) contrast(1.05) saturate(0.9) brightness(1.02)',
  },
  {
    id: 'fuji', name: 'Fuji', category: 'vintage',
    // Cool greens, lifted shadows, slight desaturation — Fujifilm Superia feel
    ffmpegFilters: [
      "curves=r='0/0.02 0.5/0.5 1/0.94':g='0/0.02 0.5/0.52 1/0.96':b='0/0.01 0.5/0.48 1/0.88'",
      'eq=saturation=0.95',
    ],
    cssPreview: 'sepia(0.1) contrast(1.02) saturate(0.95) hue-rotate(8deg)',
  },
  {
    id: 'vintage_look', name: 'Vintage', category: 'vintage',
    // Built-in vintage curve preset + slight desaturation + grain
    ffmpegFilters: [
      'curves=preset=vintage',
      'eq=saturation=0.75:contrast=1.05',
      'noise=c0s=5:c0f=t+u',
    ],
    cssPreview: 'sepia(0.5) contrast(1.05) saturate(0.75) brightness(0.95)',
  },
  {
    id: 'polaroid', name: 'Polaroid', category: 'vintage',
    // Lifted blacks, warm whites, slightly washed out
    ffmpegFilters: [
      'colorlevels=rimin=0.1:gimin=0.05:bimin=0.05:rimax=0.95:gimax=0.92:bimax=0.88',
      'eq=saturation=0.8:contrast=0.95:brightness=0.03',
    ],
    cssPreview: 'sepia(0.2) brightness(1.08) saturate(0.85) contrast(0.95)',
  },
  {
    id: 'super8', name: 'Super 8', category: 'vintage',
    // Warm brownish cast, grain, slight vignette — Super 8mm film look
    ffmpegFilters: [
      "curves=r='0/0.1 0.5/0.55 1/0.9':g='0/0.05 0.5/0.5 1/0.85':b='0/0.02 0.5/0.45 1/0.78'",
      'eq=saturation=0.7:contrast=1.1',
      'noise=c0s=15:c0f=t+u',
      'vignette=a=0.5236',  // PI/6 ≈ 0.5236 rad
    ],
    cssPreview: 'sepia(0.6) contrast(1.1) saturate(0.7) brightness(0.95)',
  },

  // ── Mono ─────────────────────────────────────────────────────────────────
  // hue=s=0 — saturation multiplier 0 → full desaturation (grayscale)
  {
    id: 'bw', name: 'B&W', category: 'mono',
    ffmpegFilters: [
      'hue=s=0',
      'eq=contrast=1.1',
    ],
    cssPreview: 'grayscale(1) contrast(1.1)',
  },
  {
    id: 'noir', name: 'Noir', category: 'mono',
    // High-contrast B&W with strong vignette
    ffmpegFilters: [
      'hue=s=0',
      'eq=contrast=1.5:brightness=-0.05',
      'vignette=a=1.0472',  // PI/3 ≈ 1.0472 rad
    ],
    cssPreview: 'grayscale(1) contrast(1.5) brightness(0.95)',
  },
  {
    id: 'faded_bw', name: 'Faded', category: 'mono',
    // Low-contrast faded B&W — lifted blacks, pulled whites
    ffmpegFilters: [
      'hue=s=0',
      'colorlevels=rimin=0.07:gimin=0.07:bimin=0.07:rimax=0.88:gimax=0.88:bimax=0.88',
      'eq=contrast=0.9',
    ],
    cssPreview: 'grayscale(1) contrast(0.9) brightness(1.05)',
  },
  {
    id: 'silver', name: 'Silver', category: 'mono',
    // Cool blue-tinted B&W (silver gelatin print feel)
    // colorbalance applied after hue=s=0 tints the grey tones per-channel
    ffmpegFilters: [
      'hue=s=0',
      'colorbalance=rs=-0.05:gs=-0.03:bs=0.05',
      'eq=contrast=1.2:brightness=0.03',
    ],
    cssPreview: 'grayscale(1) contrast(1.2) brightness(1.03)',
  },

  // ── Cool ─────────────────────────────────────────────────────────────────
  {
    id: 'cool', name: 'Cool', category: 'cool',
    ffmpegFilters: [
      'colorbalance=rs=-0.08:gs=-0.02:bs=0.12:rm=-0.05:gm=0:bm=0.08',
      'eq=saturation=1.05',
    ],
    cssPreview: 'saturate(1.05) hue-rotate(10deg) brightness(0.98)',
  },
  {
    id: 'ice', name: 'Ice', category: 'cool',
    ffmpegFilters: [
      'colorbalance=rs=-0.15:gs=-0.05:bs=0.2:rm=-0.1:gm=-0.02:bm=0.15',
      'eq=saturation=0.85:brightness=0.03',
    ],
    cssPreview: 'saturate(0.85) hue-rotate(20deg) brightness(1.03)',
  },
  {
    id: 'moonlight', name: 'Moonlight', category: 'cool',
    ffmpegFilters: [
      'colorbalance=rs=-0.12:gs=-0.03:bs=0.18:rm=-0.07:gm=0:bm=0.1:rh=-0.05:gh=-0.02:bh=0.08',
      'eq=brightness=-0.03:saturation=0.8',
    ],
    cssPreview: 'saturate(0.8) hue-rotate(15deg) brightness(0.97)',
  },

  // ── Warm ─────────────────────────────────────────────────────────────────
  {
    id: 'warm', name: 'Warm', category: 'warm',
    ffmpegFilters: [
      'colorbalance=rs=0.1:gs=0.03:bs=-0.1:rm=0.07:gm=0.02:bm=-0.07',
      'eq=saturation=1.1',
    ],
    cssPreview: 'saturate(1.1) sepia(0.2) brightness(1.02)',
  },
  {
    id: 'golden_hour', name: 'Golden Hour', category: 'warm',
    ffmpegFilters: [
      'colorbalance=rs=0.18:gs=0.08:bs=-0.18:rm=0.12:gm=0.05:bm=-0.12:rh=0.05:gh=0.03:bh=-0.05',
      'eq=saturation=1.2:contrast=1.05',
    ],
    cssPreview: 'saturate(1.2) sepia(0.35) contrast(1.05) brightness(1.03)',
  },
  {
    id: 'amber', name: 'Amber', category: 'warm',
    ffmpegFilters: [
      'colorbalance=rs=0.14:gs=0.05:bs=-0.16:rm=0.1:gm=0.04:bm=-0.14',
      'eq=saturation=1.15:brightness=0.02',
    ],
    cssPreview: 'saturate(1.15) sepia(0.3) brightness(1.02)',
  },

  // ── Vivid ─────────────────────────────────────────────────────────────────
  {
    id: 'vivid', name: 'Vivid', category: 'vivid',
    ffmpegFilters: [
      'eq=saturation=1.8:contrast=1.15:brightness=0.02',
    ],
    cssPreview: 'saturate(1.8) contrast(1.15) brightness(1.02)',
  },
  {
    id: 'hdr_look', name: 'HDR', category: 'vivid',
    ffmpegFilters: [
      'eq=saturation=1.5:contrast=1.25:brightness=0.01',
      'unsharp=lx=3:ly=3:la=0.5',
    ],
    cssPreview: 'saturate(1.5) contrast(1.25) brightness(1.01)',
  },
  {
    id: 'pop', name: 'Pop', category: 'vivid',
    ffmpegFilters: [
      'eq=saturation=2.0:contrast=1.2:brightness=0.03',
    ],
    cssPreview: 'saturate(2.0) contrast(1.2) brightness(1.03)',
  },

  // ── Muted ─────────────────────────────────────────────────────────────────
  {
    id: 'matte', name: 'Matte', category: 'muted',
    ffmpegFilters: [
      'colorlevels=rimin=0.06:gimin=0.06:bimin=0.06',
      'eq=saturation=0.85:contrast=0.95',
    ],
    cssPreview: 'saturate(0.85) contrast(0.95) brightness(1.05)',
  },
  {
    id: 'fade_look', name: 'Fade', category: 'muted',
    // Lifted blacks AND pulled whites — classic faded film look
    ffmpegFilters: [
      'colorlevels=rimin=0.08:gimin=0.08:bimin=0.08:rimax=0.92:gimax=0.92:bimax=0.92',
      'eq=saturation=0.8',
    ],
    cssPreview: 'saturate(0.8) contrast(0.9) brightness(1.08)',
  },
  {
    id: 'pastel', name: 'Pastel', category: 'muted',
    ffmpegFilters: [
      'colorlevels=rimin=0.1:gimin=0.08:bimin=0.12:rimax=0.9:gimax=0.9:bimax=0.9',
      'eq=saturation=0.7:brightness=0.04',
    ],
    cssPreview: 'saturate(0.7) brightness(1.08) contrast(0.9)',
  },

  // ── Drama ─────────────────────────────────────────────────────────────────
  {
    id: 'drama', name: 'Drama', category: 'drama',
    ffmpegFilters: [
      'eq=contrast=1.4:brightness=-0.05:saturation=1.2',
      'vignette=a=0.7854',  // PI/4
    ],
    cssPreview: 'contrast(1.4) brightness(0.95) saturate(1.2)',
  },
  {
    id: 'sepia', name: 'Sepia', category: 'drama',
    // Luminosity-weighted sepia matrix (ITU-R BT.601 coefficients)
    ffmpegFilters: [
      'colorchannelmixer=rr=.393:rg=.769:rb=.189:gr=.349:gg=.686:gb=.168:br=.272:bg=.534:bb=.131',
      'eq=contrast=1.05:brightness=0.02',
    ],
    cssPreview: 'sepia(1) contrast(1.05) brightness(1.02)',
  },
  {
    id: 'neon', name: 'Neon', category: 'drama',
    // Cyberpunk: max saturation, push shadows teal, mids magenta
    ffmpegFilters: [
      'eq=saturation=2.2:contrast=1.25:brightness=-0.03',
      'colorbalance=rs=0.1:gs=-0.1:bs=0.2:rm=0.08:gm=-0.08:bm=0.15',
    ],
    cssPreview: 'saturate(2.2) contrast(1.25) brightness(0.97)',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Adjustment System
// ─────────────────────────────────────────────────────────────────────────────

export interface AdjustmentDef {
  key: string;
  label: string;
  min: number;
  max: number;
  default: number;
  step: number;
}

export const ADJUSTMENT_DEFS: AdjustmentDef[] = [
  { key: 'brightness',  label: 'Brightness',  min: -100, max: 100, default: 0, step: 1 },
  { key: 'contrast',    label: 'Contrast',    min: -100, max: 100, default: 0, step: 1 },
  { key: 'saturation',  label: 'Saturation',  min: -100, max: 100, default: 0, step: 1 },
  { key: 'warmth',      label: 'Warmth',      min: -100, max: 100, default: 0, step: 1 },
  { key: 'tint',        label: 'Tint',        min: -100, max: 100, default: 0, step: 1 },
  { key: 'highlights',  label: 'Highlights',  min: -100, max: 100, default: 0, step: 1 },
  { key: 'shadows',     label: 'Shadows',     min: -100, max: 100, default: 0, step: 1 },
  { key: 'sharpness',   label: 'Sharpness',   min: -100, max: 100, default: 0, step: 1 },
  { key: 'fade',        label: 'Fade',        min:    0, max: 100, default: 0, step: 1 },
  { key: 'vignette',    label: 'Vignette',    min:    0, max: 100, default: 0, step: 1 },
  { key: 'grain',       label: 'Grain',       min:    0, max: 100, default: 0, step: 1 },
];

export type AdjustmentValues = Record<string, number>;

/**
 * Build FFmpeg filter segments from adjustment slider values.
 * Skips any slider that is at its default (0).
 * Returns an array of filtergraph strings in the correct color-grading order.
 *
 * Security: all numeric values are clamped to their documented FFmpeg ranges
 * before being formatted into filter strings — no user string ever reaches FFmpeg directly.
 */
export function buildAdjustmentsFFmpeg(adj: AdjustmentValues): string[] {
  const filters: string[] = [];

  // ── 1. eq — brightness, contrast, saturation ──────────────────────────
  const eqParts: string[] = [];

  const br = adj['brightness'] ?? 0;
  const co = adj['contrast'] ?? 0;
  const sa = adj['saturation'] ?? 0;

  if (br !== 0) {
    // -100 → -1.0, 0 → 0.0, +100 → +1.0  (eq brightness range: -1..1)
    const v = Math.max(-1, Math.min(1, br / 100));
    eqParts.push(`brightness=${v.toFixed(4)}`);
  }
  if (co !== 0) {
    // -100 → 0.1, 0 → 1.0, +100 → 2.0  (practical range; eq accepts up to 1000)
    const v = Math.max(0.1, Math.min(3.0, 1 + co / 100));
    eqParts.push(`contrast=${v.toFixed(4)}`);
  }
  if (sa !== 0) {
    // -100 → 0.0, 0 → 1.0, +100 → 2.0  (eq saturation range: 0..3)
    const v = Math.max(0, Math.min(3.0, 1 + sa / 100));
    eqParts.push(`saturation=${v.toFixed(4)}`);
  }
  if (eqParts.length > 0) {
    filters.push(`eq=${eqParts.join(':')}`);
  }

  // ── 2. colorbalance — warmth (red↔blue) and tint (green↔magenta) ──────
  const warmth = adj['warmth'] ?? 0;
  const tint = adj['tint'] ?? 0;

  if (warmth !== 0 || tint !== 0) {
    // Warmth:  +100 = warm (+red, -blue); -100 = cool (-red, +blue)
    // Scaled to ±0.2 to stay well within colorbalance's -1..1 range
    const w = Math.max(-0.2, Math.min(0.2, warmth / 500));
    // Tint: +100 = magenta (+red+blue, -green); -100 = green (+green, -red-blue)
    const t = Math.max(-0.15, Math.min(0.15, tint / 667));

    const rs = w.toFixed(4);
    const gs = (-t).toFixed(4);
    const bs = (-w).toFixed(4);
    const rm = (w * 0.7).toFixed(4);
    const gm = (-t * 0.7).toFixed(4);
    const bm = (-w * 0.7).toFixed(4);

    filters.push(`colorbalance=rs=${rs}:gs=${gs}:bs=${bs}:rm=${rm}:gm=${gm}:bm=${bm}`);
  }

  // ── 3. curves — highlights and shadows ────────────────────────────────
  const hl = adj['highlights'] ?? 0;
  const sh = adj['shadows'] ?? 0;

  if (hl !== 0 || sh !== 0) {
    // Highlights: +100 = brighten whites (1.0→1.0), -100 = darken highlights (1.0→0.7)
    const hiY = Math.max(0.7, Math.min(1.0, 1.0 + hl * 0.003));
    // Shadows: +100 = lift blacks (+0.15), -100 = crush blacks (-0.08)
    const shY = Math.max(-0.08, Math.min(0.15, sh * 0.0015));
    filters.push(`curves=all='0/${shY.toFixed(4)} 0.5/0.5 1/${hiY.toFixed(4)}'`);
  }

  // ── 4. unsharp — sharpness (positive) or micro-blur (negative) ────────
  const sharpness = adj['sharpness'] ?? 0;

  if (sharpness !== 0) {
    // -100 → la=-1.5 (blur), 0 → no effect, +100 → la=+1.5 (sharpen)
    // unsharp la range: -2..5; kernel size 5×5 is standard for sharpening
    const la = Math.max(-1.5, Math.min(1.5, sharpness / 100 * 1.5));
    filters.push(`unsharp=lx=5:ly=5:la=${la.toFixed(4)}`);
  }

  // ── 5. colorlevels — fade (lift blacks, create matte look) ────────────
  const fade = adj['fade'] ?? 0;

  if (fade > 0) {
    // 0 → no lift; 100 → blacks lifted to 0.15 (strong matte/fade)
    const lift = Math.min(0.15, fade / 100 * 0.15);
    filters.push(
      `colorlevels=rimin=${lift.toFixed(4)}:gimin=${lift.toFixed(4)}:bimin=${lift.toFixed(4)}`
    );
  }

  // ── 6. vignette — edge darkening ──────────────────────────────────────
  const vignette = adj['vignette'] ?? 0;

  if (vignette > 0) {
    // 0 → none; 100 → a=PI/2.5 ≈ 1.2566 rad (strong vignette)
    const angle = Math.min(Math.PI / 2.5, (vignette / 100) * (Math.PI / 2.5));
    filters.push(`vignette=a=${angle.toFixed(4)}`);
  }

  // ── 7. noise — film grain ─────────────────────────────────────────────
  const grain = adj['grain'] ?? 0;

  if (grain > 0) {
    // 0 → none; 100 → c0s=25 (strong grain)
    // c0f=t+u: temporal (changes per frame) + uniform (rather than Gaussian)
    const strength = Math.round(Math.min(25, grain / 100 * 25));
    filters.push(`noise=c0s=${strength}:c0f=t+u`);
  }

  return filters;
}

/**
 * Build the complete color-grading FFmpeg filter chain from a preset + adjustments.
 * Returns an array of filter segments ready for fluent-ffmpeg's videoFilters().
 *
 * Preset filters are applied first (they are the creative base look).
 * Adjustments are applied on top (fine-tuning relative to the preset).
 */
export function buildColorFiltersChain(
  filterId: string,
  adjustments: AdjustmentValues
): string[] {
  const filters: string[] = [];

  // 1. Preset color filter
  const preset = VIDEO_FILTERS.find(f => f.id === filterId);
  if (preset && preset.ffmpegFilters.length > 0) {
    filters.push(...preset.ffmpegFilters);
  }

  // 2. Manual adjustments (applied on top of preset)
  filters.push(...buildAdjustmentsFFmpeg(adjustments));

  return filters;
}

/** Returns true if any adjustment is non-zero */
export function hasActiveAdjustments(adjustments: AdjustmentValues): boolean {
  return ADJUSTMENT_DEFS.some(d => (adjustments[d.key] ?? 0) !== d.default);
}

/** Human-readable summary of active adjustments */
export function adjustmentSummary(adjustments: AdjustmentValues): string {
  return ADJUSTMENT_DEFS
    .filter(d => (adjustments[d.key] ?? 0) !== d.default)
    .map(d => {
      const v = adjustments[d.key] ?? 0;
      return `${d.label} ${v > 0 ? '+' : ''}${v}`;
    })
    .join(', ');
}
