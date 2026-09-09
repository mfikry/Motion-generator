import { useState, useEffect } from 'react';
import { useApiKeyStore } from '../store/apiKeyStore';
import type { ApiKeyStatus } from '@genc/shared-types';

export function ApiKeyModal() {
  const {
    keys,
    poolStatus,
    isModalOpen,
    isLoading,
    isValidating,
    error,
    closeModal,
    clearError,
    loadKeys,
    addKey,
    removeKey,
    validateKey,
    validateAllKeys,
  } = useApiKeyStore();

  const [inputKey, setInputKey] = useState('');
  const [inputLabel, setInputLabel] = useState('');
  const [showKeyText, setShowKeyText] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isModalOpen) {
      loadKeys();
      setInputKey('');
      setInputLabel('');
      setActionMessage(null);
    }
  }, [isModalOpen, loadKeys]);

  if (!isModalOpen) return null;

  const handleAddKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputKey.trim()) return;

    setActionMessage('Memvalidasi API key dengan Google Gemini...');
    const result = await addKey(inputKey.trim(), inputLabel.trim());

    if (result.success) {
      setInputKey('');
      setInputLabel('');
      setActionMessage('API key berhasil divalidasi & disimpan!');
      setTimeout(() => setActionMessage(null), 3000);
    } else {
      setActionMessage(null);
    }
  };

  const handleRemoveKey = async (id: string, label: string) => {
    if (window.confirm(`Hapus API key "${label}"?`)) {
      await removeKey(id);
      setActionMessage('API key berhasil dihapus.');
      setTimeout(() => setActionMessage(null), 3000);
    }
  };

  const handleValidateKey = async (id: string) => {
    await validateKey(id);
    setActionMessage('Validasi key selesai.');
    setTimeout(() => setActionMessage(null), 2500);
  };

  const handleValidateAll = async () => {
    await validateAllKeys();
    setActionMessage('Validasi semua key selesai.');
    setTimeout(() => setActionMessage(null), 2500);
  };

  const getStatusBadge = (status: ApiKeyStatus) => {
    switch (status) {
      case 'valid':
        return (
          <span className="badge badge-green flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent-green)] animate-pulse" />
            VALID
          </span>
        );
      case 'rate_limited':
        return (
          <span className="badge badge-gold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent-ai)]" />
            RATE LIMITED
          </span>
        );
      case 'invalid':
        return (
          <span className="badge flex items-center gap-1 bg-red-950/60 text-red-400 border border-red-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
            INVALID
          </span>
        );
    }
  };

  const formatTimestamp = (ts: string | null) => {
    if (!ts) return 'Belum dicek';
    try {
      const date = new Date(ts);
      return (
        date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) +
        ' ' +
        date.toLocaleDateString([], { month: 'short', day: 'numeric' })
      );
    } catch {
      return ts;
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeModal();
      }}
    >
      <div className="glass-card w-full max-w-2xl bg-[var(--color-bg-surface)] border-[var(--color-border-accent)] shadow-2xl relative animate-slide-up flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[var(--color-accent-ai)] to-[var(--color-btn-primary-from)] flex items-center justify-center text-lg shadow-md">
              🔑
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--color-text-primary)] font-[var(--font-display)] tracking-wide">
                MANAJEMEN GEMINI API KEY
              </h2>
              <p className="text-[11px] text-[var(--color-text-secondary)]">
                Dienkripsi via Windows DPAPI (safeStorage) secara lokal
              </p>
            </div>
          </div>
          <button
            onClick={closeModal}
            className="w-8 h-8 rounded-md flex items-center justify-center text-[var(--color-text-secondary)] hover:text-white hover:bg-white/10 transition-colors border-none bg-transparent cursor-pointer text-lg font-bold"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          {/* Add Key Form */}
          <form
            onSubmit={handleAddKey}
            className="glass-card p-4 bg-[var(--color-bg-card)] flex flex-col gap-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--color-accent-ai)] uppercase tracking-wider">
                + Tambah API Key Baru
              </span>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-[var(--color-accent-preview)] hover:underline flex items-center gap-1"
              >
                Dapatkan key di Google AI Studio ↗
              </a>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-1">
                <label className="text-[11px] text-[var(--color-text-muted)] block mb-1">
                  Label / Nama (opsional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Primary Key"
                  value={inputLabel}
                  onChange={(e) => setInputLabel(e.target.value)}
                  className="input-dark w-full text-xs"
                  disabled={isLoading}
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-[11px] text-[var(--color-text-muted)] block mb-1">
                  Google Gemini API Key <span className="text-red-400">*</span>
                </label>
                <div className="relative flex items-center">
                  <input
                    type={showKeyText ? 'text' : 'password'}
                    placeholder="AIzaSy..."
                    value={inputKey}
                    onChange={(e) => {
                      setInputKey(e.target.value);
                      if (error) clearError();
                    }}
                    className="input-dark w-full pr-10 text-xs font-mono"
                    disabled={isLoading}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowKeyText(!showKeyText)}
                    className="absolute right-2 text-xs text-[var(--color-text-muted)] hover:text-white bg-transparent border-none cursor-pointer p-1"
                    title={showKeyText ? 'Sembunyikan' : 'Tampilkan'}
                  >
                    {showKeyText ? '👁️' : '🔒'}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mt-1">
              <span className="text-[11px] text-[var(--color-text-muted)]">
                Kunci akan otomatis diuji coba ke Google Gemini sebelum disimpan.
              </span>
              <button
                type="submit"
                disabled={isLoading || !inputKey.trim()}
                className="btn-neon btn-generate text-xs flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <span className="w-3 h-3 border-2 border-slate-900 border-t-transparent rounded-full animate-spin inline-block" />
                    <span>Memvalidasi...</span>
                  </>
                ) : (
                  <>
                    <span>+</span>
                    <span>Simpan & Validasi</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Feedback banners */}
          {error && (
            <div className="p-3 rounded-lg bg-red-950/70 border border-red-500/40 text-red-200 text-xs flex items-center justify-between animate-slide-up">
              <div className="flex items-center gap-2">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
              <button
                onClick={clearError}
                className="text-red-400 hover:text-red-200 bg-transparent border-none cursor-pointer font-bold ml-2"
              >
                ✕
              </button>
            </div>
          )}

          {actionMessage && !error && (
            <div className="p-2.5 rounded-lg bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-slide-up">
              <span>✓</span>
              <span>{actionMessage}</span>
            </div>
          )}

          {/* Key List */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[var(--color-text-primary)] uppercase tracking-wider">
                  Daftar Kunci ({keys.length})
                </span>
                <span className="badge badge-green text-[10px]">{poolStatus.valid} Aktif</span>
                {poolStatus.rateLimited > 0 && (
                  <span className="badge badge-gold text-[10px]">
                    {poolStatus.rateLimited} Rate Limited
                  </span>
                )}
              </div>
              {keys.length > 0 && (
                <button
                  onClick={handleValidateAll}
                  disabled={isValidating}
                  className="chip text-[11px] flex items-center gap-1.5 disabled:opacity-50"
                  title="Cek ulang semua key ke Gemini"
                >
                  <span className={isValidating ? 'animate-spin inline-block' : ''}>🔄</span>
                  <span>{isValidating ? 'Memvalidasi...' : 'Cek Semua'}</span>
                </button>
              )}
            </div>

            {keys.length === 0 ? (
              <div className="glass-card p-8 text-center flex flex-col items-center justify-center gap-2 border-dashed border-[var(--color-border-subtle)]">
                <span className="text-3xl">🔑</span>
                <p className="text-sm font-semibold text-[var(--color-text-secondary)]">
                  Belum ada API Key tersimpan
                </p>
                <p className="text-xs text-[var(--color-text-muted)] max-w-sm">
                  Tambahkan setidaknya 1 API key Gemini untuk menggunakan fitur pembuatan animasi
                  berbasis AI.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {keys.map((k) => (
                  <div
                    key={k.id}
                    className="glass-card p-3 flex items-center justify-between gap-4 bg-[var(--color-bg-card)] hover:border-[var(--color-border-accent)] transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-7 h-7 rounded bg-[var(--color-bg-elevated)] flex items-center justify-center text-xs">
                        🔑
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-[var(--color-text-primary)] truncate">
                            {k.label}
                          </span>
                          {getStatusBadge(k.status)}
                        </div>
                        <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                          Dicek: {formatTimestamp(k.lastCheckedAt)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleValidateKey(k.id)}
                        disabled={isValidating}
                        className="chip text-[10px] py-1 px-2.5 disabled:opacity-50"
                        title="Tes ulang key ini"
                      >
                        Tes Ulang
                      </button>
                      <button
                        onClick={() => handleRemoveKey(k.id, k.label)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10 p-1.5 rounded transition-colors bg-transparent border-none cursor-pointer text-xs"
                        title="Hapus API key"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] text-[11px] text-[var(--color-text-secondary)]">
          <div>
            Pool: <strong className="text-white">{poolStatus.valid}</strong> valid /{' '}
            <strong className="text-white">{poolStatus.total}</strong> total
          </div>
          <button onClick={closeModal} className="chip text-xs py-1 px-4 hover:text-white">
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
