# Grothi.com - AI Marketing Bot SaaS Platform

## Quick Reference

| Item | Value |
|------|-------|
| **Stack** | Next.js 14 (App Router) + TypeScript + Prisma 5.22 + PostgreSQL + Tailwind + shadcn/ui |
| **Local dev** | `/home/user/grothi` |
| **Server** | 89.167.18.92 at `/home/acechange-bot/grothi` |
| **GitHub** | `https://github.com/cryptotrust1/grothi` |
| **Domain** | grothi.com (Cloudflare → Nginx → localhost:3000) |
| **PM2** | `grothi` |
| **DB** | PostgreSQL - user `grothi`, db `grothi` |
| **Admin** | info@grothi.com / Vladimir54793347@ |
| **Deploy** | `cd /home/acechange-bot/grothi && git pull origin main && bash deploy.sh` |

## CRITICAL: Prisma Version

**ALWAYS use `./node_modules/.bin/prisma`** instead of `npx prisma`. The global npx picks up Prisma 7.3.0 which breaks the 5.22.0 schema. This applies to `generate`, `migrate`, `validate`, and all other Prisma CLI commands.

## Architecture

### App Router Structure (63 files)

```
src/
├── app/
│   ├── page.tsx                    # Landing page (public)
│   ├── layout.tsx                  # Root layout with JSON-LD, metadata
│   ├── about/page.tsx              # About page
│   ├── contact/page.tsx            # Contact form (saves to ContactMessage)
│   ├── faq/page.tsx                # FAQ page
│   ├── features/page.tsx           # Features page
│   ├── pricing/page.tsx            # Public pricing page
│   ├── privacy/page.tsx            # Privacy policy
│   ├── terms/page.tsx              # Terms of service
│   │
│   ├── auth/
│   │   ├── signin/page.tsx         # Login (email+password, Zod validation)
│   │   ├── signup/page.tsx         # Register (Zod validation, 100 welcome credits)
│   │   └── forgot-password/page.tsx
│   │
│   ├── dashboard/
│   │   ├── layout.tsx              # Auth-protected layout with sidebar+topbar
│   │   ├── page.tsx                # Dashboard overview (KPIs, bot list)
│   │   ├── settings/page.tsx       # Account settings (profile, password, delete)
│   │   ├── bots/
│   │   │   ├── page.tsx            # Bot list
│   │   │   ├── new/page.tsx        # Create bot form (Zod validation)
│   │   │   └── [id]/
│   │   │       ├── page.tsx        # Bot overview (status, stats, quick actions)
│   │   │       ├── activity/       # Activity log with filters + pagination
│   │   │       ├── analytics/      # Charts (Recharts), KPIs, platform breakdown
│   │   │       ├── platforms/      # 17 platform connections with credential forms
│   │   │       ├── post/            # Post Scheduler (create + manage + calendar + list)
│   │   │       ├── media/          # Media library (upload, grid, AI captions)
│   │   │       ├── products/       # Product catalog (list, create, edit)
│   │   │       ├── scheduler/      # Redirect → /post (consolidated)
│   │   │       ├── autopilot/       # Autopilot: autonomous AI content planning & posting
│   │   │       ├── image-style/    # AI image preferences questionnaire
│   │   │       └── settings/       # Bot settings (goal, schedule, RSS, GA4)
│   │   └── credits/
│   │       ├── page.tsx            # Credit balance + transaction history
│   │       └── buy/page.tsx        # Purchase credits (Stripe checkout)
│   │
│   ├── admin/
│   │   ├── layout.tsx              # Admin-only layout (requireAdmin())
│   │   ├── page.tsx                # Admin dashboard (user count, revenue)
│   │   ├── users/page.tsx          # User management (add credits, view all)
│   │   ├── bots/page.tsx           # All bots across all users
│   │   ├── pricing/page.tsx        # Manage pricing plans + promo codes
│   │   ├── revenue/page.tsx        # Revenue analytics
│   │   └── contacts/page.tsx       # Contact messages
│   │
│   └── api/
│       ├── auth/signout/route.ts   # POST: Clear session cookie
│       ├── media/
│       │   ├── route.ts            # POST: Upload files (magic bytes validation)
│       │   └── [id]/
│       │       ├── route.ts        # GET: Serve file, DELETE: Remove file
│       │       └── generate/route.ts # POST: Claude Vision AI caption generation
│       ├── scheduled-posts/
│       │   ├── route.ts            # GET/POST: List/create scheduled posts
│       │   └── [id]/route.ts       # GET/PATCH/DELETE: Manage individual posts
│       ├── autonomous/
│       │   └── generate-plan/route.ts # POST: Generate autopilot content plan
│       ├── cron/
│       │   ├── process-posts/route.ts       # POST: Publish SCHEDULED posts
│       │   ├── collect-engagement/route.ts  # POST: Fetch engagement metrics
│       │   ├── detect-trends/route.ts       # POST: Hype Radar trend detection
│       │   ├── autonomous-content/route.ts  # POST: AI content for autopilot posts
│       │   └── health-check/route.ts        # POST: Daily health check
│       └── stripe/
│           ├── checkout/route.ts   # POST: Create Stripe checkout session
│           └── webhook/route.ts    # POST: Handle Stripe webhook events
│
├── components/
│   ├── dashboard/
│   │   ├── analytics-charts.tsx    # Recharts: EngagementChart, ActivityChart, CreditsChart
│   │   ├── bot-nav.tsx             # Shared bot sub-navigation (8 tabs)
│   │   ├── media-upload-form.tsx   # Client: drag-and-drop upload + AI generation
│   │   ├── scheduler-client.tsx    # Client: scheduler interactions (placeholder)
│   │   ├── sidebar.tsx             # Dashboard sidebar navigation
│   │   └── topbar.tsx              # Dashboard topbar (mobile menu, credits)
│   └── ui/
│       ├── badge.tsx, button.tsx, card.tsx, input.tsx
│       ├── label.tsx, separator.tsx
│
└── lib/
    ├── auth.ts                     # JWT auth (jose), session management, bcrypt
    ├── constants.ts                # Single source of truth for all shared constants
    ├── credits.ts                  # Transaction-safe credit operations
    ├── db.ts                       # Prisma singleton
    ├── encryption.ts               # AES-256-GCM encryption for API credentials
    ├── platform-algorithm.ts       # Platform algorithm knowledge base (v2) — 15 platforms, 1940 lines
    ├── platform-specs.ts           # Platform image specs + optimal posting times
    ├── stripe.ts                   # Lazy Stripe init, PRICING_PLANS
    ├── utils.ts                    # cn(), formatCredits, creditsToDollars, etc.
    └── validations.ts              # Zod schemas (signUp, signIn, createBot, platform)
```

### Database Schema (Prisma)

**Models**: User, Session, Bot, PlatformConnection, BotActivity, BotDailyStat, CreditBalance, CreditTransaction, PricingPlan, ActionCost, PromoCode, Media, Product, ProductMedia, ScheduledPost, ContactMessage

**Key Enums**: UserRole, BotStatus, SafetyLevel, BotGoal, PlatformType (17 platforms), ConnStatus, ActionType, TxnType, MediaType, PostStatus

### Authentication

- Custom JWT auth using `jose` library (NOT next-auth, despite it being in package.json)
- Sessions stored in DB with 30-day expiry
- Password: bcrypt with 12 salt rounds
- Cookie: `session_token` (httpOnly, secure, sameSite: lax)
- Auth functions: `requireAuth()`, `requireAdmin()`, `getCurrentUser()`, `signUp()`, `signIn()`

### Encryption

- AES-256-GCM for platform API credentials
- Key: `ENCRYPTION_KEY` env var (64 hex chars = 32 bytes)
- Format: `iv:authTag:ciphertext` (all hex)
- Functions: `encrypt()`, `decrypt()`, `maskApiKey()`

### Credits System

- 100 welcome bonus on signup
- Transaction-safe deduction via `db.$transaction()`
- Default action costs: GENERATE_CONTENT=5, POST=2, REPLY=3, FAVOURITE=1, BOOST=1
- Admin can override via ActionCost table
- Stripe checkout for purchases

### Constants (src/lib/constants.ts)

**Single source of truth** for all shared data. All pages import from here instead of defining locally:
- `PLATFORM_NAMES` - 17 platform display names
- `BOT_STATUS_CONFIG` - Badge variant + label per status
- `POST_STATUS_COLORS` - CSS classes per post status
- `GOAL_LABELS` - 6 bot goal display names
- `BOT_NAV_TABS` - 12 bot navigation tabs (overview, post-scheduler, activity, platforms, email, strategy, media, products, creative-style, analytics, ai-insights, settings)
- `TIMEZONES` - 17 timezone options
- `SCHEDULE_PRESETS` - 11 cron schedule options
- `CONTENT_TYPES` - 7 content type options
- `ALL_PLATFORMS` - 17 platform enum values
- `ACTION_TYPES` - 8 action type enum values

### Bot Navigation

All 12 bot sub-pages use the shared `<BotNav>` component from `src/components/dashboard/bot-nav.tsx`. This uses `BOT_NAV_TABS` from constants. To add a new tab, update both `BOT_NAV_TABS` in constants.ts and create the corresponding page.

### Media System

- Upload: `POST /api/media` with multipart form data
- Validation: magic bytes (PNG, JPEG, GIF, WebP, AVIF, MP4, WebM), file size, auth + ownership
- Storage: `data/uploads/{botId}/{uuid}.{ext}` on server filesystem
- AI Captions: `POST /api/media/{id}/generate` calls Claude Vision API
- Platform-specific guidelines in generate route (15 platforms, maxLength + style per platform)

### Post Scheduler (Unified in /post)

- **Single page** for creating posts AND managing all scheduled/published posts
- Status lifecycle: DRAFT → SCHEDULED → PUBLISHING → PUBLISHED/FAILED/CANCELLED
- **Create section**: AI assistant, platform validation, media compatibility, post preview
- **Stats cards**: Drafts, Scheduled, Published, Failed counts
- **Filter tabs**: ALL / DRAFT / SCHEDULED / PUBLISHED / FAILED
- **List view**: Posts with status, platforms, media thumbnails, error messages
- **Calendar view**: Month grid showing posts by date
- **Retry failed posts**: One-click retry requeues FAILED posts for immediate publishing
- **Delete**: Available for DRAFT, SCHEDULED, and FAILED posts
- Old `/scheduler` route redirects to `/post` for backwards compatibility
- API routes (`/api/scheduled-posts/`) for programmatic CRUD

### Product Catalog

- Per-bot product/service catalog for AI-powered promotional content
- **Product fields**: name, description, brand, category, price, URL, advantages, target audience, buying reasons, AI instructions, keywords
- **Product Media**: Many-to-many relation (ProductMedia junction table) with primary image selection
- **Post integration**: Product selector in Post Scheduler — `productId` stored on ScheduledPost
- **AI integration**: When product selected, full product context injected into AI chat system prompt
- **Post list**: Product badge shown on posts that reference a product
- Pages: `/products` (list), `/products/new` (create), `/products/[productId]` (edit)

### Autopilot System (Autonomous AI Content)

Fully autonomous content creation and posting system. The Autopilot generates a content plan, creates AI content for each post, and publishes it — all without manual intervention.

#### Architecture Overview

```
User clicks "Generate Plan" → generate-plan API creates ScheduledPost entries
                                (placeholder content: "[AUTOPILOT] ...")
                                         ↓
Cron (every 5 min) → autonomous-content route picks up placeholder posts
                      → Calls Claude API with full platform algorithm context
                      → Updates post with generated content
                      → Deducts credits (5 per generation)
                                         ↓
Cron (every 1 min) → process-posts publishes SCHEDULED posts at their time
                                         ↓
Cron (every 15 min) → collect-engagement tracks performance
                      → RL engine learns what works → improves next plan
```

#### Files

| File | Purpose | Lines |
|------|---------|-------|
| `src/lib/platform-algorithm.ts` | Algorithm knowledge base for 15 platforms | ~1940 |
| `src/app/api/autonomous/generate-plan/route.ts` | Creates content plan (ScheduledPost entries) | ~434 |
| `src/app/api/cron/autonomous-content/route.ts` | Generates AI content for placeholder posts | ~401 |
| `src/app/dashboard/bots/[id]/autopilot/page.tsx` | Autopilot dashboard UI | ~784 |
| `tests/unit/platform-algorithm.test.ts` | 75 tests for algorithm data + helper functions | ~537 |

#### Platform Algorithm Knowledge Base (`src/lib/platform-algorithm.ts`)

Central data store for all platform-specific algorithm intelligence. Every Autopilot decision references this file.

**Exported types:**

```typescript
interface EngagementSignal {
  signal: string;    // e.g. "Sends/DM shares"
  weight: number;    // 1-10 scale
  note: string;      // Source/explanation
}

interface ContentFormatRank {
  format: string;          // e.g. "Reels (15-60s)"
  reachMultiplier: number; // 1.0 = baseline
  engagementRate: number;  // percentage
  note: string;
}

interface PlatformAlgorithmConfig {
  // v1 fields (original):
  name, rankingFactors, frequency, contentMix, bestTimesWeekday,
  bestTimesWeekend, bestDays, hashtags, bestTones, bestContentTypes,
  contentTips, avoid, video?, caption, platformCategory, hasAlgorithm,
  primaryMetric, aiGenerationNotes

  // v2 fields (added for Autopilot):
  engagementVelocity: { goldenWindowMinutes, assessmentWindowMinutes, tip }
  engagementSignals: EngagementSignal[]
  contentFormatRanking: ContentFormatRank[]
  growthTactics: string[]
  suppressionTriggers: string[]
  minPostIntervalHours: number
  maxPromotionalPercent: number
}
```

**Configured platforms (15):** INSTAGRAM, TIKTOK, FACEBOOK, LINKEDIN, TWITTER, YOUTUBE, PINTEREST, THREADS, MASTODON, BLUESKY, TELEGRAM, DISCORD, REDDIT, MEDIUM, DEVTO, NOSTR, MOLTBOOK

**Exported helper functions:**

| Function | Purpose | Used by |
|----------|---------|---------|
| `getRecommendedPlan(platform)` | Returns daily text/image/video/story/article counts | generate-plan |
| `getOptimalHoursForPlatform(platform)` | Returns best posting hours (sorted) | generate-plan |
| `getContentGenerationContext(platform)` | Returns full algorithm context string for AI prompt | autonomous-content |
| `getBestContentFormat(platform)` | Returns highest-reach format with multiplier | generate-plan, autonomous-content, UI |
| `getMinPostInterval(platform)` | Returns minimum hours between posts | generate-plan |
| `wouldExceedPromoLimit(platform, total, promo)` | Checks if adding promo post exceeds limit | generate-plan |
| `getEngagementVelocityTip(platform)` | Returns golden window tip string | UI |
| `getGrowthTactics(platform)` | Returns growth tactics array | UI |
| `getSuppressionTriggers(platform)` | Returns suppression triggers array | autonomous-content |

**Key platform-specific data:**

| Platform | Primary Metric | Golden Window | Min Interval | Max Promo | Best Format |
|----------|---------------|---------------|-------------|-----------|-------------|
| Instagram | watch_time | 30 min | 4h | 20% | Reels (2.5x) |
| TikTok | watch_completion | 15 min | 3h | 15% | Short video (2.5x) |
| Facebook | meaningful_interactions | 60 min | 4h | 20% | Reels (3.0x) |
| LinkedIn | dwell_time | 60 min | 8h | 15% | Document/carousel (2.0x) |
| Twitter | replies_and_engagement | 15 min | 2h | 20% | Thread (2.5x) |
| YouTube | watch_time | 120 min | 24h | 20% | Long-form 8-15min (2.0x) |
| Pinterest | saves_and_clicks | 60 min | 2h | 40% | Idea Pin (2.5x) |
| Threads | replies_and_engagement | 30 min | 3h | 15% | Question/poll (2.5x) |
| Reddit | upvote_velocity | 60 min | 8h | 10% | AMA/discussion (3.0x) |

#### Plan Generation (`/api/autonomous/generate-plan`)

**Auth:** `getCurrentUser()` (requires session cookie)

**Request:** `POST { botId: string, duration?: 7|14|30 }`

**Flow:**
1. Loads bot with platformConns, contentPlans, products, media, rlArmStates
2. For each connected platform, for each day in duration:
   - Gets posting frequency from user's ContentPlan or AI recommendation
   - Reduces volume on non-best-days (e.g., LinkedIn weekends = skip)
   - Distributes posts across optimal hours
   - Enforces `minPostIntervalHours` — skips slots too close together
   - Selects content type using RL insights (best-performing arm) or algorithm data
   - Selects tone using RL insights or platform best tones
   - Attaches media (random from image/video pool) and product (rotation)
   - Enforces `maxPromotionalPercent` via `wouldExceedPromoLimit()`
   - Selects best content format per platform
3. Creates ScheduledPost entries with placeholder content: `[AUTOPILOT] Educational for Instagram [Format: Reels] — AI content generation pending`
4. Status: DRAFT (REVIEW_ALL mode) or SCHEDULED (AUTO_APPROVE mode)
5. Max 300 posts per plan

**Database fields on Bot:**
- `autonomousEnabled: Boolean` — master on/off
- `approvalMode: ApprovalMode` — REVIEW_ALL or AUTO_APPROVE
- `planDuration: Int` — 7, 14, or 30 days
- `contentMixMode: String` — AI_RECOMMENDED or CUSTOM
- `autopilotProductRotation: Boolean` — rotate products in promo posts
- `lastPlanGeneratedAt: DateTime?` — when plan was last generated

#### AI Content Generation (`/api/cron/autonomous-content`)

**Auth:** `CRON_SECRET` bearer token

**Runs:** Every 5 minutes via cron

**Flow:**
1. Finds up to 5 DRAFT/SCHEDULED posts where content starts with `[AUTOPILOT]`
2. For each post:
   - Deducts 5 credits (`GENERATE_CONTENT` action)
   - Builds system prompt with:
     - Brand instructions + knowledge
     - Full platform algorithm context (`getContentGenerationContext()`)
     - Suppression triggers as explicit warnings
     - Best content format recommendation
     - Character limits, hashtag count, emoji strategy
   - Builds user prompt with:
     - Content type, tone, platform-specific directives
     - Product details (if promotional post)
     - Algorithm-specific optimization (dwell_time → paragraphs, replies → end with question, saves → actionable tips)
   - Calls Claude API (`claude-sonnet-4-5-20250929`, max_tokens=1000)
   - Cleans output (strips quotes, trims to maxLength)
   - Updates ScheduledPost with generated text
   - Records BotActivity

**Error handling:**
- Insufficient credits → marks post FAILED with message
- API error → logs, leaves placeholder for retry on next cycle
- Per-post try/catch → one failure doesn't block batch

#### Autopilot UI (`/dashboard/bots/[id]/autopilot`)

**Server Component** with Server Actions (no client JavaScript).

**Sections:**
1. **Header** — Autopilot status badge (Active/Off)
2. **Main Controls** (3-column grid):
   - Toggle autopilot on/off
   - Stats (Drafts, Scheduled, Published, Failed)
   - Quick actions: Generate Plan, Approve All, Clear Pending
3. **Settings** — Approval mode, Plan duration, Content mix, Product rotation
4. **Platform Algorithm Intelligence** — Per-platform cards showing:
   - Posts/day, min interval, max promo %
   - Best content format with reach multiplier
   - Top 3 engagement signals with weight dots (color-coded: green >=9, blue >=7, gray <7)
   - Golden window badge
   - Top 3 growth tactics
5. **Pending Review** — List of DRAFT posts with approve/reject buttons
6. **How Autopilot Works** — 4-step visual explanation

**Server Actions:**
- `handleToggleAutopilot` — toggles `autonomousEnabled`
- `handleUpdateSettings` — saves approval mode, duration, content mix, product rotation
- `handleApproveAll` — moves non-placeholder DRAFTs to SCHEDULED
- `handleApprovePost` — approves single post
- `handleRejectPost` — deletes single post
- `handleClearPlan` — deletes all pending DRAFT + SCHEDULED autopilot posts
- `handleGenerate` (in AutopilotGenerateButton) — calls generate-plan API with forwarded cookies

#### RL (Reinforcement Learning) Integration

The plan generator reads `RLArmState` records to select best-performing content dimensions:
- `TONE_STYLE` → which tone works best per platform
- `CONTENT_TYPE` → which content type works best per platform
- `TIME_SLOT` → which posting hour works best per platform

Arms require 5+ pulls before being considered reliable. The RL engine (Thompson Sampling) updates arm states after each post's engagement is collected.

#### Testing

75 tests in `tests/unit/platform-algorithm.test.ts` covering:
- All 15 platforms have valid frequency, content mix (sums to 100), posting hours, best days
- All 15 platforms have valid v2 fields: engagement velocity, signals (>=3), format rankings (>=2), growth tactics (>=3), suppression triggers (>=2), min interval (1-48h), max promo (5-50%)
- Platform-specific compliance: Instagram sends=highest signal, TikTok 15-min window, LinkedIn dwell_time=top, Reddit 10% promo limit, Mastodon alt text warning
- All 6 helper functions tested with known platforms + unknown platform fallbacks

### Stripe Integration

- Lazy-loaded via `getStripe()` - no key needed for build
- Checkout: Creates session with userId/credits/planId in metadata
- Webhook: `checkout.session.completed` → `addCredits()` to user
- Webhook signature verification via `constructEvent()`

## CI/CD

### GitHub Actions Workflows

Two workflows in `.github/workflows/`:

| Workflow | File | Trigger | Purpose |
|----------|------|---------|---------|
| **CI** | `ci.yml` | Every PR to `main` | Runs tests + build — blocks merge on failure |
| **Deploy** | `deploy.yml` | Push/merge to `main` | SSH deploy to production server |

### CI Pipeline (`ci.yml`)

Runs on every pull request targeting `main`:
1. `npm ci` — clean install dependencies
2. `./node_modules/.bin/prisma generate` — generate Prisma client
3. `npm test` — run all Jest tests
4. `npm run build` — full Next.js production build

If any step fails, the PR shows a red ❌ and cannot be merged.

### Branch Protection (GitHub Settings)

`main` branch is protected with these rules:
- **Require a pull request before merging** — no direct pushes to main
- **Require status checks to pass** — "Build & Test" must pass before merge

To modify: GitHub → Settings → Branches → `main` → Edit

### Deploy Pipeline (`deploy.yml`)

Triggers automatically when code is merged to `main`:
1. Validates SSH secrets (SSH_HOST, SSH_USER, SSH_PASSWORD)
2. SSH to server → runs `bash deploy.sh`
3. Health check: verifies grothi.com responds with HTTP 200

Required GitHub Secrets: `SSH_HOST`, `SSH_USER`, `SSH_PASSWORD`

### Deployment Flow

```
Developer → PR → CI (test+build) → Merge → Deploy → Production
                  ↓ fail                      ↓
              Block merge              deploy.sh on server
```

## Testing

- Framework: Jest + ts-jest + ts-node
- Config: `jest.config.ts` (requires `ts-node` in devDependencies)
- Test location: `tests/` directory
- Run: `npm test` (509 tests across 15 suites)

## Environment Variables

```env
DATABASE_URL=postgresql://grothi:Gr0th1SaaS2026x@localhost:5432/grothi
ENCRYPTION_KEY=<64 hex chars>
NEXTAUTH_URL=https://grothi.com
NEXTAUTH_SECRET=<random string>
STRIPE_SECRET_KEY=<sk_live_...>
STRIPE_WEBHOOK_SECRET=<whsec_...>
ANTHROPIC_API_KEY=<sk-ant-...>  # For Claude Vision AI captions + Autopilot content generation
CRON_SECRET=<random string>     # Protects /api/cron/* endpoints
FACEBOOK_APP_ID=<Meta App ID>
FACEBOOK_APP_SECRET=<Meta App Secret>
THREADS_APP_ID=<Threads App ID>
THREADS_APP_SECRET=<Threads App Secret>
```

## Background Workers (Cron Jobs)

Five cron endpoints process background tasks. Protected by `CRON_SECRET` env var.

| Endpoint | Frequency | Purpose |
|----------|-----------|---------|
| `POST /api/cron/process-posts` | Every 1 min | Publishes SCHEDULED posts to Facebook/Instagram/Threads |
| `POST /api/cron/collect-engagement` | Every 15 min | Fetches likes/comments/shares from published posts |
| `POST /api/cron/detect-trends` | Every 10 min | Hype Radar viral trend detection |
| `POST /api/cron/autonomous-content` | Every 5 min | AI content generation for Autopilot posts |
| `POST /api/cron/health-check` | Daily 3 AM | Validates tokens, refreshes Threads, resets counters |

Setup: `bash server/setup-cron.sh` (auto-reads CRON_SECRET from .env, installs crontab entries)

## Deployment

1. Create PR to `main` — CI automatically runs tests + build
2. Wait for green ✓ on "Build & Test" check
3. Merge PR — Deploy workflow auto-triggers via GitHub Actions
4. deploy.sh on server runs: `npm install && prisma generate && prisma migrate && build && pm2 restart && setup-cron`
5. Workflow verifies site is live (health check on grothi.com)

**Manual deploy** (if needed): `ssh root@89.167.18.92 && cd /home/acechange-bot/grothi && bash deploy.sh`

## Known Constraints

- GPG signing fails in sandbox: use `git -c commit.gpgsign=false commit`
- Google Fonts fetch fails in sandbox build (works on server)
- SSH to server fails from sandbox (user deploys manually)
- `data/uploads/` directory must exist on server for media uploads
- Prisma client generation needed after schema changes
- Stripe keys optional for build (lazy-loaded)

## Code Quality Standards Applied

- No `catch (error: any)` - all catch blocks use `error instanceof Error` checks
- URL parameters always encoded with `encodeURIComponent()`
- All admin actions wrapped in try-catch with error feedback
- Shared constants eliminate duplication (constants.ts)
- Shared navigation component (bot-nav.tsx)
- Input validation: parseInt with isNaN checks, null guards before string methods
- API routes: proper JSON parsing with try-catch, auth checks on all endpoints
