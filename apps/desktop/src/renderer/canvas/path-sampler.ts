export interface PathPoint {
  x: number;
  y: number;
}

export interface SampledPath {
  points: PathPoint[];
  totalLength: number;
}

// Memory cache for sampled paths to prevent recalculating points on every animation frame
const pathCache = new Map<string, SampledPath>();

/**
 * Sample equidistant points along an SVG path data string ("d" attribute).
 * Uses native browser SVGPathElement.getPointAtLength for hardware-accelerated precision.
 */
export function sampleSvgPath(d: string, sampleCount = 120): SampledPath {
  const cached = pathCache.get(trimmed);
  if (cached) {
    return cached;
  }

  // Safety fallback for headless/test environments without DOM SVG support
  if (typeof document === 'undefined' || !document.createElementNS) {
    const fallback = parseSimpleSvgPoints(trimmed);
    pathCache.set(trimmed, fallback);
    return fallback;
  }

  try {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', trimmed);
    const totalLength = path.getTotalLength() || 0;

    if (totalLength <= 0) {
      const empty = { points: [], totalLength: 0 };
      pathCache.set(trimmed, empty);
      return empty;
    }

    const points: PathPoint[] = [];
    const count = Math.max(10, sampleCount);

    for (let i = 0; i <= count; i++) {
      const distance = (i / count) * totalLength;
      const pt = path.getPointAtLength(distance);
      points.push({ x: pt.x, y: pt.y });
    }

    const result: SampledPath = { points, totalLength };
    pathCache.set(trimmed, result);
    return result;
  } catch {
    // If SVG parsing fails (e.g. malformed path string), fallback gracefully
    const fallback = parseSimpleSvgPoints(trimmed);
    pathCache.set(trimmed, fallback);
    return fallback;
  }
}

/**
 * Fallback parser for basic SVG paths when SVGPathElement is not available (e.g. in test runners).
 */
export function parseSimpleSvgPoints(d: string): SampledPath {
  const points: PathPoint[] = [];
  const numbers = d
    .replace(/[a-zA-Z]/g, ' ')
    .trim()
    .split(/[\s,]+/)
    .map(Number)
    .filter((n) => !isNaN(n));

  for (let i = 0; i < numbers.length - 1; i += 2) {
    const x = numbers[i];
    const y = numbers[i + 1];
    if (x !== undefined && y !== undefined) {
      points.push({ x, y });
    }
  }

  let totalLength = 0;
  for (let i = 1; i < points.length; i++) {
    const p1 = points[i - 1];
    const p2 = points[i];
    if (p1 && p2) {
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      totalLength += Math.sqrt(dx * dx + dy * dy);
    }
  }

  return { points, totalLength };
}

/**
 * Clear the SVG path sample cache.
 */
export function clearPathCache(): void {
  pathCache.clear();
}
