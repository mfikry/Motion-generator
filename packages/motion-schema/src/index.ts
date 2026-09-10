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

/** Closed enum of primitive layer types supported by PixiJS Render Engine */
export const LAYER_TYPES = ['shape', 'path', 'icon', 'particle', 'image-ref'] as const;
export const LayerTypeSchema = z.enum(LAYER_TYPES, {
  errorMap: () => ({
    message: `Invalid layer type. Expected one of: ${LAYER_TYPES.map((t) => `'${t}'`).join(', ')}.`,
  }),
});
export type LayerType = z.infer<typeof LayerTypeSchema>;

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

/** Keyframe definition */
export const MotionKeyframeSchema = z.object({
  t: z
    .number({
      required_error: 'Keyframe timestamp t is required',
      invalid_type_error: 'Keyframe timestamp t must be a number',
    })
    .min(0, 'Keyframe timestamp t must be non-negative (>= 0)'),
  props: z.record(z.string(), z.unknown(), {
    required_error: 'Keyframe props object is required',
    invalid_type_error: 'Keyframe props must be an object of animated properties',
  }),
  easing: EasingFunctionSchema.optional(),
});
export type MotionKeyframe = z.infer<typeof MotionKeyframeSchema>;

/** Layer definition */
export const MotionLayerSchema = z.object({
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
      required_error: 'Layer keyframes array is required',
      invalid_type_error: 'Layer keyframes must be an array',
    })
    .min(1, 'Layer must contain at least 1 keyframe'),
});
export type MotionLayer = z.infer<typeof MotionLayerSchema>;

// ============================================================================
// 3. Motion Blueprint Schema
// ============================================================================

export const MotionBlueprintSchema = z
  .object({
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
    durationSec: z
      .number({
        required_error: 'durationSec is required',
        invalid_type_error: 'durationSec must be a number',
      })
      .positive('durationSec must be greater than 0'),
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
  })
  .superRefine((data, ctx) => {
    // Cross-field validation: keyframe timestamps must not exceed durationSec
    if (Array.isArray(data.layers)) {
      data.layers.forEach((layer, layerIdx) => {
        if (Array.isArray(layer.keyframes)) {
          layer.keyframes.forEach((kf, kfIdx) => {
            if (typeof kf.t === 'number' && kf.t > data.durationSec) {
              ctx.addIssue({
                code: 'custom',
                message: `Keyframe timestamp t (${kf.t}s) exceeds blueprint durationSec (${data.durationSec}s). Instruction: Ensure all keyframe timestamps are between 0 and durationSec.`,
                path: ['layers', layerIdx, 'keyframes', kfIdx, 't'],
              });
            }
          });
        }
      });
    }
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

/**
 * Validate an unknown data object against the official Motion Blueprint schema.
 *
 * @param data The JSON object to validate (from Gemini API, DB, or file).
 * @returns { valid: true, blueprint } on success, or { valid: false, errors: string[] } with actionable error messages.
 */
export function validateMotionBlueprint(data: unknown): ValidateMotionBlueprintResult {
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
    return {
      valid: true,
      blueprint: parseResult.data,
    };
  }

  const errors = parseResult.error.issues.map(formatZodIssue);

  return {
    valid: false,
    errors,
  };
}
