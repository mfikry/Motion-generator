import { useEffect, useRef, useState } from 'react';
import { ASPECT_RATIO_DIMENSIONS } from '@genc/shared-types';
import { Canvas2DPreviewRenderer } from '../canvas/canvas2d-renderer';
import { MotionPreviewRenderer } from '../canvas/pixi-renderer';
import { useGenerationStore } from '../store/generationStore';
import { useRenderSettingsStore } from '../store/renderSettingsStore';
import { useCanvasPlaybackStore } from '../store/canvasPlaybackStore';

/**
 * PreviewCanvas (v2.0)
 *
 * Primary Preview Engine: Canvas2D procedural execution with RAF playback.
 * Fallback: PixiJS v8 WebGL Canvas for legacy Motion Blueprints.
 *
 * Displays transparency checkerboard pattern when green screen is OFF.
 * Duration sourced from renderSettingsStore.timeAnim.
 * Aspect ratio preservation & viewport scaling (16:9, 9:16, 1:1).
 */
export function PreviewCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvas2dRendererRef = useRef<Canvas2DPreviewRenderer | null>(null);
  const pixiRendererRef = useRef<MotionPreviewRenderer | null>(null);
  const [renderError, setRenderError] = useState<Error | null>(null);

  if (renderError) {
    throw renderError;
  }

  const { currentCode, currentBlueprint } = useGenerationStore();
  const { greenScreen, backgroundAnimations, timeAnim, aspectRatio } = useRenderSettingsStore();
  const { setCurrentTime, setDuration, setIsPlaying, setFps, setRendererInstance } =
    useCanvasPlaybackStore();

  // Mode: Prefer Canvas2D (v2.0) if code is present or if no blueprint, otherwise PixiJS
  const isCanvas2DMode = !!currentCode || !currentBlueprint;

  // 1. Initialize Canvas2D Renderer
  useEffect(() => {
    if (!canvasRef.current || !isCanvas2DMode) return;

    let isMounted = true;
    const renderer = new Canvas2DPreviewRenderer();
    canvas2dRendererRef.current = renderer;

    const dims = ASPECT_RATIO_DIMENSIONS[aspectRatio] ?? { width: 1080, height: 1080 };

    const initCanvas2D = async () => {
      if (!canvasRef.current) return;
      try {
        await renderer.init(
          canvasRef.current,
          currentCode || undefined,
          { greenScreen },
          {
            onTimeUpdate: (t) => {
              if (isMounted) setCurrentTime(t);
            },
            onPlaybackChange: (playing) => {
              if (isMounted) setIsPlaying(playing);
            },
            onFpsUpdate: (fps) => {
              if (isMounted) setFps(fps);
            },
            onEnded: () => {
              if (isMounted) setIsPlaying(false);
            },
            onError: (err: Error) => {
              if (isMounted) {
                setRenderError(err);
              }
            },
          }
        );

        if (isMounted) {
          renderer.setTargetDimensions(dims.width, dims.height);
          renderer.setDuration(timeAnim);
          setDuration(timeAnim);
          setRendererInstance(renderer);
        }
      } catch (err) {
        console.error('Failed to initialize Canvas2D Preview Renderer:', err);
        if (isMounted) {
          setRenderError(err instanceof Error ? err : new Error(String(err)));
        }
      }
    };

    initCanvas2D();

    return () => {
      isMounted = false;
      setRendererInstance(null);
      renderer.destroy();
      canvas2dRendererRef.current = null;
    };
  }, [isCanvas2DMode]);

  // 2. Initialize PixiJS Renderer (fallback when only blueprint is present)
  useEffect(() => {
    if (!canvasRef.current || isCanvas2DMode) return;

    let isMounted = true;
    const renderer = new MotionPreviewRenderer();
    pixiRendererRef.current = renderer;

    const initPixi = async () => {
      if (!canvasRef.current) return;
      try {
        await renderer.init(
          canvasRef.current,
          currentBlueprint || undefined,
          { greenScreen, backgroundAnimations },
          {
            onTimeUpdate: (t) => {
              if (isMounted) setCurrentTime(t);
            },
            onPlaybackChange: (playing) => {
              if (isMounted) setIsPlaying(playing);
            },
            onFpsUpdate: (fps) => {
              if (isMounted) setFps(fps);
            },
            onEnded: () => {
              if (isMounted) setIsPlaying(false);
            },
          }
        );

        if (isMounted) {
          setRendererInstance(renderer);
          renderer.setDuration(timeAnim);
          setDuration(timeAnim);
        }
      } catch (err) {
        console.error('Failed to initialize PixiJS Preview Renderer:', err);
        if (isMounted) {
          setRenderError(err instanceof Error ? err : new Error(String(err)));
        }
      }
    };

    initPixi();

    return () => {
      isMounted = false;
      setRendererInstance(null);
      renderer.destroy();
      pixiRendererRef.current = null;
    };
  }, [isCanvas2DMode]);

  // Load new Canvas2D code
  useEffect(() => {
    if (canvas2dRendererRef.current && currentCode) {
      try {
        canvas2dRendererRef.current.loadCode(currentCode);
        canvas2dRendererRef.current.setDuration(timeAnim);
        setDuration(timeAnim);
        setCurrentTime(0);
        setIsPlaying(false);
        setRenderError(null);
      } catch (err) {
        console.error('Failed to load Canvas2D code into renderer:', err);
        setRenderError(err instanceof Error ? err : new Error(String(err)));
      }
    }
  }, [currentCode, setCurrentTime, setDuration, setIsPlaying]);

  // Load new PixiJS Blueprint
  useEffect(() => {
    if (pixiRendererRef.current && currentBlueprint && !isCanvas2DMode) {
      try {
        pixiRendererRef.current.loadBlueprint(currentBlueprint);
        pixiRendererRef.current.setDuration(timeAnim);
        setDuration(timeAnim);
        setCurrentTime(0);
        setIsPlaying(false);
        setRenderError(null);
      } catch (err) {
        console.error('Failed to load blueprint into PixiJS renderer:', err);
        setRenderError(err instanceof Error ? err : new Error(String(err)));
      }
    }
  }, [currentBlueprint, isCanvas2DMode, setCurrentTime, setDuration, setIsPlaying]);

  // React to timeAnim changes
  useEffect(() => {
    if (canvas2dRendererRef.current) {
      canvas2dRendererRef.current.setDuration(timeAnim);
      setDuration(timeAnim);
    }
    if (pixiRendererRef.current) {
      pixiRendererRef.current.setDuration(timeAnim);
      setDuration(timeAnim);
    }
  }, [timeAnim, setDuration]);

  // React to aspectRatio changes
  useEffect(() => {
    const dims = ASPECT_RATIO_DIMENSIONS[aspectRatio];
    if (dims) {
      if (canvas2dRendererRef.current) {
        canvas2dRendererRef.current.setTargetDimensions(dims.width, dims.height);
      }
      if (pixiRendererRef.current) {
        pixiRendererRef.current.setTargetDimensions(dims.width, dims.height);
      }
    }
  }, [aspectRatio]);

  // Update render options (Green Screen)
  useEffect(() => {
    if (canvas2dRendererRef.current) {
      canvas2dRendererRef.current.updateSettings({ greenScreen });
    }
    if (pixiRendererRef.current) {
      pixiRendererRef.current.updateSettings({ greenScreen, backgroundAnimations });
    }
  }, [greenScreen, backgroundAnimations]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full flex items-center justify-center overflow-hidden"
      style={{
        // Dark purple checkerboard pattern for transparency indicator
        backgroundColor: greenScreen ? '#00B140' : '#140f26',
        backgroundImage: greenScreen
          ? 'none'
          : 'repeating-conic-gradient(#1f1938 0% 25%, #140f26 0% 50%)',
        backgroundPosition: '50% 50%',
        backgroundSize: '24px 24px',
        transition: 'background-color 0.2s ease',
      }}
    >
      <canvas
        ref={canvasRef}
        className="block max-w-full max-h-full object-contain"
        style={{
          width: '100%',
          height: '100%',
        }}
      />
    </div>
  );
}
