/* =====================================================================
 * GhostChess Calibration Analyzer v2
 * ==================================
 * 
 * Performs comprehensive calibration analysis including:
 * 1. Accuracy estimation (app vs cc)
 * 2. Per-move classification analysis
 * 3. Auto-tuning recommendations
 * 4. Patch generation
 * 
 * Usage:
 *   const result = CalibrationAnalyzer.run(data);
 *   console.log(result.report);
 *   console.log(result.patch);
 * ===================================================================== */

const CalibrationAnalyzer = (function() {
  'use strict';

  // Classification order (best to worst)
  const CLS_ORDER = ['brilliant', 'great', 'best', 'excellent', 'good', 
                     'inaccuracy', 'mistake', 'miss', 'blunder', 'book', 'forced'];
  const CLS_IDX = {};
  CLS_ORDER.forEach((c, i) => CLS_IDX[c] = i);

  // Current model constants
  const CURRENT = {
    accuracy: { slope: 0.35, decay: 2.0, scale: 2.05 },
    rating: { intercept: -2686, accCoef: 40.42, eloCoef: 0.834 },
    classification: {
      bestTolerance: 0.0001,
      excellent: 0.02,
      good: 0.05,
      inaccuracy: 0.10,
      mistake: 0.20
    }
  };

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
    return { n, mean, std, mae, min: sorted[0], max: sorted[n-1], median };
  }

  // Analyze accuracy estimation
  function analyzeAccuracy(data) {
    const results = {
      overall: { diffs: [] },
      byColor: { white: [], black: [] },
      byTC: {},
      byElo: { '3300+': [], '3000-3299': [], '<3000': [] },
      byPlayer: {}
    };

    data.records.forEach(r => {
      const wDiff = r.app.w - r.cc.w;
      const bDiff = r.app.b - r.cc.b;
      
      results.overall.diffs.push(wDiff, bDiff);
      results.byColor.white.push(wDiff);
      results.byColor.black.push(bDiff);
      
      // By time control
      const tc = r.tclass || 'unknown';
      if (!results.byTC[tc]) results.byTC[tc] = [];
      results.byTC[tc].push(wDiff, bDiff);
      
      // By ELO
      const classifyElo = (elo) => elo >= 3300 ? '3300+' : elo >= 3000 ? '3000-3299' : '<3000';
      results.byElo[classifyElo(r.w.elo)].push(wDiff);
      results.byElo[classifyElo(r.b.elo)].push(bDiff);
      
      // By player
      if (!results.byPlayer[r.w.u]) results.byPlayer[r.w.u] = [];
      if (!results.byPlayer[r.b.u]) results.byPlayer[r.b.u] = [];
      results.byPlayer[r.w.u].push(wDiff);
      results.byPlayer[r.b.u].push(bDiff);
    });

    // Calculate statistics
    const overall = stats(results.overall.diffs);
    const white = stats(results.byColor.white);
    const black = stats(results.byColor.black);
    
    const byTC = {};
    for (const [tc, diffs] of Object.entries(results.byTC)) {
      byTC[tc] = stats(diffs);
    }
    
    const byElo = {};
    for (const [range, diffs] of Object.entries(results.byElo)) {
      byElo[range] = diffs.length > 0 ? stats(diffs) : { n: 0 };
    }

    return {
      overall, white, black, byTC, byElo,
      asymmetry: white.mean - black.mean,
      positiveBiasCount: results.overall.diffs.filter(d => d > 0).length,
      totalCount: results.overall.diffs.length
    };
  }

  // Analyze move classification
  function analyzeClassification(data) {
    const clsCounts = {};
    CLS_ORDER.forEach(c => clsCounts[c] = 0);
    
    const byElo = {
      '3300+': { total: 0, ...Object.fromEntries(CLS_ORDER.map(c => [c, 0])) },
      '3000-3299': { total: 0, ...Object.fromEntries(CLS_ORDER.map(c => [c, 0])) },
      '<3000': { total: 0, ...Object.fromEntries(CLS_ORDER.map(c => [c, 0])) }
    };

    data.records.forEach(r => {
      ['w', 'b'].forEach(color => {
        const counts = r.counts?.[color];
        if (counts) {
          const elo = color === 'w' ? r.w.elo : r.b.elo;
          const eloBucket = elo >= 3300 ? '3300+' : elo >= 3000 ? '3000-3299' : '<3000';
          
          for (const [cls, cnt] of Object.entries(counts)) {
            if (clsCounts[cls] !== undefined) {
              clsCounts[cls] += cnt;
              byElo[eloBucket][cls] += cnt;
              byElo[eloBucket].total += cnt;
            }
          }
        }
      });
    });

    const total = Object.values(clsCounts).reduce((a, b) => a + b, 0);
    
    // Calculate percentages
    const percentages = {};
    for (const cls of CLS_ORDER) {
      percentages[cls] = total > 0 ? (clsCounts[cls] / total * 100).toFixed(1) : '0.0';
    }

    // Per-ELO percentages
    const byEloPct = {};
    for (const [range, data] of Object.entries(byElo)) {
      if (data.total > 0) {
        byEloPct[range] = { total: data.total };
        for (const cls of CLS_ORDER) {
          byEloPct[range][cls] = (data[cls] / data.total * 100).toFixed(1);
        }
      }
    }

    return { total, distribution: clsCounts, percentages, byElo: byEloPct };
  }

  // Analyze move quality (CP loss)
  function analyzeMoveQuality(data) {
    const cpLosses = [];
    const exceptionalMoves = { brilliant: [], blunder: [] };

    data.records.forEach(r => {
      r.mv?.forEach(move => {
        const [color, cls, bestEval, playedEval] = move;
        
        // Calculate CP loss
        if (bestEval?.cp !== undefined && playedEval?.cp !== undefined) {
          const cpLoss = playedEval.cp - bestEval.cp;
          if (cpLoss > 0) cpLosses.push(cpLoss);
        }
        
        // Categorize
        if (cls === 'brilliant') exceptionalMoves.brilliant.push(move);
        if (cls === 'blunder' || cls === 'miss') exceptionalMoves.blunder.push(move);
      });
    });

    const totalMoves = data.records.reduce((a, r) => a + (r.mv?.length || 0), 0);
    
    return {
      totalMoves,
      avgCpLoss: cpLosses.length > 0 
        ? (cpLosses.reduce((a, b) => a + b, 0) / cpLosses.length).toFixed(1)
        : 'N/A',
      maxCpLoss: cpLosses.length > 0 ? Math.max(...cpLosses).toFixed(0) : 'N/A',
      medianCpLoss: cpLosses.length > 0 
        ? [...cpLosses].sort((a,b) => a-b)[Math.floor(cpLosses.length/2)].toFixed(1)
        : 'N/A',
      exceptional: {
        brilliant: exceptionalMoves.brilliant.length,
        blunder: exceptionalMoves.blunder.length
      }
    };
  }

  // Find outliers
  function findOutliers(data, threshold = 2) {
    const outliers = [];
    
    data.records.forEach(r => {
      const wDiff = r.app.w - r.cc.w;
      const bDiff = r.app.b - r.cc.b;
      
      if (Math.abs(wDiff) > threshold) {
        outliers.push({
          player: r.w.u,
          side: 'W',
          elo: r.w.elo,
          app: r.app.w,
          cc: r.cc.w,
          diff: wDiff,
          url: r.url
        });
      }
      if (Math.abs(bDiff) > threshold) {
        outliers.push({
          player: r.b.u,
          side: 'B',
          elo: r.b.elo,
          app: r.app.b,
          cc: r.cc.b,
          diff: bDiff,
          url: r.url
        });
      }
    });
    
    return outliers.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  }

  // Generate recommendations
  function generateRecommendations(accAnalysis) {
    const recommendations = [];
    const { overall, white, black, byTC, byElo } = accAnalysis;

    // 1. Overall bias correction
    if (Math.abs(overall.mean) > 0.3) {
      const adjustment = -overall.mean * 0.015;
      const newScale = Math.max(1.8, Math.min(2.3, CURRENT.accuracy.scale + adjustment));
      
      recommendations.push({
        id: 'GLOBAL_SCALE',
        priority: Math.abs(overall.mean) > 1 ? 'HIGH' : 'MEDIUM',
        issue: `Systematic bias of ${overall.mean.toFixed(2)}`,
        detail: `GhostChess ${overall.mean > 0 ? 'overestimates' : 'underestimates'} accuracy`,
        current: `scale: ${CURRENT.accuracy.scale}`,
        suggested: `scale: ${newScale.toFixed(3)}`,
        action: `Change ACC.scale from ${CURRENT.accuracy.scale} to ${newScale.toFixed(3)}`,
        file: 'js/estimates.js',
        impact: 'Reduces overall bias'
      });
    }

    // 2. TC-specific correction (PRIMARY RECOMMENDATION)
    if (byTC.bullet && byTC.bullet.mean > 1) {
      const bulletBias = byTC.bullet.mean;
      const blitzBias = byTC.blitz?.mean || 0;
      
      recommendations.push({
        id: 'BULLET_CORRECTION',
        priority: 'HIGH',
        issue: `Bullet games have bias of ${bulletBias.toFixed(2)} (vs Blitz: ${blitzBias.toFixed(2)})`,
        detail: 'Blitz is well-calibrated, only bullet needs fixing',
        current: 'Single profile for all TC',
        suggested: `Bullet: apply -${bulletBias.toFixed(2)} correction`,
        action: `Add TC-specific adjustment: if (tc === 'bullet') acc -= ${bulletBias.toFixed(2)}`,
        file: 'js/analyzer.js',
        impact: `Expected: Bullet bias → ~0, Overall bias → ~${((overall.mean - bulletBias * 0.5) / 2).toFixed(2)}`
      });
    }

    // 3. White/Black asymmetry
    if (Math.abs(accAnalysis.asymmetry) > 0.8) {
      recommendations.push({
        id: 'ASYMMETRIC_BIAS',
        priority: 'LOW',
        issue: `Color asymmetry: W=${white.mean.toFixed(2)}, B=${black.mean.toFixed(2)}`,
        current: 'No differentiation',
        suggested: 'Add ±offset based on color',
        action: 'Modify accuracy calculation for Black/White',
        file: 'js/analyzer.js',
        impact: 'Minor improvement'
      });
    }

    // 4. Rating-dependent
    if (byElo['<3000']?.n >= 3 && Math.abs(byElo['<3000'].mean - overall.mean) > 1) {
      recommendations.push({
        id: 'RATING_DEPENDENT',
        priority: 'LOW',
        issue: 'Bias varies by rating',
        detail: 'Consider piecewise calibration',
        current: 'Single curve',
        suggested: 'Rating-based scale adjustment',
        action: 'Collect more data for <3000 ELO',
        file: 'js/estimates.js',
        impact: 'Better calibration for all levels'
      });
    }

    return recommendations;
  }

  // Generate patch code
  function generatePatch(accAnalysis, recommendations) {
    const scaleRec = recommendations.find(r => r.id === 'GLOBAL_SCALE');
    const bulletRec = recommendations.find(r => r.id === 'BULLET_CORRECTION');
    
    const newScale = scaleRec 
      ? parseFloat(scaleRec.suggested.match(/[\d.]+/)[0])
      : CURRENT.accuracy.scale;

    return {
      timestamp: new Date().toISOString(),
      model: 'estimasi-2026.10-p13',
      files: [
        {
          path: 'js/estimates.js',
          description: 'Accuracy calculation profiles',
          before: `const PROFILES = {
  full: { slope: 0.35, decay: 2.0, scale: ${CURRENT.accuracy.scale} },
  lite: { slope: 0.35, decay: 2.0, scale: ${CURRENT.accuracy.scale} }
};`,
          after: `const PROFILES = {
  full: { slope: 0.35, decay: 2.0, scale: ${newScale.toFixed(3)} },
  lite: { slope: 0.35, decay: 2.0, scale: ${newScale.toFixed(3)} }
};`,
          priority: scaleRec?.priority || 'NONE'
        },
        {
          path: 'js/analyzer.js',
          description: 'Add TC-specific accuracy adjustment',
          before: `function calculateAccuracy(epWinChance, playerElo) {
  const acc = ACC_SCALE * (1 - Math.pow(epWinChance, ACC_DECAY));
  return acc;
}`,
          after: `function calculateAccuracy(epWinChance, playerElo, timeControl) {
  let acc = ACC_SCALE * (1 - Math.pow(epWinChance, ACC_DECAY));
  
  // Calibration correction (estimasi-2026.10-p14)
  if (timeControl === 'bullet') {
    acc = Math.max(0, Math.min(100, acc - ${bulletRec ? (bulletRec.issue.match(/[\d.]+/)[0]) : '1.5'}));
  }
  
  return acc;
}`,
          priority: bulletRec?.priority || 'NONE'
        }
      ],
      expected: {
        currentBias: accAnalysis.overall.mean.toFixed(3),
        expectedBiasAfter: '~0',
        currentMAE: accAnalysis.overall.mae.toFixed(3),
        priorityFix: bulletRec ? 'BULLET_CORRECTION' : 'GLOBAL_SCALE'
      }
    };
  }

  // Generate markdown report
  function generateReport(data, results) {
    const { accuracy, classification, moveQuality, outliers, recommendations, patch } = results;
    
    let report = `# GHOSTCHESS CALIBRATION REPORT

## Summary

**Model:** ${data.model || 'estimasi-2026.10-p13'}  
**Games:** ${data.records.length}  
**Player-Game Records:** ${accuracy.overall.n}

### Performance vs Targets

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Bias | ${accuracy.overall.mean > 0 ? '+' : ''}${accuracy.overall.mean.toFixed(2)} | ±0.5 | ${Math.abs(accuracy.overall.mean) <= 0.5 ? '✅' : '⚠️'} |
| MAE | ${accuracy.overall.mae.toFixed(2)} | <1.5 | ${accuracy.overall.mae <= 1.5 ? '✅' : '⚠️'} |
| StdDev | ${accuracy.overall.std.toFixed(2)} | <3.0 | ${accuracy.overall.std <= 3 ? '✅' : '❌'} |

**Verdict:** ${accuracy.overall.mae <= 1.5 ? '✅ GOOD' : accuracy.overall.mae <= 2.0 ? '⚠️ ACCEPTABLE' : '❌ NEEDS FIX'}

---

## Detailed Analysis

### By Time Control

| TC | Bias | MAE | Samples |
|----|------|-----|---------|
`;

    for (const [tc, tcData] of Object.entries(accuracy.byTC)) {
      const status = Math.abs(tcData.mean) <= 0.5 ? '✅' : Math.abs(tcData.mean) <= 1.0 ? '⚠️' : '❌';
      report += `| ${tc} | ${tcData.mean > 0 ? '+' : ''}${tcData.mean.toFixed(2)} ${status} | ${tcData.mae.toFixed(2)} | ${tcData.n} |\n`;
    }

    report += `

### By Rating

| Rating | Bias | MAE | Samples |
|--------|------|-----|---------|
`;

    for (const [range, rangeData] of Object.entries(accuracy.byElo)) {
      if (rangeData.n > 0) {
        report += `| ${range} | ${rangeData.mean > 0 ? '+' : ''}${rangeData.mean.toFixed(2)} | ${rangeData.mae.toFixed(2)} | ${rangeData.n} |\n`;
      }
    }

    report += `

### By Color

| Side | Bias | MAE | Samples |
|------|------|-----|---------|
| White | ${accuracy.white.mean > 0 ? '+' : ''}${accuracy.white.mean.toFixed(2)} | ${accuracy.white.mae.toFixed(2)} | ${accuracy.white.n} |
| Black | ${accuracy.black.mean > 0 ? '+' : ''}${accuracy.black.mean.toFixed(2)} | ${accuracy.black.mae.toFixed(2)} | ${accuracy.black.n} |

**Color Asymmetry:** ${accuracy.asymmetry > 0 ? '+' : ''}${accuracy.asymmetry.toFixed(3)} (${Math.abs(accuracy.asymmetry) < 0.5 ? '✅ Negligible' : '⚠️ Some asymmetry'})

---

## Recommendations

`;

    recommendations.forEach((rec, i) => {
      const icon = rec.priority === 'HIGH' ? '🔴' : rec.priority === 'MEDIUM' ? '🟡' : '🟢';
      report += `### ${i+1}. ${icon} [${rec.id}] - ${rec.priority} PRIORITY

**Issue:** ${rec.issue}  
**File:** \`${rec.file}\`  
**Action:** ${rec.action}

\`\`\`javascript
// Current:
${rec.current}

// Suggested:
${rec.suggested}
\`\`\`

*Impact: ${rec.impact}*\n\n`;
    });

    report += `---

## Patch

\`\`\`javascript
// === PATCH: ${patch.timestamp} ===

// File 1: ${patch.files[0].path}
${patch.files[0].after}

// File 2: ${patch.files[1].path}
${patch.files[1].after}

// Expected improvement:
// - Current bias: ${patch.expected.currentBias}
// - Expected bias after: ${patch.expected.expectedBiasAfter}
\`\`\`

---

## Top Outliers

| # | Player | ELO | Side | App | CC | Diff |
|---|--------|-----|------|-----|-----|------|
`;

    outliers.slice(0, 10).forEach((o, i) => {
      report += `| ${i+1} | ${o.player} | ${o.elo} | ${o.side} | ${o.app.toFixed(1)} | ${o.cc.toFixed(1)} | ${o.diff > 0 ? '+' : ''}${o.diff.toFixed(2)} |\n`;
    });

    report += `

---
*Generated by CalibrationAnalyzer v2*
`;

    return report;
  }

  // Main run function
  function run(data) {
    if (!data || !data.records) {
      throw new Error('Invalid calibration data');
    }

    const accuracy = analyzeAccuracy(data);
    const classification = analyzeClassification(data);
    const moveQuality = analyzeMoveQuality(data);
    const outliers = findOutliers(data, 2);
    const recommendations = generateRecommendations(accuracy);
    const patch = generatePatch(accuracy, recommendations);
    const report = generateReport(data, { accuracy, classification, moveQuality, outliers, recommendations, patch });

    return {
      accuracy,
      classification,
      moveQuality,
      outliers,
      recommendations,
      patch,
      report
    };
  }

  // Export
  return {
    run,
    analyzeAccuracy,
    analyzeClassification,
    analyzeMoveQuality,
    generateRecommendations,
    generatePatch,
    generateReport,
    stats,
    CURRENT
  };

})();

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CalibrationAnalyzer;
}
if (typeof window !== 'undefined') {
  window.CalibrationAnalyzer = CalibrationAnalyzer;
}
if (typeof globalThis !== 'undefined') {
  globalThis.CalibrationAnalyzer = CalibrationAnalyzer;
}
