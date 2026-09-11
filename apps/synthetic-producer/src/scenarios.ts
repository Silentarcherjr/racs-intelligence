/**
 * Synthetic DNS traffic generators — spec §13.
 *
 * Every scenario is a function of (rng, clock) → events, so the same seed
 * always produces the same incident on stage. Nothing here touches a network:
 * these are invented names under `.example` and RFC 1918 addresses.
 */

import type { DnsEvent } from "@sentinel/dns-schema";
import { between, intBetween, pick, type Rng } from "./rng.js";

export const SITES = [
  // A bank's DNS telemetry is segmented the way its network is: the data
  // centre, the branches, the channel that faces customers, and the ATM
  // estate. The names are real Panamanian districts with real bank branches —
  // a jury from a Panamanian bank should recognise its own map.
  { siteId: "ca-casa-matriz", zone: "corp.banco.local",
    resolverIp: "10.10.0.53", clientPrefix: "10.10.1.", label: "Casa Matriz" },
  { siteId: "ca-costa-del-este", zone: "sucursal.banco.local",
    resolverIp: "10.20.0.53", clientPrefix: "10.20.1.", label: "Sucursal Costa del Este" },
  { siteId: "ca-el-dorado", zone: "sucursal.banco.local",
    resolverIp: "10.30.0.53", clientPrefix: "10.30.1.", label: "Sucursal El Dorado" },
  { siteId: "ca-banca-linea", zone: "ebank.banco.local",
    resolverIp: "10.40.0.53", clientPrefix: "10.40.1.", label: "Banca en Línea" },
  { siteId: "ca-red-atm", zone: "atm.banco.local",
    resolverIp: "10.50.0.53", clientPrefix: "10.50.1.", label: "Red ATM" },
] as const;

const POPULAR = [
  "google.com", "github.com", "cloudflare.com", "apple.com", "microsoft.com",
  "office365.com", "outlook.com", "swift.com", "visa.com", "mastercard.com",
  "superbancos.gob.pa", "bnp.gob.pa", "sri.gob.pa", "windowsupdate.com",
];

const ALPHANUM = "abcdefghijklmnopqrstuvwxyz0123456789";
const BASE32 = "abcdefghijklmnopqrstuvwxyz234567";

export type ScenarioName =
  | "normal"
  | "dga"
  | "typosquat"
  | "tunneling"
  | "beaconing"
  | "qoe-degradation";

export const SCENARIOS: ScenarioName[] = [
  "normal", "dga", "typosquat", "tunneling", "beaconing", "qoe-degradation",
];

type Ctx = { rng: Rng; at: Date };

function event(p: Partial<DnsEvent> & { qname: string; at: Date; site: (typeof SITES)[number] }): DnsEvent {
  return {
    timestamp: p.at.toISOString(),
    siteId: p.site.siteId,
    zone: p.site.zone,
    clientIp: p.clientIp ?? `${p.site.clientPrefix}20`,
    resolverIp: p.site.resolverIp,
    qname: p.qname,
    qtype: p.qtype ?? "A",
    rcode: p.rcode ?? "NOERROR",
    latencyMs: p.latencyMs ?? 20,
  };
}

const randomLabel = (rng: Rng, len: number, alphabet = ALPHANUM) =>
  Array.from({ length: len }, () => pick(rng, [...alphabet])).join("");

/** Ordinary browsing: varied names, healthy latency, mostly NOERROR. */
export function normal({ rng, at }: Ctx, count = 1): DnsEvent[] {
  return Array.from({ length: count }, () => {
    const site = pick(rng, SITES);
    return event({
      at, site, qname: pick(rng, POPULAR),
      clientIp: `${site.clientPrefix}${intBetween(rng, 20, 45)}`,
      latencyMs: Number(between(rng, 8, 34).toFixed(1)),
    });
  });
}

/** Malware hunting for a live C2: many high-entropy names, nearly all NXDOMAIN. */
export function dga({ rng, at }: Ctx, count = 1): DnsEvent[] {
  const site = SITES[0];
  return Array.from({ length: count }, () =>
    event({
      at, site,
      qname: `${randomLabel(rng, intBetween(rng, 14, 20))}.${pick(rng, ["info", "biz", "xyz"])}`,
      clientIp: `${site.clientPrefix}77`,
      rcode: rng() < 0.92 ? "NXDOMAIN" : "NOERROR",
      latencyMs: Number(between(rng, 40, 90).toFixed(1)),
    }),
  );
}

const SQUATS = [
  // Matches the fictional bank served by apps/phishing-demo, so the visual
  // investigation tells one coherent story: a bank-imitating domain whose page
  // really is a bank-imitating credential form.
  "banco-aur0ra-login.example",
  "micr0soft-secure-login.example",
  "banes-co-panama.example",
  "app1e-id-verify.example",
  "0ffice365-mail.example",
];

/** Brand impersonation, queried by a handful of hosts as a campaign spreads. */
export function typosquat({ rng, at }: Ctx, count = 1): DnsEvent[] {
  return Array.from({ length: count }, () => {
    const site = pick(rng, SITES);
    return event({
      at, site, qname: pick(rng, SQUATS),
      clientIp: `${site.clientPrefix}${intBetween(rng, 30, 34)}`,
      latencyMs: Number(between(rng, 30, 70).toFixed(1)),
    });
  });
}

/** Data leaving over DNS: long encoded labels under one zone, payload qtypes. */
export function tunneling({ rng, at }: Ctx, count = 1): DnsEvent[] {
  const site = SITES[0];
  return Array.from({ length: count }, () =>
    event({
      at, site,
      qname: `${randomLabel(rng, intBetween(rng, 40, 56), BASE32)}.tun.exfil-demo.example`,
      clientIp: `${site.clientPrefix}91`,
      qtype: pick(rng, ["TXT", "NULL"]),
      latencyMs: Number(between(rng, 55, 120).toFixed(1)),
    }),
  );
}

/**
 * Implant check-in. Emitted only when the clock lands on the period, so the
 * cadence stays rigid regardless of what other traffic is being generated.
 */
export function beaconing({ at }: Ctx, periodSec = 60): DnsEvent[] {
  const site = SITES[1];
  if (Math.floor(at.getTime() / 1000) % periodSec !== 0) return [];
  return [
    event({
      at, site, qname: "cdn-sync-node.example",
      clientIp: `${site.clientPrefix}66`,
      latencyMs: Number((18 + (at.getSeconds() % 8)).toFixed(1)),
    }),
  ];
}

/** Resolver saturation at a branch: latency blows up, SERVFAILs appear. */
export function qoeDegradation({ rng, at }: Ctx, count = 1): DnsEvent[] {
  const site = SITES[1];
  return Array.from({ length: count }, () =>
    event({
      at, site, qname: pick(rng, POPULAR),
      clientIp: `${site.clientPrefix}${intBetween(rng, 50, 62)}`,
      rcode: rng() < 0.25 ? "SERVFAIL" : "NOERROR",
      latencyMs: Number(between(rng, 380, 950).toFixed(1)),
    }),
  );
}

/** One tick of traffic for the requested scenarios. */
export function tick(ctx: Ctx, active: ScenarioName[], intensity: number): DnsEvent[] {
  const out: DnsEvent[] = [];
  for (const name of active) {
    switch (name) {
      case "normal": out.push(...normal(ctx, intensity)); break;
      case "dga": out.push(...dga(ctx, Math.max(1, Math.round(intensity / 2)))); break;
      case "typosquat": if (ctx.rng() < 0.3) out.push(...typosquat(ctx, 1)); break;
      case "tunneling": out.push(...tunneling(ctx, Math.max(1, Math.round(intensity / 2)))); break;
      case "beaconing": out.push(...beaconing(ctx)); break;
      case "qoe-degradation": out.push(...qoeDegradation(ctx, intensity)); break;
    }
  }
  return out;
}
