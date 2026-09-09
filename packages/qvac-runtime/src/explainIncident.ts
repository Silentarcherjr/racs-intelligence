import { existsSync } from "node:fs";
import { join } from "node:path";
import { close, completion, loadModel, unloadModel } from "@qvac/sdk";
import {
  isAnalystResponse,
  type AnalystResponse,
  type Incident,
} from "@sentinel/dns-schema";
import { ANALYST_JSON_SCHEMA, SYSTEM_PROMPT } from "./prompt.js";

const MODEL_FILENAME = "medpsy-4b-q4_k_m-imat.gguf";

let modelIdPromise: Promise<string> | undefined;

function modelSrc(): string {
  const dir = process.env["QVAC_MODELS_DIR"];
  if (!dir) {
    throw new Error(
      `[qvac-runtime] QVAC_MODELS_DIR is not set. ` +
      `Model weights must be loaded from disk — never downloaded at runtime. ` +
      `Set QVAC_MODELS_DIR to the directory containing ${MODEL_FILENAME}.`,
    );
  }
  const local = join(dir, MODEL_FILENAME);
  if (!existsSync(local)) {
    throw new Error(
      `[qvac-runtime] ${MODEL_FILENAME} not found at ${local}. ` +
      `Model weights must be loaded from disk — never downloaded at runtime. ` +
      `Download the model manually and place it in QVAC_MODELS_DIR.`,
    );
  }
  return local;
}

async function ensureModel(): Promise<string> {
  if (!modelIdPromise) {
    modelIdPromise = loadModel({
      modelSrc: modelSrc(),
      modelType: "llamacpp-completion",
      modelConfig: {
        device: "gpu",
        ctx_size: 4096,
        reasoning_budget: 0,
      },
      onProgress: (p) => {
        const mb = (n: number) => (n / 1e6).toFixed(1);
        process.stderr.write(
          `\r[qvac-runtime] loading MedPsy-4B ${p.percentage.toFixed(0)}% (${mb(p.downloaded)}/${mb(p.total)} MB)`,
        );
        if (p.percentage >= 100) process.stderr.write("\n");
      },
    });
  }
  return modelIdPromise;
}

function fallbackResponse(incident: Incident): AnalystResponse {
  const confidence: AnalystResponse["confidence"] =
    incident.confidence >= 0.75
      ? "high"
      : incident.confidence >= 0.4
        ? "medium"
        : "low";
  return {
    summary:
      incident.explanation ??
      `Deterministic fallback for ${incident.classification} (riskScore=${incident.riskScore}). Model output was not used.`,
    likely_scenario: incident.classification,
    confidence,
    reasoning_evidence: incident.evidence.map((item) => item.description),
    recommended_next_action:
      incident.recommendedAction ??
      "Review the deterministic evidence locally. Do not request external cloud services.",
  };
}

function stripThink(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/<\/?think>/gi, "").trim();
}

function extractJson(text: string): unknown {
  const stripped = stripThink(text);
  const fenced = stripped.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? stripped).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new Error("model output did not contain a JSON object");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

function buildUserPrompt(incident: Incident): string {
  return [
    "Explain the following incident using only the structured evidence provided.",
    "Do not invent evidence. Do not invent or change risk scores. Do not confirm malware unless the input says confirmed.",
    "Return only JSON matching the required schema.",
    JSON.stringify({
      id: incident.id,
      siteId: incident.siteId,
      domains: incident.domains,
      sourceHosts: incident.sourceHosts,
      classification: incident.classification,
      riskScore: incident.riskScore,
      confidence: incident.confidence,
      evidence: incident.evidence,
      qoeImpact: incident.qoeImpact,
      recommendedAction: incident.recommendedAction,
    }),
  ].join("\n");
}

export async function explainIncident(
  incident: Incident,
): Promise<AnalystResponse> {
  const modelId = await ensureModel();
  const run = completion({
    modelId,
    stream: true,
    captureThinking: false,
    history: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(incident) },
    ],
    generationParams: {
      temp: 0.6,
      top_p: 0.95,
      top_k: 20,
      predict: 1024,
      reasoning_budget: 0,
    },
    responseFormat: {
      type: "json_schema",
      json_schema: {
        name: "AnalystResponse",
        schema: ANALYST_JSON_SCHEMA,
        strict: true,
      },
    },
    ...({ enable_thinking: false } as object),
  } as Parameters<typeof completion>[0]);

  let raw = "";
  try {
    const final = await run.final;
    raw = stripThink(final.contentText || final.raw.fullText || "");
    const parsed = extractJson(raw);
    if (!isAnalystResponse(parsed)) {
      console.error(
        "[qvac-runtime] AnalystResponse validation failed. Falling back to deterministic recommendedAction.",
      );
      console.error("[qvac-runtime] unvalidated model text (not shown to caller):", raw);
      return fallbackResponse(incident);
    }
    return parsed;
  } catch (err) {
    console.error(
      "[qvac-runtime] inference or parse failed. Falling back to deterministic recommendedAction.",
    );
    console.error("[qvac-runtime] error:", err);
    if (raw) {
      console.error("[qvac-runtime] unvalidated model text (not shown to caller):", raw);
    }
    return fallbackResponse(incident);
  }
}

export async function closeRuntime(): Promise<void> {
  if (!modelIdPromise) {
    await close();
    return;
  }
  try {
    const modelId = await modelIdPromise;
    await unloadModel({ modelId, clearStorage: false });
  } finally {
    modelIdPromise = undefined;
    await close();
  }
}
