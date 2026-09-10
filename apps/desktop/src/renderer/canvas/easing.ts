import type { EasingFunction } from '@genc/shared-types';

/**
 * Pure mathematical easing function implementations.
 * Maps normalized time t (0.0 to 1.0) to eased value.
 */
export function ease(t: number, easing?: EasingFunction | string): number {
  const clampedT = Math.max(0, Math.min(1, t));

  switch (easing) {
    case 'linear':
      return clampedT;

    case 'easeInQuad':
      return clampedT * clampedT;

    case 'easeOutQuad':
      return clampedT * (2 - clampedT);

    case 'easeInOutQuad':
      return clampedT < 0.5 ? 2 * clampedT * clampedT : -1 + (4 - 2 * clampedT) * clampedT;

    case 'easeInCubic':
      return clampedT * clampedT * clampedT;

    case 'easeOutCubic': {
      const p = clampedT - 1;
      return p * p * p + 1;
    }

    case 'easeInOutCubic':
      return clampedT < 0.5
        ? 4 * clampedT * clampedT * clampedT
        : (clampedT - 1) * (2 * clampedT - 2) * (2 * clampedT - 2) + 1;

    case 'easeInBack': {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return c3 * clampedT * clampedT * clampedT - c1 * clampedT * clampedT;
    }

    case 'easeOutBack': {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      const p = clampedT - 1;
      return 1 + c3 * Math.pow(p, 3) + c1 * Math.pow(p, 2);
    }

    case 'easeInOutBack': {
      const c1 = 1.70158;
      const c2 = c1 * 1.525;
      return clampedT < 0.5
        ? (Math.pow(2 * clampedT, 2) * ((c2 + 1) * 2 * clampedT - c2)) / 2
        : (Math.pow(2 * clampedT - 2, 2) * ((c2 + 1) * (clampedT * 2 - 2) + c2) + 2) / 2;
    }

    case 'bounce': {
      const n1 = 7.5625;
      const d1 = 2.75;
      let p = clampedT;
      if (p < 1 / d1) {
        return n1 * p * p;
      } else if (p < 2 / d1) {
        p -= 1.5 / d1;
        return n1 * p * p + 0.75;
      } else if (p < 2.5 / d1) {
        p -= 2.25 / d1;
        return n1 * p * p + 0.9375;
      } else {
        p -= 2.625 / d1;
        return n1 * p * p + 0.984375;
      }
    }

    case 'spring': {
      if (clampedT === 0) return 0;
      if (clampedT === 1) return 1;
      return (
        -1 * Math.pow(2, -10 * clampedT) * Math.sin(((clampedT * 10 - 0.75) * (2 * Math.PI)) / 3) +
        1
      );
    }

    default:
      // Default to easeInOutCubic if unspecified
      return clampedT < 0.5
        ? 4 * clampedT * clampedT * clampedT
        : (clampedT - 1) * (2 * clampedT - 2) * (2 * clampedT - 2) + 1;
  }
}

/**
 * Interpolate a numeric property between from and to at progress (0 to 1).
 */
export function interpolateNumber(
  from: number,
  to: number,
  progress: number,
  easing?: EasingFunction | string,
): number {
  const eased = ease(progress, easing);
  return from + (to - from) * eased;
}

/**
 * Parse a hex color string into [r, g, b] (0-255).
 */
export function parseHexColor(hex: string): [number, number, number] {
  let clean = hex.trim().replace(/^#/, '');
  if (clean.length === 3) {
    clean = clean
      .split('')
      .map((c) => c + c)
      .join('');
  }
  const intVal = parseInt(clean, 16);
  if (isNaN(intVal)) {
    return [255, 255, 255];
  }
  return [(intVal >> 16) & 255, (intVal >> 8) & 255, intVal & 255];
}

/**
 * Convert hex color to numeric format for PixiJS (e.g. 0xFF00FF).
 */
export function hexToNumber(hex: string): number {
  const clean = hex.trim().replace(/^#/, '');
  if (clean.length === 3) {
    const expanded = clean
      .split('')
      .map((c) => c + c)
      .join('');
    return parseInt(expanded, 16) || 0;
  }
  return parseInt(clean, 16) || 0;
}

/**
 * Interpolate between two color hex strings.
 */
export function interpolateColor(
  fromHex: string,
  toHex: string,
  progress: number,
  easing?: EasingFunction | string,
): string {
  const eased = ease(progress, easing);
  const [r1, g1, b1] = parseHexColor(fromHex);
  const [r2, g2, b2] = parseHexColor(toHex);

  const r = Math.round(Math.max(0, Math.min(255, r1 + (r2 - r1) * eased)));
  const g = Math.round(Math.max(0, Math.min(255, g1 + (g2 - g1) * eased)));
  const b = Math.round(Math.max(0, Math.min(255, b1 + (b2 - b1) * eased)));

  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}
