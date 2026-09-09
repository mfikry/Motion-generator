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
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
