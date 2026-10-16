/**
 * Render Job Store (E8 — Phase 2)
 *
 * Zustand store managing render job state in the renderer process.
 * Controls resolution, FPS, format (MP4, MOV ProRes 4444, WebM VP9),
 * rate control (CBR vs VBR), bitrate, and compute mode (CPU vs GPU).
 */

import { create } from 'zustand';
import type {
  RenderProgress,
  RenderCompleteResult,
  RenderErrorResult,
  RenderStartParams,
  FpsOption,
  ExportFormat,
  AspectRatio,
  RateControl,
  ComputeMode,
  GpuDeviceInfo,
} from '@genc/shared-types';
import { useRenderSettingsStore } from './renderSettingsStore';

export type RenderPhase =
  | 'idle'
  | 'starting'
  | 'rendering'
  | 'encoding'
  | 'finalizing'
  | 'done'
  | 'failed'
  | 'cancelled';

export interface RenderJobState {
  // Render settings (persisted across renders)
  outputFolder: string;
  fps: FpsOption;
  format: ExportFormat;
  bitrateKbps: number;
  rateControl: RateControl;
  computeMode: ComputeMode;
  resolution: '4k' | '1080p' | '720p';

  // Hardware GPU info
  gpuInfo: GpuDeviceInfo | null;
  isDetectingGpu: boolean;
  fallbackWarning: string | null;

  // Active job state
  phase: RenderPhase;
  jobId: string | null;
  currentFrame: number;
  totalFrames: number;
  percent: number;
  elapsedMs: number;
  estimatedRemainingMs: number;
  error: string | null;
  lastResult: RenderCompleteResult | null;

  // Actions
  setOutputFolder: (folder: string) => void;
  setFps: (fps: FpsOption) => void;
  setFormat: (format: ExportFormat) => void;
  setBitrateKbps: (bitrate: number) => void;
  setRateControl: (rateControl: RateControl) => void;
  setComputeMode: (computeMode: ComputeMode) => void;
  setResolution: (resolution: '4k' | '1080p' | '720p') => void;
  selectOutputFolder: () => Promise<void>;
  fetchGpuInfo: () => Promise<void>;
  startRender: (
    generationId: string,
    code: string,
    durationSec: number,
    aspectRatio: AspectRatio
  ) => Promise<void>;
  cancelRender: () => Promise<void>;
  reset: () => void;
}

/**
 * Returns pixel dimensions for a resolution preset + aspect ratio.
 */
function getResolutionDimensions(
  resolution: '4k' | '1080p' | '720p',
  aspectRatio: AspectRatio
): { width: number; height: number } {
  const baseDimensions: Record<AspectRatio, { width: number; height: number }> = {
    '16:9': { width: 1920, height: 1080 },
    '9:16': { width: 1080, height: 1920 },
    '1:1': { width: 1080, height: 1080 },
  };

  const base = baseDimensions[aspectRatio];
  const scales: Record<string, number> = {
    '4k': 2.0,
    '1080p': 1.0,
    '720p': 720 / 1080,
  };

  const scale = scales[resolution] ?? 1.0;
  return {
    width: Math.round(base.width * scale),
    height: Math.round(base.height * scale),
  };
}

export const useRenderJobStore = create<RenderJobState>((set, get) => ({
  // Default render settings
  outputFolder: 'F:\\PROJECT\\Motion generator\\output',
  fps: 60,
  format: 'mp4',
  bitrateKbps: 35000,
  rateControl: 'cbr',
  computeMode: 'cpu',
  resolution: '1080p',

  gpuInfo: null,
  isDetectingGpu: false,
  fallbackWarning: null,

  // Job state
  phase: 'idle',
  jobId: null,
  currentFrame: 0,
  totalFrames: 0,
  percent: 0,
  elapsedMs: 0,
  estimatedRemainingMs: 0,
  error: null,
  lastResult: null,

  // Settings actions
  setOutputFolder: (outputFolder) => set({ outputFolder }),
  setFps: (fps) => set({ fps }),
  setFormat: (format) => set({ format }),
  setBitrateKbps: (bitrateKbps) => set({ bitrateKbps }),
  setRateControl: (rateControl) => set({ rateControl }),
  setComputeMode: (computeMode) => set({ computeMode }),
  setResolution: (resolution) => set({ resolution }),

  selectOutputFolder: async () => {
    if (!window.electronAPI) return;
    const folder = await window.electronAPI.selectOutputFolder();
    if (folder) {
      set({ outputFolder: folder });
    }
  },

  fetchGpuInfo: async () => {
    if (!window.electronAPI?.getGpuInfo) return;
    set({ isDetectingGpu: true });
    try {
      const gpuInfo = await window.electronAPI.getGpuInfo();
      set({ gpuInfo, isDetectingGpu: false });
    } catch {
      set({ isDetectingGpu: false });
    }
  },

  startRender: async (generationId, code, durationSec, aspectRatio) => {
    const state = get();
    if (!window.electronAPI) {
      set({ error: 'Electron API not available', phase: 'failed' });
      return;
    }

    if (state.phase === 'rendering' || state.phase === 'encoding' || state.phase === 'starting') {
      set({ error: 'A render is already in progress' });
      return;
    }

    const { width, height } = getResolutionDimensions(state.resolution, aspectRatio);
    const totalFrames = Math.ceil(durationSec * state.fps);

    // Read greenScreen toggle from renderSettingsStore
    const greenScreen = useRenderSettingsStore.getState().greenScreen;

    // Generate output filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const cleanFolder = state.outputFolder.replace(/[/\\]+$/, '');
    const outputPath = `${cleanFolder}\\GEN_C_${timestamp}.${state.format}`;

    set({
      phase: 'starting',
      jobId: null,
      currentFrame: 0,
      totalFrames,
      percent: 0,
      elapsedMs: 0,
      estimatedRemainingMs: 0,
      error: null,
      lastResult: null,
      fallbackWarning: null,
    });

    const params: RenderStartParams = {
      generationId,
      code,
      outputPath,
      durationSec,
      fps: state.fps,
      width,
      height,
      format: state.format,
      bitrateKbps: state.bitrateKbps,
      rateControl: state.rateControl,
      computeMode: state.computeMode,
      greenScreen,
      seed: 1337,
    };

    try {
      const result = await window.electronAPI.startRender(params);
      if (result.success && result.jobId) {
        set({ jobId: result.jobId, phase: 'rendering' });
      } else {
        set({ phase: 'failed', error: result.error ?? 'Failed to start render' });
      }
    } catch (err) {
      set({ phase: 'failed', error: err instanceof Error ? err.message : String(err) });
    }
  },

  cancelRender: async () => {
    const state = get();
    if (!window.electronAPI || !state.jobId) return;

    try {
      await window.electronAPI.cancelRender(state.jobId);
      set({ phase: 'cancelled' });
    } catch {
      // Ignore cancel errors
    }
  },

  reset: () =>
    set({
      phase: 'idle',
      jobId: null,
      currentFrame: 0,
      totalFrames: 0,
      percent: 0,
      elapsedMs: 0,
      estimatedRemainingMs: 0,
      error: null,
      fallbackWarning: null,
    }),
}));

/**
 * Initializes IPC event listeners for render progress/complete/error.
 * Should be called once at app startup.
 */
export function initRenderJobListeners(): () => void {
  if (!window.electronAPI) return () => {};

  // Fetch GPU hardware information on startup
  useRenderJobStore.getState().fetchGpuInfo().catch(() => {});

  const cleanupProgress = window.electronAPI.onRenderProgress((progress: RenderProgress) => {
    useRenderJobStore.setState({
      currentFrame: progress.currentFrame,
      totalFrames: progress.totalFrames,
      percent: progress.percent,
      phase: progress.phase,
      elapsedMs: progress.elapsedMs,
      estimatedRemainingMs: progress.estimatedRemainingMs ?? 0,
      fallbackWarning: progress.fallbackWarning ?? useRenderJobStore.getState().fallbackWarning,
    });
  });

  const cleanupComplete = window.electronAPI.onRenderComplete((result: RenderCompleteResult) => {
    useRenderJobStore.setState({
      phase: 'done',
      lastResult: result,
      percent: 100,
      fallbackWarning: result.fallbackWarning ?? null,
    });
  });

  const cleanupError = window.electronAPI.onRenderError((error: RenderErrorResult) => {
    useRenderJobStore.setState({
      phase: 'failed',
      error: error.error,
    });
  });

  return () => {
    cleanupProgress();
    cleanupComplete();
    cleanupError();
  };
}
