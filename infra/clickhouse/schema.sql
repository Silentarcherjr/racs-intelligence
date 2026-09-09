-- Sovereign Sentinel — ClickHouse schema (spec §7 MVP-6).
--
-- Apply with:
--   curl --data-binary @infra/clickhouse/schema.sql http://127.0.0.1:8123/
--
-- Everything is keyed by (site, time) because every question an operator asks
-- starts with "which site, and when".

CREATE DATABASE IF NOT EXISTS sentinel;

-- Raw telemetry. Opt-in: the agent writes this only with --store-events, since
-- at production DNS volume this table dwarfs everything else.
CREATE TABLE IF NOT EXISTS sentinel.dns_events
(
    timestamp   DateTime64(3),
    site_id     LowCardinality(String),
    zone        LowCardinality(String),
    client_ip   String,
    resolver_ip String,
    qname       String,
    qtype       LowCardinality(String),
    rcode       LowCardinality(String),
    latency_ms  Float32
)
ENGINE = MergeTree
PARTITION BY toYYYYMMDD(timestamp)
ORDER BY (site_id, timestamp)
TTL toDateTime(timestamp) + INTERVAL 7 DAY;

-- QoE per site per window. This is what Grafana reads.
CREATE TABLE IF NOT EXISTS sentinel.dns_qoe_windows
(
    site_id             LowCardinality(String),
    window_start        DateTime64(3),
    window_end          DateTime64(3),
    score               UInt8,
    grade               LowCardinality(String),
    latency_p50         Float32,
    latency_p95         Float32,
    nxdomain_rate       Float32,
    failure_rate        Float32,
    query_rate          Float32,
    penalty_latency     UInt8,
    penalty_nxdomain    UInt8,
    penalty_failures    UInt8,
    penalty_saturation  UInt8,
    -- The operator-facing reason the score is what it is. Stored, not derived,
    -- so a dashboard can show the explanation next to the number.
    explanation         Array(String),
    used_baseline       UInt8,
    -- The agent re-analyses its sliding window every few seconds, so the same
    -- (site, window_end) is written repeatedly. ReplacingMergeTree collapses
    -- them; plain MergeTree would make every Grafana panel count duplicates.
    written_at          DateTime64(3) DEFAULT now64(3)
)
ENGINE = ReplacingMergeTree(written_at)
PARTITION BY toYYYYMMDD(window_end)
ORDER BY (site_id, window_end);

-- Security findings. Evidence travels with the incident: a score without its
-- evidence is not reviewable.
CREATE TABLE IF NOT EXISTS sentinel.dns_incidents
(
    incident_id          String,
    created_at           DateTime64(3),
    updated_at           DateTime64(3),
    site_id              LowCardinality(String),
    classification       LowCardinality(String),
    risk_score           UInt8,
    confidence           Float32,
    source_hosts         Array(String),
    domains              Array(String),
    evidence_types       Array(String),
    evidence_weights     Array(UInt8),
    evidence_descriptions Array(String),
    explanation          String,
    recommended_action   String,
    -- Always 'local'. Written on every row so the zero-egress claim is
    -- auditable from the data itself, not just from the README.
    analysis_location    LowCardinality(String) DEFAULT 'local'
)
ENGINE = ReplacingMergeTree(updated_at)
PARTITION BY toYYYYMMDD(created_at)
ORDER BY (site_id, incident_id);

-- Rolling per-site baselines (spec §14).
CREATE TABLE IF NOT EXISTS sentinel.dns_site_baselines
(
    site_id             LowCardinality(String),
    observed_at         DateTime64(3),
    latency_p50_ms      Float32,
    latency_p95_ms      Float32,
    nxdomain_rate       Float32,
    failure_rate        Float32,
    query_rate_per_sec  Float32,
    samples             UInt32
)
ENGINE = ReplacingMergeTree(observed_at)
PARTITION BY toYYYYMMDD(observed_at)
ORDER BY (site_id, observed_at);

-- SOC ↔ NOC attribution (spec §11). The verdict is always a correlation,
-- never a causal claim — see packages/qoe-engine/src/correlate.ts.
CREATE TABLE IF NOT EXISTS sentinel.dns_correlations
(
    site_id              LowCardinality(String),
    window_end           DateTime64(3),
    qoe_score            UInt8,
    verdict              LowCardinality(String),
    correlation_score    Float32,
    reasoning            Array(String),
    related_incident_ids Array(String),
    written_at           DateTime64(3) DEFAULT now64(3)
)
ENGINE = ReplacingMergeTree(written_at)
PARTITION BY toYYYYMMDD(window_end)
ORDER BY (site_id, window_end);
