/**
 * Deterministic PRNG using Mulberry32 algorithm.
 *
 * Guaranteed to generate the exact same sequence of pseudo-random numbers
 * in [0, 1) for a given integer seed across all JavaScript environments.
 * Used for deterministic procedural particle system rendering.
 */
export function createPRNG(seed: number): () => number {
  let s = Math.floor(seed) | 0;

  return function next(): number {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generate a random number between min and max (inclusive of min, exclusive of max).
 */
export function prngRange(prng: () => number, min: number, max: number): number {
  return min + (max - min) * prng();
}

/**
 * Pick a random element from an array using a PRNG.
 */
export function prngChoice<T>(prng: () => number, array: readonly T[]): T {
  const index = Math.floor(prng() * array.length);
  return array[Math.min(index, array.length - 1)] as T;
}
