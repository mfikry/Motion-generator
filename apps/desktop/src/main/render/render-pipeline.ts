/**
 * Render Pipeline Orchestrator (E8 — Phase 1)
 *
 * Coordinates frame-by-frame rendering of Canvas2D code into a video file:
 * 1. Reads code_text from database (or uses provided code directly).
 * 2. Spawns a hidden offscreen BrowserWindow running SandboxedCodeExecutor.
 * 3. Sequentially renders each frame at t = frameIndex / totalFrames.
 * 4. Pipes raw RGBA pixels to FFmpeg for encoding.
 * 5. Reports progress to the renderer UI via IPC events.
 *
 * Guarantees: "What you preview is what you render" — same execution engine.
 * Determinism: Same code + seed = identical output (PRNG is reset per frame).
 */

import { BrowserWindow } from 'electron';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { getDatabase } from '../storage/database';
import { FFmpegEncoder, findFFmpegBinary, probeFFmpeg } from './ffmpeg-encoder';
import { OffscreenRenderManager } from './offscreen-manager';
import type {
  RenderStartParams,
  RenderProgress,
  RenderCompleteResult,
  RenderErrorResult,
} from '@genc/shared-types';

export type RenderJobState = 'idle' | 'initializing' | 'rendering' | 'finalizing' | 'done' | 'failed' | 'cancelled';

export interface ActiveRenderJob {
  id: string;
  state: RenderJobState;
  params: RenderStartParams;
  currentFrame: number;
  totalFrames: number;
  startTime: number;
  cancelled: boolean;
}

/**
 * Emits render events to all renderer windows.
 */
function emitToAllWindows(channel: string, data: unknown): void {
  const windows = BrowserWindow?.getAllWindows ? BrowserWindow.getAllWindows() : [];
  for (const win of windows) {
    if (win && !win.isDestroyed?.()) {
      try {
        win.webContents?.send(channel, data);
      } catch {
        // Ignore send errors for destroyed/closing windows
      }
    }
  }
}

export class RenderPipeline {
  private activeJob: ActiveRenderJob | null = null;
  private offscreen: OffscreenRenderManager | null = null;
  private encoder: FFmpegEncoder | null = null;

  /**
   * Starts a new render job.
   * Returns the job ID if started successfully.
   */
  public async startRender(params: RenderStartParams): Promise<{ jobId: string }> {
    if (this.activeJob && this.activeJob.state !== 'idle' && this.activeJob.state !== 'done' && this.activeJob.state !== 'failed' && this.activeJob.state !== 'cancelled') {
      throw new Error('A render job is already in progress. Cancel it first.');
    }

    // 1. Resolve code
    const code = await this.resolveCode(params);
    if (!code) {
      throw new Error(`No code found for generation ID "${params.generationId}"`);
    }

    // 2. Create job
    const jobId = `render_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const totalFrames = Math.ceil(params.durationSec * params.fps);

    this.activeJob = {
      id: jobId,
      state: 'initializing',
      params,
      currentFrame: 0,
      totalFrames,
      startTime: Date.now(),
      cancelled: false,
    };

    // 3. Run render loop asynchronously (don't block IPC response)
    this.runRenderLoop(jobId, code, params, totalFrames).catch((err) => {
      this.handleError(jobId, err instanceof Error ? err.message : String(err), 'render-loop');
    });

    return { jobId };
  }

  /**
   * Cancels the active render job.
   */
  public cancelRender(jobId: string): void {
    if (this.activeJob?.id === jobId) {
      this.activeJob.cancelled = true;
      this.activeJob.state = 'cancelled';
      this.encoder?.cancel();
      this.cleanup();
    }
  }

  /**
   * Main render loop: init → render frames → encode → finalize.
   */
  private async runRenderLoop(
    jobId: string,
    code: string,
    params: RenderStartParams,
    totalFrames: number
  ): Promise<void> {
    try {
      // Step 1: Verify FFmpeg LGPL compliance
      this.emitProgress(jobId, 0, totalFrames, 'rendering', 0);
      const ffmpegPath = findFFmpegBinary();
      const probe = await probeFFmpeg(ffmpegPath);

      if (!probe.isLGPL) {
        throw new Error(
          'CRITICAL: FFmpeg binary is GPL-licensed (has --enable-gpl). ' +
          'Cannot use for commercial rendering. Install LGPL build.'
        );
      }

      // Step 2: Initialize offscreen BrowserWindow
      if (this.isCancelled(jobId)) return;
      this.offscreen = new OffscreenRenderManager();
      await this.offscreen.init();

      // Step 3: Initialize FFmpeg encoder
      if (this.isCancelled(jobId)) return;
      this.encoder = new FFmpegEncoder({
        outputPath: params.outputPath,
        width: params.width,
        height: params.height,
        fps: params.fps,
        bitrateKbps: params.bitrateKbps,
        format: params.format,
        rateControl: params.rateControl ?? 'cbr',
        computeMode: params.computeMode ?? 'cpu',
        greenScreen: params.greenScreen ?? false,
        ffmpegPath,
      });
      await this.encoder.start();

      const usedEncoder = this.encoder.getUsedEncoder();
      const computeModeUsed = this.encoder.getComputeModeUsed();
      const fallbackWarning = this.encoder.getFallbackWarning();
      const hasAlpha = this.encoder.getHasAlpha();

      // Step 4: Render frames sequentially
      if (this.activeJob) this.activeJob.state = 'rendering';
      const startTime = Date.now();

      for (let i = 0; i < totalFrames; i++) {
        if (this.isCancelled(jobId)) {
          this.cleanup();
          return;
        }

        const t = totalFrames > 1 ? i / totalFrames : 0;

        // Render frame via offscreen BrowserWindow
        const frameResult = await this.offscreen!.renderFrame(
          code,
          t,
          params.width,
          params.height,
          params.seed,
          {
            greenScreen: params.greenScreen ?? false,
            transparent: !(params.greenScreen ?? false) && hasAlpha,
            hasAlpha,
          },
          10000 // 10s timeout per frame (4K can be slow)
        );

        if (!frameResult.success || !frameResult.pixelBuffer) {
          throw new Error(
            `Frame ${i}/${totalFrames} failed: ${frameResult.error ?? 'No pixel data returned'}`
          );
        }

        // Pipe frame to FFmpeg
        await this.encoder!.writeFrame(frameResult.pixelBuffer);

        // Update progress
        if (this.activeJob) this.activeJob.currentFrame = i + 1;
        const elapsedMs = Date.now() - startTime;
        const framesRemaining = totalFrames - (i + 1);
        const msPerFrame = elapsedMs / (i + 1);
        const estimatedRemainingMs = framesRemaining * msPerFrame;

        this.emitProgress(
          jobId,
          i + 1,
          totalFrames,
          'rendering',
          elapsedMs,
          estimatedRemainingMs,
          usedEncoder,
          computeModeUsed,
          fallbackWarning
        );
      }

      // Step 5: Finalize encoding
      if (this.isCancelled(jobId)) {
        this.cleanup();
        return;
      }

      if (this.activeJob) this.activeJob.state = 'finalizing';
      this.emitProgress(
        jobId,
        totalFrames,
        totalFrames,
        'finalizing',
        Date.now() - startTime,
        0,
        usedEncoder,
        computeModeUsed,
        fallbackWarning
      );

      const finalResult = await this.encoder!.finalize();

      if (finalResult.exitCode !== 0) {
        throw new Error(
          `FFmpeg encoding failed (exit code ${finalResult.exitCode}):\n${finalResult.stderr}`
        );
      }

      // Step 6: Verify output file exists
      if (!fs.existsSync(params.outputPath)) {
        throw new Error('FFmpeg completed but output file was not created.');
      }

      const fileStats = fs.statSync(params.outputPath);
      const elapsedMs = Date.now() - startTime;

      // Success
      if (this.activeJob) this.activeJob.state = 'done';

      const completeResult: RenderCompleteResult = {
        jobId,
        outputPath: params.outputPath,
        durationSec: params.durationSec,
        totalFrames,
        fileSizeBytes: fileStats.size,
        elapsedMs,
        usedEncoder,
        computeModeUsed,
        hasAlpha,
        fallbackWarning,
      };

      emitToAllWindows('render:complete', completeResult);

      // Save to render_jobs table
      this.saveJobResult(jobId, params, 'done', elapsedMs, fileStats.size, undefined, computeModeUsed);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.handleError(jobId, errorMsg, this.activeJob?.state ?? 'unknown');
    } finally {
      this.cleanup();
    }
  }

  /**
   * Checks if the current job has been cancelled.
   */
  private isCancelled(jobId: string): boolean {
    return this.activeJob?.id === jobId && this.activeJob.cancelled;
  }

  /**
   * Resolves the Canvas2D code to render.
   */
  private async resolveCode(params: RenderStartParams): Promise<string | null> {
    // Direct code takes precedence
    if (params.code) return params.code;

    // Look up from database
    try {
      const db = getDatabase();
      const row = db.prepare('SELECT code_text FROM generations WHERE id = ?').get(params.generationId) as
        | { code_text: string | null }
        | undefined;
      return row?.code_text ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Emits a progress update to all renderer windows.
   */
  private emitProgress(
    jobId: string,
    currentFrame: number,
    totalFrames: number,
    phase: 'rendering' | 'encoding' | 'finalizing',
    elapsedMs: number,
    estimatedRemainingMs?: number,
    usedEncoder?: string,
    computeModeUsed?: 'cpu' | 'gpu',
    fallbackWarning?: string
  ): void {
    const progress: RenderProgress = {
      jobId,
      currentFrame,
      totalFrames,
      percent: totalFrames > 0 ? Math.round((currentFrame / totalFrames) * 100) : 0,
      phase,
      elapsedMs,
      estimatedRemainingMs,
      usedEncoder,
      computeModeUsed,
      fallbackWarning,
    };

    emitToAllWindows('render:progress', progress);
  }

  /**
   * Handles render errors by emitting error events and cleaning up.
   */
  private handleError(jobId: string, error: string, phase: string): void {
    if (this.activeJob) this.activeJob.state = 'failed';

    const errorResult: RenderErrorResult = {
      jobId,
      error,
      phase,
      currentFrame: this.activeJob?.currentFrame,
      totalFrames: this.activeJob?.totalFrames,
    };

    emitToAllWindows('render:error', errorResult);

    // Save failure to DB
    if (this.activeJob?.params) {
      this.saveJobResult(jobId, this.activeJob.params, 'failed', Date.now() - (this.activeJob?.startTime ?? Date.now()), 0, error);
    }
  }

  /**
   * Cleans up offscreen window and encoder resources.
   */
  private cleanup(): void {
    if (this.offscreen) {
      this.offscreen.dispose();
      this.offscreen = null;
    }
    // Don't cancel encoder here — it may be finalizing
    this.encoder = null;
  }

  /**
   * Saves render job result to the render_jobs table.
   */
  private saveJobResult(
    jobId: string,
    params: RenderStartParams,
    status: string,
    elapsedMs: number,
    fileSizeBytes: number,
    errorMessage?: string,
    computeModeUsed: 'cpu' | 'gpu' = 'cpu'
  ): void {
    try {
      const db = getDatabase();
      db.prepare(
        `INSERT OR REPLACE INTO render_jobs (id, generation_id, status, resolution, fps, format, compute_mode, bitrate, output_path, error_message, started_at, finished_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-' || ? || ' seconds'), datetime('now'))`
      ).run(
        jobId,
        params.generationId,
        status,
        `${params.width}x${params.height}`,
        params.fps,
        params.format,
        computeModeUsed,
        params.bitrateKbps,
        params.outputPath,
        errorMessage ?? null,
        Math.round(elapsedMs / 1000)
      );
    } catch {
      // Non-critical — don't fail the render for a DB write error
    }
  }

  /**
   * Returns the current active job state, or null if no job is running.
   */
  public getActiveJob(): ActiveRenderJob | null {
    return this.activeJob;
  }
}
