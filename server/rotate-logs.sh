#!/bin/bash
# Rotate Grothi cron log files to prevent unbounded growth.
# Add to daily cron: 0 2 * * * bash /home/acechange-bot/grothi/server/rotate-logs.sh

GROTHI_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$GROTHI_DIR/logs"

if [ ! -d "$LOG_DIR" ]; then
  exit 0
fi

# Keep last 7 days of logs, compress older ones
for logfile in "$LOG_DIR"/cron-*.log; do
  [ -f "$logfile" ] || continue

  # Rotate: current → .1, .1 → .2, etc.
  for i in 6 5 4 3 2 1; do
    next=$((i + 1))
    [ -f "${logfile}.${i}.gz" ] && mv "${logfile}.${i}.gz" "${logfile}.${next}.gz"
  done

  # Compress current log as .1.gz and truncate
  if [ -s "$logfile" ]; then
    gzip -c "$logfile" > "${logfile}.1.gz"
    : > "$logfile"
  fi

  # Delete logs older than 7 days
  [ -f "${logfile}.8.gz" ] && rm -f "${logfile}.8.gz"
done

echo "[rotate-logs] Log rotation complete: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
