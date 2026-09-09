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
| `docs/` | *not created yet* — ARCHITECTURE, THREAT_MODEL, ZERO_EGRESS, TRACK_MAPPING, BENCHMARKS, DEMO. |

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

**Last updated:** 2026-09-09 by Claude (Opus 5) — initial setup.
**Hackathon hour:** ~0–2 (planning phase).

### Repository status

Repo is live on GitHub (private) with `main` pushed. It contains **only docs so far** —
spec, this file, `README` skeleton, `LICENSE`, ignore rules. **No application code, no
`apps/`/`packages/` layout, no `docker-compose.yml`, no package manifests.** Everything
on the board below except item 0 is `NOT STARTED`.

### Build board

Status values: `NOT STARTED` · `IN PROGRESS` · `DONE` · `BLOCKED` · `UNVERIFIED` (built but never run end to end)

| # | Component | Status | Owner / Agent | Notes |
|---|---|---|---|---|
| 0 | Repo skeleton + git + toolchain | IN PROGRESS | Claude | Repo created and pushed to GitHub; `.gitignore`, `.gitattributes`, `LICENSE`, `README` skeleton exist. **Still missing:** collaborators, `apps/`+`packages/` layout (spec §18), package manifests, `docker-compose.yml`, `.env.example`. |
| 1 | **QVAC feasibility spike** | NOT STARTED | — | **Do this first.** Everything else is worthless if local inference does not run. Confirm SDK installs, a model loads, latency is tolerable. |
| 2 | Synthetic DNS producer | NOT STARTED | — | spec §13 — normal, DGA, typosquat, tunneling, beaconing, QoE degradation |
| 3 | Kafka (or Redpanda) + Vector | NOT STARTED | — | must be a real stream |
| 4 | Sentinel consumer + feature engine | NOT STARTED | — | spec §7 MVP-1/2 |
| 5 | Threat engine (4 detectors) | NOT STARTED | — | deterministic, weighted, explainable |
| 6 | QVAC local analyst (explanations) | NOT STARTED | — | spec §20 — constrained prompt, JSON schema, validated |
| 7 | Wazuh adapter | NOT STARTED | — | local compatible endpoint first, real Wazuh second |
| 8 | QoE engine + site baselines | NOT STARTED | — | spec §7 MVP-5, §14 |
| 9 | ClickHouse writer | NOT STARTED | — | |
| 10 | Grafana dashboard | NOT STARTED | — | QoE per site/zone |
| 11 | SOC↔NOC correlation | NOT STARTED | — | spec §11 |
| 12 | Active investigator + sandbox | NOT STARTED | — | spec §8, §9 |
| 13 | VisionPsy path | NOT STARTED | — | **Track 02 only. Do not fake it.** Drop if unstable (spec §32). |
| 14 | Analyst UI / "Ask Sentinel" | NOT STARTED | — | spec §12, §24 |
| 15 | README + docs + track mapping | NOT STARTED | — | spec §33 |
| 16 | Demo scripts (deterministic) | NOT STARTED | — | spec §29 |
| 17 | Zero-egress proof | NOT STARTED | — | spec §21 — network capture / egress denial evidence |
| 18 | Benchmarks (Track 02 only) | NOT STARTED | — | spec §22 |

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
| **Dev 1** — _name TBD_ | Streaming + threat engine | `apps/synthetic-producer/`, `packages/dns-schema/`, `packages/feature-engine/`, `packages/threat-engine/` |
| **Dev 2** — _name TBD_ | QVAC + evidence + vision | `packages/qvac-runtime/`, `packages/evidence-engine/`, vision path, `benchmarks/` |
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
| Package manager / monorepo tool | — | TBD |
| Kafka broker address | — | TBD |
| Kafka topic — raw DNS events | — | TBD |
| Kafka topic — incidents (if used) | — | TBD |
| ClickHouse DB / table for QoE | — | TBD |
| Wazuh endpoint + alert JSON shape | — | TBD |
| QVAC model id + quantization | — | TBD (**must be declared for Track 02**) |
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

- [ ] **Create the GitHub repo and push.** `git init` + first commit are done locally, but
      there is no remote yet. Add the other 3 as collaborators. Decide who owns `main`.
- [ ] **Make the repo public before submitting** (or grant jury access). Spec §38 requires
      submission links to work without credentials.
- [ ] Verify MIT is acceptable if Track 02 is claimed (spec §34 says verify, don't assume).
- [ ] **QVAC SDK not yet validated on any team machine.** Highest-risk unknown. Blocks contract "QVAC model id".
- [ ] Kafka vs Redpanda — pick one and freeze it in §6.
- [ ] Wazuh: full deployment vs local compatible endpoint first (spec §16 says build the compatible endpoint first, integrate real Wazuh after).
- [ ] Confirm whether Track 02 will be claimed. It carries extra obligations (`@qvac/sdk` for primary inference + RAG, declared model, declared quantization, benchmarks, open-source requirements). **Only claim it if all are satisfiable.**
- [ ] Declare any pre-existing code base at submission (spec §38).

---

## 9. Risk register

| Risk | Impact | Mitigation / fallback (spec §32) |
|---|---|---|
| QVAC SDK does not run locally or is too slow | Fatal — the thesis dies | Validate in hour 1. If slow: smaller model, shorter prompts, explain only high-risk incidents, cache explanations. |
| VisionPsy unstable | Loses Track 02 only | Drop the track. **Never fake it.** Tracks 04+05+03 stand without it. |
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
