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
│   │   │       ├── scheduler/      # Redirect → /post (consolidated)
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
- `BOT_NAV_TABS` - 11 bot navigation tabs (overview, post-scheduler, activity, platforms, email, strategy, media, creative-style, analytics, ai-insights, settings)
- `TIMEZONES` - 17 timezone options
- `SCHEDULE_PRESETS` - 11 cron schedule options
- `CONTENT_TYPES` - 7 content type options
- `ALL_PLATFORMS` - 17 platform enum values
- `ACTION_TYPES` - 8 action type enum values

### Bot Navigation

All 11 bot sub-pages use the shared `<BotNav>` component from `src/components/dashboard/bot-nav.tsx`. This uses `BOT_NAV_TABS` from constants. To add a new tab, update both `BOT_NAV_TABS` in constants.ts and create the corresponding page.

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
- Run: `npm test` (419 tests across 14 suites)

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
