/** Seeded PRNG (mulberry32) so every mining run is reproducible (seed 42). */
export const SEED = 42;
export function rng(seed = SEED) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a;
}
export class MiningError extends Error {}
export const DISCLAIMER = 'Statistical pattern in synthetic data for academic use. Not a medical finding, diagnosis or recommendation.';
export const round = (x: number, d = 2) => Math.round(x * 10 ** d) / 10 ** d;
