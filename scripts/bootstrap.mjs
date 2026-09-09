#!/usr/bin/env node
/**
 * One-time setup check. Runs on macOS, Linux and Windows.
 *
 *   npm run bootstrap
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, bad, clickhouseQuery, loadEnv, modelPath, ok, portOpen, warn } from "./lib.mjs";

loadEnv();
let missing = 0;

console.log("\nSovereign Sentinel — bootstrap");
console.log("══════════════════════════════\n");

console.log("Toolchain");
const major = Number(process.versions.node.split(".")[0]);
if (major >= 22) ok(`node v${process.versions.node}`);
else { bad(`node v${process.versions.node} — need >= 22.17`); missing = 1; }

console.log("\nBuilding");
try {
  execSync("npm install --silent", { cwd: ROOT, stdio: "ignore" });
  execSync("npm run build", { cwd: ROOT, stdio: "ignore" });
  ok("workspace builds");
} catch {
  bad("build failed — run 'npm run build' to see why");
  missing = 1;
}

console.log("\nServices");
const broker = process.env["KAFKA_BROKER"] ?? "localhost:9092";
if (await portOpen(broker)) ok(`Kafka at ${broker}`);
else {
  bad(`Kafka not reachable at ${broker}`);
  console.log("      docker compose up -d kafka");
  missing = 1;
}

const chUrl = process.env["CLICKHOUSE_URL"] ?? "http://127.0.0.1:8123";
try {
  await clickhouseQuery("SELECT 1");
  ok(`ClickHouse at ${chUrl}`);
  // Statements are sent one at a time: the HTTP interface rejects a
  // multi-statement body, which is why this is not just a file POST.
  const sql = readFileSync(join(ROOT, "infra/clickhouse/schema.sql"), "utf8")
    .replace(/--[^\n]*/g, "")
    .split(";").map((s) => s.trim()).filter(Boolean);
  for (const stmt of sql) await clickhouseQuery(stmt);
  ok(`schema applied (${sql.length} statements)`);
} catch (err) {
  warn(`ClickHouse not reachable at ${chUrl} — the demo runs without it, QoE is not stored`);
  console.log(`      ${String(err.message).slice(0, 120)}`);
}

console.log("\nLocal model weights (required only for explanations)");
const weights = modelPath();
if (weights && existsSync(weights)) ok("MedPsy-4B found in QVAC_MODELS_DIR");
else {
  warn("QVAC_MODELS_DIR not set or medpsy-4b-q4_k_m-imat.gguf missing");
  console.log("      Weights are never downloaded at run time — see docs/ZERO_EGRESS.md.");
  console.log("      Without them the demo still runs; incidents carry no analyst text.");
}

console.log("\n══════════════════════════════");
console.log(missing === 0 ? "Ready.  Next:  npm run demo" : "Fix the ✗ items above, then re-run.");
console.log("");
process.exit(missing);
