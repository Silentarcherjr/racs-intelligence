/**
 * Active Evidence Acquisition — spec §8.
 *
 * The difference between a detector and an investigator: when the evidence is
 * not enough to decide, this picks the single most valuable next step instead
 * of either firing a low-confidence alert or running every check on everything.
 *
 * Selection is deterministic and inspectable. The model may later be asked to
 * *rank* candidates from this fixed list — it is never allowed to invent an
 * action or execute anything (spec §8.3).
 */

import type { Incident } from "@sentinel/dns-schema";

export type IncidentState =
  | "DETECTED"
  | "EVIDENCE_INCOMPLETE"
  | "COLLECTING"
  | "REASSESSED"
  | "CONFIRMED"
  | "NEEDS_MORE";

/** The closed set of things Sentinel is permitted to do. Spec §8.2. */
export type InvestigationAction =
  | "CHECK_DOMAIN_LEXICAL"
  | "CHECK_HOST_HISTORY"
  | "CHECK_SITE_BASELINE"
  | "CHECK_BEACON_PERIODICITY"
  | "CHECK_TUNNEL_FEATURES"
  | "CHECK_BRAND_SIMILARITY"
  | "LOCAL_RENDER"
  | "VISION_ANALYSIS"
  | "CORRELATE_QOE"
  | "WAIT_FOR_MORE_STREAM_DATA"
  | "NONE";

export type Decision = {
  state: IncidentState;
  action: InvestigationAction;
  /** Why this step, in one sentence an analyst can audit. */
  rationale: string;
};

/** Above this, more evidence changes nothing — it is already actionable. */
export const CONFIDENT_ABOVE = 90;
/** Below this, there is not enough signal to justify spending a sandbox on it. */
export const TOO_WEAK_BELOW = 40;

const hasEvidence = (inc: Incident, type: string): boolean =>
  inc.evidence.some((e) => e.type === type);

const hasVisual = (inc: Incident): boolean =>
  inc.evidence.some((e) => e.source === "vision");

/**
 * Chooses the next step for one incident.
 *
 * The ordering encodes what is actually worth doing. Visual inspection is
 * expensive — a browser, a screenshot, a vision model — so it is reserved for
 * the case where it decides something: a brand-impersonating domain that is
 * suspicious but not yet conclusive. Rendering a page to confirm a 95-risk
 * tunnelling incident would tell us nothing we do not already know.
 */
export function decideNextAction(inc: Incident): Decision {
  if (hasVisual(inc)) {
    return {
      state: inc.riskScore >= CONFIDENT_ABOVE ? "CONFIRMED" : "REASSESSED",
      action: "NONE",
      rationale: "Visual evidence has already been collected for this incident.",
    };
  }

  if (inc.riskScore >= CONFIDENT_ABOVE) {
    return {
      state: "CONFIRMED",
      action: "NONE",
      rationale:
        `Risk ${inc.riskScore} is already actionable; further evidence would not ` +
        `change the recommended response.`,
    };
  }

  if (inc.riskScore < TOO_WEAK_BELOW) {
    return {
      state: "NEEDS_MORE",
      action: "WAIT_FOR_MORE_STREAM_DATA",
      rationale:
        `Risk ${inc.riskScore} is below the threshold where an investigation is ` +
        `justified. Keep observing rather than spending a sandbox on it.`,
    };
  }

  // The case visual inspection was built for: something is impersonating a
  // brand, and what the page actually looks like decides it.
  if (
    (inc.classification === "possible_typosquatting" ||
      inc.classification === "possible_phishing") &&
    (hasEvidence(inc, "brand_containment") || hasEvidence(inc, "brand_edit_distance"))
  ) {
    return {
      state: "EVIDENCE_INCOMPLETE",
      action: "LOCAL_RENDER",
      rationale:
        `${inc.domains[0] ?? "the domain"} imitates a protected brand, but the name ` +
        `alone cannot separate a parked domain from a live credential-harvesting ` +
        `page. Visual inspection has the highest expected information gain.`,
    };
  }

  if (inc.classification === "possible_dga" && !hasEvidence(inc, "interval_regularity")) {
    return {
      state: "EVIDENCE_INCOMPLETE",
      action: "CHECK_BEACON_PERIODICITY",
      rationale:
        "Generated domains plus a regular check-in cadence would indicate an " +
        "established C2 channel rather than a search for one.",
    };
  }

  if (inc.qoeImpact === undefined) {
    return {
      state: "EVIDENCE_INCOMPLETE",
      action: "CORRELATE_QOE",
      rationale:
        "Service-quality impact at this site is unknown; correlating it would " +
        "show whether this traffic is affecting users.",
    };
  }

  return {
    state: "NEEDS_MORE",
    action: "WAIT_FOR_MORE_STREAM_DATA",
    rationale: "No local check would add decisive evidence right now.",
  };
}
