#!/usr/bin/env node
/**
 * Prepara la máquina para grabar el video, para una persona.
 *
 *   npm run grabar
 *
 * Levanta lo que falte, mata lo que estorbe, calienta los modelos, verifica
 * que el producto muestre lo que debe, y se queda esperando. La persona solo
 * tiene que empezar a grabar y pulsar Enter.
 *
 * Existe porque a cinco horas del cierre nadie debería estar copiando comandos
 * de un documento: cada paso manual es una oportunidad de olvidar uno.
 */
import { spawn, spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import net from "node:net";
import { ROOT, clickhouseQuery, loadEnv, modelPath, portOpen, sleep } from "./lib.mjs";
import { existsSync } from "node:fs";

loadEnv();

const c = { g: "\x1b[32m", r: "\x1b[31m", y: "\x1b[33m", d: "\x1b[2m", b: "\x1b[1m", x: "\x1b[0m" };
const ok = (s) => console.log(`  ${c.g}✓${c.x} ${s}`);
const bad = (s) => console.log(`  ${c.r}✗${c.x} ${s}`);
const warn = (s) => console.log(`  ${c.y}!${c.x} ${s}`);
const step = (s) => console.log(`\n${c.b}${s}${c.x}`);

const sh = (cmd, args, opts = {}) =>
  spawnSync(cmd, args, { cwd: ROOT, encoding: "utf8", shell: process.platform === "win32", ...opts });

/** Mata lo que escuche en un puerto, en macOS/Linux y en Windows. */
function freePort(port) {
  if (process.platform === "win32") {
    const out = sh("powershell", ["-NoProfile", "-Command",
      `Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | ` +
      `ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`]);
    return out.status === 0;
  }
  const pids = sh("lsof", ["-ti", `:${port}`]).stdout?.trim();
  if (pids) for (const pid of pids.split("\n")) sh("kill", ["-9", pid]);
  return true;
}

let fatal = false;

console.log(`\n${c.b}  Preparación para grabar — RACS Intelligence${c.x}`);
console.log(`${c.d}  No tienes que copiar nada. Esto deja todo listo.${c.x}`);

// ── Código al día ───────────────────────────────────────────────────────────
step("1 · Código");
sh("git", ["pull", "--quiet"]);
const build = sh("npm", ["run", "build"]);
if (build.status === 0) ok("compilado y al día");
else { bad("el build falló — revisa: npm run build"); fatal = true; }

// ── Servicios ───────────────────────────────────────────────────────────────
step("2 · Servicios");
const broker = process.env["KAFKA_BROKER"] ?? "localhost:9092";
if (!(await portOpen(broker))) {
  warn("Kafka no responde, levantando contenedores…");
  sh("docker", ["compose", "up", "-d"], { stdio: "ignore" });
  for (let i = 0; i < 24 && !(await portOpen(broker)); i++) await sleep(5000);
}
if (await portOpen(broker)) ok(`Kafka en ${broker}`);
else { bad("Kafka no responde. ¿Docker Desktop / colima está corriendo?"); fatal = true; }

try {
  await clickhouseQuery("SELECT 1");
  ok("ClickHouse responde");
  const boot = sh("npm", ["run", "bootstrap"]);
  if (/Ready\./.test(boot.stdout ?? "")) ok("esquema aplicado");
  else warn("bootstrap no terminó en «Ready.» — revísalo si algo falla luego");
} catch {
  bad("ClickHouse no responde");
  fatal = true;
}

// ── Modelos ─────────────────────────────────────────────────────────────────
step("3 · Modelos locales");
const texto = modelPath();
if (texto && existsSync(texto)) ok("MedPsy-4B encontrado");
else { bad("falta MedPsy-4B. Revisa QVAC_MODELS_DIR en .env"); fatal = true; }

const visionDir = process.env["QVAC_VISION_MODELS_DIR"] ?? process.env["QVAC_MODELS_DIR"];
const vision = visionDir && existsSync(`${visionDir}/visionpsy-nano-460m-flash-q4_k_m-imat.gguf`);
if (vision) ok("VisionPsy encontrado");
else { bad("falta VisionPsy. Sin él no hay investigación visual — es el momento clave del video"); fatal = true; }

if (fatal) {
  console.log(`\n${c.r}  Hay fallos que impiden grabar. Arréglalos y vuelve a ejecutar.${c.x}\n`);
  process.exit(1);
}

// ── Interfaz ────────────────────────────────────────────────────────────────
step("4 · Interfaz");
freePort(3001);
await sleep(1500);
spawn(process.execPath, [`${ROOT}/apps/analyst-ui/dist/index.js`],
  { cwd: ROOT, detached: true, stdio: "ignore", env: { ...process.env, PORT: "3001" } }).unref();
await sleep(4000);

try {
  const res = await fetch("http://127.0.0.1:3001/api/capabilities");
  const cap = await res.json();
  if (cap.textModel) ok("interfaz levantada con el build nuevo");
  else { warn("la interfaz responde pero no ve el modelo de texto"); }
} catch {
  bad("la interfaz no responde en 3001");
  process.exit(1);
}

// ── Calentamiento ───────────────────────────────────────────────────────────
step("5 · Calentamiento (no se graba)");
console.log(`${c.d}  Carga los modelos en memoria. Sin esto el video tiene 15 s muertos.${c.x}`);
console.log(`${c.d}  Tarda unos 2 minutos. Espera.${c.x}\n`);
await new Promise((r) => {
  const p = spawn("npm", ["run", "demo", "--", "typosquat"],
    { cwd: ROOT, stdio: "ignore", shell: process.platform === "win32" });
  p.on("exit", r);
});

const filas = Number((await clickhouseQuery(
  "SELECT count() FROM sentinel.dns_incidents FINAL")).trim());
const conFoto = Number((await clickhouseQuery(
  "SELECT countIf(screenshot_path != '') FROM sentinel.dns_incidents FINAL")).trim());

if (filas >= 3) ok(`${filas} incidentes detectados`);
else { bad(`solo ${filas} incidentes — algo falló. No grabes así.`); process.exit(1); }

if (conFoto >= 1) ok(`${conFoto} con evidencia visual`);
else { bad("ningún incidente tiene captura. El momento clave del video no existiría."); process.exit(1); }

// ── Pantalla limpia ─────────────────────────────────────────────────────────
await clickhouseQuery("TRUNCATE TABLE sentinel.dns_incidents");
ok("pantalla limpia para empezar");

// ── Chuleta ─────────────────────────────────────────────────────────────────
console.log(`
${c.b}  ══════════════════════════════════════════════════════════════${c.x}
${c.b}   TODO LISTO${c.x}

   Antes de pulsar Enter:

     1. Abre  ${c.b}http://127.0.0.1:3001${c.x}  y recarga con Cmd/Ctrl + Shift + R
     2. Pon la terminal a la izquierda y el navegador a la derecha
     3. ${c.y}NO abras Grafana${c.x}
     4. Empieza a grabar, encuadrando SOLO esas dos ventanas

${c.b}   TOMAS — en este orden${c.x}

     0:00  Plano general de la interfaz, quieto
     0:30  Terminal: las detecciones apareciendo con su evidencia
     1:05  ${c.y}ZOOM a la línea «investigating:»${c.x} — es el momento clave
           Luego el render y el análisis visual. El riesgo sube de 64 a 89
     2:00  Clic en un incidente con 📷. La captura del sitio falso
     2:45  Pulsa «Explicar con QVAC». ${c.y}Graba los 5 segundos de espera${c.x}
     3:20  Baja a QoE y correlación: dos sedes, veredictos opuestos
     4:00  Terminal:  ./scripts/verify-zero-egress.sh
     4:35  Apaga el WiFi y vuelve a correr el demo. Funciona igual

${c.b}   NO HAGAS${c.x}

     · No aceleres nada que haya que leer
     · No cortes la espera de la inferencia — ese es el argumento
     · No narres: la voz se añade después

${c.b}  ══════════════════════════════════════════════════════════════${c.x}
`);

const rl = createInterface({ input: process.stdin, output: process.stdout });
await rl.question(`  ${c.b}Cuando estés grabando, pulsa Enter para arrancar el flujo…${c.x}`);
rl.close();

console.log("");
const demo = spawn("npm", ["run", "demo", "--", "typosquat", "--keep-alive"],
  { cwd: ROOT, stdio: "inherit", shell: process.platform === "win32" });
demo.on("exit", (code) => process.exit(code ?? 0));
