/* Mode offline: pendaftaran service worker + kontrol di Pengaturan (Siapkan offline / Hapus data offline). */
(function () {
  'use strict';
  var EC = window.ENGINE_CONFIG || { name: 'Stockfish 19', full: { js: 'engine/stockfish-19-single.js', wasm: 'engine/stockfish-19-single.wasm', wasmBytes: 99169054 }, lite: { js: 'engine/stockfish-19-lite-single.js', wasm: 'engine/stockfish-19-lite-single.wasm', wasmBytes: 1845971 }, cacheName: 'gr-engine-v1' };   // satu sumber: js/engine-config.js
  var ENGINE_CACHE = EC.cacheName;                                     // sama dengan sw.js (dibaca dari berkas yang sama)
  var ENGINE_FILES = [EC.full.js, EC.full.wasm];
  var WASM_BYTES = EC.full.wasmBytes;                                  // ukuran .wasm yang benar
  var $ = function (id) { return document.getElementById(id); };
  var tr = function (k) { return (window.I18N && window.I18N.t(k)) || k; };
  var secure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  var swOk = 'serviceWorker' in navigator && 'caches' in window && secure;
  var busy = false, note = '';
  var persistDenied = false;   // browser menolak permintaan penyimpanan permanen

  // minta penyimpanan permanen ("persistent storage") supaya browser tidak menghapus cache aplikasi + engine
  // saat penyimpanan HP hampir penuh. Aman: bila API tidak ada atau ditolak, aplikasi berjalan seperti biasa.
  async function askPersist() {
    try {
      if (!navigator.storage || !navigator.storage.persist) return;
      persistDenied = !(await navigator.storage.persist());
    } catch (e) { persistDenied = false; }
  }

  async function resetAll() {
    try { var regs = await navigator.serviceWorker.getRegistrations(); await Promise.all(regs.map(function (r) { return r.unregister(); })); } catch (e) {}
    try { var names = await caches.keys(); await Promise.all(names.filter(function (n) { return n.indexOf('gr-') === 0; }).map(function (n) { return caches.delete(n); })); } catch (e) {}
  }
  // pintu darurat: buka index.html?nosw=1 untuk mencabut service worker dan menghapus cache
  if (/[?&]nosw=1(&|$)/.test(location.search)) { resetAll().then(function () { location.replace(location.pathname); }); return; }

  async function engineBytes() {
    try {
      if (!(await caches.has(ENGINE_CACHE))) return 0;   // caches.open() akan MEMBUAT cache kosong bila belum ada
      var c = await caches.open(ENGINE_CACHE);
      var wasm = await c.match(ENGINE_FILES[1]), js = await c.match(ENGINE_FILES[0]);
      if (!wasm || !js) return 0;
      return +wasm.headers.get('content-length') || WASM_BYTES;
    } catch (e) { return 0; }
  }
  async function storageMb() {
    try { if (navigator.storage && navigator.storage.estimate) { var e = await navigator.storage.estimate(); return Math.round((e.usage || 0) / 1048576); } } catch (e) {}
    return 0;
  }
  function setText(s) { var el = $('off-status'); if (el) el.textContent = s; }
  function setBar(p) {
    var w = $('off-barwrap'), b = $('off-bar'); if (!w || !b) return;
    if (p === null) { w.classList.add('hidden'); return; }
    w.classList.remove('hidden'); b.style.width = Math.max(0, Math.min(100, Math.round(p * 100))) + '%';
  }
  function setBusy(v) { busy = v; ['off-prepare', 'off-clear'].forEach(function (id) { var b = $(id); if (b) b.disabled = v; }); }

  async function refresh() {
    if (!$('off-status') || busy) return;
    var prep = $('off-prepare'), clr = $('off-clear');
    if (!swOk) { setText(tr('offUnsupported')); if (prep) prep.disabled = true; if (clr) clr.disabled = true; return; }
    var bytes = await engineBytes(), ctrl = !!navigator.serviceWorker.controller, mb = await storageMb();
    var txt = bytes ? tr('offReady').replace('{mb}', Math.round(bytes / 1048576)) : ctrl ? tr('offAppOnly') : tr('offNoSw');
    if (mb) txt += ' ' + tr('offStorage').replace('{mb}', mb);
    if (persistDenied) txt += ' ' + tr('offNoPersist');
    setText(note ? note + ' ' + txt : txt); note = '';
  }

  async function prepare() {
    if (!swOk || busy) return;
    setBusy(true); setBar(0);
    try {
      await askPersist();
      var cache = await caches.open(ENGINE_CACHE);
      for (var i = 0; i < ENGINE_FILES.length; i++) {
        var url = ENGINE_FILES[i], isWasm = /\.wasm$/.test(url);
        // header X-Prepare membuat service worker tidak ikut campur: halaman ini menyimpan ke cache sendiri
        var res = await fetch(url, { cache: 'no-store', headers: { 'X-Prepare': '1' } });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        var putP = cache.put(url, res.clone());
        var reader = res.body.getReader(), got = 0;
        for (;;) {
          var r = await reader.read(); if (r.done) break;
          got += r.value.length;
          if (isWasm) { setBar(got / WASM_BYTES); setText(tr('offDownloading').replace('{pct}', Math.min(99, Math.round(100 * got / WASM_BYTES)))); }
        }
        await putP;
        if (isWasm) {
          var stored = await cache.match(url), size = stored ? (await stored.blob()).size : -1;
          if (size !== WASM_BYTES) { await cache.delete(url); throw new Error('verify'); }
        }
      }
      note = '';
    } catch (e) { note = e && e.message === 'verify' ? tr('offVerifyFail') : tr('offFail') + ' (' + (e && e.message ? e.message : e) + ')'; }
    setBar(null); setBusy(false); await refresh();
  }

  async function clearAll() {
    if (!swOk || busy) return;
    if (!window.confirm(tr('offConfirm'))) return;
    setBusy(true);
    await resetAll();
    note = tr('offCleared'); setBusy(false); await refresh();
  }

  function init() {
    var p = $('off-prepare'), c = $('off-clear');
    if (p) p.onclick = prepare;
    if (c) c.onclick = clearAll;
    ['btn-settings', 'nav-settings', 'btn-settings-m'].forEach(function (id) { var b = $(id); if (b) b.addEventListener('click', function () { setTimeout(refresh, 0); }); });
    var sel = $('set-lang'); if (sel) sel.addEventListener('change', function () { setTimeout(refresh, 0); });
    if (swOk) {
      navigator.serviceWorker.addEventListener('controllerchange', refresh);
      navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(function () { return navigator.serviceWorker.ready; }).then(askPersist).then(refresh).catch(function () { setText(tr('offUnsupported')); });
    } else refresh();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.GameReviewOffline = { refresh: refresh, prepare: prepare, clearAll: clearAll };
})();
