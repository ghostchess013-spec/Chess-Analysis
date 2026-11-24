/* =====================================================================
 * Alat Analisis Hasil Kalibrasi
 * 
 * Pakai:
 *   1. Buka validasi.html → Jalankan kalibrasi → "Salin JSON" atau "Unduh JSON"
 *   2. Paste JSON ke textarea di bawah atau load file
 *   3. Klik "Analisis"
 * 
 * Atau via console:
 *   kalibrasiAnalysis(jsonString)
 *   kalibrasiAnalysis.analyzePerRating(json)
 *   kalibrasiAnalysis.analyzePerTimeControl(json)
 *   kalibrasiAnalysis.suggestTuning(json)
 * ===================================================================== */

(function() {
  'use strict';

  // Parser & validator
  function parseJSON(str) {
    try {
      const data = JSON.parse(str);
      if (!data.records || !Array.isArray(data.records)) {
        throw new Error('Format tidak valid: harus punya array "records"');
      }
      return data;
    } catch(e) {
      throw new Error('JSON invalid: ' + e.message);
    }
  }

  // Statistik dasar
  function basicStats(values) {
    if (!values.length) return null;
    const n = values.length;
    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / n;
    const sorted = [...values].sort((a, b) => a - b);
    const median = n % 2 === 0 
      ? (sorted[n/2 - 1] + sorted[n/2]) / 2 
      : sorted[Math.floor(n/2)];
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n;
    const stdDev = Math.sqrt(variance);
    const min = sorted[0];
    const max = sorted[n - 1];
    const absValues = values.map(Math.abs);
    const mae = absValues.reduce((a, b) => a + b, 0) / n;
    const rmse = Math.sqrt(values.reduce((a, b) => a + b * b, 0) / n);
    
    // Percentiles
    const p25 = sorted[Math.floor(n * 0.25)];
    const p75 = sorted[Math.floor(n * 0.75)];
    const p90 = sorted[Math.floor(n * 0.90)];
    const p95 = sorted[Math.floor(n * 0.95)];
    
    return {
      n, mean, median, stdDev, min, max, mae, rmse,
      p25, p75, p90, p95,
      bias: mean,  // alias
    };
  }

  // Analisis per rating
  function analyzePerRating(data) {
    const buckets = {
      '<1200': [],
      '1200-1400': [],
      '1400-1600': [],
      '1600-1800': [],
      '1800-2000': [],
      '2000-2200': [],
      '2200-2400': [],
      '2400+': []
    };
    
    const bucketFn = (elo) => {
      if (elo < 1200) return '<1200';
      if (elo < 1400) return '1200-1400';
      if (elo < 1600) return '1400-1600';
      if (elo < 1800) return '1600-1800';
      if (elo < 2000) return '1800-2000';
      if (elo < 2200) return '2000-2200';
      if (elo < 2400) return '2200-2400';
      return '2400+';
    };
    
    data.records.forEach(r => {
      // Putih
      const bw = r.app.w - r.cc.w;
      buckets[bucketFn(r.w.elo)].push({ side: 'w', diff: bw, ...r });
      
      // Hitam
      const bb = r.app.b - r.cc.b;
      buckets[bucketFn(r.b.elo)].push({ side: 'b', diff: bb, ...r });
    });
    
    const result = {};
    for (const [range, items] of Object.entries(buckets)) {
      if (items.length > 0) {
        result[range] = {
          count: items.length,
          stats: basicStats(items.map(i => i.diff))
        };
      }
    }
    return result;
  }

  // Analisis per kontrol waktu
  function analyzePerTimeControl(data) {
    const groups = {};
    
    data.records.forEach(r => {
      const tc = r.tclass || 'unknown';
      if (!groups[tc]) groups[tc] = [];
      
      const wDiff = r.app.w - r.cc.w;
      const bDiff = r.app.b - r.cc.b;
      
      groups[tc].push({ side: 'w', diff: wDiff, ...r });
      groups[tc].push({ side: 'b', diff: bDiff, ...r });
    });
    
    const result = {};
    for (const [tc, items] of Object.entries(groups)) {
      result[tc] = {
        count: items.length,
        stats: basicStats(items.map(i => i.diff))
      };
    }
    return result;
  }

  // Analisis per fase permainan
  function analyzePerPhase(data) {
    const phases = { opening: [], middlegame: [], endgame: [] };
    
    data.records.forEach(r => {
      r.mv.forEach((move, idx) => {
        const ply = idx + 1;
        let phase;
        if (ply <= 10) phase = 'opening';
        else if (ply <= 30) phase = 'middlegame';
        else phase = 'endgame';
        
        phases[phase].push(move[1]); // cls
      });
    });
    
    return {
      opening: { count: phases.opening.length, distribution: countDistribution(phases.opening) },
      middlegame: { count: phases.middlegame.length, distribution: countDistribution(phases.middlegame) },
      endgame: { count: phases.endgame.length, distribution: countDistribution(phases.endgame) }
    };
  }

  // Count distribution helper
  function countDistribution(arr) {
    const counts = {};
    arr.forEach(v => counts[v] = (counts[v] || 0) + 1);
    const total = arr.length;
    const result = {};
    for (const [k, v] of Object.entries(counts)) {
      result[k] = { count: v, pct: Math.round(v / total * 1000) / 10 };
    }
    return result;
  }

  // Analisis outliers
  function findOutliers(data, threshold = 5) {
    const allDiffs = [];
    const outliers = [];
    
    data.records.forEach(r => {
      const wDiff = r.app.w - r.cc.w;
      const bDiff = r.app.b - r.cc.b;
      allDiffs.push(wDiff, bDiff);
    });
    
    const stats = basicStats(allDiffs);
    const cutoff = threshold * stats.stdDev;
    
    data.records.forEach(r => {
      const wDiff = r.app.w - r.cc.w;
      const bDiff = r.app.b - r.cc.b;
      
      if (Math.abs(wDiff) > cutoff) {
        outliers.push({
          url: r.url,
          player: r.w.u,
          elo: r.w.elo,
          side: 'white',
          appAcc: r.app.w,
          ccAcc: r.cc.w,
          diff: wDiff,
          tc: r.tclass,
          plies: r.mv.length
        });
      }
      if (Math.abs(bDiff) > cutoff) {
        outliers.push({
          url: r.url,
          player: r.b.u,
          elo: r.b.elo,
          side: 'black',
          appAcc: r.app.b,
          ccAcc: r.cc.b,
          diff: bDiff,
          tc: r.tclass,
          plies: r.mv.length
        });
      }
    });
    
    return { stats, cutoff, outliers };
  }

  // Suggest tuning berdasarkan bias
  function suggestTuning(data) {
    const allDiffs = [];
    const whiteDiffs = [];
    const blackDiffs = [];
    
    data.records.forEach(r => {
      const wDiff = r.app.w - r.cc.w;
      const bDiff = r.app.b - r.cc.b;
      allDiffs.push(wDiff, bDiff);
      whiteDiffs.push(wDiff);
      blackDiffs.push(bDiff);
    });
    
    const overall = basicStats(allDiffs);
    const white = basicStats(whiteDiffs);
    const black = basicStats(blackDiffs);
    
    // Analisis bias
    const suggestions = [];
    
    if (Math.abs(overall.bias) > 0.5) {
      if (overall.bias > 0) {
        suggestions.push({
          type: 'SCALE_UP',
          reason: `App rata-rata ${overall.bias.toFixed(2)} poin LEBIH TINGGI dari CC`,
          action: 'Naikkan ACC.scale dari 2.05 ke ~2.10',
          code: `full: { slope: 0.35, decay: 2.0, scale: 2.10 }`
        });
      } else {
        suggestions.push({
          type: 'SCALE_DOWN',
          reason: `App rata-rata ${Math.abs(overall.bias).toFixed(2)} poin LEBIH RENDAH dari CC`,
          action: 'Turunkan ACC.scale dari 2.05 ke ~2.00',
          code: `full: { slope: 0.35, decay: 2.0, scale: 2.00 }`
        });
      }
    }
    
    if (Math.abs(white.bias - black.bias) > 1) {
      suggestions.push({
        type: 'BIAS_ASYMMETRIC',
        reason: `Bias Putih: ${white.bias.toFixed(2)}, Hitam: ${black.bias.toFixed(2)}`,
        action: 'Model mungkin perlu treatment berbeda per sisi',
        code: '// Perlu adjust di analyzer.js line ~108'
      });
    }
    
    if (overall.stdDev > 3) {
      suggestions.push({
        type: 'HIGH_VARIANCE',
        reason: `StdDev ${overall.stdDev.toFixed(2)} menunjukkan model tidak stabil`,
        action: 'Coba adjust slope atau decay',
        code: `// Coba: full: { slope: 0.33, decay: 1.9, scale: 2.05 }`
      });
    }
    
    // Check MAE
    if (overall.mae > 2) {
      suggestions.push({
        type: 'HIGH_MAE',
        reason: `MAE ${overall.mae.toFixed(2)} terlalu tinggi`,
        action: 'Perlu kalibrasi lebih banyak data atau model berbeda',
        code: '// Pertimbangkan model hybrid atau weighted average'
      });
    }
    
    return {
      overall,
      white,
      black,
      suggestions,
      summary: suggestions.length === 0 
        ? '✅ Model sudah cukup akurat'
        : `⚠️ ${suggestions.length} hal perlu diperhatikan`
    };
  }

  // Analisis klasifikasi
  function analyzeClassification(data) {
    const comparison = {
      perfect: 0,       // app cls === cc cls
      offByOne: 0,      // selisih 1 level
      offByMore: 0,     // selisih > 1 level
      total: 0
    };
    
    const clsOrder = ['brilliant', 'great', 'book', 'best', 'excellent', 'good', 
                      'inaccuracy', 'mistake', 'miss', 'blunder'];
    
    const perClass = {};
    clsOrder.forEach(c => perClass[c] = { agree: 0, total: 0 });
    
    data.records.forEach(r => {
      r.mv.forEach(move => {
        const [color, appCls, bestEval, playedEval, secondEval] = move;
        // Untuk setiap gerakan, tentukan apakah ada "ground truth" dari CC
        // Ini adalah perkiraan karena kita tidak punya CC classification per move
        
        // Cek jika ada miss detection
        if (appCls === 'miss') {
          // Bandingkan dengan blunder/mistake
        }
      });
    });
    
    return { comparison, perClass };
  }

  // Full analysis report
  function generateReport(data) {
    const model = data.model || 'unknown';
    const count = data.count || data.records.length;
    
    return {
      meta: { model, count, date: data.createdAt },
      overall: basicStats(
        data.records.flatMap(r => [r.app.w - r.cc.w, r.app.b - r.cc.b])
      ),
      perRating: analyzePerRating(data),
      perTimeControl: analyzePerTimeControl(data),
      outliers: findOutliers(data, 2),
      tuning: suggestTuning(data)
    };
  }

  // Export functions
  window.KalibrasiAnalysis = {
    parseJSON,
    basicStats,
    analyzePerRating,
    analyzePerTimeControl,
    analyzePerPhase,
    findOutliers,
    suggestTuning,
    analyzeClassification,
    generateReport,
    
    // Convenience wrapper
    analyze(jsonString) {
      const data = parseJSON(jsonString);
      return generateReport(data);
    }
  };

  // Console helper
  window.kalibrasiAnalysis = window.KalibrasiAnalysis.analyze;

  console.log(`
╔═══════════════════════════════════════════════════════════╗
║  Kalibrasi Analysis Tool Ready                           ║
╠═══════════════════════════════════════════════════════════╣
║  Cara pakai:                                             ║
║  1. Paste JSON ke textarea di halaman                    ║
║  2. Klik "Analisis"                                      ║
║                                                           ║
║  Atau via console:                                        ║
║  kalibrasiAnalysis(jsonString)                           ║
║  KalibrasiAnalysis.analyze(json)                         ║
║  KalibrasiAnalysis.suggestTuning(json)                   ║
╚═══════════════════════════════════════════════════════════╝
  `);

})();
