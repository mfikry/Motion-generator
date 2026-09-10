import { describe, it, expect } from 'vitest';
import {
  validateMotionBlueprint,
  checkLoopConsistency,
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

  describe('Loop Consistency Validator (checkLoopConsistency)', () => {
    it('should fail when layer has mismatch between t=0 and t=durationSec (central-burst case)', () => {
      const centralBurstBlueprint: MotionBlueprint = {
        blueprintId: 'test-central-burst',
        category: 'burst-animation',
        canvas: { width: 1080, height: 1080, background: '#000000' },
        durationSec: 15,
        fps: 60,
        palette: ['#ff00ff', '#00ffff'],
        layers: [
          {
            id: 'central-burst',
            type: 'shape',
            shape: 'circle',
            properties: { x: 540, y: 540, radius: 50, opacity: 0 },
            keyframes: [
              { t: 0, props: { opacity: 0 } },
              { t: 7.5, props: { opacity: 1 } },
              { t: 15, props: { opacity: 1 } },
            ],
          },
        ],
        loop: { seamless: true },
        rulesLevel: 'simple',
        introOutro: false,
        noText: true,
      };

      const result = checkLoopConsistency(centralBurstBlueprint);
      expect(result.seamless).toBe(false);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0]).toBe(
        "Layer 'central-burst' tidak seamless: opacity di t=0 (0) tidak sama dengan t=15 (1)",
      );
    });

    it('should pass when layer returns to initial property value at t=durationSec', () => {
      const seamlessBlueprint: MotionBlueprint = {
        blueprintId: 'test-seamless',
        category: 'pulse',
        canvas: { width: 1080, height: 1080, background: '#000000' },
        durationSec: 10,
        fps: 60,
        palette: ['#ff00ff'],
        layers: [
          {
            id: 'pulsing-orb',
            type: 'shape',
            shape: 'circle',
            properties: { x: 540, y: 540, radius: 50, scale: 1 },
            keyframes: [
              { t: 0, props: { scale: 1 } },
              { t: 5, props: { scale: 1.5 } },
              { t: 10, props: { scale: 1 } },
            ],
          },
        ],
        loop: { seamless: true },
        rulesLevel: 'high',
        introOutro: false,
        noText: true,
      };

      const result = checkLoopConsistency(seamlessBlueprint);
      expect(result.seamless).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should ignore property mismatch when loop.seamless is false', () => {
      const nonSeamlessBlueprint: MotionBlueprint = {
        blueprintId: 'test-non-seamless',
        category: 'intro',
        canvas: { width: 1080, height: 1080, background: '#000000' },
        durationSec: 5,
        fps: 60,
        palette: ['#ff00ff'],
        layers: [
          {
            id: 'central-burst',
            type: 'shape',
            shape: 'circle',
            properties: { opacity: 0 },
            keyframes: [
              { t: 0, props: { opacity: 0 } },
              { t: 5, props: { opacity: 1 } },
            ],
          },
        ],
        loop: { seamless: false },
        rulesLevel: 'simple',
        introOutro: false,
        noText: true,
      };

      const result = checkLoopConsistency(nonSeamlessBlueprint);
      expect(result.seamless).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should recognize 360-degree rotation revolution as seamless', () => {
      const rotatingBlueprint: MotionBlueprint = {
        blueprintId: 'test-rotating',
        category: 'spinner',
        canvas: { width: 1080, height: 1080, background: '#000000' },
        durationSec: 6,
        fps: 60,
        palette: ['#00ff00'],
        layers: [
          {
            id: 'spinning-wheel',
            type: 'shape',
            shape: 'rect',
            properties: { x: 540, y: 540, rotation: 0 },
            keyframes: [
              { t: 0, props: { rotation: 0 } },
              { t: 6, props: { rotation: 360 } },
            ],
          },
        ],
        loop: { seamless: true },
        rulesLevel: 'simple',
        introOutro: false,
        noText: true,
      };

      const result = checkLoopConsistency(rotatingBlueprint);
      expect(result.seamless).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should report multiple property mismatches across layers', () => {
      const multiMismatchBlueprint: MotionBlueprint = {
        blueprintId: 'test-multi',
        category: 'complex',
        canvas: { width: 1080, height: 1080, background: '#000000' },
        durationSec: 10,
        fps: 60,
        palette: ['#ffffff'],
        layers: [
          {
            id: 'layer-a',
            type: 'shape',
            properties: { x: 100 },
            keyframes: [
              { t: 0, props: { x: 100 } },
              { t: 10, props: { x: 500 } },
            ],
          },
          {
            id: 'layer-b',
            type: 'path',
            properties: { pathProgress: 0 },
            keyframes: [
              { t: 0, props: { pathProgress: 0 } },
              { t: 10, props: { pathProgress: 1 } },
            ],
          },
        ],
        loop: { seamless: true },
        rulesLevel: 'simple',
        introOutro: false,
        noText: true,
      };

      const result = checkLoopConsistency(multiMismatchBlueprint);
      expect(result.seamless).toBe(false);
      expect(result.errors.length).toBe(2);
      expect(result.errors[0]).toContain(
        "Layer 'layer-a' tidak seamless: x di t=0 (100) tidak sama dengan t=10 (500)",
      );
      expect(result.errors[1]).toContain(
        "Layer 'layer-b' tidak seamless: pathProgress di t=0 (0) tidak sama dengan t=10 (1)",
      );
    });

    it('should pass position with small floating-point delta (x: 200.005 vs x: 200) without false positive', () => {
      const floatJitterBlueprint: MotionBlueprint = {
        blueprintId: 'test-float-jitter',
        category: 'subpixel-motion',
        canvas: { width: 1080, height: 1080, background: '#000000' },
        durationSec: 5,
        fps: 60,
        palette: ['#ffffff'],
        layers: [
          {
            id: 'floating-dot',
            type: 'shape',
            shape: 'circle',
            properties: { x: 200, y: 300, radius: 20 },
            keyframes: [
              { t: 0, props: { x: 200.005, y: 300.5 } },
              { t: 2.5, props: { x: 250, y: 350 } },
              { t: 5, props: { x: 200, y: 301.2 } },
            ],
          },
        ],
        loop: { seamless: true },
        rulesLevel: 'simple',
        introOutro: false,
        noText: true,
      };

      const result = checkLoopConsistency(floatJitterBlueprint);
      // Diff in x is 0.005 (<= 2px), diff in y is 0.7 (<= 2px) -> must pass!
      expect(result.seamless).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should fail position when difference exceeds 2px tolerance (e.g. x: 200 vs x: 203)', () => {
      const positionJumpBlueprint: MotionBlueprint = {
        blueprintId: 'test-pos-jump',
        category: 'position-jump',
        canvas: { width: 1080, height: 1080, background: '#000000' },
        durationSec: 5,
        fps: 60,
        palette: ['#ffffff'],
        layers: [
          {
            id: 'jumping-box',
            type: 'shape',
            shape: 'rect',
            properties: { x: 200, y: 300 },
            keyframes: [
              { t: 0, props: { x: 200 } },
              { t: 5, props: { x: 203 } },
            ],
          },
        ],
        loop: { seamless: true },
        rulesLevel: 'simple',
        introOutro: false,
        noText: true,
      };

      const result = checkLoopConsistency(positionJumpBlueprint);
      expect(result.seamless).toBe(false);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0]).toContain(
        "Layer 'jumping-box' tidak seamless: x di t=0 (200) tidak sama dengan t=5 (203)",
      );
    });

    it('should completely skip non-numeric properties like fill hex string from loop consistency checks', () => {
      const colorChangeBlueprint: MotionBlueprint = {
        blueprintId: 'test-color-change',
        category: 'color-morph',
        canvas: { width: 1080, height: 1080, background: '#000000' },
        durationSec: 8,
        fps: 60,
        palette: ['#ff0000', '#0000ff'],
        layers: [
          {
            id: 'color-shifter',
            type: 'shape',
            shape: 'circle',
            properties: { x: 500, y: 500, radius: 40, fill: '#ff0000' },
            keyframes: [
              { t: 0, props: { fill: '#ff0000', opacity: 1 } },
              { t: 4, props: { fill: '#00ff00', opacity: 0.8 } },
              { t: 8, props: { fill: '#0000ff', opacity: 1 } },
            ],
          },
        ],
        loop: { seamless: true },
        rulesLevel: 'simple',
        introOutro: false,
        noText: true,
      };

      const result = checkLoopConsistency(colorChangeBlueprint);
      // fill is non-numeric string, so it is skipped. opacity returns from 1 -> 1 -> seamless!
      expect(result.seamless).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });
});
