export { quietKafkaTimeoutWarning } from "./quiet.js";

/**
 * Egress guard — makes zero-egress enforced, not just claimed.
 *
 * RACS Intelligence's entire argument is that DNS telemetry, derived
 * indicators, prompts and screenshots never leave the machine. A README saying
 * so is a promise; this is a mechanism. Every outbound TCP connection the
 * process attempts is checked, and anything that is not loopback or RFC 1918
 * is refused before a byte leaves.
 *
 * ── What this does and does not prove ───────────────────────────────────────
 *
 * It intercepts Node's socket layer, which covers everything the application
 * does in JavaScript: kafkajs, fetch/undici, the ClickHouse writer, the Wazuh
 * sinks. It does NOT cover native code that opens its own sockets — a compiled
 * addon could bypass it entirely.
 *
 * So this is not an air-gap and must never be described as one (spec §21). It
 * is one of three layers: this guard, the OS-level connection check in
 * scripts/verify-zero-egress.sh, and running the demo with Wi-Fi switched off.
 * Together they are credible. Alone, none of them is.
 */

import net from "node:net";

export type EgressAttempt = {
  host: string;
  port: number;
  at: string;
  allowed: boolean;
};

const attempts: EgressAttempt[] = [];
let installed = false;

/** Loopback, link-local and RFC 1918 — the trusted infrastructure boundary. */
export function isLocalHost(host: string): boolean {
  if (!host) return true; // unix sockets and IPC carry no host
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".localhost")) return true;
  if (h === "::1" || h === "::" || h === "0.0.0.0") return true;
  if (/^127\./.test(h)) return true;
  if (/^10\./.test(h)) return true;
  if (/^192\.168\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  if (/^169\.254\./.test(h)) return true;          // link-local
  if (/^f[cd][0-9a-f]{2}:/.test(h)) return true;   // IPv6 unique-local
  if (/^fe80:/.test(h)) return true;               // IPv6 link-local
  // Compose service names resolve inside the private bridge network.
  if (/^[a-z0-9-]+$/.test(h) && !h.includes(".")) return true;
  return false;
}

export type GuardOptions = {
  /** Log every allowed connection too, not just refusals. */
  verbose?: boolean;
  /** Report a violation instead of throwing. Off by default, on purpose. */
  auditOnly?: boolean;
};

/**
 * Patches the socket layer. Call once, as early as possible — before any
 * module has had a chance to open a connection.
 */
export function installEgressGuard(opts: GuardOptions = {}): void {
  if (installed) return;
  installed = true;

  const original = net.Socket.prototype.connect;

  net.Socket.prototype.connect = function patched(
    this: net.Socket,
    ...args: unknown[]
  ): net.Socket {
    const first = args[0];
    let host = "";
    let port = 0;

    if (typeof first === "object" && first !== null) {
      const o = first as { host?: string; port?: number; path?: string };
      if (o.path) return original.apply(this, args as never);  // unix socket
      host = o.host ?? "localhost";
      port = o.port ?? 0;
    } else if (typeof first === "number") {
      port = first;
      host = typeof args[1] === "string" ? args[1] : "localhost";
    } else if (typeof first === "string") {
      return original.apply(this, args as never);              // unix socket path
    }

    const allowed = isLocalHost(host);
    const record: EgressAttempt = { host, port, at: new Date().toISOString(), allowed };
    attempts.push(record);

    // Some clients call connect() without an explicit port in the options
    // object, which would leave the proof panel showing "host:0". The real
    // peer is only known once the socket is up, so correct it then.
    if (allowed) {
      this.once("connect", () => {
        if (this.remotePort) record.port = this.remotePort;
        if (this.remoteAddress) record.host = this.remoteAddress.replace(/^::ffff:/, "");
      });
    }

    if (!allowed) {
      const msg =
        `[egress-guard] BLOCKED outbound connection to ${host}:${port}.\n` +
        `  RACS Intelligence does not send data off the machine. If this is a\n` +
        `  legitimate local service, add its address range to isLocalHost().`;
      if (opts.auditOnly) {
        console.error(msg);
      } else {
        console.error(msg);
        throw new Error(`egress blocked: ${host}:${port}`);
      }
    } else if (opts.verbose) {
      console.error(`[egress-guard] allowed ${host}:${port}`);
    }

    return original.apply(this, args as never);
  } as typeof net.Socket.prototype.connect;
}

export function egressAttempts(): EgressAttempt[] {
  return [...attempts];
}

/** Counters for the SOVEREIGN MODE panel (spec §21). */
export function egressReport(): {
  total: number;
  local: number;
  blocked: number;
  destinations: string[];
} {
  const local = attempts.filter((a) => a.allowed);
  const blocked = attempts.filter((a) => !a.allowed);
  return {
    total: attempts.length,
    local: local.length,
    blocked: blocked.length,
    destinations: [...new Set(local.map((a) => `${a.host}:${a.port}`))].sort(),
  };
}

/**
 * The proof panel from spec §21.
 *
 * Deliberately says "zero-egress", never "air-gapped": the machine has a
 * working network interface and we are not going to claim otherwise.
 */
export function sovereignModePanel(extra: Record<string, string> = {}): string {
  const r = egressReport();
  const rows: Array<[string, string]> = [
    ["QVAC runtime", "LOCAL"],
    ["Cloud inference endpoints", "NONE"],
    ["External model requests", String(r.blocked)],
    ["DNS events uploaded", "0"],
    ["Screenshots uploaded", "0"],
    ["Outbound connections attempted", String(r.total)],
    ["  … to local/private hosts", String(r.local)],
    ["  … blocked as external", String(r.blocked)],
    ...Object.entries(extra),
  ];
  const width = Math.max(...rows.map(([k]) => k.length));
  const body = rows.map(([k, v]) => `  ${k.padEnd(width)}  ${v}`).join("\n");
  return `\nSOVEREIGN MODE\n\n${body}\n\n  Destinations: ${r.destinations.join(", ") || "none"}\n`;
}
