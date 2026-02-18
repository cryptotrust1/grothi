// ============================================================
// AI Model Guides — User-friendly help for each AI model.
// Only verified information from official documentation.
// ============================================================

export interface ModelGuide {
  /** What this model is best for (1 sentence) */
  bestFor: string;
  /** Prompt writing tips (2-4 short bullets) */
  promptTips: string[];
  /** Example prompt that works well with this model */
  examplePrompt: string;
  /** Per-setting tips: key = param key from ai-models.ts */
  settings: Record<string, string>;
}

// ── IMAGE MODEL GUIDES ──

export const MODEL_GUIDES: Record<string, ModelGuide> = {
  // ── FLUX 1.1 Pro ──
  'flux-1.1-pro': {
    bestFor: 'All-purpose image generation. Best balance of quality and speed for social media posts, product photos, and marketing visuals.',
    promptTips: [
      'Be specific: describe subject, action, setting, lighting, and style',
      'Use natural language — works better than keyword lists',
      'Prompt Enhancement is ON by default — it improves your prompt automatically',
      'Add a reference image to match a visual style from an existing photo',
    ],
    examplePrompt: 'A cozy coffee shop interior with warm morning light streaming through large windows, a steaming latte on a wooden table with a croissant, soft bokeh background, professional food photography',
    settings: {
      aspect_ratio: 'Instagram: 1:1 or 4:5. TikTok/Reels: 9:16. YouTube: 16:9. Pinterest: 2:3.',
      output_format: 'PNG for best quality. JPG for smaller files (good for web). WebP for fastest loading.',
      prompt_upsampling: 'ON = AI expands your prompt for better results. Turn OFF only if the result changes too much from what you want.',
      output_quality: 'Default 90 is fine. Use 100 for print. Below 80 saves space but loses detail.',
      safety_tolerance: 'Default 2 is fine for marketing. Increase only if safe content is being blocked.',
      seed: 'Leave empty for random. Set a number to recreate the exact same image again.',
    },
  },

  // ── FLUX 1.1 Pro Ultra ──
  'flux-1.1-pro-ultra': {
    bestFor: 'Premium 4-megapixel images for print materials, large banners, and high-resolution content where every detail matters.',
    promptTips: [
      'Great for detailed scenes — the high resolution captures fine details',
      'Try Raw Mode for natural, less-processed photography look',
      'Best for product photography, landscapes, and detailed compositions',
      'Supports ultrawide formats like 21:9 for website banners',
    ],
    examplePrompt: 'Professional product photography of luxury skincare bottles arranged on a marble surface, soft natural lighting from the left, shallow depth of field, clean minimalist composition, 4K ultra detailed',
    settings: {
      aspect_ratio: 'Supports ultrawide 21:9 for website headers and banners. 4:5 for Instagram.',
      output_format: 'PNG recommended — preserves maximum detail at high resolution.',
      raw: 'ON = more natural, film-like look. Great for photography. OFF = more polished, AI-enhanced look.',
      output_quality: 'Use 95-100 for print. Default 95 is ideal for most uses.',
      safety_tolerance: 'Same as FLUX Pro. Default 2 works for most content.',
      seed: 'Same number + same prompt = same image. Useful for variations.',
    },
  },

  // ── FLUX Schnell ──
  'flux-schnell': {
    bestFor: 'Quick drafts and iterations. Test your ideas fast for just 1 credit, then switch to Pro for the final version.',
    promptTips: [
      'Perfect for testing prompts before using expensive models',
      'Generate up to 4 variations at once to find the best composition',
      'Keep prompts clear and direct — less processing time means simpler interpretations',
      'Great for batch generating social media content quickly',
    ],
    examplePrompt: 'Bright colorful smoothie bowl top view, fresh berries and granola, clean white background, flat lay food photography',
    settings: {
      aspect_ratio: 'Same options as other FLUX models. Match to your target platform.',
      output_format: 'JPG is fine for drafts. Switch to PNG for final versions.',
      num_outputs: 'Generate 2-4 at once to compare. Each costs 1 credit.',
      megapixels: '1 MP = standard quality. 0.25 MP = ultra-fast preview (quarter resolution).',
      go_fast: 'ON = fastest mode. Turn OFF only if you notice quality issues.',
      output_quality: 'For drafts, 80 is enough. Use higher for final images.',
      seed: 'Set a seed, then change only one thing in the prompt to compare results.',
    },
  },

  // ── FLUX Dev ──
  'flux-dev': {
    bestFor: 'Maximum creative control. Adjust inference steps and guidance to fine-tune exactly how the AI interprets your prompt.',
    promptTips: [
      'More inference steps = higher quality but slower (start with 28)',
      'Higher guidance = more literal interpretation of your prompt',
      'Lower guidance = more creative freedom for the AI',
      'Best for users who want to experiment with generation parameters',
    ],
    examplePrompt: 'Minimalist geometric logo design for a tech startup, clean lines, blue and white color palette, modern and professional, vector art style',
    settings: {
      aspect_ratio: 'Choose based on target platform. 1:1 for Instagram, 16:9 for YouTube.',
      output_format: 'PNG for maximum quality, especially for design work.',
      num_outputs: 'Generate 2-4 variations with same settings to pick the best one.',
      num_inference_steps: '15-20 = fast/draft. 28 = balanced (recommended). 40-50 = maximum quality but slow.',
      guidance: '2-3 = creative/loose. 3.5 = balanced (default). 7-10 = very strict prompt following.',
      go_fast: 'ON for faster generation. OFF for maximum quality per step.',
      megapixels: '1 MP for standard. 0.25 MP for quick tests.',
      seed: 'Use same seed + different guidance values to see how strictness affects output.',
    },
  },

  // ── Recraft V3 ──
  'recraft-v3': {
    bestFor: 'Design assets: logos, icons, illustrations, and vector art. The go-to model for brand and design work.',
    promptTips: [
      'Specify the style: "vector illustration", "icon", "realistic photo"',
      'For logos: describe shape, colors, and style clearly',
      'Use exact pixel sizes matching your target use case',
      'Works great for consistent brand asset generation',
    ],
    examplePrompt: 'Flat vector illustration of a friendly robot mascot waving, simple geometric shapes, vibrant orange and teal color scheme, suitable for app icon, clean white background',
    settings: {
      size: 'Square 1024x1024 for icons/logos. 1820x1024 for banners. 1024x1820 for stories.',
      style: 'Any = auto-detect best style. Realistic = photo-like. Digital Illustration = modern art. Vector = clean scalable graphics. Icon = simple symbols.',
    },
  },

  // ── Ideogram V2 ──
  'ideogram-v2': {
    bestFor: 'Images with readable text. Best for social media graphics, posters, banners, and any image that needs words in it.',
    promptTips: [
      'Put text in quotes: \'A poster with the text "SALE 50% OFF"\'',
      'Describe font style: "bold sans-serif", "elegant script", "handwritten"',
      'Negative prompt helps avoid text errors: "misspelled text, blurry text"',
      'Keep text short — 1-5 words render most reliably',
    ],
    examplePrompt: 'Instagram story design with text "NEW COLLECTION" in bold white sans-serif font, elegant fashion photography background, dark moody lighting, luxury brand aesthetic',
    settings: {
      aspect_ratio: '1:1 for social posts. 9:16 for stories. 3:1 for wide banners.',
      style_type: 'Auto = best guess. Realistic = photo-like. Design = clean graphic. 3D Render = dimensional. Anime = Japanese animation style.',
      magic_prompt_option: 'Auto = AI decides. On = always enhances. Off = uses your exact words (best for precise text placement).',
      negative_prompt: 'Add: "misspelled text, blurry, low quality, extra fingers" to avoid common issues.',
      seed: 'If text rendered correctly, save the seed to regenerate with small changes.',
    },
  },

  // ── Stable Diffusion XL ──
  'sdxl': {
    bestFor: 'Maximum customization at low cost. Full control over every generation parameter. Great for experimentation.',
    promptTips: [
      'Use negative prompts to exclude unwanted elements',
      'Keyword style works well: "professional photo, 8k, detailed, sharp focus"',
      'Try different schedulers — each produces different artistic results',
      'Reference image + low prompt strength = subtle image-to-image editing',
    ],
    examplePrompt: 'professional food photography, artisan pizza on rustic wooden board, melting mozzarella, fresh basil, warm restaurant lighting, shallow depth of field, 8k, ultra detailed',
    settings: {
      width: 'Standard: 1024. Portrait: 768 width. Landscape: 1024+ width. Must be multiple of 64.',
      height: 'Standard: 1024. Portrait: 1024+. Landscape: 768. Must be multiple of 64.',
      num_outputs: 'Generate 1-4 images. Each uses 1 credit.',
      scheduler: 'DPM++ = balanced (default). DDIM = fast/clean. Heun = highest quality. Euler A = most creative/varied.',
      num_inference_steps: '20 = fast draft. 30 = balanced (default). 50-100 = maximum detail (slow).',
      guidance_scale: '5-7 = creative. 7.5 = balanced (default). 10-15 = very strict. Above 20 = may look unnatural.',
      prompt_strength: 'Only with reference image. 0.3 = subtle change. 0.8 = major change (default). 1.0 = ignore reference.',
      negative_prompt: 'Always add: "worst quality, low quality, blurry, distorted" as minimum.',
      refine: 'No Refiner = fastest. Expert Ensemble = best quality improvement. Base Image = alternative refinement.',
      high_noise_frac: 'Only with refiner. 0.8 = default. Lower = refiner does more work. Higher = base model does more.',
      seed: 'Save seeds of good results. Same seed + small prompt changes = controlled variations.',
    },
  },

  // ── VIDEO MODELS ──

  // ── Kling V3 Video ──
  'kling-v3-video': {
    bestFor: 'Longest AI videos (up to 15 seconds). Best for narrative content, storytelling, and scenes that need more time to unfold.',
    promptTips: [
      'Describe the scene AND the action: what happens from start to finish',
      'Specify camera movement: "slow pan left", "zoom in", "tracking shot"',
      'For multi-shot: describe each scene transition clearly',
      'Negative prompt helps: "blurry, distorted faces, jittery motion"',
    ],
    examplePrompt: 'A woman walks through a sunlit cherry blossom garden, petals falling around her, she turns to smile at the camera, soft golden hour lighting, cinematic slow motion, smooth tracking shot',
    settings: {
      duration: '3-5s = short clips, social media. 8-10s = standard content. 12-15s = storytelling, narratives.',
      mode: 'Standard (720p) = faster, good for social. Pro (1080p) = sharper, better for YouTube/websites.',
      aspect_ratio: '16:9 for YouTube/landscape. 9:16 for TikTok/Reels/Stories. 1:1 for Instagram feed. Ignored if you upload a reference image.',
      generate_audio: 'Generates ambient sound matching the video. Great for nature scenes, city sounds. May not work well for speech.',
      negative_prompt: 'Add: "blurry, distorted, jittery, morphing faces" to improve quality.',
    },
  },

  // ── Grok Imagine Video ──
  'grok-imagine-video': {
    bestFor: 'Flexible duration from 1-15 seconds. Good for both text-to-video and image-to-video with any length you need.',
    promptTips: [
      'Works with both text prompts and reference images',
      'Be specific about motion: "camera slowly pans", "subject walks forward"',
      'Shorter videos (3-5s) tend to have better quality per frame',
      'Upload an image to animate it — the image becomes the first frame',
    ],
    examplePrompt: 'Timelapse of a city skyline transitioning from sunset to night, lights gradually turning on in buildings, clouds moving across orange sky, smooth camera, hyper-realistic',
    settings: {
      duration: '1-3s = GIF-like loops. 5-8s = standard clips. 10-15s = longer narratives.',
      aspect_ratio: '16:9 for landscape content. 9:16 for vertical/mobile. 1:1 for square. Ignored when you use a reference image.',
      resolution: '720p = standard, faster. 480p = fastest, lower quality but good for previews.',
    },
  },

  // ── OpenAI Sora 2 ──
  'openai-sora-2': {
    bestFor: 'High-quality video with synchronized audio. Ideal for polished social media content and professional video clips.',
    promptTips: [
      'Describe the scene in detail — Sora excels at understanding complex descriptions',
      'Include mood and atmosphere: "dramatic", "peaceful", "energetic"',
      'Reference images guide the visual style and composition',
      'Best results with clear, well-structured sentences',
    ],
    examplePrompt: 'A drone shot slowly rising above a misty mountain lake at dawn, revealing snow-capped peaks in the background, birds flying across the frame, cinematic quality, nature documentary style',
    settings: {
      seconds: '4s = quick clip. 8s = standard social content. 12s = maximum length for stories.',
      aspect_ratio: 'Landscape (1280x720) for YouTube/web. Portrait (720x1280) for TikTok/Reels.',
    },
  },

  // ── Seedance 1 Pro ──
  'seedance-1-pro': {
    bestFor: 'Versatile video with 1080p quality. Great for image-to-video animation with first/last frame control.',
    promptTips: [
      'Upload a product photo to create a dynamic video ad from it',
      'Specify camera movement for professional results',
      'Works great for e-commerce product showcases',
      'Fixed Camera mode helps for stable product shots',
    ],
    examplePrompt: 'Product showcase: a sleek smartphone rotating slowly on a dark reflective surface, soft studio lighting, particles of light floating around it, premium tech advertisement feel',
    settings: {
      duration: '2-4s = quick loops. 5-8s = standard. 10-12s = maximum for longer content.',
      resolution: '480p = fast preview. 720p = good quality. 1080p = best quality (takes longer).',
      aspect_ratio: '16:9 for landscape. 9:16 for vertical. 21:9 for cinematic. Ignored if you upload an image.',
      camera_fixed: 'ON = camera stays still (good for product shots). OFF = AI decides camera movement.',
      seed: 'Save seed of good videos to recreate with different prompts.',
    },
  },

  // ── Kling V2.6 ──
  'kling-v2.6': {
    bestFor: 'Videos with native synchronized audio. Best when you need ambient sounds, music, or audio effects in your video.',
    promptTips: [
      'Describe sounds in your prompt: "waves crashing", "birds singing"',
      'Audio works best with natural scenes and environmental sounds',
      'Upload a photo to animate it with motion and sound',
      'Negative prompt improves quality: "blurry, distorted, flickering"',
    ],
    examplePrompt: 'Ocean waves gently crashing on a tropical beach at sunset, palm trees swaying in the breeze, golden light reflecting on wet sand, peaceful ambient sounds, cinematic 4K',
    settings: {
      duration: '5s = short social clip. 10s = standard content with more story.',
      aspect_ratio: '16:9 for landscape videos. 9:16 for mobile/TikTok. 1:1 for Instagram.',
      generate_audio: 'ON = AI creates matching audio (ambient, nature, effects). Best for outdoor/nature scenes.',
      negative_prompt: 'Add: "blurry, flickering, distorted audio, morphing" for cleaner results.',
    },
  },

  // ── Google Veo 3.1 ──
  'google-veo-3.1': {
    bestFor: 'Premium video with context-aware audio at 1080p. Google\'s latest model — high quality with smart audio generation.',
    promptTips: [
      'Describe both visual and audio elements for best audio sync',
      'Upload a reference image to guide the visual style',
      'Works great for brand videos and professional content',
      'Negative prompt helps exclude unwanted visual elements',
    ],
    examplePrompt: 'A barista carefully pouring latte art in a busy cafe, steam rising from the cup, soft jazz music in the background, warm interior lighting, close-up shot, professional quality',
    settings: {
      duration: '4s = quick clip. 6s = standard. 8s = maximum length.',
      aspect_ratio: '16:9 for landscape/YouTube. 9:16 for vertical/TikTok.',
      resolution: '720p = faster generation. 1080p = best quality (recommended for final content).',
      generate_audio: 'ON = context-aware audio matching the scene. Great for atmospheric videos.',
      negative_prompt: 'Describe what to avoid: "text overlay, watermark, blurry, shaky camera".',
      seed: 'Set for reproducible results when iterating on a video concept.',
    },
  },

  // ── Google Veo 3 ──
  'google-veo-3': {
    bestFor: 'Flagship video with native audio and dialogue lip-sync. Best for videos with speaking characters or dialogue scenes.',
    promptTips: [
      'Can generate lip-synced dialogue — describe what characters say',
      'Include dialogue in quotes: \'A woman says "Welcome to our store"\'',
      'Excellent for advertisement and promotional videos with speech',
      'Combine with audio generation for full audiovisual content',
    ],
    examplePrompt: 'A friendly chef in a modern kitchen looks at the camera and says "Today we are making the perfect pasta", warm lighting, professional cooking show setup, shallow depth of field',
    settings: {
      duration: '4s = quick intro. 6s = standard clip. 8s = maximum for dialogue scenes.',
      aspect_ratio: '16:9 for landscape presentations. 9:16 for vertical social media.',
      resolution: '720p = faster. 1080p = sharper, recommended for dialogue where lip detail matters.',
      generate_audio: 'ON = generates speech, ambient sounds, and effects. Essential for dialogue videos.',
      negative_prompt: 'Add: "bad lip sync, distorted speech, unnatural mouth movement" for dialogue.',
      seed: 'Save seeds of good takes to regenerate with tweaked prompts.',
    },
  },

  // ── MiniMax Hailuo 2.3 ──
  'minimax-hailuo-2.3': {
    bestFor: 'Realistic human motion and cinematic VFX. Best for videos featuring people, camera movements, and special effects.',
    promptTips: [
      'Excels at realistic human movement and expressions',
      'Describe camera movement: "dolly in", "crane shot", "orbit around"',
      'Prompt Optimizer rewrites your prompt for better MiniMax results',
      'Good for fashion, lifestyle, and people-focused content',
    ],
    examplePrompt: 'A model walks confidently down a city street in autumn, fallen leaves swirling around her feet, camera tracking alongside, golden hour lighting, fashion editorial cinematic style',
    settings: {
      duration: '6s = standard clip. 10s = extended (only available at 768p resolution).',
      resolution: '768p = standard, supports 10s. 1080p = higher quality but limited to 6s only.',
      prompt_optimizer: 'ON = MiniMax rewrites your prompt for better results. OFF = uses your exact words.',
    },
  },

  // ── Kling V2.1 Master ──
  'kling-v2.1-master': {
    bestFor: 'Premium Kling model with superior dynamics. Best prompt adherence — the video closely matches what you describe.',
    promptTips: [
      'Describe specific actions and movements in detail',
      'Works with both text prompts and reference images',
      'Excellent for dynamic scenes with complex motion',
      'Use negative prompt to remove unwanted elements',
    ],
    examplePrompt: 'A gymnast performing a graceful backflip on a beach at sunset, slow motion capture, sand particles floating in golden light, camera follows the motion, cinematic sports photography',
    settings: {
      duration: '5s = short dynamic clip. 10s = longer sequence for more complex action.',
      aspect_ratio: '16:9 for landscape. 9:16 for vertical. 1:1 for square. Ignored with reference image.',
      negative_prompt: 'Add: "blurry, morphing, extra limbs, distorted body" for people videos.',
    },
  },

  // ── Wan 2.5 ──
  'wan-2.5': {
    bestFor: 'HD video with audio synchronization at budget-friendly 8 credits. Great value for 1080p content with sound.',
    promptTips: [
      'Prompt Optimizer enhances your description — recommended to keep ON',
      'Describe audio elements for better sound sync: "birds chirping", "music playing"',
      'Good for nature scenes, cityscapes, and atmospheric content',
      'Multiple resolution options let you balance speed vs quality',
    ],
    examplePrompt: 'Rainy evening in Tokyo, neon signs reflecting on wet streets, people with umbrellas walking past, gentle rain sounds, lo-fi atmospheric mood, cinematic widescreen',
    settings: {
      duration: '5s = standard clip. 10s = extended content.',
      size: 'Choose based on orientation AND quality. 1920x1080 = best landscape. 1080x1920 = best portrait. 832x480 = fastest preview.',
      enable_prompt_expansion: 'ON = AI improves your prompt. OFF = exact prompt control. Keep ON for most cases.',
      negative_prompt: 'Add: "low quality, blurry, watermark, text" to improve output.',
      seed: 'Set to recreate same video. Change seed for new variations of same prompt.',
    },
  },

  // ── Luma Ray 2 ──
  'luma-ray-2': {
    bestFor: 'Cinematic quality with the smoothest camera motion. Best for photorealistic scenes with beautiful camera work.',
    promptTips: [
      'Describe camera movement in detail — Luma excels at smooth motion',
      'Use "cinematic", "photorealistic", "film grain" for movie-like quality',
      'Loop mode creates seamless infinite loops for social media',
      'Upload a photo to create a cinematic animation from it',
    ],
    examplePrompt: 'Cinematic slow-motion shot: a hummingbird hovering near a vibrant red flower, iridescent feathers catching sunlight, shallow depth of field, lush green garden background, film grain',
    settings: {
      duration: '5s = standard cinematic clip. 9s = extended for more complex scenes.',
      aspect_ratio: '16:9 for cinematic. 9:16 for vertical. 21:9 for ultra-wide cinematic. 1:1 for social.',
      loop: 'ON = last frame blends into first frame for seamless infinite loop. Perfect for social media backgrounds and ambient content.',
    },
  },

  // ── MiniMax Hailuo ──
  'minimax-video-01': {
    bestFor: 'Reliable and consistent 6-second videos. Good baseline quality for everyday social media content.',
    promptTips: [
      'Fixed 6-second duration — plan your scene accordingly',
      'Prompt Optimizer helps significantly — keep it ON',
      'Works well for both text-to-video and image-to-video',
      'Good for simple scenes with clear subjects and actions',
    ],
    examplePrompt: 'A golden retriever puppy playing with autumn leaves in a park, wagging tail, joyful energy, warm afternoon sunlight, shallow focus, lifestyle photography style',
    settings: {
      prompt_optimizer: 'ON = MiniMax rewrites your prompt for better video quality. OFF = your exact words. Recommended: ON.',
    },
  },

  // ── MiniMax Hailuo Live ──
  'minimax-video-01-live': {
    bestFor: 'Animating still images into video. Upload a photo and bring it to life. Optimized for character animation and Live2D style.',
    promptTips: [
      'REQUIRES a reference image — upload a photo first',
      'Best with character images, portraits, and illustrations',
      'Describe the motion you want: "character waves", "wind blows hair"',
      'Optimized for anime/illustration style and Live2D animations',
    ],
    examplePrompt: 'The character smiles warmly and waves at the viewer, gentle hair movement from a soft breeze, subtle breathing animation, warm background lighting',
    settings: {
      prompt_optimizer: 'ON = enhances your motion description. OFF = exact prompt. Keep ON for best animation results.',
    },
  },

  // ── Kling V2.1 ──
  'kling-v2.1': {
    bestFor: 'Image-to-video at high quality. Upload a photo and Kling animates it with natural motion. Requires a starting image.',
    promptTips: [
      'REQUIRES a starting image — upload your photo first',
      'Describe what motion should happen to the image',
      'Pro mode (1080p) gives sharper output for important content',
      'Works great for product images, portraits, and scenes',
    ],
    examplePrompt: 'The scene comes to life with gentle movement, camera slowly zooms in, subtle ambient motion in the background, cinematic lighting, smooth natural animation',
    settings: {
      duration: '5s = short animation. 10s = longer sequence with more movement.',
      mode: 'Standard (720p) = faster, good for social. Pro (1080p) = sharper, better for professional use.',
      negative_prompt: 'Add: "jittery, flickering, morphing, distorted" for smoother animation.',
    },
  },

  // ── Google Veo 2 ──
  'google-veo-2': {
    bestFor: 'Stable and mature model at budget-friendly 8 credits. Realistic motion and consistent quality for everyday video needs.',
    promptTips: [
      'Most stable Google video model — very consistent results',
      'Good for landscapes, nature, and architectural scenes',
      'Upload a reference image to guide the visual style',
      'Simple, clear prompts work best — no need for complex descriptions',
    ],
    examplePrompt: 'Aerial view of turquoise ocean waves breaking on a white sand beach, camera slowly flying forward along the coastline, bright sunny day, crystal clear water, tropical paradise',
    settings: {
      duration: '5s = quick clip. 6-7s = standard. 8s = maximum length.',
      aspect_ratio: '16:9 for landscape content. 9:16 for vertical/mobile.',
      seed: 'Set a number for reproducible results. Leave empty for random variation.',
    },
  },
};
