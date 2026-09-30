/**
 * Deterministic PRNG using Mulberry32 (sequential) and SplitMix32 (seeded hash).
 *
 * Guaranteed to generate the exact same sequence or seeded values of pseudo-random numbers
 * in [0, 1) across all JavaScript environments.
 *
 * Supports both:
 * 1. Sequential calls: opts.random() -> advances deterministic PRNG stream.
 * 2. Seeded calls: opts.random(seed) -> stateless deterministic hash for specific seed
 *    (supports integer seeds, large numbers like k * 100 + armIndex, string seeds, etc.).
 */
export function createPRNG(initialSeed: number = 1337): (specificSeed?: number | string | unknown) => number {
  let s = Math.floor(initialSeed) | 0;

  return function next(specificSeed?: number | string | unknown): number {
    let numericSeed: number | null = null;

    if (typeof specificSeed === 'number' && Number.isFinite(specificSeed)) {
      numericSeed = Math.floor(specificSeed) | 0;
    } else if (typeof specificSeed === 'string') {
      // Deterministic string hash (FNV-1a style)
      let hash = 0x811c9dc5;
      for (let i = 0; i < specificSeed.length; i++) {
        hash ^= specificSeed.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
      }
      numericSeed = hash | 0;
    } else if (typeof specificSeed === 'bigint') {
      numericSeed = Number(specificSeed & BigInt(0xffffffff)) | 0;
    }

    if (numericSeed !== null) {
      // Splitmix32-style state-of-the-art 32-bit mixing for seeded random (e.g. opts.random(seed))
      // Ensures high entropy, strong avalanche effect, and full [0, 1) coverage across all seed magnitudes
      let z = (numericSeed + (initialSeed | 0) + 0x9e3779b9) | 0;
      z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
      z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
      return ((z ^ (z >>> 16)) >>> 0) / 4294967296;
    }

    // Default sequential Mulberry32 PRNG stream
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
