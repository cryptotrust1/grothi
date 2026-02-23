# AI Insights - Reinforcement Learning Engine

## Executive Summary

AI Insights je pokročilý reinforcement learning (RL) engine založený na multi-armed bandit algoritmoch, ktorý automaticky optimalizuje výkon marketingových príspevkov na základe histórie interakcií. Systém učí sa z reálnych dát (likes, comments, shares, clicks) a odporúča optimálne parametre pre každý nový príspevok.

## Architecture Overview

### Core Design Principles

1. **Contextual Multi-Armed Bandits** - Každý bot má 8 nezávislých dimenzií učenia
2. **Online Learning** - Aktualizácia po každom príspevku bez potreby retrainingu
3. **Exploration vs Exploitation** - Vážená rovnováha medzi využívaním známych stratégií a objavovaním nových
4. **Non-Stationary Adaptation** - EWMA (Exponentially Weighted Moving Average) pre adaptáciu na meniace sa trendy

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                         AI INSIGHTS ENGINE                       │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Epsilon    │  │  Thompson    │  │    UCB1      │          │
│  │   Greedy     │  │   Sampling   │  │              │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│         │                │                │                      │
│         └────────────────┼────────────────┘                      │
│                          ▼                                      │
│  ┌────────────────────────────────────────────────────────┐    │
│  │              LEARNING DIMENSION MANAGER                 │    │
│  ├─────────┬─────────┬─────────┬─────────┬─────────┬──────┤    │
│  │TIME_SLOT│DAY_WEEK │CONTENT  │HASHTAG  │TONE     │MEDIA │    │
│  │         │         │_TYPE    │_PATTERN │_STYLE   │_TYPE │    │
│  ├─────────┴─────────┴─────────┴─────────┴─────────┴──────┤    │
│  │POST_LENGTH│CTA_TYPE│                                     │    │
│  └────────────────────────────────────────────────────────┘    │
│                          │                                      │
│                          ▼                                      │
│  ┌────────────────────────────────────────────────────────┐    │
│  │              REWARD CALCULATION ENGINE                  │    │
│  │  • Engagement Rate (likes + comments + shares + clicks) │    │
│  │  • Follower-normalized scoring                         │    │
│  │  • EWMA-based reward tracking                          │    │
│  └────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

## Learning Dimensions

Systém optimalizuje 8 nezávislých dimenzií obsahu:

### 1. TIME_SLOT (24 arms)
```typescript
Arms: ['0', '1', '2', ..., '23']  // Hours in 24h format
```
**Význam**: Optimálna hodina publikovania príspevku. Systém učí sa, ktoré hodiny generujú najvyšší engagement pre daný účet.

### 2. DAY_OF_WEEK (7 arms)
```typescript
Arms: ['0', '1', '2', '3', '4', '5', '6']  // Sunday = 0
```
**Význam**: Optimálny deň v týždni pre publikovanie. Zohľadňuje sezónnosť a pracovný/víkendový režim cieľovej audiencie.

### 3. CONTENT_TYPE (7 arms)
```typescript
Arms: ['educational', 'promotional', 'engagement', 'news', 'curated', 'storytelling', 'ugc']
```
**Význam**: Typ obsahu podľa marketingovej klasifikácie:
- `educational` - Vzdelávací obsah (how-to, tipy)
- `promotional` - Priama propagácia produktov/služieb
- `engagement` - Obsah zameraný na interakciu (otázky, prieskumy)
- `news` - Aktuality a novinky
- `curated` - Zbierka/zhrnutie obsahu z iných zdrojov
- `storytelling` - Príbehová forma
- `ugc` - User-generated content

### 4. HASHTAG_PATTERN (7 arms)
```typescript
Arms: ['none', 'minimal', 'moderate', 'heavy', 'trending', 'niche', 'branded']
```
**Význam**: Stratégia použitia hashtagov:
- `none` - Žiadne hashtagy
- `minimal` - 1-2 relevantné hashtagy
- `moderate` - 3-5 hashtagov
- `heavy` - 10+ hashtagov
- `trending` - Trendové hashtagy
- `niche` - Špecializované hashtagy pre daný segment
- `branded` - Vlastné brandové hashtagy

### 5. TONE_STYLE (6 arms)
```typescript
Arms: ['professional', 'casual', 'humorous', 'inspirational', 'educational', 'provocative']
```
**Význam**: Tón komunikácie ovplyvňujúci emocionálnu odozvu publika.

### 6. MEDIA_TYPE (5 arms)
```typescript
Arms: ['text_only', 'image', 'video', 'carousel', 'story']
```
**Význam**: Formát média s najvyššou konverziou pre daný bot.

### 7. POST_LENGTH (3 arms)
```typescript
Arms: ['short', 'medium', 'long']
```
**Význam**: Dĺžka textu príspevku:
- `short` - Do 100 znakov
- `medium` - 100-500 znakov
- `long` - 500+ znakov

### 8. CTA_TYPE (5 arms)
```typescript
Arms: ['none', 'soft', 'hard', 'question', 'link']
```
**Význam**: Typ call-to-action:
- `none` - Bez výzvy k akcii
- `soft` - Neformálna výzva ("Ak sa vám páči, dajte like")
- `hard` - Priama výzva ("Kúpte teraz!")
- `question` - Otázka pre interakciu
- `link` - Odkaz na externý zdroj

## Algorithms

### 1. Epsilon-Greedy (Default)

```typescript
selectArmEpsilonGreedy(epsilon: number = 0.1): string
```

**Mechanizmus**:
- S pravdepodobnosťou `ε` (epsilon) - exploration: náhodný výber armu
- S pravdepodobnosťou `1-ε` - exploitation: výber armu s najvyššou priemernou odmenou

**Konfigurácia**:
- `epsilon` = 0.1 (štandard) - 10% exploration, 90% exploitation
- Pre nové boty sa odporúča vyšší epsilon (0.3-0.5)
- Pre stabilné boty nižší epsilon (0.05-0.1)

**Výhody**: Jednoduchosť implementácie, rýchlosť výpočtu
**Nevýhody**: Lineárna exploration (nerozlišuje medzi neznámymi a zlýmy armami)

### 2. Thompson Sampling (Bayesian)

```typescript
selectArmThompsonSampling(): string
```

**Mechanizmus**:
- Modeluje každý arm ako Beta distribúciu: Beta(α, β)
- α = počet úspechov + 1
- β = počet neúspechov + 1
- Výber armu s najvyššou hodnotou vzorky z Beta distribúcie

**Matematický základ**:
```
P(θ|data) ∝ P(data|θ) × P(θ)

kde θ je pravdepodobnosť úspechu armu
```

**Výhody**: Prirodzená rovnováha exploration/exploitation, rýchla konvergencia
**Nevýhody**: Vyššia výpočtová náročnosť, predpokladá binárne odmeny

### 3. UCB1 (Upper Confidence Bound)

```typescript
selectArmUCB1(explorationConstant: number = Math.sqrt(2)): string
```

**Mechanizmus**:
- UCB1 formula: `avgReward + sqrt((2 × ln(totalPulls)) / pulls)`
- Prvý člen: priemerná odmena (exploitation)
- Druhý člen: interval spoľahlivosti (exploration)

**Hoeffding's Inequality**:
```
P(true_mean ≤ sample_mean + sqrt(ln(t)/N)) ≥ 1 - 1/t²
```

**Výhody**: Teoretické garancie minimálneho regretu, O(1) pamäťová náročnosť
**Nevýhody**: Agresívna exploration pre armov s malým počtom pokusov

## Reward Calculation

### Engagement Score Formula

```typescript
function calculateEngagementScore(post: PostEngagement): number {
  const weights = {
    likes: 1,
    comments: 3,
    shares: 5,
    clicks: 2
  };
  
  const rawScore = 
    (post.likes * weights.likes) +
    (post.comments * weights.comments) +
    (post.shares * weights.shares) +
    (post.clicks * weights.clicks);
  
  // Normalizácia na followera
  const normalizedScore = post.followerCount > 0 
    ? rawScore / post.followerCount 
    : rawScore;
  
  return Math.min(normalizedScore, 100); // Cap at 100
}
```

### Exponential Weighted Moving Average (EWMA)

Pre adaptáciu na meniace sa trendy používame EWMA:

```typescript
function calculateEWMA(newValue: number, oldEWMA: number, alpha: number): number {
  return alpha * newValue + (1 - alpha) * oldEWMA;
}
```

**Alpha parameter** (default = 0.3):
- Vyššie α (0.5-0.7) - rýchlejšia adaptácia na nové trendy
- Nižšie α (0.1-0.2) - stabilnejšie odhady, pomalšia adaptácia

## Database Schema

### RLConfig

```prisma
model RLConfig {
  id              String   @id @default(cuid())
  botId           String
  dimension       String   // TIME_SLOT, DAY_OF_WEEK, etc.
  algorithm       String   @default("epsilon_greedy") // epsilon_greedy, thompson_sampling, ucb1
  epsilon         Float    @default(0.1)  // Pre epsilon-greedy
  explorationConst Float   @default(1.414) // Pre UCB1
  ewmaAlpha       Float    @default(0.3)  // EWMA smoothing factor
  totalEpisodes   Int      @default(0)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  bot             Bot      @relation(fields: [botId], references: [id], onDelete: Cascade)
  armStates       RLArmState[]
  
  @@unique([botId, dimension])
}
```

### RLArmState

```prisma
model RLArmState {
  id          String   @id @default(cuid())
  configId    String
  armId       String   // Napr. "14" pre TIME_SLOT=14:00
  pulls       Int      @default(0)
  rewards     Float    @default(0)
  avgReward   Float    @default(0)
  ewmaReward  Float    @default(0)
  
  // Pre Thompson Sampling
  alpha       Float    @default(1)  // Successes + 1
  beta        Float    @default(1)  // Failures + 1
  
  config      RLConfig @relation(fields: [configId], references: [id], onDelete: Cascade)
  
  @@unique([configId, armId])
}
```

### PostEngagement (Rozšírený)

```prisma
model PostEngagement {
  id                String   @id @default(cuid())
  postId            String
  platform          String
  
  // Engagement metrics
  likes             Int      @default(0)
  comments          Int      @default(0)
  shares            Int      @default(0)
  clicks            Int      @default(0)
  
  // RL dimensions (čo sme použili)
  timeSlot          String?  // "14"
  dayOfWeek         String?  // "2"
  contentType       String?  // "educational"
  hashtagPattern    String?  // "moderate"
  toneStyle         String?  // "professional"
  mediaType         String?  // "image"
  postLength        String?  // "medium"
  ctaType           String?  // "soft"
  
  // Learning state
  hasLearned        Boolean  @default(false)
  engagementScore   Float?
  
  followerCount     Int      @default(0)
  postedAt          DateTime
  createdAt         DateTime @default(now())
}
```

## API Endpoints

### GET /api/bots/[id]/rl-insights

Získa kompletné analytické dáta pre AI Insights dashboard.

**Response**:
```typescript
{
  configs: Array<{
    dimension: string;
    algorithm: string;
    totalEpisodes: number;
    explorationRate: number;
    arms: Array<{
      armId: string;
      pulls: number;
      avgReward: number;
      ewmaReward: number;
      confidence: number;
    }>;
    bestArm: string;
  }>;
  stats: {
    totalEpisodes: number;
    postsAnalyzed: number;
    activePlatforms: number;
    explorationRate: number;
  };
  recommendations: Array<{
    dimension: string;
    recommendedValue: string;
    confidence: number;
    expectedReward: number;
  }>;
}
```

### POST /api/rl/learn

Spustí learning update po získaní engagement dát.

**Request**:
```typescript
{
  postEngagementId: string;
  // Engagement metrics sa získajú z DB
}
```

**Process**:
1. Načíta PostEngagement z DB
2. Vypočíta engagement score
3. Pre každú dimenziu updatne príslušný arm
4. Označí post ako `hasLearned = true`

### POST /api/rl/recommend

Získa odporúčania pre nový príspevok.

**Request**:
```typescript
{
  botId: string;
  dimensions?: string[]; // Voliteľné - ktoré dimenzie chceme
}
```

**Response**:
```typescript
{
  recommendations: Record<string, {
    value: string;
    algorithm: string;
    confidence: number;
    exploration: boolean;
  }>;
  metadata: {
    totalEpisodes: number;
    lastUpdated: string;
  };
}
```

## Integration Workflow

### 1. Creating a Post (Scheduler Integration)

```typescript
// Pred vytvorením scheduled postu
const recommendations = await fetch('/api/rl/recommend', {
  method: 'POST',
  body: JSON.stringify({ botId: 'bot_123' })
});

// Použijeme odporúčania pre naplnenie dimenzií
const scheduledPost = await prisma.scheduledPost.create({
  data: {
    botId: 'bot_123',
    content: '...',
    // RL dimensions z odporúčaní
    rlTimeSlot: recommendations.timeSlot,
    rlContentType: recommendations.contentType,
    // ... ostatné dimenzie
  }
});
```

### 2. Publishing & Learning

```typescript
// Po publikovaní príspevku
async function onPostPublished(post: ScheduledPost, engagement: EngagementData) {
  // Vytvoríme PostEngagement záznam
  const postEngagement = await prisma.postEngagement.create({
    data: {
      postId: post.id,
      platform: post.platform,
      timeSlot: post.rlTimeSlot,
      dayOfWeek: String(post.scheduledAt.getDay()),
      contentType: post.rlContentType,
      // ... ostatné dimenzie
      followerCount: await getFollowerCount(post.botId, post.platform),
      postedAt: new Date(),
    }
  });
  
  // Engagement sa aktualizuje async cez cron job
}

// Cron job každých 15 minút
cron.schedule('*/15 * * * *', async () => {
  const pending = await prisma.postEngagement.findMany({
    where: { hasLearned: false },
    where: { postedAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } // 24h+ old
  });
  
  for (const post of pending) {
    await fetch('/api/rl/learn', {
      method: 'POST',
      body: JSON.stringify({ postEngagementId: post.id })
    });
  }
});
```

## Configuration Best Practices

### Pre nové boty (0-50 príspevkov)

```typescript
const newBotConfig = {
  algorithm: 'thompson_sampling',
  epsilon: 0.4,      // Vysoká exploration
  ewmaAlpha: 0.5,    // Rýchla adaptácia
};
```

### Pre stabilné boty (50+ príspevkov)

```typescript
const stableBotConfig = {
  algorithm: 'ucb1',
  explorationConst: 1.0,  // Nižšia exploration
  ewmaAlpha: 0.2,         // Stabilnejšie odhady
};
```

### Pre sezónne kampane

```typescript
const seasonalConfig = {
  algorithm: 'epsilon_greedy',
  epsilon: 0.3,      // Dočasne zvýšená exploration
  ewmaAlpha: 0.6,    // Rýchla detekcia zmien
};
```

## Performance Optimization

### Database Indexing

```sql
-- Pre rýchle získavanie arm states
CREATE INDEX idx_rlarmstate_config_arm ON "RLArmState"("configId", "armId");

-- Pre pending posts na learning
CREATE INDEX idx_postengagement_learned ON "PostEngagement"("hasLearned", "postedAt");

-- Pre bot configs
CREATE INDEX idx_rlconfig_bot ON "RLConfig"("botId", "dimension");
```

### Caching Strategy

```typescript
// Redis cache pre odporúčania (5 min TTL)
const cacheKey = `rl:recommend:${botId}`;
const cached = await redis.get(cacheKey);

if (cached) return JSON.parse(cached);

const recommendations = await generateRecommendations(botId);
await redis.setex(cacheKey, 300, JSON.stringify(recommendations));
return recommendations;
```

## Monitoring & Alerts

### Key Metrics

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Avg Engagement Rate | > 5% | < 2% |
| Exploration Rate | 10-30% | > 50% or < 5% |
| Learning Latency | < 1s | > 5s |
| Arm Coverage | > 80% | < 50% |

### Health Check Endpoint

```typescript
// GET /api/rl/health
{
  status: 'healthy' | 'degraded' | 'unhealthy',
  dimensions: {
    [dimension: string]: {
      totalArms: number;
      exploredArms: number;  // pulls > 0
      avgReward: number;
      lastUpdate: string;
    }
  },
  lastLearningAt: string;
}
```

## Security Considerations

1. **Rate Limiting** - `/api/rl/*` endpointy by mali mať striktné rate limity (100 req/min na bot)
2. **Input Validation** - Všetky dimension values musia byť validované proti `DIMENSION_ARMS`
3. **Auth Check** - Každý request musí overiť vlastníctvo bota cez `requireAuth()`
4. **Data Isolation** - Bot A nikdy nevidí dáta z Bot B (row-level security v DB)

## Future Enhancements

### 1. Contextual Bandits
Rozšírenie o kontextové features (deň v roku, trending topics, follower demographics).

### 2. Multi-Objective Optimization
Okrem engagementu optimalizovať aj conversion rate, reach, alebo brand sentiment.

### 3. Cross-Bot Learning
Transfer learning medzi podobnými botmi v rámci rovnakého odvetvia.

### 4. A/B Testing Framework
Integrácia s natívnym A/B testingom pre validáciu RL odporúčaní.

## References

1. Auer, P., Cesa-Bianchi, N., & Fischer, P. (2002). Finite-time analysis of the multiarmed bandit problem.
2. Chapelle, O., & Li, L. (2011). An empirical evaluation of thompson sampling.
3. Sutton, R. S., & Barto, A. G. (2018). Reinforcement Learning: An Introduction.
