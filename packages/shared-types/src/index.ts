/**
 * @genc/shared-types
 *
 * Shared TypeScript type definitions used across main, renderer, and packages.
 */

import type { MotionBlueprint } from '@genc/motion-schema';

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
  // AI Architect Generation
  AI_GENERATE_TEXT: 'ai:generate-text',
  AI_GET_GENERATIONS: 'ai:get-generations',
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

/** Supported aspect ratios */
export type AspectRatio = '16:9' | '9:16' | '1:1';
export const ASPECT_RATIOS: AspectRatio[] = ['16:9', '9:16', '1:1'];

export const ASPECT_RATIO_DIMENSIONS: Record<AspectRatio, { width: number; height: number }> = {
  '16:9': { width: 1920, height: 1080 },
  '9:16': { width: 1080, height: 1920 },
  '1:1': { width: 1080, height: 1080 },
};

/** Render settings applied to generation (v1.1: durationSec removed — purely UI param; v1.2: introOutro added; v1.3: aspectRatio added) */
export interface GenerateTextSettings {
  noText?: boolean;
  rulesLevel?: RulesAnimationLevel;
  seamless?: boolean;
  greenScreen?: boolean;
  backgroundColor?: string;
  introOutro?: boolean;
  aspectRatio?: AspectRatio;
}

/** Request payload for text mode generation */
export interface GenerateTextRequest {
  prompt: string;
  model?: string;
  thinkingLevel?: ThinkingLevel;
  variations?: number; // 1-5
  batchSize?: number; // 1-5
  settings?: GenerateTextSettings;
}

/** Result returned from text mode generation */
export interface GenerateTextResult {
  success: boolean;
  blueprints: MotionBlueprint[];
  codes?: string[];
  totalTasks: number;
  completedTasks: number;
  error?: string;
  retriesUsed?: number;
  modelUsed?: string;
}

/** Row shape from SQLite generations table */
export interface GenerationRecord {
  id: string;
  projectId: string | null;
  promptText: string;
  referenceImages: string | null;
  modelUsed: string;
  thinkingLevel: string;
  blueprintJson?: string;
  codeText?: string;
  tokenUsage: number | null;
  createdAt: string;
}

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
  // AI Architect Generation
  generateText: (request: GenerateTextRequest) => Promise<GenerateTextResult>;
  getGenerations: (limit?: number) => Promise<GenerationRecord[]>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

// Re-export Motion Blueprint schema types and validator for unified imports
export type {
  LayerType,
  EasingFunction,
  CanvasConfig,
  LoopConfig,
  MotionKeyframe,
  MotionLayer,
  MotionBlueprint,
  ValidateMotionBlueprintResult,
  LoopConsistencyResult,
  ParticleMotionPattern,
  ParticleSystemArea,
  ParticleSystemProperties,
} from '@genc/motion-schema';

export {
  LAYER_TYPES,
  EASING_FUNCTIONS,
  RULES_ANIMATION_LEVELS,
  PARTICLE_MOTION_PATTERNS,
  validateMotionBlueprint,
  checkLoopConsistency,
  LOOP_TOLERANCES,
} from '@genc/motion-schema';
