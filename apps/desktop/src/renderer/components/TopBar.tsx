import { useEffect } from 'react';
import { useApiKeyStore } from '../store/apiKeyStore';
import { useGenerationStore } from '../store/generationStore';
import { useSandboxStore } from '../store/sandboxStore';

/**
 * TopBar — App branding, API key status counter, update check, tour, lite mode, theme toggle.
 */
export function TopBar() {
  const { poolStatus, openModal, loadKeys } = useApiKeyStore();
  const {
    selectedModel,
    customModel,
    thinkingLevel,
    setSelectedModel,
    setCustomModel,
    setThinkingLevel,
  } = useGenerationStore();

  useEffect(() => {
    loadKeys();
  }, [loadKeys]);

  const badgeClass =
    poolStatus.total === 0
      ? 'badge badge-gold'
      : poolStatus.valid > 0
        ? 'badge badge-green'
        : 'badge bg-red-950/60 text-red-400 border border-red-500/30';

  return (
    <header className="flex items-center justify-between px-4 py-2 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)]">
      {/* Left: API Key Status */}
      <div className="flex flex-col gap-1">
        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={openModal}
          title="Kelola Gemini API Keys"
        >
          <span className="badge badge-gold">GEMINI API KEYS</span>
          <span className={badgeClass}>
            {poolStatus.valid}/{poolStatus.total}
          </span>
        </div>
        <button
          onClick={openModal}
          className="flex items-center gap-1.5 text-[11px] text-[var(--color-accent-ai)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer bg-transparent border-none font-semibold text-left p-0"
        >
          <span>🔑</span>
          <span>MASUKAN API</span>
        </button>
      </div>

      {/* Center: Branding */}
      <div className="flex flex-col items-center gap-0.5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--color-accent-ai)] to-[var(--color-btn-primary-from)] flex items-center justify-center text-white font-bold text-sm shadow-lg">
            GC
          </div>
          <div>
            <h1 className="text-lg font-extrabold tracking-wide text-[var(--color-text-primary)] font-[var(--font-display)] m-0 leading-tight">
              GEN (C) MOTION GENERATOR
            </h1>
            <p className="text-[10px] tracking-[0.25em] text-[var(--color-text-accent)] uppercase m-0">
              Motion Graphics Real Time
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-1">
          <span className="flex items-center gap-1 text-[10px] text-[var(--color-accent-green)] cursor-pointer hover:text-[var(--color-text-primary)] transition-colors">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent-green)] inline-block" />
            CHECK FOR UPDATE
          </span>
          <button className="badge badge-green cursor-pointer hover:brightness-110 transition-all border-none text-[10px]">
            ✦ TOUR
          </button>
          <button className="badge badge-gold cursor-pointer hover:brightness-110 transition-all border-none text-[10px]">
            ✦ LITE MODE
          </button>
          {/* Day/Night Toggle */}
          <div className="flex items-center gap-1.5">
            <span className="text-[12px]">☀️</span>
            <div className="toggle-switch active" style={{ width: 36, height: 18 }}>
              <div
                className="absolute top-[1px] left-[1px] w-[14px] h-[14px] rounded-full bg-white shadow transition-transform"
                style={{ transform: 'translateX(18px)' }}
              />
            </div>
            <span className="text-[12px]">🌙</span>
          </div>

          {/* Dev-Only Sandbox Playground Trigger */}
          {import.meta.env.DEV && (
            <button
              id="btn-open-sandbox"
              onClick={useSandboxStore.getState().openModal}
              className="badge bg-purple-900/90 text-purple-200 border border-purple-500/60 hover:bg-purple-800 cursor-pointer text-[10px] flex items-center gap-1 font-mono transition-all ml-1 shadow-sm"
              title="Buka Canvas2D Sandbox Playground (v2.0 Dev-Only)"
            >
              <span>🧪</span>
              <span>SANDBOX</span>
            </button>
          )}
        </div>
      </div>

      {/* Right: Models & Thinking Level */}
      <div className="flex flex-col gap-1.5 items-end min-w-[200px]">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold">
            Models
          </span>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="select-dark text-[11px] py-1 px-2 min-w-[110px]"
          >
            <option value="Gemi 3.6F">Gemi 3.6F</option>
            <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
            <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
            <option value="Custom">Custom</option>
          </select>
          {selectedModel === 'Custom' ? (
            <input
              type="text"
              placeholder="e.g. gemini-2.5-pro"
              value={customModel}
              onChange={(e) => setCustomModel(e.target.value)}
              className="input-dark text-[11px] py-0.5 px-1.5 w-28"
            />
          ) : (
            <button
              onClick={() => setSelectedModel('Custom')}
              className="text-[10px] text-[var(--color-text-accent)] cursor-pointer hover:text-[var(--color-text-primary)] transition-colors font-semibold uppercase bg-transparent border-none p-0"
            >
              Custom
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold">
            Thinking Level
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setThinkingLevel('low')}
              className={`chip text-[10px] py-0.5 px-2.5 ${thinkingLevel === 'low' ? 'active' : ''}`}
            >
              Low
            </button>
            <button
              onClick={() => setThinkingLevel('medium')}
              className={`chip text-[10px] py-0.5 px-2.5 ${thinkingLevel === 'medium' ? 'active' : ''}`}
            >
              Medium
            </button>
            <button
              onClick={() => setThinkingLevel('high')}
              className={`chip text-[10px] py-0.5 px-2.5 ${thinkingLevel === 'high' ? 'active' : ''}`}
            >
              High
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
