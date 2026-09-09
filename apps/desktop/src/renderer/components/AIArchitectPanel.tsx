/**
 * AIArchitectPanel — Left column: Text/Image mode, image drop zone,
 * preset categories, generate count, batch size, Generate/Open buttons, T1/T2 tabs.
 * Visual shell only — no functional logic.
 */
export function AIArchitectPanel() {
  return (
    <aside className="flex flex-col gap-3 p-3 h-full overflow-y-auto">
      {/* Section Header */}
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[var(--color-accent-ai)] text-base">⚡</span>
        <h2 className="section-header text-[var(--color-text-primary)] m-0 text-sm">AI ARCHITECT</h2>
      </div>

      {/* Text / Image Mode Tabs */}
      <div className="flex rounded-lg overflow-hidden border border-[var(--color-border-subtle)]">
        <button className="flex-1 py-2 px-4 text-[11px] font-semibold uppercase tracking-wider bg-transparent text-[var(--color-text-secondary)] border-none cursor-pointer hover:bg-[var(--color-bg-elevated)] transition-colors flex items-center justify-center gap-1.5">
          <span className="text-[13px]">📄</span> Text
        </button>
        <button className="flex-1 py-2 px-4 text-[11px] font-semibold uppercase tracking-wider bg-gradient-to-r from-[var(--color-btn-primary-from)] to-[var(--color-btn-primary-to)] text-white border-none cursor-pointer flex items-center justify-center gap-1.5 shadow-md">
          <span className="text-[13px]">🖼️</span> Image
        </button>
      </div>

      {/* Image Drop Zone */}
      <div className="glass-card flex flex-col items-center justify-center py-8 px-4 border-2 border-dashed border-[var(--color-border-accent)] cursor-pointer hover:border-[var(--color-accent-ai)] transition-colors group">
        <div className="w-12 h-12 rounded-lg bg-[var(--color-accent-ai-dim)] flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
          <span className="text-2xl">🏞️</span>
        </div>
        <p className="text-[12px] text-[var(--color-text-primary)] font-semibold m-0">
          Click or Drag Images Here
        </p>
        <p className="text-[10px] text-[var(--color-text-muted)] m-0 mt-1">
          Max 5 images · JPG, PNG, WEBP
        </p>
      </div>

      {/* Preset Category Icon */}
      <div className="flex items-center justify-between">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-[var(--color-border-subtle)] flex items-center justify-center cursor-pointer hover:border-[var(--color-border-accent)] transition-colors">
          <span className="text-lg">📊</span>
        </div>
        <span className="text-[10px] text-[var(--color-text-muted)]">1/5 Images</span>
      </div>

      {/* Generate Count */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Generate:</span>
        <span className="text-[11px] text-[var(--color-accent-ai)] font-semibold">Total: 2 Tasks</span>
      </div>
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            className={`num-select ${n === 2 ? 'active' : ''}`}
          >
            {n}
          </button>
        ))}
      </div>

      {/* Batch Size */}
      <div className="flex items-center justify-between mt-1">
        <span className="text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Batch Size:</span>
        <div className="flex gap-1.5">
          {[1, 5].map((n) => (
            <button
              key={n}
              className={`num-select ${n === 5 ? 'active' : ''}`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 mt-2">
        <button className="btn-neon btn-generate flex-1">Generate</button>
        <button className="btn-neon btn-primary flex-1">Open</button>
      </div>

      {/* Project Tabs T1/T2 */}
      <div className="flex gap-2 mt-1">
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
