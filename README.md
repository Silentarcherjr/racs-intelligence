# Sovereign Sentinel

> **Zero-egress AI analyst that detects, investigates, correlates and explains DNS
> security incidents entirely inside regulated infrastructure.**

Decentralized AI Hackathon — Panamá 2026

> ⚠️ **This README is a skeleton.** Every section below is required by the spec
> (`SOVEREIGN_SENTINEL_SPEC.md` §33) and must be completed before submission.
> `TBD` markers are deliberate — **do not invent values.** Models, quantizations,
> hardware and benchmarks must be filled in from real measured runs.

---

## 1. Project description

Sovereign Sentinel is a local-first AI security analyst for DNS telemetry in regulated
infrastructure. It consumes live DNS events, detects suspicious behavior and DNS quality
degradation, decides when more evidence is needed, gathers that evidence locally, and
produces explainable alerts — without sending any DNS query, screenshot, derived
indicator or model input to a cloud AI provider.

## 2. Problem

DNS telemetry exposes browsing habits, internal application usage, endpoint behavior,
C2 patterns and organizational structure. For banks, government and healthcare, even a
derived representation of that traffic can be sensitive — which makes the usual
`telemetry → cloud API → model` pipeline unusable. Sentinel replaces it with
`telemetry → local features → QVAC local inference → local evidence → local action`.

## 3. Tracks targeted

- **Track 04 — Ovnicom** (primary)
- **Track 05 — Caja de Ahorros** (secondary)
- **Track 02 — QVAC Psy** — *claimed only if all its requirements are satisfied*
- **Track 03 — General Ranking**

## 4. Architecture

TBD — diagram and description. See spec §15.

## 5. QVAC usage

TBD — how `@qvac/sdk` is used, where inference runs, what it is and is not asked to do.

## 6. Exact models

TBD — **must be exact.** Required for Track 02.

## 7. Exact quantizations

TBD — **must be exact.** Required for Track 02.

## 8. Hardware

TBD — the machine(s) inference was measured on.

## 9. Setup

TBD

## 10. Run instructions

TBD

## 11. Demo scenarios

TBD — normal traffic, DGA/beaconing, typosquatting + visual investigation,
QoE degradation, mixed security/QoE. See spec §13 and §29.

## 12. Zero-egress explanation

TBD — how it is enforced and how it was verified. See spec §21.

## 13. Data sources

TBD

## 14. Synthetic data declaration

All DNS data used in this project is **synthetic or public**. No real customer or
production DNS traffic was processed at any point.

## 15. Remote API disclosure

**No cloud AI inference is used.** No OpenAI, Anthropic, Gemini, Groq, Together,
OpenRouter, remote embeddings or remote vision endpoint. All inference is local via QVAC.

TBD — list any non-AI network calls that do exist, if any.

## 16. Third-party components

TBD — Kafka, ClickHouse, Grafana, Wazuh, Vector, Playwright, and every library used.

## 17. Pre-existing code/base declaration

TBD — **mandatory hackathon rule.** Declare every template, library or codebase that
existed before the build window (9 Sep 2026 08:00). Omitting this is disqualifying.

## 18. Benchmarks

TBD — required if Track 02 is claimed. See spec §22.

## 19. Limitations

- Synthetic DNS data only
- Not a replacement for enterprise threat intelligence
- Risk scores prioritize investigation; they are not proof of compromise
- Visual phishing analysis can produce false positives
- DNS encryption / DoH may limit visibility depending on deployment
- QoE causality cannot always be proven
- Model quality depends on hardware and quantization
- Site baselines require sufficient observation history
- Sandbox rendering of arbitrary sites requires careful containment in real deployment

## 20. Safety statement

TBD — sandbox containment, no credential entry, no outbound execution,
defensive use only. See spec §25.

## 21. License

MIT — see [LICENSE](LICENSE).

---

## For contributors and AI agents

Read **[AGENTS.md](AGENTS.md)** before making any change. It holds the project rules,
module ownership, shared contracts, current build state and the handoff log between
agent sessions.
