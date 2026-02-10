# Grothi.com - AI Marketing Bot SaaS Platform

## Dátum: 2026-02-10
## Verzia: 1.1 (SCHVÁLENÉ - implementácia začína)
## Status: APPROVED

---

## 0. INFRAŠTRUKTÚRA & PRÍSTUPY

### 0.1 Doména
- **Názov**: **grothi.com**
- **Registrátor**: Cloudflare
- **Cloudflare Dashboard**: https://dash.cloudflare.com/f2d737df0769679e7d6f3ddcae44ac8d/grothi.com
- **DNS**: Spravované cez Cloudflare (A record → server IP)
- **SSL**: Cloudflare Full (Strict) + Origin certifikát na serveri
- **CDN**: Cloudflare CDN zapnuté (proxy mode, oranžový oblak)

### 0.2 Server
- **Hoster**: Hetzner Cloud
- **Server ID**: #119972528 (cx33)
- **Názov**: acebot
- **IP**: 89.167.18.92
- **IPv6**: 2a01:4f9:c014:5eec::/64
- **OS**: Linux (predpoklad Ubuntu/Debian)
- **Specs**: 4 vCPU, 8 GB RAM, 80 GB SSD
- **Lokalita**: Helsinki, Fínsko (hel1-dc2, eu-central)
- **Cena**: €4.99/mes
- **Poznámka**: Na tomto serveri už beží ShadowGuardians bot (PM2 process)

### 0.3 GitHub Repository
- **URL**: https://github.com/cryptotrust1/grothi
- **Účel**: Zdrojový kód Grothi.com web aplikácie (Next.js)
- **Branch stratégia**: `main` = production, `develop` = development, `claude/*` = feature branches

### 0.4 Existujúci bot (ShadowGuardians)
- **Repozitár**: https://github.com/cryptotrust1/acechange-fixedfloat-plugin
- **Path na serveri**: /home/acechange-bot/acechange-fixedfloat-plugin/acechange-moltbook-bot/
- **PM2 process**: `shadowguardians`
- **Bot engine** zdieľaný s Grothi (content-reactor, platform clients, safety)

---

## 1. PREHĽAD PROJEKTU

### 1.1 Čo budujeme
SaaS platforma **grothi.com** kde si každý používateľ môže vytvoriť vlastného AI marketingového bota. Bot bude založený na našom existujúcom ShadowGuardians engine (nie nový kód). Používatelia si nastavia vlastné API kľúče, sociálne siete, inštrukcie a brand - a bot pre nich autonómne pracuje.

### 1.2 Brand
- **Názov**: **Grothi** (grothi.com)
- **Tagline**: "AI-Powered Marketing on Autopilot"

### 1.3 Kľúčové USP (Unique Selling Points)
- **Plne autonómny** - bot pracuje 24/7 bez zásahu používateľa
- **Self-learning** - učí sa z engagement metrík, zlepšuje sa
- **White-hat only** - Constitutional AI bezpečnostné záruky na KAŽDOM poste
- **Multi-platform** - Mastodon, Facebook, Telegram, Moltbook, Discord a ďalšie
- **Content Reactor** - AI generuje fresh content z RSS/trending dát
- **Ban protection** - automatická detekcia banov, emergency stop, email alerty
- **Kreditový systém** - platíš len za to čo bot reálne spraví

---

## 2. TECH STACK (Odporúčaný)

### 2.1 Frontend + Backend (Monolith)
| Technológia | Dôvod |
|---|---|
| **Next.js 14+ (App Router)** | SSR/SSG pre SEO, Server Components, API routes, najlepší ekosystém |
| **TypeScript** | Type safety, lepšia DX, menej bugov |
| **Tailwind CSS** | Rýchly vývoj, responsive, konzistentný design |
| **shadcn/ui** | Kvalitné UI komponenty na Tailwind + Radix (nie npm závislosť, kopíruje sa) |
| **Recharts** | Grafy na dashboard (React natívne, jednoduché) |

### 2.2 Backend / Data
| Technológia | Dôvod |
|---|---|
| **PostgreSQL** | Relačná DB, robustná, free, podporuje JSON polia pre bot state |
| **Prisma ORM** | Type-safe queries, migrácie, studio GUI, Next.js integrácia |
| **BullMQ + Redis** | Task queue pre bot execution (cron úlohy, posting) |
| **Node.js workers** | Worker procesy vykonávajú bot akcie z fronty |

### 2.3 Auth & Payments
| Technológia | Dôvod |
|---|---|
| **NextAuth.js v5 (Auth.js)** | Free, flexibilný, email+password+OAuth, Prisma adapter |
| **Stripe** | Checkout pre nákup kreditov, Webhooks, Customer Portal |
| **bcrypt** | Password hashing |
| **AES-256-GCM** | Šifrovanie API kľúčov v DB |

### 2.4 Infraštruktúra
| Technológia | Dôvod |
|---|---|
| **Hetzner CX33** | Existujúci server 89.167.18.92 (4vCPU, 8GB RAM, Helsinki) |
| **PM2** | Process manager pre Next.js + worker procesy + ShadowGuardians bot |
| **Nginx** | Reverse proxy, SSL, static files |
| **Cloudflare** | DNS, CDN, DDoS ochrana, SSL (Full Strict), caching |
| **Redis** | Pre BullMQ task queue + sessions cache |

### 2.5 Dev Tools
| Technológia | Dôvod |
|---|---|
| **ESLint + Prettier** | Kvalita kódu |
| **Prisma Studio** | DB GUI pre development |
| **next-sitemap** | Automatická sitemap generácia |
| **next-seo** | SEO meta tagy helper |

---

## 3. ARCHITEKTÚRA

### 3.1 High-Level Diagram
```
┌─────────────────────────────────────────────────────────┐
│                    NGINX (reverse proxy + SSL)            │
├─────────────────────────────────────────────────────────┤
│                                                           │
│   ┌─────────────────────────────────┐                    │
│   │     Next.js App (PM2)           │                    │
│   │  ┌───────────┐ ┌─────────────┐  │                    │
│   │  │  Public    │ │  Dashboard  │  │                    │
│   │  │  Pages     │ │  (Auth)     │  │                    │
│   │  │  (SSR/SSG) │ │  (SSR)     │  │                    │
│   │  └───────────┘ └─────────────┘  │                    │
│   │  ┌───────────────────────────┐  │                    │
│   │  │    API Routes (/api/*)    │  │                    │
│   │  └───────────┬───────────────┘  │                    │
│   └──────────────┼──────────────────┘                    │
│                  │                                        │
│   ┌──────────────▼──────────────────┐                    │
│   │        PostgreSQL (Prisma)       │                    │
│   └──────────────┬──────────────────┘                    │
│                  │                                        │
│   ┌──────────────▼──────────────────┐                    │
│   │     Redis + BullMQ Queue        │                    │
│   └──────────────┬──────────────────┘                    │
│                  │                                        │
│   ┌──────────────▼──────────────────┐                    │
│   │   Bot Worker Pool (PM2 cluster) │                    │
│   │  ┌──────┐ ┌──────┐ ┌──────┐    │                    │
│   │  │ W1   │ │ W2   │ │ W3   │    │                    │
│   │  └──────┘ └──────┘ └──────┘    │                    │
│   │  (execute bot tasks from queue) │                    │
│   └─────────────────────────────────┘                    │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Bot Execution Model
**Cron Scheduler + BullMQ Task Queue**:

1. **Scheduler** (jeden proces) - beží cron joby, pre KAŽDÉHO aktívneho bota:
   - Kontroluje bot schedule (napr. "post every 3h")
   - Vytvára tasks v BullMQ queue: `{ botId, action: 'content_react', userId }`
   - Pred vytvorením tasku overí kredit balance

2. **Worker Pool** (2-4 procesy) - vyberá tasks z fronty:
   - Načíta bot config z DB (API kľúče, inštrukcie, platforms)
   - Vykoná akciu (post, scan feeds, collect metrics)
   - Odpočíta kredity
   - Zapíše výsledok do DB (activity log)
   - Pošle real-time update cez SSE/WebSocket

3. **Výhody**:
   - Škálovateľné (pridaj workery podľa záťaže)
   - Izolované (pád jedného tasku neovplyvní ostatné)
   - Fair (round-robin medzi botmi)
   - Efektívne (zdieľané connections, žiadny overhead per-bot)

### 3.3 Čo je zdieľané vs. per-user

**Zdieľaná infraštruktúra (rovnaká pre všetkých):**
- Platform compliance rules (platform-compliance.js)
- Constitutional AI safety guardrails (safety.js)
- Banned patterns, blocked content patterns
- CONTENT_TYPES definície
- Claude API system prompts (safety rules)

**Per-user konfigurácia:**
- API kľúče (Anthropic, Mastodon, Facebook, Telegram, atď.)
- Sociálne siete accounts (instance URLs, page IDs, etc.)
- Bot instructions/system prompt (čo bot propaguje)
- Posting schedule (frekvencia, časy)
- Brand name + knowledge base
- Safety level (conservative/moderate/aggressive)
- Email notifications settings
- RSS feeds zoznam

**Per-bot state (izolovaný):**
- Content reactor learning weights
- Dedup history
- Engagement metrics + pending metrics
- Activity log
- Daily counters
- Paused platforms

---

## 4. DATABÁZOVÁ SCHÉMA (Prisma)

```prisma
// ============ AUTH ============

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  passwordHash  String
  name          String?
  avatar        String?
  role          UserRole  @default(USER)
  emailVerified Boolean   @default(false)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  // Relations
  bots            Bot[]
  creditBalance   CreditBalance?
  creditTxns      CreditTransaction[]
  stripeCustomerId String?  @unique
  sessions        Session[]

  @@index([email])
}

model Session {
  id           String   @id @default(cuid())
  userId       String
  token        String   @unique
  expiresAt    DateTime
  createdAt    DateTime @default(now())
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([token])
  @@index([userId])
}

enum UserRole {
  USER
  ADMIN
}

// ============ BOTS ============

model Bot {
  id          String    @id @default(cuid())
  userId      String
  name        String
  description String?
  status      BotStatus @default(PAUSED)

  // Bot configuration
  instructions    String   @db.Text  // System prompt - what the bot promotes
  brandName       String              // e.g., "AceChange.io"
  brandKnowledge  String?  @db.Text  // Knowledge base about the brand
  safetyLevel     SafetyLevel @default(MODERATE)

  // Schedule
  postingSchedule String?  // Cron expression or preset
  timezone        String   @default("UTC")

  // RSS feeds for content reactor
  rssFeeds        Json?    // Array of RSS feed URLs

  // Learning state
  reactorState    Json?    // Content reactor weights + state
  dedupHistory    Json?    // Dedup hashes

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  user             User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  platformConns    PlatformConnection[]
  activities       BotActivity[]
  dailyStats       BotDailyStat[]

  @@index([userId])
  @@index([status])
}

enum BotStatus {
  ACTIVE
  PAUSED
  STOPPED
  ERROR
  NO_CREDITS
}

enum SafetyLevel {
  CONSERVATIVE  // Max 2 posts/day, no brand mentions, maximum safety
  MODERATE      // Default - balanced (3-5 posts/day, careful mentions)
  AGGRESSIVE    // Higher frequency (up to 10/day), more engagement (still white-hat)
}

// ============ PLATFORM CONNECTIONS ============

model PlatformConnection {
  id          String         @id @default(cuid())
  botId       String
  platform    PlatformType
  status      ConnStatus     @default(DISCONNECTED)

  // Encrypted credentials (AES-256-GCM)
  encryptedCredentials Json  // { token, instanceUrl, pageId, etc. }

  // Platform-specific config
  config      Json?          // { visibility, maxDailyPosts, etc. }

  // Stats
  postsToday    Int   @default(0)
  repliesToday  Int   @default(0)
  lastPostAt    DateTime?
  lastError     String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  bot Bot @relation(fields: [botId], references: [id], onDelete: Cascade)

  @@unique([botId, platform])
  @@index([botId])
}

enum PlatformType {
  MASTODON
  FACEBOOK
  TELEGRAM
  MOLTBOOK
  DISCORD
  TWITTER
  BLUESKY
  REDDIT
  DEVTO
}

enum ConnStatus {
  CONNECTED
  DISCONNECTED
  ERROR
  SUSPENDED
}

// ============ BOT ACTIVITY ============

model BotActivity {
  id        String       @id @default(cuid())
  botId     String
  platform  PlatformType
  action    ActionType

  content     String?   @db.Text   // What was posted
  postId      String?              // Platform post ID
  contentType String?              // trending_insight, news_reaction, etc.

  // Result
  success   Boolean
  error     String?

  // Engagement (updated later)
  likes     Int?
  comments  Int?
  shares    Int?

  // Credits
  creditsUsed Int  @default(0)

  createdAt DateTime @default(now())

  bot Bot @relation(fields: [botId], references: [id], onDelete: Cascade)

  @@index([botId, createdAt])
  @@index([platform])
}

enum ActionType {
  POST
  REPLY
  FAVOURITE
  BOOST
  SCAN_FEEDS
  COLLECT_METRICS
  GENERATE_CONTENT
  SAFETY_BLOCK
  BAN_DETECTED
}

// ============ DAILY STATS ============

model BotDailyStat {
  id          String   @id @default(cuid())
  botId       String
  date        DateTime @db.Date

  postsCount      Int @default(0)
  repliesCount    Int @default(0)
  favouritesCount Int @default(0)
  boostsCount     Int @default(0)
  safetyBlocks    Int @default(0)
  errorsCount     Int @default(0)
  creditsUsed     Int @default(0)

  // Engagement totals
  totalLikes    Int @default(0)
  totalComments Int @default(0)
  totalShares   Int @default(0)

  bot Bot @relation(fields: [botId], references: [id], onDelete: Cascade)

  @@unique([botId, date])
  @@index([botId, date])
}

// ============ CREDITS & BILLING ============

model CreditBalance {
  id       String @id @default(cuid())
  userId   String @unique
  balance  Int    @default(0)  // 1 credit = $0.01

  updatedAt DateTime @updatedAt
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model CreditTransaction {
  id       String   @id @default(cuid())
  userId   String
  type     TxnType
  amount   Int      // Positive = credit, negative = debit
  balance  Int      // Balance after transaction

  // Context
  description String?
  botId       String?    // Which bot used the credits
  stripePaymentId String?

  createdAt DateTime @default(now())
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, createdAt])
}

enum TxnType {
  PURCHASE       // Bought credits via Stripe
  USAGE          // Bot used credits for action
  BONUS          // Admin bonus
  REFUND         // Refund
  SUBSCRIPTION   // Monthly subscription credit
}

// ============ ADMIN: PRICING ============

model PricingPlan {
  id          String  @id @default(cuid())
  name        String  // "Starter", "Pro", "Enterprise"
  credits     Int     // How many credits
  priceUsd    Int     // Price in cents (e.g., 1000 = $10.00)
  isActive    Boolean @default(true)
  isPopular   Boolean @default(false)  // Highlighted on pricing page
  features    Json?   // ["feature1", "feature2"] for pricing page
  sortOrder   Int     @default(0)

  stripePriceId String?  // Stripe Price ID

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model ActionCost {
  id         String     @id @default(cuid())
  actionType ActionType
  credits    Int        // Cost in credits
  description String?

  @@unique([actionType])
}

model PromoCode {
  id          String   @id @default(cuid())
  code        String   @unique
  discountPct Int      // 0-100 percentage
  bonusCredits Int     @default(0)
  maxUses     Int?
  usedCount   Int      @default(0)
  expiresAt   DateTime?
  isActive    Boolean  @default(true)

  createdAt DateTime @default(now())
}
```

---

## 5. ŠTRUKTÚRA STRÁNOK (Sitemap)

### 5.1 Verejné stránky (SEO indexované)

| URL | Stránka | SEO Priorita | Popis |
|---|---|---|---|
| `/` | Landing page | **HIGH** | Hero, features, pricing preview, CTA |
| `/pricing` | Cenník | **HIGH** | Kreditové balíčky, porovnávacia tabuľka |
| `/features` | Funkcie | **HIGH** | Detailný prehľad všetkých funkcií |
| `/features/content-reactor` | Content Reactor | MEDIUM | Detail AI content engine |
| `/features/multi-platform` | Multi-platform | MEDIUM | Podporované platformy |
| `/features/safety` | Safety & Compliance | MEDIUM | White-hat záruky |
| `/features/analytics` | Analytics | MEDIUM | Engagement tracking |
| `/about` | O nás | MEDIUM | Príbeh, misia, tím |
| `/contact` | Kontakt | MEDIUM | Kontaktný formulár |
| `/blog` | Blog | **HIGH** | SEO content marketing |
| `/blog/[slug]` | Blog článok | **HIGH** | Jednotlivé články |
| `/faq` | FAQ | MEDIUM | Často kladené otázky |
| `/terms` | Podmienky použitia | LOW | Terms of Service |
| `/privacy` | Ochrana súkromia | LOW | Privacy Policy |
| `/status` | Status page | LOW | Systémový stav |

### 5.2 Auth stránky (neindexované)

| URL | Stránka |
|---|---|
| `/auth/signin` | Prihlásenie |
| `/auth/signup` | Registrácia |
| `/auth/forgot-password` | Zabudnuté heslo |
| `/auth/verify-email` | Overenie emailu |
| `/auth/onboarding` | Onboarding wizard (po registrácii) |

### 5.3 Dashboard (auth required, neindexované)

| URL | Stránka | Popis |
|---|---|---|
| `/dashboard` | Hlavný dashboard | Prehľad všetkých botov, celkové štatistiky |
| `/dashboard/bots` | Zoznam botov | Všetky boty s filtrami |
| `/dashboard/bots/new` | Nový bot | Step-by-step wizard |
| `/dashboard/bots/[id]` | Bot detail | Hlavný prehľad bota |
| `/dashboard/bots/[id]/activity` | Bot aktivita | Timeline všetkých akcií |
| `/dashboard/bots/[id]/platforms` | Bot platformy | Pripojené sociálne siete |
| `/dashboard/bots/[id]/settings` | Bot nastavenia | Inštrukcie, schedule, safety |
| `/dashboard/bots/[id]/analytics` | Bot analytika | Grafy, engagement, learning |
| `/dashboard/credits` | Kredity | Balance, história, kúpiť |
| `/dashboard/credits/buy` | Kúpiť kredity | Stripe checkout |
| `/dashboard/settings` | Nastavenia účtu | Profil, email, heslo |
| `/dashboard/settings/billing` | Fakturácia | Stripe portal, faktúry |
| `/dashboard/settings/notifications` | Notifikácie | Email alertov nastavenia |

### 5.4 Admin panel (admin only, neindexované)

| URL | Stránka |
|---|---|
| `/admin` | Admin dashboard |
| `/admin/users` | Správa používateľov |
| `/admin/users/[id]` | Detail používateľa |
| `/admin/bots` | Všetky boty (across users) |
| `/admin/revenue` | Tržby a analytika |
| `/admin/pricing` | Správa cenníka |
| `/admin/pricing/plans` | Cenové plány |
| `/admin/pricing/actions` | Ceny za akcie (kredit costs) |
| `/admin/pricing/promos` | Promo kódy a zľavy |
| `/admin/settings` | Systémové nastavenia |
| `/admin/health` | System health monitoring |

### 5.5 Navigácia

**Verejný header:**
```
Logo | Features | Pricing | Blog | About | Contact | [Sign In] [Get Started →]
```

**Dashboard sidebar:**
```
🏠 Dashboard
🤖 My Bots
  └─ + New Bot
💰 Credits
⚙️ Settings
📊 (Bot detail sub-nav when viewing bot)
```

**Admin sidebar:**
```
📊 Dashboard
👥 Users
🤖 All Bots
💰 Revenue
💲 Pricing
⚙️ System Settings
🏥 Health
```

---

## 6. KREDITOVÝ SYSTÉM

### 6.1 Hodnota kreditu
- **1 kredit = $0.01 (1 cent)**

### 6.2 Ceny za akcie (default, admin ich môže meniť)

| Akcia | Kredity | Vysvetlenie |
|---|---|---|
| AI generácia obsahu (Claude API) | 5 | Najdrahšia - API call |
| Post na platformu | 2 | Publikácia postu |
| Reply na mention | 3 | AI generácia + post |
| Favourite/Like | 1 | Jednoduchá API akcia |
| Boost/Retweet | 1 | Jednoduchá API akcia |
| RSS scan (feed batch) | 2 | Web monitoring |
| Engagement metrics collection | 1 | API query |
| Daily report generation | 3 | AI sumarizácia |

### 6.3 Cenové balíčky (default)

| Balíček | Kredity | Cena | Bonus | Per-credit |
|---|---|---|---|---|
| Starter | 1,000 | $10 | - | $0.010 |
| Growth | 5,000 | $45 | +500 free | $0.0082 |
| Pro | 15,000 | $120 | +2,000 free | $0.0071 |
| Enterprise | 50,000 | $350 | +10,000 free | $0.0058 |

### 6.4 Free Tier
- **100 kreditov zadarmo** pri registrácii (na vyskúšanie)
- Stačí na ~10-15 postov (aby user videl ako to funguje)

### 6.5 Stripe integrácia
- **Stripe Checkout** pre jednorazové nákupy kreditov
- **Stripe Webhooks** pre potvrdenie platby a pripísanie kreditov
- **Stripe Customer Portal** pre faktúry a históriu platieb
- **Promo kódy** cez Stripe Coupons alebo vlastný systém

---

## 7. UI/UX DIZAJN

### 7.1 Design princípy
- **Clean & Minimal** - žiadne zbytočné elementy
- **Mobile-first** - responsive od zákldu
- **Accessible** - WCAG 2.1 AA compliance
- **Fast** - skeleton loading, optimistic updates
- **Intuitive** - user nepotrebuje manuál

### 7.2 Farebná schéma
```
Primary:    #2563EB (Blue 600 - trustworthy, professional)
Secondary:  #10B981 (Emerald 500 - growth, success)
Accent:     #8B5CF6 (Violet 500 - AI, innovation)
Background: #FAFAFA (light) / #0F172A (dark mode)
Text:       #1E293B (Slate 800)
Danger:     #EF4444 (Red 500)
Warning:    #F59E0B (Amber 500)
```

### 7.3 Komponenty (shadcn/ui)
- **Cards** - pre bot zoznam, stats KPIs
- **Tables** - pre activity log, transaction history
- **Forms** - pre bot settings, API key input
- **Dialogs** - pre confirm actions, quick edit
- **Tabs** - pre bot detail sekcie
- **Charts** (Recharts) - engagement grafy
- **Badges** - pre status (active/paused/error)
- **Toast notifications** - pre real-time updates
- **Skeleton** - loading states

### 7.4 Dashboard Layout
```
┌──────────────────────────────────────────────┐
│  Logo    Search    Credits: 4,520    Avatar   │ ← Top bar
├───────┬──────────────────────────────────────┤
│       │                                      │
│  Nav  │     Main Content Area                │
│       │                                      │
│  🏠   │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐   │
│  🤖   │  │ KPI │ │ KPI │ │ KPI │ │ KPI │   │ ← Stats cards
│  💰   │  └─────┘ └─────┘ └─────┘ └─────┘   │
│  ⚙️   │                                      │
│       │  ┌──────────────────────────────┐    │
│       │  │    Bot Activity Chart         │    │ ← Engagement graf
│       │  └──────────────────────────────┘    │
│       │                                      │
│       │  ┌──────────────────────────────┐    │
│       │  │    Recent Activity Feed       │    │ ← Real-time log
│       │  └──────────────────────────────┘    │
│       │                                      │
├───────┴──────────────────────────────────────┤
│  © 2026 Grothi.com                         │ ← Footer
└──────────────────────────────────────────────┘
```

### 7.5 Bot Creation Wizard (4 kroky)

**Step 1: Základy**
- Meno bota
- Čo propaguje (brand name, URL)
- Krátky popis účelu

**Step 2: Platformy**
- Výber platforiem (checkboxy s ikonami)
- Pre každú platformu: API kľúč/token input
- Test connection tlačidlo

**Step 3: Inštrukcie**
- Text editor pre bot instructions
- Predpripravené šablóny (Marketing, Educational, News, Community)
- Knowledge base textarea (fakty o brande)
- Safety level selector (Conservative/Moderate/Aggressive)

**Step 4: Schedule & Launch**
- Posting frekvencia (slider alebo preset)
- Aktívne hodiny (day picker)
- RSS feeds (voliteľné)
- Email notifikácie toggle
- [Launch Bot] CTA

### 7.6 Mobile Responsive
- Sidebar kolapsne do hamburger menu
- Stats cards - 2 per riadok (namiesto 4)
- Activity feed - full width
- Charts - horizontálny scroll
- Tables - responsívne cards na mobile

---

## 8. SEO STRATÉGIA

### 8.1 Technické SEO
- **SSR/SSG** - všetky verejné stránky pre-renderované
- **next-sitemap** - automatická sitemap.xml generácia
- **robots.txt** - blokuj `/dashboard/*`, `/admin/*`, `/api/*`
- **Canonical URLs** na každej stránke
- **Structured Data**: Organization, SoftwareApplication, FAQ, BreadcrumbList
- **Open Graph + Twitter Cards** na každej verejnej stránke
- **Mobile-first** - responsive, Core Web Vitals < 2.5s LCP

### 8.2 On-Page SEO
- **H1** - jeden per stránka, obsahuje primary keyword
- **Title tag** - `{Page} | Grothi - AI Marketing Bot Platform` (grothi.com)
- **Meta description** - 150-160 znakov, CTA oriented
- **Alt text** na všetkých obrázkoch
- **Internal linking** medzi features, blog, pricing
- **URL štruktúra** - čisté, krátke: `/features/safety` nie `/features?id=safety`

### 8.3 Content SEO (Blog)
Cieľové kľúčové slová:
- "AI marketing bot"
- "automated social media marketing"
- "white hat marketing automation"
- "AI content generator for social media"
- "Mastodon bot for business"
- "Facebook page automation"
- "crypto marketing bot"

Blog témy (prvých 10):
1. "How AI Marketing Bots Are Changing Social Media in 2026"
2. "White-Hat vs Black-Hat Marketing Automation: Complete Guide"
3. "How to Automate Your Facebook Page Without Getting Banned"
4. "Mastodon for Business: Complete Bot Guide"
5. "The ROI of AI-Generated Social Media Content"
6. "How Our Constitutional AI Keeps Your Brand Safe"
7. "Credit-Based Pricing: Why We Don't Do Monthly Subscriptions"
8. "Setting Up Your First AI Marketing Bot in 5 Minutes"
9. "Multi-Platform Marketing: One Bot, All Social Networks"
10. "Self-Learning Bots: How AI Improves Your Marketing Over Time"

### 8.4 Performance
- **Image optimization**: WebP + next/image lazy loading
- **Font**: system font stack (no external fonts = faster)
- **Bundle**: dynamic imports pre heavy components (charts)
- **CDN**: static assets cez Nginx/Cloudflare

---

## 9. BEZPEČNOSŤ

### 9.1 Aplikačná bezpečnosť
- **CSRF**: Next.js built-in CSRF ochrana
- **XSS**: React auto-escaping + Content Security Policy headers
- **SQL Injection**: Prisma parameterized queries (nemožné)
- **Rate limiting**: per-IP aj per-user limity na auth a API endpoints
- **Input validation**: zod schémy na všetkých API routes
- **Helmet headers**: Strict-Transport-Security, X-Frame-Options, etc.

### 9.2 Šifrovanie API kľúčov
```
User zadá API kľúč → AES-256-GCM encrypt → uložiť do DB
Worker potrebuje kľúč → načítať z DB → AES-256-GCM decrypt → použiť → zahodiť
```
- Encryption key v environment variable (nie v DB)
- Kľúče sa nikdy neposielajú na frontend v plain texte
- UI zobrazuje len `sk-...****1234` (maskované)

### 9.3 White-Hat Enforcement
Každý bot akcia prechádza cez:
1. **Platform compliance check** (platform-compliance.js) - zdieľaný
2. **Constitutional AI review** (safety.js) - zdieľaný
3. **Content review** (banned patterns, spam detection) - zdieľaný
4. **User safety level** limits - per-bot
5. **Credit balance check** - per-user
6. **Rate limiting** - per-platform per-bot

Admin môže vidieť content PRED publikáciou (moderation queue - budúca feature).

### 9.4 GDPR
- Právo na vymazanie účtu (cascade delete)
- Export dát (JSON export)
- Cookie consent banner
- Privacy policy stránka

---

## 10. ADRESÁROVÁ ŠTRUKTÚRA

```
acechange-moltbook-bot/
├── web/                          # NEW: Next.js SaaS app
│   ├── app/                      # Next.js App Router
│   │   ├── (public)/             # Public pages group
│   │   │   ├── page.tsx          # Landing page
│   │   │   ├── pricing/page.tsx
│   │   │   ├── features/page.tsx
│   │   │   ├── about/page.tsx
│   │   │   ├── contact/page.tsx
│   │   │   ├── blog/page.tsx
│   │   │   ├── blog/[slug]/page.tsx
│   │   │   ├── faq/page.tsx
│   │   │   ├── terms/page.tsx
│   │   │   └── privacy/page.tsx
│   │   ├── auth/                 # Auth pages
│   │   │   ├── signin/page.tsx
│   │   │   ├── signup/page.tsx
│   │   │   └── forgot-password/page.tsx
│   │   ├── dashboard/            # Protected dashboard
│   │   │   ├── layout.tsx        # Dashboard layout (sidebar)
│   │   │   ├── page.tsx          # Main dashboard
│   │   │   ├── bots/page.tsx
│   │   │   ├── bots/new/page.tsx
│   │   │   ├── bots/[id]/page.tsx
│   │   │   ├── bots/[id]/activity/page.tsx
│   │   │   ├── bots/[id]/platforms/page.tsx
│   │   │   ├── bots/[id]/settings/page.tsx
│   │   │   ├── bots/[id]/analytics/page.tsx
│   │   │   ├── credits/page.tsx
│   │   │   ├── credits/buy/page.tsx
│   │   │   └── settings/page.tsx
│   │   ├── admin/                # Admin panel
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   ├── users/page.tsx
│   │   │   ├── bots/page.tsx
│   │   │   ├── revenue/page.tsx
│   │   │   ├── pricing/page.tsx
│   │   │   └── settings/page.tsx
│   │   ├── api/                  # API routes
│   │   │   ├── auth/[...nextauth]/route.ts
│   │   │   ├── bots/route.ts
│   │   │   ├── bots/[id]/route.ts
│   │   │   ├── credits/route.ts
│   │   │   ├── stripe/webhook/route.ts
│   │   │   └── admin/route.ts
│   │   ├── layout.tsx            # Root layout
│   │   └── globals.css
│   ├── components/               # React components
│   │   ├── ui/                   # shadcn/ui components
│   │   ├── dashboard/            # Dashboard-specific
│   │   ├── landing/              # Landing page sections
│   │   ├── bot/                  # Bot management
│   │   └── admin/                # Admin panel
│   ├── lib/                      # Utilities
│   │   ├── db.ts                 # Prisma client
│   │   ├── auth.ts               # NextAuth config
│   │   ├── stripe.ts             # Stripe helpers
│   │   ├── encryption.ts         # AES-256 encrypt/decrypt
│   │   ├── credits.ts            # Credit management
│   │   └── validations.ts        # Zod schemas
│   ├── prisma/
│   │   ├── schema.prisma         # Database schema
│   │   └── migrations/
│   ├── public/                   # Static assets
│   ├── next.config.js
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── package.json
├── workers/                      # NEW: Bot execution workers
│   ├── scheduler.js              # Cron scheduler (creates tasks)
│   ├── worker.js                 # Task executor (processes queue)
│   ├── tasks/                    # Task handlers
│   │   ├── content-react.js      # Content reactor task
│   │   ├── post-to-platform.js   # Posting task
│   │   ├── scan-feeds.js         # RSS scanning task
│   │   ├── collect-metrics.js    # Engagement collection
│   │   └── daily-report.js       # Report generation
│   └── package.json
├── src/                          # EXISTING: Bot engine (shared modules)
│   ├── content-reactor.js        # Content Reactor v2.0
│   ├── platform-compliance.js    # Platform rules (shared)
│   ├── multi-agent/safety.js     # Constitutional AI (shared)
│   ├── learning-engine.js        # Brand protection (shared)
│   ├── scam-prevention.js        # Dedup system
│   ├── platforms/                # Platform clients
│   │   ├── mastodon.js
│   │   ├── facebook.js
│   │   ├── telegram.js
│   │   └── moltbook.js
│   └── ...
└── package.json
```

---

## 11. FÁZY IMPLEMENTÁCIE

### Fáza 1: Základy (1-2 týždne práce)
1. Inicializácia Next.js + TypeScript + Tailwind + shadcn/ui
2. Prisma schema + PostgreSQL setup
3. NextAuth.js autentifikácia (email/password)
4. Základný dashboard layout (sidebar, topbar)
5. Landing page (hero, features, CTA)

### Fáza 2: Bot Management (1-2 týždne)
6. Bot CRUD (create, read, update, delete)
7. Bot creation wizard (4 kroky)
8. Platform connection UI (API keys, test connection)
9. Bot detail page (overview, status)
10. Bot settings page (instructions, schedule, safety level)

### Fáza 3: Bot Execution (1-2 týždne)
11. Redis + BullMQ setup
12. Scheduler (cron → task queue)
13. Worker (task execution z existujúceho bot engine)
14. Refaktor existujúceho kódu pre multi-tenant
15. Real-time activity feed (SSE)

### Fáza 4: Billing (1 týždeň)
16. Stripe integration (Checkout, Webhooks)
17. Credit system (balance, transactions, deduction)
18. Credits purchase page
19. Low balance warnings

### Fáza 5: Analytics & Admin (1 týždeň)
20. Bot analytics page (engagement charts)
21. Admin panel (users, bots, revenue)
22. Pricing management (plans, action costs)
23. Promo codes

### Fáza 6: Polish & SEO (1 týždeň)
24. Verejné stránky (about, pricing, contact, FAQ, terms, privacy)
25. Blog systém
26. SEO optimalizácia (meta, sitemap, structured data)
27. Mobile responsive testing
28. Performance optimalizácia
29. Error handling & loading states
30. Email templates (welcome, low credits, reports)

### Fáza 7: Deploy & Launch
31. Production deploy (Nginx, SSL, PM2)
32. DNS setup pre doménu
33. Monitoring setup
34. Backup stratégia
35. Launch checklist

---

## 12. ČASTI Z EXISTUJÚCEHO BOTA NA REUSE

### Reuse priamo (shared modules):
- `platform-compliance.js` - pravidlá platforiem
- `multi-agent/safety.js` - Constitutional AI, brand protection
- `learning-engine.js` - brand protection rules, shouldMentionAceChange
- `scam-prevention.js` - dedup systém (adaptovať na per-bot)

### Reuse s úpravami:
- `content-reactor.js` - pridať botId parameter, loadovať config z DB
- `platforms/mastodon.js` - konštruktor berie credentials z DB
- `platforms/facebook.js` - konštruktor berie credentials z DB
- `platforms/telegram.js` - konštruktor berie credentials z DB
- `web-monitor.js` - per-bot RSS feed zoznam
- `daily-report.js` - per-bot report, posielať na user email
- `email-notifier.js` - reuse SMTP funkcie

### Nové (netýka sa existujúceho bota):
- Celý Next.js frontend
- Auth systém
- Stripe integrácia
- Credit systém
- BullMQ workers
- Admin panel
- Database layer (Prisma)

---

## 13. KONKURENČNÁ VÝHODA

| Feature | My (Grothi) | Hootsuite | Buffer | Jasper AI |
|---|---|---|---|---|
| Plne autonómny bot | ✅ | ❌ (scheduler) | ❌ (scheduler) | ❌ (generator) |
| Self-learning | ✅ | ❌ | ❌ | ❌ |
| Constitutional AI safety | ✅ | ❌ | ❌ | Čiastočne |
| Ban detection + auto-pause | ✅ | ❌ | ❌ | ❌ |
| Multi-platform (Mastodon, Moltbook) | ✅ | ❌ | ❌ | ❌ |
| Content Reactor (RSS→AI→Post) | ✅ | ❌ | ❌ | ❌ |
| Credit-based (pay per use) | ✅ | ❌ (subscription) | ❌ (subscription) | ❌ (subscription) |
| White-hat záruky | ✅ | N/A | N/A | Čiastočne |
| Engagement tracking + learning | ✅ | ✅ | ✅ | ❌ |

---

## 14. ODHADOVANÉ NÁKLADY NA PREVÁDZKU

| Položka | Mesačne |
|---|---|
| VPS server Hetzner CX33 (4vCPU, 8GB RAM) | €4.99 |
| PostgreSQL (na rovnakom serveri) | €0 |
| Redis (na rovnakom serveri) | €0 |
| Doména grothi.com (Cloudflare) | ~€1/mes (ročne ~€12) |
| Cloudflare CDN + DNS | €0 (free plan) |
| SSL (Cloudflare) | €0 |
| Stripe fees | 2.9% + €0.30 per transakcia |
| Claude API (pre bot akcie) | Per-use (users platia cez credits) |
| **TOTAL (fixné)** | **~€6/mesiac** |

**Poznámka:** Server zdieľame so ShadowGuardians botom. Ak bude záťaž veľká, upgrade na CX41 (16GB RAM, €14.99/mes).

---

## 15. ČO MUSÍŠ SPRAVIŤ TY (MANUÁLNE KROKY)

### 15.1 Cloudflare DNS (grothi.com)
Choď na https://dash.cloudflare.com/f2d737df0769679e7d6f3ddcae44ac8d/grothi.com → DNS → Records:

```
Typ    Meno       Hodnota           Proxy
A      @          89.167.18.92      ON (oranžový oblak)
A      www        89.167.18.92      ON (oranžový oblak)
```

### 15.2 Cloudflare SSL
Choď na grothi.com → SSL/TLS:
- Mode: **Full (Strict)**
- Edge Certificates: zapnuté
- Always Use HTTPS: ON
- Minimum TLS: 1.2

### 15.3 Server príprava (SSH)
```bash
ssh root@89.167.18.92

# 1. Nainštaluj PostgreSQL
apt update && apt install -y postgresql postgresql-contrib

# 2. Vytvor databázu
sudo -u postgres psql -c "CREATE USER grothi WITH PASSWORD 'SILNE_HESLO_TU';"
sudo -u postgres psql -c "CREATE DATABASE grothi OWNER grothi;"

# 3. Nainštaluj Redis
apt install -y redis-server
systemctl enable redis-server
systemctl start redis-server

# 4. Over že beží
systemctl status postgresql
systemctl status redis-server
redis-cli ping  # Mal by vrátiť PONG
```

### 15.4 Stripe účet
1. Choď na https://dashboard.stripe.com
2. Vytvor účet (ak nemáš) alebo použi existujúci
3. Zapíš si:
   - **Publishable key**: `pk_live_...` (alebo `pk_test_...` pre testovanie)
   - **Secret key**: `sk_live_...` (alebo `sk_test_...`)
   - **Webhook signing secret**: vytvor webhook endpoint pre `https://grothi.com/api/stripe/webhook`
4. Tieto kľúče pridáme do `.env` na serveri

### 15.5 GitHub repo clone na server
```bash
ssh root@89.167.18.92

cd /home/acechange-bot/
git clone https://github.com/cryptotrust1/grothi.git
cd grothi
```

### 15.6 Nginx konfigurácia
```bash
# Vytvor Nginx config pre grothi.com
cat > /etc/nginx/sites-available/grothi.com << 'NGINX'
server {
    listen 80;
    server_name grothi.com www.grothi.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
NGINX

# Aktivuj a reštartuj
ln -sf /etc/nginx/sites-available/grothi.com /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

**Poznámka:** SSL terminuje Cloudflare (Full Strict mode). Nginx počúva na porte 80, Cloudflare šifruje medzi sebou a serverom. Ak chceš origin certifikát, vygeneruj ho v Cloudflare → SSL → Origin Server.

### 15.7 Environment premenné (.env)
Na serveri v `/home/acechange-bot/grothi/` vytvor `.env`:
```
# Database
DATABASE_URL="postgresql://grothi:SILNE_HESLO_TU@localhost:5432/grothi"

# Redis
REDIS_URL="redis://localhost:6379"

# NextAuth
NEXTAUTH_URL="https://grothi.com"
NEXTAUTH_SECRET="NAHODNY_32_ZNAKOVY_STRING"

# Stripe
STRIPE_PUBLISHABLE_KEY="pk_live_..."
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# Encryption (pre API kľúče v DB)
ENCRYPTION_KEY="NAHODNY_64_HEX_STRING"

# Email (reuse z ShadowGuardians)
SMTP_HOST="smtp.m1.websupport.sk"
SMTP_PORT=587
SMTP_USER="info@acechange.io"
SMTP_PASS="..."
```

---

## 16. PORADIE IMPLEMENTÁCIE (ČO SPRAVÍM JA)

1. [ ] Inicializujem Next.js v `grothi` GitHub repo
2. [ ] Prisma schema + migrácie
3. [ ] Auth (registrácia, prihlásenie)
4. [ ] Landing page + verejné stránky
5. [ ] Dashboard + bot management
6. [ ] Napojenie na existujúci bot engine
7. [ ] BullMQ workers
8. [ ] Stripe + kreditový systém
9. [ ] Admin panel
10. [ ] SEO + polish
11. [ ] Deploy na server
12. [ ] DNS + Cloudflare + Nginx finalizácia

---

## 17. AKČNÉ BODY - SÚHRN

### Ty (manuálne, PRED implementáciou):
- [ ] Nastav Cloudflare DNS záznamy (A record → 89.167.18.92)
- [ ] Nastav Cloudflare SSL na Full (Strict)
- [ ] Nainštaluj PostgreSQL na server (príkazy vyššie)
- [ ] Nainštaluj Redis na server (príkazy vyššie)
- [ ] Vytvor Stripe účet a zapíš si kľúče
- [ ] Clone grothi repo na server
- [ ] Nastav Nginx config (príkazy vyššie)

### Ja (kód, PO tvojich krokoch):
- [ ] Celá Next.js implementácia
- [ ] Databáza + migrácie
- [ ] Všetky stránky a funkcie
- [ ] Napojenie na bot engine
- [ ] Deploy

---

**PLÁN SCHVÁLENÝ. Po splnení manuálnych krokov (sekcia 15) mi daj vedieť a začnem implementovať.**
