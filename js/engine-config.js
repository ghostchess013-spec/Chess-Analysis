/* =====================================================================
 * KONFIGURASI ENGINE: satu-satunya tempat yang diubah saat mengganti versi Stockfish.
 *
 * Cara mengganti engine (mis. ke Stockfish 20):
 *  1. Taruh berkas baru di folder engine/ (versi single dan lite: .js + .wasm).
 *  2. Ubah 'name', nama berkas, dan 'wasmBytes' (ukuran .wasm dalam byte, lihat di file manager/properti berkas).
 *  3. Buka app sekali saat online. Service worker, mode offline, halaman Validasi, label di layar,
 *     dan ukuran di Pengaturan ikut berubah otomatis. Cache engine lama dihapus sendiri.
 *  4. Uji: buka tests.html, lalu jalankan Kalibrasi otomatis dan bandingkan dengan hasil sebelumnya.
 *
 * Berkas ini dipakai di halaman (window) dan di service worker (importScripts), jadi jangan pakai document/DOM di sini.
 * ===================================================================== */
(function (g) {
  'use strict';
  const C = {
    name: 'Stockfish 19',
    full: { js: 'engine/stockfish-19-single.js', wasm: 'engine/stockfish-19-single.wasm', wasmBytes: 99169054 },
    lite: { js: 'engine/stockfish-19-lite-single.js', wasm: 'engine/stockfish-19-lite-single.wasm', wasmBytes: 1845971 }
  };
  // Nama cache engine mengikuti berkas engine penuh, jadi ganti engine = cache baru (yang lama dibuang otomatis).
  // Stockfish 19 tetap memakai nama lama 'gr-engine-v1' supaya engine 99 MB yang sudah tersimpan tidak diunduh ulang.
  C.cacheName = C.full.wasm === 'engine/stockfish-19-single.wasm' ? 'gr-engine-v1'
    : 'gr-engine-' + C.full.wasm.replace(/^engine\//, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  C.mb = (k) => Math.max(1, Math.round(C[k].wasmBytes / 1e6));   // ukuran untuk label di Pengaturan
  g.ENGINE_CONFIG = C;
})(typeof self !== 'undefined' ? self : this);
