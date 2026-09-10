/**
 * Serves the synthetic phishing page for the visual investigation demo.
 *
 * The demo cannot browse the internet — that would break zero-egress and there
 * is no real site to visit anyway, since the domains are all `.example`. So the
 * page the sandbox renders is served here, on loopback.
 *
 * Binds to 127.0.0.1 only. A mock credential form reachable from the network,
 * even a fictional one, is not something to leave lying around.
 */
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env["PHISHING_DEMO_PORT"] ?? 8099);

/**
 * Which page a hostname gets.
 *
 * The Track 02 evaluation set needs benign controls as well as the decoy: a
 * detector that only ever says "phishing" scores zero on the half of the world
 * that is not. Selection is by hostname so the sandbox genuinely navigates to
 * different sites rather than to different paths on one.
 */
const SITES: Array<[RegExp, string]> = [
  [/benign|nortia|logistica/i, "benign-corporate.html"],
  [/docs|meridian|sdk/i, "benign-docs.html"],
];
const pages = new Map<string, string>();
function pageFor(host: string): string {
  const file = SITES.find(([re]) => re.test(host))?.[1] ?? "index.html";
  let html = pages.get(file);
  if (!html) {
    html = readFileSync(join(here, "../site", file), "utf8");
    pages.set(file, html);
  }
  return html;
}

createServer((req, res) => {
  res.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    // Nothing about this page should be cached or indexed anywhere.
    "cache-control": "no-store",
    "x-robots-tag": "noindex, nofollow",
  });
  res.end(pageFor(String(req.headers.host ?? "")));
}).listen(port, "127.0.0.1", () =>
  console.error(`synthetic phishing page on http://127.0.0.1:${port}`),
);
