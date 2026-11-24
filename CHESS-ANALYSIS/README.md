# Game Review Catur (GhostChess)

PWA analisis partai catur: tempel PGN atau ambil partai dari Chess.com, lalu dapatkan
ringkasan gaya **Game Review** — akurasi, klasifikasi tiap langkah, grafik eval, nama
pembukaan, dan Rating Permainan. Analisis dikerjakan **Stockfish 19 (WebAssembly)** yang
berjalan di dalam browser, jadi bisa dipakai **offline** setelah engine diunduh sekali.

Vanilla JavaScript. **Tanpa build step, tanpa npm, tanpa bundler.**

---

## Menjalankan

Worker WebAssembly **tidak bisa jalan lewat `file://`**. Anda wajib memakai server lokal.

```bash
# pilih salah satu
python3 -m http.server 8080
npx serve .
php -S localhost:8080
```

Lalu buka `http://localhost:8080/` (bukan `file:///.../index.html`).

Setelah dibuka sekali, halaman akan mendaftarkan service worker dan aplikasi bisa
dibuka offline.

### Memuat versi terbaru setelah mengedit

Service worker memakai strategi *network-first* untuk berkas aplikasi, jadi saat online
biasanya sudah mendapat versi terbaru. Kalau tetap terlihat versi lama:

1. Naikkan `SHELL_VERSION` di `sw.js` (mis. `v39` → `v40`), **dan**
2. Naikkan nomor `?v=` berkas yang Anda ubah di `index.html` (mis. `js/app.js?v=38` → `?v=39`).

Nomor `?v=` itulah yang membuat browser dan service worker menganggap berkas itu berbeda
dari salinan yang tersimpan. Kalau lupa menaikkannya, perubahan Anda bisa tidak muncul
walaupun kodenya sudah benar.

---

## Struktur berkas

```
index.html          Shell aplikasi. Urutan <script> di sini = urutan dependensi.
manifest.json       Metadata PWA (standalone, tema #312e2b, ikon 192/512/maskable).
sw.js               Service worker: cache shell (network-first) + cache engine (cache-first).

css/
  style.css         Tema dark ala Chess.com. Variabel CSS, 5 tema papan, layout responsif.
  chesscom.css      Lapisan tampilan Chess.com: papan bergambar, bidak 3D, ikon PNG.

js/
  chess.js          Pustaka chess.js (diminifikasi) + patch before/after, .square, [%clk].
  openings.js       Opening book: 41.648 posisi, kunci hash 53-bit (cyrb53), dibungkus Proxy.
  icons.js          window.CLS + ikon SVG antarmuka.
  engine-config.js  SATU-SATUNYA titik konfigurasi engine. Dipakai window DAN service worker.
  coach.js          Semua teks id/en + avatar coach.
  assets.js         Pemuat boards.json / pieces.json, url bidak, tema papan.
  board.js          Papan interaktif: drag & drop, klik, panah, highlight, badge klasifikasi.
  engine.js         Pembungkus Worker Stockfish (uci, go, stop, dispose, pathFor).
  estimates.js      Model Expected Points: konversi eval, akurasi, rating, ambang kelas.
  analyzer.js       Replikasi Chess.com "Classification V2". Butuh estimates.js dimuat lebih dulu.
  official.js       Angka pembanding resmi Chess.com untuk halaman validasi.
  app.js            Orkestrasi: state, tab, alur review, Settings, localStorage. Berkas terbesar.
  offline.js        Tombol "Prepare offline" / "Clear offline data" + progres unduhan engine.
  tests.js          Unit test (dijalankan tests.html).
  validasi.js       Bandingkan hasil app vs Chess.com, termasuk selisih memakai tanda $.
  kalibrasi.js      Kalibrasi otomatis dari API publik Chess.com. Berjalan di validasi.html.

engine/
  stockfish-19-single.js / .wasm       Engine penuh (±99 MB), paling akurat.
  stockfish-19-lite-single.js / .wasm  Engine ringan (±1,8 MB), dimuat cepat, ikut precache.

img/
  boards/           37 tema papan + thumbs/ + boards.json.
  pieces/           40 set bidak + pieces.json + 12 SVG standar (wP…bK).
  icons/            10 ikon klasifikasi (brilliant, great, best, excellent, good, book,
                    inaccuracy, mistake, miss, blunder).
  logo/, bg/,        Logo, latar, dan ikon PWA.
  icon-*.png

tools/
  build_book_merged.py   Pembangun js/openings.js (Lichess + Polyglot).

generator.html      ALAT LAMA. Menghasilkan openings.js format objek literal (usang).
tes.html            Uji integrasi: patch chess.js, header .wasm, dan Worker sampai uciok.
tests.html          Menjalankan unit test js/tests.js.
validasi.html       Validasi satu partai + kalibrasi otomatis.
```

### Urutan dependensi (jangan diacak)

```
chess.js → openings.js → icons.js → engine-config.js → coach.js → assets.js
→ board.js → engine.js → estimates.js → analyzer.js → official.js → app.js → offline.js
```

`analyzer.js` akan melempar galat yang jelas kalau `estimates.js` belum dimuat:

> `js/estimates.js belum dimuat (harus dimuat sebelum analyzer.js)`

---

## Mengganti engine

Semua pengaturan engine terpusat di **`js/engine-config.js`**. Berkas ini juga dibaca
service worker lewat `importScripts()`, jadi **tidak boleh menyentuh `document` atau DOM**.

Langkahnya:

1. Taruh berkas engine baru di folder `engine/`.
2. Ubah di `js/engine-config.js`: `name`, `full.js`, `full.wasm`, `full.wasmBytes`,
   (dan `lite.*` bila perlu).
3. Selesai. Cache engine lama dibuang otomatis oleh `activate` di `sw.js`, label di
   `coach.js` serta ukuran unduhan ikut menyesuaikan.

`wasmBytes` **harus tepat**. Service worker memeriksa ukuran `.wasm` yang tersimpan dan
membuang berkas yang terpotong, supaya unduhan gagal tidak tersimpan permanen.

### Verifikasi setelah ganti engine

1. Buka **`tes.html`** — memeriksa header `Content-Type` `.wasm`, ukuran berkas, dan
   benar-benar menjalankan Worker sampai `uciok`.
2. Buka **`tests.html`** — unit test rumus akurasi dan klasifikasi.
3. Buka **`validasi.html`** — kalibrasi otomatis terhadap partai Chess.com.

---

## Kalibrasi (validasi.html)

Halaman ini menjawab satu pertanyaan: **seberapa dekat hasil aplikasi dengan Chess.com?**

1. Isi username Chess.com (partai Anda sendiri sudah cukup; lawan ikut terhitung).
2. Pilih rentang bulan, jumlah partai, kelas waktu, engine, dan kedalaman.
3. Tekan **Mulai kalibrasi**. Perkirakan **±1 menit per partai** dengan engine Full.
4. Hasil disimpan bertahap di `localStorage` (`cr_kalib_batch`). Kalau terhenti, tekan
   Mulai lagi untuk melanjutkan — partai yang sudah selesai tidak dianalisis ulang.
5. Tekan **Salin JSON** / **Unduh JSON** untuk mengekspor.

JSON ekspor memuat, per partai: akurasi Chess.com vs aplikasi, Rating Permainan, jumlah
tiap kelas, profil, kedalaman, PGN, dan data per langkah
`[warna, kelas, eval terbaik, eval dimainkan, eval langkah kedua]`.

Filter partai yang layak: hanya `rules=chess`, harus punya `pgn` + `url` + `accuracies`,
menolak PGN `[SetUp "1"]`, dan minimal 30 ply (`MIN_PLY`). Partai sangat pendek terlalu
bising untuk kalibrasi.

---

## Membangun ulang opening book

`js/openings.js` sudah jadi dan **tidak perlu dibangun ulang** untuk memakai aplikasi.
Hanya perlu kalau Anda ingin memperbarui datanya.

```bash
pip install chess
python3 tools/build_book_merged.py <folder a.tsv..e.tsv> <folder buku .bin> js/openings.js
```

Sumber:

- Nama pembukaan: <https://github.com/lichess-org/chess-openings> (`a.tsv` … `e.tsv`, CC0)
- Perluasan kedalaman: <https://github.com/ChrisWhittington/polyglot-books>
  (`gm2001.bin`, `Elo2400.bin`, `KomodoVariety.bin`)

Cara kerja: nama Lichess dipetakan ke posisi, lalu buku Polyglot dipakai memperluas
kedalaman sampai `MAXPLY = 20` ply dengan nama diwarisi dari posisi induk. Kunci keluaran
adalah **hash 53-bit (cyrb53) dari "susunan bidak + giliran"**, sehingga berkas tetap
kecil; `window.OPENING_BOOK[fenKey]` tetap mengembalikan `"ECO|Nama"` seperti objek biasa.

Skrip juga menulis `js/openings.js.ref.json` (peta FEN lengkap) untuk keperluan
pemeriksaan. Berkas itu **artefak debug** dan sudah masuk `.gitignore` — jangan di-commit.

> **Perhatian:** `generator.html` adalah alat lama yang menghasilkan format berbeda
> (objek literal dengan kunci FEN penuh) dan tanpa perluasan Polyglot. Jangan dipakai
> untuk menimpa `js/openings.js` hasil `build_book_merged.py`.

---

## Catatan teknis

**Penilaian.** `analyzer.js` meniru Chess.com *Classification V2* memakai *Expected Points*
(EP), bukan selisih centipawn mentah. Ambang kehilangan EP: Best `0`, Excellent `≤0.02`,
Good `≤0.05`, Inaccuracy `≤0.10`, Mistake `≤0.20`, Blunder `>0.20`, ditambah aturan
khusus untuk Brilliant, Great, Miss, Book, dan Forced. Fungsi `winPct(cp)` hanya dipakai
untuk menampilkan angka, bukan untuk klasifikasi.

**Penyimpanan lokal.** `localStorage`: `cr_settings`, `cr_user`, `cr_recent` (maks 30),
`cr_reports` (cache hasil review, maks 8 kunci), `cr_kalib_batch` (hasil kalibrasi).

**Service worker.** Berkas aplikasi *network-first* dengan batas tunggu 4 detik lalu jatuh
ke cache. Berkas `engine/*` *cache-first* — diunduh sekali, tidak pernah diunduh ulang.
Daftar berkas yang di-precache dibaca otomatis dari `index.html` (atribut `src`/`href`)
ditambah daftar `EXTRA` untuk aset yang dipanggil lewat JavaScript. Unduhan dibatch 8
berkas sekaligus agar server lokal tidak diserbu. Permintaan non-GET, `Range`, ber-header
`X-Prepare`, dan lintas-origin (API Chess.com) tidak disentuh.

---

## Lisensi & atribusi

- Nama pembukaan: dataset Lichess `chess-openings` — **CC0**.
- Buku Polyglot: `gm2001`, `Elo2400`, `KomodoVariety` — lihat repo masing-masing.
- Mesin: Stockfish (GPLv3) — lihat berkas di folder `engine/`.
- Ikon klasifikasi, tema papan, dan set bidak bergaya Chess.com disertakan untuk
  keperluan tampilan; periksa ketentuan penggunaan Chess.com bila dipublikasikan.
