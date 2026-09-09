# AGENTS.md — Sovereign Sentinel

**Purpose of this file:** shared memory between every AI agent (Claude, Codex, Astra, Cursor, …) and every human working on this repo. Multiple agents work on this project in separate sessions with no shared context. This file *is* the shared context.

**Source of truth for *what* to build:** `SOVEREIGN_SENTINEL_SPEC.md`.
**Source of truth for *what already exists and what to do next:* this file.**

---

## 0. Agent protocol — read before touching anything

1. **Read this whole file first.** Then read the sections of `SOVEREIGN_SENTINEL_SPEC.md` relevant to your task (it is 2200 lines — do not paste it all into context, use the section index).
2. **Check §4 Current State** before writing code. Assume another agent already built part of it. Never rewrite a module marked `DONE` or `IN PROGRESS` without a concrete reason stated in the handoff log.
3. **Claim your work.** Before starting, add a row to §4 with status `IN PROGRESS` and your agent name + owner.
4. **Respect module ownership (§5).** Stay inside your files. If you need a change in someone else's module, add it to §8 Open Items instead of editing across boundaries.
5. **Before you finish the session, you MUST:**
   - update §4 (statuses, what actually works, what is stubbed),
   - update §6 Shared Contracts if you defined a topic name, table, port, env var or schema,
   - append an entry to §10 Handoff Log (what you did, what you did NOT do, what breaks, what's next).
   A session that changed code but did not update this file is an incomplete session.
6. **Do not duplicate spec content here.** Link to it: "see spec §19 Data Models". Duplicated text drifts and lies.
7. **Never claim something works that you did not run.** Mark it `UNVERIFIED` and say how to verify it.
8. Write status entries in plain, checkable terms: "consumer reads from Kafka topic X and prints events" — not "streaming layer implemented".

---

## 1. The project in 60 seconds

**Sovereign Sentinel** — a local-first ("zero-egress") AI security analyst for DNS telemetry in regulated infrastructure (banks, government, healthcare).

Pipeline: `synthetic dnstap → Vector → Kafka → Sentinel → Wazuh (alerts) + ClickHouse → Grafana (QoE)`.

Sentinel does three things nothing else in the room does:
1. **Hybrid detection** — deterministic engines score DGA / typosquatting / tunneling / beaconing; the LLM *explains* evidence, it never invents scores.
2. **Active Evidence Acquisition** — when confidence is low it chooses the next local investigation step (e.g. render the domain in a local sandbox, analyze the screenshot with VisionPsy) instead of running a fixed workflow.
3. **SOC + NOC in one context** — correlates DNS *quality* degradation (QoE) with security events.

**All inference is local via QVAC. Nothing sensitive leaves the machine.** That is the entire product thesis.

- Hackathon: Decentralized AI Hackathon — Panamá 2026
- Build window: **9 Sep 2026 08:00 → 11 Sep 2026 08:00** (Panamá)
- Tracks: 04 Ovnicom (primary), 05 Caja de Ahorros (secondary), 02 QVAC Psy (optional), 03 General
- Team: 4 developers

---

## 2. Hard constraints — violating any of these kills the submission

**Never introduce, not even temporarily, not even "just to test":**

- OpenAI / Anthropic / Gemini / Groq / Together / OpenRouter / any remote inference endpoint
- cloud embeddings, remote vision, hosted RAG
- any silent substitution of QVAC by another AI provider

**Never remove from the architecture:**

- Kafka streaming (must be a *real event stream*, not a file read in a loop)
- Wazuh alert output
- ClickHouse QoE storage
- Grafana QoE dashboard
- local QVAC inference

**Also mandatory:**

- Only synthetic / public test data. No real customer DNS traffic, ever.
- Risk scores stay deterministic and explainable. The model explains evidence; it does not produce opaque scores.
- Structured model output is validated against a schema before use. Never trust raw model text.
- The browser sandbox for visual investigation renders untrusted pages — keep it isolated, no credentials, no host network access (spec §9.3, §25).
- **Everything runs local. No exceptions.** Model weights are loaded from disk and are
  already downloaded — **no model pull at demo time.** Any local inference server binds
  to `127.0.0.1`, never `0.0.0.0`. **The whole demo must survive Wi-Fi being switched
  off** — that is both the rule and the cheapest zero-egress proof (spec §21).

**Engineering priority order when you must trade off** (spec §39):
`1 end-to-end correctness → 2 local QVAC inference → 3 Track 04 requirements → 4 stability → 5 explainability → 6 demo quality → 7 Track 05 positioning → 8 VisionPsy → 9 extras`

---

## 3. Document map

| File | What it is |
|---|---|
| **Repo** | `https://github.com/Silentarcherjr/sovereign-sentinel` — **private, must be made public before submission.** Clone it; never work on a shared filesystem. |
| `SOVEREIGN_SENTINEL_SPEC.md` | Master spec. Source of truth for requirements, data models, demo script, judging criteria. |
| `AGENTS.md` (this file) | Shared agent memory: current state, contracts, ownership, handoff log. |
| `CLAUDE.md` | One-line pointer to this file, because Claude Code looks for `CLAUDE.md`. **Never put content in it.** |
| `README.md` | Jury-facing. **Skeleton only** — 21 required sections from spec §33, most still `TBD`. Owned by Dev 4. |
| `LICENSE` | MIT. Chosen as permissive for a possible Track 02 claim — verify acceptance (§8). |
| `.gitignore` / `.gitattributes` | Secrets, volumes, models, evidence excluded. `AGENTS.md` set to union-merge. |
| `docs/ONBOARDING.md` | How a new dev sets up their machine, plus the bootstrap prompt to paste into their agent. |
| `docs/` (rest) | *not created yet* — ARCHITECTURE, THREAT_MODEL, ZERO_EGRESS, TRACK_MAPPING, BENCHMARKS, DEMO. |
| **QVAC test bench** | `/Users/anthonymorell/Documents/PRUEBA DE MODELOS/` — **outside this repo, Dev 2's machine only.** 71 GB of weights, a `./qvac` CLI and the working runners. Not committable. See §4. |

**Multi-tool setup.** This project is worked on by several models. `AGENTS.md` is the
single source of truth; every tool reads it. Codex, Cursor, Aider and opencode pick it
up natively; Claude Code reaches it through the `CLAUDE.md` pointer. If a new tool needs
a differently-named file (`GEMINI.md`, `.github/copilot-instructions.md`, …), add a
one-line pointer — **never a second copy of these rules.** Two rule files that disagree
are worse than none. For models that read no file at all (web chats), paste this at the
start of the session:

> Read `AGENTS.md` in full before touching anything. It is the project's shared memory:
> rules, current state, and what the previous agent did. When you finish, update §4 and
> append your entry to §10 stating which model you are.

Useful spec sections (do not re-read the whole file):
`§7 MVP scope` · `§8 active investigation` · `§10 evidence fusion` · `§13 synthetic dataset` · `§15 architecture` · `§18 repo structure` · `§19 data models` · `§20 QVAC prompting rules` · `§26 team division` · `§28 48-hour plan` · `§29 demo script` · `§32 fallbacks` · `§38 definition of done`

---

## 4. Current state

**Last updated:** 2026-09-09 by Claude (Opus 5) — **Everything is built and wired. Only the video remains.**
**Hackathon hour:** ~6–8.

### Repository status

Repo is live on GitHub (private). The **skeleton is in place and compiles**: npm
workspaces, TypeScript project references, `@sentinel/dns-schema` with every shared type
from spec §19, and a committed 66-event fixture so all four lanes can work in parallel
without waiting for Kafka.

```
npm install && npm run build     # verified green 2026-09-09
```

**The full pipeline runs on `main`**, verified against real services (Kafka 4.3.1,
ClickHouse 26.8.2, Grafana 13.2.1, all local):

```
synthetic DNS → Kafka → agent → detection → local QVAC explanation
                              → Wazuh alert
                              → QoE + SOC/NOC correlation → ClickHouse → Grafana
```

**What is still missing is everything the jury reads, not the machinery**: the README is
a skeleton of `TBD`s, there are no demo scripts, no zero-egress proof, no analyst UI,
and `docker-compose.yml` has never been run. See §8.

### Build board

Status values: `NOT STARTED` · `IN PROGRESS` · `DONE` · `BLOCKED` · `UNVERIFIED` (built but never run end to end)

| # | Component | Status | Owner / Agent | Notes |
|---|---|---|---|---|
| 0 | Repo skeleton + git + toolchain | **DONE ✅** | Claude | npm workspaces + TS project references. `apps/`+`packages/` layout per spec §18, `@sentinel/dns-schema` with all spec §19 types, 66-event fixture. `npm install && npm run build` verified green. **Still missing:** `docker-compose.yml`, `.env.example` — Dev 3's lane. |
| 1 | **QVAC feasibility spike** | **DONE ✅** | Anthony (Dev 2) | **Verified with real numbers — see "QVAC: verified" below.** 25/25 QVAC models run locally on Apple Silicon. The project's single fatal risk is retired. |
| 2 | Synthetic DNS producer | **DONE ✅** | Anthony (Dev 1) | `apps/synthetic-producer`. `--source fixture` replays the committed 66 events byte-identically; `--source generate` streams all six spec §13 scenarios from a seed. `--dry-run` works with no broker. |
| 3 | Kafka + Vector | **PARTIAL** | Anthony (Dev 1) | **Kafka verified** against a real Apache Kafka 4.3.1 broker (native, KRaft). `docker-compose.yml` has the Kafka service but is **UNVERIFIED** — no Docker on Dev 1's machine. **Vector is not in the path**: the producer writes to Kafka directly. |
| 4 | Sentinel consumer + feature engine | **DONE ✅** | Anthony (Dev 1) | `apps/sentinel-agent` consumes the topic into a bounded sliding window and re-analyses on a timer. `packages/feature-engine` has the lexical and behavioral features. |
| 5 | Threat engine (4 detectors) | **DONE ✅** | Anthony (Dev 1) | DGA, typosquatting, tunneling, beaconing. 6 incidents from the fixture, no false positives on the 24 benign events, 5/5 regression tests. All scoring is a weighted sum of evidence — no model touches a risk number. |
| 6 | QVAC local analyst (explanations) | **DONE ✅ — wired into the agent** | Dev 2 + Claude | Merged (PR #4) and **independently verified by running it**: ~15s cold load once, then **~5s per incident**. Scenarios were accurate and evidence-grounded against real incidents. ⚠️ Known issue in §8: it downloads the model when weights are missing. |
| 7 | Wazuh adapter | **DONE ✅** | Claude (Dev 3's lane) | File sink (logcollector JSON-lines) + local HTTP receiver + real Wazuh decoder/rules in `infra/wazuh/`. Refuses non-loopback hosts. |
| 8 | QoE engine + site baselines | **DONE ✅** | Claude (Dev 3's lane) | spec §7 MVP-5, §14 |
| 9 | ClickHouse writer | **DONE ✅** | Claude (Dev 3's lane) | |
| 10 | Grafana dashboard | **DONE ✅** | Claude (Dev 3's lane) | QoE per site/zone |
| 11 | SOC↔NOC correlation | **DONE ✅** | Claude (Dev 3's lane) | spec §11 |
| 12 | Active investigator + sandbox | **DONE ✅** | Claude | `packages/evidence-engine`. Deterministic action selection (spec §8.2), throwaway Chromium context, screenshot only. **Works in isolation; the agent does not call it yet.** |
| 13 | VisionPsy path | **DONE ✅** | Claude | Verified: risk 64 → 89 on a rendered decoy page. ~2s render + ~5.5s for four vision calls. |
| 14 | Analyst UI | **DONE ✅** | Dev 2 (`frictionspp-svg`) | `apps/analyst-ui` on `127.0.0.1:3001`. Reads live ClickHouse data. "Ask Sentinel" (spec §12) is still not built. |
| 15 | README + docs | **DONE ✅** | Claude | All 21 sections of spec §33 filled from measured values. `docs/ZERO_EGRESS.md` + `docs/ONBOARDING.md`. Missing: ARCHITECTURE, THREAT_MODEL, TRACK_MAPPING, DEMO. |
| 16 | Demo scripts | **DONE ✅** | Claude | `scripts/bootstrap.sh` + `scripts/demo.sh`. **Verified deterministic**: two consecutive runs give 66 events / 6 incidents identically. |
| 17 | Zero-egress proof | **DONE ✅** | Claude | Three layers: in-process socket guard (`packages/egress-guard`, armed unconditionally), OS-level `lsof` check (`scripts/verify-zero-egress.sh`, passing), and the Wi-Fi-off test. `docs/ZERO_EGRESS.md` states the claim precisely and lists what it does **not** prove. Never says "air-gapped" — there is a test for that. |
| 18 | Benchmarks (Track 02 only) | NOT STARTED | — | spec §22 |

### QVAC: verified, with numbers

Measured on **Apple M1 Max, 32 GB** by `./qvac smoke --preset all`
(report `results/smoke-20260909-114541.json`, 2026-09-09 11:45). **25/25 models pass.**

| Model key | Repo | Quantization | Speed | Role in Sentinel |
|---|---|---|---|---|
| `medpsy-4b-gguf` | `qvac/MedPsy-4B-GGUF` | `q4_k_m-imat` | **72.6 tok/s** | **Local analyst** (incident explanation) |
| `medpsy-1.7b-gguf` | `qvac/MedPsy-1.7B-GGUF` | `q4_k_m-imat` | 140.4 tok/s | Fallback if latency bites under stream load |
| `visionpsy-460m-flash-gguf` | `qvac/VisionPsy-Nano-460M-Flash-GGUFs` | `q4_k_m-imat` + mmproj `q8` | **238.0 tok/s**, TTFT ~0.8 s | **Visual investigation** (Track 02) |
| `visionpsy-460m-gguf` | `qvac/VisionPsy-Nano-460M-GGUFs` | `q4_k_m-imat` + mmproj `q8` | 238.4 tok/s | Non-flash variant |

**Three findings that change the plan — read these before touching the QVAC lane:**

1. **MedPsy is the only usable instruct text model in the whole QVAC catalog.**
   Genesis (all four) produces unusable output — repetition loops and exam-formatted
   text — confirmed in bf16, fp32 and CPU: it is the model, not the environment.
   AfriSLM/TranslateNano are translation; Fabric is a biomedical LoRA. So the "local DNS
   security analyst" runs on **a clinically fine-tuned Qwen3**. It follows the
   constrained JSON prompt from spec §20 fine, but **this must be declared honestly in
   the README** (spec §33 items 6–7, §35). Do not hide it; stating it plainly is worth
   more credibility than it costs.

2. **⚠️ VisionPsy GGUFs do NOT run on Homebrew's `llama.cpp`.** They abort with
   `unknown projector type: custom` — the nanoVLM `mmproj` uses a pixel-shuffle
   connector upstream does not implement. Two engines work, both already built:
   the **QVAC SDK** (`runners/qvac_node/vlm.mjs`, default, Metal) and a patched
   `llama.cpp` fork (`--engine llamacpp`). **Do not spend hours rediscovering this.**

3. **MedPsy reasons inside `<think>` by default** (it is Qwen3). If the token budget is
   exhausted inside the reasoning block, the final answer comes back **empty**. Send
   `enable_thinking: false` unless you deliberately want reasoning, and strip the
   residual marker.

### The one milestone that matters first

Do not build breadth before this vertical slice works end to end:

```
synthetic DNS event → Kafka → Sentinel → features → suspicious classification
→ QVAC local explanation → Wazuh-compatible alert
```

Then: `QoE → ClickHouse → Grafana`. Then: `active investigation → VisionPsy`.

---

## 5. Module ownership

Ownership exists to prevent merge conflicts, not to gatekeep. **The team is 4 people**
(spec §26); each works on their own machine with their own agent, and each AI session
inherits its owner's lane. Fill in the names below.

| Dev | Owns | Files/dirs |
|---|---|---|
| **Dev 1** — **Anthony** (`Silentarcherjr`, `feature/stream-engine`) | Streaming + threat engine | `apps/synthetic-producer/`, `packages/dns-schema/`, `packages/feature-engine/`, `packages/threat-engine/` |
| **Dev 2** — _name TBD_ (`feature/qvac`) | QVAC + evidence + vision | `packages/qvac-runtime/`, `packages/evidence-engine/`, vision path, `benchmarks/` |
| **Dev 3** — _name TBD_ | Data + QoE + integrations | `packages/qoe-engine/`, `packages/clickhouse-adapter/`, `packages/wazuh-adapter/`, `infra/` |
| **Dev 4** — _name TBD_ | Frontend + integration + demo | `apps/analyst-ui/`, `scripts/`, `README.md`, `docs/`, video/submission |

**Rule for agents:** if your task needs a change outside your lane, do not make it. Log it in §8 as a cross-lane request.

---

## 6. Shared contracts

Everything here is a cross-module interface. **Whoever implements it first fills it in. After that it is frozen** — changing it requires a §10 log entry saying what broke.

Canonical TypeScript types (`DnsEvent`, `ThreatEvidence`, `Incident`, `QoeWindow`) live in **spec §19** and, once code exists, in `packages/dns-schema/`. Code wins over the spec once written; keep them in sync.

| Contract | Value | Status |
|---|---|---|
| Primary language | TypeScript / Node (spec §16; Python only where it materially simplifies stats) | proposed, not locked |
| Package manager / monorepo tool | **npm workspaces** + TypeScript project references. No pnpm, no turbo — nobody should be debugging tooling at hour 40 | **LOCKED** |
| Shared types package | `@sentinel/dns-schema` (`packages/dns-schema/`). **Dependency-free on purpose.** Every cross-module shape lives here; do not redefine `DnsEvent` etc. locally | **LOCKED** |
| Test fixture | `datasets/synthetic/sample-events.json` — 66 events, seed `20260909`, byte-identical for everyone. Build against this until Kafka exists | **LOCKED** |
| Kafka broker address | `localhost:9092` (env `KAFKA_BROKER`). **Apache Kafka, not Redpanda** — 4.x is KRaft-only, no ZooKeeper | **LOCKED** |
| Kafka topic — raw DNS events | `dns.events.raw` (env `KAFKA_TOPIC_DNS`), 3 partitions, **keyed by `clientIp`** so one host's queries keep their order — beaconing detection depends on it | **LOCKED** |
| Kafka topic — incidents | not used yet; the agent analyses in-process | TBD |
| ClickHouse DB / table for QoE | — | TBD |
| Wazuh endpoint + alert JSON shape | — | TBD |
| QVAC text analyst model | `qvac/MedPsy-4B-GGUF`, quantization `q4_k_m-imat` (file `medpsy-4b-q4_k_m-imat.gguf`) | **LOCKED** — verified 72.6 tok/s |
| QVAC vision model | `qvac/VisionPsy-Nano-460M-Flash-GGUFs`, quantization `q4_k_m-imat`, mmproj `q8` | **LOCKED** — verified 238 tok/s |
| Vision engine | QVAC SDK (`runners/qvac_node/vlm.mjs`). **Never Homebrew `llama.cpp`** — see §4 finding 2 | **LOCKED** |
| **Inference integration path** | **`@qvac/sdk` only.** `./qvac serve` (OpenAI-compatible, `localhost:8080`) is permitted for local development ONLY — it must not appear in the demo, the submission, or any committed code path | **LOCKED** |
| Text inference engine | `llama.cpp` + Metal (GGUF), driven through the SDK | **LOCKED** |
| **Models every inference machine must have on disk** | `qvac/MedPsy-4B-GGUF` (2.5 GB) **+** `qvac/VisionPsy-Nano-460M-Flash-GGUFs` (393 MB) = **≈2.9 GB.** Download both up front — §2 forbids pulling weights at demo time | **DECIDED** |
| Model weights location | Env var `QVAC_MODELS_DIR` (not yet implemented). Weights are **never** committed — `.gitignore` blocks `models/` and `*.gguf` | TBD |
| Hardware of record | Apple M1 Max, 32 GB (README §33 item 8) | recorded |
| QVAC analyst prompt + response schema | spec §20 | to be implemented in `packages/qvac-runtime/` |
| Env vars | `.env.example` | TBD |
| Service ports | — | TBD |

---

## 7. Conventions

- **Typed schemas everywhere.** Validate all structured model output; log and fall back on parse failure.
- **Boring, reliable code over abstraction.** No frameworks nobody on the team can debug at hour 40.
- **Determinism in demos.** Demo scripts must produce the same result every run — seeds fixed, no live network.
- **Log failures loudly**, never swallow them; the demo must show what happened.
- **Document every major architectural decision** — one paragraph in `docs/ARCHITECTURE.md`, plus a §10 entry.
- **Do not rewrite a working module** without a concrete stated reason.
### Git workflow — DECIDED, do not improvise

Every developer clones the repo and runs their own agent locally. There is **no shared
filesystem and no Live Share for development** — an agent needs a real local checkout to
run commands.

- **No `dev` branch.** `feature/*` → PR → `main`. (This overrides spec §27, which
  suggested a `dev` branch; dropped to remove one merge hop in a 48h window.)
- Branches follow the lanes: `feature/stream-engine`, `feature/qvac`, `feature/qoe`,
  `feature/ui`.
- `main` must always be demoable. Small PRs. One owner per task.
- **Merge to `main` every 2–3 hours**, not when a module feels "finished".
  No final-hour mega merge.
- Sync your branch with `git checkout main && git pull` then `git merge main`.
- Every merged feature ships a minimal test or demo command.
- **Never commit secrets.** `.env` is ignored; commit `.env.example` instead.

### ⚠️ Rule that prevents the most likely conflict

**Do not edit `AGENTS.md` inside a feature branch.** Four agents editing §4 and §10 in
parallel branches conflicts on every single PR — on the one file that has to stay
trustworthy.

Instead: put your session summary in the **PR description**, and after your PR is merged,
update `AGENTS.md` directly on `main` and push. `.gitattributes` sets union-merge as a
safety net; if it leaves duplicated rows, clean them on `main`.

---

## 8. Open items & decisions needed

Add here instead of guessing or editing another lane. Remove when resolved (and log the resolution).

- [ ] **Collaborators invited, waiting on acceptance** — `frictionspp-svg`, `LowCrime`,
      `Ralu13` at <https://github.com/Silentarcherjr/sovereign-sentinel/invitations>.
- [x] ~~SDK vs `./qvac serve`~~ — **DECIDED 2026-09-09: `@qvac/sdk` only.** `serve` is a
      dev convenience, never a shipped path. Locked in §6.
- [x] ~~Do we download VisionPsy?~~ — **DECIDED 2026-09-09: yes, download both models
      (≈2.9 GB) on every machine that runs inference.** Downloading is not the same as
      claiming Track 02: the weights must be on disk regardless, because §2 forbids
      pulling models at demo time. Order matters — **MedPsy first** (it is on the vertical
      slice, board item 6), VisionPsy second (item 13). The Track 02 *claim* is still a
      separate, later decision.
- [x] ~~Port the QVAC runner into the repo~~ — done, `packages/qvac-runtime/` (PR #4).
- [x] ~~model download / agent wiring~~ — **both done (PR #6).** Download path removed;
      explanations are opt-in via `--explain`, thresholded at risk ≥70, serialised.
- [ ] **`likely_scenario` can over-claim.** The committed demo output says "Automated
      botnet activity" for a typosquat, which the evidence does not support (spec §20
      rule 1). Real incidents came back accurate; watch it, don't block on it.
- [x] ~~Wire the investigation into the agent~~ — **done (PR #16).** Verified live: risk 80→100.
- [ ] 🔴 **Record the 5-minute video.** The last remaining Must Have (spec §29, §31).
- [x] ~~Nobody has run `docker-compose.yml`~~ — **verified end to end (PR #10)** on
      colima 0.10.3 / Docker 29.5.2. The jury can reproduce the project.
- [ ] **Make the repo public before submitting** (or grant jury access). Spec §38 requires
      submission links to work without credentials.
- [ ] Verify MIT is acceptable if Track 02 is claimed (spec §34 says verify, don't assume).
- [x] ~~QVAC SDK validated~~ — **done**, 25/25 models pass on Dev 2's M1 Max. Models
      and quantizations are locked in §6.
- [x] ~~Kafka vs Redpanda~~ — **DECIDED: Apache Kafka.** Verified natively at 4.3.1.
- [ ] **`docker-compose.yml` is UNVERIFIED.** Docker is not installed on Dev 1's machine;
      the Kafka path was verified against a native broker instead. Whoever has Docker
      first: run it, fix what breaks, remove the notice at the top of the file.
- [ ] **Vector is not in the pipeline.** The producer writes to Kafka directly. Ovnicom's
      stated pipeline is BIND9 → dnstap → Vector → Kafka. Decide whether to add Vector or
      to state plainly in the README that we start at the Kafka boundary.
- [ ] ⚠️ **Cross-lane: Claude is building `packages/wazuh-adapter/`, which §5 assigns to
      Dev 3.** Flagged rather than done silently. **Tell Dev 3 before they start it**, or
      the work is duplicated and conflicts.
- [ ] Wazuh: full deployment vs local compatible endpoint first (spec §16 says build the compatible endpoint first, integrate real Wazuh after).
- [ ] Confirm whether Track 02 will be claimed. **Now realistic**: VisionPsy runs via
      `@qvac/sdk`, exact model + quantization are known, and `./qvac bench` covers the
      benchmark requirement (spec §22). Remaining gates are the RAG requirement and the
      open-source terms.
- [ ] Declare any pre-existing code base at submission (spec §38). **Note in our favour:**
      the QVAC test bench was built *inside* the build window — its files are timestamped
      2026-09-09 09:57–11:48, after the 08:00 start — so it is hackathon work, not a
      pre-existing base. The QVAC *models* are third-party (Tether AI Research) and go
      under "third-party components" (README §33 item 16).

---

## 9. Risk register

| Risk | Impact | Mitigation / fallback (spec §32) |
|---|---|---|
| ~~QVAC does not run locally~~ | ~~Fatal~~ | **RETIRED 2026-09-09.** 25/25 models verified locally at usable speed. |
| ~~VisionPsy unstable~~ | ~~Loses Track 02~~ | **Largely retired.** Runtime proven at 238 tok/s. Residual risk is the *integration* (sandbox → screenshot → fusion), not the model. Still: never fake it. |
| MedPsy is a clinical model doing security analysis | Credibility, if hidden | Declare it plainly in the README (§33, §35). Keep scores deterministic — the model only explains evidence, so its domain matters less. |
| Only one machine can run inference | Bottlenecks the QVAC lane | The two needed models are ≈2.9 GB, not 71 GB — other devs can pull them cheaply. |
| Wazuh install eats the hackathon | Loses a Track 04 requirement | Local Wazuh-compatible endpoint first, real integration after core works. |
| Kafka instability | Breaks "real stream" claim | Redpanda, or a minimal local broker — but a genuine stream must remain. |
| ClickHouse/Grafana time sink | Loses QoE visualization | Simplest possible table + one dashboard; do not over-model. |
| Big-bang integration at hour 44 | Nothing demoable | Vertical slice first, merge continuously, freeze features at ~hour 40. |

---

## 10. Handoff log

Append-only. Newest at the top. **Every agent session adds one entry.**

Template:

```
### YYYY-MM-DD HH:MM — <agent/model> — <lane>
Did:        (what actually works now, and how it was verified)
Did not:    (what you left unfinished or intentionally skipped, and why)
Broken:     (anything failing, flaky or stubbed — be honest)
Contracts:  (anything added/changed in §6)
Next:       (the single most useful next action for whoever picks this up)
```

---

### 2026-09-09 — Claude (Opus 5) — investigation wired; feature-complete (PR #16)
Did:        Wired `decideNextAction` → `renderDomain` → `analyzeScreenshot` →
            `fuseVisionIntoIncident` into `apps/sentinel-agent`, and made `scripts/demo.mjs`
            start the decoy site and set the sandbox resolver rules automatically.
            **Verified in the live pipeline:** risk 80→100, 60→85, 55→80, 45→60, with each
            alert carrying 2–3 pieces of visual evidence. Render 76–486 ms, four vision
            calls ~5 s. Runs through the same `serialise()` queue as the text model, and
            both models plus the sandbox close on shutdown after draining.
Did not:    **The video.** That is now the only thing left. Also unbuilt: "Ask Sentinel"
            (§12), Track 02 benchmarks doc (§22), and the remaining `docs/` files.
Broken:     Nothing known. Note the vision model often answers "financial institution: no"
            for a page it identifies as "Banco Aurora" — we report that verbatim rather
            than overriding it, so `possible_phishing` promotion usually does not fire.
            That is deliberate: correcting the model would make the evidence ours.
Contracts:  `--investigate` on the agent. `QVAC_VISION_MODELS_DIR` and the decoy on
            `127.0.0.1:8099`. Demo scenario for the visual story is `typosquat`.
Next:       **Record the video.** Suggested run of show:
              npm run demo -- typosquat     the investigation, on camera
              npm run demo                   the full detection + QoE + correlation story
              scripts/verify-zero-egress.sh  the proof, then switch Wi-Fi off and rerun
            The analyst UI (3001) and Grafana (3000) both update live while it runs.

### 2026-09-09 — Claude (Opus 5) — VisionPsy investigation (PR #15)
Did:        Built the differentiator: `packages/evidence-engine` (deterministic action
            selection per spec §8.2, isolated Chromium sandbox, VisionPsy via `@qvac/sdk`,
            evidence fusion) and `apps/phishing-demo` (a **fictional** bank's credential
            page on loopback under `.example`; no real institution is imitated anywhere).
            **Verified: risk 64 → 89** on a rendered decoy, ~2s render + ~5.5s for four
            vision calls. 21/21 tests.
            **Two bugs, both about not inventing evidence:** a keyword fallback matched
            "financial" inside "does NOT appear to be a financial institution" and
            inverted the model's conclusion — there is now no fallback at all, findings
            are three-valued and unknown contributes nothing; and VisionPsy-Nano (460M)
            would not hold a composite answer format, so it is now one yes/no question
            per call with only the leading word counted.
Did not:    ⚠️ **NOT WIRED INTO THE AGENT.** The pieces work in isolation. `sentinel-agent`
            still never calls `decideNextAction`. No video.
Broken:     Nothing known.
Contracts:  `QVAC_VISION_MODELS_DIR` (falls back to `QVAC_MODELS_DIR`) must hold
            `visionpsy-nano-460m-flash-q4_k_m-imat.gguf` **and**
            `mmproj-visionpsy-nano-460m-flash-q8.gguf`. Decoy site on `127.0.0.1:8099`.
            Sandbox resolves invented domains with
            `hostResolverRules: "MAP *.example 127.0.0.1:8099"`.
            `Incident.visualEvidence` added to `@sentinel/dns-schema`.

            ── HOW TO WIRE IT (next task, ~45 min) ──────────────────────────────────
            In `apps/sentinel-agent/src/index.ts`, inside `report(inc)`, after the QVAC
            explanation and **before** the Wazuh send:

              import { decideNextAction, renderDomain, analyzeScreenshot,
                       fuseVisionIntoIncident } from "@sentinel/evidence-engine";

              const decision = decideNextAction(inc);
              if (investigate && decision.action === "LOCAL_RENDER" && inc.domains[0]) {
                say(`  investigating: ${decision.rationale}`);
                const render = await serialise(() => renderDomain(inc.domains[0]!, {
                  hostResolverRules: process.env["SANDBOX_RESOLVER_RULES"],
                }));
                const findings = await serialise(() => analyzeScreenshot(render.screenshotPath));
                Object.assign(inc, fuseVisionIntoIncident(inc, render, findings));
                say(`  risk ${before} → ${inc.riskScore} after visual evidence`);
              }

            Notes that matter:
            - Reuse `serialise()`. Two models must not run concurrently on one GPU.
            - Add `--investigate` as an opt-in flag, like `--explain`.
            - Call `closeSandbox()` and `closeVision()` in `shutdown()`, and drain first.
            - `scripts/demo.mjs` must start `apps/phishing-demo` and pass
              `SANDBOX_RESOLVER_RULES=MAP *.example 127.0.0.1:8099`.
            - The demo scenario to use is `typosquat` (the generator now emits
              `banco-aur0ra-login.example`), not `full` — the frozen fixture has no
              matching domain and the decoy is a bank.

### 2026-09-09 — Claude (Opus 5) — docker-compose verified (PR #10)
Did:        Installed colima (no GUI, no admin needed) and ran the compose stack for the
            first time. It exposed **four bugs a native install physically cannot show**:
            (1) the ClickHouse image assigns `default` a random password, so every client
            failed in a container and worked natively — fixed with explicit credentials
            wired through five places, not by disabling auth;
            (2) Grafana provisioning interpolates `${VAR}` but has **no** `:-default`
            syntax, so the datasource got an invalid host and failed with a message that
            reads like a network fault;
            (3) `source .env` breaks on a path containing spaces while Compose parses the
            same file happily — the variable just silently ends up unset;
            (4) the `${VAR:+a}${VAR:-b}` trap for the third time, in the demo banner.
            Verified: all services healthy, schema applied by the entrypoint, Grafana
            datasource healthy, dashboard queries returning real rows through the
            container, demo producing 66 events → 6 incidents → 3 explanations → 5 alerts,
            zero-egress PASS, 21/21 tests.
Did not:    **The video.** That is the only Must Have left. No Active Evidence Acquisition,
            no VisionPsy flow, no "Ask Sentinel", no benchmarks doc.
Broken:     Nothing known.
Contracts:  ClickHouse now needs `CLICKHOUSE_USER` / `CLICKHOUSE_PASSWORD` (defaults
            `sentinel`/`sentinel` in `.env.example`). Scripts load `.env` themselves.
Next:       **Record the video.** `docker compose up -d && ./scripts/bootstrap.sh &&
            ./scripts/demo.sh` is now the whole setup, and it is reproducible on a clean
            machine.

### 2026-09-09 — Claude (Opus 5) — demo, README, UI merged (PRs #9, #8)
Did:        Wrote `scripts/bootstrap.sh` and `scripts/demo.sh`, and the full README —
            all 21 sections of spec §33 from measured values, not estimates. Merged Dev 2's
            analyst UI (PR #8) after fixing two bugs in it.
            **Four bugs found by running things rather than reading them:**
            (1) the demo was not deterministic — the shared Kafka topic accumulates every
            previous run, and duplicated timestamps corrupt beaconing interval variance, so
            6 incidents silently became 5; now a throwaway topic per run;
            (2) SIGTERM during inference tore the QVAC worker down under in-flight calls,
            surfacing as a deterministic fallback that looks exactly like the model having
            nothing to say — the agent now drains queued analysis before unloading;
            (3) `sleep "${EXPLAIN:+45}${EXPLAIN:-8}"` expands to `sleep 45--explain`
            because `${VAR:-default}` yields the VALUE when set;
            (4) the UI's ClickHouse client sliced `JSONCompactEachRowWithNamesAndTypes`
            from index 1, turning the types line into a bogus first row in every table.
            Also moved the UI off port 3000, which docker-compose gives to Grafana.
Did not:    No video. No Active Evidence Acquisition, no VisionPsy flow, no "Ask Sentinel".
            **`docker-compose.yml` has still never been run by anyone.**
Broken:     Nothing known. 21/21 tests, build green.
Contracts:  Analyst UI on `127.0.0.1:3001`. Demo creates a per-run Kafka topic
            `dns.events.demo-<epoch>`.
Next:       **The video is the last Must Have.** Everything it needs now exists:
            `./scripts/demo.sh` is deterministic, the README is complete, and
            `./scripts/verify-zero-egress.sh` is the on-camera proof. After that, the
            highest-value remaining item is someone with Docker validating the compose file.

**Note for Dev 2:** you rewrote the `modelSrc()` zero-egress fix that was already merged
in PR #6 and flagged as done in §8. Check §4 and §8 before starting — that is what they
are for. Also `git merge origin/main` before opening a PR: three branches so far have
predated `main` and silently dropped a package from the build.

### 2026-09-09 — Claude (Opus 5) — zero-egress enforced and proven (PR #7)
Did:        Made zero-egress a mechanism rather than a promise. `packages/egress-guard`
            patches Node's socket layer before any module can connect (side-effect import
            placed first — a guard installed after the first connection proves nothing);
            `scripts/verify-zero-egress.sh` checks real sockets with `lsof` below the JS
            layer, audits the dependency tree for 12 cloud AI SDK names, and greps source
            for external URLs; `docs/ZERO_EGRESS.md` sets out the claim, the allowed
            endpoints, the code guards and an explicit "what this does not prove".
            The system has exactly **two** external runtime dependencies: `kafkajs` and
            `@qvac/sdk`. Script passes, 21/21 tests.
Did not:    No README content, no demo scripts, no video, no analyst UI, no Active Evidence
            Acquisition, no VisionPsy. `docker-compose.yml` still never run.
Broken:     Nothing known.
Contracts:  The agent now **always** arms the egress guard. If a new local service is added
            outside loopback/RFC1918, `isLocalHost()` must be updated or it will be blocked.
Next:       **12 of 13 Must Haves are done — only the video is left** (spec §31). It needs
            the README (§33) and deterministic demo scripts (§29) first.

### 2026-09-09 — Claude (Opus 5) — vertical slice complete (PR #6)
Did:        Wired `explainIncident()` into `apps/sentinel-agent` and **removed the model
            download path** from `packages/qvac-runtime`. It was falling back to an SDK
            constant that fetches weights over the network — a silent 2.5 GB download in
            front of a jury would have undone the whole zero-egress argument. It now fails
            immediately and names the missing file. Verified the complete pipeline with
            weights loaded from local disk: risk 90/80/75 explained by MedPsy and the
            explanation reached **both** the Wazuh alert and the ClickHouse row; risk
            65/60 alerted with the field omitted rather than empty; risk 35 not alerted.
Did not:    **No README content, no demo scripts, no zero-egress proof, no analyst UI, and
            `docker-compose.yml` has still never been run** — nobody on the team has Docker
            yet. These are now the only things between the project and a submission.
Broken:     Nothing known. Kafka and ClickHouse run natively on Dev 1's machine, which is
            not how the team or the jury will run them.
Contracts:  `--explain` / `--explain-min-risk` (default 70) on the agent. `QVAC_MODELS_DIR`
            is now **required** for explanations — there is no download fallback.
Next:       README (spec §33 — 21 sections, all still TBD), deterministic demo scripts
            (§29), and the zero-egress proof (§21). Those three are what the jury actually
            sees; the machinery is done.

### 2026-09-09 — Claude (Opus 5) — Track 04 complete on main (PRs #3, #4, #5)
Did:        Built and merged the Wazuh adapter, the QoE engine with per-site baselines,
            the SOC↔NOC correlation, the ClickHouse writer and the Grafana dashboards.
            **Verified against real services, not mocks:** Kafka 4.3.1, ClickHouse 26.8.2,
            Grafana 13.2.1, all local. Reviewed and merged Dev 2's PR #4 by running it.
            **Three bugs caught that the tests had not:** a site that stayed degraded
            taught itself degraded was normal (EWMA baseline absorbed sustained faults —
            a broken resolver reported "excellent", silently); the agent re-inserted the
            same window every few seconds so every Grafana panel would have double-counted;
            and PR #4 as proposed removed `wazuh-adapter` from `tsc --build` because its
            branch predated PR #3.
Did not:    Did not wire `explainIncident()` into the agent. Did not fix the model-download
            fallback (§8, Dev 2's code). `docker-compose.yml` remains **UNVERIFIED** — no
            Docker on this machine; ClickHouse and Grafana were verified natively.
            No analyst UI, no README content, no demo scripts, no zero-egress proof.
Broken:     Nothing known on `main`. Kafka and ClickHouse are running natively on Dev 1's
            machine — that is **not** how the team will run them; the compose file still
            needs someone with Docker.
Contracts:  ClickHouse at `127.0.0.1:8123`, database `sentinel`, 5 tables. Grafana
            dashboard uid `sentinel-dns`, datasource uid `sentinel-clickhouse`.
Next:       Analyst UI (board item 14) and the README — both are wide open and block
            nothing. Then wire the QVAC explanation into the agent.

### 2026-09-09 — Claude (Opus 5) — streaming slice (PRs #1, #2)
Did:        Built and merged the detection half of the vertical slice.
            `packages/feature-engine` (lexical + behavioral), `packages/threat-engine`
            (DGA, typosquat, tunneling, beaconing + scoring), `apps/synthetic-producer`
            and `apps/sentinel-agent`. Verified end to end against a **real Apache Kafka
            4.3.1 broker**: 66 events produced and consumed, 6 incidents, output identical
            to the direct fixture run. 5/5 regression tests.
            **Two bugs found by running it, not by reading it:**
            (1) typosquat evidence quoted an irrelevant edit distance as the reason a
            containment match fired — evidence that misleads costs more than no evidence;
            (2) detectors took `siteId` from the first event of a group, so Kafka's
            partition ordering gave the same attack a different incident id each run,
            which would have broken deduplication silently. Both fixed, both now covered
            by tests.
Did not:    No Wazuh alert, no QoE, no ClickHouse, no Grafana. **Vector is not in the
            path.** `docker-compose.yml` is written but UNVERIFIED — no Docker here.
            Did not verify Dev 2's QVAC work: `feature/qvac` was never pushed.
Broken:     Nothing known. Kafka runs natively via Homebrew on this machine
            (`brew services stop kafka` to stop it), which is **not** how the rest of the
            team will run it — they need the compose file to actually work.
Contracts:  **LOCKED in §6:** Apache Kafka at `localhost:9092`, topic `dns.events.raw`,
            3 partitions, messages keyed by `clientIp`.
Next:       Wazuh adapter — the last piece of the Track 04 core. Then wire Dev 2's
            `explainIncident()` into `apps/sentinel-agent` at the marked integration
            point, once that branch is pushed.

### 2026-09-09 — Claude (Opus 5) — skeleton + shared contracts
Did:        Created the monorepo skeleton: npm workspaces + TS project references,
            `apps/`+`packages/` per spec §18. Wrote `@sentinel/dns-schema` with all four
            spec §19 types plus the spec §20 `AnalystResponse` and a structural guard —
            **kept dependency-free on purpose** so four parallel installs cannot fight
            over versions. Generated `datasets/synthetic/sample-events.json`: 66 events,
            fixed seed, covering normal / DGA / typosquat / tunneling / beaconing / QoE
            degradation. Verified `npm install && npm run build` green and checked all 66
            fixture records against the `DnsEvent` shape. Locked tooling, schema package
            and fixture in §6. Decided the two questions blocking the QVAC lane: SDK-only
            inference, and download both models (~2.9 GB).
Did not:    Wrote **no detection logic, no stream, no storage, no UI** — every other
            `packages/*` and `apps/*` is an empty directory with a `.gitkeep`. No
            `docker-compose.yml`, no `.env.example`. The fixture is **not** the synthetic
            producer (board item 2, Dev 1) — it is a static file, and item 2 stays open.
Broken:     Nothing. But note the QVAC runner still lives outside the repo, so the repo
            is not yet reproducible on its own (§8).
Contracts:  **LOCKED in §6:** npm workspaces; `@sentinel/dns-schema` as the only home for
            cross-module types; the fixture path and seed; `@qvac/sdk` as the sole
            inference path; both models on disk.
Next:       Vertical slice, starting on `feature/stream-engine`: read the fixture →
            feature extraction → the four detectors → an `Incident`. Kafka can come
            after the detectors work against the fixture.

### 2026-09-09 — Claude (Opus 5) — QVAC spike recorded
Did:        Verified the QVAC test bench at `/Users/anthonymorell/Documents/PRUEBA DE
            MODELOS/` against its own smoke report rather than trusting its README:
            25/25 models pass, 71 GB on disk, M1 Max 32 GB. Read `catalog.py` to get the
            exact default quantizations. Locked the two models Sentinel needs in §6,
            recorded the measured speeds in §4, and wrote down three findings that would
            otherwise cost another agent hours (MedPsy is the only usable instruct text
            model; VisionPsy GGUFs break on Homebrew llama.cpp; MedPsy returns empty
            output if `<think>` eats the token budget). Retired the project's top risk
            in §9. Added the "everything runs local, demo survives Wi-Fi off" rule to §2.
            Invited 3 collaborators. Wrote `docs/ONBOARDING.md`.
Did not:    Wrote no application code — the user explicitly said not to start yet. Did
            not port the QVAC runner into `packages/qvac-runtime/`; it still lives only
            in the external test bench, which means **the repo is not yet reproducible
            without Dev 2's machine**. Did not decide SDK vs `./qvac serve` (§8).
Broken:     Nothing — but note there is still zero application code in this repo.
Contracts:  **LOCKED in §6:** analyst = `qvac/MedPsy-4B-GGUF` @ `q4_k_m-imat`;
            vision = `qvac/VisionPsy-Nano-460M-Flash-GGUFs` @ `q4_k_m-imat` + mmproj `q8`;
            vision engine = QVAC SDK, never Homebrew llama.cpp. Hardware of record =
            M1 Max 32 GB.
Next:       Create the `apps/` + `packages/` layout, then the vertical slice: synthetic
            producer → Kafka → consumer → features → detection → MedPsy explanation →
            Wazuh-compatible alert. Resolve the SDK-vs-`serve` decision before writing
            `packages/qvac-runtime/`.

### 2026-09-09 — Claude (Opus 5) — setup
Did:        Renamed `agents.md` → `AGENTS.md` (the name other tools auto-detect) and added
            `CLAUDE.md` as a one-line pointer. Created `.gitignore`, `.gitattributes`,
            `LICENSE` (MIT), `README.md` skeleton with the 21 sections from spec §33.
            Ran `git init` + first commit on `main`. Froze the git workflow in §7:
            `feature/*` → PR → `main`, no `dev` branch, and **AGENTS.md is not edited in
            feature branches**. Team confirmed at 4.
            Installed `gh` CLI, created the private repo
            `Silentarcherjr/sovereign-sentinel` and pushed `main`.
Did not:    No collaborators added — needs the other 3 GitHub usernames.
            No application code, no repo layout under `apps/`/`packages/`, no
            `docker-compose.yml`, no `.env.example`. README is a skeleton: every technical
            value is `TBD` on purpose, nothing was invented.
Broken:     Nothing runs yet — there is no code.
Contracts:  Git workflow locked (§7). License = MIT, pending Track 02 verification.
            Everything in §6 is still TBD.
Next:       **QVAC feasibility spike (board item 1) before anything else.** Then the
            `apps/`+`packages/` layout and the synthetic producer.

### 2026-09-09 — Claude (Opus 5) — bootstrap
Did:        Read `SOVEREIGN_SENTINEL_SPEC.md` in full; created this `agents.md` as the shared agent-memory / handoff document.
Did not:    Wrote no code, created no repo structure, ran no `git init`. Nothing has been built or validated yet.
Broken:     Nothing yet — nothing exists.
Contracts:  None locked. §6 is entirely TBD.
Next:       **Validate the QVAC SDK locally (board item 1) before anything else**, then create the repo skeleton and the synthetic producer. Follow spec §39: architecture and plan first, implementation after.
