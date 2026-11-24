/* Papan catur interaktif (drag & drop + klik), panah, highlight, badge klasifikasi */
(function () {
  const FILES = 'abcdefgh';
  // set bidak aktif dikelola js/assets.js (ChessAssets); cadangan: SVG lama
  const PIECE_URL = (p) => (window.ChessAssets ? window.ChessAssets.pieceUrl(p) : `img/pieces/${p}.svg`);

  function sqToXY(sq, flipped) {
    const f = FILES.indexOf(sq[0]);
    const r = parseInt(sq[1], 10) - 1;
    return flipped ? { x: 7 - f, y: r } : { x: f, y: 7 - r };
  }
  function xyToSq(x, y, flipped) {
    if (x < 0 || x > 7 || y < 0 || y > 7) return null;
    return flipped ? FILES[7 - x] + (y + 1) : FILES[x] + (8 - y);
  }

  class Board {
    constructor(el, opts) {
      this.el = el;
      this.opts = opts || {};
      this.flipped = false;
      this.fen = 'start';
      this.state = {};
      this.selected = null;
      this.legalFor = this.opts.legalFor || (() => []);
      this.el.classList.add('board');
      this.el.innerHTML = `
        <div class="board-squares"></div>
        <div class="board-hl"></div>
        <div class="board-dots"></div>
        <div class="board-pieces"></div>
        <svg class="board-arrows" viewBox="0 0 800 800" preserveAspectRatio="none"></svg>
        <div class="board-reveal"></div>
        <div class="board-badges"></div>
        <div class="board-promo hidden"></div>`;
      this.sqLayer = el.querySelector('.board-squares');
      this.hlLayer = el.querySelector('.board-hl');
      this.dotLayer = el.querySelector('.board-dots');
      this.pcLayer = el.querySelector('.board-pieces');
      this.arLayer = el.querySelector('.board-arrows');
      this.bdLayer = el.querySelector('.board-badges');
      this.rvLayer = el.querySelector('.board-reveal');
      this.revealing = false;
      this.promoLayer = el.querySelector('.board-promo');
      this.drawSquares();
      this.bindPointer();
      this.userArrows = [];
      this.userMarks = [];
    }

    drawSquares() {
      let h = '';
      for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
          const sq = xyToSq(x, y, this.flipped);
          const light = (x + y) % 2 === 0;
          let coords = '';
          if (x === 0) coords += `<span class="coord rank">${sq[1]}</span>`;
          if (y === 7) coords += `<span class="coord file">${sq[0]}</span>`;
          h += `<div class="sq ${light ? 'light' : 'dark'}" style="left:${x * 12.5}%;top:${y * 12.5}%">${coords}</div>`;
        }
      }
      this.sqLayer.innerHTML = h;
    }

    flip() {
      this.flipped = !this.flipped;
      this.drawSquares();
      this.render();
    }
    setOrientation(color) {
      const want = color === 'b';
      if (want !== this.flipped) this.flip();
    }

    parseFen(fen) {
      const map = {};
      const rows = fen.split(' ')[0].split('/');
      for (let r = 0; r < 8; r++) {
        let f = 0;
        for (const ch of rows[r]) {
          if (/\d/.test(ch)) f += parseInt(ch, 10);
          else {
            const color = ch === ch.toUpperCase() ? 'w' : 'b';
            map[FILES[f] + (8 - r)] = color + ch.toUpperCase();
            f++;
          }
        }
      }
      return map;
    }

    /* state: {fen, lastMove:{from,to}, hlColor, badge:{sq,cls}, arrows:[{from,to,color}], check} */
    set(state, animate) {
      const prev = this.pieces;
      this.state = state;
      this.pieces = this.parseFen(state.fen);
      this.selected = null;
      this.userArrows = [];
      this.userMarks = [];
      this.render(animate && prev ? { prev, move: state.lastMove } : null);
    }

    render(anim) {
      const fl = this.flipped;
      this.stopReveal();
      // pieces
      let h = '';
      for (const sq in this.pieces) {
        const p = this.pieces[sq];
        const { x, y } = sqToXY(sq, fl);
        h += `<div class="pc" data-sq="${sq}" style="transform:translate(${x * 100}%,${y * 100}%);background-image:url(${PIECE_URL(p)})"></div>`;
      }
      this.pcLayer.innerHTML = h;
      if (anim && anim.move && anim.prev) {
        const el = this.pcLayer.querySelector(`[data-sq="${anim.move.to}"]`);
        if (el) {
          const a = sqToXY(anim.move.from, fl);
          const b = sqToXY(anim.move.to, fl);
          el.style.transition = 'none';
          el.style.transform = `translate(${a.x * 100}%,${a.y * 100}%)`;
          el.getBoundingClientRect();
          el.style.transition = 'transform .16s ease-out';
          el.style.transform = `translate(${b.x * 100}%,${b.y * 100}%)`;
        }
      }
      this.renderHL();
      this.renderArrows();
      // Brilian/Bagus: ikon besar + label di petak tujuan, lalu mengecil jadi badge (seperti Chess.com)
      const rv = this.state.reveal;
      this.revealing = !!(rv && anim && anim.move && window.CLS && window.CLS[rv.cls]);
      this.renderBadge();
      if (this.revealing) this.startReveal(rv);
    }

    stopReveal() {
      clearTimeout(this.rvTimer);
      clearTimeout(this.rvEnd);
      clearTimeout(this.rvEnd2);
      this.revealing = false;
      if (this.rvLayer) this.rvLayer.innerHTML = '';
    }
    startReveal(rv) {
      this.rvTimer = setTimeout(() => this.showReveal(rv), 150);   // setelah bidak selesai bergeser
      this.rvEnd = setTimeout(() => this.endReveal(), 1400);
    }
    showReveal(rv) {
      const c = window.CLS[rv.cls];
      const { x, y } = sqToXY(rv.sq, this.flipped);
      const bar = (cx, w) => `<rect x="${cx - w / 2}" y="39" width="${w}" height="29" rx="2"/><rect x="${cx - w / 2 + 0.5}" y="72.5" width="${w - 1}" height="9" rx="2"/>`;
      const glyph = rv.cls === 'brilliant' ? bar(41.25, 11.5) + bar(58.75, 11.5) : bar(50, 11.5);
      const pillX = x === 7 ? 'right:0;' : 'left:44%;';
      const pillY = y === 0 ? 'top:0;' : 'top:-13%;';
      const label = window.I18N && window.I18N.clsName ? window.I18N.clsName(rv.cls) : c.id;   // ikut bahasa (Brilliant!/Brilian!)
      this.rvLayer.innerHTML = `<div class="rv" style="left:${x * 12.5}%;top:${y * 12.5}%">` +
        `<div class="rv-clip"><div class="rv-bg" style="background:${c.big || c.color}"></div><div class="rv-shine"></div>` +
        `<svg class="rv-glyph" viewBox="0 0 100 100">${glyph}</svg></div>` +
        `<div class="rv-pill" style="color:${c.color};${pillX}${pillY}">${label}!</div></div>`;
    }
    endReveal() {
      const el = this.rvLayer.firstElementChild;
      if (el) el.classList.add('rv-out');
      this.rvEnd2 = setTimeout(() => {
        this.rvLayer.innerHTML = '';
        this.revealing = false;
        this.renderBadge();
      }, 220);
    }

    renderHL() {
      const s = this.state;
      const fl = this.flipped;
      let h = '';
      const add = (sq, cls, style) => {
        const { x, y } = sqToXY(sq, fl);
        h += `<div class="hl ${cls}" style="left:${x * 12.5}%;top:${y * 12.5}%;${style || ''}"></div>`;
      };
      if (s.lastMove) {
        const col = s.hlColor;
        const st = col ? `background:${col};opacity:.5` : '';
        add(s.lastMove.from, col ? '' : 'last', st);
        add(s.lastMove.to, col ? '' : 'last', st);
      }
      if (s.check) add(s.check, s.badge ? 'check solid' : 'check');   // saat ulasan: petak raja merah penuh seperti Chess.com
      if (this.selected) add(this.selected, 'sel');
      for (const m of this.userMarks) add(m, 'mark');
      this.hlLayer.innerHTML = h;
      // legal dots
      let d = '';
      if (this.selected) {
        for (const m of this.legalFor(this.selected)) {
          const { x, y } = sqToXY(m.to, fl);
          const cap = !!this.pieces[m.to];
          d += `<div class="dot ${cap ? 'cap' : ''}" style="left:${x * 12.5}%;top:${y * 12.5}%"></div>`;
        }
      }
      this.dotLayer.innerHTML = d;
    }

    arrowPath(from, to, color, opacity) {
      const a = sqToXY(from, this.flipped);
      const b = sqToXY(to, this.flipped);
      const ax = a.x * 100 + 50, ay = a.y * 100 + 50, bx = b.x * 100 + 50, by = b.y * 100 + 50;
      const dx = Math.abs(b.x - a.x), dy = Math.abs(b.y - a.y);
      const w = 13.75, head = 37, headW = 33;
      let pts;
      const knight = (dx === 1 && dy === 2) || (dx === 2 && dy === 1);
      if (knight) {
        // L-shaped arrow
        const mx = dy > dx ? ax : bx;
        const my = dy > dx ? by : ay;
        return this.lArrow(ax, ay, mx, my, bx, by, color, opacity, w, head, headW);
      }
      const ang = Math.atan2(by - ay, bx - ax);
      const len = Math.hypot(bx - ax, by - ay) - 0;
      const sx = ax + Math.cos(ang) * 20, sy = ay + Math.sin(ang) * 20;
      const L = len - 20;
      const cos = Math.cos(ang), sin = Math.sin(ang);
      const P = (u, v) => `${sx + u * cos - v * sin},${sy + u * sin + v * cos}`;
      pts = [P(0, -w / 2), P(L - head, -w / 2), P(L - head, -headW / 2 - 0), P(L, 0), P(L - head, headW / 2), P(L - head, w / 2), P(0, w / 2)];
      return `<polygon points="${pts.join(' ')}" fill="${color}" opacity="${opacity}"/>`;
    }
    lArrow(ax, ay, mx, my, bx, by, color, opacity, w, head, headW) {
      const ang1 = Math.atan2(my - ay, mx - ax);
      const sx = ax + Math.cos(ang1) * 20, sy = ay + Math.sin(ang1) * 20;
      const ang2 = Math.atan2(by - my, bx - mx);
      const ex = bx - Math.cos(ang2) * head, ey = by - Math.sin(ang2) * head;
      const ext = w / 2;
      const seg1End = { x: mx + Math.cos(ang1) * ext, y: my + Math.sin(ang1) * ext };
      const path = `M${sx},${sy} L${seg1End.x},${seg1End.y} M${mx},${my} L${ex},${ey}`;
      const c2 = Math.cos(ang2), s2 = Math.sin(ang2);
      const P = (u, v) => `${ex + u * c2 - v * s2},${ey + u * s2 + v * c2}`;
      const tri = [P(0, -headW / 2), P(head, 0), P(0, headW / 2)].join(' ');
      return `<g opacity="${opacity}"><path d="${path}" stroke="${color}" stroke-width="${w}" fill="none"/><polygon points="${tri}" fill="${color}"/></g>`;
    }

    renderArrows() {
      let h = '';
      for (const a of this.state.arrows || []) h += this.arrowPath(a.from, a.to, a.color || '#96be46', a.opacity || 0.85);
      for (const a of this.userArrows) h += this.arrowPath(a.from, a.to, '#f6a33c', 0.8);
      this.arLayer.innerHTML = h;
    }

    renderBadge() {
      const b = this.state.badge;
      if (this.revealing) {
        this.bdLayer.innerHTML = '';
        return;
      }
      if (!b || !window.clsIcon(b.cls)) {
        this.bdLayer.innerHTML = '';
        return;
      }
      const { x, y } = sqToXY(b.sq, this.flipped);
      const nearRight = x === 7;
      const nearTop = y === 0;
      const left = nearRight ? (x + 1) * 12.5 - 4.1 : (x + 1) * 12.5 - 3.1;
      const top = nearTop ? y * 12.5 - 0.6 : y * 12.5 - 1.7;
      this.bdLayer.innerHTML = `<div class="badge pop" style="left:${left}%;top:${top}%">${window.clsIcon(b.cls, 40)}</div>`;
    }

    /* ---------- interaksi ---------- */
    pointToSq(ev) {
      const r = this.el.getBoundingClientRect();
      const x = Math.floor(((ev.clientX - r.left) / r.width) * 8);
      const y = Math.floor(((ev.clientY - r.top) / r.height) * 8);
      return xyToSq(x, y, this.flipped);
    }

    bindPointer() {
      let drag = null;
      let rdown = null;
      this.el.addEventListener('contextmenu', (e) => e.preventDefault());
      this.el.addEventListener('pointerdown', (e) => {
        if (!this.promoLayer.classList.contains('hidden')) return;
        const sq = this.pointToSq(e);
        if (!sq) return;
        if (e.button === 2) {
          rdown = sq;
          return;
        }
        if (e.button !== 0) return;
        if (this.userArrows.length || this.userMarks.length) {
          this.userArrows = [];
          this.userMarks = [];
          this.renderArrows();
          this.renderHL();
        }
        const piece = this.pieces && this.pieces[sq];
        const turn = (this.state.fen || '').split(' ')[1];
        if (this.selected && this.selected !== sq) {
          const ok = this.legalFor(this.selected).some((m) => m.to === sq);
          if (ok) {
            this.tryMove(this.selected, sq);
            return;
          }
        }
        if (piece && piece[0] === turn && this.opts.movable !== false) {
          this.selected = sq;
          this.renderHL();
          const el = this.pcLayer.querySelector(`[data-sq="${sq}"]`);
          if (el) {
            e.preventDefault();
            const r = this.el.getBoundingClientRect();
            drag = { sq, el, r, moved: false, sx: e.clientX, sy: e.clientY };
            el.classList.add('dragging');
            try { this.el.setPointerCapture(e.pointerId); } catch (_) {}
          }
        } else {
          this.selected = null;
          this.renderHL();
        }
      });
      this.el.addEventListener('pointermove', (e) => {
        if (!drag) return;
        const { r, el } = drag;
        if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 4) return;
        drag.moved = true;
        const sz = r.width / 8;
        const px = e.clientX - r.left - sz / 2;
        const py = e.clientY - r.top - sz / 2;
        el.style.transition = 'none';
        el.style.transform = `translate(${(px / sz) * 100}%,${(py / sz) * 100}%)`;
        el.style.zIndex = 20;
      });
      const end = (e) => {
        if (rdown && e.button === 2) {
          const to = this.pointToSq(e);
          if (to) {
            if (to === rdown) {
              const i = this.userMarks.indexOf(to);
              if (i >= 0) this.userMarks.splice(i, 1);
              else this.userMarks.push(to);
              this.renderHL();
            } else {
              const i = this.userArrows.findIndex((a) => a.from === rdown && a.to === to);
              if (i >= 0) this.userArrows.splice(i, 1);
              else this.userArrows.push({ from: rdown, to });
              this.renderArrows();
            }
          }
          rdown = null;
          return;
        }
        if (!drag) return;
        const d = drag;
        drag = null;
        d.el.classList.remove('dragging');
        d.el.style.zIndex = '';
        if (!d.moved) {
          const { x, y } = sqToXY(d.sq, this.flipped);
          d.el.style.transform = `translate(${x * 100}%,${y * 100}%)`;
          return;
        }
        const to = this.pointToSq(e);
        if (to && to !== d.sq && this.legalFor(d.sq).some((m) => m.to === to)) {
          this.tryMove(d.sq, to, true);
        } else {
          const { x, y } = sqToXY(d.sq, this.flipped);
          d.el.style.transition = 'transform .12s';
          d.el.style.transform = `translate(${x * 100}%,${y * 100}%)`;
        }
      };
      this.el.addEventListener('pointerup', end);
      this.el.addEventListener('pointercancel', end);
    }

    tryMove(from, to) {
      const moves = this.legalFor(from).filter((m) => m.to === to);
      this.selected = null;
      if (!moves.length) return;
      if (moves.length > 1 || moves[0].promotion) {
        this.askPromotion(from, to);
        return;
      }
      this.opts.onMove && this.opts.onMove(from, to);
    }

    askPromotion(from, to) {
      const color = this.pieces[from][0];
      const { x, y } = sqToXY(to, this.flipped);
      const down = y === 0;
      let h = '';
      ['q', 'n', 'r', 'b'].forEach((p, i) => {
        const yy = down ? y + i : y - i;
        h += `<div class="promo-opt" data-p="${p}" style="left:${x * 12.5}%;top:${yy * 12.5}%;background-image:url(${PIECE_URL(color + p.toUpperCase())})"></div>`;
      });
      this.promoLayer.innerHTML = h;
      this.promoLayer.classList.remove('hidden');
      const handler = (e) => {
        e.stopPropagation();
        const t = e.target.closest('.promo-opt');
        this.promoLayer.classList.add('hidden');
        this.promoLayer.removeEventListener('pointerdown', handler);
        if (t) this.opts.onMove && this.opts.onMove(from, to, t.dataset.p);
        else this.render();
      };
      this.promoLayer.addEventListener('pointerdown', handler);
    }
  }

  Board.REVEAL_MS = 1620;   // lama animasi ikon besar Bagus/Brilian sampai menjadi badge kecil (150 + 1250 + 220)
  window.Board = Board;
})();