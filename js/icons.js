/* Ikon klasifikasi langkah ala Chess.com Game Review */
(function () {
  const C = {
    brilliant: { color: '#26c2a3', big: '#1baca6', label: 'Brilliant', id: 'Brilian', sym: '!!', art: 'is brilliant', nag: '!!' },
    great: { color: '#749bbf', big: '#5b8bad', label: 'Great', id: 'Bagus', sym: '!', art: 'is a great move', nag: '!' },
    best: { color: '#81b64c', label: 'Best', id: 'Terbaik', sym: 'star', art: 'is the best move', nag: '' },
    excellent: { color: '#96bc4b', label: 'Excellent', id: 'Sangat Baik', sym: 'thumb', art: 'is excellent', nag: '' },
    good: { color: '#96af8b', label: 'Good', id: 'Baik', sym: 'check', art: 'is good', nag: '' },
    book: { color: '#a88865', hl: '#d4a47c', label: 'Book', id: 'Buku', sym: 'book', art: 'is a book move', nag: '' },
    forced: { color: '#97ac8a', label: 'Forced', id: 'Terpaksa', sym: 'arrow', art: 'is forced', nag: '' },
    inaccuracy: { color: '#f7c631', label: 'Inaccuracy', id: 'Tidak Akurat', sym: '?!', art: 'is an inaccuracy', nag: '?!' },
    mistake: { color: '#ffa459', label: 'Mistake', id: 'Kesalahan', sym: '?', art: 'is a mistake', nag: '?' },
    miss: { color: '#ff7769', label: 'Miss', id: 'Terlewat', sym: 'x', art: 'is a miss', nag: '' },
    blunder: { color: '#fa412d', label: 'Blunder', id: 'Blunder', sym: '??', art: 'is a blunder', nag: '??' }
  };

  function glyph(sym) {
    switch (sym) {
      case 'star':
        return '<path fill="#fff" d="M9 3.2l1.75 3.6 3.95.55-2.86 2.77.68 3.93L9 12.2l-3.52 1.85.68-3.93L3.3 7.35l3.95-.55z"/>';
      case 'thumb':
        return '<path fill="#fff" d="M5 8.2h2v5.6H5zM8 13.8V8.3l2.1-3.6c.3-.5 1.1-.4 1.2.2l.1.4-.5 2.4h2.6c.7 0 1.2.6 1 1.3l-1 3.8c-.1.6-.7 1-1.3 1z"/>';
      case 'check':
        return '<path fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="M5.2 9.4l2.6 2.6 5-5.4"/>';
      case 'book':
        return '<path fill="#fff" d="M4.5 5.2c1.6-.6 3.2-.4 4.1.5v8c-.9-.8-2.5-1-4.1-.4zM13.5 5.2c-1.6-.6-3.2-.4-4.1.5v8c.9-.8 2.5-1 4.1-.4z"/>';
      case 'arrow':
        return '<path fill="#fff" d="M4.5 8h6V5.3L14.2 9l-3.7 3.7V10h-6z"/>';
      case 'x':
        return '<path fill="none" stroke="#fff" stroke-width="2.3" stroke-linecap="round" d="M6 6l6 6M12 6l-6 6"/>';
      default: {
        const fs = sym.length === 1 ? 11.5 : 9.5;
        return `<text x="9" y="${sym.length === 1 ? 13 : 12.6}" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="${fs}" fill="#fff" letter-spacing="-0.6">${sym}</text>`;
      }
    }
  }

  function svgIcon(cls, size) {
    const c = C[cls];
    if (!c) return '';
    size = size || 18;
    return `<svg class="cls-icon cls-${cls}" width="${size}" height="${size}" viewBox="0 0 18 18" aria-label="${c.label}"><circle cx="9" cy="9" r="9" fill="${c.color}"/><circle cx="9" cy="9.6" r="8.4" fill="rgba(0,0,0,.12)"/><circle cx="9" cy="9" r="8.4" fill="${c.color}"/>${glyph(c.sym)}</svg>`;
  }

  // ikon PNG asli Chess.com (img/icons/<kelas>.png); 'forced' tidak punya ikon di Chess.com, tetap SVG
  const PNG_ICON = { brilliant: 1, great: 1, best: 1, excellent: 1, good: 1, book: 1, inaccuracy: 1, mistake: 1, miss: 1, blunder: 1 };
  function icon(cls, size) {
    const c = C[cls];
    if (!c) return '';
    size = size || 18;
    if (PNG_ICON[cls]) return `<img class="cls-icon cls-${cls}" src="img/icons/${cls}.png" width="${size}" height="${size}" alt="${c.label}" draggable="false">`;
    return svgIcon(cls, size);
  }

  const UI = {
    coach: `<svg viewBox="0 0 64 64" class="coach-svg"><circle cx="32" cy="32" r="32" fill="#4b4847"/><path d="M14 58c2-11 9-16 18-16s16 5 18 16a32 32 0 0 1-36 0z" fill="#81b64c"/><path d="M27 42h10l-5 7z" fill="#fff"/><circle cx="32" cy="27" r="13" fill="#f1c9a5"/><path d="M19 25c0-9 6-14 13-14s13 5 13 13c-3-4-8-6-13-6s-10 3-13 7z" fill="#5b3a29"/><circle cx="27" cy="28" r="1.8" fill="#2b2b2b"/><circle cx="37" cy="28" r="1.8" fill="#2b2b2b"/><path d="M27.5 33.5c2.6 2.3 6.4 2.3 9 0" stroke="#2b2b2b" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>`,
    flip: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M7 3l-4 4h3v9h2V7h3zM17 21l4-4h-3V8h-2v9h-3z"/></svg>',
    first: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M6 5h2v14H6zM19 5v14l-10-7z"/></svg>',
    prev: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M16 5v14L6 12z"/></svg>',
    next: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M8 5v14l10-7z"/></svg>',
    last: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M16 5h2v14h-2zM5 5v14l10-7z"/></svg>',
    play: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M7 4v16l13-8z"/></svg>',
    pause: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>',
    review: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2l2.6 6.3 6.4.5-4.9 4.2 1.5 6.5L12 16l-5.6 3.5 1.5-6.5L3 8.8l6.4-.5z"/></svg>',
    analysis: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M3 20h18v2H3zM5 10h3v8H5zM10.5 4h3v14h-3zM16 13h3v5h-3z"/></svg>',
    games: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M4 4h16v4H4zM4 10h16v4H4zM4 16h16v4H4z"/></svg>',
    gear: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M19.4 13a7.6 7.6 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.7 7.7 0 0 0-1.7-1L15 3.3h-4l-.4 2.6a7.7 7.7 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.6 7.6 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1c.5.4 1.1.7 1.7 1l.4 2.6h4l.4-2.6c.6-.3 1.2-.6 1.7-1l2.5 1 2-3.5zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z" transform="translate(-1 0)"/></svg>',
    bulb: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2zM9 19h6v1.5a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 9 20.5z"/></svg>',
    retry: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 5V1L7 6l5 5V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z"/></svg>',
    chevron: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M9 6l6 6-6 6-1.4-1.4L12.2 12 7.6 7.4z"/></svg>',
    back: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M15 6l-6 6 6 6 1.4-1.4L11.8 12l4.6-4.6z"/></svg>',
    upload: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M5 20h14v-2H5zM12 3l-6 6h4v6h4V9h4z"/></svg>',
    pawn: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 3a3.5 3.5 0 0 0-2.2 6.2C8.3 10 7.5 11.4 7.5 13h2l-1.5 5h8l-1.5-5h2c0-1.6-.8-3-2.3-3.8A3.5 3.5 0 0 0 12 3zM6 19h12v2H6z"/></svg>',
    search: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M10 3a7 7 0 0 1 5.6 11.2l5.1 5.1-1.4 1.4-5.1-5.1A7 7 0 1 1 10 3zm0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10z"/></svg>'
  };

  window.CLS = C;
  window.clsIcon = icon;
  window.UI_ICONS = UI;
})();