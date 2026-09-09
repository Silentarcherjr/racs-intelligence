/**
 * Minimal local Wazuh-compatible receiver.
 *
 * Spec §16: get a compatible endpoint working first, integrate the real manager
 * after — so that a Wazuh install going sideways cannot take the demo with it.
 * This is that endpoint. It prints what a Wazuh analyst would see.
 *
 *   npm run receiver -w @sentinel/wazuh-adapter
 */

import { quietKafkaTimeoutWarning } from "@sentinel/egress-guard";
import { createServer } from "node:http";
import type { WazuhAlert } from "./alert.js";

quietKafkaTimeoutWarning();

const port = Number(process.env["WAZUH_RECEIVER_PORT"] ?? 8081);
let count = 0;

const server = createServer((req, res) => {
  if (req.method !== "POST") {
    res.writeHead(405).end();
    return;
  }
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    try {
      const alert = JSON.parse(body) as WazuhAlert;
      const s = alert.sentinel;
      count++;
      console.log(
        `\n[${count}] level ${s.level} · ${s.classification} · risk ${s.risk_score}` +
          `\n    site ${s.site_id} · hosts ${s.source_hosts.join(", ")}` +
          `\n    domains ${s.domains.slice(0, 3).join(", ")}` +
          `\n    analysis: ${s.analysis_location}` +
          (s.explanation ? `\n    analyst: ${s.explanation}` : ""),
      );
      res.writeHead(200, { "content-type": "application/json" })
         .end(JSON.stringify({ ok: true }));
    } catch (err) {
      console.error("rejected malformed alert:", err);
      res.writeHead(400).end();
    }
  });
});

// Loopback only. This receiver must never be reachable off the host.
server.listen(port, "127.0.0.1", () =>
  console.log(`wazuh-compatible receiver on http://127.0.0.1:${port}`),
);
