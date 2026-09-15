import { z } from 'zod';

/**
 * @genc/motion-schema
 *
 * Official Motion Blueprint schema and validator.
 * Acts as the strict contract between AI Architect (Gemini API) and Render Engine (PixiJS).
 */

// ============================================================================
// 1. Enums & Constants
// ============================================================================

/** Closed enum of primitive layer types supported by PixiJS Render Engine (v1.2: added particle-system) */
export const LAYER_TYPES = [
  'shape',
  'path',
  'icon',
  'particle',
  'particle-system',
  'image-ref',
] as const;
export const LayerTypeSchema = z.enum(LAYER_TYPES, {
  errorMap: () => ({
    message: `Invalid layer type. Expected one of: ${LAYER_TYPES.map((t) => `'${t}'`).join(', ')}.`,
  }),
});
export type LayerType = z.infer<typeof LayerTypeSchema>;

/** Closed enum of supported shapes for shape layers */
export const SUPPORTED_SHAPES = ['rect', 'circle', 'polygon', 'star'] as const;
export const SUPPORTED_SHAPES_SET = new Set<string>(SUPPORTED_SHAPES);
export const SupportedShapeSchema = z.enum(SUPPORTED_SHAPES, {
  errorMap: () => ({
    message: `Invalid shape. Expected one of: ${SUPPORTED_SHAPES.map((s) => `'${s}'`).join(', ')}.`,
  }),
});
export type SupportedShape = z.infer<typeof SupportedShapeSchema>;

/** Closed enum of procedural particle motion patterns (v1.2) */
export const PARTICLE_MOTION_PATTERNS = [
  'float-up-wrap',
  'orbit-center',
  'drift-random',
  'fall-wrap',
] as const;
export const ParticleMotionPatternSchema = z.enum(PARTICLE_MOTION_PATTERNS, {
  errorMap: () => ({
    message: `Invalid motionPattern. Expected one of: ${PARTICLE_MOTION_PATTERNS.map((p) => `'${p}'`).join(', ')}.`,
  }),
});
export type ParticleMotionPattern = z.infer<typeof ParticleMotionPatternSchema>;

/** Closed enum of easing functions mapped to PixiJS/GSAP easing implementations */
export const EASING_FUNCTIONS = [
  'linear',
  'easeInQuad',
  'easeOutQuad',
  'easeInOutQuad',
  'easeInCubic',
  'easeOutCubic',
  'easeInOutCubic',
  'easeInBack',
  'easeOutBack',
  'easeInOutBack',
  'spring',
  'bounce',
] as const;
export const EasingFunctionSchema = z.enum(EASING_FUNCTIONS, {
  errorMap: () => ({
    message: `Invalid easing function. Expected one of: ${EASING_FUNCTIONS.map((e) => `'${e}'`).join(', ')}.`,
  }),
});
export type EasingFunction = z.infer<typeof EasingFunctionSchema>;

/** Closed enum of rules animation levels */
export const RULES_ANIMATION_LEVELS = ['simple', 'high', 'expert'] as const;
export const RulesAnimationLevelSchema = z.enum(RULES_ANIMATION_LEVELS, {
  errorMap: () => ({
    message: `Invalid rulesLevel. Expected one of: ${RULES_ANIMATION_LEVELS.map((r) => `'${r}'`).join(', ')}.`,
  }),
});
export type RulesAnimationLevel = z.infer<typeof RulesAnimationLevelSchema>;

/** Closed enum of supported aspect ratios (v1.3) */
export const ASPECT_RATIOS = ['16:9', '9:16', '1:1'] as const;
export const AspectRatioSchema = z.enum(ASPECT_RATIOS, {
  errorMap: () => ({
    message: `Invalid aspect ratio. Expected one of: ${ASPECT_RATIOS.map((r) => `'${r}'`).join(', ')}.`,
  }),
});
export type AspectRatio = z.infer<typeof AspectRatioSchema>;

export const ASPECT_RATIO_DIMENSIONS: Record<AspectRatio, { width: number; height: number }> = {
  '16:9': { width: 1920, height: 1080 },
  '9:16': { width: 1080, height: 1920 },
  '1:1': { width: 1080, height: 1080 },
};

// ============================================================================
// 2. Sub-Schemas
// ============================================================================

/** Canvas configuration */
export const CanvasSchema = z.object({
  width: z
    .number()
    .int('Canvas width must be an integer')
    .positive('Canvas width must be greater than 0'),
  height: z
    .number()
    .int('Canvas height must be an integer')
    .positive('Canvas height must be greater than 0'),
  background: z
    .string()
    .min(1, 'Canvas background must be specified (e.g. #HEX, rgba, or transparent)'),
});
export type CanvasConfig = z.infer<typeof CanvasSchema>;

/** Loop configuration */
export const LoopSchema = z.object({
  seamless: z.boolean({
    required_error: 'loop.seamless boolean is required',
    invalid_type_error: 'loop.seamless must be a boolean',
  }),
});
export type LoopConfig = z.infer<typeof LoopSchema>;

/** Keyframe definition (v1.1: t is normalized progress 0.0–1.0, not seconds) */
export const MotionKeyframeSchema = z.object({
  t: z
    .number({
      required_error: 'Keyframe timestamp t is required',
      invalid_type_error: 'Keyframe timestamp t must be a number',
    })
    .min(0, 'Keyframe progress t must be >= 0.0')
    .max(1.0, 'Keyframe progress t must be <= 1.0 (normalized progress, not seconds)'),
  props: z.record(z.string(), z.unknown(), {
    required_error: 'Keyframe props object is required',
    invalid_type_error: 'Keyframe props must be an object of animated properties',
  }),
  easing: EasingFunctionSchema.optional(),
});
export type MotionKeyframe = z.infer<typeof MotionKeyframeSchema>;

/** Allowed properties in keyframes[].props for path layers */
export const ALLOWED_PATH_KEYFRAME_PROPS = [
  'pathProgress',
  'stroke',
  'strokeWidth',
  'fill',
  'color',
  'opacity',
  'x',
  'y',
  'cx',
  'cy',
  'width',
  'height',
  'rotation',
  'scale',
  'scaleX',
  'scaleY',
  'path',
  'pathData',
] as const;
export const ALLOWED_PATH_KEYFRAME_PROPS_SET = new Set<string>(ALLOWED_PATH_KEYFRAME_PROPS);

/** Particle system emission/bounding area (v1.2) */
export const ParticleSystemAreaSchema = z.object({
  x: z.number({ required_error: 'area.x is required' }),
  y: z.number({ required_error: 'area.y is required' }),
  width: z.number({ required_error: 'area.width is required' }).positive('area.width must be positive'),
  height: z.number({ required_error: 'area.height is required' }).positive('area.height must be positive'),
});
export type ParticleSystemArea = z.infer<typeof ParticleSystemAreaSchema>;

/** Particle system layer properties schema (v1.2) */
export const ParticleSystemPropertiesSchema = z.object({
  count: z
    .number({ required_error: 'count is required for particle-system' })
    .int('count must be an integer')
    .positive('count must be greater than 0'),
  area: ParticleSystemAreaSchema,
  sizeRange: z
    .array(z.number().positive('Particle size in sizeRange must be positive'), {
      required_error: 'sizeRange is required',
    })
    .length(2, 'sizeRange must contain exactly 2 numbers [min, max]'),
  colorPalette: z
    .array(z.string().min(1, 'Color string must not be empty'), {
      required_error: 'colorPalette is required',
    })
    .min(1, 'colorPalette must contain at least 1 color'),
  motionPattern: ParticleMotionPatternSchema,
  speedRange: z
    .array(z.number().positive('Particle speed in speedRange must be positive'), {
      required_error: 'speedRange is required',
    })
    .length(2, 'speedRange must contain exactly 2 numbers [min, max]'),
  seed: z
    .number({ required_error: 'seed is required for particle-system' })
    .int('seed must be an integer'),
});
export type ParticleSystemProperties = z.infer<typeof ParticleSystemPropertiesSchema>;

/** Layer definition */
export const MotionLayerSchema = z
  .object({
    id: z
      .string({
        required_error: 'Layer id is required',
        invalid_type_error: 'Layer id must be a string',
      })
      .min(1, 'Layer id must not be empty'),
    type: LayerTypeSchema,
    shape: z.string().optional(),
    properties: z.record(z.string(), z.unknown(), {
      required_error: 'Layer properties object is required',
      invalid_type_error: 'Layer properties must be an object',
    }),
    keyframes: z
      .array(MotionKeyframeSchema, {
        invalid_type_error: 'Layer keyframes must be an array',
      })
      .optional(),
  })
  .superRefine((layer, ctx) => {
    // Non-particle-system layers require at least 1 keyframe
    if (layer.type !== 'particle-system') {
      if (!Array.isArray(layer.keyframes) || layer.keyframes.length === 0) {
        ctx.addIssue({
          code: 'custom',
          message: `Layer '${layer.id}' must contain at least 1 keyframe`,
          path: ['keyframes'],
        });
      }
    }

    // Strict particle-system property validation
    if (layer.type === 'particle-system') {
      const parsedProps = ParticleSystemPropertiesSchema.safeParse(layer.properties);
      if (!parsedProps.success) {
        for (const issue of parsedProps.error.issues) {
          ctx.addIssue({
            ...issue,
            path: ['properties', ...issue.path],
          });
        }
      }
    }

    // Strict shape layer validation: closed enum of rect | circle | polygon | star
    if (layer.type === 'shape') {
      if (layer.shape !== undefined) {
        const rawShape = layer.shape.trim().toLowerCase();
        if (rawShape === 'hexagon') {
          ctx.addIssue({
            code: 'custom',
            message: `Shape 'hexagon' tidak didukung. Gunakan shape: 'polygon' dengan properti 'sides: 6' untuk membuat hexagon.`,
            path: ['shape'],
          });
        } else if (rawShape === 'pentagon') {
          ctx.addIssue({
            code: 'custom',
            message: `Shape 'pentagon' tidak didukung. Gunakan shape: 'polygon' dengan properti 'sides: 5' untuk membuat pentagon.`,
            path: ['shape'],
          });
        } else if (rawShape === 'octagon') {
          ctx.addIssue({
            code: 'custom',
            message: `Shape 'octagon' tidak didukung. Gunakan shape: 'polygon' dengan properti 'sides: 8' untuk membuat octagon.`,
            path: ['shape'],
          });
        } else if (rawShape === 'triangle') {
          ctx.addIssue({
            code: 'custom',
            message: `Shape 'triangle' tidak didukung. Gunakan shape: 'polygon' dengan properti 'sides: 3' untuk membuat triangle.`,
            path: ['shape'],
          });
        } else if (!SUPPORTED_SHAPES_SET.has(rawShape)) {
          ctx.addIssue({
            code: 'custom',
            message: `Shape '${layer.shape}' tidak didukung. Pilihan yang valid hanya: ${SUPPORTED_SHAPES.map((s) => `'${s}'`).join(', ')}. Untuk poligon bersisi-N, gunakan shape: 'polygon' dengan properti 'sides: N'.`,
            path: ['shape'],
          });
        }
      }
    }

    // Strict path layer validation: only pathProgress and general visual/transform props are permitted
    if (layer.type === 'path') {
      if (Array.isArray(layer.keyframes)) {
        layer.keyframes.forEach((kf, kfIdx) => {
          if (kf.props && typeof kf.props === 'object') {
            for (const propKey of Object.keys(kf.props)) {
              if (!ALLOWED_PATH_KEYFRAME_PROPS_SET.has(propKey)) {
                ctx.addIssue({
                  code: 'custom',
                  message: `Layer '${layer.id}' (type: path) menggunakan properti '${propKey}' yang tidak didukung. Instruction: Gunakan 'pathProgress' (0-1) untuk animasi progresif path.`,
                  path: ['keyframes', kfIdx, 'props', propKey],
                });
              } else if (propKey === 'pathProgress' && typeof kf.props[propKey] !== 'number') {
                ctx.addIssue({
                  code: 'custom',
                  message: `Layer '${layer.id}' properti 'pathProgress' harus berupa angka (0-1). Instruction: Pastikan nilai pathProgress adalah angka antara 0.0 dan 1.0.`,
                  path: ['keyframes', kfIdx, 'props', 'pathProgress'],
                });
              }
            }
          }
        });
      }
    }
  });
export type MotionLayer = z.infer<typeof MotionLayerSchema>;

// ============================================================================
// 3. Motion Blueprint Schema
// ============================================================================

/**
 * Motion Blueprint Schema (v1.1)
 *
 * durationSec removed — keyframe t is normalized progress 0.0–1.0.
 * Duration is purely a UI parameter (Time Remap) applied at render time.
 */
export const MotionBlueprintSchema = z.object({
  blueprintId: z
    .string({
      required_error: 'blueprintId is required',
      invalid_type_error: 'blueprintId must be a string',
    })
    .min(1, 'blueprintId must not be empty'),
  category: z
    .string({
      required_error: 'category is required',
      invalid_type_error: 'category must be a string',
    })
    .min(1, 'category must not be empty'),
  canvas: CanvasSchema,
  fps: z
    .number({
      required_error: 'fps is required',
      invalid_type_error: 'fps must be an integer',
    })
    .int('fps must be an integer')
    .positive('fps must be greater than 0'),
  palette: z
    .array(z.string().min(1, 'Color string in palette must not be empty'), {
      required_error: 'palette is required',
      invalid_type_error: 'palette must be an array of color strings',
    })
    .min(1, 'palette must contain at least 1 color string'),
  layers: z
    .array(MotionLayerSchema, {
      required_error: 'layers is required',
      invalid_type_error: 'layers must be an array of layers',
    })
    .min(1, 'layers must contain at least 1 layer'),
  loop: LoopSchema,
  rulesLevel: RulesAnimationLevelSchema,
  introOutro: z.boolean({
    required_error: 'introOutro boolean is required',
    invalid_type_error: 'introOutro must be a boolean',
  }),
  noText: z.boolean({
    required_error: 'noText boolean is required',
    invalid_type_error: 'noText must be a boolean',
  }),
});

export type MotionBlueprint = z.infer<typeof MotionBlueprintSchema>;

// ============================================================================
// 4. Validation & Error Formatting
// ============================================================================

/** Result of validating a Motion Blueprint */
export type ValidateMotionBlueprintResult =
  { valid: true; blueprint: MotionBlueprint } | { valid: false; errors: string[] };

/**
 * Format a Zod path array into a readable JSON path string (e.g. layers[0].keyframes[1].easing)
 */
export function formatPath(path: (string | number)[]): string {
  if (path.length === 0) return 'root';
  return path.reduce<string>((acc, segment, idx) => {
    if (typeof segment === 'number') {
      return `${acc}[${segment}]`;
    }
    return idx === 0 ? String(segment) : `${acc}.${segment}`;
  }, '');
}

/**
 * Format a single Zod issue into a clear, actionable error instruction
 * suitable for feeding back to Gemini API during retry.
 */
export function formatZodIssue(issue: z.ZodIssue): string {
  const pathStr = formatPath(issue.path);

  // Missing required field
  if (issue.code === 'invalid_type' && (issue as { received?: string }).received === 'undefined') {
    const field = issue.path[issue.path.length - 1] ?? 'field';
    return `[${pathStr}]: Required field '${String(field)}' is missing. Instruction: Provide the missing field in the Motion Blueprint JSON.`;
  }

  // Custom issue with pre-formatted instruction
  if (issue.message.includes('Instruction:')) {
    return `[${pathStr}]: ${issue.message}`;
  }

  // Enum violations (e.g. invalid layer type or easing function)
  if (
    issue.code === 'invalid_enum_value' ||
    issue.message.toLowerCase().includes('expected one of')
  ) {
    return `[${pathStr}]: ${issue.message} Instruction: Change the value to one of the approved options.`;
  }

  // Minimum array items (e.g. empty layers or keyframes)
  if (issue.message.toLowerCase().includes('at least 1')) {
    return `[${pathStr}]: ${issue.message}. Instruction: Add at least one item to the '${pathStr}' array.`;
  }

  // Default with path
  return `[${pathStr}]: ${issue.message}. Instruction: Correct this field to match the Motion Blueprint specification.`;
}

export interface ValidateMotionBlueprintOptions {
  checkLoop?: boolean;
  expectedAspectRatio?: AspectRatio;
  expectedDimensions?: { width: number; height: number };
}

/**
 * Validate an unknown data object against the official Motion Blueprint schema.
 *
 * @param data The JSON object to validate (from Gemini API, DB, or file).
 * @param options Optional settings (e.g. checkLoop to validate loop consistency, expectedAspectRatio/expectedDimensions).
 * @returns { valid: true, blueprint } on success, or { valid: false, errors: string[] } with actionable error messages.
 */
export function validateMotionBlueprint(
  data: unknown,
  options?: ValidateMotionBlueprintOptions,
): ValidateMotionBlueprintResult {
  if (data === null || typeof data !== 'object') {
    return {
      valid: false,
      errors: [
        '[root]: Motion Blueprint must be a valid JSON object, received ' +
          (data === null ? 'null' : typeof data) +
          '. Instruction: Return a top-level JSON object representing the Motion Blueprint.',
      ],
    };
  }

  const parseResult = MotionBlueprintSchema.safeParse(data);

  if (parseResult.success) {
    const blueprint = parseResult.data;

    // Check aspect ratio / canvas dimensions constraint
    const expected =
      options?.expectedDimensions ??
      (options?.expectedAspectRatio ? ASPECT_RATIO_DIMENSIONS[options.expectedAspectRatio] : undefined);

    if (expected) {
      if (blueprint.canvas.width !== expected.width || blueprint.canvas.height !== expected.height) {
        const ratioLabel = options?.expectedAspectRatio ? ` for aspect ratio ${options.expectedAspectRatio}` : '';
        return {
          valid: false,
          errors: [
            `[canvas]: Canvas dimensions [${blueprint.canvas.width}x${blueprint.canvas.height}] do not match required dimensions [${expected.width}x${expected.height}]${ratioLabel}. Instruction: You MUST set "canvas": { "width": ${expected.width}, "height": ${expected.height} }.`,
          ],
        };
      }
    }

    if (options?.checkLoop) {
      const loopCheck = checkLoopConsistency(blueprint);
      if (!loopCheck.seamless) {
        return {
          valid: false,
          errors: loopCheck.errors,
        };
      }
    }

    return {
      valid: true,
      blueprint,
    };
  }

  const errors = parseResult.error.issues.map(formatZodIssue);

  return {
    valid: false,
    errors,
  };
}

// ============================================================================
// 5. Loop Consistency Validator
// ============================================================================

export interface LoopConsistencyResult {
  seamless: boolean;
  errors: string[];
}

/** Specific loop tolerances per property category */
export const LOOP_TOLERANCES = {
  /** Normalized properties (opacity, scale, pathProgress, etc.): ±0.02 */
  NORMALIZED: 0.02,
  /** Pixel-scale position and dimension properties (x, y, radius, width, etc.): ±2.0 px */
  PIXEL: 2.0,
  /** Angular/rotation properties: ±2.0 degrees (with modulo 360° wrapping) */
  ROTATION_DEG: 2.0,
} as const;

const NORMALIZED_LOOP_PROPERTIES = new Set([
  'opacity',
  'alpha',
  'scale',
  'scaleX',
  'scaleY',
  'pathProgress',
  'progress',
]);

const PIXEL_LOOP_PROPERTIES = new Set([
  'x',
  'y',
  'cx',
  'cy',
  'radius',
  'r',
  'width',
  'height',
  'size',
  'strokeWidth',
  'posX',
  'posY',
  'translateX',
  'translateY',
]);

const ROTATION_LOOP_PROPERTIES = new Set(['rotation', 'angle']);

/**
 * Validates that a Motion Blueprint with loop.seamless === true has matching
 * start and end values for all animated properties across all layers.
 *
 * v1.1: Compares property values at t = 0.0 vs t = 1.0 (normalized progress):
 * - opacity, scale, pathProgress: tolerance ±0.02
 * - pixel-scale properties (x, y, cx, cy, radius, width, height, etc.): tolerance ±2 px
 * - rotation: tolerance ±2 degrees (with modulo 360° / 2pi revolution logic)
 * - non-numeric properties (fill, stroke, strings, etc.): completely skipped from numeric checks
 *
 * @param blueprint The Motion Blueprint to check
 * @returns { seamless: boolean, errors: string[] }
 */
export function checkLoopConsistency(blueprint: MotionBlueprint): LoopConsistencyResult {
  if (!blueprint.loop?.seamless) {
    return { seamless: true, errors: [] };
  }

  const errors: string[] = [];
  const endProgress = 1.0;

  for (const layer of blueprint.layers ?? []) {
    if (!Array.isArray(layer.keyframes) || layer.keyframes.length === 0) {
      continue;
    }

    // Collect all animated property names across all keyframes in this layer
    const animatedProps = new Set<string>();
    for (const kf of layer.keyframes) {
      if (kf.props && typeof kf.props === 'object') {
        for (const propName of Object.keys(kf.props)) {
          animatedProps.add(propName);
        }
      }
    }

    // Sort keyframes chronologically
    const sortedKfs = [...layer.keyframes].sort((a, b) => a.t - b.t);

    for (const prop of animatedProps) {
      // 1. Determine effective value at t = 0
      let valStart: unknown;
      const kfAtZero = sortedKfs.find((kf) => kf.t === 0 && kf.props && prop in kf.props);
      if (kfAtZero) {
        valStart = kfAtZero.props[prop];
      } else if (layer.properties && prop in layer.properties) {
        valStart = layer.properties[prop];
      } else {
        const firstWithProp = sortedKfs.find((kf) => kf.props && prop in kf.props);
        valStart = firstWithProp ? firstWithProp.props[prop] : undefined;
      }

      // 2. Determine effective value at t = 1.0 (end of normalized cycle)
      let valEnd: unknown;
      const kfAtEnd = sortedKfs.find((kf) => kf.t === endProgress && kf.props && prop in kf.props);
      if (kfAtEnd) {
        valEnd = kfAtEnd.props[prop];
      } else {
        // Last keyframe at or before 1.0
        const lastWithProp = [...sortedKfs]
          .reverse()
          .find((kf) => kf.t <= endProgress && kf.props && prop in kf.props);
        valEnd = lastWithProp ? lastWithProp.props[prop] : valStart;
      }

      // Non-numeric properties (fill, stroke, strings, etc.) are skipped entirely
      if (typeof valStart !== 'number' || typeof valEnd !== 'number') {
        continue;
      }

      // 3. Compare values for mismatch with property-specific tolerances
      let isMismatch = false;

      if (ROTATION_LOOP_PROPERTIES.has(prop)) {
        const diff = Math.abs(valEnd - valStart);
        // Modulo 360 degree distance wrapping
        const diffMod360 = diff % 360;
        const normalizedDiffDeg = Math.min(diffMod360, 360 - diffMod360);

        // Also support radian comparison (2*PI rad) in case radians are supplied
        const twoPi = 2 * Math.PI;
        const diffModRad = diff % twoPi;
        const normalizedDiffRad = Math.min(diffModRad, twoPi - diffModRad);
        const radTolerance = (LOOP_TOLERANCES.ROTATION_DEG * Math.PI) / 180;

        if (normalizedDiffDeg > LOOP_TOLERANCES.ROTATION_DEG && normalizedDiffRad > radTolerance) {
          isMismatch = true;
        }
      } else if (PIXEL_LOOP_PROPERTIES.has(prop)) {
        if (Math.abs(valStart - valEnd) > LOOP_TOLERANCES.PIXEL) {
          isMismatch = true;
        }
      } else if (NORMALIZED_LOOP_PROPERTIES.has(prop)) {
        if (Math.abs(valStart - valEnd) > LOOP_TOLERANCES.NORMALIZED) {
          isMismatch = true;
        }
      } else {
        // Default tolerance for any other unspecified numeric property: ±0.02
        if (Math.abs(valStart - valEnd) > LOOP_TOLERANCES.NORMALIZED) {
          isMismatch = true;
        }
      }

      if (isMismatch) {
        errors.push(
          `Layer '${layer.id}' tidak seamless: ${prop} di t=0 (${String(valStart)}) tidak sama dengan t=1.0 (${String(valEnd)})`,
        );
      }
    }
  }

  return {
    seamless: errors.length === 0,
    errors,
  };
}
