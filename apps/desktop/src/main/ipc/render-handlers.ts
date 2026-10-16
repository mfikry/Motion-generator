/**
 * Render Pipeline IPC Handlers (E8)
 *
 * Registers IPC handlers for render:start, render:cancel, and
 * render:select-output on the main process side.
 */

import { ipcMain, dialog, BrowserWindow } from 'electron';
import { RenderPipeline } from '../render/render-pipeline';
import { detectGpuHardware } from '../render/ffmpeg-encoder';
import type { RenderStartParams, RenderStartResult } from '@genc/shared-types';

let pipeline: RenderPipeline | null = null;

function getPipeline(): RenderPipeline {
  if (!pipeline) {
    pipeline = new RenderPipeline();
  }
  return pipeline;
}

/**
 * Registers all render-related IPC handlers.
 */
export function registerRenderHandlers(): void {
  // Start a render job
  ipcMain.handle(
    'render:start',
    async (_event, params: RenderStartParams): Promise<RenderStartResult> => {
      try {
        const result = await getPipeline().startRender(params);
        return { success: true, jobId: result.jobId };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        return { success: false, error: errorMsg };
      }
    }
  );

  // Cancel the active render job
  ipcMain.handle('render:cancel', async (_event, jobId: string): Promise<void> => {
    getPipeline().cancelRender(jobId);
  });

  // Open folder picker dialog for output path
  ipcMain.handle('render:select-output', async (): Promise<string | null> => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return null;

    const result = await dialog.showOpenDialog(win, {
      title: 'Select Output Folder',
      properties: ['openDirectory', 'createDirectory'],
      buttonLabel: 'Select Folder',
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0] ?? null;
  });

  // Query GPU hardware detection info
  ipcMain.handle('render:get-gpu-info', async () => {
    return detectGpuHardware();
  });
}
