# Technical Design Document — GEN(C) Motion Generator
**Lanjutan dari PRD v1.0 — Siap dipecah menjadi task eksekusi (mis. untuk Google Antigravity)**

Versi Dokumen: 1.0
Status: Draft untuk Review Teknis
Dokumen Induk: `PRD_GenC_Motion_Generator.md`

---

## 1. Rekap Constraint dari PRD

| Constraint | Nilai |
|---|---|
| Target platform microstock | Adobe Stock |
| OS | Windows 10/11 saja |
| Render fondasi | Library motion open-source (bukan custom engine dari nol) |
| Audio | Tidak ada di rilis pertama |
| Mode | Mode Penuh saja (Lite Mode = optimasi performa UI, bukan tier bisnis) |
| AI Provider | Google Gemini API (multi-key) |
| Compute render | CPU atau GPU (pilihan user) |

Dokumen ini menerjemahkan constraint di atas menjadi keputusan implementasi konkret.

---

## 2. Keputusan Tech Stack

### 2.1 Application Shell

**Keputusan: Electron** (bukan Tauri).

| Kriteria | Electron | Tauri |
|---|---|---|
| Kematangan ekosistem Windows | Sangat matang | Cukup matang |
| Akses native GPU info (`app.getGPUInfo()`) | Built-in | Perlu plugin/binding manual |
| Kemudahan render offscreen (headless BrowserWindow untuk final render) | Native didukung | Lebih rumit (WebView berbeda per OS) |
| Bundle size | Lebih besar (~150-200MB) | Lebih kecil |
| Alasan pemilihan | Karena render engine berbasis **Chromium WebGL** (lihat 2.3), Electron paling konsisten: proses preview real-time dan proses final-render memakai environment rendering yang **sama persis** (hemat bug "preview vs final render beda hasil") | — |

Bundle size bukan prioritas karena app ini adalah tool produksi profesional (bukan app ringan), dan Windows-only sehingga tidak perlu portabilitas cross-OS Tauri.

### 2.2 UI Layer

- **React 18** + **TypeScript** untuk renderer process.
- **Tailwind CSS** untuk styling (cepat mereplikasi dark theme UI referensi: card ungu gelap, aksen neon per section).
- **Zustand** untuk state management ringan (bukan Redux — state UI ini tidak sekompleks itu: project aktif (T1/T2), render queue, API key status).
- **Radix UI primitives** untuk komponen dasar (dropdown, toggle, dialog) yang bisa di-restyle sesuai desain gelap referensi.

### 2.3 Render Engine (Motion)

**Keputusan: PixiJS v8 (WebGL/WebGPU 2D renderer, MIT License)** sebagai fondasi.

| Kandidat | License | Cocok? | Alasan |
|---|---|---|---|
| **PixiJS** | MIT | ✅ Dipilih | GPU-accelerated 2D rendering, native jalan di Chromium/Electron tanpa binding tambahan, mendukung filter/particle/tween via plugin, ekosistem animasi besar (gsap-pixi, pixi-spine dst), performa preview real-time bagus |
| Remotion | Freemium (bukan open-source murni — lisensi berbayar di atas revenue tertentu) | ❌ Ditolak | Berisiko lisensi untuk produk komersial yang hasilnya dijual; tidak sesuai keputusan "library open-source" di PRD |
| Lottie/dotLottie | MIT (player), tapi authoring butuh After Effects (Bodymovin) | ⚠️ Dipertimbangkan sebagai **format ekspor tambahan** (opsional, roadmap) — bukan engine utama karena tidak cocok untuk generative motion dari AI blueprint |
| Skia (via canvaskit-wasm) | BSD | ⚠️ Kandidat cadangan | Fidelity tinggi, tapi WASM overhead & integrasi dengan Electron lebih kompleks dibanding PixiJS native WebGL. Disimpan sebagai opsi upgrade fase 2 jika butuh kualitas vektor lebih presisi. |
| Three.js | MIT | ❌ Tidak dipakai sebagai core | Fokus 3D, overkill untuk motion graphics 2D flat-style seperti contoh UI (bar chart, ikon) |

**Kesimpulan**: PixiJS sebagai render core untuk kedua mode:
1. **Preview Renderer** — jalan langsung di renderer process (kanvas WebGL di UI, real-time, resolusi preview lebih rendah untuk performa).
2. **Final Render Worker** — jalan di **headless/offscreen BrowserWindow** terpisah (proses Electron tersembunyi) dengan resolusi & FPS penuh sesuai Neural Engine settings, meng-capture tiap frame ke buffer gambar (`page.capturePage()`/`webContents` offscreen rendering API Electron).

### 2.4 Encoding (Frame Sequence → Video File)

**Keputusan: FFmpeg build LGPL v3.0 (default, tanpa `--enable-gpl`)**, dibungkus via `fluent-ffmpeg` + binary `ffmpeg-static` (build LGPL-only, codec bebas paten seperti VP9/AV1 untuk WebM, dan H.264 via **OpenH264 (BSD, Cisco)** khusus MP4 agar tidak menyeret kewajiban GPL).

**Kenapa ini penting (Compliance)**:
- FFmpeg secara default (tanpa flag `--enable-gpl`) berlisensi **LGPL v2.1/v3.0**, yang mengizinkan linking ke aplikasi closed-source komersial selama kewajiban LGPL dipenuhi (sertakan notice lisensi, sediakan source FFmpeg yang dipakai, izinkan relinking versi lain).
- Kalau build FFmpeg mengaktifkan `--enable-gpl` (untuk codec seperti **x264/x265**), seluruh bundle jadi tunduk **GPL v3.0**, yang **tidak kompatibel dengan distribusi closed-source proprietary**. Ini krusial karena aplikasi kita dijual/didistribusikan closed-source.
- **Aksi konkret**: gunakan build FFmpeg LGPL-only (tanpa x264/x265 GPL). Untuk H.264 MP4 gunakan **OpenH264** (lisensi BSD, gratis dari Cisco) sebagai encoder alternatif, atau prioritaskan **ProRes 4444** (untuk alpha channel MOV, encoder FFmpeg native tanpa masalah lisensi) dan **VP9/AV1** (untuk WebM dengan alpha, royalty-free) sebagai format utama ekspor alpha channel. MP4 H.264 disediakan sebagai opsi "compatibility export" non-alpha.

| Format Output | Codec | Alpha Channel | Lisensi Aman? |
|---|---|---|---|
| `.mov` | ProRes 4444 | ✅ Ya | ✅ (native FFmpeg, tanpa GPL) |
| `.webm` | VP9 | ✅ Ya | ✅ (royalty-free, LGPL FFmpeg build) |
| `.mp4` | H.264 (via OpenH264) | ❌ Tidak (H.264 tidak native support alpha) | ✅ (BSD) — dipakai untuk green screen / non-transparent export |

### 2.5 AI Integration

- **`@google/genai`** (SDK resmi Google untuk Gemini API) di proses **main** Electron (bukan renderer, demi keamanan API key).
- Gemini dipanggil dengan **structured output / response schema (JSON mode)** agar hasil generate berupa **Motion Blueprint** terstruktur (lihat Bagian 4), bukan teks bebas — mengurangi parsing error.
- **Thinking Level (Low/Medium/High)** dari UI dipetakan ke parameter `thinkingConfig`/`reasoning effort` pada request Gemini API (nilai pasti mengikuti dokumentasi model yang dipilih saat implementasi, karena parameter ini dapat berubah per versi model).

### 2.6 Local Storage & Persistence

- **SQLite via `better-sqlite3`** (MIT) — menyimpan: project (T1/T2 dst), riwayat generate, render job log, pengaturan render terakhir.
- **Electron `safeStorage` API** (built-in, pakai DPAPI di Windows) — enkripsi API key Gemini sebelum disimpan ke disk. Tidak pernah disimpan plain text, tidak pernah di-log.
- File project (`.gencproj`) — JSON berisi konfigurasi + referensi ke motion blueprint, disimpan terpisah dari DB agar bisa di-share/backup manual oleh user.

### 2.7 Ringkasan Stack

```
Electron (Windows-only)
├── Main Process (Node.js/TypeScript)
│   ├── Gemini API Client (@google/genai) — API key rotation & validation
│   ├── SQLite (better-sqlite3) — project/history/settings
│   ├── safeStorage — enkripsi API key
│   ├── Render Job Queue Manager
│   ├── Offscreen BrowserWindow Controller (final render)
│   ├── FFmpeg Wrapper (fluent-ffmpeg, LGPL build) — encoding
│   └── Hardware Detector (GPU/CPU info, app.getGPUInfo())
│
└── Renderer Process (React + TypeScript + Tailwind)
    ├── UI Shell (Top bar, AI Architect panel, Render Settings panel)
    ├── PixiJS Canvas — Live Preview Renderer
    └── IPC Bridge (contextBridge, preload script — kontekstual isolation aktif)
```

---

## 3. Arsitektur Proses & Alur Data

```
[UI: klik Generate]
      │  IPC: generate-request(prompt/images, settings)
      ▼
[Main Process: AI Architect Module]
      │  panggil Gemini API (dengan key aktif dari rotation pool)
      │  response schema dipaksa JSON (Motion Blueprint)
      ▼
[Motion Blueprint disimpan ke SQLite + dikirim balik ke UI]
      │  IPC: blueprint-ready(blueprint)
      ▼
[Renderer: PixiJS Preview Renderer me-render blueprint secara real-time]
      │  (user review, play/pause/scrub, regenerate jika perlu)
      ▼
[UI: klik Render]
      │  IPC: render-request(blueprint, renderSettings)
      ▼
[Main Process: Render Job Queue]
      │  spawn Offscreen BrowserWindow (headless, resolusi & FPS penuh)
      │  render tiap frame blueprint → capture ke buffer PNG (dgn alpha jika Green Screen=OFF/transparent)
      ▼
[FFmpeg Wrapper: encode frame sequence → video file sesuai format/bitrate]
      │
      ▼
[Metadata Generator: generate judul/deskripsi/keyword format Adobe Stock]
      │
      ▼
[Output: file video + metadata tersimpan di folder output user]
```

**Prinsip penting**: Preview Renderer dan Final Render Worker memakai **kode rendering PixiJS yang sama** (shared rendering module), hanya berbeda resolusi/target-canvas dan sumber eksekusi (renderer process vs offscreen window). Ini menjamin "what you preview is what you render" — poin yang disebut di PRD bagian 6.3.

---

## 4. Skema Motion Blueprint (Kontrak AI Architect ↔ Render Engine)

Ini adalah "bahasa perantara" antara hasil Gemini API dan Render Engine. Gemini API **tidak pernah menghasilkan video langsung** — hanya JSON terstruktur berikut:

```json
{
  "blueprintId": "uuid-v4",
  "category": "finance-growth-chart",
  "canvas": { "width": 1080, "height": 1080, "background": "transparent" },
  "durationSec": 15,
  "fps": 60,
  "palette": ["#F5A623", "#4A90D9", "#7ED321"],
  "layers": [
    {
      "id": "bar-1",
      "type": "shape",
      "shape": "rect",
      "properties": { "x": 100, "y": 400, "width": 60, "height": 0, "fill": "#F5A623" },
      "keyframes": [
        { "t": 0.0, "props": { "height": 0 } },
        { "t": 2.0, "props": { "height": 120 }, "easing": "easeOutBack" }
      ]
    },
    {
      "id": "arrow-trend",
      "type": "path",
      "properties": { "stroke": "#D0342C", "strokeWidth": 8 },
      "keyframes": [
        { "t": 1.0, "props": { "pathProgress": 0.0 } },
        { "t": 4.0, "props": { "pathProgress": 1.0 }, "easing": "easeInOutCubic" }
      ]
    }
  ],
  "loop": { "seamless": true },
  "rulesLevel": "high",
  "introOutro": false,
  "noText": true
}
```

Field kunci:
- `layers[].type`: `shape | path | icon | particle | image-ref` (tipe primitif yang didukung Render Engine — dibatasi tegas agar Gemini tidak "berimajinasi" di luar kapabilitas renderer).
- `keyframes[].easing`: enum tertutup (mapped langsung ke fungsi easing PixiJS/GSAP: `linear, easeInOutCubic, easeOutBack, spring, bounce`, dst — sesuai opsi "Rules Animations: Simple/High/Expert" dan "Easing Preset" di PRD).
- `loop.seamless`: dipakai Render Engine untuk validasi frame awal=akhir (fitur "Looping Check" dari PRD 6.1).
- Skema ini **wajib divalidasi** (JSON Schema/Zod) sebelum dikirim ke Render Engine — jika Gemini mengembalikan field di luar skema, request otomatis di-retry dengan instruksi koreksi.

---

## 5. Skema Data Lokal (SQLite)

```sql
-- Projects (T1/T2 dst)
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT,
  created_at DATETIME,
  updated_at DATETIME
);

-- Riwayat generate (per blueprint yang dihasilkan Gemini)
CREATE TABLE generations (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id),
  prompt_text TEXT,
  reference_images TEXT,       -- path lokal, JSON array
  model_used TEXT,
  thinking_level TEXT,
  blueprint_json TEXT,          -- hasil Motion Blueprint tervalidasi
  token_usage INTEGER,
  created_at DATETIME
);

-- Render job
CREATE TABLE render_jobs (
  id TEXT PRIMARY KEY,
  generation_id TEXT REFERENCES generations(id),
  status TEXT,                  -- queued | rendering | encoding | done | failed
  resolution TEXT,
  fps INTEGER,
  format TEXT,
  compute_mode TEXT,            -- cpu | gpu
  bitrate INTEGER,
  output_path TEXT,
  error_message TEXT,
  started_at DATETIME,
  finished_at DATETIME
);

-- API Keys (nilai key TIDAK disimpan di sini — hanya referensi ke safeStorage)
CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,
  label TEXT,
  safe_storage_ref TEXT,        -- pointer terenkripsi
  status TEXT,                  -- valid | rate_limited | invalid
  last_checked_at DATETIME
);
```

---

## 6. Modul Metadata Generator (Format Adobe Stock)

Berdasarkan field submission resmi Adobe Stock Contributor, Metadata Generator menghasilkan:

| Field | Batasan Adobe Stock | Sumber Generasi |
|---|---|---|
| Title | Maks ±200 karakter, deskriptif | Gemini API (prompt turunan dari blueprint `category` + isi visual) |
| Keywords | Maks 49 keyword, urutan relevansi menentukan | Gemini API, di-generate dari kategori + elemen visual + gaya warna |
| Category | Dari daftar kategori Adobe Stock (mis. "Graphic Resources") | Mapping otomatis dari `blueprint.category` ke kategori Adobe Stock terdekat |
| Release info | N/A (motion graphics generik tidak butuh model/property release) | — |

Output disimpan sebagai `.csv` mengikuti format bulk-upload metadata Adobe Stock Contributor, satu baris per file video, agar user tinggal import saat submit.

---

## 7. Keamanan

- API key Gemini: dienkripsi via `safeStorage` (DPAPI Windows), hanya didekripsi di main process saat request ke Gemini, tidak pernah dikirim ke renderer process.
- Electron `contextIsolation: true`, `nodeIntegration: false` pada renderer — komunikasi hanya lewat `contextBridge` API yang didefinisikan eksplisit (preload script) untuk mencegah renderer mengakses Node API langsung.
- Validasi input gambar referensi (magic byte check, bukan hanya ekstensi file) sebelum dikirim ke Gemini API.
- Semua network call keluar dibatasi ke endpoint resmi `generativelanguage.googleapis.com` — tidak ada telemetry pihak ketiga tanpa consent eksplisit.

---

## 8. Deteksi & Fallback Hardware

- Saat startup, main process memanggil `app.getGPUInfo('complete')` untuk deteksi GPU aktif + driver.
- Sebelum job render dimulai, cek ketersediaan encoder GPU (NVENC untuk NVIDIA, AMF untuk AMD, QuickSync untuk Intel) via FFmpeg `-hwaccels`.
- Jika compute mode = GPU tapi hardware/driver tidak mendukung → tampilkan warning di UI, fallback otomatis ke CPU encoding (libaom/libvpx software) dengan estimasi waktu render yang disesuaikan.

---

## 9. Struktur Repository (Usulan)

```
genc-motion-generator/
├── apps/
│   └── desktop/
│       ├── src/
│       │   ├── main/                # Electron main process
│       │   │   ├── ai/              # Gemini client, key rotation, blueprint validator
│       │   │   ├── render/          # Offscreen render controller, job queue
│       │   │   ├── encode/          # FFmpeg wrapper
│       │   │   ├── storage/         # SQLite models, safeStorage helpers
│       │   │   ├── metadata/        # Adobe Stock metadata generator
│       │   │   └── ipc/             # IPC channel handlers
│       │   ├── renderer/            # React UI
│       │   │   ├── components/      # AIArchitectPanel, RenderSettingsPanel, PreviewCanvas, dst
│       │   │   ├── canvas/          # Modul PixiJS shared (dipakai preview & referensi final render)
│       │   │   ├── store/           # Zustand stores
│       │   │   └── styles/
│       │   └── preload/             # contextBridge API definitions
│       └── package.json
├── packages/
│   ├── motion-schema/               # Definisi & validator Motion Blueprint (dipakai main + renderer)
│   └── shared-types/                # TypeScript types bersama
├── docs/
│   ├── PRD_GenC_Motion_Generator.md
│   └── TechDesign_GenC_Motion_Generator.md
└── electron-builder.yml             # Konfigurasi packaging Windows (NSIS installer)
```

---

## 10. Epics Siap Eksekusi (untuk dipecah ke Agent/Antigravity)

| # | Epic | Ringkas Acceptance Criteria |
|---|---|---|
| E1 | **Project Scaffolding** | Electron + React + TS + Tailwind berjalan, window dark-theme kosong sesuai layout referensi (3 kolom: AI Architect / Preview / Render Settings), build & run di Windows sukses |
| E2 | **API Key Management** | User bisa tambah/hapus API key Gemini, key tersimpan terenkripsi (safeStorage), validasi via test call, status indikator per key, rotasi otomatis saat rate-limited |
| E3 | **Motion Blueprint Schema & Validator** | Package `motion-schema` selesai dengan validasi Zod, unit test untuk kasus valid/invalid |
| E4 | **AI Architect — Text Mode** | User input prompt teks → panggil Gemini API dengan schema JSON → blueprint valid tersimpan ke DB → dikirim ke UI |
| E5 | **AI Architect — Image Mode** | Upload hingga 5 gambar → dikirim sebagai referensi visual ke Gemini API → blueprint dihasilkan sesuai gaya gambar |
| E6 | **PixiJS Preview Renderer** | Blueprint dari E4/E5 di-render real-time di kanvas, kontrol play/pause/scrub/reset berfungsi |
| E7 | **Render Settings Panel** | Semua toggle (No Text, Background Animations, Green Screen, Intro/Outro, Rules Animations, Easing) memengaruhi hasil render sesuai definisi Bagian 4 |
| E8 | **Final Render Pipeline (Offscreen + FFmpeg)** | Render job dari blueprint menghasilkan file video sesuai resolusi/FPS/format/bitrate, mendukung alpha channel (MOV ProRes4444, WebM VP9), fallback CPU/GPU berfungsi |
| E9 | **Render Batch Queue UI** | Antrian job tampil real-time (queued/rendering/done/failed), log status seperti referensi UI |
| E10 | **Metadata Generator (Adobe Stock format)** | Setiap hasil render otomatis menghasilkan judul/keyword/kategori, export CSV format bulk-upload Adobe Stock |
| E11 | **Project Save/Load (T1/T2 multi-tab)** | User bisa punya beberapa project aktif, switch tanpa kehilangan state, simpan sebagai file `.gencproj` |
| E12 | **Similarity Checker (opsional MVP+)** | Bandingkan hasil dalam 1 batch, beri skor kemiripan visual |
| E13 | **Packaging & Installer Windows** | Build installer NSIS via electron-builder, code signing (jika sertifikat tersedia), auto-update check |

Setiap epic di atas sudah cukup kecil & spesifik untuk diberikan satu-per-satu ke agent coding (mis. Antigravity) sebagai task terpisah, direview hasilnya, baru lanjut ke epic berikutnya — sesuai rekomendasi tahap eksekusi bertahap.

---

## 11. Keputusan Teknis yang Masih Perlu Divalidasi Saat Implementasi

- Versi pasti parameter `thinkingConfig` Gemini API perlu dicek ke dokumentasi resmi terbaru saat development dimulai (parameter model AI berubah cepat).
- Perlu uji performa nyata PixiJS pada resolusi 4K/60fps offscreen rendering di hardware GPU kelas menengah (RTX 3050 dsb) — jika terlalu lambat, pertimbangkan render frame di resolusi lebih rendah lalu upscale, atau evaluasi ulang kandidat Skia (Bagian 2.3) untuk fase 2.
- Konfirmasi lisensi final build FFmpeg yang dipakai (pastikan tim build benar-benar tidak mengaktifkan `--enable-gpl`) sebagai bagian dari checklist rilis, bukan hanya asumsi di dokumen ini.

---

*Dokumen ini siap dipakai sebagai acuan teknis. Rekomendasi selanjutnya: mulai dari Epic E1–E3 (fondasi) sebelum masuk ke fitur AI/render.*
