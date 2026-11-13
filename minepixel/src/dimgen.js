// Nether és End terep, Stronghold-szoba
import { B } from './blocks.js';
import { mulberry32, hash2 } from './noise.js';

const H = 128, CS = 16, idx = (x, y, z) => (y << 8) | (z << 4) | x;
const sm = t => t * t * (3 - 2 * t);
function lat(x, y, z, s) { // rácspont-érték 0..1
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 2147483647) ^ Math.imul(s | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296;
}
function n3(x, y, z, s) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), fx = sm(x - xi), fy = sm(y - yi), fz = sm(z - zi);
  const L = (a, b, c) => lat(xi + a, yi + b, zi + c, s), mix = (a, b, t) => a + (b - a) * t;
  return mix(mix(mix(L(0, 0, 0), L(1, 0, 0), fx), mix(L(0, 1, 0), L(1, 1, 0), fx), fy), mix(mix(L(0, 0, 1), L(1, 0, 1), fx), mix(L(0, 1, 1), L(1, 1, 1), fx), fy), fz);
}
const fbm = (x, y, z, s) => n3(x, y, z, s) * 0.6 + n3(x * 2.1, y * 2.1, z * 2.1, s + 7) * 0.28 + n3(x * 4.3, y * 4.3, z * 4.3, s + 13) * 0.12;

export function genNether(world, c) {
  const bl = c.blocks, s = world.seed, x0 = c.cx * CS, z0 = c.cz * CS, rnd = mulberry32((s ^ Math.imul(c.cx, 73856093) ^ Math.imul(c.cz, 19349663)) >>> 0);
  for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
    const wx = x0 + x, wz = z0 + z, soul = n3(wx / 14, 0, wz / 14, s + 3) > 0.68, grav = n3(wx / 10, 5, wz / 10, s + 5) > 0.72;
    for (let y = 0; y < H; y++) {
      let id = 0;
      if (y <= 3 || y >= 124) id = (y <= 0 || y >= 127 || rnd() < (y <= 3 ? (4 - y) * 0.25 : (y - 123) * 0.25)) ? B.BEDROCK : B.NETHERRACK;
      else {
        const t = 0.5 + 0.75 * Math.pow(Math.abs(y - 64) / 60, 2);
        if (fbm(wx / 22, y / 13, wz / 22, s) > t) id = B.NETHERRACK;
        else if (y <= 31) id = B.LAVA;
      }
      bl[idx(x, y, z)] = id;
    }
  }
  // felszíni díszek: lélekhomok, kavics, kvarc, izzókő
  for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) for (let y = 4; y < 123; y++) {
    const i = idx(x, y, z), id = bl[i]; if (id !== B.NETHERRACK) continue;
    const up = bl[idx(x, y + 1, z)], dn = bl[idx(x, y - 1, z)];
    if (up === 0 && y < 60 && n3((x0 + x) / 12, y / 8, (z0 + z) / 12, s + 3) > 0.66) bl[i] = B.SOUL_SAND;
    else if (up === 0 && n3((x0 + x) / 10, 9, (z0 + z) / 10, s + 5) > 0.74) bl[i] = B.GRAVEL;
    else if (rnd() < 0.012 && (up === 0 || dn === 0 || bl[idx(x, y, Math.min(15, z + 1))] === 0)) bl[i] = B.NQ_ORE;
    else if (dn === 0 && y > 70 && rnd() < 0.012) { // izzókő-fürt a mennyezetről
      bl[i] = B.GLOWSTONE; for (let k = 0; k < 6; k++) { const xx = x + ((rnd() * 3) | 0) - 1, zz = z + ((rnd() * 3) | 0) - 1, yy = y - ((rnd() * 3) | 0); if (xx >= 0 && xx < 16 && zz >= 0 && zz < 16 && bl[idx(xx, yy, zz)] === 0) bl[idx(xx, yy, zz)] = B.GLOWSTONE; }
    }
  }
  if (hash2(c.cx, c.cz, s + 99) < 0.08) { // Nether-erőd: tégla szoba pillérekkel
    const y0 = 60 + ((hash2(c.cx, c.cz, s + 5) * 10) | 0), NB = B.NETHER_BRICKS, set = (x, y, z, id) => { bl[idx(x, y, z)] = id; };
    for (let z = 1; z <= 14; z++) for (let x = 1; x <= 14; x++) {
      const edge = x === 1 || x === 14 || z === 1 || z === 14;
      set(x, y0, z, NB);
      for (let y = y0 + 1; y <= y0 + 5; y++) set(x, y, z, edge && !((x === 7 || x === 8 || z === 7 || z === 8) && y <= y0 + 3) ? NB : 0);
      if (!edge && (x % 4 === 3) && (z % 4 === 3)) for (let y = y0 + 1; y <= y0 + 5; y++) set(x, y, z, NB);
      if (z % 2 === 0 || x % 2 === 0) set(x, y0 + 6, z, NB);
    }
    for (const [x, z] of [[1, 1], [14, 1], [1, 14], [14, 14], [7, 7]]) for (let y = y0 - 1; y > 30; y--) { if (bl[idx(x, y, z)] === B.NETHERRACK) break; set(x, y, z, NB); }
    c.maxY = H - 1;
  }
  c.maxY = H - 1;
}

export const DRAGON_C = [0, 0];
export function genEnd(world, c) {
  const bl = c.blocks, s = world.seed, x0 = c.cx * CS, z0 = c.cz * CS;
  for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
    const wx = x0 + x, wz = z0 + z, d = Math.hypot(wx, wz);
    let top = -1, dep = 0;
    if (d < 46) { top = 64 - ((d * 0.06) | 0); dep = Math.round(14 * Math.sqrt(1 - (d / 46) ** 2)) + 2; }
    else if (d > 110 && n3(wx / 36, 0, wz / 36, s + 9) > 0.64) { const v = n3(wx / 36, 0, wz / 36, s + 9); top = 58 + ((v * 12) | 0); dep = 3 + ((v - 0.64) * 60 | 0); }
    if (top >= 0) for (let y = top - dep + 1; y <= top; y++) bl[idx(x, y, z)] = B.END_STONE;
  }
  // obszidián oszlopok
  for (let k = 0; k < 10; k++) {
    const a = k / 10 * Math.PI * 2, px = Math.round(Math.cos(a) * 30), pz = Math.round(Math.sin(a) * 30), r = k % 3 === 0 ? 3 : 2, h = 76 + ((k * 7) % 5) * 5;
    for (let wz = pz - r; wz <= pz + r; wz++) for (let wx = px - r; wx <= px + r; wx++) {
      if (wx < x0 || wx >= x0 + 16 || wz < z0 || wz >= z0 + 16) continue; if ((wx - px) ** 2 + (wz - pz) ** 2 > r * r + 1) continue;
      for (let y = 50; y <= h; y++) bl[idx(wx - x0, y, wz - z0)] = B.OBSIDIAN;
      bl[idx(wx - x0, h + 1, wz - z0)] = B.BEDROCK;
    }
  }
  c.maxY = 100;
}

// Stronghold: a seedből számolt hely, 12 keretes portálszoba
export function strongholdPos(seed) { const r = mulberry32((seed ^ 0x5eed1234) >>> 0), a = r() * Math.PI * 2, d = 300 + r() * 250, cx = Math.round(Math.cos(a) * d) >> 4, cz = Math.round(Math.sin(a) * d) >> 4; return [cx * 16 + 8, 26, cz * 16 + 8, cx, cz]; }
export function genStronghold(world, c) {
  const [sx, sy, sz, cx, cz] = strongholdPos(world.seed); if (c.cx !== cx || c.cz !== cz) return false;
  const bl = c.blocks, set = (x, y, z, id) => { bl[idx(x, y, z)] = id; }, r = mulberry32(world.seed ^ 0x77);
  for (let y = sy - 1; y <= sy + 6; y++) for (let z = 3; z <= 13; z++) for (let x = 3; x <= 13; x++) {
    const edge = x === 3 || x === 13 || z === 3 || z === 13 || y === sy - 1 || y === sy + 6;
    set(x, y, z, edge ? (r() < 0.2 ? B.MOSSY_STONEBRICK || B.STONEBRICK : B.STONEBRICK) : 0);
  }
  for (const [x, z] of [[4, 4], [12, 4], [4, 12], [12, 12]]) set(x, sy + 1, z, B.TORCH);
  // 3x3 portálgödör + 12 keret (3 oldalanként), a keret ugyanazon a szinten
  for (let z = 7; z <= 9; z++) for (let x = 7; x <= 9; x++) set(x, sy, z, 0);
  for (let k = 7; k <= 9; k++) { set(k, sy, 6, B.END_FRAME); set(k, sy, 10, B.END_FRAME); set(6, sy, k, B.END_FRAME); set(10, sy, k, B.END_FRAME); }
  // a szoba alatti lávatócsa dísznek
  for (let z = 5; z <= 11; z++) for (let x = 5; x <= 11; x++) if ((x < 6 || x > 10 || z < 6 || z > 10)) set(x, sy - 1, z, B.LAVA);
  c.modified = true; return true;
}

// Falu: sík helyen 2-3 ház + kút, kőpadlóval (itt jelennek meg a falusiak)
export function genVillage(world, c, cols) {
  const s = world.seed; if (hash2(c.cx, c.cz, s + 4242) > 0.05) return false;
  const bi = cols[(8 << 4) | 8].biome; if (bi !== 0 && bi !== 2 && bi !== 6 && bi !== 1) return false;
  const bl = c.blocks; let lo = 999, hi = 0; for (let i = 0; i < 256; i += 5) { const h = cols[i].h; lo = Math.min(lo, h); hi = Math.max(hi, h); }
  if (hi - lo > 8 || lo < 62) return false;
  const gy = Math.round((lo + hi) / 2), PL = B.PLANKS, LG = B.LOG, set = (x, y, z, id) => { if (x >= 0 && x < 16 && z >= 0 && z < 16) bl[idx(x, y, z)] = id; };
  for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) { for (let y = gy + 1; y < gy + 8; y++) set(x, y, z, 0); const top = x < 2 || x > 13 || z < 2 || z > 13 ? B.GRASS : B.COBBLE; if (top === B.COBBLE) { for (let y = Math.min(cols[(z << 4) | x].h, gy) - 1; y <= gy; y++) set(x, y, z, y === gy ? B.COBBLE : B.DIRT); } }
  const house = (x0, z0, w, d, door) => {
    for (let z = z0; z < z0 + d; z++) for (let x = x0; x < x0 + w; x++) {
      const edge = x === x0 || x === x0 + w - 1 || z === z0 || z === z0 + d - 1, corner = (x === x0 || x === x0 + w - 1) && (z === z0 || z === z0 + d - 1);
      set(x, gy, z, B.COBBLE);
      for (let y = gy + 1; y <= gy + 3; y++) set(x, y, z, corner ? LG : edge ? (y === gy + 2 && !corner && ((x + z) % 2 === 0) ? B.GLASS : PL) : 0);
      set(x, gy + 4, z, PL);
    }
    const dx = x0 + (w >> 1); if (door === 'n') { set(dx, gy + 1, z0, 0); set(dx, gy + 2, z0, 0); } else { set(dx, gy + 1, z0 + d - 1, 0); set(dx, gy + 2, z0 + d - 1, 0); }
    set(x0 + 1, gy + 1, z0 + 1, B.TORCH);
  };
  house(2, 2, 5, 5, 's'); house(9, 3, 6, 5, 's'); house(3, 10, 5, 4, 'n');
  for (const [x, z] of [[8, 9], [9, 9], [8, 10], [9, 10]]) { set(x, gy, z, B.COBBLE); } set(8, gy + 1, 9, B.WATER);
  c.modified = true; return true;
}
