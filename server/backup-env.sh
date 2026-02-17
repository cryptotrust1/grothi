#!/bin/bash
# backup-env.sh - Backup .env file with timestamp
# Keeps the last 5 backups, deletes older ones automatically.
# Usage: bash server/backup-env.sh

set -e

# Detect project directory
if [ -f ".env" ]; then
  PROJECT_DIR="$(pwd)"
elif [ -f "/home/acechange-bot/grothi/.env" ]; then
  PROJECT_DIR="/home/acechange-bot/grothi"
else
  echo "ERROR: .env file not found. Run this script from the project root."
  exit 1
fi

BACKUP_DIR="${PROJECT_DIR}/server/env-backups"
TIMESTAMP=$(date +"%Y-%m-%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/.env.${TIMESTAMP}"
MAX_BACKUPS=5

# Create backup directory if it doesn't exist
mkdir -p "${BACKUP_DIR}"

# Copy .env to backup
cp "${PROJECT_DIR}/.env" "${BACKUP_FILE}"
chmod 600 "${BACKUP_FILE}"

echo "Backup created: ${BACKUP_FILE}"

# Count backups and remove old ones (keep last MAX_BACKUPS)
BACKUP_COUNT=$(ls -1 "${BACKUP_DIR}"/.env.* 2>/dev/null | wc -l)
if [ "${BACKUP_COUNT}" -gt "${MAX_BACKUPS}" ]; then
  REMOVE_COUNT=$((BACKUP_COUNT - MAX_BACKUPS))
  ls -1t "${BACKUP_DIR}"/.env.* | tail -n "${REMOVE_COUNT}" | xargs rm -f
  echo "Cleaned up ${REMOVE_COUNT} old backup(s). Keeping last ${MAX_BACKUPS}."
fi

echo "Total backups: $(ls -1 "${BACKUP_DIR}"/.env.* 2>/dev/null | wc -l)"
