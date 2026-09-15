import { describe, it, expect } from 'vitest';
import {
  validateMotionBlueprint,
  checkLoopConsistency,
  LAYER_TYPES,
  EASING_FUNCTIONS,
  RULES_ANIMATION_LEVELS,
  ASPECT_RATIOS,
  ASPECT_RATIO_DIMENSIONS,
  type MotionBlueprint,
  type MotionLayer,
} from '../index';

describe('Motion Blueprint Schema & Validator (@genc/motion-schema)', () => {
  // Canonical reference blueprint from Tech Design Section 4 (v1.1: normalized time 0.0–1.0)
  const validReferenceBlueprint: MotionBlueprint = {
    blueprintId: 'uuid-v4-reference-1234',
    category: 'finance-growth-chart',
    canvas: { width: 1080, height: 1080, background: 'transparent' },
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
          { t: 0.4, props: { height: 120 }, easing: 'easeOutBack' },
        ],
      },
      {
        id: 'arrow-trend',
        type: 'path',
        properties: { stroke: '#D0342C', strokeWidth: 8 },
        keyframes: [
          { t: 0.1, props: { pathProgress: 0.0 } },
          { t: 0.6, props: { pathProgress: 1.0 }, easing: 'easeInOutCubic' },
        ],
      },
    ],
    loop: { seamless: true },
    rulesLevel: 'high',
    introOutro: false,
    noText: true,
  };

  it('should successfully validate the canonical reference blueprint from Tech Design Section 4 (v1.1)', () => {
    const result = validateMotionBlueprint(validReferenceBlueprint);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.blueprint.blueprintId).toBe('uuid-v4-reference-1234');
      expect(result.blueprint.layers.length).toBe(2);
      expect(result.blueprint.layers[0]?.type).toBe('shape');
      expect(result.blueprint.layers[1]?.type).toBe('path');
      expect(result.blueprint.loop.seamless).toBe(true);
    }
  });

  it('should accept all supported layer types (shape, path, icon, particle, particle-system, image-ref)', () => {
    for (const layerType of LAYER_TYPES) {
      const isParticleSystem = layerType === 'particle-system';
      const blueprint = {
        ...validReferenceBlueprint,
        layers: [
          {
            id: `test-${layerType}`,
            type: layerType,
            properties: isParticleSystem
              ? {
                  count: 50,
                  area: { x: 0, y: 0, width: 1080, height: 1080 },
                  sizeRange: [2, 6],
                  colorPalette: ['#00E5FF', '#FFFFFF'],
                  motionPattern: 'float-up-wrap',
                  speedRange: [0.5, 1.5],
                  seed: 42,
                }
              : { opacity: 1 },
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
              { t: 0.5, props: { x: 100 }, easing },
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
            { t: 0.5, props: { x: 100 }, easing: 'cubic-bezier-custom' },
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

  it('should reject keyframe progress t > 1.0 (v1.1: normalized range)', () => {
    const invalidBlueprint = {
      ...validReferenceBlueprint,
      layers: [
        {
          id: 'overflow-layer',
          type: 'shape' as const,
          properties: {},
          keyframes: [
            { t: 0.0, props: { x: 0 } },
            { t: 1.5, props: { x: 100 } }, // 1.5 > 1.0!
          ],
        },
      ],
    };

    const result = validateMotionBlueprint(invalidBlueprint);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      const errorMsg = result.errors.find((e) => e.includes('layers[0].keyframes[1].t'));
      expect(errorMsg).toBeDefined();
      expect(errorMsg).toContain('1.0');
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
          keyframes: [{ t: -0.5, props: { x: 0 } }],
        },
      ],
    };

    const result = validateMotionBlueprint(invalidBlueprint);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      const errorMsg = result.errors.find((e) => e.includes('layers[0].keyframes[0].t'));
      expect(errorMsg).toBeDefined();
      expect(errorMsg).toContain('>= 0.0');
    }
  });

  it('should reject missing mandatory fields with clear instruction', () => {
    const missingFieldsBlueprint = {
      // blueprintId omitted
      category: 'icons',
      // canvas omitted
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

  it('should reject non-positive canvas dimensions and fps', () => {
    const invalidDimensionsBlueprint = {
      ...validReferenceBlueprint,
      canvas: { width: 0, height: -1080, background: 'transparent' },
      fps: -60,
    };

    const result = validateMotionBlueprint(invalidDimensionsBlueprint);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes('canvas.width'))).toBe(true);
      expect(result.errors.some((e) => e.includes('canvas.height'))).toBe(true);
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
    it('should fail when layer has mismatch between t=0 and t=1.0 (central-burst case)', () => {
      const centralBurstBlueprint: MotionBlueprint = {
        blueprintId: 'test-central-burst',
        category: 'burst-animation',
        canvas: { width: 1080, height: 1080, background: '#000000' },
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
              { t: 0.5, props: { opacity: 1 } },
              { t: 1.0, props: { opacity: 1 } },
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
        "Layer 'central-burst' tidak seamless: opacity di t=0 (0) tidak sama dengan t=1.0 (1)",
      );
    });

    it('should pass when layer returns to initial property value at t=1.0', () => {
      const seamlessBlueprint: MotionBlueprint = {
        blueprintId: 'test-seamless',
        category: 'pulse',
        canvas: { width: 1080, height: 1080, background: '#000000' },
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
              { t: 0.5, props: { scale: 1.5 } },
              { t: 1.0, props: { scale: 1 } },
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
              { t: 1.0, props: { opacity: 1 } },
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
              { t: 1.0, props: { rotation: 360 } },
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
        fps: 60,
        palette: ['#ffffff'],
        layers: [
          {
            id: 'layer-a',
            type: 'shape',
            properties: { x: 100 },
            keyframes: [
              { t: 0, props: { x: 100 } },
              { t: 1.0, props: { x: 500 } },
            ],
          },
          {
            id: 'layer-b',
            type: 'path',
            properties: { pathProgress: 0 },
            keyframes: [
              { t: 0, props: { pathProgress: 0 } },
              { t: 1.0, props: { pathProgress: 1 } },
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
        "Layer 'layer-a' tidak seamless: x di t=0 (100) tidak sama dengan t=1.0 (500)",
      );
      expect(result.errors[1]).toContain(
        "Layer 'layer-b' tidak seamless: pathProgress di t=0 (0) tidak sama dengan t=1.0 (1)",
      );
    });

    it('should pass position with small floating-point delta (x: 200.005 vs x: 200) without false positive', () => {
      const floatJitterBlueprint: MotionBlueprint = {
        blueprintId: 'test-float-jitter',
        category: 'subpixel-motion',
        canvas: { width: 1080, height: 1080, background: '#000000' },
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
              { t: 0.5, props: { x: 250, y: 350 } },
              { t: 1.0, props: { x: 200, y: 301.2 } },
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
              { t: 1.0, props: { x: 203 } },
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
        "Layer 'jumping-box' tidak seamless: x di t=0 (200) tidak sama dengan t=1.0 (203)",
      );
    });

    it('should completely skip non-numeric properties like fill hex string from loop consistency checks', () => {
      const colorChangeBlueprint: MotionBlueprint = {
        blueprintId: 'test-color-change',
        category: 'color-morph',
        canvas: { width: 1080, height: 1080, background: '#000000' },
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
              { t: 0.5, props: { fill: '#00ff00', opacity: 0.8 } },
              { t: 1.0, props: { fill: '#0000ff', opacity: 1 } },
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

  describe('Path Layer Keyframe Property Validation', () => {
    const basePathLayer: MotionLayer = {
      id: 'main-trend-line',
      type: 'path',
      properties: {
        path: 'M 100 800 L 500 500 L 900 200',
        stroke: '#00E5FF',
        strokeWidth: 8,
      },
      keyframes: [
        { t: 0.0, props: { pathProgress: 0.0 } },
        { t: 1.0, props: { pathProgress: 1.0 }, easing: 'easeInOutCubic' },
      ],
    };

    const baseValidBlueprint: MotionBlueprint = {
      blueprintId: 'path-test-1',
      category: 'finance-trend',
      canvas: { width: 1080, height: 1080, background: 'transparent' },
      fps: 60,
      palette: ['#00E5FF', '#76FF03'],
      layers: [basePathLayer],
      loop: { seamless: true },
      rulesLevel: 'high',
      introOutro: false,
      noText: true,
    };

    it('should successfully validate path layer using valid pathProgress and visual properties', () => {
      const result = validateMotionBlueprint(baseValidBlueprint);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.blueprint.layers[0]?.type).toBe('path');
      }
    });

    it('should reject path layer using trimStart in keyframes with clear error message mentioning pathProgress', () => {
      const invalidBlueprint = {
        ...baseValidBlueprint,
        layers: [
          {
            ...basePathLayer,
            keyframes: [
              { t: 0.0, props: { trimStart: 0.0 } },
              { t: 1.0, props: { trimStart: 1.0 }, easing: 'easeInOutCubic' },
            ],
          },
        ],
      };

      const result = validateMotionBlueprint(invalidBlueprint);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.length).toBeGreaterThanOrEqual(1);
        expect(result.errors[0]).toContain(
          "Layer 'main-trend-line' (type: path) menggunakan properti 'trimStart' yang tidak didukung",
        );
        expect(result.errors[0]).toContain(
          "Gunakan 'pathProgress' (0-1) untuk animasi progresif path",
        );
      }
    });

    it('should reject path layer using trimEnd in keyframes with clear error message mentioning pathProgress', () => {
      const invalidBlueprint = {
        ...baseValidBlueprint,
        layers: [
          {
            ...basePathLayer,
            keyframes: [
              { t: 0.0, props: { trimEnd: 0.0 } },
              { t: 1.0, props: { trimEnd: 1.0 }, easing: 'easeInOutCubic' },
            ],
          },
        ],
      };

      const result = validateMotionBlueprint(invalidBlueprint);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.length).toBeGreaterThanOrEqual(1);
        expect(result.errors[0]).toContain(
          "Layer 'main-trend-line' (type: path) menggunakan properti 'trimEnd' yang tidak didukung",
        );
        expect(result.errors[0]).toContain(
          "Gunakan 'pathProgress' (0-1) untuk animasi progresif path",
        );
      }
    });

    it('should reject path layer when both trimStart and trimEnd are present', () => {
      const invalidBlueprint = {
        ...baseValidBlueprint,
        layers: [
          {
            ...basePathLayer,
            keyframes: [
              { t: 0.0, props: { trimStart: 0.0, trimEnd: 0.5 } },
              { t: 1.0, props: { trimStart: 0.5, trimEnd: 1.0 } },
            ],
          },
        ],
      };

      const result = validateMotionBlueprint(invalidBlueprint);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        const joinedErrors = result.errors.join(' ');
        expect(joinedErrors).toContain('trimStart');
        expect(joinedErrors).toContain('trimEnd');
        expect(joinedErrors).toContain("Gunakan 'pathProgress' (0-1) untuk animasi progresif path");
      }
    });

    it('should reject path layer with non-numeric pathProgress', () => {
      const invalidBlueprint = {
        ...baseValidBlueprint,
        layers: [
          {
            ...basePathLayer,
            keyframes: [
              { t: 0.0, props: { pathProgress: 'start' } },
              { t: 1.0, props: { pathProgress: 'end' } },
            ],
          },
        ],
      };

      const result = validateMotionBlueprint(invalidBlueprint);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(
          result.errors.some((err) => err.includes("properti 'pathProgress' harus berupa angka")),
        ).toBe(true);
      }
    });
  });

  describe('Particle System Layer Validation (v1.2)', () => {
    const validParticleSystemLayer = {
      id: 'neon-particles-system',
      type: 'particle-system' as const,
      properties: {
        count: 80,
        area: { x: 0, y: 0, width: 1080, height: 1080 },
        sizeRange: [2, 6],
        colorPalette: ['#00E5FF', '#76FF03', '#FFFFFF'],
        motionPattern: 'float-up-wrap' as const,
        speedRange: [0.5, 2.0],
        seed: 42,
      },
      keyframes: [],
    };

    it('should successfully validate a well-formed particle-system layer without keyframes', () => {
      const blueprint = {
        ...validReferenceBlueprint,
        layers: [validParticleSystemLayer],
      };

      const result = validateMotionBlueprint(blueprint);
      expect(result.valid).toBe(true);
    });

    it('should accept all valid motionPattern enum values', () => {
      const patterns = ['float-up-wrap', 'orbit-center', 'drift-random', 'fall-wrap'] as const;
      for (const pattern of patterns) {
        const blueprint = {
          ...validReferenceBlueprint,
          layers: [
            {
              ...validParticleSystemLayer,
              properties: {
                ...validParticleSystemLayer.properties,
                motionPattern: pattern,
              },
            },
          ],
        };

        const result = validateMotionBlueprint(blueprint);
        expect(result.valid).toBe(true);
      }
    });

    it('should reject particle-system with missing seed', () => {
      const { seed: _, ...propsWithoutSeed } = validParticleSystemLayer.properties;
      const invalidBlueprint = {
        ...validReferenceBlueprint,
        layers: [
          {
            ...validParticleSystemLayer,
            properties: propsWithoutSeed,
          },
        ],
      };

      const result = validateMotionBlueprint(invalidBlueprint);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.some((err) => err.includes("'seed' is missing"))).toBe(true);
      }
    });

    it('should reject particle-system with non-integer seed', () => {
      const invalidBlueprint = {
        ...validReferenceBlueprint,
        layers: [
          {
            ...validParticleSystemLayer,
            properties: {
              ...validParticleSystemLayer.properties,
              seed: 42.5,
            },
          },
        ],
      };

      const result = validateMotionBlueprint(invalidBlueprint);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.some((err) => err.includes('seed must be an integer'))).toBe(true);
      }
    });

    it('should reject invalid motionPattern outside closed enum', () => {
      const invalidBlueprint = {
        ...validReferenceBlueprint,
        layers: [
          {
            ...validParticleSystemLayer,
            properties: {
              ...validParticleSystemLayer.properties,
              motionPattern: 'explode-burst',
            },
          },
        ],
      };

      const result = validateMotionBlueprint(invalidBlueprint);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.some((err) => err.includes('Invalid motionPattern'))).toBe(true);
      }
    });

    it('should reject particle-system with invalid count (<= 0)', () => {
      const invalidBlueprint = {
        ...validReferenceBlueprint,
        layers: [
          {
            ...validParticleSystemLayer,
            properties: {
              ...validParticleSystemLayer.properties,
              count: 0,
            },
          },
        ],
      };

      const result = validateMotionBlueprint(invalidBlueprint);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.some((err) => err.includes('count must be greater than 0'))).toBe(true);
      }
    });

    it('should reject particle-system with incomplete area dimensions', () => {
      const invalidBlueprint = {
        ...validReferenceBlueprint,
        layers: [
          {
            ...validParticleSystemLayer,
            properties: {
              ...validParticleSystemLayer.properties,
              area: { x: 0, y: 0, width: 1080 } as unknown as Record<string, unknown>, // missing height
            },
          },
        ],
      };

      const result = validateMotionBlueprint(invalidBlueprint);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.some((err) => err.includes("'height' is missing"))).toBe(true);
      }
    });
  });

  describe('Aspect Ratio and Canvas Dimension Validation (v1.3)', () => {
    it('should export valid ASPECT_RATIOS and dimension mappings', () => {
      expect(ASPECT_RATIOS).toEqual(['16:9', '9:16', '1:1']);
      expect(ASPECT_RATIO_DIMENSIONS['16:9']).toEqual({ width: 1920, height: 1080 });
      expect(ASPECT_RATIO_DIMENSIONS['9:16']).toEqual({ width: 1080, height: 1920 });
      expect(ASPECT_RATIO_DIMENSIONS['1:1']).toEqual({ width: 1080, height: 1080 });
    });

    it('should validate successfully when canvas matches requested 16:9 aspect ratio', () => {
      const blueprint16x9: MotionBlueprint = {
        ...validReferenceBlueprint,
        canvas: { width: 1920, height: 1080, background: 'transparent' },
      };

      const result = validateMotionBlueprint(blueprint16x9, { expectedAspectRatio: '16:9' });
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.blueprint.canvas.width).toBe(1920);
        expect(result.blueprint.canvas.height).toBe(1080);
      }
    });

    it('should validate successfully when canvas matches requested 9:16 aspect ratio', () => {
      const blueprint9x16: MotionBlueprint = {
        ...validReferenceBlueprint,
        canvas: { width: 1080, height: 1920, background: 'transparent' },
      };

      const result = validateMotionBlueprint(blueprint9x16, { expectedAspectRatio: '9:16' });
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.blueprint.canvas.width).toBe(1080);
        expect(result.blueprint.canvas.height).toBe(1920);
      }
    });

    it('should validate successfully when canvas matches requested 1:1 aspect ratio', () => {
      const blueprint1x1: MotionBlueprint = {
        ...validReferenceBlueprint,
        canvas: { width: 1080, height: 1080, background: 'transparent' },
      };

      const result = validateMotionBlueprint(blueprint1x1, { expectedAspectRatio: '1:1' });
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.blueprint.canvas.width).toBe(1080);
        expect(result.blueprint.canvas.height).toBe(1080);
      }
    });

    it('should reject blueprint when canvas dimensions do not match expected aspect ratio', () => {
      // Requested 16:9 (1920x1080), but blueprint has 1080x1080
      const squareBlueprint: MotionBlueprint = {
        ...validReferenceBlueprint,
        canvas: { width: 1080, height: 1080, background: 'transparent' },
      };

      const result = validateMotionBlueprint(squareBlueprint, { expectedAspectRatio: '16:9' });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0]).toContain('[canvas]: Canvas dimensions [1080x1080] do not match required dimensions [1920x1080] for aspect ratio 16:9');
        expect(result.errors[0]).toContain('You MUST set "canvas": { "width": 1920, "height": 1080 }');
      }
    });

    it('should reject blueprint when canvas dimensions do not match expectedDimensions directly', () => {
      const result = validateMotionBlueprint(validReferenceBlueprint, {
        expectedDimensions: { width: 1280, height: 720 },
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors[0]).toContain('[canvas]: Canvas dimensions [1080x1080] do not match required dimensions [1280x720]');
      }
    });
  });

  describe('Shape Enum Enforcement (Closed Enum: rect | circle | polygon | star)', () => {
    const baseShapeBlueprint: MotionBlueprint = {
      blueprintId: 'shape-test-bp',
      category: 'geometric-pulse',
      canvas: { width: 1080, height: 1080, background: 'transparent' },
      fps: 60,
      palette: ['#00E5FF', '#7C4DFF'],
      layers: [
        {
          id: 'test-shape',
          type: 'shape',
          shape: 'circle',
          properties: { x: 540, y: 540, radius: 60, fill: '#00E5FF' },
          keyframes: [
            { t: 0.0, props: { scale: 1.0 } },
            { t: 1.0, props: { scale: 1.0 } },
          ],
        },
      ],
      loop: { seamless: true },
      rulesLevel: 'high',
      introOutro: false,
      noText: true,
    };

    const baseLayer = baseShapeBlueprint.layers[0] as MotionLayer;

    it('should successfully validate all supported shapes: rect, circle, polygon, star', () => {
      for (const validShape of ['rect', 'circle', 'polygon', 'star']) {
        const bp: MotionBlueprint = {
          ...baseShapeBlueprint,
          layers: [
            {
              ...baseLayer,
              shape: validShape,
              properties:
                validShape === 'polygon'
                  ? { x: 540, y: 540, sides: 6, radius: 80, fill: '#00E5FF' }
                  : { x: 540, y: 540, radius: 80, width: 100, height: 100, fill: '#00E5FF' },
            },
          ],
        };

        const result = validateMotionBlueprint(bp);
        expect(result.valid).toBe(true);
      }
    });

    it('should reject shape "hexagon" with exact actionable message instructing polygon with sides: 6', () => {
      const invalidBp = {
        ...baseShapeBlueprint,
        layers: [
          {
            ...baseLayer,
            shape: 'hexagon',
          },
        ],
      };

      const result = validateMotionBlueprint(invalidBp);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0]).toContain(
          "Shape 'hexagon' tidak didukung. Gunakan shape: 'polygon' dengan properti 'sides: 6' untuk membuat hexagon.",
        );
      }
    });

    it('should reject other n-sided polygon names with actionable message', () => {
      for (const [invalidShape, expectedSides] of [
        ['pentagon', '5'],
        ['octagon', '8'],
        ['triangle', '3'],
      ]) {
        const invalidBp = {
          ...baseShapeBlueprint,
          layers: [
            {
              ...baseLayer,
              shape: invalidShape,
            },
          ],
        };

        const result = validateMotionBlueprint(invalidBp);
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.errors[0]).toContain(`Shape '${invalidShape}' tidak didukung.`);
          expect(result.errors[0]).toContain(`sides: ${expectedSides}`);
        }
      }
    });

    it('should reject arbitrary unsupported shape names like "box" or "ring"', () => {
      const invalidBp = {
        ...baseShapeBlueprint,
        layers: [
          {
            ...baseLayer,
            shape: 'ring',
          },
        ],
      };

      const result = validateMotionBlueprint(invalidBp);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors[0]).toContain("Shape 'ring' tidak didukung.");
        expect(result.errors[0]).toContain("'rect', 'circle', 'polygon', 'star'");
      }
    });
  });
});
