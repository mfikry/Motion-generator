import { safeStorage } from 'electron';
import crypto from 'node:crypto';
import { GoogleGenAI } from '@google/genai';
import { getDatabase } from './database';
import type {
  ApiKeyMetadata,
  ApiKeyStatus,
  ApiKeyAddResult,
  ApiKeyValidateResult,
} from '@genc/shared-types';

/** Row shape from SQLite api_keys table */
interface ApiKeyRow {
  id: string;
  label: string;
  safe_storage_ref: string;
  status: string;
  last_checked_at: string | null;
}

/**
 * Encrypt an API key using Electron safeStorage (DPAPI on Windows).
 * Returns base64-encoded encrypted blob for storage in SQLite.
 * The actual key is NEVER stored in plain text.
 */
function encryptKey(apiKey: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Encryption is not available on this system.');
  }
  const encrypted = safeStorage.encryptString(apiKey);
  return encrypted.toString('base64');
}

/**
 * Decrypt an API key from its base64-encoded safeStorage blob.
 * Only called internally in main process — NEVER exposed to renderer.
 */
function decryptKey(base64Blob: string): string {
  const buffer = Buffer.from(base64Blob, 'base64');
  return safeStorage.decryptString(buffer);
}

/**
 * Validate an API key by making a lightweight test call to Gemini API.
 * Uses models.list() which is a minimal read-only call.
 */
async function testKeyWithGemini(apiKey: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const ai = new GoogleGenAI({ apiKey });
    // Use a lightweight call — list available models
    const pager = await ai.models.list({ config: { pageSize: 1 } });
    // If we can iterate at least once, the key is valid
    for await (const _model of pager) {
      break; // We only need to confirm the key works
    }
    return { valid: true };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    // Check for rate limiting vs invalid key
    if (
      error.includes('429') ||
      error.toLowerCase().includes('rate') ||
      error.toLowerCase().includes('quota')
    ) {
      return { valid: true, error: 'rate_limited' };
    }
    return { valid: false, error };
  }
}

/**
 * Add a new API key.
 * Encrypts with safeStorage, validates via Gemini test call, stores in SQLite.
 * Returns metadata only — NEVER returns the key itself.
 */
export async function addKey(apiKey: string, label: string): Promise<ApiKeyAddResult> {
  try {
    // Validate the key first
    const validation = await testKeyWithGemini(apiKey);
    let status: ApiKeyStatus = 'invalid';

    if (validation.valid) {
      status = validation.error === 'rate_limited' ? 'rate_limited' : 'valid';
    }

    // Only store keys that are at least structurally valid (not clearly garbage)
    if (!validation.valid) {
      return {
        success: false,
        error: `Key validation failed: ${validation.error ?? 'Unknown error'}`,
      };
    }

    // Encrypt and store
    const id = crypto.randomUUID();
    const safeStorageRef = encryptKey(apiKey);
    const now = new Date().toISOString();

    const db = getDatabase();
    db.prepare(
      `
      INSERT INTO api_keys (id, label, safe_storage_ref, status, last_checked_at)
      VALUES (?, ?, ?, ?, ?)
    `,
    ).run(id, label || `Key ${id.slice(0, 8)}`, safeStorageRef, status, now);

    const metadata: ApiKeyMetadata = {
      id,
      label: label || `Key ${id.slice(0, 8)}`,
      status,
      lastCheckedAt: now,
    };

    return { success: true, metadata };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return { success: false, error };
  }
}

/**
 * Remove an API key by ID.
 */
export function removeKey(id: string): { success: boolean; error?: string } {
  try {
    const db = getDatabase();
    const result = db.prepare('DELETE FROM api_keys WHERE id = ?').run(id);
    if (result.changes === 0) {
      return { success: false, error: 'Key not found.' };
    }
    return { success: true };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return { success: false, error };
  }
}

/**
 * List all API keys — returns METADATA ONLY, never the actual key.
 */
export function listKeys(): ApiKeyMetadata[] {
  const db = getDatabase();
  const rows = db
    .prepare('SELECT id, label, status, last_checked_at FROM api_keys ORDER BY rowid ASC')
    .all() as ApiKeyRow[];

  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    status: row.status as ApiKeyStatus,
    lastCheckedAt: row.last_checked_at,
  }));
}

/**
 * Validate a specific key by re-testing with Gemini API.
 * Decrypts, tests, updates status in DB.
 */
export async function validateKey(id: string): Promise<ApiKeyValidateResult> {
  try {
    const db = getDatabase();
    const row = db.prepare('SELECT safe_storage_ref FROM api_keys WHERE id = ?').get(id) as
      ApiKeyRow | undefined;

    if (!row) {
      return { success: false, status: 'invalid', error: 'Key not found.' };
    }

    const apiKey = decryptKey(row.safe_storage_ref);
    const validation = await testKeyWithGemini(apiKey);
    const now = new Date().toISOString();

    let status: ApiKeyStatus = 'invalid';
    if (validation.valid) {
      status = validation.error === 'rate_limited' ? 'rate_limited' : 'valid';
    }

    db.prepare('UPDATE api_keys SET status = ?, last_checked_at = ? WHERE id = ?').run(
      status,
      now,
      id,
    );

    return { success: true, status };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return { success: false, status: 'invalid', error };
  }
}

/**
 * Validate all keys. Returns updated metadata list.
 */
export async function validateAllKeys(): Promise<ApiKeyMetadata[]> {
  const keys = listKeys();
  for (const key of keys) {
    await validateKey(key.id);
  }
  return listKeys();
}

/**
 * Get a decrypted API key by ID — INTERNAL USE ONLY.
 * Called by AI module (E4) and key rotation. NEVER exposed to renderer.
 */
export function getDecryptedKey(id: string): string | null {
  const db = getDatabase();
  const row = db.prepare('SELECT safe_storage_ref FROM api_keys WHERE id = ?').get(id) as
    ApiKeyRow | undefined;

  if (!row) return null;
  return decryptKey(row.safe_storage_ref);
}

/**
 * Update a key's status in the database.
 */
export function updateKeyStatus(id: string, status: ApiKeyStatus): void {
  const db = getDatabase();
  const now = new Date().toISOString();
  db.prepare('UPDATE api_keys SET status = ?, last_checked_at = ? WHERE id = ?').run(
    status,
    now,
    id,
  );
}
