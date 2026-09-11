#!/usr/bin/env node
/**
 * Audita qué texto visible de la interfaz sigue sin traducción.
 *
 *   npm run audit:i18n
 *
 * Extrae las cadenas que la UI puede mostrar y las compara contra el
 * diccionario. Lo hace sobre el código, no sobre una captura de pantalla: un
 * repaso visual solo encuentra lo que está en la vista que abriste, y los
 * estados vacíos, los errores y los modales casi nunca lo están.
 *
 * Lo que NO reporta, a propósito:
 *   - Salida del modelo. Se le pide responder en español; no se traduce
 *     después, porque eso sería reescribir lo que el modelo dijo.
 *   - Identificadores: nombres de sede, dominios, IDs de modelo.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./lib.mjs";

const read = (p) => readFileSync(join(ROOT, p), "utf8");
const html = read("apps/analyst-ui/html/index.html");
const js = read("apps/analyst-ui/html/dashboard.js");
const i18n = read("apps/analyst-ui/html/i18n.js");

const known = new Set([...i18n.matchAll(/^\s*"([^"]{2,120})":/gm)].map((m) => m[1]));

/** Identifiers and data that must stay as they are. */
const IGNORE = [
  /^[a-z0-9._-]+$/,                 // slugs, filenames, site ids
  /^\d/,                            // numbers, versions
  /^(qvac|ca-|pa-|dns\.|10\.|127\.)/i,
  /\.(example|com|local|pa|org|info)\b/,
  /^[A-Z_]+$/,                      // CONSTANT_NAMES
  /^(GET|POST|px|em|vw|rgba?|http)/,
  // Template literals and regex fragments are code, not copy. Left in, they
  // make the audit noisy, and a noisy audit is one people stop running.
  /\$\{|\\\\|\|\||=>|\(\)|\[\^|\.replace\(|event\.|rect\./,
  // Proper nouns keep their spelling in every language.
  /^(RACS|VisionPsy|MedPsy|Grafana|ClickHouse|Kafka|Wazuh|QVAC|Docker)\b/,
];

const candidates = new Set();
const add = (t) => {
  const s = t.trim();
  if (s.length < 3 || s.length > 130) return;
  if (!/[a-z]{3}/.test(s)) return;
  if (!/^[A-Za-z]/.test(s)) return;
  if (IGNORE.some((re) => re.test(s))) return;
  candidates.add(s);
};

for (const src of [html, js]) {
  for (const m of src.matchAll(/>([^<>{}$]{3,120})</g)) add(m.group?.[1] ?? m[1]);
  for (const m of src.matchAll(/'([A-Z][^'\\]{3,120})'/g)) add(m[1]);
  for (const m of src.matchAll(/"([A-Z][^"\\]{3,120})"/g)) add(m[1]);
  for (const m of src.matchAll(/(?:aria-label|placeholder|title)="([^"]{3,120})"/g)) add(m[1]);
}

const missing = [...candidates].filter((s) => !known.has(s)).sort();

console.log(`\n  diccionario: ${known.size} entradas`);
console.log(`  candidatas visibles: ${candidates.size}`);

if (missing.length === 0) {
  console.log(`  \x1b[32m✓\x1b[0m sin cadenas visibles pendientes\n`);
  process.exit(0);
}

console.log(`  \x1b[33m!\x1b[0m ${missing.length} sin traducir:\n`);
for (const s of missing) console.log(`      ${s}`);
console.log(`
  Si alguna de estas es salida del modelo o un identificador, déjala: el
  objetivo no es traducirlo todo, es que no quede texto NUESTRO en inglés.\n`);
process.exit(1);
