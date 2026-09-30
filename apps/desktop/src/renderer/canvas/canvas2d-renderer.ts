/**
 * Canvas2D Preview Renderer (v2.0)
 *
 * Real-time player for sandboxed Canvas2D motion graphics:
 * - Executes drawFrame(ctx, t, width, height, opts) via unified SandboxedCodeExecutor.
 * - Supports Play, Pause, Seek, Reset controls.
 * - Handles normalized progress t (0.0 to 1.0) scaled by duration.
 * - Supports Green Screen toggle and transparency checkerboard.
 * - Responsive aspect ratio scaling.
 * - Zero-copy ImageBitmap rendering from Web Worker with in-flight frame throttling.
 */

import { SandboxedCodeExecutor } from '../sandbox/sandboxed-code-executor';
import { assertCodeSafety } from '../sandbox/static-analyzer';

export interface Canvas2DRendererOptions {
  greenScreen?: boolean;
  backgroundColor?: string;
  seed?: number;
  executor?: SandboxedCodeExecutor;
}

export interface Canvas2DPlaybackCallbacks {
  onTimeUpdate?: (timeSec: number) => void;
  onPlaybackChange?: (isPlaying: boolean) => void;
  onFpsUpdate?: (fps: number) => void;
  onEnded?: () => void;
  onError?: (error: Error) => void;
}

export class Canvas2DPreviewRenderer {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private executor: SandboxedCodeExecutor;
  private ownsExecutor: boolean;
  private code: string | null = null;

  // Playback state
  private isPlaying: boolean = false;
  private currentTime: number = 0; // Current time in seconds
  private duration: number = 15; // Duration in seconds (from UI setting)
  private rafId: number | null = null;
  private lastFrameTimestamp: number = 0;
  private fpsCounter: number = 0;
  private lastFpsTimestamp: number = 0;

  // Real-time frame throttling
  private isFrameInFlight: boolean = false;
  private pendingT: number | null = null;

  // Canvas configuration
  private targetWidth: number = 1080;
  private targetHeight: number = 1080;
  private options: Canvas2DRendererOptions = {};
  private callbacks: Canvas2DPlaybackCallbacks = {};

  constructor(executor?: SandboxedCodeExecutor) {
    this.executor = executor ?? new SandboxedCodeExecutor({ defaultTimeoutMs: 300 });
    this.ownsExecutor = !executor;
  }

  /**
   * Initializes the renderer with a canvas element.
   */
  public async init(
    canvas: HTMLCanvasElement,
    code?: string,
    options: Canvas2DRendererOptions = {},
    callbacks: Canvas2DPlaybackCallbacks = {}
  ): Promise<void> {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    if (!this.ctx) {
      throw new Error('Failed to get 2D context from preview canvas.');
    }

    this.options = { ...options };
    this.callbacks = { ...callbacks };

    if (options.executor) {
      if (this.ownsExecutor) {
        this.executor.dispose();
      }
      this.executor = options.executor;
      this.ownsExecutor = false;
    }

    this.executor.warmup();

    if (code) {
      this.loadCode(code);
    } else {
      await this.renderCurrentFrame();
    }
  }

  /**
   * Loads a new Canvas2D procedural script and renders initial frame.
   */
  public async loadCode(code: string): Promise<void> {
    // 1. Static analysis gate upfront
    assertCodeSafety(code);
    this.code = code;

    // 2. Render initial frame
    await this.renderCurrentFrame();
  }

  public getCode(): string | null {
    return this.code;
  }

  /**
   * Set animation duration in seconds (from UI timeAnim).
   */
  public setDuration(durationSec: number): void {
    this.duration = Math.max(0.1, durationSec);
    if (this.currentTime > this.duration) {
      this.currentTime = this.duration;
    }
  }

  /**
   * Set target aspect ratio dimensions (e.g. 1920x1080, 1080x1920, 1080x1080).
   */
  public setTargetDimensions(width: number, height: number): void {
    this.targetWidth = width;
    this.targetHeight = height;
    if (this.canvas) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    this.renderCurrentFrame().catch(() => {});
  }

  /**
   * Resize canvas display size.
   */
  public resize(_width: number, _height: number): void {
    if (!this.canvas) return;
    if (this.canvas.width !== this.targetWidth || this.canvas.height !== this.targetHeight) {
      this.canvas.width = this.targetWidth;
      this.canvas.height = this.targetHeight;
    }
    this.renderCurrentFrame().catch(() => {});
  }

  /**
   * Start animation playback.
   */
  public play(): void {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.lastFrameTimestamp = performance.now();
    this.lastFpsTimestamp = performance.now();
    this.fpsCounter = 0;
    this.callbacks.onPlaybackChange?.(true);
    this.startRafLoop();
  }

  /**
   * Pause animation playback.
   */
  public pause(): void {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    this.stopRafLoop();
    this.callbacks.onPlaybackChange?.(false);
  }

  /**
   * Seek to a specific timestamp in seconds.
   */
  public seek(timeSec: number): void {
    this.currentTime = Math.max(0, Math.min(this.duration, timeSec));
    this.renderCurrentFrame().catch(() => {});
    this.callbacks.onTimeUpdate?.(this.currentTime);
  }

  /**
   * Reset playback to start (t = 0).
   */
  public reset(): void {
    this.pause();
    this.seek(0);
  }

  /**
   * Main RAF animation tick.
   */
  private startRafLoop(): void {
    const tick = (now: number) => {
      if (!this.isPlaying) return;

      const deltaMs = now - this.lastFrameTimestamp;
      this.lastFrameTimestamp = now;

      // Advance time
      this.currentTime += deltaMs / 1000;
      if (this.currentTime >= this.duration) {
        // Seamless loop wrap
        this.currentTime = this.currentTime % this.duration;
      }

      const t = this.duration > 0 ? (this.currentTime / this.duration) % 1.0 : 0.0;

      // Real-time throttling: only dispatch if worker is ready, else queue latest t
      if (!this.isFrameInFlight) {
        this.dispatchFrame(t).catch(() => {});
      } else {
        this.pendingT = t;
      }

      this.callbacks.onTimeUpdate?.(this.currentTime);

      // FPS calculation
      this.fpsCounter++;
      if (now - this.lastFpsTimestamp >= 1000) {
        const currentFps = Math.round((this.fpsCounter * 1000) / (now - this.lastFpsTimestamp));
        this.callbacks.onFpsUpdate?.(currentFps);
        this.fpsCounter = 0;
        this.lastFpsTimestamp = now;
      }

      this.rafId = requestAnimationFrame(tick);
    };

    this.rafId = requestAnimationFrame(tick);
  }

  private stopRafLoop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /**
   * Clears the display canvas.
   */
  private clearCanvas(): void {
    if (!this.ctx) return;
    if (this.options.greenScreen) {
      this.ctx.fillStyle = '#00B140';
      this.ctx.fillRect(0, 0, this.targetWidth, this.targetHeight);
    } else {
      this.ctx.clearRect(0, 0, this.targetWidth, this.targetHeight);
    }
  }

  /**
   * Renders a single frame at the current timestamp.
   */
  public async renderCurrentFrame(): Promise<void> {
    const t = this.duration > 0 ? (this.currentTime / this.duration) % 1.0 : 0.0;
    await this.dispatchFrame(t);
  }

  /**
   * Dispatches frame rendering to the unified SandboxedCodeExecutor.
   */
  private async dispatchFrame(t: number): Promise<void> {
    if (!this.canvas || !this.ctx) return;

    if (!this.code) {
      this.clearCanvas();
      return;
    }

    if (this.isFrameInFlight) {
      this.pendingT = t;
      return;
    }

    this.isFrameInFlight = true;
    const width = this.targetWidth;
    const height = this.targetHeight;

    try {
      const result = await this.executor.executeFrame({
        code: this.code,
        t,
        width,
        height,
        opts: { seed: this.options.seed ?? 1337 },
        timeoutMs: 300,
      });

      if (!result.success) {
        throw new Error(result.error || 'Canvas2D execution error');
      }

      if (this.ctx) {
        this.clearCanvas();

        if (result.imageBitmap) {
          this.ctx.drawImage(result.imageBitmap, 0, 0, width, height);
          result.imageBitmap.close();
        } else if (result.imageData) {
          this.ctx.putImageData(result.imageData, 0, 0);
        }
      }
    } catch (err) {
      this.stopRafLoop();
      this.isPlaying = false;
      this.callbacks.onPlaybackChange?.(false);
      this.clearCanvas();

      const error = err instanceof Error ? err : new Error(String(err));
      this.callbacks.onError?.(error);
      throw error;
    } finally {
      this.isFrameInFlight = false;
      if (this.pendingT !== null) {
        const nextT = this.pendingT;
        this.pendingT = null;
        this.dispatchFrame(nextT).catch(() => {});
      }
    }
  }

  /**
   * Update settings (e.g. green screen).
   */
  public updateSettings(options: Partial<Canvas2DRendererOptions>): void {
    this.options = { ...this.options, ...options };
    this.renderCurrentFrame().catch(() => {});
  }

  /**
   * Cleans up all resources and RAF timers.
   */
  public destroy(): void {
    this.stopRafLoop();
    if (this.ownsExecutor) {
      this.executor.dispose();
    }
    this.ctx = null;
    this.canvas = null;
  }
}
