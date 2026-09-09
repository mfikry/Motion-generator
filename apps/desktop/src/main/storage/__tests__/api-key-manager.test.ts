import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createBetterSqliteMock } from './sqlite-mock';

// Mock better-sqlite3
vi.mock('better-sqlite3', () => ({
  default: createBetterSqliteMock(),
}));

// Mock electron
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

// Mock @google/genai
vi.mock('@google/genai', () => {
  class MockGoogleGenAI {
    apiKey: string;
    models: { list: () => Promise<AsyncGenerator<{ name: string }>> };

    constructor(opts: { apiKey: string }) {
      this.apiKey = opts.apiKey;
      const key = opts.apiKey;
      this.models = {
        list: vi.fn().mockImplementation(async () => {
          if (key === 'invalid-key') {
            throw new Error('API key not valid. Please pass a valid API key.');
          }
          if (key === 'rate-limited-key') {
            throw new Error('429 Resource has been exhausted (e.g. check quota).');
          }
          return (async function* () {
            yield { name: 'models/gemini-2.5-flash' };
          })();
        }),
      };
    }
  }

  return {
    GoogleGenAI: MockGoogleGenAI,
  };
});

import { initDatabase, closeDatabase, getDatabase } from '../database';
import {
  addKey,
  removeKey,
  listKeys,
  validateKey,
  validateAllKeys,
  getDecryptedKey,
} from '../api-key-manager';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('API Key Manager (Storage, Encryption, Persistence & Validation)', () => {
  let tempDbPath: string;

  beforeEach(() => {
    closeDatabase();
    tempDbPath = path.join(
      os.tmpdir(),
      `genc-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`,
    );
    initDatabase(tempDbPath);
  });

  afterEach(() => {
    closeDatabase();
    if (fs.existsSync(tempDbPath)) {
      try {
        fs.unlinkSync(tempDbPath);
      } catch {
        // ignore cleanup error
      }
    }
  });

  it('should successfully add and encrypt a valid key', async () => {
    const res = await addKey('valid-gemini-key-123', 'My Primary Key');
    expect(res.success).toBe(true);
    expect(res.metadata).toBeDefined();
    expect(res.metadata?.label).toBe('My Primary Key');
    expect(res.metadata?.status).toBe('valid');
    expect(res.metadata?.id).toBeDefined();

    const keyId = res.metadata?.id ?? '';

    // Verify key is encrypted in SQLite
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM api_keys WHERE id = ?').get(keyId) as {
      safe_storage_ref: string;
      label: string;
    };
    expect(row.label).toBe('My Primary Key');
    // The SQLite column must NOT contain the plain key
    expect(row.safe_storage_ref).not.toBe('valid-gemini-key-123');
    // Decrypted key should match original
    expect(getDecryptedKey(keyId)).toBe('valid-gemini-key-123');
  });

  it('should reject structurally invalid keys', async () => {
    const res = await addKey('invalid-key', 'Bad Key');
    expect(res.success).toBe(false);
    expect(res.error).toContain('Key validation failed');

    const keys = listKeys();
    expect(keys.length).toBe(0);
  });

  it('should handle rate-limited keys during addition', async () => {
    const res = await addKey('rate-limited-key', 'Busy Key');
    expect(res.success).toBe(true);
    expect(res.metadata?.status).toBe('rate_limited');
  });

  it('should never expose plaintext keys in listKeys()', async () => {
    await addKey('secret-key-xyz', 'Secret Key');
    const keys = listKeys();

    expect(keys.length).toBe(1);
    expect(keys[0]).toHaveProperty('id');
    expect(keys[0]).toHaveProperty('label', 'Secret Key');
    expect(keys[0]).toHaveProperty('status', 'valid');
    expect(keys[0]).not.toHaveProperty('apiKey');
    expect(keys[0]).not.toHaveProperty('safe_storage_ref');
  });

  it('should remove a key by id', async () => {
    const added = await addKey('key-to-delete', 'Disposable Key');
    expect(listKeys().length).toBe(1);

    const deleteId = added.metadata?.id ?? '';
    const remResult = removeKey(deleteId);
    expect(remResult.success).toBe(true);
    expect(listKeys().length).toBe(0);
  });

  it('should validate key status dynamically', async () => {
    const added = await addKey('valid-gemini-key-123', 'Key to Revalidate');
    const validateId = added.metadata?.id ?? '';
    const valRes = await validateKey(validateId);
    expect(valRes.success).toBe(true);
    expect(valRes.status).toBe('valid');
  });

  it('should validate all keys in the pool', async () => {
    await addKey('valid-key-1', 'Key 1');
    await addKey('rate-limited-key', 'Key 2');

    const all = await validateAllKeys();
    expect(all.length).toBe(2);
    expect(all.find((k) => k.label === 'Key 1')?.status).toBe('valid');
    expect(all.find((k) => k.label === 'Key 2')?.status).toBe('rate_limited');
  });

  it('should persist keys across database restarts (persistence verification)', async () => {
    const added = await addKey('persistent-key-999', 'Persistent Key');
    const persistId = added.metadata?.id ?? '';

    // Simulate app restart: close DB and reopen same file
    closeDatabase();
    initDatabase(tempDbPath);

    const keysAfterRestart = listKeys();
    expect(keysAfterRestart.length).toBe(1);
    expect(keysAfterRestart[0]?.id).toBe(persistId);
    expect(keysAfterRestart[0]?.label).toBe('Persistent Key');
    expect(keysAfterRestart[0]?.status).toBe('valid');

    // SafeStorage decrypt should still work
    const decryptedAfterRestart = getDecryptedKey(persistId);
    expect(decryptedAfterRestart).toBe('persistent-key-999');
  });
});
