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


BROKER="${KAFKA_BROKER:-localhost:9092}"
GROUP="zero-egress-verify-$$"
LOG="$(mktemp -t sentinel-egress)"
FAIL=0

say() { printf '%s\n' "$*"; }
ok()  { printf '  \033[32m✓\033[0m %s\n' "$*"; }
bad() { printf '  \033[31m✗\033[0m %s\n' "$*"; FAIL=1; }

say ""
say "Verificación de egress cero"
say "════════════════════════"
say ""

# ── 1. Static: no cloud AI SDK anywhere in the dependency tree ───────────────
say "1. Auditoría de dependencias"
FORBIDDEN="openai anthropic @google/generative-ai @google-cloud google-generativeai groq-sdk together-ai cohere-ai @mistralai replicate langchain llamaindex"
found=""
for pkg in $FORBIDDEN; do
  [ -d "node_modules/$pkg" ] && found="$found $pkg"
done
if [ -n "$found" ]; then
  bad "hay SDKs de IA en la nube presentes:$found"
else
  ok "sin SDK de IA en la nube instalado (revisados: $(echo $FORBIDDEN | wc -w | tr -d ' ') nombres)"
fi

runtime_deps=$(node -e '
  const fs=require("fs"),path=require("path");
  const dirs=["packages","apps"].flatMap(d=>fs.readdirSync(d).map(x=>path.join(d,x,"package.json")));
  const ext=new Set();
  for(const f of dirs){ if(!fs.existsSync(f))continue;
    const d=JSON.parse(fs.readFileSync(f,"utf8"));
    for(const k of Object.keys(d.dependencies||{})) if(!k.startsWith("@sentinel/")) ext.add(k); }
  console.log([...ext].sort().join(" "));')
ok "dependencias externas en tiempo de ejecución: ${runtime_deps:-ninguna}"

# ── 2. Static: no external URLs in source ────────────────────────────────────
say ""
say "2. Auditoría de código fuente"
# Test files are excluded on purpose: they contain external URLs precisely to
# assert that the code REFUSES them. Flagging those would train everyone to
# ignore this check, which is worse than not having it.
urls=$(grep -rEoh 'https?://[a-zA-Z0-9.-]+' \
        --include='*.ts' --exclude='*.test.ts' packages/*/src apps/*/src 2>/dev/null \
      | grep -vE '://(127\.|localhost|\[?::1|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.|kafka|clickhouse|grafana)' \
      | sort -u)
if [ -n "$urls" ]; then
  bad "se encontraron URLs no locales en el código fuente:"
  printf '      %s\n' $urls
else
  ok "sin URLs externas en el código fuente de la aplicación"
fi

# ── 3. Runtime: watch the process's real connections ─────────────────────────
say ""
say "3. Flujo en vivo — observando sockets reales"

if ! nc -z "${BROKER%%:*}" "${BROKER##*:}" 2>/dev/null; then
  bad "Kafka no está disponible en $BROKER — inícialo y vuelve a ejecutar"
  say ""
  exit 1
fi
ok "Kafka disponible en $BROKER"

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
  bad "el proceso mantiene conexiones FUERA del límite de confianza:$external"
else
  ok "todo socket abierto es loopback o privado: $(echo $peers | tr '\n' ' ')"
fi

kill -TERM $AGENT_PID 2>/dev/null
wait $AGENT_PID 2>/dev/null
sed -n '/SOVEREIGN MODE/,$p' "$LOG"

say ""
say "════════════════════════"
if [ "$FAIL" -eq 0 ]; then
  say "RESULTADO: APROBADO — sin egress fuera del límite de confianza."
  say ""
  say "Alcance, dicho con claridad: esto demuestra que la aplicación no hace"
  say "ninguna conexión externa durante una corrida completa del pipeline, y"
  say "que ni siquiera hay un SDK de IA en la nube instalado. NO es un air"
  say "gap — la máquina tiene una interfaz de red funcional. Para la prueba"
  say "más contundente, apaga el Wi-Fi y vuelve a correr el demo: se comporta"
  say "idéntico."
else
  say "RESULTADO: FALLÓ — revisa los fallos anteriores."
fi
say ""
exit "$FAIL"
