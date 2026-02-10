#!/bin/bash
# Setup SSL for grothi.com (Cloudflare Origin or self-signed)
# Run as root on the server
set -e

echo "========================================="
echo "  Grothi.com SSL Setup"
echo "========================================="

SSL_DIR="/etc/ssl/grothi.com"
mkdir -p "$SSL_DIR"

# Check if Cloudflare origin cert already exists
if [ -f "$SSL_DIR/origin.pem" ] && [ -f "$SSL_DIR/origin-key.pem" ]; then
    echo "SSL certificates already exist at $SSL_DIR"
    echo "To replace, delete them first and re-run this script"
else
    echo ""
    echo "Choose SSL certificate type:"
    echo "  1) Generate self-signed cert (works with Cloudflare 'Full' mode)"
    echo "  2) I have a Cloudflare Origin Certificate to paste"
    echo ""
    read -p "Choice [1/2]: " SSL_CHOICE

    if [ "$SSL_CHOICE" = "2" ]; then
        echo ""
        echo "Paste the Origin Certificate PEM (end with empty line):"
        CERT=""
        while IFS= read -r line; do
            [ -z "$line" ] && break
            CERT="$CERT$line"$'\n'
        done
        echo "$CERT" > "$SSL_DIR/origin.pem"

        echo ""
        echo "Paste the Private Key PEM (end with empty line):"
        KEY=""
        while IFS= read -r line; do
            [ -z "$line" ] && break
            KEY="$KEY$line"$'\n'
        done
        echo "$KEY" > "$SSL_DIR/origin-key.pem"
        echo "Cloudflare Origin Certificate saved!"
    else
        echo "Generating self-signed certificate for grothi.com..."
        openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
            -keyout "$SSL_DIR/origin-key.pem" \
            -out "$SSL_DIR/origin.pem" \
            -subj "/C=FI/ST=Helsinki/L=Helsinki/O=Grothi/CN=grothi.com" \
            -addext "subjectAltName=DNS:grothi.com,DNS:www.grothi.com"
        echo "Self-signed certificate generated!"
        echo ""
        echo "IMPORTANT: Change Cloudflare SSL mode to 'Full' (not 'Full Strict')"
        echo "  Dashboard: https://dash.cloudflare.com → grothi.com → SSL/TLS"
        echo "  Set mode to: Full"
    fi
fi

chmod 600 "$SSL_DIR/origin-key.pem"
chmod 644 "$SSL_DIR/origin.pem"

echo ""
echo "SSL certificates ready at: $SSL_DIR"
echo "  Certificate: $SSL_DIR/origin.pem"
echo "  Private Key: $SSL_DIR/origin-key.pem"
