import { describe, it, expect } from 'vitest';
import { calculateLayerPivot } from '../layer-pivot';
import type { MotionLayer } from '@genc/motion-schema';

describe('Rotation Pivot & Geometric In-Place Rotation (@genc/desktop/canvas/pixi-renderer)', () => {
  it('calculates correct geometric pivot for shapes: circle, star, polygon (center at x, y)', () => {
    const circleLayer: MotionLayer = {
      id: 'c1',
      type: 'shape',
      shape: 'circle',
      properties: { x: 500, y: 400, radius: 50 },
    };
    const circlePivot = calculateLayerPivot(circleLayer, circleLayer.properties);
    expect(circlePivot).toEqual({ pivotX: 500, pivotY: 400 });

    const starLayer: MotionLayer = {
      id: 's1',
      type: 'shape',
      shape: 'star',
      properties: { x: 600, y: 700, radius: 80 },
    };
    const starPivot = calculateLayerPivot(starLayer, starLayer.properties);
    expect(starPivot).toEqual({ pivotX: 600, pivotY: 700 });

    const polyLayer: MotionLayer = {
      id: 'p1',
      type: 'shape',
      shape: 'polygon',
      properties: { x: 350, y: 250, sides: 6, radius: 60 },
    };
    const polyPivot = calculateLayerPivot(polyLayer, polyLayer.properties);
    expect(polyPivot).toEqual({ pivotX: 350, pivotY: 250 });
  });

  it('calculates correct geometric pivot for rect: center at (x + width / 2, y + height / 2)', () => {
    const rectLayer: MotionLayer = {
      id: 'r1',
      type: 'shape',
      shape: 'rect',
      properties: { x: 200, y: 300, width: 120, height: 80 },
    };
    const rectPivot = calculateLayerPivot(rectLayer, rectLayer.properties);
    expect(rectPivot).toEqual({ pivotX: 260, pivotY: 340 });
  });

  it('calculates correct geometric pivot for path from sampledPath bounding box centroid', () => {
    const pathLayer: MotionLayer = {
      id: 'path1',
      type: 'path',
      properties: {},
    };
    const sampledPath = {
      points: [
        { x: 100, y: 200 },
        { x: 300, y: 200 },
        { x: 300, y: 400 },
        { x: 100, y: 400 },
      ],
      totalLength: 800,
    };
    const pathPivot = calculateLayerPivot(pathLayer, pathLayer.properties, sampledPath);
    expect(pathPivot).toEqual({ pivotX: 200, pivotY: 300 });
  });

  /**
   * Transformation Math Helper:
   * Transform a local coordinate (lx, ly) through a container with position (posX, posY),
   * pivot (pX, pY), and rotation angle theta (radians).
   *
   * Formally in 2D affine coordinates:
   * parentPos = position + R(theta) * (localPos - pivot)
   */
  function transformPoint(
    localPoint: { x: number; y: number },
    pivot: { x: number; y: number },
    position: { x: number; y: number },
    thetaRad: number,
  ): { x: number; y: number } {
    const dx = localPoint.x - pivot.x;
    const dy = localPoint.y - pivot.y;
    const rotX = dx * Math.cos(thetaRad) - dy * Math.sin(thetaRad);
    const rotY = dx * Math.sin(thetaRad) + dy * Math.cos(thetaRad);
    return {
      x: position.x + rotX,
      y: position.y + rotY,
    };
  }

  it('verifies that a shape with rotation 0 -> 360 remains at the exact same (x, y) throughout animation', () => {
    const layer: MotionLayer = {
      id: 'rotating-circle',
      type: 'shape',
      shape: 'circle',
      properties: { x: 540, y: 480, radius: 70 },
      keyframes: [
        { t: 0.0, props: { rotation: 0 } },
        { t: 1.0, props: { rotation: 360 } },
      ],
    };

    const pivot = calculateLayerPivot(layer, layer.properties);
    const containerPosition = { x: pivot.pivotX, y: pivot.pivotY };
    const containerPivot = { x: pivot.pivotX, y: pivot.pivotY };

    // The center of the circle in local coordinates is (x, y) = (540, 480)
    const geometricCenterLocal = { x: 540, y: 480 };

    // Test across rotation angles: 0, 45, 90, 180, 270, 360 degrees
    const testAnglesDeg = [0, 45, 90, 135, 180, 225, 270, 315, 360];

    for (const deg of testAnglesDeg) {
      const rad = (deg * Math.PI) / 180;
      const worldCenter = transformPoint(
        geometricCenterLocal,
        containerPivot,
        containerPosition,
        rad,
      );

      // The center position MUST remain completely stationary at (540, 480)
      expect(worldCenter.x).toBeCloseTo(540, 5);
      expect(worldCenter.y).toBeCloseTo(480, 5);
    }
  });

  it('verifies that a rectangle with rotation 0 -> 360 maintains its center position in-place', () => {
    const layer: MotionLayer = {
      id: 'rotating-rect',
      type: 'shape',
      shape: 'rect',
      properties: { x: 300, y: 200, width: 200, height: 100 },
      keyframes: [
        { t: 0.0, props: { rotation: 0 } },
        { t: 1.0, props: { rotation: 360 } },
      ],
    };

    const pivot = calculateLayerPivot(layer, layer.properties);
    // Rectangle center: 300 + 200/2 = 400, 200 + 100/2 = 250
    expect(pivot).toEqual({ pivotX: 400, pivotY: 250 });

    const containerPosition = { x: pivot.pivotX, y: pivot.pivotY };
    const containerPivot = { x: pivot.pivotX, y: pivot.pivotY };
    const rectCenterLocal = { x: 400, y: 250 };

    for (let deg = 0; deg <= 360; deg += 30) {
      const rad = (deg * Math.PI) / 180;
      const worldCenter = transformPoint(
        rectCenterLocal,
        containerPivot,
        containerPosition,
        rad,
      );

      expect(worldCenter.x).toBeCloseTo(400, 5);
      expect(worldCenter.y).toBeCloseTo(250, 5);
    }
  });

  it('verifies that a path with rotation 0 -> 360 maintains its centroid in-place', () => {
    const pathLayer: MotionLayer = {
      id: 'rotating-swirl',
      type: 'path',
      properties: { x: 450, y: 550 },
      keyframes: [
        { t: 0.0, props: { rotation: 0 } },
        { t: 1.0, props: { rotation: 360 } },
      ],
    };

    const pivot = calculateLayerPivot(pathLayer, pathLayer.properties);
    expect(pivot).toEqual({ pivotX: 450, pivotY: 550 });

    const containerPosition = { x: pivot.pivotX, y: pivot.pivotY };
    const containerPivot = { x: pivot.pivotX, y: pivot.pivotY };
    const pathCenterLocal = { x: 450, y: 550 };

    for (let deg = 0; deg <= 360; deg += 45) {
      const rad = (deg * Math.PI) / 180;
      const worldCenter = transformPoint(
        pathCenterLocal,
        containerPivot,
        containerPosition,
        rad,
      );

      expect(worldCenter.x).toBeCloseTo(450, 5);
      expect(worldCenter.y).toBeCloseTo(550, 5);
    }
  });
});
