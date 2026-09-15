import type { MotionLayer } from '@genc/shared-types';
import { interpolateNumber, interpolateColor } from './easing';
import type { InterpolatedProperties } from './types';

/**
 * Check if a layer represents a background element.
 */
export function isBackgroundLayer(layer: MotionLayer): boolean {
  const idLower = layer.id.toLowerCase();
  const shapeLower = layer.shape?.toLowerCase() ?? '';
  return (
    idLower.includes('bg') ||
    idLower.includes('background') ||
    shapeLower === 'background' ||
    shapeLower === 'backdrop'
  );
}

/**
 * Check if a string is a valid Hex color code.
 */
function isHexColor(val: unknown): val is string {
  if (typeof val !== 'string') return false;
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(val.trim());
}

/**
 * Interpolate all properties for a single layer at normalized progress t.
 *
 * @param layer The MotionLayer from the blueprint
 * @param time Current normalized progress (0.0–1.0), after Time Remap from playback seconds
 * @param options Optional flags (e.g. backgroundAnimations toggle)
 * @returns Map of property keys to interpolated values at progress t
 */
export function interpolateLayerProperties(
  layer: MotionLayer,
  time: number,
  options?: { backgroundAnimations?: boolean },
): InterpolatedProperties {
  // If background animations are toggled OFF and this is a background layer, freeze at t = 0
  const effectiveTime =
    options?.backgroundAnimations === false && isBackgroundLayer(layer) ? 0.0 : Math.max(0, time);

  const result: InterpolatedProperties = { ...(layer.properties || {}) };

  if (!layer.keyframes || layer.keyframes.length === 0) {
    return result;
  }

  // Collect all unique property keys defined in any keyframe
  const animatedProps = new Set<string>();
  for (const kf of layer.keyframes) {
    if (kf.props && typeof kf.props === 'object') {
      for (const key of Object.keys(kf.props)) {
        animatedProps.add(key);
      }
    }
  }

  // Interpolate each animated property
  for (const prop of animatedProps) {
    // Filter and sort keyframes containing this property
    const kfsWithProp = layer.keyframes
      .filter((kf) => kf.props && prop in kf.props)
      .sort((a, b) => a.t - b.t);

    if (kfsWithProp.length === 0) {
      continue;
    }

    const firstKf = kfsWithProp[0];
    const lastKf = kfsWithProp[kfsWithProp.length - 1];
    if (!firstKf || !lastKf) continue;

    // Case 1: Time is before the first keyframe
    if (effectiveTime <= firstKf.t) {
      if (firstKf.t === 0 || !(prop in layer.properties)) {
        result[prop] = firstKf.props[prop];
      } else {
        // Interpolate between initial layer.properties at t=0 and first keyframe
        const initialVal = layer.properties[prop];
        const targetVal = firstKf.props[prop];
        const progress = firstKf.t > 0 ? effectiveTime / firstKf.t : 1;
        const easing = firstKf.easing;

        if (typeof initialVal === 'number' && typeof targetVal === 'number') {
          result[prop] = interpolateNumber(initialVal, targetVal, progress, easing);
        } else if (isHexColor(initialVal) && isHexColor(targetVal)) {
          result[prop] = interpolateColor(initialVal, targetVal, progress, easing);
        } else {
          result[prop] = progress >= 1 ? targetVal : initialVal;
        }
      }
      continue;
    }

    // Case 2: Time is at or past the last keyframe
    if (effectiveTime >= lastKf.t) {
      result[prop] = lastKf.props[prop];
      continue;
    }

    // Case 3: Time is between two keyframes
    for (let i = 0; i < kfsWithProp.length - 1; i++) {
      const kf1 = kfsWithProp[i];
      const kf2 = kfsWithProp[i + 1];
      if (!kf1 || !kf2) continue;

      if (effectiveTime >= kf1.t && effectiveTime <= kf2.t) {
        const span = kf2.t - kf1.t;
        const progress = span > 0 ? (effectiveTime - kf1.t) / span : 1;
        const easing = kf2.easing ?? kf1.easing;

        const val1 = kf1.props[prop];
        const val2 = kf2.props[prop];

        if (typeof val1 === 'number' && typeof val2 === 'number') {
          result[prop] = interpolateNumber(val1, val2, progress, easing);
        } else if (isHexColor(val1) && isHexColor(val2)) {
          result[prop] = interpolateColor(val1, val2, progress, easing);
        } else {
          result[prop] = progress >= 1 ? val2 : val1;
        }
        break;
      }
    }
  }

  return result;
}
