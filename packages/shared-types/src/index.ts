/**
 * @genc/shared-types
 *
 * Shared TypeScript type definitions used across main, renderer, and packages.
 */

/** IPC Channel names — single source of truth for main↔renderer communication */
export const IPC_CHANNELS = {
  GET_APP_VERSION: 'app:get-version',
  // API Key Management
  API_KEY_ADD: 'apiKey:add',
  API_KEY_REMOVE: 'apiKey:remove',
  API_KEY_LIST: 'apiKey:list',
  API_KEY_VALIDATE: 'apiKey:validate',
  API_KEY_VALIDATE_ALL: 'apiKey:validate-all',
  API_KEY_POOL_STATUS: 'apiKey:pool-status',
} as const;

export type IpcChannelName = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

/** API Key status */
export type ApiKeyStatus = 'valid' | 'rate_limited' | 'invalid';

/** API Key metadata — safe to send to renderer (NEVER contains the actual key) */
export interface ApiKeyMetadata {
  id: string;
  label: string;
  status: ApiKeyStatus;
  lastCheckedAt: string | null;
}

/** API Key pool status summary for UI counter */
export interface ApiKeyPoolStatus {
  total: number;
  valid: number;
  rateLimited: number;
  invalid: number;
}

/** Result of adding an API key */
export interface ApiKeyAddResult {
  success: boolean;
  metadata?: ApiKeyMetadata;
  error?: string;
}

/** Result of validating an API key */
export interface ApiKeyValidateResult {
  success: boolean;
  status: ApiKeyStatus;
  error?: string;
}

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
  // API Key Management — renderer only sees metadata, NEVER the key itself
  addApiKey: (key: string, label: string) => Promise<ApiKeyAddResult>;
  removeApiKey: (id: string) => Promise<{ success: boolean; error?: string }>;
  listApiKeys: () => Promise<ApiKeyMetadata[]>;
  validateApiKey: (id: string) => Promise<ApiKeyValidateResult>;
  validateAllApiKeys: () => Promise<ApiKeyMetadata[]>;
  getApiKeyPoolStatus: () => Promise<ApiKeyPoolStatus>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
