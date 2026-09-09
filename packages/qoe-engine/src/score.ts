/**
 * DNS Quality of Experience scoring — spec §7 MVP-5.
 *
 *   QoE = 100 - latency - nxdomain - failures - saturation
 *
 * Every penalty is bounded and every penalty can be read back as a sentence.
 * A score nobody can explain is a number an operator learns to ignore, and the
 * whole SOC/NOC correlation story depends on this being trusted.
 *
 * Penalties are measured against the site's own baseline (spec §14). Falling
 * back to fixed reference values happens only while a baseline is still thin,
 * and the result says so rather than pretending to know.
 */

import type { QoeWindow } from "@sentinel/dns-schema";
import type { SiteBaseline, WindowStats } from "./baseline.js";

/** Ceilings, so no single dimension can sink a score on its own. */
export const MAX_PENALTY = {
  latency: 30,
  nxdomain: 25,
  failures: 25,
  saturation: 20,
} as const;

/** Used only until a site has enough history. Deliberately generous. */
const COLD_START = {
  latencyP95Ms: 60,
  nxdomainRate: 0.05,
  failureRate: 0.01,
  queryRatePerSec: 50,
};

/** Below this many observed windows a baseline is a guess, not a reference. */
export const MIN_BASELINE_SAMPLES = 3;

export type QoeGrade = "excellent" | "good" | "degraded" | "poor" | "critical";

export function grade(score: number): QoeGrade {
  if (score >= 90) return "excellent";
  if (score >= 75) return "good";
  if (score >= 60) return "degraded";
  if (score >= 40) return "poor";
  return "critical";
}

const clamp = (v: number, max: number): number =>
  Math.max(0, Math.min(max, Math.round(v)));

export type QoeResult = {
  window: QoeWindow;
  grade: QoeGrade;
  /** One line per penalty actually applied, highest first. */
  explanation: string[];
  usedBaseline: boolean;
};

export function scoreWindow(
  stats: WindowStats,
  baseline: SiteBaseline | undefined,
): QoeResult {
  const warm = baseline !== undefined && baseline.samples >= MIN_BASELINE_SAMPLES;
  const ref = warm
    ? {
        latencyP95Ms: baseline.latencyP95Ms,
        nxdomainRate: baseline.nxdomainRate,
        failureRate: baseline.failureRate,
        queryRatePerSec: baseline.queryRatePerSec,
      }
    : COLD_START;

  const explanation: string[] = [];

  // Latency: how many times worse than this site's usual p95.
  const latencyRatio = ref.latencyP95Ms > 0 ? stats.latencyP95 / ref.latencyP95Ms : 1;
  const latency = clamp((latencyRatio - 1) * 20, MAX_PENALTY.latency);
  if (latency > 0) {
    explanation.push(
      `-${latency} p95 latency ${stats.latencyP95.toFixed(0)} ms vs ` +
        `${ref.latencyP95Ms.toFixed(0)} ms ${warm ? "site baseline" : "cold-start reference"} ` +
        `(${latencyRatio.toFixed(1)}×)`,
    );
  }

  // NXDOMAIN: excess in percentage points over the site's normal rate.
  const nxExcess = Math.max(0, stats.nxdomainRate - ref.nxdomainRate);
  const nxdomain = clamp(nxExcess * 100 * 1.5, MAX_PENALTY.nxdomain);
  if (nxdomain > 0) {
    explanation.push(
      `-${nxdomain} NXDOMAIN ${(stats.nxdomainRate * 100).toFixed(1)}% vs ` +
        `${(ref.nxdomainRate * 100).toFixed(1)}% normal ` +
        `(+${(nxExcess * 100).toFixed(1)} points)`,
    );
  }

  // Hard failures hurt more than a miss: the resolver answered wrongly or not at all.
  const failExcess = Math.max(0, stats.failureRate - ref.failureRate);
  const failures = clamp(failExcess * 100 * 2.5, MAX_PENALTY.failures);
  if (failures > 0) {
    explanation.push(
      `-${failures} SERVFAIL/timeout ${(stats.failureRate * 100).toFixed(1)}% vs ` +
        `${(ref.failureRate * 100).toFixed(1)}% normal`,
    );
  }

  // Saturation: unusual query volume, which precedes latency collapse.
  const loadRatio = ref.queryRatePerSec > 0 ? stats.queryRate / ref.queryRatePerSec : 1;
  const saturation = clamp((loadRatio - 1.5) * 15, MAX_PENALTY.saturation);
  if (saturation > 0) {
    explanation.push(
      `-${saturation} query rate ${stats.queryRate.toFixed(1)}/s vs ` +
        `${ref.queryRatePerSec.toFixed(1)}/s normal (${loadRatio.toFixed(1)}×)`,
    );
  }

  const score = Math.max(0, 100 - latency - nxdomain - failures - saturation);
  explanation.sort((a, b) => {
    const n = (s: string): number => Number(s.match(/^-(\d+)/)?.[1] ?? 0);
    return n(b) - n(a);
  });
  if (explanation.length === 0) explanation.push("no penalties applied");
  if (!warm) {
    explanation.push(
      `note: site baseline has ${baseline?.samples ?? 0} sample(s); ` +
        `fixed reference values used until ${MIN_BASELINE_SAMPLES}`,
    );
  }

  return {
    window: {
      siteId: stats.siteId,
      windowStart: stats.windowStart,
      windowEnd: stats.windowEnd,
      score,
      latencyP50: Number(stats.latencyP50.toFixed(1)),
      latencyP95: Number(stats.latencyP95.toFixed(1)),
      nxdomainRate: Number(stats.nxdomainRate.toFixed(4)),
      failureRate: Number(stats.failureRate.toFixed(4)),
      queryRate: Number(stats.queryRate.toFixed(2)),
      penalties: { latency, nxdomain, failures, saturation },
    },
    grade: grade(score),
    explanation,
    usedBaseline: warm,
  };
}
