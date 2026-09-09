#!/usr/bin/env bash
#
# Sovereign Sentinel demo (spec §29).
#
#   ./scripts/demo.sh              full pipeline on the committed fixture
#   ./scripts/demo.sh dga          one scenario at a time
#   ./scripts/demo.sh live         open-ended generated stream
#
# Scenarios: full · normal · dga · typosquat · tunneling · beaconing · qoe · live
#
# Deterministic by construction: the fixture is committed and byte-identical,
# the generator is seeded, and incident ids are hashes of the finding rather
# than of the clock. The same command tells the same story every time.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"; cd "$ROOT"

SCENARIO="${1:-full}"
GROUP="demo-$(date +%s)"
# A fresh topic per run is what actually makes the demo deterministic. The
# shared topic accumulates every previous run, and replaying that history
# changes the event count and corrupts beaconing intervals (duplicated
# timestamps), which silently loses a detection. Reading a brand-new topic
# from the beginning also avoids racing the consumer-group coordinator, which
# --from-latest does not.
TOPIC="${KAFKA_TOPIC_DNS:-dns.events.demo}-$(date +%s)"
AGENT_PID=""; RECEIVER_PID=""

cleanup() {
  echo ""
  [ -n "$AGENT_PID" ] && kill -TERM "$AGENT_PID" 2>/dev/null && wait "$AGENT_PID" 2>/dev/null
  [ -n "$RECEIVER_PID" ] && kill -TERM "$RECEIVER_PID" 2>/dev/null
  echo ""
  # Best-effort tidy-up of the throwaway topic; harmless if the CLI is absent.
  if command -v kafka-topics >/dev/null 2>&1; then
    kafka-topics --bootstrap-server "$BROKER" --delete --topic "$TOPIC" >/dev/null 2>&1
  fi
  echo "Alerts written to: out/sentinel-alerts.json"
  [ -f out/sentinel-alerts.json ] && echo "  $(wc -l < out/sentinel-alerts.json | tr -d ' ') alert(s) delivered"
  echo ""
}
trap cleanup EXIT INT TERM

BROKER="${KAFKA_BROKER:-localhost:9092}"
if ! nc -z "${BROKER%%:*}" "${BROKER##*:}" 2>/dev/null; then
  echo "Kafka is not reachable at $BROKER. Run ./scripts/bootstrap.sh first."
  exit 1
fi

# Explanations need weights on disk; they are never fetched (docs/ZERO_EGRESS.md).
EXPLAIN=""
if [ -n "${QVAC_MODELS_DIR:-}" ] && [ -f "${QVAC_MODELS_DIR}/medpsy-4b-q4_k_m-imat.gguf" ]; then
  EXPLAIN="--explain"
fi
CLICKHOUSE=""
if curl -s --max-time 2 "${CLICKHOUSE_URL:-http://127.0.0.1:8123}/?query=SELECT+1" >/dev/null 2>&1; then
  CLICKHOUSE="--clickhouse"
fi

echo ""
echo "  SOVEREIGN SENTINEL"
echo "  Local-first DNS security for regulated infrastructure"
echo ""
echo "  scenario     $SCENARIO"
echo "  broker       $BROKER"
echo "  topic        $TOPIC"
echo "  storage      ${CLICKHOUSE:+ClickHouse}${CLICKHOUSE:-none (QoE not persisted)}"
echo "  local model  ${EXPLAIN:+MedPsy-4B q4_k_m-imat, on-device}${EXPLAIN:-not loaded (set QVAC_MODELS_DIR)}"
echo ""
echo "  Nothing below leaves this machine. Verify with ./scripts/verify-zero-egress.sh"
echo "  ─────────────────────────────────────────────────────────────────────────"

# The topic must exist before the agent subscribes: only producers auto-create,
# so a consumer subscribing first fails with UNKNOWN_TOPIC_OR_PARTITION and
# then silently receives nothing while the producer happily publishes.
# Done through kafkajs rather than the kafka-topics CLI, which is not present
# on a Docker-only host.
node -e '
  const { Kafka, logLevel } = require("kafkajs");
  const admin = new Kafka({ clientId: "demo-setup", brokers: [process.argv[1]],
                            logLevel: logLevel.NOTHING }).admin();
  admin.connect()
    .then(() => admin.createTopics({ topics: [{ topic: process.argv[2], numPartitions: 3 }],
                                     waitForLeaders: true }))
    .then(() => admin.disconnect())
    .catch((e) => { console.error("could not create topic:", e.message); process.exit(1); });
' "$BROKER" "$TOPIC" || exit 1

rm -rf out
node packages/wazuh-adapter/dist/receiver.js > out-receiver.log 2>&1 &
RECEIVER_PID=$!

WAZUH_WEBHOOK_URL="${WAZUH_WEBHOOK_URL:-http://127.0.0.1:8081/}" \
node apps/sentinel-agent/dist/index.js \
  --group "$GROUP" --topic "$TOPIC" --interval 3 --window 3600 $CLICKHOUSE $EXPLAIN 2>&1 &
AGENT_PID=$!

for _ in $(seq 1 20); do
  kill -0 "$AGENT_PID" 2>/dev/null || { echo "agent failed to start"; exit 1; }
  sleep 1
  break
done
sleep 2

case "$SCENARIO" in
  full)
    node apps/synthetic-producer/dist/index.js --topic "$TOPIC" --source fixture --speed 200 ;;
  live)
    echo "  streaming — Ctrl-C to stop"
    node apps/synthetic-producer/dist/index.js --topic "$TOPIC" --source generate --rate 12 --duration 0 ;;
  normal|dga|typosquat|tunneling|beaconing)
    node apps/synthetic-producer/dist/index.js --topic "$TOPIC" --source generate \
      --scenario "$SCENARIO" --rate 10 --duration 25 ;;
  qoe)
    node apps/synthetic-producer/dist/index.js --topic "$TOPIC" --source generate \
      --scenario qoe-degradation,normal --rate 10 --duration 25 ;;
  *)
    echo "unknown scenario '$SCENARIO'"
    echo "try: full · normal · dga · typosquat · tunneling · beaconing · qoe · live"
    exit 1 ;;
esac

# Let the last window be analysed. With explanations on, the first one also
# pays the ~15s cold model load, and the agent drains anything still in flight
# on shutdown — so this only has to cover the analysis tick, not inference.
# NOTE: do not collapse this into ${EXPLAIN:+45}${EXPLAIN:-8}. When EXPLAIN is
# set, ${EXPLAIN:-8} expands to its VALUE ("--explain"), producing
# "sleep 45--explain", which fails instantly and tears the demo down before
# inference even starts. That failure looks exactly like the model producing
# nothing useful.
if [ -n "$EXPLAIN" ]; then SETTLE=45; else SETTLE=8; fi
sleep "$SETTLE"
