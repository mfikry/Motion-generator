import type { MotionBlueprint, MotionLayer } from '@genc/shared-types';

/**
 * Options controlling canvas rendering appearance and behavior.
 */
export interface CanvasRenderOptions {
  /** If true, renders a solid chroma green (#00B140) background. If false, background is transparent. */
  greenScreen: boolean;
  /** If true, background layers animate normally. If false, background layer animations are frozen at t=0. */
  backgroundAnimations: boolean;
  /** Width of the target render canvas */
  width?: number;
  /** Height of the target render canvas */
  height?: number;
}

/**
 * Playback state for preview controls.
 */
export interface PlaybackState {
  /** Current timeline position in seconds */
  currentTime: number;
  /** Total animation duration in seconds */
  duration: number;
  /** Whether the playback loop is currently active */
  isPlaying: boolean;
  /** Real-time rendered frames per second */
  fps: number;
}

/**
 * Interpolated layer properties at a specific timestamp.
 */
export interface InterpolatedProperties {
  x?: number;
  y?: number;
  cx?: number;
  cy?: number;
  width?: number;
  height?: number;
  radius?: number;
  innerRadius?: number;
  outerRadius?: number;
  points?: number;
  sides?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  rotation?: number;
  scale?: number;
  scaleX?: number;
  scaleY?: number;
  pathProgress?: number;
  [key: string]: unknown;
}

/**
 * Event callbacks emitted by the MotionPreviewRenderer.
 */
export interface MotionRendererEvents {
  /** Fired on each frame render with current timestamp in seconds */
  onTimeUpdate?: (currentTime: number) => void;
  /** Fired when animation reaches durationSec */
  onEnded?: () => void;
  /** Fired on playback state change (play/pause) */
  onPlaybackChange?: (isPlaying: boolean) => void;
  /** Fired with real-time FPS calculations */
  onFpsUpdate?: (fps: number) => void;
}

/**
 * Interface representing a scene object created for a layer in PixiJS.
 */
export interface LayerSceneNode {
  layer: MotionLayer;
  /** The container or graphics object in the PixiJS stage */
  container: unknown;
  /** Optional pre-computed path metadata for progressive path animations */
  pathData?: string;
  /** Total length of SVG path if applicable */
  totalPathLength?: number;
  /** Pre-sampled path points */
  sampledPoints?: Array<{ x: number; y: number }>;
}

export type { MotionBlueprint, MotionLayer };
