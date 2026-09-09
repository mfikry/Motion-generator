import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '@genc/shared-types';
import {
  addKey,
  removeKey,
  listKeys,
  validateKey,
  validateAllKeys,
} from '../storage/api-key-manager';
import { getKeyPoolStatus, resetRotationIndex } from '../storage/key-rotation';

/**
 * Register all API Key management IPC handlers.
 * Called once from main process on app startup.
 *
 * Security: handlers return METADATA ONLY — never the actual API key.
 */
export function registerApiKeyHandlers(): void {
  // Add a new API key
  ipcMain.handle(IPC_CHANNELS.API_KEY_ADD, async (_event, args: { key: string; label: string }) => {
    const result = await addKey(args.key, args.label);
    if (result.success) {
      resetRotationIndex();
    }
    return result;
  });

  // Remove an API key
  ipcMain.handle(IPC_CHANNELS.API_KEY_REMOVE, (_event, args: { id: string }) => {
    const result = removeKey(args.id);
    if (result.success) {
      resetRotationIndex();
    }
    return result;
  });

  // List all API keys (metadata only)
  ipcMain.handle(IPC_CHANNELS.API_KEY_LIST, () => {
    return listKeys();
  });

  // Validate a specific key
  ipcMain.handle(IPC_CHANNELS.API_KEY_VALIDATE, async (_event, args: { id: string }) => {
    return await validateKey(args.id);
  });

  // Validate all keys
  ipcMain.handle(IPC_CHANNELS.API_KEY_VALIDATE_ALL, async () => {
    return await validateAllKeys();
  });

  // Get key pool status (counts only)
  ipcMain.handle(IPC_CHANNELS.API_KEY_POOL_STATUS, () => {
    return getKeyPoolStatus();
  });
}
