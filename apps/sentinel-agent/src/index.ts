/**
 * Sentinel agent — the consumer side of the pipeline (board items 3 and 4).
 *
 *   Kafka → window → deterministic detection → incident
 *
 * The QVAC explanation and the Wazuh alert plug in where marked; both are other
 * lanes' work and are deliberately not stubbed with fake output here.
 */

// MUST be first: arms the egress guard before any module can open a socket.
import "./egress.js";
import { sovereignModePanel } from "@sentinel/egress-guard";
import { Kafka, logLevel } from "kafkajs";
import type { DnsEvent, Incident } from "@sentinel/dns-schema";
import { analyzeWindow } from "@sentinel/threat-engine";
import { sendIncident, sinkFromEnv } from "@sentinel/wazuh-adapter";
import { BaselineStore, correlate, scoreAllSites } from "@sentinel/qoe-engine";
import { ClickHouseWriter } from "@sentinel/clickhouse-adapter";
import { closeRuntime, explainIncident } from "@sentinel/qvac-runtime";
import { EventWindow } from "./window.js";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}

const opts = {
  broker: arg("broker", process.env["KAFKA_BROKER"] ?? "localhost:9092"),
  topic: arg("topic", process.env["KAFKA_TOPIC_DNS"] ?? "dns.events.raw"),
  group: arg("group", "sentinel-agent"),
  windowSec: Number(arg("window", "300")),
  analyzeEverySec: Number(arg("interval", "5")),
  fromBeginning: !process.argv.includes("--from-latest"),
  /** Below this risk we log locally but do not page a SOC. */
  alertMinRisk: Number(arg("alert-min-risk", "50")),
  alerts: !process.argv.includes("--no-alerts"),
};

const ch = process.argv.includes("--clickhouse") ? new ClickHouseWriter() : null;
/** Raw events are opt-in: at real DNS volume that table dwarfs all the others. */
const storeEvents = process.argv.includes("--store-events");
const sink = opts.alerts ? sinkFromEnv() : null;
const baselines = new BaselineStore();

/** Local QVAC explanations. Off by default: it needs the weights on disk. */
const explain = process.argv.includes("--explain");
const explainMinRisk = Number(arg("explain-min-risk", "70"));

/**
 * Inference is serialised.
 *
 * One model is loaded once and shared; firing several completions at it
 * concurrently is a good way to make a demo stutter or worse. At roughly 5s per
 * incident, queueing is also honest about what the machine is actually doing.
 */
let inferenceChain: Promise<unknown> = Promise.resolve();
function serialise<T>(fn: () => Promise<T>): Promise<T> {
  const next = inferenceChain.then(fn, fn);
  inferenceChain = next.catch(() => undefined);
  return next;
}

const window = new EventWindow(opts.windowSec);

/** Risk at which we consider an incident worth reporting again. */
const REPORT_DELTA = 5;
const reported = new Map<string, number>();

async function report(inc: Incident): Promise<void> {
  const bar = "█".repeat(Math.round(inc.riskScore / 5)).padEnd(20, "·");
  console.log(`\n  ${bar} ${String(inc.riskScore).padStart(3)}  ${inc.classification}`);
  console.log(`  site ${inc.siteId} · confidence ${inc.confidence} · hosts ${inc.sourceHosts.join(", ")}`);
  console.log(`  domains: ${inc.domains.slice(0, 3).join(", ")}${inc.domains.length > 3 ? ` (+${inc.domains.length - 3})` : ""}`);
  for (const ev of inc.evidence.slice(0, 3)) {
    console.log(`    +${String(ev.weight).padStart(2)} [${ev.source}] ${ev.description}`);
  }

  // ── Local QVAC analysis ──────────────────────────────────────────────────
  // The model explains the evidence; it never produces or alters a risk score.
  // If it fails or returns something that does not validate, the incident goes
  // out with no explanation rather than a fabricated one.
  if (explain && inc.riskScore >= explainMinRisk) {
    try {
      const analysis = await serialise(() => explainIncident(inc));
      inc.explanation = analysis.summary;
      console.log(`  analyst: ${analysis.likely_scenario}`);
      console.log(`           confidence ${analysis.confidence} · ${analysis.recommended_next_action}`);
    } catch (err) {
      console.error(`  ✗ local analysis failed for ${inc.id}:`, err);
    }
  }

  // Persisted after analysis so the stored row carries the explanation.
  ch?.writeIncident(inc);

  if (sink && inc.riskScore >= opts.alertMinRisk) {
    try {
      await sendIncident(inc, sink);
      console.log(`  → alert sent to Wazuh sink (${sink.name})`);
    } catch (err) {
      // A dropped security alert must never be silent.
      console.error(`  ✗ FAILED to deliver alert ${inc.id}:`, err);
    }
  }
}

async function main(): Promise<void> {
  const kafka = new Kafka({
    clientId: "sentinel-agent",
    brokers: [opts.broker],
    logLevel: logLevel.ERROR,
  });
  const consumer = kafka.consumer({ groupId: opts.group });

  await consumer.connect();
  await consumer.subscribe({ topic: opts.topic, fromBeginning: opts.fromBeginning });
  console.log(
    `sentinel-agent · ${opts.broker} · topic ${opts.topic} · window ${opts.windowSec}s · ` +
    (sink ? `alerts→${sink.name} at risk ≥${opts.alertMinRisk}` : "alerts off") +
    (ch ? " · clickhouse on" : "") +
    (explain ? ` · QVAC explains risk ≥${explainMinRisk}` : ""),
  );

  let received = 0;
  const timer = setInterval(() => {
    const events = window.snapshot();
    if (events.length === 0) return;

    const incidents = analyzeWindow(events);
    let shown = 0;
    for (const inc of incidents) {
      const prev = reported.get(inc.id);
      if (prev !== undefined && Math.abs(inc.riskScore - prev) < REPORT_DELTA) continue;
      reported.set(inc.id, inc.riskScore);
      void report(inc);
      shown++;
    }
    // ── QoE per site, then SOC↔NOC attribution (spec §7 MVP-5, §11) ───────
    const qoeResults = scoreAllSites(events, baselines);
    for (const qoe of qoeResults) {
      const corr = correlate(qoe, incidents);
      ch?.writeQoe(qoe);
      ch?.writeCorrelation(corr);
      const base = baselines.get(qoe.window.siteId);
      if (base) ch?.writeBaseline(base, qoe.window.windowEnd);

      const key = `qoe:${qoe.window.siteId}`;
      const prev = reported.get(key);
      if (prev === undefined || Math.abs(qoe.window.score - prev) >= REPORT_DELTA) {
        reported.set(key, qoe.window.score);
        console.log(`\n  QoE ${qoe.window.score}/100 (${qoe.grade}) · ${qoe.window.siteId}`);
        for (const line of qoe.explanation) console.log(`    ${line}`);
        if (corr.verdict !== "UNKNOWN") {
          console.log(`    verdict: ${corr.verdict} (correlation ${corr.correlationScore})`);
          for (const r of corr.reasoning) console.log(`      ${r}`);
        }
      }
    }

    if (storeEvents) for (const e of events) ch?.writeEvent(e);
    void ch?.flush().catch((err: unknown) =>
      console.error("  ✗ ClickHouse write failed:", err));

    if (shown === 0) {
      process.stdout.write(
        `\r  ${received} events · window ${events.length} · ${incidents.length} incident(s) · ` +
        `QoE ${qoeResults.map((q) => `${q.window.siteId}=${q.window.score}`).join(" ")}   `,
      );
    }
  }, opts.analyzeEverySec * 1000);

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;
      try {
        window.add(JSON.parse(message.value.toString()) as DnsEvent);
        received++;
      } catch (err) {
        // Log loudly, never swallow — a malformed event must be visible.
        console.error("skipping unparseable message:", err);
      }
    },
  });

  const shutdown = async (): Promise<void> => {
    clearInterval(timer);
    await consumer.disconnect();
    // Flush before exiting, or the final window silently never lands.
    await ch?.close().catch((err: unknown) => console.error("final flush failed:", err));
    if (explain) await closeRuntime().catch(() => undefined);
    // The proof panel is printed from real counters, not from a constant.
    console.log(sovereignModePanel({
      "Current model": explain ? "qvac/MedPsy-4B-GGUF q4_k_m-imat" : "none loaded",
      "Execution device": explain ? "Apple Silicon GPU (Metal), local" : "n/a",
    }));
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("agent failed:", err);
  process.exit(1);
});
