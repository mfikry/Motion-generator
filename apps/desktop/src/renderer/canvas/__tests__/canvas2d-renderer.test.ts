import { describe, it, expect, vi } from 'vitest';
import { Canvas2DPreviewRenderer } from '../canvas2d-renderer';

describe('Canvas2DPreviewRenderer (@genc/desktop/canvas/canvas2d-renderer)', () => {
  function createMockCanvas(): HTMLCanvasElement {
    const clearRect = vi.fn();
    const ctx = {
      clearRect,
      fillRect: vi.fn(),
      fillStyle: '#000000',
    } as unknown as CanvasRenderingContext2D;

    return {
      width: 1080,
      height: 1080,
      getContext: vi.fn().mockReturnValue(ctx),
    } as unknown as HTMLCanvasElement;
  }

  it('notifies onError, stops animation, and wipes canvas when drawFrame throws an error', async () => {
    const canvas = createMockCanvas();
    const renderer = new Canvas2DPreviewRenderer();
    const onError = vi.fn();
    const onPlaybackChange = vi.fn();

    await renderer.init(
      canvas,
      undefined,
      {},
      { onError, onPlaybackChange }
    );

    const crashingCode = `
      ctx.fillStyle = '#ff0000';
      ctx.fillRect(0, 0, width, height);
      throw new Error('Fatal error inside drawFrame: mid-execution crash');
    `;

    // Loading code executes renderCurrentFrame for frame 0
    await expect(renderer.loadCode(crashingCode)).rejects.toThrow(
      'Fatal error inside drawFrame: mid-execution crash'
    );

    // Verify onError callback was triggered with the exact error
    expect(onError).toHaveBeenCalledTimes(1);
    const errorArg = onError.mock.calls[0]?.[0] as Error;
    expect(errorArg?.message).toContain('Fatal error inside drawFrame: mid-execution crash');

    // Verify onPlaybackChange was notified to pause
    expect(onPlaybackChange).toHaveBeenCalledWith(false);

    // Verify canvas was wiped clean to prevent showing partial corrupted frame
    const ctx = canvas.getContext('2d') as unknown as { clearRect: ReturnType<typeof vi.fn> };
    expect(ctx.clearRect).toHaveBeenCalled();

    renderer.destroy();
  });
});
