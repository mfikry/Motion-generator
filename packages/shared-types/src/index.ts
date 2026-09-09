/**
 * @genc/shared-types
 *
 * Shared TypeScript type definitions used across main, renderer, and packages.
 * Extended as needed in subsequent epics.
 */

/** IPC Channel names — single source of truth for main↔renderer communication */
export const IPC_CHANNELS = {
  GET_APP_VERSION: 'app:get-version',
} as const;

export type IpcChannelName = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

/** API Key status */
export type ApiKeyStatus = 'valid' | 'rate_limited' | 'invalid';

/** Render job status */
export type RenderJobStatus = 'queued' | 'rendering' | 'encoding' | 'done' | 'failed';

/** Compute mode for rendering */
export type ComputeMode = 'cpu' | 'gpu';

/** Thinking level for AI generation */
export type ThinkingLevel = 'low' | 'medium' | 'high';

/** Supported export formats */
export type ExportFormat = 'mp4' | 'mov' | 'webm';

/** Resolution presets */
export type ResolutionPreset = '4k' | '1080p' | '720p' | 'custom';

/** FPS options */
export type FpsOption = 24 | 30 | 60;

/** Rules animation complexity */
export type RulesAnimationLevel = 'simple' | 'high' | 'expert';

/** Easing preset */
export type EasingPreset = 'off' | 'natural' | 'strong';

/** Background color mode */
export type ColorsBgMode = 'solid' | 'gradient' | 'pastel';

/** Electron API exposed to renderer via contextBridge */
export interface ElectronAPI {
  getAppVersion: () => Promise<string>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
