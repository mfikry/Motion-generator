import { describe, it, expect, vi } from 'vitest';
import { validateCodeWithDryRun } from '../pixel-loop-validator';
import { SandboxedCodeExecutor, IWorkerAdapter } from '../sandboxed-code-executor';
import { executeSandboxedCode } from '../sandbox-runner';

describe('Pixel Loop Consistency Validator (pixel-loop-validator)', () => {
  // Helper to create an in-memory worker adapter that actually renders to an OffscreenCanvas or mock ImageData
  function createMockOffscreenAdapterInternal(): IWorkerAdapter {
    const adapter: IWorkerAdapter = {
      onmessage: null,
      onerror: null,
      terminate: vi.fn(),
      postMessage: (payload) => {
        const width = payload.width;
        const height = payload.height;
        const buffer = new Uint8ClampedArray(width * height * 4);

        const ctx = {
          fillStyle: '#000000',
          fillRect: (x: number, y: number, w: number, h: number) => {
            for (let py = Math.max(0, Math.floor(y)); py < Math.min(height, y + h); py++) {
              for (let px = Math.max(0, Math.floor(x)); px < Math.min(width, x + w); px++) {
                const idx = (py * width + px) * 4;
                buffer[idx] = 255;
                buffer[idx + 1] = 0;
                buffer[idx + 2] = 0;
                buffer[idx + 3] = 255;
              }
            }
          },
          clearRect: () => {
            buffer.fill(0);
          },
          beginPath: vi.fn(),
          arc: vi.fn(),
          fill: vi.fn(),
          stroke: vi.fn(),
          save: vi.fn(),
          restore: vi.fn(),
        };

        try {
          executeSandboxedCode(ctx as unknown as CanvasRenderingContext2D, payload.code, payload.t, width, height, payload.opts || { random: () => 0.5 });
          const imageData = {
            width,
            height,
            data: buffer,
          } as ImageData;

          setTimeout(() => {
            if (adapter.onmessage) {
              adapter.onmessage({
                data: {
                  type: 'SUCCESS',
                  id: payload.id,
                  imageData,
                  executionTimeMs: 2,
                },
              });
            }
          }, 0);
        } catch (err) {
          setTimeout(() => {
            if (adapter.onmessage) {
              adapter.onmessage({
                data: {
                  type: 'ERROR',
                  id: payload.id,
                  error: err instanceof Error ? err.message : String(err),
                  executionTimeMs: 2,
                },
              });
            }
          }, 0);
        }
      },
    };
    return adapter;
  }

  it('approves smooth cyclical looping code where t=0.0 matches t=1.0', async () => {
    const executor = new SandboxedCodeExecutor({
      workerFactory: () => createMockOffscreenAdapterInternal(),
    });

    // Sinusoidal periodic box: offset is sin(t * 2PI), so at t=0 and t=1, offset = 0
    const loopingCode = `
      ctx.clearRect(0, 0, width, height);
      const offset = Math.round(Math.sin(t * Math.PI * 2) * 20);
      ctx.fillRect(40 + offset, 40, 20, 20);
    `;

    const res = await validateCodeWithDryRun(executor, loopingCode, { width: 100, height: 100 });
    expect(res.valid).toBe(true);
    expect(res.consistent).toBe(true);
    expect(res.errors).toHaveLength(0);

    executor.dispose();
  });

  it('rejects non-looping code where t=1.0 jumps or differs from t=0.0', async () => {
    const executor = new SandboxedCodeExecutor({
      workerFactory: () => createMockOffscreenAdapterInternal(),
    });

    // Linear translation: at t=0, x=0; at t=1, x=60. Does NOT loop!
    const nonLoopingCode = `
      ctx.clearRect(0, 0, width, height);
      ctx.fillRect(t * 60, 20, 20, 20);
    `;

    const res = await validateCodeWithDryRun(executor, nonLoopingCode, { width: 100, height: 100 });
    expect(res.valid).toBe(false);
    expect(res.consistent).toBe(false);
    expect(res.errors.length).toBeGreaterThan(0);
    expect(res.errors[0]).toContain('Visual loop inconsistency detected');

    executor.dispose();
  });

  it('rejects malicious code at static analysis phase before dry-run execution', async () => {
    const executor = new SandboxedCodeExecutor({
      workerFactory: () => createMockOffscreenAdapterInternal(),
    });

    const maliciousCode = 'fetch("https://evil.com");';

    const res = await validateCodeWithDryRun(executor, maliciousCode);
    expect(res.valid).toBe(false);
    expect(res.consistent).toBe(false);
    expect(res.errors.some((e) => e.includes('fetch'))).toBe(true);

    executor.dispose();
  });

  it('handles runtime exceptions in drawFrame gracefully', async () => {
    const executor = new SandboxedCodeExecutor({
      workerFactory: () => createMockOffscreenAdapterInternal(),
    });

    const buggyCode = 'const a = undefined as any; a.triggerCrash();';

    const res = await validateCodeWithDryRun(executor, buggyCode);
    expect(res.valid).toBe(false);
    expect(res.consistent).toBe(false);
    expect(res.errors.some((e) => e.includes('Execution failed'))).toBe(true);

    executor.dispose();
  });

  it('rejects completely blank/empty canvas output across all frames', async () => {
    const executor = new SandboxedCodeExecutor({
      workerFactory: () => createMockOffscreenAdapterInternal(),
    });

    // Code that executes without error but performs 0 draw calls
    const emptyCode = `
      const x = 10;
      const y = 20;
    `;

    const res = await validateCodeWithDryRun(executor, emptyCode, { width: 100, height: 100 });
    expect(res.valid).toBe(false);
    expect(res.consistent).toBe(false);
    expect(res.errors.some((e) => e.includes('completely blank/empty'))).toBe(true);

    executor.dispose();
  });

  it('rejects partial render failure when code throws an exception mid-execution at line N after drawing background', async () => {
    const executor = new SandboxedCodeExecutor({
      workerFactory: () => createMockOffscreenAdapterInternal(),
    });

    // Code that successfully draws a background and some stars, then throws an error at line N
    const partialRenderCode = `
      // Line 1: Clear and draw background
      ctx.fillStyle = '#111111';
      ctx.fillRect(0, 0, width, height);

      // Line 5: Draw galaxy core
      ctx.fillStyle = '#ffcc00';
      ctx.fillRect(40, 40, 20, 20);

      // Line 9: Mid-execution explosion (e.g. invalid operation on undefined object)
      throw new Error('Mid-execution exception at line 9: Cannot read properties of undefined');

      // Line 12: Remaining spiral arm particles that are never reached
      ctx.fillStyle = '#00f0ff';
      ctx.fillRect(60, 60, 10, 10);
    `;

    const res = await validateCodeWithDryRun(executor, partialRenderCode, { width: 100, height: 100 });
    expect(res.valid).toBe(false);
    expect(res.consistent).toBe(false);
    expect(res.errors).toHaveLength(1);
    expect(res.errors[0]).toContain('Execution failed at t=0.0');
    expect(res.errors[0]).toContain('Mid-execution exception at line 9');

    executor.dispose();
  });

  it('rejects code that only crashes mid-cycle at t=0.5', async () => {
    const executor = new SandboxedCodeExecutor({
      workerFactory: () => createMockOffscreenAdapterInternal(),
    });

    // Works fine at t=0, but explodes when t is midway through animation cycle
    const conditionalCrashCode = `
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);
      if (t >= 0.45 && t <= 0.55) {
        throw new Error('Mid-cycle particle calculation crash at t=0.5');
      }
      ctx.fillRect(10, 10, 30, 30);
    `;

    const res = await validateCodeWithDryRun(executor, conditionalCrashCode, { width: 100, height: 100 });
    expect(res.valid).toBe(false);
    expect(res.consistent).toBe(false);
    expect(res.errors.some((e) => e.includes('Execution failed at t=0.5'))).toBe(true);
    expect(res.errors.some((e) => e.includes('Mid-cycle particle calculation crash'))).toBe(true);

    executor.dispose();
  });
});
