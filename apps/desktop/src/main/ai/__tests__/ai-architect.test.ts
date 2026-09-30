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
  cleanCodeText,
  cleanJsonText,
} from '../ai-architect';
import { saveGeneration, listGenerations, getGenerationById } from '../generation-storage';
import type { GenerationRecord } from '@genc/shared-types';

const validCanvasCodeFixture = `
ctx.fillStyle = '#0a0a14';
ctx.fillRect(0, 0, width, height);
const cx = width / 2;
const cy = height / 2;
const r = 50 + 20 * Math.sin(t * Math.PI * 2);
ctx.fillStyle = '#00f5d4';
ctx.beginPath();
ctx.arc(cx, cy, r, 0, Math.PI * 2);
ctx.fill();
`.trim();

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

describe('AI Architect (v2.0 Canvas2D Generative)', () => {
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

    it('should strip markdown code blocks from JS output', () => {
      const rawWithJsBlock = '```javascript\nctx.fillRect(0, 0, width, height);\n```';
      expect(cleanCodeText(rawWithJsBlock)).toBe('ctx.fillRect(0, 0, width, height);');

      const rawWithGenericBlock = '```\nctx.fillRect(0, 0, width, height);\n```';
      expect(cleanCodeText(rawWithGenericBlock)).toBe('ctx.fillRect(0, 0, width, height);');

      const plain = 'ctx.fillRect(0, 0, width, height);';
      expect(cleanCodeText(plain)).toBe('ctx.fillRect(0, 0, width, height);');
      expect(cleanJsonText(plain)).toBe('ctx.fillRect(0, 0, width, height);');
    });
  });

  describe('Single & Batch Code Generation', () => {
    it('should generate valid Canvas2D code and persist to SQLite', async () => {
      seedKey('key-1', 'Key 1', 'AIzaKey1');

      mockGenerateContent.mockResolvedValueOnce({
        text: `\`\`\`javascript\n${validCanvasCodeFixture}\n\`\`\``,
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
      expect(result.codes?.length).toBe(1);
      expect(result.codes?.[0]).toContain('ctx.arc(cx, cy, r, 0, Math.PI * 2)');
      expect(result.totalTasks).toBe(1);
      expect(result.completedTasks).toBe(1);
      expect(result.modelUsed).toBe('gemini-2.5-flash');

      // Check SQLite persistence
      const saved = listGenerations();
      expect(saved.length).toBe(1);
      expect(saved[0]?.promptText).toBe('Glowing cyberpunk circle pulse');
      expect(saved[0]?.modelUsed).toBe('gemini-2.5-flash');
      expect(saved[0]?.tokenUsage).toBe(512);
      expect(saved[0]?.codeText).toContain('ctx.arc(cx, cy, r, 0, Math.PI * 2)');
    });

    it('should generate multiple tasks for variations * batchSize', async () => {
      seedKey('key-1', 'Key 1', 'AIzaKey1');

      mockGenerateContent.mockImplementation(() =>
        Promise.resolve({
          text: validCanvasCodeFixture,
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
      expect(result.codes?.length).toBe(4);
      expect(mockGenerateContent).toHaveBeenCalledTimes(4);

      const saved = listGenerations(10);
      expect(saved.length).toBe(4);
    });
  });

  describe('Auto-Retry on Static Analysis and Loop Seam Errors', () => {
    it('should retry when Gemini returns code with forbidden APIs and succeed on next attempt', async () => {
      seedKey('key-1', 'Key 1', 'AIzaKey1');

      // Attempt 1: Contains forbidden identifier 'window'
      const forbiddenCode = `
        const w = window.innerWidth;
        ctx.fillRect(0, 0, w, 100);
      `;

      // Attempt 2: Clean valid code
      mockGenerateContent
        .mockResolvedValueOnce({
          text: forbiddenCode,
          usageMetadata: { totalTokenCount: 200 },
        })
        .mockResolvedValueOnce({
          text: validCanvasCodeFixture,
          usageMetadata: { totalTokenCount: 350 },
        });

      const result = await generateBlueprintsFromText({
        prompt: 'Morphing shapes',
        variations: 1,
        batchSize: 1,
      });

      expect(result.success).toBe(true);
      expect(result.codes?.length).toBe(1);
      expect(result.retriesUsed).toBe(1);
      expect(mockGenerateContent).toHaveBeenCalledTimes(2);

      // Verify retry prompt sent to Gemini contains forbidden identifier hint
      const secondCallArgs = mockGenerateContent.mock.calls[1]?.[0];
      expect(secondCallArgs?.contents).toContain('Forbidden identifier detected: \'window\'');
    });

    it('should retry when sandboxed dry-run validator reports non-seamless loop and succeed on retry', async () => {
      seedKey('key-1', 'Key 1', 'AIzaKey1');

      mockGenerateContent
        .mockResolvedValueOnce({
          text: validCanvasCodeFixture,
          usageMetadata: { totalTokenCount: 300 },
        })
        .mockResolvedValueOnce({
          text: validCanvasCodeFixture,
          usageMetadata: { totalTokenCount: 350 },
        });

      // Mock validator that fails on 1st call and succeeds on 2nd call
      let validatorCallCount = 0;
      const mockValidator = vi.fn().mockImplementation(async () => {
        validatorCallCount++;
        if (validatorCallCount === 1) {
          return {
            valid: false,
            errors: ['Loop seam error: RGBA Mean Absolute Error is 18.5 > 4.0 threshold between t=0.0 and t=1.0.'],
          };
        }
        return { valid: true };
      });

      const result = await generateBlueprintsFromText(
        {
          prompt: 'Central burst pulsing',
          variations: 1,
          batchSize: 1,
        },
        mockValidator,
      );

      expect(result.success).toBe(true);
      expect(result.codes?.length).toBe(1);
      expect(result.retriesUsed).toBe(1);
      expect(mockGenerateContent).toHaveBeenCalledTimes(2);

      const secondCallArgs = mockGenerateContent.mock.calls[1]?.[0];
      expect(secondCallArgs?.contents).toContain('Loop seam error: RGBA Mean Absolute Error is 18.5');
    });

    it('should fail with clear error when MAX_VALIDATION_RETRIES is exhausted', async () => {
      seedKey('key-1', 'Key 1', 'AIzaKey1');

      // Fails static analysis every time
      const forbiddenCode = 'fetch("https://malicious.com");';

      mockGenerateContent.mockResolvedValue({
        text: forbiddenCode,
        usageMetadata: { totalTokenCount: 100 },
      });

      const result = await generateBlueprintsFromText({
        prompt: 'Broken canvas',
        variations: 1,
        batchSize: 1,
      });

      expect(result.success).toBe(false);
      expect(result.codes?.length).toBe(0);
      expect(result.error).toContain('Canvas2D code tidak valid setelah 2x retry koreksi');
    });
  });

  describe('Key Rotation Failover on 429', () => {
    it('should failover to next key when encountering HTTP 429 rate limit', async () => {
      seedKey('key-1', 'Key 1', 'AIzaKey1', 'valid');
      seedKey('key-2', 'Key 2', 'AIzaKey2', 'valid');

      mockGenerateContent
        .mockRejectedValueOnce(new Error('429 RESOURCE_EXHAUSTED: Quota exceeded for quota metric'))
        .mockResolvedValueOnce({
          text: validCanvasCodeFixture,
          usageMetadata: { totalTokenCount: 400 },
        });

      const result = await generateBlueprintsFromText({
        prompt: 'Abstract lines',
        variations: 1,
        batchSize: 1,
      });

      expect(result.success).toBe(true);
      expect(result.codes?.length).toBe(1);

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
    it('should save, list, and retrieve generation by ID with codeText', () => {
      const rec: GenerationRecord = {
        id: 'gen-uuid-1',
        projectId: null,
        promptText: 'Floating neon cube',
        referenceImages: null,
        modelUsed: 'gemini-2.5-flash',
        thinkingLevel: 'medium',
        codeText: validCanvasCodeFixture,
        tokenUsage: 650,
        createdAt: new Date().toISOString(),
      };

      saveGeneration(rec);

      const list = listGenerations(10);
      expect(list.length).toBe(1);
      expect(list[0]?.id).toBe('gen-uuid-1');
      expect(list[0]?.promptText).toBe('Floating neon cube');
      expect(list[0]?.codeText).toBe(validCanvasCodeFixture);

      const fetched = getGenerationById('gen-uuid-1');
      expect(fetched).not.toBeNull();
      expect(fetched?.id).toBe('gen-uuid-1');
      expect(fetched?.thinkingLevel).toBe('medium');
      expect(fetched?.codeText).toBe(validCanvasCodeFixture);

      const nonExistent = getGenerationById('non-existent');
      expect(nonExistent).toBeNull();
    });
  });
});
