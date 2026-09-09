# PRD — GEN(C) Motion Generator
**Motion Graphics Generator berbasis AI untuk Konten Microstock**

Versi Dokumen: 1.0
Status: Draft untuk Review
Referensi UI: Screenshot "GEN (C) EMAS V18 FINAL"

---

## 1. Ringkasan Eksekutif

GEN(C) Motion Generator adalah aplikasi desktop (Windows-first, cross-platform opsional) yang memungkinkan konten kreator/microstocker membuat **motion graphics animasi pendek** (grafik, ikon, elemen visual bergerak) secara otomatis menggunakan AI generatif (Google Gemini), lalu me-render hasilnya ke format video profesional (MP4/MOV/WEBM, termasuk alpha channel) yang siap diunggah ke platform microstock seperti Adobe Stock, Shutterstock, Pond5, Envato Elements, dsb.

Aplikasi menggabungkan tiga lapisan:
1. **AI Architect** — lapisan generatif berbasis Gemini API (text-to-motion-spec / image-to-motion-spec) yang menyusun "resep animasi" (motion blueprint) dari prompt teks atau gambar referensi.
2. **Render/Preview Engine** — lapisan rendering real-time (preview) dan lapisan render final (CPU/GPU) yang mengubah motion blueprint menjadi file video/animasi berkualitas ekspor.
3. **Studio Shell (UI)** — antarmuka kontrol untuk pengaturan render, manajemen API key, batch generation, dan manajemen output.

---

## 2. Latar Belakang & Masalah yang Dipecahkan

Microstocker motion graphics saat ini menghadapi masalah:
- Membuat motion graphics manual (After Effects dkk) memakan waktu lama per aset.
- Kebutuhan volume tinggi & variasi tinggi (microstock butuh banyak aset unik agar tidak "similar/duplicate" dan ditolak reviewer).
- Kebutuhan teknis ekspor spesifik microstock: resolusi 4K, frame rate standar, format alpha/green screen, tanpa watermark, tanpa elemen berhak cipta pihak ketiga.
- Biaya render tinggi jika mengandalkan cloud rendering render farm.

Aplikasi ini menjawab dengan: AI menyusun variasi & struktur animasi secara otomatis (mengurangi kerja manual), sementara rendering final dilakukan lokal (CPU/GPU user) agar biaya operasional rendah dan output dapat diperjualbelikan bebas royalti ke pihak ketiga (bukan hasil generate image/video AI closed-source yang lisensinya abu-abu — animasi disusun dari primitif vektor/motion yang di-generate & dirender lokal).

---

## 3. Target Pengguna

- Microstocker/kreator konten stok (individu maupun tim kecil) yang menjual motion graphics.
- Editor video/motion designer yang butuh mempercepat produksi elemen b-roll bergerak (chart, ikon, transisi, lower third, dsb).
- Agency konten yang memproduksi aset visual dalam volume besar untuk banyak channel (Reels, Shorts, stock).

**Bukan** target utama: pembuatan video sinematik kompleks/karakter animasi penuh (out of scope tahap awal).

---

## 4. Tujuan Produk & Metrik Sukses

| Tujuan | Metrik |
|---|---|
| Mempercepat produksi motion graphics | Waktu dari ide → file video final < 5 menit/aset (untuk durasi 10–20 detik) |
| Hasil layak jual di microstock | ≥90% hasil generate lolos syarat teknis platform (resolusi, format, tanpa watermark, tanpa elemen copyrighted) tanpa revisi manual |
| Efisiensi biaya generatif | 1 API key Gemini gratis/berbayar cukup untuk puluhan generate/hari (dengan rotasi key) |
| Skalabilitas produksi | User bisa menghasilkan ≥5 variasi otomatis per batch tanpa duplikasi visual signifikan |
| Reliabilitas render lokal | Render sukses (tanpa crash/corrupt file) ≥98% dari total render job |

---

## 5. Ringkasan Fitur (berdasarkan referensi UI)

### 5.1 Top Bar
- **Branding & versi produk** (nama app, tagline "Motion Graphics Real Time").
- **Check for Update** — cek versi terbaru aplikasi (auto-update opsional).
- **Tour** — walkthrough onboarding interaktif untuk user baru.
- **Lite Mode** — mode ringan yang menonaktifkan animasi UI/preview real-time berat, untuk perangkat spesifikasi rendah.
- **Day/Night theme toggle**.

### 5.2 Panel "Models" & Thinking Level (kanan atas)
- **Pemilihan model AI**: dropdown model Gemini (mis. Gemini 3.6F) + opsi **Custom** (user bisa memasukkan model ID lain / self-hosted endpoint kompatibel, untuk fleksibilitas ke depan).
- **Thinking Level**: Low / Medium / High — mengatur "kedalaman reasoning" model saat menyusun motion blueprint:
  - *Low*: respon cepat, struktur animasi sederhana, cocok untuk iterasi cepat/preview.
  - *Medium*: keseimbangan kecepatan & kualitas variasi.
  - *High*: model mempertimbangkan lebih banyak variasi komposisi, easing, timing, dan detail visual — lebih lambat tapi hasil lebih matang/siap jual.

### 5.3 Manajemen API Key Gemini
- Kolom status jumlah key aktif (mis. "5/5").
- Tombol **Masukkan API** untuk menambah/mengelola multiple Gemini API key.
- **Key rotation otomatis**: saat 1 key kena rate limit/quota habis, sistem otomatis pindah ke key berikutnya tanpa menghentikan job.
- Validasi key saat dimasukkan (test call ringan ke Gemini API untuk memastikan key valid & punya kuota).
- Enkripsi penyimpanan API key secara lokal (tidak pernah dikirim ke server pihak ketiga selain langsung ke endpoint Gemini resmi).
- Indikator kuota/health per key (mis. warna hijau/kuning/merah berdasar sisa kuota atau error rate).

### 5.4 Panel "AI Architect" (kiri)
- Mode input: **Text** atau **Image**.
  - *Text mode*: user mengetik deskripsi konsep animasi (mis. "grafik batang pertumbuhan naik, gaya flat corporate, warna biru-oranye").
  - *Image mode*: user upload hingga 5 gambar referensi (JPG/PNG/WEBP, drag & drop atau klik) — AI menganalisis gaya/warna/komposisi dari gambar sebagai acuan motion blueprint.
- **Preset kategori cepat** (ikon shortcut, contoh di UI: ikon grafik naik) — kumpulan template niche populer microstock: Finance/Growth Chart, Real Estate, Food & Restaurant, Wedding/Event, Medical/Health, Technology/UI mockup, Nature/Eco, Corporate/Business, Education, Social Media Icons, dll.
- **Generate: jumlah variasi** (1–5) — berapa banyak variasi unik dihasilkan dari satu prompt/gambar dalam satu klik generate (anti-similarity: tiap variasi punya perbedaan komposisi/warna/timing agar tidak dianggap duplikat oleh reviewer stock).
- **Batch Size** (1–5) — berapa banyak *batch job* diproses berurutan/paralel.
- **Total Tasks counter** — total antrian job yang akan diproses (variasi × batch).
- Tombol **Generate** (memicu AI Architect menyusun motion blueprint) dan **Open** (membuka folder/file hasil terakhir).
- **Tab T1 / T2** — slot/tab project berbeda agar user bisa kerja di beberapa proyek/konsep sekaligus tanpa kehilangan progres.

### 5.5 Area Preview Suite (tengah)
- **Preview Suite** (tab aktif) — live preview hasil animasi di kanvas.
- **Render Batch** — daftar antrian render dengan badge jumlah job aktif.
- **Tutorial** — panduan penggunaan in-app.
- **Kanvas preview**: menampilkan animasi secara real-time; default background hijau (chroma key) agar user bisa langsung menilai kesiapan aset untuk dikomposit.
- **Kontrol playback**: Play/Pause, Reset/Replay, Fullscreen preview, progress bar/scrubber waktu.
- **Indikator waktu (detik)** sinkron dengan pengaturan Time Anim di panel kanan.
- **Log status** di bawah kanvas (mis. "[IMAGE] DONE! 2/2 ANIMATIONS GENERATED.") — feed real-time status tiap job (queued/generating/rendering/done/failed).

### 5.6 Neural Engine & Output Settings (bawah tengah)
- **Resolusi**: dropdown (mis. 4K Ultra, 1080p, 720p, custom).
- **Frame rate**: dropdown (24/30/60 FPS).
- **Format file**: dropdown (.MP4, .MOV, .WEBM, .MOV ProRes 4444 untuk alpha, .APNG/.GIF untuk kebutuhan tertentu).
- **Compute mode**: pilihan **CPU** atau **GPU** untuk proses rendering final.
  - Auto-deteksi GPU terpasang (contoh UI: "GPU (NVIDIA RTX 3050)") dengan indikator status siap pakai.
  - Fallback otomatis ke CPU jika GPU tidak kompatibel/driver bermasalah.
- **Bitrate**: mode CBR/VBR + input nilai kbps manual.
- **Folder output**: pemilih lokasi penyimpanan hasil render (mis. "G:\CEMAS...").
- **Add Batch**: menambahkan konfigurasi render tambahan ke antrian tanpa mengubah job yang sedang berjalan.
- **Render**: tombol eksekusi render final dari preview/blueprint menjadi file video jadi.

### 5.7 Panel "Render Settings" (kanan)
- **Time Anim (sec)** — durasi animasi (input numerik, mis. 15 detik).
- **No Text** (toggle) — memastikan tidak ada elemen teks/tulisan dalam animasi (penting karena banyak platform microstock membatasi/melarang teks pada footage, atau user ingin aset generik tanpa teks agar lebih fleksibel dipakai ulang oleh buyer).
- **Background Animations** (toggle ON/OFF) — apakah elemen latar belakang ikut beranimasi (mis. partikel, gradient bergerak) atau statis.
- **Green Screen** (toggle ON/OFF) — render dengan background chroma key hijau solid vs. background transparan (alpha channel) vs. background sesuai preset warna.
- **Intro/Outro Anim** — Tidak / Pakai — menambahkan animasi masuk-keluar otomatis pada elemen utama.
- **Rules Animations** — tingkat kompleksitas gerakan: **Simple / High / Expert**:
  - *Simple*: gerakan dasar (fade, slide, scale linear).
  - *High*: kombinasi easing, multi-layer motion, timing bertingkat (staggered).
  - *Expert*: physics-based motion (bounce, spring, overshoot), motion path kompleks, multi-elemen interaktif.
- **Colors BG** — Solid / Gradient / Pastel (aktif hanya jika Green Screen di-nonaktifkan; menentukan skema warna background non-chroma).
- **Easing Preset** — Off / Natural / Strong (kontrol kurva easing global: linear vs. natural ease-in-out vs. dramatis).

---

## 6. Fitur Tambahan yang Direkomendasikan (belum terlihat di UI referensi, tapi krusial untuk kelayakan jual microstock)

Bagian ini menjawab permintaan "perhatikan hal yang mungkin terlewat":

### 6.1 Kepatuhan & Kelayakan Microstock
- **Content Safety Filter**: pemeriksaan otomatis terhadap gambar referensi yang diupload user (deteksi logo/merek pihak ketiga, wajah publik figur, karya seni berhak cipta) — beri peringatan sebelum generate agar hasil tidak ditolak/dilaporkan platform stock.
- **Metadata Generator**: otomatis membuat judul, deskripsi, dan keyword (tags) SEO-friendly untuk tiap hasil, siap copy-paste atau export CSV sesuai template upload Adobe Stock/Shutterstock/Pond5.
- **Naming Convention & Struktur Folder Otomatis**: penamaan file konsisten (mis. `[Kategori]_[Style]_[Resolusi]_[Timestamp]_v1.mp4`) plus folder per kategori/batch agar mudah diunggah massal.
- **Similarity Checker**: perbandingan visual antar hasil dalam satu batch (hash/embedding-based) untuk memberi skor kemiripan — membantu menghindari penolakan "duplicate content" oleh reviewer microstock.
- **Looping Check**: opsi agar animasi dibuat *seamless loop* (frame awal = frame akhir), fitur yang sangat dicari buyer motion background.
- **Export Alpha Channel**: pastikan opsi ProRes 4444 / WebM VP9 alpha / MOV dengan alpha benar-benar transparan (bukan cuma green screen) untuk kompatibilitas compositing profesional — nilai jual lebih tinggi di stock daripada green screen biasa.

### 6.2 Manajemen Proyek & Produktivitas
- **Save/Load Project**: menyimpan seluruh konfigurasi (prompt, gambar referensi, render settings) sebagai file proyek agar bisa dilanjutkan/di-reuse.
- **Riwayat Generate (History)**: log semua job (prompt, hasil, waktu, biaya token) yang bisa dicari/difilter, termasuk kemampuan re-render ulang dari blueprint lama tanpa memanggil ulang API (hemat kuota).
- **Template Library**: kumpulan preset motion blueprint yang bisa disimpan/dipakai ulang/dibagikan antar user (untuk tim).
- **Cost/Usage Tracker**: estimasi token Gemini terpakai per generate & per hari, plus estimasi sisa kuota per API key.

### 6.3 Kualitas & Reliabilitas Render
- **Render Queue Management**: prioritas job, jeda otomatis (pause/resume), retry otomatis jika render gagal.
- **Preview vs Final Render Consistency**: memastikan hasil final render identik (bukan hanya mirip) dengan preview real-time, agar tidak ada kejutan hasil akhir.
- **Watermark Preview**: preview di kanvas boleh diberi watermark "PREVIEW" ringan agar tidak disalahgunakan sebelum render final (opsional, mengikuti kebijakan produk).
- **Crash Recovery**: auto-save progres render job agar tidak hilang saat aplikasi crash/mati listrik.
- **Hardware Diagnostic**: pengecekan otomatis driver GPU, VRAM tersedia, estimasi waktu render berdasarkan spesifikasi hardware terdeteksi sebelum user klik Render (mencegah render gagal di tengah jalan).

### 6.4 Keamanan & Privasi
- API key Gemini disimpan terenkripsi lokal (mis. OS keychain/DPAPI), tidak pernah di-log secara plain text.
- Opsi hapus semua data API key & cache lokal (privacy compliance).
- Tidak ada upload otomatis gambar referensi user ke server pihak ketiga selain endpoint resmi Gemini API untuk keperluan generate.

### 6.5 Monetisasi & Lisensi Produk (aplikasi itu sendiri)
- Model **Freemium/Lite vs Pro**: "Lite Mode" yang sudah ada di UI mengindikasikan pembedaan free-tier (fitur/preview terbatas) vs berbayar (full render quality, batch besar, dsb) — perlu didefinisikan batasan konkret tiap tier.
- Lisensi hasil output jelas ke user: user pemilik penuh hasil render untuk dijual bebas (karena render dilakukan lokal dari primitif vektor/motion, bukan model closed-source generatif gambar/video berlisensi terbatas) — perlu disclaimer legal yang jelas di dalam app.

### 6.6 Integrasi Lanjutan (Roadmap, bukan MVP)
- Auto-upload/API integration ke Adobe Stock Contributor / Shutterstock Contributor (jika platform menyediakan API resmi).
- Plugin ekspor langsung ke Adobe After Effects/Premiere (.aep template) untuk user yang ingin edit manual lanjutan.
- Cloud sync riwayat project antar perangkat (opsional, untuk tim).

---

## 7. Arsitektur Sistem (Ringkas)

```
[UI Shell — Desktop App]
        |
        v
[AI Architect Layer] --(HTTPS)--> [Google Gemini API]
        |  (menghasilkan "Motion Blueprint" — JSON terstruktur:
        |   objek, properti visual, keyframe, easing, durasi, palet warna)
        v
[Motion Blueprint Interpreter]
        |
        v
[Render Engine — lokal]
   ├── Real-time Preview Renderer (GPU-accelerated, kualitas rendah/cepat)
   └── Final Render Pipeline (CPU/GPU terpilih user, kualitas ekspor penuh)
        |
        v
[Output Files: MP4/MOV/WEBM + Alpha, + Metadata (JSON/CSV)]
        |
        v
[Local Output Folder — siap upload ke Microstock]
```

**Catatan penting**: Gemini API digunakan sebagai "otak" penyusun struktur/komposisi animasi (motion blueprint dalam format terstruktur, mis. JSON berisi objek, keyframe, warna, easing), **bukan** sebagai model text-to-video generatif. Rendering visual akhir dilakukan oleh render engine lokal (berbasis vektor/motion graphics, semacam engine kompatibel dengan pendekatan Lottie/Remotion/Canvas-WebGL) yang dieksekusi di CPU/GPU user. Pendekatan ini penting agar:
1. Hasil visual konsisten & dapat dikontrol presisi (resolusi, alpha channel, dsb).
2. Tidak terikat lisensi ambigu dari model generatif video pihak ketiga saat dijual di microstock.
3. Biaya operasional rendah (tidak bayar compute render ke cloud AI per detik video).

---

## 8. Alur Pengguna (User Flow) Utama

1. User membuka aplikasi → memasukkan/memvalidasi API key Gemini (jika belum ada).
2. User memilih mode Text atau Image, memasukkan prompt/upload referensi.
3. User atur jumlah variasi, batch size, pilih model & thinking level.
4. User klik **Generate** → AI Architect memanggil Gemini API → motion blueprint dihasilkan → preview otomatis muncul di kanvas.
5. User meninjau preview (play/pause/scrub), menyesuaikan Render Settings (durasi, no text, green screen, rules animation, dsb) — bisa regenerate jika belum sesuai.
6. User atur Neural Engine settings (resolusi, FPS, format, CPU/GPU, bitrate) dan folder output.
7. User klik **Render** → job masuk antrian Render Batch → status real-time ditampilkan.
8. Setelah selesai, file video + metadata otomatis tersimpan di folder output, siap diunggah ke microstock.

---

## 9. Kebutuhan Non-Fungsional

| Aspek | Kebutuhan |
|---|---|
| Performa | Preview real-time minimal 30 FPS pada hardware kelas menengah (GPU entry-level) |
| Skalabilitas | Mendukung antrian batch hingga puluhan job tanpa memory leak |
| Kompatibilitas OS | Windows 10/11 saja (satu-satunya target rilis pertama) |
| Ketersediaan Offline | Render final bisa jalan offline (hanya proses generate blueprint yang butuh internet ke Gemini API) |
| Audio | Tidak ada di rilis pertama (silent output only) |
| Localization | UI mendukung minimal Bahasa Indonesia & Inggris |
| Aksesibilitas | Kontras warna UI dark-mode memenuhi standar keterbacaan (WCAG AA minimal untuk teks penting) |

---

## 10. Batasan & Risiko

- **Ketergantungan API pihak ketiga**: perubahan kebijakan/harga Gemini API dapat memengaruhi biaya operasional user — mitigasi via dukungan multi-key & opsi model custom.
- **Kualitas hasil AI bervariasi**: perlu mekanisme regenerate cepat & similarity checker agar user tidak membuang waktu pada hasil buruk.
- **Kebijakan platform microstock berubah-ubah**: metadata generator & compliance checker perlu update berkala mengikuti guideline terbaru tiap platform.
- **Beban render lokal**: pada hardware rendah, render 4K bisa lambat — perlu estimasi waktu & fallback resolusi.

---

## 11. Ruang Lingkup MVP vs Roadmap

**MVP (Rilis Pertama)**
- AI Architect (Text & Image mode) dengan Gemini API + multi-key rotation
- Preview real-time + Render Batch dasar
- Render Settings inti (durasi, no text, green screen, rules animation, easing)
- Neural Engine (resolusi/FPS/format/CPU-GPU/bitrate) + folder output
- Metadata generator dasar (judul, deskripsi, keyword)
- Save/Load project, riwayat generate

**Roadmap (Rilis Lanjutan)**
- Similarity checker otomatis antar hasil
- Auto-upload ke platform microstock via API resmi
- Template library berbagi tim
- Cloud sync
- Plugin ekspor ke After Effects/Premiere

---

## 12. Keputusan Scope (Final untuk Rilis Pertama)

Keputusan berikut sudah dikonfirmasi dan menggantikan bagian "Pertanyaan Terbuka" pada draft sebelumnya:

| Area | Keputusan |
|---|---|
| Target platform microstock | **Adobe Stock saja** untuk rilis pertama. Spesifikasi ekspor (resolusi, format, metadata, durasi minimum, dsb) mengikuti guideline teknis Adobe Stock Contributor secara spesifik — bukan generik multi-platform. |
| Fondasi render engine | **Memanfaatkan library motion open-source** yang sudah ada (bukan dibangun dari nol) sebagai dasar Render Engine, dikustomisasi untuk mendukung motion blueprint dari AI Architect, alpha channel export, dan akselerasi GPU. |
| Lite Mode vs Mode Penuh | **Untuk rilis pertama, aplikasi berjalan sebagai Mode Penuh saja.** Toggle "Lite Mode" tetap ada di UI (sesuai referensi) namun fungsinya dibatasi ke pengoptimalan performa UI (nonaktifkan animasi berat di preview) — **bukan** pembeda tier berbayar/gratis. Pembagian tier Lite/Pro sebagai model bisnis ditunda ke roadmap, didefinisikan ulang nanti setelah MVP berjalan. |
| Audio | **Tidak ada dukungan audio** (SFX/musik) di rilis pertama. Semua output silent, sesuai kebutuhan umum b-roll/motion graphics stock. Placeholder arsitektur boleh disiapkan agar penambahan audio track di masa depan tidak butuh perombakan besar, tapi tidak dikerjakan sekarang. |
| Target OS | **Windows saja** untuk rilis pertama (Windows 10/11). Dukungan macOS/Linux dipindahkan sepenuhnya ke roadmap, tidak masuk pertimbangan desain arsitektur MVP. |

### Dampak Keputusan terhadap Bagian Lain Dokumen

- **Bagian 6.1 (Metadata Generator)**: format & field metadata (judul, deskripsi, keyword, kategori) mengikuti struktur upload/CSV resmi **Adobe Stock Contributor**, bukan format generik.
- **Bagian 7 (Arsitektur)**: "Render Engine — lokal" pada rilis pertama dibangun di atas library motion open-source pilihan (perlu ditentukan pada tahap technical design — kandidat umum: engine berbasis canvas/WebGL/Skia yang mendukung ekspor alpha channel dan akselerasi GPU), bukan engine custom dari nol.
- **Bagian 9 (Non-Fungsional)**: baris "Kompatibilitas OS" disederhanakan menjadi **Windows 10/11 — satu-satunya target rilis pertama**; baris macOS dihapus dari MVP.
- **Bagian 11 (Ruang Lingkup MVP)**: item "Auto-upload ke platform microstock via API resmi" pada roadmap dipersempit fokusnya ke Adobe Stock API/format ekspor resminya terlebih dahulu, sebelum dipertimbangkan ke platform lain.

---

*Dokumen ini sudah mencakup keputusan scope final untuk rilis pertama (Adobe Stock, render engine berbasis library open-source, mode penuh saja, tanpa audio, Windows-only). Siap dilanjutkan ke tahap technical design/spesifikasi teknis.*
