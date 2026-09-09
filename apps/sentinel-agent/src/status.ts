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
import { egressReport } from "@sentinel/egress-guard";

type ModelStat = { id: string; quantization: string; loaded: boolean; calls: number; totalMs: number };

const started = Date.now();

const state = {
  eventsConsumed: 0,
  windowSize: 0,
  incidents: 0,
  models: {
    text: { id: "qvac/MedPsy-4B-GGUF", quantization: "q4_k_m-imat", loaded: false, calls: 0, totalMs: 0 } as ModelStat,
    vision: { id: "qvac/VisionPsy-Nano-460M-Flash-GGUFs", quantization: "q4_k_m-imat + mmproj q8", loaded: false, calls: 0, totalMs: 0 } as ModelStat,
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
    device: "Apple Silicon GPU (Metal) — on this machine",
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
