/* =====================================================================
 * MODUL ESTIMASI — Game Review
 *
 * PENTING: kode di file ini BUKAN formula internal Chess.com.
 * Chess.com tidak memublikasikan rumus CAPS2 maupun kurva Expected Points.
 * Isi file ini dipisah menjadi tiga jenis (lihat MODEL_INFO.components):
 *
 *   DOCUMENTED     : bersumber dari dokumentasi resmi Chess.com (ambang klasifikasi).
 *   ESTIMATE       : model buatan sendiri yang disetel pada data pembanding (kurva EP,
 *                    akurasi, Rating Permainan). Bukan rumus asli; dapat diganti tanpa
 *                    mengubah modul lain selama antarmuka fungsinya sama.
 *   APPROXIMATION  : heuristik (Bagus, Brilian, Terlewat) di analyzer.js.
 *
 * Konstanta ESTIMATE disetel pada 14 sisi pemain dari 7 partai Chess.com (rating 1300–1900,
 * blitz dan bullet). Kecocokan pada sedikit partai BUKAN bukti rumus asli telah ditiru.
 * ===================================================================== */
(function () {
  const MODEL_INFO = {
    version: 'estimasi-2026.10-p14',
    note: 'Bukan formula internal Chess.com. Lihat components[*].status.',
    components: {
      classificationThresholds: {
        status: 'DOCUMENTED',
        source: 'https://support.chess.com/en/articles/8572705-how-are-moves-classified-what-is-a-blunder-or-brilliant-etc',
        detail: 'Batas EP_loss 0.02 / 0.05 / 0.10 / 0.20. Nilai tepat di batas masuk kelas yang lebih rendah mutunya (0.02 = Good).',
        implementationParameter: 'BEST_TOLERANCE (bukan angka resmi)'
      },
      expectedPoints: {
        status: 'EXPECTED_POINTS_ESTIMATE',
        detail: 'Logistik atas centipawn dengan kemiringan bergantung rating (kFactor). Chess.com hanya menyatakan EP bergantung pada rating dan evaluasi; kurvanya tidak dipublikasikan.',
        limits: 'Saturasi di posisi sangat unggul/kalah kemungkinan berbeda dari Chess.com.',
        tested: 'Alternatif tanh/CAPS dari teks luar dan WDL Stockfish diuji dan lebih buruk pada data pembanding.'
      },
      accuracy: {
        status: 'ESTIMATE',
        name: 'calculateAccuracyEstimate',
        detail: 'Rata-rata biasa akurasi per langkah (buku/terpaksa = 100) pada kurva win% landai, diskalakan.',
        dataset: '14 sisi / 7 partai; galat validasi silang ±1.9 poin',
        limits: 'Bukan CAPS2. Uji pada partai di luar rentang rating 1300–1900 belum ada.',
        profiles: {
          full: { status: 'ESTIMATE', detail: 'Konstanta disetel pada data pembanding (14 sisi / 7 partai).' },
          scaleP14: { status: 'ESTIMATE', detail: 'p14: skala 2.0 -> 2.05. Data: 30 partai API Chess.com (60 sisi, rating 2989-3408, blitz/bullet) + 4 partai validasi (8 sisi, ~1700-1870). Selisih rata-rata master 1.77 -> 1.68 (bias +1.06 -> +0.76), level klub 1.60 -> 1.53 (bias +0.57 -> +0.17). Model lain (slope/decay/scale bebas, rata-rata pangkat, gaya Lichess, berbasis EP) tidak lebih baik di validasi silang.' },
          mateAsymmetric: { status: 'ESTIMATE', detail: 'p13: mat yang menguntungkan = +1500 cp, mat melawan = 0. Uji 3 partai Chess.com (6 sisi, engine full kedalaman 15): selisih akurasi rata-rata 2.53 -> 1.20 poin, terbesar 9.4 -> 2.0. Sampel kecil; konstanta lain tidak diubah.' },
          lite: { status: 'ESTIMATE_ALIGNED_TO_FULL', detail: 'Disamakan dengan konstanta full. Uji 6 partai (12 sisi, Stockfish 19 lite vs full, kedalaman 15): selisih akurasi rata-rata 3.4 poin (konstanta lama 1.7/1.7: 3.8; bias +3.0 menjadi -1.1). Konstanta khusus lite hasil penyetelan lebih buruk di validasi silang (3.9), jadi tidak dipakai. Sisa selisih berasal dari evaluasi engine ringan, bukan dari konstanta.' }
        }
      },
      gameRating: {
        status: 'ESTIMATE',
        name: 'gameRatingEstimate',
        detail: 'Regresi linear atas akurasi dan rating pemain, dibatasi ±650 dari rating pemain.',
        dataset: '12 titik (2 titik pencilan dari satu partai bullet pendek dikeluarkan); galat di luar sampel ±74',
        limits: 'Chess.com memetakan ke kolam rating kontrol waktu; model ini belum membedakan kontrol waktu.'
      },
      great: { status: 'APPROXIMATION', detail: 'Selisih centipawan langkah terbaik vs kedua + jendela evaluasi; disetel pada 6 contoh.' },
      brilliant: { status: 'APPROXIMATION', detail: 'Pengorbanan bidak (SEE) pada langkah terbaik; disetel pada 1 contoh.' },
      miss: { status: 'APPROXIMATION', detail: 'Langkah lemah setelah kesalahan lawan dengan ambang EP; belum divalidasi ketat.' },
      book: { status: 'DATA_SOURCE', sources: ['Lichess chess-openings (CC0)', 'Polyglot: gm2001, Elo2400, KomodoVariety'], detail: 'Posisi buku dari data terbuka; kedalaman dicocokkan pada 7 partai.' }
    }
  };

  /* ---------- DOCUMENTED: klasifikasi dari EP_loss ---------- */
  const BEST_TOLERANCE = 0.0001; // parameter implementasi (BUKAN angka resmi): EP_loss <= ini dianggap setara langkah terbaik
  function classifyByEPLoss(loss) {
    // pembulatan 1e-9 menghindari galat floating-point di batas (mis. 0.3 - 0.28 = 0.0199999...)
    const l = Math.round(loss * 1e9) / 1e9;
    if (l <= BEST_TOLERANCE) return 'best';
    if (l < 0.02) return 'excellent';
    if (l < 0.05) return 'good';
    if (l < 0.10) return 'inaccuracy';
    if (l < 0.20) return 'mistake';
    return 'blunder';
  }

  /* ---------- EXPECTED_POINTS_ESTIMATE ---------- */
  const EP_LOSS_FLATNESS = 1.0; // 1 = kurva EP untuk ambang tidak diubah (uji 0.57: perbaikan kecil/campuran)
  function kFactor(rating) {
    const r = Math.max(400, Math.min(2800, rating || 1500));
    return 0.00368208 * (0.62 + 0.38 * ((r - 400) / 2400)) * 1.12;
  }
  function evalToEP(ev, color, rating, flat) {
    // ev: {cp|mate} dari sudut pandang Putih; hasil: EP (0..1) dari sudut pandang `color`
    if (ev.mate !== undefined && ev.mate !== null) {
      if (ev.mate === 0) return ev.winner ? (ev.winner === color ? 1 : 0) : 0.5;
      const whiteMates = ev.mate > 0;
      return whiteMates === (color === 'w') ? 1 : 0;
    }
    if (ev.draw) return 0.5;
    const cp = color === 'w' ? ev.cp : -ev.cp;
    return 1 / (1 + Math.exp(-kFactor(rating) * (flat ? EP_LOSS_FLATNESS : 1) * cp));
  }

  /* ---------- ESTIMATE: akurasi ---------- */
  // Profil konstanta akurasi per engine. 'full' = Stockfish penuh (disetel pada data pembanding Chess.com).
  // 'lite' = engine ringan: diuji terhadap full pada 6 partai (lihat MODEL_INFO); konstanta full paling cocok,
  // jadi lite memakai nilai yang sama. Profil tetap dipisah supaya bisa disetel ulang bila ada data Chess.com untuk lite.
  const PROFILES = {
    full: { slope: 0.35, decay: 2.0, scale: 2.05 },   // p14: skala 2.0 -> 2.05 (30 partai API Chess.com + 4 partai validasi)
    lite: { slope: 0.35, decay: 2.0, scale: 2.05 }
  };
  let currentProfile = 'full';
  const ACC = Object.assign({}, PROFILES.full); // objek ini diubah di tempat (analyzer.js memegang referensinya)
  function useProfile(name) {
    currentProfile = PROFILES[name] ? name : 'full';
    Object.assign(ACC, PROFILES[currentProfile]);
    return currentProfile;
  }
  function getProfile() { return currentProfile; }
  const WIN_ACC_CLAMP = 1500;
  function winAccFromCp(cp) {
    cp = Math.max(-WIN_ACC_CLAMP, Math.min(WIN_ACC_CLAMP, cp));
    return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * ACC.slope * cp)) - 1);
  }
  function evalToWinAcc(ev, color) {
    // Mat ASIMETRIS (disetel pada 3 partai Chess.com): mat yang menguntungkan pemain disamakan dengan +1500 cp,
    // jadi melewatkan mat lebih cepat saat sudah menang telak tidak dihukum. Mat yang melawan pemain tetap 0,
    // jadi membiarkan mat di posisi kalah tetap dihukum. Keduanya sesuai pola tanda Chess.com.
    if (ev.mate !== undefined && ev.mate !== null) {
      if (ev.mate === 0) return ev.winner ? (ev.winner === color ? winAccFromCp(WIN_ACC_CLAMP) : 0) : 50;
      return (ev.mate > 0) === (color === 'w') ? winAccFromCp(WIN_ACC_CLAMP) : 0;
    }
    if (ev.draw) return 50;
    return winAccFromCp(color === 'w' ? ev.cp : -ev.cp);
  }
  function moveAccuracyEstimate(winBefore, winAfter) {
    // bentuk eksponensial terbuka milik Lichess (103.17, 0.04354) dengan penalti ACC.decay; BUKAN CAPS2
    const d = Math.max(0, winBefore - winAfter);
    const a = 103.1668100711649 * Math.exp(-0.04354415386753951 * ACC.decay * d) - 3.166924740191411;
    return Math.max(0, Math.min(100, a + 1));
  }
  function calculateAccuracyEstimate(moves, color) {
    // per pemain: langkah lawan tidak ikut dihitung
    const accs = moves.filter((m) => m.color === color).map((m) => m.accuracy);
    if (!accs.length) return null;
    const mean = accs.reduce((a, b) => a + b, 0) / accs.length;
    return Math.max(0, Math.min(100, 100 - (100 - mean) * ACC.scale));
  }

  /* ---------- ESTIMATE: Rating Permainan ---------- */
  function gameRatingEstimate(acc, playerRating) {
    const pr = playerRating > 0 ? playerRating : 1500;
    let r = -2686 + 40.42 * acc + 0.834 * pr;
    r = Math.max(pr - 650, Math.min(pr + 650, r));
    r = Math.max(100, Math.min(3200, r));
    return Math.round(r / 50) * 50;
  }

  window.Estimates = {
    MODEL_INFO, BEST_TOLERANCE, ACC, PROFILES, useProfile, getProfile, EP_LOSS_FLATNESS,
    classifyByEPLoss, kFactor, evalToEP, evalToWinAcc,
    moveAccuracyEstimate, calculateAccuracyEstimate, gameRatingEstimate
  };
})();
