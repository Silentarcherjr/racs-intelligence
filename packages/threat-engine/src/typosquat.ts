/**
 * Typosquatting / brand impersonation.
 *
 * Two complementary checks, because attackers use both tricks:
 *   1. Homoglyph substitution — `micr0soft`, `app1e`, `rnicrosoft`.
 *   2. Edit distance — `banesco` → `banesc0`, `banesko`.
 *
 * A hit here is *suspicion*, not proof. That distinction matters: this is the
 * detector most likely to be wrong, and it is the one that triggers visual
 * investigation (spec §8) rather than an immediate block.
 */

import type { DnsEvent } from "@sentinel/dns-schema";
import { registrableLabel } from "@sentinel/feature-engine";
import type { Detection, DetectorConfig } from "./types.js";

/** Characters attackers swap in to look like letters. */
const HOMOGLYPHS: Record<string, string> = {
  "0": "o", "1": "l", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "9": "g",
};

/** Folds a label toward what it is pretending to be. */
export function normalizeHomoglyphs(s: string): string {
  let out = "";
  for (const ch of s.toLowerCase()) out += HOMOGLYPHS[ch] ?? ch;
  return out.replace(/rn/g, "m").replace(/vv/g, "w");
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(cur[j - 1]! + 1, prev[j]! + 1, prev[j - 1]! + cost);
    }
    prev = cur;
  }
  return prev[b.length]!;
}

export function detectTyposquat(events: DnsEvent[], cfg: DetectorConfig): Detection[] {
  const bySuspect = new Map<string, DnsEvent[]>();

  /** How a suspect matched — reported honestly in the evidence. */
  const matchKind = new Map<string, "contains" | "edit_distance">();

  for (const e of events) {
    const reg = registrableLabel(e.qname);
    if (!reg) continue;
    // The genuine domain is not a squat of itself.
    if (cfg.typosquat.brands.includes(reg)) continue;

    const folded = normalizeHomoglyphs(reg);
    const stripped = folded.replace(/[^a-z]/g, "");

    for (const brand of cfg.typosquat.brands) {
      const contains = stripped.includes(brand) && reg !== brand;
      const close = levenshtein(folded, brand) <= cfg.typosquat.maxEditDistance;
      if (!contains && !close) continue;

      const key = `${brand}|${reg}`;
      const list = bySuspect.get(key);
      if (list) list.push(e);
      else bySuspect.set(key, [e]);
      // Containment is the stronger, more specific explanation, so it wins.
      matchKind.set(key, contains ? "contains" : "edit_distance");
      break; // one brand attribution per domain is enough
    }
  }

  const out: Detection[] = [];
  for (const [key, evs] of bySuspect) {
    const [brand, reg] = key.split("|") as [string, string];
    const folded = normalizeHomoglyphs(reg);
    const hosts = [...new Set(evs.map((e) => e.clientIp))];
    const substituted = folded !== reg.toLowerCase();
    const kind = matchKind.get(key) ?? "edit_distance";

    // Say what actually fired. Reporting an edit distance of 13 as evidence of
    // "similarity" would be technically true and completely misleading, and an
    // analyst who catches us doing that stops trusting every other score.
    const similarity: Detection["evidence"][number] =
      kind === "contains"
        ? {
            type: "brand_containment",
            source: "lexical",
            value: { brand, observed: reg, normalized: folded },
            weight: 30,
            description:
              `"${reg}" contains the protected brand "${brand}" as a substring ` +
              `after normalization, padded with extra words — the standard shape of a ` +
              `phishing hostname rather than a typo.`,
          }
        : {
            type: "brand_edit_distance",
            source: "lexical",
            value: { brand, observed: reg, editDistance: levenshtein(folded, brand) },
            weight: 30,
            description:
              `"${reg}" differs from the protected brand "${brand}" by ` +
              `${levenshtein(folded, brand)} character(s) after normalization.`,
          };

    const evidence: Detection["evidence"] = [
      similarity,
      {
        type: "queried_by_hosts",
        source: "behavioral",
        value: hosts.length,
        weight: hosts.length > 1 ? 15 : 5,
        description:
          hosts.length > 1
            ? `Queried by ${hosts.length} separate hosts — suggests a campaign, not one mistyped URL.`
            : `Queried by a single host.`,
      },
    ];

    if (substituted) {
      evidence.push({
        type: "homoglyph_substitution",
        source: "lexical",
        value: { observed: reg, folded },
        weight: 25,
        description:
          `Character substitution detected: "${reg}" folds to "${folded}". ` +
          `Digits standing in for letters is deliberate, not a typo.`,
      });
    }

    out.push({
      classification: "possible_typosquatting",
      siteId: evs[0]!.siteId,
      sourceHosts: hosts,
      domains: [...new Set(evs.map((e) => e.qname))],
      evidence,
    });
  }
  return out;
}
