#!/usr/bin/env bash
#
# One-time setup check. Run this before the demo, not during it.
#
#   ./scripts/bootstrap.sh
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"; cd "$ROOT"

# Load .env if present, so credentials and endpoints come from one place.
# Docker Compose reads .env by itself; the Node apps do not, and a stack that
# works for compose but not for the CLI is a confusing way to lose an hour.
#
# Parsed line by line rather than sourced: `source` chokes on an unquoted value
# containing spaces (a model path like "/Users/me/PRUEBA DE MODELOS/..." tries
# to execute "DE" as a command), while Compose accepts it happily. Same file,
# two parsers, and the failure looks like the variable was simply never set.
if [ -f "$ROOT/.env" ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in ''|'#'*) continue ;; esac
    key="${line%%=*}"; val="${line#*=}"
    case "$key" in *[!A-Za-z0-9_]*) continue ;; esac
    val="${val%\"}"; val="${val#\"}"; val="${val%\'}"; val="${val#\'}"
    export "$key=$val"
  done < "$ROOT/.env"
fi


ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*"; }
bad()  { printf '  \033[31m✗\033[0m %s\n' "$*"; }
MISSING=0

echo ""
echo "Sovereign Sentinel — bootstrap"
echo "══════════════════════════════"
echo ""

echo "Toolchain"
if command -v node >/dev/null; then
  v=$(node -p 'process.versions.node.split(".")[0]')
  [ "$v" -ge 22 ] && ok "node $(node -v)" || { bad "node $(node -v) — need >= 22.17"; MISSING=1; }
else bad "node not installed"; MISSING=1; fi

echo ""
echo "Building"
if npm install --silent >/dev/null 2>&1 && npm run build >/dev/null 2>&1; then
  ok "workspace builds"
else bad "build failed — run 'npm run build' to see why"; MISSING=1; fi

echo ""
echo "Services"
BROKER="${KAFKA_BROKER:-localhost:9092}"
if nc -z "${BROKER%%:*}" "${BROKER##*:}" 2>/dev/null; then
  ok "Kafka at $BROKER"
else
  bad "Kafka not reachable at $BROKER"
  echo "      docker compose up -d kafka     (or: brew services start kafka)"
  MISSING=1
fi

CH="${CLICKHOUSE_URL:-http://127.0.0.1:8123}"
CH_AUTH=()
[ -n "${CLICKHOUSE_USER:-}" ] && CH_AUTH=(-H "X-ClickHouse-User: $CLICKHOUSE_USER"
                                          -H "X-ClickHouse-Key: ${CLICKHOUSE_PASSWORD:-}")
if curl -s --max-time 3 "${CH_AUTH[@]}" "$CH/?query=SELECT+1" | grep -q 1; then
  ok "ClickHouse at $CH"
  if ./infra/clickhouse/apply-schema.sh "$CH" >/dev/null 2>&1; then
    ok "schema applied"
  else warn "schema could not be applied — QoE storage will fail"; fi
else
  warn "ClickHouse not reachable at $CH — the demo runs without it, QoE just is not stored"
fi

echo ""
echo "Local model weights (required only for --explain)"
if [ -n "${QVAC_MODELS_DIR:-}" ] && [ -f "${QVAC_MODELS_DIR}/medpsy-4b-q4_k_m-imat.gguf" ]; then
  ok "MedPsy-4B found in QVAC_MODELS_DIR"
else
  warn "QVAC_MODELS_DIR not set or medpsy-4b-q4_k_m-imat.gguf missing"
  echo "      Weights are never downloaded at run time — see docs/ZERO_EGRESS.md."
  echo "      Without them the demo still runs; incidents just carry no analyst text."
fi

echo ""
echo "══════════════════════════════"
[ "$MISSING" -eq 0 ] && echo "Ready.  Next:  ./scripts/demo.sh" || echo "Fix the ✗ items above, then re-run."
echo ""
exit "$MISSING"
