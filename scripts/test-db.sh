#!/usr/bin/env bash
# Throwaway local Postgres + PostGIS for tests.
#   bash scripts/test-db.sh start   # creates, starts and migrates; prints DATABASE_URL
#   bash scripts/test-db.sh stop
# Needs PostgreSQL 16 server binaries and PostGIS 3 installed (e.g. postgresql-16-postgis-3).
set -euo pipefail

PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
DIR="${TEST_DB_DIR:-/tmp/mzigo-test-db}"
PORT="${TEST_DB_PORT:-54329}"
DB=mzigo_test
URL="postgres://postgres@127.0.0.1:${PORT}/${DB}"

as_pg() {
  if [ "$(id -u)" = "0" ]; then runuser -u postgres -- "$@"; else "$@"; fi
}

case "${1:-start}" in
  start)
    if [ ! -f "$DIR/PG_VERSION" ]; then
      mkdir -p "$DIR"
      [ "$(id -u)" = "0" ] && chown postgres "$DIR"
      as_pg "$PGBIN/initdb" -D "$DIR" -U postgres --auth=trust >/dev/null
    fi
    if ! as_pg "$PGBIN/pg_ctl" -D "$DIR" status >/dev/null 2>&1; then
      as_pg "$PGBIN/pg_ctl" -D "$DIR" -o "-p $PORT -k /tmp -c listen_addresses=127.0.0.1 -c fsync=off" -l "$DIR/server.log" -w start >/dev/null
    fi
    psql "postgres://postgres@127.0.0.1:${PORT}/postgres" -qtAc "select 1 from pg_database where datname='${DB}'" | grep -q 1 \
      || psql "postgres://postgres@127.0.0.1:${PORT}/postgres" -qc "create database ${DB}"
    psql "postgres://postgres@127.0.0.1:${PORT}/postgres" -qc "alter database ${DB} set search_path = public, extensions"
    DATABASE_URL="$URL" node "$(dirname "$0")/migrate.mjs"
    echo "DATABASE_URL=$URL"
    ;;
  stop)
    as_pg "$PGBIN/pg_ctl" -D "$DIR" -m fast stop >/dev/null && echo stopped
    ;;
  reset)
    "$0" stop || true
    rm -rf "$DIR"
    "$0" start
    ;;
  *) echo "usage: $0 start|stop|reset" >&2; exit 2 ;;
esac
