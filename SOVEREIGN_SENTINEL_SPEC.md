# SOVEREIGN SENTINEL — MASTER SPEC

> **Hackathon:** Decentralized AI Hackathon — Panamá 2026  
> **Primary strategy:** Build one project that can credibly compete in Track 04 (Ovnicom), Track 05 (Caja de Ahorros), Track 02 (QVAC Psy) and therefore also Track 03 (General Ranking).  
> **Build window:** 9 Sep 2026 08:00 → 11 Sep 2026 08:00, Panamá time.  
> **Team size:** 4.  
> **Core constraint:** All AI inference must run locally on-device / on-premise using QVAC, or be delegated peer-to-peer. **No cloud inference.**

---

# 1. Executive Summary

**Sovereign Sentinel** is a local-first AI security analyst for regulated infrastructure. It consumes live DNS telemetry, detects suspicious behavior and DNS quality degradation, decides when additional evidence is required, performs local evidence enrichment, and produces explainable security alerts plus operational quality insights — without sending DNS queries, screenshots, derived indicators, prompts, or model inputs to a cloud AI provider.

The first deployment target is the exact pipeline described by Ovnicom:

```text
BIND9 + dnstap
      ↓
    Vector
      ↓
     Kafka
      ↓
┌───────────────────────────────┐
│       Sovereign Sentinel      │
│  Detection + QVAC reasoning   │
└───────────────────────────────┘
   ↓                        ↓
 Wazuh                ClickHouse
                           ↓
                        Grafana
```

The project goes beyond a basic DNS classifier. Its core differentiator is **Active Evidence Acquisition**: when the current evidence is insufficient, Sentinel chooses the most valuable next local investigation step instead of always applying a fixed workflow.

Example:

```text
Observed domain:
micr0soft-secure-login.example

Initial evidence:
- typosquatting similarity: high
- recently observed
- queried by multiple hosts
- lexical risk: medium/high

Initial risk:
64%

Sentinel decision:
"Visual verification has the highest expected information gain."

Local sandbox:
- renders the site
- captures a screenshot

VisionPsy:
- detects Microsoft-like visual identity
- detects credential form
- detects suspicious login wording

Final risk:
96%

Action:
- send explainable alert to Wazuh
- preserve evidence locally
```

At the same time, Sentinel calculates DNS Quality of Experience (QoE) by site/zone and correlates operational degradation with security events. This allows it to answer questions such as:

> “Is DNS quality falling because the resolver is overloaded, or because infected hosts are generating abnormal traffic?”

The product is designed for **banks, government, healthcare, datacenters, and other regulated environments** where sending DNS data or screenshots to a cloud AI service is unacceptable.

---

# 2. One-Sentence Pitch

> **Sovereign Sentinel is a zero-egress AI analyst that detects, investigates, correlates and explains DNS security incidents entirely inside regulated infrastructure.**

Alternative pitch:

> **It does not just flag suspicious DNS — it decides what evidence is missing, gathers that evidence locally, and explains what is happening without exposing customer data to the cloud.**

---

# 3. Why This Project

## 3.1 Why it matters

DNS telemetry can reveal:

- user browsing habits
- internal application usage
- endpoint behavior
- command-and-control patterns
- sensitive domains
- organizational structure
- security incidents
- operational health

For banking, government and healthcare, even a “derived” representation of DNS traffic may be sensitive.

Traditional AI pipelines often require:

```text
Telemetry → cloud API → model → result
```

That design is incompatible with the hackathon and with many real regulated deployments.

Sentinel instead uses:

```text
Telemetry → local features → QVAC local inference → local evidence → local action
```

## 3.2 Why edge/local AI is an advantage, not a limitation

Local execution enables:

- zero-egress analysis
- lower privacy risk
- deterministic data residency
- operation during WAN outages
- lower dependency on third-party AI providers
- easier compliance review
- local performance tuning
- customer-controlled model lifecycle
- optional peer delegation inside the trusted infrastructure

---

# 4. Track Strategy

## Track 04 — Ovnicom — Primary Corporate Track

**Direct fit:** excellent.

Required:

- consume DNS telemetry as a **stream**, not a static file
- classify suspicious domains / behavior
- detect at least:
  - DGA-like behavior
  - typosquatting
  - DNS tunneling indicators
  - beaconing / C2-like periodicity
- send security alerts to Wazuh
- calculate interpretable DNS QoE score
- write QoE to ClickHouse
- visualize by site / zone in Grafana
- preserve the existing production pipeline
- process only synthetic/public test data
- run inference locally with QVAC

Sentinel should satisfy all of these.

## Track 05 — Caja de Ahorros — Secondary Corporate Track

**Positioning:** Sovereign SOC/NOC assistant for banking.

Why this is relevant to a bank:

- phishing / typosquatting
- command-and-control detection
- suspicious DNS behavior
- data exfiltration indicators
- sensitive telemetry remains inside the bank
- analysts can query incidents locally
- no customer or security telemetry is sent to a third-party AI
- potential future integration with existing bank SIEM/NOC/SOC infrastructure

The banking story must be explicit in the video and README.

## Track 02 — QVAC Psy — Optional but Strategic

Target model: **VisionPsy**, only if the implementation is stable enough.

VisionPsy must be **central**, not decorative.

Proposed core role:

1. DNS/behavioral engine detects a suspicious domain.
2. Sentinel determines that visual inspection would materially improve certainty.
3. A local isolated browser renders the page.
4. Screenshot stays on the machine.
5. VisionPsy analyzes it locally.
6. Visual findings are fused with DNS evidence.
7. Risk score and explanation are updated.

If VisionPsy is not stable enough, do **not** fake this track. Track 04 + 05 + General remain valid without it.

Track 02 special obligations:

- use `@qvac/sdk` for primary inference and RAG operations
- declare exact model
- declare quantization
- declare hardware
- repository must be open source under a permissive approved license
- provide reproducible setup instructions
- provide performance log:
  - model load time
  - prompts
  - token counts
  - TTFT
  - throughput
- show a real user workflow, not merely a benchmark
- disclose all remote APIs and third-party services
- no remote inference

## Track 03 — General Ranking

Any compliant corporate-track project also participates in the general ranking.

General scoring:

| Criterion | Weight |
|---|---:|
| Technical | 35% |
| Innovation | 25% |
| Impact | 20% |
| Design | 10% |
| Completion | 10% |

Tie-break priority:

1. Technical
2. Impact
3. jury chair vote

---

# 5. Project Principles

## Principle 1 — Zero-Egress AI

Nothing used for AI inference leaves the trusted environment.

Must remain local:

- DNS query names
- client identifiers
- source IPs
- screenshots
- extracted text
- embeddings
- prompts
- model outputs
- incident context
- derived behavioral summaries used by AI

Cloud services may only be used for non-AI functions explicitly allowed by the hackathon.

Prefer avoiding unnecessary cloud dependencies entirely during the demo.

## Principle 2 — Hybrid Detection Beats “LLM Does Everything”

Do not send every DNS event to an LLM.

Use deterministic / statistical features first.

Examples:

- domain entropy
- subdomain entropy
- query length
- digit ratio
- consonant/vowel patterns
- n-gram similarity
- edit distance to known brands
- NXDOMAIN rate
- unique-domain rate
- source host burstiness
- periodicity
- inter-arrival variance
- subdomain depth
- label count
- encoded-looking payloads
- qtype anomalies
- latency
- p95/p99 latency
- resolver failure rate

QVAC should be used for:

- reasoning over aggregated evidence
- incident interpretation
- evidence prioritization
- human-readable explanation
- local natural-language analyst queries
- visual reasoning via VisionPsy
- classification of ambiguous cases

## Principle 3 — Explainability

Every alert should say **why**.

Bad:

```text
Malicious: 97%
```

Good:

```text
Risk: 92/100

Evidence:
+22 high lexical entropy
+20 NXDOMAIN burst
+18 periodic beacon pattern
+15 first-seen domain
+10 queried by 8 hosts
+7 abnormal query length

Likely behavior:
DGA / C2 discovery

Recommended action:
Investigate source host 10.20.5.17
```

## Principle 4 — Active Evidence Acquisition

Sentinel should not always run every enrichment step.

It should choose the next action based on expected value.

Example actions:

- wait for more stream evidence
- inspect lexical similarity
- inspect recent host behavior
- compare with known brand names
- render site locally
- run VisionPsy
- correlate with QoE degradation
- inspect historical baseline

Conceptual score:

```text
action_value =
expected_confidence_gain
- compute_cost
- latency_cost
- operational_risk
```

This can initially be implemented with deterministic heuristics.

Do not overcomplicate it with reinforcement learning.

## Principle 5 — Security + Operations in One Context

Sentinel is not only SOC and not only NOC.

It correlates:

```text
Security indicators
+
QoE degradation
+
site baseline
+
host behavior
=
operator-readable incident context
```

---

# 6. Core User Personas

## 6.1 SOC Analyst

Needs:

- high-signal alerts
- evidence
- affected hosts
- why the event matters
- recommended next step
- no cloud data exposure

## 6.2 NOC Operator

Needs:

- zone/site QoE
- current health
- latency degradation
- NXDOMAIN anomalies
- saturation indications
- whether degradation is operational or security-driven

## 6.3 Security/Infrastructure Manager

Needs:

- customer/site overview
- zero-egress proof
- incident history
- simple dashboards
- explainable risk
- deployability in regulated environments

## 6.4 Banking Security Team

Needs:

- sensitive telemetry kept on-premise
- phishing / typosquatting detection
- C2/DGA/tunneling visibility
- local analyst assistant
- integration with SIEM
- reproducibility and auditability

---

# 7. MVP Scope

The MVP must be completed before stretch goals.

## MVP-1 — Streaming DNS Consumer

Must consume events from Kafka or a compatible local event stream.

Do not use only a CSV during the final demo.

Input events should approximate normalized dnstap telemetry.

Example:

```json
{
  "timestamp": "2026-09-09T14:32:10.133Z",
  "site_id": "PA-PTY-01",
  "zone": "bank-branch-01",
  "client_ip": "10.20.5.17",
  "resolver_ip": "10.20.0.53",
  "qname": "xj39adkq9.example",
  "qtype": "A",
  "rcode": "NXDOMAIN",
  "latency_ms": 41.8
}
```

## MVP-2 — Feature Extraction

For each event/window derive features required for threat and QoE analysis.

Per-domain example:

```json
{
  "qname": "xj39adkq9.example",
  "entropy": 3.92,
  "length": 17,
  "digit_ratio": 0.18,
  "label_count": 2,
  "subdomain_depth": 0,
  "brand_similarity": 0.07,
  "nxdomain_ratio": 0.96,
  "query_count_5m": 44,
  "unique_clients_5m": 3,
  "periodicity_score": 0.74
}
```

## MVP-3 — Threat Detection

At minimum demonstrate:

- DGA-like traffic
- typosquatting
- DNS tunneling indicators
- beaconing/C2 indicators

Use hybrid detection:

```text
rules / statistical features
        ↓
lightweight scoring
        ↓
QVAC reasoning on enriched incidents
```

Do not claim the system is production-grade malware detection.

Use language such as:

- suspicious
- likely
- anomalous
- requires investigation
- confidence

## MVP-4 — Wazuh Alert Output

Produce alert JSON consumable by a local webhook/API receiver.

Example:

```json
{
  "integration": "sovereign-sentinel",
  "severity": 12,
  "category": "dns_security",
  "classification": "possible_dga",
  "risk_score": 91,
  "site_id": "PA-PTY-01",
  "source_host": "10.20.5.17",
  "domain": "xj39adkq9.example",
  "evidence": [
    "high_entropy",
    "nxdomain_burst",
    "periodic_queries",
    "new_domain"
  ],
  "explanation": "Pattern is consistent with DGA-based command-and-control discovery.",
  "recommended_action": "Investigate the source host and review related process/network activity."
}
```

## MVP-5 — QoE Scoring

Calculate a DNS experience score per site/zone.

Inputs:

- resolution latency
- p95 latency
- NXDOMAIN rate
- SERVFAIL rate if present
- timeouts if simulated
- query load/saturation signal

Proposed initial formula:

```text
QoE = 100
      - latency_penalty
      - nxdomain_penalty
      - failure_penalty
      - saturation_penalty
```

Each penalty must be bounded.

Example interpretation:

| Score | Meaning |
|---|---|
| 90–100 | Excellent |
| 75–89 | Good |
| 60–74 | Degraded |
| 40–59 | Poor |
| 0–39 | Critical |

The score must be **explainable**.

Example:

```text
QoE: 63 / 100

-18 p95 latency above baseline
-11 NXDOMAIN spike
 -8 saturation indicator
```

## MVP-6 — ClickHouse Output

Write aggregated QoE metrics and relevant incident summaries.

Suggested tables:

- `dns_events`
- `dns_qoe_windows`
- `dns_incidents`
- `dns_site_baselines`

## MVP-7 — Grafana Dashboard

Minimum panels:

1. QoE score by site
2. QoE over time
3. p95 DNS latency
4. NXDOMAIN rate
5. suspicious event count
6. threat categories
7. top affected hosts
8. zone/site comparison

## MVP-8 — QVAC Local Analyst

QVAC must clearly perform genuine inference.

Example input:

```json
{
  "incident_type": "possible_dga",
  "risk_score": 82,
  "site": "PA-PTY-01",
  "signals": {
    "nxdomain_rate": 0.43,
    "entropy_mean": 4.1,
    "periodicity": 0.88,
    "new_domains": 149
  }
}
```

Expected output:

- concise interpretation
- confidence caveat
- likely scenario
- recommended next investigation
- operator-friendly explanation

---

# 8. High-Value Feature — Active Investigation

This is the main innovation layer.

## 8.1 Incident state machine

```text
DETECTED
   ↓
EVIDENCE_INCOMPLETE
   ↓
SELECT_NEXT_ACTION
   ↓
COLLECT_LOCAL_EVIDENCE
   ↓
REASSESS
   ↓
┌────────────┬──────────────┐
│ CONFIRMED  │ NEEDS_MORE   │
└────────────┴──────────────┘
```

## 8.2 Candidate actions

```text
CHECK_DOMAIN_LEXICAL
CHECK_HOST_HISTORY
CHECK_SITE_BASELINE
CHECK_BEACON_PERIODICITY
CHECK_TUNNEL_FEATURES
CHECK_BRAND_SIMILARITY
LOCAL_RENDER
VISION_ANALYSIS
CORRELATE_QOE
WAIT_FOR_MORE_STREAM_DATA
```

## 8.3 Simple deterministic action selection

Example:

```python
if threat == "typosquatting" and visual_evidence_missing:
    next_action = "LOCAL_RENDER"

elif threat == "possible_dga" and periodicity_unknown:
    next_action = "CHECK_BEACON_PERIODICITY"

elif qoe_drop and security_correlation_unknown:
    next_action = "CORRELATE_QOE"
```

Later, QVAC can help rank candidate actions from a constrained list.

Never allow the model to execute arbitrary commands.

---

# 9. VisionPsy Investigation Path

Only build this after the core stream → detection → Wazuh → QoE path works.

## 9.1 Flow

```text
Suspicious domain
      ↓
Active Investigation
      ↓
Local isolated browser
      ↓
Screenshot
      ↓
VisionPsy via @qvac/sdk
      ↓
Structured visual evidence
      ↓
Evidence fusion
      ↓
Updated risk score
```

## 9.2 Vision evidence schema

```json
{
  "brand_impersonation_detected": true,
  "possible_brand": "Microsoft",
  "login_form_detected": true,
  "credential_request_detected": true,
  "urgency_language_detected": false,
  "visual_confidence": 0.91,
  "notes": [
    "Page contains branding visually similar to Microsoft sign-in.",
    "Credential fields are visible."
  ]
}
```

## 9.3 Safety

The render environment must be isolated.

Do not:

- enter credentials
- submit forms
- execute arbitrary downloaded files
- follow downloads
- allow persistent browser sessions
- reuse real customer cookies

Prefer:

- containerized Chromium / Playwright
- no credentials
- restricted network policy
- screenshot only
- short timeout
- no download permission

For the demo, use controlled local synthetic phishing pages or safe public test pages.

---

# 10. Evidence Fusion

Risk should not be an opaque LLM percentage.

Use deterministic weighted evidence.

Example:

```text
Typosquat similarity       +20
First seen recently        +10
Multiple affected hosts    +10
Login form detected        +15
Brand impersonation        +20
Known benign allowlist     -50
No visual similarity       -10
```

Final risk:

```text
risk = clamp(sum(weights), 0, 100)
```

QVAC explains the score; QVAC does not invent the score.

Store:

```json
{
  "incident_id": "INC-2026-0007",
  "risk_score": 91,
  "classification": "credential_phishing_suspected",
  "evidence": [
    {
      "type": "brand_similarity",
      "value": 0.93,
      "source": "lexical"
    },
    {
      "type": "visual_brand_impersonation",
      "value": true,
      "source": "VisionPsy"
    },
    {
      "type": "login_form",
      "value": true,
      "source": "VisionPsy"
    }
  ]
}
```

---

# 11. SOC + NOC Correlation

This is a major differentiator.

Example:

```text
14:31 QoE = 94
14:32 DGA burst begins
14:32 NXDOMAIN rises
14:33 resolver latency rises
14:34 QoE = 67
```

Sentinel should derive:

```text
"QoE degradation is temporally correlated with abnormal DGA-like DNS volume from 3 hosts."
```

Important:

- say “correlated”
- do not claim causation unless evidence is strong
- use transparent evidence

Possible classifications:

```text
LIKELY_OPERATIONAL
LIKELY_SECURITY_DRIVEN
MIXED
UNKNOWN
```

---

# 12. Ask Sentinel — Local Analyst Interface

Stretch feature after MVP.

Example questions:

- “Why did Panama Site 01 drop below 70 QoE?”
- “Show me the top suspicious hosts in the last hour.”
- “Which incidents look like DGA?”
- “Are the NXDOMAIN spikes security-related?”
- “Explain incident INC-2026-0007.”
- “What should the analyst investigate first?”

Implementation strategy:

Do not give QVAC unrestricted database access.

Use constrained local tools/functions:

```text
get_incident(id)
get_site_qoe(site, window)
get_top_hosts(window)
get_security_summary(window)
get_qoe_breakdown(site, window)
```

QVAC calls only approved local functions.

---

# 13. Synthetic Dataset

No real customer data.

Create synthetic event streams with labeled scenarios.

## 13.1 Normal traffic

Domains such as controlled/example domains:

```text
office.example
portal.example
updates.example
cdn.example
mail.example
```

Use `.example`, `.test`, `.invalid` where appropriate.

## 13.2 DGA scenario

Generate random-looking domains.

Label:

```text
scenario = DGA
```

Desired characteristics:

- high entropy
- high NXDOMAIN
- many unique domains
- potentially periodic source behavior

## 13.3 Typosquatting scenario

Use non-live synthetic domains:

```text
micr0soft-login.test
paypa1-secure.test
g00gle-auth.test
```

Do not target real users.

## 13.4 DNS tunneling scenario

Simulate unusually long / encoded-looking subdomain labels.

Do not build a real exfiltration tool.

Generate synthetic records only.

## 13.5 Beaconing scenario

Generate repeated queries at near-regular intervals.

## 13.6 QoE degradation scenarios

- latency spike
- NXDOMAIN spike
- simulated saturation
- site-specific degradation
- mixed security + operational scenario

---

# 14. Site Baselines

A key feature.

Each site gets its own rolling baseline.

Example:

```json
{
  "site_id": "PA-PTY-01",
  "baseline": {
    "latency_p50_ms": 19.4,
    "latency_p95_ms": 42.2,
    "nxdomain_rate": 0.031,
    "query_rate_per_sec": 840
  }
}
```

Compare current window to local baseline.

Avoid global thresholds where possible.

Example anomaly:

```text
Current NXDOMAIN: 18%
Site baseline: 3.1%
Deviation: +14.9 percentage points
```

This makes the system more useful than static rules.

---

# 15. Suggested Architecture

```text
                    ┌─────────────────────┐
                    │ Synthetic dnstap /  │
                    │ normalized events   │
                    └──────────┬──────────┘
                               │
                             Vector
                               │
                             Kafka
                               │
                ┌──────────────┴───────────────┐
                │                              │
                ▼                              ▼
        Stream Feature Engine             QoE Engine
                │                              │
                ▼                              ▼
        Threat Scoring                  Site Baselines
                │                              │
                └──────────────┬───────────────┘
                               ▼
                      Incident Correlator
                               │
                     ┌─────────┴──────────┐
                     │                    │
                     ▼                    ▼
             QVAC Local Analyst    Active Investigator
                                          │
                                   ┌──────┴───────┐
                                   │              │
                                   ▼              ▼
                              Local checks   VisionPsy
                                                 │
                                             screenshot
                                                 │
                                             local only
                     ┌───────────────────────────┘
                     ▼
                Evidence Fusion
                     │
             ┌───────┴──────────┐
             ▼                  ▼
          Wazuh             ClickHouse
                                 │
                              Grafana
```

---

# 16. Recommended Technology Stack

Use the simplest stack that can be completed reliably.

## Application / Agent

Preferred:

- TypeScript / Node.js if QVAC JS SDK integration is the most stable
- Python only for components where it materially simplifies stream/statistical logic

Avoid unnecessary polyglot complexity.

## AI

- `@qvac/sdk`
- QVAC local text model
- VisionPsy if stable
- no OpenAI
- no Claude API
- no Gemini API
- no Groq
- no cloud model endpoint

## Streaming

- Kafka
- optionally Redpanda if Kafka compatibility is easier for local demo
- must still demonstrate a real event stream

## Data

- ClickHouse
- SQLite may be used for local app state if needed
- do not replace required ClickHouse output for Ovnicom demo

## SIEM

- Wazuh
- local webhook/API path
- if full Wazuh deployment becomes a blocker, build a compatible local endpoint first, then integrate real Wazuh as priority

## Visualization

- Grafana
- optional custom dashboard for Sentinel analyst UI

## Browser sandbox

- Playwright / Chromium
- local isolated execution

## Orchestration

- Docker Compose

---

# 17. Docker Compose Target

Ideal local environment:

```text
docker-compose.yml

services:
  kafka
  clickhouse
  grafana
  wazuh
  sentinel
  synthetic-dns-producer
  optional-local-phishing-demo
```

Do not spend half the hackathon fighting Wazuh if installation becomes unstable.

Fallback order:

1. core Sentinel works
2. Kafka works
3. ClickHouse works
4. Grafana works
5. Wazuh real integration
6. VisionPsy
7. Ask Sentinel
8. optional peer delegation

---

# 18. Suggested Repository Structure

```text
sovereign-sentinel/
│
├── README.md
├── LICENSE
├── docker-compose.yml
├── .env.example
│
├── docs/
│   ├── ARCHITECTURE.md
│   ├── THREAT_MODEL.md
│   ├── BENCHMARKS.md
│   ├── DEMO.md
│   ├── TRACK_MAPPING.md
│   └── ZERO_EGRESS.md
│
├── apps/
│   ├── sentinel-agent/
│   ├── analyst-ui/
│   └── synthetic-producer/
│
├── packages/
│   ├── dns-schema/
│   ├── feature-engine/
│   ├── threat-engine/
│   ├── qoe-engine/
│   ├── evidence-engine/
│   ├── qvac-runtime/
│   ├── wazuh-adapter/
│   └── clickhouse-adapter/
│
├── infra/
│   ├── grafana/
│   ├── clickhouse/
│   ├── kafka/
│   └── wazuh/
│
├── datasets/
│   ├── README.md
│   └── synthetic/
│
├── benchmarks/
│   ├── prompts/
│   ├── results/
│   └── run-benchmark.*
│
└── scripts/
    ├── bootstrap.*
    ├── demo-normal-traffic.*
    ├── demo-dga.*
    ├── demo-typosquat.*
    └── demo-qoe-degradation.*
```

For a 48-hour hackathon, simplify this if it becomes overhead.

---

# 19. Data Models

## DNS Event

```ts
type DnsEvent = {
  timestamp: string;
  siteId: string;
  zone: string;
  clientIp: string;
  resolverIp: string;
  qname: string;
  qtype: string;
  rcode: string;
  latencyMs: number;
};
```

## Threat Evidence

```ts
type ThreatEvidence = {
  type: string;
  source: "stream" | "lexical" | "behavioral" | "vision" | "baseline";
  value: unknown;
  weight: number;
  description: string;
};
```

## Incident

```ts
type Incident = {
  id: string;
  createdAt: string;
  updatedAt: string;
  siteId: string;
  sourceHosts: string[];
  domains: string[];
  classification:
    | "possible_dga"
    | "possible_tunneling"
    | "possible_beaconing"
    | "possible_typosquatting"
    | "possible_phishing"
    | "unknown";
  riskScore: number;
  confidence: number;
  evidence: ThreatEvidence[];
  qoeImpact?: {
    observed: boolean;
    correlationScore: number;
  };
  explanation?: string;
  recommendedAction?: string;
};
```

## QoE Window

```ts
type QoeWindow = {
  siteId: string;
  windowStart: string;
  windowEnd: string;
  score: number;
  latencyP50: number;
  latencyP95: number;
  nxdomainRate: number;
  failureRate: number;
  queryRate: number;
  penalties: {
    latency: number;
    nxdomain: number;
    failures: number;
    saturation: number;
  };
};
```

---

# 20. QVAC Prompting Rules

Prompts should constrain the model.

Example system instruction:

```text
You are a local DNS security analyst running inside regulated infrastructure.

You receive structured evidence produced by deterministic security and QoE engines.

Rules:
1. Never invent evidence.
2. Never claim malware is confirmed unless the structured input says confirmed.
3. Use probabilistic language for uncertain findings.
4. Explain the most important evidence first.
5. Recommend only defensive investigation steps.
6. Do not request external cloud services.
7. Output valid JSON using the required schema.
```

Response schema:

```json
{
  "summary": "",
  "likely_scenario": "",
  "confidence": "low|medium|high",
  "reasoning_evidence": [],
  "recommended_next_action": ""
}
```

Do not rely on free-form output parsing where avoidable.

---

# 21. Zero-Egress Verification

Create a visible proof page/section.

Example:

```text
SOVEREIGN MODE

QVAC runtime: LOCAL
Cloud inference endpoints: NONE
External model requests: 0
DNS events uploaded: 0
Screenshots uploaded: 0
Current model: ...
Execution device: ...
```

Technical verification ideas:

- run the core demo with WAN access disabled
- inspect container network
- log all outbound requests
- document every allowed remote/non-AI dependency
- expose local-only endpoint list
- provide architecture diagram

Never falsely claim “air-gapped” unless the demo truly is.

Use “zero cloud AI inference” / “zero-egress inference” if more accurate.

---

# 22. Track 02 Benchmark Requirements

If VisionPsy is included, collect:

```json
{
  "timestamp": "",
  "hardware": "",
  "os": "",
  "qvac_sdk_version": "",
  "model": "",
  "quantization": "",
  "task": "visual_phishing_analysis",
  "model_load_ms": 0,
  "prompt_tokens": 0,
  "completion_tokens": 0,
  "ttft_ms": 0,
  "tokens_per_second": 0,
  "total_inference_ms": 0
}
```

Also measure domain-level task quality using a small controlled evaluation set.

Example metrics:

- visual brand impersonation detection accuracy
- login-form detection accuracy
- false positives
- false negatives
- average TTFT
- average throughput

Do not invent benchmark numbers.

All final numbers must be measured on declared hardware.

---

# 23. Evaluation Dataset

Build a small reproducible labeled corpus.

Example:

```text
20 normal streams
10 DGA scenarios
10 typosquatting scenarios
10 beaconing scenarios
10 tunneling-like synthetic scenarios
10 QoE degradation scenarios
5 mixed security + QoE scenarios
```

Use manageable scope.

Metrics:

- precision
- recall
- F1 for each detector where feasible
- alert latency
- events/sec
- false positives
- QoE score stability
- QVAC inference latency

Track 02 visual subset:

- benign local mock pages
- controlled phishing-like mock pages
- varied branding/layout

---

# 24. UI / Dashboard

The custom Sentinel UI can be lightweight.

Primary screen:

```text
┌────────────────────────────────────────────────────┐
│ Sovereign Sentinel                      LOCAL ●     │
├────────────────────────────────────────────────────┤
│ Threat Level     Active Incidents     DNS QoE       │
│ HIGH             3                    71/100        │
├────────────────────────────────────────────────────┤
│ Live Incident Feed                                  │
│                                                    │
│ [91] Possible DGA       PA-PTY-01      10.20.5.17  │
│ [87] Typosquatting      BANK-02        10.31.4.22  │
├────────────────────────────────────────────────────┤
│ Investigation                                      │
│ Current confidence: 64%                            │
│ Next action: Visual verification                   │
│ VisionPsy: running locally...                      │
│ Final confidence: 96%                              │
└────────────────────────────────────────────────────┘
```

Design goals:

- clear
- dark/light not important
- professional
- security-operator aesthetic
- avoid animation-heavy UI
- evidence always visible
- local mode indicator always visible

---

# 25. Security Boundaries

Sentinel is defensive.

Do not include:

- offensive payload deployment
- real credential harvesting
- real data exfiltration
- malware
- public scanning
- unauthorized access
- real customer DNS data

Synthetic traffic only.

Any local mock phishing page must be clearly marked as synthetic in the repository.

---

# 26. Team of 4 — Recommended Division

## Developer 1 — Streaming + Threat Engine

Owns:

- Kafka consumer
- DNS schema
- feature extraction
- DGA/tunneling/beaconing/typosquatting scores
- synthetic event producer

## Developer 2 — QVAC + VisionPsy + Evidence Engine

Owns:

- QVAC SDK
- local model setup
- prompt schemas
- incident explanation
- active investigation
- VisionPsy flow
- benchmarks

## Developer 3 — Data + QoE + Integrations

Owns:

- QoE algorithm
- site baselines
- ClickHouse
- Grafana
- Wazuh adapter
- SOC/NOC correlation

## Developer 4 — Frontend + Integration + Demo

Owns:

- Sentinel UI
- end-to-end integration support
- demo controls
- README coordination
- track mapping
- video recording/editing
- final submission validation

Everyone codes.

After approximately the final 8 hours, Developer 4 prioritizes completion/demo over new features.

---

# 27. Git Workflow

Suggested:

```text
main
dev
feature/stream-engine
feature/qvac
feature/qoe
feature/ui
```

Rules:

- `main` must always be demoable after MVP integration
- merge frequently
- avoid giant PRs
- one owner per task
- no final-hour mega merge
- each merged feature must have a minimal test/demo

---

# 28. 48-Hour Plan

## Hours 0–2

Goal:

- repo created
- responsibilities assigned
- exact stack locked
- QVAC hello-world verified
- Kafka event visible
- Docker Compose skeleton running

**Kill ambiguity quickly.**

## Hours 2–6

Goal:

```text
synthetic producer → Kafka → Sentinel consumer
```

and:

```text
event → feature extraction → initial risk score
```

Also:

```text
QoE window → score
```

## Hours 6–12

Goal:

- DGA detection
- typosquatting detection
- beaconing indicators
- tunneling indicators
- ClickHouse writes
- basic Grafana
- basic Wazuh alert
- QVAC structured explanation

At hour 12, a crude end-to-end demo must exist.

## Hours 12–20

Goal:

- improve detectors
- per-site baselines
- explainable scoring
- SOC/NOC correlation
- polished Wazuh event
- better Grafana
- Sentinel analyst UI

## Hours 20–28

Goal:

- Active Evidence Acquisition
- safe local browser
- VisionPsy integration
- evidence fusion

If VisionPsy becomes unstable for more than a reasonable debugging window, reduce scope.

## Hours 28–34

Goal:

- Ask Sentinel
- Track 05 banking positioning
- benchmarks
- performance logs
- evaluation dataset
- false-positive tuning

## Hours 34–40

**Feature freeze.**

Goal:

- integration
- testing
- edge cases
- setup reproducibility
- zero-egress verification
- README

No major new features after this point.

## Hours 40–44

Goal:

- rehearse demo
- record benchmark values
- capture clean screenshots
- prepare video script
- make repo reproducible

## Hours 44–47

Goal:

- record and edit final video
- final README
- verify all links
- verify repo access
- verify license if Track 02

## Hour 47–48

Submission buffer.

Do not use the final hour for feature development.

Submit early if possible.

---

# 29. Demo Script — 5 Minutes

## 0:00–0:25 — Problem

Explain:

- DNS is extremely sensitive
- regulated organizations cannot safely send it to cloud AI
- existing SOC and NOC tools create fragmented views

## 0:25–0:45 — Product

> “Sovereign Sentinel is an AI analyst that detects, investigates and explains DNS incidents entirely inside the infrastructure.”

Show architecture quickly.

## 0:45–1:30 — Normal State

Show:

- Kafka stream running
- Grafana QoE healthy
- Sentinel LOCAL indicator
- Wazuh quiet

## 1:30–2:10 — DGA / Beacon Scenario

Run synthetic scenario.

Show:

- live detection
- evidence
- alert
- Wazuh receives it
- QoE begins changing

## 2:10–3:10 — Active Visual Investigation

Trigger synthetic typosquat.

Show:

```text
Initial risk: 64%
Next best action: visual verification
```

Local browser captures mock site.

VisionPsy analyzes locally.

Show:

```text
Brand impersonation detected
Credential form detected
Risk: 96%
```

Wazuh receives updated alert.

## 3:10–3:50 — SOC + NOC

Show QoE degradation.

Ask/explain:

> “Why did Site 01 degrade?”

Sentinel correlates security burst + DNS metrics.

## 3:50–4:25 — Zero-Egress

Disable WAN if safe for the demo or show outbound log.

Explain:

- QVAC local
- VisionPsy local
- no cloud AI
- telemetry remains inside

Continue one inference.

## 4:25–4:50 — Banking Use Case

Explain:

- same architecture inside a bank
- phishing / typosquatting
- C2/DGA
- local analyst
- sensitive telemetry never leaves

## 4:50–5:00 — Closing

> “Cloud AI asks regulated organizations to move sensitive data toward intelligence. Sovereign Sentinel brings intelligence to the data.”

---

# 30. Judging Optimization

## Technical — 35%

Demonstrate:

- real stream
- QVAC genuine inference
- local-only execution
- Wazuh integration
- ClickHouse
- Grafana
- measurable performance
- explainable detection
- optional VisionPsy
- reproducible environment

## Innovation — 25%

Lead with:

- Active Evidence Acquisition
- evidence fusion
- SOC/NOC correlation
- local visual investigation
- per-site baseline
- sovereign zero-egress design

Do not claim “first ever”.

Say:

> “Our differentiator is not another DNS classifier. It is an autonomous local investigation loop that chooses the next evidence needed to reduce uncertainty.”

## Impact — 20%

Target:

- banking
- government
- healthcare
- regulated datacenters
- managed security providers

## Design — 10%

Show:

- low cognitive load
- evidence-first alerts
- interpretable QoE
- clear local-mode proof

## Completion — 10%

A smaller complete system beats a huge broken architecture.

---

# 31. MVP vs Stretch Goals

## Must Have

- Kafka stream
- threat scoring
- QVAC local explanation
- DGA
- typosquatting
- tunneling indicators
- beaconing indicators
- Wazuh output
- QoE scoring
- ClickHouse
- Grafana
- zero-egress proof
- polished 5-minute video

## Strong Should Have

- site baselines
- SOC/NOC correlation
- Active Evidence Acquisition
- custom Sentinel UI
- reproducible benchmarks

## Stretch

- VisionPsy
- local sandbox investigation
- Ask Sentinel
- QVAC/Pear peer delegation
- sophisticated correlation graph
- multi-site simulation

Do not sacrifice Must Have to finish Stretch.

---

# 32. Failure / Fallback Plan

## If VisionPsy fails

Ship Track 04 + 05 + General strongly.

Do not fake Track 02.

## If Wazuh deployment fails

Maintain a Wazuh-compatible local JSON/webhook adapter, continue debugging actual Wazuh, and clearly disclose demo scope.

Actual Wazuh integration remains high priority because Ovnicom explicitly asks for it.

## If ClickHouse/Grafana fails

Fix before adding new AI features.

These are core Track 04 requirements.

## If QVAC text inference is slow

- reduce prompt size
- feed aggregated evidence, not raw event streams
- choose appropriate small model/quantization
- cache static instructions
- invoke only on incidents, not every event

## If Kafka becomes unstable

Use the simplest Kafka-compatible local setup possible, but final demo must still be a stream, not static file replay masquerading as a stream.

---

# 33. README Requirements

README must include:

1. Project description
2. Problem
3. Tracks targeted
4. Architecture
5. QVAC usage
6. Exact models
7. Exact quantizations
8. Hardware
9. Setup
10. Run instructions
11. Demo scenarios
12. Zero-egress explanation
13. Data sources
14. Synthetic data declaration
15. Remote API disclosure
16. Third-party components
17. Pre-existing code/base declaration
18. Benchmarks
19. Limitations
20. Safety statement
21. License

Critical hackathon rule:

> Any pre-existing base must be declared.

Do not omit templates/libraries/codebases that existed before the build window.

---

# 34. Licensing

General hackathon does not require an open license.

Track 02 Psy requires permissive open source.

If targeting Track 02, choose a permissive license after verifying it is acceptable.

Likely candidates:

- MIT
- Apache-2.0

Do not decide purely from this document; verify the track requirements before final submission.

---

# 35. Known Limitations to State Honestly

- synthetic DNS data only
- not a replacement for enterprise threat intelligence
- risk scores are investigation prioritization, not proof of compromise
- visual phishing analysis can produce false positives
- DNS encryption / DoH may limit visibility depending on deployment
- QoE causality cannot always be proven
- model quality depends on hardware / quantization
- site baselines require sufficient observation history
- sandbox rendering of arbitrary sites requires careful containment in real deployment

Honesty improves credibility.

---

# 36. Product Evolution After Hackathon

Potential product directions:

## Managed Security Appliance

Local appliance deployed at customer datacenter.

## Bank Sovereign SOC Copilot

Local analyst for:

- DNS
- proxy
- firewall
- EDR summaries
- SIEM incidents

## MSSP Multi-Customer Deployment

Each customer keeps a local inference node.

No cross-customer telemetry leakage.

## Branch Edge Nodes

Small local models at branches / sites.

Heavy inference optionally delegated to larger trusted on-prem peers.

---

# 37. Final Project Positioning

Do not pitch:

> “We made an AI that detects bad domains.”

Pitch:

> **“We built a sovereign investigation layer for regulated DNS infrastructure.”**

Do not pitch:

> “The LLM decides whether traffic is malicious.”

Pitch:

> **“Deterministic engines produce measurable evidence; QVAC reasons over that evidence locally, and VisionPsy can acquire additional visual evidence when uncertainty remains.”**

Do not pitch:

> “AI replaces SOC analysts.”

Pitch:

> **“Sentinel reduces investigation time while keeping the analyst in control.”**

---

# 38. Definition of Done

The project is considered hackathon-ready only when all are true:

- [ ] Live/simulated DNS events are streamed through Kafka
- [ ] Sentinel consumes the stream continuously
- [ ] At least four requested threat patterns can be demonstrated
- [ ] QVAC performs real local inference
- [ ] No cloud AI endpoint is used
- [ ] Wazuh receives an alert
- [ ] QoE is calculated per site/zone
- [ ] QoE is stored in ClickHouse
- [ ] Grafana displays QoE
- [ ] At least one mixed security/QoE scenario works
- [ ] Zero-egress behavior is documented and demonstrated
- [ ] Repository is reproducible
- [ ] Pre-existing base is declared
- [ ] Video is under five minutes
- [ ] Submission links work without credentials required by the jury
- [ ] Track 02 requirements are satisfied if Track 02 is claimed
- [ ] Banking applicability is explicitly demonstrated if Track 05 is claimed

---

# 39. Instructions for Astra / Codex / Any Coding Agent

Read this entire file before modifying the repository.

## First task

**Do not write production code immediately.**

First:

1. Inspect the repository.
2. Verify the current build window rules and constraints stated here.
3. Identify missing technical information.
4. Validate QVAC SDK feasibility on the current machine.
5. Propose the simplest architecture that satisfies the Must Have requirements.
6. Produce a concrete implementation plan for four developers.
7. Identify the top five technical risks.
8. Identify which tasks can run in parallel.
9. Define the minimum end-to-end vertical slice.
10. Only after this analysis, begin implementation.

## Hard constraints

Never introduce:

- OpenAI API
- Claude API
- Gemini API
- Groq
- Together
- OpenRouter
- any remote inference endpoint
- cloud embeddings
- remote visual inference

Do not silently substitute QVAC with another AI provider.

Do not remove:

- Kafka streaming requirement
- Wazuh integration target
- ClickHouse output
- Grafana QoE dashboard
- local QVAC inference

## Engineering priorities

Use this order:

```text
1. End-to-end correctness
2. Local QVAC inference
3. Track 04 requirements
4. Stability
5. Explainability
6. Demo quality
7. Track 05 positioning
8. Track 02 VisionPsy
9. Extra features
```

## Vertical slice objective

The first integrated milestone should be:

```text
Synthetic DNS event
→ Kafka
→ Sentinel
→ feature extraction
→ suspicious classification
→ QVAC local explanation
→ Wazuh-compatible alert
```

Then add:

```text
QoE
→ ClickHouse
→ Grafana
```

Then:

```text
Active investigation
→ VisionPsy
```

## Code quality

- keep components modular
- use typed schemas
- validate all structured model output
- log failures
- make demo scripts deterministic
- avoid hidden magic
- document every major architectural choice
- prefer boring reliable code over overengineered abstractions
- do not rewrite working modules without a concrete reason

---

# 40. Prompt to Give Astra Medium

Copy/paste this:

```text
Read SOVEREIGN_SENTINEL_SPEC.md completely before doing anything.

We are building this project for a 48-hour hackathon with four developers. The specification is the source of truth.

Your first role is Principal Architect, not code generator.

Do NOT write implementation code yet.

1. Audit the spec for technical feasibility.
2. Check the current repository and environment.
3. Propose the minimum architecture that can satisfy all Must Have requirements.
4. Identify the five largest implementation risks, especially QVAC, Kafka, Wazuh, ClickHouse/Grafana and VisionPsy.
5. Define the first end-to-end vertical slice.
6. Divide the work into parallel tasks for four developers with clear file/module ownership to minimize merge conflicts.
7. Produce a milestone plan for the remaining hackathon time.
8. Explicitly separate MVP features from stretch goals.
9. Ensure no AI inference uses a cloud API.
10. Do not assume VisionPsy works until it is tested locally.
11. Do not claim Track 02 until all of its additional benchmark/open-source requirements can be satisfied.
12. Preserve real streaming: the final solution must consume an event stream, not only static files.
13. Preserve Wazuh, ClickHouse and Grafana as Track 04 requirements.
14. Keep risk scores deterministic/explainable; QVAC should explain evidence rather than invent evidence or opaque scores.

After presenting the architecture and plan, wait for our approval before implementing.
```

---

# 41. Final Reminder

The project should feel like one coherent product, not four hackathon tracks glued together.

The story is:

```text
Regulated infrastructure generates sensitive DNS telemetry.
        ↓
The telemetry cannot go to cloud AI.
        ↓
Sentinel analyzes it locally.
        ↓
It detects both security and quality issues.
        ↓
When uncertain, it chooses the next evidence worth collecting.
        ↓
It can use VisionPsy locally for visual investigation.
        ↓
It explains the incident to the operator.
        ↓
It sends security findings to Wazuh.
        ↓
It sends QoE metrics to ClickHouse/Grafana.
        ↓
Nothing sensitive leaves the trusted infrastructure.
```

That is the product.
