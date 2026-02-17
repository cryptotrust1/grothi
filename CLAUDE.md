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
│   │   │       ├── media/          # Media library (upload, grid, AI captions)
│   │   │       ├── scheduler/      # Post scheduler (calendar + list view)
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
    ├── platform-specs.ts           # Platform image specs + optimal posting times
    ├── stripe.ts                   # Lazy Stripe init, PRICING_PLANS
    ├── utils.ts                    # cn(), formatCredits, creditsToDollars, etc.
    └── validations.ts              # Zod schemas (signUp, signIn, createBot, platform)
```

### Database Schema (Prisma)

**Models**: User, Session, Bot, PlatformConnection, BotActivity, BotDailyStat, CreditBalance, CreditTransaction, PricingPlan, ActionCost, PromoCode, Media, ScheduledPost, ContactMessage

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
- `BOT_NAV_TABS` - 8 bot navigation tabs (overview, activity, platforms, media, scheduler, image-style, analytics, settings)
- `TIMEZONES` - 17 timezone options
- `SCHEDULE_PRESETS` - 11 cron schedule options
- `CONTENT_TYPES` - 7 content type options
- `ALL_PLATFORMS` - 17 platform enum values
- `ACTION_TYPES` - 8 action type enum values

### Bot Navigation

All 8 bot sub-pages use the shared `<BotNav>` component from `src/components/dashboard/bot-nav.tsx`. This uses `BOT_NAV_TABS` from constants. To add a new tab, update both `BOT_NAV_TABS` in constants.ts and create the corresponding page.

### Media System

- Upload: `POST /api/media` with multipart form data
- Validation: magic bytes (PNG, JPEG, GIF, WebP, AVIF, MP4, WebM), file size, auth + ownership
- Storage: `data/uploads/{botId}/{uuid}.{ext}` on server filesystem
- AI Captions: `POST /api/media/{id}/generate` calls Claude Vision API
- Platform-specific guidelines in generate route (15 platforms, maxLength + style per platform)

### Post Scheduler

- Status lifecycle: DRAFT → SCHEDULED → PUBLISHING → PUBLISHED/FAILED/CANCELLED
- Calendar view (month grid) + list view with status filters
- Auto-scheduling uses `OPTIMAL_POSTING_TIMES` from platform-specs.ts
- Server actions for create + delete in the page component
- API routes for programmatic CRUD

### Stripe Integration

- Lazy-loaded via `getStripe()` - no key needed for build
- Checkout: Creates session with userId/credits/planId in metadata
- Webhook: `checkout.session.completed` → `addCredits()` to user
- Webhook signature verification via `constructEvent()`

## Testing

- Framework: Jest + ts-jest
- Config: `jest.config.ts`
- Test location: `tests/` directory
- Run: `npm test` (94 tests across 5 suites)
- Suites: utils, validations, encryption, constants, platform-specs

## Environment Variables

```env
DATABASE_URL=postgresql://grothi:Gr0th1SaaS2026x@localhost:5432/grothi
ENCRYPTION_KEY=<64 hex chars>
NEXTAUTH_URL=https://grothi.com
NEXTAUTH_SECRET=<random string>
STRIPE_SECRET_KEY=<sk_live_...>
STRIPE_WEBHOOK_SECRET=<whsec_...>
ANTHROPIC_API_KEY=<sk-ant-...>  # For Claude Vision AI captions
CRON_SECRET=<random string>     # Protects /api/cron/* endpoints
FACEBOOK_APP_ID=<Meta App ID>
FACEBOOK_APP_SECRET=<Meta App Secret>
THREADS_APP_ID=<Threads App ID>
THREADS_APP_SECRET=<Threads App Secret>
```

## Background Workers (Cron Jobs)

Three cron endpoints process background tasks. Protected by `CRON_SECRET` env var.

| Endpoint | Frequency | Purpose |
|----------|-----------|---------|
| `POST /api/cron/process-posts` | Every 1 min | Publishes SCHEDULED posts to Facebook/Instagram/Threads |
| `POST /api/cron/collect-engagement` | Every 15 min | Fetches likes/comments/shares from published posts |
| `POST /api/cron/health-check` | Daily 3 AM | Validates tokens, refreshes Threads, resets counters |

Setup: `bash server/setup-cron.sh` (auto-reads CRON_SECRET from .env, installs crontab entries)

## Deployment

1. Push to `main` branch on GitHub
2. SSH to server: `ssh root@89.167.18.92`
3. `cd /home/acechange-bot/grothi && git pull origin main && bash deploy.sh`
4. deploy.sh runs: `npm install && prisma generate && prisma migrate && build && pm2 restart && setup-cron`

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
