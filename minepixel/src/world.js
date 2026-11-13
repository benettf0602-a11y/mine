// Világ: chunkok, terepgenerálás (biomok, barlangok, ércek, fák), fényszámítás
import { Noise, mulberry32, hash2 } from './noise.js';
import { genNether, genEnd, genStronghold, genVillage } from './dimgen.js';
import { B, BLOCKS, CS, H, SEA, OP, EM, SOLID, BIOME, FK, FL, RSW } from './blocks.js';
import { TICKS } from './content.js';

export class Chunk {
  constructor(cx, cz) {
    this.cx = cx; this.cz = cz;
    this.blocks = new Uint8Array(CS * CS * H);
    this.sky = new Uint8Array(CS * CS * H);
    this.blk = new Uint8Array(CS * CS * H);
    this.biomes = new Uint8Array(CS * CS);
    this.dirty = true; this.generated = false; this.modified = false; this.maxY = 0;
    this.mesh = null;
  }
}
const idx = (x, y, z) => (y << 8) | (z << 4) | x;
export const ckey = (cx, cz) => (cx + 32768) * 65536 + (cz + 32768);
const DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

export class World {
  constructor(seed) {
    this.seed = seed | 0;
    this.noise = new Noise(this.seed);
    this.chunks = new Map();
    this.stash = new Map();     // módosított, kitöltött chunkok (mentéshez)
    this.facing = new Map();    // "x,y,z" -> irány (kemence, láda...)
    this.containers = new Map(); // "x,y,z" -> tartalom
    this.ticking = new Set();   // növények/palánták (véletlen tick)
  }

  // ---------- hozzáférés ----------
  getChunk(cx, cz) { return this.chunks.get(ckey(cx, cz)); }
  getBlock(x, y, z) {
    if (y < 0) return B.BEDROCK;
    if (y >= H) return B.AIR;
    const c = this.chunks.get(ckey(x >> 4, z >> 4));
    if (!c || !c.generated) return B.STONE;
    return c.blocks[idx(x & 15, y, z & 15)];
  }
  isLoaded(x, z) { const c = this.chunks.get(ckey(x >> 4, z >> 4)); return !!(c && c.generated); }
  getSky(x, y, z) {
    if (y >= H) return 15; if (y < 0) return 0;
    const c = this.chunks.get(ckey(x >> 4, z >> 4)); if (!c || !c.generated) return 15;
    return c.sky[idx(x & 15, y, z & 15)];
  }
  getBlk(x, y, z) {
    if (y >= H || y < 0) return 0;
    const c = this.chunks.get(ckey(x >> 4, z >> 4)); if (!c || !c.generated) return 0;
    return c.blk[idx(x & 15, y, z & 15)];
  }
  getBiome(x, z) { const c = this.chunks.get(ckey(x >> 4, z >> 4)); return c ? c.biomes[((z & 15) << 4) | (x & 15)] : 0; }
  topY(x, z) { for (let y = H - 1; y >= 0; y--) { const b = this.getBlock(x, y, z); if (b !== B.AIR && SOLID[b] || FK[b] === 1) return y; } return 0; }
  markDirty(x, y, z) {
    const cx = x >> 4, cz = z >> 4, lx = x & 15, lz = z & 15;
    let c = this.chunks.get(ckey(cx, cz)); if (c) c.dirty = true;
    if (lx === 0) { c = this.chunks.get(ckey(cx - 1, cz)); if (c) c.dirty = true; }
    if (lx === 15) { c = this.chunks.get(ckey(cx + 1, cz)); if (c) c.dirty = true; }
    if (lz === 0) { c = this.chunks.get(ckey(cx, cz - 1)); if (c) c.dirty = true; }
    if (lz === 15) { c = this.chunks.get(ckey(cx, cz + 1)); if (c) c.dirty = true; }
  }

  // ---------- terep ----------
  column(x, z) {
    const n = this.noise;
    const cont = n.fbm2(x * 0.0025, z * 0.0025, 4);
    const hills = n.fbm2(x * 0.011 + 37, z * 0.011 - 91, 4);
    const mraw = n.fbm2(x * 0.005 - 400, z * 0.005 + 400, 3);
    const det = n.fbm2(x * 0.045, z * 0.045, 2);
    const m = Math.max(0, mraw - 0.1) * 3.2;
    let h = SEA + 4 + cont * 22 + hills * 7 + det * 2 + m * m * 30;
    h = Math.max(6, Math.min(H - 8, Math.floor(h)));
    const temp = n.fbm2(x * 0.0018 + 900, z * 0.0018 - 900, 3) * 1.5;
    const hum = n.fbm2(x * 0.0021 - 700, z * 0.0021 + 700, 3) * 1.5;
    let biome;
    if (h < SEA - 1) biome = BIOME.OCEAN;
    else if (m > 0.35 && h > 80) biome = BIOME.MOUNTAIN;
    else if (h <= SEA + 1) biome = BIOME.BEACH;
    else if (temp < -0.28) biome = BIOME.SNOWY;
    else if (temp > 0.33 && hum < 0.12) biome = BIOME.DESERT;
    else if (hum > 0.3) biome = temp > 0 ? BIOME.FOREST : BIOME.BIRCH;
    else if (hum > 0.12) biome = BIOME.FOREST;
    else biome = BIOME.PLAINS;
    return { h, biome };
  }

  generateChunk(c) {
    const stashed = this.stash.get(ckey(c.cx, c.cz));
    if (!stashed && this.dim) {
      c.biomes.fill(1);
      if (this.dim === 'nether') genNether(this, c); else genEnd(this, c);
      c.generated = true; this.lightChunk(c); return;
    }
    const x0 = c.cx * CS, z0 = c.cz * CS;
    const cols = [];
    for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
      const info = this.column(x0 + x, z0 + z);
      cols.push(info);
      c.biomes[(z << 4) | x] = info.biome;
    }
    if (!stashed && this.voidOutside) { c.maxY = 0; c.generated = true; this.lightChunk(c); return; }   // importált térkép: a határán túl üres
    if (stashed) {
      c.blocks.set(stashed); c.modified = true;
      let maxY = 0; for (let i = c.blocks.length - 1; i >= 0; i--) if (c.blocks[i]) { maxY = i >> 8; break; }
      c.maxY = maxY;
      for (let i = 0; i < c.blocks.length; i++) { const bi = c.blocks[i]; if (TICKS[bi]) this.ticking.add((x0 + (i & 15)) + ',' + (i >> 8) + ',' + (z0 + ((i >> 4) & 15))); if (FL[bi] && FK[bi]) (this.fluidWake || (this.fluidWake = [])).push([x0 + (i & 15), i >> 8, z0 + ((i >> 4) & 15)]); if (RSW[bi]) (this.rsWake || (this.rsWake = [])).push([x0 + (i & 15), i >> 8, z0 + ((i >> 4) & 15)]); }
      c.generated = true; this.lightChunk(c); return;
    }
    const blocks = c.blocks;
    const nz = this.noise;
    const rnd = mulberry32((this.seed ^ Math.imul(c.cx, 73856093) ^ Math.imul(c.cz, 19349663)) >>> 0);

    // barlang-zaj durva rácson (4 blokkonként), trilineáris interpoláció
    const GX = 5, GY = (H >> 2) + 2, GZ = 5;
    const ga = new Float32Array(GX * GY * GZ), gb = new Float32Array(GX * GY * GZ), gc = new Float32Array(GX * GY * GZ);
    for (let gy = 0; gy < GY; gy++) for (let gz = 0; gz < GZ; gz++) for (let gx = 0; gx < GX; gx++) {
      const wx = x0 + gx * 4, wy = gy * 4, wz = z0 + gz * 4, gi = (gy * GZ + gz) * GX + gx;
      ga[gi] = nz.n3(wx * 0.032, wy * 0.052, wz * 0.032);
      gb[gi] = nz.n3(wx * 0.032 + 100.5, wy * 0.052 + 33.1, wz * 0.032 + 100.5);
      gc[gi] = nz.n3(wx * 0.016 - 50, wy * 0.034, wz * 0.016 + 77);
    }
    const lerp = (a, b, t) => a + (b - a) * t;
    function samp(g, x, y, z) {
      const fx = x / 4, fy = y / 4, fz = z / 4;
      const ix = fx | 0, iy = fy | 0, iz = fz | 0, tx = fx - ix, ty = fy - iy, tz = fz - iz;
      const i = (iy * GZ + iz) * GX + ix;
      const a = lerp(lerp(g[i], g[i + 1], tx), lerp(g[i + GX], g[i + GX + 1], tx), tz);
      const j = i + GZ * GX;
      const b = lerp(lerp(g[j], g[j + 1], tx), lerp(g[j + GX], g[j + GX + 1], tx), tz);
      return lerp(a, b, ty);
    }
    let maxY = 0;
    for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
      const { h, biome } = cols[(z << 4) | x];
      const wx = x0 + x, wz = z0 + z;
      const dirtDepth = 3 + ((hash2(wx, wz, 5) * 2) | 0);
      let surface = B.GRASS, sub = B.DIRT;
      switch (biome) {
        case BIOME.DESERT: surface = B.SAND; sub = B.SAND; break;
        case BIOME.BEACH: surface = B.SAND; sub = B.SAND; break;
        case BIOME.SNOWY: surface = B.SNOW_GRASS; break;
        case BIOME.OCEAN: {
          const gv = nz.n2(wx * 0.08, wz * 0.08);
          surface = h > SEA - 14 ? (gv > 0.25 ? B.GRAVEL : B.SAND) : (gv > 0 ? B.GRAVEL : B.DIRT);
          if (h > SEA - 9 && h < SEA - 1 && nz.n2(wx * 0.07 + 50, wz * 0.07) > 0.4) surface = B.CLAY;
          sub = surface === B.SAND ? B.SAND : B.DIRT; break;
        }
        case BIOME.MOUNTAIN:
          if (h > 102 + nz.n2(wx * 0.1, wz * 0.1) * 5) { surface = B.SNOW; sub = B.STONE; }
          else if (h > 86) { surface = B.STONE; sub = B.STONE; }
          else if (nz.n2(wx * 0.07, wz * 0.07) > 0.35) { surface = B.GRAVEL; sub = B.STONE; }
          break;
      }
      const top = Math.min(h, H - 1);
      for (let y = 0; y <= top; y++) {
        let id;
        if (y === 0) id = B.BEDROCK;
        else if (y < 4 && rnd() < (4 - y) * 0.22) id = B.BEDROCK;
        else if (y === h) id = surface;
        else if (y > h - dirtDepth && sub !== B.STONE) id = sub;
        else if (biome === BIOME.DESERT && y > h - dirtDepth - 3) id = B.SANDSTONE;
        else if (y < 12 + ((hash2(wx, wz, 9) * 4) | 0) - 1) id = B.DEEPSLATE;
        else id = B.STONE;
        if (id !== B.BEDROCK && y > 0 && y < h - 1) {
          // barlangok
          const a = samp(ga, x, y, z), b = samp(gb, x, y, z);
          let carve = a * a + b * b < 0.0105;
          if (!carve && y < 56) carve = samp(gc, x, y, z) > 0.6;
          if (carve && (y < h - 3 || (h > SEA + 2 && y < h - 1 && a * a + b * b < 0.004))) {
            id = y <= 9 ? B.LAVA : B.AIR;
          }
        }
        blocks[idx(x, y, z)] = id;
      }
      // víz
      if (h < SEA) {
        for (let y = h + 1; y <= SEA; y++) blocks[idx(x, y, z)] = B.WATER;
        if (biome === BIOME.OCEAN && nz.n2(wx * 0.05, wz * 0.05) < -0.35 && h < SEA - 3) { /* jégtábla helye – kihagyva */ }
      }
      if (biome === BIOME.SNOWY && h < SEA) blocks[idx(x, SEA, z)] = B.ICE;
      if (biome === BIOME.OCEAN && h < SEA - 1 && false) blocks[idx(x, SEA, z)] = B.ICE;
      maxY = Math.max(maxY, h, SEA);
    }
    // ércek
    const ORES = [
      { a: B.COAL_ORE, d: B.D_COAL, lo: 5, hi: 100, tries: 22, size: 9 },
      { a: B.IRON_ORE, d: B.D_IRON, lo: 4, hi: 64, tries: 14, size: 6 },
      { a: B.GOLD_ORE, d: B.D_GOLD, lo: 4, hi: 30, tries: 3, size: 5 },
      { a: B.DIAMOND_ORE, d: B.D_DIAMOND, lo: 4, hi: 16, tries: 3, size: 4 },
      { a: B.COPPER_ORE, d: B.D_COPPER, lo: 5, hi: 90, tries: 12, size: 7 },
      { a: B.LAPIS_ORE, d: B.D_LAPIS, lo: 3, hi: 30, tries: 3, size: 5 },
      { a: B.REDSTONE_ORE, d: B.D_REDSTONE, lo: 3, hi: 16, tries: 6, size: 6 },
      { a: B.ANDESITE, d: 0, lo: 5, hi: 90, tries: 3, size: 26 },
      { a: B.GRANITE, d: 0, lo: 5, hi: 90, tries: 3, size: 26 },
      { a: B.DIORITE, d: 0, lo: 5, hi: 90, tries: 3, size: 26 },
    ];
    for (const o of ORES) for (let t = 0; t < o.tries; t++) {
      let px = (rnd() * 16) | 0, pz = (rnd() * 16) | 0, py = o.lo + ((rnd() * (o.hi - o.lo)) | 0);
      for (let s = 0; s < o.size; s++) {
        if (px >= 0 && px < 16 && pz >= 0 && pz < 16 && py > 0 && py < H) {
          const i = idx(px, py, pz), cur = blocks[i];
          if (cur === B.STONE) blocks[i] = o.a; else if (cur === B.DEEPSLATE && o.d) blocks[i] = o.d;
        }
        px += ((rnd() * 3) | 0) - 1; py += ((rnd() * 3) | 0) - 1; pz += ((rnd() * 3) | 0) - 1;
      }
    }
    if (cols[(8 << 4) | 8].biome === BIOME.MOUNTAIN) for (let t = 0; t < 4; t++) {
      const px = (rnd() * 16) | 0, pz = (rnd() * 16) | 0, py = 10 + ((rnd() * 80) | 0), i = idx(px, py, pz);
      if (blocks[i] === B.STONE) blocks[i] = B.EMERALD_ORE;
    }
    // gravel/dirt foltok a föld alatt
    for (let t = 0; t < 6; t++) {
      let px = (rnd() * 16) | 0, pz = (rnd() * 16) | 0, py = 20 + ((rnd() * 50) | 0);
      const kind = rnd() < 0.5 ? B.GRAVEL : B.DIRT;
      for (let s = 0; s < 14; s++) {
        if (px >= 0 && px < 16 && pz >= 0 && pz < 16 && py > 0 && py < H && blocks[idx(px, py, pz)] === B.STONE) blocks[idx(px, py, pz)] = kind;
        px += ((rnd() * 3) | 0) - 1; py += ((rnd() * 3) | 0) - 1; pz += ((rnd() * 3) | 0) - 1;
      }
    }
    // növények, fák, kaktuszok (a szomszéd chunkok fái is belenyúlnak)
    const setIf = (x, y, z, id, onlyAir) => {
      if (x < 0 || x > 15 || z < 0 || z > 15 || y < 0 || y >= H) return;
      const i = idx(x, y, z), cur = blocks[i];
      if (onlyAir ? (cur === B.AIR || cur === B.TALLGRASS || cur === B.DANDELION || cur === B.POPPY) : (cur === B.AIR || cur === B.TALLGRASS || cur === B.DANDELION || cur === B.POPPY || BLOCKS[cur].shape === 'cross' || cur === B.LEAVES || cur === B.BIRCH_LEAVES || cur === B.SPRUCE_LEAVES)) {
        blocks[i] = id; if (y > maxY) maxY = y;
      }
    };
    for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
      const { h, biome } = cols[(z << 4) | x];
      if (h <= SEA || h >= H - 12) continue;
      const wx = x0 + x, wz = z0 + z, r = hash2(wx, wz, 77);
      const ground = blocks[idx(x, h, z)];
      if (ground === B.GRASS) {
        const t = biome === BIOME.FOREST || biome === BIOME.BIRCH ? 0.10 : biome === BIOME.PLAINS ? 0.22 : 0.05;
        if (r < t) blocks[idx(x, h + 1, z)] = B.TALLGRASS;
        else if (r < t + 0.012 && biome === BIOME.PLAINS) blocks[idx(x, h + 1, z)] = r < t + 0.006 ? B.DANDELION : B.POPPY;
        else if (r < t + 0.006) blocks[idx(x, h + 1, z)] = B.DANDELION;
        const rp = hash2(wx, wz, 555);
        if (rp < 0.0014 && biome === BIOME.PLAINS) blocks[idx(x, h + 1, z)] = B.PUMPKIN; else if (rp < 0.0012 && biome === BIOME.BIRCH) blocks[idx(x, h + 1, z)] = B.MELON;
        if (blocks[idx(x, h + 1, z)]) maxY = Math.max(maxY, h + 1);
      }
    }
    for (let tz = -4; tz < CS + 4; tz++) for (let tx = -4; tx < CS + 4; tx++) {
      const wx = x0 + tx, wz = z0 + tz;
      const info = (tx >= 0 && tx < CS && tz >= 0 && tz < CS) ? cols[(tz << 4) | tx] : this.column(wx, wz);
      const { h, biome } = info;
      if (h <= SEA || h > 96) continue;
      const r = hash2(wx, wz, 1234);
      let kind = null;
      if (biome === BIOME.FOREST) { if (r < 0.045) kind = 'oak'; else if (r < 0.052) kind = 'birch'; }
      else if (biome === BIOME.BIRCH) { if (r < 0.04) kind = 'birch'; else if (r < 0.046) kind = 'oak'; }
      else if (biome === BIOME.PLAINS) { if (r < 0.0035) kind = 'oak'; }
      else if (biome === BIOME.SNOWY) { if (r < 0.018) kind = 'spruce'; }
      else if (biome === BIOME.MOUNTAIN) { if (r < 0.006 && h < 90) kind = 'spruce'; }
      else if (biome === BIOME.DESERT) { if (r < 0.006) kind = 'cactus'; }
      if (!kind) continue;
      const tr = mulberry32((hash2(wx, wz, 4321) * 4294967296) >>> 0);
      const lx = tx, lz = tz;
      if (kind === 'cactus') {
        const ht = 1 + ((tr() * 3) | 0);
        for (let k = 1; k <= ht; k++) setIf(lx, h + k, lz, B.CACTUS, true);
        continue;
      }
      if (kind === 'oak' || kind === 'birch') {
        const trunk = kind === 'oak' ? 4 + ((tr() * 3) | 0) : 5 + ((tr() * 3) | 0);
        const LOGB = kind === 'oak' ? B.LOG : B.BIRCH_LOG, LEAF = kind === 'oak' ? B.LEAVES : B.BIRCH_LEAVES;
        const top = h + trunk;
        for (let dy = -2; dy <= 1; dy++) {
          const rad = dy <= -1 ? 2 : 1;
          for (let dz = -rad; dz <= rad; dz++) for (let dx = -rad; dx <= rad; dx++) {
            const corner = Math.abs(dx) === rad && Math.abs(dz) === rad;
            if (corner && (dy >= 0 || tr() < 0.5)) continue;
            if (dy === 1 && corner) continue;
            if (dx === 0 && dz === 0 && dy <= 0) continue;
            setIf(lx + dx, top + dy, lz + dz, LEAF, true);
          }
        }
        for (let k = 1; k <= trunk; k++) setIf(lx, h + k, lz, LOGB, false);
      } else {
        const trunk = 6 + ((tr() * 4) | 0), top = h + trunk;
        const radii = [0, 1, 2, 1, 2, 3, 2, 3];
        for (let k = 0; k < Math.min(trunk - 1, 8); k++) {
          const rad = radii[k], y = top + 1 - k;
          for (let dz = -rad; dz <= rad; dz++) for (let dx = -rad; dx <= rad; dx++) {
            if (Math.abs(dx) + Math.abs(dz) > rad + (rad > 1 ? 0 : 0) + (rad >= 2 ? 1 : 0)) continue;
            if (dx === 0 && dz === 0 && y <= top) continue;
            setIf(lx + dx, y, lz + dz, B.SPRUCE_LEAVES, true);
          }
        }
        for (let k = 1; k <= trunk; k++) setIf(lx, h + k, lz, B.SPRUCE_LOG, false);
      }
    }
    c.maxY = Math.min(H - 1, maxY + 1);
    if (genStronghold(this, c)) c.maxY = Math.max(c.maxY, 40);
    if (genVillage(this, c, cols)) c.maxY = Math.max(c.maxY, 90);
    c.generated = true;
    this.lightChunk(c);
  }

  // ---------- fény ----------
  lightChunk(c) {
    const { blocks, sky, blk } = c;
    sky.fill(0); blk.fill(0);
    const x0 = c.cx * CS, z0 = c.cz * CS;
    const qs = [], qb = [];
    for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
      let L = 15;
      for (let y = H - 1; y >= 0; y--) {
        const i = idx(x, y, z), op = OP[blocks[i]];
        if (op >= 15) L = 0; else if (op > 0 && L > 0) L = Math.max(0, L - op);
        sky[i] = L;
        if (EM[blocks[i]] > 0) { blk[i] = EM[blocks[i]]; qb.push(x0 + x, y, z0 + z); }
        if (L === 0 && y < c.maxY - 40) { /* mélyben nincs égi fény */ }
      }
    }
    // égi fény magok: ahol a szomszéd oszlop sötétebb
    for (let y = 0; y <= Math.min(H - 1, c.maxY + 1); y++) for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
      const i = idx(x, y, z), s = sky[i];
      if (s < 2) continue;
      let seed = false;
      for (let d = 0; d < 4 && !seed; d++) {
        const nx = x + DIRS[d === 0 ? 0 : d === 1 ? 1 : d === 2 ? 4 : 5][0], nz2 = z + DIRS[d === 0 ? 0 : d === 1 ? 1 : d === 2 ? 4 : 5][2];
        if (nx >= 0 && nx < 16 && nz2 >= 0 && nz2 < 16) {
          const j = idx(nx, y, nz2);
          if (OP[blocks[j]] < 15 && sky[j] < s - 1) seed = true;
        } else {
          const wx = x0 + nx, wz = z0 + nz2;
          const nc = this.chunks.get(ckey(wx >> 4, wz >> 4));
          if (nc && nc.generated) { const j = idx(wx & 15, y, wz & 15); if (OP[nc.blocks[j]] < 15 && nc.sky[j] < s - 1) seed = true; }
        }
      }
      if (seed) qs.push(x0 + x, y, z0 + z);
    }
    // a szomszéd chunkok határ-cellái felénk
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = this.chunks.get(ckey(c.cx + dx, c.cz + dz)); if (!nc || !nc.generated) continue;
      for (let y = 0; y < H; y++) for (let k = 0; k < 16; k++) {
        const lx = dx === 1 ? 15 : dx === -1 ? 0 : k, lz = dz === 1 ? 15 : dz === -1 ? 0 : k;
        const i = idx(lx, y, lz);
        if (nc.sky[i] > 1) qs.push(nc.cx * 16 + lx, y, nc.cz * 16 + lz);
        if (nc.blk[i] > 1) qb.push(nc.cx * 16 + lx, y, nc.cz * 16 + lz);
      }
    }
    this.propagate(qs, true);
    this.propagate(qb, false);
    c.dirty = true;
  }

  propagate(q, isSky) {
    let h = 0;
    while (h < q.length) {
      const x = q[h++], y = q[h++], z = q[h++];
      const cc = this.chunks.get(ckey(x >> 4, z >> 4)); if (!cc) continue;
      const arr = isSky ? cc.sky : cc.blk;
      const l = arr[idx(x & 15, y, z & 15)];
      if (l <= 1) continue;
      for (let d = 0; d < 6; d++) {
        const nx = x + DIRS[d][0], ny = y + DIRS[d][1], nz = z + DIRS[d][2];
        if (ny < 0 || ny >= H) continue;
        const nc = this.chunks.get(ckey(nx >> 4, nz >> 4)); if (!nc || !nc.generated) continue;
        const bi = idx(nx & 15, ny, nz & 15), op = OP[nc.blocks[bi]];
        if (op >= 15) continue;
        const t = (isSky && d === 3 && l === 15 && op === 0) ? 15 : l - Math.max(1, op);
        const na = isSky ? nc.sky : nc.blk;
        if (t > na[bi]) { na[bi] = t; this.markDirty(nx, ny, nz); q.push(nx, ny, nz); }
      }
    }
  }

  removeLight(x, y, z, isSky) {
    const cc = this.chunks.get(ckey(x >> 4, z >> 4)); if (!cc) return;
    const arr0 = isSky ? cc.sky : cc.blk, i0 = idx(x & 15, y, z & 15), l0 = arr0[i0];
    if (!l0) return;
    arr0[i0] = 0; this.markDirty(x, y, z);
    const rq = [x, y, z, l0], aq = [];
    let h = 0;
    while (h < rq.length) {
      const px = rq[h++], py = rq[h++], pz = rq[h++], l = rq[h++];
      for (let d = 0; d < 6; d++) {
        const nx = px + DIRS[d][0], ny = py + DIRS[d][1], nz = pz + DIRS[d][2];
        if (ny < 0 || ny >= H) continue;
        const nc = this.chunks.get(ckey(nx >> 4, nz >> 4)); if (!nc || !nc.generated) continue;
        const na = isSky ? nc.sky : nc.blk, bi = idx(nx & 15, ny, nz & 15), nl = na[bi];
        if (nl !== 0 && (nl < l || (isSky && d === 3 && l === 15))) {
          na[bi] = 0; this.markDirty(nx, ny, nz); rq.push(nx, ny, nz, nl);
        } else if (nl >= l) aq.push(nx, ny, nz);
      }
    }
    this.propagate(aq, isSky);
  }

  setBlock(x, y, z, id, silent) {
    if (y < 0 || y >= H) return false;
    const c = this.chunks.get(ckey(x >> 4, z >> 4)); if (!c || !c.generated) return false;
    const i = idx(x & 15, y, z & 15), old = c.blocks[i];
    if (old === id) return false;
    c.blocks[i] = id; c.modified = true; if (this.onSet && !this.suppress) this.onSet(x, y, z, id);
    if (TICKS[old] || TICKS[id]) { const tk = x + ',' + y + ',' + z; if (TICKS[id]) this.ticking.add(tk); else this.ticking.delete(tk); } if (id && y > c.maxY) c.maxY = Math.min(H - 1, y + 1);
    this.markDirty(x, y, z);
    if (this.fluidHook) this.fluidHook(x, y, z, old, id);
    if (this.rsHook) this.rsHook(x, y, z, old, id);
    if (!silent) {
      const oldOp = OP[old], newOp = OP[id];
      if (EM[old] > 0 || newOp > oldOp) this.removeLight(x, y, z, false);
      if (newOp > oldOp) this.removeLight(x, y, z, true);
      const qs = [], qb = [];
      if (newOp < 15) {
        let cand = 0;
        for (let d = 0; d < 6; d++) {
          const nx = x + DIRS[d][0], ny = y + DIRS[d][1], nz = z + DIRS[d][2];
          let s = this.getSky(nx, ny, nz);
          if (d === 2 && s === 15 && newOp === 0) { cand = 15; break; }
          s -= Math.max(1, newOp); if (s > cand) cand = s;
        }
        if (cand > c.sky[i]) { c.sky[i] = cand; qs.push(x, y, z); }
        let cb = 0;
        for (let d = 0; d < 6; d++) {
          const b2 = this.getBlk(x + DIRS[d][0], y + DIRS[d][1], z + DIRS[d][2]) - Math.max(1, newOp);
          if (b2 > cb) cb = b2;
        }
        if (cb > c.blk[i]) { c.blk[i] = cb; qb.push(x, y, z); }
      }
      if (EM[id] > 0 && c.blk[i] < EM[id]) { c.blk[i] = EM[id]; qb.push(x, y, z); }
      this.propagate(qs, true); this.propagate(qb, false);
    }
    return true;
  }

  // ---------- szerializálás ----------
  static rle(arr) {
    const out = []; let v = arr[0], n = 1;
    for (let i = 1; i < arr.length; i++) {
      if (arr[i] === v && n < 255) n++; else { out.push(v, n); v = arr[i]; n = 1; }
    }
    out.push(v, n);
    let s = ''; for (let i = 0; i < out.length; i += 4096) s += String.fromCharCode.apply(null, out.slice(i, i + 4096));
    return btoa(s);
  }
  static unrle(str) {
    const s = atob(str), out = new Uint8Array(CS * CS * H);
    let p = 0;
    for (let i = 0; i < s.length; i += 2) { const v = s.charCodeAt(i), n = s.charCodeAt(i + 1); out.fill(v, p, p + n); p += n; }
    return out;
  }
  collectModified() {
    const res = {};
    for (const c of this.chunks.values()) if (c.modified && c.generated) this.stash.set(ckey(c.cx, c.cz), c.blocks.slice());
    for (const [k, v] of this.stash) res[k] = World.rle(v);
    return res;
  }
}
