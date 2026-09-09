#!/usr/bin/env bash
# Applies schema.sql to ClickHouse.
#
# ClickHouse's HTTP interface rejects multi-statement bodies, so statements are
# sent one at a time. Works against a native install or the compose service.
#
#   ./infra/clickhouse/apply-schema.sh [http://127.0.0.1:8123]
set -euo pipefail

URL="${1:-${CLICKHOUSE_URL:-http://127.0.0.1:8123}}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

python3 - "$DIR/schema.sql" <<'PY' | while IFS= read -r stmt; do
import re, sys
sql = open(sys.argv[1]).read()
sql = re.sub(r"--[^\n]*", "", sql)                  # strip comments
for s in (s.strip() for s in sql.split(";")):
    if s:
        print(s.replace("\n", " "))
PY
  [ -z "$stmt" ] && continue
  printf '  %.60s… ' "$stmt"
  if curl -sS --fail-with-body --data-binary "$stmt" "$URL/" >/dev/null; then
    echo "ok"
  else
    echo "FAILED"; exit 1
  fi
done

echo "schema applied to $URL"
