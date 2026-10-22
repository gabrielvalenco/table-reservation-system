#!/usr/bin/env bash
# Restaura um dump. Por segurança, NUNCA escreve por cima do banco em uso: restaura em um banco novo,
# que você confere e depois promove (veja docs/operacao.md, "Restaurar um backup").
#
#   ./scripts/restore.sh backups/reservas-20261022-030000.dump            # cria o banco reservas_restore
#   TARGET_DB=reservas_conferencia ./scripts/restore.sh <arquivo>
#   ./scripts/restore.sh <arquivo> --check                                 # também confere os dados e apaga o banco de teste
set -euo pipefail

file="${1:?uso: restore.sh <arquivo.dump> [--check]}"
check="${2:-}"

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env.production}"
DB_USER="${DB_USER:-reservas}"
SOURCE_DB="${SOURCE_DB:-reservas}"
TARGET_DB="${TARGET_DB:-${SOURCE_DB}_restore}"

compose() {
  if [ -f "$ENV_FILE" ]; then docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"; else docker compose -f "$COMPOSE_FILE" "$@"; fi
}
psql_db() { compose exec -T db psql -U "$DB_USER" -v ON_ERROR_STOP=1 -tA "$@"; }

[ "$TARGET_DB" != "$SOURCE_DB" ] || { echo "recusado: o destino não pode ser o banco em uso ($SOURCE_DB)" >&2; exit 1; }

psql_db -d postgres -c "DROP DATABASE IF EXISTS \"$TARGET_DB\"" > /dev/null
psql_db -d postgres -c "CREATE DATABASE \"$TARGET_DB\"" > /dev/null
compose exec -T db pg_restore -U "$DB_USER" -d "$TARGET_DB" --no-owner --exit-on-error < "$file"
echo "restaurado em: $TARGET_DB"

if [ "$check" = "--check" ]; then
  tables=$(psql_db -d "$TARGET_DB" -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'")
  reservations=$(psql_db -d "$TARGET_DB" -c "SELECT count(*) FROM reservations")
  migrations=$(psql_db -d "$TARGET_DB" -c "SELECT count(*) FROM schema_migrations")
  # A restrição que garante "nada de reserva sobreposta" precisa ter voltado junto com os dados.
  exclusion=$(psql_db -d "$TARGET_DB" -c "SELECT count(*) FROM pg_constraint WHERE contype = 'x' AND conrelid = 'reservations'::regclass")
  echo "conferência: $tables tabelas, $reservations reservas, $migrations migrations, $exclusion restrição(ões) EXCLUDE"
  [ "$exclusion" -ge 1 ] || { echo "FALHA: restrição EXCLUDE ausente no banco restaurado" >&2; exit 1; }
  psql_db -d postgres -c "DROP DATABASE \"$TARGET_DB\"" > /dev/null
  echo "restore verificado; banco de teste removido."
fi
