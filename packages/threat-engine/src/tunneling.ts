/**
 * DNS tunneling — using DNS as a transport to move data out.
 *
 * The signature is structural: one parent zone receiving many long, unique,
 * high-entropy subdomains, usually over record types that can carry a payload
 * back (TXT, NULL, CNAME). Nobody's CDN looks like that.
 */

import type { DnsEvent } from "@sentinel/dns-schema";
import { entropy, labels, zoneBehaviors } from "@sentinel/feature-engine";
import type { Detection, DetectorConfig } from "./types.js";

export function detectTunneling(events: DnsEvent[], cfg: DetectorConfig): Detection[] {
  const out: Detection[] = [];

  for (const zone of zoneBehaviors(events)) {
    if (zone.queryCount < cfg.tunneling.minQueries) continue;
    if (zone.meanSubdomainLength < cfg.tunneling.minSubdomainLength) continue;

    const zoneEvents = events.filter((e) => {
      const ls = labels(e.qname);
      const parent = ls.length > 2 ? ls.slice(1).join(".") : ls.join(".");
      return parent === zone.parentZone;
    });

    const subs = zoneEvents.map((e) => labels(e.qname)[0] ?? "");
    const meanEntropy = subs.reduce((a, s) => a + entropy(s), 0) / subs.length;

    const evidence: Detection["evidence"] = [
      {
        type: "subdomain_length",
        source: "lexical",
        value: Number(zone.meanSubdomainLength.toFixed(1)),
        weight: 25,
        description:
          `Mean subdomain length ${zone.meanSubdomainLength.toFixed(0)} characters ` +
          `(max ${zone.maxSubdomainLength}) under "${zone.parentZone}" — ` +
          `consistent with encoded payload, not hostnames.`,
      },
      {
        type: "subdomain_uniqueness",
        source: "behavioral",
        value: { unique: zone.uniqueSubdomains, total: zone.queryCount },
        weight: 20,
        description:
          `${zone.uniqueSubdomains} unique subdomains across ${zone.queryCount} queries — ` +
          `almost no caching, as expected when each query carries different data.`,
      },
      {
        type: "subdomain_entropy",
        source: "lexical",
        value: Number(meanEntropy.toFixed(2)),
        weight: 20,
        description: `Mean subdomain entropy ${meanEntropy.toFixed(2)} bits.`,
      },
    ];

    if (zone.payloadQtypeRatio >= cfg.tunneling.minPayloadQtypeRatio) {
      evidence.push({
        type: "payload_qtype_ratio",
        source: "stream",
        value: Number(zone.payloadQtypeRatio.toFixed(2)),
        weight: 25,
        description:
          `${(zone.payloadQtypeRatio * 100).toFixed(0)}% of queries use TXT/NULL/CNAME — ` +
          `record types chosen for carrying data back to the client.`,
      });
    }

    out.push({
      classification: "possible_tunneling",
      siteId: zone.siteId,
      sourceHosts: zone.clientIps,
      domains: [zone.parentZone],
      evidence,
    });
  }
  return out;
}
