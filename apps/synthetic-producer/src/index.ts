/**
 * Synthetic DNS producer — board item 2.
 *
 * Two modes, deliberately:
 *
 *   --source fixture   replays the committed 66-event file. Byte-identical
 *                      every run, so the demo tells the same story on stage.
 *   --source generate  produces an open-ended seeded stream, so the pipeline
 *                      can be shown running rather than replaying a recording.
 *
 * Both speak the same Kafka topic. `--dry-run` prints to stdout instead, which
 * makes the producer testable with no broker at all.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { quietKafkaTimeoutWarning } from "@sentinel/egress-guard";
import { Kafka, logLevel } from "kafkajs";
import type { DnsEvent } from "@sentinel/dns-schema";
import { mulberry32 } from "./rng.js";
import { SCENARIOS, tick, type ScenarioName } from "./scenarios.js";

quietKafkaTimeoutWarning();

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE = resolve(here, "../../../datasets/synthetic/sample-events.json");

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}
const flag = (name: string): boolean => process.argv.includes(`--${name}`);

const opts = {
  broker: arg("broker", process.env["KAFKA_BROKER"] ?? "localhost:9092"),
  topic: arg("topic", process.env["KAFKA_TOPIC_DNS"] ?? "dns.events.raw"),
  source: arg("source", "generate") as "fixture" | "generate",
  scenario: arg("scenario", "all"),
  rate: Number(arg("rate", "10")),        // events per second, generate mode
  duration: Number(arg("duration", "60")), // seconds, 0 = forever
  seed: Number(arg("seed", "20260909")),
  speed: Number(arg("speed", "1")),        // fixture replay multiplier
  dryRun: flag("dry-run"),
};

const active: ScenarioName[] =
  opts.scenario === "all"
    ? SCENARIOS
    : (opts.scenario.split(",").map((s) => s.trim()) as ScenarioName[]);

for (const s of active) {
  if (!SCENARIOS.includes(s)) {
    console.error(`unknown scenario "${s}". known: ${SCENARIOS.join(", ")}`);
    process.exit(1);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main(): Promise<void> {
  const kafka = new Kafka({
    clientId: "sentinel-synthetic-producer",
    brokers: [opts.broker],
    logLevel: logLevel.ERROR,
  });
  const producer = opts.dryRun ? null : kafka.producer();

  if (producer) {
    await producer.connect();
    console.error(`→ ${opts.broker} topic=${opts.topic}`);
  } else {
    console.error(`→ dry run (no broker)`);
  }

  let sent = 0;
  const emit = async (events: DnsEvent[]): Promise<void> => {
    if (events.length === 0) return;
    sent += events.length;
    if (producer) {
      await producer.send({
        topic: opts.topic,
        // Key by client so one host's events keep their order in a partition —
        // beaconing detection depends on interval order being trustworthy.
        messages: events.map((e) => ({ key: e.clientIp, value: JSON.stringify(e) })),
      });
    } else {
      for (const e of events) console.log(JSON.stringify(e));
    }
  };

  if (opts.source === "fixture") {
    const events = JSON.parse(readFileSync(FIXTURE, "utf8")) as DnsEvent[];
    console.error(`replaying ${events.length} fixture events at ${opts.speed}×`);
    let prev: number | null = null;
    for (const e of events) {
      const t = Date.parse(e.timestamp);
      if (prev !== null && opts.speed > 0) await sleep(((t - prev) / opts.speed));
      prev = t;
      await emit([e]);
    }
  } else {
    const rng = mulberry32(opts.seed);
    const started = Date.now();
    console.error(
      `generating ${opts.rate}/s · scenarios: ${active.join(", ")} · ` +
      `${opts.duration ? opts.duration + "s" : "until stopped"} · seed ${opts.seed}`,
    );
    for (;;) {
      const now = new Date();
      await emit(tick({ rng, at: now }, active, Math.max(1, Math.round(opts.rate / 5))));
      if (opts.duration && (Date.now() - started) / 1000 >= opts.duration) break;
      await sleep(200);
    }
  }

  console.error(`sent ${sent} events`);
  await producer?.disconnect();
}

let closing = false;
for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    if (closing) process.exit(1);
    closing = true;
    console.error("\nstopping…");
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("producer failed:", err);
  process.exit(1);
});
