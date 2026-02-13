# Grothi - Per-Platform Content Strategy + AI Media Generation

## Overview

Add per-platform content scheduling (how many videos, images, texts per platform per day), AI-powered image and video generation, and a user-friendly "Content Strategy" UI page.

---

## Phase 1: Database Schema — `PlatformContentPlan` model

### New Prisma model

```prisma
model PlatformContentPlan {
  id        String       @id @default(cuid())
  botId     String
  platform  PlatformType
  enabled   Boolean      @default(true)

  // Daily content quotas
  dailyTexts    Int @default(1)
  dailyImages   Int @default(1)
  dailyVideos   Int @default(0)
  dailyStories  Int @default(0)   // Instagram/Facebook Stories, TikTok, YT Shorts

  // Platform-specific style overrides (null = use bot defaults)
  toneOverride       String?   // e.g. "professional", "casual"
  imageStyleOverride String?   // e.g. "minimalist", "bold"
  videoStyleOverride String?   // e.g. "quick_tips", "product_demo"
  hashtagOverride    String?   // e.g. "moderate", "heavy"

  // Video preferences for this platform
  videoLength   String?   // "short_5_15s", "medium_30_60s", "long_2_5min"
  videoFormat   String?   // "vertical_9_16", "square_1_1", "landscape_16_9"

  // Posting windows (JSON array of hour ints, e.g. [9,13,17])
  postingHours  Json?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  bot Bot @relation(fields: [botId], references: [id], onDelete: Cascade)

  @@unique([botId, platform])
  @@index([botId])
}
```

Add to Bot model: `contentPlans PlatformContentPlan[]`

### New enums to add to constants.ts

```ts
export const VIDEO_LENGTHS = [
  { value: 'short_5_15s', label: '5-15 seconds', desc: 'Quick hooks, TikTok/Reels/Shorts' },
  { value: 'medium_30_60s', label: '30-60 seconds', desc: 'Tips, product demos, explainers' },
  { value: 'long_2_5min', label: '2-5 minutes', desc: 'Tutorials, deep dives, YouTube' },
];

export const VIDEO_FORMATS = [
  { value: 'vertical_9_16', label: 'Vertical 9:16', desc: 'TikTok, Reels, Shorts, Stories' },
  { value: 'square_1_1', label: 'Square 1:1', desc: 'Facebook, Instagram feed, LinkedIn' },
  { value: 'landscape_16_9', label: 'Landscape 16:9', desc: 'YouTube, Twitter, LinkedIn' },
];

export const VIDEO_STYLES = [
  { value: 'quick_tips', label: 'Quick Tips', desc: 'Fast-paced educational clips' },
  { value: 'product_demo', label: 'Product Demo', desc: 'Showcase features and benefits' },
  { value: 'storytelling', label: 'Storytelling', desc: 'Narrative-driven, emotional' },
  { value: 'behind_scenes', label: 'Behind the Scenes', desc: 'Authentic, raw, personal' },
  { value: 'testimonial', label: 'Testimonial', desc: 'Customer stories, social proof' },
  { value: 'trending', label: 'Trending/Meme', desc: 'Current trends, viral formats' },
  { value: 'explainer', label: 'Explainer', desc: 'Concept breakdowns, how-it-works' },
  { value: 'slideshow', label: 'Slideshow', desc: 'Image carousel with transitions' },
];
```

---

## Phase 2: Per-Platform Content Strategy Defaults

### Marketing best-practice defaults per platform

These are pre-filled when a user connects a platform, based on top marketer recommendations:

| Platform | Daily Texts | Daily Images | Daily Videos | Daily Stories | Video Length | Video Format | Hashtags |
|----------|------------|-------------|-------------|--------------|-------------|-------------|----------|
| **Facebook** | 1 | 1 | 1 | 1 | medium_30_60s | landscape_16_9 | minimal |
| **Instagram** | 0 | 1 | 1 | 2 | short_5_15s | vertical_9_16 | heavy |
| **X (Twitter)** | 3 | 1 | 0 | 0 | short_5_15s | landscape_16_9 | minimal |
| **LinkedIn** | 1 | 1 | 1 | 0 | medium_30_60s | landscape_16_9 | moderate |
| **TikTok** | 0 | 0 | 2 | 0 | short_5_15s | vertical_9_16 | heavy |
| **YouTube** | 0 | 0 | 1 | 1 | long_2_5min | landscape_16_9 | moderate |
| **Pinterest** | 0 | 3 | 1 | 0 | short_5_15s | vertical_9_16 | heavy |
| **Threads** | 2 | 1 | 0 | 0 | — | — | none |
| **Reddit** | 1 | 0 | 0 | 0 | — | — | none |
| **Telegram** | 2 | 1 | 0 | 0 | — | — | none |
| **Discord** | 2 | 1 | 0 | 0 | — | — | none |
| **Medium** | 1/week | 1 header | 0 | 0 | — | — | none |
| **Dev.to** | 1/week | 1 cover | 0 | 0 | — | — | moderate |
| **Mastodon** | 2 | 1 | 0 | 0 | — | — | moderate |
| **Bluesky** | 3 | 1 | 0 | 0 | — | — | none |
| **Nostr** | 2 | 0 | 0 | 0 | — | — | none |

### Why these numbers:
- **Facebook**: Algorithm prioritizes video (Reels). 1-2 posts/day is optimal, link posts suppressed
- **Instagram**: Visual-first. 1 Reel/day outperforms everything. 3-7 Stories/day keeps you visible. Carousels for saves
- **X/Twitter**: High-volume text platform. 3-5 tweets/day. Video has 10x engagement over links
- **LinkedIn**: 1-2 posts/day max. Text-only or video outperforms link posts. Dwell time matters
- **TikTok**: 1-3 videos/day. First 3s hook determines performance. Watch completion = #1 factor
- **YouTube**: 1 long video/week + 2-3 Shorts/day. Consistency > frequency for long-form
- **Pinterest**: 3-5 pins/day. Vertical (2:3) images perform best. Keywords critical for SEO
- **Threads**: Text-first like Twitter. 2-3 posts/day. Conversation starters work best
- **Reddit**: 1 genuine post/day. >10% self-promo triggers spam filters
- **Telegram**: 2-3 per day. Rich media gets 2x engagement
- **Medium/Dev.to**: 1-2 articles/week. Quality over quantity
- **Mastodon/Bluesky**: Chronological feeds — 2-3/day works well
- **Nostr**: Decentralized, 2-3 notes/day

---

## Phase 3: AI Generation Integration — Replicate API

### Why Replicate?
1. **Single API** for both image AND video generation
2. **Pay-per-use** — no monthly subscriptions ($0.003-0.05/image, $0.05-0.50/video)
3. **Webhook support** — async generation, no blocking
4. **Multiple models** — can switch without code changes
5. **Stable API**, well-documented, widely used in production
6. **No rate limits** for reasonable usage

### Models to use:
- **Images**: `black-forest-labs/flux-1.1-pro` (best quality/speed balance)
  - Fallback: `stability-ai/sdxl` (cheaper, still good)
- **Videos**: `minimax/video-01-live` (best for short social media videos)
  - Fallback: `luma/ray` (Dream Machine — good for cinematic)
- **Text**: Claude API (already integrated) — generates scripts, captions, post text

### New environment variable:
```env
REPLICATE_API_TOKEN=r8_...  # From replicate.com
```

### New ActionType costs:
```
GENERATE_IMAGE = 3 credits
GENERATE_VIDEO = 8 credits
```

### API routes to create:

#### `POST /api/generate/image`
```
Body: { botId, platform, prompt?, style? }
1. Auth check + bot ownership
2. Deduct credits (GENERATE_IMAGE = 3)
3. Build prompt from bot's imagePreferences + platformContentPlan style
4. Call Replicate: flux-1.1-pro with platform-specific dimensions
5. Download result, save to data/uploads/{botId}/
6. Create Media record (type: IMAGE)
7. Return media object
```

#### `POST /api/generate/video`
```
Body: { botId, platform, prompt?, style?, length? }
1. Auth check + bot ownership
2. Deduct credits (GENERATE_VIDEO = 8)
3. Build prompt from bot's instructions + platform plan's videoStyle
4. Call Replicate: minimax/video-01-live with platform aspect ratio
5. Download result, save to data/uploads/{botId}/
6. Create Media record (type: VIDEO, duration)
7. Return media object
```

#### `POST /api/generate/text`
```
Body: { botId, platform, contentType?, tone? }
1. Auth check + bot ownership
2. Deduct credits (GENERATE_CONTENT = 5, already exists)
3. Build prompt from bot instructions + brand knowledge + platform plan
4. Call Claude API with platform-specific guidelines
5. Return { text, hashtags, suggestedMedia }
```

---

## Phase 4: New "Content Strategy" Page

### Location: `src/app/dashboard/bots/[id]/strategy/page.tsx`

### New bot nav tab (add to BOT_NAV_TABS):
```ts
{ key: 'strategy', label: 'Content Strategy', path: '/strategy' },
```

### Page Layout (user-friendly, visual):

```
┌──────────────────────────────────────────────────┐
│ {botName} - Content Strategy                      │
│ Define what and how often to post on each platform│
│ [Overview] [Activity] [Platforms] ...  [Strategy]  │
├──────────────────────────────────────────────────┤
│ ℹ️ How it works                                   │
│ Set a daily content plan for each connected       │
│ platform. The bot auto-generates text, images,    │
│ and videos based on your preferences.             │
├──────────────────────────────────────────────────┤
│                                                   │
│ ┌─ Facebook ──────────── Connected ─────────────┐ │
│ │ Daily Plan:                                    │ │
│ │  📝 Texts [1] 🖼️ Images [1] 🎬 Videos [1]    │ │
│ │  📱 Stories/Reels [1]                          │ │
│ │                                                │ │
│ │ Style: [Professional ▾]  Hashtags: [Minimal ▾] │ │
│ │ Video: [30-60s ▾] [Landscape 16:9 ▾]          │ │
│ │                                                │ │
│ │ 📊 Recommended: 1 text + 1 image + 1 video/day│ │
│ │    Links in body reduce reach 70-80%           │ │
│ └────────────────────────────────────────────────┘ │
│                                                   │
│ ┌─ Instagram ─────────── Connected ─────────────┐ │
│ │ Daily Plan:                                    │ │
│ │  📝 Texts [0] 🖼️ Images [1] 🎬 Videos [1]    │ │
│ │  📱 Stories/Reels [2]                          │ │
│ │                                                │ │
│ │ Style: [Casual ▾]  Hashtags: [Heavy 6-10 ▾]   │ │
│ │ Video: [5-15s ▾] [Vertical 9:16 ▾]            │ │
│ │                                                │ │
│ │ 📊 Recommended: Reels get 2-3x reach.          │ │
│ │    Carousels have highest saves. 3-7 Stories.  │ │
│ └────────────────────────────────────────────────┘ │
│                                                   │
│ ... (repeat for each connected platform) ...      │
│                                                   │
│ ┌─ Not Connected Platforms ─────────────────────┐ │
│ │ TikTok, Pinterest, YouTube ... [Connect →]    │ │
│ └────────────────────────────────────────────────┘ │
│                                                   │
│ [💡 Apply Recommended Settings] [Save Strategy]   │
└──────────────────────────────────────────────────┘
```

### Key UX principles:
1. **Only show connected platforms** prominently — unconnected at bottom as links
2. **Pre-fill with recommended defaults** — user just tweaks
3. **Inline tips** per platform — "Recommended: Reels get 2-3x reach"
4. **Number inputs with +/- steppers** for daily quotas
5. **Dropdowns** for style/format options
6. **"Apply Recommended"** button fills in all defaults at once
7. **Mobile-friendly** — stacked cards, responsive grid

---

## Phase 5: Rename "Image Style" → "Creative Style"

### Changes:
1. Rename the tab in BOT_NAV_TABS: `{ key: 'creative-style', label: 'Creative Style', path: '/creative-style' }`
2. Move `src/app/dashboard/bots/[id]/image-style/` → `src/app/dashboard/bots/[id]/creative-style/`
3. Add video style preferences section to the page:
   - Default video style (quick_tips, product_demo, storytelling, etc.)
   - Video intro/outro preferences
   - Music/audio style preference
   - Pacing (fast/medium/slow)
   - Text overlays on video (always/sometimes/never)
4. Keep all existing image preferences

### Updated `imagePreferences` → `creativePreferences` in Bot model (JSON field rename):
```ts
{
  // Existing image fields
  brandColors, visualStyles, imageTypes, tone, textOverlay, logoPlacement, fontStyle, subjects, avoidTopics, customInstructions,
  // New video fields
  videoStyle: "quick_tips",
  videoPacing: "medium",
  videoTextOverlays: "sometimes",
  videoMusicStyle: "upbeat",
  videoIntro: "",
  videoOutro: "",
}
```

---

## Phase 6: Integration into Scheduler

### Current scheduler behavior:
- Manual post creation with text + optional media
- Platform targeting

### Enhanced scheduler:
- Auto-generate content based on PlatformContentPlan quotas
- Daily cron job reads each bot's plans and creates ScheduledPosts
- Each ScheduledPost gets AI-generated text, image, or video based on the plan
- User can review/edit before publishing

---

## Implementation Order

### Step 1: Schema + Constants (30 min)
- [ ] Add PlatformContentPlan model to Prisma schema
- [ ] Add GENERATE_IMAGE, GENERATE_VIDEO to ActionType enum
- [ ] Add VIDEO_LENGTHS, VIDEO_FORMATS, VIDEO_STYLES to constants.ts
- [ ] Run prisma generate + migrate

### Step 2: Content Strategy Page (2-3 hours)
- [ ] Add 'strategy' tab to BOT_NAV_TABS
- [ ] Create `/dashboard/bots/[id]/strategy/page.tsx`
- [ ] Platform-specific defaults in `src/lib/platform-defaults.ts`
- [ ] Server actions: save/load/apply-defaults
- [ ] Auto-create default plans when platform is connected

### Step 3: Creative Style Page Update (1 hour)
- [ ] Rename image-style → creative-style (route + nav)
- [ ] Add video preference section
- [ ] Update Bot model JSON field

### Step 4: AI Generation API Routes (2-3 hours)
- [ ] Install Replicate SDK: `npm i replicate`
- [ ] Create `src/lib/replicate.ts` (lazy-loaded client)
- [ ] Create `POST /api/generate/image` route
- [ ] Create `POST /api/generate/video` route
- [ ] Create `POST /api/generate/text` route (enhance existing)
- [ ] Add credit costs for new action types

### Step 5: UI for Generation in Media Page (1-2 hours)
- [ ] "Generate Image" button with platform selector + style
- [ ] "Generate Video" button with platform selector + length/style
- [ ] Generation progress indicator (polling or SSE)
- [ ] Preview generated media before saving

### Step 6: Auto-Scheduler Integration (2 hours)
- [ ] Daily content planning based on PlatformContentPlan
- [ ] Auto-generate and queue posts
- [ ] Review queue in scheduler

---

## Files to Create/Modify

### New files:
- `src/app/dashboard/bots/[id]/strategy/page.tsx` — Content Strategy page
- `src/lib/platform-defaults.ts` — Default content plans per platform
- `src/lib/replicate.ts` — Replicate API client (lazy-loaded)
- `src/app/api/generate/image/route.ts` — Image generation endpoint
- `src/app/api/generate/video/route.ts` — Video generation endpoint
- `src/app/api/generate/text/route.ts` — Text generation endpoint

### Modified files:
- `prisma/schema.prisma` — PlatformContentPlan model + ActionType enum
- `src/lib/constants.ts` — New constants (VIDEO_*, BOT_NAV_TABS)
- `src/app/dashboard/bots/[id]/image-style/` → rename to creative-style
- `src/components/dashboard/bot-nav.tsx` — Updated nav
- `src/components/dashboard/media-upload-form.tsx` — Add "Generate" buttons
- `src/lib/credits.ts` — New action costs
