/**
 * ClickHouse writer — spec §7 MVP-6.
 *
 * Uses the HTTP interface with JSONEachRow, so there is no client library to
 * pin, break or audit. Rows are batched and flushed on a timer: a per-row
 * insert into a MergeTree table is the classic way to make ClickHouse miserable.
 *
 * Like every other sink in this project, it refuses to talk to a non-local
 * host. QoE rows carry site names and query patterns; that is telemetry, and
 * telemetry does not leave the machine (AGENTS.md §2).
 */

import type { DnsEvent, Incident } from "@sentinel/dns-schema";
import type { Correlation, QoeResult, SiteBaseline } from "@sentinel/qoe-engine";

/**
 * Credentials, when the deployment has them.
 *
 * The ClickHouse Docker image assigns the `default` user a random password
 * unless configured, so an unauthenticated client works against a native
 * install and fails in a container. Sent as headers rather than in the URL so
 * they never end up in a log line.
 */
export function clickhouseAuthHeaders(
  env: NodeJS.ProcessEnv = process.env,
): Record<string, string> {
  const user = env["CLICKHOUSE_USER"];
  const password = env["CLICKHOUSE_PASSWORD"];
  if (!user) return {};
  return { "X-ClickHouse-User": user, "X-ClickHouse-Key": password ?? "" };
}

const chTime = (iso: string): string =>
  new Date(iso).toISOString().replace("T", " ").replace("Z", "");

export type ClickHouseOptions = {
  url?: string;
  database?: string;
  /** Flush when a table's buffer reaches this many rows. */
  batchSize?: number;
  /** Flush at least this often, even if the buffer is small. */
  flushMs?: number;
};

export class ClickHouseWriter {
  readonly #url: string;
  readonly #db: string;
  readonly #batchSize: number;
  readonly #buffers = new Map<string, unknown[]>();
  #timer: NodeJS.Timeout | null = null;

  constructor(opts: ClickHouseOptions = {}) {
    const url = opts.url ?? process.env["CLICKHOUSE_URL"] ?? "http://127.0.0.1:8123";
    const host = new URL(url).hostname;
    const local =
      host === "localhost" || host === "127.0.0.1" || host === "::1" ||
      host === "clickhouse" || host.endsWith(".local") ||
      /^10\./.test(host) || /^192\.168\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host);
    if (!local) {
      throw new Error(
        `refusing to write telemetry to a non-local ClickHouse host: ${host}`,
      );
    }

    this.#url = url;
    this.#db = opts.database ?? process.env["CLICKHOUSE_DB"] ?? "sentinel";
    this.#batchSize = opts.batchSize ?? 500;

    const flushMs = opts.flushMs ?? 2000;
    if (flushMs > 0) {
      this.#timer = setInterval(() => void this.flush(), flushMs);
      this.#timer.unref?.();
    }
  }

  #push(table: string, row: unknown): void {
    const buf = this.#buffers.get(table);
    if (buf) buf.push(row);
    else this.#buffers.set(table, [row]);
    if ((this.#buffers.get(table)?.length ?? 0) >= this.#batchSize) void this.flush(table);
  }

  writeEvent(e: DnsEvent): void {
    this.#push("dns_events", {
      timestamp: chTime(e.timestamp), site_id: e.siteId, zone: e.zone,
      client_ip: e.clientIp, resolver_ip: e.resolverIp, qname: e.qname,
      qtype: e.qtype, rcode: e.rcode, latency_ms: e.latencyMs,
    });
  }

  writeQoe(r: QoeResult): void {
    const w = r.window;
    this.#push("dns_qoe_windows", {
      site_id: w.siteId,
      window_start: chTime(w.windowStart), window_end: chTime(w.windowEnd),
      score: w.score, grade: r.grade,
      latency_p50: w.latencyP50, latency_p95: w.latencyP95,
      nxdomain_rate: w.nxdomainRate, failure_rate: w.failureRate, query_rate: w.queryRate,
      penalty_latency: w.penalties.latency, penalty_nxdomain: w.penalties.nxdomain,
      penalty_failures: w.penalties.failures, penalty_saturation: w.penalties.saturation,
      explanation: r.explanation, used_baseline: r.usedBaseline ? 1 : 0,
    });
  }

  writeIncident(i: Incident): void {
    this.#push("dns_incidents", {
      incident_id: i.id, created_at: chTime(i.createdAt), updated_at: chTime(i.updatedAt),
      site_id: i.siteId, classification: i.classification,
      risk_score: i.riskScore, confidence: i.confidence,
      source_hosts: i.sourceHosts, domains: i.domains,
      evidence_types: i.evidence.map((e) => e.type),
      evidence_weights: i.evidence.map((e) => e.weight),
      evidence_descriptions: i.evidence.map((e) => e.description),
      explanation: i.explanation ?? "", recommended_action: i.recommendedAction ?? "",
      analysis_location: "local",
    });
  }

  writeBaseline(b: SiteBaseline, observedAt: string): void {
    this.#push("dns_site_baselines", {
      site_id: b.siteId, observed_at: chTime(observedAt),
      latency_p50_ms: b.latencyP50Ms, latency_p95_ms: b.latencyP95Ms,
      nxdomain_rate: b.nxdomainRate, failure_rate: b.failureRate,
      query_rate_per_sec: b.queryRatePerSec, samples: b.samples,
    });
  }

  writeCorrelation(c: Correlation): void {
    this.#push("dns_correlations", {
      site_id: c.siteId, window_end: chTime(c.windowEnd), qoe_score: c.qoeScore,
      verdict: c.verdict, correlation_score: c.correlationScore,
      reasoning: c.reasoning, related_incident_ids: c.relatedIncidentIds,
    });
  }

  /** Flushes one table, or all of them. Throws on failure — never silent. */
  async flush(only?: string): Promise<void> {
    const tables = only ? [only] : [...this.#buffers.keys()];
    for (const table of tables) {
      const rows = this.#buffers.get(table);
      if (!rows || rows.length === 0) continue;
      this.#buffers.set(table, []);

      const body = rows.map((r) => JSON.stringify(r)).join("\n");
      const query = `INSERT INTO ${this.#db}.${table} FORMAT JSONEachRow`;
      const res = await fetch(`${this.#url}/?query=${encodeURIComponent(query)}`, {
        method: "POST",
        body,
        headers: { "content-type": "application/x-ndjson", ...clickhouseAuthHeaders() },
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`ClickHouse insert into ${table} failed: ${res.status} ${detail}`);
      }
    }
  }

  async close(): Promise<void> {
    if (this.#timer) clearInterval(this.#timer);
    await this.flush();
  }
}
