/* Alat validasi: bandingkan hasil aplikasi dengan Game Review Chess.com untuk PGN yang sama.
   Fungsi murni (tanpa DOM) supaya bisa diuji. */
(function () {
  const NAG = { 1: 'great', 2: 'mistake', 3: 'brilliant', 4: 'blunder', 6: 'inaccuracy', 9: 'miss' };
  const ORDER = ['brilliant', 'great', 'book', 'best', 'excellent', 'good', 'inaccuracy', 'mistake', 'miss', 'blunder'];
  const MARKED = ['brilliant', 'great', 'inaccuracy', 'mistake', 'miss', 'blunder'];

  /* Tanda $ di PGN Chess.com per setengah-langkah: null (tanpa tanda) atau salah satu kelas bertanda. */
  function parseNags(pgn) {
    let txt = String(pgn || '').replace(/\r/g, '');
    txt = txt.split('\n').filter((l) => !/^\s*\[.*\]\s*$/.test(l)).join(' ');
    txt = txt.replace(/\{[^}]*\}/g, ' ').replace(/;[^\n]*/g, ' ');
    for (let k = 0; k < 5 && /\([^()]*\)/.test(txt); k++) txt = txt.replace(/\([^()]*\)/g, ' ');
    const marks = [];
    txt.split(/\s+/).forEach((tok) => {
      if (!tok || /^(1-0|0-1|1\/2-1\/2|\*)$/.test(tok)) return;
      const nag = tok.match(/^\$(\d+)$/);
      if (nag) { if (marks.length) marks[marks.length - 1] = NAG[parseInt(nag[1], 10)] || 'nag' + nag[1]; return; }
      const san = tok.replace(/^\d+\.+/, '');
      if (!san) return;
      marks.push(null);
    });
    return marks;
  }

  /* Sama dengan parsePgn di app.js (tanpa jam). */
  function parsePgn(pgn) {
    pgn = String(pgn || '').replace(/\r/g, '').trim();
    if (!pgn) throw new Error('PGN kosong');
    pgn = pgn.split(/\n\s*\n(?=\[Event )/)[0];
    const c = new Chess();
    try { c.loadPgn(pgn); } catch (e) { c.loadPgn(pgn.replace(/\{[^}]*\}/g, ' ').replace(/\$\d+/g, ' ')); }
    const headers = c.getHeaders ? c.getHeaders() : c.header();
    const hist = c.history({ verbose: true });
    if (!hist.length) throw new Error('PGN tidak berisi langkah');
    const positions = [{ fen: headers.FEN || hist[0].before }];
    const moves = hist.map((m) => { positions.push({ fen: m.after }); return { san: m.san, from: m.from, to: m.to, color: m.color, piece: m.piece, captured: m.captured, promotion: m.promotion, flags: m.flags }; });
    return { headers, moves, positions, pgn };
  }

  const group = (cls) => (MARKED.indexOf(cls) >= 0 ? cls : 'tanpa-tanda');

  /* Perbandingan per langkah dengan tanda PGN (hanya kelas bertanda yang bisa dibandingkan). */
  function compareMarks(report, marks) {
    const rows = []; let agree = 0;
    report.moves.forEach((m, i) => {
      const cc = marks[i] || 'tanpa-tanda', app = group(m.cls), ok = cc === app;
      if (ok) agree++;
      rows.push({ ply: i + 1, color: m.color, san: m.san, app: m.cls, appGroup: app, cc, match: ok });
    });
    return { total: rows.length, agree, rows, mismatches: rows.filter((r) => !r.match), marksCount: marks.length === report.moves.length };
  }

  /* cc: { w: {kelas: n}, b: {kelas: n}, accW, accB, ratingW, ratingB } (nilai kosong = tidak diisi). */
  function compareSummary(report, cc) {
    const out = { classes: [], accuracy: {}, rating: {} };
    ORDER.forEach((k) => out.classes.push({ cls: k, appW: report.counts.w[k] || 0, ccW: cc.w[k], appB: report.counts.b[k] || 0, ccB: cc.b[k] }));
    [['w', 'accW'], ['b', 'accB']].forEach(([col, key]) => {
      const app = report.accuracy[col], ref = cc[key];
      out.accuracy[col] = { app, cc: ref, diff: ref === undefined || ref === null || app === null ? null : app - ref };
    });
    [['w', 'ratingW'], ['b', 'ratingB']].forEach(([col, key]) => {
      const app = report.gameRating[col], ref = cc[key];
      out.rating[col] = { app, cc: ref, diff: ref === undefined || ref === null || app === null ? null : app - ref };
    });
    return out;
  }

  /* Data per langkah untuk disimpan/diunduh (validasi dan debugging). */
  function buildExport(game, report, cc, marks) {
    return {
      format: 'game-review-validasi-1',
      model: report.model || (report.meta && report.meta.model) || null,
      meta: report.meta || null,
      headers: game.headers,
      summary: { accuracy: report.accuracy, gameRating: report.gameRating, counts: report.counts, chesscom: cc || null },
      perMove: report.moves.map((m, i) => ({
        ply: i + 1, color: m.color, san: m.san, uci: m.uci,
        fenBefore: game.positions[i].fen, fenAfter: game.positions[i + 1].fen,
        evalBest: m.evalBest, evalPlayed: m.evalPlayed,
        epBefore: m.epBefore, epAfter: m.epAfter, epLoss: m.epLoss,
        cls: m.cls, accuracy: m.accuracy, bestMove: m.bestMove || null,
        chesscomMark: marks && marks[i] !== undefined ? marks[i] : null
      }))
    };
  }

  window.Validasi = { ORDER, MARKED, parseNags, parsePgn, compareMarks, compareSummary, buildExport, group };
})();
