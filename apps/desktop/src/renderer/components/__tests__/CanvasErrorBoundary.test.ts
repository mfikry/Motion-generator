import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { CanvasErrorBoundary } from '../CanvasErrorBoundary';

describe('CanvasErrorBoundary (@genc/desktop/components/CanvasErrorBoundary)', () => {
  it('initializes with hasError: false and error: null', () => {
    const boundary = new CanvasErrorBoundary({ children: 'Child Content' });
    expect(boundary.state.hasError).toBe(false);
    expect(boundary.state.error).toBeNull();
  });

  it('updates state to hasError: true on getDerivedStateFromError', () => {
    const error = new Error('PixiJS WebGL initialization failed');
    const newState = CanvasErrorBoundary.getDerivedStateFromError(error);

    expect(newState.hasError).toBe(true);
    expect(newState.error).toBe(error);
  });

  it('triggers onReset callback when handleReset is invoked', () => {
    const onReset = vi.fn();
    const boundary = new CanvasErrorBoundary({ children: null, onReset });
    (
      boundary as unknown as {
        updater: { enqueueSetState: (inst: unknown, partialState: unknown) => void };
      }
    ).updater = {
      enqueueSetState: (_inst: unknown, partialState: unknown) => {
        boundary.state = { ...boundary.state, ...(partialState as object) };
      },
    };

    boundary.handleReset();
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(boundary.state.hasError).toBe(false);
  });

  it('renders children when hasError is false', () => {
    const child = React.createElement('div', { id: 'test-child' }, 'Canvas Running');
    const boundary = new CanvasErrorBoundary({ children: child });

    const rendered = boundary.render();
    expect(rendered).toBe(child);
  });

  it('renders error card UI when hasError is true', () => {
    const boundary = new CanvasErrorBoundary({ children: 'Child' });
    boundary.state = {
      hasError: true,
      error: new Error('ReferenceError: trimmed is not defined'),
    };

    const rendered = boundary.render();
    expect(rendered).toBeDefined();
    // Verify it returned a React element for the error fallback
    expect(React.isValidElement(rendered)).toBe(true);
  });
});
