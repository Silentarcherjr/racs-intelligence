/**
 * Lexical features of a domain name.
 *
 * Every function here is pure and deterministic: same input, same number, no
 * clock, no network, no model. That is what lets the risk score be explained to
 * an auditor (spec §5, principle 3).
 */

/** Public suffixes we care about for the synthetic dataset. Not a full PSL. */
const KNOWN_SUFFIXES = [
  "com.pa", "gob.pa", "net.pa", "org.pa",
  "co.uk", "com.br", "com.mx",
];

/** Splits a qname into its labels, dropping a trailing dot. */
export function labels(qname: string): string[] {
  return qname.replace(/\.$/, "").toLowerCase().split(".").filter(Boolean);
}

/**
 * The registrable part of a name — roughly "the bit someone bought".
 *
 * `login.micr0soft-secure.example` → `micr0soft-secure`
 * `api.banesco.com.pa`             → `banesco`
 */
export function registrableLabel(qname: string): string {
  const ls = labels(qname);
  if (ls.length === 0) return "";
  const tail2 = ls.slice(-2).join(".");
  // Two-part public suffix (com.pa): the registrable label sits one further left.
  if (KNOWN_SUFFIXES.includes(tail2)) return ls[ls.length - 3] ?? "";
  return ls[ls.length - 2] ?? ls[0] ?? "";
}

/** Shannon entropy over the characters of `s`, in bits per character. */
export function entropy(s: string): number {
  if (s.length === 0) return 0;
  const counts = new Map<string, number>();
  for (const ch of s) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  let h = 0;
  for (const n of counts.values()) {
    const p = n / s.length;
    h -= p * Math.log2(p);
  }
  return h;
}

/** Fraction of characters that are digits, 0–1. */
export function digitRatio(s: string): number {
  if (s.length === 0) return 0;
  let d = 0;
  for (const ch of s) if (ch >= "0" && ch <= "9") d++;
  return d / s.length;
}

/** Fraction of alphabetic characters that are vowels, 0–1. */
export function vowelRatio(s: string): number {
  const alpha = s.replace(/[^a-z]/gi, "");
  if (alpha.length === 0) return 0;
  const v = alpha.match(/[aeiou]/gi)?.length ?? 0;
  return v / alpha.length;
}

/** Length of the longest run of consecutive consonants. */
export function longestConsonantRun(s: string): number {
  let best = 0;
  let cur = 0;
  for (const ch of s.toLowerCase()) {
    if (ch >= "a" && ch <= "z" && !"aeiou".includes(ch)) {
      cur++;
      if (cur > best) best = cur;
    } else {
      cur = 0;
    }
  }
  return best;
}

/** Lexical fingerprint of one domain name. */
export type LexicalFeatures = {
  qname: string;
  registrable: string;
  length: number;
  labelCount: number;
  maxLabelLength: number;
  entropy: number;
  digitRatio: number;
  vowelRatio: number;
  longestConsonantRun: number;
};

export function lexicalFeatures(qname: string): LexicalFeatures {
  const ls = labels(qname);
  const reg = registrableLabel(qname);
  return {
    qname,
    registrable: reg,
    length: qname.length,
    labelCount: ls.length,
    maxLabelLength: ls.reduce((m, l) => Math.max(m, l.length), 0),
    entropy: entropy(reg),
    digitRatio: digitRatio(reg),
    vowelRatio: vowelRatio(reg),
    longestConsonantRun: longestConsonantRun(reg),
  };
}
