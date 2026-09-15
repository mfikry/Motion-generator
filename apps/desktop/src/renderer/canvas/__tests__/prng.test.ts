import { describe, it, expect } from 'vitest';
import { createPRNG, prngRange, prngChoice } from '../prng';

describe('Deterministic PRNG (Mulberry32) - @genc/desktop/canvas/prng', () => {
  it('generates identical sequence of numbers for the same seed', () => {
    const prng1 = createPRNG(12345);
    const prng2 = createPRNG(12345);

    const seq1 = Array.from({ length: 10 }, () => prng1());
    const seq2 = Array.from({ length: 10 }, () => prng2());

    expect(seq1).toEqual(seq2);
    expect(seq1.every((n) => n >= 0 && n < 1)).toBe(true);
  });

  it('generates different sequences for different seeds', () => {
    const prng1 = createPRNG(42);
    const prng2 = createPRNG(999);

    const seq1 = Array.from({ length: 10 }, () => prng1());
    const seq2 = Array.from({ length: 10 }, () => prng2());

    expect(seq1).not.toEqual(seq2);
  });

  it('scales numbers within range [min, max]', () => {
    const prng = createPRNG(777);
    for (let i = 0; i < 50; i++) {
      const val = prngRange(prng, 10, 50);
      expect(val).toBeGreaterThanOrEqual(10);
      expect(val).toBeLessThan(50);
    }
  });

  it('selects valid items from array via prngChoice', () => {
    const prng = createPRNG(888);
    const palette = ['#FF0000', '#00FF00', '#0000FF'];
    const counts = new Map<string, number>();

    for (let i = 0; i < 60; i++) {
      const choice = prngChoice(prng, palette);
      expect(palette).toContain(choice);
      counts.set(choice, (counts.get(choice) ?? 0) + 1);
    }

    // All choices should be sampled
    expect(counts.size).toBe(palette.length);
  });
});
