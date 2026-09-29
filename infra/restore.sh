#!/usr/bin/env bash
set -euo pipefail

RESTORE_FILE="${1:-}"
if [[ -z "$RESTORE_FILE" ]]; then
  echo "Usage: ./infra/restore.sh /path/to/backup.sql.gz"
  exit 1
fi

DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/store}"
TARGET_DB="${TARGET_DB:-store_restore}"

createdb "$TARGET_DB" || true
pg_restore --clean --if-exists --dbname="$TARGET_DB" "$RESTORE_FILE"

echo "Restore completed to $TARGET_DB"
