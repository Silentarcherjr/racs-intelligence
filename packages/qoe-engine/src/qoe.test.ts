import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { DnsEvent, Incident } from "@sentinel/dns-schema";
import { BaselineStore, windowStats } from "./baseline.js";
import { MAX_PENALTY, scoreWindow } from "./score.js";
import { correlate } from "./correlate.js";
import { scoreAllSites } from "./index.js";

const here = dirname(fileURLToPath(import.meta.url));
const events = JSON.parse(
  readFileSync(resolve(here, "../../../datasets/synthetic/sample-events.json"), "utf8"),
) as DnsEvent[];

test("the degraded branch scores worse than headquarters", () => {
  const results = scoreAllSites(events, new BaselineStore());
  const branch = results.find((r) => r.window.siteId === "ca-costa-del-este")!;
  const hq = results.find((r) => r.window.siteId === "ca-casa-matriz")!;
  // The fixture plants 380-950ms latency and SERVFAIL bursts at the branch only.
  assert.ok(branch.window.score < hq.window.score,
    `branch ${branch.window.score} should be worse than hq ${hq.window.score}`);
});

test("every penalty stays inside its ceiling", () => {
  const awful: DnsEvent[] = Array.from({ length: 50 }, (_, i) => ({
    timestamp: new Date(Date.UTC(2026, 8, 9, 12, 0, i)).toISOString(),
    siteId: "ca-casa-matriz", zone: "corp.banco.local", clientIp: "10.10.1.20",
    resolverIp: "10.10.0.53", qname: "x.example", qtype: "A",
    rcode: i % 2 ? "SERVFAIL" : "NXDOMAIN", latencyMs: 9000,
  }));
  const s = scoreWindow(windowStats("ca-casa-matriz", awful)!, undefined);
  assert.ok(s.window.penalties.latency <= MAX_PENALTY.latency);
  assert.ok(s.window.penalties.nxdomain <= MAX_PENALTY.nxdomain);
  assert.ok(s.window.penalties.failures <= MAX_PENALTY.failures);
  assert.ok(s.window.penalties.saturation <= MAX_PENALTY.saturation);
  assert.ok(s.window.score >= 0, "score must never go negative");
});

test("score always equals 100 minus its stated penalties", () => {
  // If these ever diverge, the explanation shown to an operator is a lie.
  for (const r of scoreAllSites(events, new BaselineStore())) {
    const p = r.window.penalties;
    assert.equal(r.window.score, 100 - p.latency - p.nxdomain - p.failures - p.saturation);
  }
});

test("a healthy window is not attributed to anything", () => {
  const healthy = scoreWindow(windowStats("ca-casa-matriz", events.slice(0, 5))!, undefined);
  const c = correlate(healthy, []);
  assert.equal(c.verdict, "UNKNOWN");
  assert.equal(c.correlationScore, 0);
});

test("beaconing is never blamed for degradation", () => {
  // Beaconing is low-volume by design. Blaming it for a resolver problem would
  // send an operator hunting malware while the real fault is capacity.
  const bad = scoreWindow(
    windowStats("ca-costa-del-este", events.filter((e) => e.latencyMs > 300))!,
    undefined,
  );
  const beacon: Incident = {
    id: "b1", createdAt: "", updatedAt: "", siteId: "ca-costa-del-este",
    sourceHosts: ["10.20.1.66"], domains: ["cdn-sync-node.example"],
    classification: "possible_beaconing", riskScore: 65, confidence: 0.58, evidence: [],
  };
  const c = correlate(bad, [beacon]);
  assert.equal(c.relatedIncidentIds.length, 0);
  assert.equal(c.verdict, "LIKELY_OPERATIONAL");
});

test("correlation language never claims causation", () => {
  const bad = scoreWindow(
    windowStats("ca-casa-matriz", events.filter((e) => e.rcode === "NXDOMAIN"))!,
    undefined,
  );
  const dga: Incident = {
    id: "d1", createdAt: "", updatedAt: "", siteId: "ca-casa-matriz",
    sourceHosts: ["10.10.1.77"], domains: ["x.info"],
    classification: "possible_dga", riskScore: 75, confidence: 0.87, evidence: [],
  };
  const text = correlate(bad, [dga]).reasoning.join(" ").toLowerCase();
  for (const word of ["caused by", "because of", "due to"]) {
    assert.ok(!text.includes(word), `verdict must not claim causation: found "${word}"`);
  }
});

test("a site that stays degraded never learns that degraded is normal", () => {
  // The bug this guards: an EWMA baseline fed every window absorbs a sustained
  // fault. After a few bad windows the penalties vanish and a broken resolver
  // reports "excellent" — silently, which is the worst kind of wrong.
  const bad: DnsEvent[] = Array.from({ length: 40 }, (_, i) => ({
    timestamp: new Date(Date.UTC(2026, 8, 9, 12, 0, i)).toISOString(),
    siteId: "ca-costa-del-este", zone: "sucursal.banco.local", clientIp: "10.20.1.50",
    resolverIp: "10.20.0.53", qname: "google.com", qtype: "A",
    rcode: i % 4 === 0 ? "SERVFAIL" : "NOERROR", latencyMs: 800,
  }));

  const store = new BaselineStore();
  const scores = Array.from({ length: 8 }, () => scoreAllSites(bad, store)[0]!.window.score);

  assert.ok(
    scores.every((s) => s < 75),
    `a persistently broken site must keep scoring badly, got ${scores.join(", ")}`,
  );
  assert.equal(scores[0], scores[scores.length - 1],
    "the score must not drift as the fault persists");
});

test("a healthy site does build a baseline", () => {
  const good: DnsEvent[] = Array.from({ length: 40 }, (_, i) => ({
    timestamp: new Date(Date.UTC(2026, 8, 9, 12, 0, i)).toISOString(),
    siteId: "ca-casa-matriz", zone: "corp.banco.local", clientIp: "10.10.1.20",
    resolverIp: "10.10.0.53", qname: "google.com", qtype: "A",
    rcode: "NOERROR", latencyMs: 15,
  }));
  const store = new BaselineStore();
  for (let i = 0; i < 4; i++) scoreAllSites(good, store);
  const b = store.get("ca-casa-matriz")!;
  assert.ok(b.samples >= 3, `expected a warm baseline, got ${b.samples} samples`);
  assert.ok(scoreAllSites(good, store)[0]!.usedBaseline, "should now score against it");
});
