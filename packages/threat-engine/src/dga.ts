/**
 * DGA detection — malware generating throwaway domains to find its C2.
 *
 * The tell is not one weird name, it is a *host* producing many high-entropy
 * names that mostly fail to resolve. A single odd domain is noise; twenty of
 * them from one endpoint, nearly all NXDOMAIN, is a pattern.
 */

import type { DnsEvent } from "@sentinel/dns-schema";
import { entropy, lexicalFeatures, vowelRatio } from "@sentinel/feature-engine";
import { hostBehaviors } from "@sentinel/feature-engine";
import type { Detection, DetectorConfig } from "./types.js";

export function detectDga(events: DnsEvent[], cfg: DetectorConfig): Detection[] {
  const out: Detection[] = [];

  for (const host of hostBehaviors(events)) {
    const hostEvents = events.filter((e) => e.clientIp === host.clientIp);
    const failed = hostEvents.filter((e) => e.rcode === "NXDOMAIN");
    if (failed.length === 0) continue;

    const regs = [...new Set(failed.map((e) => lexicalFeatures(e.qname).registrable))]
      .filter(Boolean);
    if (regs.length < cfg.dga.minUniqueDomains) continue;
    if (host.nxdomainRate < cfg.dga.minNxdomainRate) continue;

    const meanEntropy = regs.reduce((a, r) => a + entropy(r), 0) / regs.length;
    const meanVowel = regs.reduce((a, r) => a + vowelRatio(r), 0) / regs.length;
    if (meanEntropy < cfg.dga.minEntropy) continue;
    if (meanVowel > cfg.dga.maxVowelRatio) continue;

    out.push({
      classification: "possible_dga",
      siteId: host.siteId,
      sourceHosts: [host.clientIp],
      domains: [...new Set(failed.map((e) => e.qname))].sort().slice(0, 20),
      evidence: [
        {
          type: "nxdomain_rate",
          source: "behavioral",
          value: Number(host.nxdomainRate.toFixed(3)),
          weight: 25,
          description:
            `${(host.nxdomainRate * 100).toFixed(0)}% of this host's lookups failed ` +
            `(${host.nxdomainCount} of ${host.queryCount}) — typical of a host cycling ` +
            `through generated domains until one resolves.`,
        },
        {
          type: "unique_failed_domains",
          source: "behavioral",
          value: regs.length,
          weight: 20,
          description:
            `${regs.length} distinct non-resolving domains from a single host in the window.`,
        },
        {
          type: "name_entropy",
          source: "lexical",
          value: Number(meanEntropy.toFixed(2)),
          weight: 20,
          description:
            `Mean character entropy of ${meanEntropy.toFixed(2)} bits — ` +
            `machine-generated names, not words a person would type.`,
        },
        {
          type: "vowel_ratio",
          source: "lexical",
          value: Number(meanVowel.toFixed(3)),
          weight: 10,
          description:
            `Vowel ratio ${meanVowel.toFixed(2)}: too low for natural language.`,
        },
      ],
    });
  }
  return out;
}
