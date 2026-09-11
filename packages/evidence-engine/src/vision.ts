/**
 * Local visual analysis with VisionPsy.
 *
 * The screenshot never leaves the machine — that is the whole point of doing
 * this here rather than sending it to a vision API. Like the text analyst, the
 * model reports what it sees; it does not assign a risk score.
 *
 * ⚠️ VisionPsy GGUFs do NOT run on Homebrew's llama.cpp. The nanoVLM `mmproj`
 * uses a pixel-shuffle projector upstream does not implement, and it aborts
 * with "unknown projector type: custom". The QVAC SDK's engine does support it,
 * which is why inference goes through `@qvac/sdk` and not a local binary.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { completion, loadModel, unloadModel } from "@qvac/sdk";

const MODEL_FILE = "visionpsy-nano-460m-flash-q4_k_m-imat.gguf";
const MMPROJ_FILE = "mmproj-visionpsy-nano-460m-flash-q8.gguf";

/**
 * One question per call.
 *
 * VisionPsy-Nano is a 460M model. Asked for a composite line
 * ("BRAND=… | CREDENTIALS=yes | …") it drifts: sometimes prose, sometimes a
 * partial line, sometimes an invented field. A keyword fallback over that prose
 * then matched "financial" inside "does NOT appear to be a financial
 * institution" and inverted the model's own conclusion.
 *
 * Small model, small questions. Each call asks one thing and accepts one word,
 * which it answers reliably. Four calls at ~3s each is a fair price for
 * evidence that is actually what the model said.
 */
export const VISION_QUESTIONS = {
  brand:
    "Look at this screenshot. What organisation or brand name is shown? " +
    "Reply with the name only, or 'unknown'.",
  credentials:
    "Does this page ask the visitor to enter a password, PIN, token or login " +
    "credentials? Reply with one word: yes or no.",
  urgency:
    "Does this page use urgency, threats, deadlines or time pressure? " +
    "Reply with one word: yes or no.",
  financial:
    "Does this page present itself as a bank or financial institution? " +
    "Reply with one word: yes or no.",
} as const;

/** Kept for the record: the description shown to an analyst is assembled below. */
export const VISION_PROMPT = VISION_QUESTIONS.brand;

export type VisionFindings = {
  /** The model's own words. Shown to the analyst verbatim. */
  description: string;
  brand: string | null;
  /**
   * `null` means the model's answer could not be read with confidence.
   *
   * Deliberately three-valued. Collapsing unknown into `false` would let a
   * failed read quietly become a finding of absence, which is a claim we did
   * not earn — and, on the other side, an unparseable answer must never be
   * guessed into a positive. Unknown contributes no evidence at all.
   */
  credentialForm: boolean | null;
  urgencyLanguage: boolean | null;
  financialBranding: boolean | null;
  /** False when the structured line could not be parsed. */
  parsed: boolean;
  inferenceMs: number;
  model: string;
};

/**
 * Weights are never downloaded (AGENTS.md §2). Fails loudly and says what is
 * missing, exactly like the text analyst.
 */
function weightPaths(): { model: string; mmproj: string } {
  const dir = process.env["QVAC_VISION_MODELS_DIR"] ?? process.env["QVAC_MODELS_DIR"];
  if (!dir) {
    throw new Error(
      `[vision] QVAC_VISION_MODELS_DIR is not set.\n` +
        `  Visual analysis needs ${MODEL_FILE} and ${MMPROJ_FILE} on disk.\n` +
        `  RACS Intelligence never downloads model weights — see docs/ZERO_EGRESS.md.`,
    );
  }
  const model = join(dir, MODEL_FILE);
  const mmproj = join(dir, MMPROJ_FILE);
  for (const [label, p] of [["model", model], ["projector", mmproj]] as const) {
    if (!existsSync(p)) throw new Error(`[vision] ${label} weights not found: ${p}`);
  }
  return { model, mmproj };
}

let modelIdPromise: Promise<string> | undefined;

async function ensureModel(): Promise<string> {
  if (!modelIdPromise) {
    const { model, mmproj } = weightPaths();
    modelIdPromise = loadModel({
      modelSrc: model,
      // A plain path carries no engine hint, unlike the SDK's own constants,
      // so the engine has to be named explicitly.
      modelType: "llamacpp-completion",
      modelConfig: { ctx_size: 4096, projectionModelSrc: mmproj },
    } as unknown as Parameters<typeof loadModel>[0]);
  }
  return modelIdPromise;
}

export async function closeVision(): Promise<void> {
  if (!modelIdPromise) return;
  try {
    await unloadModel({ modelId: await modelIdPromise, clearStorage: false });
  } finally {
    modelIdPromise = undefined;
  }
}

/**
 * VisionPsy is a Qwen-family model and reasons inside <think> before answering.
 * The reasoning must not reach an analyst: it is exploratory, contradicts
 * itself on the way to a conclusion, and reads as though the system is unsure
 * of things it in fact decided.
 */
function stripThink(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "")
             .replace(/<\/?think>/gi, "")
             .trim();
}

function yesNo(raw: string): boolean | null {
  const v = stripThink(raw).trim().toLowerCase();
  // Only the leading word counts. "no, but it resembles one" is a no, and
  // scanning the whole sentence is how negation gets read backwards.
  const first = v.replace(/^[^a-zñáéíóú]+/i, "").split(/[\s,.;:!]/)[0] ?? "";
  if (["yes", "yeah", "true", "sí", "si"].includes(first)) return true;
  if (["no", "nope", "false"].includes(first)) return false;
  return null;
}

async function ask(modelId: string, screenshotPath: string, prompt: string,
                   maxTokens: number): Promise<string> {
  const run = completion({
    modelId,
    modelType: "llamacpp-completion",
    stream: true,
    history: [{ role: "user", content: prompt, attachments: [{ path: screenshotPath }] }],
    n_predict: maxTokens,
  } as unknown as Parameters<typeof completion>[0]);

  let out = "";
  for await (const token of run.tokenStream) out += token;
  return out;
}

export async function analyzeScreenshot(screenshotPath: string): Promise<VisionFindings> {
  const modelId = await ensureModel();
  const started = Date.now();

  const brandRaw = stripThink(await ask(modelId, screenshotPath, VISION_QUESTIONS.brand, 64));
  const credentialForm = yesNo(await ask(modelId, screenshotPath, VISION_QUESTIONS.credentials, 24));
  const urgencyLanguage = yesNo(await ask(modelId, screenshotPath, VISION_QUESTIONS.urgency, 24));
  const financialBranding = yesNo(await ask(modelId, screenshotPath, VISION_QUESTIONS.financial, 24));

  const brand = brandRaw && !/unknown|none/i.test(brandRaw)
    ? brandRaw.split(/[\n.]/)[0]!.trim().slice(0, 80)
    : null;

  // This sentence is assembled from the model's yes/no answers, so it is our
  // wording rather than its prose — writing it in Spanish translates nothing.
  const say = (v: boolean | null): string =>
    v === null ? "no se pudo determinar" : v ? "sí" : "no";
  const description =
    `Marca mostrada: ${brand ?? "desconocida"}. ` +
    `Pide credenciales: ${say(credentialForm)}. ` +
    `Usa urgencia o presión: ${say(urgencyLanguage)}. ` +
    `Se presenta como institución financiera: ${say(financialBranding)}.`;

  return {
    description,
    brand,
    credentialForm,
    urgencyLanguage,
    financialBranding,
    parsed: [credentialForm, urgencyLanguage, financialBranding].some((v) => v !== null),
    inferenceMs: Date.now() - started,
    model: "qvac/VisionPsy-Nano-460M-Flash-GGUFs q4_k_m-imat",
  };
}
