/**
 * Recording aid — opt-in only, does nothing unless armed with "#autodemo"
 * in the URL. Drives one smooth, precisely-timed walkthrough for the
 * screen recording so it does not depend on live clicks landing on a
 * re-rendering page:
 *
 *   Overview -> Incidents (mixed detections) -> a DGA incident -> a
 *   tunneling incident -> close -> the Banco Aurora incident -> evidence
 *   -> the captured screenshot -> "Explicar con QVAC" -> the finished
 *   explanation -> close -> Network health (QoE).
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

  async function openModalFor(predicate) {
    const btn = await waitFor(() => {
      const rows = [...document.querySelectorAll("tbody tr")];
      const row = rows.find(predicate);
      return row ? row.querySelector(".details-button") : null;
    }, 8000);
    if (!btn) return null;
    btn.click();
    return waitFor(() => {
      const dialog = document.getElementById("incident-modal");
      return dialog && dialog.hasAttribute("open") ? dialog : null;
    });
  }

  function closeModal() {
    document.getElementById("close-modal")?.click();
  }

  async function showBriefly(predicate, label) {
    step("opening " + label);
    const modal = await openModalFor(predicate);
    if (!modal) {
      step("no " + label + " incident found, skipping");
      return;
    }
    await sleep(1600);
    step("showing " + label + " evidence");
    await smoothScrollTo(modal, Math.round(modal.scrollHeight * 0.45), 1800);
    await sleep(3200);
    closeModal();
    await sleep(900);
  }

  async function run() {
    step("waiting for overview");
    await sleep(4000);

    step("toggling EN");
    document.querySelector('[data-lang="en"]')?.click();
    await sleep(2200);
    step("toggling back to ES");
    document.querySelector('[data-lang="es"]')?.click();
    await sleep(1600);

    step("clicking Incidentes");
    document.querySelector('a[href="#incidents"]')?.click();
    await sleep(2800);

    // Detection variety before the main investigation story.
    await showBriefly((r) => r.textContent.includes("Dga"), "DGA");
    await showBriefly((r) => r.textContent.includes("Tunneling"), "tunneling");

    step("finding Aurora row");
    const modal = await openModalFor(
      (r) =>
        r.textContent.includes("banco-aur0ra-login.example") &&
        r.textContent.includes("ca-banca-linea")
    );
    if (!modal) return step("FAILED: Aurora modal never opened");
    await sleep(1800);

    step("scrolling to evidence");
    await smoothScrollTo(modal, Math.round(modal.scrollHeight * 0.42), 2000);
    await sleep(3200);

    step("scrolling to screenshot");
    await smoothScrollTo(modal, modal.scrollHeight, 2200);
    await sleep(1800);

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

    await smoothScrollTo(modal, modal.scrollHeight, 900);
    await sleep(4500);

    step("closing modal");
    closeModal();
    await sleep(900);

    step("opening Salud de la red");
    document.querySelector('a[href="#network"]')?.click();
    await waitFor(() => document.querySelector(".qoe-score") || document.querySelector("table"));
    await sleep(5500);

    step("opening Inteligencia local");
    document.querySelector('a[href="#intelligence"]')?.click();
    await waitFor(() => {
      const grid = document.getElementById("runtime-grid");
      return grid && grid.children.length > 0 ? grid : null;
    });
    await sleep(6500);

    step("done");
  }

  run().catch((err) => step("ERROR: " + err.message));
})();
