# Sovereign Sentinel

> **A zero-egress AI analyst that detects, investigates, correlates and explains
> DNS security incidents entirely inside regulated infrastructure.**

Decentralized AI Hackathon — Panamá 2026

---

## 1. Project description

Sovereign Sentinel is a local-first AI security analyst for DNS telemetry. It consumes a
live event stream, scores four classes of threat with deterministic engines, calculates
DNS quality of experience per site, and asks a **locally-run** language model to explain
the evidence — without sending a single DNS query, derived indicator, prompt or model
input to a cloud provider.

It also answers a question most DNS tooling cannot: **is quality degrading because the
resolver is struggling, or because something on the network is misbehaving?**

## 2. Problem

DNS telemetry exposes browsing habits, internal application usage, endpoint behaviour,
command-and-control patterns and organisational structure. For a bank, a ministry or a
hospital, even a *derived* representation of that traffic can be sensitive — which makes
the usual pipeline unusable:

```
telemetry → cloud API → model → result
```

Sentinel replaces it with:

```
telemetry → local features → QVAC local inference → local evidence → local action
```

## 3. Tracks targeted

| Track | Status |
|---|---|
| **04 — Ovnicom** | **Claimed.** Every stated requirement is implemented and verified. |
| **05 — Caja de Ahorros** | **Claimed.** See §11 for the banking scenario. |
| **03 — General Ranking** | Claimed. |
| **02 — QVAC Psy** | **Not claimed.** VisionPsy runs locally and is benchmarked (§18), but the visual investigation flow is not integrated, so the model is not *central* to the product. Claiming it would be dishonest — see §19. |

## 4. Architecture

```
  synthetic dnstap events
            │
          Kafka  (dns.events.raw, 3 partitions, keyed by client IP)
            │
   ┌────────┴─────────┐
   ▼                  ▼
 feature-engine    qoe-engine ──── per-site rolling baselines
   │                  │
   ▼                  ▼
 threat-engine     QoE score ──┐
   │                           │
   ▼                           ▼
 Incident ──────────────► SOC/NOC correlation
   │
   ├──► qvac-runtime  → MedPsy-4B, on-device, explains the evidence
   ├──► wazuh-adapter → alert with full evidence
   └──► clickhouse-adapter → Grafana
```

Detection is deterministic and explainable. **The model explains evidence; it never
creates or alters a risk score.** Every risk number is a plain weighted sum, and the
weights travel with the alert.

| Package | Responsibility |
|---|---|
| `dns-schema` | Shared types. Dependency-free on purpose. |
| `feature-engine` | Lexical and behavioural features |
| `threat-engine` | DGA · typosquatting · tunneling · beaconing, plus scoring |
| `qoe-engine` | QoE, per-site baselines, SOC/NOC correlation |
| `qvac-runtime` | Local inference via `@qvac/sdk` |
| `wazuh-adapter` | Alert formatting and delivery |
| `clickhouse-adapter` | QoE and incident storage |
| `egress-guard` | Blocks any non-local socket |

## 5. QVAC usage

All inference runs through `@qvac/sdk` on-device. The model receives structured evidence
produced by the deterministic engines and returns JSON constrained by a schema, which is
validated before use; on a validation failure the incident is delivered with **no**
explanation rather than an unvalidated one.

The system prompt is the seven-rule analyst prompt from the specification — never invent
evidence, never claim confirmation, use probabilistic language, explain the most important
evidence first, recommend only defensive steps, do not request external services, output
valid JSON.

`reasoning_budget: 0` / `enable_thinking: false` is required: MedPsy is a Qwen3 derivative
and, left to reason freely, exhausts its token budget inside `<think>` and returns an
empty answer.

## 6. Exact models

| Role | Model | Status |
|---|---|---|
| Local analyst | `qvac/MedPsy-4B-GGUF` | In use |
| Visual analysis | `qvac/VisionPsy-Nano-460M-Flash-GGUFs` | Benchmarked, not integrated |

**A note we would rather state than hide:** MedPsy is a clinically fine-tuned model. Of the
25 models published by QVAC, it is the only usable instruct text model — the Genesis family
produces unusable output, AfriSLM and TranslateNano are translation models, and Fabric is a
biomedical LoRA. Underneath it is Qwen3 and it follows the constrained analyst prompt well,
but it was not trained for security work. It explains evidence; it does not decide anything.

## 7. Exact quantizations

| Model | Quantization | File |
|---|---|---|
| MedPsy-4B | `q4_k_m-imat` | `medpsy-4b-q4_k_m-imat.gguf` (2.5 GB) |
| VisionPsy-Flash | `q4_k_m-imat` + mmproj `q8` | `visionpsy-nano-460m-flash-q4_k_m-imat.gguf` (393 MB) |

## 8. Hardware

Apple M1 Max, 32 GB unified memory, macOS 15. Inference on the GPU via Metal.

## 9. Setup

```bash
git clone https://github.com/Silentarcherjr/sovereign-sentinel.git
cd sovereign-sentinel
npm install && npm run build

cp .env.example .env          # endpoints and ClickHouse credentials
docker compose up -d          # kafka, clickhouse, grafana
./scripts/bootstrap.sh        # verifies prerequisites and applies the schema
```

Verified on colima 0.10.3 / Docker 29.5.2 on Apple Silicon. On macOS without
Docker Desktop, `brew install colima docker docker-compose && colima start`
works and needs no GUI.

Model weights are **never downloaded at run time**. Fetch them once, ahead of time, and
point `QVAC_MODELS_DIR` at the directory containing `medpsy-4b-q4_k_m-imat.gguf`. Without
them the pipeline still runs; incidents simply carry no analyst text.

Copy `.env.example` to `.env` to change any endpoint.

## 10. Run instructions

```bash
npm run demo                    # full pipeline on the committed fixture
npm run demo -- dga             # one scenario at a time
npm run demo -- live            # open-ended generated stream
npm test                        # 21 regression tests
```

These run on **macOS, Linux and Windows** — they are Node scripts, so Windows
needs neither WSL nor Git Bash. `scripts/demo.sh` and `scripts/bootstrap.sh`
are thin wrappers around the same code.

`scripts/verify-zero-egress.sh` is the one exception: it inspects real sockets
with `lsof`, which has no Windows equivalent worth faking. On Windows, run the
demo and confirm the **SOVEREIGN MODE** panel reports zero blocked external
connections — the in-process guard works everywhere.

### Watching it work

| | | |
|---|---|---|
| **Analyst UI** | <http://127.0.0.1:3001> | Incidents with full evidence, QoE per site, the SOC/NOC verdict, and an *Explain with QVAC* button. Refreshes every 4 s and pauses while a detail view is open. |
| **Grafana** | <http://127.0.0.1:3000> | Ten panels, auto-refreshing every 10 s. Dashboard: *Sovereign Sentinel — DNS Security & QoE*. |

Start the UI with `npm start -w @sentinel/analyst-ui`. For a live view rather
than a replay, run `npm run demo -- live` and watch either surface update as
events arrive.

## 11. Demo scenarios

`./scripts/demo.sh full` replays 66 committed events and produces, identically on every
run:

| Risk | Classification | Evidence |
|---|---|---|
| 90 | DNS tunneling | 48-char encoded subdomains, 100% TXT/NULL, no caching |
| 80 | Typosquatting | `micr0soft-secure-login.example`, homoglyph, two sites |
| 75 | DGA | 10 unique names, 100% NXDOMAIN, 3.66 bits entropy |
| 65 | Beaconing | Interval variation 0.000 at a 60-second cadence |
| 60 / 35 | Typosquatting | `app1e-id-verify`, `banes-co-panama` |

And the correlation that ties security to operations:

```
pa-branch-01  QoE 45  LIKELY_OPERATIONAL      no finding explains the degradation
pa-hq         QoE 59  LIKELY_SECURITY_DRIVEN  DGA + tunneling explain 100% of it
```

**Banking scenario (Track 05).** `banes-co-panama.example` and
`micr0soft-secure-login.example` are credential-phishing lookalikes of a Panamanian bank
and its identity provider. A bank's SOC sees the finding, its evidence and a local
explanation — while the DNS traffic that revealed it never leaves the bank.

## 12. Zero-egress explanation

Proven three ways, not asserted once. See [`docs/ZERO_EGRESS.md`](docs/ZERO_EGRESS.md).

1. **In-process guard** — `packages/egress-guard` patches the socket layer before any
   module can connect and refuses anything that is not loopback or RFC 1918.
2. **OS-level check** — `scripts/verify-zero-egress.sh` inspects real sockets with `lsof`,
   below the JavaScript layer, and audits the dependency tree for twelve cloud AI SDKs.
3. **Switch the Wi-Fi off** — the demo behaves identically.

**This is zero cloud AI inference and zero egress. It is not an air gap** and we do not
claim it is: the machine has a working network interface, we simply do not use it.

## 13. Data sources

Synthetic events generated by `apps/synthetic-producer`, plus a committed 66-event fixture
(`datasets/synthetic/sample-events.json`, seed `20260909`). All domains are under
`.example` or invented; all addresses are RFC 1918.

## 14. Synthetic data declaration

**All DNS data is synthetic.** No real customer, production or captured DNS traffic was
processed at any point.

## 15. Remote API disclosure

**No cloud AI inference is used.** No OpenAI, Anthropic, Gemini, Groq, Together,
OpenRouter, remote embeddings or remote vision. There are no non-AI remote calls either:
the only network destinations at run time are the local Kafka broker, ClickHouse, Grafana
and the Wazuh endpoint.

Model weights were downloaded once from Hugging Face **before** the run, as a build step.
The runtime refuses to download anything.

## 16. Third-party components

| Component | Use |
|---|---|
| Apache Kafka 4.3.1 | Event stream |
| ClickHouse 26.8.2 | Storage |
| Grafana 13.2.1 | Dashboards |
| Wazuh | Alert destination (decoder and rules in `infra/wazuh/`) |
| `kafkajs` | Kafka client |
| `@qvac/sdk` | Local inference |
| QVAC models | Tether AI Research |

The entire system has **two** external runtime dependencies: `kafkajs` and `@qvac/sdk`.

## 17. Pre-existing code/base declaration

**No pre-existing codebase was used.** Every file in this repository was written inside the
build window (9 Sep 2026 08:00 → 11 Sep 2026 08:00, Panamá).

A local QVAC model test bench was built to validate SDK feasibility; its files are
timestamped 2026-09-09 09:57–11:48, also inside the window. The QVAC **model weights** are
third-party artefacts published by Tether AI Research and are declared in §16.

## 18. Benchmarks

Measured on the hardware in §8 by `./qvac smoke --preset all`. **25 of 25 QVAC models
pass.** The two relevant to Sentinel:

| Model | Quantization | Throughput | Notes |
|---|---|---|---|
| `medpsy-4b-gguf` | `q4_k_m-imat` | **72.6 tok/s** | Analyst |
| `visionpsy-460m-flash-gguf` | `q4_k_m-imat` | **238.0 tok/s** | TTFT ~0.8 s |

End-to-end, in the running pipeline: **~15 s cold model load once, then ~5 s per incident
explanation** (measured 5.5 / 4.4 / 5.1 s). Explanations are therefore thresholded — by
default only incidents at risk ≥ 70 are explained.

## 19. Limitations

- Synthetic DNS data only.
- Not a replacement for enterprise threat intelligence.
- Risk scores prioritise investigation; they are **not proof of compromise**.
- The correlation verdict says *correlated*, never *caused*, and is enforced by a test.
- The analyst model is clinically fine-tuned (§6). It explains; it does not decide.
- **Vector is not in the pipeline.** The producer writes to Kafka directly; Ovnicom's
  stated pipeline begins at BIND9 → dnstap → Vector. We start at the Kafka boundary.
- **Active Evidence Acquisition and the VisionPsy investigation flow are not built.** The
  vision model runs and is benchmarked, but the sandbox → screenshot → fusion loop does
  not exist, which is why Track 02 is not claimed.
- Site baselines need a few healthy windows before they mean anything; until then a fixed
  reference is used and the output says so.
- DNS encryption (DoH/DoT) limits visibility depending on deployment.

## 20. Safety statement

Defensive use only. The system observes DNS metadata, scores it, and recommends
investigation steps. It performs no blocking, no active scanning and no interaction with
suspicious infrastructure. Alert severity is capped at Wazuh level 12 — level 13+ reads as
a confirmed compromise, and a risk score is not that.

## 21. License

MIT — see [LICENSE](LICENSE).

---

**Contributors and AI agents:** read [`AGENTS.md`](AGENTS.md) before making any change.
