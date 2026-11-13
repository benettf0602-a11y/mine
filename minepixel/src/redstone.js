// Redstone szimuláció: kar, gomb, nyomólap, por (0..15), lámpa, fáklya + ajtók / kapuk / csapóajtók / TNT vezérlése.
// Az állapot a blokk-azonosítóban van (pl. por szint, kar be/ki), ezért a hálózaton a szokásos blokkszinkronnal terjed.
// Csak a host / egyjátékos számol; a kliens csak megkapja a blokkváltozásokat.
import { B, H, OPAQUE, SOLID, RSB, RSW } from './blocks.js';
import { isCmdBlock, isDust, dustLevel, DUST_ID, dustConnTo, DIRS4, ATTACH_DIR, DOOR_HALVES, isDoorTop, isDoorOpen, GATES, TRAPDOORS } from './content.js';

const N6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const TICK = 0.1, TORCH_DELAY = 0.15, BUTTON_TIME = 1.0, PLATE_HOLD = 0.4, MAX_NODES = 4000;
const key = (x, y, z) => x + ',' + y + ',' + z;
const conductor = id => !!id && OPAQUE[id] === 1 && SOLID[id] === 1;

export class Redstone {
  constructor(game) {
    this.g = game; this.dirty = new Set(); this.timers = []; this.t = 0; this.acc = 0; this.plateAcc = 0;
    this.reps = new Set(); this.repAcc = 0; this.pw = new Map(); this.hold = new Map(); this.pendingTorch = new Set(); this.quiet = false;
  }
  get w() { return this.g.world; }
  get off() { return !this.w || this.g.net.isClient; }
  attach(w) {
    this.dirty.clear(); this.reps.clear(); this.timers.length = 0; this.pw.clear(); this.hold.clear(); this.pendingTorch.clear(); this.t = 0; this.acc = 0;
    w.rsHook = (x, y, z, old, id) => this.onSet(x, y, z, old, id);
  }
  get(x, y, z) { return this.w.getBlock(x, y, z); }

  // ---------- változás figyelése ----------
  onSet(x, y, z, old, id) {
    if (this.off || this.quiet) return;
    if (id === B.BUTTON_ON && old !== id) this.timers.push({ t: this.t + BUTTON_TIME, k: 'btn', x, y, z });
    if (id === B.PLATE_ON && old !== id) this.hold.set(key(x, y, z), this.t + PLATE_HOLD);
    let rel = RSB[id] || RSB[old];
    if (!rel) for (const [dx, dy, dz] of N6) if (RSB[this.get(x + dx, y + dy, z + dz)]) { rel = 1; break; }
    if (rel) this.dirty.add(key(x, y, z));
  }
  touch(x, y, z) { if (!this.off) this.dirty.add(key(x, y, z)); }

  // ---------- erőforrások: mi ad áramot ----------
  // a por irányai, amerre "mutat" (táplál): egy kapcsolat → a szemben lévő oldal is; nincs kapcsolat → mind a négy
  dustPoints(x, y, z) {
    const get = (a, b, c) => this.get(a, b, c); const m = [0, 0, 0, 0]; let n = 0;
    for (let i = 0; i < 4; i++) if (dustConnTo(get, x, y, z, DIRS4[i][0], DIRS4[i][1])) { m[i] = 1; n++; }
    if (n === 0) return [1, 1, 1, 1];
    if (n === 1) { const i = m.indexOf(1); m[i ^ 1] = 1; }
    return m;
  }
  // a tömör blokkot ért erős tápot adja vissza (kar rajta, nyomólap fölötte, fáklya alatta, por felé mutat / rajta)
  blockPower(x, y, z, withDust) {
    let best = 0;
    for (const [dx, dy, dz] of N6) {
      const mx = x + dx, my = y + dy, mz = z + dz, id = this.get(mx, my, mz);
      if (id === B.LEVER_ON || id === B.BUTTON_ON) {
        const f = this.w.facing.get(key(mx, my, mz)), a = ATTACH_DIR[f === undefined ? 3 : f];
        if (mx + a[0] === x && my + a[1] === y && mz + a[2] === z) best = 15;
      } else if (id === B.PLATE_ON) { if (dy === 1) best = 15; }
      else if (id === B.RSTORCH) { if (dy === -1) best = 15; }
      else if (withDust && isDust(id)) {
        const L = dustLevel(id); if (L <= best) continue;
        if (dy === 1) best = L;
        else if (dy === 0) {
          const pts = this.dustPoints(mx, my, mz), i = DIRS4.findIndex(d => d[0] === -dx && d[1] === -dz);
          if (i >= 0 && pts[i]) best = L;
        }
      }
      if (best === 15) return 15;
    }
    return best;
  }
  // ez a cella kap-e áramot a szomszédaitól (mechanizmusokhoz: lámpa, ajtó, TNT)
  isPowered(x, y, z) {
    for (const [dx, dy, dz] of N6) {
      const nx = x + dx, ny = y + dy, nz = z + dz, id = this.get(nx, ny, nz);
      if (id === B.LEVER_ON || id === B.BUTTON_ON || id === B.PLATE_ON || id === B.BLOCK_REDSTONE) return true;
      if (id === B.RSTORCH) { if (dy !== -1) return true; continue; }        // a fáklya a saját alátámasztó blokkját nem táplálja
      if (isDust(id)) {
        if (dustLevel(id) <= 0) continue;
        if (dy === 1) return true;                                            // a por a alatta lévő blokkot táplálja
        if (dy === 0) { const pts = this.dustPoints(nx, ny, nz), i = DIRS4.findIndex(d => d[0] === -dx && d[1] === -dz); if (i >= 0 && pts[i]) return true; }
        continue;
      }
      if (conductor(id) && this.blockPower(nx, ny, nz, true) > 0) return true;
    }
    return false;
  }
  // a por külső bemenete (nem a saját vezetékéből)
  extPower(x, y, z) {
    let best = 0;
    for (const [dx, dy, dz] of N6) {
      const id = this.get(x + dx, y + dy, z + dz);
      if (id === B.LEVER_ON || id === B.BUTTON_ON || id === B.PLATE_ON || id === B.BLOCK_REDSTONE || id === B.RSTORCH) return 15;
      if (conductor(id)) { const p = this.blockPower(x + dx, y + dy, z + dz, false); if (p > best) best = p; }
    }
    return best;
  }

  // ---------- por-hálózat újraszámolása ----------
  dustLinks(x, y, z) {
    const get = (a, b, c) => this.get(a, b, c), out = [];
    for (const [dx, dz] of DIRS4) {
      const c = dustConnTo(get, x, y, z, dx, dz);
      if (c === 1 && isDust(get(x + dx, y, z + dz))) out.push([x + dx, y, z + dz]);
      else if (c === 2) out.push([x + dx, y + 1, z + dz]);
      else if (c === -1) out.push([x + dx, y - 1, z + dz]);
    }
    return out;
  }
  recalcDust(seeds) {
    const nodes = new Map(), stack = [];
    for (const [x, y, z] of seeds) { const k = key(x, y, z); if (!nodes.has(k) && isDust(this.get(x, y, z))) { nodes.set(k, { x, y, z, old: dustLevel(this.get(x, y, z)), lv: 0 }); stack.push(k); } }
    while (stack.length && nodes.size < MAX_NODES) {
      const n = nodes.get(stack.pop());
      for (const [x, y, z] of this.dustLinks(n.x, n.y, n.z)) { const k = key(x, y, z); if (nodes.has(k) || !isDust(this.get(x, y, z))) continue; nodes.set(k, { x, y, z, old: dustLevel(this.get(x, y, z)), lv: 0 }); stack.push(k); }
    }
    const buckets = Array.from({ length: 16 }, () => []);
    for (const n of nodes.values()) { n.lv = this.extPower(n.x, n.y, n.z); if (n.lv > 0) buckets[n.lv].push(n); }
    for (let L = 15; L >= 2; L--) for (const n of buckets[L]) {
      if (n.lv !== L) continue;
      for (const [x, y, z] of this.dustLinks(n.x, n.y, n.z)) { const m = nodes.get(key(x, y, z)); if (m && m.lv < L - 1) { m.lv = L - 1; buckets[L - 1].push(m); } }
    }
    const changed = [];
    this.quiet = true;
    for (const n of nodes.values()) if (n.lv !== n.old) { this.w.setBlock(n.x, n.y, n.z, DUST_ID(n.lv)); changed.push(n); }
    this.quiet = false;
    return changed;
  }

  // ---------- fogyasztók ----------
  evalCell(x, y, z) {
    const id = this.get(x, y, z);
    if (id === B.LAMP || id === B.LAMP_ON) { const p = this.isPowered(x, y, z); if (p !== (id === B.LAMP_ON)) this.w.setBlock(x, y, z, p ? B.LAMP_ON : B.LAMP); return; }
    if (id === B.RSTORCH || id === B.RSTORCH_OFF) {
      const k = key(x, y, z); if (this.pendingTorch.has(k)) return;
      const lit = !(conductor(this.get(x, y - 1, z)) && (this.blockPower(x, y - 1, z, true) > 0));
      if (lit !== (id === B.RSTORCH)) { this.pendingTorch.add(k); this.timers.push({ t: this.t + TORCH_DELAY, k: 'torch', x, y, z }); }
      return;
    }
    if (isCmdBlock(id)) {
      const c = this.w.containers.get(key(x, y, z)), auto = !!(c && c.auto);
      if (id === B.CMD_REP) this.reps.add(key(x, y, z));
      else if (id === B.CMD) this.edge(x, y, z, p => { if (p) this.runCmd(x, y, z, 0); }, () => auto || this.isPowered(x, y, z));
      return;
    }
    if (id === B.TNT) { this.edge(x, y, z, p => { if (p) this.g.igniteTNT(x, y, z, 0.8); }); return; }
    if (DOOR_HALVES.has(id)) {
      const ly = isDoorTop(id) ? y - 1 : y, lo = this.get(x, ly, z); if (!DOOR_HALVES.has(lo) || isDoorTop(lo)) return;
      this.edge(x, ly, z, (p, was) => {
        const up = this.get(x, ly + 1, z); if (!DOOR_HALVES.has(up)) return;
        if (p && !isDoorOpen(lo)) { this.w.setBlock(x, ly, z, B.DOOR_OPEN); this.w.setBlock(x, ly + 1, z, B.DOOR_TOP_OPEN); }
        else if (!p && was && isDoorOpen(lo)) { this.w.setBlock(x, ly, z, B.DOOR); this.w.setBlock(x, ly + 1, z, B.DOOR_TOP); }
      }, () => this.isPowered(x, ly, z) || this.isPowered(x, ly + 1, z));
      return;
    }
    if (GATES.has(id)) { this.edge(x, y, z, (p, was) => { if (p && id === B.FENCE_GATE) this.w.setBlock(x, y, z, B.FENCE_GATE_OPEN); else if (!p && was && id === B.FENCE_GATE_OPEN) this.w.setBlock(x, y, z, B.FENCE_GATE); }); return; }
    if (TRAPDOORS.has(id)) {
      this.edge(x, y, z, (p, was) => {
        const cur = this.get(x, y, z), top = cur === B.TRAPDOOR_TOP || cur === B.TRAPDOOR_TOP_OPEN, open = cur === B.TRAPDOOR_OPEN || cur === B.TRAPDOOR_TOP_OPEN;
        if (p && !open) this.w.setBlock(x, y, z, top ? B.TRAPDOOR_TOP_OPEN : B.TRAPDOOR_OPEN);
        else if (!p && was && open) this.w.setBlock(x, y, z, top ? B.TRAPDOOR_TOP : B.TRAPDOOR);
      });
    }
  }
  // parancsblokk futtatása + láncolt blokkok
  runCmd(x, y, z, depth) {
    const w = this.w, c = w.containers.get(key(x, y, z)); if (!c || !c.cmd) return false;
    let ok = false; try { ok = !!this.g.runBlockCommand(c.cmd, x, y, z); } catch (e) { ok = false; }
    c.ok = ok;
    if (depth < 16) {
      const f = w.facing.get(key(x, y, z)), d = { 1: [1, 0, 0], 0: [-1, 0, 0], 5: [0, 0, 1], 4: [0, 0, -1] }[f === undefined ? 1 : f] || [1, 0, 0];
      const nx = x + d[0], ny = y + d[1], nz = z + d[2];
      if (w.getBlock(nx, ny, nz) === B.CMD_CHAIN) { const cc = w.containers.get(key(nx, ny, nz)); if (cc && (cc.auto || this.isPowered(nx, ny, nz)) && (!cc.cond || ok)) this.runCmd(nx, ny, nz, depth + 1); }
    }
    return ok;
  }
  // élvezérlés: csak akkor cselekszik, ha az áram állapota megváltozott
  edge(x, y, z, fn, powered) {
    const k = key(x, y, z), p = powered ? powered() : this.isPowered(x, y, z), was = this.pw.get(k) || false;
    if (p === was) return;
    if (p) this.pw.set(k, true); else this.pw.delete(k);
    fn(p, was);
  }

  // ---------- fő ciklus ----------
  settle(cells) {
    const seeds = [], around = new Set();
    for (const k of cells) {
      const [x, y, z] = k.split(',').map(Number);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
        const a = x + dx, b = y + dy, c = z + dz;
        if (b < 0 || b >= H || !this.w.isLoaded(a, c)) continue;
        around.add(key(a, b, c));
        if (isDust(this.get(a, b, c))) seeds.push([a, b, c]);
      }
    }
    const changed = seeds.length ? this.recalcDust(seeds) : [];
    for (const n of changed) for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) for (let dz = -2; dz <= 2; dz++) around.add(key(n.x + dx, n.y + dy, n.z + dz));
    for (const k of around) { const [x, y, z] = k.split(',').map(Number); if (RSB[this.get(x, y, z)]) this.evalCell(x, y, z); }
  }
  scanPlates() {
    const w = this.w, seen = new Set();
    const touchEnt = (px, py, pz) => {
      const x = Math.floor(px), y = Math.floor(py + 0.02), z = Math.floor(pz), id = w.getBlock(x, y, z);
      if (id === B.PLATE) w.setBlock(x, y, z, B.PLATE_ON);
      if (id === B.PLATE || id === B.PLATE_ON) { const k = key(x, y, z); this.hold.set(k, this.t + PLATE_HOLD); seen.add(k); }
    };
    for (const p of this.g.playerList()) if (p.pos && !p.dead) touchEnt(p.pos[0], p.pos[1], p.pos[2]);
    for (const m of this.g.mobs.list) touchEnt(m.pos[0], m.pos[1], m.pos[2]);
    for (const [k, until] of this.hold) {
      if (until > this.t) continue;
      this.hold.delete(k); const [x, y, z] = k.split(',').map(Number);
      if (w.getBlock(x, y, z) === B.PLATE_ON) w.setBlock(x, y, z, B.PLATE);
    }
  }
  update(dt) {
    if (this.off) { if (this.dirty.size) this.dirty.clear(); if (this.timers.length) this.timers.length = 0; return; }
    const w = this.w;
    if (w.rsWake && w.rsWake.length) for (const [x, y, z] of w.rsWake.splice(0)) {
      const id = w.getBlock(x, y, z);
      if (id === B.BUTTON_ON) this.timers.push({ t: this.t + BUTTON_TIME, k: 'btn', x, y, z });
      if (id === B.PLATE_ON) this.hold.set(key(x, y, z), this.t + PLATE_HOLD);
      this.dirty.add(key(x, y, z));
    }
    this.t += dt; this.acc += dt; this.plateAcc += dt;
    for (let i = this.timers.length - 1; i >= 0; i--) {
      const tm = this.timers[i]; if (tm.t > this.t) continue;
      this.timers.splice(i, 1);
      if (tm.k === 'btn') { if (w.getBlock(tm.x, tm.y, tm.z) === B.BUTTON_ON) w.setBlock(tm.x, tm.y, tm.z, B.BUTTON); }
      else if (tm.k === 'torch') {
        this.pendingTorch.delete(key(tm.x, tm.y, tm.z));
        const id = w.getBlock(tm.x, tm.y, tm.z); if (id !== B.RSTORCH && id !== B.RSTORCH_OFF) continue;
        const lit = !(conductor(w.getBlock(tm.x, tm.y - 1, tm.z)) && this.blockPower(tm.x, tm.y - 1, tm.z, true) > 0);
        if (lit !== (id === B.RSTORCH)) w.setBlock(tm.x, tm.y, tm.z, lit ? B.RSTORCH : B.RSTORCH_OFF);
      }
    }
    if (this.reps.size && (this.repAcc += dt) >= TICK) {
      this.repAcc = 0;
      for (const k of [...this.reps]) {
        const [x, y, z] = k.split(',').map(Number);
        if (w.getBlock(x, y, z) !== B.CMD_REP) { this.reps.delete(k); continue; }
        const c = w.containers.get(k); if ((c && c.auto) || this.isPowered(x, y, z)) this.runCmd(x, y, z, 0);
      }
    }
    if (this.plateAcc > 0.15) { this.plateAcc = 0; this.scanPlates(); }
    if (this.acc >= TICK && this.dirty.size) {
      this.acc = 0;
      const cells = [...this.dirty].slice(0, 400); for (const k of cells) this.dirty.delete(k);
      this.settle(cells);
    } else if (this.acc >= TICK) this.acc = 0;
  }
}
