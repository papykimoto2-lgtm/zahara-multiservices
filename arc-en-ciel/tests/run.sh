#!/usr/bin/env bash
# Teste les migrations dans un PostgreSQL jetable (aucune base réelle touchée). Usage : bash arc-en-ciel/tests/run.sh
set -euo pipefail
PGBIN=${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}
D=$(mktemp -d); PORT=${PORT:-54399}; HERE=$(cd "$(dirname "$0")" && pwd)
if [ "$(id -u)" = 0 ]; then id pgtest >/dev/null 2>&1 || useradd -m pgtest; chown pgtest "$D"; RUN="su pgtest -c"; else RUN="bash -c"; fi
trap '$RUN "\"$PGBIN/pg_ctl\" -D \"$D/data\" stop -m immediate" >/dev/null 2>&1 || true; rm -rf "$D"' EXIT
$RUN "'$PGBIN/initdb' -D '$D/data' -A trust -U postgres >/dev/null && '$PGBIN/pg_ctl' -D '$D/data' -o '-p $PORT -k $D' -l '$D/log' -w start >/dev/null"
P="$PGBIN/psql -h $D -p $PORT -U postgres -v ON_ERROR_STOP=1 -q"
$P -c 'create database arc' >/dev/null
P="$P -d arc"
$P -f "$HERE/stub_supabase.sql"
for f in "$HERE"/../supabase/migrations/*.sql; do echo "→ $(basename "$f")"; $P -f "$f"; done
$P -f "$HERE/arc.test.sql" 2>&1 | grep -v '^$'
