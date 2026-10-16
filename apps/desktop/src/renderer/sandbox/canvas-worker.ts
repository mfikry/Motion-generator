/**
 * Sandboxed Canvas2D Web Worker (v2.0)
 *
 * Runs isolated in a background Web Worker thread:
 * - Manages an OffscreenCanvas.
 * - Executes drawFrame within the sandbox runner.
 * - Returns rendered frames as transferable ImageBitmap (or fallback ImageData).
 */

import { executeSandboxedCode } from './sandbox-runner';
import { WorkerExecutePayload, WorkerResponse } from './types';

let cachedCanvas: OffscreenCanvas | null = null;
let cachedCtx: OffscreenCanvasRenderingContext2D | null = null;
let _internalPostMessage: ((message: unknown, transfer?: Transferable[]) => void) | null = null;

/**
 * List of dangerous host and I/O APIs neutralized in DedicatedWorkerGlobalScope.
 */
export const DANGEROUS_WORKER_APIS = [
  // Network & I/O
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'EventSource',
  'sendBeacon',
  'openDatabase',
  'BroadcastChannel',

  // Storage & Caching
  'indexedDB',
  'caches',
  'cookieStore',
  'localStorage',
  'sessionStorage',

  // Dynamic script loading & compilation
  'importScripts',
  'WebAssembly',

  // Timers (frame rendering must be a pure deterministic function of progress t)
  'setTimeout',
  'setInterval',
  'setImmediate',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'queueMicrotask',

  // Threading & Workers
  'Worker',
  'SharedWorker',
  'ServiceWorker',

  // Dialogs / Navigation
  'alert',
  'prompt',
  'confirm',
  'open',
  'close',
] as const;

/**
 * Hardens DedicatedWorkerGlobalScope by neutralizing dangerous APIs and freezing prototypes.
 * This runs at worker startup, ensuring defense-in-depth even if static analysis is bypassed.
 */
export function hardenWorkerGlobalScope(
  targetScope?: Record<string, unknown>,
  options: { freezePrototypes?: boolean } = {}
): void {
  const scope =
    targetScope ||
    (typeof self !== 'undefined'
      ? (self as unknown as Record<string, unknown>)
      : typeof globalThis !== 'undefined'
      ? (globalThis as unknown as Record<string, unknown>)
      : null);

  if (!scope) return;

  // 1. Neutralize all dangerous APIs with non-writable, non-configurable undefined descriptors
  for (const prop of DANGEROUS_WORKER_APIS) {
    try {
      Object.defineProperty(scope, prop, {
        value: undefined,
        writable: false,
        configurable: false,
      });
    } catch {
      try {
        scope[prop] = undefined;
      } catch {
        // Ignore if environment forbids property definition
      }
    }
  }

  // 2. Freeze base prototypes to block prototype pollution and prototype climbing
  const shouldFreeze =
    options.freezePrototypes ??
    typeof (globalThis as unknown as { importScripts?: unknown }).importScripts === 'function';

  if (shouldFreeze) {
    try {
      Object.freeze(Object.prototype);
      Object.freeze(Function.prototype);
      Object.freeze(Array.prototype);
    } catch {
      // Ignore if prototypes cannot be frozen in current context
    }
  }
}

/**
 * Secures self.postMessage by preserving an internal channel for legitimate render responses,
 * while preventing rogue code in the worker from calling self.postMessage arbitrarily.
 */
export function setupWorkerCommunication(targetScope?: { postMessage: unknown }): void {
  const scope = targetScope || (typeof self !== 'undefined' ? (self as unknown as { postMessage: unknown }) : null);
  if (!scope || typeof scope.postMessage !== 'function') return;

  const realPostMessage = (scope.postMessage as (...args: unknown[]) => void).bind(scope);
  _internalPostMessage = realPostMessage as (message: unknown, transfer?: Transferable[]) => void;

  try {
    Object.defineProperty(scope, 'postMessage', {
      value: function () {
        throw new Error('postMessage is disabled within the sandboxed drawing scope.');
      },
      writable: false,
      configurable: false,
    });
  } catch {
    try {
      scope.postMessage = function () {
        throw new Error('postMessage is disabled within the sandboxed drawing scope.');
      };
    } catch {
      // Ignore
    }
  }
}

/**
 * Gets or initializes an OffscreenCanvas with the required dimensions.
 */
export function getOrCreateOffscreenCanvas(
  width: number,
  height: number
): { canvas: { transferToImageBitmap?: () => ImageBitmap }; ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D } {
  if (typeof OffscreenCanvas !== 'undefined') {
    if (!cachedCanvas || cachedCanvas.width !== width || cachedCanvas.height !== height) {
      cachedCanvas = new OffscreenCanvas(width, height);
      cachedCtx = cachedCanvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
    }
    if (!cachedCtx || !cachedCanvas) {
      throw new Error('Failed to obtain 2D rendering context for OffscreenCanvas');
    }
    return { canvas: cachedCanvas, ctx: cachedCtx };
  }

  // Headless Node environment fallback
  if (!cachedCanvas || !cachedCtx) {
    const mockCtx = {
      clearRect: () => {},
      fillRect: () => {},
      beginPath: () => {},
      arc: () => {},
      fill: () => {},
      stroke: () => {},
      resetTransform: () => {},
      reset: () => {},
      getImageData: () => ({ data: new Uint8Array(width * height * 4) }),
    };
    cachedCanvas = {
      width,
      height,
      transferToImageBitmap: () => ({ close: () => {} }),
    } as unknown as OffscreenCanvas;
    cachedCtx = mockCtx as unknown as OffscreenCanvasRenderingContext2D;
  }
  return { canvas: cachedCanvas, ctx: cachedCtx };
}

/**
 * Core handler for processing an execution request in a worker environment.
 */
export function processWorkerExecution(
  payload: WorkerExecutePayload,
  canvasProvider?: (width: number, height: number) => {
    canvas: { transferToImageBitmap?: () => ImageBitmap };
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  }
): WorkerResponse & { transferables?: Transferable[] } {
  const startTime = performance.now();
  const { id, code, t, width, height, opts } = payload;

  try {
    const { canvas, ctx } = canvasProvider
      ? canvasProvider(width, height)
      : getOrCreateOffscreenCanvas(width, height);

    // Full 2D context state sanitization before frame execution
    if (typeof (ctx as unknown as { reset?: () => void }).reset === 'function') {
      (ctx as unknown as { reset: () => void }).reset();
    } else {
      if (typeof ctx.resetTransform === 'function') {
        ctx.resetTransform();
      }
      ctx.globalAlpha = 1.0;
      ctx.globalCompositeOperation = 'source-over';
      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';
      ctx.filter = 'none';
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#000000';
      ctx.fillStyle = '#000000';
    }

    // Clear canvas before drawing
    ctx.clearRect(0, 0, width, height);

    const safeOpts = (opts || {}) as Record<string, unknown>;
    const isGreenScreen = safeOpts.greenScreen === true;
    const isTransparent = safeOpts.transparent === true || (!isGreenScreen && safeOpts.hasAlpha === true);
    // Explicit hasAlpha: false (e.g. from render-pipeline for MP4) signals a non-alpha export format
    const shouldCompositeSolidBg = safeOpts.hasAlpha === false && !isGreenScreen;

    if (isGreenScreen) {
      ctx.fillStyle = '#00B140';
      ctx.fillRect(0, 0, width, height);
    }

    const origClearRect = ctx.clearRect;
    const origFillRect = ctx.fillRect;
    let bgHandled = false;

    if (isGreenScreen) {
      // 1. Intercept clearRect so scripts with ctx.clearRect() do not erase the green screen
      ctx.clearRect = function (x: number, y: number, w: number, h: number) {
        if (x <= 0 && y <= 0 && w >= width && h >= height) {
          const prevFill = ctx.fillStyle;
          ctx.fillStyle = '#00B140';
          origFillRect.call(this, 0, 0, width, height);
          ctx.fillStyle = prevFill;
          return;
        }
        return origClearRect.call(this, x, y, w, h);
      };

      // 2. Intercept fillRect so any background fill in the script is forced to #00B140
      ctx.fillRect = function (x: number, y: number, w: number, h: number) {
        if (x <= 0 && y <= 0 && w >= width && h >= height) {
          const prevFill = ctx.fillStyle;
          ctx.fillStyle = '#00B140';
          origFillRect.call(this, 0, 0, width, height);
          ctx.fillStyle = prevFill;
          return;
        }
        return origFillRect.call(this, x, y, w, h);
      };
    } else if (isTransparent) {
      // Intercept fillRect so opaque background fills in scripts are skipped in transparent mode
      ctx.fillRect = function (x: number, y: number, w: number, h: number) {
        if (!bgHandled && x <= 0 && y <= 0 && w >= width && h >= height) {
          bgHandled = true;
          // Skip full-canvas solid background rect to preserve alpha channel transparency
          return;
        }
        return origFillRect.call(this, x, y, w, h);
      };
    }

    try {
      // Execute sandboxed drawFrame
      executeSandboxedCode(ctx, code, t, width, height, opts);
    } finally {
      ctx.clearRect = origClearRect;
      ctx.fillRect = origFillRect;
    }

    // Post-execution background guarantee and compositing:
    if (isGreenScreen) {
      // Guarantee solid green screen #00B140 behind all elements
      ctx.save();
      ctx.globalCompositeOperation = 'destination-over';
      ctx.filter = 'none';
      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';
      ctx.globalAlpha = 1.0;
      ctx.fillStyle = '#00B140';
      origFillRect.call(ctx, 0, 0, width, height);
      ctx.restore();
    } else if (shouldCompositeSolidBg) {
      // For non-alpha formats (e.g. MP4 H.264 yuv420p), composite over solid background
      // so FFmpeg swscale does not discard alpha falloff (shadowBlur/glow) into solid opaque neon bands.
      const bgColor =
        typeof safeOpts.backgroundColor === 'string' && safeOpts.backgroundColor
          ? safeOpts.backgroundColor
          : '#000000';
      ctx.save();
      ctx.globalCompositeOperation = 'destination-over';
      ctx.filter = 'none';
      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';
      ctx.globalAlpha = 1.0;
      ctx.fillStyle = bgColor;
      origFillRect.call(ctx, 0, 0, width, height);
      ctx.restore();
    }

    const executionTimeMs = performance.now() - startTime;

    // Return imageData directly when requested for pixel comparison / dry-run
    if (payload.returnImageData || typeof canvas.transferToImageBitmap !== 'function') {
      const imageData = ctx.getImageData(0, 0, width, height);
      return {
        type: 'SUCCESS',
        id,
        imageData,
        executionTimeMs,
      };
    }

    // Prefer zero-copy transferToImageBitmap if available
    if (typeof canvas.transferToImageBitmap === 'function') {
      const imageBitmap = canvas.transferToImageBitmap();
      return {
        type: 'SUCCESS',
        id,
        imageBitmap,
        executionTimeMs,
        transferables: [imageBitmap],
      };
    }

    // Fallback to getImageData
    const imageData = ctx.getImageData(0, 0, width, height);
    return {
      type: 'SUCCESS',
      id,
      imageData,
      executionTimeMs,
    };
  } catch (err) {
    const executionTimeMs = performance.now() - startTime;
    // Wipe offscreen canvas clean immediately to prevent partial-render leakage
    try {
      const { ctx } = canvasProvider
        ? canvasProvider(width, height)
        : getOrCreateOffscreenCanvas(width, height);
      if (typeof (ctx as unknown as { reset?: () => void }).reset === 'function') {
        (ctx as unknown as { reset: () => void }).reset();
      } else if (typeof ctx.resetTransform === 'function') {
        ctx.resetTransform();
      }
      ctx.clearRect(0, 0, width, height);
    } catch {
      // Ignore cleanup error
    }

    const errorName = err instanceof Error && err.name ? err.name : 'RuntimeError';
    let errorMsg = err instanceof Error ? err.message : String(err);
    if (errorMsg.startsWith(`${errorName}: `)) {
      errorMsg = errorMsg.slice(`${errorName}: `.length);
    }
    return {
      type: 'ERROR',
      id,
      error: `${errorName}: ${errorMsg}`,
      executionTimeMs,
    };
  }
}

// -----------------------------------------------------------------------------
// WORKER STARTUP HARDENING & LISTENER ATTACHMENT
// -----------------------------------------------------------------------------
// Only activate auto-hardening and message listener in actual dedicated worker contexts
if (typeof self !== 'undefined' && typeof (self as unknown as Worker).postMessage === 'function' && typeof window === 'undefined') {
  setupWorkerCommunication(self as unknown as { postMessage: unknown });
  hardenWorkerGlobalScope();

  // Notify host that worker initialization and hardening has completed
  const notifyReady = _internalPostMessage as ((message: unknown) => void) | null;
  if (notifyReady) {
    notifyReady({ type: 'READY' });
  } else if (typeof (self as unknown as Worker).postMessage === 'function') {
    (self as unknown as Worker).postMessage({ type: 'READY' });
  }

  self.onmessage = (event: MessageEvent<WorkerExecutePayload>) => {
    try {
      const response = processWorkerExecution(event.data);
      const { transferables, ...result } = response;
      if (_internalPostMessage) {
        try {
          if (transferables && transferables.length > 0) {
            _internalPostMessage(result, transferables);
          } else {
            _internalPostMessage(result);
          }
        } catch {
          _internalPostMessage(result);
        }
      } else if (typeof (self as unknown as Worker).postMessage === 'function') {
        (self as unknown as Worker).postMessage(result, transferables as unknown as StructuredSerializeOptions);
      }
    } catch (workerErr) {
      const errMsg = workerErr instanceof Error ? workerErr.message : String(workerErr);
      if (_internalPostMessage) {
        _internalPostMessage({
          type: 'ERROR',
          id: event.data?.id,
          error: `Worker execution handler failed: ${errMsg}`,
          executionTimeMs: 0,
        });
      }
    }
  };
}

