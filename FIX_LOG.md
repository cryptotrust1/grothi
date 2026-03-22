# Fix Log — Production Audit Round 4 (Extended)

## Commit 1: P0/P1 Security & Correctness Fixes

### Fix 1: Refund Webhook Idempotency (P0)
**File**: `src/app/api/stripe/webhook/route.ts`
**Change**: Added duplicate check at top of `handleRefund()` — queries for existing `refund_${paymentIntentId}` transaction before processing.
**Reason**: Stripe retry on `charge.refunded` event would deduct credits twice without this guard.

### Fix 2: Encryption Decrypt Validation (P0)
**File**: `src/lib/encryption.ts`
**Change**: Added format validation for IV (must be 32 hex chars), authTag (must be 32 hex chars), and ciphertext (must be hex if non-empty).
**Reason**: Malformed encrypted data could cause silent buffer allocation errors.

### Fix 3: Rollover Expired Entry Filtering (P0)
**File**: `src/lib/credits.ts`
**Change**: Added `expiresAt` filter to ROLLOVER entry query in `allocateSubscriptionCredits()`.
**Reason**: Expired ROLLOVER credits were being re-added to next period's rollover calculation.

### Fix 4: Variable Shadowing Fix (P0 — Build)
**File**: `src/app/api/cron/autonomous-content/route.ts`
**Change**: Renamed second `keywords` variable to `seoKeywords` and updated 2 usage references.
**Reason**: Variable shadowing caused SWC compiler warning during build.

### Fix 5: Platform Credentials Schema Bounds (P1)
**File**: `src/lib/validations.ts`
**Change**: Added `.max(4000)` per credential value and max 20 fields via `.refine()`.
**Reason**: Unbounded `z.record(z.string())` allowed arbitrary credential sizes.

### Fix 6: Email HTML Content Bounds (P1)
**File**: `src/lib/validations.ts`
**Change**: Added `.max(1_000_000)` to `htmlContent` in both `emailCampaignSchema` and `emailAutomationStepSchema`. Added `.max(500_000)` to `textContent`.
**Reason**: Unbounded HTML/text content could cause DB bloat or OOM.

## Commit 2: Rollover Bug Fix + AI Refund + Error Sanitization

### Fix 7: Undefined `now` Variable in Rollover (P0)
**File**: `src/lib/credits.ts`
**Change**: Moved `const now = new Date()` from line 406 to top of transaction scope (line 296), removed duplicate declaration.
**Reason**: `now` was referenced at line 326 (in ROLLOVER expiry filter) but not declared until line 406. Would cause ReferenceError at runtime when rollover is enabled.

### Fix 8: Image Generation Credit Refund on Failure (P1)
**File**: `src/app/api/generate/image/route.ts`
**Change**: Added `addCredits(REFUND)` calls in:
- Replicate API error catch block
- Image download timeout/abort handler
- Image download HTTP error path
- No output from Replicate path
- Invalid URL from Replicate path
- Outer catch block (unexpected errors)
**Reason**: Credits were deducted before generation but never refunded when generation/download failed.

### Fix 9: API Error Message Sanitization (P1)
**File**: `src/app/api/generate/image/route.ts`
**Change**: Replaced `Error: ${apiMsg}` in user-facing error responses with generic messages. Raw API errors only logged server-side.
**Reason**: Replicate API auth/billing error messages could leak internal configuration details.

## Tests Added

**File**: `tests/unit/production-audit-round4.test.ts` (15 tests)
- 7 tests for encryption decrypt validation
- 6 tests for validation schema bounds
- 1 test for credit module structure
- 1 test for webhook route structure

## Verification

All 976 tests pass (961 existing + 15 new).
