/**
 * Shared data contracts for Sovereign Sentinel.
 *
 * This package is the boundary between all four lanes. Everything crossing a
 * module boundary is typed here, so nobody invents a second shape for the same
 * thing. Types follow SOVEREIGN_SENTINEL_SPEC.md §19 and §20.
 *
 * Deliberately dependency-free: four people install this at once, and a shared
 * contract that drags a dependency tree behind it causes version conflicts.
 * Runtime validation of model output belongs in the consuming package.
 */

// ─── DNS telemetry ──────────────────────────────────────────────────────────

/** One normalized DNS query observation. Spec §19. */
export type DnsEvent = {
  timestamp: string; // ISO 8601
  siteId: string;
  zone: string;
  clientIp: string;
  resolverIp: string;
  qname: string;
  qtype: string;
  rcode: string;
  latencyMs: number;
};

// ─── Threat detection ───────────────────────────────────────────────────────

/** Where a piece of evidence came from. Spec §19. */
export type EvidenceSource =
  | "stream"
  | "lexical"
  | "behavioral"
  | "vision"
  | "baseline";

/**
 * One deterministic finding contributing to a risk score.
 *
 * `weight` is set by the detection engines, never by a model. The model
 * explains evidence; it does not create or reweight it (spec §5, principle 2).
 */
export type ThreatEvidence = {
  type: string;
  source: EvidenceSource;
  value: unknown;
  weight: number;
  description: string;
};

export const CLASSIFICATIONS = [
  "possible_dga",
  "possible_tunneling",
  "possible_beaconing",
  "possible_typosquatting",
  "possible_phishing",
  "unknown",
] as const;

export type Classification = (typeof CLASSIFICATIONS)[number];

/** A correlated security finding. Spec §19. */
export type Incident = {
  id: string;
  createdAt: string;
  updatedAt: string;
  siteId: string;
  sourceHosts: string[];
  domains: string[];
  classification: Classification;
  /** 0–100. Deterministic and explainable — never model-generated. */
  riskScore: number;
  /** 0–1. */
  confidence: number;
  evidence: ThreatEvidence[];
  qoeImpact?: {
    observed: boolean;
    correlationScore: number;
  };
  explanation?: string;
  recommendedAction?: string;
};

// ─── DNS quality of experience ──────────────────────────────────────────────

/** One QoE measurement window for a site. Spec §19. */
export type QoeWindow = {
  siteId: string;
  windowStart: string;
  windowEnd: string;
  /** 0–100, higher is better. */
  score: number;
  latencyP50: number;
  latencyP95: number;
  nxdomainRate: number;
  failureRate: number;
  queryRate: number;
  penalties: {
    latency: number;
    nxdomain: number;
    failures: number;
    saturation: number;
  };
};

// ─── Local analyst output ───────────────────────────────────────────────────

/**
 * The only shape the QVAC analyst is allowed to return. Spec §20.
 *
 * MUST be validated before use — a local model can still emit malformed JSON.
 * On a parse failure, log loudly and fall back to the deterministic
 * explanation; never surface unvalidated model text (spec §7 conventions).
 */
export type AnalystResponse = {
  summary: string;
  likely_scenario: string;
  confidence: "low" | "medium" | "high";
  reasoning_evidence: string[];
  recommended_next_action: string;
};

/** Structural check for {@link AnalystResponse}. Cheap guard, not a validator. */
export function isAnalystResponse(v: unknown): v is AnalystResponse {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r["summary"] === "string" &&
    typeof r["likely_scenario"] === "string" &&
    (r["confidence"] === "low" ||
      r["confidence"] === "medium" ||
      r["confidence"] === "high") &&
    Array.isArray(r["reasoning_evidence"]) &&
    r["reasoning_evidence"].every((e) => typeof e === "string") &&
    typeof r["recommended_next_action"] === "string"
  );
}
