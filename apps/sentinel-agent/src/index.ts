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
import { quietKafkaTimeoutWarning, sovereignModePanel } from "@sentinel/egress-guard";
import { Kafka, logLevel } from "kafkajs";
import type { DnsEvent, Incident } from "@sentinel/dns-schema";
import { analyzeWindow } from "@sentinel/threat-engine";
import { sendIncident, sinkFromEnv } from "@sentinel/wazuh-adapter";
import { BaselineStore, correlate, scoreAllSites } from "@sentinel/qoe-engine";
import { ClickHouseWriter } from "@sentinel/clickhouse-adapter";
import { closeRuntime, explainIncident } from "@sentinel/qvac-runtime";
import {
  analyzeScreenshot, closeSandbox, closeVision, decideNextAction, fuseVisionIntoIncident,
  renderDomain,
} from "@sentinel/evidence-engine";
import { EventWindow } from "./window.js";
import { noteDecision, noteEvents, noteInference, noteRender, startStatusServer } from "./status.js";

quietKafkaTimeoutWarning();

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
/** Active evidence acquisition: render a suspicious domain and look at it. */
const investigate = process.argv.includes("--investigate");
const explainMinRisk = Number(arg("explain-min-risk", "70"));

/**
 * Inference is serialised.
 *
 * One model is loaded once and shared; firing several completions at it
 * concurrently is a good way to make a demo stutter or worse. At roughly 5s per
 * incident, queueing is also honest about what the machine is actually doing.
 */
let inferenceChain: Promise<unknown> = Promise.resolve();
let pendingInferences = 0;

function serialise<T>(fn: () => Promise<T>): Promise<T> {
  pendingInferences++;
  const next = inferenceChain.then(fn, fn);
  inferenceChain = next.catch(() => undefined).finally(() => pendingInferences--);
  return next;
}

/**
 * Waits for queued analysis to finish before the model is unloaded.
 *
 * Without this, a SIGTERM during inference tears the QVAC worker down
 * underneath in-flight calls: the running one aborts with WORKER_SHUTDOWN and
 * everything still queued fails with MODEL_NOT_FOUND. Both surface as a
 * deterministic fallback, which looks like the model simply had nothing useful
 * to say — the failure is invisible exactly when it matters.
 */
async function drainInference(timeoutMs = 120_000): Promise<void> {
  if (pendingInferences === 0) return;
  console.log(`  waiting for ${pendingInferences} in-flight analysis job(s)…`);
  const timeout = new Promise<void>((r) => setTimeout(r, timeoutMs).unref?.());
  await Promise.race([inferenceChain.catch(() => undefined), timeout]);
}

const window = new EventWindow(opts.windowSec);

/**
 * The status line is written with \r and no newline so it overwrites itself.
 * Anything printed afterwards lands on the same physical line and shreds it —
 * which is how three analyst explanations disappeared into a progress counter.
 * Clear it before writing anything else.
 */
let statusLineOpen = false;
function say(line: string): void {
  if (statusLineOpen) {
    process.stdout.write("\r" + " ".repeat(110) + "\r");
    statusLineOpen = false;
  }
  console.log(line);
}

/** Risk at which we consider an incident worth reporting again. */
const REPORT_DELTA = 5;
const reported = new Map<string, number>();

async function report(inc: Incident): Promise<void> {
  const bar = "█".repeat(Math.round(inc.riskScore / 5)).padEnd(20, "·");
  say(`\n  ${bar} ${String(inc.riskScore).padStart(3)}  ${inc.classification}`);
  say(`  site ${inc.siteId} · confidence ${inc.confidence} · hosts ${inc.sourceHosts.join(", ")}`);
  say(`  domains: ${inc.domains.slice(0, 3).join(", ")}${inc.domains.length > 3 ? ` (+${inc.domains.length - 3})` : ""}`);
  for (const ev of inc.evidence.slice(0, 3)) {
    say(`    +${String(ev.weight).padStart(2)} [${ev.source}] ${ev.description}`);
  }

  // ── Local QVAC analysis ──────────────────────────────────────────────────
  // The model explains the evidence; it never produces or alters a risk score.
  // If it fails or returns something that does not validate, the incident goes
  // out with no explanation rather than a fabricated one.
  if (explain && inc.riskScore >= explainMinRisk) {
    try {
      const analysis = await serialise(async () => {
        const t0 = Date.now();
        const r = await explainIncident(inc);
        noteInference("text", Date.now() - t0);
        return r;
      });
      inc.explanation = analysis.summary;
      say(`  analyst: ${analysis.likely_scenario}`);
      say(`           confidence ${analysis.confidence} · ${analysis.recommended_next_action}`);
    } catch (err) {
      console.error(`  ✗ local analysis failed for ${inc.id}:`, err);
    }
  }

  // ── Active evidence acquisition (spec §8) ────────────────────────────────
  // Detection says a domain imitates a brand. That is not enough to separate a
  // parked domain from a live credential-harvesting page — so go and look.
  if (investigate) {
    const decision = decideNextAction(inc);
    const domain = inc.domains[0];
    if (decision.action === "LOCAL_RENDER" && domain) {
      say(`  investigating: ${decision.rationale}`);
      noteDecision(domain, decision.state, decision.action, decision.rationale);
      const before = inc.riskScore;
      try {
        // Through the same queue as the text model: two models competing for
        // one GPU is how a demo starts stuttering.
        const render = await serialise(() => renderDomain(domain, {
          hostResolverRules: process.env["SANDBOX_RESOLVER_RULES"],
        }));
        noteRender(render.renderMs);
        say(`  rendered in an isolated browser · ${render.renderMs} ms · ${render.screenshotPath}`);

        const findings = await serialise(async () => {
          const t = Date.now();
          const r = await analyzeScreenshot(render.screenshotPath);
          noteInference("vision", Date.now() - t);
          return r;
        });
        say(`  VisionPsy: ${findings.description}`);

        Object.assign(inc, fuseVisionIntoIncident(inc, render, findings));
        say(inc.riskScore === before
          ? `  risk unchanged at ${inc.riskScore} — the visual evidence was inconclusive`
          : `  risk ${before} → ${inc.riskScore} after local visual evidence`);
      } catch (err) {
        // An investigation that fails leaves the incident exactly as it was.
        console.error(`  ✗ visual investigation failed for ${domain}:`, err);
      }
    }
  }

  // Persisted after analysis so the stored row carries the explanation.
  ch?.writeIncident(inc);

  if (sink && inc.riskScore >= opts.alertMinRisk) {
    try {
      await sendIncident(inc, sink);
      say(`  → alert sent to Wazuh sink (${sink.name})`);
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

  startStatusServer();
  await consumer.connect();
  await consumer.subscribe({ topic: opts.topic, fromBeginning: opts.fromBeginning });
  console.log(
    `sentinel-agent · ${opts.broker} · topic ${opts.topic} · window ${opts.windowSec}s · ` +
    (sink ? `alerts→${sink.name} at risk ≥${opts.alertMinRisk}` : "alerts off") +
    (ch ? " · clickhouse on" : "") +
    (explain ? ` · QVAC explains risk ≥${explainMinRisk}` : "") +
    (investigate ? " · active investigation on" : ""),
  );

  let received = 0;
  const timer = setInterval(() => {
    const events = window.snapshot();
    if (events.length === 0) return;

    const incidents = analyzeWindow(events);
    noteEvents(received, events.length, incidents.length);
    let shown = 0;
    for (const inc of incidents) {
      const prev = reported.get(inc.id);
      if (prev !== undefined && Math.abs(inc.riskScore - prev) < REPORT_DELTA) continue;
      reported.set(inc.id, inc.riskScore);
      void report(inc);
      shown++;
    }
    // Console reporting is throttled to avoid noise, but the stored row must
    // not be. An incident detected early (say, 4 beacon check-ins) keeps
    // growing; if its risk does not move by REPORT_DELTA it is never
    // re-printed, and without this its ClickHouse row would stay stale
    // forever. ReplacingMergeTree collapses the rewrites.
    for (const inc of incidents) ch?.writeIncident(inc);

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
        say(`\n  QoE ${qoe.window.score}/100 (${qoe.grade}) · ${qoe.window.siteId}`);
        for (const line of qoe.explanation) say(`    ${line}`);
        if (corr.verdict !== "UNKNOWN") {
          say(`    verdict: ${corr.verdict} (correlation ${corr.correlationScore})`);
          for (const r of corr.reasoning) say(`      ${r}`);
        }
      }
    }

    if (storeEvents) for (const e of events) ch?.writeEvent(e);
    void ch?.flush().catch((err: unknown) =>
      console.error("  ✗ ClickHouse write failed:", err));

    if (shown === 0) {
      // Only on a terminal: \r overwrites a line on a TTY, but in a redirected
      // log it is just a character, and the "cleared" line leaves 110 spaces
      // of debris in front of every real message.
      if (process.stdout.isTTY) {
        process.stdout.write(
          `\r  ${received} events · window ${events.length} · ${incidents.length} incident(s) · ` +
          `QoE ${qoeResults.map((q) => `${q.window.siteId}=${q.window.score}`).join(" ")}   `,
        );
        statusLineOpen = true;
      }
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
    if (explain || investigate) {
      await drainInference();
      await closeRuntime().catch(() => undefined);
      await closeVision().catch(() => undefined);
      await closeSandbox().catch(() => undefined);
    }
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
