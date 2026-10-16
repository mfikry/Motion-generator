import { contextBridge, ipcRenderer } from 'electron';
import type { ElectronAPI } from '@genc/shared-types';

/**
 * Preload script — the ONLY bridge between main and renderer processes.
 * contextIsolation: true ensures renderer cannot access Node.js APIs directly.
 * All IPC communication is explicitly exposed here via contextBridge.
 *
 * SECURITY: API key values are accepted as input (for adding) but NEVER
 * returned to renderer. All return types are metadata-only.
 */
const electronAPI: ElectronAPI = {
  getAppVersion: () => ipcRenderer.invoke('app:get-version'),

  // API Key Management — returns metadata only, NEVER the actual key
  addApiKey: (key: string, label: string) => ipcRenderer.invoke('apiKey:add', { key, label }),

  removeApiKey: (id: string) => ipcRenderer.invoke('apiKey:remove', { id }),

  listApiKeys: () => ipcRenderer.invoke('apiKey:list'),

  validateApiKey: (id: string) => ipcRenderer.invoke('apiKey:validate', { id }),

  validateAllApiKeys: () => ipcRenderer.invoke('apiKey:validate-all'),

  getApiKeyPoolStatus: () => ipcRenderer.invoke('apiKey:pool-status'),

  // AI Architect Generation
  generateText: (request) => ipcRenderer.invoke('ai:generate-text', request),

  getGenerations: (limit) => ipcRenderer.invoke('ai:get-generations', { limit }),

  // Render Pipeline (E8)
  startRender: (params) => ipcRenderer.invoke('render:start', params),

  cancelRender: (jobId) => ipcRenderer.invoke('render:cancel', jobId),

  selectOutputFolder: () => ipcRenderer.invoke('render:select-output'),

  getGpuInfo: () => ipcRenderer.invoke('render:get-gpu-info'),

  onRenderProgress: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: unknown) => {
      callback(progress as Parameters<typeof callback>[0]);
    };
    ipcRenderer.on('render:progress', handler);
    return () => ipcRenderer.removeListener('render:progress', handler);
  },

  onRenderComplete: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, result: unknown) => {
      callback(result as Parameters<typeof callback>[0]);
    };
    ipcRenderer.on('render:complete', handler);
    return () => ipcRenderer.removeListener('render:complete', handler);
  },

  onRenderError: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, error: unknown) => {
      callback(error as Parameters<typeof callback>[0]);
    };
    ipcRenderer.on('render:error', handler);
    return () => ipcRenderer.removeListener('render:error', handler);
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// Offscreen Render Harness Bridge (E8)
contextBridge.exposeInMainWorld('__renderOffscreen', {
  ready: () => ipcRenderer.send('render-offscreen:ready'),
  initError: (error: string) => ipcRenderer.send('render-offscreen:init-error', error),
  onExecuteFrame: (
    callback: (
      requestId: string,
      code: string,
      t: number,
      width: number,
      height: number,
      seed: number,
      options?: Record<string, unknown>
    ) => void
  ) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      requestId: string,
      code: string,
      t: number,
      width: number,
      height: number,
      seed: number,
      options?: Record<string, unknown>
    ) => {
      callback(requestId, code, t, width, height, seed, options);
    };
    ipcRenderer.on('render-offscreen:execute-frame', handler);
    return () => ipcRenderer.removeListener('render-offscreen:execute-frame', handler);
  },
  sendFrameResult: (requestId: string, pixelData: Uint8Array, executionTimeMs?: number) => {
    ipcRenderer.send('render-offscreen:frame-result', requestId, pixelData, executionTimeMs);
  },
  sendFrameError: (requestId: string, error: string) => {
    ipcRenderer.send('render-offscreen:frame-error', requestId, error);
  },
  onDispose: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('render-offscreen:dispose', handler);
    return () => ipcRenderer.removeListener('render-offscreen:dispose', handler);
  },
});

