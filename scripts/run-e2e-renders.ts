import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { RenderPipeline } from '../apps/desktop/src/main/render/render-pipeline';
import type { RenderStartParams } from '@genc/shared-types';

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runJob(pipeline: RenderPipeline, name: string, params: RenderStartParams) {
  console.log(`\n========================================`);
  console.log(`STARTING: ${name}`);
  console.log(`Format: ${params.format}, Compute: ${params.computeMode}, GreenScreen: ${params.greenScreen}, Dur: ${params.durationSec}s`);
  console.log(`Output: ${params.outputPath}`);
  console.log(`========================================`);

  const tStart = Date.now();
  const { jobId } = await pipeline.startRender(params);
  console.log(`Job ID: ${jobId}`);

  while (true) {
    await sleep(250);
    const job = pipeline.getActiveJob();
    if (!job) break;
    if (job.state === 'done') {
      const elapsedTotal = ((Date.now() - tStart) / 1000).toFixed(2);
      console.log(`[DONE] ${name} completed in ${elapsedTotal}s!`);
      break;
    }
    if (job.state === 'failed' || job.state === 'cancelled') {
      throw new Error(`Job ${name} failed with state: ${job.state}`);
    }
  }

  // Small delay between jobs to allow file handles and encoder cleanup to settle
  await sleep(1000);
}

app.on('window-all-closed', (e) => {
  // Prevent Electron from auto-quitting between sequential render jobs
  if (e && typeof e.preventDefault === 'function') e.preventDefault();
});

app.whenReady().then(async () => {
  try {
    const code = fs.readFileSync('temp_code.js', 'utf-8');
    const pipeline = new RenderPipeline();
    const outputDir = 'F:\\PROJECT\\Motion generator\\output';

    // 1. MP4 Green Screen = OFF (GPU)
    await runJob(pipeline, 'TEST 1: MP4 GPU (GreenScreen = OFF)', {
      generationId: 'gen_e2e_rings',
      code,
      outputPath: path.join(outputDir, 'TEST_E2E_rings_mp4_gpu_nogreen.mp4'),
      durationSec: 2,
      fps: 60,
      width: 1920,
      height: 1080,
      format: 'mp4',
      bitrateKbps: 35000,
      rateControl: 'cbr',
      computeMode: 'gpu',
      greenScreen: false,
      seed: 1337,
    });

    // 2. MP4 Green Screen = ON (GPU)
    await runJob(pipeline, 'TEST 2: MP4 GPU (GreenScreen = ON)', {
      generationId: 'gen_e2e_rings',
      code,
      outputPath: path.join(outputDir, 'TEST_E2E_rings_mp4_gpu_greenscreen.mp4'),
      durationSec: 2,
      fps: 60,
      width: 1920,
      height: 1080,
      format: 'mp4',
      bitrateKbps: 35000,
      rateControl: 'cbr',
      computeMode: 'gpu',
      greenScreen: true,
      seed: 1337,
    });

    // 3. MOV ProRes 4444 (Alpha Transparent) (CPU)
    await runJob(pipeline, 'TEST 3: MOV ProRes 4444 Alpha (GreenScreen = OFF)', {
      generationId: 'gen_e2e_rings',
      code,
      outputPath: path.join(outputDir, 'TEST_E2E_rings_mov_prores_alpha.mov'),
      durationSec: 2,
      fps: 60,
      width: 1920,
      height: 1080,
      format: 'mov',
      bitrateKbps: 150000,
      rateControl: 'cbr',
      computeMode: 'cpu',
      greenScreen: false,
      seed: 1337,
    });

    // 4. WebM VP9 (Alpha Transparent) (CPU)
    await runJob(pipeline, 'TEST 4: WebM VP9 Alpha (GreenScreen = OFF)', {
      generationId: 'gen_e2e_rings',
      code,
      outputPath: path.join(outputDir, 'TEST_E2E_rings_webm_vp9_alpha.webm'),
      durationSec: 2,
      fps: 60,
      width: 1920,
      height: 1080,
      format: 'webm',
      bitrateKbps: 35000,
      rateControl: 'cbr',
      computeMode: 'cpu',
      greenScreen: false,
      seed: 1337,
    });

    // 5. Benchmark 15-second clip: CPU vs GPU comparison
    console.log('\n========================================');
    console.log('STARTING BENCHMARK: 15-SECOND CLIP (900 FRAMES)');
    console.log('========================================');

    // 5A. CPU Benchmark
    const tCpuStart = Date.now();
    await runJob(pipeline, 'BENCHMARK 5A: 15s MP4 via CPU (libopenh264)', {
      generationId: 'gen_e2e_rings',
      code,
      outputPath: path.join(outputDir, 'BENCHMARK_15s_mp4_cpu.mp4'),
      durationSec: 15,
      fps: 60,
      width: 1920,
      height: 1080,
      format: 'mp4',
      bitrateKbps: 35000,
      rateControl: 'cbr',
      computeMode: 'cpu',
      greenScreen: false,
      seed: 1337,
    });
    const tCpuElapsed = ((Date.now() - tCpuStart) / 1000).toFixed(2);

    // 5B. GPU Benchmark
    const tGpuStart = Date.now();
    await runJob(pipeline, 'BENCHMARK 5B: 15s MP4 via GPU (h264_amf)', {
      generationId: 'gen_e2e_rings',
      code,
      outputPath: path.join(outputDir, 'BENCHMARK_15s_mp4_gpu.mp4'),
      durationSec: 15,
      fps: 60,
      width: 1920,
      height: 1080,
      format: 'mp4',
      bitrateKbps: 35000,
      rateControl: 'cbr',
      computeMode: 'gpu',
      greenScreen: false,
      seed: 1337,
    });
    const tGpuElapsed = ((Date.now() - tGpuStart) / 1000).toFixed(2);

    console.log(`\n========================================`);
    console.log(`BENCHMARK RESULTS (15s @ 1080p 60fps / 900 frames):`);
    console.log(`CPU Total Time: ${tCpuElapsed}s`);
    console.log(`GPU Total Time: ${tGpuElapsed}s`);
    console.log(`========================================`);

    console.log('ALL E2E RENDERS COMPLETED SUCCESSFULLY!');
    process.exit(0);
  } catch (err) {
    console.error('E2E Render Test encountered error:', err);
    process.exit(1);
  }
});
