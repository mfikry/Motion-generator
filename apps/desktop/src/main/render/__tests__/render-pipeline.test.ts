import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RenderPipeline } from '../render-pipeline';
import type { RenderStartParams } from '@genc/shared-types';

describe('RenderPipeline Orchestrator (E8 Phase 1)', () => {
  let pipeline: RenderPipeline;

  beforeEach(() => {
    pipeline = new RenderPipeline();
  });

  const validParams: RenderStartParams = {
    generationId: 'gen_test_123',
    code: 'function drawFrame(ctx, t, width, height, opts) { ctx.fillStyle = "#fff"; ctx.fillRect(0,0,width,height); }',
    outputPath: 'F:\\PROJECT\\Motion generator\\output\\test.mp4',
    durationSec: 1,
    fps: 30,
    width: 320,
    height: 180,
    format: 'mp4',
    bitrateKbps: 2000,
    seed: 1337,
  };

  it('rejects startRender when no code is provided and generationId not in DB', async () => {
    const paramsNoCode: RenderStartParams = {
      ...validParams,
      code: undefined,
      generationId: 'non_existent_id',
    };

    await expect(pipeline.startRender(paramsNoCode)).rejects.toThrow(
      'No code found for generation ID "non_existent_id"'
    );
  });

  it('initiates a render job and returns a unique jobId when code is provided', async () => {
    vi.spyOn(pipeline as any, 'runRenderLoop').mockImplementation(async () => {});

    const result = await pipeline.startRender(validParams);
    expect(result.jobId).toBeDefined();
    expect(result.jobId).toMatch(/^render_\d+_[a-f0-9]+$/);

    const active = pipeline.getActiveJob();
    expect(active).not.toBeNull();
    expect(active?.id).toBe(result.jobId);
    expect(active?.totalFrames).toBe(30);

    pipeline.cancelRender(result.jobId);
  });

  it('rejects a second startRender while a render job is actively in progress', async () => {
    // Keep runRenderLoop active
    let releaseRender: () => void = () => {};
    vi.spyOn(pipeline as any, 'runRenderLoop').mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          releaseRender = resolve;
        })
    );

    const result = await pipeline.startRender(validParams);

    await expect(pipeline.startRender(validParams)).rejects.toThrow(
      'A render job is already in progress. Cancel it first.'
    );

    pipeline.cancelRender(result.jobId);
    releaseRender();
  });

  it('cancels an active render job cleanly when cancelRender is invoked', async () => {
    vi.spyOn(pipeline as any, 'runRenderLoop').mockImplementation(
      () => new Promise<void>(() => {})
    );

    const result = await pipeline.startRender(validParams);
    const activeBefore = pipeline.getActiveJob();
    expect(activeBefore?.cancelled).toBe(false);

    pipeline.cancelRender(result.jobId);

    const activeAfter = pipeline.getActiveJob();
    expect(activeAfter?.cancelled).toBe(true);
    expect(activeAfter?.state).toBe('cancelled');
  });
});
