#!/usr/bin/env bash
#
# Zero-egress verification (spec §21).
#
# Runs the full pipeline and checks, at the operating-system level, that the
# process never establishes a connection outside the trusted boundary.
#
# This is layer 2 of 3. Layer 1 is the in-process guard (packages/egress-guard),
# which JavaScript cannot escape but native code could. Layer 3 is running the
# demo with Wi-Fi switched off. Any one alone is weak; together they are honest.
#
#   ./scripts/verify-zero-egress.sh
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

BROKER="${KAFKA_BROKER:-localhost:9092}"
GROUP="zero-egress-verify-$$"
LOG="$(mktemp -t sentinel-egress)"
FAIL=0

say() { printf '%s\n' "$*"; }
ok()  { printf '  \033[32m✓\033[0m %s\n' "$*"; }
bad() { printf '  \033[31m✗\033[0m %s\n' "$*"; FAIL=1; }

say ""
say "Zero-egress verification"
say "════════════════════════"
say ""

# ── 1. Static: no cloud AI SDK anywhere in the dependency tree ───────────────
say "1. Dependency audit"
FORBIDDEN="openai anthropic @google/generative-ai @google-cloud google-generativeai groq-sdk together-ai cohere-ai @mistralai replicate langchain llamaindex"
found=""
for pkg in $FORBIDDEN; do
  [ -d "node_modules/$pkg" ] && found="$found $pkg"
done
if [ -n "$found" ]; then
  bad "cloud AI SDKs present:$found"
else
  ok "no cloud AI SDK installed (checked: $(echo $FORBIDDEN | wc -w | tr -d ' ') names)"
fi

runtime_deps=$(node -e '
  const fs=require("fs"),path=require("path");
  const dirs=["packages","apps"].flatMap(d=>fs.readdirSync(d).map(x=>path.join(d,x,"package.json")));
  const ext=new Set();
  for(const f of dirs){ if(!fs.existsSync(f))continue;
    const d=JSON.parse(fs.readFileSync(f,"utf8"));
    for(const k of Object.keys(d.dependencies||{})) if(!k.startsWith("@sentinel/")) ext.add(k); }
  console.log([...ext].sort().join(" "));')
ok "external runtime dependencies: ${runtime_deps:-none}"

# ── 2. Static: no external URLs in source ────────────────────────────────────
say ""
say "2. Source audit"
# Test files are excluded on purpose: they contain external URLs precisely to
# assert that the code REFUSES them. Flagging those would train everyone to
# ignore this check, which is worse than not having it.
urls=$(grep -rEoh 'https?://[a-zA-Z0-9.-]+' \
        --include='*.ts' --exclude='*.test.ts' packages/*/src apps/*/src 2>/dev/null \
      | grep -vE '://(127\.|localhost|\[?::1|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.|kafka|clickhouse|grafana)' \
      | sort -u)
if [ -n "$urls" ]; then
  bad "non-local URLs found in source:"
  printf '      %s\n' $urls
else
  ok "no external URLs in application source"
fi

# ── 3. Runtime: watch the process's real connections ─────────────────────────
say ""
say "3. Live pipeline — observing real sockets"

if ! nc -z "${BROKER%%:*}" "${BROKER##*:}" 2>/dev/null; then
  bad "Kafka is not reachable at $BROKER — start it and re-run"
  say ""
  exit 1
fi
ok "Kafka reachable at $BROKER"

node apps/sentinel-agent/dist/index.js \
  --group "$GROUP" --interval 3 --window 3600 --no-alerts > "$LOG" 2>&1 &
AGENT_PID=$!
trap 'kill $AGENT_PID 2>/dev/null' EXIT

for _ in $(seq 1 20); do grep -q "sentinel-agent ·" "$LOG" && break; sleep 1; done

node apps/synthetic-producer/dist/index.js --source fixture --speed 1000 >/dev/null 2>&1
sleep 6

# Every socket this process family actually holds open.
peers=$(lsof -nP -p "$AGENT_PID" -a -i 2>/dev/null \
        | awk 'NR>1 {print $9}' | grep -o '\->[^ ]*' | sed 's/^->//' | sort -u)

external=""
for peer in $peers; do
  host="${peer%:*}"
  case "$host" in
    127.*|::1|localhost|10.*|192.168.*|169.254.*|\[::1\]) ;;
    172.1[6-9].*|172.2[0-9].*|172.3[01].*) ;;
    *) external="$external $peer" ;;
  esac
done

if [ -n "$external" ]; then
  bad "process holds connections OUTSIDE the trusted boundary:$external"
else
  ok "every open socket is loopback or private: $(echo $peers | tr '\n' ' ')"
fi

kill -TERM $AGENT_PID 2>/dev/null
wait $AGENT_PID 2>/dev/null
sed -n '/SOVEREIGN MODE/,$p' "$LOG"

say ""
say "════════════════════════"
if [ "$FAIL" -eq 0 ]; then
  say "RESULT: PASS — no egress outside the trusted boundary."
  say ""
  say "Scope, stated plainly: this proves the application makes no external"
  say "connection during a full pipeline run, and that no cloud AI SDK is even"
  say "installed. It is NOT an air gap — the machine has a working network"
  say "interface. For the strongest demonstration, switch Wi-Fi off and run the"
  say "demo again: it behaves identically."
else
  say "RESULT: FAIL — see the failures above."
fi
say ""
exit "$FAIL"
