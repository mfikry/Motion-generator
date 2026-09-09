/**
 * RenderSettingsPanel — Right column: Time Anim, No Text, Background Animations,
 * Green Screen, Intro/Outro, Rules Animations, Colors BG, Easing Preset.
 * Visual shell only — no functional logic.
 */
export function RenderSettingsPanel() {
  return (
    <aside className="flex flex-col gap-3 p-3 h-full overflow-y-auto">
      {/* Section Header */}
      <h2 className="section-header text-[var(--color-text-primary)] text-center m-0 text-sm tracking-widest">
        RENDER SETTINGS
      </h2>

      {/* Time Anim */}
      <div className="glass-card p-3 flex flex-col items-center gap-1">
        <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-widest font-semibold">Time Anim (sec)</span>
        <span className="text-3xl font-extrabold text-[var(--color-text-primary)] font-[var(--font-display)]">15</span>
      </div>

      {/* No Text Toggle */}
      <div className="glass-card p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">🚫</span>
          <span className="text-[12px] font-bold text-[var(--color-text-primary)] uppercase tracking-wide">No Text</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold text-[var(--color-accent-green)]">ON</span>
          <div className="toggle-switch active" />
        </div>
      </div>

      {/* Background Animations Toggle */}
      <div className="glass-card p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">🎨</span>
          <span className="text-[11px] font-bold text-[var(--color-text-primary)] uppercase tracking-wide leading-tight">Background<br/>Animations</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold text-[var(--color-text-muted)]">OFF</span>
          <div className="toggle-switch" />
        </div>
      </div>

      {/* Green Screen Toggle */}
      <div className="glass-card p-3 flex items-center justify-between glow-ai" style={{ borderColor: 'rgba(34, 197, 94, 0.3)', boxShadow: '0 0 15px var(--color-glow-green)' }}>
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded bg-[#00B140] inline-block border border-[rgba(34,197,94,0.5)]" />
          <span className="text-[12px] font-bold text-[var(--color-text-primary)] uppercase tracking-wide">Green Screen</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold text-[var(--color-accent-green)]">ON</span>
          <div className="toggle-switch active" />
        </div>
      </div>

      {/* Intro/Outro Anim */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-widest font-semibold text-center">Intro/Outro Anim</span>
        <div className="flex rounded-lg overflow-hidden border border-[var(--color-border-subtle)]">
          <button className="flex-1 py-2 text-[11px] font-semibold uppercase tracking-wider bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] border-none cursor-pointer hover:text-[var(--color-text-primary)] transition-colors">
            Tidak
          </button>
          <button className="flex-1 py-2 text-[11px] font-semibold uppercase tracking-wider bg-gradient-to-r from-[var(--color-btn-primary-from)] to-[var(--color-btn-primary-to)] text-white border-none cursor-pointer">
            Pakai
          </button>
        </div>
      </div>

      {/* Rules Animations */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-widest font-semibold text-center">Rules Animations</span>
        <div className="flex gap-1">
          <button className="chip flex-1 text-[10px] text-center justify-center">Simple</button>
          <button className="chip active flex-1 text-[10px] text-center justify-center">High</button>
          <button className="chip flex-1 text-[10px] text-center justify-center">Expert</button>
        </div>
      </div>

      {/* Colors BG */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-widest font-semibold text-center">Colors BG</span>
        <div className="flex gap-1">
          <button className="chip active flex-1 text-[10px] text-center justify-center">Solid</button>
          <button className="chip flex-1 text-[10px] text-center justify-center opacity-50">Gradient</button>
          <button className="chip flex-1 text-[10px] text-center justify-center opacity-50">Pastel</button>
        </div>
      </div>

      {/* Easing Preset */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-widest font-semibold">Easing Preset</span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[var(--color-text-muted)]">OFF</span>
            <div className="toggle-switch" />
          </div>
        </div>
        <div className="flex gap-1">
          <button className="chip active flex-1 text-[10px] text-center justify-center">Natural</button>
          <button className="chip flex-1 text-[10px] text-center justify-center">Strong</button>
        </div>
      </div>
    </aside>
  );
}
