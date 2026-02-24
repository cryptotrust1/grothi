# Product Catalog Feature - Implementation Plan

## Goal

Users can create a **Product/Service catalog** per bot with rich marketing data. When creating a post, user selects a product — the AI then receives full product context to generate highly targeted social media content that sells.

---

## 1. Database Schema Changes

### New Model: `Product`

```prisma
model Product {
  id             String   @id @default(cuid())
  botId          String
  name           String                      // Product/service name
  description    String   @db.Text           // Full description
  brand          String?                     // Brand name (optional)
  category       String?                     // Category (e.g. "Software", "Clothing")
  price          String?                     // Price as text ("29.99 EUR", "from $15/mo")
  url            String?                     // Product page link
  advantages     String   @db.Text           // Benefits, USPs, pros
  targetAudience String   @db.Text           // Demographics, who buys this
  buyingReasons  String   @db.Text           // Why people should buy
  aiInstructions String?  @db.Text           // How user wants AI to present it
  keywords       String[]                    // Tags/keywords for AI context
  isActive       Boolean  @default(true)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  bot            Bot             @relation(fields: [botId], references: [id], onDelete: Cascade)
  productMedia   ProductMedia[]
  scheduledPosts ScheduledPost[]

  @@index([botId])
}
```

### New Model: `ProductMedia` (junction — many products ↔ many media)

```prisma
model ProductMedia {
  id        String  @id @default(cuid())
  productId String
  mediaId   String
  sortOrder Int     @default(0)
  isPrimary Boolean @default(false)

  product   Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  media     Media   @relation(fields: [mediaId], references: [id], onDelete: Cascade)

  @@unique([productId, mediaId])
  @@index([productId])
  @@index([mediaId])
}
```

### Modified Models

**ScheduledPost** — add optional product reference:
```
+ productId  String?
+ product    Product?  @relation(fields: [productId], references: [id], onDelete: SetNull)
```

**Bot** — add relation:
```
+ products   Product[]
```

**Media** — add relation:
```
+ productMedia  ProductMedia[]
```

---

## 2. Navigation

Add **"Products"** tab to `BOT_NAV_TABS` in `src/lib/constants.ts`, after "Media":

```typescript
{ key: 'products', label: 'Products', path: '/products' },
```

Update tab count in test: 11 → 12.

---

## 3. New Pages

### 3a. Products List — `/dashboard/bots/[id]/products/page.tsx`

Server component:
- Grid of product cards (primary image thumbnail, name, category, price, active/inactive badge)
- "Add Product" button → `/products/new`
- Product count displayed
- Delete action (server action, only if no published posts reference it — otherwise archive/deactivate)
- Toggle active/inactive
- Click card → edit page

### 3b. Create Product — `/dashboard/bots/[id]/products/new/page.tsx`

Server component with form:

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Name | text input | Yes | Product/service name |
| Description | textarea | Yes | Full detailed description |
| Brand | text input | No | Brand name |
| Category | text input | No | Product category |
| Price | text input | No | Free-form price text |
| URL | url input | No | Product page link |
| Advantages | textarea | Yes | Benefits, USPs, pros |
| Target Audience | textarea | Yes | Who buys this |
| Buying Reasons | textarea | Yes | Why people should buy |
| AI Instructions | textarea | No | How to present/promote |
| Keywords | text input | No | Comma-separated tags |
| Media | multi-select checkboxes | No | Pick from media library |
| Primary Image | radio within selected | No | Which image is the main thumbnail |

Server action: `handleCreateProduct(formData)` — validates, creates Product + ProductMedia records in transaction.

### 3c. Edit Product — `/dashboard/bots/[id]/products/[productId]/page.tsx`

Same form as create, pre-filled with existing data. Server action `handleUpdateProduct(formData)`. Handles adding/removing media associations.

---

## 4. New Post Integration

### 4a. Product Selector in PostFormClient

In `post-form-client.tsx`, add:
- **Product selector dropdown** above the media selector (similar UX pattern)
- When a product is selected:
  - Show product info card (name, brand, primary image, category, price)
  - Product media appears as suggestions in the media selector
  - "Use Product Info" button → pre-fills content textarea with product details formatted for social media
  - Product context is sent to AI chat assistant

New props for PostFormClient:
```typescript
products: Array<{
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  price: string | null;
  primaryImage: { id: string; filename: string; type: string } | null;
  mediaCount: number;
}>;
```

Hidden form field: `<input type="hidden" name="productId" value={selectedProductId} />`

### 4b. Server Page Data

In `post/page.tsx`, fetch products:
```typescript
const products = await db.product.findMany({
  where: { botId: bot.id, isActive: true },
  include: {
    productMedia: {
      where: { isPrimary: true },
      include: { media: { select: { id: true, filename: true, type: true } } },
      take: 1,
    },
    _count: { select: { productMedia: true } },
  },
  orderBy: { name: 'asc' },
});
```

### 4c. Server Action Update

In `handleCreatePost`:
```typescript
const productId = (formData.get('productId') as string) || null;
if (productId) {
  const product = await db.product.findFirst({ where: { id: productId, botId: id } });
  if (!product) redirect(...error);
}
await db.scheduledPost.create({
  data: { ...existing, productId }
});
```

### 4d. AI Chat Context

In `/api/chat/post-assistant/route.ts`, accept `productId` param. When provided, fetch product and inject into system prompt:

```
PRODUCT TO PROMOTE:
Name: {name}
Brand: {brand}
Category: {category}
Price: {price}
URL: {url}
Description: {description}

KEY ADVANTAGES:
{advantages}

TARGET AUDIENCE:
{targetAudience}

WHY PEOPLE SHOULD BUY:
{buyingReasons}

Keywords: {keywords.join(', ')}

USER'S AI PRESENTATION INSTRUCTIONS:
{aiInstructions}

Create engaging social media content that promotes this product to the
target audience. Highlight the advantages and buying reasons. Include a
CTA if appropriate for the platform.
```

---

## 5. Post List Enhancement

In the post manager list view, show product badge on posts:
- Small product name badge next to platform badges on posts that have `productId`
- Helps user identify product-related posts at a glance

---

## 6. Files to Create/Modify

### New Files (4):
| File | Purpose |
|------|---------|
| `src/app/dashboard/bots/[id]/products/page.tsx` | Products list |
| `src/app/dashboard/bots/[id]/products/new/page.tsx` | Create product form |
| `src/app/dashboard/bots/[id]/products/[productId]/page.tsx` | Edit product |
| `prisma/migrations/.../migration.sql` | Auto-generated by Prisma |

### Modified Files (8):
| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Add Product, ProductMedia; update ScheduledPost, Bot, Media |
| `src/lib/constants.ts` | Add "Products" tab to BOT_NAV_TABS |
| `src/app/dashboard/bots/[id]/post/page.tsx` | Fetch products, pass to client, store productId |
| `src/components/dashboard/post-form-client.tsx` | Add product selector UI + product info card |
| `src/app/api/chat/post-assistant/route.ts` | Accept productId, inject product context into AI |
| `tests/unit/constants.test.ts` | Update tab count 11 → 12 |
| `CLAUDE.md` | Document Product feature |
| `src/lib/validations.ts` | Add product validation schema (optional) |

---

## 7. Implementation Order

1. **Schema** — Add Product + ProductMedia models, update relations, generate + migrate
2. **Constants** — Add Products tab to BOT_NAV_TABS
3. **Products list page** — Grid with thumbnails, active/inactive, delete
4. **Create product page** — Full form with media picker
5. **Edit product page** — Pre-filled form with existing data
6. **Post form integration** — Product selector dropdown + product card preview
7. **AI integration** — Product context injection in chat assistant
8. **Post list badges** — Product badge on post cards
9. **Tests + docs** — Update test count, CLAUDE.md
10. **Build verification** — Run tests + TypeScript check

---

## 8. Why This Design Works

**For the user:**
- One place to manage all product info — no re-typing for each post
- Media library reuse — same images/videos across products and posts
- AI gets complete context — generates much better sales content

**For AI effectiveness:**
- **What** to sell (name, description, category, price)
- **Who** to sell to (targetAudience — demographics, persona)
- **Why** they should buy (advantages, buyingReasons — copy-ready USPs)
- **How** to present it (aiInstructions — user's voice and style)
- **Visual assets** (product media auto-suggested for posts)
- **Context** (keywords for hashtags, URL for CTAs, brand for consistency)

**What competitors lack:**
- Most schedulers have NO product catalog — user types product info every post
- Per-product AI instructions — user controls promotion style per product
- RL engine integration — track which products perform best per platform
- Media library reuse — product photos always available without re-uploading
