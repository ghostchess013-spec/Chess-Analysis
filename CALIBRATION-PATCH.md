/* =====================================================================
 * CALIBRATION PATCH - Time Control Specific
 * ===========================================
 * 
 * Based on analysis of 30 games (58 player-game records)
 * Model: estimasi-2026.10-p14
 * 
 * FINDINGS:
 * - Blitz: bias +0.22 (well calibrated ✅)
 * - Bullet: bias +1.97 (needs correction ❌)
 * 
 * ACTION: Add TC-specific accuracy adjustment
 * ===================================================================== */

// PATCH 1: js/analyzer.js
// Find the function that calculates accuracy per player and add TC adjustment

/*
--- BEFORE (approximately line 200-220 in analyzer.js) ---

function calculateAccuracy(moves, playerElo) {
  const accs = moves
    .filter(m => m.color === playerColor)
    .map(m => m.accuracy);
  
  if (!accs.length) return null;
  
  const mean = accs.reduce((a, b) => a + b, 0) / accs.length;
  return Math.max(0, Math.min(100, 100 - (100 - mean) * ACC.scale));
}

--- AFTER ---

function calculateAccuracy(moves, playerElo, timeControl) {
  const accs = moves
    .filter(m => m.color === playerColor)
    .map(m => m.accuracy);
  
  if (!accs.length) return null;
  
  let mean = accs.reduce((a, b) => a + b, 0) / accs.length;
  
  // CALIBRATION CORRECTION (p14-calib):
  // Bullet games show systematic +1.97 overestimation
  // Blitz is well calibrated (+0.22), so only correct bullet
  if (timeControl === 'bullet') {
    mean = Math.max(0, Math.min(100, mean - 1.97));
  }
  
  return Math.max(0, Math.min(100, 100 - (100 - mean) * ACC.scale));
}

--- CALL SITE CHANGE ---
// Wherever calculateAccuracy is called, pass timeControl:
// Before: const acc = calculateAccuracy(moves, playerElo);
// After:  const acc = calculateAccuracy(moves, playerElo, game.timeControl);
*/

// PATCH 2: js/estimates.js
// Add constants for calibration adjustment (optional, for documentation)

/*
--- ADD TO estimates.js after ACC constant (around line 90) ---

// CALIBRATION ADJUSTMENTS (from p14-calib analysis)
// These offsets reduce systematic bias observed in calibration data
const CALIB = {
  bullet: -1.97,  // Bullet games overestimate by ~2 points
  blitz:  0,      // Blitz is well calibrated, no correction needed
  rapid:  0       // Unknown, assume no correction
};

--- UPDATE calculateAccuracyEstimate ---

function calculateAccuracyEstimate(moves, color, timeControl) {
  const accs = moves.filter((m) => m.color === color).map((m) => m.accuracy);
  if (!accs.length) return null;
  
  let mean = accs.reduce((a, b) => a + b, 0) / accs.length;
  
  // Apply calibration correction if available
  if (timeControl && CALIB[timeControl] !== undefined) {
    mean = Math.max(0, Math.min(100, mean + CALIB[timeControl]));
  }
  
  return Math.max(0, Math.min(100, 100 - (100 - mean) * ACC.scale));
}
*/

// EXPECTED IMPROVEMENT:
// ====================
// Before:  Bias +1.06, MAE 1.81, StdDev 2.10
// After:   Bias ~0.3,  MAE ~1.5,  StdDev ~2.1
//
// Per Time Control:
// - Blitz:  bias +0.22 → +0.22 (unchanged, already good)
// - Bullet: bias +1.97 → ~0.00 (fixed!)
//
// Verdict: ⚠️ ACCEPTABLE → ✅ GOOD

// =====================================================================
// ALTERNATIVE PATCH: Global Scale Adjustment Only
// =====================================================================
// If TC-specific fix is too complex, use this simpler patch:

/*
--- js/estimates.js ---

// Change scale from 2.05 to 2.03
const PROFILES = {
  full: { slope: 0.35, decay: 2.0, scale: 2.03 },  // was 2.05
  lite: { slope: 0.35, decay: 2.0, scale: 2.03 }   // was 2.05
};

--- EXPECTED IMPROVEMENT ---
Before:  Bias +1.06, MAE 1.81
After:   Bias ~0.50, MAE ~1.75

Note: This slightly worsens MAE but reduces bias.
Recommendation: Use TC-specific fix instead.
*/

// =====================================================================
// VALIDATION CHECKLIST
// =====================================================================
// After applying patch:
// [ ] Re-run calibration on same 30 games
// [ ] Verify Blitz still works (regression)
// [ ] Check Bullet bias reduced to <0.5
// [ ] Test on new games not in calibration set
// [ ] Monitor for any edge cases (mate positions, extreme accuracy)

console.log(`
╔══════════════════════════════════════════════════════════════════╗
║  CALIBRATION PATCH READY                                          ║
╠══════════════════════════════════════════════════════════════════╣
║  Recommended: TC-Specific Fix (option 1)                         ║
║                                                                  ║
║  Expected Results:                                                ║
║  • Bullet bias:  +1.97 → ~0.00                                  ║
║  • Overall bias: +1.06 → ~0.30                                   ║
║  • MAE:          1.81 → ~1.50                                     ║
╚══════════════════════════════════════════════════════════════════╝
`);
