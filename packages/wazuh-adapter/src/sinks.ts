/**
 * Where alerts go.
 *
 * Two sinks, matching how Wazuh is actually fed in the field:
 *
 *   FileSink — appends JSON lines to a path a Wazuh agent tails via
 *              logcollector. This is the standard, boring, works-offline
 *              integration and it is the one we default to.
 *   HttpSink — POSTs to a local endpoint, for setups that prefer a webhook.
 *
 * Both fail loudly. A dropped security alert must never be silent (AGENTS.md §7).
 */

import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { WazuhAlert } from "./alert.js";

export interface AlertSink {
  readonly name: string;
  send(alert: WazuhAlert): Promise<void>;
  close?(): Promise<void>;
}

/** Appends one JSON object per line — the format Wazuh's logcollector expects. */
export class FileSink implements AlertSink {
  readonly name = "file";
  #ready = false;

  constructor(private readonly path: string) {}

  async send(alert: WazuhAlert): Promise<void> {
    if (!this.#ready) {
      await mkdir(dirname(this.path), { recursive: true });
      this.#ready = true;
    }
    await appendFile(this.path, JSON.stringify(alert) + "\n", "utf8");
  }
}

/**
 * POSTs to a local Wazuh endpoint.
 *
 * The URL must stay on the host. This is a zero-egress product: an alert
 * carrying domain names and host addresses leaving the machine would break the
 * one promise the whole thing is built on (AGENTS.md §2).
 */
export class HttpSink implements AlertSink {
  readonly name = "http";

  constructor(private readonly url: string, private readonly timeoutMs = 5000) {
    const host = new URL(url).hostname;
    const local =
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host.endsWith(".local") ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host);
    if (!local) {
      throw new Error(
        `refusing to send alerts to a non-local host: ${host}. ` +
          `Sovereign Sentinel does not send telemetry off the machine.`,
      );
    }
  }

  async send(alert: WazuhAlert): Promise<void> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await fetch(this.url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(alert),
        signal: ctrl.signal,
      });
      if (!res.ok) {
        throw new Error(`wazuh endpoint returned ${res.status} ${res.statusText}`);
      }
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Writes to several sinks; one failing does not stop the others. */
export class FanoutSink implements AlertSink {
  readonly name = "fanout";

  constructor(private readonly sinks: AlertSink[]) {}

  async send(alert: WazuhAlert): Promise<void> {
    const results = await Promise.allSettled(this.sinks.map((s) => s.send(alert)));
    const failed = results.flatMap((r, i) =>
      r.status === "rejected" ? [`${this.sinks[i]!.name}: ${r.reason}`] : [],
    );
    if (failed.length === this.sinks.length) {
      throw new Error(`every alert sink failed — ${failed.join("; ")}`);
    }
    for (const f of failed) console.error(`alert sink failed (others succeeded) — ${f}`);
  }
}
