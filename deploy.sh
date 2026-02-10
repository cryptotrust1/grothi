#!/bin/bash
# Grothi.com Deploy Script
# Run this on the server: bash deploy.sh
set -e

echo "========================================="
echo "  Grothi.com Deployment Script"
echo "========================================="

# Find grothi directory
GROTHI_DIR=""
for dir in /home/user/grothi /root/grothi /home/grothi /home/acechange-bot/grothi; do
  if [ -d "$dir" ] && [ -f "$dir/package.json" ]; then
    GROTHI_DIR="$dir"
    break
  fi
done

if [ -z "$GROTHI_DIR" ]; then
  echo "ERROR: Cannot find grothi directory. Where did you clone it?"
  echo "Usage: cd /path/to/grothi && bash deploy.sh"
  exit 1
fi

cd "$GROTHI_DIR"
echo "[1/7] Working in: $GROTHI_DIR"

# Step 1: Pull latest code
echo ""
echo "[2/7] Pulling latest code..."
git pull origin main || { echo "WARN: git pull failed, continuing with current code"; }

# Step 2: Install deps (in case package.json changed)
echo ""
echo "[3/7] Installing dependencies..."
npm install 2>&1 | tail -3

# Step 3: Fix PostgreSQL permissions
echo ""
echo "[4/7] Fixing PostgreSQL permissions..."
sudo -u postgres psql -c "ALTER USER grothi CREATEDB;" 2>&1 || echo "WARN: Could not alter user (may already have permission)"

# Step 4: Generate Prisma client + run migrations
echo ""
echo "[5/7] Running Prisma migrations..."
./node_modules/.bin/prisma generate
./node_modules/.bin/prisma migrate dev --name init 2>&1 || {
  echo "migrate dev failed, trying migrate deploy..."
  ./node_modules/.bin/prisma migrate deploy 2>&1
}

# Step 5: Seed the database
echo ""
echo "[6/7] Seeding database..."
npx tsx prisma/seed.ts 2>&1 || echo "WARN: Seed failed (may already be seeded)"

# Step 6: Build Next.js
echo ""
echo "[7/7] Building Next.js..."
npm run build

# Step 7: Restart PM2
echo ""
echo "Restarting PM2..."
pm2 restart grothi 2>/dev/null || pm2 start npm --name grothi -- start
pm2 save

echo ""
echo "========================================="
echo "  DEPLOYMENT COMPLETE!"
echo "  grothi.com should be live now"
echo "========================================="
echo ""
pm2 status grothi
