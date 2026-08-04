#!/usr/bin/env bash
# Nightly backup of the SQLite database.
# Uses the sqlite3 .backup command, which is safe to run while the app is
# writing — a plain file copy of a WAL database can capture a torn state.
#
# Install: cp deploy/backup.sh /usr/local/bin/study-dashboard-backup
#          chmod +x /usr/local/bin/study-dashboard-backup
#          crontab -e   →   0 3 * * * /usr/local/bin/study-dashboard-backup
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/study-dashboard}"
DB="$APP_DIR/server/prisma/dev.db"
DEST="${DEST:-$APP_DIR/backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"

mkdir -p "$DEST"
STAMP="$(date +%Y-%m-%d_%H-%M)"
sqlite3 "$DB" ".backup '$DEST/dev-$STAMP.db'"
gzip -f "$DEST/dev-$STAMP.db"

find "$DEST" -name 'dev-*.db.gz' -mtime "+$KEEP_DAYS" -delete
echo "backup written: $DEST/dev-$STAMP.db.gz"
