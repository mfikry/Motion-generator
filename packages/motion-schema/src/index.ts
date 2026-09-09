/**
 * @genc/motion-schema
 *
 * Motion Blueprint schema definitions and validators.
 * Full implementation in Epic E3.
 */

/** Placeholder type for Motion Blueprint — will be replaced with Zod schema in E3 */
export interface MotionBlueprint {
  blueprintId: string;
  category: string;
  canvas: {
    width: number;
    height: number;
    background: string;
  };
  durationSec: number;
  fps: number;
  palette: string[];
  layers: MotionLayer[];
  loop: { seamless: boolean };
  rulesLevel: 'simple' | 'high' | 'expert';
  introOutro: boolean;
  noText: boolean;
}

export interface MotionLayer {
  id: string;
  type: 'shape' | 'path' | 'icon' | 'particle' | 'image-ref';
  shape?: string;
  properties: Record<string, unknown>;
  keyframes: MotionKeyframe[];
}

export interface MotionKeyframe {
  t: number;
  props: Record<string, unknown>;
  easing?: string;
}
