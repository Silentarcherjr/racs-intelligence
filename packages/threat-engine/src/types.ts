import type { Classification, ThreatEvidence } from "@sentinel/dns-schema";

/**
 * What a detector returns before correlation.
 *
 * Detectors never assign a final risk score — they only state what they found
 * and how much it is worth. Aggregation happens once, in `score.ts`, so the
 * arithmetic behind a number is always in one place (spec §5, principle 3).
 */
export type Detection = {
  classification: Classification;
  siteId: string;
  sourceHosts: string[];
  domains: string[];
  evidence: ThreatEvidence[];
};

/** Tunable thresholds. Defaults are calibrated against the committed fixture. */
export type DetectorConfig = {
  dga: {
    minUniqueDomains: number;
    minNxdomainRate: number;
    minEntropy: number;
    maxVowelRatio: number;
  };
  typosquat: {
    brands: string[];
    maxEditDistance: number;
  };
  tunneling: {
    minSubdomainLength: number;
    minPayloadQtypeRatio: number;
    minQueries: number;
  };
  beaconing: {
    minQueries: number;
    maxIntervalCv: number;
    minIntervalSec: number;
    maxIntervalSec: number;
  };
};

/**
 * Brands worth protecting. In a real deployment this comes from the customer —
 * a bank cares about its own name and its payment processors, not ours.
 */
export const DEFAULT_BRANDS = [
  "microsoft", "apple", "google", "github", "cloudflare",
  "banesco", "bancogeneral", "caja", "office365", "outlook",
];

export const DEFAULT_CONFIG: DetectorConfig = {
  dga: {
    minUniqueDomains: 5,
    minNxdomainRate: 0.5,
    minEntropy: 3.2,
    maxVowelRatio: 0.35,
  },
  typosquat: { brands: DEFAULT_BRANDS, maxEditDistance: 2 },
  tunneling: { minSubdomainLength: 25, minPayloadQtypeRatio: 0.5, minQueries: 4 },
  beaconing: {
    minQueries: 4,
    maxIntervalCv: 0.2,
    minIntervalSec: 10,
    maxIntervalSec: 3600,
  },
};
