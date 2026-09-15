import type { MotionLayer } from '@genc/motion-schema';
import type { SampledPath } from './path-sampler';

/**
 * Calculate the geometric rotation & scaling pivot for any layer.
 * Ensures rotation and scaling happen strictly around the object's own geometric center,
 * rather than the canvas origin (0, 0).
 */
export function calculateLayerPivot(
  layer: MotionLayer,
  props: Record<string, unknown>,
  sampledPath?: SampledPath,
): { pivotX: number; pivotY: number } {
  // If pivot is explicitly given in props
  if (typeof props.pivotX === 'number' && typeof props.pivotY === 'number') {
    return { pivotX: props.pivotX, pivotY: props.pivotY };
  }

  if (layer.type === 'shape') {
    const shape = (layer.shape || 'rect').toLowerCase();
    const x = Number(props.x ?? 0);
    const y = Number(props.y ?? 0);

    if (shape === 'circle' || shape === 'star' || shape === 'polygon') {
      return { pivotX: x, pivotY: y };
    }
    // rect or rectangle: center is (x + width / 2, y + height / 2)
    const width = Number(props.width ?? props.w ?? 100);
    const height = Number(props.height ?? props.h ?? 100);
    return { pivotX: x + width / 2, pivotY: y + height / 2 };
  }

  if (layer.type === 'path') {
    if (typeof props.x === 'number' && typeof props.y === 'number') {
      return { pivotX: props.x, pivotY: props.y };
    }
    if (typeof props.cx === 'number' && typeof props.cy === 'number') {
      return { pivotX: props.cx, pivotY: props.cy };
    }
    if (sampledPath && sampledPath.points.length > 0) {
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      for (const p of sampledPath.points) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
      if (minX !== Infinity) {
        return {
          pivotX: (minX + maxX) / 2,
          pivotY: (minY + maxY) / 2,
        };
      }
    }
    return { pivotX: 0, pivotY: 0 };
  }

  if (layer.type === 'particle-system') {
    const area = props.area as { x?: number; y?: number; width?: number; height?: number } | undefined;
    if (area && typeof area.x === 'number' && typeof area.width === 'number') {
      return {
        pivotX: area.x + area.width / 2,
        pivotY: (area.y ?? 0) + (area.height ?? 0) / 2,
      };
    }
  }

  const x = Number(props.x ?? 0);
  const y = Number(props.y ?? 0);
  return { pivotX: x, pivotY: y };
}
