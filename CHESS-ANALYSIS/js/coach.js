/* Teks Coach & terjemahan (ID / EN) */
(function () {
  const EC = (typeof window !== 'undefined' && window.ENGINE_CONFIG) || null;   // js/engine-config.js
  const ENG = (EC && EC.name) || 'Stockfish';
  const MB = (k) => (EC && EC.mb ? EC.mb(k) : k === 'full' ? 99 : 2);
  const T = {
    id: {
      gameReview: 'Ulasan Partai', analysis: 'Analisis', newGame: 'Partai Baru', games: 'Partai',
      startReview: 'Mulai Ulasan', next: 'Berikutnya', best: 'Terbaik', retry: 'Coba Lagi', showBest: 'Langkah Terbaik',
      players: 'Pemain', accuracy: 'Akurasi', gameRating: 'Rating Partai', opening: 'Pembukaan', middlegame: 'Tengah Permainan', endgame: 'Akhir Permainan',
      analyzing: 'Menganalisis partai…', loadingEngine: 'Memuat engine ' + ENG + '…', engineDownloading: 'Mengunduh engine', engineInit: 'Menyiapkan engine…', engineRetry: 'Coba lagi', secShort: 'dtk', minShort: 'mnt', depth: 'Kedalaman',
      pastePgn: 'Tempel PGN di sini…', loadPgn: 'Muat & Analisis', username: 'Username Chess.com', fetch: 'Cari Partai', sample: 'Contoh Partai',
      fenLabel: 'Analisis dari posisi (FEN)', analyzeFen: 'Analisis Posisi', recent: 'Riwayat Ulasan', noRecent: 'Belum ada ulasan.',
      keyMoments: 'Momen Kunci', backToGame: 'Kembali ke partai', variation: 'Variasi', settings: 'Pengaturan', theme: 'Papan', lang: 'Bahasa', sound: 'Suara',
      engineLines: 'Jalur Engine', reviewSummary: 'Ringkasan', correct: 'Benar! Itu langkah yang bagus.', tryAgain: 'Belum tepat, coba lagi.', findBetter: 'Temukan langkah yang lebih baik.',
      white: 'Putih', black: 'Hitam', move: 'Langkah', checkmate: 'Skakmat', draw: 'Remis', mateIn: 'Mat dalam', fast: 'Cepat', standard: 'Standar', deep: 'Dalam', deeper: 'Lebih dalam', veryDeep: 'Sangat dalam',
      loading: 'Memuat…', cancel: 'Batal', noGames: 'Tidak ada partai ditemukan.', fetchFail: 'Gagal mengambil data dari Chess.com. Periksa username / koneksi.',
      invalidPgn: 'PGN tidak valid', invalidFen: 'FEN tidak valid', engineFail: 'Engine gagal dimuat. Jalankan lewat server (http://), bukan file://.', engineFailDetail: 'Engine gagal dimuat: ',
      vs: 'vs', month: 'Bulan', review: 'Ulas', delete: 'Hapus', coachIntro: 'Mari kita ulas partai ini!',
      showArrows: 'Panah langkah terbaik', on: 'Aktif', off: 'Nonaktif', autoplay: 'Putar otomatis', playSpeed: 'Kecepatan putar otomatis', secUnit: 'detik',
      tools: 'Alat pengembang', runTests: 'Tes unit Game Review', validate: 'Validasi vs Chess.com',
      pieceSet: 'Bidak',
      srcAccOfficial: 'Akurasi: angka resmi Chess.com', srcAccApp: 'Akurasi: perkiraan app (angka Chess.com tidak tersedia)', srcMarksOfficial: 'Tanda Brilian, Bagus, Tidak Akurat, Kesalahan, Blunder: resmi Chess.com', srcRating: 'Rating Permainan dan langkah lain: perkiraan app',
      engine: 'Mesin analisis', engLite: 'Ringan (' + MB('lite') + ' MB)', engFull: 'Penuh (' + MB('full') + ' MB)',
      engHint: 'Ringan: cepat dimuat, cocok untuk HP. Penuh: lebih mirip Chess.com, tapi unduhan besar (sekali, lalu tersimpan).',
      engineChanged: 'Mesin diganti. Memuat…', engineBusy: 'Tunggu analisis selesai dulu.',
      offWaiting: 'Aplikasi sedang memuat engine; akan tersimpan otomatis setelah selesai.',
      offline: 'Mode offline', offPrepare: 'Siapkan offline', offClear: 'Hapus data offline',
      offUnsupported: 'Tidak tersedia di alamat ini (butuh localhost atau https).',
      offNoSw: 'Mendaftarkan… muat ulang halaman sekali lalu buka Pengaturan lagi.',
      offAppOnly: 'Aplikasi tersimpan, engine belum. Tekan Siapkan offline (unduhan ±95 MB, sekali saja).',
      offReady: 'Siap offline. Engine tersimpan ({mb} MB).', offDownloading: 'Mengunduh engine… {pct}%',
      offVerifyFail: 'Unduhan engine tidak lengkap. Coba lagi.', offFail: 'Gagal menyiapkan offline.',
      offCleared: 'Data offline dihapus. Muat ulang halaman.', offConfirm: 'Hapus semua data offline (aplikasi dan engine)?', offStorage: 'Penyimpanan terpakai: {mb} MB.', offNoPersist: 'Penyimpanan permanen ditolak browser: data offline bisa dihapus otomatis saat penyimpanan HP menipis.'
    },
    en: {
      gameReview: 'Game Review', analysis: 'Analysis', newGame: 'New Game', games: 'Games',
      startReview: 'Start Review', next: 'Next', best: 'Best', retry: 'Retry', showBest: 'Best Move',
      players: 'Players', accuracy: 'Accuracy', gameRating: 'Game Rating', opening: 'Opening', middlegame: 'Middlegame', endgame: 'Endgame',
      analyzing: 'Analyzing game…', loadingEngine: 'Loading ' + ENG + ' engine…', engineDownloading: 'Downloading engine', engineInit: 'Preparing engine…', engineRetry: 'Retry', secShort: 's', minShort: 'min', depth: 'Depth',
      pastePgn: 'Paste PGN here…', loadPgn: 'Load & Analyze', username: 'Chess.com username', fetch: 'Find Games', sample: 'Sample Game',
      fenLabel: 'Analyze from position (FEN)', analyzeFen: 'Analyze Position', recent: 'Recent Reviews', noRecent: 'No reviews yet.',
      keyMoments: 'Key Moments', backToGame: 'Back to game', variation: 'Variation', settings: 'Settings', theme: 'Board', lang: 'Language', sound: 'Sound',
      engineLines: 'Engine Lines', reviewSummary: 'Summary', correct: 'Correct! That is a good move.', tryAgain: 'Not quite, try again.', findBetter: 'Find a better move.',
      white: 'White', black: 'Black', move: 'Move', checkmate: 'Checkmate', draw: 'Draw', mateIn: 'Mate in', fast: 'Fast', standard: 'Standard', deep: 'Deep', deeper: 'Deeper', veryDeep: 'Very deep',
      loading: 'Loading…', cancel: 'Cancel', noGames: 'No games found.', fetchFail: 'Could not fetch from Chess.com. Check username / connection.',
      invalidPgn: 'Invalid PGN', invalidFen: 'Invalid FEN', engineFail: 'Engine failed to load. Serve over http://, not file://.', engineFailDetail: 'Engine failed to load: ',
      vs: 'vs', month: 'Month', review: 'Review', delete: 'Delete', coachIntro: "Let's review this game!",
      showArrows: 'Best move arrows', on: 'On', off: 'Off', autoplay: 'Autoplay', playSpeed: 'Autoplay speed', secUnit: 'sec',
      tools: 'Developer tools', runTests: 'Game Review unit tests', validate: 'Validate vs Chess.com',
      pieceSet: 'Pieces',
      srcAccOfficial: 'Accuracy: official Chess.com figure', srcAccApp: 'Accuracy: app estimate (Chess.com figure not available)', srcMarksOfficial: 'Brilliant, Great, Inaccuracy, Mistake, Blunder marks: official Chess.com', srcRating: 'Game Rating and other moves: app estimate',
      engine: 'Analysis engine', engLite: 'Lite (' + MB('lite') + ' MB)', engFull: 'Full (' + MB('full') + ' MB)',
      engHint: 'Lite: loads fast, good for phones. Full: closer to Chess.com, but a big download (once, then cached).',
      engineChanged: 'Engine changed. Loading…', engineBusy: 'Wait for the analysis to finish first.',
      offWaiting: 'The app is loading the engine; it will be cached automatically when done.',
      offline: 'Offline mode', offPrepare: 'Prepare offline', offClear: 'Clear offline data',
      offUnsupported: 'Not available at this address (needs localhost or https).',
      offNoSw: 'Registering… reload the page once, then open Settings again.',
      offAppOnly: 'App cached, engine not yet. Tap Prepare offline (about 95 MB, one time).',
      offReady: 'Ready offline. Engine cached ({mb} MB).', offDownloading: 'Downloading engine… {pct}%',
      offVerifyFail: 'Engine download incomplete. Try again.', offFail: 'Could not prepare offline.',
      offCleared: 'Offline data cleared. Reload the page.', offConfirm: 'Delete all offline data (app and engine)?', offStorage: 'Storage used: {mb} MB.', offNoPersist: 'Persistent storage was denied by the browser: offline data may be cleared automatically when device storage runs low.'
    }
  };
  const CLS_NAME = {
    id: { brilliant: 'Brilian', great: 'Bagus', best: 'Terbaik', excellent: 'Sangat Baik', good: 'Baik', book: 'Buku', forced: 'Terpaksa', inaccuracy: 'Tidak Akurat', mistake: 'Kesalahan', miss: 'Terlewat', blunder: 'Blunder' },
    en: { brilliant: 'Brilliant', great: 'Great', best: 'Best', excellent: 'Excellent', good: 'Good', book: 'Book', forced: 'Forced', inaccuracy: 'Inaccuracy', mistake: 'Mistake', miss: 'Miss', blunder: 'Blunder' }
  };
  const PIECE = {
    id: { p: 'pion', n: 'kuda', b: 'gajah', r: 'benteng', q: 'menteri', k: 'raja' },
    en: { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' }
  };

  let lang = localStorage.getItem('cr_lang') || 'id';
  const t = (k) => (T[lang] && T[lang][k]) || T.en[k] || k;
  const clsName = (c) => CLS_NAME[lang][c] || c;

  function headline(m) {
    const s = `<b>${m.san}</b>`;
    if (lang === 'id') {
      return {
        brilliant: `${s} adalah langkah brilian`, great: `${s} adalah langkah bagus`, best: `${s} adalah langkah terbaik`,
        excellent: `${s} sangat baik`, good: `${s} baik`, book: `${s} adalah langkah buku`, forced: `${s} terpaksa`,
        inaccuracy: `${s} tidak akurat`, mistake: `${s} adalah kesalahan`, miss: `${s} adalah peluang terlewat`, blunder: `${s} adalah blunder`
      }[m.cls];
    }
    return {
      brilliant: `${s} is brilliant`, great: `${s} is a great move`, best: `${s} is best`, excellent: `${s} is excellent`, good: `${s} is good`,
      book: `${s} is a book move`, forced: `${s} is forced`, inaccuracy: `${s} is an inaccuracy`, mistake: `${s} is a mistake`, miss: `${s} is a miss`, blunder: `${s} is a blunder`
    }[m.cls];
  }

  function pick(arr, seed) {
    return arr[Math.abs(seed) % arr.length];
  }

  function explain(m, report) {
    const id = lang === 'id';
    const P = PIECE[lang];
    const inf = m.info || {};
    const seed = m.ply * 7 + m.san.length;
    const bestTxt = m.bestSan ? (id ? ` Langkah terbaik adalah <b>${m.bestSan}</b>.` : ` The best move was <b>${m.bestSan}</b>.`) : '';
    switch (inf.reason) {
      case 'checkmate':
        return id ? 'Skakmat! Permainan selesai.' : 'Checkmate! The game is over.';
      case 'allowsMate':
        return (id ? `Ini memberi lawan skakmat dalam ${inf.mateIn}.` : `This allows checkmate in ${inf.mateIn}.`) + bestTxt;
      case 'missedMate':
        return (id ? `Kamu melewatkan skakmat dalam ${inf.mateIn}.` : `You missed a checkmate in ${inf.mateIn}.`) + bestTxt;
      case 'hasMate':
        if (['best', 'great', 'brilliant', 'excellent'].includes(m.cls)) return id ? `Ini mengarah ke skakmat dalam ${inf.mateIn}.` : `This leads to checkmate in ${inf.mateIn}.`;
        break;
      case 'losesPiece':
        return (id ? `Ini kehilangan ${P[inf.piece] || 'bidak'}.` : `This loses a ${P[inf.piece] || 'piece'}.`) + bestTxt;
      case 'losesMaterial':
        return (id ? 'Ini kehilangan material.' : 'This loses material.') + bestTxt;
      case 'worsens':
        return (id ? pick(['Ini memperburuk posisimu.', 'Ada langkah yang lebih baik.', 'Ini memberi lawan keunggulan.'], seed) : pick(['This worsens your position.', 'There was a better move.', 'This gives your opponent the advantage.'], seed)) + bestTxt;
      case 'missedPiece':
        return (id ? `Kamu melewatkan kesempatan memenangkan ${P[inf.piece] || 'bidak'}.` : `You missed a chance to win a ${P[inf.piece] || 'piece'}.`) + bestTxt;
      case 'missedWin':
        return (id ? 'Kamu melewatkan kesempatan untuk unggul.' : 'You missed a chance to gain an advantage.') + bestTxt;
    }
    switch (m.cls) {
      case 'brilliant': {
        const pc = inf.sac ? P[inf.sac.type] : '';
        if (!pc) return id ? 'Langkah brilian! Langkah yang sulit ditemukan.' : 'A brilliant move! A hard move to find.';
        return id ? `Pengorbanan ${pc} yang luar biasa! Langkah yang sulit ditemukan.` : `A brilliant ${pc} sacrifice! A hard move to find.`;
      }
      case 'great':
        return inf.great === 'turn'
          ? (id ? 'Langkah ini membalikkan keadaan!' : 'This move turns the game around!')
          : (id ? 'Satu-satunya langkah bagus di posisi ini. Kerja bagus!' : 'The only good move in this position. Well done!');
      case 'best':
        return id ? pick(['Langkah terbaik menurut engine.', 'Sempurna! Itu langkah engine.', 'Kamu menemukan langkah terbaik.'], seed) : pick(['The engine agrees with this move.', 'Perfect! That is the top engine move.', 'You found the best move.'], seed);
      case 'excellent':
        return (id ? 'Langkah yang sangat kuat.' : 'A very strong move.') + bestTxt;
      case 'good':
        return (id ? 'Langkah yang solid.' : 'A solid move.') + bestTxt;
      case 'book': {
        const op = report && report.opening;
        return op ? (id ? `Teori pembukaan: ${op.name}.` : `Opening theory: ${op.name}.`) : id ? 'Ini langkah teori pembukaan.' : 'This is an opening theory move.';
      }
      case 'forced':
        return id ? 'Hanya ada satu langkah legal.' : 'This was the only legal move.';
      case 'inaccuracy':
      case 'mistake':
      case 'blunder':
      case 'miss':
        return (id ? 'Ada langkah yang lebih baik.' : 'There was a better move.') + bestTxt;
    }
    return '';
  }

  function summary(report, game) {
    const id = lang === 'id';
    const a = report.accuracy;
    const res = game.headers.Result;
    const W = game.headers.White || t('white'), B = game.headers.Black || t('black');
    const best = Math.max(a.w || 0, a.b || 0);
    const leader = (a.w || 0) >= (a.b || 0) ? W : B;
    const bl = report.counts.w.blunder + report.counts.b.blunder;
    let s;
    if (best >= 90) s = id ? `Permainan yang sangat akurat dari ${leader}!` : `A very accurate game by ${leader}!`;
    else if (bl === 0) s = id ? 'Partai yang bersih tanpa blunder. Kerja bagus!' : 'A clean game with no blunders. Nice work!';
    else if (bl >= 4) s = id ? 'Partai yang penuh drama dengan banyak blunder!' : 'A dramatic game full of blunders!';
    else s = id ? `${leader} bermain lebih akurat di partai ini.` : `${leader} played more accurately in this game.`;
    if (res === '1-0') s += id ? ` ${W} menang.` : ` ${W} won.`;
    else if (res === '0-1') s += id ? ` ${B} menang.` : ` ${B} won.`;
    else if (res === '1/2-1/2') s += id ? ' Partai berakhir remis.' : ' The game ended in a draw.';
    return s;
  }

  window.I18N = {
    t, clsName, headline, explain, summary,
    get lang() { return lang; },
    setLang(l) { lang = l; localStorage.setItem('cr_lang', l); }
  };
})();