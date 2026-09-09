/**
 * Loads .env before anything reads process.env.
 *
 * The scripts do this for the pipeline, but the UI is started directly
 * (`npm start -w @sentinel/analyst-ui`) and would otherwise miss the
 * ClickHouse credentials entirely — failing with "Authentication failed",
 * which reads like a broken database rather than an unloaded config file.
 *
 * Parsed line by line, last occurrence wins, real environment variables
 * outrank the file — the same semantics as bash `source` and Docker Compose,
 * so one file never means three different things.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function loadEnv(): void {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
  const file = join(root, ".env");
  if (!existsSync(file)) return;

  const parsed = new Map<string, string>();
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
  for (const [key, val] of parsed) {
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
