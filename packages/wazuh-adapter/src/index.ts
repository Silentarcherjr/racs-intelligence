import type { Incident } from "@sentinel/dns-schema";
import { toWazuhAlert } from "./alert.js";
import { FanoutSink, FileSink, HttpSink, type AlertSink } from "./sinks.js";

export * from "./alert.js";
export * from "./sinks.js";

/**
 * Builds the sink set from the environment.
 *
 * Defaults to the file sink, because it works with no Wazuh deployment at all —
 * spec §16 says get a compatible path working first and integrate the real
 * manager after, and that is exactly the failure mode we are avoiding.
 */
export function sinkFromEnv(env: NodeJS.ProcessEnv = process.env): AlertSink {
  const sinks: AlertSink[] = [];
  const path = env["WAZUH_ALERTS_FILE"] ?? "./out/sentinel-alerts.json";
  sinks.push(new FileSink(path));
  const url = env["WAZUH_WEBHOOK_URL"];
  if (url) sinks.push(new HttpSink(url));
  return sinks.length === 1 ? sinks[0]! : new FanoutSink(sinks);
}

/** Formats an incident as a Wazuh alert and delivers it. */
export async function sendIncident(incident: Incident, sink: AlertSink): Promise<void> {
  await sink.send(toWazuhAlert(incident));
}
