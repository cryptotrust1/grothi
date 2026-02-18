#!/bin/bash
# Setup direct media serving for Meta platforms (Instagram, Threads, Facebook)
#
# Meta's crawlers cannot download media through Cloudflare's bot protection.
# This script sets up Nginx to serve media files directly via the server IP
# on port 8787, bypassing Cloudflare entirely.
#
# Run as root: bash server/setup-media-direct.sh

set -e

echo "========================================="
echo "  Grothi.com Direct Media Serving Setup"
echo "========================================="

NGINX_AVAILABLE="/etc/nginx/sites-available"
NGINX_ENABLED="/etc/nginx/sites-enabled"
CONFIG_SRC="server/nginx-media-direct.conf"
CONFIG_NAME="grothi-media-direct"
UPLOAD_DIR="/home/acechange-bot/grothi/data/uploads"
SERVER_IP="89.167.18.92"
PORT=8787

# Check if running as root
if [ "$(id -u)" -ne 0 ]; then
    echo "Error: This script must be run as root"
    exit 1
fi

# Check if Nginx is installed
if ! command -v nginx &> /dev/null; then
    echo "Error: Nginx is not installed"
    exit 1
fi

# Check if config source exists
if [ ! -f "$CONFIG_SRC" ]; then
    echo "Error: Config file not found: $CONFIG_SRC"
    echo "Make sure you're running this from the project root directory"
    exit 1
fi

# Check if upload directory exists
if [ ! -d "$UPLOAD_DIR" ]; then
    echo "Warning: Upload directory does not exist: $UPLOAD_DIR"
    echo "Creating it..."
    mkdir -p "$UPLOAD_DIR"
fi

echo ""
echo "[1/4] Installing Nginx config..."
cp "$CONFIG_SRC" "$NGINX_AVAILABLE/$CONFIG_NAME"
echo "  Copied to $NGINX_AVAILABLE/$CONFIG_NAME"

# Enable the site
if [ ! -L "$NGINX_ENABLED/$CONFIG_NAME" ]; then
    ln -s "$NGINX_AVAILABLE/$CONFIG_NAME" "$NGINX_ENABLED/$CONFIG_NAME"
    echo "  Enabled: $NGINX_ENABLED/$CONFIG_NAME"
else
    echo "  Already enabled"
fi

echo ""
echo "[2/4] Testing Nginx config..."
nginx -t
echo "  Nginx config is valid"

echo ""
echo "[3/4] Reloading Nginx..."
systemctl reload nginx
echo "  Nginx reloaded"

echo ""
echo "[4/4] Opening firewall port $PORT..."
# Try ufw first, then iptables
if command -v ufw &> /dev/null; then
    ufw allow $PORT/tcp 2>/dev/null && echo "  UFW: port $PORT opened" || echo "  UFW: port may already be open or UFW inactive"
else
    iptables -C INPUT -p tcp --dport $PORT -j ACCEPT 2>/dev/null || {
        iptables -A INPUT -p tcp --dport $PORT -j ACCEPT
        echo "  iptables: port $PORT opened"
    }
fi

echo ""
echo "[5/5] Adding MEDIA_DIRECT_BASE to .env..."
ENV_FILE="/home/acechange-bot/grothi/.env"
MEDIA_URL="http://$SERVER_IP:$PORT/media"

if grep -q "^MEDIA_DIRECT_BASE=" "$ENV_FILE" 2>/dev/null; then
    # Update existing entry
    sed -i "s|^MEDIA_DIRECT_BASE=.*|MEDIA_DIRECT_BASE=$MEDIA_URL|" "$ENV_FILE"
    echo "  Updated MEDIA_DIRECT_BASE=$MEDIA_URL"
else
    # Add new entry
    echo "" >> "$ENV_FILE"
    echo "# Direct media URL for Meta platforms (bypasses Cloudflare)" >> "$ENV_FILE"
    echo "MEDIA_DIRECT_BASE=$MEDIA_URL" >> "$ENV_FILE"
    echo "  Added MEDIA_DIRECT_BASE=$MEDIA_URL"
fi

echo ""
echo "========================================="
echo "  Testing..."
echo "========================================="

# Quick test: check if port is listening
sleep 1
if curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$PORT/" | grep -q "444"; then
    echo "  ✓ Port $PORT responding (444 on root = correct, blocks non-media paths)"
else
    echo "  ⚠ Port $PORT may not be responding yet. Check: curl http://127.0.0.1:$PORT/"
fi

# Check if a test file is accessible (if uploads exist)
TEST_FILE=$(find "$UPLOAD_DIR" -type f -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" | head -1)
if [ -n "$TEST_FILE" ]; then
    REL_PATH=${TEST_FILE#$UPLOAD_DIR/}
    TEST_URL="http://127.0.0.1:$PORT/media/$REL_PATH"
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$TEST_URL")
    if [ "$HTTP_CODE" = "200" ]; then
        echo "  ✓ Media file accessible: $TEST_URL (HTTP $HTTP_CODE)"
    else
        echo "  ⚠ Media file returned HTTP $HTTP_CODE: $TEST_URL"
    fi
fi

echo ""
echo "========================================="
echo "  SETUP COMPLETE"
echo ""
echo "  Media URL: http://$SERVER_IP:$PORT/media/{botId}/{filename}"
echo "  Env var:   MEDIA_DIRECT_BASE=$MEDIA_URL"
echo ""
echo "  Next: redeploy the app (pm2 restart grothi)"
echo "  Then try scheduling a post to Instagram."
echo "========================================="
