// Ütközésvizsgálat és mozgatás (AABB) – játékos, mobok, tárgyak közös
import { B, SOLID, BLOCKS, FK } from './blocks.js';
import { blockBoxes, fenceMask, BOXSHAPES } from './content.js';

const EPS = 1e-4;
export function boxHits(world, x0, y0, z0, x1, y1, z1) {
  const ix0 = Math.floor(x0), ix1 = Math.floor(x1 - EPS), iy0 = Math.floor(y0), iy1 = Math.floor(y1 - EPS), iz0 = Math.floor(z0), iz1 = Math.floor(z1 - EPS);
  for (let y = iy0 - 1; y <= iy1; y++) for (let z = iz0; z <= iz1; z++) for (let x = ix0; x <= ix1; x++) {
    const id = world.getBlock(x, y, z);
    if (y < iy0) { // a kerítés / kapu 1,5 magas: az alatta lévő cella tetejét is ellenőrizzük
      if (id && (BLOCKS[id].shape === 'fence' || BLOCKS[id].shape === 'gate') && SOLID[id]) {
        const boxes = blockBoxes(id, world.facing.get(x + ',' + y + ',' + z), BLOCKS[id].shape === 'fence' ? fenceMask((a, b, c) => world.getBlock(a, b, c), x, y, z) : 0, true);
        for (const bx of boxes) if (x1 > x + bx[0] && x0 < x + bx[3] && y1 > y + bx[1] && y0 < y + bx[4] && z1 > z + bx[2] && z0 < z + bx[5]) return true;
      }
      continue;
    }
    if (SOLID[id]) {
      if (id === B.CACTUS) {
        if (x1 > x + 1 / 16 && x0 < x + 15 / 16 && z1 > z + 1 / 16 && z0 < z + 15 / 16) return true; else continue;
      }
      const sh = BLOCKS[id].shape;
      if (BOXSHAPES.has(sh)) {
        const boxes = blockBoxes(id, world.facing.get(x + ',' + y + ',' + z), sh === 'fence' ? fenceMask((a, b, c) => world.getBlock(a, b, c), x, y, z) : 0, true);
        for (const bx of boxes) if (x1 > x + bx[0] && x0 < x + bx[3] && y1 > y + bx[1] && y0 < y + bx[4] && z1 > z + bx[2] && z0 < z + bx[5]) return true;
        continue;
      }
      return true;
    }
  }
  return false;
}

// a lábunk alatti legmagasabb támasz felső síkja (lapok, lépcsők, kerítés pontos leszálláshoz)
function supportTop(world, x0, y0, z0, x1, z1) {
  let best = null;
  const ix0 = Math.floor(x0), ix1 = Math.floor(x1 - EPS), iz0 = Math.floor(z0), iz1 = Math.floor(z1 - EPS), iy = Math.floor(y0);
  for (let y = iy - 1; y <= iy; y++) for (let z = iz0; z <= iz1; z++) for (let x = ix0; x <= ix1; x++) {
    const id = world.getBlock(x, y, z); if (!SOLID[id]) continue;
    const sh = BLOCKS[id].shape;
    if (id === B.CACTUS) continue;
    const boxes = BOXSHAPES.has(sh) ? blockBoxes(id, world.facing.get(x + ',' + y + ',' + z), sh === 'fence' ? fenceMask((a, b, c) => world.getBlock(a, b, c), x, y, z) : 0, true) : [[0, 0, 0, 1, 1, 1]];
    for (const bx of boxes || []) {
      if (!(x1 > x + bx[0] && x0 < x + bx[3] && z1 > z + bx[2] && z0 < z + bx[5])) continue;
      const top = y + bx[4];
      if (top > y0 && top <= y0 + 0.6 && (best === null || top > best)) best = top;
    }
  }
  return best;
}
// kis lépcsőfokok (lap, termőföld, lépcső) automatikus fellépése
function stepUp(world, pos, hw, h, vel, grounded) {
  if (!grounded || vel[1] > 0.5 || vel[1] < -2) return false;
  if (!boxHits(world, pos[0] - hw, pos[1] - 0.03, pos[2] - hw, pos[0] + hw, pos[1], pos[2] + hw)) {
    // nincs talaj alatta -> nem lépünk
    return false;
  }
  for (const st of [0.07, 0.27, 0.52]) {
    if (!boxHits(world, pos[0] - hw, pos[1] + st, pos[2] - hw, pos[0] + hw, pos[1] + st + h, pos[2] + hw)) { pos[1] += st; return true; }
  }
  return false;
}
// pos = láb-közép, w = szélesség, h = magasság. Visszaad: {ground, hitX, hitZ, hitHead}
export function moveBox(world, pos, w, h, vel, dt, sneakEdge) {
  const hw = w / 2, res = { ground: false, hitX: false, hitZ: false, hitHead: false };
  const grounded = boxHits(world, pos[0] - hw, pos[1] - 0.03, pos[2] - hw, pos[0] + hw, pos[1], pos[2] + hw);
  let dx = vel[0] * dt, dy = vel[1] * dt, dz = vel[2] * dt;
  // nagy lépések felbontása
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) / 0.4));
  dx /= steps; dy /= steps; dz /= steps;
  for (let s = 0; s < steps; s++) {
    // Y
    if (dy !== 0) {
      pos[1] += dy;
      if (boxHits(world, pos[0] - hw, pos[1], pos[2] - hw, pos[0] + hw, pos[1] + h, pos[2] + hw)) {
        if (dy < 0) { const st = supportTop(world, pos[0] - hw, pos[1], pos[2] - hw, pos[0] + hw, pos[2] + hw); pos[1] = st !== null ? st : Math.floor(pos[1]) + 1; res.ground = true; } else { pos[1] = Math.floor(pos[1] + h - EPS) - h - EPS * 2; res.hitHead = true; }
        vel[1] = 0; dy = 0;
      }
    }
    // X
    if (dx !== 0) {
      const old = pos[0]; pos[0] += dx;
      if (boxHits(world, pos[0] - hw, pos[1], pos[2] - hw, pos[0] + hw, pos[1] + h, pos[2] + hw)) {
        if (!stepUp(world, pos, hw, h, vel, grounded)) { pos[0] = old; vel[0] = 0; dx = 0; res.hitX = true; }
      }
      else if (sneakEdge && !boxHits(world, pos[0] - hw, pos[1] - 0.6, pos[2] - hw, pos[0] + hw, pos[1] - 0.01, pos[2] + hw) && sneakEdge.ground) { pos[0] = old; dx = 0; }
    }
    // Z
    if (dz !== 0) {
      const old = pos[2]; pos[2] += dz;
      if (boxHits(world, pos[0] - hw, pos[1], pos[2] - hw, pos[0] + hw, pos[1] + h, pos[2] + hw)) {
        if (!stepUp(world, pos, hw, h, vel, grounded)) { pos[2] = old; vel[2] = 0; dz = 0; res.hitZ = true; }
      }
      else if (sneakEdge && !boxHits(world, pos[0] - hw, pos[1] - 0.6, pos[2] - hw, pos[0] + hw, pos[1] - 0.01, pos[2] + hw) && sneakEdge.ground) { pos[2] = old; dz = 0; }
    }
  }
  return res;
}

// Voxel-DDA sugár: visszaad {x,y,z,nx,ny,nz,id,dist} vagy null
export function raycast(world, ox, oy, oz, dx, dy, dz, maxDist, pickLiquid = false) {
  let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
  const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
  const tdx = dx !== 0 ? Math.abs(1 / dx) : Infinity, tdy = dy !== 0 ? Math.abs(1 / dy) : Infinity, tdz = dz !== 0 ? Math.abs(1 / dz) : Infinity;
  let tx = dx !== 0 ? ((dx > 0 ? x + 1 - ox : ox - x) * tdx) : Infinity;
  let ty = dy !== 0 ? ((dy > 0 ? y + 1 - oy : oy - y) * tdy) : Infinity;
  let tz = dz !== 0 ? ((dz > 0 ? z + 1 - oz : oz - z) * tdz) : Infinity;
  let nx = 0, ny = 0, nz = 0, t = 0;
  for (let i = 0; i < 200; i++) {
    const id = world.getBlock(x, y, z);
    if (id && (pickLiquid ? true : !FK[id])) {
      const th = BLOCKS[id].thin;
      if (!th) return { x, y, z, nx, ny, nz, id, dist: t };
      // vékony lapok (redstone por, nyomólap): csak a tényleges vékony réteget találjuk el
      if (oy + dy * t <= y + th + 1e-6) return { x, y, z, nx, ny, nz, id, dist: t };
      if (dy < 0) { const tp = (oy - (y + th)) / -dy; if (tp <= Math.min(tx, ty, tz)) return { x, y, z, nx: 0, ny: 1, nz: 0, id, dist: Math.max(tp, t) }; }
    }
    if (tx < ty && tx < tz) { t = tx; if (t > maxDist) return null; x += sx; tx += tdx; nx = -sx; ny = 0; nz = 0; }
    else if (ty < tz) { t = ty; if (t > maxDist) return null; y += sy; ty += tdy; nx = 0; ny = -sy; nz = 0; }
    else { t = tz; if (t > maxDist) return null; z += sz; tz += tdz; nx = 0; ny = 0; nz = -sz; }
  }
  return null;
}

export function rayAABB(ox, oy, oz, dx, dy, dz, bx0, by0, bz0, bx1, by1, bz1) {
  let tmin = 0, tmax = Infinity;
  const o = [ox, oy, oz], d = [dx, dy, dz], lo = [bx0, by0, bz0], hi = [bx1, by1, bz1];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-9) { if (o[i] < lo[i] || o[i] > hi[i]) return -1; }
    else {
      let t1 = (lo[i] - o[i]) / d[i], t2 = (hi[i] - o[i]) / d[i];
      if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
      tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
      if (tmin > tmax) return -1;
    }
  }
  return tmin;
}
