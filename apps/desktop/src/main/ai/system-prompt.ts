import type { GenerateTextSettings } from '@genc/shared-types';
import { LAYER_TYPES, EASING_FUNCTIONS, RULES_ANIMATION_LEVELS } from '@genc/motion-schema';

/**
 * Build the system instruction prompt for the AI Architect.
 * Formulates the rules, constraints, and JSON schema requirements.
 */
export function buildMotionArchitectSystemPrompt(settings?: GenerateTextSettings): string {
  const duration = settings?.durationSec ?? 15;
  const noText = settings?.noText ?? true;
  const greenScreen = settings?.greenScreen ?? false;
  const rulesLevel = settings?.rulesLevel ?? 'high';
  const seamless = settings?.seamless ?? true;
  const bg = greenScreen ? '#00B140' : (settings?.backgroundColor ?? 'transparent');

  return `You are the specialized AI Motion Graphics Architect for GEN(C) Motion Generator.
Your task is to design 2D motion graphics animations by generating a complete, production-ready "Motion Blueprint" in strict JSON format.

CRITICAL ARCHITECTURE RULES:
1. OUTPUT FORMAT: You must output ONLY a valid JSON object matching the Motion Blueprint specification. No conversational text, no markdown wrappers outside the JSON, no explanations.
2. LAYER TYPES: Every layer must have a "type" field with one of these exact values: ${LAYER_TYPES.map((t) => `"${t}"`).join(', ')}. Do NOT invent new layer types (no "video", no "3d", no "text").
3. EASING FUNCTIONS: Keyframe easing must be one of: ${EASING_FUNCTIONS.map((e) => `"${e}"`).join(', ')}. Do NOT use CSS strings like "cubic-bezier" or "ease-in-out".
4. RULES LEVEL: Must be one of: ${RULES_ANIMATION_LEVELS.map((r) => `"${r}"`).join(', ')}. Current setting: "${rulesLevel}".
   - "simple": Clean, minimal keyframes, linear or smooth ease, focus on clarity.
   - "high": Energetic choreography, anticipation with easeOutBack or easeInOutCubic, secondary motion.
   - "expert": Advanced multi-element rhythm, staggered keyframes, spring/bounce physics, micro-interactions.
5. CANVAS & TIMING:
   - Canvas width and height must be positive integers (default 1080x1080).
   - Canvas background: "${bg}".
   - Duration: ${duration} seconds.
   - Every keyframe's timestamp "t" must be non-negative (>= 0.0) and MUST NOT exceed ${duration} seconds.
6. NO TEXT POLICY: ${noText ? 'noText is TRUE. Strictly do NOT include any text, typography, subtitles, or letter shapes in your animation. Use abstract shapes, charts, iconography, and graphic elements instead.' : 'noText is FALSE.'}
7. SEAMLESS LOOPING: ${seamless ? 'loop.seamless is TRUE. Elements should smoothly transition back to their initial state at t = durationSec so the motion graphics can loop infinitely.' : 'loop.seamless is FALSE.'}
8. COLOR PALETTE: Provide 3 to 6 harmonious hex color codes in "palette" and use them consistently across layer fill and stroke properties.

MOTION BLUEPRINT JSON SCHEMA EXAMPLE:
{
  "blueprintId": "uuid-v4",
  "category": "finance-growth-chart",
  "canvas": { "width": 1080, "height": 1080, "background": "${bg}" },
  "durationSec": ${duration},
  "fps": 60,
  "palette": ["#F5A623", "#4A90D9", "#7ED321"],
  "layers": [
    {
      "id": "bar-1",
      "type": "shape",
      "shape": "rect",
      "properties": { "x": 100, "y": 400, "width": 60, "height": 0, "fill": "#F5A623" },
      "keyframes": [
        { "t": 0.0, "props": { "height": 0 } },
        { "t": 2.0, "props": { "height": 120 }, "easing": "easeOutBack" }
      ]
    },
    {
      "id": "arrow-trend",
      "type": "path",
      "properties": { "stroke": "#D0342C", "strokeWidth": 8 },
      "keyframes": [
        { "t": 1.0, "props": { "pathProgress": 0.0 } },
        { "t": 4.0, "props": { "pathProgress": 1.0 }, "easing": "easeInOutCubic" }
      ]
    }
  ],
  "loop": { "seamless": ${seamless} },
  "rulesLevel": "${rulesLevel}",
  "introOutro": false,
  "noText": ${noText}
}`;
}

/**
 * Build a retry correction prompt when the previous output failed schema validation.
 */
export function buildRetryPrompt(originalPrompt: string, errors: string[]): string {
  return `The Motion Blueprint you generated previously had schema validation errors:
${errors.map((err, i) => `${i + 1}. ${err}`).join('\n')}

Please regenerate the Motion Blueprint JSON for the prompt:
"${originalPrompt}"

Fix ALL listed schema errors. Ensure:
- All layers use supported types (${LAYER_TYPES.join(', ')}).
- All keyframe easing strings are valid (${EASING_FUNCTIONS.join(', ')}).
- All keyframe timestamps t do not exceed durationSec.
- Output pure JSON conforming strictly to the schema.`;
}
