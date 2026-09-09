/**
 * Shared helpers for the cross-platform scripts.
 *
 * These exist in Node rather than bash so Windows works without WSL or Git
 * Bash. `scripts/verify-zero-egress.sh` stays bash on purpose: it inspects
 * sockets with lsof, which has no Windows equivalent worth faking.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import net from "node:net";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Loads .env into process.env.
 *
 * Parsed line by line rather than sourced. A value containing spaces — a model
 * path like ".../PRUEBA DE MODELOS/..." — breaks `source` in bash while Docker
 * Compose accepts it happily, and the variable just silently ends up unset.
 */
export function loadEnv() {
  const file = join(ROOT, ".env");
  if (!existsSync(file)) return;

  // Collected first, applied after — so a repeated key resolves the way bash
  // `source` and Docker Compose both resolve it: the LAST occurrence wins.
  // Applying as we go would let the first win, which means the same .env
  // behaves differently depending on which of the three parsers reads it.
  const parsed = new Map();
  for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    parsed.set(key, val);
  }
  // A variable already set in the real environment outranks the file.
  for (const [key, val] of parsed) {
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

/** Is something listening? Replaces `nc -z`, which Windows does not have. */
export function portOpen(hostPort, timeoutMs = 2000) {
  const idx = hostPort.lastIndexOf(":");
  const host = hostPort.slice(0, idx) || "127.0.0.1";
  const port = Number(hostPort.slice(idx + 1));
  return new Promise((res) => {
    const sock = new net.Socket();
    const done = (ok) => { sock.destroy(); res(ok); };
    sock.setTimeout(timeoutMs);
    sock.once("connect", () => done(true));
    sock.once("timeout", () => done(false));
    sock.once("error", () => done(false));
    sock.connect(port, host);
  });
}

export function clickhouseHeaders() {
  const user = process.env["CLICKHOUSE_USER"];
  if (!user) return {};
  return {
    "X-ClickHouse-User": user,
    "X-ClickHouse-Key": process.env["CLICKHOUSE_PASSWORD"] ?? "",
  };
}

export async function clickhouseQuery(sql) {
  const url = process.env["CLICKHOUSE_URL"] ?? "http://127.0.0.1:8123";
  const res = await fetch(`${url}/`, {
    method: "POST", body: sql, headers: clickhouseHeaders(),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text.split("\n")[0]);
  return text;
}

export const modelPath = () => {
  const dir = process.env["QVAC_MODELS_DIR"];
  return dir ? join(dir, "medpsy-4b-q4_k_m-imat.gguf") : null;
};

export const green = (s) => `\x1b[32m${s}\x1b[0m`;
export const red = (s) => `\x1b[31m${s}\x1b[0m`;
export const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
export const ok = (s) => console.log(`  ${green("✓")} ${s}`);
export const bad = (s) => console.log(`  ${red("✗")} ${s}`);
export const warn = (s) => console.log(`  ${yellow("!")} ${s}`);
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
