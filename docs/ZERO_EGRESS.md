# Zero-Egress

## The claim, stated precisely

> Sovereign Sentinel performs **zero cloud AI inference**. DNS queries, derived
> indicators, prompts, model inputs and screenshots never leave the machine.

**It is not air-gapped, and we do not claim it is.** The host has a working
network interface. The claim is about where analysis happens and where data
goes — not about the machine being physically isolated. Spec §21 is explicit
that overstating this is worse than not claiming it.

## Why it matters

DNS telemetry reveals browsing habits, internal application usage, endpoint
behaviour, C2 patterns, sensitive domains and organisational structure. For a
bank, a ministry or a hospital, even a *derived* representation of that traffic
can be sensitive. The usual pipeline —

```
telemetry → cloud API → model → result
```

— is simply not available to them. Sentinel replaces it with:

```
telemetry → local features → QVAC local inference → local evidence → local action
```

## Three layers of proof

No single check is convincing on its own. These three are, together.

### 1. In-process guard — `packages/egress-guard/`

The agent patches Node's socket layer before any other module can open a
connection (`apps/sentinel-agent/src/egress.ts` is imported first, deliberately).
Every outbound TCP connection is inspected; anything that is not loopback or
RFC 1918 is refused before a byte leaves.

```
[egress-guard] BLOCKED outbound connection to api.openai.com:443.
```

**Limitation, stated plainly:** this covers everything the application does in
JavaScript. A compiled native addon could open its own socket and bypass it.
That is why layer 2 exists.

### 2. Operating-system check — `scripts/verify-zero-egress.sh`

Runs the full pipeline and inspects the process's real open sockets with `lsof`,
below the JavaScript layer, asserting every peer is loopback or private. It also
audits the dependency tree and greps the source for external URLs.

```bash
./scripts/verify-zero-egress.sh
```

### 3. Switch the Wi-Fi off

The strongest and simplest demonstration: disable the network interface and run
the demo again. It behaves identically, because nothing it needs is remote. This
is also why `packages/qvac-runtime` refuses to download model weights and fails
loudly instead — a demo that quietly pulls 2.5 GB is not a local demo.

## Dependency audit

The whole system has **two** external runtime dependencies:

| Package | Used by | Network behaviour |
|---|---|---|
| `kafkajs` | agent, producer | Connects to the local broker only |
| `@qvac/sdk` | qvac-runtime | Local inference. Its download path is **not used** — weights must already be on disk |

No `openai`, `anthropic`, `@google/generative-ai`, `groq-sdk`, `cohere-ai`,
`together-ai`, `replicate`, `langchain` or `llamaindex` is installed. The
verification script checks for twelve such names and fails if any appears.

## Allowed local endpoints

Everything the system talks to, and nothing else:

| Service | Address | Purpose |
|---|---|---|
| Kafka | `localhost:9092` | DNS event stream |
| ClickHouse | `127.0.0.1:8123` | QoE and incident storage |
| Grafana | `127.0.0.1:3000` | Dashboards |
| Wazuh receiver | `127.0.0.1:8081` | Alert delivery |
| QVAC | in-process | Local inference on Apple Silicon GPU |

Every service in `docker-compose.yml` is published to `127.0.0.1` only, never
`0.0.0.0`.

## Guards written into the code

These are enforced, not documented:

| Guard | File | Behaviour |
|---|---|---|
| Alert sink | `packages/wazuh-adapter/src/sinks.ts` | `HttpSink` **throws at construction** for a non-loopback host |
| Storage | `packages/clickhouse-adapter/src/index.ts` | Refuses a non-local ClickHouse host |
| Model weights | `packages/qvac-runtime/src/explainIncident.ts` | No download path; fails loudly if weights are absent |
| Socket layer | `packages/egress-guard/src/index.ts` | Blocks any non-local TCP connection |

Each has a test. `packages/wazuh-adapter/src/alert.test.ts` asserts that
`https://siem.example.com` is refused; `packages/egress-guard/src/guard.test.ts`
asserts that `api.openai.com` cannot be reached and that the proof panel never
uses the phrase "air-gapped".

## The proof panel

Printed from real counters on shutdown, not from constants (spec §21):

```
SOVEREIGN MODE

  QVAC runtime                    LOCAL
  Cloud inference endpoints       NONE
  External model requests         0
  DNS events uploaded             0
  Screenshots uploaded            0
  Outbound connections attempted  2
    … to local/private hosts      2
    … blocked as external         0
  Current model                   qvac/MedPsy-4B-GGUF q4_k_m-imat
  Execution device                Apple Silicon GPU (Metal), local

  Destinations: localhost:9092
```

## What this does not prove

- **Not an air gap.** The interface works; we simply do not use it.
- The guard is a JavaScript-level control. Native code could bypass it — hence
  the OS-level check and the Wi-Fi test.
- It says nothing about the host's *other* software.
- Model weights were downloaded once, ahead of time, from Hugging Face. That is
  a build-time step, not a runtime one, and it is why the runtime refuses to
  download anything.
