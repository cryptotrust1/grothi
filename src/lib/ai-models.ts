// ============================================================
// AI Model Registry — Complete definition of all available
// image and video generation models with their parameters.
// User can select any model and configure every parameter.
// ============================================================

// ── Parameter types ──

export type ParamType = 'select' | 'number' | 'boolean' | 'string';

export interface ParamOption {
  value: string;
  label: string;
}

export interface ModelParam {
  key: string;
  label: string;
  type: ParamType;
  description: string;
  required?: boolean;
  /** Select options */
  options?: ParamOption[];
  /** Number range */
  min?: number;
  max?: number;
  step?: number;
  /** Default value */
  default?: string | number | boolean;
  /** Group for UI layout: 'basic' shown always, 'advanced' in collapsible */
  group: 'basic' | 'advanced';
}

export interface AIModel {
  id: string;
  /** Replicate model identifier (e.g. 'black-forest-labs/flux-1.1-pro') */
  replicateId: string;
  name: string;
  /** Brand / company name (e.g. 'Google DeepMind', 'MiniMax', 'Luma AI') */
  brand: string;
  description: string;
  category: 'image' | 'video';
  /** Credit cost per generation */
  creditCost: number;
  /** Supports reference/input image */
  supportsReferenceImage: boolean;
  /** The key name for reference image in API input */
  referenceImageKey?: string;
  /** Supports negative prompt */
  supportsNegativePrompt: boolean;
  /** All configurable parameters */
  params: ModelParam[];
  /** Provider: replicate or runway */
  provider: 'replicate' | 'runway';
  /** Estimated generation time */
  estimatedTime: string;
  /** Badge label for UI (e.g. 'Best Quality', 'Fastest') */
  badge?: string;
  /** Whether this model uses async polling (video models) */
  async?: boolean;
}

// ── Shared parameter definitions ──

const ASPECT_RATIOS: ParamOption[] = [
  { value: '1:1', label: '1:1 (Square)' },
  { value: '16:9', label: '16:9 (Landscape)' },
  { value: '9:16', label: '9:16 (Portrait/Vertical)' },
  { value: '4:3', label: '4:3 (Classic)' },
  { value: '3:4', label: '3:4 (Portrait)' },
  { value: '3:2', label: '3:2 (Photo)' },
  { value: '2:3', label: '2:3 (Pinterest)' },
  { value: '4:5', label: '4:5 (Instagram Portrait)' },
  { value: '5:4', label: '5:4 (Landscape)' },
];

const ASPECT_RATIOS_ULTRA: ParamOption[] = [
  ...ASPECT_RATIOS,
  { value: '21:9', label: '21:9 (Ultrawide)' },
  { value: '9:21', label: '9:21 (Ultra Tall)' },
];

const OUTPUT_FORMATS: ParamOption[] = [
  { value: 'png', label: 'PNG (Best Quality)' },
  { value: 'jpg', label: 'JPG (Smaller Size)' },
  { value: 'webp', label: 'WebP (Web Optimized)' },
];

// ── IMAGE MODELS ──

export const IMAGE_MODELS: AIModel[] = [
  // ── FLUX 1.1 Pro ──
  {
    id: 'flux-1.1-pro',
    replicateId: 'black-forest-labs/flux-1.1-pro',
    name: 'FLUX 1.1 Pro',
    brand: 'Black Forest Labs',
    description: 'Best quality/speed balance. Professional grade image generation with excellent prompt following.',
    category: 'image',
    creditCost: 3,
    supportsReferenceImage: true,
    referenceImageKey: 'image_prompt',
    supportsNegativePrompt: false,
    provider: 'replicate',
    estimatedTime: '~5 seconds',
    badge: 'Recommended',
    params: [
      {
        key: 'aspect_ratio',
        label: 'Aspect Ratio',
        type: 'select',
        description: 'Image dimensions ratio. Choose based on target platform.',
        options: ASPECT_RATIOS,
        default: '1:1',
        group: 'basic',
      },
      {
        key: 'output_format',
        label: 'Output Format',
        type: 'select',
        description: 'File format of the generated image.',
        options: OUTPUT_FORMATS,
        default: 'png',
        group: 'basic',
      },
      {
        key: 'output_quality',
        label: 'Output Quality',
        type: 'number',
        description: 'Quality of the output image (1-100). Higher = better quality but larger file.',
        min: 1,
        max: 100,
        step: 1,
        default: 90,
        group: 'advanced',
      },
      {
        key: 'safety_tolerance',
        label: 'Safety Tolerance',
        type: 'number',
        description: 'Content filter strictness (1=strict, 6=permissive). Lower values block more content.',
        min: 1,
        max: 6,
        step: 1,
        default: 2,
        group: 'advanced',
      },
      {
        key: 'prompt_upsampling',
        label: 'Prompt Enhancement',
        type: 'boolean',
        description: 'Automatically enhance your prompt for better results. May slightly change the interpretation.',
        default: true,
        group: 'basic',
      },
      {
        key: 'seed',
        label: 'Seed',
        type: 'number',
        description: 'Random seed for reproducible results. Leave empty for random.',
        min: 0,
        max: 2147483647,
        step: 1,
        group: 'advanced',
      },
    ],
  },

  // ── FLUX 1.1 Pro Ultra ──
  {
    id: 'flux-1.1-pro-ultra',
    replicateId: 'black-forest-labs/flux-1.1-pro-ultra',
    name: 'FLUX 1.1 Pro Ultra',
    brand: 'Black Forest Labs',
    description: 'Highest quality, up to 4 megapixel resolution. Best for large prints and premium content.',
    category: 'image',
    creditCost: 5,
    supportsReferenceImage: true,
    referenceImageKey: 'image_prompt',
    supportsNegativePrompt: false,
    provider: 'replicate',
    estimatedTime: '~10 seconds',
    badge: 'Best Quality',
    params: [
      {
        key: 'aspect_ratio',
        label: 'Aspect Ratio',
        type: 'select',
        description: 'Image dimensions ratio. Ultra supports ultrawide formats.',
        options: ASPECT_RATIOS_ULTRA,
        default: '1:1',
        group: 'basic',
      },
      {
        key: 'output_format',
        label: 'Output Format',
        type: 'select',
        description: 'File format of the generated image.',
        options: OUTPUT_FORMATS,
        default: 'png',
        group: 'basic',
      },
      {
        key: 'output_quality',
        label: 'Output Quality',
        type: 'number',
        description: 'Quality of the output image (1-100).',
        min: 1,
        max: 100,
        step: 1,
        default: 95,
        group: 'advanced',
      },
      {
        key: 'safety_tolerance',
        label: 'Safety Tolerance',
        type: 'number',
        description: 'Content filter strictness (1=strict, 6=permissive).',
        min: 1,
        max: 6,
        step: 1,
        default: 2,
        group: 'advanced',
      },
      {
        key: 'raw',
        label: 'Raw Mode',
        type: 'boolean',
        description: 'Less processed, more natural look. Great for photography-style images.',
        default: false,
        group: 'basic',
      },
      {
        key: 'seed',
        label: 'Seed',
        type: 'number',
        description: 'Random seed for reproducible results.',
        min: 0,
        max: 2147483647,
        step: 1,
        group: 'advanced',
      },
    ],
  },

  // ── FLUX Schnell ──
  {
    id: 'flux-schnell',
    replicateId: 'black-forest-labs/flux-schnell',
    name: 'FLUX Schnell',
    brand: 'Black Forest Labs',
    description: 'Fastest generation, great for quick drafts and iterations. Low cost.',
    category: 'image',
    creditCost: 1,
    supportsReferenceImage: false,
    supportsNegativePrompt: false,
    provider: 'replicate',
    estimatedTime: '~2 seconds',
    badge: 'Fastest',
    params: [
      {
        key: 'aspect_ratio',
        label: 'Aspect Ratio',
        type: 'select',
        description: 'Image dimensions ratio.',
        options: ASPECT_RATIOS,
        default: '1:1',
        group: 'basic',
      },
      {
        key: 'output_format',
        label: 'Output Format',
        type: 'select',
        description: 'File format of the generated image.',
        options: OUTPUT_FORMATS,
        default: 'png',
        group: 'basic',
      },
      {
        key: 'output_quality',
        label: 'Output Quality',
        type: 'number',
        description: 'Quality of the output image (1-100).',
        min: 1,
        max: 100,
        step: 1,
        default: 90,
        group: 'advanced',
      },
      {
        key: 'num_outputs',
        label: 'Number of Images',
        type: 'number',
        description: 'Generate multiple images at once (1-4). Each image costs credits.',
        min: 1,
        max: 4,
        step: 1,
        default: 1,
        group: 'basic',
      },
      {
        key: 'go_fast',
        label: 'Turbo Mode',
        type: 'boolean',
        description: 'Use fp8 quantized model for even faster generation.',
        default: true,
        group: 'advanced',
      },
      {
        key: 'megapixels',
        label: 'Resolution',
        type: 'select',
        description: 'Output resolution in megapixels.',
        options: [
          { value: '1', label: '1 MP (Standard)' },
          { value: '0.25', label: '0.25 MP (Fast/Draft)' },
        ],
        default: '1',
        group: 'basic',
      },
      {
        key: 'seed',
        label: 'Seed',
        type: 'number',
        description: 'Random seed for reproducible results.',
        min: 0,
        max: 2147483647,
        step: 1,
        group: 'advanced',
      },
    ],
  },

  // ── FLUX Dev ──
  {
    id: 'flux-dev',
    replicateId: 'black-forest-labs/flux-dev',
    name: 'FLUX Dev',
    brand: 'Black Forest Labs',
    description: 'Development model with fine-grained control. Adjustable inference steps and guidance.',
    category: 'image',
    creditCost: 2,
    supportsReferenceImage: false,
    supportsNegativePrompt: false,
    provider: 'replicate',
    estimatedTime: '~8 seconds',
    badge: 'Most Control',
    params: [
      {
        key: 'aspect_ratio',
        label: 'Aspect Ratio',
        type: 'select',
        description: 'Image dimensions ratio.',
        options: ASPECT_RATIOS,
        default: '1:1',
        group: 'basic',
      },
      {
        key: 'output_format',
        label: 'Output Format',
        type: 'select',
        description: 'File format.',
        options: OUTPUT_FORMATS,
        default: 'png',
        group: 'basic',
      },
      {
        key: 'output_quality',
        label: 'Output Quality',
        type: 'number',
        description: 'Quality (1-100).',
        min: 1,
        max: 100,
        step: 1,
        default: 90,
        group: 'advanced',
      },
      {
        key: 'num_outputs',
        label: 'Number of Images',
        type: 'number',
        description: 'Generate multiple images (1-4).',
        min: 1,
        max: 4,
        step: 1,
        default: 1,
        group: 'basic',
      },
      {
        key: 'num_inference_steps',
        label: 'Inference Steps',
        type: 'number',
        description: 'Number of denoising steps (1-50). More steps = higher quality but slower.',
        min: 1,
        max: 50,
        step: 1,
        default: 28,
        group: 'basic',
      },
      {
        key: 'guidance',
        label: 'Guidance Scale',
        type: 'number',
        description: 'How strictly to follow the prompt (0-10). Higher = more faithful to prompt.',
        min: 0,
        max: 10,
        step: 0.1,
        default: 3.5,
        group: 'basic',
      },
      {
        key: 'go_fast',
        label: 'Turbo Mode',
        type: 'boolean',
        description: 'Use fp8 quantized model for faster generation.',
        default: true,
        group: 'advanced',
      },
      {
        key: 'megapixels',
        label: 'Resolution',
        type: 'select',
        description: 'Output resolution.',
        options: [
          { value: '1', label: '1 MP (Standard)' },
          { value: '0.25', label: '0.25 MP (Fast/Draft)' },
        ],
        default: '1',
        group: 'basic',
      },
      {
        key: 'seed',
        label: 'Seed',
        type: 'number',
        description: 'Random seed for reproducible results.',
        min: 0,
        max: 2147483647,
        step: 1,
        group: 'advanced',
      },
    ],
  },

  // ── Recraft V3 ──
  {
    id: 'recraft-v3',
    replicateId: 'recraft-ai/recraft-v3',
    name: 'Recraft V3',
    brand: 'Recraft AI',
    description: 'Design-focused model. Excellent for logos, icons, illustrations, and design assets.',
    category: 'image',
    creditCost: 3,
    supportsReferenceImage: false,
    supportsNegativePrompt: false,
    provider: 'replicate',
    estimatedTime: '~8 seconds',
    badge: 'Design',
    params: [
      {
        key: 'size',
        label: 'Image Size',
        type: 'select',
        description: 'Exact pixel dimensions of the output image.',
        options: [
          { value: '1024x1024', label: '1024x1024 (Square)' },
          { value: '1365x1024', label: '1365x1024 (Landscape 4:3)' },
          { value: '1024x1365', label: '1024x1365 (Portrait 3:4)' },
          { value: '1536x1024', label: '1536x1024 (Landscape 3:2)' },
          { value: '1024x1536', label: '1024x1536 (Portrait 2:3)' },
          { value: '1820x1024', label: '1820x1024 (Wide 16:9)' },
          { value: '1024x1820', label: '1024x1820 (Tall 9:16)' },
          { value: '2048x1024', label: '2048x1024 (Ultra Wide)' },
          { value: '1024x2048', label: '1024x2048 (Ultra Tall)' },
          { value: '1280x1024', label: '1280x1024 (5:4)' },
          { value: '1024x1280', label: '1024x1280 (4:5)' },
        ],
        default: '1024x1024',
        group: 'basic',
      },
      {
        key: 'style',
        label: 'Visual Style',
        type: 'select',
        description: 'Artistic style of the generated image.',
        options: [
          { value: 'any', label: 'Any (Auto-detect)' },
          { value: 'realistic_image', label: 'Realistic Photo' },
          { value: 'digital_illustration', label: 'Digital Illustration' },
          { value: 'vector_illustration', label: 'Vector Illustration' },
          { value: 'icon', label: 'Icon' },
        ],
        default: 'any',
        group: 'basic',
      },
    ],
  },

  // ── Ideogram V2 ──
  {
    id: 'ideogram-v2',
    replicateId: 'ideogram-ai/ideogram-v2',
    name: 'Ideogram V2',
    brand: 'Ideogram',
    description: 'Excellent text rendering in images. Best for posters, banners, and social media with text.',
    category: 'image',
    creditCost: 3,
    supportsReferenceImage: false,
    supportsNegativePrompt: true,
    provider: 'replicate',
    estimatedTime: '~10 seconds',
    badge: 'Best Text',
    params: [
      {
        key: 'aspect_ratio',
        label: 'Aspect Ratio',
        type: 'select',
        description: 'Image dimensions ratio.',
        options: [
          { value: '1:1', label: '1:1 (Square)' },
          { value: '16:9', label: '16:9 (Landscape)' },
          { value: '9:16', label: '9:16 (Vertical)' },
          { value: '4:3', label: '4:3 (Classic)' },
          { value: '3:4', label: '3:4 (Portrait)' },
          { value: '3:2', label: '3:2 (Photo)' },
          { value: '2:3', label: '2:3 (Tall)' },
          { value: '16:10', label: '16:10 (Widescreen)' },
          { value: '10:16', label: '10:16 (Tall Widescreen)' },
          { value: '3:1', label: '3:1 (Banner)' },
          { value: '1:3', label: '1:3 (Tall Banner)' },
        ],
        default: '1:1',
        group: 'basic',
      },
      {
        key: 'style_type',
        label: 'Style Type',
        type: 'select',
        description: 'Visual rendering style.',
        options: [
          { value: 'Auto', label: 'Auto (Best match)' },
          { value: 'General', label: 'General' },
          { value: 'Realistic', label: 'Realistic' },
          { value: 'Design', label: 'Design' },
          { value: 'Render 3D', label: '3D Render' },
          { value: 'Anime', label: 'Anime' },
        ],
        default: 'Auto',
        group: 'basic',
      },
      {
        key: 'magic_prompt_option',
        label: 'Magic Prompt',
        type: 'select',
        description: 'Automatically enhance your prompt for better results.',
        options: [
          { value: 'Auto', label: 'Auto' },
          { value: 'On', label: 'Always On' },
          { value: 'Off', label: 'Off (Use exact prompt)' },
        ],
        default: 'Auto',
        group: 'basic',
      },
      {
        key: 'negative_prompt',
        label: 'Negative Prompt',
        type: 'string',
        description: 'What to avoid in the image (e.g. "blurry, low quality, text errors").',
        group: 'advanced',
      },
      {
        key: 'seed',
        label: 'Seed',
        type: 'number',
        description: 'Random seed for reproducible results.',
        min: 0,
        max: 2147483647,
        step: 1,
        group: 'advanced',
      },
    ],
  },

  // ── Stable Diffusion XL ──
  {
    id: 'sdxl',
    replicateId: 'stability-ai/sdxl',
    name: 'Stable Diffusion XL',
    brand: 'Stability AI',
    description: 'Classic open-source model. Full control with negative prompts, guidance, and scheduler selection.',
    category: 'image',
    creditCost: 1,
    supportsReferenceImage: true,
    referenceImageKey: 'image',
    supportsNegativePrompt: true,
    provider: 'replicate',
    estimatedTime: '~8 seconds',
    badge: 'Classic',
    params: [
      {
        key: 'width',
        label: 'Width',
        type: 'number',
        description: 'Image width in pixels (128-2048).',
        min: 128,
        max: 2048,
        step: 64,
        default: 1024,
        group: 'basic',
      },
      {
        key: 'height',
        label: 'Height',
        type: 'number',
        description: 'Image height in pixels (128-2048).',
        min: 128,
        max: 2048,
        step: 64,
        default: 1024,
        group: 'basic',
      },
      {
        key: 'num_outputs',
        label: 'Number of Images',
        type: 'number',
        description: 'Generate multiple images (1-4).',
        min: 1,
        max: 4,
        step: 1,
        default: 1,
        group: 'basic',
      },
      {
        key: 'scheduler',
        label: 'Scheduler',
        type: 'select',
        description: 'Sampling scheduler algorithm. Different schedulers produce different results.',
        options: [
          { value: 'DDIM', label: 'DDIM (Fast, clean)' },
          { value: 'DPMSolverMultistep', label: 'DPM++ (Balanced)' },
          { value: 'HeunDiscrete', label: 'Heun (High quality)' },
          { value: 'KarrasDPM', label: 'Karras DPM (Smooth)' },
          { value: 'K_EULER_ANCESTRAL', label: 'Euler A (Creative)' },
          { value: 'K_EULER', label: 'Euler (Classic)' },
          { value: 'PNDM', label: 'PNDM (Fast)' },
        ],
        default: 'DPMSolverMultistep',
        group: 'advanced',
      },
      {
        key: 'num_inference_steps',
        label: 'Inference Steps',
        type: 'number',
        description: 'Number of denoising steps (1-100). More = better quality, slower.',
        min: 1,
        max: 100,
        step: 1,
        default: 30,
        group: 'basic',
      },
      {
        key: 'guidance_scale',
        label: 'Guidance Scale',
        type: 'number',
        description: 'Prompt adherence (0-50). Higher = more faithful to prompt but less creative.',
        min: 0,
        max: 50,
        step: 0.5,
        default: 7.5,
        group: 'basic',
      },
      {
        key: 'prompt_strength',
        label: 'Prompt Strength',
        type: 'number',
        description: 'When using reference image, controls how much to change it (0-1). Lower = closer to original.',
        min: 0,
        max: 1,
        step: 0.05,
        default: 0.8,
        group: 'advanced',
      },
      {
        key: 'negative_prompt',
        label: 'Negative Prompt',
        type: 'string',
        description: 'What to avoid in the image.',
        default: 'worst quality, low quality, blurry, distorted',
        group: 'basic',
      },
      {
        key: 'refine',
        label: 'Refiner',
        type: 'select',
        description: 'Use SDXL refiner for improved details.',
        options: [
          { value: 'no_refiner', label: 'No Refiner' },
          { value: 'expert_ensemble_refiner', label: 'Expert Ensemble' },
          { value: 'base_image_refiner', label: 'Base Image Refiner' },
        ],
        default: 'no_refiner',
        group: 'advanced',
      },
      {
        key: 'high_noise_frac',
        label: 'High Noise Fraction',
        type: 'number',
        description: 'Fraction of steps for base model when using refiner (0-1).',
        min: 0,
        max: 1,
        step: 0.05,
        default: 0.8,
        group: 'advanced',
      },
      {
        key: 'seed',
        label: 'Seed',
        type: 'number',
        description: 'Random seed for reproducible results.',
        min: 0,
        max: 2147483647,
        step: 1,
        group: 'advanced',
      },
    ],
  },
];

// ── VIDEO MODELS ──
// All video models use Replicate API exclusively.
// Model IDs and parameters verified against Replicate API schemas.
// Schema source: https://replicate.com/api/models/{owner}/{name}/versions
// Duration defaults set to MAXIMUM allowed by each model's API.

export const VIDEO_MODELS: AIModel[] = [
  // ── Kling V3 Video (longest duration: 3-15 seconds) ──
  // Schema: kwaivgi/kling-v3-video — duration: integer min 3, max 15, default 5
  {
    id: 'kling-v3-video',
    replicateId: 'kwaivgi/kling-v3-video',
    name: 'Kling V3 Video',
    brand: 'Kuaishou (Kling)',
    description: 'Longest AI video: up to 15 seconds. Multi-shot mode with up to 6 scenes. Native audio, 720p/1080p. Best for narrative content.',
    category: 'video',
    creditCost: 15,
    supportsReferenceImage: true,
    referenceImageKey: 'start_image',
    supportsNegativePrompt: true,
    provider: 'replicate',
    estimatedTime: '~3-6 minutes',
    badge: 'Longest',
    async: true,
    params: [
      {
        key: 'duration',
        label: 'Duration',
        type: 'number',
        description: 'Video length in seconds (3-15). The longest AI video available.',
        min: 3,
        max: 15,
        step: 1,
        default: 15,
        group: 'basic',
      },
      {
        key: 'mode',
        label: 'Quality Mode',
        type: 'select',
        description: 'Standard = 720p. Pro = 1080p.',
        options: [
          { value: 'standard', label: 'Standard (720p)' },
          { value: 'pro', label: 'Pro (1080p)' },
        ],
        default: 'pro',
        group: 'basic',
      },
      {
        key: 'aspect_ratio',
        label: 'Aspect Ratio',
        type: 'select',
        description: 'Video dimensions ratio. Ignored when start_image is provided.',
        options: [
          { value: '16:9', label: '16:9 (Landscape)' },
          { value: '9:16', label: '9:16 (Vertical/TikTok)' },
          { value: '1:1', label: '1:1 (Square)' },
        ],
        default: '16:9',
        group: 'basic',
      },
      {
        key: 'generate_audio',
        label: 'Generate Audio',
        type: 'boolean',
        description: 'Generate native audio for the video.',
        default: false,
        group: 'basic',
      },
      {
        key: 'negative_prompt',
        label: 'Negative Prompt',
        type: 'string',
        description: 'Things you do not want to see in the video. Max 2500 characters.',
        group: 'advanced',
      },
    ],
  },

  // ── xAI Grok Imagine Video (1-15 seconds, flexible) ──
  // Schema: xai/grok-imagine-video — duration: integer min 1, max 15, default 5
  {
    id: 'grok-imagine-video',
    replicateId: 'xai/grok-imagine-video',
    name: 'Grok Imagine Video',
    brand: 'xAI (Grok)',
    description: 'Up to 15 seconds. Image-to-video and text-to-video. Any duration from 1 to 15 seconds.',
    category: 'video',
    creditCost: 10,
    supportsReferenceImage: true,
    referenceImageKey: 'image',
    supportsNegativePrompt: false,
    provider: 'replicate',
    estimatedTime: '~2-4 minutes',
    badge: 'Flexible',
    async: true,
    params: [
      {
        key: 'duration',
        label: 'Duration',
        type: 'number',
        description: 'Video length in seconds (1-15). Set any duration you want.',
        min: 1,
        max: 15,
        step: 1,
        default: 15,
        group: 'basic',
      },
      {
        key: 'aspect_ratio',
        label: 'Aspect Ratio',
        type: 'select',
        description: 'Video dimensions ratio. Ignored when providing an input image.',
        options: [
          { value: '16:9', label: '16:9 (Landscape)' },
          { value: '9:16', label: '9:16 (Vertical/TikTok)' },
          { value: '1:1', label: '1:1 (Square)' },
          { value: '4:3', label: '4:3 (Classic)' },
          { value: '3:4', label: '3:4 (Portrait)' },
          { value: '3:2', label: '3:2 (Photo)' },
          { value: '2:3', label: '2:3 (Tall)' },
        ],
        default: '16:9',
        group: 'basic',
      },
      {
        key: 'resolution',
        label: 'Resolution',
        type: 'select',
        description: 'Video resolution.',
        options: [
          { value: '720p', label: '720p (HD)' },
          { value: '480p', label: '480p (Fast)' },
        ],
        default: '720p',
        group: 'basic',
      },
    ],
  },

  // ── OpenAI Sora 2 (4-12 seconds) ──
  // Schema: openai/sora-2 — seconds: enum [4, 8, 12], default 4
  {
    id: 'openai-sora-2',
    replicateId: 'openai/sora-2',
    name: 'OpenAI Sora 2',
    brand: 'OpenAI',
    description: 'OpenAI video generation. Up to 12 seconds with synchronized audio. Portrait (720x1280) or landscape (1280x720).',
    category: 'video',
    creditCost: 12,
    supportsReferenceImage: true,
    referenceImageKey: 'input_reference',
    supportsNegativePrompt: false,
    provider: 'replicate',
    estimatedTime: '~3-5 minutes',
    badge: 'OpenAI',
    async: true,
    params: [
      {
        key: 'seconds',
        label: 'Duration',
        type: 'select',
        description: 'Video length in seconds.',
        options: [
          { value: '4', label: '4 seconds' },
          { value: '8', label: '8 seconds' },
          { value: '12', label: '12 seconds' },
        ],
        default: '12',
        group: 'basic',
      },
      {
        key: 'aspect_ratio',
        label: 'Aspect Ratio',
        type: 'select',
        description: 'Portrait is 720x1280, landscape is 1280x720.',
        options: [
          { value: 'landscape', label: 'Landscape (1280x720)' },
          { value: 'portrait', label: 'Portrait (720x1280)' },
        ],
        default: 'landscape',
        group: 'basic',
      },
    ],
  },

  // ── ByteDance Seedance 1 Pro (2-12 seconds, 1080p) ──
  // Schema: bytedance/seedance-1-pro — duration: integer min 2, max 12, default 5
  {
    id: 'seedance-1-pro',
    replicateId: 'bytedance/seedance-1-pro',
    name: 'Seedance 1 Pro',
    brand: 'ByteDance',
    description: 'Up to 12 seconds at 1080p. Flexible duration from 2-12s. Image-to-video with first/last frame control.',
    category: 'video',
    creditCost: 10,
    supportsReferenceImage: true,
    referenceImageKey: 'image',
    supportsNegativePrompt: false,
    provider: 'replicate',
    estimatedTime: '~2-4 minutes',
    badge: 'Versatile',
    async: true,
    params: [
      {
        key: 'duration',
        label: 'Duration',
        type: 'number',
        description: 'Video length in seconds (2-12).',
        min: 2,
        max: 12,
        step: 1,
        default: 12,
        group: 'basic',
      },
      {
        key: 'resolution',
        label: 'Resolution',
        type: 'select',
        description: 'Video resolution.',
        options: [
          { value: '480p', label: '480p (Fast)' },
          { value: '720p', label: '720p (HD)' },
          { value: '1080p', label: '1080p (Full HD)' },
        ],
        default: '1080p',
        group: 'basic',
      },
      {
        key: 'aspect_ratio',
        label: 'Aspect Ratio',
        type: 'select',
        description: 'Video dimensions ratio. Ignored if an image is provided.',
        options: [
          { value: '16:9', label: '16:9 (Landscape)' },
          { value: '9:16', label: '9:16 (Vertical/TikTok)' },
          { value: '1:1', label: '1:1 (Square)' },
          { value: '4:3', label: '4:3 (Classic)' },
          { value: '3:4', label: '3:4 (Portrait)' },
          { value: '21:9', label: '21:9 (Cinematic)' },
          { value: '9:21', label: '9:21 (Ultra Tall)' },
        ],
        default: '16:9',
        group: 'basic',
      },
      {
        key: 'camera_fixed',
        label: 'Fixed Camera',
        type: 'boolean',
        description: 'Lock camera position for stable shots.',
        default: false,
        group: 'advanced',
      },
      {
        key: 'seed',
        label: 'Seed',
        type: 'number',
        description: 'Random seed for reproducible results.',
        min: 0,
        max: 2147483647,
        step: 1,
        group: 'advanced',
      },
    ],
  },

  // ── Kling V2.6 (5-10 seconds, native audio) ──
  // Schema: kwaivgi/kling-v2.6 — duration: enum [5, 10], default 5
  {
    id: 'kling-v2.6',
    replicateId: 'kwaivgi/kling-v2.6',
    name: 'Kling V2.6',
    brand: 'Kuaishou (Kling)',
    description: 'Up to 10 seconds with native synchronized audio. Cinematic quality with excellent motion.',
    category: 'video',
    creditCost: 10,
    supportsReferenceImage: true,
    referenceImageKey: 'start_image',
    supportsNegativePrompt: true,
    provider: 'replicate',
    estimatedTime: '~3-5 minutes',
    badge: 'Audio',
    async: true,
    params: [
      {
        key: 'duration',
        label: 'Duration',
        type: 'select',
        description: 'Video length in seconds.',
        options: [
          { value: '5', label: '5 seconds' },
          { value: '10', label: '10 seconds' },
        ],
        default: '10',
        group: 'basic',
      },
      {
        key: 'aspect_ratio',
        label: 'Aspect Ratio',
        type: 'select',
        description: 'Video dimensions ratio. Ignored if start_image is provided.',
        options: [
          { value: '16:9', label: '16:9 (Landscape)' },
          { value: '9:16', label: '9:16 (Vertical/TikTok)' },
          { value: '1:1', label: '1:1 (Square)' },
        ],
        default: '16:9',
        group: 'basic',
      },
      {
        key: 'generate_audio',
        label: 'Generate Audio',
        type: 'boolean',
        description: 'Generate synchronized audio based on video content.',
        default: true,
        group: 'basic',
      },
      {
        key: 'negative_prompt',
        label: 'Negative Prompt',
        type: 'string',
        description: 'Things you do not want to see in the video.',
        group: 'advanced',
      },
    ],
  },

  // ── Google Veo 3.1 (max 8s, premium, with audio) ──
  // Schema: google/veo-3.1 — duration: enum [4, 6, 8], default 8
  {
    id: 'google-veo-3.1',
    replicateId: 'google/veo-3.1',
    name: 'Google Veo 3.1',
    brand: 'Google DeepMind',
    description: 'Latest Google model. Up to 8 seconds with context-aware audio. 1080p. Reference image support.',
    category: 'video',
    creditCost: 15,
    supportsReferenceImage: true,
    referenceImageKey: 'image',
    supportsNegativePrompt: true,
    provider: 'replicate',
    estimatedTime: '~3-5 minutes',
    badge: 'Premium + Audio',
    async: true,
    params: [
      {
        key: 'duration',
        label: 'Duration',
        type: 'select',
        description: 'Video length in seconds. Max 8s.',
        options: [
          { value: '4', label: '4 seconds' },
          { value: '6', label: '6 seconds' },
          { value: '8', label: '8 seconds (max)' },
        ],
        default: '8',
        group: 'basic',
      },
      {
        key: 'aspect_ratio',
        label: 'Aspect Ratio',
        type: 'select',
        description: 'Video dimensions ratio.',
        options: [
          { value: '16:9', label: '16:9 (Landscape)' },
          { value: '9:16', label: '9:16 (Vertical/TikTok)' },
        ],
        default: '16:9',
        group: 'basic',
      },
      {
        key: 'resolution',
        label: 'Resolution',
        type: 'select',
        description: 'Video resolution.',
        options: [
          { value: '720p', label: '720p (Standard)' },
          { value: '1080p', label: '1080p (HD)' },
        ],
        default: '1080p',
        group: 'basic',
      },
      {
        key: 'generate_audio',
        label: 'Generate Audio',
        type: 'boolean',
        description: 'Generate synchronized audio with the video.',
        default: true,
        group: 'basic',
      },
      {
        key: 'negative_prompt',
        label: 'Negative Prompt',
        type: 'string',
        description: 'Description of what to exclude from the generated video.',
        group: 'advanced',
      },
      {
        key: 'seed',
        label: 'Seed',
        type: 'number',
        description: 'Random seed for reproducible results. Omit for random.',
        min: 0,
        max: 4294967295,
        step: 1,
        group: 'advanced',
      },
    ],
  },

  // ── Google Veo 3 (max 8s, flagship, with audio) ──
  // Schema: google/veo-3 — duration: enum [4, 6, 8], default 8
  {
    id: 'google-veo-3',
    replicateId: 'google/veo-3',
    name: 'Google Veo 3',
    brand: 'Google DeepMind',
    description: 'Flagship text-to-video with native audio and dialogue lip-sync. Up to 8 seconds. Cinematic quality.',
    category: 'video',
    creditCost: 12,
    supportsReferenceImage: true,
    referenceImageKey: 'image',
    supportsNegativePrompt: true,
    provider: 'replicate',
    estimatedTime: '~3-5 minutes',
    badge: 'Flagship + Audio',
    async: true,
    params: [
      {
        key: 'duration',
        label: 'Duration',
        type: 'select',
        description: 'Video length in seconds. Max 8s.',
        options: [
          { value: '4', label: '4 seconds' },
          { value: '6', label: '6 seconds' },
          { value: '8', label: '8 seconds (max)' },
        ],
        default: '8',
        group: 'basic',
      },
      {
        key: 'aspect_ratio',
        label: 'Aspect Ratio',
        type: 'select',
        description: 'Video dimensions ratio.',
        options: [
          { value: '16:9', label: '16:9 (Landscape)' },
          { value: '9:16', label: '9:16 (Vertical/TikTok)' },
        ],
        default: '16:9',
        group: 'basic',
      },
      {
        key: 'resolution',
        label: 'Resolution',
        type: 'select',
        description: 'Video resolution.',
        options: [
          { value: '720p', label: '720p (Standard)' },
          { value: '1080p', label: '1080p (HD)' },
        ],
        default: '1080p',
        group: 'basic',
      },
      {
        key: 'generate_audio',
        label: 'Generate Audio',
        type: 'boolean',
        description: 'Generate synchronized audio with the video.',
        default: true,
        group: 'basic',
      },
      {
        key: 'negative_prompt',
        label: 'Negative Prompt',
        type: 'string',
        description: 'Description of what to exclude from the generated video.',
        group: 'advanced',
      },
      {
        key: 'seed',
        label: 'Seed',
        type: 'number',
        description: 'Random seed for reproducible results. Omit for random.',
        min: 0,
        max: 4294967295,
        step: 1,
        group: 'advanced',
      },
    ],
  },

  // ── MiniMax Hailuo 2.3 (max 10s at 768p) ──
  // Schema: minimax/hailuo-2.3 — duration: enum [6, 10], default 6
  {
    id: 'minimax-hailuo-2.3',
    replicateId: 'minimax/hailuo-2.3',
    name: 'MiniMax Hailuo 2.3',
    brand: 'MiniMax',
    description: 'Up to 10 seconds at 768p. Realistic human motion, cinematic VFX, camera movement control.',
    category: 'video',
    creditCost: 10,
    supportsReferenceImage: true,
    referenceImageKey: 'first_frame_image',
    supportsNegativePrompt: false,
    provider: 'replicate',
    estimatedTime: '~1-3 minutes',
    badge: 'MiniMax Latest',
    async: true,
    params: [
      {
        key: 'duration',
        label: 'Duration',
        type: 'select',
        description: 'Video length in seconds. 10s only available at 768p.',
        options: [
          { value: '6', label: '6 seconds' },
          { value: '10', label: '10 seconds (max, 768p only)' },
        ],
        default: '10',
        group: 'basic',
      },
      {
        key: 'resolution',
        label: 'Resolution',
        type: 'select',
        description: 'Video resolution. 1080p supports only 6-second duration.',
        options: [
          { value: '768p', label: '768p (Standard, 10s OK)' },
          { value: '1080p', label: '1080p (HD, 6s only)' },
        ],
        default: '768p',
        group: 'basic',
      },
      {
        key: 'prompt_optimizer',
        label: 'Prompt Optimizer',
        type: 'boolean',
        description: 'Automatically optimize prompt for better results. Disable for exact prompt control.',
        default: true,
        group: 'basic',
      },
    ],
  },

  // ── Kling V2.1 Master (max 10s, premium T2V+I2V) ──
  // Schema: kwaivgi/kling-v2.1-master — duration: enum [5, 10], default 5
  {
    id: 'kling-v2.1-master',
    replicateId: 'kwaivgi/kling-v2.1-master',
    name: 'Kling V2.1 Master',
    brand: 'Kuaishou (Kling)',
    description: 'Premium Kling. Up to 10 seconds. Superb dynamics and prompt adherence. Text or image input.',
    category: 'video',
    creditCost: 12,
    supportsReferenceImage: true,
    referenceImageKey: 'start_image',
    supportsNegativePrompt: true,
    provider: 'replicate',
    estimatedTime: '~3-5 minutes',
    badge: 'Premium',
    async: true,
    params: [
      {
        key: 'duration',
        label: 'Duration',
        type: 'select',
        description: 'Video length in seconds.',
        options: [
          { value: '5', label: '5 seconds' },
          { value: '10', label: '10 seconds (max)' },
        ],
        default: '10',
        group: 'basic',
      },
      {
        key: 'aspect_ratio',
        label: 'Aspect Ratio',
        type: 'select',
        description: 'Video dimensions ratio. Ignored if start_image is provided.',
        options: [
          { value: '16:9', label: '16:9 (Landscape)' },
          { value: '9:16', label: '9:16 (Vertical/TikTok)' },
          { value: '1:1', label: '1:1 (Square)' },
        ],
        default: '16:9',
        group: 'basic',
      },
      {
        key: 'negative_prompt',
        label: 'Negative Prompt',
        type: 'string',
        description: 'Things you do not want to see in the video.',
        group: 'advanced',
      },
    ],
  },

  // ── Wan 2.5 T2V (max 10s, 1080p, audio) ──
  // Schema: wan-video/wan-2.5-t2v — duration: enum [5, 10], default 5
  {
    id: 'wan-2.5',
    replicateId: 'wan-video/wan-2.5-t2v',
    name: 'Wan 2.5',
    brand: 'Alibaba (Wan)',
    description: 'Up to 10 seconds at 1080p with audio sync. Voice/music synchronization. Major upgrade from Wan 2.1.',
    category: 'video',
    creditCost: 8,
    supportsReferenceImage: false,
    supportsNegativePrompt: true,
    provider: 'replicate',
    estimatedTime: '~2-3 minutes',
    badge: 'Audio + HD',
    async: true,
    params: [
      {
        key: 'duration',
        label: 'Duration',
        type: 'select',
        description: 'Video length in seconds.',
        options: [
          { value: '5', label: '5 seconds' },
          { value: '10', label: '10 seconds (max)' },
        ],
        default: '10',
        group: 'basic',
      },
      {
        key: 'size',
        label: 'Resolution',
        type: 'select',
        description: 'Video resolution and orientation.',
        options: [
          { value: '1280*720', label: '1280x720 (HD Landscape)' },
          { value: '720*1280', label: '720x1280 (HD Portrait)' },
          { value: '1920*1080', label: '1920x1080 (Full HD Landscape)' },
          { value: '1080*1920', label: '1080x1920 (Full HD Portrait)' },
          { value: '832*480', label: '832x480 (Fast Landscape)' },
          { value: '480*832', label: '480x832 (Fast Portrait)' },
        ],
        default: '1280*720',
        group: 'basic',
      },
      {
        key: 'enable_prompt_expansion',
        label: 'Prompt Optimizer',
        type: 'boolean',
        description: 'Automatically enhance prompt for better results.',
        default: true,
        group: 'basic',
      },
      {
        key: 'negative_prompt',
        label: 'Negative Prompt',
        type: 'string',
        description: 'What to avoid in the video.',
        group: 'advanced',
      },
      {
        key: 'seed',
        label: 'Seed',
        type: 'number',
        description: 'Random seed for reproducible results.',
        min: 0,
        max: 2147483647,
        step: 1,
        group: 'advanced',
      },
    ],
  },

  // ── Luma Ray 2 720p (max 9s) ──
  // Schema: luma/ray-2-720p — duration: enum [5, 9], default 5
  {
    id: 'luma-ray-2',
    replicateId: 'luma/ray-2-720p',
    name: 'Luma Ray 2',
    brand: 'Luma AI',
    description: 'Up to 9 seconds. Cinematic quality with smooth camera motion. Photorealistic at 720p.',
    category: 'video',
    creditCost: 10,
    supportsReferenceImage: true,
    referenceImageKey: 'start_image',
    supportsNegativePrompt: false,
    provider: 'replicate',
    estimatedTime: '~3-5 minutes',
    badge: 'Cinematic',
    async: true,
    params: [
      {
        key: 'duration',
        label: 'Duration',
        type: 'select',
        description: 'Video length in seconds.',
        options: [
          { value: '5', label: '5 seconds' },
          { value: '9', label: '9 seconds (max)' },
        ],
        default: '9',
        group: 'basic',
      },
      {
        key: 'aspect_ratio',
        label: 'Aspect Ratio',
        type: 'select',
        description: 'Video dimensions ratio.',
        options: [
          { value: '16:9', label: '16:9 (Landscape)' },
          { value: '9:16', label: '9:16 (Vertical/TikTok)' },
          { value: '1:1', label: '1:1 (Square)' },
          { value: '4:3', label: '4:3 (Classic)' },
          { value: '3:4', label: '3:4 (Portrait)' },
          { value: '21:9', label: '21:9 (Cinematic)' },
          { value: '9:21', label: '9:21 (Ultra Tall)' },
        ],
        default: '16:9',
        group: 'basic',
      },
      {
        key: 'loop',
        label: 'Loop',
        type: 'boolean',
        description: 'Make the video loop seamlessly. Last frame matches first frame for continuous playback.',
        default: false,
        group: 'basic',
      },
    ],
  },

  // ── Google Veo 3.1 (max 8s, premium, with audio) ── duplicate removed, kept above

  // ── MiniMax Hailuo video-01 (fixed 6s) ──
  // Schema: minimax/video-01 — NO duration parameter, fixed ~6 seconds
  {
    id: 'minimax-video-01',
    replicateId: 'minimax/video-01',
    name: 'MiniMax Hailuo',
    brand: 'MiniMax',
    description: 'Fixed 6 seconds at 720p/25fps. Reliable text-to-video and image-to-video. Good motion quality.',
    category: 'video',
    creditCost: 8,
    supportsReferenceImage: true,
    referenceImageKey: 'first_frame_image',
    supportsNegativePrompt: false,
    provider: 'replicate',
    estimatedTime: '~2-3 minutes',
    badge: 'Reliable',
    async: true,
    params: [
      {
        key: 'prompt_optimizer',
        label: 'Prompt Optimizer',
        type: 'boolean',
        description: 'Let MiniMax rewrite your prompt for better results. Disable for exact prompt control.',
        default: true,
        group: 'basic',
      },
    ],
  },

  // ── MiniMax Hailuo video-01-live (fixed ~6s, image-to-video) ──
  // Schema: minimax/video-01-live — NO duration parameter, fixed duration
  {
    id: 'minimax-video-01-live',
    replicateId: 'minimax/video-01-live',
    name: 'MiniMax Hailuo Live',
    brand: 'MiniMax',
    description: 'Fixed ~6 seconds. Image-to-video animation. Optimized for Live2D and animation. Requires reference image.',
    category: 'video',
    creditCost: 8,
    supportsReferenceImage: true,
    referenceImageKey: 'first_frame_image',
    supportsNegativePrompt: false,
    provider: 'replicate',
    estimatedTime: '~2-3 minutes',
    badge: 'Image to Video',
    async: true,
    params: [
      {
        key: 'prompt_optimizer',
        label: 'Prompt Optimizer',
        type: 'boolean',
        description: 'Let MiniMax enhance your prompt.',
        default: true,
        group: 'basic',
      },
    ],
  },

  // ── Kling V2.1 (max 10s, I2V, start_image required) ──
  // Schema: kwaivgi/kling-v2.1 — duration: enum [5, 10], default 5
  {
    id: 'kling-v2.1',
    replicateId: 'kwaivgi/kling-v2.1',
    name: 'Kling V2.1',
    brand: 'Kuaishou (Kling)',
    description: 'Up to 10 seconds. Image-to-video at 720p or 1080p. Requires a starting image.',
    category: 'video',
    creditCost: 10,
    supportsReferenceImage: true,
    referenceImageKey: 'start_image',
    supportsNegativePrompt: true,
    provider: 'replicate',
    estimatedTime: '~3-5 minutes',
    badge: 'I2V',
    async: true,
    params: [
      {
        key: 'duration',
        label: 'Duration',
        type: 'select',
        description: 'Video length in seconds.',
        options: [
          { value: '5', label: '5 seconds' },
          { value: '10', label: '10 seconds (max)' },
        ],
        default: '10',
        group: 'basic',
      },
      {
        key: 'mode',
        label: 'Quality Mode',
        type: 'select',
        description: 'Standard = 720p/24fps. Pro = 1080p/24fps.',
        options: [
          { value: 'standard', label: 'Standard (720p)' },
          { value: 'pro', label: 'Pro (1080p)' },
        ],
        default: 'standard',
        group: 'basic',
      },
      {
        key: 'negative_prompt',
        label: 'Negative Prompt',
        type: 'string',
        description: 'Things you do not want to see in the video.',
        group: 'advanced',
      },
    ],
  },

  // ── Google Veo 2 (max 8s) ──
  // Schema: google/veo-2 — duration: enum [5, 6, 7, 8], default 5
  {
    id: 'google-veo-2',
    replicateId: 'google/veo-2',
    name: 'Google Veo 2',
    brand: 'Google DeepMind',
    description: 'Up to 8 seconds. Realistic motion, high-quality output. Mature and stable model.',
    category: 'video',
    creditCost: 8,
    supportsReferenceImage: true,
    referenceImageKey: 'image',
    supportsNegativePrompt: false,
    provider: 'replicate',
    estimatedTime: '~2-4 minutes',
    badge: 'Stable',
    async: true,
    params: [
      {
        key: 'duration',
        label: 'Duration',
        type: 'select',
        description: 'Video length in seconds.',
        options: [
          { value: '5', label: '5 seconds' },
          { value: '6', label: '6 seconds' },
          { value: '7', label: '7 seconds' },
          { value: '8', label: '8 seconds (max)' },
        ],
        default: '8',
        group: 'basic',
      },
      {
        key: 'aspect_ratio',
        label: 'Aspect Ratio',
        type: 'select',
        description: 'Video dimensions ratio.',
        options: [
          { value: '16:9', label: '16:9 (Landscape)' },
          { value: '9:16', label: '9:16 (Vertical/TikTok)' },
        ],
        default: '16:9',
        group: 'basic',
      },
      {
        key: 'seed',
        label: 'Seed',
        type: 'number',
        description: 'Random seed for reproducible results. Omit for random.',
        min: 0,
        max: 4294967295,
        step: 1,
        group: 'advanced',
      },
    ],
  },
];

// ── Helper functions ──

export const ALL_MODELS = [...IMAGE_MODELS, ...VIDEO_MODELS];

export function getModelById(id: string): AIModel | undefined {
  return ALL_MODELS.find(m => m.id === id);
}

export function getImageModels(): AIModel[] {
  return IMAGE_MODELS;
}

export function getVideoModels(): AIModel[] {
  return VIDEO_MODELS;
}

export function getDefaultImageModel(): AIModel {
  return IMAGE_MODELS[0]; // FLUX 1.1 Pro
}

export function getDefaultVideoModel(): AIModel {
  return VIDEO_MODELS[0]; // MiniMax Hailuo
}

/** Build the input object for Replicate API from user-selected params */
export function buildModelInput(
  model: AIModel,
  prompt: string,
  userParams: Record<string, unknown>,
  referenceImage?: string,
  negativePrompt?: string,
): Record<string, unknown> {
  const input: Record<string, unknown> = { prompt };

  // Add user-configured params (only if they differ from undefined/empty)
  for (const param of model.params) {
    const value = userParams[param.key];
    if (value !== undefined && value !== '' && value !== null) {
      input[param.key] = value;
    } else if (param.default !== undefined) {
      input[param.key] = param.default;
    }
  }

  // Add reference image
  if (referenceImage && model.supportsReferenceImage && model.referenceImageKey) {
    input[model.referenceImageKey] = referenceImage;
  }

  // Add negative prompt
  if (negativePrompt && model.supportsNegativePrompt) {
    input.negative_prompt = negativePrompt;
  }

  return input;
}

/** Get default param values for a model */
export function getDefaultParams(model: AIModel): Record<string, unknown> {
  const defaults: Record<string, unknown> = {};
  for (const param of model.params) {
    if (param.default !== undefined) {
      defaults[param.key] = param.default;
    }
  }
  return defaults;
}
