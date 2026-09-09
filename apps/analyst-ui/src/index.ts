import { createReadStream, existsSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { loadEnv } from "./env.js";

// Before any other import reads process.env at module scope.
loadEnv();

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { queryClickHouse } from "./clickhouse.js";
import { explainIncident } from "@sentinel/qvac-runtime";

const __dirname = dirname(fileURLToPath(import.meta.url));
const HTML_DIR = join(__dirname, "..", "html");

const HOST = "127.0.0.1";
// 3000 belongs to Grafana in docker-compose.yml — do not reuse it.
const PORT = Number(process.env["PORT"] ?? 3001);

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", `http://${HOST}:${PORT}`);

  // Screenshots captured by the sandbox. Served read-only from out/evidence,
  // with the filename sanitised — the one thing this server must never do is
  // hand out arbitrary files because a path had ".." in it.
  if (url.pathname.startsWith("/evidence/")) {
    const name = basename(decodeURIComponent(url.pathname.slice("/evidence/".length)));
    const file = join(process.cwd(), "out", "evidence", name);
    if (/^[\w.-]+\.png$/.test(name) && existsSync(file)) {
      res.writeHead(200, { "content-type": "image/png", "cache-control": "no-store" });
      createReadStream(file).pipe(res);
    } else {
      res.writeHead(404).end();
    }
    return;
  }
  const path = url.pathname;

  res.setHeader("Content-Type", "application/json; charset=utf-8");

  try {
    if (req.method === "GET" && path === "/api/incidents") {
      const rows = await queryClickHouse(`
        SELECT
          incident_id, created_at, site_id, classification,
          risk_score, confidence, source_hosts, domains,
          evidence_types, evidence_weights, evidence_descriptions,
          recommended_action, screenshot_path
        FROM sentinel.dns_incidents FINAL
        ORDER BY risk_score DESC
      `);
      res.end(JSON.stringify(rows));
    }
    else if (req.method === "GET" && path.startsWith("/api/incidents/")) {
      const id = decodeURIComponent(path.slice("/api/incidents/".length));
      const rows = await queryClickHouse(`
        SELECT
          incident_id, created_at, site_id, classification,
          risk_score, confidence, source_hosts, domains,
          evidence_types, evidence_weights, evidence_descriptions,
          explanation, recommended_action,
          screenshot_path, visual_description, visual_model
        FROM sentinel.dns_incidents FINAL
        WHERE incident_id = '${id.replace(/'/g, "''")}'
      `);
      res.end(JSON.stringify(rows[0] ?? null));
    }
    else if (req.method === "POST" && path.startsWith("/api/explain/")) {
      const id = decodeURIComponent(path.slice("/api/explain/".length));
      const rows = await queryClickHouse(`
        SELECT
          incident_id AS id, created_at AS createdAt, updated_at AS updatedAt,
          site_id AS siteId, classification, risk_score AS riskScore,
          confidence, source_hosts AS sourceHosts, domains,
          evidence_types, evidence_weights, evidence_descriptions,
          explanation, recommended_action AS recommendedAction
        FROM sentinel.dns_incidents FINAL
        WHERE incident_id = '${id.replace(/'/g, "''")}'
      `);
      if (rows.length === 0) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: "Incident not found" }));
        return;
      }
      const row = rows[0];
      const incident = {
        id: row.id,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        siteId: row.siteId,
        classification: row.classification,
        riskScore: row.riskScore,
        confidence: row.confidence,
        sourceHosts: row.sourceHosts,
        domains: row.domains,
        evidence: row.evidence_types.map((type: string, i: number) => ({
          type,
          source: "behavioral",
          value: null,
          weight: row.evidence_weights[i],
          description: row.evidence_descriptions[i],
        })),
        explanation: row.explanation,
        recommendedAction: row.recommendedAction,
      };
      try {
        const response = await explainIncident(incident);
        res.end(JSON.stringify(response));
      } catch (err) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: String(err) }));
      }
    }
    else if (req.method === "GET" && path === "/api/qoe") {
      const rows = await queryClickHouse(`
        SELECT
          site_id, window_end, score, grade,
          latency_p50, latency_p95, nxdomain_rate, failure_rate,
          penalty_latency, penalty_nxdomain, penalty_failures, penalty_saturation,
          explanation
        FROM sentinel.dns_qoe_windows FINAL
        ORDER BY site_id, window_end DESC
        LIMIT 1 BY site_id
      `);
      res.end(JSON.stringify(rows));
    }
    else if (req.method === "GET" && path === "/api/correlations") {
      const rows = await queryClickHouse(`
        SELECT
          site_id, window_end, qoe_score, verdict,
          correlation_score, reasoning, related_incident_ids
        FROM sentinel.dns_correlations FINAL
        ORDER BY site_id, window_end DESC
        LIMIT 1 BY site_id
      `);
      res.end(JSON.stringify(rows));
    }
    else {
      // Serve static HTML
      const htmlPath = join(HTML_DIR, path === "/" ? "index.html" : path);
      try {
        const html = readFileSync(htmlPath, "utf-8");
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(html);
      } catch {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: "Not found" }));
      }
    }
  } catch (err) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: String(err) }));
  }
}

const server = createServer(handleRequest);
server.listen(PORT, HOST, () => {
  console.log(`[analyst-ui] Listening on http://${HOST}:${PORT}`);
});
