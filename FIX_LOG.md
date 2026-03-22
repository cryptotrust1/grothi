# Fix Log — Production Audit Round 4

## Fixes Applied

### 1. Refund Webhook Idempotency (P0)
**File**: `src/app/api/stripe/webhook/route.ts`
**Change**: Added duplicate check at top of `handleRefund()` — queries for existing `refund_${paymentIntentId}` transaction before processing.
**Reason**: Without this check, Stripe retry on `charge.refunded` event would deduct credits twice.

### 2. Encryption Decrypt Validation (P0)
**File**: `src/lib/encryption.ts`
**Change**: Added format validation for IV (must be 32 hex chars), authTag (must be 32 hex chars), and ciphertext (must be hex).
**Reason**: Malformed encrypted data could cause silent buffer allocation errors or incorrect decryption.

### 3. Rollover Expired Entry Filtering (P0)
**File**: `src/lib/credits.ts`
**Change**: Added `expiresAt` filter to ROLLOVER entry query in `allocateSubscriptionCredits()` — only non-expired entries are counted toward rollover.
**Reason**: Expired ROLLOVER credits were being re-added to the next period's rollover calculation.

### 4. Variable Shadowing Fix (P0 — Build)
**File**: `src/app/api/cron/autonomous-content/route.ts`
**Change**: Renamed second `keywords` variable (line 725) to `seoKeywords` and updated its 2 usage references.
**Reason**: Variable shadowing caused SWC compiler warning during build.

### 5. Platform Credentials Schema Bounds (P1)
**File**: `src/lib/validations.ts`
**Change**: Added `.max(4000)` per credential value and max 20 fields via `.refine()`.
**Reason**: Unbounded `z.record(z.string())` allowed arbitrary credential sizes.

### 6. Email HTML Content Bounds (P1)
**File**: `src/lib/validations.ts`
**Change**: Added `.max(1_000_000)` to `htmlContent` in both `emailCampaignSchema` and `emailAutomationStepSchema`. Added `.max(500_000)` to `textContent`.
**Reason**: Unbounded HTML/text content could cause DB bloat or OOM.

## Tests Added

**File**: `tests/unit/production-audit-round4.test.ts` (15 tests)
- 7 tests for encryption decrypt validation (IV, authTag, ciphertext format)
- 6 tests for validation schema bounds (credentials, email HTML)
- 1 test for credit module structure
- 1 test for webhook route structure
