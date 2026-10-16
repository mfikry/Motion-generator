import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NeuralEngine } from '../NeuralEngine';
import { useRenderJobStore } from '../../store/renderJobStore';
import type { GpuDeviceInfo } from '@genc/shared-types';

describe('NeuralEngine Component — GPU Toggle & Race Condition Hardening', () => {
  beforeEach(() => {
    (useRenderJobStore as unknown as { getInitialState: () => unknown }).getInitialState = () =>
      useRenderJobStore.getState();
    useRenderJobStore.getState().reset();
    useRenderJobStore.setState({
      computeMode: 'cpu',
      gpuInfo: null,
      isDetectingGpu: false,
      fallbackWarning: null,
    });
  });

  it('renders default CPU compute mode without error', () => {
    const html = renderToStaticMarkup(React.createElement(NeuralEngine, { computeMode: 'cpu' }));
    expect(html).toContain('CPU Engine');
    expect(html).toContain('NEURAL ENGINE');
  });

  it('renders loading indicator "Mendeteksi GPU..." when GPU is selected while detecting', () => {
    const html = renderToStaticMarkup(
      React.createElement(NeuralEngine, {
        computeMode: 'gpu',
        isDetectingGpu: true,
        gpuInfo: null,
      })
    );
    expect(html).toContain('Mendeteksi GPU...');
    expect(html).not.toContain('undefined');
  });

  it('renders real GPU device name and encoders when GPU detection finishes', () => {
    const mockGpu: GpuDeviceInfo = {
      hasGpu: true,
      gpuName: 'AMD Radeon Graphics (AMF)',
      vendor: 'amd',
      supportedEncoders: ['h264_amf', 'h264_mf'],
      preferredH264Encoder: 'h264_amf',
      preferredHevcEncoder: 'hevc_amf',
    };

    const html = renderToStaticMarkup(
      React.createElement(NeuralEngine, {
        computeMode: 'gpu',
        isDetectingGpu: false,
        gpuInfo: mockGpu,
      })
    );
    expect(html).toContain('AMD Radeon Graphics (AMF)');
    expect(html).toContain('H264_AMF');
  });

  it('prevents TypeError regression when supportedEncoders is missing/undefined or empty', () => {
    // Exact bug scenario: gpuInfo present but supportedEncoders is undefined or empty
    const incompleteGpu = {
      hasGpu: true,
      gpuName: 'Generic GPU',
      vendor: 'unknown',
    } as unknown as GpuDeviceInfo;

    // Must NOT throw "Cannot read properties of undefined (reading 'join')"
    expect(() => {
      const html = renderToStaticMarkup(
        React.createElement(NeuralEngine, {
          computeMode: 'gpu',
          isDetectingGpu: false,
          gpuInfo: incompleteGpu,
        })
      );
      expect(html).toBeDefined();
    }).not.toThrow();
  });

  it('handles rapid toggle between CPU and GPU without crashing or race conditions', () => {
    const mockGpu: GpuDeviceInfo = {
      hasGpu: true,
      gpuName: 'NVIDIA RTX 4070 (NVENC)',
      vendor: 'nvidia',
      supportedEncoders: ['h264_nvenc'],
      preferredH264Encoder: 'h264_nvenc',
      preferredHevcEncoder: 'hevc_nvenc',
    };

    for (let i = 0; i < 50; i++) {
      const mode = i % 2 === 0 ? 'gpu' : 'cpu';
      expect(() => {
        renderToStaticMarkup(
          React.createElement(NeuralEngine, {
            computeMode: mode,
            isDetectingGpu: i < 5,
            gpuInfo: i > 2 ? mockGpu : null,
          })
        );
      }).not.toThrow();
    }
  });

  it('displays fallback warning notice banner cleanly when present', () => {
    const html = renderToStaticMarkup(
      React.createElement(NeuralEngine, {
        fallbackWarning: 'GPU encoder failed to initialize. Fell back to CPU (libopenh264).',
      })
    );
    expect(html).toContain('GPU encoder failed to initialize');
  });
});
