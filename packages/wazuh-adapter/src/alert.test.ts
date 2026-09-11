import { test } from "node:test";
import assert from "node:assert/strict";
import type { Incident } from "@sentinel/dns-schema";
import { riskToWazuhLevel, toWazuhAlert } from "./alert.js";
import { HttpSink } from "./sinks.js";

const incident: Incident = {
  id: "abc123", createdAt: "2026-09-09T12:15:55Z", updatedAt: "2026-09-09T12:15:55Z",
  siteId: "ca-casa-matriz", sourceHosts: ["10.10.1.91"], domains: ["tun.exfil-demo.example"],
  classification: "possible_tunneling", riskScore: 90, confidence: 1,
  evidence: [{ type: "subdomain_length", source: "lexical", value: 48, weight: 25,
               description: "Mean subdomain length 48 characters." }],
  recommendedAction: "Capture full DNS payloads for this zone.",
};

test("maps risk onto Wazuh severity without ever claiming confirmation", () => {
  assert.equal(riskToWazuhLevel(95), 12);
  assert.equal(riskToWazuhLevel(70), 10);
  assert.equal(riskToWazuhLevel(10), 3);
  // 13+ in Wazuh reads as confirmed. A risk score is prioritisation, not proof.
  for (const r of [0, 50, 90, 100]) assert.ok(riskToWazuhLevel(r) <= 12);
});

test("alert carries the evidence, not just the score", () => {
  const a = toWazuhAlert(incident);
  assert.equal(a.sentinel.incident_id, "abc123");
  assert.equal(a.sentinel.level, 12);
  assert.equal(a.sentinel.evidence.length, 1);
  assert.match(a.sentinel.evidence[0]!.description, /subdomain length/);
  assert.equal(a.sentinel.analysis_location, "local");
});

test("omits explanation when the analyst produced none", () => {
  // A missing key is honest. An empty string reads like the model said nothing
  // useful, which is a different claim.
  assert.equal("explanation" in toWazuhAlert(incident).sentinel, false);
});

test("refuses to send alerts off the machine", () => {
  assert.throws(() => new HttpSink("https://siem.example.com/hook"), /non-local/);
  assert.doesNotThrow(() => new HttpSink("http://127.0.0.1:8081/"));
  assert.doesNotThrow(() => new HttpSink("http://10.10.0.5:8081/"));
});
