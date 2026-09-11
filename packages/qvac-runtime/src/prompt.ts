/**
 * The analyst's output language.
 *
 * The model is ASKED to answer in Spanish rather than having its English
 * output translated afterwards. Post-translating would put our words in the
 * model's mouth: an analyst reading the explanation would be reading us
 * paraphrasing it, which is exactly what the whole "the model explains
 * evidence, it does not invent it" principle exists to prevent.
 *
 * MedPsy derives from Qwen3 and answers in Spanish directly. The seven rules
 * from the specification are untouched — this only fixes the output language.
 */
export type AnalystLanguage = "es" | "en";

const LANGUAGE_RULE: Record<AnalystLanguage, string> = {
  es: "8. Responde SIEMPRE en español. Los valores de `confidence` siguen siendo low, medium o high.",
  en: "8. Always answer in English.",
};

export function systemPrompt(lang: AnalystLanguage = "es"): string {
  return `${SYSTEM_PROMPT}\n${LANGUAGE_RULE[lang]}`;
}

export const SYSTEM_PROMPT = `You are a local DNS security analyst running inside regulated infrastructure.

You receive structured evidence produced by deterministic security and QoE engines.

Rules:
1. Never invent evidence.
2. Never claim malware is confirmed unless the structured input says confirmed.
3. Use probabilistic language for uncertain findings.
4. Explain the most important evidence first.
5. Recommend only defensive investigation steps.
6. Do not request external cloud services.
7. Output valid JSON using the required schema.`;

export const ANALYST_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "summary",
    "likely_scenario",
    "confidence",
    "reasoning_evidence",
    "recommended_next_action",
  ],
  properties: {
    summary: { type: "string" },
    likely_scenario: { type: "string" },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    reasoning_evidence: {
      type: "array",
      items: { type: "string" },
    },
    recommended_next_action: { type: "string" },
  },
} as const;
