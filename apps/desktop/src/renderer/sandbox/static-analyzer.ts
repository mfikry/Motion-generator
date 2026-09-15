/**
 * Static Analysis Pre-Execution Scanner for Canvas2D Code (v2.0)
 *
 * Scans JavaScript code strings before execution to detect and reject dangerous
 * identifiers, bypass techniques, reflection, global access, and I/O mechanisms.
 */

import { StaticAnalysisResult } from './types';

/**
 * Forbidden standalone identifiers (word boundaries).
 */
export const FORBIDDEN_IDENTIFIERS = [
  // Network / I/O
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'EventSource',
  'sendBeacon',
  'openDatabase',

  // Dynamic code evaluation & generation
  'eval',
  'Function',
  'AsyncFunction',
  'GeneratorFunction',
  'WebAssembly',
  'importScripts',

  // Module loading & Node.js environment
  'import',
  'require',
  'module',
  'exports',
  'process',
  '__dirname',
  '__filename',
  'Buffer',

  // Global host & window objects
  'window',
  'document',
  'globalThis',
  'self',
  'top',
  'parent',
  'frames',
  'global',

  // Storage & databases
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'cookieStore',
  'caches',

  // Threading, Worker & Event Messaging
  'Worker',
  'SharedWorker',
  'ServiceWorker',
  'postMessage',
  'onmessage',
  'addEventListener',
  'removeEventListener',

  // Browser navigation, UI & location
  'location',
  'navigator',
  'alert',
  'prompt',
  'confirm',
  'open',
  'close',

  // Prototype climbing & reflection
  'constructor',
  '__proto__',
  'prototype',
  'Reflect',
  'Proxy',

  // Obfuscation helpers
  'atob',
  'btoa',

  // Timers (frame rendering should be a pure function of t)
  'setTimeout',
  'setInterval',
  'setImmediate',
  'requestAnimationFrame',
  'cancelAnimationFrame',
] as const;

/**
 * Set for O(1) lookup
 */
export const FORBIDDEN_IDENTIFIERS_SET = new Set<string>(FORBIDDEN_IDENTIFIERS);

/**
 * Decodes unicode (\uXXXX) and hex (\xXX) escape sequences in string.
 */
function decodeEscapes(code: string): string {
  return code
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * Strip comments (both single-line and multi-line) to analyze code tokens accurately.
 * Also preserves newlines to maintain line numbers if needed.
 */
function stripComments(code: string): string {
  // Replace multi-line comments with spaces
  let cleaned = code.replace(/\/\*[\s\S]*?\*\//g, ' ');
  // Replace single-line comments with spaces
  cleaned = cleaned.replace(/\/\/.*$/gm, ' ');
  return cleaned;
}

/**
 * Scans JS code string for dangerous patterns and forbidden identifiers.
 *
 * @param code Raw JavaScript code string (body of drawFrame)
 * @returns StaticAnalysisResult with valid boolean and array of error messages
 */
export function analyzeCodeSafety(code: string): StaticAnalysisResult {
  const errors: string[] = [];

  if (!code || typeof code !== 'string' || code.trim().length === 0) {
    return {
      valid: false,
      errors: ['Code must be a non-empty string.'],
    };
  }

  // 1. Decode escape sequences to detect hidden identifiers (e.g. \u0065val -> eval)
  const decoded = decodeEscapes(code);

  // 2. Remove comments so comments don't hide code or falsely trigger
  const cleaned = stripComments(decoded);

  // 3. Check for forbidden word boundaries
  for (const identifier of FORBIDDEN_IDENTIFIERS) {
    const regex = new RegExp(`\\b${identifier}\\b`);
    if (regex.test(cleaned)) {
      errors.push(`Forbidden identifier detected: '${identifier}'. Direct access is prohibited.`);
    }
  }

  // 4. Check for property access bypassing (dot notation for dangerous properties)
  // e.g. something.constructor, something.__proto__, something.prototype
  const dotAccessRegex = /\.\s*(constructor|__proto__|prototype|eval|fetch|window|document|process)\b/;
  if (dotAccessRegex.test(cleaned)) {
    const match = cleaned.match(dotAccessRegex);
    const prop = match ? match[1] : 'dangerous property';
    errors.push(`Forbidden property access via dot notation: '.${prop}'.`);
  }

  // 5. Check for bracket notation property access with string literals
  // e.g. obj['constructor'], obj["__proto__"], obj[`fetch`]
  const bracketLiteralRegex =
    /\[\s*['"`]\s*(constructor|__proto__|prototype|fetch|eval|Function|window|document|process|localStorage|indexedDB|globalThis|self|postMessage|importScripts|location|navigator)\s*['"`]\s*\]/;
  if (bracketLiteralRegex.test(cleaned)) {
    const match = cleaned.match(bracketLiteralRegex);
    const prop = match ? match[1] : 'dangerous property';
    errors.push(`Forbidden property access via bracket notation: '["${prop}"]'.`);
  }

  // 6. Check for concatenated string bypass inside bracket access
  // e.g. this['con' + 'structor'], window['loc' + 'ation']
  const bracketConcatRegex = /\[\s*['"`][^\]]*\+[^\]]*['"`]\s*\]/;
  if (bracketConcatRegex.test(cleaned)) {
    // Check if the concatenation contains substrings of forbidden keys
    for (const id of ['constructor', '__proto__', 'eval', 'fetch', 'window', 'document', 'process']) {
      const half1 = id.slice(0, Math.ceil(id.length / 2));
      const half2 = id.slice(Math.ceil(id.length / 2));
      if (cleaned.includes(half1) && cleaned.includes(half2)) {
        errors.push(`Suspected concatenated forbidden property access targeting '${id}'.`);
        break;
      }
    }
    if (!errors.some((e) => e.includes('concatenated'))) {
      errors.push('Suspicious string concatenation inside property lookup brackets.');
    }
  }

  // 7. Check for import() call expression
  if (/import\s*\(/.test(cleaned)) {
    errors.push("Dynamic import 'import()' is strictly forbidden.");
  }

  // 8. Check for Function() call expression or constructor pattern
  if (/Function\s*\(/.test(cleaned)) {
    errors.push("Function constructor 'Function()' is strictly forbidden.");
  }

  // Deduplicate errors
  const uniqueErrors = Array.from(new Set(errors));

  return {
    valid: uniqueErrors.length === 0,
    errors: uniqueErrors,
  };
}

/**
 * Asserts code safety. Throws an Error if code violates security policy.
 */
export function assertCodeSafety(code: string): void {
  const result = analyzeCodeSafety(code);
  if (!result.valid) {
    throw new Error(`Security Policy Violation:\n- ${result.errors.join('\n- ')}`);
  }
}
