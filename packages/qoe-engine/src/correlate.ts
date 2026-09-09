/**
 * SOC + NOC correlation — spec §11.
 *
 * The question this answers is the one an operator actually asks at 2am:
 * "is DNS slow because the resolver is struggling, or because something on my
 * network is misbehaving?"
 *
 * Two rules govern this file:
 *   1. Say *correlated*. Never *caused*. Temporal coincidence is not causation,
 *      and a security tool that overclaims gets switched off.
 *   2. Show the reasoning. Every verdict carries the evidence that produced it.
 */

import type { Incident } from "@sentinel/dns-schema";
import type { QoeResult } from "./score.js";

export type CorrelationVerdict =
  | "LIKELY_OPERATIONAL"
  | "LIKELY_SECURITY_DRIVEN"
  | "MIXED"
  | "UNKNOWN";

export type Correlation = {
  siteId: string;
  windowEnd: string;
  qoeScore: number;
  verdict: CorrelationVerdict;
  /** 0–1. How much of the degradation the security findings account for. */
  correlationScore: number;
  reasoning: string[];
  relatedIncidentIds: string[];
};

/**
 * Which QoE penalty each threat class would plausibly move.
 *
 * This mapping is the honest core of the correlation: a DGA burst produces
 * failed lookups, so it can explain an NXDOMAIN penalty — but it has no reason
 * to explain a latency collapse. Beaconing is low-volume by design and should
 * never be blamed for degradation at all.
 */
const EXPECTED_EFFECT: Record<string, Array<keyof QoeResult["window"]["penalties"]>> = {
  possible_dga: ["nxdomain"],
  possible_tunneling: ["saturation", "latency"],
  possible_beaconing: [],
  possible_typosquatting: [],
  possible_phishing: [],
  unknown: [],
};

/** Below this the window is healthy and there is nothing to explain. */
const DEGRADED_BELOW = 75;

export function correlate(qoe: QoeResult, incidents: Incident[]): Correlation {
  const siteIncidents = incidents.filter((i) => i.siteId === qoe.window.siteId);
  const p = qoe.window.penalties;
  const totalPenalty = p.latency + p.nxdomain + p.failures + p.saturation;
  const reasoning: string[] = [];

  if (qoe.window.score >= DEGRADED_BELOW) {
    return {
      siteId: qoe.window.siteId,
      windowEnd: qoe.window.windowEnd,
      qoeScore: qoe.window.score,
      verdict: "UNKNOWN",
      correlationScore: 0,
      reasoning: [`QoE ${qoe.window.score} is not degraded; nothing to attribute.`],
      relatedIncidentIds: [],
    };
  }

  // How many penalty points can the security findings plausibly account for?
  let explained = 0;
  const related: string[] = [];
  for (const inc of siteIncidents) {
    const effects = EXPECTED_EFFECT[inc.classification] ?? [];
    const points = effects.reduce((a, k) => a + p[k], 0);
    if (points === 0) continue;
    explained += points;
    related.push(inc.id);
    reasoning.push(
      `${inc.classification} (risk ${inc.riskScore}) from ${inc.sourceHosts.join(", ")} ` +
        `is temporally correlated with ${effects.join(" and ")} degradation ` +
        `(${points} of ${totalPenalty} penalty points).`,
    );
  }

  const correlationScore = totalPenalty > 0 ? Math.min(1, explained / totalPenalty) : 0;

  let verdict: CorrelationVerdict;
  if (related.length === 0) {
    verdict = "LIKELY_OPERATIONAL";
    reasoning.push(
      `No security finding at this site accounts for the degradation. ` +
        `Dominant penalties: ${dominant(p)}. This looks like an infrastructure issue.`,
    );
  } else if (correlationScore >= 0.7) {
    verdict = "LIKELY_SECURITY_DRIVEN";
    reasoning.push(
      `${(correlationScore * 100).toFixed(0)}% of the penalty is in dimensions the ` +
        `observed findings would be expected to move. Correlation only — not proof ` +
        `that the traffic caused the degradation.`,
    );
  } else if (correlationScore >= 0.25) {
    verdict = "MIXED";
    reasoning.push(
      `Security findings account for roughly ${(correlationScore * 100).toFixed(0)}% of ` +
        `the penalty; the rest is unexplained and may be operational.`,
    );
  } else {
    verdict = "LIKELY_OPERATIONAL";
    reasoning.push(
      `Findings are present but explain little of the degradation ` +
        `(${(correlationScore * 100).toFixed(0)}%). Treat as operational first.`,
    );
  }

  return {
    siteId: qoe.window.siteId,
    windowEnd: qoe.window.windowEnd,
    qoeScore: qoe.window.score,
    verdict,
    correlationScore: Number(correlationScore.toFixed(2)),
    reasoning,
    relatedIncidentIds: related,
  };
}

function dominant(p: QoeResult["window"]["penalties"]): string {
  return Object.entries(p)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([k, v]) => `${k} -${v}`)
    .join(", ") || "none";
}
