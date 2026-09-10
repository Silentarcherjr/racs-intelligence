/** Run from the repository root: node apps/analyst-ui/verify-ui.mjs
 * Requires the analyst UI, ClickHouse and the project's Playwright Chromium.
 * Exercises actual local records; does not seed or change incident data.
 */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
const output = fileURLToPath(new URL('../../node_modules/.cache/sentinel/', import.meta.url));
await mkdir(output,{recursive:true});
const browser = await chromium.launch({headless:true});
const errors = [];
try {
  const page = await browser.newPage({viewport:{width:1536,height:1080}});
  page.on('pageerror',error=>errors.push(error.message));
  const response = await page.goto('http://127.0.0.1:3001');
  assert.equal(response.status(),200);
  await page.waitForFunction(()=>document.querySelector('#feed-status').textContent==='Local data connected');
  const incidents = await (await page.request.get('http://127.0.0.1:3001/api/incidents')).json();
  assert.equal(Number(await page.locator('#metric-incidents').innerText()),incidents.length);
  assert.equal(await page.locator('#error-banner').isVisible(),false);
  assert.ok(await page.locator('.brand-mark img').evaluate(image=>image.complete && image.naturalWidth>0));
  const css = await page.request.get('http://127.0.0.1:3001/dashboard.css');
  assert.ok(css.headers()['content-type'].startsWith('text/css'));
  const script = await page.request.get('http://127.0.0.1:3001/dashboard.js');
  assert.ok(script.headers()['content-type'].startsWith('text/javascript'));
  assert.equal((await page.request.get('http://127.0.0.1:3001/src/index.ts')).status(),404);
  await page.screenshot({path:output+'ui-desktop.png',fullPage:true});
  await page.locator('#incident-search').fill('does-not-exist.invalid');
  assert.match(await page.locator('#incidents-body').innerText(),/No incidents match|No incidents yet/);
  await page.locator('#incident-search').fill('');
  await page.locator('#risk-filter').selectOption('high');
  assert.equal(await page.locator('[data-incident]').count(),incidents.filter(x=>x.risk_score>=70).length);
  await page.locator('#risk-filter').selectOption('all');
  if(incidents.length) {
    const visual = incidents.find(x=>x.screenshot_path);
    const selected = visual || incidents[0];
    await page.locator('[data-incident]').evaluateAll((buttons,id)=>buttons.find(button=>button.dataset.incident===id).click(),selected.incident_id);
    await page.locator('#incident-detail .evidence-list').waitFor();
    assert.equal(await page.locator('#incident-modal').isVisible(),true);
    assert.match(await page.locator('#incident-detail').innerText(),/Detection evidence/);
    if(visual) {
      await page.waitForFunction(()=>{const image=document.querySelector('#evidence-image');return image?.complete && image.naturalWidth>0;});
    }
    await page.screenshot({path:output+'ui-evidence.png'});
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#incident-modal').isVisible(),false);
  }
  await page.locator('[data-view="network"]').click();
  await page.waitForFunction(()=>document.querySelector('#page-title').textContent==='Network health');
  assert.equal(await page.locator('#incidents-section').isVisible(),false);
  await page.locator('[data-view="incidents"]').click();
  await page.waitForFunction(()=>document.querySelector('#page-title').textContent==='Incident investigation');
  assert.equal(await page.locator('#incidents-section').isVisible(),true);
  await page.locator('[data-view="overview"]').click();
  await page.waitForFunction(()=>document.querySelector('#page-title').textContent==='Security overview');
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#export-button').click();
  const download = await downloadPromise;
  assert.match(download.suggestedFilename(),/^sentinel-incidents-.*\.json$/);
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:output+'ui-mobile.png',fullPage:true});
  const dimensions = await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));
  assert.ok(dimensions.scrollWidth<=dimensions.width,`Mobile page overflows: ${JSON.stringify(dimensions)}`);
  assert.equal(errors.length,0,errors.join('\n'));
  const result = {passed:true,incidents:incidents.length,visualIncidents:incidents.filter(x=>x.screenshot_path).length,desktop:'1536x1080',mobile:'390x844',pageErrors:errors,checks:['real API metrics','local assets','static file allowlist','search','risk filter','incident details','screenshot evidence','Escape closes dialog','navigation','JSON export','mobile overflow']};
  await writeFile(output+'ui-verification.json',JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));
} finally {await browser.close();}