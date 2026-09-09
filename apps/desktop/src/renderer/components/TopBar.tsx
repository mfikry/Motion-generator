/**
 * TopBar — App branding, update check, tour, lite mode, theme toggle.
 * Visual shell only — no functional logic.
 */
export function TopBar() {
  return (
    <header className="flex items-center justify-between px-4 py-2 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)]">
      {/* Left: API Key Status */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="badge badge-gold">GEMINI API KEYS</span>
          <span className="badge badge-green">5/5</span>
        </div>
        <button className="flex items-center gap-1.5 text-[11px] text-[var(--color-accent-ai)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer bg-transparent border-none font-semibold">
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
        </div>
      </div>

      {/* Right: Models & Thinking Level */}
      <div className="flex flex-col gap-1.5 items-end min-w-[200px]">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold">Models</span>
          <select className="select-dark text-[11px] py-1 px-2 min-w-[120px]">
            <option>Gemi 3.6F</option>
          </select>
          <span className="text-[10px] text-[var(--color-text-accent)] cursor-pointer hover:text-[var(--color-text-primary)] transition-colors font-semibold uppercase">
            Custom
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold">Thinking Level</span>
          <div className="flex gap-1">
            <button className="chip text-[10px] py-0.5 px-2.5">Low</button>
            <button className="chip text-[10px] py-0.5 px-2.5">Medium</button>
            <button className="chip active text-[10px] py-0.5 px-2.5">High</button>
          </div>
        </div>
      </div>
    </header>
  );
}
