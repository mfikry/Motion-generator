/**
 * Offscreen BrowserWindow Manager (E8)
 *
 * Creates and manages a hidden BrowserWindow that runs the render-offscreen
 * harness. Provides a simple request/response API for rendering individual
 * frames using the same SandboxedCodeExecutor as the live preview.
 */

import { BrowserWindow, ipcMain, app } from 'electron';
import path from 'node:path';

const isDev = process.env.NODE_ENV !== 'production' && !(app?.isPackaged ?? false);

export interface FrameRenderResult {
  success: boolean;
  pixelBuffer?: Buffer;
  executionTimeMs?: number;
  error?: string;
}

export class OffscreenRenderManager {
  private window: BrowserWindow | null = null;
  private isReady: boolean = false;
  private readyPromise: Promise<void> | null = null;
  private pendingRequests: Map<
    string,
    { resolve: (result: FrameRenderResult) => void; timer: ReturnType<typeof setTimeout> }
  > = new Map();
  private nextId: number = 0;
  private disposed: boolean = false;

  /**
   * Creates the hidden BrowserWindow and waits for the render harness to be ready.
   */
  public async init(): Promise<void> {
    if (this.window || this.disposed) return;
    if (this.readyPromise) return this.readyPromise;

    this.readyPromise = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Offscreen render window init timed out (30s)'));
      }, 30000);

      // Listen for ready signal from offscreen harness
      const onReady = () => {
        clearTimeout(timeout);
        this.isReady = true;
        ipcMain.removeListener('render-offscreen:ready', onReady);
        ipcMain.removeListener('render-offscreen:init-error', onError);
        resolve();
      };

      const onError = (_event: Electron.IpcMainEvent, error: string) => {
        clearTimeout(timeout);
        ipcMain.removeListener('render-offscreen:ready', onReady);
        ipcMain.removeListener('render-offscreen:init-error', onError);
        reject(new Error(`Offscreen render init failed: ${error}`));
      };

      ipcMain.on('render-offscreen:ready', onReady);
      ipcMain.on('render-offscreen:init-error', onError);

      // Register frame result handlers
      this.registerFrameHandlers();

      // Create hidden BrowserWindow with strict contextIsolation
      this.window = new BrowserWindow({
        show: false,
        width: 100,
        height: 100,
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          preload: path.join(__dirname, '../preload/index.js'),
          offscreen: true,
        },
      });

      // Load the offscreen render page
      if (isDev && process.env['VITE_DEV_SERVER_URL']) {
        const devUrl = process.env['VITE_DEV_SERVER_URL'];
        const base = devUrl.endsWith('/') ? devUrl : `${devUrl}/`;
        const offscreenUrl = `${base}render-offscreen.html`;
        this.window.loadURL(offscreenUrl).catch(reject);
      } else {
        const htmlPath = path.join(__dirname, '../renderer/render-offscreen.html');
        this.window.loadFile(htmlPath).catch(reject);
      }

      this.window.on('closed', () => {
        this.window = null;
        this.isReady = false;
        // Reject all pending requests
        for (const [id, pending] of this.pendingRequests) {
          clearTimeout(pending.timer);
          pending.resolve({
            success: false,
            error: 'Offscreen window was closed',
          });
          this.pendingRequests.delete(id);
        }
      });
    });

    return this.readyPromise;
  }

  /**
   * Registers IPC handlers for frame results from the offscreen window.
   */
  private registerFrameHandlers(): void {
    ipcMain.on(
      'render-offscreen:frame-result',
      (_event: Electron.IpcMainEvent, requestId: string, pixelBuffer: Buffer, executionTimeMs: number) => {
        const pending = this.pendingRequests.get(requestId);
        if (pending) {
          clearTimeout(pending.timer);
          this.pendingRequests.delete(requestId);
          pending.resolve({
            success: true,
            pixelBuffer,
            executionTimeMs,
          });
        }
      }
    );

    ipcMain.on(
      'render-offscreen:frame-error',
      (_event: Electron.IpcMainEvent, requestId: string, error: string) => {
        const pending = this.pendingRequests.get(requestId);
        if (pending) {
          clearTimeout(pending.timer);
          this.pendingRequests.delete(requestId);
          pending.resolve({
            success: false,
            error,
          });
        }
      }
    );
  }

  /**
   * Renders a single frame and returns the raw RGBA pixel buffer.
   */
  public async renderFrame(
    code: string,
    t: number,
    width: number,
    height: number,
    seed: number,
    options?: Record<string, unknown>,
    timeoutMs: number = 10000
  ): Promise<FrameRenderResult> {
    if (!this.isReady || !this.window) {
      return { success: false, error: 'Offscreen render window not ready' };
    }

    const requestId = `frame_${this.nextId++}_${Date.now()}`;

    return new Promise<FrameRenderResult>((resolve) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        resolve({
          success: false,
          error: `Frame render timed out (${timeoutMs}ms)`,
        });
      }, timeoutMs);

      this.pendingRequests.set(requestId, { resolve, timer });

      // Send frame request to offscreen window
      this.window!.webContents.send(
        'render-offscreen:execute-frame',
        requestId,
        code,
        t,
        width,
        height,
        seed,
        options
      );
    });
  }

  /**
   * Disposes of the offscreen window and cleans up resources.
   */
  public dispose(): void {
    this.disposed = true;
    this.isReady = false;

    // Cancel all pending requests
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.resolve({ success: false, error: 'Disposed' });
      this.pendingRequests.delete(id);
    }

    // Clean up IPC listeners
    ipcMain.removeAllListeners('render-offscreen:ready');
    ipcMain.removeAllListeners('render-offscreen:init-error');
    ipcMain.removeAllListeners('render-offscreen:frame-result');
    ipcMain.removeAllListeners('render-offscreen:frame-error');

    // Send dispose signal and close window
    if (this.window) {
      try {
        this.window.webContents.send('render-offscreen:dispose');
      } catch {
        // Ignore if already destroyed
      }
      try {
        this.window.close();
      } catch {
        // Ignore
      }
      this.window = null;
    }

    this.readyPromise = null;
  }
}
