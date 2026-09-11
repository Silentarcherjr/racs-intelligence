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
const EVIDENCE_DIR = join(__dirname, "../../..", "out", "evidence");

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
    const file = join(EVIDENCE_DIR, name);
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
    else if (req.method === "GET" && path === "/api/capabilities") {
      // What THIS process can do, which is not the same question as what the
      // agent is doing. The UI runs inference itself through /api/explain, so
      // gating that button on the agent's status made it permanently disabled
      // whenever no demo happened to be running — which is most of the time.
      const modelsDir = process.env["QVAC_MODELS_DIR"] ?? "";
      const weights = modelsDir ? join(modelsDir, "medpsy-4b-q4_k_m-imat.gguf") : "";
      res.end(JSON.stringify({
        textModel: Boolean(weights && existsSync(weights)),
        reason: !modelsDir
          ? "QVAC_MODELS_DIR is not set for the UI process"
          : !existsSync(weights)
            ? `medpsy-4b-q4_k_m-imat.gguf not found in ${modelsDir}`
            : null,
      }));
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
      // Only named dashboard assets are public. Evidence has its own guarded route.
      const assets: Record<string, { file: string; type: string }> = {
        "/": { file: "index.html", type: "text/html; charset=utf-8" },
        "/index.html": { file: "index.html", type: "text/html; charset=utf-8" },
        "/dashboard.css": { file: "dashboard.css", type: "text/css; charset=utf-8" },
        "/dashboard.js": { file: "dashboard.js", type: "text/javascript; charset=utf-8" },
        "/i18n.js": { file: "i18n.js", type: "text/javascript; charset=utf-8" },
        "/racs-logo.jpeg": { file: "racs-logo.jpeg", type: "image/jpeg" },
      };
      const asset = assets[path];
      if (req.method !== "GET" || !asset) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: "Not found" }));
        return;
      }
      res.setHeader("Content-Type", asset.type);
      res.setHeader("Cache-Control", "no-store");
      res.end(readFileSync(join(HTML_DIR, asset.file)));
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
