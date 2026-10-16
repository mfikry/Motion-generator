import { describe, it, expect, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {
  findFFmpegBinary,
  probeFFmpeg,
  selectH264Encoder,
  detectGpuHardware,
  FFmpegEncoder,
} from '../ffmpeg-encoder';

describe('FFmpeg Encoder — LGPL Compliance & Video Encoding (E8 Phase 1)', () => {
  const vendorFfmpegPath = path.resolve(process.cwd(), 'apps/desktop/vendor/ffmpeg/ffmpeg.exe');
  const tempFiles: string[] = [];

  afterEach(() => {
    for (const f of tempFiles) {
      if (fs.existsSync(f)) {
        try {
          fs.unlinkSync(f);
        } catch {
          // Ignore cleanup errors
        }
      }
    }
    tempFiles.length = 0;
  });

  it('locates the bundled LGPL FFmpeg binary in vendor/ffmpeg', () => {
    const foundPath = findFFmpegBinary();
    expect(fs.existsSync(foundPath)).toBe(true);
    expect(foundPath.toLowerCase()).toContain('ffmpeg');
  });

  it('probes vendor binary and proves LGPL-only compliance (NO --enable-gpl)', async () => {
    const probe = await probeFFmpeg(vendorFfmpegPath);

    // Hard technical constraint: MUST be LGPL
    expect(probe.isLGPL).toBe(true);
    expect(probe.buildConfiguration).not.toContain('--enable-gpl');
    expect(probe.buildConfiguration).toContain('--enable-version3');

    // Must have Cisco OpenH264 (BSD license)
    expect(probe.hasOpenH264).toBe(true);
  });

  it('selects libopenh264 (BSD) as primary H.264 encoder in CPU mode, rejecting GPL encoders', async () => {
    const result = await selectH264Encoder(vendorFfmpegPath, 'cpu');
    expect(result.encoder).toBe('libopenh264');
    expect(result.computeModeUsed).toBe('cpu');
  });

  it('detects available GPU hardware encoders and configures GPU compute mode', async () => {
    const gpuInfo = await detectGpuHardware(vendorFfmpegPath);
    expect(gpuInfo).toBeDefined();
    expect(Array.isArray(gpuInfo.supportedEncoders)).toBe(true);
    // On this machine, AMD Radeon / Media Foundation is present
    if (gpuInfo.hasGpu) {
      expect(gpuInfo.preferredH264Encoder).toBeDefined();
      const gpuResult = await selectH264Encoder(vendorFfmpegPath, 'gpu');
      expect(gpuResult.computeModeUsed).toBe('gpu');
      expect(gpuResult.encoder).toBe(gpuInfo.preferredH264Encoder);
    }
  }, 15000);

  it('encodes raw RGBA frames with alpha transparency to MOV ProRes 4444 (LGPL native prores_ks)', async () => {
    const outputPath = path.resolve(
      process.cwd(),
      `apps/desktop/vendor/test_alpha_${Date.now()}.mov`
    );
    tempFiles.push(outputPath);

    const width = 320;
    const height = 180;
    const fps = 30;
    const totalFrames = 10;

    const encoder = new FFmpegEncoder({
      outputPath,
      width,
      height,
      fps,
      bitrateKbps: 5000,
      format: 'mov',
      greenScreen: false,
      ffmpegPath: vendorFfmpegPath,
    });

    await encoder.start();

    // Semi-transparent RGBA frame (R=255, G=0, B=128, A=100)
    const frameBuffer = Buffer.alloc(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      frameBuffer[i * 4] = 255;
      frameBuffer[i * 4 + 1] = 0;
      frameBuffer[i * 4 + 2] = 128;
      frameBuffer[i * 4 + 3] = 100; // Alpha
    }

    for (let i = 0; i < totalFrames; i++) {
      await encoder.writeFrame(frameBuffer);
    }

    const { exitCode } = await encoder.finalize();

    expect(exitCode).toBe(0);
    expect(fs.existsSync(outputPath)).toBe(true);

    const stats = fs.statSync(outputPath);
    expect(stats.size).toBeGreaterThan(1000);
    expect(encoder.getUsedEncoder()).toBe('prores_ks');
  });

  it('encodes raw RGBA frames with alpha transparency to WebM VP9 (libvpx-vp9, royalty-free)', async () => {
    const outputPath = path.resolve(
      process.cwd(),
      `apps/desktop/vendor/test_vp9_${Date.now()}.webm`
    );
    tempFiles.push(outputPath);

    const width = 320;
    const height = 180;
    const fps = 30;
    const totalFrames = 10;

    const encoder = new FFmpegEncoder({
      outputPath,
      width,
      height,
      fps,
      bitrateKbps: 2000,
      format: 'webm',
      greenScreen: false,
      ffmpegPath: vendorFfmpegPath,
    });

    await encoder.start();

    const frameBuffer = Buffer.alloc(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      frameBuffer[i * 4] = 0;
      frameBuffer[i * 4 + 1] = 245;
      frameBuffer[i * 4 + 2] = 212;
      frameBuffer[i * 4 + 3] = 150;
    }

    for (let i = 0; i < totalFrames; i++) {
      await encoder.writeFrame(frameBuffer);
    }

    const { exitCode } = await encoder.finalize();

    expect(exitCode).toBe(0);
    expect(fs.existsSync(outputPath)).toBe(true);

    const stats = fs.statSync(outputPath);
    expect(stats.size).toBeGreaterThan(500);
    expect(encoder.getUsedEncoder()).toBe('libvpx-vp9');
  });

  it('respects CBR and VBR bitrate settings in FFmpeg arguments', async () => {
    const cbrEncoder = new FFmpegEncoder({
      outputPath: 'dummy.mp4',
      width: 1920,
      height: 1080,
      fps: 60,
      bitrateKbps: 45000,
      rateControl: 'cbr',
      format: 'mp4',
      ffmpegPath: vendorFfmpegPath,
    });
    const cbrArgs = (cbrEncoder as any).buildFFmpegArgs('libopenh264', false);
    expect(cbrArgs).toContain('-b:v');
    expect(cbrArgs).toContain('45000k');
    expect(cbrArgs).toContain('-minrate');
    expect(cbrArgs).toContain('-maxrate');

    const vbrEncoder = new FFmpegEncoder({
      outputPath: 'dummy.mp4',
      width: 1920,
      height: 1080,
      fps: 60,
      bitrateKbps: 30000,
      rateControl: 'vbr',
      format: 'mp4',
      ffmpegPath: vendorFfmpegPath,
    });
    const vbrArgs = (vbrEncoder as any).buildFFmpegArgs('libopenh264', false);
    expect(vbrArgs).toContain('-b:v');
    expect(vbrArgs).toContain('30000k');
    expect(vbrArgs).not.toContain('-minrate');
  });

  it('encodes raw RGBA frames to a valid MP4 file via libopenh264', async () => {
    const outputPath = path.resolve(
      process.cwd(),
      `apps/desktop/vendor/test_render_${Date.now()}.mp4`
    );
    tempFiles.push(outputPath);

    const width = 320;
    const height = 180;
    const fps = 30;
    const totalFrames = 15; // 0.5s

    const encoder = new FFmpegEncoder({
      outputPath,
      width,
      height,
      fps,
      bitrateKbps: 2000,
      format: 'mp4',
      ffmpegPath: vendorFfmpegPath,
    });

    await encoder.start();

    // Create a solid frame buffer
    const frameBuffer = Buffer.alloc(width * height * 4, 100);

    for (let i = 0; i < totalFrames; i++) {
      await encoder.writeFrame(frameBuffer);
    }

    const { exitCode } = await encoder.finalize();

    expect(exitCode).toBe(0);
    expect(fs.existsSync(outputPath)).toBe(true);

    const stats = fs.statSync(outputPath);
    expect(stats.size).toBeGreaterThan(500); // Valid MP4 header + video packets
  });

  it('verifies determinism: two identical encode passes of seeded frames produce identical outputs', async () => {
    const pass1Path = path.resolve(process.cwd(), `apps/desktop/vendor/det_pass1_${Date.now()}.mp4`);
    const pass2Path = path.resolve(process.cwd(), `apps/desktop/vendor/det_pass2_${Date.now()}.mp4`);
    tempFiles.push(pass1Path, pass2Path);

    const width = 160;
    const height = 90;
    const fps = 30;
    const totalFrames = 10;

    // Generate deterministic procedural frames using seeded values
    const frames: Buffer[] = [];
    for (let f = 0; f < totalFrames; f++) {
      const buf = Buffer.alloc(width * height * 4);
      for (let p = 0; p < width * height; p++) {
        // Deterministic pseudo-random pattern
        const val = ((p * 31 + f * 17 + 1337) & 0xff);
        buf[p * 4] = val;
        buf[p * 4 + 1] = (val + 50) & 0xff;
        buf[p * 4 + 2] = (val + 100) & 0xff;
        buf[p * 4 + 3] = 255;
      }
      frames.push(buf);
    }

    // Pass 1
    const encoder1 = new FFmpegEncoder({
      outputPath: pass1Path,
      width,
      height,
      fps,
      bitrateKbps: 1500,
      format: 'mp4',
      ffmpegPath: vendorFfmpegPath,
    });
    await encoder1.start();
    for (const frame of frames) {
      await encoder1.writeFrame(frame);
    }
    const res1 = await encoder1.finalize();
    expect(res1.exitCode).toBe(0);

    // Pass 2 (identical frames, identical settings)
    const encoder2 = new FFmpegEncoder({
      outputPath: pass2Path,
      width,
      height,
      fps,
      bitrateKbps: 1500,
      format: 'mp4',
      ffmpegPath: vendorFfmpegPath,
    });
    await encoder2.start();
    for (const frame of frames) {
      await encoder2.writeFrame(frame);
    }
    const res2 = await encoder2.finalize();
    expect(res2.exitCode).toBe(0);

    // Compare output files
    const hash1 = crypto.createHash('sha256').update(fs.readFileSync(pass1Path)).digest('hex');
    const hash2 = crypto.createHash('sha256').update(fs.readFileSync(pass2Path)).digest('hex');

    expect(hash1).toBe(hash2);
  });
});
