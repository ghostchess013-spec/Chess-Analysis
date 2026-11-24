/* =====================================================================
 * Auto-Tuner: Suggest parameter adjustments based on calibration data
 * 
 * Usage:
 *   const tuner = new AutoTuner(calibrationJSON);
 *   tuner.analyze();
 *   tuner.suggest('accuracy');
 *   tuner.suggest('rating');
 *   tuner.applyToEstimates();
 * ===================================================================== */

(function() {
  'use strict';

  // Current constants from estimates.js
  const CURRENT = {
    accuracy: {
      slope: 0.35,
      decay: 2.0,
      scale: 2.05
    },
    rating: {
      intercept: -2686,
      accCoef: 40.42,
      eloCoef: 0.834,
      minDiff: -650,
      maxDiff: 650
    },
    classification: {
      bestTolerance: 0.0001,
      excellent: 0.02,
      good: 0.05,
      inaccuracy: 0.10,
      mistake: 0.20
    },
    great: {
      gapMin: 100,
      gapMax: 560,
      cbMin: -300,
      cbMax: 700,
      epGapMin: 0.08
    }
  };

  class AutoTuner {
    constructor(jsonData) {
      if (typeof jsonData === 'string') {
        this.data = JSON.parse(jsonData);
      } else {
        this.data = jsonData;
      }
      this.records = this.data.records || [];
      this.results = {};
    }

    analyze() {
      // Calculate per-side differences
      const whiteDiffs = [];
      const blackDiffs = [];
      const allDiffs = [];
      
      this.records.forEach(r => {
        const wDiff = r.app.w - r.cc.w;
        const bDiff = r.app.b - r.cc.b;
        whiteDiffs.push(wDiff);
        blackDiffs.push(bDiff);
        allDiffs.push(wDiff, bDiff);
      });

      const stats = (arr) => {
        const n = arr.length;
        const mean = arr.reduce((a,b) => a+b, 0) / n;
        const std = Math.sqrt(arr.reduce((a,b) => a + (b-mean)**2, 0) / n);
        const mae = arr.reduce((a,b) => a + Math.abs(b), 0) / n;
        const sorted = [...arr].sort((a,b) => a-b);
        return { n, mean, std, mae, min: sorted[0], max: sorted[n-1], 
                 p25: sorted[Math.floor(n*0.25)], 
                 p75: sorted[Math.floor(n*0.75)] };
      };

      this.results = {
        overall: stats(allDiffs),
        white: stats(whiteDiffs),
        black: stats(blackDiffs),
        perRating: this._perRating(),
        perTimeControl: this._perTimeControl()
      };

      return this.results;
    }

    _perRating() {
      const buckets = {};
      this.records.forEach(r => {
        const wElo = r.w.elo || 1500;
        const bElo = r.b.elo || 1500;
        const wBucket = Math.floor(wElo / 200) * 200;
        const bBucket = Math.floor(bElo / 200) * 200;
        
        if (!buckets[wBucket]) buckets[wBucket] = [];
        if (!buckets[bBucket]) buckets[bBucket] = [];
        
        buckets[wBucket].push(r.app.w - r.cc.w);
        buckets[bBucket].push(r.app.b - r.cc.b);
      });

      const result = {};
      for (const [bucket, diffs] of Object.entries(buckets)) {
        if (diffs.length >= 3) {
          const s = stats(diffs);
          result[bucket] = { count: diffs.length, ...s };
        }
      }
      return result;
    }

    _perTimeControl() {
      const buckets = {};
      this.records.forEach(r => {
        const tc = r.tclass || 'unknown';
        if (!buckets[tc]) buckets[tc] = [];
        buckets[tc].push(r.app.w - r.cc.w, r.app.b - r.cc.b);
      });

      const result = {};
      for (const [tc, diffs] of Object.entries(buckets)) {
        const s = stats(diffs);
        result[tc] = { count: diffs.length, ...s };
      }
      return result;
    }

    // Generate suggestions for accuracy model
    suggestAccuracy() {
      const suggestions = [];
      const { overall, white, black, perRating, perTimeControl } = this.results;

      // Overall bias analysis
      const bias = overall.mean;
      const mae = overall.mae;
      
      if (Math.abs(bias) > 0.5) {
        const direction = bias > 0 ? 'TINGGI' : 'RENDAH';
        const adjustment = bias > 0 ? 0.03 : -0.03;
        const newScale = Math.max(1.5, Math.min(3.0, CURRENT.accuracy.scale + adjustment));
        
        suggestions.push({
          priority: Math.abs(bias) > 1.5 ? 'HIGH' : 'MEDIUM',
          issue: `App rata-rata ${bias.toFixed(2)} poin LEBIH ${direction} dari Chess.com`,
          currentValue: `scale: ${CURRENT.accuracy.scale}`,
          suggestedChange: `scale: ${newScale.toFixed(2)}`,
          formula: `// New: { slope: ${CURRENT.accuracy.slope}, decay: ${CURRENT.accuracy.decay}, scale: ${newScale.toFixed(2)} }`,
          reason: `${bias > 0 ? 'Naikkan' : 'Turunkan'} scale akan ${bias > 0 ? 'menurunkan' : 'menaikkan'} akurasi rata-rata`
        });
      }

      // Check asymmetric bias
      const biasDiff = white.mean - black.mean;
      if (Math.abs(biasDiff) > 1.0) {
        suggestions.push({
          priority: 'MEDIUM',
          issue: `Bias asimetris: Putih ${white.mean.toFixed(2)}, Hitam ${black.mean.toFixed(2)}`,
          currentValue: 'Model symmetric',
          suggestedChange: 'Perlu treatment berbeda per sisi',
          formula: '// Modify analyzeGame() untuk apply offset berbeda per color',
          reason: 'Model saat ini tidak membedakan sisi Putih/Hitam'
        });
      }

      // Check variance
      if (overall.std > 3) {
        suggestions.push({
          priority: 'MEDIUM',
          issue: `Variansi tinggi (std: ${overall.std.toFixed(2)})`,
          currentValue: `decay: ${CURRENT.accuracy.decay}`,
          suggestedChange: `decay: ${(CURRENT.accuracy.decay * 0.95).toFixed(2)}`,
          formula: `// Coba: { slope: ${CURRENT.accuracy.slope}, decay: ${(CURRENT.accuracy.decay * 0.95).toFixed(2)}, scale: ${CURRENT.accuracy.scale} }`,
          reason: 'Decay lebih kecil = perubahan win% dihukum lebih ringan = variance lebih rendah'
        });
      }

      // Per-rating analysis
      const ratingSuggestions = [];
      for (const [rating, data] of Object.entries(perRating)) {
        if (data.count >= 3 && Math.abs(data.mean) > 1.5) {
          ratingSuggestions.push({
            range: `${rating}-${parseInt(rating)+200}`,
            bias: data.mean,
            count: data.count
          });
        }
      }
      
      if (ratingSuggestions.length > 0) {
        suggestions.push({
          priority: 'LOW',
          issue: 'Bias berbeda per rating',
          details: ratingSuggestions,
          formula: '// Model rating-dependent mungkin diperlukan',
          reason: 'Kurva EP mungkin perlu adjust berdasarkan rating pemain'
        });
      }

      // Per time control
      const tcSuggestions = [];
      for (const [tc, data] of Object.entries(perTimeControl)) {
        if (data.count >= 5 && Math.abs(data.mean) > 1) {
          tcSuggestions.push({
            tc,
            bias: data.mean,
            count: data.count
          });
        }
      }
      
      if (tcSuggestions.length > 0) {
        suggestions.push({
          priority: 'LOW',
          issue: 'Bias berbeda per kontrol waktu',
          details: tcSuggestions,
          formula: '// Buat profile berbeda per tc: bullet, blitz, rapid',
          reason: 'Chess.com mungkin pakai parameter berbeda per tc'
        });
      }

      return suggestions;
    }

    // Generate suggestions for rating estimation
    suggestRating() {
      const suggestions = [];
      const { overall, perRating } = this.results;

      // Analyze rating estimation errors
      const ratingErrors = [];
      this.records.forEach(r => {
        if (r.app.rw && r.cc.rw) {
          ratingErrors.push(r.app.rw - r.cc.rw);
        }
        if (r.app.rb && r.cc.rb) {
          ratingErrors.push(r.app.rb - r.cc.rb);
        }
      });

      if (ratingErrors.length > 0) {
        const rStats = stats(ratingErrors);
        const bias = rStats.mean;
        
        if (Math.abs(bias) > 20) {
          const adjustment = -bias * 0.5;
          const newIntercept = CURRENT.rating.intercept + adjustment;
          
          suggestions.push({
            priority: Math.abs(bias) > 50 ? 'HIGH' : 'MEDIUM',
            issue: `Rating estimation bias: ${bias.toFixed(0)} poin`,
            currentValue: `intercept: ${CURRENT.rating.intercept}`,
            suggestedChange: `intercept: ${Math.round(newIntercept)}`,
            formula: `gameRatingEstimate(acc, playerRating) { let r = ${Math.round(newIntercept)} + ${CURRENT.rating.accCoef} * acc + ${CURRENT.rating.eloCoef} * playerRating; ... }`,
            reason: `Adjust intercept untuk offset systematic bias`
          });
        }
      }

      // Check per-rating patterns
      for (const [rating, data] of Object.entries(perRating)) {
        if (data.count >= 3 && Math.abs(data.mean) > 2) {
          suggestions.push({
            priority: 'LOW',
            issue: `Rating range ${rating} memiliki bias akurasi berbeda`,
            details: { rating, bias: data.mean, count: data.count },
            formula: '// Mungkin perlu piecewise linear model',
            reason: 'Hubungan acc -> game rating mungkin non-linear'
          });
        }
      }

      return suggestions;
    }

    // All suggestions
    suggestAll() {
      return {
        accuracy: this.suggestAccuracy(),
        rating: this.suggestRating(),
        dataSummary: this.results
      };
    }

    // Generate patch code
    generatePatch() {
      const suggestions = this.suggestAccuracy();
      const scaleSuggestion = suggestions.find(s => s.suggestedChange && s.suggestedChange.includes('scale'));
      
      if (scaleSuggestion) {
        const match = scaleSuggestion.suggestedChange.match(/scale:\s*([\d.]+)/);
        const newScale = match ? parseFloat(match[1]) : CURRENT.accuracy.scale;
        
        return `
// ===== PATCH RECOMMENDED BY AUTO-TUNER =====
// File: js/estimates.js
// Section: ACCURACY

// BEFORE:
const PROFILES = {
  full: { slope: ${CURRENT.accuracy.slope}, decay: ${CURRENT.accuracy.decay}, scale: ${CURRENT.accuracy.scale} },
  lite: { slope: ${CURRENT.accuracy.slope}, decay: ${CURRENT.accuracy.decay}, scale: ${CURRENT.accuracy.scale} }
};

// AFTER:
const PROFILES = {
  full: { slope: ${CURRENT.accuracy.slope}, decay: ${CURRENT.accuracy.decay}, scale: ${newScale.toFixed(2)} },
  lite: { slope: ${CURRENT.accuracy.slope}, decay: ${CURRENT.accuracy.decay}, scale: ${newScale.toFixed(2)} }
};

// ===== END PATCH =====
// Applied: ${new Date().toISOString()}
// Based on: ${this.records.length} records
// Bias before: ${this.results.overall.mean.toFixed(2)}
// Expected new bias: ~0
`;
      }
      
      return '// No scale adjustment recommended. Review suggestions above.';
    }

    // Print summary to console
    printSummary() {
      console.log(`
╔══════════════════════════════════════════════════════════╗
║  KALIBRASI ANALYSIS SUMMARY                            ║
╠══════════════════════════════════════════════════════════╣
║  Records analyzed: ${String(this.records.length).padEnd(40)}║
║  Model: ${(this.data.model || 'unknown').padEnd(48)}║
╠══════════════════════════════════════════════════════════╣
║  OVERALL ACCURACY DIFF                                 ║
║  ├── Bias (avg): ${String(this.results.overall.mean.toFixed(2)).padEnd(42)}║
║  ├── MAE: ${String(this.results.overall.mae.toFixed(2)).padEnd(46)}║
║  ├── StdDev: ${String(this.results.overall.std.toFixed(2)).padEnd(44)}║
║  ├── Min: ${String(this.results.overall.min.toFixed(2)).padEnd(47)}║
║  └── Max: ${String(this.results.overall.max.toFixed(2)).padEnd(47)}║
╠══════════════════════════════════════════════════════════╣
║  WHITE vs BLACK                                        ║
║  ├── White bias: ${String(this.results.white.mean.toFixed(2)).padEnd(41)}║
║  └── Black bias: ${String(this.results.black.mean.toFixed(2)).padEnd(41)}║
╚══════════════════════════════════════════════════════════╝
      `);
    }
  }

  // Helper
  function stats(arr) {
    const n = arr.length;
    if (n === 0) return { n: 0, mean: 0, std: 0, mae: 0 };
    const mean = arr.reduce((a,b) => a+b, 0) / n;
    const std = Math.sqrt(arr.reduce((a,b) => a + (b-mean)**2, 0) / n);
    const mae = arr.reduce((a,b) => a + Math.abs(b), 0) / n;
    const sorted = [...arr].sort((a,b) => a-b);
    return { n, mean, std, mae, min: sorted[0], max: sorted[n-1] };
  }

  // Export
  window.AutoTuner = AutoTuner;

  // Console helper
  window.autoTune = function(jsonOrData) {
    const tuner = new AutoTuner(jsonOrData);
    tuner.analyze();
    tuner.printSummary();
    console.log('\n📋 Suggestions:', tuner.suggestAll());
    console.log('\n📝 Suggested patch:', tuner.generatePatch());
    return tuner;
  };

  console.log(`
╔══════════════════════════════════════════════════════════╗
║  Auto-Tuner Ready                                       ║
╠══════════════════════════════════════════════════════════╣
║  Usage:                                                 ║
║  1. Paste JSON to kalibrasi-analysis.html              ║
║  2. Or use console:                                     ║
║     autoTune(jsonString)                               ║
║     new AutoTuner(data).analyze().suggestAccuracy()    ║
╚══════════════════════════════════════════════════════════╝
  `);

})();
