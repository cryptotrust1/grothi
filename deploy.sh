#!/bin/bash
# Grothi.com Deploy Script
# Run this on the server: bash deploy.sh
set -e

echo "========================================="
echo "  Grothi.com Deployment Script"
echo "========================================="

# Use current directory or find grothi
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
  echo "ERROR: Cannot find grothi. Run from: cd /home/acechange-bot/grothi && bash deploy.sh"
  exit 1
fi

cd "$GROTHI_DIR"
echo "Working in: $GROTHI_DIR"

# Step 1: Backup .env before anything else
echo ""
echo "[1/10] Backing up .env..."
bash server/backup-env.sh 2>/dev/null || echo "WARN: .env backup skipped (file may not exist yet)"

# Step 2: Pull latest code
echo ""
echo "[2/10] Pulling latest code..."
git fetch origin main
git reset --hard origin/main || {
  echo "ERROR: git reset failed. Fix manually: git status"
  exit 1
}

# Step 3: Install deps (in case package.json changed)
echo ""
echo "[3/10] Installing dependencies..."
npm install 2>&1 | tail -3

# Step 4: Fix PostgreSQL permissions
echo ""
echo "[4/10] Fixing PostgreSQL permissions..."
sudo -u postgres psql -c "ALTER USER grothi CREATEDB;" 2>&1 || echo "WARN: Could not alter user (may already have permission)"

# Step 5: Generate Prisma client + run migrations
echo ""
echo "[5/10] Running Prisma migrations..."
./node_modules/.bin/prisma generate
./node_modules/.bin/prisma db push --accept-data-loss 2>&1 || {
  echo "WARN: db push had issues, trying migrate dev..."
  ./node_modules/.bin/prisma migrate dev --name auto 2>&1 || echo "WARN: Migration had issues"
}

# Step 6: Seed the database
echo ""
echo "[6/10] Seeding database..."
./node_modules/.bin/tsx prisma/seed.ts 2>&1 || echo "WARN: Seed failed (may already be seeded)"

# Step 7: Build Next.js (zero-downtime: build to temp dir, then swap)
echo ""
echo "[7/10] Building Next.js..."
echo "Building to temporary directory (.next-build) for zero-downtime deploy..."
NEXT_BUILD_DIR=.next-build npm run build

# Step 8: Swap build directories (atomic swap, ~1 second downtime)
echo ""
echo "[8/10] Swapping build directories..."
rm -rf .next-old
if [ -d .next ]; then
  mv .next .next-old
fi
mv .next-build .next
echo "Build swap complete."

# Step 9: Restart PM2
echo ""
echo "[9/10] Restarting PM2..."
pm2 restart grothi --update-env 2>/dev/null || pm2 start npm --name grothi -- start
pm2 save

# Cleanup old build
rm -rf .next-old

# Step 10: Update Nginx media direct config (for Instagram/Meta media serving)
echo ""
echo "[10/11] Updating Nginx media direct config..."
if [ -f server/nginx-media-direct.conf ]; then
  sudo cp server/nginx-media-direct.conf /etc/nginx/sites-available/grothi-media-direct 2>/dev/null && \
  sudo ln -sf /etc/nginx/sites-available/grothi-media-direct /etc/nginx/sites-enabled/ 2>/dev/null && \
  sudo nginx -t 2>&1 && sudo systemctl reload nginx 2>&1 && \
  echo "Nginx media config updated and reloaded." || \
  echo "WARN: Nginx media config update failed. Update manually: sudo cp server/nginx-media-direct.conf /etc/nginx/sites-available/grothi-media-direct && sudo nginx -t && sudo systemctl reload nginx"
else
  echo "WARN: server/nginx-media-direct.conf not found, skipping."
fi

# Step 11: Setup cron jobs (process-posts, collect-engagement, health-check)
echo ""
echo "[11/11] Setting up cron jobs..."
bash server/setup-cron.sh 2>&1 || echo "WARN: Cron setup failed. Run manually: bash server/setup-cron.sh"

echo ""
echo "========================================="
echo "  DEPLOYMENT COMPLETE! (11 steps)"
echo "  grothi.com should be live now"
echo "========================================="
echo ""
pm2 status grothi
