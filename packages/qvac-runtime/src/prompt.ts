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
