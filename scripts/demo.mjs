#!/usr/bin/env node
/**
 * Sovereign Sentinel demo. Runs on macOS, Linux and Windows.
 *
 *   npm run demo              full pipeline on the committed fixture
 *   npm run demo -- dga       one scenario at a time
 *   npm run demo -- live      open-ended generated stream
 *   npm run demo -- typosquat --keep-alive
 *                             keeps local services and model status running
 *   npm run demo -- typosquat --wait
 *                             brings the stack up, then waits for Enter before
 *                             producing anything — so a recording can start on
 *                             the first event instead of on Kafka's boot logs
 *
 * Scenarios: full · normal · dga · typosquat · tunneling · beaconing · qoe · live
 *
 * Deterministic by construction: the fixture is committed and byte-identical,
 * the generator is seeded, incident ids are hashes of the finding rather than
 * of the clock, and each run gets its own Kafka topic so no previous run can
 * leak into this one.
 */
import { spawn } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { Kafka, logLevel } from "kafkajs";
import { ROOT, clickhouseQuery, loadEnv, modelPath, portOpen, sleep } from "./lib.mjs";

loadEnv();

const SCENARIOS = ["full", "normal", "dga", "typosquat", "tunneling", "beaconing", "qoe", "live"];
const scenario = (process.argv[2] ?? "full").replace(/^--.*/, "full");
/** Hold at the starting line until a person says go. */
const waitForGo = process.argv.includes("--wait");
// Keep the local analyst and model status available after the stream finishes.
const keepAlive = process.argv.includes("--keep-alive");
if (!SCENARIOS.includes(scenario)) {
  console.error(`unknown scenario "${scenario}"\ntry: ${SCENARIOS.join(" · ")}`);
  process.exit(1);
}

const broker = process.env["KAFKA_BROKER"] ?? "localhost:9092";
const topic = `${process.env["KAFKA_TOPIC_DNS"] ?? "dns.events.raw"}-${Date.now()}`;
const group = `demo-${Date.now()}`;

if (!(await portOpen(broker))) {
  console.error(`Kafka is not reachable at ${broker}. Run 'npm run bootstrap' first.`);
  process.exit(1);
}

const weights = modelPath();
const explain = Boolean(weights && existsSync(weights));
// Visual investigation needs the vision weights AND the decoy site.
const visionDir = process.env["QVAC_VISION_MODELS_DIR"] ?? process.env["QVAC_MODELS_DIR"];
const investigate = Boolean(visionDir &&
  existsSync(join(visionDir, "visionpsy-nano-460m-flash-q4_k_m-imat.gguf")));

let clickhouse = false;
try { await clickhouseQuery("SELECT 1"); clickhouse = true; } catch { /* optional */ }

const node = process.execPath;
const children = [];
let closing = false;

function start(script, args, opts = {}) {
  const child = spawn(node, [join(ROOT, script), ...args], {
    cwd: ROOT, stdio: opts.quiet ? "ignore" : "inherit", env: process.env,
  });
  children.push(child);
  return child;
}

async function cleanup() {
  if (closing) return;
  closing = true;
  for (const c of children) { try { c.kill("SIGTERM"); } catch { /* already gone */ } }
  await sleep(2500);          // let the agent drain inference and print its panel
  for (const c of children) { try { c.kill("SIGKILL"); } catch { /* already gone */ } }

  const alerts = join(ROOT, "out/sentinel-alerts.json");
  console.log("");
  if (existsSync(alerts)) {
    const n = readFileSync(alerts, "utf8").trim().split("\n").filter(Boolean).length;
    console.log(`Alerts written to: out/sentinel-alerts.json — ${n} alert(s) delivered`);
  }
  console.log("");
}
process.on("SIGINT", () => cleanup().then(() => process.exit(0)));
process.on("SIGTERM", () => cleanup().then(() => process.exit(0)));

console.log(`
  SOVEREIGN SENTINEL
  Local-first DNS security for regulated infrastructure

  scenario     ${scenario}
  broker       ${broker}
  topic        ${topic}
  storage      ${clickhouse ? "ClickHouse" : "none (QoE not persisted)"}
  local model  ${explain ? "MedPsy-4B q4_k_m-imat, on-device" : "not loaded (set QVAC_MODELS_DIR)"}
  investigate  ${investigate ? "VisionPsy-Nano-460M-Flash, on-device" : "off (set QVAC_VISION_MODELS_DIR)"}

  Nothing below leaves this machine. Verify with scripts/verify-zero-egress.sh
  ─────────────────────────────────────────────────────────────────────────`);

// The topic must exist before the agent subscribes: only producers auto-create,
// so a consumer subscribing first fails with UNKNOWN_TOPIC_OR_PARTITION and then
// silently receives nothing while the producer happily publishes.
const admin = new Kafka({ clientId: "demo-setup", brokers: [broker], logLevel: logLevel.NOTHING }).admin();
await admin.connect();
await admin.createTopics({ topics: [{ topic, numPartitions: 3 }], waitForLeaders: true });
await admin.disconnect();

// Keep screenshots referenced by incidents already stored in ClickHouse.
rmSync(join(ROOT, "out/sentinel-alerts.json"), { force: true });
start("packages/wazuh-adapter/dist/receiver.js", [], { quiet: true });

if (investigate) {
  // The decoy the sandbox will render. Loopback only; the demo cannot and must
  // not browse the internet.
  start("apps/phishing-demo/dist/index.js", [], { quiet: true });
  process.env["SANDBOX_RESOLVER_RULES"] ??=
    `MAP *.example 127.0.0.1:${process.env["PHISHING_DEMO_PORT"] ?? 8099}`;
  await sleep(1200);
}

process.env["WAZUH_WEBHOOK_URL"] ??= "http://127.0.0.1:8081/";
start("apps/sentinel-agent/dist/index.js", [
  "--group", group, "--topic", topic, "--interval", "3", "--window", "3600",
  ...(clickhouse ? ["--clickhouse"] : []),
  ...(explain ? ["--explain"] : []),
  ...(investigate ? ["--investigate"] : []),
]);
await sleep(3000);

if (waitForGo) {
  // Everything is up and connected; nothing has been produced yet. On camera
  // this is the difference between opening on a live incident and opening on
  // a broker's startup noise.
  console.log("\n  ─────────────────────────────────────────────────────────");
  console.log("  Stack is up and the agent is consuming. No events yet.");
  console.log("  Press Enter to start the stream.");
  console.log("  ─────────────────────────────────────────────────────────\n");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  await rl.question("");
  rl.close();
}

const producerArgs =
  scenario === "full"  ? ["--source", "fixture", "--speed", "200"] :
  scenario === "live"  ? ["--source", "generate", "--rate", "12", "--duration", "0"] :
  scenario === "qoe"   ? ["--source", "generate", "--scenario", "qoe-degradation,normal", "--rate", "10", "--duration", "25"] :
                         ["--source", "generate", "--scenario", scenario, "--rate", "10", "--duration", "25"];

if (scenario === "live") console.log("  streaming — Ctrl-C to stop");

await new Promise((res) => {
  const p = start("apps/synthetic-producer/dist/index.js", ["--topic", topic, ...producerArgs]);
  p.on("exit", res);
});

// Let the last window be analysed. With explanations on, the first one also
// pays the ~15s cold model load; the agent drains anything still in flight.
// Text and vision share one serial queue. Give the visual path enough time to
// finish after the producer stops, otherwise the demo exits with VisionPsy
// still queued and the UI truthfully reports zero completed vision calls.
await sleep(investigate && explain ? 150000 : investigate ? 75000 : explain ? 45000 : 8000);
if (keepAlive) {
  console.log("Demo stream complete. Local services remain active; press Ctrl-C to stop.");
  await new Promise(() => {});
}
await cleanup();
process.exit(0);
