import { TopBar } from './components/TopBar';
import { AIArchitectPanel } from './components/AIArchitectPanel';
import { PreviewSuite } from './components/PreviewSuite';
import { NeuralEngine } from './components/NeuralEngine';
import { RenderSettingsPanel } from './components/RenderSettingsPanel';

/**
 * App — Main layout component.
 * 3-column layout: AI Architect (left) | Preview Suite + Neural Engine (center) | Render Settings (right)
 * Dark purple theme matching the GEN(C) EMAS V18 reference screenshot.
 */
export function App() {
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
    </div>
  );
}
