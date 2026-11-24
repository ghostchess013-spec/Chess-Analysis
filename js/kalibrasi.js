/* Kalibrasi otomatis (validasi.html): ambil partai yang punya akurasi Chess.com dari API publik,
   analisis satu per satu dengan engine aplikasi, simpan bertahap di localStorage, lalu ekspor satu JSON.
   API publik hanya memuat akurasi (tanpa klasifikasi per langkah / Rating Permainan). */
(function () {
  'use strict';
  const KEY = 'cr_kalib_batch';
  const API = 'https://api.chess.com/pub/player/';
  const MIN_PLY = 30;                       // partai sangat pendek terlalu bising untuk kalibrasi
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /* ---------- API (satu per satu + coba ulang; Chess.com membatasi permintaan paralel) ---------- */
  async function getJson(url) {
    let lastErr = null;
    for (let i = 0; i < 4; i++) {
      try {
        const r = await fetch(url);
        if (r.status === 404) return null;
        if (r.ok) return await r.json();
        lastErr = new Error('HTTP ' + r.status);
      } catch (e) { lastErr = e; }
      await sleep(800 * (i + 1));
    }
    try { const r = await fetch('api/chesscom?url=' + encodeURIComponent(url)); if (r.ok) return await r.json(); } catch (e) { /* tanpa proxy */ }
    throw lastErr || new Error('gagal mengambil data');
  }

  function usable(g, classes) {
    return !!(g && g.rules === 'chess' && g.pgn && g.url && g.accuracies &&
      typeof g.accuracies.white === 'number' && typeof g.accuracies.black === 'number' &&
      !/\[SetUp "1"\]/.test(g.pgn) && (!classes.length || classes.indexOf(g.time_class) >= 0));
  }

  async function collect(opts, onStatus) {
    const seen = new Set(opts.skip || []), out = [];
    const perUser = Math.ceil(opts.max / opts.users.length);
    for (const u of opts.users) {
      let got = 0;
      onStatus('Mengambil daftar arsip ' + u + '…');
      const a = await getJson(API + encodeURIComponent(u) + '/games/archives');
      const arcs = (a && a.archives ? a.archives : []).slice(-opts.months).reverse();   // bulan terbaru dulu
      for (const url of arcs) {
        if (got >= perUser || out.length >= opts.max) break;
        onStatus('Mengambil arsip ' + url.split('/').slice(-2).join('-') + ' (' + u + ')…');
        const d = await getJson(url);
        const games = (d && d.games ? d.games : []).slice().reverse();                 // partai terbaru dulu
        for (const g of games) {
          if (got >= perUser || out.length >= opts.max) break;
          if (!usable(g, opts.classes) || seen.has(g.url)) continue;
          let plies = 0;
          try { plies = window.Validasi.parsePgn(g.pgn).moves.length; } catch (e) { continue; }
          if (plies < MIN_PLY) continue;
          seen.add(g.url); out.push(g); got++;
        }
      }
    }
    return out;
  }

  /* ---------- catatan per partai (cukup untuk menyetel ulang rumus akurasi tanpa analisis ulang) ---------- */
  function evalC(e) {
    if (!e) return null;
    if (e.mate !== undefined && e.mate !== null) return e.winner ? { mate: e.mate, winner: e.winner } : { mate: e.mate };
    if (e.draw) return { cp: 0, draw: true };
    return { cp: e.cp };
  }
  function record(g, rep, depth) {
    return {
      url: g.url, tc: g.time_control, tclass: g.time_class, end: g.end_time,
      w: { u: g.white && g.white.username, elo: g.white && g.white.rating },
      b: { u: g.black && g.black.username, elo: g.black && g.black.rating },
      cc: { w: g.accuracies.white, b: g.accuracies.black },
      app: { w: rep.accuracy.w, b: rep.accuracy.b, rw: rep.gameRating.w, rb: rep.gameRating.b },
      counts: rep.counts, profile: (rep.meta && rep.meta.profile) || null, depth, pgn: g.pgn,
      // [warna, kelas, eval terbaik, eval dimainkan, eval langkah kedua] (semua dari sudut pandang Putih)
      mv: rep.moves.map((m, i) => {
        const ln = rep.evals && rep.evals[i] && rep.evals[i].lines;
        return [m.color, m.cls, evalC(m.evalBest), evalC(m.evalPlayed), ln && ln[1] ? evalC(ln[1].white) : null];
      })
    };
  }

  function stats(records) {
    const d = [];
    records.forEach((r) => { if (r.app.w != null) d.push(r.app.w - r.cc.w); if (r.app.b != null) d.push(r.app.b - r.cc.b); });
    if (!d.length) return null;
    return { n: d.length, mae: d.reduce((a, x) => a + Math.abs(x), 0) / d.length, bias: d.reduce((a, x) => a + x, 0) / d.length, max: Math.max(...d.map(Math.abs)) };
  }

  function load() { try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); return s && Array.isArray(s.records) ? s : { records: [] }; } catch (e) { return { records: [] }; } }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); return true; } catch (e) { return false; } }
  function exportJson(s) {
    return JSON.stringify({
      format: 'game-review-kalibrasi-1',
      model: window.Estimates && window.Estimates.MODEL_INFO ? window.Estimates.MODEL_INFO.version : null,
      createdAt: new Date().toISOString(), count: s.records.length, records: s.records
    });
  }

  window.Kalibrasi = { usable, collect, record, stats, exportJson, MIN_PLY, KEY };

  /* ---------- UI (hanya bila elemen ada di halaman) ---------- */
  const $ = (id) => document.getElementById(id);
  if (!$('kRun')) return;
  let st = load(), stop = false, eng = null, engKind = null, wl = null;
  const say = (t) => { $('kStatus').textContent = t; };
  const bar = (id, p) => { $(id).style.width = Math.round(Math.max(0, Math.min(1, p)) * 100) + '%'; };
  const f1 = (x) => (x == null ? '–' : x.toFixed(1));
  const sg = (x) => (x == null ? '' : (x > 0 ? '+' : '') + x.toFixed(1));
  try { const u = localStorage.getItem('cr_user'); if (u && !$('kUsers').value) $('kUsers').value = u; } catch (e) {}

  function render() {
    const s = stats(st.records);
    $('kSum').classList.toggle('hidden', !s);
    if (s) $('kSum').innerHTML = 'Tersimpan <b>' + st.records.length + ' partai</b> (' + s.n + ' sisi pemain). Selisih akurasi app vs Chess.com: rata-rata <b>' + s.mae.toFixed(2) + '</b>, bias ' + sg(s.bias) + ', terbesar ' + s.max.toFixed(1) + '.';
    let h = st.records.length ? '<tr><th>Partai</th><th>Chess.com</th><th>App</th><th>Selisih</th></tr>' : '';
    st.records.slice().reverse().forEach((r) => {
      const dw = r.app.w - r.cc.w, db = r.app.b - r.cc.b;
      h += '<tr><td>' + (r.w.u || '?') + ' – ' + (r.b.u || '?') + '<br><span class="muted">' + (r.tclass || '') + ' · ' + (r.profile || '') + ' · ' + r.mv.length + ' ply</span></td><td>' + f1(r.cc.w) + ' / ' + f1(r.cc.b) + '</td><td>' + f1(r.app.w) + ' / ' + f1(r.app.b) + '</td><td class="' + (Math.max(Math.abs(dw), Math.abs(db)) < 3 ? 'good' : 'bad') + '">' + sg(dw) + ' / ' + sg(db) + '</td></tr>';
    });
    $('kTable').innerHTML = h;
  }
  async function keepAwake(on) {
    try {
      if (on && 'wakeLock' in navigator) wl = await navigator.wakeLock.request('screen');
      else if (!on && wl) { await wl.release(); wl = null; }
    } catch (e) { /* tidak didukung */ }
  }
  async function getEng(kind) {
    if (eng && engKind === kind) return eng;
    if (eng) { try { eng.dispose(); } catch (e) {} eng = null; }
    say('Memuat engine ' + kind + '…');
    eng = new Engine(Engine.pathFor(kind)); engKind = kind;
    await eng.readyPromise;
    return eng;
  }
  function busy(on) {
    $('kRun').disabled = on; $('kClear').disabled = on;
    $('kStop').classList.toggle('hidden', !on);
  }

  $('kRun').onclick = async function () {
    const users = $('kUsers').value.split(/[\s,;]+/).map((x) => x.trim().toLowerCase()).filter(Boolean);
    if (!users.length) { say('Isi minimal satu username Chess.com.'); return; }
    const classes = Array.from(document.querySelectorAll('input[name=kClass]:checked')).map((x) => x.value);
    const opts = { users, classes, months: parseInt($('kMonths').value, 10) || 2, max: parseInt($('kMax').value, 10) || 30, skip: st.records.map((r) => r.url) };
    const kind = $('kEngine').value === 'lite' ? 'lite' : 'full', depth = parseInt($('kDepth').value, 10) || 15;
    stop = false; busy(true); bar('kBar', 0); bar('kBar2', 0); await keepAwake(true);
    try {
      const list = await collect(opts, say);
      if (stop) { say('Dihentikan.'); return; }
      if (!list.length) { say('Tidak ada partai baru dengan akurasi Chess.com untuk pilihan ini. Coba tambah bulan atau username lain.'); return; }
      const e = await getEng(kind);
      for (let i = 0; i < list.length && !stop; i++) {
        const g = list[i];
        say('Partai ' + (i + 1) + '/' + list.length + ': ' + g.white.username + ' vs ' + g.black.username + ' (' + g.time_class + ')');
        bar('kBar', i / list.length); bar('kBar2', 0);
        let rep = null;
        try {
          rep = await Analyzer.analyzeGame(window.Validasi.parsePgn(g.pgn), e, { depth, cancelled: () => stop, onProgress: (p) => bar('kBar2', p) });
        } catch (err) { say('Partai dilewati: ' + (err && err.message ? err.message : err)); continue; }
        if (!rep) break;
        st.records.push(record(g, rep, depth)); st.updated = Date.now();
        if (!save(st)) say('Penyimpanan HP penuh; salin JSON sekarang supaya hasil tidak hilang.');
        render();
      }
      bar('kBar', stop ? 0 : 1);
      say(stop ? 'Dihentikan. Hasil yang sudah selesai tetap tersimpan; tekan Mulai lagi untuk melanjutkan.' : 'Selesai. ' + st.records.length + ' partai tersimpan. Salin JSON lalu kirim.');
    } catch (err) {
      say('Galat: ' + (err && err.message ? err.message : err) + '. Hasil yang sudah selesai tetap tersimpan.');
    } finally {
      busy(false); await keepAwake(false);
    }
  };
  $('kStop').onclick = function () { stop = true; if (eng) eng.stop(); say('Menghentikan…'); };
  $('kClear').onclick = function () {
    if (!st.records.length || !confirm('Hapus ' + st.records.length + ' hasil kalibrasi yang tersimpan?')) return;
    st = { records: [] }; save(st); render(); say('Hasil dihapus.');
  };
  $('kCopy').onclick = async function () {
    if (!st.records.length) { $('kEx').textContent = 'Belum ada hasil.'; return; }
    const txt = exportJson(st); let ok = false;
    try { await navigator.clipboard.writeText(txt); ok = true; } catch (e) {}
    if (!ok) { try { const ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta); ta.select(); ok = document.execCommand('copy'); document.body.removeChild(ta); } catch (e) {} }
    $('kEx').textContent = ok ? 'JSON disalin (' + Math.round(txt.length / 1024) + ' KB, ' + st.records.length + ' partai).' : 'Gagal menyalin.';
  };
  $('kDl').onclick = function () {
    if (!st.records.length) { $('kEx').textContent = 'Belum ada hasil.'; return; }
    try {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([exportJson(st)], { type: 'application/json' }));
      a.download = 'kalibrasi-' + st.records.length + '-partai.json';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      $('kEx').textContent = 'Berkas diunduh.';
    } catch (e) { $('kEx').textContent = 'Unduh gagal: ' + e.message + '. Pakai Salin JSON.'; }
  };
  render();
})();
