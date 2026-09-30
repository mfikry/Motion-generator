/**
 * Type definitions for Sandboxed Canvas2D Code Execution Engine (v2.0)
 */

export interface SandboxOptions {
  seed?: number;
  random: () => number;
  [key: string]: unknown;
}

export type DrawFrameContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export type DrawFrameFn = (
  ctx: DrawFrameContext,
  t: number,
  width: number,
  height: number,
  opts: SandboxOptions
) => void;

export interface StaticAnalysisResult {
  valid: boolean;
  errors: string[];
}

export interface ExecutionResult {
  success: boolean;
  imageBitmap?: ImageBitmap;
  imageData?: ImageData;
  error?: string;
  timedOut?: boolean;
  executionTimeMs: number;
}

export interface ExecuteFrameParams {
  code: string;
  t: number;
  width: number;
  height: number;
  opts?: {
    seed?: number;
    [key: string]: unknown;
  };
  timeoutMs?: number;
  returnImageData?: boolean;
}

export interface WorkerExecutePayload {
  id: string;
  code: string;
  t: number;
  width: number;
  height: number;
  opts?: {
    seed?: number;
    [key: string]: unknown;
  };
  returnImageData?: boolean;
}

export interface WorkerSuccessPayload {
  type: 'SUCCESS';
  id: string;
  imageBitmap?: ImageBitmap;
  imageData?: ImageData;
  executionTimeMs: number;
}

export interface WorkerErrorPayload {
  type: 'ERROR';
  id: string;
  error: string;
  executionTimeMs: number;
}

export interface WorkerReadyPayload {
  type: 'READY';
}

export type WorkerResponse = WorkerSuccessPayload | WorkerErrorPayload | WorkerReadyPayload;
