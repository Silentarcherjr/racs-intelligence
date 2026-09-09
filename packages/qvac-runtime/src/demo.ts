import type { Incident } from "@sentinel/dns-schema";
import { closeRuntime, explainIncident } from "./explainIncident.js";

const incident: Incident = {
  id: "inc-demo-typosquat-001",
  createdAt: "2026-09-09T12:10:00Z",
  updatedAt: "2026-09-09T12:10:00Z",
  siteId: "pa-hq",
  sourceHosts: ["10.10.1.44"],
  domains: ["g00gle.com"],
  classification: "possible_typosquatting",
  riskScore: 72,
  confidence: 0.81,
  evidence: [
    {
      type: "typosquat_distance",
      source: "lexical",
      value: { target: "google.com", distance: 2 },
      weight: 0.6,
      description:
        "g00gle.com is a close lexical match to google.com (edit distance 2, digit substitution).",
    },
    {
      type: "query_burst",
      source: "behavioral",
      value: { count: 14, windowSec: 60 },
      weight: 0.4,
      description:
        "14 queries for the same qname from one host in 60 seconds.",
    },
  ],
  recommendedAction:
    "Isolate the source host locally and inspect the destination with the isolated browser sandbox. Do not open the domain on an analyst workstation.",
};

try {
  const response = await explainIncident(incident);
  process.stdout.write(`${JSON.stringify(response, null, 2)}\n`);
} finally {
  await closeRuntime();
}
