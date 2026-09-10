import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createBetterSqliteMock, clearMockDatabases } from '../../storage/__tests__/sqlite-mock';

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

// Mock GoogleGenAI with vi.hoisted so it is initialized before vi.mock hoisting
const { mockGenerateContent } = vi.hoisted(() => {
  return {
    mockGenerateContent: vi.fn(),
  };
});

vi.mock('@google/genai', () => ({
  GoogleGenAI: class MockGoogleGenAI {
    apiKey?: string;
    models = {
      generateContent: mockGenerateContent,
    };
    constructor(opts?: { apiKey?: string }) {
      this.apiKey = opts?.apiKey;
    }
  },
}));

import { initDatabase, closeDatabase, getDatabase } from '../../storage/database';
import { resetRotationIndex } from '../../storage/key-rotation';
import {
  generateBlueprintsFromText,
  resolveModelName,
  mapThinkingBudget,
  cleanJsonText,
} from '../ai-architect';
import { saveGeneration, listGenerations, getGenerationById } from '../generation-storage';
import type { MotionBlueprint, GenerationRecord } from '@genc/shared-types';

const validBlueprintFixture: MotionBlueprint = {
  blueprintId: 'bp-test-uuid',
  category: 'cyberpunk',
  canvas: { width: 1920, height: 1080, background: '#0a0a1a' },
  durationSec: 5,
  fps: 30,
  palette: ['#00ffff', '#ff00ff', '#ffff00', '#0a0a1a'],
  layers: [
    {
      id: 'layer-1',
      type: 'shape',
      shape: 'circle',
      properties: { x: 960, y: 540, radius: 50, color: '#00ffff' },
      keyframes: [
        { t: 0, props: { scale: 0.5 }, easing: 'easeInOutCubic' },
        { t: 2.5, props: { scale: 1.0 }, easing: 'easeInOutCubic' },
        { t: 5, props: { scale: 0.5 }, easing: 'easeInOutCubic' },
      ],
    },
  ],
  loop: { seamless: true },
  rulesLevel: 'simple',
  introOutro: false,
  noText: true,
};

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

describe('AI Architect (Text Mode)', () => {
  beforeEach(() => {
    clearMockDatabases();
    closeDatabase();
    initDatabase(':memory:');
    resetRotationIndex();
    mockGenerateContent.mockReset();
  });

  afterEach(() => {
    closeDatabase();
  });

  describe('Utility Functions', () => {
    it('should map model names correctly', () => {
      expect(resolveModelName('Gemi 3.6F')).toBe('gemini-2.5-flash');
      expect(resolveModelName('Gemini 3.6F')).toBe('gemini-2.5-flash');
      expect(resolveModelName('gemini-2.5-pro')).toBe('gemini-2.5-pro');
      expect(resolveModelName(undefined)).toBe('gemini-2.5-flash');
      expect(resolveModelName('')).toBe('gemini-2.5-flash');
    });

    it('should map thinking level to token budgets', () => {
      expect(mapThinkingBudget('low')).toEqual({ thinkingBudget: 1024 });
      expect(mapThinkingBudget('medium')).toEqual({ thinkingBudget: 2048 });
      expect(mapThinkingBudget('high')).toEqual({ thinkingBudget: 4096 });
      expect(mapThinkingBudget(undefined)).toEqual({ thinkingBudget: 4096 });
    });

    it('should strip markdown code blocks from JSON output', () => {
      const rawWithCodeBlock = '```json\n{"key": "value"}\n```';
      expect(cleanJsonText(rawWithCodeBlock)).toBe('{"key": "value"}');

      const rawWithGenericBlock = '```\n{"key": "value"}\n```';
      expect(cleanJsonText(rawWithGenericBlock)).toBe('{"key": "value"}');

      const plain = '{"key": "value"}';
      expect(cleanJsonText(plain)).toBe('{"key": "value"}');
    });
  });

  describe('Single & Batch Generation', () => {
    it('should generate a valid blueprint and persist to SQLite', async () => {
      seedKey('key-1', 'Key 1', 'AIzaKey1');

      mockGenerateContent.mockResolvedValueOnce({
        text: JSON.stringify(validBlueprintFixture),
        usageMetadata: { totalTokenCount: 512 },
      });

      const result = await generateBlueprintsFromText({
        prompt: 'Glowing cyberpunk circle pulse',
        model: 'Gemi 3.6F',
        thinkingLevel: 'high',
        variations: 1,
        batchSize: 1,
      });

      expect(result.error).toBeUndefined();
      expect(result.success).toBe(true);
      expect(result.blueprints.length).toBe(1);
      expect(result.blueprints[0]?.category).toBe('cyberpunk');
      expect(result.totalTasks).toBe(1);
      expect(result.completedTasks).toBe(1);
      expect(result.modelUsed).toBe('gemini-2.5-flash');

      // Check SQLite persistence
      const saved = listGenerations();
      expect(saved.length).toBe(1);
      expect(saved[0]?.promptText).toBe('Glowing cyberpunk circle pulse');
      expect(saved[0]?.modelUsed).toBe('gemini-2.5-flash');
      expect(saved[0]?.tokenUsage).toBe(512);

      const parsedSavedBp = JSON.parse(saved[0]?.blueprintJson ?? '{}');
      expect(parsedSavedBp.category).toBe('cyberpunk');
    });

    it('should generate multiple tasks for variations * batchSize', async () => {
      seedKey('key-1', 'Key 1', 'AIzaKey1');

      // 2 variations * 2 batch size = 4 total tasks
      mockGenerateContent.mockImplementation(() =>
        Promise.resolve({
          text: JSON.stringify(validBlueprintFixture),
          usageMetadata: { totalTokenCount: 300 },
        }),
      );

      const result = await generateBlueprintsFromText({
        prompt: 'Futuristic glowing orb',
        variations: 2,
        batchSize: 2,
      });

      expect(result.success).toBe(true);
      expect(result.totalTasks).toBe(4);
      expect(result.completedTasks).toBe(4);
      expect(result.blueprints.length).toBe(4);
      expect(mockGenerateContent).toHaveBeenCalledTimes(4);

      const saved = listGenerations(10);
      expect(saved.length).toBe(4);
    });
  });

  describe('Auto-Retry on Schema Validation Error', () => {
    it('should retry when Gemini returns schema-invalid JSON and succeed on next attempt', async () => {
      seedKey('key-1', 'Key 1', 'AIzaKey1');

      // Attempt 1: Invalid layer type (fails closed enum)
      const invalidBlueprint = {
        ...validBlueprintFixture,
        layers: [
          {
            id: 'l-1',
            type: 'video_clip', // Invalid enum
            shape: 'rect',
            properties: {},
            keyframes: [],
          },
        ],
      };

      // Attempt 2: Valid
      mockGenerateContent
        .mockResolvedValueOnce({
          text: JSON.stringify(invalidBlueprint),
          usageMetadata: { totalTokenCount: 400 },
        })
        .mockResolvedValueOnce({
          text: JSON.stringify(validBlueprintFixture),
          usageMetadata: { totalTokenCount: 450 },
        });

      const result = await generateBlueprintsFromText({
        prompt: 'Morphing shapes',
        variations: 1,
        batchSize: 1,
      });

      expect(result.success).toBe(true);
      expect(result.blueprints.length).toBe(1);
      expect(result.retriesUsed).toBe(1);
      expect(mockGenerateContent).toHaveBeenCalledTimes(2);

      // Verify retry prompt sent to Gemini contains error hint
      const secondCallArgs = mockGenerateContent.mock.calls[1]?.[0];
      expect(secondCallArgs?.contents).toContain('had schema validation errors');
      expect(secondCallArgs?.contents).toContain('layers[0].type');
    });

    it('should retry when Gemini returns a blueprint with non-seamless loop (central-burst case) and succeed on retry', async () => {
      seedKey('key-1', 'Key 1', 'AIzaKey1');

      // Attempt 1: central-burst opacity mismatch (t=0 is 0, t=15 is 1)
      const centralBurstMismatch: MotionBlueprint = {
        ...validBlueprintFixture,
        durationSec: 15,
        layers: [
          {
            id: 'central-burst',
            type: 'shape',
            shape: 'circle',
            properties: { x: 960, y: 540, radius: 50, opacity: 0 },
            keyframes: [
              { t: 0, props: { opacity: 0 } },
              { t: 7.5, props: { opacity: 1 } },
              { t: 15, props: { opacity: 1 } },
            ],
          },
        ],
        loop: { seamless: true },
      };

      const burstLayer = centralBurstMismatch.layers[0];
      if (!burstLayer) throw new Error('burstLayer is undefined');

      // Attempt 2: corrected (t=15 returns to 0)
      const centralBurstCorrected: MotionBlueprint = {
        ...centralBurstMismatch,
        layers: [
          {
            ...burstLayer,
            keyframes: [
              { t: 0, props: { opacity: 0 } },
              { t: 7.5, props: { opacity: 1 } },
              { t: 15, props: { opacity: 0 } },
            ],
          },
        ],
      };

      mockGenerateContent
        .mockResolvedValueOnce({
          text: JSON.stringify(centralBurstMismatch),
          usageMetadata: { totalTokenCount: 400 },
        })
        .mockResolvedValueOnce({
          text: JSON.stringify(centralBurstCorrected),
          usageMetadata: { totalTokenCount: 450 },
        });

      const result = await generateBlueprintsFromText({
        prompt: 'Central burst pulsing',
        variations: 1,
        batchSize: 1,
      });

      expect(result.success).toBe(true);
      expect(result.blueprints.length).toBe(1);
      expect(result.retriesUsed).toBe(1);
      expect(mockGenerateContent).toHaveBeenCalledTimes(2);

      // Verify retry prompt sent to Gemini contains the exact central-burst mismatch error
      const secondCallArgs = mockGenerateContent.mock.calls[1]?.[0];
      expect(secondCallArgs?.contents).toContain(
        "Layer 'central-burst' tidak seamless: opacity di t=0 (0) tidak sama dengan t=15 (1)",
      );
    });

    it('should fail with clear error when MAX_SCHEMA_RETRIES is exhausted', async () => {
      seedKey('key-1', 'Key 1', 'AIzaKey1');

      const invalidBlueprint = {
        ...validBlueprintFixture,
        canvas: { width: 100, height: 100 }, // Invalid canvas bounds
      };

      // Fails 3 times (initial + 2 retries)
      mockGenerateContent.mockResolvedValue({
        text: JSON.stringify(invalidBlueprint),
        usageMetadata: { totalTokenCount: 300 },
      });

      const result = await generateBlueprintsFromText({
        prompt: 'Broken canvas',
        variations: 1,
        batchSize: 1,
      });

      expect(result.success).toBe(false);
      expect(result.blueprints.length).toBe(0);
      expect(result.error).toContain('Motion Blueprint tidak valid setelah 2x retry koreksi');
    });
  });

  describe('Key Rotation Failover on 429', () => {
    it('should failover to next key when encountering HTTP 429 rate limit', async () => {
      seedKey('key-1', 'Key 1', 'AIzaKey1', 'valid');
      seedKey('key-2', 'Key 2', 'AIzaKey2', 'valid');

      // 1st call throws 429 Quota Exceeded
      // 2nd call succeeds
      mockGenerateContent
        .mockRejectedValueOnce(new Error('429 RESOURCE_EXHAUSTED: Quota exceeded for quota metric'))
        .mockResolvedValueOnce({
          text: JSON.stringify(validBlueprintFixture),
          usageMetadata: { totalTokenCount: 400 },
        });

      const result = await generateBlueprintsFromText({
        prompt: 'Abstract lines',
        variations: 1,
        batchSize: 1,
      });

      expect(result.success).toBe(true);
      expect(result.blueprints.length).toBe(1);

      // Key 1 should now be marked rate_limited in DB
      const db = getDatabase();
      const k1 = db.prepare('SELECT status FROM api_keys WHERE id = ?').get('key-1') as {
        status: string;
      };
      expect(k1.status).toBe('rate_limited');
    });

    it('should return informative error when all keys are rate limited', async () => {
      seedKey('key-1', 'Key 1', 'AIzaKey1', 'valid');

      mockGenerateContent.mockRejectedValue(new Error('429 RESOURCE_EXHAUSTED: Quota exceeded'));

      const result = await generateBlueprintsFromText({
        prompt: 'Particle swarm',
        variations: 1,
        batchSize: 1,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Semua API key Gemini telah mencapai batas kuota');
    });

    it('should return error if no keys exist in pool', async () => {
      const result = await generateBlueprintsFromText({
        prompt: 'No keys test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Tidak ada API key Gemini yang aktif/valid');
    });
  });

  describe('Generation Storage Module', () => {
    it('should save, list, and retrieve generation by ID', () => {
      const rec: GenerationRecord = {
        id: 'gen-uuid-1',
        projectId: null,
        promptText: 'Floating neon cube',
        referenceImages: null,
        modelUsed: 'gemini-2.5-flash',
        thinkingLevel: 'medium',
        blueprintJson: JSON.stringify(validBlueprintFixture),
        tokenUsage: 650,
        createdAt: new Date().toISOString(),
      };

      saveGeneration(rec);

      const list = listGenerations(10);
      expect(list.length).toBe(1);
      expect(list[0]?.id).toBe('gen-uuid-1');
      expect(list[0]?.promptText).toBe('Floating neon cube');

      const fetched = getGenerationById('gen-uuid-1');
      expect(fetched).not.toBeNull();
      expect(fetched?.id).toBe('gen-uuid-1');
      expect(fetched?.thinkingLevel).toBe('medium');

      const nonExistent = getGenerationById('non-existent');
      expect(nonExistent).toBeNull();
    });
  });
});
