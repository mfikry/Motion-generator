import { Application, Container, Graphics } from 'pixi.js';
import type { CanvasRenderOptions, MotionRendererEvents, PlaybackState } from './types';
import type { MotionBlueprint, MotionLayer } from '@genc/shared-types';
import { interpolateLayerProperties } from './interpolator';
import { sampleSvgPath, type SampledPath } from './path-sampler';
import { hexToNumber } from './easing';

interface LayerRecord {
  layer: MotionLayer;
  container: Container;
  graphics: Graphics;
  sampledPath?: SampledPath;
}

/**
 * MotionPreviewRenderer
 *
 * Core engine that drives real-time PixiJS v8 rendering of Motion Blueprints.
 * Follows the "what you preview is what you render" paradigm — this same class
 * can be reused in both the browser UI and headless offscreen Electron workers.
 */
export class MotionPreviewRenderer {
  private app: Application | null = null;
  private canvasElement: HTMLCanvasElement | null = null;
  private rootContainer: Container | null = null;
  private backgroundGraphics: Graphics | null = null;
  private layersContainer: Container | null = null;

  private blueprint: MotionBlueprint | null = null;
  private options: CanvasRenderOptions = {
    greenScreen: false,
    backgroundAnimations: true,
  };
  private events: MotionRendererEvents = {};

  private isPlaying = false;
  private currentTime = 0;
  private duration = 15;
  private rafId: number | null = null;
  private lastTimestamp = 0;
  private frameCount = 0;
  private lastFpsUpdate = 0;
  private fps = 60;

  private layers: LayerRecord[] = [];

  /**
   * Initialize the PixiJS v8 Application onto the specified HTML5 Canvas.
   */
  async init(
    canvas: HTMLCanvasElement,
    blueprint?: MotionBlueprint,
    options?: Partial<CanvasRenderOptions>,
    events?: MotionRendererEvents,
  ): Promise<void> {
    this.canvasElement = canvas;
    if (options) {
      this.options = { ...this.options, ...options };
    }
    if (events) {
      this.events = events;
    }

    const app = new Application();
    const width = canvas.clientWidth || 800;
    const height = canvas.clientHeight || 800;

    await app.init({
      canvas,
      width,
      height,
      backgroundAlpha: 0, // Transparent by default
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
    });

    this.app = app;

    // Root container to scale & center blueprint canvas into preview dimensions
    this.rootContainer = new Container();
    this.backgroundGraphics = new Graphics();
    this.layersContainer = new Container();

    this.rootContainer.addChild(this.backgroundGraphics);
    this.rootContainer.addChild(this.layersContainer);
    this.app.stage.addChild(this.rootContainer);

    if (blueprint) {
      this.loadBlueprint(blueprint);
    } else {
      this.updateViewportScale();
    }
  }

  /**
   * Load and interpret a validated Motion Blueprint.
   */
  loadBlueprint(blueprint: MotionBlueprint): void {
    this.blueprint = blueprint;
    this.duration = Math.max(0.1, blueprint.durationSec || 15);
    this.currentTime = 0;

    if (!this.layersContainer) return;

    // Clear previous layer objects
    this.layersContainer.removeChildren();
    this.layers = [];

    // Construct layer hierarchy
    for (const layer of blueprint.layers || []) {
      const container = new Container();
      const graphics = new Graphics();
      container.addChild(graphics);

      let sampledPath: SampledPath | undefined;
      const pathData = layer.properties?.pathData || layer.properties?.path || layer.shape;
      if (layer.type === 'path' && typeof pathData === 'string') {
        sampledPath = sampleSvgPath(pathData, 150);
      }

      this.layers.push({
        layer,
        container,
        graphics,
        sampledPath,
      });

      this.layersContainer.addChild(container);
    }

    this.updateViewportScale();
    this.renderAtTime(0);
  }

  /**
   * Recalculate aspect-ratio-preserving scale and center alignment.
   */
  private updateViewportScale(): void {
    if (!this.app || !this.rootContainer || !this.canvasElement) return;

    const canvasWidth = this.app.renderer.width / (window.devicePixelRatio || 1);
    const canvasHeight = this.app.renderer.height / (window.devicePixelRatio || 1);

    const bpWidth = this.blueprint?.canvas.width || 1080;
    const bpHeight = this.blueprint?.canvas.height || 1080;

    const scale = Math.min(canvasWidth / bpWidth, canvasHeight / bpHeight);
    this.rootContainer.scale.set(scale);

    const offsetX = (canvasWidth - bpWidth * scale) / 2;
    const offsetY = (canvasHeight - bpHeight * scale) / 2;
    this.rootContainer.position.set(offsetX, offsetY);
  }

  /**
   * Render the exact frame corresponding to timestamp t (in seconds).
   */
  renderAtTime(t: number): void {
    if (!this.blueprint || !this.backgroundGraphics) return;

    const bpWidth = this.blueprint.canvas.width || 1080;
    const bpHeight = this.blueprint.canvas.height || 1080;

    // 1. Background Rendering
    this.backgroundGraphics.clear();
    if (this.options.greenScreen) {
      // Solid chroma green #00B140
      this.backgroundGraphics.rect(0, 0, bpWidth, bpHeight).fill({ color: 0x00b140, alpha: 1.0 });
    } else if (
      this.blueprint.canvas.background &&
      this.blueprint.canvas.background !== 'transparent'
    ) {
      const bgColor = hexToNumber(this.blueprint.canvas.background);
      this.backgroundGraphics.rect(0, 0, bpWidth, bpHeight).fill({ color: bgColor, alpha: 1.0 });
    }
    // If transparent and green screen OFF, backgroundGraphics is empty (CSS checkerboard shows through)

    // 2. Layer Rendering
    for (const item of this.layers) {
      const { layer, container, graphics, sampledPath } = item;
      const props = interpolateLayerProperties(layer, t, {
        backgroundAnimations: this.options.backgroundAnimations,
      });

      graphics.clear();

      // Transform properties
      const opacity =
        typeof props.opacity === 'number'
          ? Math.max(0, Math.min(1, props.opacity))
          : typeof props.alpha === 'number'
            ? Math.max(0, Math.min(1, props.alpha))
            : 1.0;
      container.alpha = opacity;

      const scale = typeof props.scale === 'number' ? props.scale : 1.0;
      const scaleX = typeof props.scaleX === 'number' ? props.scaleX : scale;
      const scaleY = typeof props.scaleY === 'number' ? props.scaleY : scale;
      container.scale.set(scaleX, scaleY);

      const rotDeg =
        typeof props.rotation === 'number'
          ? props.rotation
          : typeof props.angle === 'number'
            ? props.angle
            : 0;
      container.rotation = (rotDeg * Math.PI) / 180;

      // Fill and Stroke color resolution
      const rawFill = props.fill || props.color;
      const fillColor = typeof rawFill === 'string' ? hexToNumber(rawFill) : undefined;

      const rawStroke = props.stroke || props.borderColor;
      const strokeColor = typeof rawStroke === 'string' ? hexToNumber(rawStroke) : undefined;
      const strokeWidth = typeof props.strokeWidth === 'number' ? props.strokeWidth : 0;

      // Render based on Layer Type
      if (layer.type === 'shape') {
        const shape = (layer.shape || 'rect').toLowerCase();
        const x = Number(props.x ?? 0);
        const y = Number(props.y ?? 0);

        if (shape === 'circle') {
          const radius = Number(props.radius ?? props.r ?? 50);
          graphics.circle(x, y, radius);
          if (fillColor !== undefined) {
            graphics.fill({ color: fillColor });
          }
          if (strokeColor !== undefined && strokeWidth > 0) {
            graphics.stroke({ color: strokeColor, width: strokeWidth });
          }
        } else if (shape === 'rect' || shape === 'rectangle') {
          const width = Number(props.width ?? props.w ?? 100);
          const height = Number(props.height ?? props.h ?? 100);
          const radius = Number(props.radius ?? 0);

          if (radius > 0) {
            graphics.roundRect(x, y, width, height, radius);
          } else {
            graphics.rect(x, y, width, height);
          }

          if (fillColor !== undefined) {
            graphics.fill({ color: fillColor });
          }
          if (strokeColor !== undefined && strokeWidth > 0) {
            graphics.stroke({ color: strokeColor, width: strokeWidth });
          }
        } else if (shape === 'star') {
          const points = Number(props.points ?? 5);
          const radius = Number(props.radius ?? 50);
          const innerRadius = Number(props.innerRadius ?? radius * 0.5);
          graphics.star(x, y, points, radius, innerRadius);
          if (fillColor !== undefined) {
            graphics.fill({ color: fillColor });
          }
          if (strokeColor !== undefined && strokeWidth > 0) {
            graphics.stroke({ color: strokeColor, width: strokeWidth });
          }
        } else {
          // Default to rect
          const width = Number(props.width ?? 100);
          const height = Number(props.height ?? 100);
          graphics.rect(x, y, width, height);
          if (fillColor !== undefined) {
            graphics.fill({ color: fillColor });
          }
          if (strokeColor !== undefined && strokeWidth > 0) {
            graphics.stroke({ color: strokeColor, width: strokeWidth });
          }
        }
      } else if (layer.type === 'path') {
        // Progressive SVG Path Rendering via pathProgress
        const progress = Math.max(
          0,
          Math.min(1, typeof props.pathProgress === 'number' ? props.pathProgress : 1.0),
        );

        if (sampledPath && sampledPath.points.length >= 2 && progress > 0) {
          const pts = sampledPath.points;
          const targetIndex = (pts.length - 1) * progress;
          const floorIndex = Math.floor(targetIndex);
          const frac = targetIndex - floorIndex;

          const activeStroke = strokeColor !== undefined ? strokeColor : (fillColor ?? 0xffffff);
          const activeWidth = strokeWidth > 0 ? strokeWidth : 4;

          const firstPt = pts[0];
          if (!firstPt) break;
          graphics.moveTo(firstPt.x, firstPt.y);

          for (let i = 1; i <= floorIndex; i++) {
            const pt = pts[i];
            if (pt) graphics.lineTo(pt.x, pt.y);
          }

          if (frac > 0 && floorIndex + 1 < pts.length) {
            const p1 = pts[floorIndex];
            const p2 = pts[floorIndex + 1];
            if (p1 && p2) {
              const interpX = p1.x + (p2.x - p1.x) * frac;
              const interpY = p1.y + (p2.y - p1.y) * frac;
              graphics.lineTo(interpX, interpY);
            }
          }

          graphics.stroke({
            color: activeStroke,
            width: activeWidth,
            cap: 'round',
            join: 'round',
          });
        }
      } else if (layer.type === 'particle') {
        // Particle baseline visual
        const x = Number(props.x ?? 0);
        const y = Number(props.y ?? 0);
        const radius = Number(props.radius ?? props.size ?? 4);
        const pColor = fillColor ?? strokeColor ?? 0x00ffff;
        graphics.circle(x, y, radius).fill({ color: pColor });
      } else if (layer.type === 'icon') {
        // Icon baseline visual (ring / star / geometric badge)
        const x = Number(props.x ?? 0);
        const y = Number(props.y ?? 0);
        const radius = Number(props.radius ?? 40);
        const iconColor = fillColor ?? 0xffd700;
        graphics.circle(x, y, radius).stroke({ color: iconColor, width: 4 });
      } else {
        // Fallback / image-ref placeholder
        const x = Number(props.x ?? 0);
        const y = Number(props.y ?? 0);
        const width = Number(props.width ?? 100);
        const height = Number(props.height ?? 100);
        graphics.rect(x, y, width, height).stroke({ color: 0x555555, width: 2 });
      }
    }
  }

  /**
   * Start playback loop.
   */
  play(): void {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.lastTimestamp = performance.now();
    this.lastFpsUpdate = performance.now();
    this.frameCount = 0;
    this.events.onPlaybackChange?.(true);

    const tick = (now: number) => {
      if (!this.isPlaying) return;

      const deltaSec = (now - this.lastTimestamp) / 1000;
      this.lastTimestamp = now;

      // FPS tracking
      this.frameCount++;
      if (now - this.lastFpsUpdate >= 500) {
        this.fps = Math.round((this.frameCount * 1000) / (now - this.lastFpsUpdate));
        this.events.onFpsUpdate?.(this.fps);
        this.frameCount = 0;
        this.lastFpsUpdate = now;
      }

      this.currentTime += deltaSec;

      if (this.currentTime >= this.duration) {
        if (this.blueprint?.loop?.seamless) {
          // Seamless loop
          this.currentTime = this.currentTime % this.duration;
        } else {
          this.currentTime = this.duration;
          this.pause();
          this.events.onEnded?.();
        }
      }

      this.renderAtTime(this.currentTime);
      this.events.onTimeUpdate?.(this.currentTime);

      this.rafId = requestAnimationFrame(tick);
    };

    this.rafId = requestAnimationFrame(tick);
  }

  /**
   * Pause playback loop.
   */
  pause(): void {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.events.onPlaybackChange?.(false);
  }

  /**
   * Jump / seek to specific timestamp in seconds.
   */
  seek(time: number): void {
    this.currentTime = Math.max(0, Math.min(this.duration, time));
    this.renderAtTime(this.currentTime);
    this.events.onTimeUpdate?.(this.currentTime);
  }

  /**
   * Reset playback to timestamp 0 and pause.
   */
  reset(): void {
    this.pause();
    this.seek(0);
  }

  /**
   * Update render options (e.g. Green Screen toggle, Background Animations toggle).
   */
  updateSettings(options: Partial<CanvasRenderOptions>): void {
    this.options = { ...this.options, ...options };
    this.renderAtTime(this.currentTime);
  }

  /**
   * Resize canvas resolution and adjust scale.
   */
  resize(width: number, height: number): void {
    if (!this.app) return;
    this.app.renderer.resize(width, height);
    this.updateViewportScale();
    this.renderAtTime(this.currentTime);
  }

  /**
   * Current playback state for UI inspection.
   */
  getPlaybackState(): PlaybackState {
    return {
      currentTime: this.currentTime,
      duration: this.duration,
      isPlaying: this.isPlaying,
      fps: this.fps,
    };
  }

  /**
   * Clean up and destroy PixiJS instance and listeners.
   */
  destroy(): void {
    this.pause();
    if (this.app) {
      this.app.destroy(true, { children: true });
      this.app = null;
    }
    this.layers = [];
    this.blueprint = null;
  }
}
