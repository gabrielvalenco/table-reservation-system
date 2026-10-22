#!/usr/bin/env bash
# Backup do banco com pg_dump (formato custom, comprimido). Guarda em ./backups e apaga o que passar da retenção.
#
#   ./scripts/backup.sh                       # produção
#   COMPOSE_FILE=docker-compose.yml DB_USER=postgres ./scripts/backup.sh   # desenvolvimento
#
# Agende no cron da VPS (todo dia às 3h):  0 3 * * * cd /caminho/do/projeto && ./scripts/backup.sh >> backups/backup.log 2>&1
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env.production}"
DB_USER="${DB_USER:-reservas}"
DB_NAME="${DB_NAME:-reservas}"
BACKUP_DIR="${BACKUP_DIR:-backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

compose() {
  if [ -f "$ENV_FILE" ]; then docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"; else docker compose -f "$COMPOSE_FILE" "$@"; fi
}

mkdir -p "$BACKUP_DIR"
file="$BACKUP_DIR/${DB_NAME}-$(date +%Y%m%d-%H%M%S).dump"

compose exec -T db pg_dump -U "$DB_USER" -Fc "$DB_NAME" > "$file.partial"
# Um dump vazio ou truncado é pior que nenhum: confere que o pg_restore consegue ler o índice do arquivo.
compose exec -T db pg_restore --list < "$file.partial" > /dev/null
mv "$file.partial" "$file"

find "$BACKUP_DIR" -name "${DB_NAME}-*.dump" -mtime +"$RETENTION_DAYS" -delete

echo "backup ok: $file ($(wc -c < "$file") bytes)"
