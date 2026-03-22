#!/bin/bash
# Setup cron jobs for Grothi.com background workers
# Run as root: bash server/setup-cron.sh
#
# These cron jobs call the API endpoints that process scheduled posts,
# collect engagement metrics, and run daily health checks.
set -e

echo "========================================="
echo "  Grothi.com Cron Job Setup"
echo "========================================="

# ── Read CRON_SECRET from .env ────────────────────────────────

GROTHI_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$GROTHI_DIR/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: .env file not found at $ENV_FILE"
  echo "Run setup-server.sh first or create .env manually."
  exit 1
fi

CRON_SECRET=$(grep -E '^CRON_SECRET=' "$ENV_FILE" | cut -d'=' -f2- | tr -d '"' | tr -d "'")

if [ -z "$CRON_SECRET" ] || [ "$CRON_SECRET" = "generate-with-openssl-rand-base64-32" ]; then
  echo ""
  echo "CRON_SECRET not set in .env. Generating one..."
  CRON_SECRET=$(openssl rand -base64 32)

  if grep -q '^CRON_SECRET=' "$ENV_FILE"; then
    sed -i "s|^CRON_SECRET=.*|CRON_SECRET=\"$CRON_SECRET\"|" "$ENV_FILE"
  else
    echo "" >> "$ENV_FILE"
    echo "# Cron job authentication secret" >> "$ENV_FILE"
    echo "CRON_SECRET=\"$CRON_SECRET\"" >> "$ENV_FILE"
  fi

  echo "  Generated and saved CRON_SECRET to .env"
fi

echo "  CRON_SECRET: ${CRON_SECRET:0:8}...  (first 8 chars)"

# ── Base URL ──────────────────────────────────────────────────

BASE_URL=$(grep -E '^NEXTAUTH_URL=' "$ENV_FILE" | cut -d'=' -f2- | tr -d '"' | tr -d "'")
BASE_URL="${BASE_URL:-https://grothi.com}"

echo "  Base URL: $BASE_URL"

# ── Build cron entries ────────────────────────────────────────

CRON_MARKER="# GROTHI-CRON-JOBS"

# The five cron jobs:
# 1. Process scheduled posts - every minute
# 2. Collect engagement metrics - every 15 minutes
# 3. Detect trends (Hype Radar) - every 10 minutes
# 4. Generate AI content for autopilot posts - every 5 minutes
# 5. Daily health check (token refresh, counter reset) - 3 AM
LOG_DIR="$GROTHI_DIR/logs"
mkdir -p "$LOG_DIR"

# Timeout values aligned to route maxDuration (with 10s buffer for network):
#   process-posts:       maxDuration=300s → timeout=290s (runs every 1 min, cron-lock prevents overlap)
#   collect-engagement:  maxDuration=300s → timeout=290s
#   detect-trends:       maxDuration=300s → timeout=290s
#   autonomous-content:  maxDuration=300s → timeout=290s
#   health-check:        maxDuration=300s → timeout=290s
# Retry: --retry 2 --retry-delay 5 for transient network failures (DNS, TCP reset)
CRON_LINES="$CRON_MARKER
* * * * * curl -sf --max-time 290 --retry 2 --retry-delay 5 -X POST ${BASE_URL}/api/cron/process-posts -H \"Authorization: Bearer ${CRON_SECRET}\" >> ${LOG_DIR}/cron-process-posts.log 2>&1
*/15 * * * * curl -sf --max-time 290 --retry 2 --retry-delay 5 -X POST ${BASE_URL}/api/cron/collect-engagement -H \"Authorization: Bearer ${CRON_SECRET}\" >> ${LOG_DIR}/cron-collect-engagement.log 2>&1
*/10 * * * * curl -sf --max-time 290 --retry 2 --retry-delay 5 -X POST ${BASE_URL}/api/cron/detect-trends -H \"Authorization: Bearer ${CRON_SECRET}\" >> ${LOG_DIR}/cron-detect-trends.log 2>&1
*/5 * * * * curl -sf --max-time 290 --retry 2 --retry-delay 5 -X POST ${BASE_URL}/api/cron/autonomous-content -H \"Authorization: Bearer ${CRON_SECRET}\" >> ${LOG_DIR}/cron-autonomous-content.log 2>&1
0 3 * * * curl -sf --max-time 290 --retry 2 --retry-delay 5 -X POST ${BASE_URL}/api/cron/health-check -H \"Authorization: Bearer ${CRON_SECRET}\" >> ${LOG_DIR}/cron-health-check.log 2>&1
0 2 * * * bash ${GROTHI_DIR}/server/rotate-logs.sh >> ${LOG_DIR}/cron-rotate.log 2>&1
$CRON_MARKER-END"

# ── Install cron jobs ────────────────────────────────────────

echo ""
echo "Installing cron jobs..."

# Get existing crontab (or empty)
EXISTING_CRON=$(crontab -l 2>/dev/null || true)

# Remove old Grothi cron entries if they exist
CLEANED_CRON=$(echo "$EXISTING_CRON" | sed "/$CRON_MARKER/,/$CRON_MARKER-END/d")

# Add new entries
NEW_CRON="$CLEANED_CRON
$CRON_LINES"

echo "$NEW_CRON" | crontab -

echo "  Cron jobs installed successfully!"
echo ""
echo "Active cron jobs:"
echo "  [every 1 min]  POST /api/cron/process-posts       (publish scheduled posts)"
echo "  [every 15 min] POST /api/cron/collect-engagement   (fetch likes/comments/shares)"
echo "  [every 10 min] POST /api/cron/detect-trends       (hype/viral trend detection)"
echo "  [every 5 min]  POST /api/cron/autonomous-content  (AI content for autopilot)"
echo "  [daily 3 AM]   POST /api/cron/health-check         (token refresh, counter reset)"
echo "  [daily 2 AM]   rotate-logs.sh                      (log rotation)"
echo ""
echo "Verify with: crontab -l"
echo ""
echo "========================================="
echo "  CRON SETUP COMPLETE"
echo "========================================="
