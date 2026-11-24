/* Aset Chess.com: papan, set bidak. Daftar dibaca dari img/boards/boards.json dan img/pieces/pieces.json.
   Aset adalah milik Chess.com; dipakai hanya untuk keperluan pribadi. */
(function () {
  'use strict';
  var DEFAULTS = { board: '9rdwe', pieces: 'ejgfv' };      // bawaan Chess.com: papan "Green", bidak "Neo"
  var FALLBACK = { boards: [{ id: '9rdwe', name: 'Green', file: '9rdwe.png', light: '#ebecd0', dark: '#739552' }], pieces: [{ id: 'ejgfv', name: 'Neo' }] };
  var state = { boards: FALLBACK.boards.slice(), pieces: FALLBACK.pieces.slice(), pieceId: DEFAULTS.pieces, loaded: false };
  var PIECE_CODES = ['wp', 'wn', 'wb', 'wr', 'wq', 'wk', 'bp', 'bn', 'bb', 'br', 'bq', 'bk'];

  // daftar terakhir disimpan di localStorage supaya papan/bidak pilihan langsung benar saat halaman dibuka
  try {
    var cached = JSON.parse(localStorage.getItem('cr_assets') || 'null');
    if (cached && cached.boards && cached.boards.length && cached.pieces && cached.pieces.length) { state.boards = cached.boards; state.pieces = cached.pieces; }
  } catch (e) {}

  function abs(path) {
    var base = typeof document !== 'undefined' && document.baseURI ? document.baseURI : 'http://localhost/';
    try { return new URL(path, base).href; } catch (e) { return path; }
  }
  function pieceUrl(p, id) { return 'img/pieces/' + (id || state.pieceId) + '/' + p[0] + String(p[1]).toLowerCase() + '.png'; }   // p = "wP", "bN", ...
  function isTall(id) { return /^3d_/.test(String(id)); }                                  // set 3D: gambar 150x156 (sedikit lebih tinggi)
  function boardEntry(id) { return state.boards.filter(function (b) { return b.id === id; })[0] || state.boards.filter(function (b) { return b.id === DEFAULTS.board; })[0] || state.boards[0]; }
  function pieceEntry(id) { return state.pieces.filter(function (p) { return p.id === id; })[0] || state.pieces.filter(function (p) { return p.id === DEFAULTS.pieces; })[0] || state.pieces[0]; }
  function boardUrl(e) { return 'img/boards/' + e.file; }
  function thumbUrl(e) { return 'img/boards/thumbs/' + e.id + '.webp'; }

  function getJson(url) {
    return Promise.resolve().then(function () { return fetch(url); }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
  }
  function load() {
    return Promise.all([getJson('img/boards/boards.json').catch(function () { return null; }), getJson('img/pieces/pieces.json').catch(function () { return null; })]).then(function (r) {
      if (r[0] && r[0].length) state.boards = r[0];
      if (r[1] && r[1].length) state.pieces = r[1];
      if (r[0] && r[1]) { state.loaded = true; try { localStorage.setItem('cr_assets', JSON.stringify({ boards: state.boards, pieces: state.pieces })); } catch (e) {} }
      return state;
    });
  }

  // papan bergambar: gambar 8x8 jadi latar .board, kotak dibuat transparan lewat CSS (body.img-board)
  function applyBoard(id, body) {
    var e = boardEntry(id); body = body || document.body;
    body.classList.add('img-board');
    body.style.setProperty('--board-img', 'url(' + abs(boardUrl(e)) + ')');
    body.style.setProperty('--light', e.light); body.style.setProperty('--dark', e.dark);
    body.style.setProperty('--coord-l', e.dark); body.style.setProperty('--coord-d', e.light);      // koordinat: warna kotak lawannya
    return e;
  }
  function setPieces(id, body) {
    var e = pieceEntry(id); body = body || document.body;
    state.pieceId = e.id;
    body.style.setProperty('--pc-bg', isTall(e.id) ? '100% 100%' : '100%');
    return e;
  }
  function preloadPieces(id) {
    return Promise.all(PIECE_CODES.map(function (c) {
      return new Promise(function (res) { var i = new Image(); i.onload = i.onerror = function () { res(); }; i.src = 'img/pieces/' + id + '/' + c + '.png'; });
    }));
  }
  window.ChessAssets = { DEFAULTS: DEFAULTS, state: state, PIECE_CODES: PIECE_CODES, pieceUrl: pieceUrl, isTall: isTall, boardEntry: boardEntry, pieceEntry: pieceEntry, boardUrl: boardUrl, thumbUrl: thumbUrl, load: load, applyBoard: applyBoard, setPieces: setPieces, preloadPieces: preloadPieces };
})();
