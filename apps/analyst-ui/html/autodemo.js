/**
 * Recording aid — opt-in only, does nothing unless armed with "#autodemo"
 * in the URL. Drives one smooth, precisely-timed walkthrough for the
 * screen recording so it does not depend on live clicks landing on a
 * re-rendering page: Overview -> Incidents -> the Banco Aurora incident ->
 * scroll through evidence and the captured screenshot -> "Explicar con
 * QVAC" -> hold on the finished explanation.
 *
 * Not part of the analyst product surface. Safe to leave in: it is inert
 * for every real user, since nobody links to "#autodemo".
 */
(function () {
  if (!location.hash.includes("autodemo")) return;

  const step = (label) => {
    console.log("[autodemo]", label);
    document.title = "AD: " + label;
  };

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  async function waitFor(fn, timeoutMs = 20000, stepMs = 150) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const value = fn();
      if (value) return value;
      await sleep(stepMs);
    }
    return null;
  }

  function smoothScrollTo(el, to, ms) {
    const from = el.scrollTop;
    const t0 = performance.now();
    return new Promise((resolve) => {
      function step(now) {
        const p = Math.min(1, (now - t0) / ms);
        const eased = 1 - Math.pow(1 - p, 3);
        el.scrollTop = from + (to - from) * eased;
        if (p < 1) requestAnimationFrame(step);
        else resolve();
      }
      requestAnimationFrame(step);
    });
  }

  async function run() {
    step("waiting for overview");
    await sleep(2500);

    step("clicking Incidentes");
    document.querySelector('a[href="#incidents"]')?.click();
    await sleep(2000);

    step("finding Aurora row");
    const openButton = await waitFor(() => {
      const rows = [...document.querySelectorAll("tbody tr")];
      const row = rows.find(
        (r) =>
          r.textContent.includes("banco-aur0ra-login.example") &&
          r.textContent.includes("ca-banca-linea")
      );
      return row ? row.querySelector(".details-button") : null;
    });
    if (!openButton) return step("FAILED: no row/button found");
    step("clicking Inspeccionar");
    openButton.click();

    step("waiting for modal");
    const modal = await waitFor(() => {
      const dialog = document.getElementById("incident-modal");
      return dialog && dialog.hasAttribute("open") ? dialog : null;
    });
    if (!modal) return step("FAILED: modal never opened");
    await sleep(1600);

    step("scrolling to evidence");
    await smoothScrollTo(modal, Math.round(modal.scrollHeight * 0.42), 2000);
    await sleep(2500);

    step("scrolling to screenshot");
    await smoothScrollTo(modal, modal.scrollHeight, 2200);
    await sleep(1400);

    step("finding explain button");
    const explainButton = await waitFor(() => {
      const btn = document.getElementById("explain-button");
      return btn && !btn.disabled ? btn : null;
    });
    if (!explainButton) return step("FAILED: explain button not found/enabled");
    step("clicking Explicar con QVAC");
    explainButton.click();

    step("waiting for QVAC result");
    const gotResult = await waitFor(() => {
      const result = document.getElementById("analysis-result");
      return result && /Resumen|Summary/i.test(result.textContent || "");
    }, 30000, 300);
    if (!gotResult) step("FAILED: no result within 30s");
    else step("done");

    await smoothScrollTo(modal, modal.scrollHeight, 900);
    await sleep(4000);
  }

  run().catch((err) => step("ERROR: " + err.message));
})();
