# Panduan Analisis & Tuning Kalibrasi

## 📋 Overview

Dokumen ini menjelaskan cara menggunakan tools kalibrasi untuk **meningkatkan akurasi** model GhostChess agar semakin mirip Chess.com.

---

## 🎯 TUJUAN

1. **Evaluasi** - Seberapa dekat hasil GhostChess dengan Chess.com?
2. **Analisis** - Di bagian mana yang masih berbeda?
3. **Tuning** - Bagaimana cara improve?

---

## 📁 FILE YANG DIBUAT

| File | Fungsi |
|------|--------|
| `validasi.html` | Kalibrasi otomatis dari API Chess.com |
| `kalibrasi-analysis.html` | Analisis hasil kalibrasi |
| `js/kalibrasi-analysis.js` | Library analisis statistik |
| `js/auto-tuner.js` | Saran parameter adjustment |

---

## 🚀 LANGKAH 1: Jalankan Kalibrasi

### Opsi A: via Browser

```
1. Buka validasi.html di browser
2. Masukkan username Chess.com
3. Klik "Mulai kalibrasi"
4. Tunggu selesai (biasanya 30-60 menit untuk 30 partai)
5. Klik "Salin JSON" atau "Unduh JSON"
```

### Opsi B: via Console

```javascript
// Buka validasi.html, buka DevTools, ketik:
kalibrasi.username = 'USERNAME_ANDA';
kalibrasi.start().then(json => {
  console.log(JSON.stringify(json));
  // Copy JSON hasil
});
```

---

## 📊 LANGKAH 2: Analisis Hasil

### Buka kalibrasi-analysis.html

```
1. Buka kalibrasi-analysis.html di browser
2. Paste JSON hasil kalibrasi ke textarea
3. Klik "Analisis"
```

### Baca Statistik

#### Overall Stats
| Metrik | Target | Arti |
|--------|--------|------|
| Bias | ±0.5 | App rata-rata terlalu tinggi/rendah |
| MAE | <2.0 | Mean Absolute Error |
| StdDev | <3.0 | Seberapa konsisten |

#### Per Rating
- Cek apakah bias berbeda di rating tertentu
- Model mungkin perlu adjustment per level

#### Per Time Control
- Bullet, Blitz, Rapid mungkin perlu parameter berbeda

#### Outliers
- Party dengan selisih >2 std dev
- Perlu investigasi khusus

---

## 🎛️ LANGKAH 3: Apply Tuning

### Dari Auto-Tuner

Jika ada saran, akan muncul di section **"Suggested Parameter Changes"**:

```javascript
// Contoh output:
// Scale adjustment: 2.05 -> 2.07
// Decline adjustment: 2.0 -> 2.1
```

### Apply Manual ke estimates.js

```javascript
// js/estimates.js

// BEFORE:
const PROFILES = {
  full: { slope: 0.35, decay: 2.0, scale: 2.05 },
  lite: { slope: 0.35, decay: 2.0, scale: 2.05 }
};

// AFTER (sesuai saran):
const PROFILES = {
  full: { slope: 0.35, decay: 2.0, scale: 2.07 },  // Scale dinaikkan
  lite: { slope: 0.35, decay: 2.0, scale: 2.07 }   // Scale dinaikkan
};
```

---

## 📈 TARGET KINERJA

| Metrik | Acceptable | Good | Excellent |
|--------|------------|------|-----------|
| Bias | ±1.0 | ±0.5 | ±0.25 |
| MAE | <2.5 | <1.5 | <1.0 |
| StdDev | <4.0 | <3.0 | <2.0 |

---

## 🔄 WORKFLOW KALIBRASI BERULANG

```
┌─────────────────────────────────────────┐
│  1. Jalankan kalibrasi (30+ partai)     │
└─────────────────┬───────────────────────┘
                  ▼
┌─────────────────────────────────────────┐
│  2. Analisis hasil                     │
└─────────────────┬───────────────────────┘
                  ▼
┌─────────────────────────────────────────┐
│  3. Apply tuning suggestion             │
└─────────────────┬───────────────────────┘
                  ▼
┌─────────────────────────────────────────┐
│  4. Re-run kalibrasi dengan params baru │
└─────────────────┬───────────────────────┘
                  ▼
┌─────────────────────────────────────────┐
│  5. Cek apakah improve?                │
│     Ya → Ulangi step 3                  │
│     Tidak → Stop, sudah optimal         │
└─────────────────────────────────────────┘
```

---

## ⚠️ KETERBATASAN

1. **Data terbatas** - Kalibrasi pada 14-50 partido mungkin tidak representatif
2. **Rating range** - Model disetel untuk 1300-1900, mungkin berbeda di level lain
3. **Time control** - Belum ada profile terpisah
4. **Reverse engineering** - Ini bukan formula asli Chess.com

---

## 💡 TIPS

### Untuk Akurasi Tertinggi:

1. **Gunakan engine Full** (bukan Lite)
2. **Kedalaman tinggi** (18+)
3. **Parse PGN Chess.com** (bukan estimasi)
4. **Kalibrasi reguler** setiap ada update model

### Untuk Debug Outliers:

1. Buka URL partido dari hasil
2. Cek apakah ada posisi khusus (mate, fortress, dll)
3. Perhatikan jika PGN sudah outdated

---

## 📞 OUTPUT FORMAT

### JSON dari kalibrasi:

```json
{
  "format": "game-review-kalibrasi-1",
  "model": "estimasi-2026.10-p14",
  "createdAt": "2024-01-15T12:00:00Z",
  "count": 30,
  "records": [
    {
      "url": "https://www.chess.com/game/live/123456789",
      "tclass": "blitz",
      "w": { "u": "player1", "elo": 1700 },
      "b": { "u": "player2", "elo": 1650 },
      "cc": { "w": 85.2, "b": 78.4 },  // Chess.com
      "app": { "w": 86.1, "b": 77.8 }, // GhostChess
      "mv": [...]
    }
  ]
}
```

---

## 🔧 API Reference

### kalibrasi-analysis.js

```javascript
// Parse & validate
KalibrasiAnalysis.parseJSON(jsonString)

// Basic stats
KalibrasiAnalysis.basicStats(values)
  // Returns: { n, mean, median, stdDev, min, max, mae, rmse, p25, p75, p90, p95 }

// Full analysis
KalibrasiAnalysis.analyze(jsonString)
  // Returns: { meta, overall, perRating, perTimeControl, outliers, tuning }

// Per-category analysis
KalibrasiAnalysis.analyzePerRating(data)
KalibrasiAnalysis.analyzePerTimeControl(data)
KalibrasiAnalysis.findOutliers(data, threshold)
KalibrasiAnalysis.suggestTuning(data)
```

### auto-tuner.js

```javascript
// Create tuner
const tuner = new AutoTuner(calibrationJSON);

// Analyze
tuner.analyze();
tuner.printSummary(); // Prints to console

// Get suggestions
tuner.suggestAccuracy();  // Accuracy model suggestions
tuner.suggestRating();     // Rating model suggestions
tuner.suggestAll();        // All suggestions

// Generate patch
tuner.generatePatch(); // Returns code to apply
```

### Console Helpers

```javascript
//kalibrasiAnalysis(jsonString)  // From kalibrasi-analysis.js
//autoTune(jsonString)           // From auto-tuner.js
```

---

## 📝 CHANGELOG

### v1.0 (2024-01-15)
- Initial release
- Validasi.html integration
- kalibrasi-analysis.html
- kalibrasi-analysis.js
- auto-tuner.js
