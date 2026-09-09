/**
 * Regression guard for the four detectors, run against the committed fixture.
 *
 *   npm test -w @sentinel/threat-engine
 *
 * The point is not coverage — it is that the demo cannot silently start
 * flagging normal traffic, or stop flagging the scenarios we present to a jury.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { DnsEvent } from "@sentinel/dns-schema";
import { analyzeWindow } from "./index.js";

const here = dirname(fileURLToPath(import.meta.url));
const events = JSON.parse(
  readFileSync(resolve(here, "../../../datasets/synthetic/sample-events.json"), "utf8"),
) as DnsEvent[];

const incidents = analyzeWindow(events);
const kinds = new Set(incidents.map((i) => i.classification));

test("detects all four required threat patterns", () => {
  for (const k of [
    "possible_dga",
    "possible_typosquatting",
    "possible_tunneling",
    "possible_beaconing",
  ]) {
    assert.ok(kinds.has(k as never), `missing detection: ${k}`);
  }
});

test("does not flag the normal-traffic hosts", () => {
  // Baseline hosts in the fixture sit in 10.10.1.20–28; the planted scenarios
  // use .77 (DGA), .91 (tunneling), .31–.33 (typosquat) and 10.20.1.66 (beacon).
  const flagged = new Set(incidents.flatMap((i) => i.sourceHosts));
  const benign = ["10.10.1.20", "10.10.1.21", "10.10.1.22", "10.10.1.23"];
  for (const host of benign) {
    assert.ok(!flagged.has(host), `false positive on benign host ${host}`);
  }
});

test("risk scores are bounded and evidence-backed", () => {
  for (const inc of incidents) {
    assert.ok(inc.riskScore >= 0 && inc.riskScore <= 100, "risk out of range");
    assert.ok(inc.evidence.length > 0, "incident with no evidence");
    const sum = inc.evidence.reduce((a, e) => a + e.weight, 0);
    assert.equal(inc.riskScore, Math.min(100, Math.round(sum)), "score must equal its evidence");
  }
});

test("incident ids are stable across runs", () => {
  const again = analyzeWindow(events);
  assert.deepEqual(incidents.map((i) => i.id), again.map((i) => i.id));
});
