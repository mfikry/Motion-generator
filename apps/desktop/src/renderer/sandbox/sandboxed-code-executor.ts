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

/**
 * Default browser worker factory using Vite module worker syntax.
 */
export function defaultBrowserWorkerFactory(): IWorkerAdapter {
  if (typeof Worker === 'undefined') {
    throw new Error('Web Worker is not supported in this environment.');
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

  /**
   * Initializes or gets the active worker instance.
   */
  private getWorker(): IWorkerAdapter {
    if (this.isDisposed) {
      throw new Error('SandboxedCodeExecutor has been disposed.');
    }
    if (!this.worker) {
      this.worker = this.workerFactory();
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
    };

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
        if (!res || res.id !== requestId) return;

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
        } else {
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
