import { useEffect } from 'react';
import { TopBar } from './components/TopBar';
import { AIArchitectPanel } from './components/AIArchitectPanel';
import { PreviewSuite } from './components/PreviewSuite';
import { NeuralEngine } from './components/NeuralEngine';
import { RenderSettingsPanel } from './components/RenderSettingsPanel';
import { ApiKeyModal } from './components/ApiKeyModal';
import { SandboxPlaygroundModal } from './components/SandboxPlaygroundModal';
import { useGenerationStore } from './store/generationStore';
import type { MotionBlueprint } from '@genc/shared-types';

/**
 * App — Main layout component.
 * 3-column layout: AI Architect (left) | Preview Suite + Neural Engine (center) | Render Settings (right)
 * Dark purple theme matching the GEN(C) EMAS V18 reference screenshot.
 */
export function App() {
  // Demo blueprint loading via query parameter in DEV mode for browser testing
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const params = new URLSearchParams(window.location.search);
    const demo = params.get('demo');

    if (demo === 'path') {
      useGenerationStore.getState().setCurrentBlueprint({
        blueprintId: 'demo-trend-arrow',
        category: 'finance-trend-arrow',
        canvas: { width: 1080, height: 1080, background: 'transparent' },
        fps: 60,
        palette: ['#00E5FF', '#76FF03', '#FFD600'],
        loop: { seamless: true },
        rulesLevel: 'high',
        introOutro: false,
        noText: true,
        layers: [
          {
            id: 'background-grid',
            type: 'shape',
            shape: 'rect',
            properties: { x: 0, y: 0, width: 1080, height: 1080, fill: '#140f26', opacity: 1 },
            keyframes: [{ t: 0.0, props: { opacity: 1 } }],
          },
          {
            id: 'trend-line-path',
            type: 'path',
            properties: {
              path: 'M 100 850 L 320 620 L 500 700 L 720 400 L 980 200',
              stroke: '#00E5FF',
              strokeWidth: 12,
              pathProgress: 0.75,
            },
            keyframes: [
              { t: 0.0, props: { pathProgress: 0.75 } },
              { t: 0.5, props: { pathProgress: 1.0 }, easing: 'easeInOutCubic' },
              { t: 1.0, props: { pathProgress: 0.75 }, easing: 'easeInOutCubic' },
            ],
          },
        ],
      });
    } else if (demo === 'corrupted') {
      useGenerationStore.getState().setCurrentBlueprint({
        blueprintId: 'demo-corrupted',
        category: 'corrupted',
        canvas: { width: 1080, height: 1080, background: 'transparent' },
        fps: 60,
        palette: ['#FF0000'],
        loop: { seamless: false },
        rulesLevel: 'simple',
        introOutro: false,
        noText: true,
        layers: [
          {
            id: 'corrupted-layer',
            type: 'shape',
            shape: 'rect',
            get properties() {
              throw new Error('Simulated intentional corrupted blueprint property crash');
            },
            keyframes: [],
          },
        ],
      } as unknown as MotionBlueprint);
    } else if (demo === 'particles') {
      useGenerationStore.getState().setCurrentBlueprint({
        blueprintId: 'demo-neon-particles',
        category: 'neon-particles',
        canvas: { width: 1080, height: 1080, background: '#0a0518' },
        fps: 60,
        palette: ['#00E5FF', '#D500F9', '#FFD600', '#FFFFFF'],
        loop: { seamless: true },
        rulesLevel: 'high',
        introOutro: false,
        noText: true,
        layers: [
          {
            id: 'floating-particles',
            type: 'particle-system',
            properties: {
              count: 80,
              area: { x: 0, y: 0, width: 1080, height: 1080 },
              sizeRange: [3, 8],
              colorPalette: ['#00E5FF', '#D500F9', '#FFD600', '#FFFFFF'],
              motionPattern: 'float-up-wrap',
              speedRange: [1, 2],
              seed: 42,
            },
          },
        ],
      });
    }
  }, []);
  return (
    <div className="flex flex-col h-screen w-screen bg-[var(--color-bg-base)] overflow-hidden">
      {/* Top Bar */}
      <TopBar />

      {/* Main Content: 3 columns */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left Column — AI Architect */}
        <div
          className="flex-shrink-0 border-r border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] overflow-hidden"
          style={{ width: 280 }}
        >
          <AIArchitectPanel />
        </div>

        {/* Center Column — Preview Suite + Neural Engine */}
        <div className="flex-1 flex flex-col min-w-0 bg-[var(--color-bg-base)]">
          <div className="flex-1 min-h-0">
            <PreviewSuite />
          </div>
          <NeuralEngine />
        </div>

        {/* Right Column — Render Settings */}
        <div
          className="flex-shrink-0 border-l border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] overflow-hidden"
          style={{ width: 260 }}
        >
          <RenderSettingsPanel />
        </div>
      </div>

      {/* API Key Management Modal */}
      <ApiKeyModal />

      {/* Dev-Only Canvas2D Sandbox Playground */}
      <SandboxPlaygroundModal />
    </div>
  );
}
