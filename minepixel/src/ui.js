// Készlet-logika és inventár/barkácsasztal/kemence/láda/kreatív felület
import { B, I, BLOCKS, ITEMS, ARMOR, itemDef, maxStack, maxDur, matchRecipe, SMELT, fuelTime, toolInfo } from './blocks.js';
import { CREATIVE_BLOCKS } from './content.js';
import { iconURL } from './textures.js';
import * as A from './audio.js';

export class Inventory {
  constructor() { this.slots = new Array(36).fill(null); }
  add(id, n, d = 0) {
    const ms = maxStack(id);
    if (ms > 1) for (const s of this.slots) { if (s && s.id === id && s.n < ms) { const t = Math.min(ms - s.n, n); s.n += t; n -= t; if (!n) return 0; } }
    for (let i = 0; i < 36 && n > 0; i++) {
      if (!this.slots[i]) { const t = Math.min(ms, n); this.slots[i] = { id, n: t, d }; n -= t; }
    }
    return n;
  }
  addHotbarFirst(id, n) { return this.add(id, n); }
  count(id) { let c = 0; for (const s of this.slots) if (s && s.id === id) c += s.n; return c; }
  take(i, n = 1) { const s = this.slots[i]; if (!s) return; s.n -= n; if (s.n <= 0) this.slots[i] = null; }
  serialize() { return this.slots.map(s => s ? [s.id, s.n, s.d || 0, s.e || 0] : 0); }
  load(a) { this.slots = new Array(36).fill(null); (a || []).forEach((s, i) => { if (s && i < 36) this.slots[i] = { id: s[0], n: s[1], d: s[2] || 0, ...(s[3] ? { e: s[3] } : {}) }; }); }
}

const $ = id => document.getElementById(id);
export const ENCH_HU = { s: 'Élesség', f: 'Hatékonyság', u: 'Törhetetlenség', p: 'Védelem' };
const ROM = ['', ' I', ' II', ' III'];
export const enchText = s => s && s.e ? ' ✦ ' + Object.entries(s.e).map(([k, v]) => ENCH_HU[k] + ROM[v]).join(', ') : '';
const nameOf = id => { const d = itemDef(id); return d ? d.name : '?'; };

export class InvUI {
  constructor(game) {
    this.g = game; this.cursor = null; this.refs = []; this.mode = null; this.ctx = null; this.craft = null; this.furn = null;
    this.cur = $('cursor'); this.tip = $('tooltip');
    window.addEventListener('mousemove', e => { this.mx = e.clientX; this.my = e.clientY; this.cur.style.left = e.clientX + 'px'; this.cur.style.top = e.clientY + 'px'; this.moveTip(e); });
    $('inv-panel').addEventListener('contextmenu', e => e.preventDefault());
  }
  get open() { return this.mode !== null; }
  get inv() { return this.g.inv; }

  show(mode, ctx) {
    this.mode = mode; this.ctx = ctx || null; this.refs = [];
    const p = $('inv-panel'); p.innerHTML = '';
    if (mode === 'inventory' || mode === 'crafting' || mode === 'kitchen' || mode === 'brew') {
      const n = mode === 'inventory' ? 2 : 3;
      this.craft = new Array(n * n).fill(null); this.craftN = n;
    }
    if (mode === 'creative') this.tab = this.tab || 'blocks';
    this.build(); $('inv').classList.remove('hidden'); this.renderAll();
  }
  close() {
    if (!this.mode) return;
    if (this.craft) { for (const s of this.craft) if (s) this.give(s); this.craft = null; }
    if (this.cursor) { this.give(this.cursor); this.cursor = null; }
    this.mode = null; this.ctx = null; this.furn = null; this.tip.style.display = 'none';
    $('inv').classList.add('hidden'); this.cur.style.display = 'none';
  }
  give(s) { const left = this.inv.add(s.id, s.n, s.d); if (left > 0) this.g.dropItem(s.id, left, this.g.player.pos[0], this.g.player.pos[1] + 1.4, this.g.player.pos[2], true); }

  // ---------- építés ----------
  mkSlot(arr, i, o = {}) {
    const el = document.createElement('div'); el.className = 'slot';
    const ref = Object.assign({ arr, i, el }, o); this.refs.push(ref);
    el.addEventListener('mousedown', e => { e.preventDefault(); this.click(ref, e.button, e.shiftKey); });
    el.addEventListener('mouseenter', () => { ref.hover = true; this.showTip(ref); });
    el.addEventListener('mouseleave', () => { ref.hover = false; this.tip.style.display = 'none'; });
    return el;
  }
  grid(cols, arr, from, count, o = {}) {
    const g = document.createElement('div'); g.className = 'grid'; g.style.gridTemplateColumns = `repeat(${cols}, 44px)`;
    for (let k = 0; k < count; k++) g.appendChild(this.mkSlot(arr, from + k, o));
    return g;
  }
  title(t) { const h = document.createElement('h3'); h.textContent = t; return h; }
  playerInv(p) {
    p.appendChild(this.title('Inventár'));
    p.appendChild(this.grid(9, this.inv.slots, 9, 27, { quickTo: 'hot' }));
    const sp = document.createElement('div'); sp.style.height = '8px'; p.appendChild(sp);
    p.appendChild(this.grid(9, this.inv.slots, 0, 9, { quickTo: 'main' }));
  }
  build() {
    const p = $('inv-panel'), m = this.mode;
    if (m === 'inventory' || m === 'crafting' || m === 'kitchen' || m === 'brew') {
      p.appendChild(this.title(m === 'crafting' ? 'Barkácsolás' : m === 'brew' ? 'Bájitalfőző' : m === 'kitchen' ? 'Konyhai sütő – főzés' : 'Barkácsolás (2×2)'));
      const row = document.createElement('div'); row.className = 'invrow';
      if (m === 'inventory') { const ac = document.createElement('div'); ac.className = 'grid'; ac.style.gridTemplateColumns = '44px'; for (let k = 0; k < 4; k++) ac.appendChild(this.mkSlot(this.g.armor, k, { armorSlot: true })); row.appendChild(ac); }
      row.appendChild(this.grid(this.craftN, this.craft, 0, this.craftN * this.craftN, { craft: true }));
      const ar = document.createElement('div'); ar.className = 'arrow'; row.appendChild(ar);
      this.outEl = this.mkSlot(null, 0, { kind: 'out' }); row.appendChild(this.outEl);
      p.appendChild(row);
      this.playerInv(p);
    } else if (m === 'chest') {
      p.appendChild(this.title('Láda'));
      p.appendChild(this.grid(9, this.ctx.slots, 0, 27, { chest: true }));
      const sp = document.createElement('div'); sp.style.height = '12px'; p.appendChild(sp);
      this.playerInv(p);
    } else if (m === 'furnace') {
      const f = this.ctx; this.furn = f;
      p.appendChild(this.title('Kemence'));
      const row = document.createElement('div'); row.className = 'invrow';
      const col = document.createElement('div'); col.style.display = 'flex'; col.style.flexDirection = 'column'; col.style.alignItems = 'center'; col.style.gap = '4px';
      col.appendChild(this.mkSlot(f.slots, 0, { furnIn: true }));
      const fl = document.createElement('div'); fl.className = 'flame'; fl.innerHTML = '<i></i>'; this.flameEl = fl.firstChild; col.appendChild(fl);
      col.appendChild(this.mkSlot(f.slots, 1, { furnFuel: true }));
      row.appendChild(col);
      const ar = document.createElement('div'); ar.className = 'arrow'; ar.innerHTML = '<i></i>'; this.arrowEl = ar.firstChild; row.appendChild(ar);
      row.appendChild(this.mkSlot(f.slots, 2, { kind: 'furnout' }));
      p.appendChild(row); this.playerInv(p);
    } else if (m === 'creative') {
      p.appendChild(this.title('Kreatív inventár'));
      const tabs = document.createElement('div'); tabs.className = 'tabs';
      for (const [k, l] of [['blocks', 'Blokkok'], ['items', 'Tárgyak']]) {
        const t = document.createElement('div'); t.className = 'tab' + (this.tab === k ? ' on' : ''); t.textContent = l;
        t.onclick = () => { this.tab = k; this.refs = []; p.innerHTML = ''; this.build(); this.renderAll(); }; tabs.appendChild(t);
      }
      p.appendChild(tabs);
      const list = [];
      if (this.tab === 'blocks') for (const id of CREATIVE_BLOCKS) list.push(id);
      else for (const k of Object.keys(ITEMS)) list.push(+k);
      const pal = document.createElement('div'); pal.className = 'palette';
      this.pal = list.map(id => ({ id, n: 1, d: 0 }));
      pal.appendChild(this.grid(9, this.pal, 0, this.pal.length, { palette: true }));
      p.appendChild(pal);
      const sp = document.createElement('div'); sp.style.height = '10px'; p.appendChild(sp);
      p.appendChild(this.title('Gyorssáv'));
      p.appendChild(this.grid(9, this.inv.slots, 0, 9, { quickTo: 'main' }));
    }
  }

  // ---------- logika ----------
  accepts(ref, id) {
    if (ref.armorSlot) return !!(ARMOR[id] && ARMOR[id].slot === ref.i);
    if (ref.furnIn) return true;
    if (ref.furnFuel) return fuelTime(id) > 0;
    if (ref.kind === 'furnout' || ref.kind === 'out') return false;
    return true;
  }
  recompute() {
    if (!this.craft) return;
    const r = matchRecipe(this.craft, this.craftN, this.mode === 'brew' ? 'brew' : this.mode === 'kitchen'); this.result = r;
  }
  consumeCraft() { for (let i = 0; i < this.craft.length; i++) { const s = this.craft[i]; if (s) { const rt = (itemDef(s.id) || {}).returns; s.n--; if (s.n <= 0) this.craft[i] = rt ? { id: rt, n: 1, d: 0 } : null; } } }
  click(ref, btn, shift) {
    A.sndClick();
    if (ref.palette) {
      const it = ref.arr[ref.i], ms = maxStack(it.id);
      if (this.cursor) { this.cursor = null; } else this.cursor = { id: it.id, n: btn === 2 ? 1 : (shift ? ms : (ms > 1 ? 64 : 1)), d: 0 };
      this.renderAll(); return;
    }
    if (ref.kind === 'out') {
      this.recompute(); const r = this.result; if (!r) return;
      if (shift) {
        let guard = 64;
        while (guard-- > 0) { this.recompute(); const rr = this.result; if (!rr) break; const left = this.inv.add(rr.id, rr.count); if (left > 0) { /* nincs hely */ if (left < rr.count) { /* részben */ } this.inv.slots; break; } this.consumeCraft(); }
      } else {
        const ms = maxStack(r.id);
        if (!this.cursor) { this.cursor = { id: r.id, n: r.count, d: 0 }; this.consumeCraft(); }
        else if (this.cursor.id === r.id && this.cursor.n + r.count <= ms) { this.cursor.n += r.count; this.consumeCraft(); }
      }
      this.renderAll(); return;
    }
    const arr = ref.arr, i = ref.i, s = arr[i];
    if (ref.kind === 'furnout') {
      if (!s) return;
      if (shift) { const left = this.inv.add(s.id, s.n); if (left === 0) arr[i] = null; else s.n = left; }
      else if (!this.cursor) { this.cursor = s; arr[i] = null; }
      else if (this.cursor.id === s.id && this.cursor.n + s.n <= maxStack(s.id)) { this.cursor.n += s.n; arr[i] = null; }
      this.renderAll(); return;
    }
    if (shift && s) {
      this.quickMove(ref); this.renderAll(); return;
    }
    const c = this.cursor;
    if (btn === 0 || btn === undefined) {
      if (!c) { if (s) { this.cursor = s; arr[i] = null; } }
      else if (!this.accepts(ref, c.id)) { /* nem fér be */ }
      else if (!s) { arr[i] = c; this.cursor = null; }
      else if (s.id === c.id && maxStack(c.id) > 1) { const t = Math.min(maxStack(c.id) - s.n, c.n); s.n += t; c.n -= t; if (c.n <= 0) this.cursor = null; }
      else { arr[i] = c; this.cursor = s; }
    } else if (btn === 2) {
      if (!c) { if (s) { const h = Math.ceil(s.n / 2); this.cursor = { id: s.id, n: h, d: s.d }; s.n -= h; if (s.n <= 0) arr[i] = null; } }
      else if (!this.accepts(ref, c.id)) { }
      else if (!s) { arr[i] = { id: c.id, n: 1, d: c.d }; c.n--; if (c.n <= 0) this.cursor = null; }
      else if (s.id === c.id && s.n < maxStack(s.id) && maxStack(c.id) > 1) { s.n++; c.n--; if (c.n <= 0) this.cursor = null; }
      else { arr[i] = c; this.cursor = s; }
    }
    this.renderAll();
  }
  moveInto(stack, targetArr, from, to, filter) {
    // a stack-et megpróbálja beletenni a [from,to) tartományba; visszaadja a maradékot
    const ms = maxStack(stack.id); let n = stack.n;
    if (ms > 1) for (let k = from; k < to && n > 0; k++) { const t = targetArr[k]; if (t && t.id === stack.id && t.n < ms) { const m = Math.min(ms - t.n, n); t.n += m; n -= m; } }
    for (let k = from; k < to && n > 0; k++) if (!targetArr[k]) { const m = Math.min(ms, n); targetArr[k] = { id: stack.id, n: m, d: stack.d }; n -= m; }
    return n;
  }
  quickMove(ref) {
    const s = ref.arr[ref.i], isPlayer = ref.arr === this.inv.slots;
    let left = s.n; const tmp = { id: s.id, n: s.n, d: s.d };
    if (isPlayer) {
      if (ARMOR[s.id] && this.mode === 'inventory' && !this.g.armor[ARMOR[s.id].slot]) { this.g.armor[ARMOR[s.id].slot] = tmp; ref.arr[ref.i] = null; return; }
      if (this.mode === 'chest') left = this.moveInto(tmp, this.ctx.slots, 0, 27);
      else if (this.mode === 'furnace') {
        const f = this.ctx;
        if (SMELT[s.id] !== undefined) left = this.moveInto(tmp, f.slots, 0, 1);
        if (left > 0 && fuelTime(s.id) > 0) { tmp.n = left; left = this.moveInto(tmp, f.slots, 1, 2); }
      } else if (ref.quickTo === 'hot') left = this.moveInto(tmp, this.inv.slots, 0, 9);
      else if (ref.quickTo === 'main') left = this.moveInto(tmp, this.inv.slots, 9, 36);
    } else {
      // konténerből a játékos felé
      left = this.moveInto(tmp, this.inv.slots, 0, 36);
    }
    if (left === 0) ref.arr[ref.i] = null; else s.n = left;
  }

  // ---------- megjelenítés ----------
  fillEl(el, s) {
    el.innerHTML = '';
    if (!s) return;
    const img = document.createElement('img'); img.src = iconURL(s.id); el.appendChild(img);
    if (s.n > 1) { const c = document.createElement('span'); c.className = 'cnt'; c.textContent = s.n; el.appendChild(c); }
    const md = maxDur(s.id);
    if (md && s.d > 0) { const f = 1 - s.d / md, d = document.createElement('div'); d.className = 'dur'; d.innerHTML = `<i style="width:${f * 100}%;background:hsl(${f * 120},90%,45%)"></i>`; el.appendChild(d); }
  }
  renderAll() {
    this.recompute();
    for (const r of this.refs) {
      let s;
      if (r.kind === 'out') s = this.result ? { id: this.result.id, n: this.result.count } : null; else s = r.arr[r.i];
      this.fillEl(r.el, s);
    }
    const c = this.cursor;
    if (c) { this.cur.style.display = 'block'; this.cur.innerHTML = `<img src="${iconURL(c.id)}">${c.n > 1 ? `<span class="cnt">${c.n}</span>` : ''}`; if (this.mx !== undefined) { this.cur.style.left = this.mx + 'px'; this.cur.style.top = this.my + 'px'; } }
    else this.cur.style.display = 'none';
    this.g.refreshHotbar();
  }
  tick() {
    if (this.mode === 'furnace' && this.furn) {
      const f = this.furn;
      if (this.flameEl) this.flameEl.style.height = (f.burnMax > 0 ? Math.max(0, f.burn / f.burnMax) * 100 : 0) + '%';
      if (this.arrowEl) this.arrowEl.style.width = (f.cook / 10 * 100) + '%';
      for (const r of this.refs) if (r.arr === f.slots) this.fillEl(r.el, r.arr[r.i]);
    }
  }
  showTip(ref) {
    let s = ref.kind === 'out' ? (this.result ? { id: this.result.id } : null) : ref.arr[ref.i];
    if (!s) { this.tip.style.display = 'none'; return; }
    this.tip.textContent = nameOf(s.id) + enchText(s); this.tip.style.display = 'block';
  }
  moveTip(e) { if (this.tip.style.display === 'block') { this.tip.style.left = (e.clientX + 14) + 'px'; this.tip.style.top = (e.clientY - 30) + 'px'; } }
}
