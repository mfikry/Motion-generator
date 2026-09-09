/**
 * PreviewSuite — Center column: Tab bar (Preview Suite, Render Batch, Tutorial),
 * canvas preview area, playback controls, status log.
 * Visual shell only — no functional logic.
 */
export function PreviewSuite() {
  return (
    <div className="flex flex-col gap-0 h-full">
      {/* Tab Bar */}
      <div className="flex items-center gap-4 px-4 py-2 border-b border-[var(--color-border-subtle)]">
        <button className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-accent-preview)] border-none bg-transparent cursor-pointer pb-1 border-b-2 border-b-[var(--color-accent-preview)]">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent-preview)] inline-block" />
          Preview Suite
        </button>
        <button className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] border-none bg-transparent cursor-pointer hover:text-[var(--color-text-secondary)] transition-colors">
          <span className="text-[10px]">📋</span>
          Render Batch
          <span className="badge badge-cyan text-[9px] py-0 px-1.5">0</span>
        </button>
        <button className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] border-none bg-transparent cursor-pointer hover:text-[var(--color-text-secondary)] transition-colors">
          <span className="text-[10px]">📖</span>
          Tutorial
        </button>
      </div>

      {/* Canvas Area */}
      <div className="flex-1 mx-4 mt-3 rounded-xl overflow-hidden border border-[var(--color-border-subtle)] bg-[#00B140] relative min-h-[280px]">
        {/* Green screen / chroma key placeholder */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-[var(--color-bg-base)] opacity-20 text-center">
            <p className="text-4xl font-bold m-0">PREVIEW</p>
            <p className="text-sm mt-1">Canvas will render here</p>
          </div>
        </div>
      </div>

      {/* Playback Controls */}
      <div className="flex items-center gap-3 px-4 py-2.5">
        {/* Time Display */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold">Time (s)</span>
          <span className="text-base font-bold text-[var(--color-text-primary)] font-[var(--font-mono)]">15</span>
        </div>

        {/* Play Button */}
        <button className="w-10 h-10 rounded-full border-2 border-[var(--color-accent-ai)] bg-transparent flex items-center justify-center cursor-pointer hover:bg-[var(--color-accent-ai-dim)] transition-colors group">
          <span className="text-[var(--color-accent-ai)] text-lg group-hover:scale-110 transition-transform">▶</span>
        </button>

        {/* Reset */}
        <button className="w-8 h-8 rounded-full bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] flex items-center justify-center cursor-pointer hover:border-[var(--color-border-accent)] transition-colors text-[var(--color-text-secondary)]">
          ↻
        </button>

        {/* Fullscreen */}
        <button className="w-8 h-8 rounded-full bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] flex items-center justify-center cursor-pointer hover:border-[var(--color-border-accent)] transition-colors text-[var(--color-text-secondary)] text-xs">
          ⛶
        </button>

        {/* Scrubber */}
        <div className="flex-1 h-1.5 bg-[var(--color-bg-elevated)] rounded-full relative overflow-hidden cursor-pointer">
          <div
            className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-[var(--color-accent-preview)] to-blue-500"
            style={{ width: '35%' }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-[var(--color-accent-preview)] shadow-lg border-2 border-white"
            style={{ left: '35%' }}
          />
        </div>
      </div>

      {/* Status Log */}
      <div className="mx-4 mb-3">
        <div className="status-log">
          <span className="text-[var(--color-accent-ai)]">[IMAGE]</span>{' '}
          <span className="text-[var(--color-accent-green)]">DONE!</span>{' '}
          <span className="text-[var(--color-text-secondary)]">2/2 ANIMATIONS GENERATED.</span>
        </div>
      </div>
    </div>
  );
}
