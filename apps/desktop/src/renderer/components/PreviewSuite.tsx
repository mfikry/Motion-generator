import { useState } from 'react';
import { useGenerationStore } from '../store/generationStore';

/**
 * PreviewSuite — Center column:
 * Tab bar, canvas preview area / Blueprint Inspector, playback controls, status log.
 */
export function PreviewSuite() {
  const { currentBlueprint, statusMessage, isGenerating } = useGenerationStore();
  const [viewMode, setViewMode] = useState<'preview' | 'json'>('preview');
  const [copied, setCopied] = useState(false);

  const handleCopyJson = () => {
    if (!currentBlueprint) return;
    navigator.clipboard.writeText(JSON.stringify(currentBlueprint, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-0 h-full">
      {/* Tab Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--color-border-subtle)]">
        <div className="flex items-center gap-4">
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

        {/* JSON / Preview View Toggle if Blueprint exists */}
        {currentBlueprint && (
          <div className="flex items-center gap-1 bg-[var(--color-bg-elevated)] p-0.5 rounded-md border border-[var(--color-border-subtle)]">
            <button
              onClick={() => setViewMode('preview')}
              className={`text-[10px] font-semibold px-2 py-0.5 rounded border-none cursor-pointer transition-colors ${
                viewMode === 'preview'
                  ? 'bg-[var(--color-btn-primary-from)] text-white'
                  : 'bg-transparent text-[var(--color-text-muted)] hover:text-white'
              }`}
            >
              Summary
            </button>
            <button
              onClick={() => setViewMode('json')}
              className={`text-[10px] font-semibold px-2 py-0.5 rounded border-none cursor-pointer transition-colors ${
                viewMode === 'json'
                  ? 'bg-[var(--color-btn-primary-from)] text-white'
                  : 'bg-transparent text-[var(--color-text-muted)] hover:text-white'
              }`}
            >
              Raw JSON
            </button>
            <button
              onClick={handleCopyJson}
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded border-none bg-transparent text-[var(--color-accent-preview)] hover:text-white cursor-pointer ml-1"
              title="Copy JSON to clipboard"
            >
              {copied ? '✓ Copied' : '📋 Copy'}
            </button>
          </div>
        )}
      </div>

      {/* Canvas Area / Blueprint Inspector */}
      <div className="flex-1 mx-4 mt-3 rounded-xl overflow-hidden border border-[var(--color-border-subtle)] relative min-h-[280px] flex flex-col bg-[var(--color-bg-base)]">
        {currentBlueprint ? (
          viewMode === 'json' ? (
            /* Raw JSON View */
            <div className="flex-1 overflow-auto p-3 font-mono text-[11px] leading-relaxed text-[var(--color-accent-preview)] bg-[var(--color-bg-surface)]">
              <pre className="m-0 select-text whitespace-pre-wrap break-all">
                {JSON.stringify(currentBlueprint, null, 2)}
              </pre>
            </div>
          ) : (
            /* Structured Summary View */
            <div className="flex-1 flex flex-col p-4 overflow-y-auto bg-[var(--color-bg-surface)] gap-3">
              {/* Header Info */}
              <div className="flex items-start justify-between gap-2 border-b border-[var(--color-border-subtle)] pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="badge badge-gold uppercase text-[10px] font-bold">
                      {currentBlueprint.category}
                    </span>
                    <span className="badge badge-cyan text-[10px]">
                      {currentBlueprint.canvas.width}x{currentBlueprint.canvas.height}
                    </span>
                    <span className="badge badge-green text-[10px]">
                      {currentBlueprint.durationSec}s @ {currentBlueprint.fps} FPS
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-white mt-1.5 m-0 font-[var(--font-display)]">
                    Blueprint ID:{' '}
                    <span className="font-mono text-xs text-[var(--color-text-accent)]">
                      {currentBlueprint.blueprintId}
                    </span>
                  </h3>
                </div>

                {/* Color Palette Swatches */}
                <div className="flex flex-col items-end gap-1">
                  <span className="text-[10px] text-[var(--color-text-muted)] font-semibold uppercase">
                    Palette ({currentBlueprint.palette.length})
                  </span>
                  <div className="flex gap-1">
                    {currentBlueprint.palette.map((color, idx) => (
                      <span
                        key={idx}
                        className="w-5 h-5 rounded border border-white/20 shadow-sm"
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Blueprint Attributes */}
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div className="glass-card p-2 bg-[var(--color-bg-card)]">
                  <span className="text-[10px] text-[var(--color-text-muted)] block uppercase">
                    Layers
                  </span>
                  <strong className="text-white text-sm">{currentBlueprint.layers.length}</strong>
                </div>
                <div className="glass-card p-2 bg-[var(--color-bg-card)]">
                  <span className="text-[10px] text-[var(--color-text-muted)] block uppercase">
                    Rules Level
                  </span>
                  <strong className="text-[var(--color-accent-ai)] text-sm uppercase">
                    {currentBlueprint.rulesLevel}
                  </strong>
                </div>
                <div className="glass-card p-2 bg-[var(--color-bg-card)]">
                  <span className="text-[10px] text-[var(--color-text-muted)] block uppercase">
                    Loop Seamless
                  </span>
                  <strong className="text-emerald-400 text-sm">
                    {currentBlueprint.loop.seamless ? 'YES' : 'NO'}
                  </strong>
                </div>
                <div className="glass-card p-2 bg-[var(--color-bg-card)]">
                  <span className="text-[10px] text-[var(--color-text-muted)] block uppercase">
                    No Text
                  </span>
                  <strong className="text-cyan-400 text-sm">
                    {currentBlueprint.noText ? 'TRUE' : 'FALSE'}
                  </strong>
                </div>
              </div>

              {/* Layers Breakdown */}
              <div className="flex flex-col gap-1.5 mt-1">
                <span className="text-[11px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">
                  Daftar Layer Motion:
                </span>
                <div className="flex flex-col gap-1.5">
                  {currentBlueprint.layers.map((layer, idx) => (
                    <div
                      key={layer.id || idx}
                      className="glass-card p-2.5 flex items-center justify-between text-xs bg-[var(--color-bg-elevated)] border-[var(--color-border-subtle)]"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-[var(--color-text-muted)]">
                          #{idx + 1}
                        </span>
                        <span className="font-bold text-white">{layer.id}</span>
                        <span className="badge badge-gold text-[9px] py-0 px-1.5 uppercase">
                          {layer.type}
                        </span>
                        {layer.shape && (
                          <span className="badge badge-cyan text-[9px] py-0 px-1.5">
                            {layer.shape}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-[var(--color-text-secondary)]">
                        <span>
                          <strong className="text-white">{layer.keyframes.length}</strong> keyframes
                        </span>
                        {layer.keyframes[0]?.easing && (
                          <span className="font-mono text-[10px] text-[var(--color-accent-preview)]">
                            {layer.keyframes[0].easing}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        ) : (
          /* Default Canvas Placeholder (Green screen styling) */
          <div className="absolute inset-0 flex items-center justify-center bg-[#00B140]">
            <div className="text-[var(--color-bg-base)] opacity-25 text-center">
              <p className="text-4xl font-extrabold m-0 tracking-wider font-[var(--font-display)]">
                PREVIEW
              </p>
              <p className="text-xs font-semibold mt-1">
                {isGenerating
                  ? 'Sedang menghasilkan Motion Blueprint dari AI...'
                  : 'Masukkan prompt di panel AI Architect & klik Generate'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Playback Controls */}
      <div className="flex items-center gap-3 px-4 py-2.5">
        {/* Time Display */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold">
            Time (s)
          </span>
          <span className="text-base font-bold text-[var(--color-text-primary)] font-[var(--font-mono)]">
            {currentBlueprint ? currentBlueprint.durationSec : 15}
          </span>
        </div>

        {/* Play Button */}
        <button className="w-10 h-10 rounded-full border-2 border-[var(--color-accent-ai)] bg-transparent flex items-center justify-center cursor-pointer hover:bg-[var(--color-accent-ai-dim)] transition-colors group">
          <span className="text-[var(--color-accent-ai)] text-lg group-hover:scale-110 transition-transform">
            ▶
          </span>
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
            style={{ width: currentBlueprint ? '100%' : '35%' }}
          />
        </div>
      </div>

      {/* Status Log */}
      <div className="mx-4 mb-3">
        <div className="status-log">
          {statusMessage ? (
            <>
              <span className="text-[var(--color-accent-ai)]">[TEXT]</span>{' '}
              <span className="text-[var(--color-accent-green)]">STATUS:</span>{' '}
              <span className="text-[var(--color-text-secondary)]">{statusMessage}</span>
            </>
          ) : (
            <>
              <span className="text-[var(--color-accent-ai)]">[STANDBY]</span>{' '}
              <span className="text-[var(--color-accent-green)]">READY.</span>{' '}
              <span className="text-[var(--color-text-secondary)]">
                Masukkan prompt teks untuk memulai generate.
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
