import { describe, it, expect } from 'vitest';
import {
  analyzeCodeSafety,
  assertCodeSafety,
  FORBIDDEN_IDENTIFIERS,
} from '../static-analyzer';
import {
  PULSING_CIRCLE_CODE,
  RANDOM_PARTICLES_CODE,
  MALICIOUS_SAMPLES,
} from '../sample-codes';

describe('Static Analysis Pre-Execution Scanner (static-analyzer.ts)', () => {
  describe('Legitimate Canvas2D Code (Must Pass)', () => {
    it('approves PULSING_CIRCLE_CODE', () => {
      const result = analyzeCodeSafety(PULSING_CIRCLE_CODE);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(() => assertCodeSafety(PULSING_CIRCLE_CODE)).not.toThrow();
    });

    it('approves RANDOM_PARTICLES_CODE with opts.random()', () => {
      const result = analyzeCodeSafety(RANDOM_PARTICLES_CODE);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(() => assertCodeSafety(RANDOM_PARTICLES_CODE)).not.toThrow();
    });

    it('approves complex safe mathematical and drawing operations', () => {
      const safeCode = `
        ctx.save();
        ctx.translate(width / 2, height / 2);
        ctx.rotate(t * Math.PI * 2);
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = (i * Math.PI) / 3;
          const r = 100 + 20 * Math.sin(t * 4);
          const x = r * Math.cos(angle);
          const y = r * Math.sin(angle);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      `;
      const result = analyzeCodeSafety(safeCode);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Empty or Invalid Code Input', () => {
    it('rejects empty string', () => {
      const result = analyzeCodeSafety('');
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('non-empty string');
    });

    it('rejects whitespace-only string', () => {
      const result = analyzeCodeSafety('   \n\t  ');
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('non-empty string');
    });
  });

  describe('Forbidden Identifiers (Must Reject)', () => {
    it.each(FORBIDDEN_IDENTIFIERS)('rejects forbidden identifier: %s', (id) => {
      const testCode = `const x = ${id}; ctx.fillRect(0, 0, 10, 10);`;
      const result = analyzeCodeSafety(testCode);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes(id))).toBe(true);
      expect(() => assertCodeSafety(testCode)).toThrow();
    });
  });

  describe('Bypass Techniques & Malicious Samples', () => {
    it('rejects network exfiltration via fetch', () => {
      const result = analyzeCodeSafety(MALICIOUS_SAMPLES.fetchAttempt);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('fetch'))).toBe(true);
    });

    it('rejects window redirect attempt', () => {
      const result = analyzeCodeSafety(MALICIOUS_SAMPLES.windowAccessAttempt);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('window') || e.includes('location'))).toBe(true);
    });

    it('rejects document DOM tampering', () => {
      const result = analyzeCodeSafety(MALICIOUS_SAMPLES.documentAccessAttempt);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('document'))).toBe(true);
    });

    it('rejects prototype climbing via [].constructor.constructor', () => {
      const result = analyzeCodeSafety(MALICIOUS_SAMPLES.prototypeClimbingAttempt);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('constructor'))).toBe(true);
    });

    it('rejects bracket notation property access to constructor', () => {
      const result = analyzeCodeSafety(MALICIOUS_SAMPLES.bracketConstructorAttempt);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('constructor'))).toBe(true);
    });

    it('rejects globalThis storage manipulation', () => {
      const result = analyzeCodeSafety(MALICIOUS_SAMPLES.globalThisStorageAttempt);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('globalThis') || e.includes('localStorage'))).toBe(true);
    });

    it('rejects eval() execution', () => {
      const result = analyzeCodeSafety(MALICIOUS_SAMPLES.evalAttempt);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('eval'))).toBe(true);
    });

    it('rejects unicode-escaped eval (\\u0065val)', () => {
      const result = analyzeCodeSafety(MALICIOUS_SAMPLES.unicodeEscapeEvalAttempt);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('eval'))).toBe(true);
    });

    it('rejects worker postMessage escape attempt', () => {
      const result = analyzeCodeSafety(MALICIOUS_SAMPLES.postMessageAttempt);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('postMessage') || e.includes('self'))).toBe(true);
    });

    it('rejects dynamic import()', () => {
      const result = analyzeCodeSafety(MALICIOUS_SAMPLES.dynamicImportAttempt);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('import'))).toBe(true);
    });

    it('rejects concatenated property access like this["con" + "structor"]', () => {
      const trickyCode = 'const f = this["con" + "structor"];';
      const result = analyzeCodeSafety(trickyCode);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('concatenat'))).toBe(true);
    });

    it('rejects access to __proto__ and prototype', () => {
      const protoCode = 'const p = Object.__proto__;';
      const result = analyzeCodeSafety(protoCode);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('__proto__'))).toBe(true);
    });

    it('rejects timer functions like setTimeout or setInterval', () => {
      const timerCode = 'setTimeout(() => {}, 100);';
      const result = analyzeCodeSafety(timerCode);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('setTimeout'))).toBe(true);
    });
  });
});
