# Technical Design Document — GEN(C) Motion Generator
**Lanjutan dari PRD v1.0 — Siap dipecah menjadi task eksekusi (mis. untuk Google Antigravity)**

Versi Dokumen: 1.1 (lihat Bagian 12 untuk perubahan dari v1.0 — migrasi ke waktu ternormalisasi)
Status: Draft untuk Review Teknis
Dokumen Induk: `PRD_GenC_Motion_Generator.md` (v1.1)

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
[Time Remap Layer]
      │  t_detik_asli = progress_ternormalisasi (0.0-1.0) × durasi_pilihan_user (detik)
      │  (lihat Bagian 4 — v1.1: blueprint disusun dalam progress ternormalisasi,
      │   bukan detik absolut; langkah ini mengubah durasi TIDAK memicu re-generate ke Gemini)
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

> **v1.1 — Perubahan Basis Waktu**: Sejak v1.1, `t` pada setiap keyframe adalah **progress ternormalisasi (0.0 – 1.0)** yang mewakili satu siklus loop penuh — **bukan** detik absolut. Field `durationSec` **dihapus dari blueprint** (Gemini tidak lagi menghitung/mengetahui durasi asli). Durasi pilihan user diterapkan sepenuhnya di **Time Remap Layer** (lihat Bagian 3) dengan rumus `t_detik_asli = t_ternormalisasi × durasi_pilihan_user_detik`. Field `loop.seamless` di-cek dengan membandingkan `t: 0.0` vs `t: 1.0` (bukan lagi `t: 0` vs `t: durationSec`).

Ini adalah "bahasa perantara" antara hasil Gemini API dan Render Engine. Gemini API **tidak pernah menghasilkan video langsung** — hanya JSON terstruktur berikut:

```json
{
  "blueprintId": "uuid-v4",
  "category": "finance-growth-chart",
  "canvas": { "width": 1080, "height": 1080, "background": "transparent" },
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
        { "t": 0.4, "props": { "height": 120 }, "easing": "easeOutBack" }
      ]
    },
    {
      "id": "arrow-trend",
      "type": "path",
      "properties": { "stroke": "#D0342C", "strokeWidth": 8 },
      "keyframes": [
        { "t": 0.1, "props": { "pathProgress": 0.0 } },
        { "t": 0.6, "props": { "pathProgress": 1.0 }, "easing": "easeInOutCubic" }
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
- `layers[].type`: `shape | path | icon | particle-system | image-ref` (tipe primitif yang didukung Render Engine — dibatasi tegas agar Gemini tidak "berimajinasi" di luar kapabilitas renderer).

**v1.2 — Primitif `particle-system`** (menggantikan `particle` tunggal): Satu entri layer bisa mendeskripsikan **banyak elemen sejenis sekaligus** secara ringkas, tanpa Gemini perlu menulis satu entri JSON per partikel (yang boros token dan terbukti membuat Gemini "menyerah" generate hanya 1-2 partikel untuk tema seperti "neon particles"). Bentuk properti:

```json
{
  "id": "particle-field",
  "type": "particle-system",
  "properties": {
    "count": 80,
    "area": { "x": 0, "y": 0, "width": 1080, "height": 1080 },
    "sizeRange": [2, 6],
    "colorPalette": ["#39FF14", "#00FFFF", "#FF00FF"],
    "motionPattern": "float-up-wrap",
    "speedRange": [0.05, 0.2],
    "seed": 12345
  }
}
```
- `motionPattern`: enum tertutup (`float-up-wrap`, `orbit-center`, `drift-random`, `fall-wrap`, dst) — Render Engine yang mengeksekusi pola gerak secara **prosedural**, Gemini cukup memilih pola + parameter rentang, tidak perlu keyframe manual per partikel.
- `seed`: wajib diisi Gemini (nilai tetap) — menjamin hasil preview dan final render **identik** (prinsip "what you preview is what you render") karena posisi acak partikel dihasilkan dari PRNG yang sama, bukan `Math.random()` biasa.
- `count` disarankan sistem prompt dalam rentang wajar per kategori (mis. 40–150 untuk field partikel penuh layar) agar visual "penuh", bukan sepi seperti sebelumnya.
- Render Engine mengimplementasikan ini dengan PixiJS `ParticleContainer` untuk performa (ratusan partikel tetap ringan).
- `keyframes[].t`: **progress ternormalisasi 0.0–1.0** (v1.1) — Zod schema memvalidasi bahwa semua nilai `t` berada dalam rentang ini; nilai di luar rentang ditolak dan masuk retry loop.
- `keyframes[].easing`: enum tertutup (mapped langsung ke fungsi easing PixiJS/GSAP: `linear, easeInOutCubic, easeOutBack, spring, bounce`, dst — sesuai opsi "Rules Animations: Simple/High/Expert" dan "Easing Preset" di PRD).
- `layers[].type === "path"` — untuk animasi panjang garis, **satu-satunya** properti keyframe yang sah adalah `pathProgress` (0.0–1.0); properti dari tool lain (`trimStart`/`trimEnd`/`dashOffset`) ditolak validator dengan pesan koreksi eksplisit.
- **Sinkronisasi layer sekunder**: layer aksen/glow/trail wajib mengikuti window waktu (dalam skala 0.0–1.0 yang sama) dengan layer utama yang ditemaninya — tidak boleh punya siklus berulang independen yang tidak sinkron.
- `loop.seamless`: dipakai Render Engine untuk validasi **nilai efektif di `t: 0.0` vs `t: 1.0`** (fitur "Looping Check" dari PRD 6.1), dengan toleransi per jenis properti (lihat `LOOP_TOLERANCES` yang sudah diimplementasikan di E4: ±0.02 untuk normalized properties, ±2px untuk posisi, ±2° untuk rotasi — nilai-nilai ini **tidak berubah** oleh migrasi v1.1, karena tetap dibandingkan pada skala 0.0–1.0).
- Skema ini **wajib divalidasi** (JSON Schema/Zod) sebelum dikirim ke Render Engine — jika Gemini mengembalikan field di luar skema, request otomatis di-retry dengan instruksi koreksi.

### 4.1 Time Remap — Kontrak dengan Render Engine

Render Engine (Preview & Final Render Worker) menerima **dua** input terpisah, bukan satu:
1. Motion Blueprint tervalidasi (waktu ternormalisasi 0.0–1.0).
2. `durationSec` — nilai dari "Time Anim (sec)" di Render Settings Panel, **ditentukan user di UI, tidak pernah oleh Gemini**.

Sebelum evaluasi interpolator (`interpolator.ts`), waktu playback riil (detik, dari RAF loop atau scrubber) di-remap balik ke skala ternormalisasi: `t_ternormalisasi = t_playback_detik / durationSec`, lalu blueprint dievaluasi seperti biasa. Mengubah `durationSec` di UI **cukup memicu re-render preview dengan skala baru** — tidak memicu request baru ke Gemini API.

### 4.2 Aspect Ratio Constraint & Render Viewport

Sesuai kebutuhan platform microstock dan format video modern, rasio kanvas dikendalikan melalui "Aspect Ratio" di Render Settings Panel:
- `16:9` (Landscape) → `canvas.width: 1920, canvas.height: 1080` (standar YouTube, broadcast, microstock video)
- `9:16` (Portrait / Vertical) → `canvas.width: 1080, canvas.height: 1920` (standar TikTok, Instagram Reels, Shorts)
- `1:1` (Square) → `canvas.width: 1080, canvas.height: 1080` (standar feed post, avatar, motion icon)

Prinsip Operasional:
1. **Locked Constraint ke AI Architect**: Nilai dimensi kanvas (`width` & `height`) dikunci berdasarkan pilihan user di UI dan disuntikkan ke system prompt Gemini sebagai constraint wajib. Gemini dilarang mengubah resolusi/rasio ini.
2. **Schema & Aspect Ratio Validation**: `validateMotionBlueprint` memvalidasi bahwa `canvas.width` dan `canvas.height` pada blueprint tepat sesuai dengan aspect ratio yang diminta. Jika terjadi deviasi, validator menolak blueprint dan masuk ke retry loop dengan pesan instruksi koreksi spesifik.
3. **Viewport Scaling & Fitting**: `pixi-renderer.ts` dan `PreviewCanvas.tsx` menghitung skala dengan rasio terjaga (`scale = Math.min(canvasWidth / bpWidth, canvasHeight / bpHeight)`), menerapkan letterboxing atau pillarboxing secara otomatis agar kanvas preview pas di dalam window tanpa distorsi.

### 4.3 Temuan Bias Kategori & Prinsip "Strict Prompt Fidelity"

Berdasarkan pengujian manual, model Gemini memiliki kecenderungan menambahkan elemen visual liar di luar apa yang secara eksplisit diminta (mis. menyelipkan bar chart, lingkaran/cincin dekoratif, atau partikel pemanis) sebagai bentuk improvisasi kreatif yang tidak diinginkan.

Solusi Arsitektur:
1. **Prinsip Universal "Strict Prompt Fidelity"**:
   - Setiap layer dalam komposisi akhir **wajib dapat ditelusuri langsung** ke kata/frasa pada prompt user.
   - **Pre-Finalization Self-Check**: Sebelum JSON blueprint dikeluarkan, Gemini wajib mengevaluasi setiap layer: *"Apakah elemen ini benar-benar bagian dari tema yang diminta, atau saya menambahkannya sendiri sebagai pemanis?"* — jika jawabannya *"saya tambahkan sendiri"*, elemen tersebut **wajib dihapus**.
   - **Pengecualian yang Diizinkan**: Pemilihan palet warna harmonis, variasi kedalaman/kecepatan/jumlah elemen **sejenis** (misal 2 layer partikel untuk efek parallax latar dan depan), serta variasi timing/easing.
   - **Larangan Keras**: Dilarang menambah kategori elemen baru yang tidak tersirat (misal shape cincin/aura ke tema partikel, partikel ke tema gelombang atau geometri, bar chart ke tema non-data, dsb).
2. **Pembersihan Murni Few-Shot Examples**:
   - Keempat contoh few-shot pada system prompt dibersihkan sepenuhnya dari elemen lintas-kategori:
     - *Neon Particles*: 100% murni layer `particle-system` (zero shape, zero ring, zero line).
     - *Rotating Rings*: 100% murni bentuk geometris berputar (tanpa partikel pemanis).
     - *Flowing Waves*: 100% murni kurva path bergelombang (tanpa partikel pemanis).
     - *Finance Growth Chart*: 100% murni batang chart dan garis tren (tanpa ambient dust).

### 4.4 Prinsip Umum: "Visual Richness Floor" (Kepadatan & Kedalaman Wajib per Komposisi)

Setelah perbaikan "Strict Prompt Fidelity" (Bagian 4.3), model Gemini berhasil membersihkan elemen yang tidak relevan. Namun, timbul efek samping berupa *over-correction*: Gemini menafsirkan larangan menambah elemen di luar tema sebagai alasan untuk membuat komposisi seminimal mungkin (mis. hanya 1-3 elemen kesepian di tengah kanvas).

Untuk menjamin hasil gerak memiliki nilai komersial tinggi dan estetika yang memukau tanpa melanggar kemurnian tema, ditetapkan aturan **Visual Richness Floor**:

1. **Distingsi Kritis (Larangan vs Keharusan)**:
   - *Yang tetap DILARANG*: Menambahkan jenis/kategori primitif asing yang tidak tersirat dari prompt (mis. bar chart di tema partikel, cincin di tema partikel, partikel di tema geometri/wave tanpa diminta).
   - *Yang WAJIB dilakukan*: Elemen yang merupakan bagian dari tema yang diminta wajib dihadirkan dengan kepadatan dan kedalaman visual yang kaya, bukan sekadar representasi minimalis/literal.

2. **Empat Pilar Visual Richness Floor**:
   - **Cakupan Pola Berulang $\ge 60\%-70\%$ Area Kanvas**: Untuk tema dengan kata yang mengimplikasikan distribusi/pola berulang (grid, kisi, lattice, matrix, dots, field, swarm, starfield, rain, digital rain, mesh), elemen wajib didistribusikan merata menutupi $\ge 60\%-70\%$ luas kanvas aktif, bukan hanya 1–3 instans kecil di tengah.
   - **Kedalaman Visual Berlapis (Visual Depth)**: Objek inti tidak boleh berupa satu warna solid datar. Wajib menerapkan minimal satu teknik kedalaman:
     - *Multi-Stroke / Layered Glow*: Tumpukan 2–3 stroke pada path/shape yang sama (mis. stroke luar tebal semi-transparan sebagai pendaran cahaya + stroke dalam tipis tajam dengan warna terang/kontras).
     - *Hierarki Skala / Ukuran*: Variasi skala dan opasitas antar instans (elemen latar lebih kecil dan lembut, elemen depan lebih besar dan tegas) untuk ilusi z-depth.
     - *Struktur Konsentris / Multi-Tier*: Poligon atau cincin bertingkat dengan ritme gerak harmonis.
   - **Presisi Matematis Bentuk Geometris (SVG Path)**:
     - *Spiral (Archimedes/Vortex)*: Radius kurva wajib melebar seiring bertambahnya sudut ($r = a + b\theta$), diekspresikan sebagai path SVG multi-putaran ($720^\circ-1080^\circ$) yang menjalar keluar dari pusat $(cx, cy)$. Dilarang hanya memutar busur pendek statis.
     - *Gelombang Sinusoidal*: Membentang penuh di seluruh lebar kanvas dengan kurva harmonis berirama.
     - *Simetri Radial*: Pembagian sudut yang presisi secara matematis ($360^\circ / N$).
   - **Penskalaan Kepadatan terhadap Rasio Aspek (Aspect-Aware Density Scaling)**:
     - Pada kanvas 16:9 widescreen ($1920\times 1080$), perbanyak sebaran kolom dan instans secara lateral agar tepi kanvas tidak tampak kosong.
     - Pada kanvas 9:16 vertikal ($1080\times 1920$), tonjolkan pergerakan kaskade vertikal.
     - Pada kanvas 1:1 ($1080\times 1080$), jaga keseimbangan simetri matriks atau radial.

3. **Few-Shot Examples Pelengkap Kepadatan**:
   - Menambahkan contoh 5 (*Animated Geometric Grid / Lattice*) yang mendemonstrasikan kisi matriks padat dengan cakupan $\ge 70\%$ area kanvas.
   - Menambahkan contoh 6 (*Mathematically Precise Archimedean Spiral*) yang mendemonstrasikan formula kurva spiral $r = a + b\theta$ multi-turn dan layered glow stroke.
   - Kedua contoh baru ini membuktikan bahwa "setia pada tema" dan "padat/detail" berjalan berdampingan.

### 4.5 Enforcement Enum Shape, Pivot Rotasi In-Place, & Anti-Copy-Paste Few-Shot

Berdasarkan pengujian manual lanjutan terhadap model generatif dan pipeline preview canvas:

1. **Enum Tertutup Shape (`rect | circle | polygon | star`)**:
   - `motion-schema` memperketat validasi `layer.shape` menjadi enum tertutup `SUPPORTED_SHAPES = ['rect', 'circle', 'polygon', 'star']`.
   - Nama bentuk mandiri di luar enum ditolak validator dan memicu auto-retry. Khusus untuk nama bentuk poligon umum seperti `"hexagon"`, `"pentagon"`, `"octagon"`, `"triangle"`, validator memberikan pesan penolakan yang presisi dan terstruktur, mis.:
     `"Shape 'hexagon' tidak didukung. Gunakan shape: 'polygon' dengan properti 'sides: 6' untuk membuat hexagon."`
   - Render engine mengimplementasikan poligon bersisi-$n$ secara prosedural via `graphics.poly(...)` berdasarkan sudut rotasi reguler $(i \times \frac{2\pi}{N} - \frac{\pi}{2})$.

2. **In-Place Rotation Pivot pada Render Engine (`pixi-renderer.ts`)**:
   - Sebelumnya, `container.pivot` dan `container.position` berada di `(0, 0)`, sehingga saat layer memiliki keyframe `rotation`, objek terlempar mengelilingi titik asal global kanvas alih-alih berputar di porosnya.
   - Solusi: Menghitung titik pusat geometris objek (`pivotX`, `pivotY`) secara eksplisit:
     - Shape `circle`, `star`, `polygon`: pusat di $(x, y)$.
     - Shape `rect`: pusat di $(x + width / 2, y + height / 2)$.
     - Layer `path`: titik pusat $(props.x, props.y)$ atau centroid *bounding box* dari titik kurva SVG yang disampel.
   - Mengeset `container.pivot.set(pivotX, pivotY)` dan `container.position.set(pivotX, pivotY)`. Identitas transformasi ini menjamin:
     - Pada `rotation = 0` dan `scale = 1`: posisi objek identik 100% dengan koordinat aslinya.
     - Pada rotasi $0^\circ \to 360^\circ$: pusat objek tetap diam di koordinat yang sama sepanjang waktu (hanya orientasi visual yang berputar).
     - Pada `scale`: pembesaran/pengecilan terjadi secara simetris dari pusat objek.

3. **Prinsip Anti-Copy-Paste Few-Shot**:
   - Few-shot examples di system prompt ditegaskan sebagai **referensi pola/struktur**, bukan jawaban final untuk disalin.
   - Gemini dilarang keras mereplikasi nilai numerik mentah (seperti koordinat statis, warna hex spesifik, dan tinggi bar chart dari contoh finance chart).
   - Gemini wajib menghitung nilai numerik baru secara dinamis sesuai detail prompt pengguna.

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
| E4 | **AI Architect — Text Mode** | User input prompt teks → panggil Gemini API dengan schema JSON (v1.1: blueprint dalam progress ternormalisasi 0.0–1.0, bukan detik) → blueprint valid tersimpan ke DB → dikirim ke UI |
| E5 | **AI Architect — Image Mode** | Upload hingga 5 gambar → dikirim sebagai referensi visual ke Gemini API → blueprint dihasilkan sesuai gaya gambar |
| E6 | **PixiJS Preview Renderer** | Blueprint dari E4/E5 di-render real-time di kanvas, kontrol play/pause/scrub/reset berfungsi. v1.1: menerapkan Time Remap (Bagian 4.1) — playback di-remap dari detik pilihan user ke skala ternormalisasi sebelum evaluasi interpolator |
| E7 | **Render Settings Panel** | Semua toggle (No Text, Background Animations, Green Screen, Intro/Outro, Rules Animations, Easing) memengaruhi hasil render sesuai definisi Bagian 4. v1.1: "Time Anim (sec)" kini murni parameter Time Remap (slow-motion stretch) — mengubahnya tidak memicu generate ulang ke Gemini |
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

## 12. Changelog v1.0 → v1.1 (Migrasi ke Waktu Ternormalisasi)

Perubahan ini dipicu oleh pola bug kualitas berulang yang ditemukan saat pengujian manual Epic E4 & E6 dengan API Gemini asli (loop tidak seamless, properti path tak dikenal, durasi fade tidak proporsional, layer aksen tidak sinkron) — akar masalahnya sama: Gemini harus menghitung sendiri waktu absolut dalam detik untuk seluruh durasi, rawan salah/tidak konsisten. Rincian keputusan produk ada di `PRD_GenC_Motion_Generator.md` Bagian 13; ringkasan dampak teknisnya:

| Area | v1.0 (lama) | v1.1 (baru) |
|---|---|---|
| Basis waktu blueprint (`keyframes[].t`) | Detik absolut (0 – `durationSec`) | Progress ternormalisasi (0.0 – 1.0), satu siklus loop |
| Field `durationSec` di blueprint | Ada, ditentukan Gemini | **Dihapus** dari blueprint — durasi murni parameter UI |
| Peran durasi pilihan user | Bagian dari apa yang Gemini "pikirkan" | Parameter **Time Remap** di render/preview (Bagian 4.1); ubah durasi = re-render, bukan re-generate |
| Mekanisme perpanjangan durasi | N/A (Gemini generate sesuai durasi diminta) | Slow-motion stretch (satu siklus diregangkan), **bukan** tile/repeat loop |
| Loop consistency check | Bandingkan `t: 0` vs `t: durationSec` | Bandingkan `t: 0.0` vs `t: 1.0` — toleransi (`LOOP_TOLERANCES`) tidak berubah |
| Validasi properti path (`pathProgress`-only) | Berlaku, dalam skala detik | Tetap berlaku, dalam skala 0.0–1.0 |
| Sinkronisasi layer sekunder/aksen | Instruksi prompt saja (rawan diabaikan Gemini) | Terjamin lebih struktural — semua layer berbagi skala waktu 0.0–1.0 yang sama |
| Galeri tema preset (opsi yang dipertimbangkan) | — | **Tidak diadopsi.** Prompt teks bebas dipertahankan, diarahkan via placeholder ke tema singkat |

**Epic yang terdampak dan perlu penyesuaian kode** (lihat catatan v1.1 di baris masing-masing pada Bagian 10): E3 (schema `motion-schema` — validasi rentang `t`, hapus `durationSec`), E4 (system prompt Gemini disusun ulang untuk waktu ternormalisasi), E6 (tambahan Time Remap sebelum interpolator).

**Risiko yang tetap ada, tidak diselesaikan migrasi ini**: kegagalan geometri untuk konsep visual presisi (mis. ikon) — lihat PRD Bagian 13 bagian "Risiko yang TIDAK Diselesaikan".

---

*Dokumen ini siap dipakai sebagai acuan teknis. Untuk proyek yang sudah berjalan (Epic E1–E6 selesai), langkah selanjutnya adalah task migrasi v1.1 pada `motion-schema`, `ai-architect.ts`/`system-prompt.ts`, dan `interpolator.ts`/`pixi-renderer.ts` sebelum melanjutkan ke Epic E7 dst.*

---

## 13. Migrasi v2.0 — Arsitektur Eksekusi Kode Canvas2D (Generative Code Sandbox)

### 13.1 Latar Belakang & Motivasi Pivot
Pada implementasi v1.x, AI Architect menghasilkan struktur data JSON deklaratif (Motion Blueprint) yang di-parse dan di-render oleh engine berbasis PixiJS. Pendekatan ini memiliki keterbatasan intrinsik dalam menangani animasi kompleks (seperti partikel fluida, fraktal, gelombang matematika, efek distorsi dinamis, atau visualisasi data lanjutan) karena model AI harus memetakan seluruh logika visual ke dalam keyframes statis.

Pada v2.0, sistem bertransisi ke **Generative Code Execution**: AI Architect menyusun kode JavaScript prosedural murni untuk fungsi render Canvas2D:
```typescript
function drawFrame(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  t: number,
  width: number,
  height: number,
  opts: SandboxOptions
): void;
```
Karena kode yang dieksekusi dihasilkan oleh model AI eksternal, **keamanan adalah prioritas mutlak**. Seluruh eksekusi harus melalui sistem sandbox bertingkat (*defense-in-depth*) sebelum dapat dijalankan di lingkungan aplikasi.

---

### 13.2 Kontrak Keamanan & Pre-Execution Static Analysis
Sebelum kode dikirim ke thread eksekusi, kode di-scan secara statis oleh modul `static-analyzer.ts`. Kode akan langsung ditolak tanpa alokasi worker jika mengandung identifier terlarang atau teknik bypass berikut:

1. **Jaringan & I/O Eksternal**: `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`, `openDatabase`.
2. **Evaluasi Kode Dinamis**: `eval`, `Function(`, `AsyncFunction`, `GeneratorFunction`, `WebAssembly`, `importScripts`.
3. **Module Loading & Node.js Runtime**: `import(`, `require(`, `module`, `exports`, `process`, `__dirname`, `__filename`, `Buffer`.
4. **Objek Global Host**: `window`, `document`, `globalThis`, `self`, `top`, `parent`, `frames`, `global`.
5. **Penyimpanan Lokal**: `localStorage`, `sessionStorage`, `indexedDB`, `cookieStore`, `caches`.
6. **Threading & Messaging**: `Worker`, `SharedWorker`, `ServiceWorker`, `postMessage`, `onmessage`, `addEventListener`, `removeEventListener`.
7. **Navigasi & Dialog UI**: `location`, `navigator`, `alert`, `prompt`, `confirm`, `open`, `close`.
8. **Introspeksi Prototipe & Reflection**: `constructor`, `__proto__`, `prototype`, `Reflect`, `Proxy`. Akses terhadap `.constructor`, `['constructor']`, ``[`constructor`]``, maupun manipulasi string concatenation (`['con' + 'structor']`) ditolak tegas.
9. **Manipulasi Timer**: `setTimeout`, `setInterval`, `setImmediate`, `requestAnimationFrame`. Frame render wajib berupa fungsi deterministik murni terhadap `t`.
10. **Escape Obfuscation**: String kode didekode terlebih dahulu dari unicode escapes (`\uXXXX`) dan hex escapes (`\xXX`) sebelum pencocokan token untuk mencegah teknik bypass seperti `\u0065val`.

---

### 13.3 Isolasi Eksekusi: Web Worker & OffscreenCanvas
1. **Background Thread**: Eksekusi kode berlangsung di dalam Web Worker terisolasi (`canvas-worker.ts`), terpisah dari UI thread dan Electron main process.
2. **OffscreenCanvas**: Rendering dilakukan pada `OffscreenCanvas`. Hasil render dikembalikan sebagai zero-copy transferable `ImageBitmap` (atau buffer `ImageData` sebagai fallback).
3. **50ms Watchdog Timeout Guard**: Host thread (`sandboxed-code-executor.ts`) memasang watchdog timer dengan batas maksimal 50ms per frame. Jika kode mengandung infinite loop (mis. `while (true) {}`) atau eksekusi melebihi 50ms:
   - Worker langsung dihentikan paksa via `worker.terminate()`.
   - Instance worker baru yang bersih otomatis di-respawn untuk request berikutnya.
   - Host mengembalikan status gagal (`{ success: false, timedOut: true, error: "Execution timed out (> 50ms)" }`) tanpa menghasilkan frame parsial.

---

### 13.4 Surface API Minimal & Seeded PRNG
1. **Scope Shadowing**: Di dalam worker, wrapper fungsi strict mode meng-shadow seluruh variabel global berbahaya menjadi `undefined`.
2. **Parameter Terbatas**: Satu-satunya yang dapat diakses oleh kode yang dieksekusi adalah:
   - `ctx`: Konteks Canvas 2D standar (`CanvasRenderingContext2D` / `OffscreenCanvasRenderingContext2D`).
   - `t`: Progress ternormalisasi `[0.0, 1.0]`.
   - `width`: Lebar kanvas (integer pixel).
   - `height`: Tinggi kanvas (integer pixel).
   - `opts`: Objek opsi terisolasi, menyediakan `opts.random()` ber-seed Mulberry32 (`createPRNG` dari `prng.ts`). `Math.random()` dialihkan ke delegasi `opts.random()`.
3. **Pembekuan Prototipe**: `Object.freeze(Object.prototype)`, `Object.freeze(Function.prototype)`, dan `Object.freeze(Array.prototype)` diterapkan pada worker untuk mencegah eksploitasi prototype pollution.

---

### 13.5 Roadmap Tahapan Migrasi v2.0
- **Tahap 1 (Selesai)**: Fondasi Keamanan & Sandboxed Code Execution Engine (Pre-execution Static Analysis, Worker Isolation, 50ms Watchdog Timeout, Mulberry32 PRNG, Handcrafted Test Samples, Unit Tests).
- **Tahap 2**: Migrasi AI Architect — Penyusunan System Prompt v2.0, instruksi pembuatan kode fungsi Canvas2D `drawFrame`, dan validasi kode via static analysis.
- **Tahap 3**: Migrasi Render Engine & Preview UI — Integrasi `PreviewCanvas` dan final render pipeline untuk menampilkan output ImageBitmap dari SandboxedCodeExecutor.