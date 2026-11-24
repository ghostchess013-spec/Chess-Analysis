/* =====================================================================
 * Mesin Game Review — replikasi sistem Chess.com "Classification V2"
 * - Expected Points Model (0.00 kalah .. 0.50 seimbang .. 1.00 menang),
 *   disesuaikan dengan rating pemain
 * - Ambang resmi: Best 0, Excellent ≤0.02, Good ≤0.05, Inaccuracy ≤0.10,
 *   Mistake ≤0.20, Blunder >0.20
 * - Aturan khusus: Brilliant (pengorbanan bidak terbaik), Great (satu-satunya
 *   langkah bagus / membalikkan keadaan), Miss (gagal menghukum kesalahan),
 *   Book (teori pembukaan), Forced (satu-satunya langkah legal)
 * - Akurasi per pemain (model berbasis win% + rata-rata tertimbang volatilitas)
 * ===================================================================== */
(function () {
  const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  const PNAME = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };

  const bookKey = (fen) => fen.split(' ').slice(0, 2).join(' ');

  /* ---------- Model ESTIMASI diimpor dari js/estimates.js (bukan formula Chess.com) ---------- */
  const E = window.Estimates;
  if (!E) throw new Error('js/estimates.js belum dimuat (harus dimuat sebelum analyzer.js)');
  const { kFactor, evalToEP, evalToWinAcc, moveAccuracyEstimate, calculateAccuracyEstimate, gameRatingEstimate, classifyByEPLoss, ACC } = E;
  void kFactor;

  function winPct(cp) {
    // rumus logistik standar (win% murni engine) — dipakai untuk grafik/tampilan, BUKAN untuk akurasi
    return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
  }
  /* APPROXIMATION (bukan aturan resmi Chess.com): ambang aturan Bagus disetel pada 6 contoh Bagus dari Chess.com */
  // epGapMin (p13): langkah kedua harus menurunkan peluang menang (EP) minimal 0.08; di posisi yang sudah menang telak
  // langkah kedua biasanya masih menang, jadi tidak ditandai Bagus. Uji 3 partai Chess.com: salah tandai 7 -> 5, yang benar tetap 6.
  const GREAT = { gapMin: 100, gapMax: 560, cbMin: -300, cbMax: 700, epGapMin: 0.08 };
  function evalToWin(ev, color) {
    if (ev.mate !== undefined && ev.mate !== null) {
      if (ev.mate === 0) return ev.winner ? (ev.winner === color ? 100 : 0) : 50;
      return (ev.mate > 0) === (color === 'w') ? 100 : 0;
    }
    if (ev.draw) return 50;
    const cp = Math.max(-1500, Math.min(1500, color === 'w' ? ev.cp : -ev.cp));
    return winPct(cp);
  }
  function lineToWhite(line, turn) {
    const s = turn === 'w' ? 1 : -1;
    if (line.mate !== undefined) return { mate: line.mate * s };
    return { cp: line.cp * s };
  }

  /* ---------- Material & SEE ---------- */
  function material(chess, color) {
    let m = 0;
    for (const row of chess.board()) for (const p of row) if (p && p.color === color) m += VAL[p.type];
    return m;
  }
  function nonPawnMaterial(chess) {
    let m = 0;
    for (const row of chess.board()) for (const p of row) if (p && p.type !== 'p' && p.type !== 'k') m += VAL[p.type];
    return m;
  }
  // Static Exchange Evaluation: keuntungan material bagi pihak yang melangkah bila menangkap di sq
  function see(chess, sq, depth) {
    depth = depth || 0;
    if (depth > 8) return 0;
    const target = chess.get(sq);
    if (!target) return 0;
    const caps = chess.moves({ verbose: true }).filter((m) => m.to === sq);
    if (!caps.length) return 0;
    caps.sort((a, b) => VAL[a.piece] - VAL[b.piece]);
    const m = caps[0];
    chess.move(m);
    let gain = VAL[target.type] + (m.promotion ? VAL[m.promotion] - 1 : 0);
    if (target.type === 'k') gain = 100;
    const reply = see(chess, sq, depth + 1);
    chess.undo();
    return Math.max(0, gain - reply);
  }
  // Bidak milik `color` yang bisa dimakan lawan dengan untung (dihitung saat giliran lawan)
  function hangingPieces(chess, color) {
    const res = [];
    if (chess.turn() === color) return res;
    for (const row of chess.board()) {
      for (const p of row) {
        if (!p || p.color !== color || p.type === 'k') continue;
        const g = see(chess, p.square);
        if (g > 0) res.push({ sq: p.square, type: p.type, gain: g });
      }
    }
    return res;
  }

  /* ---------- Fase permainan ---------- */
  function phaseOf(chess, ply, inBook) {
    const npm = nonPawnMaterial(chess);
    let queens = 0;
    for (const row of chess.board()) for (const p of row) if (p && p.type === 'q') queens++;
    if (npm <= 26 || (queens === 0 && npm <= 32)) return 'endgame';
    if (inBook || ply < 16) {
      // pembukaan selama perkembangan bidak belum selesai
      let undeveloped = 0;
      const back = { w: '1', b: '8' };
      for (const row of chess.board())
        for (const p of row) if (p && (p.type === 'n' || p.type === 'b') && p.square[1] === back[p.color]) undeveloped++;
      if (inBook || undeveloped >= 3 || ply < 12) return 'opening';
    }
    return 'middlegame';
  }

  /* ---------- Akurasi & Rating Permainan: lihat js/estimates.js ---------- */
  function accToIcon(acc) {
    if (acc === null || acc === undefined) return null;
    if (acc >= 92) return 'best';
    if (acc >= 82) return 'excellent';
    if (acc >= 70) return 'good';
    if (acc >= 55) return 'inaccuracy';
    if (acc >= 40) return 'mistake';
    return 'blunder';
  }

  /* ---------- Klasifikasi satu langkah ---------- */
  const basicClass = classifyByEPLoss; // batas resmi (DOCUMENTED), lihat estimates.js

  function pvMaterialSwing(fen, pv, plies, color) {
    // perubahan material (bagi `color`) sepanjang PV
    const c = new Chess(fen);
    const start = material(c, color) - material(c, color === 'w' ? 'b' : 'w');
    let worst = 0, last = 0, firstCap = null;
    for (let i = 0; i < Math.min(plies, pv.length); i++) {
      let mv;
      try {
        mv = c.move({ from: pv[i].slice(0, 2), to: pv[i].slice(2, 4), promotion: pv[i][4] });
      } catch (e) {
        break;
      }
      if (!mv) break;
      if (mv.captured && !firstCap) firstCap = { piece: mv.captured, by: mv.color, sq: mv.to };
      const d = material(c, color) - material(c, color === 'w' ? 'b' : 'w') - start;
      last = d;
      if (i % 2 === 1 || i === Math.min(plies, pv.length) - 1) worst = Math.min(worst, d);
    }
    return { last, worst, firstCap };
  }

  function evalTerminal(chess) {
    if (chess.isCheckmate()) return { mate: 0, winner: chess.turn() === 'w' ? 'b' : 'w' };
    if (chess.isDraw() || chess.isStalemate() || chess.isInsufficientMaterial() || chess.isThreefoldRepetition()) return { cp: 0, draw: true };
    return null;
  }

  /* ---------- Analisis penuh ---------- */
  async function analyzeGame(game, engine, opts) {
    opts = opts || {};
    const depth = opts.depth || 15;
    const onProgress = opts.onProgress || (() => {});
    const positions = game.positions; // [{fen}], panjang = moves+1
    const N = positions.length;
    const evals = new Array(N);
    engine.newGame();
    for (let i = 0; i < N; i++) {
      if (opts.cancelled && opts.cancelled()) return null;
      const c = new Chess(positions[i].fen);
      const term = evalTerminal(c);
      if (term) {
        evals[i] = { white: term, lines: [], terminal: true };
      } else {
        const r = await engine.analyze(positions[i].fen, { depth, multipv: 2 });
        if (!r) return null;
        const turn = c.turn();
        evals[i] = {
          white: r.lines[0] ? lineToWhite(r.lines[0], turn) : { cp: 0 },
          lines: r.lines.map((l) => ({ white: lineToWhite(l, turn), pv: l.pv, move: l.pv[0] })),
          best: r.bestmove,
          depth: r.depth
        };
      }
      onProgress((i + 1) / N, i);
    }
    // pasang konstanta akurasi sesuai engine (engine tanpa profil dianggap full) SEBELUM laporan dibangun
    const profile = E.useProfile(engine.profile);
    const meta = {
      engine: engine.engineName || 'Stockfish (versi tidak dilaporkan)',
      profile,
      depth, multipv: 2, uciOptions: { Hash: 32 }, tablebase: false,
      model: E.MODEL_INFO.version, createdAt: new Date().toISOString()
    };
    return buildReport(game, evals, Object.assign({}, opts, { meta }));
  }

  /* Buku dari data Chess.com sendiri (p15): header ECOUrl PGN Chess.com memuat ujung jalur pembukaan yang dikenali Chess.com,
     mis. ".../Bogo-Indian-Defense-Nimzowitsch-Variation-5.Nc3" -> langkah ke-9 (5.Nc3). Di 4 partai validasi Chess.com tidak pernah
     mengakhiri buku sebelum langkah itu, jadi semua langkah sampai di situ dihitung buku (batas bawah). p16: SEMUA langkah di URL harus
     cocok dengan langkah partai di urutan yang sama. Di partai Th3Gambitt (3...Nxd4 lalu transposisi ke Scotch 3...exd4) Chess.com
     TIDAK menghitung langkah hasil transposisi sebagai buku, jadi transposisi tidak lagi diterima. */
  function ecoBookPly(game) {
    const url = game && game.headers && game.headers.ECOUrl;
    if (!url || !/chess\.com\/openings\//.test(url)) return 0;
    let slug = '';
    try { slug = decodeURIComponent(String(url).split('?')[0].split('/').pop() || ''); } catch (e) { return 0; }
    slug = slug.replace(/O-O-O/g, 'OOO').replace(/O-O/g, 'OO');
    const toks = slug.split('-');
    const first = toks.findIndex((t) => /^\d+\.(\.\.)?\S/.test(t));
    if (first < 0) return 0;
    let ply = 0, san = '';
    const norm = (s) => String(s || '').replace(/[+#!?-]/g, '');
    for (let k = first; k < toks.length; k++) {
      const t = toks[k];
      let m = t.match(/^(\d+)\.\.\.(.+)$/);
      if (m) { ply = 2 * parseInt(m[1], 10); san = m[2]; }
      else if ((m = t.match(/^(\d+)\.(.+)$/))) { ply = 2 * parseInt(m[1], 10) - 1; san = m[2]; }
      else if (/^[KQRBNa-hO][a-hxO1-8=QRBN]*$/.test(t) && ply) { ply += 1; san = t; }
      else return 0;                                              // token bukan langkah: ECO tidak dipakai
      const mv = game.moves && game.moves[ply - 1];
      if (!mv || norm(mv.san) !== norm(san)) return 0;            // urutan berbeda (transposisi) atau langkah lain: tidak dipakai
    }
    return ply;
  }

  function buildReport(game, evals, opts) {
    const moves = [];
    const ratingOf = { w: parseInt(game.headers.WhiteElo, 10) || 1500, b: parseInt(game.headers.BlackElo, 10) || 1500 };
    const wins = evals.map((e) => evalToWin(e.white, 'w'));
    let stillBook = true;
    let opening = null;
    const ecoPly = ecoBookPly(game);

    for (let i = 0; i < game.moves.length; i++) {
      const mv = game.moves[i];
      const color = mv.color;
      const opp = color === 'w' ? 'b' : 'w';
      const rating = ratingOf[color];
      const before = evals[i], after = evals[i + 1];
      const fenBefore = game.positions[i].fen, fenAfter = game.positions[i + 1].fen;
      const cB = new Chess(fenBefore);
      const legal = cB.moves({ verbose: true });
      const uci = mv.from + mv.to + (mv.promotion || '');

      // ep sesudah
      let playedEval = after.white;
      const lineIdx = before.lines.findIndex((l) => l.move === uci);
      if (lineIdx >= 0 && !after.terminal) playedEval = before.lines[lineIdx].white;
      const bestEval = before.lines.length ? before.lines[0].white : before.white;
      const epBest = evalToEP(bestEval, color, rating);
      const epPlayed = evalToEP(playedEval, color, rating);
      let loss = Math.max(0, evalToEP(bestEval, color, rating, true) - evalToEP(playedEval, color, rating, true));
      if (lineIdx === 0) loss = 0;
      const winBefore = evalToWin(bestEval, color);
      const winAfter = lineIdx === 0 ? winBefore : evalToWin(playedEval, color);
      const winBeforeA = evalToWinAcc(bestEval, color);
      const winAfterA = lineIdx === 0 ? winBeforeA : evalToWinAcc(playedEval, color);

      // buku pembukaan
      const bk = window.OPENING_BOOK && window.OPENING_BOOK[bookKey(fenAfter)];
      let cls;
      if (stillBook && (bk || i < ecoPly)) {
        cls = 'book';
        if (typeof bk === 'string') opening = { eco: bk.split('|')[0], name: bk.split('|')[1], ply: i };
      } else {
        stillBook = false;
        if (legal.length === 1) cls = 'forced';
        else cls = basicClass(loss);
      }

      const info = { reason: null };
      const cA = new Chess(fenAfter);

      if (cls !== 'book' && cls !== 'forced') {
        const prev = moves[i - 1];
        const prevBad = prev && ['mistake', 'blunder', 'miss', 'inaccuracy'].includes(prev.cls);
        // ---- Brilliant — APPROXIMATION (heuristik pengorbanan via SEE; bukan aturan resmi Chess.com) ----
        if (loss <= 0.02 && !after.terminal && !mv.promotion) {
          const hang = hangingPieces(cA, color);
          const cB2 = new Chess(fenBefore);
          // bandingkan dengan bidak yang sudah menggantung sebelumnya (pakai posisi null-move)
          let prevHang = [];
          try {
            const parts = fenBefore.split(' ');
            parts[1] = opp;
            parts[3] = '-';
            const nm = new Chess(parts.join(' '));
            prevHang = hangingPieces(nm, color);
          } catch (e) { prevHang = []; }
          const captured = mv.captured ? VAL[mv.captured] : 0;
          let sac = null;
          for (const h of hang) {
            if (h.type === 'p') continue;
            const was = prevHang.find((p) => p.sq === h.sq && !(h.sq === mv.to));
            const net = h.gain - captured - (was ? was.gain : 0);
            if (net >= 2 && (!sac || h.gain > sac.gain)) sac = { ...h, net };
          }
          void cB2;
          const epAfter = epPlayed;
          const notTrivial = epBest < 0.985 || evalToEP(before.lines[1] ? before.lines[1].white : bestEval, color, rating) < 0.9;
          const lowElo = rating < 1200 ? 0.04 : 0;
          if (sac && epAfter >= 0.5 - lowElo && notTrivial && !(cB.inCheck() && legal.length <= 3)) {
            cls = 'brilliant';
            info.sac = sac;
          }
        }
        // ---- Great — APPROXIMATION (selisih cp terbaik vs kedua + jendela evaluasi; bukan aturan resmi) ----
        if (cls === 'best' || (cls === 'excellent' && loss <= 0.005)) {
          const second = before.lines[1];
          if (second && legal.length > 2) {
            const epSecond = evalToEP(second.white, color, rating);
            const gap = epBest - epSecond;
            const prevMv = game.moves[i - 1];
            const isRecapture = prevMv && prevMv.captured && mv.captured && prevMv.to === mv.to;
            const epPrevForMe = i > 0 ? evalToEP(evals[i - 1].white, color, rating) : 0.5;
            const turnsAround = prevBad && epPrevForMe < 0.4 && epPlayed >= 0.45;
            const cpMover = (ev) => (ev.mate !== undefined && ev.mate !== null ? null : color === 'w' ? ev.cp : -ev.cp);
            const cB = cpMover(bestEval), cS = cpMover(second.white);
            const gapCp = cB !== null && cS !== null ? cB - cS : null;
            // KALIBRASI (patch 10): langkah terbaik mesin yang jauh lebih baik dari langkah kedua (selisih 100–560 cp),
            // bukan rekapitulasi, dan posisi masih hidup (evaluasi -300..+700 cp bagi pemain). Dari 7 partai Chess.com.
            if (!isRecapture && gapCp !== null && gapCp >= GREAT.gapMin && gapCp <= GREAT.gapMax && cB >= GREAT.cbMin && cB <= GREAT.cbMax && gap >= GREAT.epGapMin) {
              cls = 'great';
              info.great = turnsAround ? 'turn' : 'only';
            }
          }
        }
        // ---- Miss — APPROXIMATION (heuristik; ambang EP belum divalidasi ketat) ----
        if (['inaccuracy', 'mistake', 'blunder'].includes(cls) && prevBad) {
          if (epBest >= 0.7 && epPlayed >= 0.3 && epPlayed < epBest - 0.08) {
            cls = 'miss';
          }
        }
      }

      // ---- alasan / penjelasan coach ----
      if (after.terminal && after.white.mate === 0) info.reason = 'checkmate';
      else if (playedEval.mate !== undefined && playedEval.mate !== null && (playedEval.mate > 0) !== (color === 'w') && cls !== 'best') {
        info.reason = 'allowsMate';
        info.mateIn = Math.abs(playedEval.mate);
      } else if (bestEval.mate !== undefined && (bestEval.mate > 0) === (color === 'w') && !(playedEval.mate !== undefined && (playedEval.mate > 0) === (color === 'w')) && ['inaccuracy', 'mistake', 'blunder', 'miss'].includes(cls)) {
        info.reason = 'missedMate';
        info.mateIn = Math.abs(bestEval.mate);
      } else if (playedEval.mate !== undefined && (playedEval.mate > 0) === (color === 'w')) {
        info.reason = 'hasMate';
        info.mateIn = Math.abs(playedEval.mate);
      } else if (['inaccuracy', 'mistake', 'blunder'].includes(cls) && after.lines && after.lines[0]) {
        const sw = pvMaterialSwing(fenAfter, after.lines[0].pv, 5, color);
        if (sw.worst <= -2 && sw.firstCap && sw.firstCap.by === opp) {
          info.reason = 'losesPiece';
          info.piece = sw.firstCap.piece;
        } else if (sw.worst <= -1) {
          info.reason = 'losesMaterial';
        } else info.reason = 'worsens';
      } else if (cls === 'miss' && before.lines[0]) {
        const sw = pvMaterialSwing(fenBefore, before.lines[0].pv, 5, color);
        if (sw.last >= 2 && sw.firstCap && sw.firstCap.by === color) {
          info.reason = 'missedPiece';
          info.piece = sw.firstCap.piece;
        } else info.reason = 'missedWin';
      }

      const bestMove = before.best && before.best !== uci ? before.best : null;
      let bestSan = null;
      if (bestMove) {
        try {
          const t = new Chess(fenBefore);
          bestSan = t.move({ from: bestMove.slice(0, 2), to: bestMove.slice(2, 4), promotion: bestMove[4] }).san;
        } catch (e) { bestSan = null; }
      }
      const inBook = cls === 'book';
      moves.push({
        ply: i,
        color,
        san: mv.san,
        uci,
        from: mv.from,
        to: mv.to,
        captured: mv.captured,
        piece: mv.piece,
        cls,
        loss,
        epBest,
        epPlayed,
        epBefore: epBest, // alias: EP posisi sebelum langkah (langkah terbaik mesin), sudut pandang pemain
        epAfter: epPlayed, // alias: EP setelah langkah yang dimainkan, sudut pandang pemain yang sama
        epLoss: loss,
        evalBest: bestEval,
        evalPlayed: playedEval,
        winBefore,
        winAfter,
        accuracy: cls === 'book' || cls === 'forced' ? 100 : moveAccuracyEstimate(winBeforeA, winAfterA),
        evalAfter: after.white,
        bestMove,
        bestSan,
        bestLine: before.lines[0] ? before.lines[0].pv : [],
        info,
        phase: phaseOf(cA, i, inBook),
        clock: mv.clock
      });
    }

    // statistik
    const counts = { w: {}, b: {} };
    Object.keys(window.CLS).forEach((k) => (counts.w[k] = counts.b[k] = 0));
    Object.keys(window.CLS).forEach((k) => {
      counts.w[k] = 0;
      counts.b[k] = 0;
    });
    moves.forEach((m) => counts[m.color][m.cls]++);
    const accW = calculateAccuracyEstimate(moves, 'w');
    const accB = calculateAccuracyEstimate(moves, 'b');
    const phases = {};
    for (const ph of ['opening', 'middlegame', 'endgame']) {
      phases[ph] = {};
      for (const col of ['w', 'b']) {
        const ms = moves.filter((m) => m.phase === ph && m.color === col);
        if (!ms.length || (ph === 'opening' && ms.every((m) => m.cls === 'book') && ms.length < 2)) {
          phases[ph][col] = ms.length ? 'book' : null;
          continue;
        }
        const nonBook = ms.filter((m) => m.cls !== 'book');
        if (!nonBook.length) {
          phases[ph][col] = 'book';
          continue;
        }
        const a = nonBook.reduce((s, m) => s + m.accuracy, 0) / nonBook.length;
        phases[ph][col] = accToIcon(100 - (100 - a) * ACC.scale); // skala sama dengan akurasi partai
      }
    }
    // key moments
    const keyMoments = moves.filter((m) => ['brilliant', 'great', 'miss', 'mistake', 'blunder'].includes(m.cls)).map((m) => m.ply);

    return {
      moves,
      evals: evals.map((e) => ({ white: e.white, lines: e.lines, best: e.best, depth: e.depth, terminal: e.terminal })),
      wins,
      counts,
      accuracy: { w: accW, b: accB },
      gameRating: {
        w: accW === null ? null : gameRatingEstimate(accW, parseInt(game.headers.WhiteElo, 10)),
        b: accB === null ? null : gameRatingEstimate(accB, parseInt(game.headers.BlackElo, 10))
      },
      phases,
      opening,
      keyMoments,
      meta: (opts && opts.meta) || { engine: null, model: E.MODEL_INFO.version },
      model: E.MODEL_INFO.version
    };
  }

  window.Analyzer = { ecoBookPly, analyzeGame, buildReport, evalToEP, evalToWin, winPct, lineToWhite, classifyByEPLoss, see, hangingPieces, PNAME, VAL, material };
})();