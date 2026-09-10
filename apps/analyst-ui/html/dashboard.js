'use strict';
const icons = {
  grid:'<rect x="3" y="3" width="7" height="7" rx="1.3"/><rect x="14" y="3" width="7" height="7" rx="1.3"/><rect x="3" y="14" width="7" height="7" rx="1.3"/><rect x="14" y="14" width="7" height="7" rx="1.3"/>',
  shield:'<path d="M12 3 20 6v6c0 4-4 7-8 9-4-2-8-5-8-9V6Z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  activity:'<path d="M2 12h5l3-8 4 16 3-8h5"/>',
  cpu:'<rect x="5" y="5" width="14" height="14" rx="3"/><rect x="9" y="9" width="6" height="6" rx="1"/><path d="M9 2v3m6-3v3M9 19v3m6-3v3M2 9h3m-3 6h3m14-6h3m-3 6h3"/>',
  chart:'<path d="M4 3v17h17M8 15l4-6 4 3 5-7"/>',
  external:'<path d="M14 3h7v7m0-7L10 14M10 4H4v16h16v-6"/>',
  download:'<path d="M12 3v12m-5-5 5 5 5-5M4 15v6h16v-6"/>',
  lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>',
  refresh:'<path d="M20 7a9 9 0 0 0-15-2L3 8m0-5v5h5m-4 9a9 9 0 0 0 15 2l2-3m0 5v-5h-5"/>',
  layers:'<path d="m12 3 10 5-10 5L2 8Zm-9 9 9 5 9-5m-18 5 9 5 9-5"/>',
  alert:'<path d="m12 3 10 18H2Zm0 6v5m0 3v.5"/>',
  network:'<rect x="9" y="2" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="16" y="16" width="6" height="6" rx="1"/><path d="M12 8v4H5v4m7-4h7v4"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.5"/>',
  search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>',
  arrow:'<path d="M4 12h16m-5-5 5 5-5 5"/>',
  pin:'<path d="M19 9c0 5-7 12-7 12S5 14 5 9a7 7 0 0 1 14 0Z"/><circle cx="12" cy="9" r="2"/>',
  camera:'<path d="M8 5 6 8H3v12h18V8h-3l-2-3Z"/><circle cx="12" cy="13" r="4"/>',
  scan:'<path d="M3 8V3h5m8 0h5v5M3 16v5h5m8 0h5v-5M3 12h18"/>'
};
const icon = name => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.shield}</svg>`;
document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); });
const $ = id => document.getElementById(id);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const clamp = value => Math.max(0, Math.min(100, num(value)));
const pretty = value => String(value || 'Unknown').replace(/^possible_/, '').replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
const numberFormat = new Intl.NumberFormat('en-US');
const state = {incidents:[], qoe:[], correlations:[], runtime:null, refreshing:false, hasData:false};
const riskClass = score => num(score) >= 70 ? 'risk-high' : num(score) >= 40 ? 'risk-medium' : 'risk-low';
const emptyRow = (cols, text) => `<tr><td colspan="${cols}" class="empty-cell">${escapeHtml(text)}</td></tr>`;
const REFRESH_MS = 4000;
let detailRequest = 0;
let toastTimeout;

async function getJSON(url, options = {}) {
  const response = await fetch(url, {...options, signal:options.signal || AbortSignal.timeout(12000)});
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}
function notify(message) {
  $('toast').textContent = message;
  $('toast').hidden = false;
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => { $('toast').hidden = true; }, 3500);
}
function setView() {
  const view = ['overview','incidents','network','intelligence'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'overview';
  const titles = {overview:['Security overview','A clear view of your threats. Complete control of your data.','Overview'],incidents:['Incident investigation','Follow the evidence from DNS signals to local visual analysis.','Incidents'],network:['Network health','Understand DNS experience and its connection to security events.','Network health'],intelligence:['Local intelligence','See what runs on your machine, and why the investigator acts.','Local intelligence']};
  $('page-title').textContent = titles[view][0];
  $('page-description').textContent = titles[view][1];
  $('breadcrumb-current').textContent = titles[view][2];
  document.querySelectorAll('[data-section]').forEach(el => {el.hidden = !el.dataset.section.split(' ').includes(view);});
  document.querySelectorAll('[data-view]').forEach(el => {
    el.classList.toggle('active', el.dataset.view === view);
    if (el.dataset.view === view) el.setAttribute('aria-current','page'); else el.removeAttribute('aria-current');
  });
}
window.addEventListener('hashchange', setView);
setView();
$('today').textContent = new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric'}).format(new Date());

function renderMetrics() {
  $('metric-incidents').textContent = numberFormat.format(state.incidents.length);
  $('metric-risk').textContent = numberFormat.format(state.incidents.filter(x => num(x.risk_score) >= 70).length);
  $('metric-incidents-note').textContent = `${state.incidents.filter(x => x.screenshot_path).length} with visual evidence`;
  const sites = state.qoe.length;
  $('metric-qoe').textContent = sites ? Math.round(state.qoe.reduce((sum,x) => sum + num(x.score), 0) / sites) : '—';
  $('metric-qoe-note').textContent = sites ? `Average across ${sites} reporting site${sites === 1 ? '' : 's'}` : 'No site telemetry yet';
  $('metric-sites').textContent = sites;
  $('nav-count').textContent = state.incidents.length;
  $('incident-count').textContent = state.incidents.length;
}
function renderCharts() {
  const incidents = state.incidents.slice(0,12);
  if (!incidents.length) {
    $('risk-chart').innerHTML = '<div class="empty-state">No incidents recorded. The next detection will appear here.</div>';
  } else {
    const width = 620, height = 175, left = 29, right = 12, top = 12, bottom = 32;
    const plotH = height - top - bottom, plotW = width - left - right;
    const step = plotW / incidents.length;
    let svg = '<svg viewBox="0 0 620 175" role="img" aria-label="Risk scores for the highest-risk observed incidents"><defs><linearGradient id="bar-cyan" x2="0" y2="1"><stop stop-color="#54cbed"/><stop offset="1" stop-color="#54cbed" stop-opacity=".15"/></linearGradient><linearGradient id="bar-coral" x2="0" y2="1"><stop stop-color="#fc8c91"/><stop offset="1" stop-color="#fc8c91" stop-opacity=".12"/></linearGradient></defs>';
    [0,25,50,75,100].forEach(score => {
      const y = top + plotH * (1 - score/100);
      svg += `<line class="chart-grid" x1="${left}" y1="${y}" x2="${width-right}" y2="${y}"/><text x="${left-8}" y="${y+3}" text-anchor="end">${score}</text>`;
    });
    const threshold = top + plotH * .3;
    svg += `<line x1="${left}" y1="${threshold}" x2="${width-right}" y2="${threshold}" stroke="#fc8c91" stroke-opacity=".3" stroke-dasharray="4 5"/>`;
    incidents.forEach((inc,i) => {
      const score = clamp(inc.risk_score), x = left + step*(i+.5), y = top + plotH*(1-score/100), barW = Math.min(35,step*.42);
      const domain = inc.domains?.[0] || inc.site_id;
      const label = incidents.length > 6 ? String(i+1) : domain.length > 16 ? domain.slice(0,13)+'…' : domain;
      const color = score >= 70 ? 'coral' : 'cyan';
      svg += `<g><title>${escapeHtml(domain)} · Risk ${score}/100</title><rect x="${x-barW/2}" y="${y}" width="${barW}" height="${Math.max(1,top+plotH-y)}" rx="4" fill="url(#bar-${color})"/><line x1="${x-barW/2+3}" x2="${x+barW/2-3}" y1="${y+1}" y2="${y+1}" stroke="${score>=70?'#fc8c91':'#54cbed'}" stroke-width="2"/><text x="${x}" y="${height-12}" text-anchor="middle">${escapeHtml(label)}</text></g>`;
    });
    $('risk-chart').innerHTML = svg + '</svg>';
  }
  const groups = new Map();
  state.incidents.forEach(x => groups.set(x.classification,(groups.get(x.classification)||0)+1));
  const palette = ['#54cbed','#a99af7','#fc8c91','#53d9b0','#e9bc79'];
  const entries = [...groups].sort((a,b)=>b[1]-a[1]);
  let offset = 0;
  const segments = entries.map(([label,count],i) => {
    const start = offset; offset += count/state.incidents.length*100;
    return `${palette[i%palette.length]} ${start}% ${offset}%`;
  });
  $('threat-donut').style.background = segments.length ? `conic-gradient(${segments.join(',')})` : '#26344a';
  $('donut-total').textContent = state.incidents.length;
  $('threat-legend').innerHTML = entries.length ? entries.map(([label,count],i) => `<div class="legend-row"><i class="legend-dot" style="background:${palette[i%palette.length]}"></i><span class="legend-name" title="${escapeHtml(pretty(label))}">${escapeHtml(pretty(label))}</span><strong>${count}</strong></div>`).join('') : '<p class="muted">No detections yet</p>';
}
function filteredIncidents() {
  const query = $('incident-search').value.trim().toLowerCase(), level = $('risk-filter').value;
  return state.incidents.filter(inc => {
    const score = num(inc.risk_score);
    const matchesRisk = level === 'all' || (level === 'high' && score >= 70) || (level === 'medium' && score >= 40 && score < 70) || (level === 'low' && score < 40);
    return matchesRisk && [inc.classification,inc.site_id,...(inc.domains||[]),...(inc.source_hosts||[])].join(' ').toLowerCase().includes(query);
  });
}
function renderIncidents() {
  const items = filteredIncidents();
  $('incidents-body').innerHTML = items.length ? items.map(inc => `<tr>
    <td><span class="risk-badge ${riskClass(inc.risk_score)}">${num(inc.risk_score)}</span></td>
    <td><div class="detection-name">${escapeHtml(pretty(inc.classification))}</div><div class="domain-name" title="${escapeHtml((inc.domains||[]).join(', '))}">${escapeHtml(inc.domains?.[0] || 'No domain recorded')}${inc.domains?.length > 1 ? ` +${inc.domains.length-1}` : ''}</div></td>
    <td><span class="site-name">${icon('pin')}${escapeHtml(inc.site_id)}</span></td>
    <td><div class="confidence-cell"><div class="confidence-track"><span style="width:${clamp(num(inc.confidence)*100)}%"></span></div>${Math.round(num(inc.confidence)*100)}%</div></td>
    <td><span class="evidence-tag ${inc.screenshot_path?'visual':''}">${icon(inc.screenshot_path?'camera':'layers')}${inc.screenshot_path?'Visual + DNS':'DNS evidence'}</span></td>
    <td><button class="details-button" data-incident="${escapeHtml(inc.incident_id)}" aria-label="Inspect ${escapeHtml(inc.domains?.[0] || pretty(inc.classification))}">Inspect ${icon('arrow')}</button></td>
  </tr>`).join('') : emptyRow(6,state.incidents.length ? 'No incidents match these filters.' : 'No incidents yet. Waiting for detections from the local stream.');
  $('table-summary').textContent = `Showing ${items.length} of ${state.incidents.length} incident${state.incidents.length===1?'':'s'}`;
}
$('incident-search').addEventListener('input',renderIncidents);
$('risk-filter').addEventListener('change',renderIncidents);
$('incidents-body').addEventListener('click', event => {const button = event.target.closest('[data-incident]'); if(button) showIncident(button.dataset.incident);});

function renderNetwork() {
  $('qoe-body').innerHTML = state.qoe.length ? state.qoe.map(q => `<tr><td><span class="site-name">${icon('pin')}${escapeHtml(q.site_id)}</span><span class="grade">${escapeHtml(pretty(q.grade))}</span></td><td><div class="qoe-score"><strong class="${num(q.score)>=75?'mint':num(q.score)>=40?'violet':'coral'}">${num(q.score)}</strong><span class="confidence-track"><span style="width:${clamp(q.score)}%;background:${num(q.score)>=75?'var(--mint)':'var(--coral)'}"></span></span></div></td><td>${num(q.latency_p95).toFixed(1)} <span class="muted">ms</span></td><td>${(num(q.nxdomain_rate)*100).toFixed(1)}%</td></tr>`).join('') : emptyRow(4,'No site telemetry recorded yet.');
  const verdicts = {LIKELY_SECURITY_DRIVEN:['Security driven','security'],LIKELY_OPERATIONAL:['Operational','operational'],MIXED:['Mixed signals','mixed'],MIXED_CAUSE:['Mixed signals','mixed'],INSUFFICIENT_EVIDENCE:['Insufficient evidence','']};
  $('correlations').innerHTML = state.correlations.length ? state.correlations.map(c => {
    const verdict = verdicts[c.verdict] || [pretty(c.verdict),''];
    return `<div class="correlation-row"><div class="correlation-head"><span class="site-name">${icon('network')}${escapeHtml(c.site_id)}</span><span class="verdict ${verdict[1]}">${escapeHtml(verdict[0])}</span></div><p>${escapeHtml(Array.isArray(c.reasoning)?c.reasoning.join(' '):c.reasoning || 'No reasoning recorded.')}</p><div class="correlation-details">QoE ${num(c.qoe_score)}/100 · Correlation ${num(c.correlation_score).toFixed(2)} · ${(c.related_incident_ids||[]).length} linked incidents</div></div>`;
  }).join('') : '<div class="empty-state">No correlations recorded yet.</div>';
}
const runtimeCard = (label,value,sub,extra='') => `<div class="runtime-card"><div class="rt-label">${label}</div><div class="rt-value ${extra}">${value}</div><div class="rt-sub">${sub}</div></div>`;
function renderRuntime(d) {
  $('runtime-indicator').textContent = d ? '● Agent connected' : 'Agent not running';
  $('runtime-indicator').classList.toggle('running',Boolean(d));
  if(!d) {
    $('runtime-grid').innerHTML = runtimeCard('Stream','—','The agent is currently offline.')+runtimeCard('Text analyst','Not connected','Availability is measured during a run.','model-name')+runtimeCard('Vision analyst','Not connected','Availability is measured during a run.','model-name')+runtimeCard('Execution','On-device','Runtime details appear during a run.')+runtimeCard('Egress counters','Not measured','The agent must be running to report counters.','model-name');
    $('decisions').innerHTML = '<p class="muted">Investigation decisions appear while the agent is running.</p>';
    $('decision-count').textContent = '0';
    return;
  }
  const modelCard = (model,label) => runtimeCard(label,escapeHtml(model.id.split('/').pop()),`${escapeHtml(model.quantization)}<br>${num(model.calls)} calls · ${model.avgMs ? (num(model.avgMs)/1000).toFixed(1)+'s avg' : 'No latency measured'}<br><span class="model-status ${model.loaded?'mint':''}">${model.loaded?'● Loaded':model.available?'○ Available on disk':'○ Not available'}</span>`,'model-name');
  $('runtime-grid').innerHTML = runtimeCard('Events consumed',numberFormat.format(num(d.eventsConsumed)),`${num(d.windowSize)} in the active window<br>${num(d.incidents)} detected incidents`)+modelCard(d.models.text,'Text analyst')+modelCard(d.models.vision,'Vision analyst')+runtimeCard('Execution device','On-device',`${escapeHtml(d.device)}<br>${num(d.renders.count)} sandbox renders`)+runtimeCard('Zero-egress counters',`${num(d.egress.blocked)} blocked`,`${num(d.egress.attempted)} attempts · ${num(d.egress.local)} local<br>${num(d.egress.eventsUploaded)} DNS events uploaded · ${num(d.egress.screenshotsUploaded)} screenshots uploaded<br>${num(d.egress.cloudInferenceEndpoints)} cloud inference endpoints`,'proof-value');
  $('decision-count').textContent = d.decisions.length;
  $('decisions').innerHTML = d.decisions.length ? [...d.decisions].reverse().map(decision=>`<article class="decision"><strong>${escapeHtml(decision.domain)}</strong><div class="decision-action">${escapeHtml(decision.state)} → ${escapeHtml(decision.action)}</div><p>${escapeHtml(decision.rationale)}</p></article>`).join('') : '<p class="muted">No investigation decisions yet.</p>';
}
async function refreshAll() {
  if(state.refreshing || $('incident-modal').open) return;
  state.refreshing = true;
  $('refresh-button').disabled = true;
  const results = await Promise.allSettled([getJSON('/api/incidents'),getJSON('/api/qoe'),getJSON('/api/correlations'),getJSON('http://127.0.0.1:3002/status',{signal:AbortSignal.timeout(2500)})]);
  const keys = ['incidents','qoe','correlations'];
  const failures = [];
  results.slice(0,3).forEach((result,i) => {
    if(result.status==='fulfilled' && Array.isArray(result.value)) state[keys[i]] = result.value;
    else failures.push(`${keys[i]}: ${result.status==='rejected'?result.reason.message:'Unexpected response format'}`);
  });
  state.runtime = results[3].status==='fulfilled' ? results[3].value : null;
  renderMetrics(); renderCharts(); renderIncidents(); renderNetwork(); renderRuntime(state.runtime);
  $('error-banner').hidden = !failures.length;
  $('error-banner').textContent = failures.length ? `Local data unavailable. Displayed values may be stale. ${failures.join(' · ')}` : '';
  $('feed-status').textContent = failures.length ? 'Connection interrupted' : 'Local data connected';
  $('feed-dot').classList.toggle('offline',Boolean(failures.length));
  if(!failures.length) {
    state.hasData = true;
    $('last-sync').textContent = 'Updated '+new Intl.DateTimeFormat('en-US',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date());
  }
  state.refreshing = false;
  $('refresh-button').disabled = false;
}
$('refresh-button').addEventListener('click',refreshAll);

async function showIncident(id) {
  const request = ++detailRequest;
  const modal = $('incident-modal');
  $('incident-detail').innerHTML = '<h2 id="detail-title" class="sr-only">Loading incident</h2><div class="empty-state">Loading local evidence…</div>';
  if(!modal.open) modal.showModal();
  try {
    const inc = await getJSON('/api/incidents/'+encodeURIComponent(id));
    if(request!==detailRequest || !modal.open) return;
    if(!inc) {$('incident-detail').innerHTML='<h2 id="detail-title">Incident not found</h2>';return;}
    const evidence = (inc.evidence_descriptions||[]).map((desc,i)=>`<div class="evidence-item"><span class="evidence-weight">+${num(inc.evidence_weights[i])}</span><div><strong>${escapeHtml(pretty(inc.evidence_types[i]))}</strong>${escapeHtml(desc)}</div></div>`).join('');
    const screenshot = inc.screenshot_path ? '/evidence/'+encodeURIComponent(inc.screenshot_path.split(/[\\/]/).pop()) : null;
    const textAvailable = Boolean(state.runtime?.models?.text?.available);
    $('incident-detail').innerHTML = `<div class="detail-heading"><h2 id="detail-title">${escapeHtml(pretty(inc.classification))}</h2><span class="risk-badge ${riskClass(inc.risk_score)}">${num(inc.risk_score)} / 100</span></div><div class="detail-meta"><span>${escapeHtml(inc.site_id)}</span><span>·</span><span>${Math.round(num(inc.confidence)*100)}% confidence</span><span>·</span><span>${(inc.source_hosts||[]).length} source hosts</span></div><p class="detail-domains">${escapeHtml((inc.domains||[]).join(' · '))}</p><div class="detail-section"><h3>Source hosts</h3><p class="detail-domains">${escapeHtml((inc.source_hosts||[]).join(' · '))}</p></div><section class="detail-section"><h3>Detection evidence · total weight ${(inc.evidence_weights||[]).reduce((sum,x)=>sum+num(x),0)}</h3><div class="evidence-list">${evidence || '<p class="detail-empty">No evidence recorded.</p>'}</div></section><section class="detail-section"><h3>Visual investigation</h3>${screenshot?`<div class="screenshot-frame"><div class="screenshot-header">${icon('lock')} LOCAL SANDBOX · CAPTURED ON THIS MACHINE</div><a href="${screenshot}" target="_blank" rel="noopener" aria-label="Open full screenshot"><img id="evidence-image" src="${screenshot}" alt="Suspicious page captured in the isolated local browser"></a><div class="screenshot-caption"><strong>${escapeHtml(inc.visual_model || 'VisionPsy')}:</strong> ${escapeHtml(inc.visual_description || 'No visual description recorded.')}</div></div>`:'<div class="detail-empty">No visual evidence has been recorded for this incident.</div>'}</section><section class="detail-section"><h3>Recommended action</h3><div class="recommendation">${escapeHtml(inc.recommended_action || 'No action recorded.')}</div></section>${inc.explanation?`<section class="detail-section"><h3>Saved analyst explanation</h3><div class="recommendation">${escapeHtml(inc.explanation)}</div></section>`:''}<div class="detail-actions"><button class="button primary" id="explain-button" ${textAvailable?'':'disabled'}>${icon('cpu')} Explain with QVAC</button><span>${textAvailable?'Local inference · may take a few moments':'Text model availability must be confirmed by a running agent.'}</span></div><div class="analysis-result" id="analysis-result" aria-live="polite"></div>`;
    $('explain-button').addEventListener('click',()=>explainIncident(id));
    $('evidence-image')?.addEventListener('error',event=>{event.target.closest('.screenshot-frame').innerHTML='<div class="detail-empty">The recorded screenshot is no longer available on this machine.</div>';});
  } catch(error) {
    if(request===detailRequest && modal.open) $('incident-detail').innerHTML = `<h2 id="detail-title">Unable to load incident</h2><p class="detail-empty">${escapeHtml(error.message)}</p>`;
  }
}
$('close-modal').addEventListener('click',()=>$('incident-modal').close());
$('incident-modal').addEventListener('click',event=>{const rect=event.currentTarget.getBoundingClientRect();if(event.target===event.currentTarget && (event.clientX<rect.left || event.clientX>rect.right || event.clientY<rect.top || event.clientY>rect.bottom)) event.currentTarget.close();});
$('incident-modal').addEventListener('close',()=>{detailRequest++;refreshAll();});
async function explainIncident(id) {
  const button = $('explain-button'), result = $('analysis-result');
  button.disabled = true;
  button.textContent = 'Analyzing locally…';
  result.textContent = 'QVAC is reviewing the evidence on this machine.';
  try {
    const data = await getJSON('/api/explain/'+encodeURIComponent(id),{method:'POST',signal:AbortSignal.timeout(180000)});
    result.innerHTML = `<p><strong>Summary:</strong> ${escapeHtml(data.summary)}</p><p><strong>Likely scenario:</strong> ${escapeHtml(data.likely_scenario)}</p><p><strong>Confidence:</strong> ${escapeHtml(data.confidence)}</p><ul>${(data.reasoning_evidence||[]).map(reason=>`<li>${escapeHtml(reason)}</li>`).join('')}</ul><p><strong>Next action:</strong> ${escapeHtml(data.recommended_next_action)}</p>`;
  } catch(error) {result.textContent='Local analysis failed: '+error.message;}
  finally {button.disabled=false;button.innerHTML=icon('cpu')+' Explain with QVAC';}
}
$('export-button').addEventListener('click',()=>{
  if(!state.hasData) {notify('Connect to the local data source before exporting.');return;}
  const report = {product:'RACS Intelligence',generatedAt:new Date().toISOString(),dataSource:'Local synthetic telemetry',filters:{search:$('incident-search').value,risk:$('risk-filter').value},incidents:filteredIncidents(),qoe:state.qoe,correlations:state.correlations};
  const url = URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));
  const link = document.createElement('a');link.href=url;link.download='sentinel-incidents-'+new Date().toISOString().slice(0,10)+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  notify('Incident report exported locally.');
});
document.addEventListener('keydown',event=>{
  if(event.key==='/' && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName) && !$('incident-modal').open) {event.preventDefault();location.hash='incidents';setView();$('incident-search').focus();}
});
refreshAll();
setInterval(refreshAll,REFRESH_MS);