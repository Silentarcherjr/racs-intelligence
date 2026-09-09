/**
 * Per-site rolling baselines — spec §14.
 *
 * The point of a baseline is that a global threshold lies. 40 ms of latency is
 * fine for a branch on a satellite link and terrible for the datacentre; an 8%
 * NXDOMAIN rate is normal where people mistype internal hostnames all day. A
 * site is only degraded relative to what that site normally does.
 */

import type { DnsEvent } from "@sentinel/dns-schema";

export type SiteBaseline = {
  siteId: string;
  latencyP50Ms: number;
  latencyP95Ms: number;
  nxdomainRate: number;
  failureRate: number;
  queryRatePerSec: number;
  /** How many windows have contributed. Below ~3 the baseline is a guess. */
  samples: number;
};

export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx]!;
}

const FAILURE_CODES = new Set(["SERVFAIL", "REFUSED", "TIMEOUT"]);

/** Raw measurements for one window at one site. */
export type WindowStats = {
  siteId: string;
  windowStart: string;
  windowEnd: string;
  count: number;
  latencyP50: number;
  latencyP95: number;
  nxdomainRate: number;
  failureRate: number;
  queryRate: number;
};

export function windowStats(siteId: string, events: DnsEvent[]): WindowStats | null {
  if (events.length === 0) return null;

  const times = events.map((e) => Date.parse(e.timestamp)).sort((a, b) => a - b);
  const start = times[0]!;
  const end = times[times.length - 1]!;
  const spanSec = Math.max(1, (end - start) / 1000);

  const latencies = events.map((e) => e.latencyMs).sort((a, b) => a - b);
  const nx = events.filter((e) => e.rcode === "NXDOMAIN").length;
  const fail = events.filter((e) => FAILURE_CODES.has(e.rcode)).length;

  return {
    siteId,
    windowStart: new Date(start).toISOString(),
    windowEnd: new Date(end).toISOString(),
    count: events.length,
    latencyP50: percentile(latencies, 50),
    latencyP95: percentile(latencies, 95),
    nxdomainRate: nx / events.length,
    failureRate: fail / events.length,
    queryRate: events.length / spanSec,
  };
}

/**
 * Exponentially weighted update, so a baseline follows real drift without one
 * bad window rewriting what "normal" means.
 */
export function updateBaseline(
  prev: SiteBaseline | undefined,
  stats: WindowStats,
  alpha = 0.3,
): SiteBaseline {
  if (!prev) {
    return {
      siteId: stats.siteId,
      latencyP50Ms: stats.latencyP50,
      latencyP95Ms: stats.latencyP95,
      nxdomainRate: stats.nxdomainRate,
      failureRate: stats.failureRate,
      queryRatePerSec: stats.queryRate,
      samples: 1,
    };
  }
  const ewma = (old: number, next: number): number => old * (1 - alpha) + next * alpha;
  return {
    siteId: stats.siteId,
    latencyP50Ms: ewma(prev.latencyP50Ms, stats.latencyP50),
    latencyP95Ms: ewma(prev.latencyP95Ms, stats.latencyP95),
    nxdomainRate: ewma(prev.nxdomainRate, stats.nxdomainRate),
    failureRate: ewma(prev.failureRate, stats.failureRate),
    queryRatePerSec: ewma(prev.queryRatePerSec, stats.queryRate),
    samples: prev.samples + 1,
  };
}

/** In-memory baseline store. Persistence is ClickHouse's job, not ours. */
export class BaselineStore {
  #byId = new Map<string, SiteBaseline>();

  get(siteId: string): SiteBaseline | undefined {
    return this.#byId.get(siteId);
  }
  observe(stats: WindowStats): SiteBaseline {
    const next = updateBaseline(this.#byId.get(stats.siteId), stats);
    this.#byId.set(stats.siteId, next);
    return next;
  }
  all(): SiteBaseline[] {
    return [...this.#byId.values()].sort((a, b) => a.siteId.localeCompare(b.siteId));
  }
}
