import { describe, it, expect } from 'vitest';
import { ease, interpolateNumber, hexToNumber, interpolateColor } from '../easing';
import type { EasingFunction } from '@genc/motion-schema';

describe('Easing & Interpolation Utilities (@genc/desktop/canvas/easing)', () => {
  const allEasings: EasingFunction[] = [
    'linear',
    'easeInQuad',
    'easeOutQuad',
    'easeInOutQuad',
    'easeInCubic',
    'easeOutCubic',
    'easeInOutCubic',
    'easeInBack',
    'easeOutBack',
    'easeInOutBack',
    'spring',
    'bounce',
  ];

  describe('Boundary checks for all 12 closed-enum easing functions', () => {
    allEasings.forEach((name) => {
      it(`easing '${name}' should return 0 at t=0 and 1 at t=1`, () => {
        expect(ease(0, name)).toBeCloseTo(0, 4);
        expect(ease(1, name)).toBeCloseTo(1, 4);
      });
    });

    it('linear is identity f(t) = t', () => {
      expect(ease(0.25, 'linear')).toBeCloseTo(0.25, 4);
      expect(ease(0.5, 'linear')).toBeCloseTo(0.5, 4);
      expect(ease(0.75, 'linear')).toBeCloseTo(0.75, 4);
    });

    it('easeOutBack overshoots 1.0 before settling to 1.0', () => {
      // At t=0.8, easeOutBack overshoots > 1
      expect(ease(0.8, 'easeOutBack')).toBeGreaterThan(1.0);
      expect(ease(1.0, 'easeOutBack')).toBeCloseTo(1.0, 4);
    });

    it('bounce stays within [0, 1] range', () => {
      for (let t = 0; t <= 1; t += 0.1) {
        const val = ease(t, 'bounce');
        expect(val).toBeGreaterThanOrEqual(-0.001);
        expect(val).toBeLessThanOrEqual(1.001);
      }
    });
  });

  describe('interpolateNumber', () => {
    it('interpolates linearly between start and end', () => {
      expect(interpolateNumber(100, 200, 0, 'linear')).toBe(100);
      expect(interpolateNumber(100, 200, 0.5, 'linear')).toBe(150);
      expect(interpolateNumber(100, 200, 1, 'linear')).toBe(200);
    });

    it('respects easing function curve', () => {
      const midLinear = interpolateNumber(0, 100, 0.5, 'linear');
      const midEaseIn = interpolateNumber(0, 100, 0.5, 'easeInCubic');
      // easeIn is slower at start, so at 0.5 it should be lower than linear 50
      expect(midLinear).toBe(50);
      expect(midEaseIn).toBeLessThan(50);
    });
  });

  describe('hexToNumber', () => {
    it('converts 6-digit hex string with or without # to numeric value', () => {
      expect(hexToNumber('#FF0000')).toBe(0xff0000);
      expect(hexToNumber('00FF00')).toBe(0x00ff00);
      expect(hexToNumber('#0000FF')).toBe(0x0000ff);
      expect(hexToNumber('#FFFFFF')).toBe(0xffffff);
      expect(hexToNumber('#000000')).toBe(0x000000);
    });

    it('converts 3-digit shorthand hex (#F00 -> 0xFF0000)', () => {
      expect(hexToNumber('#F00')).toBe(0xff0000);
      expect(hexToNumber('0F0')).toBe(0x00ff00);
      expect(hexToNumber('#00F')).toBe(0x0000ff);
    });

    it('defaults to 0 for invalid hex values', () => {
      expect(hexToNumber('invalid-color')).toBe(0);
      expect(hexToNumber('')).toBe(0);
    });
  });

  describe('interpolateColor', () => {
    it('interpolates between black (#000000) and white (#ffffff) at 0.5', () => {
      const mid = interpolateColor('#000000', '#ffffff', 0.5, 'linear');
      // Midpoint RGB of 0 and 255 is 128 (0x80)
      expect(mid.toLowerCase()).toBe('#808080');
    });

    it('returns start color at progress 0 and end color at progress 1', () => {
      const start = interpolateColor('#ff0000', '#0000ff', 0, 'linear');
      const end = interpolateColor('#ff0000', '#0000ff', 1, 'linear');
      expect(start.toLowerCase()).toBe('#ff0000');
      expect(end.toLowerCase()).toBe('#0000ff');
    });
  });
});
