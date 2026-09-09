/**
 * Incident → Wazuh alert.
 *
 * Wazuh ingests custom JSON events and its own decoders/rules turn them into
 * alerts. We emit a flat, decoder-friendly document under a `sentinel` key and
 * ship the matching decoder + rules in `infra/wazuh/`, so this is a real
 * integration rather than "we POSTed some JSON at it".
 *
 * The alert carries the evidence, not just the score. An analyst opening this
 * in Wazuh must be able to see *why* without coming back to us (spec §5).
 */

import type { Incident } from "@sentinel/dns-schema";

export type WazuhAlert = {
  integration: "sovereign-sentinel";
  timestamp: string;
  sentinel: {
    incident_id: string;
    classification: string;
    risk_score: number;
    confidence: number;
    /** Suggested Wazuh rule level, 0–15. The rules file may override it. */
    level: number;
    site_id: string;
    source_hosts: string[];
    domains: string[];
    evidence: Array<{
      type: string;
      source: string;
      weight: number;
      description: string;
    }>;
    /** Populated only when the local QVAC analyst produced a validated answer. */
    explanation?: string;
    recommended_action?: string;
    /** Stated in every alert: this pipeline never called a cloud model. */
    analysis_location: "local";
  };
};

/**
 * Maps a 0–100 risk score onto Wazuh's 0–15 severity scale.
 *
 * Nothing above 12 — level 13+ in Wazuh means "confirmed", and a risk score is
 * a prioritisation signal, not proof of compromise (spec §35).
 */
export function riskToWazuhLevel(risk: number): number {
  if (risk >= 90) return 12;
  if (risk >= 70) return 10;
  if (risk >= 50) return 7;
  if (risk >= 30) return 5;
  return 3;
}

export function toWazuhAlert(incident: Incident): WazuhAlert {
  return {
    integration: "sovereign-sentinel",
    timestamp: incident.updatedAt,
    sentinel: {
      incident_id: incident.id,
      classification: incident.classification,
      risk_score: incident.riskScore,
      confidence: incident.confidence,
      level: riskToWazuhLevel(incident.riskScore),
      site_id: incident.siteId,
      source_hosts: incident.sourceHosts,
      domains: incident.domains,
      evidence: incident.evidence.map((e) => ({
        type: e.type,
        source: e.source,
        weight: e.weight,
        description: e.description,
      })),
      ...(incident.explanation ? { explanation: incident.explanation } : {}),
      ...(incident.recommendedAction
        ? { recommended_action: incident.recommendedAction }
        : {}),
      analysis_location: "local",
    },
  };
}
