/**
 * Beaconing — an implant checking in with its controller on a fixed cadence.
 *
 * Humans and normal software are bursty. A conversation whose interval barely
 * varies is being driven by a timer, and that is worth a look even when the
 * domain itself resolves and looks unremarkable.
 */

import type { DnsEvent } from "@sentinel/dns-schema";
import { conversationBehaviors } from "@sentinel/feature-engine";
import type { Detection, DetectorConfig } from "./types.js";

export function detectBeaconing(events: DnsEvent[], cfg: DetectorConfig): Detection[] {
  const out: Detection[] = [];

  for (const conv of conversationBehaviors(events)) {
    if (conv.queryCount < cfg.beaconing.minQueries) continue;
    if (conv.meanIntervalSec < cfg.beaconing.minIntervalSec) continue;
    if (conv.meanIntervalSec > cfg.beaconing.maxIntervalSec) continue;
    if (conv.intervalCv > cfg.beaconing.maxIntervalCv) continue;

    out.push({
      classification: "possible_beaconing",
      siteId: conv.siteId,
      sourceHosts: [conv.clientIp],
      domains: [conv.qname],
      evidence: [
        {
          type: "interval_regularity",
          source: "behavioral",
          value: Number(conv.intervalCv.toFixed(4)),
          weight: 35,
          description:
            `Interval variation coefficient ${conv.intervalCv.toFixed(3)} — ` +
            `the gap between queries barely changes. Timer-driven, not human.`,
        },
        {
          type: "beacon_period",
          source: "behavioral",
          value: Number(conv.meanIntervalSec.toFixed(1)),
          weight: 20,
          description:
            `Contacted every ${conv.meanIntervalSec.toFixed(0)} seconds, ` +
            `${conv.queryCount} times between ${conv.firstSeen} and ${conv.lastSeen}.`,
        },
        {
          type: "single_destination",
          source: "behavioral",
          value: conv.qname,
          weight: 10,
          description:
            `All check-ins target one name ("${conv.qname}") from one host.`,
        },
      ],
    });
  }
  return out;
}
