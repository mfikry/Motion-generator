import { useRenderSettingsStore } from '../store/renderSettingsStore';

/**
 * RenderSettingsPanel — Right column: Time Anim, No Text, Background Animations,
 * Green Screen, Intro/Outro, Rules Animations, Colors BG, Easing Preset.
 * Connected to live renderSettingsStore for real-time canvas preview updates.
 */
export function RenderSettingsPanel() {
  const {
    timeAnim,
    aspectRatio,
    noText,
    backgroundAnimations,
    greenScreen,
    introOutro,
    rulesLevel,
    setTimeAnim,
    setAspectRatio,
    toggleNoText,
    toggleBackgroundAnimations,
    toggleGreenScreen,
    setIntroOutro,
    setRulesLevel,
  } = useRenderSettingsStore();

  return (
    <aside className="flex flex-col gap-3 p-3 h-full overflow-y-auto">
      {/* Section Header */}
      <h2 className="section-header text-[var(--color-text-primary)] text-center m-0 text-sm tracking-widest">
        RENDER SETTINGS
      </h2>

      {/* Aspect Ratio Selector (16:9, 9:16, 1:1) — v1.3 */}
      <div className="glass-card p-2.5 flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-widest font-semibold">
            Aspect Ratio
          </span>
          <span className="text-[9px] text-[var(--color-accent-preview)] font-mono font-semibold">
            {aspectRatio === '16:9' ? '1920×1080' : aspectRatio === '9:16' ? '1080×1920' : '1080×1080'}
          </span>
        </div>
        <div className="flex gap-1 w-full">
          {(['16:9', '9:16', '1:1'] as const).map((ratio) => (
            <button
              key={ratio}
              type="button"
              onClick={() => setAspectRatio(ratio)}
              className={`chip flex-1 text-[11px] font-bold py-1 text-center justify-center cursor-pointer transition-all ${
                aspectRatio === ratio ? 'active shadow-sm' : ''
              }`}
            >
              {ratio}
            </button>
          ))}
        </div>
        <span className="text-[9px] text-[var(--color-text-muted)] text-center font-sans">
          {aspectRatio === '16:9' ? 'Landscape (YouTube / Stock)' : aspectRatio === '9:16' ? 'Portrait (Reels / TikTok)' : 'Square (Post / Feed)'}
        </span>
      </div>

      {/* Time Anim (sec) — v1.1 Time Remap scaling parameter */}
      <div className="glass-card p-3 flex flex-col items-center gap-2">
        <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-widest font-semibold">
          Time Anim (sec)
        </span>
        <div className="flex items-center justify-center gap-2 w-full">
          <button
            type="button"
            onClick={() => setTimeAnim(Math.max(1, timeAnim - 1))}
            className="w-7 h-7 rounded bg-[var(--color-bg-elevated)] hover:bg-[var(--color-border-accent)] text-white border border-[var(--color-border-subtle)] cursor-pointer flex items-center justify-center text-sm font-bold transition-colors"
            title="Kurangi 1 detik"
          >
            -
          </button>
          <div className="flex items-center justify-center">
            <input
              type="number"
              min={1}
              max={120}
              value={timeAnim}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val) && val > 0) {
                  setTimeAnim(val);
                }
              }}
              className="w-14 bg-transparent text-center text-3xl font-extrabold text-[var(--color-text-primary)] font-[var(--font-display)] border-b border-transparent hover:border-[var(--color-accent-preview)] focus:border-[var(--color-accent-preview)] focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
          <button
            type="button"
            onClick={() => setTimeAnim(Math.min(120, timeAnim + 1))}
            className="w-7 h-7 rounded bg-[var(--color-bg-elevated)] hover:bg-[var(--color-border-accent)] text-white border border-[var(--color-border-subtle)] cursor-pointer flex items-center justify-center text-sm font-bold transition-colors"
            title="Tambah 1 detik"
          >
            +
          </button>
        </div>
        <div className="flex gap-1 w-full justify-center">
          {[5, 10, 15, 20, 30].map((sec) => (
            <button
              key={sec}
              type="button"
              onClick={() => setTimeAnim(sec)}
              className={`chip text-[10px] py-0.5 px-1.5 cursor-pointer ${
                timeAnim === sec ? 'active' : ''
              }`}
            >
              {sec}s
            </button>
          ))}
        </div>
      </div>

      {/* No Text Toggle */}
      <div
        onClick={toggleNoText}
        className="glass-card p-3 flex items-center justify-between cursor-pointer hover:border-[var(--color-border-accent)] transition-colors select-none"
      >
        <div className="flex items-center gap-2">
          <span className="text-base">🚫</span>
          <span className="text-[12px] font-bold text-[var(--color-text-primary)] uppercase tracking-wide">
            No Text
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-[10px] font-semibold ${noText ? 'text-[var(--color-accent-green)]' : 'text-[var(--color-text-muted)]'}`}
          >
            {noText ? 'ON' : 'OFF'}
          </span>
          <div className={`toggle-switch ${noText ? 'active' : ''}`} />
        </div>
      </div>

      {/* Background Animations Toggle */}
      <div
        onClick={toggleBackgroundAnimations}
        className="glass-card p-3 flex items-center justify-between cursor-pointer hover:border-[var(--color-border-accent)] transition-colors select-none"
      >
        <div className="flex items-center gap-2">
          <span className="text-base">🎨</span>
          <span className="text-[11px] font-bold text-[var(--color-text-primary)] uppercase tracking-wide leading-tight">
            Background
            <br />
            Animations
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-[10px] font-semibold ${backgroundAnimations ? 'text-[var(--color-accent-green)]' : 'text-[var(--color-text-muted)]'}`}
          >
            {backgroundAnimations ? 'ON' : 'OFF'}
          </span>
          <div className={`toggle-switch ${backgroundAnimations ? 'active' : ''}`} />
        </div>
      </div>

      {/* Green Screen Toggle */}
      <div
        onClick={toggleGreenScreen}
        className={`glass-card p-3 flex items-center justify-between cursor-pointer transition-all select-none ${
          greenScreen
            ? 'glow-ai border-[rgba(34,197,94,0.5)]'
            : 'hover:border-[var(--color-border-accent)]'
        }`}
        style={
          greenScreen
            ? {
                borderColor: 'rgba(34, 197, 94, 0.5)',
                boxShadow: '0 0 15px var(--color-glow-green)',
              }
            : undefined
        }
      >
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded bg-[#00B140] inline-block border border-[rgba(34,197,94,0.5)] shadow-sm" />
          <span className="text-[12px] font-bold text-[var(--color-text-primary)] uppercase tracking-wide">
            Green Screen
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-[10px] font-semibold ${greenScreen ? 'text-[var(--color-accent-green)]' : 'text-[var(--color-text-muted)]'}`}
          >
            {greenScreen ? 'ON' : 'OFF'}
          </span>
          <div className={`toggle-switch ${greenScreen ? 'active' : ''}`} />
        </div>
      </div>

      {/* Intro/Outro Anim */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-widest font-semibold text-center">
          Intro/Outro Anim
        </span>
        <div className="flex rounded-lg overflow-hidden border border-[var(--color-border-subtle)]">
          <button
            onClick={() => setIntroOutro(false)}
            className={`flex-1 py-2 text-[11px] font-semibold uppercase tracking-wider border-none cursor-pointer transition-colors ${
              !introOutro
                ? 'bg-gradient-to-r from-[var(--color-btn-primary-from)] to-[var(--color-btn-primary-to)] text-white'
                : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            Tidak
          </button>
          <button
            onClick={() => setIntroOutro(true)}
            className={`flex-1 py-2 text-[11px] font-semibold uppercase tracking-wider border-none cursor-pointer transition-colors ${
              introOutro
                ? 'bg-gradient-to-r from-[var(--color-btn-primary-from)] to-[var(--color-btn-primary-to)] text-white'
                : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            Pakai
          </button>
        </div>
      </div>

      {/* Rules Animations */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-widest font-semibold text-center">
          Rules Animations
        </span>
        <div className="flex gap-1">
          <button
            onClick={() => setRulesLevel('simple')}
            className={`chip flex-1 text-[10px] text-center justify-center cursor-pointer ${
              rulesLevel === 'simple' ? 'active' : ''
            }`}
          >
            Simple
          </button>
          <button
            onClick={() => setRulesLevel('high')}
            className={`chip flex-1 text-[10px] text-center justify-center cursor-pointer ${
              rulesLevel === 'high' ? 'active' : ''
            }`}
          >
            High
          </button>
          <button
            onClick={() => setRulesLevel('expert')}
            className={`chip flex-1 text-[10px] text-center justify-center cursor-pointer ${
              rulesLevel === 'expert' ? 'active' : ''
            }`}
          >
            Expert
          </button>
        </div>
      </div>

      {/* Colors BG */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-widest font-semibold text-center">
          Colors BG
        </span>
        <div className="flex gap-1">
          <button className="chip active flex-1 text-[10px] text-center justify-center">
            Solid
          </button>
          <button className="chip flex-1 text-[10px] text-center justify-center opacity-50">
            Gradient
          </button>
          <button className="chip flex-1 text-[10px] text-center justify-center opacity-50">
            Pastel
          </button>
        </div>
      </div>

      {/* Easing Preset */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-widest font-semibold">
            Easing Preset
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[var(--color-accent-green)]">ON</span>
            <div className="toggle-switch active" />
          </div>
        </div>
        <div className="flex gap-1">
          <button className="chip active flex-1 text-[10px] text-center justify-center">
            Natural
          </button>
          <button className="chip flex-1 text-[10px] text-center justify-center">Strong</button>
        </div>
      </div>
    </aside>
  );
}
