/**
 * NeuralEngine — Below the preview canvas: Resolution, FPS, Format,
 * CPU/GPU compute mode, Bitrate, Output folder, Add Batch + Render buttons.
 * Visual shell only — no functional logic.
 */
export function NeuralEngine() {
  return (
    <div className="flex flex-col gap-2.5 px-4 py-3 border-t border-[var(--color-border-subtle)]">
      {/* Section Title */}
      <div className="flex items-center gap-2">
        <span className="section-header text-[var(--color-text-secondary)] text-[11px]">
          Neural Engine
        </span>
      </div>

      {/* Row 1: Resolution, FPS, Format */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <select className="select-dark text-[11px] py-1 min-w-[90px]">
            <option>4K ULTRA</option>
            <option>1080p</option>
            <option>720p</option>
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <select className="select-dark text-[11px] py-1 min-w-[70px]">
            <option>60 FPS</option>
            <option>30 FPS</option>
            <option>24 FPS</option>
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <select className="select-dark text-[11px] py-1 min-w-[70px]">
            <option>.MP4</option>
            <option>.MOV</option>
            <option>.WEBM</option>
          </select>
        </div>
      </div>

      {/* Row 2: Compute Mode */}
      <div className="flex items-center gap-2">
        <button className="chip text-[10px] py-1 px-3">CPU</button>
        <button className="chip text-[10px] py-1 px-3">GPU</button>
        <div className="flex items-center gap-1.5 ml-1">
          <span className="w-2 h-2 rounded-full bg-[var(--color-accent-green)] inline-block animate-pulse-glow" />
          <span className="text-[10px] text-[var(--color-accent-green)] font-semibold">
            GPU (NVIDIA RTX 3050)
          </span>
        </div>
      </div>

      {/* Row 3: Bitrate */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold">
          Bitrate
        </span>
        <select className="select-dark text-[11px] py-1 min-w-[60px]">
          <option>CBR</option>
          <option>VBR</option>
        </select>
        <input
          type="text"
          className="input-dark text-[11px] w-[80px] text-right"
          defaultValue="35689"
          readOnly
        />
        <span className="text-[10px] text-[var(--color-text-muted)]">kbps</span>
      </div>

      {/* Row 4: Output Path + Actions */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <span className="text-[14px]">📁</span>
          <span className="text-[11px] text-[var(--color-accent-ai)] truncate font-mono">
            G:\CEMAS...
          </span>
        </div>
        <button className="btn-neon text-[10px] py-1.5 px-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-accent)] hover:text-[var(--color-text-primary)]">
          + Add Batch
        </button>
        <button className="btn-neon btn-render py-1.5 px-6 text-[11px]">Render</button>
      </div>
    </div>
  );
}
