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
// Model IDs verified against https://replicate.com/collections/text-to-video

export const VIDEO_MODELS: AIModel[] = [
  // ── Google Veo 3.1 (latest, premium, with audio) ──
  {
    id: 'google-veo-3.1',
    replicateId: 'google/veo-3.1',
    name: 'Google Veo 3.1',
    brand: 'Google DeepMind',
    description: 'Latest Google video model. Higher-fidelity video with context-aware audio. Supports reference images and frame-to-frame generation.',
    category: 'video',
    creditCost: 15,
    supportsReferenceImage: true,
    referenceImageKey: 'image',
    supportsNegativePrompt: false,
    provider: 'replicate',
    estimatedTime: '~3-5 minutes',
    badge: 'Premium + Audio',
    async: true,
    params: [
      {
        key: 'duration',
        label: 'Duration',
        type: 'select',
        description: 'Video length in seconds.',
        options: [
          { value: '4', label: '4 seconds' },
          { value: '6', label: '6 seconds' },
          { value: '8', label: '8 seconds' },
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
        description: 'Video resolution. 1080p for higher quality.',
        options: [
          { value: '720p', label: '720p (Standard)' },
          { value: '1080p', label: '1080p (HD)' },
        ],
        default: '720p',
        group: 'basic',
      },
      {
        key: 'seed',
        label: 'Seed',
        type: 'number',
        description: 'Random seed for reproducible results.',
        min: 0,
        max: 4294967295,
        step: 1,
        group: 'advanced',
      },
    ],
  },

  // ── Google Veo 3 (flagship, with audio) ──
  {
    id: 'google-veo-3',
    replicateId: 'google/veo-3',
    name: 'Google Veo 3',
    brand: 'Google DeepMind',
    description: 'Google flagship text-to-video with native audio and dialogue lip-sync. Cinematic quality.',
    category: 'video',
    creditCost: 12,
    supportsReferenceImage: true,
    referenceImageKey: 'image',
    supportsNegativePrompt: false,
    provider: 'replicate',
    estimatedTime: '~3-5 minutes',
    badge: 'Flagship + Audio',
    async: true,
    params: [
      {
        key: 'duration',
        label: 'Duration',
        type: 'select',
        description: 'Video length in seconds.',
        options: [
          { value: '4', label: '4 seconds' },
          { value: '6', label: '6 seconds' },
          { value: '8', label: '8 seconds' },
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
        default: '720p',
        group: 'basic',
      },
      {
        key: 'seed',
        label: 'Seed',
        type: 'number',
        description: 'Random seed for reproducible results.',
        min: 0,
        max: 4294967295,
        step: 1,
        group: 'advanced',
      },
    ],
  },

  // ── MiniMax Hailuo 2.3 (latest MiniMax, high fidelity) ──
  {
    id: 'minimax-hailuo-2.3',
    replicateId: 'minimax/hailuo-2.3',
    name: 'MiniMax Hailuo 2.3',
    brand: 'MiniMax',
    description: 'Latest MiniMax model. Realistic human motion, cinematic VFX, camera movement control. 6s or 10s clips up to 1080p.',
    category: 'video',
    creditCost: 10,
    supportsReferenceImage: true,
    referenceImageKey: 'first_frame_image',
    supportsNegativePrompt: false,
    provider: 'replicate',
    estimatedTime: '~1-3 minutes',
    badge: 'Latest',
    async: true,
    params: [
      {
        key: 'duration',
        label: 'Duration',
        type: 'select',
        description: 'Video length in seconds. 10s not available at 1080p.',
        options: [
          { value: '6', label: '6 seconds' },
          { value: '10', label: '10 seconds (768p only)' },
        ],
        default: '6',
        group: 'basic',
      },
      {
        key: 'resolution',
        label: 'Resolution',
        type: 'select',
        description: 'Video resolution. 1080p only available for 6s duration.',
        options: [
          { value: '768P', label: '768p (Standard)' },
          { value: '1080P', label: '1080p (HD, 6s only)' },
        ],
        default: '768P',
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

  // ── Kling V2.1 Master (premium, T2V+I2V, 1080p) ──
  {
    id: 'kling-v2.1-master',
    replicateId: 'kwaivgi/kling-v2.1-master',
    name: 'Kling V2.1 Master',
    brand: 'Kuaishou (Kling)',
    description: 'Premium Kling model. Superb dynamics and prompt adherence. 1080p 5s and 10s videos from text or image.',
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
          { value: '10', label: '10 seconds' },
        ],
        default: '5',
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
        ],
        default: '16:9',
        group: 'basic',
      },
      {
        key: 'cfg_scale',
        label: 'Guidance Scale',
        type: 'number',
        description: 'How closely to follow the prompt (0-1). Higher = more faithful.',
        min: 0,
        max: 1,
        step: 0.05,
        default: 0.5,
        group: 'advanced',
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

  // ── xAI Grok Imagine Video ──
  {
    id: 'grok-imagine-video',
    replicateId: 'xai/grok-imagine-video',
    name: 'Grok Imagine Video',
    brand: 'xAI (Grok)',
    description: 'xAI video generation with native audio. Image-to-video and text-to-video. 1-15 second clips with synchronized sound.',
    category: 'video',
    creditCost: 10,
    supportsReferenceImage: true,
    referenceImageKey: 'image_url',
    supportsNegativePrompt: false,
    provider: 'replicate',
    estimatedTime: '~2-4 minutes',
    badge: 'Audio + I2V',
    async: true,
    params: [
      {
        key: 'duration',
        label: 'Duration',
        type: 'number',
        description: 'Video length in seconds (1-15).',
        min: 1,
        max: 15,
        step: 1,
        default: 8,
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

  // ── Luma Ray 2 720p ──
  {
    id: 'luma-ray-2',
    replicateId: 'luma/ray-2-720p',
    name: 'Luma Ray 2',
    brand: 'Luma AI',
    description: 'Cinematic quality video generation. Photorealistic output with smooth camera motion. 5s or 9s clips at 720p.',
    category: 'video',
    creditCost: 10,
    supportsReferenceImage: false,
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
        description: 'Video length.',
        options: [
          { value: '5s', label: '5 seconds' },
          { value: '9s', label: '9 seconds' },
        ],
        default: '5s',
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
        description: 'Make the video loop seamlessly. Last frame matches first frame.',
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

  // ── MiniMax Hailuo video-01 (text-to-video) ──
  {
    id: 'minimax-video-01',
    replicateId: 'minimax/video-01',
    name: 'MiniMax Hailuo',
    brand: 'MiniMax',
    description: 'High quality text-to-video and image-to-video. Good motion, diverse styles. 6 second clips at 720p/25fps.',
    category: 'video',
    creditCost: 8,
    supportsReferenceImage: false,
    supportsNegativePrompt: false,
    provider: 'replicate',
    estimatedTime: '~2-3 minutes',
    badge: 'Recommended',
    async: true,
    params: [
      {
        key: 'prompt_optimizer',
        label: 'Prompt Optimizer',
        type: 'boolean',
        description: 'Let MiniMax rewrite your prompt for better results. Disable for exact prompt control.',
        default: false,
        group: 'basic',
      },
    ],
  },

  // ── MiniMax Hailuo video-01-live (image-to-video) ──
  {
    id: 'minimax-video-01-live',
    replicateId: 'minimax/video-01-live',
    name: 'MiniMax Hailuo Live',
    brand: 'MiniMax',
    description: 'Image-to-video animation. Bring your images to life with motion. Optimized for Live2D and animation. Requires reference image.',
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
        default: false,
        group: 'basic',
      },
    ],
  },

  // ── Kling V2.1 (image-to-video, 720p/1080p) ──
  {
    id: 'kling-v2.1',
    replicateId: 'kwaivgi/kling-v2.1',
    name: 'Kling V2.1',
    brand: 'Kuaishou (Kling)',
    description: 'High quality AI video from images. 5s or 10s clips in 720p/1080p. Great motion and physics.',
    category: 'video',
    creditCost: 10,
    supportsReferenceImage: true,
    referenceImageKey: 'start_image',
    supportsNegativePrompt: true,
    provider: 'replicate',
    estimatedTime: '~3-5 minutes',
    badge: 'High Quality',
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
        default: '5',
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
        ],
        default: '16:9',
        group: 'basic',
      },
      {
        key: 'cfg_scale',
        label: 'Guidance Scale',
        type: 'number',
        description: 'How closely to follow the prompt (0-1). Higher = more faithful.',
        min: 0,
        max: 1,
        step: 0.05,
        default: 0.5,
        group: 'advanced',
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

  // ── Google Veo 2 (up to 4K, mature model) ──
  {
    id: 'google-veo-2',
    replicateId: 'google/veo-2',
    name: 'Google Veo 2',
    brand: 'Google DeepMind',
    description: 'State-of-the-art video generation with realistic motion. Up to 4K resolution capability. 5-8 second clips.',
    category: 'video',
    creditCost: 8,
    supportsReferenceImage: true,
    referenceImageKey: 'image',
    supportsNegativePrompt: false,
    provider: 'replicate',
    estimatedTime: '~2-4 minutes',
    badge: 'Reliable',
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
          { value: '8', label: '8 seconds' },
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
        description: 'Random seed for reproducible results.',
        min: 0,
        max: 4294967295,
        step: 1,
        group: 'advanced',
      },
    ],
  },

  // ── Wan 2.1 T2V ──
  {
    id: 'wan-2.1',
    replicateId: 'wavespeedai/wan-2.1-t2v-480p',
    name: 'Wan 2.1',
    brand: 'Alibaba (Wan)',
    description: 'Fast and affordable video generation at 480p. Great for quick drafts and social content. Up to ~3.4s at 24fps.',
    category: 'video',
    creditCost: 5,
    supportsReferenceImage: false,
    supportsNegativePrompt: true,
    provider: 'replicate',
    estimatedTime: '~1-2 minutes',
    badge: 'Budget',
    async: true,
    params: [
      {
        key: 'num_frames',
        label: 'Number of Frames',
        type: 'number',
        description: 'Total frames to generate (17-81). More frames = longer video. 24fps. 81 frames ≈ 3.4s.',
        min: 17,
        max: 81,
        step: 4,
        default: 81,
        group: 'basic',
      },
      {
        key: 'guidance_scale',
        label: 'Guidance Scale',
        type: 'number',
        description: 'Prompt adherence (0-20). Higher = follows prompt more closely.',
        min: 0,
        max: 20,
        step: 0.5,
        default: 5,
        group: 'advanced',
      },
      {
        key: 'negative_prompt',
        label: 'Negative Prompt',
        type: 'string',
        description: 'What to avoid.',
        default: 'Bright tones, overexposed, static, blurred details, subtitles, style, works, paintings, images, static, overall gray, worst quality, low quality, JPEG artifacts, ugly, duplicate, morbid, mutilated, extra fingers, mutated hands, poorly drawn hands, poorly drawn face, mutation, deformed, blurry, dehydrated, bad anatomy, bad proportions, extra limbs, cloned face, disfigured, gross proportions, malformed limbs, missing arms, missing legs, extra arms, extra legs, fused fingers, too many fingers, long neck',
        group: 'advanced',
      },
      {
        key: 'seed',
        label: 'Seed',
        type: 'number',
        description: 'Random seed.',
        min: 0,
        max: 2147483647,
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
