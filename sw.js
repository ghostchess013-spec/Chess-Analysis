/* =====================================================================
 * Service worker Game Review — mode offline.
 *
 *  - Berkas aplikasi (index.html, css, js, gambar): JARINGAN DULU, cadangan dari cache.
 *    Saat online selalu mendapat versi terbaru (revalidasi, tanpa perlu hapus cache);
 *    saat offline atau jaringan lambat (> 4 dtk) dipakai salinan tersimpan.
 *  - Engine (engine/*.js dan engine/*.wasm, ±99 MB): CACHE DULU. Diunduh sekali, lalu tidak
 *    diunduh ulang. Ukuran .wasm diperiksa agar file terpotong tidak tersimpan permanen.
 *  - Permintaan lintas-situs (API Chess.com), selain GET, Range, dan header X-Prepare: tidak disentuh.
 *
 * Mengganti engine? Cukup ubah js/engine-config.js (nama berkas, ukuran .wasm); cache engine lama dibuang otomatis.
 * Versi cache aplikasi dibaca dari js/version.js (window.VERSIONS.SW = 'v' + SHELL).
 * Setiap patch baru: cukup naikkan VER/SHELL di js/version.js, tidak perlu mengedit berkas ini.
 * ===================================================================== */
// js/version.js hanya menulis ke `window.VERSIONS`; di dalam service worker `self` adalah global scope,
// jadi berkas yang sama dipakai tanpa perbedaan. Cadangan 'v40' hanya terpakai bila berkas itu gagal dimuat.
try { importScripts('js/version.js'); } catch (e) { /* pakai cadangan di bawah */ }
const SHELL_VERSION = (self.VERSIONS && self.VERSIONS.SW) || 'v40';
const SHELL_CACHE = 'gr-shell-' + SHELL_VERSION;
// konfigurasi engine dari satu tempat (js/engine-config.js); cadangan bila berkas itu tidak ada
try { importScripts('js/engine-config.js'); } catch (e) { /* pakai cadangan di bawah */ }
const EC = self.ENGINE_CONFIG || { name: 'Stockfish 19', full: { js: 'engine/stockfish-19-single.js', wasm: 'engine/stockfish-19-single.wasm', wasmBytes: 99169054 }, lite: { js: 'engine/stockfish-19-lite-single.js', wasm: 'engine/stockfish-19-lite-single.wasm', wasmBytes: 1845971 }, cacheName: 'gr-engine-v1' };
const ENGINE_CACHE = EC.cacheName;
// ukuran .wasm yang benar per berkas (untuk menolak unduhan terpotong); berkas lain tidak diperiksa
const WASM_SIZES = { [EC.full.wasm.split('/').pop()]: EC.full.wasmBytes, [EC.lite.wasm.split('/').pop()]: EC.lite.wasmBytes };
// engine ringan (±2 MB) ikut disimpan saat instal supaya langsung bisa dipakai offline; engine penuh (99 MB) tidak
const ENGINE_PRECACHE = [EC.lite.js, EC.lite.wasm];
const NETWORK_TIMEOUT_MS = 4000;
const ENGINE_PATH = /\/engine\/[^/]+$/;
// aset papan/bidak/ikon yang dipakai lewat JS (tidak tertulis di index.html); papan & bidak lain disimpan otomatis saat pertama dipakai
const EXTRA = [
  'img/bg/ghostchess-hp.jpg',
  'img/bg/ghostchess-desktop.jpg',
  'img/boards/boards.json',
  'img/pieces/pieces.json',
  'img/apple-touch-icon.png',
  'css/chesscom.css',
  'js/assets.js',
  'img/icons/brilliant.png',
  'img/icons/great.png',
  'img/icons/best.png',
  'img/icons/excellent.png',
  'img/icons/good.png',
  'img/icons/book.png',
  'img/icons/inaccuracy.png',
  'img/icons/mistake.png',
  'img/icons/miss.png',
  'img/icons/blunder.png',
  'img/logo/logo-white.png',
  'img/logo/pawn.png',
  'img/boards/9rdwe.png',
  'img/boards/thumbs/9rdwe.webp',
  'img/boards/thumbs/dark_wood.webp',
  'img/boards/thumbs/glass.webp',
  'img/boards/thumbs/brown.webp',
  'img/boards/thumbs/icy_sea.webp',
  'img/boards/thumbs/newspaper.webp',
  'img/boards/thumbs/walnut.webp',
  'img/boards/thumbs/sky.webp',
  'img/boards/thumbs/lolz.webp',
  'img/boards/thumbs/stone.webp',
  'img/boards/thumbs/bases.webp',
  'img/boards/thumbs/8_bit.webp',
  'img/boards/thumbs/marble.webp',
  'img/boards/thumbs/purple.webp',
  'img/boards/thumbs/translucent.webp',
  'img/boards/thumbs/metal.webp',
  'img/boards/thumbs/tournament.webp',
  'img/boards/thumbs/dash.webp',
  'img/boards/thumbs/burled_wood.webp',
  'img/boards/thumbs/blue.webp',
  'img/boards/thumbs/bubblegum.webp',
  'img/boards/thumbs/checkers.webp',
  'img/boards/thumbs/graffiti.webp',
  'img/boards/thumbs/light.webp',
  'img/boards/thumbs/neon.webp',
  'img/boards/thumbs/orange.webp',
  'img/boards/thumbs/parchment.webp',
  'img/boards/thumbs/red.webp',
  'img/boards/thumbs/sand.webp',
  'img/boards/thumbs/tan.webp',
  'img/boards/thumbs/4fs27.webp',
  'img/boards/thumbs/g715q.webp',
  'img/boards/thumbs/my2xa.webp',
  'img/boards/thumbs/bju81.webp',
  'img/boards/thumbs/z4m3d.webp',
  'img/boards/thumbs/6m5lc.webp',
  'img/boards/thumbs/ohdxn.webp',
  'img/pieces/ejgfv/wp.png',
  'img/pieces/ejgfv/wn.png',
  'img/pieces/ejgfv/wb.png',
  'img/pieces/ejgfv/wr.png',
  'img/pieces/ejgfv/wq.png',
  'img/pieces/ejgfv/wk.png',
  'img/pieces/ejgfv/bp.png',
  'img/pieces/ejgfv/bn.png',
  'img/pieces/ejgfv/bb.png',
  'img/pieces/ejgfv/br.png',
  'img/pieces/ejgfv/bq.png',
  'img/pieces/ejgfv/bk.png',
  'img/pieces/8qetl/wn.png',
  'img/pieces/game_room/wn.png',
  'img/pieces/wood/wn.png',
  'img/pieces/glass/wn.png',
  'img/pieces/gothic/wn.png',
  'img/pieces/classic/wn.png',
  'img/pieces/metal/wn.png',
  'img/pieces/bases/wn.png',
  'img/pieces/neo_wood/wn.png',
  'img/pieces/icy_sea/wn.png',
  'img/pieces/club/wn.png',
  'img/pieces/ocean/wn.png',
  'img/pieces/newspaper/wn.png',
  'img/pieces/space/wn.png',
  'img/pieces/cases/wn.png',
  'img/pieces/condal/wn.png',
  'img/pieces/3d_chesskid/wn.png',
  'img/pieces/8_bit/wn.png',
  'img/pieces/marble/wn.png',
  'img/pieces/book/wn.png',
  'img/pieces/alpha/wn.png',
  'img/pieces/bubblegum/wn.png',
  'img/pieces/dash/wn.png',
  'img/pieces/graffiti/wn.png',
  'img/pieces/light/wn.png',
  'img/pieces/lolz/wn.png',
  'img/pieces/luca/wn.png',
  'img/pieces/maya/wn.png',
  'img/pieces/modern/wn.png',
  'img/pieces/nature/wn.png',
  'img/pieces/neon/wn.png',
  'img/pieces/sky/wn.png',
  'img/pieces/tigers/wn.png',
  'img/pieces/tournament/wn.png',
  'img/pieces/vintage/wn.png',
  'img/pieces/3d_wood/wn.png',
  'img/pieces/3d_staunton/wn.png',
  'img/pieces/3d_plastic/wn.png',
  'img/pieces/ca09k/wn.png',
  'manifest.json', 'img/icon-192.png', 'img/icon-512.png', 'img/icon-maskable-512.png',
  'img/pieces/wP.svg', 'img/pieces/wN.svg', 'img/pieces/wB.svg', 'img/pieces/wR.svg', 'img/pieces/wQ.svg', 'img/pieces/wK.svg',
  'img/pieces/bP.svg', 'img/pieces/bN.svg', 'img/pieces/bB.svg', 'img/pieces/bR.svg', 'img/pieces/bQ.svg', 'img/pieces/bK.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    // daftar berkas diambil dari index.html (src/href), jadi selalu sama dengan yang dimuat halaman
    const res = await fetch(new Request('index.html', { cache: 'reload' }));
    if (!res.ok) throw new Error('index.html tidak bisa diambil: HTTP ' + res.status);
    const html = await res.clone().text();
    const urls = new Set(['index.html']);
    const re = /(?:src|href)=["']([^"'#]+)["']/g;
    let m;
    while ((m = re.exec(html))) {
      const u = m[1];
      if (/^([a-z][a-z0-9+.-]*:)?\/\//i.test(u) || /^(data|mailto|javascript):/i.test(u)) continue;
      urls.add(u);
    }
    EXTRA.forEach((u) => urls.add(u));
    await cache.put(new Request('index.html'), res);
    const list = [...urls].filter((u) => u !== 'index.html');
    for (let i = 0; i < list.length; i += 8) {   // per 8 berkas: server lokal tidak diserbu ratusan permintaan sekaligus
      await Promise.all(list.slice(i, i + 8).map(async (u) => {
        try {
          const r = await fetch(new Request(u, { cache: 'reload' }));
          if (r.ok) await cache.put(new Request(u), r);
        } catch (e) { /* satu berkas gagal tidak membatalkan instalasi */ }
      }));
    }
    // engine ringan: kecil, jadi disimpan sekarang (dilewati bila sudah ada)
    const engCache = await caches.open(ENGINE_CACHE);
    for (const u of ENGINE_PRECACHE) {
      try {
        const rq = new Request(u);
        if (await engCache.match(rq)) continue;
        const r = await fetch(new Request(u, { cache: 'reload' }));
        if (r.ok) await putEngineFile(engCache, rq, r);
      } catch (e) { /* tidak fatal */ }
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((n) =>
      (n.indexOf('gr-shell-') === 0 && n !== SHELL_CACHE) || (n.indexOf('gr-engine-') === 0 && n !== ENGINE_CACHE)
    ).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (req.headers.has('range') || req.headers.has('x-prepare')) return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (ENGINE_PATH.test(url.pathname)) { event.respondWith(engineCacheFirst(event)); return; }
  event.respondWith(networkFirst(event));
});

async function engineCacheFirst(event) {
  const req = event.request;
  const cache = await caches.open(ENGINE_CACHE);
  const hit = await cache.match(req, { ignoreSearch: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (res && res.status === 200) {
    event.waitUntil((async () => {
      try { await putEngineFile(cache, req, res.clone()); }
      catch (e) { try { await cache.delete(req); } catch (e2) {} }
    })());
  }
  return res;
}

// simpan berkas engine; .wasm dengan ukuran salah (terpotong) dibuang agar tidak tersimpan permanen
async function putEngineFile(cache, req, res) {
  await cache.put(req, res);
  const expected = WASM_SIZES[new URL(req.url).pathname.split('/').pop()];
  if (expected) {
    const stored = await cache.match(req);
    const size = stored ? (await stored.blob()).size : -1;
    if (size !== expected) { await cache.delete(req); return false; }
  }
  return true;
}

async function networkFirst(event) {
  const req = event.request;
  const cache = await caches.open(SHELL_CACHE);
  const find = async () =>
    (await cache.match(req)) || (await cache.match(req, { ignoreSearch: true })) ||
    (req.mode === 'navigate' ? await cache.match('index.html') : undefined);
  // 'navigate' tidak boleh dibangun ulang dengan init; pakai Request baru dari URL-nya
  const netReq = req.mode === 'navigate'
    ? new Request(req.url, { cache: 'no-cache', credentials: 'same-origin' })
    : new Request(req, { cache: 'no-cache' });
  const net = fetch(netReq);
  const store = (res) => { if (res && res.ok) event.waitUntil(cache.put(req, res.clone()).catch(() => {})); return res; };
  try {
    const res = await Promise.race([
      net,
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), NETWORK_TIMEOUT_MS))
    ]);
    return store(res);
  } catch (err) {
    const hit = await find();
    if (hit) { event.waitUntil(net.then(store).catch(() => {})); return hit; }
    return net;   // tidak ada salinan: tunggu jaringan apa adanya (atau gagal)
  }
}
