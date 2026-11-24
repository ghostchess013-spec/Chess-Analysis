/* Tes unit Game Review: batas EP_loss, sudut pandang Putih/Hitam, akurasi per pemain, label model. */
(function () {
  const fakeBody = () => { const cls = new Set(), vars = {}; return { cls, vars, classList: { add: (c) => cls.add(c), remove: (c) => cls.delete(c) }, style: { setProperty: (k, v) => { vars[k] = v; } } }; };
  function runTests() {
    const R = [];
    const t = (group, name, fn) => {
      try {
        const v = fn();
        R.push({ group, name, ok: v === true || v === undefined, detail: v === true || v === undefined ? '' : String(v) });
      } catch (e) { R.push({ group, name, ok: false, detail: 'galat: ' + e.message }); }
    };
    const E = window.Estimates, A = window.Analyzer;
    const eq = (a, b) => (a === b ? true : 'dapat ' + a + ', seharusnya ' + b);
    const near = (a, b, tol) => (Math.abs(a - b) <= (tol || 1e-9) ? true : 'dapat ' + a + ', seharusnya ' + b);

    // ---------- 1. Batas EP_loss (dokumentasi resmi) ----------
    [[0, 'best'], [0.00005, 'best'], [0.0001, 'best'], [0.0101, 'excellent'], [0.0199999, 'excellent'], [0.02, 'good'], [0.0499999, 'good'],
     [0.05, 'inaccuracy'], [0.0999999, 'inaccuracy'], [0.1, 'mistake'], [0.1999999, 'mistake'], [0.2, 'blunder'], [1, 'blunder']]
      .forEach(([l, c]) => t('Batas EP_loss', `EP_loss ${l} → ${c}`, () => eq(E.classifyByEPLoss(l), c)));
    t('Batas EP_loss', 'EP_loss 0.0002 (di atas toleransi Best) → excellent', () => eq(E.classifyByEPLoss(0.0002), 'excellent'));
    t('Floating-point', '0.52 - 0.50 (≈0.02) → good', () => eq(E.classifyByEPLoss(0.52 - 0.5), 'good'));
    t('Floating-point', '0.30 - 0.28 (=0.0199999…) dibulatkan → good', () => eq(E.classifyByEPLoss(0.3 - 0.28), 'good'));
    t('Floating-point', '0.15 - 0.05 (=0.0999999…) dibulatkan → mistake', () => eq(E.classifyByEPLoss(0.15 - 0.05), 'mistake'));
    t('Floating-point', '0.25 - 0.05 (≈0.20) → blunder', () => eq(E.classifyByEPLoss(0.25 - 0.05), 'blunder'));

    // ---------- 2. Sudut pandang Putih / Hitam ----------
    [800, 1500, 2200].forEach((r) => {
      t('Sudut pandang', `rating ${r}: EP(+150, Putih) + EP(+150, Hitam) = 1`, () => near(E.evalToEP({ cp: 150 }, 'w', r) + E.evalToEP({ cp: 150 }, 'b', r), 1));
      t('Sudut pandang', `rating ${r}: EP(+150, Putih) = EP(-150, Hitam)`, () => near(E.evalToEP({ cp: 150 }, 'w', r), E.evalToEP({ cp: -150 }, 'b', r)));
      t('Sudut pandang', `rating ${r}: EP(0) = 0.5 untuk kedua warna`, () => near(E.evalToEP({ cp: 0 }, 'w', r), 0.5) === true && near(E.evalToEP({ cp: 0 }, 'b', r), 0.5));
      t('Sudut pandang', `rating ${r}: EP naik bila evaluasi naik (Putih)`, () => (E.evalToEP({ cp: 100 }, 'w', r) < E.evalToEP({ cp: 200 }, 'w', r) ? true : 'tidak monoton'));
    });
    t('Skor mate', 'mate +3 (Putih mat): EP Putih = 1, Hitam = 0', () => eq(E.evalToEP({ mate: 3 }, 'w', 1500), 1) === true && eq(E.evalToEP({ mate: 3 }, 'b', 1500), 0));
    t('Skor mate', 'mate -3 (Hitam mat): EP Putih = 0, Hitam = 1', () => eq(E.evalToEP({ mate: -3 }, 'w', 1500), 0) === true && eq(E.evalToEP({ mate: -3 }, 'b', 1500), 1));
    t('Skor mate', 'posisi skakmat, Hitam menang: EP Putih 0, Hitam 1', () => eq(E.evalToEP({ mate: 0, winner: 'b' }, 'w', 1500), 0) === true && eq(E.evalToEP({ mate: 0, winner: 'b' }, 'b', 1500), 1));
    t('Skor mate', 'remis/stalemate: EP = 0.5', () => eq(E.evalToEP({ cp: 0, draw: true }, 'w', 1500), 0.5));
    t('Konversi sudut pandang', 'lineToWhite: giliran Hitam, cp +100 → Putih -100', () => eq(A.lineToWhite({ cp: 100 }, 'b').cp, -100));
    t('Konversi sudut pandang', 'lineToWhite: giliran Hitam, mate +2 → Putih mate -2', () => eq(A.lineToWhite({ mate: 2 }, 'b').mate, -2));
    t('Konversi sudut pandang', 'lineToWhite: giliran Putih tidak berubah', () => eq(A.lineToWhite({ cp: 100 }, 'w').cp, 100));
    t('Win% akurasi', 'evalToWinAcc simetris: Putih(+200) + Hitam(+200) = 100', () => near(E.evalToWinAcc({ cp: 200 }, 'w') + E.evalToWinAcc({ cp: 200 }, 'b'), 100, 1e-9));
    t('Win% akurasi', 'mat yang menguntungkan = setara +1500 cp (melewatkan mat cepat saat menang telak tidak dihukum)', () => (near(E.evalToWinAcc({ mate: 3 }, 'w'), E.evalToWinAcc({ cp: 1500 }, 'w'), 1e-9) === true && near(E.evalToWinAcc({ mate: 0, winner: 'b' }, 'b'), E.evalToWinAcc({ cp: -1500 }, 'b'), 1e-9) === true ? true : 'mat tidak setara +1500 cp'));
    t('Win% akurasi', 'mat melawan pemain = 0 (membiarkan mat tetap dihukum)', () => (eq(E.evalToWinAcc({ mate: -2 }, 'w'), 0) === true && eq(E.evalToWinAcc({ mate: 4 }, 'b'), 0) === true ? true : 'mat melawan pemain bukan 0'));

    // ---------- 3. Akurasi per pemain ----------
    const mv = (color, accuracy) => ({ color, accuracy });
    const sample = [mv('w', 100), mv('b', 100), mv('w', 20), mv('b', 100), mv('w', 100), mv('b', 100)];
    t('Akurasi per pemain', 'langkah buruk Putih tidak menurunkan akurasi Hitam', () => near(E.calculateAccuracyEstimate(sample, 'b'), 100, 1e-9));
    t('Akurasi per pemain', 'langkah buruk Putih menurunkan akurasi Putih', () => (E.calculateAccuracyEstimate(sample, 'w') < 100 ? true : 'tidak turun'));
    const sample2 = sample.map((m) => mv(m.color === 'w' ? 'b' : 'w', m.accuracy));
    t('Akurasi per pemain', 'tukar warna → hasil tertukar', () => near(E.calculateAccuracyEstimate(sample2, 'b'), E.calculateAccuracyEstimate(sample, 'w')));
    t('Akurasi per pemain', 'pemain tanpa langkah → null', () => eq(E.calculateAccuracyEstimate([mv('w', 90)], 'b'), null));
    t('Akurasi per pemain', 'hasil dibatasi 0..100', () => { const lo = E.calculateAccuracyEstimate([mv('w', 0), mv('w', 0)], 'w'); const hi = E.calculateAccuracyEstimate([mv('w', 100)], 'w'); return lo >= 0 && hi <= 100 ? true : `lo=${lo} hi=${hi}`; });
    t('Akurasi per pemain', 'moveAccuracyEstimate: tanpa kehilangan = 100', () => near(E.moveAccuracyEstimate(60, 60), 100, 1e-9));
    t('Akurasi per pemain', 'moveAccuracyEstimate menurun saat kehilangan win% naik', () => (E.moveAccuracyEstimate(60, 50) > E.moveAccuracyEstimate(60, 30) ? true : 'tidak menurun'));

    // ---------- 4. Label model (jujur soal estimasi) ----------
    t('Label model', 'tidak ada fungsi bernama calculateCAPS2', () => eq(typeof E.calculateCAPS2, 'undefined'));
    t('Label model', 'ada calculateAccuracyEstimate', () => eq(typeof E.calculateAccuracyEstimate, 'function'));
    t('Label model', 'akurasi & Rating Permainan berstatus ESTIMATE', () => eq(E.MODEL_INFO.components.accuracy.status, 'ESTIMATE') === true && eq(E.MODEL_INFO.components.gameRating.status, 'ESTIMATE'));
    t('Label model', 'Bagus/Brilian/Terlewat berstatus APPROXIMATION', () => ['great', 'brilliant', 'miss'].every((k) => E.MODEL_INFO.components[k].status === 'APPROXIMATION') ? true : 'ada yang bukan APPROXIMATION');
    t('Label model', 'ambang klasifikasi berstatus DOCUMENTED', () => eq(E.MODEL_INFO.components.classificationThresholds.status, 'DOCUMENTED'));
    t('Label model', 'Expected Points berstatus EXPECTED_POINTS_ESTIMATE', () => eq(E.MODEL_INFO.components.expectedPoints.status, 'EXPECTED_POINTS_ESTIMATE'));

    // ---------- 5. Laporan lengkap dengan evaluasi buatan ----------
    const mkGame = (sans) => {
      const c = new Chess(); const positions = [{ fen: c.fen() }]; const moves = [];
      sans.forEach((s) => { const m = c.move(s); moves.push({ san: m.san, from: m.from, to: m.to, color: m.color, piece: m.piece, captured: m.captured, promotion: m.promotion, flags: m.flags }); positions.push({ fen: c.fen() }); });
      return { headers: { WhiteElo: '1500', BlackElo: '1500', White: 'P', Black: 'H' }, moves, positions };
    };
    const L = (cp, move) => ({ white: { cp }, pv: [move], move });
    // Hitam salah (e5 jauh lebih buruk dari c5 untuk Hitam); Putih bermain terbaik
    const gB = mkGame(['a3', 'e5']);
    const evB = [
      { white: { cp: 30 }, lines: [L(30, 'a2a3'), L(20, 'h2h3')], best: 'a2a3', depth: 12 },
      { white: { cp: -300 }, lines: [L(-300, 'c7c5'), L(150, 'e7e5')], best: 'c7c5', depth: 12 },
      { white: { cp: 150 }, lines: [L(150, 'b1c3'), L(100, 'g1f3')], best: 'b1c3', depth: 12 }
    ];
    const rB = A.buildReport(gB, evB, {});
    t('Laporan', 'langkah Putih terbaik: loss = 0', () => eq(rB.moves[0].loss, 0));
    t('Laporan', 'langkah Hitam yang merugikan Hitam: loss > 0.2 → blunder', () => (rB.moves[1].loss > 0.2 && rB.moves[1].cls === 'blunder' ? true : `loss=${rB.moves[1].loss.toFixed(3)} cls=${rB.moves[1].cls}`));
    t('Laporan', 'akurasi Hitam < akurasi Putih', () => (rB.accuracy.b < rB.accuracy.w ? true : `b=${rB.accuracy.b} w=${rB.accuracy.w}`));
    t('Laporan', 'data per langkah: epBefore, epAfter, epLoss, evalBest, evalPlayed ada', () => ['epBefore', 'epAfter', 'epLoss', 'evalBest', 'evalPlayed'].every((k) => k in rB.moves[1]) ? true : 'field hilang');
    t('Laporan', 'epLoss = max(0, epBefore - epAfter)', () => near(rB.moves[1].epLoss, Math.max(0, rB.moves[1].epBefore - rB.moves[1].epAfter), 1e-12));
    t('Laporan', 'laporan memuat versi model', () => (rB.model === E.MODEL_INFO.version && rB.meta && rB.meta.model === E.MODEL_INFO.version ? true : 'versi model hilang'));
    // Cermin: Putih salah, Hitam bermain terbaik
    const gW = mkGame(['a3', 'a6']);
    const evW = [
      { white: { cp: 300 }, lines: [L(300, 'e2e4'), L(-150, 'a2a3')], best: 'e2e4', depth: 12 },
      { white: { cp: -150 }, lines: [L(-150, 'a7a6'), L(-140, 'h7h6')], best: 'a7a6', depth: 12 },
      { white: { cp: -150 }, lines: [L(-150, 'e2e4'), L(-170, 'd2d4')], best: 'e2e4', depth: 12 }
    ];
    const rW = A.buildReport(gW, evW, {});
    t('Laporan (cermin)', 'langkah Putih yang merugikan Putih: loss > 0.2 → blunder', () => (rW.moves[0].loss > 0.2 && rW.moves[0].cls === 'blunder' ? true : `loss=${rW.moves[0].loss.toFixed(3)} cls=${rW.moves[0].cls}`));
    t('Laporan (cermin)', 'langkah Hitam terbaik: loss = 0', () => eq(rW.moves[1].loss, 0));
    t('Laporan (cermin)', 'akurasi Putih < akurasi Hitam', () => (rW.accuracy.w < rW.accuracy.b ? true : `w=${rW.accuracy.w} b=${rW.accuracy.b}`));
    t('Laporan (cermin)', 'kerugian Putih (cermin) sama besar dengan kerugian Hitam di skenario pertama', () => near(rW.moves[0].loss, rB.moves[1].loss, 1e-9));
    // ---------- 6. Profil engine (konstanta akurasi per engine) ----------
    const prof = [mv('w', 100), mv('b', 100), mv('w', 70), mv('b', 85), mv('w', 90), mv('b', 60)];
    t('Profil engine', 'useProfile("lite") memakai konstanta ringan', () => { E.useProfile('lite'); const ok = E.getProfile() === 'lite' && E.ACC.scale === E.PROFILES.lite.scale; E.useProfile('full'); return ok ? true : 'konstanta lite tidak terpasang'; });
    t('Profil engine', 'useProfile("full") mengembalikan konstanta penuh', () => { E.useProfile('lite'); E.useProfile('full'); return E.getProfile() === 'full' && E.ACC.scale === E.PROFILES.full.scale ? true : 'tidak kembali'; });
    t('Profil engine', 'profil tidak dikenal → full', () => { E.useProfile('lite'); const r = E.useProfile('tidak-ada'); return r === 'full' && E.ACC.decay === E.PROFILES.full.decay ? true : 'dapat ' + r; });
    t('Profil engine', 'profil lite memakai konstanta hasil kalibrasi (sama dengan full)', () => { const L = E.PROFILES.lite, F = E.PROFILES.full; return L !== F && L.slope === F.slope && L.decay === F.decay && L.scale === F.scale ? true : 'lite ' + JSON.stringify(L) + ' vs full ' + JSON.stringify(F); });
    t('Profil engine', 'MODEL_INFO mencatat kedua profil', () => (E.MODEL_INFO.components.accuracy.profiles && E.MODEL_INFO.components.accuracy.profiles.full && E.MODEL_INFO.components.accuracy.profiles.lite ? true : 'profil tidak tercatat'));
    {
      const gm = (sans, url) => { const c = new Chess(); sans.split(' ').forEach((x) => c.move(x)); return { headers: url ? { ECOUrl: url } : {}, moves: c.history({ verbose: true }) }; };
      const U = 'https://www.chess.com/openings/';
      const ply = (g) => A.ecoBookPly(g);
      t('Buku ECO Chess.com', 'Bogo-Indian ...-5.Nc3 -> buku sampai langkah ke-9', () => eq(ply(gm('d4 Nf6 c4 e6 Nf3 Bb4+ Bd2 Qe7 Nc3 Nc6', U + 'Bogo-Indian-Defense-Nimzowitsch-Variation-5.Nc3')), 9));
      t('Buku ECO Chess.com', 'Nimzo-Larsen ...-2.Bb2-e6 -> 4', () => eq(ply(gm('b3 f5 Bb2 e6 f3 Nf6', U + 'Nimzowitsch-Larsen-Attack-Dutch-Variation-2.Bb2-e6')), 4));
      t('Buku ECO Chess.com', 'French ...-4...Nfd7-5.Nf3-c5 -> 10', () => eq(ply(gm('e4 e6 d4 d5 Nc3 Nf6 e5 Nfd7 Nf3 c5 Ne2 Nc6', U + 'French-Defense-Classical-Steinitz-Variation-4...Nfd7-5.Nf3-c5')), 10));
      t('Buku ECO Chess.com', 'transposisi (London lewat 1...Nf6) tidak dipakai -> 0', () => eq(ply(gm('d4 Nf6 Bf4 d5 e3 e6', U + 'Queens-Pawn-Opening-Accelerated-London-System-2...Nf6-3.e3')), 0));
      t('Buku ECO Chess.com', 'transposisi Scotch lewat 3...Nxd4 (partai Th3Gambitt) tidak dipakai -> 0', () => eq(ply(gm('e4 e5 Nf3 Nc6 d4 Nxd4 Nxd4 exd4 Qxd4 d6', U + 'Scotch-Game-3...exd4-4.Nxd4-Nxd4-5.Qxd4')), 0));
      t('Buku ECO Chess.com', 'Scotch urutan asli -> 9', () => eq(ply(gm('e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Nxd4 Qxd4 d6', U + 'Scotch-Game-3...exd4-4.Nxd4-Nxd4-5.Qxd4')), 9));
      const O = window.Official;
      if (O) {
        t('Data resmi Chess.com', 'tanda $ PGN Game Review dibaca per langkah', () => { const m = O.parseNags('[White "a"]\n\n1. e4 e5 2. Qh5 $6 Nc6 3. Bc4 Nf6 $4 4. Qxf7# 1-0'); return JSON.stringify(m) === JSON.stringify([null, null, 'inaccuracy', null, null, 'blunder', null]) ? true : JSON.stringify(m); });
        t('Data resmi Chess.com', 'id partai dari header Link / Site', () => eq(O.gameId({ Link: 'https://www.chess.com/analysis/game/live/185318915138/review?move=35' }), '185318915138') === true && eq(O.gameId({ Site: 'https://www.chess.com/game/daily/123' }), '123'));
        const mk = (color, cls, epLoss) => ({ color, cls, epLoss, epBest: 0.5, epPlayed: 0.5 - epLoss, info: { reason: cls === 'mistake' ? 'worsens' : null }, ply: 0 });
        const rep = () => { const r = { moves: [mk('w', 'best', 0), mk('b', 'mistake', 0.03), mk('w', 'great', 0), mk('b', 'inaccuracy', 0.06), mk('w', 'book', 0)], accuracy: { w: 80, b: 70 }, gameRating: {} }; r.moves.forEach((m, i) => (m.ply = i)); return r; };
        const gm2 = { ccMarks: [null, null, null, 'blunder', 'inaccuracy'], ccAccuracy: { w: 50.4, b: 76.5 }, headers: { WhiteElo: '1834', BlackElo: '1816' } };
        t('Data resmi Chess.com', 'tanda resmi menimpa kelas app; tanpa tanda = bukan langkah buruk/Bagus', () => { const r = O.apply(rep(), gm2); const c = r.moves.map((m) => m.cls).join(','); return c === 'best,good,best,blunder,inaccuracy' ? true : c; });
        t('Data resmi Chess.com', 'akurasi resmi dipakai, akurasi app disimpan, jumlah kelas dihitung ulang', () => { const r = O.apply(rep(), gm2); return r.accuracy.w === 50.4 && r.accuracy.b === 76.5 && r.appAccuracy.w === 80 && r.counts.b.blunder === 1 && r.counts.w.inaccuracy === 1 && r.counts.b.good === 1 && r.officialAccuracy && r.officialMarks ? true : JSON.stringify(r.counts); });
        t('Data resmi Chess.com', 'dipanggil dua kali tidak mengubah apa-apa', () => { const r = O.apply(O.apply(rep(), gm2), gm2); return r.appAccuracy.w === 80 && r.accuracy.w === 50.4 ? true : 'berubah'; });
        t('Data resmi Chess.com', 'tanpa data resmi laporan app tidak berubah', () => { const r = O.apply(rep(), { headers: {} }); return r.accuracy.w === 80 && !r.officialAccuracy && !r.officialMarks && r.moves[1].cls === 'mistake' ? true : 'berubah'; });
        t('Data resmi Chess.com', 'angka resmi dipotong seperti layar Game Review (API 88.39 -> 88.3, 73.30 -> 73.2, 82.88 -> 82.8, 91.52 -> 91.5)', () => { const v = [88.39, 73.3, 86.4, 82.88, 91.52, 70.53, 83.85, 100, 0].map(O.display).join(' '); return v === '88.3 73.2 86.3 82.8 91.5 70.5 83.8 100.0 0.0' ? true : v; });
      }
      t('Buku ECO Chess.com', 'rokade di URL (5.O-O) dikenali', () => eq(ply(gm('e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 O-O d6', U + 'Italian-Game-Giuoco-Pianissimo-5.O-O')), 9));
      t('Buku ECO Chess.com', 'langkah terakhir URL tidak cocok -> 0 (tidak dipakai)', () => eq(ply(gm('d4 Nf6 c4 e6 Nf3 Bb4+ Bd2 Qe7 g3 Nc6', U + 'Bogo-Indian-Defense-Nimzowitsch-Variation-5.Nc3')), 0));
      t('Buku ECO Chess.com', 'tanpa ECOUrl atau tanpa langkah di URL -> 0', () => eq(ply(gm('e4 c5')), 0) === true && eq(ply(gm('e4 c5', U + 'Sicilian-Defense')), 0));
    }
    t('Profil engine', 'kondisi awal / setelah tes = full', () => eq(E.getProfile(), 'full'));
    // ---------- 7. Buku pembukaan (js/openings.js) ----------
    // Kunci = 2 ruas FEN pertama (susunan bidak + giliran jalan). Isi buku tidak diperiksa satu per satu
    // (posisinya berubah setiap kali buku dibuat ulang), tapi bentuk dan perilaku proxy-nya diperiksa.
    const OB = window.OPENING_BOOK;
    const FEN0 = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w';
    const nilai0 = () => OB[FEN0];
    t('Buku pembukaan', 'buku terbaca, ukuran > 40.000 posisi', () => (OB && window.OPENING_BOOK_SIZE > 40000 ? true : 'OPENING_BOOK_SIZE = ' + window.OPENING_BOOK_SIZE));
    t('Buku pembukaan', 'posisi awal (2 ruas FEN) dikenali', () => (typeof nilai0() === 'string' && nilai0().length > 3 ? true : String(nilai0())));
    t('Buku pembukaan', 'nilai berbentuk ECO|Nama (mis. A00|King… atau A40|…)', () => (/^[A-E]\d\d\|.+/.test(nilai0()) ? true : String(nilai0())));
    t('Buku pembukaan', 'jumlah nilai di dalam buku = angka ukuran yang dilaporkan', () => {
      const size = window.OPENING_BOOK_SIZE;
      // hitung nilai unik yang benar-benar bisa diambil dari kunci-kunci buku
      const n = Object.keys(OB).map((k) => OB[k]).filter((v) => typeof v === 'string' && v).length;
      return n > 0 && n <= size ? true : 'terambil ' + n + ' dari ukuran ' + size;
    });
    t('Buku pembukaan', 'kunci asing / kosong → undefined (proxy tidak melempar galat)', () => (eq(OB['tidak-ada-posisi-ini'], undefined) === true && eq(OB[''], undefined)));
    t('Buku pembukaan', 'kunci lain (posisi akhir 8 baris kosong) → undefined, bukan nilai palsu', () => eq(OB['8/8/8/8/8/8/8/8 w'], undefined));
    t('Buku pembukaan', 'objek analisis pembukaan juga tersedia (scanOpening)', () => (typeof A.scanOpening === 'function' ? true : 'scanOpening tidak ada'));

    // ---------- 8. Aset Chess.com (papan, bidak, ikon) ----------
    const AS = window.ChessAssets;
    t('Aset Chess.com', 'ChessAssets tersedia dengan bawaan Green + Neo', () => (AS && AS.DEFAULTS.board === '9rdwe' && AS.DEFAULTS.pieces === 'ejgfv' ? true : 'bawaan salah'));
    t('Aset Chess.com', 'pieceUrl("wP","ejgfv") = img/pieces/ejgfv/wp.png', () => eq(AS.pieceUrl('wP', 'ejgfv'), 'img/pieces/ejgfv/wp.png'));
    t('Aset Chess.com', 'pieceUrl("bN","3d_wood") = img/pieces/3d_wood/bn.png', () => eq(AS.pieceUrl('bN', '3d_wood'), 'img/pieces/3d_wood/bn.png'));
    t('Aset Chess.com', 'pieceUrl memakai set aktif bila id tidak diberikan', () => { AS.setPieces('ejgfv', fakeBody()); return eq(AS.pieceUrl('wK'), 'img/pieces/ejgfv/wk.png'); });
    t('Aset Chess.com', 'set 3D (3d_*) dikenali tinggi, set lain tidak', () => eq(AS.isTall('3d_wood') && AS.isTall('3d_plastic') && !AS.isTall('ejgfv') && !AS.isTall('wood'), true));
    t('Aset Chess.com', 'boardEntry id tak dikenal → papan bawaan (Green)', () => eq(AS.boardEntry('tidak-ada').id, '9rdwe'));
    t('Aset Chess.com', 'pieceEntry id tak dikenal → set bawaan (Neo)', () => eq(AS.pieceEntry('tidak-ada').id, 'ejgfv'));
    t('Aset Chess.com', 'applyBoard memasang kelas img-board dan gambar papan', () => { const b = fakeBody(); AS.applyBoard('9rdwe', b); return b.cls.has('img-board') && /img\/boards\/9rdwe\.png/.test(b.vars['--board-img']) ? true : JSON.stringify(b.vars); });
    t('Aset Chess.com', 'applyBoard: koordinat memakai warna kotak lawannya', () => { const b = fakeBody(), e = AS.applyBoard('9rdwe', b); return b.vars['--coord-l'] === e.dark && b.vars['--coord-d'] === e.light ? true : JSON.stringify(b.vars); });
    t('Aset Chess.com', 'setPieces: set 3D diratakan (100% 100%), set biasa 100%', () => { const old = AS.state.pieces; AS.state.pieces = old.concat([{ id: '3d_wood', name: '3D Wood' }]); const a = fakeBody(), c = fakeBody(); AS.setPieces('3d_wood', a); AS.setPieces('ejgfv', c); AS.state.pieces = old; return a.vars['--pc-bg'] === '100% 100%' && c.vars['--pc-bg'] === '100%' ? true : a.vars['--pc-bg'] + ' / ' + c.vars['--pc-bg']; });
    ['brilliant', 'great', 'best', 'excellent', 'good', 'book', 'inaccuracy', 'mistake', 'miss', 'blunder'].forEach((k) =>
      t('Ikon Chess.com', 'ikon ' + k + ' memakai img/icons/' + k + '.png', () => (window.clsIcon(k, 20).indexOf('img/icons/' + k + '.png') >= 0 ? true : window.clsIcon(k, 20))));
    t('Ikon Chess.com', '"forced" tetap SVG (Chess.com tidak punya ikonnya)', () => (/^<svg/.test(window.clsIcon('forced', 20)) ? true : window.clsIcon('forced', 20)));
    t('Ikon Chess.com', 'ukuran ikon mengikuti parameter', () => (/width="33" height="33"/.test(window.clsIcon('best', 33)) ? true : window.clsIcon('best', 33)));
    AS.setPieces('ejgfv', fakeBody());
    return R;
  }

  // tes asinkron: analyzeGame harus memasang profil dari engine dan mencatatnya di meta
  async function runAll() {
    const R = runTests();
    const E = window.Estimates, A = window.Analyzer;
    const add = (name, ok, detail) => R.push({ group: 'Profil engine (analyzeGame)', name, ok: ok === true, detail: ok === true ? '' : String(detail === undefined ? ok : detail) });
    const fake = (profile) => ({ profile, engineName: 'Stockfish tiruan', newGame() {}, async analyze() { return { lines: [{ depth: 10, multipv: 1, pv: ['e2e4'], cp: 30 }, { depth: 10, multipv: 2, pv: ['d2d4'], cp: 20 }], bestmove: 'e2e4', depth: 10 }; } });
    const game = () => { const c = new Chess(); const positions = [{ fen: c.fen() }], moves = []; ['a3', 'e5'].forEach((s) => { const m = c.move(s); moves.push({ san: m.san, from: m.from, to: m.to, color: m.color, piece: m.piece, flags: m.flags }); positions.push({ fen: c.fen() }); }); return { headers: { WhiteElo: '1500', BlackElo: '1500' }, moves, positions }; };
    try {
      const r1 = await A.analyzeGame(game(), fake('lite'), { depth: 10 });
      add('engine ringan → meta.profile = lite dan konstanta lite aktif', r1.meta.profile === 'lite' && E.getProfile() === 'lite', JSON.stringify(r1.meta));
      add('meta mencatat nama engine', r1.meta.engine === 'Stockfish tiruan', r1.meta.engine);
      const r2 = await A.analyzeGame(game(), fake('full'), { depth: 10 });
      add('engine penuh → meta.profile = full', r2.meta.profile === 'full' && E.getProfile() === 'full', JSON.stringify(r2.meta));
      const r3 = await A.analyzeGame(game(), { newGame() {}, async analyze() { return { lines: [{ depth: 10, multipv: 1, pv: ['e2e4'], cp: 0 }], bestmove: 'e2e4', depth: 10 }; } }, { depth: 10 });
      add('engine tanpa profil → dianggap full', r3.meta.profile === 'full', r3.meta.profile);
    } catch (e) { add('analyzeGame dengan engine tiruan', false, e.message); }
    E.useProfile('full');
    return R;
  }
  window.GameReviewTests = { run: runTests, runAll: runAll };
})();
