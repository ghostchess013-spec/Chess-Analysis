#!/usr/bin/env python3
"""
Bangun js/openings.js = nama pembukaan Lichess (CC0) + perluasan kedalaman dari buku Polyglot.

Pemakaian:
  pip install chess
  python3 build_book_merged.py <folder a.tsv..e.tsv> <folder gm2001.bin, Elo2400.bin, KomodoVariety.bin> <hasil openings.js>

Sumber:
  - https://github.com/lichess-org/chess-openings            (a.tsv .. e.tsv; CC0)
  - https://github.com/ChrisWhittington/polyglot-books        (Releases: gm2001.zip, Elo2400.zip, KomodoVariety.zip)
"""
import re, sys, json, collections
import chess, chess.polyglot

TSV_DIR, BOOK_DIR, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
SOURCES = [('gm2001.bin', 0.10, 12, 20),          # (file, bobot >= frac*maks, bobot minimum, kedalaman maks khusus sumber ini)
           ('Elo2400.bin', 0.10, 12, 20),
           ('KomodoVariety.bin', 0.25, 1, 10)]       # buku 'variety': menambah jalur yang jarang di level master tapi ada di Chess.com
MAXPLY = 20                                                         # kedalaman maksimum perluasan keseluruhan (setengah-langkah)

def key_of(b): return ' '.join(b.fen().split(' ')[:2])

# ---------- 1) Lichess: posisi bernama + posisi di tengah jalur ----------
lines = []
for f in 'abcde':
    txt = open(f'{TSV_DIR}/{f}.tsv', encoding='utf-8').read()
    for i, ln in enumerate(re.split(r'\r?\n', txt)):
        if i == 0 or not ln.strip(): continue
        p = ln.strip().split('\t')
        if len(p) < 3 or not all(x.strip() for x in p[:3]): continue
        lines.append((p[0].strip(), p[1].strip(), [t for t in re.sub(r'\d+\.', ' ', p[2].strip()).split() if t]))

memo = {'': chess.Board()}; boards = {}; plyof = {}; named = {}; paths = []
for eco, name, toks in lines:
    ks = []
    for i in range(1, len(toks) + 1):
        pk = ' '.join(toks[:i])
        if pk not in memo:
            b = memo[' '.join(toks[:i - 1])].copy(stack=False); b.push_san(toks[i - 1]); memo[pk] = b
        k = key_of(memo[pk]); ks.append(k); boards.setdefault(k, memo[pk]); plyof.setdefault(k, i)
    paths.append((eco, name, ks))
    cur = named.get(ks[-1])
    if cur is None or (name, eco) < (cur[1], cur[0]): named[ks[-1]] = (eco, name)

book = dict(named); score = {k: 10 ** 6 for k in named}
for eco, name, ks in paths:
    cur = None; cp = -1
    for i, k in enumerate(ks):
        if k in named: cur = named[k]; cp = i + 1; continue
        val = cur if cur else (eco, name)
        if k not in book or cp > score[k] or (cp == score[k] and (val[1], val[0]) < (book[k][1], book[k][0])):
            book[k] = val; score[k] = cp
n_lichess = len(book)

# ---------- 2) Polyglot: perluas kedalaman, nama diwarisi dari posisi induk ----------
readers = [(chess.polyglot.open_reader(f'{BOOK_DIR}/{fn}'), frac, minw, mp) for fn, frac, minw, mp in SOURCES]
q = collections.deque((boards[k], plyof[k]) for k in book)
q.appendleft((chess.Board(), 0))
visited = set()
while q:
    b, ply = q.popleft()
    k0 = key_of(b)
    if k0 in visited or ply >= MAXPLY: continue
    visited.add(k0)
    moves = {}
    for r, frac, minw, mp in readers:
        if ply >= mp: continue
        es = list(r.find_all(b))
        if not es: continue
        mx = max(e.weight for e in es)
        for e in es:
            if e.weight >= minw and e.weight >= frac * mx: moves[e.move.uci()] = e.move
    for u in sorted(moves):
        nb = b.copy(stack=False); nb.push(moves[u]); k = key_of(nb)
        if k not in book:
            parent = book.get(k0)
            if parent is None: continue
            book[k] = parent; boards[k] = nb; plyof[k] = ply + 1
        q.append((nb, ply + 1))
for r, *_ in readers: r.close()

# ---------- 3) Keluaran ringkas: kunci = hash 53-bit (cyrb53) dari "susunan bidak + giliran" ----------
M32 = 0xFFFFFFFF
def imul(a, b): return (a * b) & M32
def cyrb53(s):
    h1, h2 = 0xdeadbeef, 0x41c6ce57
    for ch in s:
        c = ord(ch)
        h1 = imul(h1 ^ c, 2654435761); h2 = imul(h2 ^ c, 1597334677)
    h1 = imul(h1 ^ (h1 >> 16), 2246822507); h1 ^= imul(h2 ^ (h2 >> 13), 3266489909)
    h2 = imul(h2 ^ (h2 >> 16), 2246822507); h2 ^= imul(h1 ^ (h1 >> 13), 3266489909)
    return 4294967296 * (2097151 & h2) + (h1 & M32)
def b36(n):
    d = '0123456789abcdefghijklmnopqrstuvwxyz'
    if n == 0: return '0'
    s = ''
    while n: n, r = divmod(n, 36); s = d[r] + s
    return s

cnt = collections.Counter(eco + '|' + name for eco, name in book.values())
names = sorted(cnt, key=lambda s: (-cnt[s], s)); idx = {s: i for i, s in enumerate(names)}
items = {}
for k, (eco, name) in book.items():
    h = b36(cyrb53(k))
    assert h not in items, 'tabrakan hash: ' + k
    items[h] = idx[eco + '|' + name]
toks = [f'{h},{b36(i)}' for h, i in sorted(items.items())]
rows = [' '.join(toks[i:i + 8]) for i in range(0, len(toks), 8)]

out = f'''/* Opening book — nama pembukaan dari Lichess chess-openings (CC0), kedalaman diperluas dengan buku Polyglot gm2001 + Elo2400 + KomodoVariety
   (github.com/lichess-org/chess-openings, github.com/ChrisWhittington/polyglot-books). {n_lichess} posisi Lichess + {len(book) - n_lichess} posisi tambahan = {len(book)} posisi, {len(names)} nama.
   Dibuat oleh tools/build_book_merged.py. Kunci data = hash 53-bit dari FEN (susunan bidak + giliran jalan); window.OPENING_BOOK[fenKey] tetap
   mengembalikan "ECO|Nama" seperti biasa, jadi kode lain tidak berubah. */
(function () {{
  var N = [
{(","+chr(10)).join("    " + json.dumps(s, ensure_ascii=False) for s in names)}
  ];
  var D = (
{chr(10).join("    " + json.dumps(r + (" " if i < len(rows) - 1 else "")) + (" +" if i < len(rows) - 1 else "") for i, r in enumerate(rows))}
  );
  function hash(s) {{
    var h1 = 0xdeadbeef, h2 = 0x41c6ce57, c, i;
    for (i = 0; i < s.length; i++) {{ c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }}
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507); h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507); h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
  }}
  var T = new Map(), P = D.split(" "), i, q;
  for (i = 0; i < P.length; i++) {{ if (!P[i]) continue; q = P[i].split(","); T.set(q[0], parseInt(q[1], 36)); }}
  function look(k) {{ var v = T.get(hash(k).toString(36)); return v === undefined ? undefined : N[v]; }}
  window.OPENING_BOOK = new Proxy({{}}, {{
    get: function (_, k) {{ return typeof k === "string" ? look(k) : undefined; }},
    has: function (_, k) {{ return typeof k === "string" && look(k) !== undefined; }}
  }});
  window.OPENING_BOOK_SIZE = T.size;
}})();
'''
open(OUT, 'w', encoding='utf-8').write(out)
json.dump({k: book[k][0] + '|' + book[k][1] for k in book}, open(OUT + '.ref.json', 'w'))
print(f'lichess={n_lichess} total={len(book)} nama_unik={len(names)} berkas={len(out)//1024} KB')
