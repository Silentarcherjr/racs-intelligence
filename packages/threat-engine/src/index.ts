import type { DnsEvent, Incident } from "@sentinel/dns-schema";
import { detectDga } from "./dga.js";
import { detectTyposquat } from "./typosquat.js";
import { detectTunneling } from "./tunneling.js";
import { detectBeaconing } from "./beaconing.js";
import { toIncident } from "./score.js";
import { DEFAULT_CONFIG, type DetectorConfig } from "./types.js";

export * from "./types.js";
export * from "./score.js";
export { detectDga } from "./dga.js";
export { detectTyposquat } from "./typosquat.js";
export { detectTunneling } from "./tunneling.js";
export { detectBeaconing } from "./beaconing.js";
export { normalizeHomoglyphs, levenshtein } from "./typosquat.js";

/**
 * Runs every detector over one window of events and returns incidents,
 * highest risk first.
 *
 * Deliberately *not* streaming: the caller owns windowing. Keeping this a pure
 * function of an event array is what makes it testable against the fixture and
 * reusable behind Kafka without change.
 */
export function analyzeWindow(
  events: DnsEvent[],
  cfg: DetectorConfig = DEFAULT_CONFIG,
): Incident[] {
  if (events.length === 0) return [];

  const windowEnd = events
    .map((e) => e.timestamp)
    .reduce((a, b) => (a > b ? a : b));

  const detections = [
    ...detectDga(events, cfg),
    ...detectTyposquat(events, cfg),
    ...detectTunneling(events, cfg),
    ...detectBeaconing(events, cfg),
  ];

  return detections
    .map((d) => toIncident(d, windowEnd))
    .sort((a, b) => b.riskScore - a.riskScore || a.id.localeCompare(b.id));
}
