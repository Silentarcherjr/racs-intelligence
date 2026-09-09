/**
 * Isolated browser sandbox — renders a suspicious domain and captures a
 * screenshot, and does nothing else.
 *
 * This is the one component that deliberately touches hostile content, so the
 * constraints matter more than the features (spec §9.3, §25):
 *
 *   - A fresh, throwaway browser context per investigation. No profile, no
 *     cookies, no storage, no credentials — nothing to steal and nothing that
 *     survives to the next page.
 *   - Navigation is pinned to the target host. A phishing page that redirects
 *     elsewhere does not get to take the sandbox with it.
 *   - Nothing is ever typed, clicked or submitted. We look; we do not interact.
 *   - Downloads are refused and a hard timeout applies.
 *   - Name resolution is redirected to the local demo server, so the sandbox
 *     never reaches the internet. In a real deployment this is the customer's
 *     own resolver — the code path is identical.
 */

import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { chromium, type Browser } from "playwright";

export type RenderResult = {
  domain: string;
  screenshotPath: string;
  title: string;
  /** Visible text, truncated. Used as corroboration, never as the sole signal. */
  visibleText: string;
  finalUrl: string;
  renderMs: number;
};

export type SandboxOptions = {
  /** Where screenshots land. Gitignored: evidence stays on the machine. */
  outputDir?: string;
  timeoutMs?: number;
  /**
   * Resolver override, e.g. "MAP *.example 127.0.0.1:8099".
   * Present so the demo resolves invented domains to the local decoy page
   * without touching DNS or the internet.
   */
  hostResolverRules?: string;
};

let browser: Browser | null = null;

async function ensureBrowser(rules?: string): Promise<Browser> {
  if (browser) return browser;
  browser = await chromium.launch({
    headless: true,
    args: [
      "--disable-background-networking",
      "--no-default-browser-check",
      "--no-first-run",
      "--disable-extensions",
      ...(rules ? [`--host-resolver-rules=${rules}`] : []),
    ],
  });
  return browser;
}

export async function closeSandbox(): Promise<void> {
  await browser?.close().catch(() => undefined);
  browser = null;
}

export async function renderDomain(
  domain: string,
  opts: SandboxOptions = {},
): Promise<RenderResult> {
  const outputDir = opts.outputDir ?? "./out/evidence";
  const timeoutMs = opts.timeoutMs ?? 15_000;
  const started = Date.now();

  const b = await ensureBrowser(opts.hostResolverRules);
  const context = await b.newContext({
    // A blank slate every time: no storage, no permissions, no service workers.
    storageState: undefined,
    permissions: [],
    javaScriptEnabled: true,
    viewport: { width: 1280, height: 900 },
    acceptDownloads: false,
    bypassCSP: false,
  });

  try {
    const page = await context.newPage();
    page.setDefaultTimeout(timeoutMs);

    // Pin navigation to the target host. Everything else is aborted, so a page
    // that tries to pull the sandbox somewhere else simply fails to.
    await page.route("**/*", (route) => {
      const host = new URL(route.request().url()).hostname;
      if (host === domain || host === "127.0.0.1" || host === "localhost") {
        void route.continue();
      } else {
        void route.abort();
      }
    });

    await page.goto(`http://${domain}/`, { waitUntil: "domcontentloaded", timeout: timeoutMs });

    const safeName = domain.replace(/[^a-z0-9.-]/gi, "_");
    const screenshotPath = join(outputDir, `${safeName}-${Date.now()}.png`);
    await mkdir(dirname(screenshotPath), { recursive: true });
    await page.screenshot({ path: screenshotPath, fullPage: false });

    const title = await page.title().catch(() => "");
    const visibleText = (await page.evaluate(() => document.body?.innerText ?? "")
      .catch(() => "")).replace(/\s+/g, " ").trim().slice(0, 800);

    return {
      domain,
      screenshotPath,
      title,
      visibleText,
      finalUrl: page.url(),
      renderMs: Date.now() - started,
    };
  } finally {
    // The context dies with the investigation, whatever happened inside it.
    await context.close().catch(() => undefined);
  }
}
