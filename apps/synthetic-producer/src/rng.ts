/**
 * Seeded RNG — mulberry32.
 *
 * Demos must be reproducible (AGENTS.md §7). `Math.random()` would make every
 * run of the demo tell a slightly different story, which is exactly what you do
 * not want with five minutes and a jury watching.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rng = () => number;

export const pick = <T>(rng: Rng, xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)]!;
export const between = (rng: Rng, lo: number, hi: number): number => lo + rng() * (hi - lo);
export const intBetween = (rng: Rng, lo: number, hi: number): number =>
  Math.floor(between(rng, lo, hi + 1));
