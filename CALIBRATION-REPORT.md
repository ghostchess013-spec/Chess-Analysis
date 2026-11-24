/* =====================================================================
 * COMPREHENSIVE CALIBRATION REPORT
 * GhostChess Model: estimasi-2026.10-p13
 * Data: 30 games Magnus Carlsen (3000-3400) vs opponents
 * ===================================================================== */

## EXECUTIVE SUMMARY

### Key Finding: GhostChess OVERESTIMATES accuracy by ~1 point

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| **Bias** | +1.06 | ±0.5 | ⚠️ High |
| **MAE** | 1.81 | <1.5 | ⚠️ Slight over |
| **StdDev** | 2.10 | <3.0 | ✅ Good |
| **Median** | +0.98 | ~0 | ⚠️ Systematic |

### Critical Discovery: Time Control Matters!

The overestimation is NOT uniform:

| Time Control | Bias | MAE | Samples | Status |
|--------------|------|-----|---------|--------|
| **Blitz** (180+60) | +0.22 | 1.17 | 30 | ✅ EXCELLENT |
| **Bullet** (60+0) | +1.97 | 2.49 | 28 | ❌ HIGH ERROR |

**Blitz is well-calibrated!** The problem is primarily with **BULLET games**.

---

## DETAILED ANALYSIS

### 1. BY RATING GROUP

| Rating | Bias | MAE | Samples |
|--------|------|-----|---------|
| 3300+ | +0.86 | 1.70 | 28 |
| 3000-3299 | +1.23 | 1.95 | 25 |
| <3000 | +1.34 | 1.75 | 5 |

Higher rated players have slightly less bias.

### 2. BY COLOR

| Side | Bias | MAE | Samples |
|------|------|-----|---------|
| White | +1.09 | 1.71 | 29 |
| Black | +1.04 | 1.91 | 29 |
| **Asymmetry** | **0.05** | - | - |

No significant White/Black asymmetry.

### 3. DISTRIBUTION OF ERRORS

```
Error Range    Count   %
-3.0 to -2.0    3     5%
-2.0 to -1.0    5     9%
-1.0 to  0.0    9    16%
 0.0 to +1.0   16    28%
+1.0 to +2.0   15    26%
+2.0 to +3.0    6    10%
+3.0 to +4.0    3     5%
+4.0 to +6.3    1     2%
```

**76% of records show positive bias** (GhostChess estimates higher)

---

## RECOMMENDATIONS

### PRIMARY: Time Control-Specific Calibration

Since Blitz is already well-calibrated, apply correction **only for bullet**:

```javascript
// js/estimates.js

const PROFILES = {
  full: { slope: 0.35, decay: 2.0, scale: 2.05 },
  lite: { slope: 0.35, decay: 2.0, scale: 2.05 }
};

// Add TC-specific adjustment in accuracy calculation
function calculateAccuracy(epWinChance, tc) {
  const baseAcc = ACC_SCALE * (1 - Math.pow(epWinChance, ACC_DECAY));
  
  if (tc === 'bullet') {
    // Reduce by 1.97 points (average bias observed)
    return Math.max(0, Math.min(100, baseAcc - 1.97));
  }
  return baseAcc;
}
```

### ALTERNATIVE: Global Scale Adjustment

If TC-specific approach is too complex:

```javascript
// Change scale from 2.05 to 2.03
const PROFILES = {
  full: { slope: 0.35, decay: 2.0, scale: 2.03 },
  lite: { slope: 0.35, decay: 2.0, scale: 2.03 }
};
```

---

## EXPECTED IMPACT

### If we fix BULLET only:
- Bullet bias: 1.97 → ~0
- Bullet MAE: 2.49 → ~1.5
- Overall bias: 1.06 → ~0.5
- Overall MAE: 1.81 → ~1.4

### If we do global scale:
- Overall bias: 1.06 → ~0.2
- Overall MAE: 1.81 → ~1.6 (slightly worse for blitz)

**Recommendation: Fix bullet only (more targeted)**

---

## FILES TO MODIFY

1. **js/estimates.js** - Add TC-specific profile or adjustment
2. **js/analyzer.js** - Pass TC to accuracy calculation
3. **js/kalibrasi-analysis.html** - Add TC filter UI

---

## NEXT STEPS

1. [ ] Implement TC-specific calibration
2. [ ] Re-run calibration on bullet games
3. [ ] Validate Blitz still works (regression test)
4. [ ] Collect more data for <3000 ELO players
5. [ ] Consider adding Rapid (900+180) to profile

---

*Generated: 2026-10-14*
*Model: estimasi-2026.10-p13*
*Games: 30 (58 player-game records)*
