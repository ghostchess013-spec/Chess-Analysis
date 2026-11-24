/* =====================================================================
 * Run Calibration Analysis
 * Usage: node run-analysis.js [json-file]
 * 
 * If no file provided, uses inline data from 30 Magnus Carlsen games
 * ===================================================================== */

const fs = require('fs');

// Inline calibration data from 30 games
const CALIBRATION_DATA = {
  "format": "game-review-kalibrasi-1",
  "model": "estimasi-2026.10-p13",
  "createdAt": "2026-10-14T12:38:04.362Z",
  "count": 30,
  "records": [
    {
      "url": "https://www.chess.com/game/live/185309700660",
      "tc": "180", "tclass": "blitz",
      "cc": {"w": 84.97, "b": 89.25},
      "app": {"w": 84.12, "b": 87.44},
      "w": {"elo": 3067}, "b": {"elo": 3408}
    },
    {
      "url": "https://www.chess.com/game/live/185309569912",
      "tc": "180", "tclass": "blitz",
      "cc": {"w": 95.58, "b": 88.28},
      "app": {"w": 96.87, "b": 89.52},
      "w": {"elo": 3406}, "b": {"elo": 3069}
    },
    {
      "url": "https://www.chess.com/game/live/185308859590",
      "tc": "180", "tclass": "blitz",
      "cc": {"w": 96.56, "b": 87.52},
      "app": {"w": 97.23, "b": 89.51},
      "w": {"elo": 3404}, "b": {"elo": 3083}
    },
    {
      "url": "https://www.chess.com/game/live/185308615224",
      "tc": "180", "tclass": "blitz",
      "cc": {"w": 85.83, "b": 89.24},
      "app": {"w": 88.31, "b": 90.47},
      "w": {"elo": 3085}, "b": {"elo": 3402}
    },
    {
      "url": "https://www.chess.com/game/live/185308478452",
      "tc": "180", "tclass": "blitz",
      "cc": {"w": 87.62, "b": 79.67},
      "app": {"w": 86.81, "b": 80.71},
      "w": {"elo": 3400}, "b": {"elo": 3087}
    },
    {
      "url": "https://www.chess.com/game/live/185202554214",
      "tc": "180", "tclass": "blitz",
      "cc": {"w": 92.51, "b": 86.13},
      "app": {"w": 95.69, "b": 82.58},
      "w": {"elo": 3396}, "b": {"elo": 3014}
    },
    {
      "url": "https://www.chess.com/game/live/185202365212",
      "tc": "180", "tclass": "blitz",
      "cc": {"w": 77.98, "b": 84.03},
      "app": {"w": 79.34, "b": 85.48},
      "w": {"elo": 3016}, "b": {"elo": 3394}
    },
    {
      "url": "https://www.chess.com/game/live/185201915476",
      "tc": "180", "tclass": "blitz",
      "cc": {"w": 93.45, "b": 87.10},
      "app": {"w": 93.49, "b": 87.48},
      "w": {"elo": 3392}, "b": {"elo": 3097}
    },
    {
      "url": "https://www.chess.com/game/live/185126650094",
      "tc": "180", "tclass": "blitz",
      "cc": {"w": 97.27, "b": 90.95},
      "app": {"w": 97.28, "b": 89.93},
      "w": {"elo": 3389}, "b": {"elo": 2989}
    },
    {
      "url": "https://www.chess.com/game/live/185126449352",
      "tc": "180", "tclass": "blitz",
      "cc": {"w": 82.05, "b": 89.77},
      "app": {"w": 85.76, "b": 93.30},
      "w": {"elo": 2991}, "b": {"elo": 3388}
    },
    {
      "url": "https://www.chess.com/game/live/185126243802",
      "tc": "180", "tclass": "blitz",
      "cc": {"w": 95.26, "b": 91.53},
      "app": {"w": 96.24, "b": 92.64},
      "w": {"elo": 3386}, "b": {"elo": 2993}
    },
    {
      "url": "https://www.chess.com/game/live/185126039306",
      "tc": "180", "tclass": "blitz",
      "cc": {"w": 95.84, "b": 96.80},
      "app": {"w": 96.51, "b": 97.57},
      "w": {"elo": 2995}, "b": {"elo": 3384}
    },
    {
      "url": "https://www.chess.com/game/live/185125936484",
      "tc": "60", "tclass": "bullet",
      "cc": {"w": 86.54, "b": 86.45},
      "app": {"w": 87.43, "b": 88.70},
      "w": {"elo": 3321}, "b": {"elo": 2998}
    },
    {
      "url": "https://www.chess.com/game/live/185125533096",
      "tc": "60", "tclass": "bullet",
      "cc": {"w": 83.61, "b": 89.32},
      "app": {"w": 89.90, "b": 94.33},
      "w": {"elo": 3000}, "b": {"elo": 3319}
    },
    {
      "url": "https://www.chess.com/game/live/185125473810",
      "tc": "60", "tclass": "bullet",
      "cc": {"w": 84.92, "b": 76.19},
      "app": {"w": 88.73, "b": 81.93},
      "w": {"elo": 3317}, "b": {"elo": 3002}
    },
    {
      "url": "https://www.chess.com/game/live/185125415950",
      "tc": "60", "tclass": "bullet",
      "cc": {"w": 76.37, "b": 84.23},
      "app": {"w": 77.95, "b": 86.09},
      "w": {"elo": 3004}, "b": {"elo": 3315}
    },
    {
      "url": "https://www.chess.com/game/live/185125329318",
      "tc": "60", "tclass": "bullet",
      "cc": {"w": 95.51, "b": 90.62},
      "app": {"w": 96.37, "b": 91.57},
      "w": {"elo": 3313}, "b": {"elo": 3006}
    },
    {
      "url": "https://www.chess.com/game/live/185125293538",
      "tc": "60", "tclass": "bullet",
      "cc": {"w": 78.38, "b": 91.27},
      "app": {"w": 76.87, "b": 88.18},
      "w": {"elo": 3008}, "b": {"elo": 3311}
    },
    {
      "url": "https://www.chess.com/game/live/185125244240",
      "tc": "60", "tclass": "bullet",
      "cc": {"w": 87.80, "b": 76.60},
      "app": {"w": 91.95, "b": 82.41},
      "w": {"elo": 3309}, "b": {"elo": 3010}
    },
    {
      "url": "https://www.chess.com/game/live/185125160256",
      "tc": "60", "tclass": "bullet",
      "cc": {"w": 84.14, "b": 91.27},
      "app": {"w": 86.69, "b": 92.56},
      "w": {"elo": 3013}, "b": {"elo": 3306}
    },
    {
      "url": "https://www.chess.com/game/live/185125087610",
      "tc": "60", "tclass": "bullet",
      "cc": {"w": 95.92, "b": 89.27},
      "app": {"w": 92.30, "b": 90.15},
      "w": {"elo": 3303}, "b": {"elo": 3016}
    },
    {
      "url": "https://www.chess.com/game/live/185125051068",
      "tc": "60", "tclass": "bullet",
      "cc": {"w": 68.27, "b": 97.06},
      "app": {"w": 67.91, "b": 97.34},
      "w": {"elo": 3019}, "b": {"elo": 3300}
    },
    {
      "url": "https://www.chess.com/game/live/185124959356",
      "tc": "60", "tclass": "bullet",
      "cc": {"w": 78.28, "b": 75.29},
      "app": {"w": 79.97, "b": 77.65},
      "w": {"elo": 3297}, "b": {"elo": 3022}
    },
    {
      "url": "https://www.chess.com/game/live/185007329328",
      "tc": "180", "tclass": "blitz",
      "cc": {"w": 89.11, "b": 94.47},
      "app": {"w": 89.48, "b": 94.16},
      "w": {"elo": 3082}, "b": {"elo": 3382}
    },
    {
      "url": "https://www.chess.com/game/live/185007123978",
      "tc": "180", "tclass": "blitz",
      "cc": {"w": 93.14, "b": 83.89},
      "app": {"w": 93.35, "b": 83.16},
      "w": {"elo": 3380}, "b": {"elo": 3084}
    },
    {
      "url": "https://www.chess.com/game/live/185006835362",
      "tc": "180", "tclass": "blitz",
      "cc": {"w": 94.37, "b": 94.07},
      "app": {"w": 94.24, "b": 95.25},
      "w": {"elo": 3087}, "b": {"elo": 3377}
    },
    {
      "url": "https://www.chess.com/game/live/185006539282",
      "tc": "180", "tclass": "blitz",
      "cc": {"w": 77.12, "b": 78.45},
      "app": {"w": 75.46, "b": 76.66},
      "w": {"elo": 3383}, "b": {"elo": 3081}
    },
    {
      "url": "https://www.chess.com/game/live/185006259970",
      "tc": "180", "tclass": "blitz",
      "cc": {"w": 81.87, "b": 87.58},
      "app": {"w": 82.43, "b": 87.21},
      "w": {"elo": 3067}, "b": {"elo": 3397}
    },
    {
      "url": "https://www.chess.com/game/live/185005960300",
      "tc": "180", "tclass": "blitz",
      "cc": {"w": 80.66, "b": 83.69},
      "app": {"w": 83.81, "b": 86.16},
      "w": {"elo": 3395}, "b": {"elo": 3069}
    }
  ]
};

// Statistics helper
function stats(arr) {
  if (!arr || !arr.length) return { n: 0, mean: 0, std: 0, mae: 0, min: 0, max: 0 };
  const n = arr.length;
  const sum = arr.reduce((a, b) => a + b, 0);
  const mean = sum / n;
  const sorted = [...arr].sort((a, b) => a - b);
  const variance = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance);
  const mae = arr.reduce((a, b) => a + Math.abs(b), 0) / n;
  return { n, mean, std, mae, min: sorted[0], max: sorted[n-1], median: sorted[Math.floor(n/2)] };
}

// Classification hierarchy
const CLS_ORDER = ['brilliant', 'great', 'best', 'excellent', 'good', 
                   'inaccuracy', 'mistake', 'miss', 'blunder', 'book', 'forced'];

// Main analysis
function analyze(data) {
  console.log('\n' + '═'.repeat(70));
  console.log('  GHOSTCHESS CALIBRATION ANALYSIS v2');
  console.log('  Model: ' + (data.model || 'unknown'));
  console.log('  Games: ' + data.records.length);
  console.log('═'.repeat(70) + '\n');

  // 1. ACCURACY ANALYSIS
  console.log('📊 1. ACCURACY ESTIMATION (GhostChess vs Chess.com)');
  console.log('─'.repeat(50));
  
  const whiteDiffs = [];
  const blackDiffs = [];
  const allDiffs = [];
  const byTC = { blitz: [], bullet: [] };
  const byElo = { '3300+': [], '3000-3299': [], '<3000': [] };
  
  data.records.forEach(r => {
    const wDiff = r.app.w - r.cc.w;
    const bDiff = r.app.b - r.cc.b;
    
    whiteDiffs.push(wDiff);
    blackDiffs.push(bDiff);
    allDiffs.push(wDiff, bDiff);
    
    const tc = r.tclass || 'blitz';
    byTC[tc] = byTC[tc] || [];
    byTC[tc].push(wDiff, bDiff);
    
    const wElo = r.w.elo;
    const bElo = r.b.elo;
    if (wElo >= 3300) byElo['3300+'].push(wDiff);
    else if (wElo >= 3000) byElo['3000-3299'].push(wDiff);
    else byElo['<3000'].push(wDiff);
    
    if (bElo >= 3300) byElo['3300+'].push(bDiff);
    else if (bElo >= 3000) byElo['3000-3299'].push(bDiff);
    else byElo['<3000'].push(bDiff);
  });
  
  const overall = stats(allDiffs);
  const white = stats(whiteDiffs);
  const black = stats(blackDiffs);
  
  console.log('\n   OVERALL (app - cc):');
  console.log('   ├─ Samples:  ' + overall.n);
  console.log('   ├─ Bias:      ' + overall.mean.toFixed(2) + (overall.mean > 0 ? ' (OVERESTIMATE)' : ' (UNDERESTIMATE)'));
  console.log('   ├─ MAE:       ' + overall.mae.toFixed(2));
  console.log('   ├─ StdDev:    ' + overall.std.toFixed(2));
  console.log('   ├─ Median:    ' + overall.median.toFixed(2));
  console.log('   └─ Range:     [' + overall.min.toFixed(2) + ', ' + overall.max.toFixed(2) + ']');
  
  console.log('\n   BY COLOR:');
  console.log('   ├─ White (n=' + white.n + '): bias=' + white.mean.toFixed(2) + ', MAE=' + white.mae.toFixed(2));
  console.log('   └─ Black (n=' + black.n + '): bias=' + black.mean.toFixed(2) + ', MAE=' + black.mae.toFixed(2));
  
  console.log('\n   BY RATING:');
  for (const [range, diffs] of Object.entries(byElo)) {
    if (diffs.length > 0) {
      const s = stats(diffs);
      console.log('   ├─ ' + range.padEnd(12) + ' (n=' + s.n + '): bias=' + s.mean.toFixed(2) + ', MAE=' + s.mae.toFixed(2));
    }
  }
  
  console.log('\n   BY TIME CONTROL:');
  for (const [tc, diffs] of Object.entries(byTC)) {
    if (diffs.length > 0) {
      const s = stats(diffs);
      console.log('   ├─ ' + tc.padEnd(12) + ' (n=' + s.n + '): bias=' + s.mean.toFixed(2) + ', MAE=' + s.mae.toFixed(2));
    }
  }
  
  // 2. CLASSIFICATION DISTRIBUTION
  console.log('\n\n📊 2. MOVE CLASSIFICATION (from counts)');
  console.log('─'.repeat(50));
  
  const clsCounts = {};
  CLS_ORDER.forEach(c => clsCounts[c] = 0);
  
  data.records.forEach(r => {
    ['w', 'b'].forEach(color => {
      const counts = r.counts[color];
      if (counts) {
        for (const [cls, cnt] of Object.entries(counts)) {
          if (clsCounts[cls] !== undefined) {
            clsCounts[cls] += cnt;
          }
        }
      }
    });
  });
  
  const total = Object.values(clsCounts).reduce((a, b) => a + b, 0);
  console.log('\n   Classification breakdown (' + total + ' total moves):\n');
  
  for (const cls of CLS_ORDER) {
    const cnt = clsCounts[cls] || 0;
    const pct = total > 0 ? (cnt / total * 100) : 0;
    const bar = '█'.repeat(Math.round(pct / 2)).padEnd(20);
    console.log('   ' + cls.padEnd(12) + String(cnt).padStart(4) + ' (' + pct.toFixed(1).padStart(5) + '%) ' + bar);
  }
  
  // 3. OUTLIERS
  console.log('\n\n📊 3. LARGEST DEVIATIONS');
  console.log('─'.repeat(50));
  
  const outliers = [];
  data.records.forEach(r => {
    const wDiff = r.app.w - r.cc.w;
    const bDiff = r.app.b - r.cc.b;
    
    if (Math.abs(wDiff) > 3) {
      outliers.push({ player: r.w.u, side: 'W', diff: wDiff, elo: r.w.elo, url: r.url.split('/').pop() });
    }
    if (Math.abs(bDiff) > 3) {
      outliers.push({ player: r.b.u, side: 'B', diff: bDiff, elo: r.b.elo, url: r.url.split('/').pop() });
    }
  });
  
  outliers.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  
  console.log('\n   Top 10 largest errors (|diff| > 3):\n');
  outliers.slice(0, 10).forEach((o, i) => {
    console.log('   ' + (i+1) + '. ' + o.player + ' (' + o.elo + ') ' + o.side);
    console.log('      app=' + (o.side === 'W' ? 
      data.records.find(r => r.w.u === o.player).app.w : 
      data.records.find(r => r.b.u === o.player).app.b).toFixed(1) + 
      ' cc=' + (o.side === 'W' ? 
      data.records.find(r => r.w.u === o.player).cc.w : 
      data.records.find(r => r.b.u === o.player).cc.b).toFixed(1) +
      ' diff=' + (o.diff > 0 ? '+' : '') + o.diff.toFixed(2));
  });
  
  // 4. RECOMMENDATIONS
  console.log('\n\n📊 4. TUNING RECOMMENDATIONS');
  console.log('─'.repeat(50));
  
  const recommendations = [];
  
  // Overall bias
  if (Math.abs(overall.mean) > 0.3) {
    const currentScale = 2.05;
    const adjustment = -overall.mean * 0.015;
    const newScale = Math.max(1.8, Math.min(2.3, currentScale + adjustment));
    
    recommendations.push({
      priority: Math.abs(overall.mean) > 1 ? 'HIGH' : 'MEDIUM',
      issue: 'Systematic bias of ' + overall.mean.toFixed(2),
      action: 'Change ACC.scale from ' + currentScale + ' to ' + newScale.toFixed(2),
      file: 'js/estimates.js'
    });
  }
  
  // White/Black asymmetry
  const asym = Math.abs(white.mean - black.mean);
  if (asym > 0.8) {
    recommendations.push({
      priority: 'MEDIUM',
      issue: 'Asymmetric bias: W=' + white.mean.toFixed(2) + ', B=' + black.mean.toFixed(2),
      action: 'Add side-specific offset in analyzer.js',
      file: 'js/analyzer.js'
    });
  }
  
  // Time control differences
  if (byTC.bullet && byTC.blitz) {
    const bulletBias = stats(byTC.bullet).mean;
    const blitzBias = stats(byTC.blitz).mean;
    if (Math.abs(bulletBias - blitzBias) > 1) {
      recommendations.push({
        priority: 'LOW',
        issue: 'TC bias difference: bullet=' + bulletBias.toFixed(2) + ', blitz=' + blitzBias.toFixed(2),
        action: 'Create TC-specific PROFILES',
        file: 'js/estimates.js'
      });
    }
  }
  
  console.log('\n');
  recommendations.forEach((rec, i) => {
    const icon = rec.priority === 'HIGH' ? '🔴' : rec.priority === 'MEDIUM' ? '🟡' : '🟢';
    console.log('   ' + icon + ' [' + rec.priority + '] ' + rec.issue);
    console.log('      File: ' + rec.file);
    console.log('      Action: ' + rec.action);
    console.log('');
  });
  
  // 5. PATCH
  console.log('\n📊 5. GENERATED PATCH');
  console.log('─'.repeat(50));
  
  const bias = overall.mean;
  const currentScale = 2.05;
  const newScale = Math.max(1.8, Math.min(2.3, currentScale - bias * 0.015));
  
  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║  PATCH FOR js/estimates.js                                    ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  // BEFORE:                                                    ║
║  const PROFILES = {                                            ║
║    full: { slope: 0.35, decay: 2.0, scale: ${currentScale} },           ║
║    lite: { slope: 0.35, decay: 2.0, scale: ${currentScale} }            ║
║  };                                                            ║
║                                                                  ║
║  // AFTER:                                                     ║
║  const PROFILES = {                                            ║
║    full: { slope: 0.35, decay: 2.0, scale: ${newScale.toFixed(2)} },           ║
║    lite: { slope: 0.35, decay: 2.0, scale: ${newScale.toFixed(2)} }            ║
║  };                                                            ║
║                                                                  ║
║  Expected improvement:                                          ║
║  - Current bias: ${bias.toFixed(2)}                                            ║
║  - Expected bias after: ~0                                     ║
║  - Current MAE: ${overall.mae.toFixed(2)}                                              ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
  `);
  
  // Summary
  console.log('\n' + '═'.repeat(70));
  console.log('  SUMMARY');
  console.log('═'.repeat(70));
  console.log(`
   Current model: ${data.model}
   Games analyzed: ${data.records.length}
   
   Accuracy Performance:
   • Bias:   ${overall.mean > 0 ? '+' : ''}${overall.mean.toFixed(2)} (GhostChess tends to ${overall.mean > 0 ? 'overestimate' : 'underestimate'})
   • MAE:    ${overall.mae.toFixed(2)} (Target: <1.5)
   • StdDev: ${overall.std.toFixed(2)} (Target: <3.0)
   
   Verdict: ${overall.mae < 1.5 ? '✅ GOOD - Within tolerance' : 
               overall.mae < 2.5 ? '⚠️ ACCEPTABLE - Some tuning recommended' : 
               '❌ NEEDS IMPROVEMENT'}
   
   Recommended action: ${recommendations.length > 0 ? 
     recommendations.map(r => r.action).join('; ') : 
     'No immediate action needed'}
  `);
  
  console.log('═'.repeat(70) + '\n');
  
  return { overall, white, black, recommendations, newScale };
}

// Run
const results = analyze(CALIBRATION_DATA);

// Save results
fs.writeFileSync('calibration-results.json', JSON.stringify(results, null, 2));
console.log('Results saved to calibration-results.json');
