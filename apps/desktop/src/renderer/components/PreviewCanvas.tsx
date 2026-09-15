import { useEffect, useRef, useState } from 'react';
import { ASPECT_RATIO_DIMENSIONS } from '@genc/shared-types';
import { MotionPreviewRenderer } from '../canvas/pixi-renderer';
import { useGenerationStore } from '../store/generationStore';
import { useRenderSettingsStore } from '../store/renderSettingsStore';
import { useCanvasPlaybackStore } from '../store/canvasPlaybackStore';

/**
 * PreviewCanvas
 *
 * Hosts the PixiJS v8 WebGL Canvas for real-time Motion Blueprint preview.
 * Displays transparency checkerboard pattern when green screen is OFF.
 * v1.1: Duration sourced from renderSettingsStore.timeAnim (Time Remap).
 * v1.3: Aspect ratio preservation & viewport scaling (16:9, 9:16, 1:1).
 */
export function PreviewCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<MotionPreviewRenderer | null>(null);
  const [renderError, setRenderError] = useState<Error | null>(null);

  // If an error occurred in the canvas renderer, throw it during render so CanvasErrorBoundary catches it
  if (renderError) {
    throw renderError;
  }

  const { currentBlueprint } = useGenerationStore();
  const { greenScreen, backgroundAnimations, timeAnim, aspectRatio } = useRenderSettingsStore();
  const { setCurrentTime, setDuration, setIsPlaying, setFps, setRendererInstance } =
    useCanvasPlaybackStore();

  // Initialize PixiJS renderer
  useEffect(() => {
    if (!canvasRef.current) return;

    let isMounted = true;
    const renderer = new MotionPreviewRenderer();
    rendererRef.current = renderer;

    const initRenderer = async () => {
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
          },
        );

        if (isMounted) {
          setRendererInstance(renderer);
          // v1.1: Duration from UI timeAnim, not blueprint
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

    initRenderer();

    // Resize observer
    const container = containerRef.current;
    let resizeObserver: ResizeObserver | null = null;
    if (container) {
      resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (entry && rendererRef.current) {
          const { width, height } = entry.contentRect;
          if (width > 0 && height > 0) {
            rendererRef.current.resize(width, height);
          }
        }
      });
      resizeObserver.observe(container);
    }

    return () => {
      isMounted = false;
      if (resizeObserver && container) {
        resizeObserver.unobserve(container);
      }
      setRendererInstance(null);
      renderer.destroy();
      rendererRef.current = null;
    };
  }, []);

  // Update blueprint when changed
  useEffect(() => {
    if (rendererRef.current && currentBlueprint) {
      try {
        rendererRef.current.loadBlueprint(currentBlueprint);
        // v1.1: Duration from UI timeAnim, not blueprint
        rendererRef.current.setDuration(timeAnim);
        setDuration(timeAnim);
        setCurrentTime(0);
        setIsPlaying(false);
        setRenderError(null);
      } catch (err) {
        console.error('Failed to load blueprint into PixiJS renderer:', err);
        setRenderError(err instanceof Error ? err : new Error(String(err)));
      }
    }
  }, [currentBlueprint, setCurrentTime, setDuration, setIsPlaying]);

  // v1.1: React to timeAnim changes — re-render with new time scale, no re-generate
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.setDuration(timeAnim);
      setDuration(timeAnim);
    }
  }, [timeAnim, setDuration]);

  // v1.3: React to aspectRatio changes — update viewport scale and target boundary
  useEffect(() => {
    if (rendererRef.current) {
      const dims = ASPECT_RATIO_DIMENSIONS[aspectRatio];
      if (dims) {
        rendererRef.current.setTargetDimensions(dims.width, dims.height);
      }
    }
  }, [aspectRatio]);

  // Update render options (Green Screen, Background Animations)
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.updateSettings({
        greenScreen,
        backgroundAnimations,
      });
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
