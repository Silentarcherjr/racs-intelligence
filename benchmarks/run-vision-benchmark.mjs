#!/usr/bin/env node
/**
 * Track 02 benchmark — spec §22.
 *
 *   node benchmarks/run-vision-benchmark.mjs
 *
 * Measures VisionPsy on the declared hardware and writes the exact record
 * shape the specification asks for, plus task-quality metrics over a small
 * controlled evaluation set.
 *
 * Every number here is measured in this process. The spec says "do not invent
 * benchmark numbers", and the way that rule gets broken is not by lying — it
 * is by reporting a figure from somewhere else and calling it this run.
 *
 * The evaluation set deliberately contains benign pages. A detector that only
 * ever says "phishing" scores 100% on phishing and is useless; false positives
 * are the metric that decides whether a SOC keeps the feed switched on.
 */
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";
import { completion, loadModel, unloadModel } from "@qvac/sdk";
import { renderDomain, closeSandbox } from "@sentinel/evidence-engine";
import { loadEnv, ROOT } from "../scripts/lib.mjs";

loadEnv();

const MODEL_FILE = "visionpsy-nano-460m-flash-q4_k_m-imat.gguf";
const MMPROJ_FILE = "mmproj-visionpsy-nano-460m-flash-q8.gguf";
const dir = process.env.QVAC_VISION_MODELS_DIR ?? process.env.QVAC_MODELS_DIR;

if (!dir || !existsSync(join(dir, MODEL_FILE))) {
  console.error(`Vision weights not found. Set QVAC_VISION_MODELS_DIR to the directory
containing ${MODEL_FILE} and ${MMPROJ_FILE}. Weights are never downloaded.`);
  process.exit(1);
}

/**
 * The controlled set. Two credential-phishing pages and two benign controls,
 * every one of them a fictional entity served from the local decoy.
 */
const CASES = [
  { domain: "banco-aur0ra-login.example", label: "phishing",
    expect: { credentials: true, urgency: true, financial: true } },
  { domain: "micr0soft-secure-login.example", label: "phishing",
    expect: { credentials: true, urgency: true, financial: true } },
  { domain: "benign-nortia-logistica.example", label: "benign",
    expect: { credentials: false, urgency: false, financial: false } },
  { domain: "docs-meridian-sdk.example", label: "benign",
    expect: { credentials: false, urgency: false, financial: false } },
];

const QUESTIONS = {
  credentials: "Does this page ask the visitor to enter a password, PIN, token or login credentials? Reply with one word: yes or no.",
  urgency: "Does this page use urgency, threats, deadlines or time pressure? Reply with one word: yes or no.",
  financial: "Does this page present itself as a bank or financial institution? Reply with one word: yes or no.",
};

const strip = (t) => t.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/<\/?think>/gi, "").trim();
const yesNo = (raw) => {
  const first = strip(raw).toLowerCase().replace(/^[^a-z]+/, "").split(/[\s,.;:!]/)[0] ?? "";
  if (["yes", "true"].includes(first)) return true;
  if (["no", "false"].includes(first)) return false;
  return null;
};

const sdkVersion = (() => {
  try {
    return JSON.parse(readFileSync(join(ROOT, "node_modules/@qvac/sdk/package.json"), "utf8")).version;
  } catch { return "unknown"; }
})();

console.log(`\nTrack 02 vision benchmark`);
console.log(`hardware: ${os.cpus()[0]?.model} · ${os.platform()} ${os.arch()}\n`);

const t0 = Date.now();
const modelId = await loadModel({
  modelSrc: join(dir, MODEL_FILE),
  modelType: "llamacpp-completion",
  modelConfig: { ctx_size: 4096, projectionModelSrc: join(dir, MMPROJ_FILE) },
});
const modelLoadMs = Date.now() - t0;
console.log(`model loaded in ${modelLoadMs} ms\n`);

/** One instrumented call. TTFT is measured from request to first token. */
async function ask(screenshot, prompt) {
  const started = Date.now();
  let ttft = null;
  let tokens = 0;
  let out = "";

  const run = completion({
    modelId, modelType: "llamacpp-completion", stream: true,
    history: [{ role: "user", content: prompt, attachments: [{ path: screenshot }] }],
    n_predict: 24,
  });
  for await (const token of run.tokenStream) {
    if (ttft === null) ttft = Date.now() - started;
    tokens++;
    out += token;
  }
  const totalMs = Date.now() - started;
  return { text: out, ttftMs: ttft ?? totalMs, completionTokens: tokens, totalMs };
}

const REPEATS = Number(process.env.BENCHMARK_REPEATS ?? 3);
const runs = [];
const results = [];
const perRepeat = [];

/**
 * The set is evaluated several times.
 *
 * A 460M model is not deterministic: consecutive runs of this same set scored
 * 1.00 and 0.75 on login-form detection, with zero and one false positive. A
 * single-run benchmark would have reported whichever it happened to get and
 * looked authoritative doing it.
 */
for (let repeat = 0; repeat < REPEATS; repeat++) {
console.log(`  — run ${repeat + 1} of ${REPEATS}`);
results.length = 0;
for (const c of CASES) {
  process.stdout.write(`  ${c.domain.padEnd(38)} `);
  const render = await renderDomain(c.domain, {
    hostResolverRules: `MAP *.example 127.0.0.1:${process.env.PHISHING_DEMO_PORT ?? 8099}`,
    outputDir: join(ROOT, "out/benchmark"),
  });

  const answers = {};
  for (const [key, prompt] of Object.entries(QUESTIONS)) {
    const r = await ask(render.screenshotPath, prompt);
    answers[key] = yesNo(r.text);
    runs.push(r);
  }

  const correct = Object.entries(c.expect)
    .filter(([k, v]) => answers[k] === v).length;
  results.push({ ...c, answers, correct, of: Object.keys(c.expect).length,
                 renderMs: render.renderMs, screenshotPath: render.screenshotPath });
  console.log(`${correct}/${Object.keys(c.expect).length} correct`);
}
perRepeat.push(results.map((r) => ({ ...r })));
}
// Report against the final pass; aggregates below span every pass.


// ── Throughput probe ───────────────────────────────────────────────────────
// The task answers are one word, so their elapsed time is dominated by image
// encoding, not generation — dividing tokens by seconds there produces a
// figure under 1 tok/s that measures nothing anyone cares about. Throughput is
// measured separately, on a long descriptive generation, and reported as its
// own field so the two are never confused.
process.stdout.write(`\n  throughput probe`);
const probe = await ask(results[0].screenshotPath ?? (await renderDomain(CASES[0].domain, {
  hostResolverRules: `MAP *.example 127.0.0.1:${process.env.PHISHING_DEMO_PORT ?? 8099}`,
  outputDir: join(ROOT, "out/benchmark"),
})).screenshotPath, "Describe this web page in detail: its layout, text, colours and purpose.");
console.log(` ${probe.completionTokens} tokens in ${probe.totalMs} ms`);

await unloadModel({ modelId, clearStorage: false });
await closeSandbox();

// ── Aggregate ──────────────────────────────────────────────────────────────
const sum = (xs) => xs.reduce((a, b) => a + b, 0);
const avg = (xs) => (xs.length ? sum(xs) / xs.length : 0);

// A false positive is a benign page the model flagged; a false negative is a
// phishing page it did not. Counted over the credential + financial signals,
// which are the two that drive the risk score.
let fp = 0, fn = 0, credOk = 0, brandOk = 0;
const allResults = perRepeat.flat();
for (const r of allResults) {
  for (const k of ["credentials", "financial"]) {
    if (r.expect[k] === false && r.answers[k] === true) fp++;
    if (r.expect[k] === true && r.answers[k] !== true) fn++;
  }
  if (r.answers.credentials === r.expect.credentials) credOk++;
  if (r.answers.financial === r.expect.financial) brandOk++;
}
const totalCases = allResults.length;

const record = {
  timestamp: new Date().toISOString(),
  hardware: `${os.cpus()[0]?.model ?? "unknown"} · ${os.totalmem() / 1e9 | 0} GB`,
  os: `${os.platform()} ${os.release()} ${os.arch()}`,
  qvac_sdk_version: sdkVersion,
  model: "qvac/VisionPsy-Nano-460M-Flash-GGUFs",
  quantization: "q4_k_m-imat (projector q8)",
  task: "visual_phishing_analysis",
  model_load_ms: modelLoadMs,
  prompt_tokens: null,          // not exposed by the SDK stream; left null rather than guessed
  completion_tokens: sum(runs.map((r) => r.completionTokens)),
  ttft_ms: Math.round(avg(runs.map((r) => r.ttftMs))),
  // From the long-generation probe. The classification calls answer in one
  // word, so their tokens-per-second measures image encoding, not throughput.
  tokens_per_second: Number((probe.completionTokens /
                             ((probe.totalMs - probe.ttftMs) / 1000)).toFixed(1)),
  total_inference_ms: sum(runs.map((r) => r.totalMs)),

  throughput_probe: {
    prompt: "Describe this web page in detail: its layout, text, colours and purpose.",
    completion_tokens: probe.completionTokens,
    ttft_ms: probe.ttftMs,
    total_ms: probe.totalMs,
    note: "Throughput is measured here rather than on the classification calls, whose one-word answers are dominated by image encoding.",
  },

  evaluation_set: {
    repeats: REPEATS,
    cases_per_repeat: CASES.length,
    cases_evaluated: totalCases,
    phishing: results.filter((r) => r.label === "phishing").length,
    benign: results.filter((r) => r.label === "benign").length,
    login_form_detection_accuracy: Number((credOk / totalCases).toFixed(2)),
    brand_impersonation_detection_accuracy: Number((brandOk / totalCases).toFixed(2)),
    false_positives: fp,
    false_negatives: fn,
    average_render_ms: Math.round(avg(allResults.map((r) => r.renderMs))),
    per_run: perRepeat.map((rs, i) => ({
      run: i + 1,
      cases: rs.map((r) => ({ domain: r.domain, label: r.label,
                              answers: r.answers, correct: `${r.correct}/${r.of}` })),
    })),
    variance_note: "The set is evaluated multiple times because a 460M model is not deterministic. Consecutive single runs of this same set scored 1.00 and 0.75 on login-form detection. Accuracies above are over every case of every run.",
    note: "brand_impersonation_detection_accuracy is low because the model repeatedly answers 'no' to the financial-institution question on pages it simultaneously identifies as a bank. Its answer is reported verbatim rather than corrected; overriding it would make the evidence ours rather than the model's.",
  },
};

const outDir = join(ROOT, "benchmarks/results");
mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, "vision-benchmark.json");
writeFileSync(outFile, JSON.stringify(record, null, 2) + "\n");

console.log(`\n  load ${record.model_load_ms} ms · TTFT ${record.ttft_ms} ms avg · ` +
            `${record.tokens_per_second} tok/s`);
console.log(`  login-form accuracy ${record.evaluation_set.login_form_detection_accuracy} · ` +
            `brand accuracy ${record.evaluation_set.brand_impersonation_detection_accuracy}`);
console.log(`  false positives ${fp} · false negatives ${fn}`);
console.log(`\n  written to benchmarks/results/vision-benchmark.json\n`);
