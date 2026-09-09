/**
 * Sentinel agent — the consumer side of the pipeline (board items 3 and 4).
 *
 *   Kafka → window → deterministic detection → incident
 *
 * The QVAC explanation and the Wazuh alert plug in where marked; both are other
 * lanes' work and are deliberately not stubbed with fake output here.
 */

import { Kafka, logLevel } from "kafkajs";
import type { DnsEvent, Incident } from "@sentinel/dns-schema";
import { analyzeWindow } from "@sentinel/threat-engine";
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
};

const window = new EventWindow(opts.windowSec);

/** Risk at which we consider an incident worth reporting again. */
const REPORT_DELTA = 5;
const reported = new Map<string, number>();

function report(inc: Incident): void {
  const bar = "█".repeat(Math.round(inc.riskScore / 5)).padEnd(20, "·");
  console.log(`\n  ${bar} ${String(inc.riskScore).padStart(3)}  ${inc.classification}`);
  console.log(`  site ${inc.siteId} · confidence ${inc.confidence} · hosts ${inc.sourceHosts.join(", ")}`);
  console.log(`  domains: ${inc.domains.slice(0, 3).join(", ")}${inc.domains.length > 3 ? ` (+${inc.domains.length - 3})` : ""}`);
  for (const ev of inc.evidence.slice(0, 3)) {
    console.log(`    +${String(ev.weight).padStart(2)} [${ev.source}] ${ev.description}`);
  }

  // ── Integration points, owned by other lanes (AGENTS.md §5) ──────────────
  // Dev 2: incident.explanation = await explainIncident(incident)  — QVAC, local
  // Dev 3: await wazuh.send(incident)  /  await clickhouse.writeQoe(window)
  // Left unwired on purpose: a fake explanation here would be worse than none.
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
  console.log(`sentinel-agent · ${opts.broker} · topic ${opts.topic} · window ${opts.windowSec}s`);

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
      report(inc);
      shown++;
    }
    if (shown === 0) {
      process.stdout.write(
        `\r  ${received} events · window ${events.length} · ${incidents.length} incident(s) · no change   `,
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
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("agent failed:", err);
  process.exit(1);
});
