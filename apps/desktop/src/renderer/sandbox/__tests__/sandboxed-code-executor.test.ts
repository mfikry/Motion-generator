import { describe, it, expect, vi } from 'vitest';
import {
  SandboxedCodeExecutor,
  IWorkerAdapter,
} from '../sandboxed-code-executor';
import {
  PULSING_CIRCLE_CODE,
  RANDOM_PARTICLES_CODE,
  INFINITE_LOOP_CODE,
  MALICIOUS_SAMPLES,
} from '../sample-codes';
import { WorkerExecutePayload } from '../types';

/**
 * Creates a controllable mock Worker adapter for testing executor mechanics,
 * timeouts, crashes, and message handling in a Node.js test environment.
 */
function createMockWorkerAdapter(): {
  adapter: IWorkerAdapter;
  terminateSpy: ReturnType<typeof vi.fn>;
  postMessageSpy: ReturnType<typeof vi.fn>;
} {
  const terminateSpy = vi.fn();
  const postMessageSpy = vi.fn();

  const adapter: IWorkerAdapter = {
    onmessage: null,
    onerror: null,
    terminate: terminateSpy,
    postMessage: postMessageSpy,
  };

  return { adapter, terminateSpy, postMessageSpy };
}

describe('Sandboxed Code Executor Host Controller (sandboxed-code-executor.ts)', () => {
  describe('Pre-Execution Static Analysis Gate', () => {
    it('immediately rejects malicious fetch attempt without contacting worker', async () => {
      const { adapter, postMessageSpy } = createMockWorkerAdapter();
      const executor = new SandboxedCodeExecutor({
        workerFactory: () => adapter,
      });

      const result = await executor.executeFrame({
        code: MALICIOUS_SAMPLES.fetchAttempt,
        t: 0,
        width: 1920,
        height: 1080,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Security Policy Violation');
      expect(result.error).toContain('fetch');
      expect(postMessageSpy).not.toHaveBeenCalled();

      executor.dispose();
    });

    it('immediately rejects prototype climbing attempt without contacting worker', async () => {
      const { adapter, postMessageSpy } = createMockWorkerAdapter();
      const executor = new SandboxedCodeExecutor({
        workerFactory: () => adapter,
      });

      const result = await executor.executeFrame({
        code: MALICIOUS_SAMPLES.prototypeClimbingAttempt,
        t: 0,
        width: 1920,
        height: 1080,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('constructor');
      expect(postMessageSpy).not.toHaveBeenCalled();

      executor.dispose();
    });

    it('immediately rejects empty code string', async () => {
      const { adapter, postMessageSpy } = createMockWorkerAdapter();
      const executor = new SandboxedCodeExecutor({
        workerFactory: () => adapter,
      });

      const result = await executor.executeFrame({
        code: '',
        t: 0,
        width: 100,
        height: 100,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('non-empty string');
      expect(postMessageSpy).not.toHaveBeenCalled();

      executor.dispose();
    });
  });

  describe('Successful Worker Execution Flow', () => {
    it('dispatches valid PULSING_CIRCLE_CODE to worker and resolves on SUCCESS', async () => {
      let activeAdapter: IWorkerAdapter | null = null;
      const executor = new SandboxedCodeExecutor({
        workerFactory: () => {
          const { adapter } = createMockWorkerAdapter();
          adapter.postMessage = (payload: WorkerExecutePayload) => {
            // Simulate asynchronous worker response
            setTimeout(() => {
              if (adapter.onmessage) {
                adapter.onmessage({
                  data: {
                    type: 'SUCCESS',
                    id: payload.id,
                    executionTimeMs: 12,
                  },
                });
              }
            }, 10);
          };
          activeAdapter = adapter;
          return adapter;
        },
      });

      const result = await executor.executeFrame({
        code: PULSING_CIRCLE_CODE,
        t: 0.5,
        width: 1920,
        height: 1080,
      });

      expect(result.success).toBe(true);
      expect(result.timedOut).toBe(false);
      expect(result.error).toBeUndefined();
      expect(activeAdapter).not.toBeNull();

      executor.dispose();
    });

    it('passes options and seeds for procedural animation code', async () => {
      const captured: { payload?: WorkerExecutePayload } = {};
      const executor = new SandboxedCodeExecutor({
        workerFactory: () => {
          const { adapter } = createMockWorkerAdapter();
          adapter.postMessage = (payload: WorkerExecutePayload) => {
            captured.payload = payload;
            if (adapter.onmessage) {
              adapter.onmessage({
                data: {
                  type: 'SUCCESS',
                  id: payload.id,
                  executionTimeMs: 8,
                },
              });
            }
          };
          return adapter;
        },
      });

      const result = await executor.executeFrame({
        code: RANDOM_PARTICLES_CODE,
        t: 0.1,
        width: 1080,
        height: 1080,
        opts: { seed: 54321 },
      });

      expect(result.success).toBe(true);
      expect(captured.payload).toBeDefined();
      expect(captured.payload?.opts?.seed).toBe(54321);
      expect(captured.payload?.width).toBe(1080);
      expect(captured.payload?.height).toBe(1080);

      executor.dispose();
    });
  });

  describe('50ms Watchdog Timeout Guard (Strict Termination)', () => {
    it('forcibly terminates worker when execution exceeds 50ms limit (e.g. infinite loop)', async () => {
      const terminateSpy = vi.fn();
      let workerCount = 0;

      const executor = new SandboxedCodeExecutor({
        defaultTimeoutMs: 50,
        workerFactory: () => {
          workerCount++;
          const isFirstWorker = workerCount === 1;
          const adapter: IWorkerAdapter = {
            onmessage: null,
            onerror: null,
            terminate: terminateSpy,
            postMessage: (payload) => {
              if (isFirstWorker) {
                // Simulate infinite loop: worker never responds!
              } else {
                setTimeout(() => {
                  if (adapter.onmessage) {
                    adapter.onmessage({
                      data: {
                        type: 'SUCCESS',
                        id: payload.id,
                        executionTimeMs: 5,
                      },
                    });
                  }
                }, 5);
              }
            },
          };
          return adapter;
        },
      });

      const startTime = performance.now();
      const result = await executor.executeFrame({
        code: INFINITE_LOOP_CODE,
        t: 0,
        width: 1920,
        height: 1080,
        timeoutMs: 50,
      });
      const elapsed = performance.now() - startTime;

      expect(result.success).toBe(false);
      expect(result.timedOut).toBe(true);
      expect(result.error).toContain('Execution timed out: drawFrame exceeded 50ms limit');
      expect(elapsed).toBeGreaterThanOrEqual(40);
      expect(terminateSpy).toHaveBeenCalledTimes(1);

      // Verify that after timeout and worker termination, next call re-spawns a fresh worker
      expect(workerCount).toBe(1);

      // Now run a second job that finishes immediately
      const secondResult = await executor.executeFrame({
        code: PULSING_CIRCLE_CODE,
        t: 0,
        width: 100,
        height: 100,
        timeoutMs: 50,
      });

      expect(secondResult.success).toBe(true);
      // Second worker was spawned because first was terminated
      expect(workerCount).toBe(2);

      executor.dispose();
    });
  });

  describe('Worker Error and Crash Recovery', () => {
    it('handles worker runtime error response gracefully', async () => {
      const executor = new SandboxedCodeExecutor({
        workerFactory: () => {
          const { adapter } = createMockWorkerAdapter();
          adapter.postMessage = (payload: WorkerExecutePayload) => {
            if (adapter.onmessage) {
              adapter.onmessage({
                data: {
                  type: 'ERROR',
                  id: payload.id,
                  error: 'TypeError: Cannot read properties of undefined',
                  executionTimeMs: 5,
                },
              });
            }
          };
          return adapter;
        },
      });

      const result = await executor.executeFrame({
        code: 'const a = 1;',
        t: 0,
        width: 100,
        height: 100,
      });

      expect(result.success).toBe(false);
      expect(result.timedOut).toBe(false);
      expect(result.error).toContain('TypeError');

      executor.dispose();
    });

    it('handles unexpected worker crash event (onerror)', async () => {
      const terminateSpy = vi.fn();
      const executor = new SandboxedCodeExecutor({
        workerFactory: () => {
          const adapter: IWorkerAdapter = {
            onmessage: null,
            onerror: null,
            terminate: terminateSpy,
            postMessage: () => {
              setTimeout(() => {
                if (adapter.onerror) {
                  adapter.onerror(new Error('Out of memory in worker'));
                }
              }, 5);
            },
          };
          return adapter;
        },
      });

      const result = await executor.executeFrame({
        code: PULSING_CIRCLE_CODE,
        t: 0,
        width: 100,
        height: 100,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Worker crashed: Out of memory in worker');
      expect(terminateSpy).toHaveBeenCalled();

      executor.dispose();
    });

    it('throws when attempting to execute after disposal', async () => {
      const executor = new SandboxedCodeExecutor({
        workerFactory: () => createMockWorkerAdapter().adapter,
      });
      executor.dispose();

      const result = await executor.executeFrame({
        code: PULSING_CIRCLE_CODE,
        t: 0,
        width: 100,
        height: 100,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('disposed');
    });
  });
});
