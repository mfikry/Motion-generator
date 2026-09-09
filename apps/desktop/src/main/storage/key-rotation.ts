import { listKeys, getDecryptedKey, updateKeyStatus } from './api-key-manager';
import type { ApiKeyPoolStatus, ApiKeyStatus } from '@genc/shared-types';

/** Internal index for round-robin rotation */
let currentKeyIndex = 0;

/**
 * Get the next available (valid) decrypted API key from the pool.
 * Uses round-robin rotation, skipping rate_limited and invalid keys.
 * Returns null if no valid keys are available.
 *
 * INTERNAL USE ONLY — called by AI Architect module (E4).
 * NEVER exposed to renderer process.
 */
export function getNextAvailableKey(): { id: string; apiKey: string } | null {
  const keys = listKeys();
  const validKeys = keys.filter((k) => k.status === 'valid');

  if (validKeys.length === 0) return null;

  // Wrap index if needed
  if (currentKeyIndex >= validKeys.length) {
    currentKeyIndex = 0;
  }

  const selected = validKeys[currentKeyIndex];
  if (!selected) return null;

  const decrypted = getDecryptedKey(selected.id);
  if (!decrypted) return null;

  // Advance index for next call (round-robin)
  currentKeyIndex = (currentKeyIndex + 1) % validKeys.length;

  return { id: selected.id, apiKey: decrypted };
}

/**
 * Mark a key as rate-limited and immediately get the next available key.
 * Called when a Gemini API call returns 429 / rate limit error.
 * Returns the next available key, or null if no more valid keys exist.
 *
 * INTERNAL USE ONLY — called by AI Architect module (E4).
 */
export function markKeyRateLimited(id: string): { id: string; apiKey: string } | null {
  updateKeyStatus(id, 'rate_limited' as ApiKeyStatus);
  return getNextAvailableKey();
}

/**
 * Get a summary of the key pool status for the UI counter.
 * Safe to send to renderer — contains only counts, no key values.
 */
export function getKeyPoolStatus(): ApiKeyPoolStatus {
  const keys = listKeys();
  return {
    total: keys.length,
    valid: keys.filter((k) => k.status === 'valid').length,
    rateLimited: keys.filter((k) => k.status === 'rate_limited').length,
    invalid: keys.filter((k) => k.status === 'invalid').length,
  };
}

/**
 * Reset the rotation index. Useful when keys are added/removed.
 */
export function resetRotationIndex(): void {
  currentKeyIndex = 0;
}
