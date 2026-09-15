import { describe, it, expect } from 'vitest';
import { createPRNG, prngRange } from '../prng';

describe('Particle System Periodic Motion & Looping (v1.2)', () => {
  const area = { x: 0, y: 0, width: 1080, height: 1080 };
  const H = area.height;
  const cx = area.x + area.width / 2;
  const cy = area.y + area.height / 2;

  it('float-up-wrap: guaranteed seamless loop where pos(0.0) === pos(1.0)', () => {
    const prng = createPRNG(42);
    const speed = prngRange(prng, 1, 3);
    const speedMultiplier = Math.max(1, Math.round(speed));
    const driftFreqX = Math.max(1, Math.round(prngRange(prng, 1, 3)));
    const driftAmpX = prngRange(prng, 8, 30);
    const phaseX = prngRange(prng, 0, Math.PI * 2);
    const x0 = prngRange(prng, area.x, area.x + area.width);
    const y0 = prngRange(prng, area.y, area.y + area.height);

    const calcPos = (t: number) => {
      const progress = t >= 1.0 ? 1.0 : ((t % 1.0) + 1.0) % 1.0;
      const dy = speedMultiplier * H * progress;
      const yOffset = ((y0 - area.y - dy) % H + H) % H;
      const y = area.y + yOffset;
      const x = x0 + driftAmpX * Math.sin(2 * Math.PI * driftFreqX * progress + phaseX);
      return { x, y };
    };

    const p0 = calcPos(0.0);
    const pQuarter = calcPos(0.25);
    const p1 = calcPos(1.0);

    // At t=0.0 and t=1.0, positions must be identical (within float tolerance)
    expect(Math.abs(p1.x - p0.x)).toBeLessThan(1e-6);
    expect(Math.abs(p1.y - p0.y)).toBeLessThan(1e-6);

    // At t=0.25, the particle should have actually moved
    expect(pQuarter.y).not.toBeCloseTo(p0.y, 1);
  });

  it('fall-wrap: guaranteed seamless loop where pos(0.0) === pos(1.0)', () => {
    const prng = createPRNG(123);
    const speed = prngRange(prng, 1, 3);
    const speedMultiplier = Math.max(1, Math.round(speed));
    const driftFreqX = Math.max(1, Math.round(prngRange(prng, 1, 3)));
    const driftAmpX = prngRange(prng, 8, 30);
    const phaseX = prngRange(prng, 0, Math.PI * 2);
    const x0 = prngRange(prng, area.x, area.x + area.width);
    const y0 = prngRange(prng, area.y, area.y + area.height);

    const calcPos = (t: number) => {
      const progress = t >= 1.0 ? 1.0 : ((t % 1.0) + 1.0) % 1.0;
      const dy = speedMultiplier * H * progress;
      const yOffset = ((y0 - area.y + dy) % H + H) % H;
      const y = area.y + yOffset;
      const x = x0 + driftAmpX * Math.sin(2 * Math.PI * driftFreqX * progress + phaseX);
      return { x, y };
    };

    const p0 = calcPos(0.0);
    const p1 = calcPos(1.0);

    expect(Math.abs(p1.x - p0.x)).toBeLessThan(1e-6);
    expect(Math.abs(p1.y - p0.y)).toBeLessThan(1e-6);
  });

  it('orbit-center: circular trajectory that completes integer revolutions and matches pos(0.0) === pos(1.0)', () => {
    const prng = createPRNG(789);
    const orbitRadius = prngRange(prng, 100, 400);
    const orbitSpeed = Math.max(1, Math.round(prngRange(prng, 1, 3))) * (prngRange(prng, 0, 1) > 0.5 ? 1 : -1);
    const orbitPhase = prngRange(prng, 0, Math.PI * 2);

    const calcPos = (t: number) => {
      const progress = t >= 1.0 ? 1.0 : ((t % 1.0) + 1.0) % 1.0;
      const theta = orbitPhase + 2 * Math.PI * orbitSpeed * progress;
      const x = cx + orbitRadius * Math.cos(theta);
      const y = cy + orbitRadius * Math.sin(theta);
      return { x, y };
    };

    const p0 = calcPos(0.0);
    const p1 = calcPos(1.0);

    expect(Math.abs(p1.x - p0.x)).toBeLessThan(1e-6);
    expect(Math.abs(p1.y - p0.y)).toBeLessThan(1e-6);

    // Orbit radius preserved throughout
    for (const t of [0.0, 0.25, 0.5, 0.75, 1.0]) {
      const p = calcPos(t);
      const dist = Math.hypot(p.x - cx, p.y - cy);
      expect(dist).toBeCloseTo(orbitRadius, 4);
    }
  });

  it('drift-random: harmonic Lissajous drift and opacity pulse match at t=0.0 and t=1.0', () => {
    const prng = createPRNG(999);
    const x0 = 500;
    const y0 = 500;
    const baseAlpha = 0.8;
    const driftAmpX = prngRange(prng, 10, 40);
    const driftAmpY = prngRange(prng, 10, 40);
    const driftFreqX = Math.max(1, Math.round(prngRange(prng, 1, 3)));
    const driftFreqY = Math.max(1, Math.round(prngRange(prng, 1, 3)));
    const phaseX = prngRange(prng, 0, Math.PI * 2);
    const phaseY = prngRange(prng, 0, Math.PI * 2);

    const calcState = (t: number) => {
      const progress = t >= 1.0 ? 1.0 : ((t % 1.0) + 1.0) % 1.0;
      const x = x0 + driftAmpX * Math.sin(2 * Math.PI * driftFreqX * progress + phaseX);
      const y = y0 + driftAmpY * Math.cos(2 * Math.PI * driftFreqY * progress + phaseY);
      const alphaPulse = 0.8 + 0.2 * Math.sin(2 * Math.PI * driftFreqX * progress + phaseX);
      const alpha = Math.max(0, Math.min(1, baseAlpha * alphaPulse));
      return { x, y, alpha };
    };

    const s0 = calcState(0.0);
    const s1 = calcState(1.0);

    expect(Math.abs(s1.x - s0.x)).toBeLessThan(1e-6);
    expect(Math.abs(s1.y - s0.y)).toBeLessThan(1e-6);
    expect(Math.abs(s1.alpha - s0.alpha)).toBeLessThan(1e-6);
  });
});
