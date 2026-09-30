import crypto from 'node:crypto';
import { GoogleGenAI } from '@google/genai';
import { getNextAvailableKey, markKeyRateLimited } from '../storage/key-rotation';
import { analyzeCodeSafety } from '../../renderer/sandbox/static-analyzer';
import { buildMotionArchitectSystemPrompt, buildRetryPrompt } from './system-prompt';
import { saveGeneration } from './generation-storage';
import type {
  GenerateTextRequest,
  GenerateTextResult,
  ThinkingLevel,
} from '@genc/shared-types';

/** Maximum validation retry attempts per task */
const MAX_VALIDATION_RETRIES = 2;

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
 * Strip markdown code blocks if the model outputs ```javascript ... ``` or ```js ... ```
 */
export function cleanCodeText(raw: string): string {
  let trimmed = raw.trim();
  if (trimmed.startsWith('```')) {
    trimmed = trimmed
      .replace(/^```(?:javascript|js)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();
  }

  // If code is wrapped in function drawFrame(...) { ... }, unwrap the inner body
  const fnMatch = trimmed.match(/^\s*(?:async\s+)?function\s+drawFrame\s*\([^)]*\)\s*\{([\s\S]*)\}\s*$/);
  if (fnMatch && fnMatch[1]) {
    return fnMatch[1].trim();
  }

  return trimmed;
}

/**
 * Backward compatibility alias for cleanCodeText.
 */
export const cleanJsonText = cleanCodeText;

export type CodeValidatorFn = (
  code: string
) => Promise<{ valid: boolean; errors?: string[] }>;

/**
 * Generate a single Canvas2D script with automatic key rotation, static analysis,
 * and dry-run validation retry loop.
 */
export async function generateSingleCode(
  request: GenerateTextRequest,
  _taskIndex: number,
  targetModel: string,
  validator?: CodeValidatorFn
): Promise<{ code: string; tokenUsage: number | null; retriesUsed: number }> {
  let promptToSend = request.prompt;
  let retriesUsed = 0;

  while (true) {
    // 1. Get an active key from rotation pool
    let currentKey = getNextAvailableKey();
    if (!currentKey) {
      throw new Error(
        'Tidak ada API key Gemini yang aktif/valid. Silakan tambahkan atau periksa status API key di menu MASUKAN API.'
      );
    }

    let responseText = '';
    let tokenUsage: number | null = null;

    // 2. Call Gemini API with rate-limit failover loop
    let callSucceeded = false;
    while (!callSucceeded) {
      try {
        const genStartTime = Date.now();
        console.log(`[AI-Architect] Calling Gemini API (model: ${targetModel}, keyId: ${currentKey.id})...`);
        const ai = new GoogleGenAI({ apiKey: currentKey.apiKey });
        const response = await ai.models.generateContent({
          model: targetModel,
          contents: promptToSend,
          config: {
            systemInstruction: buildMotionArchitectSystemPrompt(request.settings),
            thinkingConfig: mapThinkingBudget(request.thinkingLevel),
          },
        });

        const genDuration = Date.now() - genStartTime;
        responseText = response.text ?? '';
        tokenUsage = response.usageMetadata?.totalTokenCount ?? null;
        console.log(`[AI-Architect] Gemini API call succeeded in ${genDuration}ms (tokens: ${tokenUsage}, length: ${responseText.length} chars)`);
        callSucceeded = true;
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`[AI-Architect] Gemini API error: ${errorMsg}`);
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
              'Semua API key Gemini telah mencapai batas kuota / rate limit (429). Silakan tunggu beberapa saat atau tambahkan key baru.'
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

    // 3. Clean and extract code string
    const code = cleanCodeText(responseText);
    const errors: string[] = [];

    // 4. Layer 1: Pre-Execution Static Analysis Gate
    const staticAnalysis = analyzeCodeSafety(code);
    if (!staticAnalysis.valid) {
      errors.push(...staticAnalysis.errors);
    } else if (validator) {
      // 5. Layer 2: Sandboxed Dry-Run & Pixel-Based Loop Consistency Check
      try {
        const dryRun = await validator(code);
        if (!dryRun.valid && dryRun.errors && dryRun.errors.length > 0) {
          errors.push(...dryRun.errors);
        }
      } catch (valErr) {
        errors.push(`Validator dry-run error: ${valErr instanceof Error ? valErr.message : String(valErr)}`);
      }
    }

    // 6. Validation passed!
    if (errors.length === 0) {
      const id = crypto.randomUUID();

      // Persist valid generation to SQLite
      saveGeneration({
        id,
        projectId: null,
        promptText: request.prompt,
        referenceImages: null,
        modelUsed: targetModel,
        thinkingLevel: request.thinkingLevel ?? 'high',
        codeText: code,
        tokenUsage,
        createdAt: new Date().toISOString(),
      });

      return { code, tokenUsage, retriesUsed };
    }

    // Validation failed: retry if quota remains
    if (retriesUsed < MAX_VALIDATION_RETRIES) {
      retriesUsed++;
      promptToSend = buildRetryPrompt(request.prompt, errors, request.settings);
      continue;
    }

    // Exhausted retries
    throw new Error(
      `Canvas2D code tidak valid setelah ${retriesUsed}x retry koreksi:\n` +
        errors.slice(0, 3).join('\n')
    );
  }
}

/**
 * Execute text-to-Canvas2D generation for all requested tasks (variations × batchSize).
 *
 * @param request Generation parameters from renderer
 * @param validator Optional dry-run and pixel loop validator function
 * @returns Result containing all validated Canvas2D codes or error details
 */
export async function generateBlueprintsFromText(
  request: GenerateTextRequest,
  validator?: CodeValidatorFn
): Promise<GenerateTextResult> {
  const variations = Math.max(1, Math.min(5, request.variations ?? 1));
  const batchSize = Math.max(1, Math.min(5, request.batchSize ?? 1));
  const totalTasks = variations * batchSize;
  const targetModel = resolveModelName(request.model);

  const codes: string[] = [];
  let totalRetriesUsed = 0;

  try {
    for (let i = 0; i < totalTasks; i++) {
      const { code, retriesUsed } = await generateSingleCode(request, i, targetModel, validator);
      codes.push(code);
      totalRetriesUsed += retriesUsed;
    }

    return {
      success: true,
      blueprints: [],
      codes,
      totalTasks,
      completedTasks: codes.length,
      retriesUsed: totalRetriesUsed,
      modelUsed: targetModel,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      blueprints: [],
      codes,
      totalTasks,
      completedTasks: codes.length,
      error: errorMsg,
      retriesUsed: totalRetriesUsed,
      modelUsed: targetModel,
    };
  }
}
