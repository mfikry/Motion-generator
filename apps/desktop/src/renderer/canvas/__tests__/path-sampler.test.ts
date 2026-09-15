import { describe, it, expect, beforeEach } from 'vitest';
import { sampleSvgPath, parseSimpleSvgPoints, clearPathCache } from '../path-sampler';

describe('SVG Path Sampler (@genc/desktop/canvas/path-sampler)', () => {
  beforeEach(() => {
    clearPathCache();
  });

  describe('sampleSvgPath with realistic Motion Blueprint paths', () => {
    it('samples financial trend-line path (M ... L ...)', () => {
      const trendLinePath = 'M 100 800 L 280 650 L 460 700 L 640 450 L 820 500 L 980 200';
      const result = sampleSvgPath(trendLinePath, 60);

      expect(result).toBeDefined();
      expect(result.points.length).toBeGreaterThanOrEqual(2);
      expect(result.totalLength).toBeGreaterThan(0);

      // Verify all sampled points have valid finite numbers
      result.points.forEach((pt) => {
        expect(Number.isFinite(pt.x)).toBe(true);
        expect(Number.isFinite(pt.y)).toBe(true);
      });

      // First point should be close to start coordinates (100, 800)
      expect(result.points[0]?.x).toBeCloseTo(100, 0);
      expect(result.points[0]?.y).toBeCloseTo(800, 0);
    });

    it('samples smooth curve / swirl path with bezier curves (M ... C ... S ...)', () => {
      const swirlPath = 'M 200 500 C 350 200, 500 200, 650 500 S 900 800, 1000 500';
      const result = sampleSvgPath(swirlPath, 80);

      expect(result).toBeDefined();
      expect(result.points.length).toBeGreaterThanOrEqual(2);
      expect(result.totalLength).toBeGreaterThan(0);
      result.points.forEach((pt) => {
        expect(Number.isFinite(pt.x)).toBe(true);
        expect(Number.isFinite(pt.y)).toBe(true);
      });
    });

    it('samples arrow pointer icon path with multiple M commands', () => {
      const arrowPath = 'M 300 700 L 700 300 M 700 300 L 550 300 M 700 300 L 700 450';
      const result = sampleSvgPath(arrowPath);

      expect(result).toBeDefined();
      expect(result.points.length).toBeGreaterThanOrEqual(2);
      expect(result.totalLength).toBeGreaterThan(0);
    });

    it('handles empty or whitespace path strings without throwing ReferenceError', () => {
      expect(() => sampleSvgPath('')).not.toThrow();
      const emptyResult = sampleSvgPath('');
      expect(emptyResult.points).toEqual([]);
      expect(emptyResult.totalLength).toBe(0);

      expect(() => sampleSvgPath('   \n\t  ')).not.toThrow();
      const wsResult = sampleSvgPath('   \n\t  ');
      expect(wsResult.points).toEqual([]);
      expect(wsResult.totalLength).toBe(0);
    });

    it('caches sampled path results and respects clearPathCache', () => {
      const pathStr = 'M 0 0 L 100 100 L 200 0';
      const first = sampleSvgPath(pathStr, 50);
      const second = sampleSvgPath(pathStr, 50);

      // Should return identical cached instance
      expect(first).toBe(second);

      clearPathCache();
      const third = sampleSvgPath(pathStr, 50);
      expect(third).not.toBe(first);
      expect(third.totalLength).toBe(first.totalLength);
    });
  });

  describe('parseSimpleSvgPoints fallback parser', () => {
    it('parses coordinate pairs correctly', () => {
      const d = 'M 50 100 L 150 200 L 250 100';
      const res = parseSimpleSvgPoints(d);

      expect(res.points).toEqual([
        { x: 50, y: 100 },
        { x: 150, y: 200 },
        { x: 250, y: 100 },
      ]);
      expect(res.totalLength).toBeGreaterThan(0);
    });

    it('handles comma-separated and mixed syntax', () => {
      const d = 'M10,20 L30,40 50,60';
      const res = parseSimpleSvgPoints(d);

      expect(res.points).toEqual([
        { x: 10, y: 20 },
        { x: 30, y: 40 },
        { x: 50, y: 60 },
      ]);
    });
  });
});
