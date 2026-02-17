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
echo "[1/8] Backing up .env..."
bash server/backup-env.sh 2>/dev/null || echo "WARN: .env backup skipped (file may not exist yet)"

# Step 2: Pull latest code
echo ""
echo "[2/8] Pulling latest code..."
git fetch origin main
git reset --hard origin/main || {
  echo "ERROR: git reset failed. Fix manually: git status"
  exit 1
}

# Step 2: Install deps (in case package.json changed)
echo ""
echo "[3/8] Installing dependencies..."
npm install 2>&1 | tail -3

# Step 3: Fix PostgreSQL permissions
echo ""
echo "[4/8] Fixing PostgreSQL permissions..."
sudo -u postgres psql -c "ALTER USER grothi CREATEDB;" 2>&1 || echo "WARN: Could not alter user (may already have permission)"

# Step 4: Generate Prisma client + run migrations
echo ""
echo "[5/8] Running Prisma migrations..."
./node_modules/.bin/prisma generate
./node_modules/.bin/prisma migrate deploy 2>&1 || {
  echo "WARN: migrate deploy had issues (may already be in sync)"
}

# Step 5: Seed the database
echo ""
echo "[6/8] Seeding database..."
./node_modules/.bin/tsx prisma/seed.ts 2>&1 || echo "WARN: Seed failed (may already be seeded)"

# Step 6: Build Next.js (clean old chunks first to prevent ChunkLoadError)
echo ""
echo "[7/8] Building Next.js..."
echo "Cleaning old build artifacts..."
rm -rf .next
npm run build

# Step 7: Restart PM2
echo ""
echo "[8/9] Restarting PM2..."
pm2 restart grothi --update-env 2>/dev/null || pm2 start npm --name grothi -- start
pm2 save

# Step 8: Setup cron jobs (process-posts, collect-engagement, health-check)
echo ""
echo "[9/9] Setting up cron jobs..."
bash server/setup-cron.sh 2>&1 || echo "WARN: Cron setup failed. Run manually: bash server/setup-cron.sh"

echo ""
echo "========================================="
echo "  DEPLOYMENT COMPLETE!"
echo "  grothi.com should be live now"
echo "========================================="
echo ""
pm2 status grothi
