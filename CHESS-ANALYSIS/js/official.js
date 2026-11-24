/* Data RESMI Chess.com (bukan hitungan app):
   1) Akurasi: field "accuracies" di API publik Chess.com (ada untuk partai yang pernah di-review di Chess.com).
   2) Tanda langkah: tanda $ di PGN dari Game Review Chess.com (Bagikan > PGN): Brilian, Bagus, Tidak Akurat, Kesalahan, Blunder.
   Langkah lain (Terbaik, Sangat Baik, Baik, Buku, Terlewat) tidak ditandai di PGN, jadi tetap hitungan app.
   Bila data resmi tidak tersedia, app memakai hitungannya sendiri seperti biasa. */
(function () {
  'use strict';
  const NAG = { 1: 'great', 2: 'mistake', 3: 'brilliant', 4: 'blunder', 6: 'inaccuracy', 9: 'miss' };
  const MARKED = ['brilliant', 'great', 'inaccuracy', 'mistake', 'miss', 'blunder'];
  const BAD = ['inaccuracy', 'mistake', 'blunder', 'miss'];
  const CACHE_KEY = 'cr_official';
  const RETRY_MS = 30 * 60 * 1000;   // partai belum di-review: cek lagi 30 menit kemudian

  /* tanda $ per setengah-langkah: null (tanpa tanda) atau nama kelas */
  function parseNags(pgn) {
    let txt = String(pgn || '').replace(/\r/g, '');
    txt = txt.split('\n').filter((l) => !/^\s*\[.*\]\s*$/.test(l)).join(' ');
    txt = txt.replace(/\{[^}]*\}/g, ' ').replace(/;[^\n]*/g, ' ');
    for (let k = 0; k < 5 && /\([^()]*\)/.test(txt); k++) txt = txt.replace(/\([^()]*\)/g, ' ');
    const marks = [];
    txt.split(/\s+/).forEach((tok) => {
      if (!tok || /^(1-0|0-1|1\/2-1\/2|\*)$/.test(tok)) return;
      const nag = tok.match(/^\$(\d+)$/);
      if (nag) { if (marks.length) marks[marks.length - 1] = NAG[parseInt(nag[1], 10)] || null; return; }
      const san = tok.replace(/^\d+\.+/, '');
      if (!san) return;
      marks.push(null);
    });
    return marks;
  }

  /* id partai Chess.com dari header Link / Site */
  function gameId(h) {
    const s = String((h && (h.Link || '')) || '') + ' ' + String((h && h.Site) || '');
    const m = s.match(/chess\.com\/(?:analysis\/)?game\/(?:live|daily)\/(\d+)/);
    return m ? m[1] : null;
  }
  function fromApiGame(g) {
    return g && g.accuracies && typeof g.accuracies.white === 'number' && typeof g.accuracies.black === 'number'
      ? { w: g.accuracies.white, b: g.accuracies.black } : null;
  }
  function loadCache() { try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}') || {}; } catch (e) { return {}; } }
  function saveCache(c) {
    try {
      const keys = Object.keys(c);
      if (keys.length > 400) keys.sort((a, b) => c[a].t - c[b].t).slice(0, keys.length - 400).forEach((k) => delete c[k]);
      localStorage.setItem(CACHE_KEY, JSON.stringify(c));
    } catch (e) {}
  }
  function remember(id, acc) { if (!id) return; const c = loadCache(); c[id] = { acc: acc || null, t: Date.now() }; saveCache(c); }

  /* Akurasi resmi untuk PGN Chess.com (header Link + tanggal + pemain) lewat arsip bulanan API publik. */
  async function fetchAccuracy(headers) {
    const id = gameId(headers);
    if (!id) return null;
    const hit = loadCache()[id];
    if (hit && (hit.acc || Date.now() - hit.t < RETRY_MS)) return hit.acc;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return null;
    const d = String(headers.UTCDate || headers.EndDate || headers.Date || '').split('.');
    if (d.length < 2 || !/^\d{4}$/.test(d[0])) return null;
    for (const u of [headers.White, headers.Black]) {
      if (!u || !/^[A-Za-z0-9_-]{2,40}$/.test(u)) continue;
      try {
        const r = await fetch(`https://api.chess.com/pub/player/${encodeURIComponent(u.toLowerCase())}/games/${d[0]}/${d[1]}`);
        if (!r.ok) continue;
        const j = await r.json();
        const g = (j.games || []).find((x) => String(x.url || '').split('/').pop() === id);
        if (g) { const acc = fromApiGame(g); remember(id, acc); return acc; }
      } catch (e) { /* jaringan: coba pemain lain / lain kali */ }
    }
    return null;
  }

  /* Angka resmi ditampilkan seperti layar Game Review Chess.com: DIPOTONG ke 1 desimal, bukan dibulatkan.
     API menyimpan 2 desimal (sudah dibulatkan), jadi dikurangi 0.005 dulu. Cocok dengan 7 dari 8 angka layar
     di partai Anda (mis. API 88.39 -> layar 88.3, API 73.30 -> layar 73.2). */
  function display(v) {
    if (v === null || v === undefined || isNaN(v)) return '—';
    if (v >= 99.995) return '100.0';
    return Math.max(0, Math.floor((v - 0.005) * 10 + 1e-9) / 10).toFixed(1);
  }

  function recount(report) {
    const counts = { w: {}, b: {} };
    Object.keys(window.CLS).forEach((k) => { counts.w[k] = 0; counts.b[k] = 0; });
    report.moves.forEach((m) => { counts[m.color][m.cls] = (counts[m.color][m.cls] || 0) + 1; });
    report.counts = counts;
    report.keyMoments = report.moves.filter((m) => ['brilliant', 'great', 'miss', 'mistake', 'blunder'].includes(m.cls)).map((m) => m.ply);
  }

  /* Pasang data resmi ke laporan analisis app. Aman dipanggil berulang. */
  function apply(report, game) {
    if (!report || !game) return report;
    const marks = game.ccMarks;
    if (marks && marks.length === report.moves.length && marks.some(Boolean) && !report.officialMarks) {
      report.moves.forEach((m, i) => {
        const mk = marks[i];
        if (m.cls === 'book' || m.cls === 'forced') { if (mk && MARKED.includes(mk)) { m.appCls = m.cls; m.cls = mk; m.official = true; } return; }
        if (mk && MARKED.includes(mk)) {
          if (m.cls !== mk) { m.appCls = m.cls; m.cls = mk; }
          m.official = true;
          if (!BAD.includes(mk) && m.info) m.info.reason = null;
          if (mk === 'great' && m.info && !m.info.great) m.info.great = 'only';
          return;
        }
        // tanpa tanda di PGN Chess.com: bukan Brilian/Bagus/Tidak Akurat/Kesalahan/Blunder menurut Chess.com
        if (m.cls === 'brilliant' || m.cls === 'great') { m.appCls = m.cls; m.cls = 'best'; }
        else if (BAD.includes(m.cls)) {
          const prevBad = i > 0 && ['inaccuracy', 'mistake', 'blunder'].includes(marks[i - 1]);
          m.appCls = m.cls;
          // Terlewat tidak ditandai di PGN: perkiraan app (langkah buruk tepat setelah kesalahan lawan, peluang besar terlewat)
          if (prevBad && m.epBest >= 0.7 && m.epPlayed < m.epBest - 0.08) m.cls = 'miss';
          else { m.cls = m.epLoss < 0.02 ? 'excellent' : 'good'; if (m.info) m.info.reason = null; }
        }
      });
      report.officialMarks = true;
      recount(report);
    }
    if (game.ccAccuracy && !report.officialAccuracy) {
      report.appAccuracy = Object.assign({}, report.accuracy);
      report.accuracy = { w: game.ccAccuracy.w, b: game.ccAccuracy.b };
      const E = window.Estimates, h = game.headers || {};
      if (E && E.gameRatingEstimate) {
        report.gameRating = {
          w: E.gameRatingEstimate(report.accuracy.w, parseInt(h.WhiteElo, 10)),
          b: E.gameRatingEstimate(report.accuracy.b, parseInt(h.BlackElo, 10))
        };
      }
      report.officialAccuracy = true;
    }
    return report;
  }

  window.Official = { parseNags, gameId, fromApiGame, fetchAccuracy, apply, remember, display };
})();
