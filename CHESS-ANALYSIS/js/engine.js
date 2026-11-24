/* Wrapper Stockfish (WASM, Web Worker) dengan antrian job dan MultiPV. Nama/berkas engine: js/engine-config.js */
(function () {
  class Engine {
    constructor(path) {
      this.path = path || Engine.pathFor('full');
      this.profile = /lite/i.test(this.path) ? 'lite' : 'full';   // dipakai analyzer.js untuk memilih konstanta akurasi
      this.ready = false;
      this.job = null;
      this.queue = [];
      this.listeners = [];
      this.readyPromise = new Promise((resolve, reject) => {
        let worker;
        try {
          worker = new Worker(this.path);
        } catch (e) {
          reject(e);
          return;
        }
        this.worker = worker;
        let timer;
        const arm = (ms, msg) => {
          clearTimeout(timer);
          timer = setTimeout(() => {
            Engine._setLoad({ phase: 'error' });
            reject(new Error(msg));
          }, ms);
        };
        this._arm = arm;
        this._reject = reject;
        this._disarm = () => clearTimeout(timer);
        arm(90000, 'Engine timeout (90 dtk): file .wasm terlalu lama dimuat');
        Engine._setLoad({ phase: 'download', percent: 0, loaded: 0, total: 0, speed: 0, eta: 0 });
        worker.onerror = (e) => {
          if (e && e.preventDefault) e.preventDefault();
          clearTimeout(timer);
          Engine._setLoad({ phase: 'error' });
          reject(new Error(e.message || 'Engine gagal dimuat'));
        };
        worker.onmessage = (e) => this.onLine(String(e.data));
        this._onUciOk = () => {
          clearTimeout(timer);
          this.send('setoption name Hash value 32');
          this.send('isready');
        };
        this._onReadyOk = () => {
          if (!this.ready) {
            this.ready = true;
            Engine._setLoad({ phase: 'ready', percent: 1 });
            resolve(this);
          }
        };
        // minta wrapper melaporkan progres unduhan .wasm (dijawab lewat onLine)
        worker.postMessage('setoption name CanOutputEngineDownloadProgress');
        this.send('uci');
      });
    }

    send(cmd) {
      this.worker && this.worker.postMessage(cmd);
    }

    // dipakai app.js saat pengguna berganti engine (Lite <-> Full)
    dispose() {
      const wasReady = this.ready;
      this.disposed = true;
      this.ready = false;
      if (this._disarm) this._disarm();
      if (!wasReady && this._reject) this._reject(new Error('Engine dibuang'));
      this.queue.forEach((q) => q.resolve(null));
      this.queue = [];
      if (this.job) { this.job.resolve(null); this.job = null; }
      if (this._progressCh) { try { this._progressCh.port1.close(); } catch (e) {} this._progressCh = null; }
      if (this.worker) { try { this.worker.terminate(); } catch (e) {} this.worker = null; }
    }

    // dipanggil setelah wrapper menjawab bahwa ia mendukung laporan progres
    _setupProgress() {
      if (this._progressOn || typeof MessageChannel === 'undefined') return;
      this._progressOn = true;
      const ch = new MessageChannel();
      this._progressCh = ch;
      ch.port1.onmessage = (ev) => {
        if (this.ready) return;
        const p = ev.data || {};
        const percent = Math.max(0, Math.min(1, p.percent || 0));
        if (percent >= 1) {
          // unduhan selesai -> kompilasi WebAssembly & inisialisasi
          Engine._setLoad({ phase: 'init', percent: 1, loaded: p.loaded || 0, total: p.total || 0, speed: 0, eta: 0 });
          this._arm(90000, 'Engine timeout: inisialisasi lebih dari 90 dtk');
        } else {
          Engine._setLoad({ phase: 'download', percent, loaded: p.loaded || 0, total: p.total || 0, speed: p.speedBytesPerSec || 0, eta: p.eta || 0 });
          // selama data masih mengalir, jangan anggap timeout
          this._arm(60000, 'Engine timeout: unduhan .wasm berhenti selama 60 dtk');
        }
      };
      this.worker.postMessage({ progressPort: ch.port2 }, [ch.port2]);
    }

    onLine(line) {
      if (line.startsWith('id name ')) { this.engineName = line.slice(8).trim(); return; }
      if (line === 'info WillOutputEngineDownloadProgress') return this._setupProgress();
      if (line === 'uciok') return this._onUciOk && this._onUciOk();
      if (line === 'readyok') {
        if (!this.ready) return this._onReadyOk();
        if (this.job && this.job.waitReady) {
          this.job.waitReady = false;
          this.startJob();
        }
        return;
      }
      const j = this.job;
      if (!j || j.waitReady) return;
      if (line.startsWith('info') && line.includes(' pv ') && line.includes(' score ')) {
        if (line.includes('lowerbound') || line.includes('upperbound')) return;
        const tok = line.split(' ');
        const get = (k) => {
          const i = tok.indexOf(k);
          return i >= 0 ? tok[i + 1] : null;
        };
        const depth = parseInt(get('depth'), 10);
        const mpv = parseInt(get('multipv') || '1', 10);
        const si = tok.indexOf('score');
        const type = tok[si + 1];
        const val = parseInt(tok[si + 2], 10);
        const pv = tok.slice(tok.indexOf('pv') + 1);
        const ln = { depth, multipv: mpv, pv };
        if (type === 'cp') ln.cp = val;
        else ln.mate = val;
        if (depth < j.lastDepth && mpv === 1) j.lines = [];
        j.lastDepth = depth;
        j.lines[mpv - 1] = ln;
        if (j.onInfo && mpv === Math.min(j.multipv, j.lines.length)) j.onInfo(j.lines.filter(Boolean), depth);
      } else if (line.startsWith('bestmove')) {
        const bm = line.split(' ')[1];
        this.job = null;
        if (!j.cancelled) j.resolve({ lines: j.lines.filter(Boolean), bestmove: bm === '(none)' ? null : bm, depth: j.lastDepth });
        else j.resolve(null);
        this.next();
      }
    }

    analyze(fen, opts) {
      opts = opts || {};
      return new Promise((resolve) => {
        const job = { fen, depth: opts.depth || 14, movetime: opts.movetime, multipv: opts.multipv || 1, onInfo: opts.onInfo, resolve, lines: [], lastDepth: 0, cancelled: false };
        if (opts.exclusive) {
          // batalkan semua job sebelumnya
          this.queue.forEach((q) => q.resolve(null));
          this.queue = [];
          if (this.job) {
            this.job.cancelled = true;
            this.send('stop');
          }
        }
        this.queue.push(job);
        if (!this.job) this.next();
      });
    }

    stop() {
      this.queue.forEach((q) => q.resolve(null));
      this.queue = [];
      if (this.job) {
        this.job.cancelled = true;
        this.send('stop');
      }
    }

    next() {
      if (this.job || !this.queue.length) return;
      this.job = this.queue.shift();
      this.job.waitReady = true;
      this.send('setoption name MultiPV value ' + this.job.multipv);
      this.send('isready');
    }

    startJob() {
      const j = this.job;
      this.send('position fen ' + j.fen);
      if (j.movetime) this.send('go movetime ' + j.movetime);
      else if (j.infinite) this.send('go infinite');
      else this.send('go depth ' + j.depth);
    }

    newGame() {
      this.send('ucinewgame');
    }
  }

  /* Status pemuatan engine (statis) + pendengar, dipakai UI untuk progress bar */
  Engine.load = { phase: 'idle', percent: 0, loaded: 0, total: 0, speed: 0, eta: 0 };
  Engine._listeners = [];
  Engine.onLoad = function (fn) {
    Engine._listeners.push(fn);
    try { fn(Engine.load); } catch (e) { console.error(e); }
  };
  Engine._setLoad = function (patch) {
    Engine.load = Object.assign({}, Engine.load, patch);
    Engine._listeners.forEach((fn) => { try { fn(Engine.load); } catch (e) { console.error(e); } });
  };

  /* Pilihan engine di Pengaturan: 'lite' (±2 MB) atau 'full' (±99 MB) */
  Engine.pathFor = function (kind) {
    const C = window.ENGINE_CONFIG;
    if (C && C.full && C.lite) return kind === 'full' ? C.full.js : C.lite.js;
    return kind === 'full' ? 'engine/stockfish-19-single.js' : 'engine/stockfish-19-lite-single.js';   // cadangan
  };

  window.Engine = Engine;
})();