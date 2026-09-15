import { describe, it, expect } from 'vitest';
import { interpolateLayerProperties } from '../interpolator';
import type { MotionLayer } from '@genc/motion-schema';

describe('Layer Property Interpolator (@genc/desktop/canvas/interpolator) - v1.1 Normalized Time', () => {
  const animatedShapeLayer: MotionLayer = {
    id: 'box-pulse',
    type: 'shape',
    shape: 'rect',
    properties: {
      x: 100,
      y: 200,
      width: 50,
      height: 50,
      fill: '#000000',
      opacity: 1,
      rotation: 0,
    },
    keyframes: [
      {
        t: 0.0,
        props: { x: 100, opacity: 1, rotation: 0, fill: '#000000' },
      },
      {
        t: 0.5,
        props: { x: 300, opacity: 0.5, rotation: 90, fill: '#FFFFFF' },
        easing: 'linear',
      },
      {
        t: 1.0,
        props: { x: 100, opacity: 1, rotation: 180, fill: '#000000' },
        easing: 'linear',
      },
    ],
  };

  const backgroundLayer: MotionLayer = {
    id: 'background',
    type: 'shape',
    shape: 'rect',
    properties: {
      x: 0,
      y: 0,
      width: 1080,
      height: 1080,
      fill: '#101010',
      opacity: 1,
    },
    keyframes: [
      {
        t: 0.0,
        props: { opacity: 1, fill: '#101010' },
      },
      {
        t: 1.0,
        props: { opacity: 0.2, fill: '#505050' },
        easing: 'linear',
      },
    ],
  };

  it('evaluates properties exactly at t=0', () => {
    const props = interpolateLayerProperties(animatedShapeLayer, 0.0);
    expect(props.x).toBe(100);
    expect(props.opacity).toBe(1);
    expect(props.rotation).toBe(0);
    expect(props.fill?.toLowerCase()).toBe('#000000');
  });

  it('interpolates intermediate values at quarter-progress t=0.25', () => {
    const props = interpolateLayerProperties(animatedShapeLayer, 0.25);
    // Between t=0.0 (x:100, opacity:1) and t=0.5 (x:300, opacity:0.5)
    expect(props.x).toBe(200);
    expect(props.opacity).toBeCloseTo(0.75, 2);
    expect(props.rotation).toBe(45);
    expect(props.fill?.toLowerCase()).toBe('#808080');
  });

  it('evaluates properties exactly at t=0.5 (second keyframe)', () => {
    const props = interpolateLayerProperties(animatedShapeLayer, 0.5);
    expect(props.x).toBe(300);
    expect(props.opacity).toBe(0.5);
    expect(props.rotation).toBe(90);
    expect(props.fill?.toLowerCase()).toBe('#ffffff');
  });

  it('clamps to final keyframe when t >= 1.0', () => {
    const propsAt1 = interpolateLayerProperties(animatedShapeLayer, 1.0);
    const propsPast1 = interpolateLayerProperties(animatedShapeLayer, 1.5);

    expect(propsAt1.x).toBe(100);
    expect(propsAt1.rotation).toBe(180);

    expect(propsPast1.x).toBe(100);
    expect(propsPast1.rotation).toBe(180);
    expect(propsPast1.opacity).toBe(1);
  });

  it('freezes background layer at t=0 when backgroundAnimations is false', () => {
    // When backgroundAnimations is false, background layer stays at t=0
    const frozenProps = interpolateLayerProperties(backgroundLayer, 0.5, {
      backgroundAnimations: false,
    });
    expect(frozenProps.opacity).toBe(1);
    expect(frozenProps.fill?.toLowerCase()).toBe('#101010');

    // When backgroundAnimations is true, background layer animates
    const animatedProps = interpolateLayerProperties(backgroundLayer, 0.5, {
      backgroundAnimations: true,
    });
    expect(animatedProps.opacity).toBeCloseTo(0.6, 2);
  });

  it('does not freeze non-background layers when backgroundAnimations is false', () => {
    const props = interpolateLayerProperties(animatedShapeLayer, 0.25, {
      backgroundAnimations: false,
    });
    expect(props.x).toBe(200);
    expect(props.rotation).toBe(45);
  });

  it('handles layer with no keyframes by returning base properties', () => {
    const staticLayer: MotionLayer = {
      id: 'static-circle',
      type: 'shape',
      shape: 'circle',
      properties: { cx: 500, cy: 500, radius: 40, fill: '#FF5500' },
      keyframes: [],
    };

    const props = interpolateLayerProperties(staticLayer, 0.5);
    expect(props.cx).toBe(500);
    expect(props.cy).toBe(500);
    expect(props.radius).toBe(40);
    expect(props.fill).toBe('#FF5500');
  });
});
