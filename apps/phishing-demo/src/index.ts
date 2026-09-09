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
const page = readFileSync(join(here, "../site/index.html"), "utf8");
const port = Number(process.env["PHISHING_DEMO_PORT"] ?? 8099);

createServer((_req, res) => {
  res.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    // Nothing about this page should be cached or indexed anywhere.
    "cache-control": "no-store",
    "x-robots-tag": "noindex, nofollow",
  });
  res.end(page);
}).listen(port, "127.0.0.1", () =>
  console.error(`synthetic phishing page on http://127.0.0.1:${port}`),
);
