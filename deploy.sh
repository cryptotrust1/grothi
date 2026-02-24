#!/bin/bash
# Grothi.com Deploy Script
# Run this on the server: bash deploy.sh
#
# Exit codes:
#   0 = success
#   1 = critical failure (git, npm install, prisma, build, pm2)

echo "========================================="
echo "  Grothi.com Deployment Script"
echo "  Started: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo "========================================="

ERRORS=0

fail() {
  echo "FATAL: $1"
  echo "========================================="
  echo "  DEPLOYMENT FAILED"
  echo "========================================="
  exit 1
}

warn() {
  echo "WARN: $1"
  ERRORS=$((ERRORS + 1))
}

# ── Locate project directory ──────────────────────────────────

GROTHI_DIR="$(pwd)"
if [ ! -f "$GROTHI_DIR/package.json" ]; then
  for dir in /home/acechange-bot/grothi /root/grothi; do
    if [ -d "$dir" ] && [ -f "$dir/package.json" ]; then
      GROTHI_DIR="$dir"
      break
    fi
  done
fi

if [ ! -f "$GROTHI_DIR/package.json" ]; then
  fail "Cannot find grothi project. Run from: cd /home/acechange-bot/grothi && bash deploy.sh"
fi

cd "$GROTHI_DIR"
echo "Working in: $GROTHI_DIR"

# ── Step 1/11: Backup .env ────────────────────────────────────

echo ""
echo "[1/11] Backing up .env..."
if [ -f ".env" ]; then
  bash server/backup-env.sh 2>/dev/null || warn ".env backup failed (non-critical)"
else
  echo "  No .env file found, skipping backup."
fi

# ── Step 2/11: Pull latest code ───────────────────────────────

echo ""
echo "[2/11] Pulling latest code..."
git fetch origin main || fail "git fetch failed. Check network/SSH keys."
git reset --hard origin/main || fail "git reset failed. Check git status manually."
# Remove stale untracked files in src/ (prevents build errors from orphaned pages)
git clean -fd src/ 2>/dev/null
# Remove stale type cache (tsconfig includes .next/types which persists across builds)
rm -rf .next/types 2>/dev/null
echo "  Git: $(git log --oneline -1)"

# ── Step 3/11: Install dependencies ───────────────────────────

echo ""
echo "[3/11] Installing dependencies..."
npm install --production=false 2>&1 | tail -5
if [ ${PIPESTATUS[0]} -ne 0 ]; then
  fail "npm install failed. Check disk space and network."
fi

# ── Step 4/11: Fix PostgreSQL permissions ─────────────────────

echo ""
echo "[4/11] Fixing PostgreSQL permissions..."
sudo -u postgres psql -c "ALTER USER grothi CREATEDB;" 2>/dev/null \
  || warn "Could not alter postgres user (may already have permission)"

# ── Step 5/11: Prisma generate + migrate ──────────────────────

echo ""
echo "[5/11] Running Prisma generate..."
./node_modules/.bin/prisma generate || fail "Prisma generate failed. Check schema.prisma for errors."

echo ""
echo "[6/11] Running Prisma migrations..."
MIGRATE_OUTPUT=$(./node_modules/.bin/prisma migrate deploy 2>&1)
MIGRATE_EXIT=$?
echo "$MIGRATE_OUTPUT"

if [ $MIGRATE_EXIT -ne 0 ]; then
  # Check for P3009 (failed migration stuck in history) — resolve and retry
  FAILED_MIGRATION=$(echo "$MIGRATE_OUTPUT" | grep -oP 'The `\K[^`]+' | head -1)
  if [ -n "$FAILED_MIGRATION" ]; then
    echo "  Resolving stuck migration: $FAILED_MIGRATION"
    ./node_modules/.bin/prisma migrate resolve --applied "$FAILED_MIGRATION" 2>&1
    echo "  Retrying migrate deploy..."
    ./node_modules/.bin/prisma migrate deploy 2>&1 || {
      echo "  migrate deploy still failing, trying db push..."
      ./node_modules/.bin/prisma db push 2>&1 || fail "Both prisma migrate deploy and db push failed. Fix schema manually."
    }
  else
    echo "  migrate deploy failed, trying db push..."
    ./node_modules/.bin/prisma db push 2>&1 || fail "Both prisma migrate deploy and db push failed. Fix schema manually."
  fi
fi

# ── Step 7/11: Seed database ──────────────────────────────────

echo ""
echo "[7/11] Seeding database..."
./node_modules/.bin/tsx prisma/seed.ts 2>&1 || warn "Seed failed (may already be seeded)"

# ── Step 8/11: Build Next.js ──────────────────────────────────

echo ""
echo "[8/11] Building Next.js..."

# Clean stale build artifacts
rm -rf .next-build

# Build to temporary directory for zero-downtime swap
NEXT_BUILD_DIR=.next-build npm run build
BUILD_EXIT=$?

if [ $BUILD_EXIT -ne 0 ]; then
  rm -rf .next-build
  fail "Next.js build failed (exit code $BUILD_EXIT). Fix build errors before deploying."
fi

if [ ! -d ".next-build" ]; then
  fail "Build completed but .next-build directory not found. Check next.config.js distDir setting."
fi

echo "  Build successful."

# ── Step 9/11: Swap build + restart PM2 ───────────────────────

echo ""
echo "[9/11] Swapping build directories and restarting PM2..."

# Atomic swap: old → backup, new → active
rm -rf .next-old
if [ -d .next ]; then
  mv .next .next-old
fi
mv .next-build .next

# Restart PM2
if pm2 describe grothi > /dev/null 2>&1; then
  pm2 restart grothi --update-env || fail "PM2 restart failed."
else
  pm2 start npm --name grothi -- start || fail "PM2 start failed."
fi
pm2 save 2>/dev/null

# Cleanup old build
rm -rf .next-old

echo "  PM2 restarted."

# ── Step 10/11: Update Nginx config ───────────────────────────

echo ""
echo "[10/11] Updating Nginx media config..."
if [ -f server/nginx-media-direct.conf ]; then
  if sudo cp server/nginx-media-direct.conf /etc/nginx/sites-available/grothi-media-direct 2>/dev/null \
    && sudo ln -sf /etc/nginx/sites-available/grothi-media-direct /etc/nginx/sites-enabled/ 2>/dev/null \
    && sudo nginx -t 2>&1 \
    && sudo systemctl reload nginx 2>&1; then
    echo "  Nginx media config updated and reloaded."
  else
    warn "Nginx media config update failed. Update manually."
  fi
else
  echo "  server/nginx-media-direct.conf not found, skipping."
fi

# ── Step 11/11: Setup cron jobs ───────────────────────────────

echo ""
echo "[11/11] Setting up cron jobs..."
bash server/setup-cron.sh 2>&1 || warn "Cron setup failed. Run manually: bash server/setup-cron.sh"

# ── Health check ──────────────────────────────────────────────

echo ""
echo "Running health check..."
sleep 3

HEALTH_OK=false
for i in 1 2 3; do
  HTTP_CODE=$(curl -sf -o /dev/null -w "%{http_code}" --max-time 10 http://localhost:3000/ 2>/dev/null)
  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "302" ] || [ "$HTTP_CODE" = "307" ]; then
    HEALTH_OK=true
    echo "  Health check passed (HTTP $HTTP_CODE) on attempt $i"
    break
  fi
  echo "  Attempt $i: HTTP $HTTP_CODE - waiting 5s..."
  sleep 5
done

if [ "$HEALTH_OK" = false ]; then
  warn "Health check failed - app may not be responding on port 3000. Check: pm2 logs grothi"
fi

# ── Summary ───────────────────────────────────────────────────

echo ""
echo "========================================="
if [ $ERRORS -gt 0 ]; then
  echo "  DEPLOYMENT COMPLETE with $ERRORS warning(s)"
else
  echo "  DEPLOYMENT COMPLETE (all steps passed)"
fi
echo "  grothi.com should be live now"
echo "  Finished: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo "========================================="
echo ""
pm2 status grothi 2>/dev/null || true
