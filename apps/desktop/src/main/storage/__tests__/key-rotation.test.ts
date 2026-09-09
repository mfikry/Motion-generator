import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createBetterSqliteMock, clearMockDatabases } from './sqlite-mock';

// Mock better-sqlite3
vi.mock('better-sqlite3', () => ({
  default: createBetterSqliteMock(),
}));

// Mock electron before importing modules that depend on it
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn().mockReturnValue(''),
  },
  safeStorage: {
    isEncryptionAvailable: vi.fn().mockReturnValue(true),
    encryptString: vi.fn().mockImplementation((str: string) => Buffer.from(`encrypted:${str}`)),
    decryptString: vi.fn().mockImplementation((buf: Buffer) => {
      const text = buf.toString('utf-8');
      return text.replace(/^encrypted:/, '');
    }),
  },
}));

import { initDatabase, closeDatabase, getDatabase } from '../database';
import { listKeys, getDecryptedKey, updateKeyStatus } from '../api-key-manager';
import {
  getNextAvailableKey,
  markKeyRateLimited,
  getKeyPoolStatus,
  resetRotationIndex,
} from '../key-rotation';

describe('Key Rotation & API Key Management', () => {
  beforeEach(() => {
    clearMockDatabases();
    closeDatabase();
    initDatabase(':memory:');
    resetRotationIndex();
  });

  afterEach(() => {
    closeDatabase();
  });

  function seedKey(id: string, label: string, plainKey: string, status = 'valid') {
    const db = getDatabase();
    const fakeEncrypted = Buffer.from(`encrypted:${plainKey}`).toString('base64');
    db.prepare(
      `
      INSERT INTO api_keys (id, label, safe_storage_ref, status, last_checked_at)
      VALUES (?, ?, ?, ?, ?)
    `,
    ).run(id, label, fakeEncrypted, status, new Date().toISOString());
  }

  it('should return null when key pool is empty', () => {
    const key = getNextAvailableKey();
    expect(key).toBeNull();

    const status = getKeyPoolStatus();
    expect(status).toEqual({ total: 0, valid: 0, rateLimited: 0, invalid: 0 });
  });

  it('should return the single valid key repeatedly', () => {
    seedKey('key-1', 'Key One', 'AIzaKey1');

    const first = getNextAvailableKey();
    expect(first).toEqual({ id: 'key-1', apiKey: 'AIzaKey1' });

    const second = getNextAvailableKey();
    expect(second).toEqual({ id: 'key-1', apiKey: 'AIzaKey1' });
  });

  it('should round-robin across multiple valid keys', () => {
    seedKey('key-1', 'Key 1', 'AIzaKey1');
    seedKey('key-2', 'Key 2', 'AIzaKey2');
    seedKey('key-3', 'Key 3', 'AIzaKey3');

    const k1 = getNextAvailableKey();
    const k2 = getNextAvailableKey();
    const k3 = getNextAvailableKey();
    const k4 = getNextAvailableKey(); // Should wrap around to key-1

    expect(k1?.id).toBe('key-1');
    expect(k2?.id).toBe('key-2');
    expect(k3?.id).toBe('key-3');
    expect(k4?.id).toBe('key-1');
  });

  it('should skip rate_limited and invalid keys during rotation', () => {
    seedKey('key-1', 'Key 1', 'AIzaKey1', 'rate_limited');
    seedKey('key-2', 'Key 2', 'AIzaKey2', 'valid');
    seedKey('key-3', 'Key 3', 'AIzaKey3', 'invalid');
    seedKey('key-4', 'Key 4', 'AIzaKey4', 'valid');

    const k1 = getNextAvailableKey();
    const k2 = getNextAvailableKey();
    const k3 = getNextAvailableKey();

    expect(k1?.id).toBe('key-2');
    expect(k2?.id).toBe('key-4');
    expect(k3?.id).toBe('key-2'); // Wrap around, still only valid keys
  });

  it('should mark key as rate-limited and immediately return next available key', () => {
    seedKey('key-1', 'Key 1', 'AIzaKey1', 'valid');
    seedKey('key-2', 'Key 2', 'AIzaKey2', 'valid');

    const next = markKeyRateLimited('key-1');
    expect(next?.id).toBe('key-2');

    const poolStatus = getKeyPoolStatus();
    expect(poolStatus.rateLimited).toBe(1);
    expect(poolStatus.valid).toBe(1);
    expect(poolStatus.total).toBe(2);
  });

  it('should return correct pool status summary for UI', () => {
    seedKey('k1', 'Key 1', 'key1', 'valid');
    seedKey('k2', 'Key 2', 'key2', 'valid');
    seedKey('k3', 'Key 3', 'key3', 'rate_limited');
    seedKey('k4', 'Key 4', 'key4', 'invalid');

    const status = getKeyPoolStatus();
    expect(status).toEqual({
      total: 4,
      valid: 2,
      rateLimited: 1,
      invalid: 1,
    });
  });

  it('should correctly decrypt keys via getDecryptedKey internally', () => {
    seedKey('secret-1', 'My Secret', 'AIzaSuperSecretKey123');
    const decrypted = getDecryptedKey('secret-1');
    expect(decrypted).toBe('AIzaSuperSecretKey123');

    // listKeys should NEVER include the decrypted key
    const list = listKeys();
    expect(list[0]).toHaveProperty('id', 'secret-1');
    expect(list[0]).toHaveProperty('label', 'My Secret');
    expect(list[0]).toHaveProperty('status', 'valid');
    expect(list[0]).not.toHaveProperty('apiKey');
    expect(list[0]).not.toHaveProperty('safe_storage_ref');
  });

  it('should update key status properly', () => {
    seedKey('status-test', 'Status Test', 'AIzaTest', 'valid');
    updateKeyStatus('status-test', 'rate_limited');

    const keys = listKeys();
    expect(keys[0]?.status).toBe('rate_limited');
  });
});
