/**
 * Demo runner: read a window of DNS events, print the incidents found.
 *
 *   npm run demo -w @sentinel/threat-engine
 *   node packages/threat-engine/dist/cli.js path/to/events.json
 *
 * Deterministic by construction — same input file, same output, every time.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { DnsEvent } from "@sentinel/dns-schema";
import { analyzeWindow } from "./index.js";

const here = dirname(fileURLToPath(import.meta.url));
const DEFAULT_FIXTURE = resolve(here, "../../../datasets/synthetic/sample-events.json");

const path = process.argv[2] ?? DEFAULT_FIXTURE;
const events = JSON.parse(readFileSync(path, "utf8")) as DnsEvent[];
const incidents = analyzeWindow(events);

const sites = [...new Set(events.map((e) => e.siteId))].join(", ");
console.log(`\n  ${events.length} DNS events · sites: ${sites}`);
console.log(`  ${incidents.length} incident(s)\n`);

for (const inc of incidents) {
  const bar = "█".repeat(Math.round(inc.riskScore / 5)).padEnd(20, "·");
  console.log(`  ${bar} ${String(inc.riskScore).padStart(3)}  ${inc.classification}`);
  console.log(`  ${" ".repeat(20)}      confidence ${inc.confidence} · site ${inc.siteId}`);
  console.log(`  hosts:   ${inc.sourceHosts.join(", ")}`);

  const shown = inc.domains.slice(0, 3).join(", ");
  const more = inc.domains.length > 3 ? ` (+${inc.domains.length - 3} more)` : "";
  console.log(`  domains: ${shown}${more}`);

  console.log(`  evidence:`);
  for (const ev of inc.evidence) {
    console.log(`    +${String(ev.weight).padStart(2)}  [${ev.source}] ${ev.description}`);
  }
  console.log(`  action:  ${inc.recommendedAction}\n`);
}

if (incidents.length === 0) console.log("  (nothing suspicious in this window)\n");
