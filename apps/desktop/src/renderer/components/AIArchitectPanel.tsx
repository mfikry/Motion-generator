import { useGenerationStore } from '../store/generationStore';
import { useRenderSettingsStore } from '../store/renderSettingsStore';

const PROMPT_PRESETS = [
  {
    label: '✨ Neon Particles',
    prompt: 'neon particles',
  },
  {
    label: '🔄 Rotating Rings',
    prompt: 'rotating rings',
  },
  {
    label: '📈 Grafik Tren Naik',
    prompt: 'grafik tren naik',
  },
  {
    label: '📊 Bar Chart',
    prompt: 'grafik batang pertumbuhan',
  },
];

/**
 * AIArchitectPanel — Left column:
 * Text / Image mode toggle, prompt input, presets, variations, batch size,
 * dynamic Total Tasks counter, and Generate execution.
 */
export function AIArchitectPanel() {
  const {
    mode,
    prompt,
    variations,
    batchSize,
    isGenerating,
    statusMessage,
    error,
    retriesUsed,
    setMode,
    setPrompt,
    setVariations,
    setBatchSize,
    clearError,
    generate,
  } = useGenerationStore();

  const totalTasks = variations * batchSize;

  const handleGenerate = () => {
    const settings = useRenderSettingsStore.getState();
    generate({
      noText: settings.noText,
      greenScreen: settings.greenScreen,
      rulesLevel: settings.rulesLevel,
      introOutro: settings.introOutro,
      backgroundColor: settings.colorsBg,
      aspectRatio: settings.aspectRatio,
    });
  };

  return (
    <aside className="flex flex-col gap-3 p-3 h-full overflow-y-auto">
      {/* Section Header */}
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[var(--color-accent-ai)] text-base">⚡</span>
        <h2 className="section-header text-[var(--color-text-primary)] m-0 text-sm">
          AI ARCHITECT
        </h2>
      </div>

      {/* Text / Image Mode Tabs */}
      <div className="flex rounded-lg overflow-hidden border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)]">
        <button
          onClick={() => setMode('text')}
          className={`flex-1 py-2 px-3 text-[11px] font-semibold uppercase tracking-wider border-none cursor-pointer flex items-center justify-center gap-1.5 transition-all ${
            mode === 'text'
              ? 'bg-gradient-to-r from-[var(--color-btn-primary-from)] to-[var(--color-btn-primary-to)] text-white shadow-md'
              : 'bg-transparent text-[var(--color-text-secondary)] hover:text-white'
          }`}
        >
          <span className="text-[13px]">📄</span> Text
        </button>
        <button
          onClick={() => setMode('image')}
          className={`flex-1 py-2 px-3 text-[11px] font-semibold uppercase tracking-wider border-none cursor-pointer flex items-center justify-center gap-1.5 transition-all ${
            mode === 'image'
              ? 'bg-gradient-to-r from-[var(--color-btn-primary-from)] to-[var(--color-btn-primary-to)] text-white shadow-md'
              : 'bg-transparent text-[var(--color-text-secondary)] hover:text-white'
          }`}
        >
          <span className="text-[13px]">🖼️</span> Image
        </button>
      </div>

      {/* Mode Content */}
      {mode === 'text' ? (
        <div className="flex flex-col gap-2.5">
          {/* Prompt Input */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                Prompt Tema Singkat
              </label>
              <span className="text-[10px] text-[var(--color-text-muted)] font-mono">
                {prompt.length} chars
              </span>
            </div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ketik tema singkat... mis: neon particles, rotating rings, grafik tren naik"
              rows={4}
              disabled={isGenerating}
              className="input-dark w-full resize-none text-xs leading-relaxed font-sans placeholder:text-gray-500 focus:border-[var(--color-accent-ai)]"
            />
          </div>

          {/* Quick Preset Chips */}
          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
              Contoh Prompt:
            </span>
            <div className="flex flex-wrap gap-1">
              {PROMPT_PRESETS.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setPrompt(preset.prompt)}
                  disabled={isGenerating}
                  className="chip text-[10px] py-1 px-2 text-left truncate max-w-full hover:border-[var(--color-accent-ai)]"
                  title={preset.prompt}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Image Mode (Drop Zone stub for E5) */
        <div className="glass-card flex flex-col items-center justify-center py-8 px-4 border-2 border-dashed border-[var(--color-border-accent)] cursor-pointer hover:border-[var(--color-accent-ai)] transition-colors group">
          <div className="w-12 h-12 rounded-lg bg-[var(--color-accent-ai-dim)] flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
            <span className="text-2xl">🏞️</span>
          </div>
          <p className="text-[12px] text-[var(--color-text-primary)] font-semibold m-0">
            Click or Drag Images Here
          </p>
          <p className="text-[10px] text-[var(--color-text-muted)] m-0 mt-1">
            Max 5 images · JPG, PNG, WEBP (Fase E5)
          </p>
        </div>
      )}

      {/* Generate Count (Variations 1-5) */}
      <div className="flex items-center justify-between mt-1">
        <span className="text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
          Variations:
        </span>
        <span className="text-[11px] text-[var(--color-accent-ai)] font-semibold">
          Total: {totalTasks} {totalTasks === 1 ? 'Task' : 'Tasks'}
        </span>
      </div>
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setVariations(n)}
            disabled={isGenerating}
            className={`num-select ${variations === n ? 'active' : ''}`}
          >
            {n}
          </button>
        ))}
      </div>

      {/* Batch Size */}
      <div className="flex items-center justify-between mt-1">
        <span className="text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
          Batch Size:
        </span>
        <div className="flex gap-1.5">
          {[1, 2, 3, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setBatchSize(n)}
              disabled={isGenerating}
              className={`num-select ${batchSize === n ? 'active' : ''}`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 mt-2">
        <button
          onClick={handleGenerate}
          disabled={isGenerating || !prompt.trim()}
          className="btn-neon btn-generate flex-1 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold py-2.5"
        >
          {isGenerating ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin inline-block" />
              <span>Generating...</span>
            </>
          ) : (
            <>
              <span>⚡</span>
              <span>Generate ({totalTasks})</span>
            </>
          )}
        </button>
      </div>

      {/* Status or Error Notifications */}
      {error && (
        <div className="p-2.5 rounded-lg bg-red-950/70 border border-red-500/40 text-red-200 text-xs flex flex-col gap-1 animate-slide-up">
          <div className="flex items-center justify-between">
            <span className="font-bold flex items-center gap-1">
              <span>⚠️</span> Gagal Generate
            </span>
            <button
              onClick={clearError}
              className="text-red-400 hover:text-white bg-transparent border-none cursor-pointer font-bold p-0"
            >
              ✕
            </button>
          </div>
          <p className="text-[11px] m-0 text-red-300 leading-snug whitespace-pre-wrap">{error}</p>
        </div>
      )}

      {statusMessage && !error && (
        <div className="p-2.5 rounded-lg bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-[11px] flex items-center gap-1.5 animate-slide-up">
          <span>✓</span>
          <span>{statusMessage}</span>
          {retriesUsed > 0 && (
            <span className="badge badge-gold text-[9px] py-0 px-1 ml-auto">
              {retriesUsed}x retry
            </span>
          )}
        </div>
      )}

      {/* Project Tabs T1/T2 */}
      <div className="flex gap-2 mt-auto pt-2 border-t border-[var(--color-border-subtle)]">
        <button className="px-4 py-1.5 rounded-full text-[11px] font-bold bg-gradient-to-r from-[var(--color-accent-preview)] to-blue-500 text-white border-none cursor-pointer shadow-md">
          T1
        </button>
        <button className="px-4 py-1.5 rounded-full text-[11px] font-bold bg-transparent text-[var(--color-text-muted)] border border-[var(--color-border-subtle)] cursor-pointer hover:border-[var(--color-border-accent)] hover:text-[var(--color-text-primary)] transition-colors">
          T2
        </button>
      </div>
    </aside>
  );
}
