// WorldEdit – beépített plugin (admin parancsok): //pos1 //pos2 //set //replace //walls //sphere //hsphere //cyl //hcyl //copy //cut //paste //rotate //undo //redo //count //size
export const MAX_BLOCKS = 400000, SLICE = 6000;
export default {
  name: 'WorldEdit', version: '1.0',
  onEnable(api) {
    const S = new Map(); // játékosonkénti állapot
    const st = n => { const k = n.toLowerCase(); if (!S.has(k)) S.set(k, { p1: null, p2: null, clip: null, undo: [], redo: [], busy: false }); return S.get(k); };
    const fl = p => p.map(v => Math.floor(v));
    const sel = (ctx, s) => { if (!s.p1 || !s.p2) { ctx.error('Előbb jelöld ki a területet: //pos1 és //pos2'); return null; } const lo = [0, 1, 2].map(i => Math.min(s.p1[i], s.p2[i])), hi = [0, 1, 2].map(i => Math.max(s.p1[i], s.p2[i])); const n = (hi[0] - lo[0] + 1) * (hi[1] - lo[1] + 1) * (hi[2] - lo[2] + 1); if (n > MAX_BLOCKS) { ctx.error('Túl nagy terület: ' + n + ' blokk (max ' + MAX_BLOCKS + ').'); return null; } return { lo, hi, n }; };
    // blokk-minta: "stone" | "stone,dirt" | "30%stone,dirt" nélkül – egyszerű véletlen lista
    const pattern = (ctx, txt) => {
      if (!txt) { ctx.error('Add meg a blokkot, pl.: //set stone'); return null; }
      const ids = []; for (const part of String(txt).split(',')) { const q = part.trim(); const id = q === 'air' || q === 'levego' || q === 'levegő' ? 0 : api.findItem(q); if (id === null || id === undefined || (id !== 0 && !api.isBlock(id))) { ctx.error('Ismeretlen blokk: ' + q); return null; } ids.push(id); }
      return () => ids[ids.length === 1 ? 0 : Math.floor(Math.random() * ids.length)];
    };
    // szeletelt végrehajtás, visszavonás-rögzítéssel
    const run = (ctx, s, label, positions) => {
      if (s.busy) return ctx.error('Még fut az előző művelet.'); s.busy = true;
      const changed = []; let i = 0, skipped = 0; const t0 = Date.now();
      const step = () => {
        const end = Math.min(positions.length, i + SLICE);
        for (; i < end; i++) { const [x, y, z, id] = positions[i]; const old = api.getBlock(x, y, z); if (old === id) continue; if (api.setBlock(x, y, z, id)) changed.push([x, y, z, old]); else skipped++; }
        if (i < positions.length) return setTimeout(step, 10);
        s.busy = false; if (changed.length) { s.undo.push(changed); if (s.undo.length > 20) s.undo.shift(); s.redo.length = 0; }
        ctx.tell(label + ': ' + changed.length + ' blokk módosítva (' + ((Date.now() - t0) / 1000).toFixed(1) + ' mp)' + (skipped ? ' – ' + skipped + ' blokk kimaradt (nincs betöltve)' : ''));
      };
      step();
    };
    const cmd = (name, desc, fn) => api.command('/' + name, { desc, admin: true, run: fn });
    cmd('pos1', 'Első pont (a pozíciód vagy x y z)', (ctx, a) => { const p = a.length >= 3 ? a.slice(0, 3).map(Number) : fl(ctx.pos()); if (p.some(v => !isFinite(v))) return ctx.error('Hibás koordináta.'); st(ctx.name).p1 = p; ctx.tell('Első pont: ' + p.join(', ')); });
    cmd('pos2', 'Második pont', (ctx, a) => { const p = a.length >= 3 ? a.slice(0, 3).map(Number) : fl(ctx.pos()); if (p.some(v => !isFinite(v))) return ctx.error('Hibás koordináta.'); st(ctx.name).p2 = p; ctx.tell('Második pont: ' + p.join(', ')); });
    cmd('size', 'A kijelölés mérete', (ctx) => { const r = sel(ctx, st(ctx.name)); if (r) ctx.tell('Kijelölés: ' + (r.hi[0] - r.lo[0] + 1) + ' × ' + (r.hi[1] - r.lo[1] + 1) + ' × ' + (r.hi[2] - r.lo[2] + 1) + ' = ' + r.n + ' blokk'); });
    cmd('count', 'Adott blokk megszámolása a kijelölésben', (ctx, a) => { const s = st(ctx.name), r = sel(ctx, s); if (!r) return; const pf = pattern(ctx, a[0]); if (!pf) return; const id = pf(); let n = 0; for (let x = r.lo[0]; x <= r.hi[0]; x++) for (let y = r.lo[1]; y <= r.hi[1]; y++) for (let z = r.lo[2]; z <= r.hi[2]; z++) if (api.getBlock(x, y, z) === id) n++; ctx.tell(api.itemName(id) + ': ' + n + ' db'); });
    cmd('set', 'Kijelölés kitöltése blokkal', (ctx, a) => { const s = st(ctx.name), r = sel(ctx, s); if (!r) return; const pf = pattern(ctx, a[0]); if (!pf) return; const l = []; for (let x = r.lo[0]; x <= r.hi[0]; x++) for (let y = r.lo[1]; y <= r.hi[1]; y++) for (let z = r.lo[2]; z <= r.hi[2]; z++) l.push([x, y, z, pf()]); run(ctx, s, '//set', l); });
    cmd('replace', 'Blokk cseréje a kijelölésben: //replace <honnan> <mire>', (ctx, a) => { const s = st(ctx.name), r = sel(ctx, s); if (!r) return; const from = pattern(ctx, a[0]), to = pattern(ctx, a[1]); if (!from || !to) return; const src = new Set(String(a[0]).split(',').map(q => { q = q.trim(); return q === 'air' ? 0 : api.findItem(q); })); const l = []; for (let x = r.lo[0]; x <= r.hi[0]; x++) for (let y = r.lo[1]; y <= r.hi[1]; y++) for (let z = r.lo[2]; z <= r.hi[2]; z++) if (src.has(api.getBlock(x, y, z))) l.push([x, y, z, to()]); run(ctx, s, '//replace', l); });
    cmd('walls', 'A kijelölés négy oldalfala', (ctx, a) => { const s = st(ctx.name), r = sel(ctx, s); if (!r) return; const pf = pattern(ctx, a[0]); if (!pf) return; const l = []; for (let x = r.lo[0]; x <= r.hi[0]; x++) for (let y = r.lo[1]; y <= r.hi[1]; y++) for (let z = r.lo[2]; z <= r.hi[2]; z++) if (x === r.lo[0] || x === r.hi[0] || z === r.lo[2] || z === r.hi[2]) l.push([x, y, z, pf()]); run(ctx, s, '//walls', l); });
    const shape = (hollow, cylinder) => (ctx, a) => {
      const s = st(ctx.name), pf = pattern(ctx, a[0]); if (!pf) return; const rad = +a[1], h = cylinder ? Math.floor(+a[2] || 1) : 0;
      if (!(rad >= 1 && rad <= 100)) return ctx.error('A sugár 1 és 100 között legyen.'); if (cylinder && !(h >= 1 && h <= 256)) return ctx.error('A magasság 1 és 256 között legyen.');
      const c = fl(ctx.pos()), l = [], R = Math.ceil(rad);
      for (let x = -R; x <= R; x++) for (let z = -R; z <= R; z++) {
        if (cylinder) { const d = Math.hypot(x, z); if (d > rad + 0.3 || (hollow && d <= rad - 0.7)) continue; for (let y = 0; y < h; y++) l.push([c[0] + x, c[1] + y, c[2] + z, pf()]); }
        else for (let y = -R; y <= R; y++) { const d = Math.hypot(x, y, z); if (d > rad + 0.3 || (hollow && d <= rad - 0.7)) continue; l.push([c[0] + x, c[1] + y, c[2] + z, pf()]); }
        if (l.length > MAX_BLOCKS) return ctx.error('Túl nagy alakzat.');
      }
      run(ctx, s, cylinder ? (hollow ? '//hcyl' : '//cyl') : (hollow ? '//hsphere' : '//sphere'), l);
    };
    cmd('sphere', '//sphere <blokk> <sugár>', shape(false, false)); cmd('hsphere', '//hsphere <blokk> <sugár>', shape(true, false));
    cmd('cyl', '//cyl <blokk> <sugár> [magasság]', shape(false, true)); cmd('hcyl', '//hcyl <blokk> <sugár> [magasság]', shape(true, true));
    const grab = (ctx, s, r) => { const o = fl(ctx.pos()), blocks = []; for (let x = r.lo[0]; x <= r.hi[0]; x++) for (let y = r.lo[1]; y <= r.hi[1]; y++) for (let z = r.lo[2]; z <= r.hi[2]; z++) blocks.push([x - o[0], y - o[1], z - o[2], api.getBlock(x, y, z)]); s.clip = { blocks, size: r.n }; };
    cmd('copy', 'Kijelölés másolása (a pozíciódhoz képest)', (ctx) => { const s = st(ctx.name), r = sel(ctx, s); if (!r) return; grab(ctx, s, r); ctx.tell(r.n + ' blokk a vágólapon.'); });
    cmd('cut', 'Kijelölés kivágása', (ctx) => { const s = st(ctx.name), r = sel(ctx, s); if (!r) return; grab(ctx, s, r); const l = []; for (const [dx, dy, dz] of s.clip.blocks) { const o = fl(ctx.pos()); l.push([o[0] + dx, o[1] + dy, o[2] + dz, 0]); } run(ctx, s, '//cut', l); });
    cmd('paste', 'Vágólap beillesztése a pozíciódra (-a: levegő nélkül)', (ctx, a) => { const s = st(ctx.name); if (!s.clip) return ctx.error('Üres a vágólap (//copy).'); const o = fl(ctx.pos()), skipAir = a.includes('-a'); const l = []; for (const [dx, dy, dz, id] of s.clip.blocks) { if (skipAir && id === 0) continue; l.push([o[0] + dx, o[1] + dy, o[2] + dz, id]); } run(ctx, s, '//paste', l); });
    cmd('rotate', 'Vágólap forgatása: //rotate 90|180|270', (ctx, a) => { const s = st(ctx.name); if (!s.clip) return ctx.error('Üres a vágólap.'); const d = +a[0]; if (![90, 180, 270].includes(d)) return ctx.error('Használat: //rotate 90|180|270'); const n = d / 90; s.clip.blocks = s.clip.blocks.map(([x, y, z, id]) => { let X = x, Z = z; for (let i = 0; i < n; i++) { const t = X; X = -Z; Z = t; } return [X, y, Z, id]; }); ctx.tell('Vágólap elforgatva ' + d + ' fokkal.'); });
    cmd('undo', 'Visszavonás: //undo [db]', (ctx, a) => { const s = st(ctx.name); let n = Math.max(1, Math.min(20, +a[0] || 1)), done = 0; while (n-- > 0 && s.undo.length) { const ch = s.undo.pop(), redo = []; for (let i = ch.length - 1; i >= 0; i--) { const [x, y, z, old] = ch[i]; redo.push([x, y, z, api.getBlock(x, y, z)]); api.setBlock(x, y, z, old); } s.redo.push(redo); done++; } ctx.tell(done ? done + ' művelet visszavonva.' : 'Nincs mit visszavonni.'); });
    cmd('redo', 'Újra: //redo', (ctx) => { const s = st(ctx.name); const ch = s.redo.pop(); if (!ch) return ctx.tell('Nincs mit újra végrehajtani.'); const un = []; for (let i = ch.length - 1; i >= 0; i--) { const [x, y, z, id] = ch[i]; un.push([x, y, z, api.getBlock(x, y, z)]); api.setBlock(x, y, z, id); } s.undo.push(un); ctx.tell('Művelet újra végrehajtva.'); });
    cmd('help', 'WorldEdit súgó', (ctx) => { ctx.tell('WorldEdit: //pos1 //pos2 //size //count //set //replace //walls //sphere //hsphere //cyl //hcyl //copy //cut //paste //rotate //undo //redo'); ctx.tell('Blokk: angol vagy magyar név, szám, vagy lista véletlenszerűen: stone,dirt'); });
    api.on('leave', e => { S.delete(String(e.name).toLowerCase()); });
  },
};
