import { describe, it, expect } from 'vitest';
import {
  validateMotionBlueprint,
  LAYER_TYPES,
  EASING_FUNCTIONS,
  RULES_ANIMATION_LEVELS,
  type MotionBlueprint,
} from '../index';

describe('Motion Blueprint Schema & Validator (@genc/motion-schema)', () => {
  // Canonical reference blueprint from Tech Design Section 4
  const validReferenceBlueprint: MotionBlueprint = {
    blueprintId: 'uuid-v4-reference-1234',
    category: 'finance-growth-chart',
    canvas: { width: 1080, height: 1080, background: 'transparent' },
    durationSec: 15,
    fps: 60,
    palette: ['#F5A623', '#4A90D9', '#7ED321'],
    layers: [
      {
        id: 'bar-1',
        type: 'shape',
        shape: 'rect',
        properties: { x: 100, y: 400, width: 60, height: 0, fill: '#F5A623' },
        keyframes: [
          { t: 0.0, props: { height: 0 } },
          { t: 2.0, props: { height: 120 }, easing: 'easeOutBack' },
        ],
      },
      {
        id: 'arrow-trend',
        type: 'path',
        properties: { stroke: '#D0342C', strokeWidth: 8 },
        keyframes: [
          { t: 1.0, props: { pathProgress: 0.0 } },
          { t: 4.0, props: { pathProgress: 1.0 }, easing: 'easeInOutCubic' },
        ],
      },
    ],
    loop: { seamless: true },
    rulesLevel: 'high',
    introOutro: false,
    noText: true,
  };

  it('should successfully validate the canonical reference blueprint from Tech Design Section 4', () => {
    const result = validateMotionBlueprint(validReferenceBlueprint);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.blueprint.blueprintId).toBe('uuid-v4-reference-1234');
      expect(result.blueprint.layers.length).toBe(2);
      expect(result.blueprint.layers[0]?.type).toBe('shape');
      expect(result.blueprint.layers[1]?.type).toBe('path');
      expect(result.blueprint.durationSec).toBe(15);
      expect(result.blueprint.loop.seamless).toBe(true);
    }
  });

  it('should accept all supported layer types (shape, path, icon, particle, image-ref)', () => {
    for (const layerType of LAYER_TYPES) {
      const blueprint = {
        ...validReferenceBlueprint,
        layers: [
          {
            id: `test-${layerType}`,
            type: layerType,
            properties: { opacity: 1 },
            keyframes: [{ t: 0, props: { opacity: 0 } }],
          },
        ],
      };
      const result = validateMotionBlueprint(blueprint);
      expect(result.valid).toBe(true);
    }
  });

  it('should reject invalid layer types outside the closed enum', () => {
    const invalidBlueprint = {
      ...validReferenceBlueprint,
      layers: [
        {
          id: 'invalid-layer',
          type: 'video', // Disallowed type
          properties: {},
          keyframes: [{ t: 0, props: {} }],
        },
      ],
    };

    const result = validateMotionBlueprint(invalidBlueprint);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.length).toBeGreaterThan(0);
      const errorMsg = result.errors.find((e) => e.includes('layers[0].type'));
      expect(errorMsg).toBeDefined();
      expect(errorMsg).toContain('Invalid layer type');
      expect(errorMsg).toContain('Instruction:');
    }
  });

  it('should accept all supported easing functions', () => {
    for (const easing of EASING_FUNCTIONS) {
      const blueprint = {
        ...validReferenceBlueprint,
        layers: [
          {
            id: 'test-layer',
            type: 'shape' as const,
            properties: {},
            keyframes: [
              { t: 0, props: { x: 0 } },
              { t: 1, props: { x: 100 }, easing },
            ],
          },
        ],
      };
      const result = validateMotionBlueprint(blueprint);
      expect(result.valid).toBe(true);
    }
  });

  it('should reject unknown easing functions', () => {
    const invalidBlueprint = {
      ...validReferenceBlueprint,
      layers: [
        {
          id: 'test-layer',
          type: 'shape' as const,
          properties: {},
          keyframes: [
            { t: 0, props: { x: 0 } },
            { t: 1, props: { x: 100 }, easing: 'cubic-bezier-custom' },
          ],
        },
      ],
    };

    const result = validateMotionBlueprint(invalidBlueprint);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      const errorMsg = result.errors.find((e) => e.includes('layers[0].keyframes[1].easing'));
      expect(errorMsg).toBeDefined();
      expect(errorMsg).toContain('Invalid easing function');
      expect(errorMsg).toContain('Instruction:');
    }
  });

  it('should accept all supported rules animation levels (simple, high, expert)', () => {
    for (const level of RULES_ANIMATION_LEVELS) {
      const blueprint = {
        ...validReferenceBlueprint,
        rulesLevel: level,
      };
      const result = validateMotionBlueprint(blueprint);
      expect(result.valid).toBe(true);
    }
  });

  it('should reject empty keyframes array', () => {
    const invalidBlueprint = {
      ...validReferenceBlueprint,
      layers: [
        {
          id: 'empty-kf-layer',
          type: 'shape' as const,
          properties: {},
          keyframes: [], // Empty!
        },
      ],
    };

    const result = validateMotionBlueprint(invalidBlueprint);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      const errorMsg = result.errors.find((e) => e.includes('layers[0].keyframes'));
      expect(errorMsg).toBeDefined();
      expect(errorMsg).toContain('at least 1 keyframe');
    }
  });

  it('should reject empty layers array', () => {
    const invalidBlueprint = {
      ...validReferenceBlueprint,
      layers: [], // Empty!
    };

    const result = validateMotionBlueprint(invalidBlueprint);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      const errorMsg = result.errors.find((e) => e.includes('layers'));
      expect(errorMsg).toBeDefined();
      expect(errorMsg).toContain('at least 1 layer');
    }
  });

  it('should reject keyframe timestamps exceeding durationSec', () => {
    const invalidBlueprint = {
      ...validReferenceBlueprint,
      durationSec: 10,
      layers: [
        {
          id: 'overflow-layer',
          type: 'shape' as const,
          properties: {},
          keyframes: [
            { t: 0.0, props: { x: 0 } },
            { t: 12.5, props: { x: 100 } }, // 12.5 > 10.0 duration!
          ],
        },
      ],
    };

    const result = validateMotionBlueprint(invalidBlueprint);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      const errorMsg = result.errors.find((e) => e.includes('layers[0].keyframes[1].t'));
      expect(errorMsg).toBeDefined();
      expect(errorMsg).toContain('exceeds blueprint durationSec');
      expect(errorMsg).toContain('Instruction:');
    }
  });

  it('should reject negative keyframe timestamps', () => {
    const invalidBlueprint = {
      ...validReferenceBlueprint,
      layers: [
        {
          id: 'negative-kf',
          type: 'shape' as const,
          properties: {},
          keyframes: [{ t: -2.5, props: { x: 0 } }],
        },
      ],
    };

    const result = validateMotionBlueprint(invalidBlueprint);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      const errorMsg = result.errors.find((e) => e.includes('layers[0].keyframes[0].t'));
      expect(errorMsg).toBeDefined();
      expect(errorMsg).toContain('non-negative');
    }
  });

  it('should reject missing mandatory fields with clear instruction', () => {
    const missingFieldsBlueprint = {
      // blueprintId omitted
      category: 'icons',
      // canvas omitted
      durationSec: 5,
      // fps omitted
      palette: ['#000000'],
      // layers omitted
      loop: { seamless: true },
      rulesLevel: 'simple',
      introOutro: false,
      noText: true,
    };

    const result = validateMotionBlueprint(missingFieldsBlueprint);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes('blueprintId'))).toBe(true);
      expect(result.errors.some((e) => e.includes('canvas'))).toBe(true);
      expect(result.errors.some((e) => e.includes('layers'))).toBe(true);
      expect(result.errors.some((e) => e.includes('fps'))).toBe(true);
    }
  });

  it('should reject non-positive canvas dimensions and duration', () => {
    const invalidDimensionsBlueprint = {
      ...validReferenceBlueprint,
      canvas: { width: 0, height: -1080, background: 'transparent' },
      durationSec: 0,
      fps: -60,
    };

    const result = validateMotionBlueprint(invalidDimensionsBlueprint);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes('canvas.width'))).toBe(true);
      expect(result.errors.some((e) => e.includes('canvas.height'))).toBe(true);
      expect(result.errors.some((e) => e.includes('durationSec'))).toBe(true);
      expect(result.errors.some((e) => e.includes('fps'))).toBe(true);
    }
  });

  it('should reject non-object inputs safely without throwing exceptions', () => {
    const nullResult = validateMotionBlueprint(null);
    expect(nullResult.valid).toBe(false);
    if (!nullResult.valid) {
      expect(nullResult.errors[0]).toContain('must be a valid JSON object');
    }

    const strResult = validateMotionBlueprint('not a json object');
    expect(strResult.valid).toBe(false);
    if (!strResult.valid) {
      expect(strResult.errors[0]).toContain('must be a valid JSON object');
    }

    const undefResult = validateMotionBlueprint(undefined);
    expect(undefResult.valid).toBe(false);
    if (!undefResult.valid) {
      expect(undefResult.errors[0]).toContain('must be a valid JSON object');
    }
  });

  it('should format all error messages with actionable Instruction tags', () => {
    const brokenBlueprint = {
      blueprintId: '',
      category: '',
      canvas: { width: -100, height: 0, background: '' },
      durationSec: -5,
      fps: 0,
      palette: [],
      layers: [],
      loop: { seamless: 'not-a-boolean' },
      rulesLevel: 'invalid-level',
      introOutro: 'yes',
      noText: 'no',
    };

    const result = validateMotionBlueprint(brokenBlueprint);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.length).toBeGreaterThan(5);
      result.errors.forEach((err) => {
        expect(err).toMatch(/^\[.+\]:/); // Starts with [path]:
        expect(err).toContain('Instruction:'); // Contains actionable instructions
      });
    }
  });
});
