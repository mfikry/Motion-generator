import React from 'react';
import { useRenderJobStore } from '../store/renderJobStore';
import { useGenerationStore } from '../store/generationStore';
import { useRenderSettingsStore } from '../store/renderSettingsStore';
import type { FpsOption, ExportFormat, RateControl, ComputeMode } from '@genc/shared-types';

/**
 * NeuralEngine — Controls render settings and triggers Final Render Pipeline (E8).
 *
 * Connected to:
 * - renderJobStore: resolution, FPS, format, bitrate, rate control (CBR/VBR), computeMode (CPU/GPU), output path, render status
 * - generationStore: current Canvas2D code
 * - renderSettingsStore: duration (timeAnim), aspect ratio, greenScreen
 */
export interface NeuralEngineProps {
  computeMode?: ComputeMode;
  gpuInfo?: GpuDeviceInfo | null;
  isDetectingGpu?: boolean;
  fallbackWarning?: string | null;
}

export function NeuralEngine(props?: NeuralEngineProps) {
  const store = useRenderJobStore();

  const computeMode = props?.computeMode ?? store.computeMode;
  const gpuInfo = props?.gpuInfo !== undefined ? props.gpuInfo : store.gpuInfo;
  const isDetectingGpu = props?.isDetectingGpu !== undefined ? props.isDetectingGpu : store.isDetectingGpu;
  const fallbackWarning = props?.fallbackWarning !== undefined ? props.fallbackWarning : store.fallbackWarning;

  const {
    outputFolder,
    fps,
    format,
    bitrateKbps,
    rateControl,
    resolution,
    phase,
    currentFrame,
    totalFrames,
    percent,
    estimatedRemainingMs,
    error,
    lastResult,
    setResolution,
    setFps,
    setFormat,
    setBitrateKbps,
    setRateControl,
    setComputeMode,
    selectOutputFolder,
    fetchGpuInfo,
    startRender,
    cancelRender,
    reset,
  } = store;

  const { currentCode, generations } = useGenerationStore();
  const { timeAnim, aspectRatio, greenScreen } = useRenderSettingsStore();

  const isRendering = phase === 'starting' || phase === 'rendering' || phase === 'finalizing';

  React.useEffect(() => {
    fetchGpuInfo();
  }, [fetchGpuInfo]);

  const handleStartRender = async () => {
    if (isRendering) return;

    // Resolve code: from store currentCode or latest generation
    const code = currentCode || generations[0]?.codeText;
    if (!code) {
      alert('Tidak ada kode Canvas2D untuk di-render. Silakan generate atau pilih animasi terlebih dahulu.');
      return;
    }

    const generationId = generations[0]?.id || `gen_${Date.now()}`;
    await startRender(generationId, code, timeAnim, aspectRatio);
  };

  return (
    <div className="flex flex-col gap-2.5 px-4 py-3 border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)]">
      {/* Section Title & Status Indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="section-header text-[var(--color-text-secondary)] text-[11px] font-bold tracking-wider">
            NEURAL ENGINE
          </span>
          {isRendering && (
            <span className="flex items-center gap-1 text-[10px] text-[var(--color-accent-preview)] animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent-preview)] inline-block" />
              {phase === 'starting' ? 'Initializing...' : phase === 'finalizing' ? 'Encoding...' : 'Rendering...'}
            </span>
          )}
        </div>

        {/* Mini progress stats if rendering */}
        {isRendering && totalFrames > 0 && (
          <div className="text-[10px] font-mono text-[var(--color-text-muted)]">
            Frame {currentFrame}/{totalFrames} ({percent}%)
            {estimatedRemainingMs > 0 && ` • ~${Math.ceil(estimatedRemainingMs / 1000)}s remaining`}
          </div>
        )}
      </div>

      {/* Progress Bar (visible during render) */}
      {isRendering && (
        <div className="w-full bg-[var(--color-bg-base)] h-1.5 rounded-full overflow-hidden border border-[var(--color-border-subtle)]">
          <div
            className="h-full bg-gradient-to-r from-[var(--color-accent-preview)] to-[var(--color-accent-ai)] transition-all duration-150 ease-out"
            style={{ width: `${Math.max(2, percent)}%` }}
          />
        </div>
      )}

      {/* Fallback Warning Notice Banner */}
      {fallbackWarning && (
        <div className="flex items-center justify-between px-2.5 py-1.5 rounded bg-amber-950/40 border border-amber-500/50 text-[11px] text-amber-300">
          <span className="truncate">
            ⚠️ {fallbackWarning}
          </span>
          <button
            type="button"
            onClick={() => useRenderJobStore.setState({ fallbackWarning: null })}
            className="text-[10px] text-amber-400 hover:text-white ml-2 cursor-pointer bg-transparent border-none"
            title="Dismiss warning"
          >
            ✕
          </button>
        </div>
      )}

      {/* Result Notification Banner */}
      {phase === 'done' && lastResult && (
        <div className="flex items-center justify-between px-2.5 py-1.5 rounded bg-[var(--color-bg-base)] border border-[var(--color-accent-green)] text-[11px]">
          <span className="text-[var(--color-accent-green)] truncate">
            ✓ Render Complete: <strong>{lastResult.outputPath.split(/[/\\]/).pop()}</strong> ({(lastResult.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB in {(lastResult.elapsedMs / 1000).toFixed(1)}s)
            {lastResult.computeModeUsed && ` • ${lastResult.computeModeUsed.toUpperCase()} (${lastResult.usedEncoder || 'Encoder'})`}
            {lastResult.hasAlpha ? ' • Alpha Transparansi' : ''}
          </span>
          <button
            type="button"
            onClick={reset}
            className="text-[10px] text-[var(--color-text-muted)] hover:text-white ml-2 cursor-pointer bg-transparent border-none"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Error Notification Banner */}
      {phase === 'failed' && error && (
        <div className="flex items-center justify-between px-2.5 py-1.5 rounded bg-[var(--color-bg-base)] border border-[var(--color-accent-red,red)] text-[11px]">
          <span className="text-red-400 truncate">
            ✕ Render Failed: {error}
          </span>
          <button
            type="button"
            onClick={reset}
            className="text-[10px] text-[var(--color-text-muted)] hover:text-white ml-2 cursor-pointer bg-transparent border-none"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Row 1: Resolution, FPS, Format */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <select
            value={resolution}
            disabled={isRendering}
            onChange={(e) => setResolution(e.target.value as '4k' | '1080p' | '720p')}
            className="select-dark text-[11px] py-1 min-w-[90px] cursor-pointer"
          >
            <option value="4k">4K ULTRA</option>
            <option value="1080p">1080p</option>
            <option value="720p">720p</option>
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <select
            value={fps}
            disabled={isRendering}
            onChange={(e) => setFps(Number(e.target.value) as FpsOption)}
            className="select-dark text-[11px] py-1 min-w-[70px] cursor-pointer"
          >
            <option value={60}>60 FPS</option>
            <option value={30}>30 FPS</option>
            <option value={24}>24 FPS</option>
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <select
            value={format}
            disabled={isRendering}
            onChange={(e) => setFormat(e.target.value as ExportFormat)}
            className="select-dark text-[11px] py-1 min-w-[70px] cursor-pointer"
            title={
              format === 'mov'
                ? 'QuickTime ProRes 4444 (Alpha Channel)'
                : format === 'webm'
                ? 'WebM VP9 (Alpha Channel, Royalty-Free)'
                : 'MP4 H.264 (Standard)'
            }
          >
            <option value="mp4">.MP4</option>
            <option value="mov">.MOV (ProRes 4444)</option>
            <option value="webm">.WEBM (VP9)</option>
          </select>
        </div>
        {!greenScreen && (format === 'mov' || format === 'webm') && (
          <span className="text-[10px] text-cyan-400 font-mono tracking-tight bg-cyan-950/40 px-1.5 py-0.5 rounded border border-cyan-800/40">
            Alpha Channel Active
          </span>
        )}
      </div>

      {/* Row 2: Compute Mode (CPU vs GPU) */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={isRendering}
          onClick={() => setComputeMode('cpu')}
          className={`chip text-[10px] py-1 px-3 ${computeMode === 'cpu' ? 'active' : ''}`}
          title="CPU software encoding (LGPL OpenH264 BSD / Kostya ProRes / VP9)"
        >
          CPU
        </button>
        <button
          type="button"
          disabled={isRendering}
          onClick={() => setComputeMode('gpu')}
          className={`chip text-[10px] py-1 px-3 ${computeMode === 'gpu' ? 'active' : ''}`}
          title={
            isDetectingGpu
              ? 'Mendeteksi hardware GPU...'
              : gpuInfo?.hasGpu
              ? `Hardware acceleration active: ${gpuInfo.gpuName} (${gpuInfo.supportedEncoders?.join(', ') ?? 'HW'})`
              : 'Hardware acceleration (AMF / NVENC / QSV with CPU auto-fallback)'
          }
        >
          GPU
        </button>
        <div className="flex items-center gap-1.5 ml-1 min-w-0">
          {computeMode === 'gpu' ? (
            isDetectingGpu ? (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-400 inline-block animate-pulse" />
                <span className="text-[10px] text-amber-300 font-semibold truncate">
                  Mendeteksi GPU...
                </span>
              </>
            ) : gpuInfo?.hasGpu ? (
              <>
                <span className="w-2 h-2 rounded-full bg-[var(--color-accent-preview)] inline-block" />
                <span
                  className="text-[10px] text-[var(--color-accent-preview)] font-semibold truncate max-w-[240px]"
                  title={`${gpuInfo.gpuName} (${gpuInfo.supportedEncoders?.join(', ') ?? 'HW'})`}
                >
                  {gpuInfo.gpuName} ({gpuInfo.preferredH264Encoder?.toUpperCase() || gpuInfo.supportedEncoders?.[0]?.toUpperCase() || 'HW'})
                </span>
              </>
            ) : gpuInfo ? (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                <span
                  className="text-[10px] text-amber-400 font-semibold truncate max-w-[240px]"
                  title="Tidak ada hardware encoder GPU yang kompatibel. Render akan otomatis fallback ke CPU."
                >
                  Tidak Ada GPU HW (Fallback CPU)
                </span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-400 inline-block animate-pulse" />
                <span className="text-[10px] text-amber-300 font-semibold truncate">
                  Mendeteksi GPU...
                </span>
              </>
            )
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-[var(--color-accent-green)] inline-block" />
              <span className="text-[10px] text-[var(--color-accent-green)] font-semibold truncate">
                CPU Engine (OpenH264 / Kostya / VP9)
              </span>
            </>
          )}
        </div>
      </div>

      {/* Row 3: Bitrate & Rate Control */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold">
          Bitrate
        </span>
        <select
          value={rateControl}
          onChange={(e) => setRateControl(e.target.value as RateControl)}
          className="select-dark text-[11px] py-1 min-w-[60px]"
          disabled={isRendering}
          title="Rate control mode: CBR (Constant Bitrate) or VBR (Variable Bitrate)"
        >
          <option value="cbr">CBR</option>
          <option value="vbr">VBR</option>
        </select>
        <input
          type="number"
          min={1000}
          max={100000}
          step={1000}
          disabled={isRendering}
          value={bitrateKbps}
          onChange={(e) => {
            const val = parseInt(e.target.value, 10);
            if (!isNaN(val) && val > 0) setBitrateKbps(val);
          }}
          className="input-dark text-[11px] w-[80px] text-right font-mono"
        />
        <span className="text-[10px] text-[var(--color-text-muted)]">kbps</span>
      </div>

      {/* Row 4: Output Path + Actions */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={isRendering}
          onClick={selectOutputFolder}
          className="flex items-center gap-1.5 flex-1 min-w-0 bg-[var(--color-bg-base)] px-2 py-1.5 rounded border border-[var(--color-border-subtle)] hover:border-[var(--color-border-accent)] cursor-pointer text-left transition-colors"
          title="Click to change output folder"
        >
          <span className="text-[14px]">📁</span>
          <span className="text-[11px] text-[var(--color-accent-ai)] truncate font-mono">
            {outputFolder || 'Select folder...'}
          </span>
        </button>

        <button
          type="button"
          disabled
          className="btn-neon text-[10px] py-1.5 px-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] text-[var(--color-text-muted)] opacity-60 cursor-not-allowed"
          title="Multi-job batch queue coming in Epic E9"
        >
          + Add Batch
        </button>

        {isRendering ? (
          <button
            type="button"
            onClick={cancelRender}
            className="btn-neon py-1.5 px-6 text-[11px] bg-red-600/20 border-red-500 text-red-300 hover:bg-red-600/40 cursor-pointer font-bold transition-all"
          >
            Cancel
          </button>
        ) : (
          <button
            type="button"
            onClick={handleStartRender}
            className="btn-neon btn-render py-1.5 px-6 text-[11px] cursor-pointer font-bold transition-all"
          >
            Render
          </button>
        )}
      </div>
    </div>
  );
}
