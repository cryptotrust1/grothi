# GROTHI - Expertný Audit AI Systému & Návrh Vylepšení
## Komplexná analýza nastavení, AI funkcií, stratégie a návrh systému pre maximálne výsledky

**Dátum:** 17. marca 2026
**Typ:** Strategický audit + Návrh architektúry
**Autor:** AI Expert Audit (SEO + Social Media + AI Strategy)

---

## ČASŤ 1: AUDIT SÚČASNÉHO STAVU

### 1.1 Prehľad všetkých nastavení bota

Grothi má **5 hlavných nastavovacích oblastí** rozprestretých na **4 stránkach**:

| Stránka | Účel | Počet nastavení | Reálne použitie v AI |
|---------|------|-----------------|---------------------|
| Bot Creation (`/bots/new`) | Základné nastavenie | 9 polí | 7/9 použitých |
| Bot Settings (`/bots/[id]/settings`) | Konfigurácia | ~25 polí | 18/25 použitých |
| Strategy (`/bots/[id]/strategy`) | Obsahová stratégia + Audience | ~45 polí | 40/45 použitých |
| Autopilot (`/bots/[id]/autopilot`) | Autonomné publikovanie | 6 nastavení | 6/6 použitých |
| Image Style (`/bots/[id]/image-style`) | Vizuálny štýl | ~15 polí | 1/15 (!) |
| Per-Platform Plans (v Strategy) | Platforma-špecifické | ~10 na platformu | 8/10 použitých |

### 1.2 Čo funguje VÝBORNE (silné stránky)

#### A) AI Content Generation Pipeline (9/10)
Systém promptov v `autonomous-content` je **profesionálnej kvality**:
- 12-vrstvový systémový prompt (role → cieľ → brand → knowledge → audience → algorithm → format → requirements)
- Explicitná algoritmická optimalizácia ("create content that the algorithm will recommend")
- Suppression triggers ako "DO NOT" varovania
- Jazyková vynútenosť pre non-EN jazyky
- Product context injection s UTM parametrami

#### B) Platform Algorithm Knowledge Base (8/10)
Súbor `platform-algorithm.ts` (~1940 riadkov) obsahuje:
- 15 platforiem s detailnými algoritmickými dátami
- Engagement signály s váhami (1-10)
- Content format ranking s reach multipliermi (1.0x - 3.0x)
- Golden window, min interval, max promo %
- Growth tactics + suppression triggers

#### C) Audience Profile System (9/10)
Extrémne detailný profil cieľovej skupiny (30+ polí):
- Schwartz awareness model (6 stupňov)
- Pain/gain framework
- Vocabulary layer (wordsTheyUse/wordsToAvoid)
- Buying psychology (triggers, barriers, sensitivity)
- Psychographics (interests, values, lifestyle)

#### D) Reinforcement Learning Engine (7/10)
Thompson Sampling RL pre optimalizáciu:
- TONE_STYLE, CONTENT_TYPE, TIME_SLOT dimenzie
- Per-platform learning
- 5+ pulls threshold pre spoľahlivosť
- Automatické učenie z engagement dát

#### E) Per-Platform Strategy Override (8/10)
ContentPlan model umožňuje per-platform nastavenie:
- Frekvencia (text/image/video/story)
- Content types override
- Tone override
- Hashtag strategy override
- Custom hashtagy

### 1.3 Čo NEFUNGUJE alebo je NEPOUŽITÉ

#### A) KRITICKÉ NEDOSTATKY

| Problém | Detail | Dopad |
|---------|--------|-------|
| **Image Style preferences IGNOROVANÉ** | `creativePreferences` sa ukladajú ale AI content generátor ich NEPOUŽÍVA | Vizuálny branding sa neaplikuje |
| **GA4 integrácia PRÁZDNA** | `gaPropertyId` a `gaCredentials` existujú v DB ale nikde sa nepoužívajú | Žiadne conversion tracking |
| **`imagePreferences` DEPRECATED** | Starý formát nahradený `creativePreferences`, ale starý field stále existuje | Mätúce, mŕtvy kód |
| **`algorithmConfig` MINIMÁLNE POUŽITÝ** | Hype radar ukladá dáta ale takmer nikde sa nepoužívajú v AI generácii | Trend data sa strácajú |
| **`dedupHistory` NEPOUŽITÝ** | Existuje v schéme ale nikdy sa nečíta ani nezapisuje | Zbytočné pole |
| **`postingSchedule` MINIMÁLNE POUŽITÝ** | Existuje ale autopilot používa vlastnú logiku | Mätúce pre usera |

#### B) CHÝBAJÚCE FUNKCIE (podľa expertných štandardov 2026)

| Chýbajúca funkcia | Prečo je kritická | Konkurencia |
|-------------------|-------------------|-------------|
| **Social SEO / Keywords v caption** | 46% Gen Z používa social search namiesto Google | Buffer, Hootsuite, SocialBee |
| **A/B Testing obsahu** | Nemožnosť porovnať varianty textu | Hootsuite, Sprout Social |
| **Content Pillars systém** | Žiadna štruktúra hlavných tém | SocialBee AI Copilot |
| **Competitor monitoring** | Nesleduje konkurenciu | Sprout Social, Hootsuite |
| **Engagement/Community management** | Žiadny unified inbox, žiadne automatické odpovede | Agorapulse, Hootsuite |
| **Content repurposing** | Jeden post = jedna platforma, žiadna adaptácia | Repurpose.io, Buffer |
| **Conversion funnel tracking** | Žiadna návštevnosť → lead → sale pipeline | HubSpot, Sprout |
| **Brand Voice scoring** | AI generuje ale neoveruje konzistenciu hlasu | Jasper AI, Writer |
| **Visual content AI** | Žiadne AI-generovanie obrázkov pre posty | Canva, DALL-E integrácia |
| **Hook generator / Attention optimization** | Žiadna optimalizácia prvých 3 sekúnd/riadkov | FeedHive |
| **Hashtag research & recommendations** | Keywords existujú ale žiadny výskum hashtagov | Later, Flick |

#### C) REDUNDANCIE A KONFÚZIE

1. **Dvojité nastavenie frequency:**
   - `postingSchedule` (cron) v Settings vs `dailyTextPosts/dailyImagePosts` v Strategy per-platform
   - User nevie čo má prednosť → autopilot používa per-platform, `postingSchedule` je takmer ignorované

2. **Dvojité nastavenie content types:**
   - Globálne `contentTypes` v reactorState vs per-platform `contentTypesOverride` v ContentPlan
   - Funguje správne (override má prednosť), ale UX je mätúce

3. **Trojité nastavenie tónov:**
   - Globálne `toneStyles` v reactorState
   - Per-platform `tonesOverride` v ContentPlan
   - RL learning `TONE_STYLE` armState
   - Komplikovaná priorita: RL > override > globálne

4. **Image Style vs Creative Preferences:**
   - `/image-style` stránka ukladá do `creativePreferences`
   - Staré `imagePreferences` pole stále existuje
   - ANI JEDNO sa nepoužíva v AI content generácii

5. **Safety Level vs Max Posts/Day:**
   - `safetyLevel` (CONSERVATIVE=2, MODERATE=3-5, AGGRESSIVE=10)
   - `maxPostsPerDay` (1-50)
   - Oba existujú, nie je jasné čo má prednosť

---

## ČASŤ 2: EXPERTNÁ ANALÝZA - ČO HOVORIA EXPERTI 2026

### 2.1 Kľúčové trendy v algoritmoch sociálnych sietí (2026)

Na základe výskumu z Hootsuite, Buffer, Sprout Social, Metricool, StoryChief a ďalších:

#### Zdieľania > Lajky > Komentáre
**Zdieľania (sends/shares) sú teraz #1 signál** na väčšine platforiem. Instagram to potvrdil: "We want to inspire content that brings people together." Poslanie videa kamarátovi je silnejší signál ako like.

#### Social SEO nahrádza hashtagy
- Instagram v decembri 2024 **zrušil možnosť sledovať hashtagy**
- 46% Gen Z používa sociálne siete ako vyhľadávač
- Keywords v captions, alt textoch a bio sú teraz kritické
- Odporúčanie: 3-5 niche hashtagov + keyword-rich captions

#### Prvé 3 sekundy rozhodujú o všetkom
- TikTok: "3-second rule" — ak nedržíte pozornosť, algoritmus zastaví distribúciu
- Instagram Reels: watch time je hlavná metrika
- LinkedIn: "golden hour" (prvých 60 minút) je ešte kritickejšia

#### Autenticita > Produkčná kvalita
- AI na Facebooku čoraz viac odmeňuje obsah, ktorý "feels human"
- Algoritmy penalizujú generic AI content
- Micro-influenceri (5K-100K) majú lepšie engagement rates

#### Video dominuje
- Short-form video generuje 2.5x viac engagement ako akýkoľvek iný formát
- Instagram Reels: 2.46% engagement rate
- LinkedIn native video: +69% performance boost

#### Content Pillars sú základ
- 3-5 hlavných tém definuje brand na sociálnych sieťach
- AI dokáže automaticky klasifikovať posty do pilierov
- Tracking engagement per pillar umožňuje optimalizáciu

### 2.2 Lead Generation Best Practices

- **80% B2B leadov** zo sociálnych sietí pochádza z LinkedIn
- Content-to-Lead Funnel: vzdelávaj → buduj dôveru → CTA → lead magnet
- Retargeting: udržiavaj viditeľnosť pre nekonvertovaných leadov
- Social listening: monitoruj zmienky a konverzácie

### 2.3 Reinforcement Learning vs A/B Testing

- RL je **nadradený** tradičnému A/B testovaniu — testuje viaceré premenné simultánne
- RL sa prispôsobuje v reálnom čase na základe feedback
- Grothi už má RL engine (Thompson Sampling) — **masívna konkurenčná výhoda**
- Ale: RL engine sa používa iba na 3 dimenzie (tone, content_type, time_slot) — dá sa rozšíriť

---

## ČASŤ 3: NÁVRH VYLEPŠENÉHO SYSTÉMU

### 3.1 Filozofia návrhu

**Princíp:** Grothi musí byť "AI Social Media Growth Engine" — nie len scheduler s AI.

Kľúčový diferenciátor: **Closed-Loop Optimization System**
```
Nastaviť stratégiu → AI generuje obsah → Publikovať → Merať engagement
      ↑                                                        ↓
      └──────── RL sa učí + automaticky optimalizuje ←────────┘
```

Žiadny konkurent nemá tak hlbokú integráciu RL + platform algorithm knowledge + audience psychology ako Grothi. Toto je potrebné **dokončiť a zdokonaliť**.

### 3.2 PRIORITA 1: Opraviť čo nefunguje (Quick Wins)

#### QW-1: Integrovať Creative Preferences do AI generácie
**Problém:** User nastaví vizuálne preferencie v Image Style, ale AI ich nikdy nepoužije.
**Riešenie:** V `autonomous-content/route.ts` pridať sekciu do system promptu:
```
VISUAL BRAND IDENTITY:
- Brand colors: ${creativePreferences.brandColors}
- Style: ${creativePreferences.style}
- Overlay text: ${creativePreferences.overlayText}
→ When describing visuals or suggesting image content, ALWAYS align with these preferences.
→ If generating text overlay suggestions, use brand colors and approved style.
```
**Dopad:** Konzistentnejší brand identity naprieč všetkými postami.

#### QW-2: Eliminovať redundanciu Safety Level vs Max Posts/Day
**Problém:** Dva nastavenia kontrolujú to isté.
**Riešenie:** Zmeniť `safetyLevel` na "preset" ktorý automaticky nastaví max posts/day:
- CONSERVATIVE → 3/day, MODERATE → 8/day, AGGRESSIVE → 15/day
- Ale umožniť "Custom" kde user zadá vlastný limit
- Zobraziť jednu sekciu namiesto dvoch

#### QW-3: Vyčistiť deprecated fields
**Riešenie:**
- Migrácia: odstrániť `imagePreferences`, `dedupHistory`, `gaCredentials`
- Migrovať existujúce dáta z `imagePreferences` → `creativePreferences` ak chýbajú

#### QW-4: Využiť algorithmConfig z Hype Radar
**Problém:** `detect-trends` cron ukladá dáta do `algorithmConfig` ale AI ich nepoužíva.
**Riešenie:** V `autonomous-content/route.ts` načítať `bot.algorithmConfig` a injectovať:
```
CURRENT TRENDING TOPICS:
${algorithmConfig.detectedTrends?.map(t => `- ${t.topic} (${t.momentum})`).join('\n')}
→ If any trending topic aligns with brand keywords, consider incorporating it naturally.
```

#### QW-5: Zjednotiť frequency nastavenia
**Problém:** `postingSchedule` cron vs per-platform frequency v ContentPlan.
**Riešenie:**
- Odstrániť `postingSchedule` z Bot Settings UI (ponechať v DB pre backward compat)
- Frequency sa nastavuje VÝLUČNE cez Strategy page per-platform
- Autopilot aj manuálne plánovanie používajú rovnaké per-platform nastavenia

### 3.3 PRIORITA 2: Nové systémy pre 10x výsledky

#### P2-1: Social SEO Engine (KRITICKÉ)

**Prečo:** 46% Gen Z, 35% millennials používa social search. Instagram indexuje public posty pre Google. Keywords > Hashtagy.

**Návrh architektúry:**

```
Nový model: SocialSEOConfig (per bot)
├── targetKeywords: String[]          # Hlavné SEO keywords (20-50)
├── longTailKeywords: String[]        # Long-tail frázy
├── keywordClusters: Json             # Zoskupené keywords do tém
├── competitorKeywords: String[]      # Keywords konkurencie
├── platformKeywordMap: Json          # Per-platform keyword priority
└── autoKeywordRefresh: Boolean       # AI automaticky aktualizuje keywords
```

**Integrácia do AI generácie:**
```
SOCIAL SEO REQUIREMENTS:
- Primary keyword for this post: "${selectedKeyword}"
- MUST include this keyword naturally in the first 2 sentences
- Include 1-2 related long-tail phrases: ${longTailSuggestions}
- Alt text MUST contain: "${altTextKeyword}"
- Caption must be searchable — use natural language, not hashtag-speak
- Platform search optimization: ${platformSpecificSEOTips}
```

**Keyword Performance Tracking:**
- Nová RL dimenzia: `KEYWORD` — ktoré keywords generujú najväčší reach
- Dashboard: keyword performance heatmap
- Automatický refresh: AI analyzuje top-performing posty a extrahuje nové keywords

#### P2-2: Content Pillars System

**Prečo:** Experti odporúčajú 3-5 pilierov. AI môže automaticky klasifikovať obsah a optimalizovať mix.

**Návrh:**

```
Nový model: ContentPillar
├── id, botId
├── name: String              # "Industry Insights", "Behind the Scenes"
├── description: String       # Čo tento pilier pokrýva
├── targetPercentage: Int     # 30% = 30 z 100 postov je tento pilier
├── keywords: String[]        # Keywords špecifické pre pilier
├── toneOverride: String?     # Ak pilier vyžaduje iný tón
├── contentTypes: String[]    # Preferované formáty pre tento pilier
├── performanceScore: Float   # RL-computed score
└── isActive: Boolean
```

**AI Integration:**
- Autopilot pri generovaní plánu **rozdeľuje posty podľa pilierov** (dodržiava targetPercentage)
- Každý post má `pillarId` — AI prompt obsahuje kontext piliera
- RL učí sa: "Behind the Scenes" posty majú 3x engagement → automaticky zvýšiť %
- Dashboard: pillar performance chart (engagement, reach, conversions per pillar)

#### P2-3: Hook Generator & Attention Optimizer

**Prečo:** Prvé 3 sekundy/riadky rozhodujú o 80% výkonu postu. Toto je najdôležitejší element obsahu.

**Návrh:**

Rozšíriť AI generáciu o **2-pass systém:**

**Pass 1: Content Generation** (existujúce)
- AI vygeneruje plný obsah postu

**Pass 2: Hook Optimization** (NOVÉ)
```
System prompt:
"You are a social media hook specialist. Your ONLY job is to optimize the
first line/sentence of this ${platform} post for maximum attention.

PLATFORM RULES:
- Instagram: First line must stop the scroll. Use pattern interrupt,
  controversial statement, or unexpected statistic.
- TikTok: First 3 words are everything. Start with action verb or question.
- LinkedIn: First sentence determines if user clicks "see more".
  Use insight, counter-intuitive fact, or professional challenge.
- Twitter: Entire tweet IS the hook. Front-load the value.

HOOK FORMULAS THAT WORK:
1. "Most people think X. They're wrong." (contrarian)
2. "I [action] for [time] and here's what happened" (story)
3. "[Shocking stat]% of [audience] don't know this" (curiosity gap)
4. "Stop [common mistake]. Do this instead:" (direct)
5. "The [industry] secret nobody talks about:" (insider)

CURRENT HOOK: "${firstLine}"
PLATFORM: ${platform}
AUDIENCE: ${audienceProfile.aspirationalIdentity}

Generate 3 alternative hooks. Each must be under ${maxHookLength} characters.
Rank them by expected attention-grab score (1-10).
"
```

**RL Integration:** Nová dimenzia `HOOK_FORMULA` — RL sa učí, ktorá formula funguje najlepšie pre danú platformu + audience.

#### P2-4: Content Repurposing Engine

**Prečo:** Jeden výborný post by mal byť adaptovaný pre všetky platformy. To dramaticky znižuje cost-per-content a zvyšuje konzistentnosť.

**Návrh:**

```
Nový workflow: "Create Once, Adapt Everywhere"

1. User vytvorí post pre jednu platformu (alebo Autopilot vygeneruje)
2. Tlačidlo "Repurpose to..." zobrazí ostatné pripojené platformy
3. AI adaptuje obsah:
   - Instagram Reel script → LinkedIn article summary
   - LinkedIn article → Twitter thread
   - Twitter thread → Instagram carousel slides
   - Blog post (RSS) → 5 social media posts

AI Repurposing Prompt:
"Adapt this ${sourcePlatform} content for ${targetPlatform}.

SOURCE CONTENT:
${originalContent}

ADAPTATION RULES FOR ${targetPlatform}:
- Character limit: ${targetLimit}
- Best format: ${bestFormat} (${reachMultiplier}x reach)
- Tone adjustment: ${sourceTone} → ${targetTone}
- Hashtag strategy: ${targetHashtagStrategy}
- Key algorithm signal: ${targetPrimaryMetric}
- KEEP the core message and brand voice
- CHANGE the format, length, and style to be native to ${targetPlatform}
- ADD platform-specific elements (questions for Twitter, visual descriptions for Instagram)
"
```

**Dopad:** 1 kvalitný post → 5-10 platformovo-natívnych variácií. Dramatické zníženie cost per post.

#### P2-5: Rozšírený RL Engine (Multi-Dimensional Learning)

**Súčasný stav:** RL optimalizuje 3 dimenzie (tone, content_type, time_slot).

**Návrh rozšírenia na 10 dimenzií:**

| Dimenzia | Čo sa učí | Dopad |
|----------|-----------|-------|
| `TONE_STYLE` | Najlepší tón per platform | Existujúce |
| `CONTENT_TYPE` | Najlepší typ obsahu | Existujúce |
| `TIME_SLOT` | Najlepší čas publikovania | Existujúce |
| `HOOK_FORMULA` | Najlepší typ háčika | **NOVÉ** - 5 formúl |
| `CONTENT_PILLAR` | Najvýkonnejší pilier | **NOVÉ** |
| `KEYWORD_CLUSTER` | Najúčinnejšie SEO keywords | **NOVÉ** |
| `CONTENT_LENGTH` | Optimálna dĺžka textu | **NOVÉ** - short/medium/long |
| `CTA_TYPE` | Najúčinnejšia výzva k akcii | **NOVÉ** - question/link/instruction/none |
| `EMOJI_DENSITY` | Optimálna hustota emoji | **NOVÉ** - none/low/medium/high |
| `MEDIA_TYPE` | Obrázok vs video vs carousel | **NOVÉ** |

**Dopad:** Z 3-dimenzionálneho na 10-dimenzionálne optimalizačné priestory. Systém sa učí 10x rýchlejšie, čo funguje najlepšie.

#### P2-6: Engagement Score Prediction

**Prečo:** Pred publikovaním predpovedať, ako dobre bude post performovať.

**Návrh:**

```
Pre každý post pred publikovaním:
1. AI analyzuje obsah + historické dáta
2. Vypočíta "Predicted Engagement Score" (0-100)
3. Ak score < 40 → varovanie + návrhy na vylepšenie
4. Ak score > 80 → "High Performer" badge

Scoring factors:
- Hook quality (prvý riadok analysis)
- Keyword relevance (Social SEO score)
- Platform algorithm alignment (suppression triggers check)
- Content pillar performance (historický RL score)
- Optimal time slot match
- Media type match (preferovaný formát)
- Brand voice consistency
```

**UI:** V Post Scheduler vedľa každého postu: zelená/žltá/červená bodka s predpovedaným score.

### 3.4 PRIORITA 3: Pokročilé systémy (Diferenciácia od konkurencie)

#### P3-1: Competitive Intelligence Module

**Prečo:** Žiadny tool v cene Grothi neponúka real-time competitive monitoring.

**Návrh:**

```
Nový model: CompetitorProfile
├── id, botId
├── name: String
├── platforms: Json            # { instagram: "@handle", twitter: "@handle" }
├── contentThemes: String[]    # AI-detected themes
├── postingFrequency: Json     # Detected patterns
├── topPerformingContent: Json # Best posts by engagement
├── weaknesses: String[]       # AI-identified gaps
└── lastAnalyzedAt: DateTime

Nový cron: /api/cron/competitor-analysis
- Frequency: Daily
- Scrape public competitor profiles (kde API umožňuje)
- AI analysis: content themes, frequency, engagement patterns
- Identify gaps = opportunities for our user
```

**AI Integration do content generation:**
```
COMPETITIVE INTELLIGENCE:
- Competitor "${name}" posts about: ${themes}
- Their top-performing content: ${topContent}
- Identified gap: ${gap}
→ Consider addressing this gap in your content to capture unserved audience.
```

#### P3-2: Content Calendar Intelligence

**Prečo:** Expertné nástroje (SocialBee, Later) majú AI-driven content calendáre ktoré zohľadňujú udalosti, sezóny, trendy.

**Návrh:**

Rozšíriť Autopilot plan generation o:

```
CALENDAR INTELLIGENCE:
1. Industry events (user-defined): ["CES", "Black Friday", "Fashion Week"]
2. Holidays & seasons: Auto-detected based on user timezone/location
3. Trending topics: From Hype Radar + RSS feeds
4. Content pillar rotation: Ensure balanced coverage
5. Competitor gaps: Schedule content when competitors are quiet

Výsledok: AI generuje "smart calendar" s:
- Pre-event content (7 dní pred)
- Event-day content (live reactions)
- Post-event content (wrap-ups, lessons learned)
- Seasonal adaptations (tone, colors, themes)
```

#### P3-3: Brand Voice Consistency Checker

**Prečo:** Najväčší problém AI-generovaného obsahu je nekonzistentný brand voice. Optimizely a Writer majú voice scoring.

**Návrh:**

```
Post-generation quality gate:

1. AI vygeneruje obsah
2. Brand Voice Checker (druhý AI call, menší model - Haiku):

   "Analyze this post for brand voice consistency:
   POST: ${generatedContent}

   BRAND VOICE GUIDELINES:
   - Instructions: ${bot.instructions}
   - Audience vocabulary: ${wordsTheyUse}
   - Words to avoid: ${wordsToAvoid}
   - Tone: ${selectedTone}
   - Communication style: ${communicationStyle}

   Score 1-10 on:
   - Tone match
   - Vocabulary alignment
   - Authenticity feel
   - CTA appropriateness

   If total < 6, suggest specific fixes."

3. Ak score < 6 → automaticky regenerovať s feedback
4. Max 2 regenerácie (credit protection)
```

**Cost:** +1 Haiku call per post (~0.001$) pre signifikantne lepšiu kvalitu.

#### P3-4: Funnel-Aware Content Strategy

**Prečo:** Obsah by mal byť cielene mapovaný na customer journey fázy. Toto je základ lead generation.

**Návrh:**

Rozšíriť Content Pillars o **funnel stage mapping:**

```
Každý Content Pillar má:
├── funnelStage: "TOFU" | "MOFU" | "BOFU"
│   ├── TOFU (Top of Funnel): Awareness - educational, entertaining
│   ├── MOFU (Middle of Funnel): Consideration - case studies, comparisons
│   └── BOFU (Bottom of Funnel): Decision - testimonials, offers, CTA

Autopilot distribúcia:
- TOFU: 50-60% postov (build audience)
- MOFU: 25-35% postov (nurture interest)
- BOFU: 10-20% postov (convert)

AI dostáva kontext:
"This post is TOFU content targeting people in the AWARENESS stage.
Goal: Educate and attract. DO NOT sell directly.
Instead: Provide value → Build trust → Hint at expertise."

vs

"This post is BOFU content targeting people in the DECISION stage.
Goal: Convert. Include specific offer/CTA.
Mention: ${product.advantages}, ${product.buyingReasons}
Address objection: ${audienceProfile.objections[0]}"
```

**Dopad:** Obsah nie je náhodný mix — je to **strategický funnel** ktorý systematicky konvertuje followers na customers.

#### P3-5: Multi-Format Content System

**Prečo:** Algoritmy 2026 odmeňujú rôznorodé formáty. Instagram: carousel + Reels + Stories. TikTok: video + carousel.

**Návrh:**

Rozšíriť ScheduledPost o **format-specific fields:**

```
ScheduledPost rozšírenie:
├── contentFormat: String     # "carousel", "reel_script", "thread", "story_sequence"
├── formatData: Json          # Format-specific data:
│   ├── carousel: { slides: [{ text, imagePrompt }] }
│   ├── reel_script: { hook, scenes: [{ action, text, duration }], cta }
│   ├── thread: { tweets: [{ text, hasImage }] }
│   └── story_sequence: { slides: [{ type, text, interactive }] }

AI generuje format-aware obsah:
"Generate an Instagram CAROUSEL post (5 slides):
Slide 1: Hook — attention-grabbing statement or question
Slide 2-4: Value — one key insight per slide
Slide 5: CTA — follow for more / save this / link in bio

Each slide: max 150 characters, bold first line.
Instagram shows unseen slides again = multiple chances for engagement."
```

**Dopad:** Namiesto plain text postov → štruktúrované multi-format obsahu ktorý využíva najlepšie formáty každej platformy (carousel 2.5x reach na Instagram, thread 2.5x na Twitter).

### 3.5 PRIORITA 4: UX Zjednotenie nastavení

#### Nová štruktúra nastavení (navrhovaná)

**Súčasný stav:** 4 roztrúsené stránky, niektoré nastavenia sa opakujú.

**Navrhovaný stav:** 3 jasné sekcie

```
📋 BRAND SETUP (jednorazové)
├── Brand Name, Description
├── Brand Voice (instructions + knowledge)
├── Visual Identity (creative preferences - AKO FUNGUJE)
├── Target Audience (audience profile)
├── Content Pillars (3-5 hlavných tém)
├── SEO Keywords (primary + long-tail)
└── Products Catalog (existujúce)

⚙️ STRATEGY (per-platform)
├── Connected Platforms (existujúce)
├── Per-Platform Config:
│   ├── Frequency (posts/day per type)
│   ├── Content Mix (pillar distribution)
│   ├── Funnel Mix (TOFU/MOFU/BOFU %)
│   ├── Tone Override
│   ├── Hashtag Strategy + Custom Hashtags
│   └── Best Times (AI-suggested, user-adjustable)
├── RSS Intelligence (existujúce)
└── Competitive Intelligence (NOVÉ)

🤖 AUTOPILOT (runtime)
├── On/Off Toggle
├── Approval Mode
├── Plan Duration
├── Generation Settings (language, safety level)
└── Performance Dashboard
    ├── RL Learning Status (10 dimenzií)
    ├── Content Pillar Performance
    ├── Engagement Prediction Accuracy
    └── A/B Test Results
```

### 3.6 METRIKY ÚSPECHU (KPIs pre vylepšený systém)

| Metrika | Súčasný stav | Cieľ po vylepšení | Ako merať |
|---------|-------------|-------------------|-----------|
| Engagement Rate | Nemerané centrálne | +40% za 3 mesiace | RL tracking per platform |
| Reach per Post | Nemerané | +60% za 3 mesiace | Social SEO + Hook optimization |
| Content Consistency | Nemerané | Brand voice score > 8/10 | Brand Voice Checker |
| Click-through Rate | UTM tracking | +50% | Funnel-aware CTA optimization |
| Time to Create 30-day Plan | ~2 min | ~30 sec (s piliermi) | Autopilot + pillars |
| Content Variety Score | 3 dimenzie RL | 10 dimenzií RL | Extended RL engine |
| Cross-platform Efficiency | 1 post = 1 platform | 1 post → 5 platforiem | Repurposing engine |

---

## ČASŤ 4: IMPLEMENTAČNÝ ROADMAP

### Fáza 1: Quick Wins (1-2 týždne)
1. ✅ Integrovať `creativePreferences` do AI promptu
2. ✅ Integrovať `algorithmConfig` trendy do AI promptu
3. ✅ Vyčistiť deprecated DB fields
4. ✅ Zjednotiť frequency nastavenia (odstrániť duplicitu)
5. ✅ Safety Level → preset pre Max Posts/Day

### Fáza 2: Základné systémy (3-4 týždne)
1. 🔧 Social SEO Engine (keywords v captions, alt text, platformový SEO)
2. 🔧 Content Pillars model + integrácia do Autopilot
3. 🔧 Hook Generator (2-pass content generation)
4. 🔧 Rozšíriť RL na 7 dimenzií (hook, pillar, keyword, length)

### Fáza 3: Pokročilé systémy (4-6 týždňov)
1. 🔧 Content Repurposing Engine
2. 🔧 Brand Voice Consistency Checker
3. 🔧 Funnel-Aware Content Strategy
4. 🔧 Engagement Score Prediction
5. 🔧 Multi-Format Content (carousel, thread, reel_script)

### Fáza 4: Diferenciácia (6-8 týždňov)
1. 🔧 Competitive Intelligence Module
2. 🔧 Calendar Intelligence (events, seasons)
3. 🔧 UX zjednotenie nastavení
4. 🔧 Full 10-dimension RL engine

---

## ČASŤ 5: ZÁVER A ZHRNUTIE

### Čo Grothi robí VÝBORNE:
1. **AI content generation** je na profesionálnej úrovni (12-vrstvový prompt)
2. **Platform algorithm knowledge base** je najkomplexnejšia aká existuje v open-source
3. **Audience profiling** (30+ polí) je hlbšie ako väčšina enterprise nástrojov
4. **RL engine** (Thompson Sampling) je unikátna funkcia — žiadny konkurent v tejto cenovej kategórii
5. **Per-platform strategy** s overrides je dobre navrhnutý

### Čo Grothi MUSÍ opraviť:
1. **Creative preferences** sa nepoužívajú v AI — mŕtva funkcia
2. **Trend data** z Hype Radar sa ignorujú
3. **Redundantné nastavenia** mätú userov (frequency, safety, image prefs)
4. **Deprecated fields** zanášajú schému

### Čo Grothi MUSÍ pridať pre extrémne výsledky:
1. **Social SEO Engine** — #1 priorita, algoritmy 2026 odmeňujú keywords
2. **Content Pillars** — základ profesionálnej content stratégie
3. **Hook Optimizer** — prvé 3 sekundy = 80% úspechu
4. **Funnel-Aware Content** — systematická konverzia followers → customers
5. **Extended RL (10 dimenzií)** — 10x lepšie self-learning
6. **Content Repurposing** — 1 post → 5 platforiem
7. **Brand Voice Checker** — konzistentnosť = dôvera

### Výsledok po implementácii:
Grothi sa zmení z **"AI content schedulera"** na **"AI Social Media Growth Engine"** ktorý:
- Automaticky optimalizuje 10 dimenzií obsahu cez RL
- Vytvára SEO-optimalizovaný obsah pre social search
- Generuje format-natívny obsah (carousely, thready, reel scripty)
- Systematicky konvertuje followers na customers cez funnel strategy
- Udržiava konzistentný brand voice naprieč všetkými platformami
- Repurposuje 1 obsah na 5+ platforiem
- Predpovedá engagement pred publikovaním

**Toto by Grothi urobilo extrémne cenným pre firmy a influencerov — nie len ďalší scheduler, ale skutočný AI growth partner.**

---

## ZDROJE (Expertné zdroje použité v analýze)

- [Hootsuite - Instagram Algorithm 2026](https://blog.hootsuite.com/instagram-algorithm/)
- [Buffer - TikTok Algorithm Guide 2026](https://buffer.com/resources/tiktok-algorithm/)
- [Sprout Social - LinkedIn Algorithm 2026](https://sproutsocial.com/insights/linkedin-algorithm/)
- [StoryChief - Social Media Algorithms 2026](https://storychief.io/blog/social-media-algorithms-2026)
- [Metricool - Social Media SEO 2026](https://metricool.com/social-media-seo/)
- [Metricool - AI in Social Media 2026](https://metricool.com/ai-social-media-marketing/)
- [Sprout Social - Social Media Lead Generation](https://sproutsocial.com/insights/social-media-lead-generation/)
- [SocialPilot - Lead Generation Guide 2026](https://www.socialpilot.co/blog/social-media-lead-generation)
- [FeedHive - Maximizing Organic Reach 2025](https://www.feedhive.com/blog/the-evolution-of-social-media-algorithms-strategies-for-maximizing-organic-reach-in-2025)
- [Averi AI - AI Content Framework](https://www.averi.ai/breakdowns/mastering-ai-content-creation-a-step-by-step-framework-for-high-quality-output-at-scale)
- [StoryChief - AI Content Strategy 2026](https://storychief.io/blog/ai-content-strategy)
- [Enrichlabs - AI Content Marketing 2026](https://www.enrichlabs.ai/blog/ai-content-marketing-strategy)
- [Dive Media - Social SEO Keywords vs Hashtags 2026](https://www.divemedia.com.au/marketing-tips-and-insights/social-seo-keywords-vs-hashtags)
- [Digital Brand Expressions - Social SEO 2026](https://www.digitalbrandexpressions.com/2026/02/24/social-seo-in-2026-why-it-matters-how-to-implement-it/)
- [Aampe - RL vs A/B Testing](https://aampe.com/blog/reinforcement-learning-is-about-to-eat-a-b-testing-for-lunch)
- [arXiv - RL-LLM-AB Framework](https://arxiv.org/abs/2506.06316)
- [Buffer - Best Social Media Management Tools 2026](https://buffer.com/resources/best-social-media-management-tools/)
- [Agorapulse - LinkedIn Algorithm 2025-2026](https://www.agorapulse.com/blog/linkedin/linkedin-algorithm-2025/)
