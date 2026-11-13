// Folyadék-szimuláció (víz + láva): szintek, lefolyás, szétterülés, végtelen forrás, víz+láva reakció.
// Csak a host / egyjátékos fut; a kliensek a blokkváltozásokat a hálózaton kapják.
import { B, BLOCKS, FK, FL, SOLID, H } from './blocks.js';
import { WATER_ID, LAVA_ID } from './content.js';

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const MAXL = [0, 7, 3];                  // legnagyobb szint: víz 7, láva 3 (felszín)
const DELAY = [0, 0.25, 1.4];           // lépésköz másodpercben
const BUDGET = 260;                      // frissítés / képkocka
const idOf = (k, l) => k === 1 ? WATER_ID(l) : LAVA_ID(l);

export class Fluids {
  constructor(game) { this.g = game; this.q = new Map(); this.t = 0; }
  get w() { return this.g.world; }
  get off() { return !this.w || this.g.net.isClient; }
  reset() { this.q.clear(); this.t = 0; }

  attach(w) {
    this.q.clear(); this.t = 0;
    w.fluidHook = (x, y, z, old, id) => this.onSet(x, y, z, old, id);
  }
  key(x, y, z) { return x + ',' + y + ',' + z; }
  wake(x, y, z) {
    if (y < 0 || y >= H) return;
    const k = this.key(x, y, z); if (this.q.has(k)) return;
    const id = this.w.getBlock(x, y, z); if (!FK[id]) return;
    this.q.set(k, this.t + DELAY[FK[id]]);
  }
  onSet(x, y, z, old, id) {
    if (this.off) return;
    if (FK[id] || FK[old]) this.wake(x, y, z);
    const w = this.w;
    this.wake(x, y + 1, z); this.wake(x, y - 1, z); this.wake(x + 1, y, z); this.wake(x - 1, y, z); this.wake(x, y, z + 1); this.wake(x, y, z - 1);
    void w;
  }

  // a cellába beömölhet-e a k fajtájú folyadék?
  canEnter(x, y, z, k) {
    const w = this.w; if (y < 0 || y >= H || !w.isLoaded(x, z)) return false;
    const b = w.getBlock(x, y, z);
    if (b === B.AIR) return true;
    if (FK[b]) { if (FK[b] !== k) return true; return FL[b] > 0 && FL[b] < 8; }
    const d = BLOCKS[b]; return !!(d && d.replace && !d.solid);
  }
  canFlowDown(x, y, z, k) { return this.canEnter(x, y - 1, z, k); }

  // mekkora szintet "kap" ez a cella a szomszédaitól (-1: semmit)
  feed(x, y, z, k) {
    const w = this.w;
    if (FK[w.getBlock(x, y + 1, z)] === k) return 8;
    let best = 99, srcs = 0;
    for (const [dx, dz] of DIRS) {
      const nx = x + dx, nz = z + dz, nb = w.getBlock(nx, y, nz);
      if (FK[nb] !== k) continue;
      const lv = FL[nb];
      if (lv === 0) { srcs++; best = Math.min(best, 1); continue; }
      if (this.canFlowDown(nx, y, nz, k)) continue;              // aki lefelé folyik, oldalra nem terül
      const eff = lv === 8 ? 0 : lv; best = Math.min(best, eff + 1);
    }
    if (k === 1 && srcs >= 2) {                                    // végtelen vízforrás
      const below = w.getBlock(x, y - 1, z);
      if (SOLID[below] || (FK[below] === 1 && FL[below] === 0)) return 0;
    }
    return best <= MAXL[k] ? best : -1;
  }

  // folyadék beömlése egy cellába (reakciókkal)
  place(x, y, z, k, lv) {
    const w = this.w, t = w.getBlock(x, y, z);
    if (FK[t] && FK[t] !== k) {
      if (k === 1) w.setBlock(x, y, z, FL[t] === 0 ? B.OBSIDIAN : B.COBBLE);   // víz a lávára
      else w.setBlock(x, y, z, B.STONE);                                        // láva a vízre
      this.g.fxFizz && this.g.fxFizz(x, y, z); return;
    }
    if (FK[t] === k) { if (FL[t] === 8 || (lv !== 8 && FL[t] <= lv)) return; }
    w.setBlock(x, y, z, idOf(k, lv));
  }

  spreadFrom(x, y, z, k, level) {
    const w = this.w;
    if (this.canFlowDown(x, y, z, k)) {
      this.place(x, y - 1, z, k, 8);
      if (level !== 0) return;
    }
    const lv2 = (level === 8 ? 0 : level) + 1; if (lv2 > MAXL[k]) return;
    for (const [dx, dz] of DIRS) {
      const nx = x + dx, nz = z + dz;
      if (!this.canEnter(nx, y, nz, k)) continue;
      const nb = w.getBlock(nx, y, nz);
      if (FK[nb] === k && (FL[nb] === 8 || FL[nb] <= lv2)) continue;
      if (k === 2 && FK[nb] === 1) continue;                       // láva oldalról nem folyik vízbe (a víz kövesíti)
      this.place(nx, y, nz, k, lv2);
    }
  }

  process(x, y, z) {
    const w = this.w; if (!w.isLoaded(x, z)) return;
    const id = w.getBlock(x, y, z), k = FK[id]; if (!k) return;
    let level = FL[id];
    if (level > 0) {
      const f = this.feed(x, y, z, k);
      if (f < 0) { w.setBlock(x, y, z, B.AIR); return; }
      if (f !== level) { w.setBlock(x, y, z, idOf(k, f)); return; }
    } else if (k === 1) { /* forrás */ }
    if (k === 2) {                                                  // a lávát víz érinti (felül / oldalt) → obszidián / kavics
      for (const [dx, dy, dz] of [[0, 1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]]) if (FK[w.getBlock(x + dx, y + dy, z + dz)] === 1) { w.setBlock(x, y, z, level === 0 ? B.OBSIDIAN : B.COBBLE); return; }
    }
    this.spreadFrom(x, y, z, k, level);
  }

  update(dt) {
    if (this.off) { if (this.q.size) this.q.clear(); return; }
    const w = this.w;
    if (w.fluidWake && w.fluidWake.length) { for (const [x, y, z] of w.fluidWake.splice(0)) this.wake(x, y, z); }
    this.t += dt;
    if (!this.q.size) return;
    const due = []; for (const [k, t] of this.q) { if (t <= this.t) { due.push(k); if (due.length >= BUDGET) break; } }
    for (const k of due) { this.q.delete(k); const [x, y, z] = k.split(',').map(Number); this.process(x, y, z); }
  }

  // áramlás iránya (x,z) – a játékost / mobokat sodorja
  flow(x, y, z) {
    const w = this.w, id = w.getBlock(x, y, z), k = FK[id]; if (!k) return [0, 0];
    const h = b => !FK[b] ? (SOLID[b] ? -1 : 0) : (FL[b] === 8 ? 8 : 8 - FL[b]);
    const mine = h(id); let fx = 0, fz = 0;
    for (const [dx, dz] of DIRS) { const nb = w.getBlock(x + dx, y, z + dz), nh = h(nb); if (nh < 0) continue; const d = mine - nh; fx += dx * d; fz += dz * d; }
    if (FK[w.getBlock(x, y + 1, z)]) { /* függőleges vízoszlopban kisebb sodrás */ fx *= 0.5; fz *= 0.5; }
    const l = Math.hypot(fx, fz); return l > 0 ? [fx / l, fz / l] : [0, 0];
  }
}
