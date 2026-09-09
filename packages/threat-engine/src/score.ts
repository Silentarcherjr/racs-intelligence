/**
 * Turning detections into incidents.
 *
 * All risk arithmetic lives here and nowhere else. The score is a plain weighted
 * sum of evidence produced by deterministic detectors — no model touches it.
 * That is the whole point: an analyst can be shown exactly which findings added
 * which points (spec §5, principles 2 and 3).
 */

import { createHash } from "node:crypto";
import type { Incident, ThreatEvidence } from "@sentinel/dns-schema";
import type { Detection } from "./types.js";

/** Risk is the sum of evidence weights, capped at 100. Nothing hidden. */
export function riskFromEvidence(evidence: ThreatEvidence[]): number {
  const total = evidence.reduce((a, e) => a + e.weight, 0);
  return Math.max(0, Math.min(100, Math.round(total)));
}

/**
 * Confidence reflects how *corroborated* a finding is, not how bad it is.
 *
 * Evidence from several independent sources (lexical + behavioral + vision)
 * is worth more than three restatements of the same observation.
 */
export function confidenceFromEvidence(evidence: ThreatEvidence[]): number {
  const distinctSources = new Set(evidence.map((e) => e.source)).size;
  const base = Math.min(evidence.length / 4, 1) * 0.6;
  const corroboration = Math.min(distinctSources / 3, 1) * 0.4;
  return Number((base + corroboration).toFixed(2));
}

const ACTIONS: Record<string, string> = {
  possible_dga:
    "Isolate the host and inspect running processes; the query pattern suggests malware searching for a live C2 domain.",
  possible_tunneling:
    "Capture full DNS payloads for this zone and review what data is leaving; consider blocking the parent zone at the resolver.",
  possible_beaconing:
    "Correlate the check-in times with process and network telemetry on the host to identify what is calling out.",
  possible_typosquatting:
    "Verify the destination before blocking. Visual inspection in the local sandbox will confirm or clear a phishing page.",
  possible_phishing:
    "Block the domain and check whether any user submitted credentials to it.",
  unknown: "Collect further evidence before acting.",
};

/** Stable id so the same window always produces the same incident id. */
function incidentId(d: Detection): string {
  const material = [d.classification, d.siteId, ...d.sourceHosts.sort(), ...d.domains.sort()].join("|");
  return createHash("sha256").update(material).digest("hex").slice(0, 16);
}

/**
 * @param windowEnd ISO timestamp of the end of the analysed window. Passed in
 *   rather than read from the clock so demo runs are byte-reproducible
 *   (AGENTS.md §7, "determinism in demos").
 */
export function toIncident(d: Detection, windowEnd: string): Incident {
  const evidence = [...d.evidence].sort((a, b) => b.weight - a.weight);
  return {
    id: incidentId(d),
    createdAt: windowEnd,
    updatedAt: windowEnd,
    siteId: d.siteId,
    sourceHosts: d.sourceHosts,
    domains: d.domains,
    classification: d.classification,
    riskScore: riskFromEvidence(evidence),
    confidence: confidenceFromEvidence(evidence),
    evidence,
    recommendedAction: ACTIONS[d.classification] ?? ACTIONS["unknown"]!,
  };
}
