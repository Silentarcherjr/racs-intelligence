/**
 * Behavioral features — what a host *does* over a window, not what a name looks
 * like. Pure and deterministic, like the lexical side.
 *
 * Scope note: latency/QoE statistics deliberately live in `@sentinel/qoe-engine`
 * (Dev 3's lane, AGENTS.md §5). This module only produces security features.
 */

import type { DnsEvent } from "@sentinel/dns-schema";
import { labels, registrableLabel } from "./lexical.js";

/** Everything one client host did in the window. */
export type HostBehavior = {
  clientIp: string;
  siteId: string;
  queryCount: number;
  uniqueDomains: number;
  nxdomainCount: number;
  nxdomainRate: number;
  distinctZones: number;
};

/** One (host → domain) conversation, used for periodicity analysis. */
export type ConversationBehavior = {
  clientIp: string;
  qname: string;
  siteId: string;
  queryCount: number;
  /** Seconds between consecutive queries, in order. */
  intervalsSec: number[];
  meanIntervalSec: number;
  /** Stddev / mean. Near 0 means a machine-regular cadence. */
  intervalCv: number;
  firstSeen: string;
  lastSeen: string;
};

/** Traffic aggregated under one parent zone — the shape tunneling shows up in. */
export type ZoneBehavior = {
  parentZone: string;
  siteId: string;
  queryCount: number;
  uniqueSubdomains: number;
  meanSubdomainLength: number;
  maxSubdomainLength: number;
  /** Fraction of queries using TXT / NULL / CNAME. */
  payloadQtypeRatio: number;
  clientIps: string[];
};

const PAYLOAD_QTYPES = new Set(["TXT", "NULL", "CNAME"]);

function toEpochSec(iso: string): number {
  return Date.parse(iso) / 1000;
}

export function hostBehaviors(events: DnsEvent[]): HostBehavior[] {
  const byHost = new Map<string, DnsEvent[]>();
  for (const e of events) {
    const list = byHost.get(e.clientIp);
    if (list) list.push(e);
    else byHost.set(e.clientIp, [e]);
  }

  const out: HostBehavior[] = [];
  for (const [clientIp, evs] of byHost) {
    const nx = evs.filter((e) => e.rcode === "NXDOMAIN").length;
    out.push({
      clientIp,
      siteId: evs[0]!.siteId,
      queryCount: evs.length,
      uniqueDomains: new Set(evs.map((e) => e.qname)).size,
      nxdomainCount: nx,
      nxdomainRate: nx / evs.length,
      distinctZones: new Set(evs.map((e) => e.zone)).size,
    });
  }
  return out.sort((a, b) => b.queryCount - a.queryCount);
}

export function conversationBehaviors(events: DnsEvent[]): ConversationBehavior[] {
  const byPair = new Map<string, DnsEvent[]>();
  for (const e of events) {
    const key = `${e.clientIp}|${e.qname}`;
    const list = byPair.get(key);
    if (list) list.push(e);
    else byPair.set(key, [e]);
  }

  const out: ConversationBehavior[] = [];
  for (const evs of byPair.values()) {
    const sorted = [...evs].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    const intervals: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      intervals.push(toEpochSec(sorted[i]!.timestamp) - toEpochSec(sorted[i - 1]!.timestamp));
    }

    const mean = intervals.length
      ? intervals.reduce((a, b) => a + b, 0) / intervals.length
      : 0;
    const variance = intervals.length
      ? intervals.reduce((a, b) => a + (b - mean) ** 2, 0) / intervals.length
      : 0;

    out.push({
      clientIp: sorted[0]!.clientIp,
      qname: sorted[0]!.qname,
      siteId: sorted[0]!.siteId,
      queryCount: sorted.length,
      intervalsSec: intervals,
      meanIntervalSec: mean,
      intervalCv: mean > 0 ? Math.sqrt(variance) / mean : 0,
      firstSeen: sorted[0]!.timestamp,
      lastSeen: sorted[sorted.length - 1]!.timestamp,
    });
  }
  return out.sort((a, b) => b.queryCount - a.queryCount);
}

export function zoneBehaviors(events: DnsEvent[]): ZoneBehavior[] {
  const byZone = new Map<string, DnsEvent[]>();
  for (const e of events) {
    const ls = labels(e.qname);
    // Parent zone = everything except the leftmost label.
    const parent = ls.length > 2 ? ls.slice(1).join(".") : ls.join(".");
    const list = byZone.get(parent);
    if (list) list.push(e);
    else byZone.set(parent, [e]);
  }

  const out: ZoneBehavior[] = [];
  for (const [parentZone, evs] of byZone) {
    const subLengths = evs.map((e) => labels(e.qname)[0]?.length ?? 0);
    out.push({
      parentZone,
      siteId: evs[0]!.siteId,
      queryCount: evs.length,
      uniqueSubdomains: new Set(evs.map((e) => labels(e.qname)[0] ?? "")).size,
      meanSubdomainLength: subLengths.reduce((a, b) => a + b, 0) / subLengths.length,
      maxSubdomainLength: subLengths.reduce((m, l) => Math.max(m, l), 0),
      payloadQtypeRatio:
        evs.filter((e) => PAYLOAD_QTYPES.has(e.qtype)).length / evs.length,
      clientIps: [...new Set(evs.map((e) => e.clientIp))],
    });
  }
  return out.sort((a, b) => b.queryCount - a.queryCount);
}

/** Distinct registrable domains a host queried, for DGA clustering. */
export function registrablesByHost(events: DnsEvent[]): Map<string, string[]> {
  const m = new Map<string, Set<string>>();
  for (const e of events) {
    const reg = registrableLabel(e.qname);
    if (!reg) continue;
    const set = m.get(e.clientIp);
    if (set) set.add(reg);
    else m.set(e.clientIp, new Set([reg]));
  }
  return new Map([...m].map(([k, v]) => [k, [...v]]));
}
