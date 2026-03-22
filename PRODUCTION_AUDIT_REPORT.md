# Production Audit Report — Grothi.com

**Date**: 2026-03-22
**Auditor**: Claude (automated full-system audit)
**Scope**: End-to-end production readiness audit covering auth, billing, cron, encryption, validation, media, and platform integrations.

---

## Executive Summary

The Grothi.com codebase is broadly well-architected with strong security practices including JWT+DB session validation, AES-256-GCM encryption, bcrypt hashing, and atomic credit deduction via Serializable transactions. The audit identified **4 P0 issues** (fixed), **4 P1 issues** (fixed), and documented remaining risks that need monitoring.

**All fixes verified**: 976 tests pass (961 existing + 15 new hardening tests).

---

## Risk Register

### P0 — Critical (Fixed)

| # | Issue | Root Cause | Fix |
|---|-------|-----------|-----|
| 1 | **Refund webhook not idempotent** — duplicate `charge.refunded` events could deduct credits twice | No check for existing `refund_` transaction before processing | Added idempotency check at top of `handleRefund()` |
| 2 | **Encryption decrypt accepts malformed data** — invalid IV/authTag hex or lengths silently accepted | No format validation on split parts | Added regex+length validation for IV (32 hex), authTag (32 hex), and ciphertext (hex) |
| 3 | **Rollover includes expired entries** — expired ROLLOVER ledger entries counted in next period rollover | Missing `expiresAt` filter in ROLLOVER query | Added `OR: [expiresAt: null, expiresAt: { gt: now }]` filter |
| 4 | **Variable shadowing in autonomous-content** — `keywords` declared twice (line 408 and 725) causing SWC build warning | Copy-paste oversight in SEO keyword section | Renamed second variable to `seoKeywords` |

### P1 — High (Fixed)

| # | Issue | Root Cause | Fix |
|---|-------|-----------|-----|
| 5 | **Platform credentials schema unbounded** — `z.record(z.string())` allows unlimited credential fields of unlimited length | Missing max constraints | Added `.max(4000)` per value, max 20 fields |
| 6 | **Email campaign HTML unbounded** — `htmlContent` schema has no max length | Missing max constraint | Added `.max(1_000_000)` to campaign and automation step schemas |
| 7 | **Email text content unbounded** — `textContent` had no max length | Missing max constraint | Added `.max(500_000)` |
| 8 | **Automation step HTML unbounded** — Same as campaign issue | Missing max constraint | Fixed in `emailAutomationStepSchema` |

### P2 — Medium (Documented, Not Fixed)

| # | Issue | Risk | Recommendation |
|---|-------|------|---------------|
| 1 | FIFO ledger deduction is non-critical path | Ledger/balance divergence if table doesn't exist | Monitor for `[credits] FIFO ledger deduction failed` logs |
| 2 | In-memory rate limiting in PM2 cluster mode | Rate limits multiplied by process count | Ensure production uses Redis-backed rate limiting |
| 3 | Welcome bonus given before email verification | Account farming for free credits | Add email verification requirement before bonus |
| 4 | Cron lock release error silently swallowed | Potential lock leak blocking future cron runs | Add alerting for lock release failures |
| 5 | Stuck post recovery threshold (3 min) < max API timeout (5 min) | Posts marked FAILED while still publishing | Increase threshold to 8 minutes |
| 6 | Expired credits not removed in real-time | User sees available credits that can't be spent | Check expiration in `deductCredits()` |
| 7 | Legacy purchase path trusts metadata credits | Credit forgery if pack lookup fails | Remove legacy path or add pack validation |

---

## Verified Good

| Area | Finding |
|------|---------|
| **JWT Security** | HS256 algorithm explicitly set, dual validation (JWT signature + DB session lookup), 30-day expiry |
| **Password Hashing** | bcrypt with 12 salt rounds, timing-safe comparison |
| **Cookie Security** | httpOnly, secure, sameSite:lax, path:/ |
| **Admin Authorization** | `requireAdmin()` checks role on all admin endpoints |
| **IDOR Prevention** | Bot/post ownership verified via userId before access |
| **Stripe Webhook Signature** | `constructEvent()` validates signature before processing |
| **Credit Deduction Atomicity** | Serializable transaction with `updateMany` guard (balance >= amount) |
| **File Upload Validation** | Magic bytes validation, SVG blocked, path traversal checks |
| **2FA Implementation** | TOTP with window=1, recovery codes hashed with bcrypt, removed after use |
| **Rate Limiting** | Applied to signin (10/15min), signup (5/hr), 2FA verify (5/15min), checkout |
| **Cron Secret** | Timing-safe comparison using SHA256 hashing |
| **Tenant Isolation** | All API routes verify bot.userId matches authenticated user |

---

## Test Evidence

- **Before fixes**: 961 tests passing, 26 suites
- **After fixes**: 976 tests passing, 27 suites
- **New tests added**: 15 (covering decrypt validation, schema bounds, credential limits)
- **Build**: Blocked by Google Fonts fetch in sandbox (documented known issue, works on server)
- **Prisma validation**: Schema valid

---

## Remaining Risks & Post-Deploy Monitoring

1. **Monitor logs for**: `[credits] FIFO ledger deduction failed` — indicates CreditLedger table migration needed
2. **Monitor logs for**: `[cron-lock] CronLock table not found` — indicates missing migration
3. **Monitor Stripe dashboard**: Watch for duplicate refund events to verify idempotency fix
4. **Rate limiting**: Verify Redis is configured in production (check `REDIS_URL` env var)
5. **Cron overlap**: Check PM2 logs for `[cron-lock] Skipping ... previous instance still running` patterns
6. **Credit balance reconciliation**: Run `reconcileBalance()` for active users after deploy to verify ledger consistency

---

## Deployment Considerations

- **Rollback safe**: All fixes are backward compatible, no schema changes required
- **No migration needed**: Fixes are code-level only
- **Deploy order**: Standard `git pull && npm install && prisma generate && build && pm2 restart`
