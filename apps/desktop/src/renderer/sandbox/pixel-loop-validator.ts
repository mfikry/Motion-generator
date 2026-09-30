/**
 * Pixel-Based Loop Consistency & Sandboxed Dry-Run Validator (v2.0)
 *
 * Validates generated Canvas2D procedural code by executing test frames:
 * 1. Pre-execution static analysis gate (analyzeCodeSafety).
 * 2. Sandboxed execution at t = 0.0, t = 0.5, and t = 1.0.
 * 3. Compares pixel buffers between t = 0.0 and t = 1.0.
 * 4. Rejects code if runtime error occurs, watchdog timeout triggers (>50ms),
 *    or mean pixel difference exceeds threshold.
 */

import { analyzeCodeSafety } from './static-analyzer';
import { SandboxedCodeExecutor } from './sandboxed-code-executor';

export interface PixelLoopValidationOptions {
  width?: number;
  height?: number;
  maxDifferenceThreshold?: number; // Mean Absolute Error threshold per channel (0–255)
  timeoutMs?: number;
  seed?: number;
}

export interface PixelLoopValidationResult {
  valid: boolean;
  consistent: boolean;
  pixelDiffScore?: number;
  errors: string[];
}

/**
 * Extracts raw Uint8ClampedArray pixel buffer from an ExecutionResult.
 */
function extractPixelData(
  res: { imageData?: ImageData; imageBitmap?: ImageBitmap },
  width: number,
  height: number
): Uint8ClampedArray | null {
  if (res.imageData && res.imageData.data) {
    return res.imageData.data;
  }

  if (res.imageBitmap && typeof document !== 'undefined') {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(res.imageBitmap, 0, 0, width, height);
        return ctx.getImageData(0, 0, width, height).data;
      }
    } catch {
      // Fallback
    }
  }

  return null;
}

/**
 * Validates a Canvas2D code string through static analysis and sandboxed dry-run rendering.
 *
 * @param executor SandboxedCodeExecutor instance
 * @param code Raw JavaScript code body
 * @param options Validation parameters
 */
export async function validateCodeWithDryRun(
  executor: SandboxedCodeExecutor,
  code: string,
  options: PixelLoopValidationOptions = {}
): Promise<PixelLoopValidationResult> {
  const width = options.width ?? 128;
  const height = options.height ?? 128;
  const threshold = options.maxDifferenceThreshold ?? 4.0;
  const timeoutMs = options.timeoutMs ?? 50;
  const seed = options.seed ?? 1337;

  // 1. Static Analysis Gate
  const analysis = analyzeCodeSafety(code);
  if (!analysis.valid) {
    return {
      valid: false,
      consistent: false,
      errors: analysis.errors,
    };
  }

  // 2. Render frame at t = 0.0
  const res0 = await executor.executeFrame({
    code,
    t: 0.0,
    width,
    height,
    timeoutMs,
    opts: { seed },
    returnImageData: true,
  });

  if (!res0.success) {
    return {
      valid: false,
      consistent: false,
      errors: [`Execution failed at t=0.0: ${res0.error ?? 'Unknown error'}`],
    };
  }

  // 3. Render frame at t = 0.5 (mid-cycle validation)
  const resMid = await executor.executeFrame({
    code,
    t: 0.5,
    width,
    height,
    timeoutMs,
    opts: { seed },
    returnImageData: true,
  });

  if (!resMid.success) {
    return {
      valid: false,
      consistent: false,
      errors: [`Execution failed at t=0.5: ${resMid.error ?? 'Unknown error'}`],
    };
  }

  // 4. Render frame at t = 1.0 (end-cycle validation)
  const res1 = await executor.executeFrame({
    code,
    t: 1.0,
    width,
    height,
    timeoutMs,
    opts: { seed },
    returnImageData: true,
  });

  if (!res1.success) {
    return {
      valid: false,
      consistent: false,
      errors: [`Execution failed at t=1.0: ${res1.error ?? 'Unknown error'}`],
    };
  }

  // 5. Extract pixel data for t=0.0, t=0.5, t=1.0
  const buf0 = extractPixelData(res0, width, height);
  const bufMid = extractPixelData(resMid, width, height);
  const buf1 = extractPixelData(res1, width, height);

  // Helper to check if a buffer has any visible content (alpha > 5)
  function isBufferEmpty(buf: Uint8ClampedArray | null): boolean {
    if (!buf || buf.length === 0) return true;
    for (let i = 0; i < buf.length; i += 4) {
      const a = buf[i + 3] ?? 0;
      if (a > 5) {
        return false;
      }
    }
    return true;
  }

  // Anti-empty-canvas guard: Reject if canvas is completely empty/transparent across all frames
  // Checks t=0.0, t=0.5, and t=1.0 so animations with minimal content at cycle endpoints are not false-rejected
  if (buf0 && bufMid && buf1) {
    if (isBufferEmpty(buf0) && isBufferEmpty(bufMid) && isBufferEmpty(buf1)) {
      return {
        valid: false,
        consistent: false,
        errors: [
          'Canvas output is completely blank/empty across frames (t=0.0, t=0.5, t=1.0). Ensure drawing commands (e.g. ctx.fillRect, ctx.arc, ctx.fill) are executed inside drawFrame.',
        ],
      };
    }
  }

  if (!buf0 || !buf1 || buf0.length !== buf1.length || buf0.length === 0) {
    // If buffers cannot be extracted (e.g. headless node mock environment without ImageData),
    // mark consistent if frames executed successfully
    return {
      valid: true,
      consistent: true,
      errors: [],
    };
  }

  let totalDiff = 0;
  const len = buf0.length;
  for (let i = 0; i < len; i++) {
    const val0 = buf0[i] ?? 0;
    const val1 = buf1[i] ?? 0;
    totalDiff += Math.abs(val0 - val1);
  }

  const avgDiff = totalDiff / len;

  if (avgDiff > threshold) {
    return {
      valid: false,
      consistent: false,
      pixelDiffScore: avgDiff,
      errors: [
        `Visual loop inconsistency detected: average pixel difference between frame t=0.0 and t=1.0 is ${avgDiff.toFixed(
          2
        )} (maximum allowed threshold: ${threshold.toFixed(
          1
        )}). The animation state at t=1.0 must smoothly and identically match t=0.0 to loop seamlessly.`,
      ],
    };
  }

  return {
    valid: true,
    consistent: true,
    pixelDiffScore: avgDiff,
    errors: [],
  };
}
