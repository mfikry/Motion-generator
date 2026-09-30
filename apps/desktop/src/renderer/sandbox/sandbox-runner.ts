/**
 * Sandbox Scope Isolation & Execution Runner (v2.0)
 *
 * Enforces strict minimal API surface for drawFrame execution:
 * - Only (ctx, t, width, height, opts) are accessible.
 * - Global host variables (self, globalThis, window, document, etc.) are shadowed to undefined.
 * - opts.random() is backed by deterministic Mulberry32 PRNG.
 * - Prototype freezing to prevent prototype pollution or climbing.
 */

import { createPRNG } from '../canvas/prng';
import { assertCodeSafety } from './static-analyzer';
import { DrawFrameContext, DrawFrameFn, SandboxOptions } from './types';

/**
 * List of global variables shadowed to undefined inside the execution scope.
 */
const SHADOWED_GLOBALS = [
  'self',
  'globalThis',
  'window',
  'document',
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'EventSource',
  'Worker',
  'SharedWorker',
  'ServiceWorker',
  'postMessage',
  'onmessage',
  'importScripts',
  'addEventListener',
  'removeEventListener',
  'location',
  'navigator',
  'indexedDB',
  'localStorage',
  'sessionStorage',
  'caches',
  'cookieStore',
  'close',
  'Function',
  'setTimeout',
  'setInterval',
  'setImmediate',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'queueMicrotask',
  'process',
  'require',
  'module',
  'exports',
  '__dirname',
  '__filename',
  'Buffer',
  'alert',
  'prompt',
  'confirm',
] as const;

/**
 * Freeze base prototypes to prevent prototype pollution and climbing.
 * Safe to call multiple times.
 */
let prototypesFrozen = false;
export function freezePrototypes(force: boolean = false): void {
  if (prototypesFrozen) return;
  // Only freeze in dedicated worker environments or when forced,
  // to avoid interfering with Node.js test runner harnesses (Vitest).
  const isDedicatedWorker =
    typeof (globalThis as unknown as { importScripts?: unknown }).importScripts === 'function' || force;
  if (!isDedicatedWorker) return;

  try {
    Object.freeze(Object.prototype);
    Object.freeze(Function.prototype);
    Object.freeze(Array.prototype);
    prototypesFrozen = true;
  } catch {
    // Ignore in environments where prototypes are already frozen or restricted
  }
}

/**
 * Creates a sandboxed execution function from raw JavaScript code.
 *
 * @param code The body of drawFrame(ctx, t, width, height, opts)
 * @returns A callable function executing the sandboxed code
 */
export function createSandboxedRunner(code: string): DrawFrameFn {
  // Pre-execution static analysis gate
  assertCodeSafety(code);

  // Freeze prototypes as an extra defense layer
  freezePrototypes();

  // Create an explicit wrapper function in strict mode
  // Shadow all dangerous identifiers with undefined parameters
  const parameterList = ['ctx', 't', 'width', 'height', 'opts', 'Math', ...SHADOWED_GLOBALS];

  const wrapperSource = `
    "use strict";
    return function(${parameterList.join(', ')}) {
      ${code}
      if (typeof drawFrame === 'function') {
        drawFrame(ctx, t, width, height, opts);
      }
    };
  `;

  // We compile the wrapper via Function constructor (done inside host/runner, not user code)
  const factory = new Function(wrapperSource) as () => (
    ctx: DrawFrameContext,
    t: number,
    width: number,
    height: number,
    opts: SandboxOptions,
    safeMath: Math,
    ...shadows: undefined[]
  ) => void;

  const innerFn = factory();

  const undefinedShadows = new Array<undefined>(SHADOWED_GLOBALS.length).fill(undefined);

  return function executeFrame(
    ctx: DrawFrameContext,
    t: number,
    width: number,
    height: number,
    opts: SandboxOptions
  ): void {
    // Create a safe Math delegate where Math.random() points to opts.random()
    const safeMath = Object.create(Math) as Math;
    safeMath.random = opts.random;

    try {
      innerFn(ctx, t, width, height, opts, safeMath, ...undefinedShadows);
    } catch (err) {
      const errorName = err instanceof Error && err.name ? err.name : 'RuntimeError';
      const errorMsg = err instanceof Error ? err.message : String(err);
      const contextualError = new Error(`${errorName}: ${errorMsg}`);
      contextualError.name = errorName;
      if (err instanceof Error && err.stack) {
        contextualError.stack = err.stack;
      }
      throw contextualError;
    }
  };
}

/**
 * Prepares a secure SandboxOptions object with Mulberry32 seeded PRNG.
 */
export function prepareSandboxOptions(
  seed: number = 1337,
  customOpts: Record<string, unknown> = {}
): SandboxOptions {
  const prng = createPRNG(seed);
  return Object.freeze({
    ...customOpts,
    seed,
    random: prng,
  });
}

/**
 * Executes sandboxed Canvas2D code directly on a given 2D context.
 */
export function executeSandboxedCode(
  ctx: DrawFrameContext,
  code: string,
  t: number,
  width: number,
  height: number,
  opts?: { seed?: number; [key: string]: unknown }
): void {
  const seed = typeof opts?.seed === 'number' ? opts.seed : 1337;
  const safeOpts = prepareSandboxOptions(seed, opts);
  const runner = createSandboxedRunner(code);
  runner(ctx, t, width, height, safeOpts);
}
