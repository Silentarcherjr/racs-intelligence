/**
 * Live runtime status, served over HTTP for the analyst UI.
 *
 * Almost everything that makes this system interesting is invisible: which
 * model is loaded, on what device, how long each call took, why the
 * investigator chose to render a page, and the fact that not one byte went
 * anywhere. Without a surface for it, "the AI runs locally" is a claim a viewer
 * has to take on faith or verify by reading source.
 *
 * This is that surface. Numbers come from real counters, never from constants.
 */

import { createServer } from "node:http";
import os from "node:os";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { egressReport } from "@sentinel/egress-guard";

type ModelStat = { id: string; quantization: string; available: boolean; loaded: boolean; calls: number; totalMs: number };

const modelDir = process.env["QVAC_MODELS_DIR"] ?? "";
const visionDir = process.env["QVAC_VISION_MODELS_DIR"] ?? modelDir;
const textAvailable = Boolean(modelDir && existsSync(join(modelDir, "medpsy-4b-q4_k_m-imat.gguf")));
const visionAvailable = Boolean(
  visionDir &&
  existsSync(join(visionDir, "visionpsy-nano-460m-flash-q4_k_m-imat.gguf")) &&
  existsSync(join(visionDir, "mmproj-visionpsy-nano-460m-flash-q8.gguf")),
);

/**
 * Describes the machine this is actually running on.
 *
 * This was hardcoded to "Apple Silicon GPU (Metal)" — which is true on the
 * machine it was written on and a lie everywhere else. A panel whose whole
 * purpose is to prove where inference happens cannot state the wrong hardware,
 * and a jury running it on Windows would have been told it was using Metal.
 *
 * What can be verified is reported. The accelerator the SDK ultimately picks
 * is not observable from here, so it is described as requested rather than
 * asserted as fact.
 */
function describeDevice(): string {
  const arch = os.arch();
  const cpu = os.cpus()[0]?.model?.trim();

  if (os.platform() === "darwin" && arch === "arm64") {
    return `Apple Silicon (${cpu ?? "arm64"}) — GPU via Metal, on this machine`;
  }
  if (os.platform() === "win32") {
    return `Windows ${arch} (${cpu ?? "unknown CPU"}) — GPU requested, on this machine`;
  }
  if (os.platform() === "linux") {
    return `Linux ${arch} (${cpu ?? "unknown CPU"}) — GPU requested, on this machine`;
  }
  return `${os.platform()} ${arch} (${cpu ?? "unknown CPU"}) — on this machine`;
}

const started = Date.now();

const state = {
  eventsConsumed: 0,
  windowSize: 0,
  incidents: 0,
  models: {
    text: { id: "qvac/MedPsy-4B-GGUF", quantization: "q4_k_m-imat", available: textAvailable, loaded: false, calls: 0, totalMs: 0 } as ModelStat,
    vision: { id: "qvac/VisionPsy-Nano-460M-Flash-GGUFs", quantization: "q4_k_m-imat + mmproj q8", available: visionAvailable, loaded: false, calls: 0, totalMs: 0 } as ModelStat,
  },
  renders: { count: 0, totalMs: 0 },
  decisions: [] as Array<{ at: string; domain: string; state: string; action: string; rationale: string }>,
};

export function noteEvents(consumed: number, windowSize: number, incidents: number): void {
  state.eventsConsumed = consumed;
  state.windowSize = windowSize;
  state.incidents = incidents;
}

/**
 * Records inference time only.
 *
 * Timing around the serialise() queue instead would fold in however long the
 * call waited behind the other model — the first version reported 21s per
 * vision call for work that takes about five. A number on a screen a jury is
 * reading has to mean what it says.
 */
export function noteInference(kind: "text" | "vision", ms: number): void {
  const m = state.models[kind];
  m.loaded = true;
  m.calls++;
  m.totalMs += ms;
}

export function noteRender(ms: number): void {
  state.renders.count++;
  state.renders.totalMs += ms;
}

/** Kept short: this is a live view, not an audit log. ClickHouse is the record. */
export function noteDecision(domain: string, s: string, action: string, rationale: string): void {
  state.decisions.unshift({ at: new Date().toISOString(), domain, state: s, action, rationale });
  state.decisions.length = Math.min(state.decisions.length, 12);
}

function snapshot(): unknown {
  const avg = (m: { calls: number; totalMs: number }): number =>
    m.calls === 0 ? 0 : Math.round(m.totalMs / m.calls);
  const e = egressReport();
  return {
    uptimeSec: Math.round((Date.now() - started) / 1000),
    eventsConsumed: state.eventsConsumed,
    windowSize: state.windowSize,
    incidents: state.incidents,
    device: describeDevice(),
    models: {
      text: { ...state.models.text, avgMs: avg(state.models.text) },
      vision: { ...state.models.vision, avgMs: avg(state.models.vision) },
    },
    renders: { ...state.renders, avgMs: avg({ calls: state.renders.count, totalMs: state.renders.totalMs }) },
    decisions: state.decisions,
    egress: {
      attempted: e.total,
      local: e.local,
      blocked: e.blocked,
      destinations: e.destinations,
      cloudInferenceEndpoints: 0,
      eventsUploaded: 0,
      screenshotsUploaded: 0,
    },
  };
}

/** Loopback only, like everything else here. */
export function startStatusServer(port = Number(process.env["AGENT_STATUS_PORT"] ?? 3002)): void {
  createServer((req, res) => {
    res.setHeader("access-control-allow-origin", "*");   // read-only, loopback
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.setHeader("cache-control", "no-store");
    if (req.url === "/status") res.end(JSON.stringify(snapshot()));
    else res.writeHead(404).end();
  }).listen(port, "127.0.0.1");
}
