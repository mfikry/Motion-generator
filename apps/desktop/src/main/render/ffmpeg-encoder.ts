/**
 * FFmpeg Encoder — Raw RGBA Frame Pipe → MP4/MOV/WebM (E8 Phase 2)
 *
 * Manages an FFmpeg subprocess that receives raw RGBA pixel data on stdin
 * and produces an encoded video file.
 *
 * FEATURES:
 * - Alpha Channel Export: ProRes 4444 (MOV) & VP9 (WebM) with native transparency.
 * - Hardware GPU Acceleration: Auto-detects NVIDIA (NVENC), AMD (AMF), Intel (QSV),
 *   and Windows Media Foundation (MF), with automatic fallback to CPU (libopenh264) + user warning.
 * - Precision Bitrate Control: CBR (strict constant) and VBR (variable) modes.
 *
 * LICENSING:
 * - FFmpeg binary MUST be LGPL-only (no --enable-gpl).
 * - ProRes 4444: prores_ks (native LGPL FFmpeg encoder).
 * - VP9: libvpx-vp9 (BSD 3-Clause, royalty-free).
 * - H.264 CPU: libopenh264 (BSD, Cisco) — NOT libx264 (GPL).
 * - H.264 GPU: NVENC/AMF/QSV/MF (LGPL-compliant dynamic loading).
 */

import { spawn, ChildProcess, execFile } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { app } from 'electron';
import type { GpuDeviceInfo, ComputeMode, RateControl } from '@genc/shared-types';

export interface FFmpegEncoderOptions {
  /** Output file path */
  outputPath: string;
  /** Frame width in pixels */
  width: number;
  /** Frame height in pixels */
  height: number;
  /** Frames per second */
  fps: number;
  /** Target bitrate in kbps */
  bitrateKbps: number;
  /** Export format: 'mp4' | 'mov' | 'webm' */
  format: 'mp4' | 'mov' | 'webm';
  /** Rate control mode: 'cbr' (constant) | 'vbr' (variable) */
  rateControl?: RateControl;
  /** Compute mode: 'cpu' (software) | 'gpu' (hardware accelerated) */
  computeMode?: ComputeMode;
  /** Green screen active: true = solid green bg (#00B140), false = transparent alpha */
  greenScreen?: boolean;
  /** Explicit alpha channel override */
  hasAlpha?: boolean;
  /** Custom FFmpeg binary path (overrides auto-detection) */
  ffmpegPath?: string;
}

export interface FFmpegProbeResult {
  path: string;
  version: string;
  isLGPL: boolean;
  hasOpenH264: boolean;
  hasH264MF: boolean;
  buildConfiguration: string;
}

/**
 * Locates the FFmpeg binary, preferring the bundled LGPL build.
 */
export function findFFmpegBinary(customPath?: string): string {
  if (customPath && fs.existsSync(customPath)) {
    return customPath;
  }

  const vendorPaths = [
    // Development: check relative to cwd and __dirname
    path.join(process.cwd(), 'apps/desktop/vendor/ffmpeg/ffmpeg.exe'),
    path.join(process.cwd(), 'vendor/ffmpeg/ffmpeg.exe'),
    path.join(__dirname, '../../vendor/ffmpeg/ffmpeg.exe'),
    path.join(__dirname, '../../../vendor/ffmpeg/ffmpeg.exe'),
    path.join(__dirname, '../../../../vendor/ffmpeg/ffmpeg.exe'),
    // Production: relative to app.asar
    path.join(app?.getAppPath?.() ?? '', 'vendor/ffmpeg/ffmpeg.exe'),
    // Extraresources (electron-builder pattern)
    path.join(process.resourcesPath ?? '', 'ffmpeg/ffmpeg.exe'),
    path.join(process.resourcesPath ?? '', 'vendor/ffmpeg/ffmpeg.exe'),
  ];

  for (const p of vendorPaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  // Fallback to system PATH
  return 'ffmpeg';
}

/**
 * Probes the FFmpeg binary to verify licensing compliance and configuration.
 * CRITICAL: Rejects GPL builds to protect commercial license compliance.
 */
export async function probeFFmpeg(ffmpegPath: string): Promise<FFmpegProbeResult> {
  return new Promise((resolve, reject) => {
    execFile(ffmpegPath, ['-version'], { timeout: 10000 }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(`FFmpeg not found or failed to run at "${ffmpegPath}": ${err.message}`));
        return;
      }

      const output = stdout + '\n' + stderr;
      const versionMatch = output.match(/ffmpeg version\s+(\S+)/);
      const version = versionMatch?.[1] ?? 'unknown';
      const configLine = output.match(/configuration:\s*(.+)/)?.[1] ?? '';

      const isGPL = configLine.includes('--enable-gpl');
      const isLGPL = !isGPL;
      const hasOpenH264 = configLine.includes('--enable-libopenh264');

      resolve({
        path: ffmpegPath,
        version,
        isLGPL,
        hasOpenH264,
        hasH264MF: true, // Supported via MediaFoundation on Windows 10/11
        buildConfiguration: configLine,
      });
    });
  });
}

/**
 * Probes whether a specific video encoder can actually initialize and run on the current hardware/driver.
 * Returns true if successful, false otherwise (e.g. nvcuda.dll missing).
 */
export async function probeEncoderViability(ffmpegPath: string, encoderName: string): Promise<boolean> {
  return new Promise((resolve) => {
    execFile(
      ffmpegPath,
      ['-f', 'lavfi', '-i', 'nullsrc=s=256x256:d=0.04', '-c:v', encoderName, '-f', 'null', '-'],
      { timeout: 3000 },
      (err) => {
        resolve(!err);
      }
    );
  });
}

let cachedGpuInfo: GpuDeviceInfo | null = null;

/**
 * Detects available hardware GPU encoders on this system (NVENC, AMF, QSV, MF).
 * Results are cached for efficiency.
 */
export async function detectGpuHardware(customFfmpegPath?: string): Promise<GpuDeviceInfo> {
  if (cachedGpuInfo) return cachedGpuInfo;

  const ffmpegPath = customFfmpegPath ?? findFFmpegBinary();

  const candidates: Array<{ encoder: string; vendor: 'nvidia' | 'amd' | 'intel' | 'unknown'; name: string }> = [
    { encoder: 'h264_nvenc', vendor: 'nvidia', name: 'NVIDIA GeForce / RTX (NVENC)' },
    { encoder: 'h264_amf', vendor: 'amd', name: 'AMD Radeon Graphics (AMF)' },
    { encoder: 'h264_qsv', vendor: 'intel', name: 'Intel Quick Sync Video (QSV)' },
    { encoder: 'h264_mf', vendor: 'unknown', name: 'Windows Media Foundation GPU' },
  ];

  const supportedEncoders: string[] = [];
  let preferredH264: string | null = null;
  let preferredVendor: 'nvidia' | 'amd' | 'intel' | 'unknown' = 'unknown';
  let detectedName = 'No Hardware GPU Encoder';

  for (const c of candidates) {
    const isViable = await probeEncoderViability(ffmpegPath, c.encoder);
    if (isViable) {
      supportedEncoders.push(c.encoder);
      if (!preferredH264) {
        preferredH264 = c.encoder;
        preferredVendor = c.vendor;
        detectedName = c.name;
      }
    }
  }

  // Refine GPU name via Electron app.getGPUInfo if available
  if (preferredH264 && typeof app?.getGPUInfo === 'function') {
    try {
      const gpuInfo = await app.getGPUInfo('basic');
      const device = (gpuInfo as Record<string, unknown>)?.gpuDevice as Array<{ deviceString?: string }>;
      if (device?.[0]?.deviceString) {
        detectedName = `${device[0].deviceString} (${preferredH264.toUpperCase()})`;
      }
    } catch {
      // Fallback name is already assigned
    }
  }

  let preferredHevc: string | null = null;
  if (preferredVendor === 'nvidia' && supportedEncoders.includes('h264_nvenc')) {
    preferredHevc = 'hevc_nvenc';
  } else if (preferredVendor === 'amd' && supportedEncoders.includes('h264_amf')) {
    preferredHevc = 'hevc_amf';
  } else if (preferredVendor === 'intel' && supportedEncoders.includes('h264_qsv')) {
    preferredHevc = 'hevc_qsv';
  } else if (supportedEncoders.includes('h264_mf')) {
    preferredHevc = 'hevc_mf';
  }

  cachedGpuInfo = {
    hasGpu: supportedEncoders.length > 0,
    gpuName: detectedName,
    vendor: preferredVendor,
    supportedEncoders,
    preferredH264Encoder: preferredH264,
    preferredHevcEncoder: preferredHevc,
  };

  return cachedGpuInfo;
}

/**
 * Selects the best LGPL-compliant H.264 encoder based on compute mode (CPU vs GPU).
 * If GPU is requested but unavailable, falls back automatically to CPU (libopenh264) with warning.
 */
export async function selectH264Encoder(
  ffmpegPath: string,
  computeMode: ComputeMode = 'cpu'
): Promise<{ encoder: string; computeModeUsed: ComputeMode; fallbackWarning?: string }> {
  if (computeMode === 'gpu') {
    const gpuInfo = await detectGpuHardware(ffmpegPath);
    if (gpuInfo.hasGpu && gpuInfo.preferredH264Encoder) {
      return {
        encoder: gpuInfo.preferredH264Encoder,
        computeModeUsed: 'gpu',
      };
    }
    // Fallback cleanly to CPU
    return {
      encoder: 'libopenh264',
      computeModeUsed: 'cpu',
      fallbackWarning:
        'GPU hardware acceleration was requested, but no supported GPU encoder (NVENC, AMF, QSV, MF) was viable on this system. Automatically fell back to CPU encoding (libopenh264).',
    };
  }

  // CPU mode
  return {
    encoder: 'libopenh264',
    computeModeUsed: 'cpu',
  };
}

/**
 * Manages an FFmpeg subprocess that receives raw RGBA frames on stdin
 * and encodes them to a video file.
 */
export class FFmpegEncoder {
  private process: ChildProcess | null = null;
  private ffmpegPath: string;
  private options: FFmpegEncoderOptions;
  private stderrLog: string = '';
  private framesWritten: number = 0;
  private closed: boolean = false;

  private usedEncoder: string = '';
  private computeModeUsed: ComputeMode = 'cpu';
  private fallbackWarning?: string;
  private hasAlpha: boolean = false;

  constructor(options: FFmpegEncoderOptions) {
    this.options = options;
    this.ffmpegPath = options.ffmpegPath ?? findFFmpegBinary();
  }

  /**
   * Starts the FFmpeg subprocess. Must be called before writing frames.
   * Verifies LGPL compliance before proceeding.
   */
  public async start(): Promise<void> {
    // 1. Probe and verify LGPL compliance
    const probe = await probeFFmpeg(this.ffmpegPath);

    if (!probe.isLGPL) {
      throw new Error(
        `LICENSING VIOLATION: FFmpeg at "${this.ffmpegPath}" is built with --enable-gpl. ` +
        `This is PROHIBITED for commercial distribution. ` +
        `Configuration: ${probe.buildConfiguration}`
      );
    }

    // 2. Select encoder based on format & compute mode
    const format = this.options.format;
    const isGreenScreen = this.options.greenScreen ?? false;

    if (format === 'mov') {
      // ProRes 4444 (native LGPL Kostya encoder)
      this.usedEncoder = 'prores_ks';
      this.computeModeUsed = 'cpu';
      this.hasAlpha = this.options.hasAlpha ?? !isGreenScreen;
    } else if (format === 'webm') {
      // VP9 (libvpx-vp9, BSD 3-Clause, royalty-free)
      this.usedEncoder = 'libvpx-vp9';
      this.computeModeUsed = 'cpu';
      this.hasAlpha = this.options.hasAlpha ?? !isGreenScreen;
    } else {
      // MP4 H.264
      this.hasAlpha = false;
      const selection = await selectH264Encoder(
        this.ffmpegPath,
        this.options.computeMode ?? 'cpu'
      );
      this.usedEncoder = selection.encoder;
      this.computeModeUsed = selection.computeModeUsed;
      this.fallbackWarning = selection.fallbackWarning;
    }

    // 3. Ensure output directory exists
    const outputDir = path.dirname(this.options.outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // 4. Build FFmpeg arguments
    const args = this.buildFFmpegArgs();

    // 5. Spawn FFmpeg process
    this.process = spawn(this.ffmpegPath, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });

    this.stderrLog = '';
    this.framesWritten = 0;
    this.closed = false;

    // Capture stderr for diagnostics
    this.process.stderr?.on('data', (data: Buffer) => {
      this.stderrLog += data.toString();
      // Keep only last 8KB to prevent memory bloat on long renders
      if (this.stderrLog.length > 8192) {
        this.stderrLog = this.stderrLog.slice(-4096);
      }
    });

    this.process.stdout?.on('data', () => {
      // Discard stdout
    });

    // Wait for FFmpeg to be ready
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`FFmpeg startup timed out (10s):\n${this.stderrLog}`));
      }, 10000);

      this.process!.on('error', (err) => {
        clearTimeout(timeout);
        reject(new Error(`FFmpeg failed to start: ${err.message}`));
      });

      const onData = () => {
        clearTimeout(timeout);
        this.process?.stderr?.removeListener('data', onData);
        resolve();
      };
      this.process!.stderr?.on('data', onData);

      if (this.process!.stdin?.writable) {
        clearTimeout(timeout);
        this.process!.stderr?.removeListener('data', onData);
        resolve();
      }
    });
  }

  /**
   * Writes a single raw RGBA frame to FFmpeg stdin.
   * The buffer must be exactly width * height * 4 bytes (RGBA).
   */
  public async writeFrame(rgbaBuffer: Buffer | Uint8Array): Promise<void> {
    if (this.closed || !this.process?.stdin?.writable) {
      throw new Error('FFmpeg encoder is not running or stdin is closed.');
    }

    const expectedSize = this.options.width * this.options.height * 4;
    if (rgbaBuffer.length !== expectedSize) {
      throw new Error(
        `Frame buffer size mismatch: got ${rgbaBuffer.length} bytes, ` +
        `expected ${expectedSize} (${this.options.width}x${this.options.height}x4)`
      );
    }

    return new Promise<void>((resolve, reject) => {
      const canContinue = this.process!.stdin!.write(
        Buffer.from(rgbaBuffer.buffer, rgbaBuffer.byteOffset, rgbaBuffer.byteLength),
        (err) => {
          if (err) {
            reject(new Error(`Failed to write frame ${this.framesWritten}: ${err.message}`));
          }
        }
      );

      this.framesWritten++;

      if (canContinue) {
        resolve();
      } else {
        // Backpressure: wait for drain before next frame
        this.process!.stdin!.once('drain', resolve);
      }
    });
  }

  /**
   * Finalizes encoding by closing stdin and waiting for FFmpeg to exit.
   */
  public async finalize(): Promise<{ exitCode: number; stderr: string }> {
    if (this.closed || !this.process) {
      return { exitCode: -1, stderr: 'Encoder already closed' };
    }

    this.closed = true;

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.process?.kill('SIGKILL');
        resolve({ exitCode: -1, stderr: this.stderrLog + '\n[TIMEOUT: FFmpeg finalization took >60s]' });
      }, 60000);

      this.process!.on('close', (code) => {
        clearTimeout(timeout);
        resolve({
          exitCode: code ?? -1,
          stderr: this.stderrLog,
        });
      });

      this.process!.on('error', (err) => {
        clearTimeout(timeout);
        resolve({
          exitCode: -1,
          stderr: this.stderrLog + `\n[ERROR]: ${err.message}`,
        });
      });

      // Close stdin to signal end of input
      try {
        this.process!.stdin?.end();
      } catch {
        // Ignore if already closed
      }
    });
  }

  /** Forcibly cancels the FFmpeg process */
  public cancel(): void {
    this.closed = true;
    try {
      this.process?.kill('SIGKILL');
    } catch {
      // Ignore
    }
    this.process = null;
  }

  /** Number of frames successfully written */
  public getFramesWritten(): number {
    return this.framesWritten;
  }

  /** Latest stderr output from FFmpeg */
  public getStderrLog(): string {
    return this.stderrLog;
  }

  public getUsedEncoder(): string {
    return this.usedEncoder;
  }

  public getComputeModeUsed(): ComputeMode {
    return this.computeModeUsed;
  }

  public getFallbackWarning(): string | undefined {
    return this.fallbackWarning;
  }

  public getHasAlpha(): boolean {
    return this.hasAlpha;
  }

  /**
   * Builds the FFmpeg command-line arguments for raw RGBA input → encoded output.
   */
  private buildFFmpegArgs(): string[] {
    const {
      width,
      height,
      fps,
      bitrateKbps,
      outputPath,
      format,
      rateControl = 'cbr',
    } = this.options;
    const isCbr = rateControl === 'cbr';

    const args: string[] = [
      '-y',                          // Overwrite output
      '-hide_banner',                // Suppress banner
      '-f', 'rawvideo',
      '-pix_fmt', 'rgba',            // Input format is always RGBA
      '-s', `${width}x${height}`,
      '-r', String(fps),
      '-i', 'pipe:0',                // Read from stdin
    ];

    if (format === 'mp4') {
      args.push('-c:v', this.usedEncoder, '-pix_fmt', 'yuv420p');
      if (isCbr) {
        args.push(
          '-b:v', `${bitrateKbps}k`,
          '-minrate', `${bitrateKbps}k`,
          '-maxrate', `${bitrateKbps}k`,
          '-bufsize', `${bitrateKbps * 2}k`
        );
      } else {
        args.push(
          '-b:v', `${bitrateKbps}k`,
          '-maxrate', `${Math.round(bitrateKbps * 1.5)}k`,
          '-bufsize', `${bitrateKbps * 2}k`
        );
      }
      args.push('-movflags', '+faststart', '-an');
    } else if (format === 'webm') {
      args.push('-c:v', 'libvpx-vp9');
      if (this.hasAlpha) {
        // VP9 Alpha transparency
        args.push('-pix_fmt', 'yuva420p', '-auto-alt-ref', '0');
      } else {
        args.push('-pix_fmt', 'yuv420p');
      }

      if (isCbr) {
        args.push(
          '-b:v', `${bitrateKbps}k`,
          '-minrate', `${bitrateKbps}k`,
          '-maxrate', `${bitrateKbps}k`
        );
      } else {
        args.push('-b:v', `${bitrateKbps}k`);
      }
      args.push('-an');
    } else if (format === 'mov') {
      // ProRes 4444 (supports native alpha)
      args.push('-c:v', 'prores_ks', '-profile:v', '4444');
      if (this.hasAlpha) {
        args.push('-pix_fmt', 'yuva444p10le');
      } else {
        args.push('-pix_fmt', 'yuv422p10le');
      }
      args.push('-b:v', `${bitrateKbps}k`, '-an');
    }

    // Output file
    args.push(outputPath);

    return args;
  }
}
