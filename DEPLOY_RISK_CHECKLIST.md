# Deploy Risk Checklist — Production Audit Round 4

## Pre-Deploy

- [ ] All 976 tests pass locally
- [ ] CI pipeline passes (Build & Test workflow)
- [ ] No schema changes — no migration needed
- [ ] Changes are backward compatible

## Changes Deployed

- [ ] `src/app/api/stripe/webhook/route.ts` — refund idempotency
- [ ] `src/lib/encryption.ts` — decrypt validation
- [ ] `src/lib/credits.ts` — rollover fix + `now` variable fix
- [ ] `src/app/api/cron/autonomous-content/route.ts` — variable shadowing
- [ ] `src/lib/validations.ts` — schema bounds
- [ ] `src/app/api/generate/image/route.ts` — credit refund on failure + error sanitization

## Post-Deploy Verification

- [ ] Site responds on grothi.com (HTTP 200)
- [ ] Sign in works for admin account
- [ ] Create a test bot — verify bot creation succeeds
- [ ] Check PM2 logs for startup errors: `pm2 logs grothi --lines 50`
- [ ] Verify cron jobs running: check for `[process-posts]` log entries
- [ ] Verify no `[credits] FIFO ledger deduction failed` errors in recent logs
- [ ] Verify no `[cron-lock] CronLock table not found` warnings

## Rollback Plan

If issues are found after deploy:
```bash
cd /home/acechange-bot/grothi
git log --oneline -5           # Find the commit before this PR
git reset --hard <commit>      # Revert to previous state
npm install && ./node_modules/.bin/prisma generate && npm run build
pm2 restart grothi
```

The deploy.sh script also keeps `.next-old` for automatic rollback if the health check fails.

## Monitoring (First 24 Hours)

- Watch Stripe webhook logs for any duplicate refund processing
- Monitor credit balance consistency: run admin reconciliation if suspicious
- Check AI image generation success rate (refund errors should now appear in logs)
- Verify autopilot content generation still works (no regression from `seoKeywords` rename)
