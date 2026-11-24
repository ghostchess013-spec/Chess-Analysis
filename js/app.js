/* ===================== Aplikasi Game Review ===================== */
(function () {
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const I = window.I18N;
  const icon = window.clsIcon;
  const DEFAULT_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  // Kedalaman analisis langsung: TETAP, tidak mengikuti pengaturan Kedalaman (yang hanya untuk Ulasan Partai).
  // 22 = sama dengan pilihan tertinggi Ulasan Partai. Ubah angka ini bila terasa terlalu lambat (mis. 20).
  const LIVE_DEPTH = 22;

  const S = {
    game: null, report: null, ply: 0, variation: null, tab: 'review', view: 'empty',
    engine: null, engineErr: null, analyzing: false, cancel: false, live: null, liveToken: 0,
    tryMode: null, playing: null,
    settings: Object.assign({ theme: 'green', depth: 15, sound: true, arrows: true, playSpeed: 1, engine: 'lite', board: '9rdwe', pieces: 'ejgfv' }, (function () { try { return JSON.parse(localStorage.getItem('cr_settings') || '{}') || {}; } catch (e) { return {}; } })())
  };
  const saveSettings = () => localStorage.setItem('cr_settings', JSON.stringify(S.settings));

  /* ---------- util ---------- */
  function toast(msg, ms) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.add('hidden'), ms || 2800);
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function fmtEval(ev, short) {
    if (!ev) return '0.0';
    if (ev.mate !== undefined && ev.mate !== null) {
      if (ev.mate === 0) return ev.winner === 'w' ? '1-0' : ev.winner === 'b' ? '0-1' : '½-½';
      return (ev.mate > 0 ? '' : '-') + 'M' + Math.abs(ev.mate);
    }
    const v = ev.cp / 100;
    if (short) return (v > 0 ? '+' : '') + (Math.abs(v) >= 10 ? v.toFixed(0) : v.toFixed(1));
    return (v > 0 ? '+' : '') + v.toFixed(2);
  }
  // HP: coach dipindah ke atas papan (seperti Chess.com); desktop tetap di panel
  const mqPhone = window.matchMedia('(max-width: 760px)');
  function dockCoach(root) {
    const top = $('#coach-top');
    if (!top) return;
    const row = root ? $('.coach-row', root) : null;
    top.innerHTML = '';
    if (mqPhone.matches && row && S.tab === 'review') {
      top.appendChild(row);
      top.classList.remove('hidden');
    } else {
      top.classList.add('hidden');
    }
  }
  const onPhoneChange = () => { if (S.tab === 'review') renderReview(); else dockCoach(null); };
  if (mqPhone.addEventListener) mqPhone.addEventListener('change', onPhoneChange);
  else if (mqPhone.addListener) mqPhone.addListener(onPhoneChange);
  const evalWhiteIsAhead = (ev) => (ev.mate !== undefined && ev.mate !== null ? (ev.mate === 0 ? ev.winner !== 'b' : ev.mate > 0) : ev.cp >= 0);
  function uciToSan(fen, uci) {
    try {
      const c = new Chess(fen);
      return c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san;
    } catch (e) { return null; }
  }
  function pvToSan(fen, pv, max) {
    const c = new Chess(fen);
    const out = [];
    let n = parseInt(fen.split(' ')[5], 10) || 1;
    let turn = c.turn();
    for (let i = 0; i < Math.min(pv.length, max || 12); i++) {
      let m;
      try { m = c.move({ from: pv[i].slice(0, 2), to: pv[i].slice(2, 4), promotion: pv[i][4] }); } catch (e) { break; }
      if (turn === 'w') out.push(n + '. ' + m.san);
      else out.push(i === 0 ? n + '... ' + m.san : m.san);
      if (turn === 'b') n++;
      turn = turn === 'w' ? 'b' : 'w';
    }
    return out.join(' ');
  }
  function renderIcons(root) {
    $$('i[data-ic]', root).forEach((el) => { if (!el.innerHTML) el.innerHTML = window.UI_ICONS[el.dataset.ic] || ''; });
  }
  function applyI18n() {
    $$('[data-t]').forEach((el) => {
      const k = el.dataset.t;
      el.textContent = I.t(k);
    });
    $('#inp-pgn').placeholder = I.t('pastePgn');
    const en = $('#eng-name');
    if (en) en.textContent = (window.ENGINE_CONFIG && window.ENGINE_CONFIG.name) || 'Stockfish';
    const sb = $('#btn-settings-m');
    if (sb) { sb.title = I.t('settings'); sb.setAttribute('aria-label', I.t('settings')); }
    // label pilihan Kedalaman mengikuti bahasa (Cepat/Standar/Dalam atau Fast/Standard/Deep)
    const depthSel = $('#set-depth');
    if (depthSel) Array.from(depthSel.options).forEach((o) => { const k = { 12: 'fast', 15: 'standard', 18: 'deep', 20: 'deeper', 22: 'veryDeep' }[o.value]; if (k) o.textContent = `${I.t(k)} (${o.value})`; });
    const spSel = $('#set-speed');
    if (spSel) Array.from(spSel.options).forEach((o) => (o.textContent = `${o.value} ${I.t('secUnit')}`));
    const engSel = $('#set-engine');
    if (engSel) Array.from(engSel.options).forEach((o) => { const k = { lite: 'engLite', full: 'engFull' }[o.value]; if (k) o.textContent = I.t(k); });
    document.documentElement.lang = I.lang;
  }

  /* ---------- suara (WebAudio, tanpa file) ---------- */
  let actx = null;
  function sound(type) {
    if (!S.settings.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const now = actx.currentTime;
      const mk = (freq, dur, vol, t0, kind) => {
        const o = actx.createOscillator(), g = actx.createGain();
        o.type = kind || 'triangle';
        o.frequency.setValueAtTime(freq, now + t0);
        o.frequency.exponentialRampToValueAtTime(freq * 0.5, now + t0 + dur);
        g.gain.setValueAtTime(vol, now + t0);
        g.gain.exponentialRampToValueAtTime(0.0001, now + t0 + dur);
        o.connect(g).connect(actx.destination);
        o.start(now + t0);
        o.stop(now + t0 + dur + 0.02);
      };
      if (type === 'capture') { mk(520, 0.07, 0.35, 0); mk(260, 0.09, 0.3, 0.03); }
      else if (type === 'check') { mk(880, 0.1, 0.25, 0, 'square'); mk(660, 0.12, 0.2, 0.08, 'square'); }
      else if (type === 'castle') { mk(400, 0.06, 0.3, 0); mk(400, 0.06, 0.3, 0.09); }
      else if (type === 'end') { mk(523, 0.2, 0.25, 0, 'sine'); mk(659, 0.2, 0.25, 0.12, 'sine'); mk(784, 0.35, 0.25, 0.24, 'sine'); }
      else if (type === 'correct') { mk(660, 0.12, 0.25, 0, 'sine'); mk(990, 0.2, 0.25, 0.1, 'sine'); }
      else if (type === 'wrong') { mk(220, 0.25, 0.25, 0, 'sawtooth'); }
      else mk(330, 0.06, 0.35, 0);
    } catch (e) { /* abaikan */ }
  }
  function moveSound(m, fenAfter) {
    const c = new Chess(fenAfter);
    if (c.isCheckmate()) return sound('end');
    if (c.inCheck()) return sound('check');
    if (m.flags && (m.flags.includes('k') || m.flags.includes('q'))) return sound('castle');
    if (m.captured) return sound('capture');
    sound('move');
  }

  /* ---------- PGN ---------- */
  function parseClock(cmt) {
    const m = /\[%clk\s+([\d:.]+)\]/.exec(cmt || '');
    return m ? m[1] : null;
  }
  function parsePgn(pgn) {
    pgn = String(pgn || '').replace(/\r/g, '').trim();
    if (!pgn) throw new Error(I.t('invalidPgn'));
    // ambil game pertama bila ada banyak
    const parts = pgn.split(/\n\s*\n(?=\[Event )/);
    pgn = parts[0];
    const c = new Chess();
    try { c.loadPgn(pgn); } catch (e) {
      // coba tanpa komentar/variasi
      const cleaned = pgn.replace(/\{[^}]*\}/g, ' ').replace(/\$\d+/g, ' ');
      c.loadPgn(cleaned);
    }
    const headers = c.getHeaders ? c.getHeaders() : c.header();
    const hist = c.history({ verbose: true });
    const comments = {};
    (c.getComments ? c.getComments() : []).forEach((x) => (comments[x.fen] = x.comment));
    const startFen = headers.FEN || (hist[0] ? hist[0].before : DEFAULT_FEN);
    const positions = [{ fen: startFen }];
    const moves = hist.map((m) => {
      positions.push({ fen: m.after });
      return { san: m.san, from: m.from, to: m.to, color: m.color, piece: m.piece, captured: m.captured, promotion: m.promotion, flags: m.flags, clock: parseClock(comments[m.after]) };
    });
    if (!moves.length) throw new Error(I.t('invalidPgn'));
    if (!headers.Result || headers.Result === '*') {
      const fin = new Chess(positions[positions.length - 1].fen);
      if (fin.isCheckmate()) headers.Result = fin.turn() === 'w' ? '0-1' : '1-0';
      else if (fin.isDraw()) headers.Result = '1/2-1/2';
    }
    const nags = window.Official ? window.Official.parseNags(pgn) : null;   // tanda resmi Game Review Chess.com (bila ada)
    const ccMarks = nags && nags.length === moves.length && nags.some(Boolean) ? nags : null;
    return { headers, moves, positions, pgn, ccMarks };
  }
  function gameFromFen(fen) {
    const c = new Chess();
    c.load(fen.trim());
    return { headers: { White: I.t('white'), Black: I.t('black'), FEN: c.fen(), Result: '*' }, moves: [], positions: [{ fen: c.fen() }], pgn: '' };
  }

  /* ---------- Progres memuat engine ---------- */
  function fmtEta(sec) {
    if (!sec || sec < 0) return '';
    return '±' + (sec < 60 ? Math.ceil(sec) + ' ' + I.t('secShort') : Math.round(sec / 60) + ' ' + I.t('minShort'));
  }
  function fmtSpeed(bps) {
    return bps < 1048576 ? Math.round(bps / 1024) + ' KB/s' : (bps / 1048576).toFixed(1) + ' MB/s';
  }
  function engineLoadInfo() {
    const st = Engine.load;
    if (st.phase === 'download') {
      const parts = [];
      if (st.total) parts.push(Math.round(st.loaded / 1048576) + '/' + Math.round(st.total / 1048576) + ' MB');
      if (st.speed > 0) parts.push(fmtSpeed(st.speed));
      const eta = fmtEta(st.eta);
      if (eta) parts.push(eta);
      const pct = Math.floor(st.percent * 100);
      return { text: I.t('engineDownloading') + ' ' + pct + '%', label: I.t('engineDownloading') + '…', pct, meta: parts.join(' · '), indet: false };
    }
    if (st.phase === 'init') return { text: I.t('engineInit'), label: I.t('engineInit'), pct: 100, meta: '', indet: true };
    return { text: I.t('loadingEngine'), label: I.t('loadingEngine'), pct: 0, meta: '', indet: true };
  }
  function engineLoadingHtml() {
    const g = engineLoadInfo();
    return `<div class="eng-load"><div class="eng-load-top"><span id="eng-load-label">${esc(g.text)}</span><span id="eng-load-meta" class="muted">${esc(g.meta)}</span></div>` +
      `<div class="eng-bar"><div id="eng-load-fill" class="eng-bar-fill${g.indet ? ' indet' : ''}" style="width:${g.pct}%"></div></div></div>`;
  }
  function engineErrorHtml() {
    const msg = S.engineErr && S.engineErr.message ? S.engineErr.message : '';
    return `<div class="eng-load"><div style="color:#ff6b6b">${esc(I.t('engineFailDetail') + msg)}</div><button id="eng-retry" class="btn btn-gray" style="margin-top:8px">${esc(I.t('engineRetry'))}</button></div>`;
  }
  // memperbarui elemen yang sedang tampil tanpa merender ulang seluruh panel
  function onEngineLoad() {
    if (S.engine) return;
    const g = engineLoadInfo();
    const label = $('#eng-load-label'), meta = $('#eng-load-meta'), fill = $('#eng-load-fill');
    if (label) label.textContent = g.text;
    if (meta) meta.textContent = g.meta;
    if (fill) { fill.style.width = g.pct + '%'; fill.classList.toggle('indet', g.indet); }
    if (S.analyzing) { // tampilan Ulasan Partai sedang menunggu engine
      const pl = $('#progress-label'), pf = $('#review-progress .progress-fill'), pp = $('#progress-pct'), pd = $('#progress-depth');
      if (pl) pl.textContent = g.label;
      if (pf) { pf.style.width = g.pct + '%'; pf.classList.toggle('indet', g.indet); }
      if (pp) pp.textContent = g.indet ? '' : g.pct + '%';
      if (pd) pd.textContent = g.meta;
    }
  }

  /* ---------- Engine ---------- */
  function getEngine() {
    if (S.engine) return Promise.resolve(S.engine);
    if (S.enginePromise) return S.enginePromise;
    const e = new Engine(Engine.pathFor(S.settings.engine));
    S.engineLoading = e;
    S.enginePromise = e.readyPromise.then(() => {
      if (e.disposed) return e;
      S.engine = e;
      S.engineLoading = null;
      const nameEl = document.querySelector('#engine-head .eng-meta b');
      if (nameEl && e.engineName) nameEl.textContent = e.engineName.replace(/ WASM$/, '');
      return e;
    }).catch((err) => {
      if (e.disposed) throw err; // engine lama yang sudah dibuang: jangan ganggu status engine baru
      S.enginePromise = null;
      S.engineErr = err;
      const detail = (err && err.message) ? err.message : String(err);
      console.error('[Engine]', err);
      toast(location.protocol === 'file:' ? I.t('engineFail') : I.t('engineFailDetail') + detail, 10000);
      throw err;
    });
    return S.enginePromise;
  }

  /* ---------- Board ---------- */
  let board;
  function currentFen() {
    const v = S.variation;
    if (v && v.idx >= 0) return v.list[v.idx].fen;
    if (S.game) return S.game.positions[S.ply].fen;
    return DEFAULT_FEN;
  }
  function currentMoveInfo() {
    const v = S.variation;
    if (v && v.idx >= 0) return { variation: true, m: v.list[v.idx] };
    if (S.game && S.ply > 0) return { m: S.game.moves[S.ply - 1], rm: S.report ? S.report.moves[S.ply - 1] : null };
    return {};
  }
  function kingInCheck(fen) {
    const c = new Chess(fen);
    if (!c.inCheck()) return null;
    const t = c.turn();
    for (const row of c.board()) for (const p of row) if (p && p.type === 'k' && p.color === t) return p.square;
    return null;
  }

  function refreshBoard(animate) {
    const fen = currentFen();
    const info = currentMoveInfo();
    const st = { fen, check: kingInCheck(fen), arrows: [] };
    if (info.m) st.lastMove = { from: info.m.from, to: info.m.to };
    if (info.rm && S.report) {
      const rm = info.rm;
      st.badge = { sq: rm.to, cls: rm.cls };
      const cc = window.CLS[rm.cls];
      const col = cc && (cc.hl || cc.color);
      if (col && rm.cls !== 'forced') st.hlColor = col;
      if (!S.tryMode && (rm.cls === 'brilliant' || rm.cls === 'great')) {
        st.reveal = { sq: rm.to, cls: rm.cls };
        // panah emas = balasan lawan yang diharapkan (terbaik menurut engine; bila lawan memainkannya, langkah aslinya)
        const nr = S.report.moves[S.ply], nm = S.game.moves[S.ply];
        if (S.settings.arrows && nr && nm && nr.cls !== 'book') {
          const uci = nr.bestMove || (nm.from + nm.to);
          st.arrows.push({ from: uci.slice(0, 2), to: uci.slice(2, 4), color: '#d88600', opacity: 0.8 });
        }
      }
      if (S.settings.arrows && rm.bestMove && !['best', 'brilliant', 'great', 'book', 'forced'].includes(rm.cls) && !S.tryMode) {
        st.arrows.push({ from: rm.bestMove.slice(0, 2), to: rm.bestMove.slice(2, 4), color: '#96be46', opacity: 0.85 });
      }
    }
    if (S.tryMode && S.tryMode.hint) st.arrows.push({ from: S.tryMode.hint.slice(0, 2), to: S.tryMode.hint.slice(2, 4), color: '#96be46' });
    if (S.tab === 'analysis' && S.liveArrow && S.settings.arrows && !info.rm) st.arrows.push({ from: S.liveArrow.slice(0, 2), to: S.liveArrow.slice(2, 4), color: '#3692e7', opacity: 0.7 });
    board.set(st, animate);
    updatePlayers();
    updateEvalBar();
  }

  function legalFor(sq) {
    try {
      const c = new Chess(currentFen());
      return c.moves({ square: sq, verbose: true });
    } catch (e) { return []; }
  }

  function onBoardMove(from, to, promo) {
    const fen = currentFen();
    const c = new Chess(fen);
    let m;
    try { m = c.move({ from, to, promotion: promo || 'q' }); } catch (e) { return; }
    if (!m) return;
    const after = c.fen();
    moveSound(m, after);
    if (S.tryMode) return handleTry(m, fen, after);
    // langkah sesuai garis utama?
    if (!S.variation && S.game && S.ply < S.game.moves.length) {
      const nm = S.game.moves[S.ply];
      if (nm.from === from && nm.to === to && (nm.promotion || 'q') === (m.promotion || 'q')) return goto(S.ply + 1, true, true);
    }
    if (!S.game) S.game = gameFromFen(DEFAULT_FEN);
    if (!S.variation) S.variation = { base: S.ply, list: [], idx: -1 };
    const v = S.variation;
    v.list = v.list.slice(0, v.idx + 1);
    v.list.push({ san: m.san, from: m.from, to: m.to, fen: after, color: m.color, flags: m.flags, captured: m.captured });
    v.idx = v.list.length - 1;
    refreshBoard(false);
    renderAll();
    liveAnalyze();
  }

  /* ---------- Navigasi ---------- */
  function goto(ply, animate, silent) {
    if (!S.game) return;
    S.variation = null;
    S.tryMode = null;
    ply = Math.max(0, Math.min(S.game.moves.length, ply));
    const forward = ply === S.ply + 1;
    S.ply = ply;
    refreshBoard(animate && forward);
    if (forward && !silent && ply > 0) moveSound(S.game.moves[ply - 1], S.game.positions[ply].fen);
    renderAll();
    liveAnalyze();
  }
  function step(d) {
    const v = S.variation;
    if (v) {
      const ni = v.idx + d;
      if (ni < -1) {
        S.variation = null;
        return goto(v.base - 1 < 0 ? 0 : v.base - 1);
      }
      if (ni >= v.list.length) return;
      v.idx = ni;
      refreshBoard(d > 0);
      if (d > 0) moveSound(v.list[ni], v.list[ni].fen);
      renderAll();
      liveAnalyze();
      return;
    }
    goto(S.ply + d, d > 0);
  }
  function exitVariation() {
    if (!S.variation) return;
    const b = S.variation.base;
    S.variation = null;
    goto(b);
  }
  // putar otomatis: 1-5 detik per langkah (Pengaturan); untuk Bagus/Brilian tunggu animasi ikon besar selesai dulu
  const playMs = () => Math.min(5, Math.max(1, parseInt(S.settings.playSpeed, 10) || 1)) * 1000;
  function playTick() {
    if (!S.game || S.ply >= S.game.moves.length) {
      S.playing = null;
      updatePlayBtn();
      return;
    }
    if (board.revealing) {
      S.playing = setTimeout(playTick, 120);
      return;
    }
    step(1);
    const rm = S.report && S.ply > 0 ? S.report.moves[S.ply - 1] : null;
    const reveal = rm && (rm.cls === 'brilliant' || rm.cls === 'great') && !S.tryMode && !S.variation;
    S.playing = setTimeout(playTick, reveal ? Math.max(playMs(), window.Board.REVEAL_MS + 450) : playMs());
  }
  function togglePlay() {
    if (S.playing) {
      clearTimeout(S.playing);
      S.playing = null;
    } else {
      if (!S.game) return;
      if (S.ply >= S.game.moves.length) goto(0);
      S.playing = setTimeout(playTick, playMs());
    }
    updatePlayBtn();
  }
  function updatePlayBtn() {
    const b = $('#c-play i');
    b.innerHTML = window.UI_ICONS[S.playing ? 'pause' : 'play'];
  }

  /* ---------- Pemain, jam, material ---------- */
  /* ---------- Foto profil pemain (API Chess.com, disimpan di localStorage) ---------- */
  const AVATARS = (function () { try { return JSON.parse(localStorage.getItem('cr_avatars') || '{}') || {}; } catch (e) { return {}; } })();
  const AVATAR_TTL = 7 * 24 * 3600 * 1000;   // ada foto: simpan 7 hari
  const AVATAR_MISS_TTL = 24 * 3600 * 1000;  // tidak ada foto / bukan akun Chess.com: cek lagi besok
  const avatarKey = (n) => String(n || '').trim().toLowerCase();
  function avatarFor(name) { const e = AVATARS[avatarKey(name)]; return e && e.url ? e.url : ''; }
  function saveAvatars() {
    try {
      const keys = Object.keys(AVATARS);
      if (keys.length > 300) keys.sort((a, b) => AVATARS[a].t - AVATARS[b].t).slice(0, keys.length - 300).forEach((k) => delete AVATARS[k]);
      localStorage.setItem('cr_avatars', JSON.stringify(AVATARS));
    } catch (e) {}
  }
  const isChessComName = (n) => /^[a-z0-9_-]{2,40}$/.test(avatarKey(n));   // "Paul Morphy", "?", dll. bukan username Chess.com
  const CC_DEFAULT_AVATAR = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d3d1d0"/><stop offset="1" stop-color="#8f8d8c"/></linearGradient></defs><circle cx="50" cy="30" r="11.5" fill="url(#g)"/><rect x="36" y="44" width="28" height="7" rx="3.5" fill="url(#g)"/><path d="M42 51c1 10-3 17-14 25-3 2.3-3 4.5 0 5h44c3-.5 3-2.7 0-5C61 68 57 61 58 51z" fill="url(#g)"/></svg>');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // API Chess.com membatasi permintaan paralel (kode 429), jadi foto diminta satu per satu dan dicoba ulang
  let avatarQueue = Promise.resolve();
  function loadAvatar(name) {
    avatarQueue = avatarQueue.then(() => loadAvatarNow(name)).catch(() => {});
    return avatarQueue;
  }
  async function loadAvatarNow(name) {
    const k = avatarKey(name);
    if (!isChessComName(k)) return;
    const e = AVATARS[k];
    if (e && Date.now() - e.t < (e.url ? AVATAR_TTL : AVATAR_MISS_TTL)) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    const url = `https://api.chess.com/pub/player/${encodeURIComponent(k)}`;
    const keep = (d) => {
      AVATARS[k] = { url: d && typeof d.avatar === 'string' && /^https:\/\//.test(d.avatar) ? d.avatar : '', t: Date.now() };
      saveAvatars();
    };
    for (let i = 0; i < 3; i++) {
      try {
        const r = await fetch(url);
        if (r.status === 404) return keep(null);              // bukan akun Chess.com
        if (r.ok) return keep(await r.json());                // tanpa field avatar = belum punya foto
      } catch (err) { /* jaringan/CORS: coba lagi */ }
      await sleep(i === 0 ? 700 : 1500);                      // 429/5xx: tunggu lalu ulangi
    }
    try { keep(await fetchJson(url)); } catch (err) { /* tidak disimpan; dicoba lagi saat partai berikutnya */ }
  }
  function prefetchAvatars(game) {
    const h = (game && game.headers) || {};
    const upd = () => { if (S.game === game) updatePlayers(); };
    loadAvatar(h.White).then(upd);
    loadAvatar(h.Black).then(upd);
  }

  function updatePlayers() {
    const g = S.game;
    const flipped = board.flipped;
    const top = flipped ? 'w' : 'b', bot = flipped ? 'b' : 'w';
    const h = (g && g.headers) || {};
    const fen = currentFen();
    const setBar = (el, col) => {
      const name = col === 'w' ? h.White || I.t('white') : h.Black || I.t('black');
      const elo = col === 'w' ? h.WhiteElo : h.BlackElo;
      $('.pname', el).textContent = name;
      $('.prating', el).textContent = elo && elo !== '?' ? `(${elo})` : '';
      const av = $('.avatar', el);
      const pname = col === 'w' ? h.White : h.Black;
      const photo = avatarFor(pname);
      const dflt = !photo && isChessComName(pname);          // akun Chess.com tanpa foto: pion abu-abu seperti di Chess.com
      av.classList.toggle('photo', !!photo);
      av.classList.toggle('cc-default', dflt);
      av.style.backgroundImage = photo ? `url("${photo}")` : dflt ? `url("${CC_DEFAULT_AVATAR}")` : `url(${window.ChessAssets ? window.ChessAssets.pieceUrl(col + 'P') : `img/pieces/${col}P.svg`})`;
      $('.captured', el).innerHTML = capturedHtml(fen, col);
      // jam
      const clk = $('.clock', el);
      let clock = null;
      if (g && !S.variation) {
        for (let i = S.ply - 1; i >= 0; i--) if (g.moves[i].color === col && g.moves[i].clock) { clock = g.moves[i].clock; break; }
        if (!clock) for (let i = 0; i < g.moves.length; i++) if (g.moves[i].color === col && g.moves[i].clock) { clock = g.moves[i].clock; break; }
      }
      if (clock) {
        clk.classList.remove('hidden');
        clk.textContent = clock.replace(/^0:/, '').replace(/\.\d+$/, '');
        clk.classList.toggle('active', fen.split(' ')[1] === col);
      } else clk.classList.add('hidden');
    };
    setBar($('#player-top'), top);
    setBar($('#player-bottom'), bot);
  }
  function capturedHtml(fen, col) {
    const start = { p: 8, n: 2, b: 2, r: 2, q: 1 };
    const cnt = { w: { p: 0, n: 0, b: 0, r: 0, q: 0 }, b: { p: 0, n: 0, b: 0, r: 0, q: 0 } };
    const board = fen.split(' ')[0];
    for (const ch of board) {
      if (/[pnbrq]/i.test(ch)) {
        const c = ch === ch.toUpperCase() ? 'w' : 'b';
        cnt[c][ch.toLowerCase()]++;
      }
    }
    const opp = col === 'w' ? 'b' : 'w';
    let h = '';
    for (const t of ['p', 'b', 'n', 'r', 'q']) {
      const n = Math.max(0, start[t] - cnt[opp][t]);
      if (!n) continue;
      h += '<span class="grp">';
      for (let i = 0; i < n; i++) h += `<img src="${window.ChessAssets ? window.ChessAssets.pieceUrl(opp + t.toUpperCase()) : `img/pieces/${opp}${t.toUpperCase()}.svg`}" alt="">`;
      h += '</span>';
    }
    const V = { p: 1, n: 3, b: 3, r: 5, q: 9 };
    let mw = 0, mb = 0;
    for (const t in V) { mw += cnt.w[t] * V[t]; mb += cnt.b[t] * V[t]; }
    const adv = col === 'w' ? mw - mb : mb - mw;
    if (adv > 0) h += `<span class="adv">+${adv}</span>`;
    return h;
  }

  /* ---------- Eval bar ---------- */
  function currentEval() {
    if (S.report && !S.variation) return S.report.evals[S.ply].white;
    if (S.live && S.live.fen === currentFen() && S.live.lines[0]) return Analyzer.lineToWhite(S.live.lines[0], S.live.fen.split(' ')[1]);
    return null;
  }
  function updateEvalBar() {
    const bar = $('#eval-bar');
    const ev = currentEval();
    bar.classList.toggle('flipped', board.flipped);
    const fill = $('.eval-fill', bar), txt = $('.eval-txt', bar);
    if (!ev) {
      fill.style.height = '50%';
      txt.textContent = '';
      return;
    }
    let pct;
    if (ev.mate !== undefined && ev.mate !== null) pct = ev.mate === 0 ? (ev.winner === 'w' ? 100 : ev.winner === 'b' ? 0 : 50) : ev.mate > 0 ? 100 : 0;
    else pct = 50 + 50 * (2 / (1 + Math.exp(-0.004 * ev.cp)) - 1);
    pct = Math.max(ev.mate !== undefined ? 0 : 4, Math.min(ev.mate !== undefined ? 100 : 96, pct));
    fill.style.height = pct + '%';
    const white = evalWhiteIsAhead(ev);
    let s = fmtEval(ev, true).replace('+', '');
    if (ev.cp !== undefined && Math.abs(ev.cp) < 5) s = '0.0';
    txt.textContent = s;
    // posisi teks: di sisi yang unggul
    const atBottom = board.flipped ? !white : white;
    txt.classList.toggle('top', !atBottom);
    txt.style.color = white ? '#403d39' : '#fff';
  }

  /* ---------- Live engine (tab Analysis / variasi) ---------- */
  function liveAnalyze() {
    const need = S.tab === 'analysis' || S.variation || !S.report;
    if (!$('#engine-toggle').checked || !need || S.analyzing) {
      return;
    }
    const fen = currentFen();
    const c = new Chess(fen);
    S.liveArrow = null;
    if (c.isGameOver()) {
      S.live = { fen, lines: [], depth: 0 };
      renderEngineLines();
      return;
    }
    const token = ++S.liveToken;
    getEngine().then((eng) => {
      if (token !== S.liveToken) return;
      S.live = { fen, lines: [], depth: 0 };
      eng.analyze(fen, {
        depth: LIVE_DEPTH, multipv: 3, exclusive: true,
        onInfo: (lines, depth) => {
          if (token !== S.liveToken) return;
          S.live = { fen, lines, depth };
          S.liveArrow = lines[0] && lines[0].pv[0];
          throttleLive();
        }
      }).then((r) => {
        if (!r || token !== S.liveToken) return;
        S.live = { fen, lines: r.lines, depth: r.depth };
        S.liveArrow = r.bestmove;
        renderEngineLines();
        updateEvalBar();
        if (S.tab === 'analysis' && !currentMoveInfo().rm) refreshBoardKeep();
      });
    }).catch(() => {});
  }
  let liveT = null;
  function throttleLive() {
    if (liveT) return;
    liveT = setTimeout(() => {
      liveT = null;
      renderEngineLines();
      updateEvalBar();
    }, 200);
  }
  function refreshBoardKeep() {
    // render ulang panah tanpa mereset seleksi
    const fen = currentFen();
    if (board.state.fen !== fen) return;
    const arrows = (board.state.arrows || []).filter((a) => a.color !== '#3692e7');
    if (S.liveArrow && S.settings.arrows) arrows.push({ from: S.liveArrow.slice(0, 2), to: S.liveArrow.slice(2, 4), color: '#3692e7', opacity: 0.7 });
    board.state.arrows = arrows;
    board.renderArrows();
  }

  /* ---------- Render panel ---------- */
  function setTab(tab) {
    S.tab = tab;
    if (tab !== 'review') dockCoach(null);
    $$('.ptab').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    $$('.nav-item[data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    $$('.tab-page').forEach((p) => p.classList.toggle('hidden', p.id !== 'tab-' + tab));
    $('#panel-title-txt').textContent = I.t(tab === 'review' ? 'gameReview' : tab === 'analysis' ? 'analysis' : 'games');
    if (tab !== 'analysis' && S.engine && !S.analyzing && !S.variation && S.report) { S.liveToken++; S.engine.stop(); }
    refreshBoard(false);
    renderAll();
    if (tab === 'analysis') liveAnalyze();
    if (tab === 'games') renderRecent();
  }

  function renderAll() {
    if (S.tab === 'review') renderReview();
    if (S.tab === 'analysis') renderAnalysis();
  }

  function setReviewView(v) {
    S.view = v;
    $('#review-empty').classList.toggle('hidden', v !== 'empty');
    $('#review-progress').classList.toggle('hidden', v !== 'progress');
    $('#review-summary').classList.toggle('hidden', v !== 'summary');
    $('#review-step').classList.toggle('hidden', v !== 'step');
    if (v !== 'step' && v !== 'summary') dockCoach(null);
  }

  function renderReview() {
    if (S.analyzing) return setReviewView('progress');
    if (!S.report) return setReviewView('empty');
    if (S.view === 'summary' && S.ply === 0 && !S.variation) return renderSummary();
    if (S.view === 'summary' && (S.ply > 0 || S.variation)) S.view = 'step';
    renderStep();
  }

  /* ----- Grafik evaluasi ----- */
  function graphSvg(h, withDots) {
    const r = S.report;
    const wins = r.wins;
    const N = wins.length;
    const W = 600;
    const xs = (i) => (N <= 1 ? 0 : (i / (N - 1)) * W);
    const ys = (w) => h - (Math.max(0, Math.min(100, w)) / 100) * h;
    let pts = `0,${h} `;
    for (let i = 0; i < N; i++) pts += `${xs(i).toFixed(1)},${ys(wins[i]).toFixed(1)} `;
    pts += `${W},${h}`;
    let dots = '';
    if (withDots) {
      r.moves.forEach((m) => {
        if (!['brilliant', 'great', 'miss', 'mistake', 'blunder'].includes(m.cls)) return;
        dots += `<circle cx="${xs(m.ply + 1)}" cy="${ys(wins[m.ply + 1])}" r="${h > 60 ? 4.5 : 3.5}" fill="${window.CLS[m.cls].color}" stroke="#fff" stroke-width="1" vector-effect="non-scaling-stroke"/>`;
      });
    }
    const cur = S.variation ? S.variation.base : S.ply;
    const cx = xs(cur);
    return `<svg viewBox="0 0 ${W} ${h}" preserveAspectRatio="none">
      <rect width="${W}" height="${h}" fill="#403d39"/>
      <polygon points="${pts}" fill="#fff"/>
      <line x1="0" y1="${h / 2}" x2="${W}" y2="${h / 2}" stroke="#8b8987" stroke-width="1" opacity=".5" vector-effect="non-scaling-stroke"/>
      ${S.view === 'step' || S.ply > 0 ? `<line x1="${cx}" y1="0" x2="${cx}" y2="${h}" stroke="#81b64c" stroke-width="2" vector-effect="non-scaling-stroke"/>` : ''}
      ${dots}</svg>`;
  }
  function bindGraph(el) {
    el.addEventListener('click', (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const N = S.report.wins.length;
      const ply = Math.round(x * (N - 1));
      if (S.view === 'summary') S.view = 'step';
      goto(ply);
    });
  }

  function renderSummary() {
    setReviewView('summary');
    const r = S.report, g = S.game, h = g.headers;
    const acc = r.accuracy;
    const fmt = (a) => (a === null || a === undefined ? '—' : r.officialAccuracy && window.Official ? window.Official.display(a) : a.toFixed(1));
    const ph = (p, c) => {
      const v = r.phases[p][c];
      return v ? icon(v, 26) : '';
    };
    const order = ['brilliant', 'great', 'best', 'excellent', 'good', 'book', 'inaccuracy', 'mistake', 'miss', 'blunder'];
    const rows = order.map((k) => `<tr class="row-cls"><td class="lab">${I.clsName(k)}</td><td class="val" style="color:${window.CLS[k].color}">${r.counts.w[k]}</td><td class="ico">${icon(k, 24)}</td><td class="val" style="color:${window.CLS[k].color}">${r.counts.b[k]}</td></tr>`).join('');
    const opening = r.opening ? `<div class="opening-line">${icon('book', 16)}<span>${esc(r.opening.eco)} · ${esc(r.opening.name)}</span></div>` : '';
    const keys = r.keyMoments.slice(0, 14).map((p) => {
      const m = r.moves[p];
      const num = Math.floor(p / 2) + 1 + (m.color === 'w' ? '. ' : '... ');
      return `<button class="key-chip" data-ply="${p + 1}">${icon(m.cls, 16)}${num}${esc(m.san)}</button>`;
    }).join('');
    $('#review-summary').innerHTML = `
      <div class="coach-row"><div class="coach-avatar">${window.UI_ICONS.coach}</div><div class="bubble">${esc(I.summary(r, g))}</div></div>
      <div class="graph-wrap" id="sum-graph">${graphSvg(82, true)}</div>
      ${opening}
      <table class="sum-table">
        <tr class="sum-head"><td class="lab">${I.t('players')}</td>
          <td class="val"><div class="ph"><div class="av w"></div><div class="nm">${esc(h.White || I.t('white'))}</div></div></td><td></td>
          <td class="val"><div class="ph"><div class="av b"></div><div class="nm">${esc(h.Black || I.t('black'))}</div></div></td></tr>
        <tr><td class="lab">${I.t('accuracy')}</td><td class="val"><span class="acc-box w">${fmt(acc.w)}</span></td><td></td><td class="val"><span class="acc-box b">${fmt(acc.b)}</span></td></tr>
        <tr class="sep"><td colspan="4"></td></tr>
        ${rows}
        <tr class="sep"><td colspan="4"></td></tr>
        <tr><td class="lab">${I.t('gameRating')}</td><td class="val"><span class="rating-box">${r.gameRating.w || '—'}</span></td><td></td><td class="val"><span class="rating-box">${r.gameRating.b || '—'}</span></td></tr>
        <tr class="sep"><td colspan="4"></td></tr>
        <tr><td class="lab">${I.t('opening')}</td><td class="val">${ph('opening', 'w')}</td><td></td><td class="val">${ph('opening', 'b')}</td></tr>
        <tr><td class="lab">${I.t('middlegame')}</td><td class="val">${ph('middlegame', 'w')}</td><td></td><td class="val">${ph('middlegame', 'b')}</td></tr>
        <tr><td class="lab">${I.t('endgame')}</td><td class="val">${ph('endgame', 'w')}</td><td></td><td class="val">${ph('endgame', 'b')}</td></tr>
      </table>
      <div class="src-note">${r.officialAccuracy ? '✓ ' + I.t('srcAccOfficial') : I.t('srcAccApp')}${r.officialMarks ? '<br>✓ ' + I.t('srcMarksOfficial') : ''}<br>${I.t('srcRating')}</div>
      ${keys ? `<div class="sec-title">${I.t('keyMoments')}</div><div class="key-list">${keys}</div>` : ''}
      <div class="sum-actions"><button class="btn btn-green btn-xl" id="btn-start-review"><i data-ic="review"></i>${I.t('startReview')}</button></div>`;
    renderIcons($('#review-summary'));
    bindGraph($('#sum-graph'));
    $('#btn-start-review').onclick = () => {
      S.view = 'step';
      goto(1, true);
    };
    dockCoach($('#review-summary'));
    $$('.key-chip', $('#review-summary')).forEach((b) => (b.onclick = () => { S.view = 'step'; goto(parseInt(b.dataset.ply, 10)); }));
  }

  function evalBadge(ev, color) {
    const s = fmtEval(ev);
    const neg = !evalWhiteIsAhead(ev);
    return `<span class="ev ${neg ? 'neg' : ''}">${s}</span>`;
  }

  function renderStep() {
    setReviewView('step');
    const r = S.report, g = S.game;
    const el = $('#review-step');
    let bubble;
    const v = S.variation;
    if (S.tryMode) {
      const tm = S.tryMode;
      const msg = tm.result === 'ok' ? `<div class="bh">${icon(tm.cls || 'best', 22)}<span>${I.t('correct')}</span></div>` : tm.result === 'bad' ? `<div class="bh">${icon('mistake', 22)}<span>${I.t('tryAgain')}</span></div>` : `<div class="bh"><span>${I.t('findBetter')}</span></div>`;
      bubble = msg + (tm.checking ? `<div class="bt">${I.t('loading')}</div>` : '');
    } else if (v && v.idx >= 0) {
      const ev = S.live && S.live.fen === currentFen() && S.live.lines[0] ? Analyzer.lineToWhite(S.live.lines[0], S.live.fen.split(' ')[1]) : null;
      bubble = `<div class="bh"><span>${I.t('variation')}: <b>${esc(v.list.map((x) => x.san).join(' '))}</b></span>${ev ? evalBadge(ev) : ''}</div><div class="bt"><a href="#" id="exit-var" style="color:#45753c;font-weight:700">← ${I.t('backToGame')}</a></div>`;
    } else if (S.ply === 0) {
      bubble = `<div class="bh"><span>${esc(I.summary(r, g))}</span></div>`;
    } else {
      const m = r.moves[S.ply - 1];
      const ev = r.evals[S.ply].white;
      const exp = I.explain(m, r);
      let bestLine = '';
      if (m.bestMove && !['best', 'book', 'forced', 'brilliant', 'great'].includes(m.cls) && m.bestLine.length) {
        bestLine = `<div class="best-line">${icon('best', 14)} <b>${esc(m.bestSan || '')}</b> — ${esc(pvToSan(g.positions[S.ply - 1].fen, m.bestLine, 8))}</div>`;
      }
      bubble = `<div class="bh">${icon(m.cls, 24)}<span>${I.clsName(m.cls)}</span>${evalBadge(ev)}</div><div class="bt">${exp}</div>${bestLine}`;
    }
    const m = S.ply > 0 ? r.moves[S.ply - 1] : null;
    const bad = m && !S.variation && ['inaccuracy', 'mistake', 'blunder', 'miss'].includes(m.cls);
    const good = m && ['brilliant', 'great', 'best'].includes(m.cls);
    let actions;
    if (S.tryMode) {
      actions = `<button class="btn btn-gray" id="st-hint"><i data-ic="bulb"></i>${I.t('showBest')}</button><button class="btn btn-green" id="st-next">${I.t('next')}</button>`;
    } else if (S.variation) {
      actions = `<button class="btn btn-gray full" id="st-exit">${I.t('backToGame')}</button>`;
    } else if (S.ply >= g.moves.length) {
      actions = `<button class="btn btn-gray" id="st-summary">${I.t('reviewSummary')}</button><button class="btn btn-green" id="st-first">${I.t('startReview')}</button>`;
    } else if (bad) {
      actions = `<button class="btn btn-gray" id="st-best"><i data-ic="bulb"></i>${I.t('best')}</button><button class="btn btn-gray" id="st-retry"><i data-ic="retry"></i>${I.t('retry')}</button><button class="btn btn-green full" id="st-next">${I.t('next')}</button>`;
    } else {
      actions = `<button class="btn btn-gray" id="st-summary">${I.t('reviewSummary')}</button><button class="btn btn-green" id="st-next">${I.t('next')}</button>`;
    }
    void good;
    // mini move list
    let mm = '';
    r.moves.forEach((x, i) => {
      if (x.color === 'w' || i === 0) mm += `<span class="mn">${Math.floor(i / 2) + 1}${x.color === 'w' ? '.' : '...'}</span>`;
      mm += `<span class="mm ${i + 1 === S.ply && !S.variation ? 'cur' : ''}" data-ply="${i + 1}">${['book', 'forced', 'good', 'excellent', 'best'].includes(x.cls) ? '' : icon(x.cls, 14)}${esc(x.san)}</span>`;
    });
    el.innerHTML = `
      <div class="coach-row"><div class="coach-avatar">${window.UI_ICONS.coach}</div><div class="bubble">${bubble}</div></div>
      <div class="graph-wrap step-graph" id="step-graph">${graphSvg(52, true)}</div>
      <div class="step-actions">${actions}</div>
      <div class="mini-moves" id="mini-moves">${mm}</div>`;
    renderIcons(el);
    bindGraph($('#step-graph'));
    const on = (id, fn) => { const b = $('#' + id, el); if (b) b.onclick = fn; };
    on('st-next', () => { S.tryMode = null; goto(S.ply + 1, true); });
    on('st-summary', () => { S.view = 'summary'; goto(0); });
    on('st-first', () => goto(1, true));
    on('st-exit', exitVariation);
    on('st-best', () => showBestLine());
    on('st-retry', () => startTry());
    on('st-hint', () => {
      if (!S.tryMode) return;
      S.tryMode.hint = S.tryMode.best;
      refreshBoard(false);
    });
    const ex = $('#exit-var', el);
    if (ex) ex.onclick = (e) => { e.preventDefault(); exitVariation(); };
    $$('.mm', el).forEach((b) => (b.onclick = () => goto(parseInt(b.dataset.ply, 10))));
    const cur = $('.mm.cur', el);
    if (cur) { const mmEl = $('#mini-moves', el); mmEl.scrollTop = cur.offsetTop - mmEl.offsetTop - 40; }
    dockCoach(el);
  }

  function showBestLine() {
    const m = S.report.moves[S.ply - 1];
    if (!m || !m.bestLine.length) return;
    const base = S.ply - 1;
    const c = new Chess(S.game.positions[base].fen);
    const list = [];
    for (const u of m.bestLine.slice(0, 10)) {
      let mv;
      try { mv = c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }); } catch (e) { break; }
      list.push({ san: mv.san, from: mv.from, to: mv.to, fen: c.fen(), color: mv.color, flags: mv.flags, captured: mv.captured });
    }
    S.ply = base;
    S.variation = { base: base + 1, list, idx: 0 };
    S.variation.base = base + 1;
    // base dipakai untuk kembali: tampilkan posisi sebelum langkah
    S.variation.returnPly = base + 1;
    refreshBoard(true);
    moveSound(list[0], list[0].fen);
    renderAll();
    liveAnalyze();
  }

  function startTry() {
    const m = S.report.moves[S.ply - 1];
    S.tryMode = { ply: S.ply, best: m.bestMove, result: null };
    S.ply = S.ply - 1;
    refreshBoard(false);
    renderAll();
  }
  async function handleTry(mv, fenBefore, fenAfter) {
    const tm = S.tryMode;
    const rm = S.report.moves[tm.ply - 1];
    const uci = mv.from + mv.to + (mv.promotion || '');
    board.set({ fen: fenAfter, lastMove: { from: mv.from, to: mv.to }, check: kingInCheck(fenAfter) }, false);
    if (uci === rm.uci) {
      tm.result = 'bad';
      sound('wrong');
      renderStep();
      setTimeout(() => { if (S.tryMode === tm) refreshBoard(false); }, 900);
      return;
    }
    if (uci === tm.best) {
      tm.result = 'ok';
      tm.cls = 'best';
      sound('correct');
      renderStep();
      return;
    }
    tm.checking = true;
    renderStep();
    const eng = await getEngine();
    const r = await eng.analyze(fenAfter, { depth: 13, multipv: 1, exclusive: true });
    tm.checking = false;
    if (S.tryMode !== tm || !r) return;
    const turnAfter = fenAfter.split(' ')[1];
    let ev = r.lines[0] ? Analyzer.lineToWhite(r.lines[0], turnAfter) : { cp: 0 };
    const c = new Chess(fenAfter);
    if (c.isCheckmate()) ev = { mate: 0, winner: mv.color };
    const rating = parseInt(S.game.headers[mv.color === 'w' ? 'WhiteElo' : 'BlackElo'], 10) || 1500;
    const loss = rm.epBest - Analyzer.evalToEP(ev, mv.color, rating);
    if (loss <= 0.05) {
      tm.result = 'ok';
      tm.cls = loss <= 0.005 ? 'best' : loss <= 0.02 ? 'excellent' : 'good';
      sound('correct');
    } else {
      tm.result = 'bad';
      sound('wrong');
      setTimeout(() => { if (S.tryMode === tm) refreshBoard(false); }, 900);
    }
    renderStep();
  }

  /* ----- Tab Analysis ----- */
  function renderEngineLines() {
    const box = $('#engine-lines');
    const fen = currentFen();
    const L = S.live && S.live.fen === fen ? S.live : null;
    const c = new Chess(fen);
    if (c.isGameOver()) {
      box.innerHTML = `<div class="muted" style="padding:6px 0">${c.isCheckmate() ? I.t('checkmate') : I.t('draw')}</div>`;
      $('#eng-eval').textContent = c.isCheckmate() ? (c.turn() === 'w' ? '0-1' : '1-0') : '½-½';
      return;
    }
    if (!$('#engine-toggle').checked) { box.innerHTML = ''; $('#eng-depth').textContent = ''; return; }
    if (S.analyzing) { box.innerHTML = `<div class="muted" style="padding:6px 0">${I.t('analyzing')}</div>`; return; }
    if (!L || !L.lines.length) {
      if (S.report && !S.variation && S.report.evals[S.ply].lines.length) {
        const e = S.report.evals[S.ply];
        box.innerHTML = e.lines.map((l) => lineHtml(l.white, l.pv, fen)).join('');
        setEngEval(e.white, e.depth);
        bindLines(fen);
        return;
      }
      if (S.engine) box.innerHTML = `<div class="muted" style="padding:6px 0">${I.t('loading')}</div>`;
      else if (S.engineErr && !S.enginePromise) {
        box.innerHTML = engineErrorHtml();
        const rb = $('#eng-retry');
        if (rb) rb.onclick = () => { S.engineErr = null; renderEngineLines(); getEngine().then(() => { if (S.tab === 'analysis') liveAnalyze(); renderEngineLines(); }).catch(() => renderEngineLines()); };
      } else box.innerHTML = engineLoadingHtml();
      return;
    }
    const turn = fen.split(' ')[1];
    box.innerHTML = L.lines.map((l) => lineHtml(Analyzer.lineToWhite(l, turn), l.pv, fen)).join('');
    setEngEval(Analyzer.lineToWhite(L.lines[0], turn), L.depth);
    bindLines(fen);
  }
  function setEngEval(ev, depth) {
    const e = $('#eng-eval');
    e.textContent = fmtEval(ev);
    e.classList.toggle('neg', !evalWhiteIsAhead(ev));
    $('#eng-depth').textContent = `${I.t('depth').toLowerCase()} ${depth || 0}`;
  }
  function lineHtml(ev, pv, fen) {
    return `<div class="eline" data-pv="${pv.slice(0, 12).join(' ')}"><span class="sc ${evalWhiteIsAhead(ev) ? '' : 'neg'}">${fmtEval(ev)}</span><span class="pv">${esc(pvToSan(fen, pv, 12))}</span></div>`;
  }
  function bindLines(fen) {
    $$('.eline').forEach((el) => (el.onclick = () => {
      const pv = el.dataset.pv.split(' ');
      const c = new Chess(fen);
      let mv;
      try { mv = c.move({ from: pv[0].slice(0, 2), to: pv[0].slice(2, 4), promotion: pv[0][4] }); } catch (e) { return; }
      onBoardMove(mv.from, mv.to, mv.promotion);
    }));
  }

  function renderAnalysis() {
    renderEngineLines();
    const g = S.game, r = S.report;
    // nama pembukaan
    let op = '';
    if (g) {
      const upto = S.variation ? S.variation.base : S.ply;
      for (let i = upto; i >= 0; i--) {
        const b = window.OPENING_BOOK[g.positions[i].fen.split(' ').slice(0, 2).join(' ')];
        if (typeof b === 'string') { op = b.replace('|', ' · '); break; }
      }
    }
    $('#opening-name').textContent = op;
    const ml = $('#move-list');
    if (!g || !g.moves.length) { ml.innerHTML = ''; }
    else {
      let h = '';
      const startBlack = g.moves[0].color === 'b';
      let n = parseInt(g.positions[0].fen.split(' ')[5], 10) || 1;
      let i = 0;
      let row = 0;
      while (i < g.moves.length) {
        const odd = row % 2 ? 'row-odd' : '';
        h += `<div class="num ${odd}">${n}.</div>`;
        if (i === 0 && startBlack) h += `<div class="mv ${odd}"></div>`;
        else { h += mvHtml(i, odd); i++; }
        if (i < g.moves.length && g.moves[i].color === 'b') { h += mvHtml(i, odd); i++; }
        else h += `<div class="mv ${odd}"></div>`;
        n++;
        row++;
      }
      ml.innerHTML = h;
      $$('.mv[data-ply]', ml).forEach((el) => (el.onclick = () => goto(parseInt(el.dataset.ply, 10))));
      const cur = $('.mv.cur', ml);
      if (cur && S.tab === 'analysis') {
        const pb = $('#panel-body');
        const top = cur.offsetTop, bh = pb.clientHeight;
        if (top < pb.scrollTop + 60 || top > pb.scrollTop + bh - 60) pb.scrollTop = top - bh / 2;
      }
    }
    function mvHtml(i, odd) {
      const m = g.moves[i];
      const rm = r && r.moves[i];
      const ic = rm && !['good', 'excellent', 'book', 'forced'].includes(rm.cls) ? icon(rm.cls, 16) : rm && rm.cls === 'book' ? icon('book', 16) : '';
      const ev = r ? `<span class="ev">${fmtEval(r.evals[i + 1].white, true)}</span>` : '';
      return `<div class="mv ${odd} ${i + 1 === S.ply && !S.variation ? 'cur' : ''}" data-ply="${i + 1}">${ic}<span>${esc(m.san)}</span>${ev}</div>`;
    }
    const vb = $('#var-box');
    if (S.variation && S.variation.list.length) {
      const v = S.variation;
      vb.classList.remove('hidden');
      vb.innerHTML = `<div class="vt"><span>${I.t('variation')}</span><button class="icon-btn" id="var-x">✕</button></div>` + v.list.map((x, i) => `<span class="vm ${i === v.idx ? 'cur' : ''}" data-i="${i}">${esc(x.san)}</span>`).join(' ');
      $('#var-x').onclick = exitVariation;
      $$('.vm', vb).forEach((el) => (el.onclick = () => { v.idx = parseInt(el.dataset.i, 10); refreshBoard(false); renderAll(); liveAnalyze(); }));
    } else vb.classList.add('hidden');
  }

  /* ---------- Muat & analisis ---------- */
  async function loadGame(game, opts) {
    opts = opts || {};
    stopPlay();
    if (S.analyzing) { S.cancel = true; S.engine && S.engine.stop(); await new Promise((r) => setTimeout(r, 120)); }
    S.game = game;
    if (opts.official) game.ccAccuracy = opts.official;
    S.report = opts.report || null;
    if (S.report && window.Official) window.Official.apply(S.report, game);
    S.variation = null;
    S.tryMode = null;
    S.ply = 0;
    S.live = null;
    prefetchAvatars(game);
    // akurasi resmi Chess.com untuk PGN dari Chess.com (dicari di arsip API; tidak menunda analisis)
    if (window.Official && !game.ccAccuracy) {
      window.Official.fetchAccuracy(game.headers).then((acc) => {
        if (!acc || S.game !== game) return;
        game.ccAccuracy = acc;
        if (S.report) { window.Official.apply(S.report, game); saveRecent(game, S.report); renderAll(); }
      });
    }   // foto profil: tampil langsung bila sudah tersimpan, kalau belum diambil sekarang
    // orientasi: jika username dicari, tampilkan dari sisi pemain
    const me = (localStorage.getItem('cr_user') || '').toLowerCase();
    board.setOrientation(me && (game.headers.Black || '').toLowerCase() === me ? 'b' : 'w');
    refreshBoard(false);
    if (!game.moves.length) {
      setTab('analysis');
      return;
    }
    if (S.report) {
      S.view = 'summary';
      setTab('review');
      return;
    }
    setTab('review');
    await runAnalysis();
  }
  function stopPlay() { if (S.playing) { clearTimeout(S.playing); S.playing = null; updatePlayBtn(); } }

  async function runAnalysis() {
    const game = S.game;
    S.analyzing = true;
    S.cancel = false;
    S.liveToken++;
    setReviewView('progress');
    $('#progress-label').textContent = I.t('loadingEngine');
    $('.progress-fill').style.width = '0%';
    $('#progress-pct').textContent = '0%';
    let eng;
    try { eng = await getEngine(); } catch (e) {
      S.analyzing = false;
      setReviewView('empty');
      return;
    }
    eng.stop();
    $('#review-progress .progress-fill').classList.remove('indet');
    $('#progress-label').textContent = I.t('analyzing');
    const depth = parseInt(S.settings.depth, 10) || 15;
    $('#progress-depth').textContent = `${I.t('depth')} ${depth}`;
    const t0 = Date.now();
    const report = await Analyzer.analyzeGame(game, eng, {
      depth,
      cancelled: () => S.cancel || S.game !== game,
      onProgress: (p) => {
        const pct = Math.round(p * 100);
        $('.progress-fill').style.width = pct + '%';
        const el = (Date.now() - t0) / 1000;
        const eta = p > 0.02 ? Math.max(0, Math.round(el / p - el)) : null;
        $('#progress-pct').textContent = pct + '%' + (eta !== null ? ` · ~${eta}s` : '');
      }
    });
    S.analyzing = false;
    if (!report || S.game !== game) {
      if (S.game === game) setReviewView(S.report ? 'summary' : 'empty');
      return;
    }
    if (window.Official) window.Official.apply(report, game);   // tanda & akurasi resmi Chess.com bila tersedia
    S.report = report;
    S.view = 'summary';
    sound('end');
    saveRecent(game, report);
    goto(0);
    renderAll();
  }

  /* ---------- Riwayat ---------- */
  function loadRecent() {
    try { return JSON.parse(localStorage.getItem('cr_recent') || '[]'); } catch (e) { return []; }
  }
  function saveRecent(game, report) {
    const list = loadRecent().filter((x) => x.pgn !== game.pgn);
    const item = {
      id: Date.now(), pgn: game.pgn, white: game.headers.White, black: game.headers.Black, result: game.headers.Result,
      accW: report.accuracy.w, accB: report.accuracy.b, official: !!report.officialAccuracy, date: new Date().toISOString().slice(0, 10)
    };
    list.unshift(item);
    while (list.length > 30) list.pop();
    try {
      localStorage.setItem('cr_recent', JSON.stringify(list));
      const slim = Object.assign({}, report, { evals: report.evals.map((e) => ({ white: e.white, lines: e.lines.map((l) => ({ white: l.white, pv: l.pv.slice(0, 10), move: l.move })), best: e.best, depth: e.depth, terminal: e.terminal })) });
      const cache = JSON.parse(localStorage.getItem('cr_reports') || '{}');
      cache[item.id] = slim;
      const keys = Object.keys(cache).sort((a, b) => b - a);
      keys.slice(8).forEach((k) => delete cache[k]);
      localStorage.setItem('cr_reports', JSON.stringify(cache));
    } catch (e) {
      try { localStorage.removeItem('cr_reports'); } catch (_) {}
    }
  }
  const accTxt = (x, k) => (x[k] == null ? '—' : x.official && window.Official ? window.Official.display(x[k]) : x[k].toFixed(1));
  function renderRecent() {
    const list = loadRecent();
    const box = $('#recent-list');
    if (!list.length) { box.innerHTML = `<div class="muted">${I.t('noRecent')}</div>`; return; }
    box.innerHTML = list.map((x) => `<div class="recent-item" data-id="${x.id}">
      <div><div><b>${esc(x.white || '?')}</b> ${I.t('vs')} <b>${esc(x.black || '?')}</b> <span class="muted">${esc(x.result || '')}</span></div>
      <div class="acc">${I.t('accuracy')}: ${accTxt(x, 'accW')} / ${accTxt(x, 'accB')} · ${x.date}</div></div>
      <button class="x" data-del="${x.id}" title="${I.t('delete')}">✕</button></div>`).join('');
    $$('.recent-item', box).forEach((el) => (el.onclick = (e) => {
      const id = el.dataset.id;
      if (e.target.dataset.del) {
        localStorage.setItem('cr_recent', JSON.stringify(loadRecent().filter((x) => String(x.id) !== id)));
        renderRecent();
        return;
      }
      const item = loadRecent().find((x) => String(x.id) === id);
      if (!item) return;
      let rep = null;
      try { rep = JSON.parse(localStorage.getItem('cr_reports') || '{}')[id] || null; } catch (_) {}
      try { loadGame(parsePgn(item.pgn), { report: rep }); } catch (err) { toast(err.message); }
    }));
  }

  /* ---------- Chess.com API ---------- */
  async function fetchJson(url) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } catch (e) {
      // fallback lewat proxy server (jika dijalankan di Cloudflare/Hono)
      const r = await fetch('api/chesscom?url=' + encodeURIComponent(url));
      if (!r.ok) throw e;
      return await r.json();
    }
  }
  async function fetchArchives() {
    const u = $('#inp-user').value.trim().toLowerCase();
    if (!u) return;
    localStorage.setItem('cr_user', u);
    const gl = $('#games-list');
    gl.innerHTML = `<div class="muted">${I.t('loading')}</div>`;
    try {
      const d = await fetchJson(`https://api.chess.com/pub/player/${encodeURIComponent(u)}/games/archives`);
      const arcs = (d.archives || []).slice().reverse();
      if (!arcs.length) { gl.innerHTML = `<div class="muted">${I.t('noGames')}</div>`; return; }
      const sel = $('#sel-month');
      sel.innerHTML = arcs.map((a) => { const p = a.split('/'); return `<option value="${a}">${p[p.length - 2]}-${p[p.length - 1]}</option>`; }).join('');
      $('#month-row').classList.remove('hidden');
      sel.onchange = () => fetchMonth(sel.value, u);
      await fetchMonth(arcs[0], u);
      loadAvatar(u);   // foto profil sendiri disiapkan setelah daftar partai tampil (tidak paralel)
    } catch (e) {
      gl.innerHTML = `<div class="muted">${I.t('fetchFail')}</div>`;
    }
  }
  async function fetchMonth(url, u) {
    const gl = $('#games-list');
    gl.innerHTML = `<div class="muted">${I.t('loading')}</div>`;
    try {
      const d = await fetchJson(url);
      const games = (d.games || []).filter((g) => g.pgn && (!g.rules || g.rules === 'chess')).reverse();
      if (!games.length) { gl.innerHTML = `<div class="muted">${I.t('noGames')}</div>`; return; }
      S.fetched = games;
      gl.innerHTML = games.map((g, i) => {
        const meW = g.white.username.toLowerCase() === u;
        const me = meW ? g.white : g.black;
        const res = me.result === 'win' ? 'win' : ['agreed', 'repetition', 'stalemate', 'insufficient', '50move', 'timevsinsufficient'].includes(me.result) ? 'draw' : 'loss';
        const dt = g.end_time ? new Date(g.end_time * 1000).toLocaleDateString() : '';
        const tc = (g.time_class || '').replace('bullet', '⚡ bullet').replace('blitz', '⚡ blitz').replace('rapid', '⏱ rapid').replace('daily', '☀ daily');
        return `<div class="g-item" data-i="${i}"><div class="tc">${esc(tc)}</div><div class="pl"><div>⬜ ${esc(g.white.username)} <span class="r">(${g.white.rating})</span></div><div>⬛ ${esc(g.black.username)} <span class="r">(${g.black.rating})</span></div></div><div class="res ${res}">${res === 'win' ? '1' : res === 'draw' ? '½' : '0'}</div><div class="dt">${dt}</div></div>`;
      }).join('');
      $$('.g-item', gl).forEach((el) => (el.onclick = () => {
        const g = S.fetched[parseInt(el.dataset.i, 10)];
        try {
          const off = window.Official ? window.Official.fromApiGame(g) : null;
          if (window.Official && off) window.Official.remember(String(g.url || '').split('/').pop(), off);
          loadGame(parsePgn(g.pgn), { official: off });
        } catch (e) { toast(e.message); }
      }));
    } catch (e) {
      gl.innerHTML = `<div class="muted">${I.t('fetchFail')}</div>`;
    }
  }

  const SAMPLE = `[Event "Live Chess"]
[Site "Chess.com"]
[Date "2023.01.01"]
[White "Magnus"]
[Black "Opponent"]
[Result "1-0"]
[WhiteElo "2850"]
[BlackElo "2700"]
[TimeControl "180"]

1. e4 {[%clk 0:03:00]} e5 {[%clk 0:02:59]} 2. Nf3 {[%clk 0:02:58]} Nc6 {[%clk 0:02:57]} 3. Bc4 {[%clk 0:02:56]} Nd4 {[%clk 0:02:54]} 4. Nxe5 {[%clk 0:02:50]} Qg5 {[%clk 0:02:50]} 5. Nxf7 {[%clk 0:02:40]} Qxg2 {[%clk 0:02:48]} 6. Rf1 {[%clk 0:02:35]} Qxe4+ {[%clk 0:02:45]} 7. Be2 {[%clk 0:02:30]} Nf3# {[%clk 0:02:44]} 0-1`;
  const SAMPLE2 = `[Event "Opera Game"]
[Site "Paris"]
[Date "1858.??.??"]
[White "Paul Morphy"]
[Black "Duke Karl / Count Isouard"]
[Result "1-0"]
[WhiteElo "2600"]
[BlackElo "1800"]

1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0`;
  void SAMPLE;

  /* ---------- Papan & bidak (aset Chess.com) ---------- */
  function chooseBoard(id) {
    S.settings.board = id; saveSettings();
    window.ChessAssets.applyBoard(id);
    renderAssetPickers();
  }
  function choosePieces(id) {
    window.ChessAssets.preloadPieces(id).then(() => {      // muat dulu agar tidak berkedip
      S.settings.pieces = id; saveSettings();
      window.ChessAssets.setPieces(id);
      renderAssetPickers();
      refreshBoard(false);
      updatePlayers();
    });
  }
  function renderAssetPickers() {
    const A = window.ChessAssets;
    if (!A || !$('#board-strip')) return;
    const fill = (sel, items, mk, current, onPick, nameSel) => {
      const el = $(sel);
      if (el.dataset.n !== String(items.length)) {
        el.innerHTML = items.map(mk).join('');
        el.dataset.n = String(items.length);
        el.onclick = (e) => { const b = e.target.closest('.pick-item'); if (b) onPick(b.dataset.id); };
      }
      let name = '';
      el.querySelectorAll('.pick-item').forEach((b) => { const on = b.dataset.id === current; b.classList.toggle('active', on); if (on) name = b.title; });
      const ne = $(nameSel); if (ne) ne.textContent = name;
    };
    fill('#board-strip', A.state.boards, (b) => `<button class="pick-item" data-id="${esc(b.id)}" title="${esc(b.name)}" aria-label="${esc(b.name)}" style="background-image:url(${A.thumbUrl(b)})"></button>`, A.boardEntry(S.settings.board).id, chooseBoard, '#board-name');
    fill('#piece-strip', A.state.pieces, (p) => `<button class="pick-item pc-item" data-id="${esc(p.id)}" title="${esc(p.name)}" aria-label="${esc(p.name)}" style="background-image:url(${A.pieceUrl('wN', p.id)})"></button>`, A.pieceEntry(S.settings.pieces).id, choosePieces, '#piece-name');
  }

  /* ---------- Pengaturan ---------- */
  function applySettings() {
    document.body.dataset.theme = '';
    if (window.ChessAssets) { window.ChessAssets.applyBoard(S.settings.board); window.ChessAssets.setPieces(S.settings.pieces); }
    renderAssetPickers();
    $('#set-depth').value = String(S.settings.depth);
    if ($('#set-engine')) $('#set-engine').value = S.settings.engine === 'full' ? 'full' : 'lite';
    $('#set-lang').value = I.lang;
    $('#set-sound').checked = !!S.settings.sound;
    $('#set-arrows').checked = !!S.settings.arrows;
    $('#set-speed').value = String(playMs() / 1000);
    $('#legend').innerHTML = Object.keys(window.CLS).map((k) => `<div>${icon(k, 20)}<span>${I.clsName(k)}</span></div>`).join('');
  }

  /* ---------- Init ---------- */
  function init() {
    renderIcons(document);
    $$('.coach-avatar').forEach((el) => (el.innerHTML = window.UI_ICONS.coach));
    board = new Board($('#board'), { legalFor, onMove: onBoardMove });
    applySettings();
    applyI18n();
    refreshBoard(false);
    setReviewView('empty');

    $$('.ptab, .nav-item[data-tab]').forEach((b) => (b.onclick = () => setTab(b.dataset.tab)));
    $('#btn-goto-games').onclick = () => setTab('games');
    $('#btn-sample').onclick = $('#btn-sample2').onclick = () => loadGame(parsePgn(SAMPLE2));
    $('#btn-load').onclick = () => {
      try { loadGame(parsePgn($('#inp-pgn').value)); } catch (e) { toast(I.t('invalidPgn') + ': ' + e.message); }
    };
    $('#inp-file').onchange = (e) => {
      const f = e.target.files[0];
      if (!f) return;
      const rd = new FileReader();
      rd.onload = () => { $('#inp-pgn').value = rd.result; try { loadGame(parsePgn(rd.result)); } catch (er) { toast(I.t('invalidPgn')); } };
      rd.readAsText(f);
      e.target.value = '';
    };
    $('#btn-fen').onclick = () => {
      try { loadGame(gameFromFen($('#inp-fen').value || DEFAULT_FEN)); } catch (e) { toast(I.t('invalidFen')); }
    };
    $('#btn-fetch').onclick = fetchArchives;
    $('#inp-user').addEventListener('keydown', (e) => { if (e.key === 'Enter') fetchArchives(); });
    $('#inp-user').value = localStorage.getItem('cr_user') || '';
    $('#btn-cancel').onclick = () => { S.cancel = true; S.engine && S.engine.stop(); };
    $('#engine-toggle').onchange = () => {
      if (!$('#engine-toggle').checked) { S.liveToken++; S.liveArrow = null; S.engine && S.engine.stop(); refreshBoard(false); }
      renderEngineLines();
      liveAnalyze();
    };

    $('#c-flip').onclick = () => { board.flip(); refreshBoard(false); };
    $('#c-first').onclick = () => { stopPlay(); if (S.variation) exitVariation(); else goto(0); };
    $('#c-prev').onclick = () => { stopPlay(); step(-1); };
    $('#c-next').onclick = () => { stopPlay(); if (S.view === 'summary' && S.tab === 'review') S.view = 'step'; step(1); };
    $('#c-last').onclick = () => { stopPlay(); if (S.game) { if (S.view === 'summary') S.view = 'step'; goto(S.game.moves.length); } };
    $('#c-play').onclick = togglePlay;
    document.addEventListener('keydown', (e) => {
      if (/input|textarea|select/i.test(e.target.tagName)) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); $('#c-next').click(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); $('#c-prev').click(); }
      else if (e.key === 'Home' || e.key === 'ArrowUp') { e.preventDefault(); $('#c-first').click(); }
      else if (e.key === 'End' || e.key === 'ArrowDown') { e.preventDefault(); $('#c-last').click(); }
      else if (e.key === 'f' || e.key === 'F') $('#c-flip').click();
      else if (e.key === ' ') { e.preventDefault(); togglePlay(); }
    });

    const openModal = () => {
      applySettings(); $('#modal').classList.remove('hidden');
      ['#board-strip', '#piece-strip'].forEach((s) => { const a = $(s) && $(s).querySelector('.active'); if (a && a.scrollIntoView) { try { a.scrollIntoView({ inline: 'center', block: 'nearest' }); } catch (e) {} } });
    };
    $('#btn-settings').onclick = $('#nav-settings').onclick = openModal;
    $('#modal-close').onclick = () => $('#modal').classList.add('hidden');
    $('#modal').onclick = (e) => { if (e.target.id === 'modal') $('#modal').classList.add('hidden'); };
    $('#set-depth').onchange = (e) => { S.settings.depth = parseInt(e.target.value, 10); saveSettings(); };
    $('#set-engine').onchange = (e) => {
      const next = e.target.value === 'full' ? 'full' : 'lite';
      if (S.analyzing) { toast(I.t('engineBusy')); e.target.value = S.settings.engine; return; }
      S.settings.engine = next; saveSettings();
      [S.engine, S.engineLoading].forEach((x) => { if (x && x.dispose) { try { x.dispose(); } catch (err) {} } });
      S.engine = null; S.engineLoading = null; S.enginePromise = null; S.engineErr = null; S.liveToken++;
      toast(I.t('engineChanged'));
      renderEngineLines();
      getEngine().then(() => { if (S.tab === 'analysis') liveAnalyze(); renderEngineLines(); }).catch(() => renderEngineLines());
    };
    $('#set-sound').onchange = (e) => { S.settings.sound = e.target.checked; saveSettings(); };
    $('#set-arrows').onchange = (e) => { S.settings.arrows = e.target.checked; saveSettings(); refreshBoard(false); };
    $('#set-speed').onchange = (e) => { S.settings.playSpeed = parseInt(e.target.value, 10); saveSettings(); };
    $('#set-lang').onchange = (e) => { I.setLang(e.target.value); applyI18n(); applySettings(); renderAll(); setTab(S.tab); };

    // daftar papan/bidak dari manifest (img/boards/boards.json, img/pieces/pieces.json), lalu terapkan ulang pilihan tersimpan
    if (window.ChessAssets) window.ChessAssets.load().then(() => { applySettings(); refreshBoard(false); updatePlayers(); }).catch(() => {});

    // muat engine di latar belakang (progres unduhan tampil via Engine.onLoad)
    Engine.onLoad(onEngineLoad);
    getEngine().then(() => { if (S.tab === 'analysis') liveAnalyze(); renderEngineLines(); }).catch(() => renderEngineLines());

    // ?pgn=... atau #fen=...
    const qs = new URLSearchParams(location.search);
    if (qs.get('pgn')) { try { loadGame(parsePgn(qs.get('pgn'))); } catch (e) { toast(I.t('invalidPgn')); } }
    else if (qs.get('fen')) { try { loadGame(gameFromFen(qs.get('fen'))); } catch (e) { toast(I.t('invalidFen')); } }
    window.addEventListener('resize', () => updateEvalBar());
    window.__APP = { S, loadGame, parsePgn, goto, SAMPLE2 };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();