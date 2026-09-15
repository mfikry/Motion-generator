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
): { canvas: OffscreenCanvas; ctx: OffscreenCanvasRenderingContext2D } {
  if (!cachedCanvas || cachedCanvas.width !== width || cachedCanvas.height !== height) {
    cachedCanvas = new OffscreenCanvas(width, height);
    cachedCtx = cachedCanvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
  }
  if (!cachedCtx) {
    throw new Error('Failed to obtain 2D rendering context for OffscreenCanvas');
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

    // Clear canvas before drawing
    ctx.clearRect(0, 0, width, height);

    // Execute sandboxed drawFrame
    executeSandboxedCode(ctx, code, t, width, height, opts);

    const executionTimeMs = performance.now() - startTime;

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
      transferables: [imageData.data.buffer],
    };
  } catch (err) {
    const executionTimeMs = performance.now() - startTime;
    return {
      type: 'ERROR',
      id,
      error: err instanceof Error ? err.message : String(err),
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

  self.onmessage = (event: MessageEvent<WorkerExecutePayload>) => {
    const response = processWorkerExecution(event.data);
    const { transferables, ...result } = response;
    if (_internalPostMessage) {
      if (transferables && transferables.length > 0) {
        _internalPostMessage(result, transferables);
      } else {
        _internalPostMessage(result);
      }
    } else if (typeof (self as unknown as Worker).postMessage === 'function') {
      (self as unknown as Worker).postMessage(result, transferables as unknown as StructuredSerializeOptions);
    }
  };
}

