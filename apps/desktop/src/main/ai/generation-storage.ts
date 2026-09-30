import { getDatabase } from '../storage/database';
import type { GenerationRecord } from '@genc/shared-types';

interface GenerationRow {
  id: string;
  project_id: string | null;
  prompt_text: string;
  reference_images: string | null;
  model_used: string;
  thinking_level: string;
  blueprint_json: string | null;
  code_text: string | null;
  token_usage: number | null;
  created_at: string;
}

/**
 * Save a newly generated Canvas2D code or Motion Blueprint record into SQLite.
 */
export function saveGeneration(record: GenerationRecord): void {
  const db = getDatabase();
  db.prepare(
    `
    INSERT INTO generations (
      id, project_id, prompt_text, reference_images, model_used,
      thinking_level, blueprint_json, code_text, token_usage, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
  ).run(
    record.id,
    record.projectId,
    record.promptText,
    record.referenceImages,
    record.modelUsed,
    record.thinkingLevel,
    record.blueprintJson ?? null,
    record.codeText ?? null,
    record.tokenUsage,
    record.createdAt,
  );
}

/**
 * List recent generations from SQLite.
 */
export function listGenerations(limit = 20): GenerationRecord[] {
  const db = getDatabase();
  const rows = db
    .prepare(
      `
    SELECT id, project_id, prompt_text, reference_images, model_used,
           thinking_level, blueprint_json, code_text, token_usage, created_at
    FROM generations
    ORDER BY created_at DESC
    LIMIT ?
  `,
    )
    .all(limit) as GenerationRow[];

  return rows.map((row) => ({
    id: row.id,
    projectId: row.project_id,
    promptText: row.prompt_text,
    referenceImages: row.reference_images,
    modelUsed: row.model_used,
    thinkingLevel: row.thinking_level,
    blueprintJson: row.blueprint_json ?? undefined,
    codeText: row.code_text ?? undefined,
    tokenUsage: row.token_usage,
    createdAt: row.created_at,
  }));
}

/**
 * Get a specific generation by ID.
 */
export function getGenerationById(id: string): GenerationRecord | null {
  const db = getDatabase();
  const row = db
    .prepare(
      `
    SELECT id, project_id, prompt_text, reference_images, model_used,
           thinking_level, blueprint_json, code_text, token_usage, created_at
    FROM generations
    WHERE id = ?
  `,
    )
    .get(id) as GenerationRow | undefined;

  if (!row) return null;

  return {
    id: row.id,
    projectId: row.project_id,
    promptText: row.prompt_text,
    referenceImages: row.reference_images,
    modelUsed: row.model_used,
    thinkingLevel: row.thinking_level,
    blueprintJson: row.blueprint_json ?? undefined,
    codeText: row.code_text ?? undefined,
    tokenUsage: row.token_usage,
    createdAt: row.created_at,
  };
}

