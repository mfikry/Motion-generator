# AGENTS.md — GEN(C) Motion Generator

Instruksi ini berlaku untuk semua agent coding (mis. Google Antigravity) yang bekerja di repository ini. Baca file ini SEBELUM mengerjakan task apa pun. Dokumen acuan lengkap ada di `/docs/PRD_GenC_Motion_Generator.md` dan `/docs/TechDesign_GenC_Motion_Generator.md` — baca keduanya untuk konteks penuh sebelum mulai coding.

---

## 1. Prinsip Kerja

- **Kerjakan satu epic dalam satu waktu**, sesuai urutan di Tech Design Bagian 10 (E1 → E2 → E3 → ...), kecuali diinstruksikan lain secara eksplisit di task.
- **Jangan mengerjakan epic lain** di luar task yang diberikan, walau terlihat "sekalian saja". Tunggu instruksi task berikutnya.
- Jika task ambigu atau ada keputusan teknis yang belum dibahas di Tech Design, **tanyakan dulu** — jangan berasumsi, terutama untuk keputusan yang menyangkut lisensi, arsitektur inti, atau UX.
- Setiap selesai satu epic, pastikan aplikasi bisa **di-build dan dijalankan** (`npm run dev` atau setara) tanpa error sebelum melaporkan task selesai.

---

## 2. Batasan Teknis KERAS (Tidak Boleh Dilanggar)

- **OS target: Windows 10/11 saja.** Jangan menambahkan dependency atau kode yang spesifik-platform lain (macOS/Linux) di fase ini.
- **Lisensi library: hanya MIT, BSD, Apache-2.0, atau LGPL yang comply untuk closed-source commercial.**
  - **DILARANG** menambahkan library berlisensi **GPL** (termasuk build FFmpeg dengan flag `--enable-gpl`, atau library apa pun yang mewajibkan source code aplikasi ikut open-source).
  - **DILARANG** menambahkan library dengan lisensi freemium/berbayar (seperti Remotion) tanpa konfirmasi eksplisit dari saya terlebih dahulu.
  - Sebelum menambah dependency baru yang belum disebut di Tech Design, **sebutkan nama library + lisensinya** di laporan hasil kerja agar saya bisa review.
- **FFmpeg wajib pakai build LGPL** (default, tanpa `--enable-gpl`). Untuk H.264 gunakan OpenH264 (BSD), untuk alpha channel gunakan ProRes4444 (MOV) atau VP9 (WebM).
- **Render engine: PixiJS** sebagai fondasi (sesuai Tech Design Bagian 2.3). Jangan mengganti ke library lain tanpa diskusi.
- **API key Gemini tidak boleh pernah**: di-hardcode di kode, di-log ke console/file log, atau dikirim ke renderer process. Selalu lewat `safeStorage` di main process saja.
- **Tidak ada fitur audio** di fase ini — jangan menambahkan dependency audio/codec audio kompleks di luar kebutuhan dasar container video.

---

## 3. Coding Style & Struktur

- **TypeScript strict mode** aktif di seluruh project (main, renderer, packages).
- Ikuti struktur folder yang sudah didefinisikan di Tech Design Bagian 9 (`apps/desktop/src/main`, `renderer`, `preload`, `packages/motion-schema`, dll) — jangan membuat struktur folder baru yang menyimpang tanpa alasan kuat.
- Electron: `contextIsolation: true`, `nodeIntegration: false` di semua BrowserWindow — komunikasi main↔renderer HANYA lewat `contextBridge` di preload script.
- Semua data yang dipertukarkan antara AI Architect dan Render Engine **harus divalidasi** terhadap Motion Blueprint schema (package `motion-schema`, Zod) sebelum dipakai — tolak/retry jika tidak valid, jangan "dipaksakan render".
- Tulis unit test minimal untuk: validator schema, modul enkripsi API key, dan modul metadata generator — ketiganya adalah bagian yang paling kritikal untuk kebenaran & keamanan.

---

## 4. Urutan Prioritas Epic (ringkas — detail lengkap di Tech Design Bagian 10)

1. E1 — Project Scaffolding
2. E2 — API Key Management
3. E3 — Motion Blueprint Schema & Validator
4. E4 — AI Architect (Text Mode)
5. E5 — AI Architect (Image Mode)
6. E6 — PixiJS Preview Renderer
7. E7 — Render Settings Panel
8. E8 — Final Render Pipeline (Offscreen + FFmpeg)
9. E9 — Render Batch Queue UI
10. E10 — Metadata Generator (Adobe Stock format)
11. E11 — Project Save/Load (multi-tab T1/T2)
12. E12 — Similarity Checker (opsional)
13. E13 — Packaging & Installer Windows

---

## 5. Definisi "Selesai" (Definition of Done) per Task

Sebuah task/epic dianggap selesai jika:

- [ ] Kode berhasil di-build tanpa error/warning kritis
- [ ] Fitur bisa dijalankan & diuji manual sesuai acceptance criteria di Tech Design
- [ ] Tidak melanggar batasan di Bagian 2 dokumen ini
- [ ] Perubahan/dependency baru dilaporkan dengan jelas (apa yang ditambah, kenapa, lisensinya apa)
- [ ] Tidak ada API key, secret, atau kredensial ter-commit ke repo

---

_Jika ada konflik antara file ini dan Tech Design/PRD, prioritaskan AGENTS.md untuk hal teknis-operasional (batasan lisensi, cara kerja), dan Tech Design untuk detail arsitektur/skema._
