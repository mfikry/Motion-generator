import { contextBridge, ipcRenderer } from 'electron';

/**
 * Preload script — the ONLY bridge between main and renderer processes.
 * contextIsolation: true ensures renderer cannot access Node.js APIs directly.
 * All IPC communication is explicitly exposed here via contextBridge.
 */
contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: (): Promise<string> => ipcRenderer.invoke('app:get-version'),
});
