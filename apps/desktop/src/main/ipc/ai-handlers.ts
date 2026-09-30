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
  // Generate Canvas2D code from text prompt
  ipcMain.handle(IPC_CHANNELS.AI_GENERATE_TEXT, async (event, request: GenerateTextRequest) => {
    const validator = async (code: string) => {
      try {
        const script = `window.__sandboxedValidator ? window.__sandboxedValidator.validate(${JSON.stringify(code)}) : Promise.resolve({ valid: true })`;
        const res = await event.sender.executeJavaScript(script);
        return res as { valid: boolean; errors?: string[] };
      } catch (err) {
        return {
          valid: false,
          errors: [`Dry-run validator invocation failed: ${err instanceof Error ? err.message : String(err)}`],
        };
      }
    };

    return await generateBlueprintsFromText(request, validator);
  });

  // Retrieve recent generation history from SQLite
  ipcMain.handle(IPC_CHANNELS.AI_GET_GENERATIONS, (_event, args?: { limit?: number }) => {
    return listGenerations(args?.limit ?? 20);
  });
}
