import React, { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  title?: string;
  description?: string;
  compact?: boolean;
  onReset?: () => void;
  resetKey?: unknown;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * CanvasErrorBoundary
 *
 * Catches JavaScript / PixiJS runtime errors during canvas rendering
 * and panel rendering (e.g. Neural Engine), displaying an isolated
 * error card and preventing the entire React tree from unmounting into a blank screen.
 */
export class CanvasErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('CanvasErrorBoundary caught an error in rendered component:', error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.compact) {
        return (
          <div className="w-full px-4 py-3 bg-[var(--color-bg-surface)] border-t border-rose-500/30 flex items-center justify-between gap-3 text-left">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-lg text-rose-400">⚠️</span>
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-rose-300 truncate">
                  {this.props.title || 'Komponen Mengalami Error'}
                </div>
                <div className="text-[10px] text-[var(--color-text-muted)] truncate font-mono">
                  {this.state.error?.name}: {this.state.error?.message || 'Unknown runtime error'}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={this.handleReset}
              className="chip active text-[10px] py-1 px-3 bg-rose-600/30 border-rose-500/50 text-rose-200 hover:bg-rose-600/50 cursor-pointer flex-shrink-0"
            >
              ↻ Reset Panel
            </button>
          </div>
        );
      }

      return (
        <div className="relative w-full h-full min-h-[280px] flex flex-col items-center justify-center p-6 bg-[var(--color-bg-surface)] text-center">
          <div className="glass-card max-w-lg w-full p-6 border border-rose-500/30 bg-rose-950/20 rounded-xl shadow-2xl flex flex-col items-center gap-3">
            {/* Error Icon */}
            <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-2xl text-rose-400">
              ⚠️
            </div>

            {/* Error Title */}
            <div>
              <h4 className="text-base font-bold text-white m-0 font-[var(--font-display)]">
                {this.props.title || 'Gagal Me-render Preview'}
              </h4>
              <p className="text-xs text-[var(--color-text-secondary)] mt-1 mb-0">
                {this.props.description || 'Terjadi kesalahan runtime saat mengeksekusi kode Canvas2D / engine render.'}
              </p>
            </div>

            {/* Error Message Box */}
            <div className="w-full bg-[var(--color-bg-base)]/80 border border-rose-500/20 rounded-lg p-3 text-left overflow-auto max-h-32">
              <p className="font-mono text-xs text-rose-400 m-0 break-words leading-relaxed">
                {this.state.error?.name}: {this.state.error?.message || 'Unknown runtime error'}
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={this.handleReset}
                className="btn-primary px-4 py-1.5 text-xs font-semibold rounded-lg cursor-pointer transition-all flex items-center gap-1.5 shadow-lg shadow-purple-900/30"
              >
                <span>↻</span>
                Coba Lagi / Reset
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
