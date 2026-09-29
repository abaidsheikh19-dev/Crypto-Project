#!/usr/bin/env bash
set -euo pipefail

# Local backup placeholder for Postgres and app content. Intended for encrypted off-site storage.
DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/store}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_DIR="${BACKUP_DIR:-/tmp/backup}"
TARGET="${BACKUP_TARGET:-$BACKUP_DIR/backup-$TIMESTAMP.sql.gz}"

mkdir -p "$BACKUP_DIR"
PGPASSWORD="$(printf '%s' "$DB_URL" | sed -n 's#.*://\([^:]*\):\([^@]*\)@.*#\2#p')" \
  pg_dump "$(printf '%s' "$DB_URL" | sed -n 's#.*://.*@\([^/]*\)/.*#\1#p')" \
  -U "$(printf '%s' "$DB_URL" | sed -n 's#.*://\([^:]*\):.*@.*#\1#p')" \
  -d "$(printf '%s' "$DB_URL" | sed -n 's#.*://.*@.*/\(.*\)#\1#p')" \
  | gzip > "$TARGET"

if [[ -n "${AGE_PUBLIC_KEY:-}" ]]; then
  age -r "$AGE_PUBLIC_KEY" -o "$TARGET.age" "$TARGET"
  rm -f "$TARGET"
  echo "Encrypted backup written to $TARGET.age"
else
  echo "Backup written to $TARGET"
fi
