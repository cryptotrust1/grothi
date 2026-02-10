#!/bin/bash
# Complete server setup for Grothi.com
# Run as root: bash server/setup-server.sh
set -e

GROTHI_DIR="$(cd "$(dirname "$0")/.." && pwd)"
echo "========================================="
echo "  Grothi.com Complete Server Setup"
echo "  Directory: $GROTHI_DIR"
echo "========================================="

# ============================================
# 1. SSL Certificate Setup
# ============================================
echo ""
echo "[1/6] Setting up SSL certificates..."
SSL_DIR="/etc/ssl/grothi.com"
mkdir -p "$SSL_DIR"

if [ ! -f "$SSL_DIR/origin.pem" ]; then
    echo "Generating self-signed SSL certificate..."
    openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
        -keyout "$SSL_DIR/origin-key.pem" \
        -out "$SSL_DIR/origin.pem" \
        -subj "/C=FI/ST=Helsinki/L=Helsinki/O=Grothi/CN=grothi.com" \
        -addext "subjectAltName=DNS:grothi.com,DNS:www.grothi.com" 2>/dev/null
    chmod 600 "$SSL_DIR/origin-key.pem"
    echo "  SSL cert generated at $SSL_DIR"
else
    echo "  SSL cert already exists, skipping"
fi

# ============================================
# 2. Nginx Configuration
# ============================================
echo ""
echo "[2/6] Configuring Nginx..."

# Install Nginx if not present
if ! command -v nginx &> /dev/null; then
    apt-get update -qq && apt-get install -y -qq nginx
fi

# Copy config
cp "$GROTHI_DIR/server/nginx-grothi.conf" /etc/nginx/sites-available/grothi.com
ln -sf /etc/nginx/sites-available/grothi.com /etc/nginx/sites-enabled/grothi.com

# Remove default site if it conflicts
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true

# Test and reload
nginx -t && systemctl reload nginx
echo "  Nginx configured and reloaded"

# ============================================
# 3. PostgreSQL Setup
# ============================================
echo ""
echo "[3/6] Setting up PostgreSQL..."

if ! command -v psql &> /dev/null; then
    apt-get update -qq && apt-get install -y -qq postgresql postgresql-contrib
    systemctl enable postgresql
    systemctl start postgresql
fi

# Create user and database (ignore errors if already exist)
sudo -u postgres psql -c "CREATE USER grothi WITH PASSWORD 'Gr0th1SaaS2026x';" 2>/dev/null || echo "  User grothi already exists"
sudo -u postgres psql -c "CREATE DATABASE grothi OWNER grothi;" 2>/dev/null || echo "  Database grothi already exists"
sudo -u postgres psql -c "ALTER USER grothi CREATEDB;" 2>/dev/null || true
echo "  PostgreSQL ready"

# ============================================
# 4. Redis Setup
# ============================================
echo ""
echo "[4/6] Setting up Redis..."

if ! command -v redis-cli &> /dev/null; then
    apt-get update -qq && apt-get install -y -qq redis-server
    systemctl enable redis-server
fi
systemctl start redis-server 2>/dev/null || true
echo "  Redis ready ($(redis-cli ping 2>/dev/null || echo 'starting...'))"

# ============================================
# 5. Environment File
# ============================================
echo ""
echo "[5/6] Checking .env file..."

if [ ! -f "$GROTHI_DIR/.env" ]; then
    echo "  Creating .env from template..."
    NEXTAUTH_SECRET=$(openssl rand -base64 32)
    ENCRYPTION_KEY=$(openssl rand -hex 32)

    cat > "$GROTHI_DIR/.env" << ENVEOF
# Database
DATABASE_URL="postgresql://grothi:Gr0th1SaaS2026x@localhost:5432/grothi"

# Redis
REDIS_URL="redis://localhost:6379"

# Auth
NEXTAUTH_URL="https://grothi.com"
NEXTAUTH_SECRET="$NEXTAUTH_SECRET"

# Encryption (for API keys in DB)
ENCRYPTION_KEY="$ENCRYPTION_KEY"

# Stripe (add your keys when ready)
# STRIPE_PUBLISHABLE_KEY="pk_test_..."
# STRIPE_SECRET_KEY="sk_test_..."
# STRIPE_WEBHOOK_SECRET="whsec_..."

# Email (reuse from ShadowGuardians)
# SMTP_HOST="smtp.m1.websupport.sk"
# SMTP_PORT=587
# SMTP_USER="info@acechange.io"
# SMTP_PASS="..."
ENVEOF
    echo "  .env created with generated secrets"
else
    echo "  .env already exists"
fi

# ============================================
# 6. Application Setup
# ============================================
echo ""
echo "[6/6] Building application..."

cd "$GROTHI_DIR"

# Install dependencies
echo "  Installing npm dependencies..."
npm install 2>&1 | tail -3

# Generate Prisma client
echo "  Generating Prisma client..."
./node_modules/.bin/prisma generate 2>&1 | tail -1

# Run migrations
echo "  Running database migrations..."
./node_modules/.bin/prisma migrate dev --name init 2>&1 | tail -3 || {
    echo "  migrate dev failed, trying migrate deploy..."
    ./node_modules/.bin/prisma migrate deploy 2>&1 | tail -3
}

# Seed database
echo "  Seeding database..."
npx tsx prisma/seed.ts 2>&1 | tail -2 || echo "  (may already be seeded)"

# Build Next.js
echo "  Building Next.js (this takes ~60s)..."
npm run build 2>&1 | tail -5

# ============================================
# PM2 Setup
# ============================================
echo ""
echo "Setting up PM2..."

# Stop existing grothi process if running
pm2 delete grothi 2>/dev/null || true

# Start with proper config
cd "$GROTHI_DIR"
pm2 start npm --name grothi -- start
pm2 save

echo ""
echo "========================================="
echo "  SETUP COMPLETE!"
echo "========================================="
echo ""
echo "  Site: https://grothi.com"
echo "  Admin: admin@grothi.com / Admin123!"
echo ""
echo "  IMPORTANT: Set Cloudflare SSL mode:"
echo "  - For self-signed cert: 'Full' mode"
echo "  - For Cloudflare origin cert: 'Full (Strict)' mode"
echo "  Dashboard: https://dash.cloudflare.com → grothi.com → SSL/TLS"
echo ""

# Verify
echo "Services status:"
echo "  Nginx:      $(systemctl is-active nginx)"
echo "  PostgreSQL:  $(systemctl is-active postgresql)"
echo "  Redis:       $(redis-cli ping 2>/dev/null || echo 'not running')"
echo "  PM2 grothi:  $(pm2 describe grothi 2>/dev/null | grep status | head -1 || echo 'not running')"
echo ""
echo "Quick test: curl -k https://localhost"
curl -sk https://localhost -o /dev/null -w "  HTTP Status: %{http_code}\n" 2>/dev/null || echo "  (test failed - check pm2 logs grothi)"
echo ""
pm2 status
