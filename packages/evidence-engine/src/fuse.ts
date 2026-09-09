/**
 * Evidence fusion — spec §10.
 *
 * Visual findings become weighted evidence items exactly like lexical and
 * behavioural ones, and the risk score is recomputed as the same plain sum.
 * The vision model contributes observations; it does not contribute a number.
 *
 * Absence of visual similarity *reduces* risk. A detector that can only ever
 * escalate is a detector that eventually cries wolf, and being able to clear a
 * domain is what makes the investigation worth running at all.
 */

import type { Incident, ThreatEvidence } from "@sentinel/dns-schema";
import type { RenderResult } from "./sandbox.js";
import type { VisionFindings } from "./vision.js";

/** Weights for visual findings. Spec §10 gives the shape; these are ours. */
export const VISION_WEIGHTS = {
  credentialForm: 15,
  brandImpersonation: 20,
  urgencyLanguage: 10,
  noVisualSimilarity: -10,
} as const;

export function visionEvidence(
  render: RenderResult,
  findings: VisionFindings,
): ThreatEvidence[] {
  const out: ThreatEvidence[] = [];

  if (findings.credentialForm === true) {
    out.push({
      type: "credential_form_detected",
      source: "vision",
      value: { title: render.title, url: render.finalUrl },
      weight: VISION_WEIGHTS.credentialForm,
      description:
        `The rendered page asks the visitor for credentials. A domain imitating a ` +
        `brand is suspicious; one imitating a brand *and* collecting passwords is ` +
        `a credential-harvesting page.`,
    });
  }

  if (findings.financialBranding === true) {
    out.push({
      type: "brand_impersonation_visual",
      source: "vision",
      value: { title: render.title },
      weight: VISION_WEIGHTS.brandImpersonation,
      description:
        `The page presents itself with financial-institution branding — the visual ` +
        `identity matches what the domain name was imitating.`,
    });
  }

  if (findings.urgencyLanguage === true) {
    out.push({
      type: "urgency_language",
      source: "vision",
      value: true,
      weight: VISION_WEIGHTS.urgencyLanguage,
      description:
        `The page uses time pressure or account-suspension language, a standard ` +
        `technique for rushing a victim past their own judgement.`,
    });
  }

  if (!findings.parsed) {
    // The model ran but its answer could not be read. Say so and change
    // nothing: an unreadable answer is not evidence of innocence either.
    out.push({
      type: "visual_analysis_inconclusive",
      source: "vision",
      value: { screenshot: render.screenshotPath },
      weight: 0,
      description:
        `The page was rendered and analysed locally, but the model's answer could ` +
        `not be read with confidence. Risk is unchanged; the screenshot is preserved ` +
        `for manual review.`,
    });
  } else if (out.length === 0) {
    out.push({
      type: "no_visual_similarity",
      source: "vision",
      value: { title: render.title },
      weight: VISION_WEIGHTS.noVisualSimilarity,
      description:
        `Local rendering found no credential form, financial branding or urgency ` +
        `language. The lexical similarity is not corroborated visually, so this is ` +
        `more likely a parked or unrelated domain.`,
    });
  }

  out.push({
    type: "local_render",
    source: "vision",
    value: {
      screenshot: render.screenshotPath,
      renderMs: render.renderMs,
      model: findings.model,
      inferenceMs: findings.inferenceMs,
    },
    weight: 0, // provenance, not signal
    description:
      `Rendered in a local isolated browser and analysed on-device by ` +
      `${findings.model}. The screenshot never left this machine.`,
  });

  return out;
}

/**
 * Folds visual evidence into an incident and recomputes the score.
 *
 * A phishing page confirmed visually is no longer merely "possible
 * typosquatting" — the classification is promoted so the alert says what was
 * actually found.
 */
export function fuseVisionIntoIncident(
  incident: Incident,
  render: RenderResult,
  findings: VisionFindings,
  now: string = new Date().toISOString(),
): Incident {
  const added = visionEvidence(render, findings);
  const evidence = [...incident.evidence, ...added].sort((a, b) => b.weight - a.weight);
  const riskScore = Math.max(0, Math.min(100,
    Math.round(evidence.reduce((a, e) => a + e.weight, 0))));

  const confirmedPhishing =
    findings.credentialForm === true && findings.financialBranding === true &&
    incident.classification === "possible_typosquatting";

  const distinctSources = new Set(evidence.map((e) => e.source)).size;

  return {
    ...incident,
    updatedAt: now,
    classification: confirmedPhishing ? "possible_phishing" : incident.classification,
    riskScore,
    // Vision is an independent source, so corroboration genuinely rises.
    confidence: Number(Math.min(1, (Math.min(evidence.length / 4, 1) * 0.6) +
                                   (Math.min(distinctSources / 3, 1) * 0.4)).toFixed(2)),
    evidence,
    visualEvidence: {
      screenshotPath: render.screenshotPath,
      description: findings.description,
      analysedBy: findings.model,
    },
    recommendedAction: confirmedPhishing
      ? "Block the domain at the resolver and check whether any user submitted " +
        "credentials to it. Preserve the screenshot as evidence."
      : incident.recommendedAction,
  };
}
