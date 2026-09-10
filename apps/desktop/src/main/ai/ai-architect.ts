import crypto from 'node:crypto';
import { GoogleGenAI } from '@google/genai';
import { getNextAvailableKey, markKeyRateLimited } from '../storage/key-rotation';
import { validateMotionBlueprint } from '@genc/motion-schema';
import { buildMotionArchitectSystemPrompt, buildRetryPrompt } from './system-prompt';
import { saveGeneration } from './generation-storage';
import type {
  GenerateTextRequest,
  GenerateTextResult,
  ThinkingLevel,
  MotionBlueprint,
} from '@genc/shared-types';

/** Maximum schema retry attempts per task */
const MAX_SCHEMA_RETRIES = 2;

/**
 * Map user-facing model selection to actual Gemini model name.
 */
export function resolveModelName(selectedModel?: string): string {
  if (!selectedModel || selectedModel === 'Gemi 3.6F' || selectedModel === 'Gemini 3.6F') {
    return 'gemini-2.5-flash';
  }
  return selectedModel.trim();
}

/**
 * Map ThinkingLevel (low/medium/high) to thinking budget tokens.
 */
export function mapThinkingBudget(level?: ThinkingLevel): { thinkingBudget: number } {
  switch (level) {
    case 'low':
      return { thinkingBudget: 1024 };
    case 'medium':
      return { thinkingBudget: 2048 };
    case 'high':
      return { thinkingBudget: 4096 };
    default:
      return { thinkingBudget: 4096 };
  }
}

/**
 * Strip markdown code blocks if the model outputs ```json ... ```
 */
export function cleanJsonText(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('```')) {
    return trimmed
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();
  }
  return trimmed;
}

/**
 * Generate a single Motion Blueprint with automatic key rotation and schema retry.
 */
async function generateSingleBlueprint(
  request: GenerateTextRequest,
  _taskIndex: number,
  targetModel: string,
): Promise<{ blueprint: MotionBlueprint; tokenUsage: number | null; retriesUsed: number }> {
  let promptToSend = request.prompt;
  let retriesUsed = 0;

  while (true) {
    // 1. Get an active key from rotation pool
    let currentKey = getNextAvailableKey();
    if (!currentKey) {
      throw new Error(
        'Tidak ada API key Gemini yang aktif/valid. Silakan tambahkan atau periksa status API key di menu MASUKAN API.',
      );
    }

    let responseText = '';
    let tokenUsage: number | null = null;

    // 2. Call Gemini API with rate-limit failover loop
    let callSucceeded = false;
    while (!callSucceeded) {
      try {
        const ai = new GoogleGenAI({ apiKey: currentKey.apiKey });
        const response = await ai.models.generateContent({
          model: targetModel,
          contents: promptToSend,
          config: {
            systemInstruction: buildMotionArchitectSystemPrompt(request.settings),
            responseMimeType: 'application/json',
            thinkingConfig: mapThinkingBudget(request.thinkingLevel),
          },
        });

        responseText = response.text ?? '';
        tokenUsage = response.usageMetadata?.totalTokenCount ?? null;
        callSucceeded = true;
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        const lowerMsg = errorMsg.toLowerCase();
        const isRateLimit =
          errorMsg.includes('429') ||
          lowerMsg.includes('rate limit') ||
          lowerMsg.includes('rate_limit') ||
          lowerMsg.includes('ratelimit') ||
          lowerMsg.includes('quota') ||
          lowerMsg.includes('resource_exhausted');

        if (isRateLimit) {
          // Mark current key as rate limited and rotate to next key
          const nextKey = markKeyRateLimited(currentKey.id);
          if (!nextKey) {
            throw new Error(
              'Semua API key Gemini telah mencapai batas kuota / rate limit (429). Silakan tunggu beberapa saat atau tambahkan key baru.',
            );
          }
          currentKey = nextKey;
          // Loop and retry with new key
          continue;
        }

        // Non-rate-limit error: rethrow
        throw new Error(`Gemini API error: ${errorMsg}`);
      }
    }

    // 3. Parse JSON
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(cleanJsonText(responseText));
    } catch {
      if (retriesUsed < MAX_SCHEMA_RETRIES) {
        retriesUsed++;
        promptToSend = `The response was not valid JSON. Please output strictly a valid JSON object matching the Motion Blueprint specification for prompt: "${request.prompt}"`;
        continue;
      }
      throw new Error(
        `Gagal mem-parsing output Gemini sebagai JSON valid setelah ${retriesUsed} percobaan retry.`,
      );
    }

    // 4. Validate against Motion Blueprint Zod Schema
    const validation = validateMotionBlueprint(parsedJson);

    if (validation.valid) {
      const blueprint = validation.blueprint;

      // Ensure blueprint has a unique UUID if placeholder or empty
      if (!blueprint.blueprintId || blueprint.blueprintId === 'uuid-v4') {
        blueprint.blueprintId = crypto.randomUUID();
      }

      // Persist valid generation to SQLite
      saveGeneration({
        id: blueprint.blueprintId,
        projectId: null,
        promptText: request.prompt,
        referenceImages: null,
        modelUsed: targetModel,
        thinkingLevel: request.thinkingLevel ?? 'high',
        blueprintJson: JSON.stringify(blueprint),
        tokenUsage,
        createdAt: new Date().toISOString(),
      });

      return { blueprint, tokenUsage, retriesUsed };
    }

    // Validation failed: retry if quota remains
    if (retriesUsed < MAX_SCHEMA_RETRIES) {
      retriesUsed++;
      promptToSend = buildRetryPrompt(request.prompt, validation.errors);
      continue;
    }

    // Exhausted retries
    throw new Error(
      `Motion Blueprint tidak valid setelah ${retriesUsed}x retry koreksi:\n` +
        validation.errors.slice(0, 3).join('\n'),
    );
  }
}

/**
 * Execute text-to-blueprint generation for all requested tasks (variations × batchSize).
 *
 * @param request Generation parameters from renderer
 * @returns Result containing all validated blueprints or error details
 */
export async function generateBlueprintsFromText(
  request: GenerateTextRequest,
): Promise<GenerateTextResult> {
  const variations = Math.max(1, Math.min(5, request.variations ?? 1));
  const batchSize = Math.max(1, Math.min(5, request.batchSize ?? 1));
  const totalTasks = variations * batchSize;
  const targetModel = resolveModelName(request.model);

  const blueprints: MotionBlueprint[] = [];
  let totalRetriesUsed = 0;

  try {
    for (let i = 0; i < totalTasks; i++) {
      const { blueprint, retriesUsed } = await generateSingleBlueprint(request, i, targetModel);
      blueprints.push(blueprint);
      totalRetriesUsed += retriesUsed;
    }

    return {
      success: true,
      blueprints,
      totalTasks,
      completedTasks: blueprints.length,
      retriesUsed: totalRetriesUsed,
      modelUsed: targetModel,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      blueprints,
      totalTasks,
      completedTasks: blueprints.length,
      error: errorMsg,
      retriesUsed: totalRetriesUsed,
      modelUsed: targetModel,
    };
  }
}
