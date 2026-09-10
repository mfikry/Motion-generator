import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '@genc/shared-types';
import { generateBlueprintsFromText } from '../ai/ai-architect';
import { listGenerations } from '../ai/generation-storage';
import type { GenerateTextRequest } from '@genc/shared-types';

/**
 * Register IPC handlers for AI Architect generation features.
 * Called once during main process startup.
 */
export function registerAiHandlers(): void {
  // Generate Motion Blueprints from text prompt
  ipcMain.handle(IPC_CHANNELS.AI_GENERATE_TEXT, async (_event, request: GenerateTextRequest) => {
    return await generateBlueprintsFromText(request);
  });

  // Retrieve recent generation history from SQLite
  ipcMain.handle(IPC_CHANNELS.AI_GET_GENERATIONS, (_event, args?: { limit?: number }) => {
    return listGenerations(args?.limit ?? 20);
  });
}
