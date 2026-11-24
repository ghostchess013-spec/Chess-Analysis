/* =====================================================================
 * Comprehensive Calibration Analysis
 * Analisis: 30 games Magnus Carlsen vs opponents
 * 
 * Usage: 
 *   1. Include this file after kalibrasi-analysis.js
 *   2. Or run via Node.js: node analyze-calibration.js
 *   3. Or paste JSON into kalibrasi-analysis.html
 * ===================================================================== */

(function() {
  'use strict';

  // Parse the calibration data
  function parseCalibrationData(json) {
    try {
      return JSON.parse(json);
    } catch(e) {
      console.error('JSON parse error:', e);
      return null;
    }
  }

  // Statistics helper
  function stats(arr) {
    if (!arr || !arr.length) return { n: 0, mean: 0, std: 0, mae: 0, min: 0, max: 0, median: 0 };
    const n = arr.length;
    const sum = arr.reduce((a, b) => a + b, 0);
    const mean = sum / n;
    const sorted = [...arr].sort((a, b) => a - b);
    const median = n % 2 === 0 ? (sorted[n/2-1] + sorted[n/2]) / 2 : sorted[Math.floor(n/2)];
    const variance = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
    const std = Math.sqrt(variance);
    const mae = arr.reduce((a, b) => a + Math.abs(b), 0) / n;
    return { n, mean, std, mae, min: sorted[0], max: sorted[n-1], median, bias: mean };
  }

  // Classification hierarchy
  const CLS_ORDER = ['brilliant', 'great', 'best', 'excellent', 'good', 
                     'inaccuracy', 'mistake', 'miss', 'blunder', 'book', 'forced'];
  const CLS_IDX = {};
  CLS_ORDER.forEach((c, i) => CLS_IDX[c] = i);

  // Analyze accuracy estimation (app vs cc)
  function analyzeAccuracy(data) {
    const whiteDiffs = [];
    const blackDiffs = [];
    const allDiffs = [];
    
    const byRating = {};
    const byTC = {};
    
    data.records.forEach(r => {
      const wDiff = r.app.w - r.cc.w;
      const bDiff = r.app.b - r.cc.b;
      
      whiteDiffs.push(wDiff);
      blackDiffs.push(bDiff);
      allDiffs.push(wDiff, bDiff);
      
      // By rating
      const wBucket = Math.floor(r.w.elo / 200) * 200;
      const bBucket = Math.floor(r.b.elo / 200) * 200;
      if (!byRating[wBucket]) byRating[wBucket] = [];
      if (!byRating[bBucket]) byRating[bBucket] = [];
      byRating[wBucket].push(wDiff);
      byRating[bBucket].push(bDiff);
      
      // By time control
      const tc = r.tclass || 'unknown';
      if (!byTC[tc]) byTC[tc] = [];
      byTC[tc].push(wDiff, bDiff);
    });
    
    const overall = stats(allDiffs);
    const white = stats(whiteDiffs);
    const black = stats(blackDiffs);
    
    const ratingAnalysis = {};
    for (const [bucket, diffs] of Object.entries(byRating)) {
      if (diffs.length >= 2) {
        ratingAnalysis[bucket] = { count: diffs.length, ...stats(diffs) };
      }
    }
    
    const tcAnalysis = {};
    for (const [tc, diffs] of Object.entries(byTC)) {
      tcAnalysis[tc] = { count: diffs.length, ...stats(diffs) };
    }
    
    return { overall, white, black, byRating: ratingAnalysis, byTC: tcAnalysis };
  }

  // Analyze per-move classification
  function analyzeClassification(data) {
    // Compare GhostChess app classification vs Chess.com (simulated)
    // Note: Without CC classification per-move, we analyze the distribution
    
    const appDist = {};    // GhostChess classification distribution
    const ccDist = {};     // Chess.com overall distribution
    const byEloRange = {};
    
    const CLASSES = ['brilliant', 'great', 'best', 'excellent', 'good', 
                     'inaccuracy', 'mistake', 'miss', 'blunder', 'book', 'forced'];
    
    CLASSES.forEach(c => {
      appDist[c] = 0;
      ccDist[c] = 0;
    });
    
    data.records.forEach(r => {
      const elo = r.w.elo;
      const bucket = elo >= 3300 ? '3300+' : elo >= 3000 ? '3000-3299' : '<3000';
      if (!byEloRange[bucket]) {
        byEloRange[bucket] = { app: {}, cc: {}, total: 0 };
        CLASSES.forEach(c => {
          byEloRange[bucket].app[c] = 0;
          byEloRange[bucket].cc[c] = 0;
        });
      }
      
      // Count per player
      for (const color of ['w', 'b']) {
        const counts = r.counts[color];
        const total = Object.values(counts).reduce((a, b) => a + b, 0);
        
        byEloRange[bucket].total += total;
        
        for (const [cls, cnt] of Object.entries(counts)) {
          if (appDist[cls] !== undefined) {
            appDist[cls] += cnt;
            byEloRange[bucket].app[cls] += cnt;
          }
        }
      }
      
      // Chess.com counts
      const ccW = r.cc.w;
      const ccB = r.cc.b;
      // CC doesn't give per-move breakdown, but we can estimate from overall accuracy
    });
    
    // Calculate percentages
    const totalApp = Object.values(appDist).reduce((a, b) => a + b, 0);
    const appPct = {};
    for (const [cls, cnt] of Object.entries(appDist)) {
      appPct[cls] = totalApp > 0 ? (cnt / totalApp * 100).toFixed(1) : '0.0';
    }
    
    // Per-ELO breakdown
    const eloBreakdown = {};
    for (const [range, data] of Object.entries(byEloRange)) {
      const total = data.total;
      eloBreakdown[range] = {
        count: data.total,
        distribution: {}
      };
      for (const cls of CLASSES) {
        eloBreakdown[range].distribution[cls] = total > 0 
          ? (data.app[cls] / total * 100).toFixed(1) 
          : '0.0';
      }
    }
    
    return { total: totalApp, distribution: appDist, percentages: appPct, byElo: eloBreakdown };
  }

  // Analyze move quality patterns (CP loss analysis)
  function analyzeMoveQuality(data) {
    const cpLosses = [];
    const blunders = [];
    const brilliants = [];
    
    data.records.forEach(r => {
      r.mv.forEach((move, idx) => {
        const [color, cls, bestEval, playedEval] = move;
        
        // Calculate CP loss where possible
        if (bestEval && playedEval) {
          let bestCp = bestEval.cp !== undefined ? bestEval.cp : 0;
          let playedCp = playedEval.cp !== undefined ? playedEval.cp : 0;
          
          // Handle mate values
          if (bestEval.mate !== undefined) bestCp = 10000 * Math.sign(bestEval.mate);
          if (playedEval.mate !== undefined) playedCp = 10000 * Math.sign(playedEval.mate);
          
          const cpLoss = playedCp - bestCp;
          
          if (cpLoss > 0) { // Played worse than best
            cpLosses.push(cpLoss);
          }
        }
        
        // Categorize exceptional moves
        if (cls === 'brilliant') brilliants.push(move);
        if (cls === 'blunder' || cls === 'miss') blunders.push(move);
      });
    });
    
    return {
      avgCpLoss: cpLosses.length > 0 
        ? (cpLosses.reduce((a, b) => a + b, 0) / cpLosses.length).toFixed(1)
        : 'N/A',
      maxCpLoss: cpLosses.length > 0 ? Math.max(...cpLosses).toFixed(0) : 'N/A',
      blunderCount: blunders.length,
      brilliantCount: brilliants.length,
      totalMoves: data.records.reduce((a, r) => a + r.mv.length, 0)
    };
  }

  // Generate tuning recommendations
  function generateTuning(data, accuracyAnalysis) {
    const recommendations = [];
    const { overall, white, black, byTC } = accuracyAnalysis;
    
    // 1. Overall bias correction
    const bias = overall.mean;
    if (Math.abs(bias) > 0.3) {
      const adjustment = -bias * 0.015; // Scale adjustment factor
      const currentScale = 2.05;
      const newScale = Math.max(1.8, Math.min(2.3, currentScale + adjustment));
      
      recommendations.push({
        id: 'ACC_SCALE',
        priority: Math.abs(bias) > 1 ? 'HIGH' : 'MEDIUM',
        issue: `GhostChess ${bias > 0 ? 'overestimates' : 'underestimates'} accuracy by ${Math.abs(bias).toFixed(2)} points`,
        current: `{ slope: 0.35, decay: 2.0, scale: ${currentScale} }`,
        suggested: `{ slope: 0.35, decay: 2.0, scale: ${newScale.toFixed(2)} }`,
        action: `Change ACC.scale from ${currentScale} to ${newScale.toFixed(2)}`,
        reason: 'This will reduce systematic bias'
      });
    }
    
    // 2. White vs Black asymmetry
    const asym = white.mean - black.mean;
    if (Math.abs(asym) > 0.8) {
      recommendations.push({
        id: 'ASYMMETRIC_BIAS',
        priority: 'MEDIUM',
        issue: `Asymmetric bias: White ${white.mean.toFixed(2)}, Black ${black.mean.toFixed(2)}`,
        current: 'No side differentiation',
        suggested: 'Add side-specific offset',
        action: 'Consider adding ±0.5% offset based on color',
        reason: 'Chess.com may use different thresholds for White/Black'
      });
    }
    
    // 3. By time control
    for (const [tc, tcData] of Object.entries(byTC)) {
      if (tcData.count >= 10 && Math.abs(tcData.mean) > 1.0) {
        recommendations.push({
          id: `TC_${tc.toUpperCase()}`,
          priority: 'LOW',
          issue: `${tc} has bias of ${tcData.mean.toFixed(2)} (${tcData.count} samples)`,
          current: 'Single profile for all TC',
          suggested: `Profile for ${tc}`,
          action: `Create TC-specific PROFILES entry`,
          reason: 'Different time controls may need different parameters'
        });
      }
    }
    
    // 4. By rating
    recommendations.push({
      id: 'RATING_CURVE',
      priority: 'LOW',
      issue: 'Consider rating-dependent calibration',
      current: 'Single curve for all ratings',
      suggested: 'Piecewise linear or polynomial fit',
      action: 'Collect more data across rating spectrum',
      reason: 'EP curve shape may vary by player strength'
    });
    
    return recommendations;
  }

  // Generate patch code
  function generatePatch(accuracyAnalysis) {
    const { overall } = accuracyAnalysis;
    const bias = overall.mean;
    
    const currentScale = 2.05;
    const adjustment = -bias * 0.015;
    const newScale = Math.max(1.8, Math.min(2.3, currentScale + adjustment));
    
    return `
// ═══════════════════════════════════════════════════════════════
// CALIBRATION PATCH - Generated ${new Date().toISOString()}
// Based on: 30 games analysis
// Model: ${data.model || 'estimasi-2026.10-p13'}
// ═══════════════════════════════════════════════════════════════

// File: js/estimates.js

// --- BEFORE ---
const PROFILES = {
  full: { slope: 0.35, decay: 2.0, scale: ${currentScale} },
  lite: { slope: 0.35, decay: 2.0, scale: ${currentScale} }
};

// --- AFTER ---
const PROFILES = {
  full: { slope: 0.35, decay: 2.0, scale: ${newScale.toFixed(2)} },
  lite: { slope: 0.35, decay: 2.0, scale: ${newScale.toFixed(2)} }
};

// --- IMPACT ESTIMATE ---
// Bias before: ${bias.toFixed(2)}
// Expected bias after: ~0
// MAE before: ${overall.mae.toFixed(2)}
// StdDev: ${overall.std.toFixed(2)}

// ═══════════════════════════════════════════════════════════════
`;
  }

  // Main analysis function
  function runFullAnalysis(json) {
    const data = parseCalibrationData(json);
    if (!data) return null;
    
    console.log('\n' + '═'.repeat(70));
    console.log('  GHOSTCHESS CALIBRATION ANALYSIS');
    console.log('  Based on 30 games: Magnus Carlsen (3000-3400) vs various opponents');
    console.log('═'.repeat(70) + '\n');
    
    // 1. Accuracy Analysis
    console.log('📊 1. ACCURACY ESTIMATION ANALYSIS');
    console.log('-'.repeat(50));
    const accResult = analyzeAccuracy(data);
    
    console.log(`   Overall (${accResult.overall.n} samples):`);
    console.log(`   ├─ Bias: ${accResult.overall.mean.toFixed(2)} ${accResult.overall.mean > 0 ? '↑' : '↓'}`);
    console.log(`   ├─ MAE: ${accResult.overall.mae.toFixed(2)}`);
    console.log(`   ├─ StdDev: ${accResult.overall.std.toFixed(2)}`);
    console.log(`   └─ Range: [${accResult.overall.min.toFixed(2)}, ${accResult.overall.max.toFixed(2)}]`);
    
    console.log(`\n   By Color:`);
    console.log(`   ├─ White (n=${accResult.white.n}): bias=${accResult.white.mean.toFixed(2)}, MAE=${accResult.white.mae.toFixed(2)}`);
    console.log(`   └─ Black (n=${accResult.black.n}): bias=${accResult.black.mean.toFixed(2)}, MAE=${accResult.black.mae.toFixed(2)}`);
    
    console.log(`\n   By Time Control:`);
    for (const [tc, tcData] of Object.entries(accResult.byTC)) {
      console.log(`   ├─ ${tc} (n=${tcData.count}): bias=${tcData.mean.toFixed(2)}, MAE=${tcData.mae.toFixed(2)}`);
    }
    
    // 2. Classification Analysis
    console.log('\n\n📊 2. MOVE CLASSIFICATION DISTRIBUTION');
    console.log('-'.repeat(50));
    const clsResult = analyzeClassification(data);
    
    console.log(`   Total moves analyzed: ${clsResult.total}`);
    console.log(`\n   Classification breakdown:`);
    for (const cls of CLS_ORDER) {
      const cnt = clsResult.distribution[cls] || 0;
      const pct = clsResult.percentages[cls] || '0.0';
      const bar = '█'.repeat(Math.round(parseFloat(pct) / 2));
      console.log(`   ${cls.padEnd(12)} ${String(cnt).padStart(4)} (${pct.padStart(5)}%) ${bar}`);
    }
    
    // 3. Move Quality
    console.log('\n\n📊 3. MOVE QUALITY PATTERNS');
    console.log('-'.repeat(50));
    const mqResult = analyzeMoveQuality(data);
    console.log(`   Total moves: ${mqResult.totalMoves}`);
    console.log(`   Avg CP loss: ${mqResult.avgCpLoss}`);
    console.log(`   Max CP loss: ${mqResult.maxCpLoss}`);
    console.log(`   Blunders: ${mqResult.blunderCount}`);
    console.log(`   Brilliants: ${mqResult.brilliantCount}`);
    
    // 4. Tuning Recommendations
    console.log('\n\n📊 4. TUNING RECOMMENDATIONS');
    console.log('-'.repeat(50));
    const tuning = generateTuning(data, accResult);
    
    if (tuning.length === 0) {
      console.log('   ✅ Model is well calibrated!');
    } else {
      tuning.forEach((rec, idx) => {
        const icon = rec.priority === 'HIGH' ? '🔴' : rec.priority === 'MEDIUM' ? '🟡' : '🟢';
        console.log(`\n   ${icon} [${rec.id}] ${rec.priority} PRIORITY`);
        console.log(`   Issue: ${rec.issue}`);
        console.log(`   Action: ${rec.action}`);
        console.log(`   Change: ${rec.current} → ${rec.suggested}`);
        console.log(`   Reason: ${rec.reason}`);
      });
    }
    
    // 5. Generated Patch
    console.log('\n\n📊 5. SUGGESTED PATCH CODE');
    console.log('-'.repeat(50));
    const patch = generatePatch(accResult);
    console.log(patch);
    
    console.log('\n' + '═'.repeat(70));
    console.log('  Analysis Complete');
    console.log('═'.repeat(70) + '\n');
    
    // Return structured results
    return {
      accuracy: accResult,
      classification: clsResult,
      moveQuality: mqResult,
      recommendations: tuning,
      patch: patch
    };
  }

  // Export
  window.CalibrationAnalyzer = {
    analyze: runFullAnalysis,
    analyzeAccuracy,
    analyzeClassification,
    analyzeMoveQuality,
    generateTuning,
    generatePatch,
    stats,
    CLS_ORDER,
    CLS_IDX
  };

  // Console shortcut
  window.calibAnalyze = runFullAnalysis;

  console.log(`
╔══════════════════════════════════════════════════════════════╗
║  Calibration Analyzer Ready                                 ║
╠══════════════════════════════════════════════════════════════╣
║  Usage:                                                      ║
║  1. Paste JSON into kalibrasi-analysis.html                  ║
║  2. Or via console:                                          ║
║     calibAnalyze(jsonString)                                 ║
║     CalibrationAnalyzer.analyze(json)                        ║
╚══════════════════════════════════════════════════════════════╝
  `);

})();
