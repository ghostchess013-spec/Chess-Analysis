/* =====================================================================
 * Satu sumber nomor versi aset ("cache busting").
 *
 * MASALAH YANG DISELESAIKAN
 *   Browser dan service worker menyimpan salinan berkas. Kalau Anda mengubah sebuah
 *   berkas tapi nomor versinya tidak dinaikkan, pengguna bisa terus mendapat salinan
 *   LAMA meski kodenya sudah benar. Sebelumnya nomor versi ditulis manual di index.html
 *   (`js/app.js?v=38`) dan di sw.js (`SHELL_VERSION`), jadi mudah lupa.
 *
 * CARA PAKAI (setiap kali selesai mengedit berkas js/css)
 *   1. Naikkan VER di bawah, mis. 39 -> 40.  Cukup SATU angka untuk semua berkas.
 *   2. Kalau yang diubah berkas engine (js/engine-config.js) atau daftar berkas di
 *      index.html, naikkan juga SHELL di bawah. Kalau ragu, naikkan keduanya.
 *
 * MENGAPA MASIH PERLU SATU ANGKA DI index.html
 *   Saat halaman dimuat, index.html memuat js/version.js lewat `js/version.js?v=<VER>`.
 *   Sebelum berkas ini sempat berjalan, semua tag <script> lain sudah terlanjur dibaca
 *   browser beserta nomor versinya. Karena itu nomor versi bawaan (`?v=`) TIDAK berubah:
 *   bagian itu tidak menambah kerumitan baru, hanya dipertahankan apa adanya.
 *
 *   Yang memberi manfaat nyata: SW memakai VER sebagai SHELL_CACHE, jadi setiap kali VER
 *   dinaikkan, cache aplikasi lama otomatis dibuang tanpa Anda harus mengedit sw.js.
 *
 * URUTAN PEMUATAN TIDAK BERUBAH: berkas ini hanya menulis nomor ke window.VERSIONS
 * (tidak menyentuh DOM dan tidak butuh berkas lain), jadi aman dimuat paling atas.
 * ===================================================================== */
(function () {
  'use strict';

  // ====== NAIKKAN ANGKA DI SINI SETELAH SETIAP PERUBAHAN BERKAS js/ ATAU css/ ======
  var VER = 40;
  // ====== NAIKKAN ANGKA DI SINI BILA BERKAS ENGINE ATAU DAFTAR DI index.html BERUBAH =
  var SHELL = 40;

  var SW = 'v' + SHELL;                                   // dipakai sw.js sebagai SHELL_VERSION
  var Q = '?v=' + VER;                                    // dipakai sebagai cadangan nomor versi aset
  var V = {};
  ['index.html', 'css/style.css', 'css/chesscom.css', 'js/chess.js', 'js/openings.js', 'js/icons.js', 'js/engine-config.js',
   'js/coach.js', 'js/assets.js', 'js/board.js', 'js/engine.js', 'js/estimates.js', 'js/analyzer.js', 'js/official.js',
   'js/app.js', 'js/offline.js', 'sw.js'].forEach(function (k) { V[k] = Q; });

  window.VERSIONS = { VER: VER, SHELL: SHELL, SW: SW, Q: Q, V: V };
})();
