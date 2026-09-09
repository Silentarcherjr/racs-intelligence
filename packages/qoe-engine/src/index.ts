export * from "./baseline.js";
export * from "./score.js";
export * from "./correlate.js";

import type { DnsEvent } from "@sentinel/dns-schema";
import { BaselineStore, windowStats } from "./baseline.js";
import { grade, scoreWindow, type QoeResult } from "./score.js";

/**
 * A window must score at least this well to be folded into the site baseline.
 *
 * Without this, a site that stays degraded teaches itself that degraded is
 * normal: three bad windows in a row and the EWMA baseline has absorbed the
 * fault, the penalties vanish and a broken resolver reports "excellent". That
 * is the exact opposite of what a NOC needs, and it is silent.
 *
 * A site that has never been healthy therefore keeps no baseline at all and
 * stays on the fixed reference — which is honest: it has shown us no "normal".
 */
export const HEALTHY_ENOUGH_FOR_BASELINE = 75;

/** Scores every site present in a window, updating each site's baseline. */
export { grade };

export function scoreAllSites(
  events: DnsEvent[],
  baselines: BaselineStore,
): QoeResult[] {
  const bySite = new Map<string, DnsEvent[]>();
  for (const e of events) {
    const list = bySite.get(e.siteId);
    if (list) list.push(e);
    else bySite.set(e.siteId, [e]);
  }

  const out: QoeResult[] = [];
  for (const [siteId, evs] of [...bySite].sort(([a], [b]) => a.localeCompare(b))) {
    const stats = windowStats(siteId, evs);
    if (!stats) continue;
    // Score against the baseline as it was *before* this window, and only then
    // decide whether this window deserves to shape what "normal" means.
    const result = scoreWindow(stats, baselines.get(siteId));
    if (result.window.score >= HEALTHY_ENOUGH_FOR_BASELINE) baselines.observe(stats);
    out.push(result);
  }
  return out;
}
