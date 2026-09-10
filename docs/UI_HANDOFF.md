# UI modernization handoff

Owner: LowCrime (Dev 4). Agent: Codex. Branch: feature/ui. Status: DONE.

## Result

Modernized the working analyst UI at http://127.0.0.1:3001 into a full-window dashboard inspired by the supplied reference and the original RACS Intelligence logo. Dark navy surfaces, cyan brand accents, responsive sidebar, real incident and QoE metrics, risk visualization, detection breakdown, incident search and risk filters, local JSON export, SOC/NOC correlation, runtime counters and accessible native incident dialogs.

Evidence remains visible: DNS weights, source hosts, recommended actions, local screenshots and VisionPsy descriptions. Text analysis remains behind the existing QVAC endpoint and requires a running agent reporting the text model available. All assets are local; no fonts, scripts, inference or telemetry services were added outside the machine. Static assets are served through an explicit allowlist with correct MIME types.

Scope: apps/analyst-ui and this handoff. No shared schemas, service ports, environment variable names or inference contracts changed. The existing UI was changed because LowCrime explicitly requested visual modernization for the jury.

AGENTS.md section 7 prohibits editing AGENTS.md on feature branches. This document holds the session record for the PR description. After merging, update sections 4 and 10 on main. Publication follows feature/ui -> PR -> main. No merge into main has been performed.

## Verification performed on Windows

- Existing Node 24.21.0 and Docker Compose 5.5.1 preserved.
- Git 2.55.0 and GitHub CLI 2.100.0 installed only after confirming absence. GitHub authentication verified as LowCrime. Existing Git identity preserved.
- npm install: 0 reported vulnerabilities. npm run build: passed.
- Docker Kafka and ClickHouse healthy; Grafana health endpoint reported database ok.
- npm run bootstrap: Ready.
- Playwright Chromium and both VisionPsy GGUF files installed. The new ignored .env contains the absolute local vision models path.
- npm run demo -- typosquat: exited successfully and delivered 5 alerts to the Wazuh-compatible receiver. VisionPsy read local screenshots and raised risk using visual evidence. Kafka logged a transient coordinator startup error and recovered automatically without intervention.
- npm test: 21/21 existing tests passed.
- node apps/analyst-ui/verify-ui.mjs: passed at 1536x1080 and 390x844, with 17 stored incidents and 4 visual incidents, no page JavaScript errors. Checks cover real API metrics, logo/CSS/JS, static allowlist, search, risk filters, evidence dialog, actual screenshot loading, Escape, navigation, JSON export and mobile overflow.
- The first mobile check caught a 681px document in a 390px viewport. A screen-reader-only label escaped its unpositioned table scrolling container. Fixed by making .table-wrap positioned; the complete browser verification then passed.

Artifacts: node_modules/.cache/sentinel/ui-desktop.png, ui-mobile.png, ui-evidence.png and ui-verification.json. They are local and ignored.

## Develop locally

From C:\Users\Cbast\racs-intelligence:

```powershell
# When restarting the machine: open Docker Desktop first.
docker compose up -d
npm run build
npm start -w @sentinel/analyst-ui
```

The UI currently runs in the background on port 3001. Do not start a second copy while that port is occupied. Current logs: node_modules/.cache/sentinel/ui-medpsy.stdout.log and ui-medpsy.stderr.log.

Edit apps/analyst-ui/html/index.html, dashboard.css and dashboard.js and refresh the browser. HTML, CSS and JavaScript are served directly with no-store caching. TypeScript server changes require npm run build and restarting the UI.

In a separate terminal, when you want a live investigation and runtime panel:

```powershell
npm run demo -- typosquat --keep-alive
```

Do not run two demos simultaneously: they share local service ports. The completed setup demo has exited; stored incidents and screenshots remain visible. An idle runtime panel correctly says the agent is not running.

Run the UI check with the UI and ClickHouse already running:

```powershell
node apps/analyst-ui/verify-ui.mjs
```

## Limitations / remaining work

MedPsy text weights and VisionPsy weights are installed. Both local text and vision inference have now been verified on this machine. MedPsy was downloaded after the user explicitly requested it in a follow-up. The alert receiver is the project's Wazuh-compatible receiver, not a full Wazuh manager. Windows OS-level egress / Wi-Fi-off verification was not performed.

Next: review the feature/ui PR and record the jury demo with the agent running. Transfer this record to AGENTS.md on main after merge.
## Follow-up: MedPsy installed and verified

User requested downloading the missing text model. Downloaded qvac/MedPsy-4B-GGUF, quantization q4_k_m-imat, into models/medpsy-4b-q4_k_m-imat.gguf (2,716,068,640 bytes). Size and SHA256 verified against the official Hugging Face repository metadata before the partial download was renamed into place.

SHA256: 2ecbf622a2856f631001f20f593669aa03acba39977f521bef80cd8600864980

Updated only QVAC_MODELS_DIR in the ignored local .env to the absolute project models directory so npm workspace startup can resolve the weights. Restarted the existing UI to load that setting. The vision files and existing dependency versions were preserved.

Verified POST /api/explain/13c40203527f0ddd through the running UI against an existing synthetic incident: HTTP 200, schema-valid response with summary and evidence, no deterministic fallback. First request including model loading took 41 seconds. Response saved in node_modules/.cache/sentinel/medpsy-verification.json; download metadata in medpsy-download-metadata.json. The UI now runs with the new model path; its current logs are ui-medpsy.stdout.log and ui-medpsy.stderr.log in the same cache directory.

No application code or shared contracts changed. No additional full demo was run during this download-only follow-up.