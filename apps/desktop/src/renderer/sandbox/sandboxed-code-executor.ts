/**
 * Sandboxed Code Executor Host Controller (v2.0)
 *
 * Orchestrates safe execution of Canvas2D code:
 * 1. Pre-execution static analysis gate (rejects dangerous code before dispatch).
 * 2. Dedicated Web Worker lifecycle management.
 * 3. 50ms Watchdog Timeout Guard: forcibly terminates worker on infinite loops/freeze.
 * 4. Error handling & worker re-spawning.
 */

import { analyzeCodeSafety } from './static-analyzer';
import { ExecuteFrameParams, ExecutionResult, WorkerExecutePayload, WorkerResponse } from './types';

export const DEFAULT_EXECUTION_TIMEOUT_MS = 50;

export interface IWorkerAdapter {
  postMessage(message: WorkerExecutePayload, transfer?: Transferable[]): void;
  terminate(): void;
  onmessage: ((event: { data: WorkerResponse }) => void) | null;
  onerror: ((event: unknown) => void) | null;
}

export type WorkerFactory = () => IWorkerAdapter;

import { processWorkerExecution } from './canvas-worker';

/**
 * Fallback worker adapter for non-browser / unit-test environments where Web Worker is unavailable.
 */
export function createInProcessWorkerAdapter(): IWorkerAdapter {
  let onmessageHandler: ((event: { data: WorkerResponse }) => void) | null = null;
  let onerrorHandler: ((event: unknown) => void) | null = null;

  return {
    postMessage(payload: WorkerExecutePayload) {
      setTimeout(() => {
        try {
          const res = processWorkerExecution(payload);
          onmessageHandler?.({ data: res });
        } catch (err) {
          onmessageHandler?.({
            data: {
              type: 'ERROR',
              id: payload.id,
              error: err instanceof Error ? err.message : String(err),
              executionTimeMs: 0,
            },
          });
        }
      }, 0);
    },
    terminate() {},
    get onmessage() {
      return onmessageHandler;
    },
    set onmessage(handler) {
      onmessageHandler = handler;
    },
    get onerror() {
      return onerrorHandler;
    },
    set onerror(handler) {
      onerrorHandler = handler;
    },
  };
}

/**
 * Default browser worker factory using Vite module worker syntax.
 * Automatically falls back to in-process adapter in headless environments.
 */
export function defaultBrowserWorkerFactory(): IWorkerAdapter {
  if (typeof Worker === 'undefined') {
    return createInProcessWorkerAdapter();
  }
  return new Worker(new URL('./canvas-worker.ts', import.meta.url), {
    type: 'module',
  }) as unknown as IWorkerAdapter;
}

export class SandboxedCodeExecutor {
  private worker: IWorkerAdapter | null = null;
  private readonly workerFactory: WorkerFactory;
  private readonly defaultTimeoutMs: number;
  private nextRequestId: number = 1;
  private isDisposed: boolean = false;

  constructor(options?: { workerFactory?: WorkerFactory; defaultTimeoutMs?: number }) {
    this.workerFactory = options?.workerFactory ?? defaultBrowserWorkerFactory;
    this.defaultTimeoutMs = options?.defaultTimeoutMs ?? DEFAULT_EXECUTION_TIMEOUT_MS;
  }

  private workerReadyPromise: Promise<void> | null = null;
  private workerReadyResolver: (() => void) | null = null;

  /**
   * Pre-warms the Web Worker so that JIT compilation and module fetching
   * (e.g. in Vite dev mode) do not compete with the execution watchdog timeout.
   */
  public warmup(): void {
    if (!this.isDisposed && !this.worker) {
      try {
        this.getWorker();
      } catch {
        // Ignore in environments where workers are not supported
      }
    }
  }

  /**
   * Ensures the worker has completed startup and hardening before executing frames.
   */
  public async ensureWorkerReady(): Promise<void> {
    if (!this.worker) {
      this.getWorker();
    }
    if (this.workerReadyPromise) {
      await this.workerReadyPromise;
    }
  }

  /**
   * Initializes or gets the active worker instance.
   */
  private getWorker(): IWorkerAdapter {
    if (this.isDisposed) {
      throw new Error('SandboxedCodeExecutor has been disposed.');
    }
    if (!this.worker) {
      this.worker = this.workerFactory();
      this.workerReadyPromise = new Promise<void>((resolve) => {
        this.workerReadyResolver = resolve;
        // Fallback resolve after 1500ms in case environment doesn't emit READY
        setTimeout(resolve, 1500);
      });
      const initialWorker = this.worker;
      initialWorker.onmessage = (event: { data: WorkerResponse }) => {
        if (event.data?.type === 'READY') {
          if (this.workerReadyResolver) {
            this.workerReadyResolver();
            this.workerReadyResolver = null;
          }
        }
      };
    }
    return this.worker;
  }

  /**
   * Forcibly terminates the current worker and cleans up state.
   */
  private terminateWorker(): void {
    if (this.worker) {
      try {
        this.worker.terminate();
      } catch {
        // Ignore termination errors
      }
      this.worker = null;
      this.workerReadyPromise = null;
      this.workerReadyResolver = null;
    }
  }

  /**
   * Executes a Canvas2D drawFrame script safely inside the sandboxed worker.
   */
  public async executeFrame(params: ExecuteFrameParams): Promise<ExecutionResult> {
    const startTime = performance.now();
    const timeoutMs = params.timeoutMs ?? this.defaultTimeoutMs;

    // Step 1: Pre-execution Static Analysis Gate
    const analysis = analyzeCodeSafety(params.code);
    if (!analysis.valid) {
      return {
        success: false,
        error: `Security Policy Violation:\n- ${analysis.errors.join('\n- ')}`,
        timedOut: false,
        executionTimeMs: performance.now() - startTime,
      };
    }

    // Step 2: Prepare worker message
    const requestId = `req_${this.nextRequestId++}_${Date.now()}`;
    const payload: WorkerExecutePayload = {
      id: requestId,
      code: params.code,
      t: params.t,
      width: params.width,
      height: params.height,
      opts: params.opts,
      returnImageData: params.returnImageData,
    };

    // Step 2b: Ensure worker has completed startup/hardening before dispatching frame
    try {
      await this.ensureWorkerReady();
    } catch {
      // Ignore warmup errors
    }

    // Step 3: Execute in worker with strict watchdog timeout guard
    return new Promise<ExecutionResult>((resolve) => {
      let settled = false;
      let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
      let workerInstance: IWorkerAdapter;

      try {
        workerInstance = this.getWorker();
      } catch (err) {
        resolve({
          success: false,
          error: err instanceof Error ? err.message : String(err),
          timedOut: false,
          executionTimeMs: performance.now() - startTime,
        });
        return;
      }

      const cleanup = () => {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
          timeoutHandle = null;
        }
        if (workerInstance) {
          workerInstance.onmessage = null;
          workerInstance.onerror = null;
        }
      };

      // Watchdog Timeout Guard: terminates worker if drawFrame exceeds timeout
      timeoutHandle = setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();

        // Forcibly terminate the hung worker (e.g. while(true) loop)
        this.terminateWorker();

        resolve({
          success: false,
          error: `Execution timed out: drawFrame exceeded ${timeoutMs}ms limit`,
          timedOut: true,
          executionTimeMs: performance.now() - startTime,
        });
      }, timeoutMs);

      // Handle worker response
      workerInstance.onmessage = (event: { data: WorkerResponse }) => {
        if (settled) return;
        const res = event.data;
        if (!res || res.type === 'READY' || res.id !== requestId) return;

        settled = true;
        cleanup();

        if (res.type === 'SUCCESS') {
          resolve({
            success: true,
            imageBitmap: res.imageBitmap,
            imageData: res.imageData,
            timedOut: false,
            executionTimeMs: performance.now() - startTime,
          });
        } else if (res.type === 'ERROR') {
          resolve({
            success: false,
            error: res.error,
            timedOut: false,
            executionTimeMs: performance.now() - startTime,
          });
        }
      };

      // Handle unexpected worker crash/error
      workerInstance.onerror = (err: unknown) => {
        if (settled) return;
        settled = true;
        cleanup();
        this.terminateWorker();

        const errMsg =
          err instanceof Error ? err.message : typeof err === 'string' ? err : 'Worker error';

        resolve({
          success: false,
          error: `Worker crashed: ${errMsg}`,
          timedOut: false,
          executionTimeMs: performance.now() - startTime,
        });
      };

      // Dispatch execution payload to worker
      try {
        workerInstance.postMessage(payload);
      } catch (postErr) {
        if (settled) return;
        settled = true;
        cleanup();
        resolve({
          success: false,
          error: postErr instanceof Error ? postErr.message : String(postErr),
          timedOut: false,
          executionTimeMs: performance.now() - startTime,
        });
      }
    });
  }

  /**
   * Disposes of the executor and terminates running workers.
   */
  public dispose(): void {
    this.isDisposed = true;
    this.terminateWorker();
  }
}
