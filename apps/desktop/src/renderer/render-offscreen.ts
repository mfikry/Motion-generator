/**
 * Offscreen Render Harness (E8)
 *
 * Runs in a hidden BrowserWindow with contextIsolation: true.
 * Receives frame render requests from the main process via IPC bridge (__renderOffscreen),
 * executes them through the SAME SandboxedCodeExecutor used by the live preview,
 * and returns raw ImageData pixel buffers.
 *
 * This guarantees "what you preview is what you render" — no separate path.
 */

import { SandboxedCodeExecutor } from './sandbox/sandboxed-code-executor';

interface RenderOffscreenAPI {
  ready: () => void;
  initError: (error: string) => void;
  onExecuteFrame: (
    callback: (
      requestId: string,
      code: string,
      t: number,
      width: number,
      height: number,
      seed: number,
      options?: Record<string, unknown>
    ) => void
  ) => () => void;
  sendFrameResult: (requestId: string, pixelData: Uint8Array, executionTimeMs?: number) => void;
  sendFrameError: (requestId: string, error: string) => void;
  onDispose: (callback: () => void) => () => void;
}

declare global {
  interface Window {
    __renderOffscreen?: RenderOffscreenAPI;
  }
}

const api = window.__renderOffscreen;
if (!api) {
  console.error('[OffscreenRender] __renderOffscreen bridge not found on window');
}

/** Single shared executor instance for all frames in a render job */
let executor: SandboxedCodeExecutor | null = null;

/**
 * Initialize the executor and signal readiness to the main process.
 */
async function init(): Promise<void> {
  if (!api) throw new Error('Render bridge not available');

  executor = new SandboxedCodeExecutor({
    // Higher timeout for full-res frames — rendering at 4K takes longer than preview
    defaultTimeoutMs: 5000,
  });

  executor.warmup();
  await executor.ensureWorkerReady();

  // Signal readiness to main process
  api.ready();
  console.log('[OffscreenRender] Executor ready');
}

// Handle frame render requests
api?.onExecuteFrame(
  async (
    requestId: string,
    code: string,
    t: number,
    width: number,
    height: number,
    seed: number,
    options?: Record<string, unknown>
  ) => {
    if (!api) return;
    if (!executor) {
      api.sendFrameError(requestId, 'Executor not initialized');
      return;
    }

    try {
      const result = await executor.executeFrame({
        code,
        t,
        width,
        height,
        opts: { seed, ...options },
        returnImageData: true, // Always need raw pixels for FFmpeg
        timeoutMs: 5000,
      });

      if (!result.success) {
        api.sendFrameError(requestId, result.error ?? 'Frame execution failed');
        return;
      }

      if (!result.imageData) {
        api.sendFrameError(requestId, 'No ImageData returned from executor');
        return;
      }

      // Convert Uint8ClampedArray to Uint8Array for clean structured clone transfer
      const pixelData = new Uint8Array(
        result.imageData.data.buffer,
        result.imageData.data.byteOffset,
        result.imageData.data.byteLength
      );
      api.sendFrameResult(requestId, pixelData, result.executionTimeMs);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      api.sendFrameError(requestId, errorMsg);
    }
  }
);

// Handle dispose
api?.onDispose(() => {
  if (executor) {
    executor.dispose();
    executor = null;
  }
  console.log('[OffscreenRender] Disposed');
});

// Start initialization
init().catch((err) => {
  console.error('[OffscreenRender] Init failed:', err);
  api?.initError(err instanceof Error ? err.message : String(err));
});
