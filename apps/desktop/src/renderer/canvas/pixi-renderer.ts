import { Application, Container, Graphics, ParticleContainer, Particle, Rectangle, Texture } from 'pixi.js';
import type { CanvasRenderOptions, MotionRendererEvents, PlaybackState } from './types';
import type {
  MotionBlueprint,
  MotionLayer,
  ParticleMotionPattern,
  ParticleSystemProperties,
} from '@genc/shared-types';
import { interpolateLayerProperties } from './interpolator';
import { sampleSvgPath, type SampledPath } from './path-sampler';
import { hexToNumber } from './easing';
import { createPRNG, prngRange, prngChoice } from './prng';

interface ParticleInstanceData {
  particle: Particle;
  x0: number;
  y0: number;
  baseAlpha: number;
  speedMultiplier: number;
  driftAmpX: number;
  driftAmpY: number;
  driftFreqX: number;
  driftFreqY: number;
  phaseX: number;
  phaseY: number;
  orbitRadius: number;
  orbitSpeed: number;
  orbitPhase: number;
}

interface ParticleSystemRuntime {
  pContainer: ParticleContainer;
  area: { x: number; y: number; width: number; height: number };
  motionPattern: ParticleMotionPattern;
  particles: ParticleInstanceData[];
  update: (tNormalized: number) => void;
}

interface LayerRecord {
  layer: MotionLayer;
  container: Container;
  graphics: Graphics;
  sampledPath?: SampledPath;
  particleSystem?: ParticleSystemRuntime;
}

import { calculateLayerPivot } from './layer-pivot';
export { calculateLayerPivot };

/**
 * MotionPreviewRenderer
 *
 * Core engine that drives real-time PixiJS v8 rendering of Motion Blueprints.
 * Follows the "what you preview is what you render" paradigm — this same class
 * can be reused in both the browser UI and headless offscreen Electron workers.
 *
 * v1.1: Implements Time Remap — blueprint keyframes are in normalized progress
 * (0.0–1.0). Playback seconds are remapped: tNorm = tSec / durationSec.
 * Duration is set by the UI ("Time Anim" setting), not by the blueprint.
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
  private particleCircleTexture: Texture | null = null;
  private targetDimensions = { width: 1080, height: 1080 };

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
      this.renderAtTime(0);
    }
  }

  /**
   * Generates or returns a reusable circular texture for ParticleContainer.
   * Falls back to Texture.WHITE if canvas/WebGL context does not support texture generation.
   */
  private getParticleTexture(): Texture {
    if (this.particleCircleTexture) {
      return this.particleCircleTexture;
    }
    try {
      if (this.app?.renderer) {
        const g = new Graphics().circle(16, 16, 16).fill(0xffffff);
        this.particleCircleTexture = this.app.renderer.generateTexture(g);
        g.destroy();
        return this.particleCircleTexture;
      }
    } catch {
      // Fallback
    }
    return Texture.WHITE;
  }

  /**
   * Instantiate a high-performance procedural ParticleContainer driven by Mulberry32 PRNG.
   * v1.2: Deterministic particles moving in periodic loops over normalized time t in [0.0, 1.0].
   */
  private createParticleSystem(layer: MotionLayer): ParticleSystemRuntime {
    const props = (layer.properties || {}) as ParticleSystemProperties;
    const count =
      typeof props.count === 'number'
        ? Math.max(1, Math.min(500, Math.round(props.count)))
        : 50;
    const bpWidth = this.blueprint?.canvas.width || 1080;
    const bpHeight = this.blueprint?.canvas.height || 1080;

    const area = {
      x: props.area?.x ?? 0,
      y: props.area?.y ?? 0,
      width: props.area?.width && props.area.width > 0 ? props.area.width : bpWidth,
      height: props.area?.height && props.area.height > 0 ? props.area.height : bpHeight,
    };

    const sizeRange =
      props.sizeRange && props.sizeRange.length === 2 ? props.sizeRange : [2, 6];
    const colorPalette =
      props.colorPalette && props.colorPalette.length > 0
        ? props.colorPalette
        : ['#00ffff', '#ffffff', '#7b2cbf'];
    const motionPattern: ParticleMotionPattern = props.motionPattern || 'float-up-wrap';
    const speedRange =
      props.speedRange && props.speedRange.length === 2 ? props.speedRange : [1, 3];
    const seed = typeof props.seed === 'number' ? props.seed : 12345;

    const prng = createPRNG(seed);
    const texture = this.getParticleTexture();
    const baseTextureSize = texture.width || 32;

    const pContainer = new ParticleContainer({
      texture,
      dynamicProperties: {
        position: true,
        color: true,
      },
      boundsArea: new Rectangle(area.x, area.y, area.width, area.height),
    });

    const particles: ParticleInstanceData[] = [];
    const minSpeed = Math.min(speedRange[0] ?? 1, speedRange[1] ?? 3);
    const maxSpeed = Math.max(speedRange[0] ?? 1, speedRange[1] ?? 3);

    const cx = area.x + area.width / 2;
    const cy = area.y + area.height / 2;
    const maxOrbitR = Math.min(area.width, area.height) * 0.45;
    const minOrbitR = maxOrbitR * 0.15;

    for (let i = 0; i < count; i++) {
      const radius = prngRange(prng, sizeRange[0] ?? 2, sizeRange[1] ?? 6);
      const hexColor = prngChoice(prng, colorPalette);
      const tint = hexToNumber(hexColor);
      const baseAlpha = prngRange(prng, 0.4, 1.0);
      const speed = prngRange(prng, minSpeed, maxSpeed);
      const cycleCount = Math.max(1, Math.round(speed));

      const x0 = prngRange(prng, area.x, area.x + area.width);
      const y0 = prngRange(prng, area.y, area.y + area.height);

      const scale = (radius * 2) / baseTextureSize;

      const particle = new Particle({
        texture,
        x: x0,
        y: y0,
        scaleX: scale,
        scaleY: scale,
        anchorX: 0.5,
        anchorY: 0.5,
        tint,
        alpha: baseAlpha,
      });

      pContainer.addParticle(particle);

      const dir = prngRange(prng, 0, 1) > 0.5 ? 1 : -1;

      particles.push({
        particle,
        x0,
        y0,
        baseAlpha,
        speedMultiplier: cycleCount,
        driftAmpX: prngRange(prng, 8, 30),
        driftAmpY: prngRange(prng, 8, 30),
        driftFreqX: Math.max(1, Math.round(prngRange(prng, 1, 3))),
        driftFreqY: Math.max(1, Math.round(prngRange(prng, 1, 3))),
        phaseX: prngRange(prng, 0, Math.PI * 2),
        phaseY: prngRange(prng, 0, Math.PI * 2),
        orbitRadius: prngRange(prng, minOrbitR, maxOrbitR),
        orbitSpeed: dir * cycleCount,
        orbitPhase: prngRange(prng, 0, Math.PI * 2),
      });
    }

    const H = area.height;

    const update = (t: number) => {
      // Normalized progress in [0, 1]
      const progress = t >= 1.0 ? 1.0 : ((t % 1.0) + 1.0) % 1.0;

      for (const pData of particles) {
        const p = pData.particle;

        switch (motionPattern) {
          case 'float-up-wrap': {
            const dy = pData.speedMultiplier * H * progress;
            const yOffset = ((pData.y0 - area.y - dy) % H + H) % H;
            p.y = area.y + yOffset;
            p.x =
              pData.x0 +
              pData.driftAmpX * Math.sin(2 * Math.PI * pData.driftFreqX * progress + pData.phaseX);
            p.alpha = pData.baseAlpha;
            break;
          }

          case 'fall-wrap': {
            const dy = pData.speedMultiplier * H * progress;
            const yOffset = ((pData.y0 - area.y + dy) % H + H) % H;
            p.y = area.y + yOffset;
            p.x =
              pData.x0 +
              pData.driftAmpX * Math.sin(2 * Math.PI * pData.driftFreqX * progress + pData.phaseX);
            p.alpha = pData.baseAlpha;
            break;
          }

          case 'orbit-center': {
            const theta = pData.orbitPhase + 2 * Math.PI * pData.orbitSpeed * progress;
            p.x = cx + pData.orbitRadius * Math.cos(theta);
            p.y = cy + pData.orbitRadius * Math.sin(theta);
            p.alpha = pData.baseAlpha;
            break;
          }

          case 'drift-random': {
            p.x =
              pData.x0 +
              pData.driftAmpX * Math.sin(2 * Math.PI * pData.driftFreqX * progress + pData.phaseX);
            p.y =
              pData.y0 +
              pData.driftAmpY * Math.cos(2 * Math.PI * pData.driftFreqY * progress + pData.phaseY);
            const alphaPulse =
              0.8 + 0.2 * Math.sin(2 * Math.PI * pData.driftFreqX * progress + pData.phaseX);
            p.alpha = Math.max(0, Math.min(1, pData.baseAlpha * alphaPulse));
            break;
          }
        }
      }

      if (typeof pContainer.update === 'function') {
        pContainer.update();
      }
    };

    return {
      pContainer,
      area,
      motionPattern,
      particles,
      update,
    };
  }

  /**
   * Load and interpret a validated Motion Blueprint.
   * v1.1: Duration is NOT read from blueprint (durationSec removed).
   */
  loadBlueprint(blueprint: MotionBlueprint): void {
    this.blueprint = blueprint;
    this.currentTime = 0;

    if (!this.layersContainer) return;

    // Clear previous layer objects
    for (const item of this.layers) {
      if (item.particleSystem) {
        item.particleSystem.pContainer.destroy({ children: true });
      }
      item.container.destroy({ children: true });
    }
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

      let particleSystem: ParticleSystemRuntime | undefined;
      if (layer.type === 'particle-system') {
        particleSystem = this.createParticleSystem(layer);
        container.addChild(particleSystem.pContainer);
      }

      this.layers.push({
        layer,
        container,
        graphics,
        sampledPath,
        particleSystem,
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

    const bpWidth = this.blueprint?.canvas.width || this.targetDimensions.width;
    const bpHeight = this.blueprint?.canvas.height || this.targetDimensions.height;

    const scale = Math.min(canvasWidth / bpWidth, canvasHeight / bpHeight);
    this.rootContainer.scale.set(scale);

    const offsetX = (canvasWidth - bpWidth * scale) / 2;
    const offsetY = (canvasHeight - bpHeight * scale) / 2;
    this.rootContainer.position.set(offsetX, offsetY);
  }

  /**
   * Update the default canvas aspect ratio / dimensions when no blueprint is loaded yet.
   */
  setTargetDimensions(width: number, height: number): void {
    this.targetDimensions = { width, height };
    this.updateViewportScale();
    this.renderAtTime(this.currentTime);
  }

  /**
   * Set the playback duration in seconds (from UI "Time Anim" setting).
   * v1.1: Duration is purely a UI parameter — changing it triggers re-render
   * with new time remap scale, without re-generating the blueprint.
   */
  setDuration(durationSec: number): void {
    this.duration = Math.max(0.1, durationSec);
    // Re-render current frame with new time scale
    this.renderAtTime(this.currentTime);
  }

  /**
   * Render the exact frame corresponding to timestamp t (in playback seconds).
   * v1.1 Time Remap: converts playback seconds to normalized progress (0.0–1.0)
   * before evaluating keyframe interpolation.
   */
  renderAtTime(t: number): void {
    if (!this.backgroundGraphics) return;

    const bpWidth = this.blueprint?.canvas.width || this.targetDimensions.width;
    const bpHeight = this.blueprint?.canvas.height || this.targetDimensions.height;

    // 1. Background Rendering
    this.backgroundGraphics.clear();
    if (this.options.greenScreen) {
      // Solid chroma green #00B140
      this.backgroundGraphics.rect(0, 0, bpWidth, bpHeight).fill({ color: 0x00b140, alpha: 1.0 });
    } else if (
      this.blueprint?.canvas.background &&
      this.blueprint.canvas.background !== 'transparent'
    ) {
      const bgColor = hexToNumber(this.blueprint.canvas.background);
      this.backgroundGraphics.rect(0, 0, bpWidth, bpHeight).fill({ color: bgColor, alpha: 1.0 });
    }

    // Canvas frame boundary outline for clean preview bounding (letterbox / pillarbox)
    this.backgroundGraphics
      .rect(0, 0, bpWidth, bpHeight)
      .stroke({ color: 0x473b6b, width: 1, alpha: 0.7 });
    // If transparent and green screen OFF, backgroundGraphics is empty (CSS checkerboard shows through)

    // v1.1 Time Remap: convert playback seconds to normalized progress
    const tNormalized = this.duration > 0 ? Math.min(1.0, t / this.duration) : 0;

    // 2. Layer Rendering
    for (const item of this.layers) {
      const { layer, container, graphics, sampledPath, particleSystem } = item;
      const props = interpolateLayerProperties(layer, tNormalized, {
        backgroundAnimations: this.options.backgroundAnimations,
      });

      graphics.clear();

      if (particleSystem) {
        particleSystem.update(tNormalized);
      }

      // 1. Calculate explicit geometric pivot to ensure rotation & scaling happen in-place
      const { pivotX, pivotY } = calculateLayerPivot(layer, props, sampledPath);
      container.pivot.set(pivotX, pivotY);
      container.position.set(pivotX, pivotY);

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
        } else if (shape === 'polygon') {
          const sides = Math.max(3, Number(props.sides ?? 6));
          const radius = Number(props.radius ?? props.r ?? 50);
          const polyPoints: number[] = [];
          for (let i = 0; i < sides; i++) {
            const angle = (i * 2 * Math.PI) / sides - Math.PI / 2;
            polyPoints.push(x + radius * Math.cos(angle), y + radius * Math.sin(angle));
          }
          graphics.poly(polyPoints);
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
          if (!firstPt) continue;
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
      } else if (layer.type === 'particle-system') {
        // Procedurally rendered via particleSystem & ParticleContainer
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
    for (const item of this.layers) {
      if (item.particleSystem) {
        item.particleSystem.pContainer.destroy({ children: true });
      }
      item.container.destroy({ children: true });
    }
    if (this.particleCircleTexture) {
      this.particleCircleTexture.destroy(true);
      this.particleCircleTexture = null;
    }
    if (this.app) {
      this.app.destroy(true, { children: true });
      this.app = null;
    }
    this.layers = [];
    this.blueprint = null;
  }
}
