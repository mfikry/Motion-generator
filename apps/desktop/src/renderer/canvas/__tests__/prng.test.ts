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

  it('generates consistent deterministic values when called with a specific seed', () => {
    const prng = createPRNG(1337);
    const valA1 = prng(42);
    prng(); // advance sequential state
    prng();
    const valA2 = prng(42);
    const valB = prng(999);

    expect(valA1).toBe(valA2);
    expect(valA1).not.toBe(valB);
    expect(valA1).toBeGreaterThanOrEqual(0);
    expect(valA1).toBeLessThan(1);
  });

  it('safely handles large seeds, negative seeds, floats, and string seeds', () => {
    const prng = createPRNG(1337);

    // Large numbers like k * 100 + armIndex in galaxy spiral particles
    const largeSeedVal1 = prng(14000);
    const largeSeedVal2 = prng(14000);
    expect(largeSeedVal1).toBe(largeSeedVal2);
    expect(largeSeedVal1).toBeGreaterThanOrEqual(0);
    expect(largeSeedVal1).toBeLessThan(1);

    // Negative seed
    const negSeed = prng(-9999);
    expect(negSeed).toBeGreaterThanOrEqual(0);
    expect(negSeed).toBeLessThan(1);

    // Float seed
    const floatSeed1 = prng(3.14159);
    const floatSeed2 = prng(3.14159);
    expect(floatSeed1).toBe(floatSeed2);

    // Zero seed
    const zeroSeed = prng(0);
    expect(zeroSeed).toBeGreaterThanOrEqual(0);
    expect(zeroSeed).toBeLessThan(1);

    // String seeds (e.g. opts.random('star_1'))
    const strSeed1 = prng('arm_0_particle_5');
    const strSeed2 = prng('arm_0_particle_5');
    const strSeedOther = prng('arm_1_particle_5');
    expect(strSeed1).toBe(strSeed2);
    expect(strSeed1).not.toBe(strSeedOther);
    expect(strSeed1).toBeGreaterThanOrEqual(0);
    expect(strSeed1).toBeLessThan(1);
  });
});
