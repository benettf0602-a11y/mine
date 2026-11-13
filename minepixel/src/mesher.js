// Chunk-mesh építése: arcelrejtés, simított fény + AO, biomszínezés, speciális alakzatok
import { B, BLOCKS, H, CS, OPAQUE, FK, FL } from './blocks.js';
import { tileUV } from './textures.js';
import { ckey } from './world.js';
import { blockBoxes, fluidHeight, fenceConn, dustMask, DIRS4 } from './content.js';

const PW = 18, PY = PW * PW;
const pb = new Uint8Array(PW * PW * H), ps = new Uint8Array(PW * PW * H), pl = new Uint8Array(PW * PW * H);
const pi = (x, y, z) => y * PY + (z + 1) * PW + x + 1;

const rgb = (r, g, b) => [r / 230, g / 230, b / 230];
const GRASS_TINT = [rgb(122, 186, 74), rgb(98, 168, 58), rgb(178, 178, 86), rgb(130, 184, 150), rgb(122, 164, 104), rgb(122, 186, 74), rgb(140, 184, 80), rgb(112, 176, 66)];
const FOLIAGE_TINT = [rgb(92, 164, 52), rgb(64, 140, 40), rgb(150, 160, 60), rgb(96, 152, 112), rgb(88, 150, 72), rgb(92, 164, 52), rgb(100, 160, 56), rgb(104, 168, 60)];
const WHITE = [1, 1, 1];
const AOF = [0.5, 0.7, 0.86, 1];

// n, sarkok (BL, BR, TR, TL), árnyalat
const FACES = [
  { n: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], shade: 0.6 },
  { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], shade: 0.6 },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], shade: 1.0 },
  { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], shade: 0.5 },
  { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], shade: 0.8 },
  { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], shade: 0.8 },
];
// csúcsonkénti AO-szomszéd eltolások
for (const F of FACES) {
  const a = F.n.findIndex(v => v !== 0), [u, v] = [0, 1, 2].filter(i => i !== a);
  F.v = F.c.map(c => {
    const du = c[u] ? 1 : -1, dv = c[v] ? 1 : -1;
    const e = (i, s) => { const o = [0, 0, 0]; o[i] = s; return o; };
    const d = o => o[1] * PY + o[2] * PW + o[0];
    return { d1: d(e(u, du)), d2: d(e(v, dv)), dc: d([e(u, du)[0] + e(v, dv)[0], e(u, du)[1] + e(v, dv)[1], e(u, du)[2] + e(v, dv)[2]]) };
  });
  F.nd = F.n[1] * PY + F.n[2] * PW + F.n[0];
}

function newBuf() { return { pos: [], uv: [], aux: [], tint: [], idx: [], n: 0 }; }
function pushQuad(buf, P, UV, AUX, tint, flip) {
  const b = buf.n;
  for (let i = 0; i < 4; i++) {
    buf.pos.push(P[i][0], P[i][1], P[i][2]); buf.uv.push(UV[i][0], UV[i][1]);
    buf.aux.push(AUX[i][0], AUX[i][1], AUX[i][2]); buf.tint.push(tint[0], tint[1], tint[2]);
  }
  if (flip) buf.idx.push(b + 1, b + 2, b + 3, b + 1, b + 3, b); else buf.idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  buf.n += 4;
}
const uvQuad = (t) => [[t[0], t[1]], [t[2], t[1]], [t[2], t[3]], [t[0], t[3]]];
const finish = buf => buf.n ? { pos: new Float32Array(buf.pos), uv: new Float32Array(buf.uv), aux: new Float32Array(buf.aux), tint: new Float32Array(buf.tint), idx: new Uint32Array(buf.idx) } : null;

function fillPadded(world, c) {
  for (let dz = -1; dz <= 16; dz++) for (let dx = -1; dx <= 16; dx++) {
    const cx = c.cx + (dx < 0 ? -1 : dx > 15 ? 1 : 0), cz = c.cz + (dz < 0 ? -1 : dz > 15 ? 1 : 0);
    const n = world.chunks.get(ckey(cx, cz)), lx = dx & 15, lz = dz & 15;
    const base = (dz + 1) * PW + dx + 1;
    if (!n || !n.generated) { for (let y = 0; y < H; y++) { pb[y * PY + base] = 0; ps[y * PY + base] = 15; pl[y * PY + base] = 0; } continue; }
    const nb = n.blocks, nsky = n.sky, nblk = n.blk;
    for (let y = 0; y < H; y++) { const s = (y << 8) | (lz << 4) | lx, o = y * PY + base; pb[o] = nb[s]; ps[o] = nsky[s]; pl[o] = nblk[s]; }
  }
}

export function meshChunk(world, c, smooth = true) {
  fillPadded(world, c);
  const S = newBuf(), PLNT = newBuf(), W = newBuf();
  const top = Math.min(H - 1, c.maxY + 1);
  const x0 = c.cx * CS, z0 = c.cz * CS;
  const AUX = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]], POS = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]], AO = [0, 0, 0, 0];

  for (let y = 0; y <= top; y++) for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
    const here = pi(x, y, z), id = pb[here];
    if (!id) continue;
    const b = BLOCKS[id], shape = b.shape;
    const biome = c.biomes[(z << 4) | x];
    const tint = b.tint === 'grass' ? GRASS_TINT[biome] : b.tint === 'foliage' ? FOLIAGE_TINT[biome] : WHITE;
    const bx = x0 + x, bz = z0 + z;

    if (shape === 'cross') {
      const t = uvQuad(tileUV(b.tex.side)), sk = ps[here] / 15, bl = pl[here] / 15;
      const A = [sk, bl, 1];
      const q1 = [[0.1, 0, 0.1], [0.9, 0, 0.9], [0.9, 1, 0.9], [0.1, 1, 0.1]], q2 = [[0.9, 0, 0.1], [0.1, 0, 0.9], [0.1, 1, 0.9], [0.9, 1, 0.1]];
      for (const q of [q1, q2]) pushQuad(PLNT, q.map(p => [bx + p[0], y + p[1], bz + p[2]]), t, [A, A, A, A], tint, false);
      continue;
    }
    if (shape === 'torch') {
      const tu = tileUV(b.tex.side), du = tu[2] - tu[0], dv = tu[3] - tu[1];
      const sideT = [tu[0] + du * 7 / 16, tu[1], tu[0] + du * 9 / 16, tu[3] - dv * 6 / 16];
      const topT = [tu[0] + du * 7 / 16, tu[3] - dv * 8 / 16, tu[0] + du * 9 / 16, tu[3] - dv * 6 / 16];
      const A = [ps[here] / 15, 1, 1];
      for (let f = 0; f < 6; f++) {
        if (f === 3) continue;
        const F = FACES[f], pts = F.c.map(cc => [bx + 7 / 16 + cc[0] * 2 / 16, y + cc[1] * 10 / 16, bz + 7 / 16 + cc[2] * 2 / 16]);
        const a2 = [A[0], A[1], F.shade > 0.9 ? 1 : 0.9];
        pushQuad(PLNT, pts, uvQuad(f === 2 ? topT : sideT), [a2, a2, a2, a2], WHITE, false);
      }
      continue;
    }
    if (shape === 'ladder') {
      const f = world.facing.get(bx + ',' + y + ',' + bz), ff = f === undefined ? 5 : f, e = 1 / 16, t = uvQuad(tileUV(b.tex.side)), sk = ps[here] / 15, bl = pl[here] / 15, A = [sk, bl, 0.9];
      const q = ff === 0 ? [[1 - e, 0, 1], [1 - e, 0, 0], [1 - e, 1, 0], [1 - e, 1, 1]] : ff === 1 ? [[e, 0, 0], [e, 0, 1], [e, 1, 1], [e, 1, 0]] : ff === 4 ? [[0, 0, 1 - e], [1, 0, 1 - e], [1, 1, 1 - e], [0, 1, 1 - e]] : [[1, 0, e], [0, 0, e], [0, 1, e], [1, 1, e]];
      pushQuad(PLNT, q.map(p => [bx + p[0], y + p[1], bz + p[2]]), t, [A, A, A, A], WHITE, false);
      continue;
    }
    if (shape === 'dust') {
      const L = id - B.DUST0, get = (a, b2, c) => world.getBlock(a, b2, c), mask = dustMask(get, bx, y, bz);
      const t = uvQuad(tileUV(b.tex.side)), k = L === 0 ? 0.3 : 0.5 + 0.5 * L / 15, tint = [k, L === 0 ? 0.02 : 0.04, L === 0 ? 0.02 : 0.04];
      const A = [ps[here] / 15, pl[here] / 15, 1], yy = y + 0.02;
      const quad = (x0, z0, x1, z1) => pushQuad(PLNT, [[bx + x0, yy, bz + z0], [bx + x1, yy, bz + z0], [bx + x1, yy, bz + z1], [bx + x0, yy, bz + z1]], t, [A, A, A, A], tint, false);
      const a0 = 6.5 / 16, a1 = 9.5 / 16;
      quad(5 / 16, 5 / 16, 11 / 16, 11 / 16);
      for (let i = 0; i < 4; i++) {
        const on = mask & (1 << i), len = mask ? (on ? 5 / 16 : 0) : 3 / 16; if (!len) continue;
        const [dx, dz] = DIRS4[i];
        if (dx) quad(dx > 0 ? 11 / 16 : 5 / 16 - len, a0, dx > 0 ? 11 / 16 + len : 5 / 16, a1); else quad(a0, dz > 0 ? 11 / 16 : 5 / 16 - len, a1, dz > 0 ? 11 / 16 + len : 5 / 16);
      }
      continue;
    }
    if (shape === 'slab' || shape === 'stairs' || shape === 'bed' || shape === 'farmland' || shape === 'door' || shape === 'fence' || shape === 'gate' || shape === 'trapdoor' || shape === 'switch' || shape === 'prop') {
      const facing = (shape === 'stairs' || shape === 'door' || shape === 'gate' || shape === 'trapdoor' || shape === 'switch' || shape === 'prop') ? world.facing.get(bx + ',' + y + ',' + bz) : undefined;
      const mask = shape === 'fence' ? (fenceConn(pb[here + 1]) ? 1 : 0) | (fenceConn(pb[here - 1]) ? 2 : 0) | (fenceConn(pb[here + PW]) ? 4 : 0) | (fenceConn(pb[here - PW]) ? 8 : 0) : 0;
      const boxes = blockBoxes(id, facing, mask);
      for (const bb of boxes) for (let f = 0; f < 6; f++) {
        const F = FACES[f], edge = f === 0 ? bb[3] === 1 : f === 1 ? bb[0] === 0 : f === 2 ? bb[4] === 1 : f === 3 ? bb[1] === 0 : f === 4 ? bb[5] === 1 : bb[2] === 0;
        let sk, bl;
        if (edge) { const ni = here + F.nd, nid = pb[ni]; if (OPAQUE[nid]) continue; sk = ps[ni]; bl = pl[ni]; } else { sk = ps[here]; bl = pl[here]; }
        const tn = bb[6] || (f === 2 ? b.tex.top : f === 3 ? b.tex.bottom : b.tex.side), tu = tileUV(tn);
        const ha = F.c[0][0] !== F.c[1][0] ? 0 : F.c[0][1] !== F.c[1][1] ? 1 : 2, va = F.c[0][0] !== F.c[3][0] ? 0 : F.c[0][1] !== F.c[3][1] ? 1 : 2;
        const pts = [], uvs = [], A = [sk / 15, bl / 15, F.shade];
        for (let v = 0; v < 4; v++) {
          const cc = F.c[v], q = [bb[0] + cc[0] * (bb[3] - bb[0]), bb[1] + cc[1] * (bb[4] - bb[1]), bb[2] + cc[2] * (bb[5] - bb[2])];
          pts.push([bx + q[0], y + q[1], bz + q[2]]);
          const uf = F.c[0][ha] === 0 ? q[ha] : 1 - q[ha], vf = F.c[0][va] === 0 ? q[va] : 1 - q[va];
          uvs.push([tu[0] + (tu[2] - tu[0]) * uf, tu[1] + (tu[3] - tu[1]) * vf]);
        }
        pushQuad(S, pts, uvs, [A, A, A, A], WHITE, false);
      }
      continue;
    }
    if (shape === 'water') {
      const above = pb[here + PY], ht = fluidHeight(id, FK[above] === 1), tt = uvQuad(tileUV(b.tex.side));
      for (let f = 0; f < 6; f++) {
        const F = FACES[f], ni = here + F.nd, nid = pb[ni];
        if (OPAQUE[nid]) continue;
        let lo = 0;
        if (FK[nid] === 1) {
          if (f >= 4 || f < 2) { // oldalfal: csak a szomszéd feletti rész látszik
            const nh = fluidHeight(nid, FK[pb[ni + PY]] === 1); if (nh >= ht) continue; lo = nh;
          } else continue;
        }
        const sk = ps[ni] / 15, bl = pl[ni] / 15, A = [sk, bl, F.shade];
        pushQuad(W, F.c.map(cc => [bx + cc[0], y + (cc[1] ? ht : lo), bz + cc[2]]), tt, [A, A, A, A], WHITE, false);
      }
      continue;
    }
    // kocka-szerű (lava, kaktusz, közönséges)
    const isLava = shape === 'lava', isCactus = shape === 'cactus';
    const above = pb[here + PY], ht = isLava ? fluidHeight(id, FK[above] === 2) : 1;
    let facing = -1;
    if (b.dir) { const f = world.facing.get(bx + ',' + y + ',' + bz); facing = f === undefined ? 5 : f; }
    for (let f = 0; f < 6; f++) {
      const F = FACES[f], ni = here + F.nd, nid = pb[ni];
      if (isCactus) { if (f === 3 || ((f === 2) && (OPAQUE[nid] || nid === id))) continue; }
      else {
        if (OPAQUE[nid]) continue;
        if (isLava && FK[nid] === 2) { if (f === 2 || f === 3 || fluidHeight(nid, FK[pb[ni + PY]] === 2) >= ht) continue; }
        else if (nid === id && b.cullSame) continue;
      }
      let tn = f === 2 ? b.tex.top : f === 3 ? b.tex.bottom : b.tex.side;
      if (b.dir && f === facing) tn = b.front;
      const tuv = uvQuad(tileUV(tn));
      const ns = ps[ni], nb2 = pl[ni];
      for (let v = 0; v < 4; v++) {
        const cc = F.c[v];
        let px2 = cc[0], py2 = cc[1] * ht, pz2 = cc[2];
        if (isCactus && f !== 2) { if (F.n[0]) px2 = cc[0] ? 15 / 16 : 1 / 16; if (F.n[2]) pz2 = cc[2] ? 15 / 16 : 1 / 16; }
        POS[v][0] = bx + px2; POS[v][1] = y + py2; POS[v][2] = bz + pz2;
        if (isLava) { AUX[v][0] = 1; AUX[v][1] = 1; AUX[v][2] = f === 3 ? 0.8 : 1; AO[v] = 3; continue; }
        let sky = ns, blk = nb2, ao = 3;
        if (smooth) {
          const V = F.v[v], i1 = ni + V.d1, i2 = ni + V.d2, ic = ni + V.dc;
          const o1 = OPAQUE[pb[i1]], o2 = OPAQUE[pb[i2]], oc = OPAQUE[pb[ic]];
          const s1 = o1 ? ns : ps[i1], s2 = o2 ? ns : ps[i2], sc = (o1 && o2) || oc ? ns : ps[ic];
          const b1 = o1 ? nb2 : pl[i1], b2 = o2 ? nb2 : pl[i2], bc = (o1 && o2) || oc ? nb2 : pl[ic];
          sky = (ns + s1 + s2 + sc) / 4; blk = (nb2 + b1 + b2 + bc) / 4;
          ao = (o1 && o2) ? 0 : 3 - (o1 + o2 + oc);
        }
        AO[v] = ao;
        AUX[v][0] = sky / 15; AUX[v][1] = blk / 15; AUX[v][2] = F.shade * AOF[ao];
      }
      const flip = AO[0] + AO[2] < AO[1] + AO[3];
      pushQuad(S, POS.map(p => p.slice()), tuv, AUX.map(a => a.slice()), tint, flip);
    }
  }
  return { solid: finish(S), plant: finish(PLNT), water: finish(W) };
}

// Egyetlen blokk modellje (kézben tartott / eldobott blokkokhoz): középpontosítva, fix fénnyel
export function blockModel(id) {
  const b = BLOCKS[id], S = newBuf();
  const A = (sh) => [1, 1, sh];
  if (b.shape === 'cross') {
    const t = uvQuad(tileUV(b.tex.side)), a = A(1);
    for (const q of [[[-0.4, -0.5, -0.4], [0.4, -0.5, 0.4], [0.4, 0.5, 0.4], [-0.4, 0.5, -0.4]], [[0.4, -0.5, -0.4], [-0.4, -0.5, 0.4], [-0.4, 0.5, 0.4], [0.4, 0.5, -0.4]]])
      pushQuad(S, q, t, [a, a, a, a], b.tint ? GRASS_TINT[0] : WHITE, false);
    return finish(S);
  }
  if (b.shape === 'torch') {
    const tu = tileUV(b.tex.side), du = tu[2] - tu[0], dv = tu[3] - tu[1];
    const sideT = [tu[0] + du * 7 / 16, tu[1], tu[0] + du * 9 / 16, tu[3] - dv * 6 / 16], topT = [tu[0] + du * 7 / 16, tu[3] - dv * 8 / 16, tu[0] + du * 9 / 16, tu[3] - dv * 6 / 16];
    for (let f = 0; f < 6; f++) {
      if (f === 3) continue;
      const F = FACES[f], pts = F.c.map(cc => [-1 / 16 + cc[0] * 2 / 16, -0.5 + cc[1] * 10 / 16, -1 / 16 + cc[2] * 2 / 16]), a = A(F.shade);
      pushQuad(S, pts, uvQuad(f === 2 ? topT : sideT), [a, a, a, a], WHITE, false);
    }
    return finish(S);
  }
  if (b.shape === 'ladder') {
    const t = uvQuad(tileUV(b.tex.side)), a = A(1);
    pushQuad(S, [[-0.5, -0.5, 0], [0.5, -0.5, 0], [0.5, 0.5, 0], [-0.5, 0.5, 0]], t, [a, a, a, a], WHITE, false);
    return finish(S);
  }
  if (b.shape === 'fence' || b.shape === 'gate' || b.shape === 'trapdoor' || b.shape === 'switch' || b.shape === 'prop') {
    const boxes = blockBoxes(id, b.shape === 'switch' ? 3 : b.shape === 'prop' ? 5 : 4, 3, false);
    for (const bb of boxes) for (let f = 0; f < 6; f++) {
      const F = FACES[f], a = A(F.shade), tu = tileUV(bb[6] || b.tex.side);
      const ha = F.c[0][0] !== F.c[1][0] ? 0 : F.c[0][1] !== F.c[1][1] ? 1 : 2, va = F.c[0][0] !== F.c[3][0] ? 0 : F.c[0][1] !== F.c[3][1] ? 1 : 2;
      const pts = [], uvs = [];
      for (let v = 0; v < 4; v++) {
        const cc = F.c[v], q = [bb[0] + cc[0] * (bb[3] - bb[0]), bb[1] + cc[1] * (bb[4] - bb[1]), bb[2] + cc[2] * (bb[5] - bb[2])];
        pts.push([q[0] - 0.5, q[1] - 0.5, q[2] - 0.5]);
        const uf = F.c[0][ha] === 0 ? q[ha] : 1 - q[ha], vf = F.c[0][va] === 0 ? q[va] : 1 - q[va];
        uvs.push([tu[0] + (tu[2] - tu[0]) * uf, tu[1] + (tu[3] - tu[1]) * vf]);
      }
      pushQuad(S, pts, uvs, [a, a, a, a], WHITE, false);
    }
    return finish(S);
  }
  if (b.shape === 'door') {
    for (let f = 0; f < 6; f++) {
      const F = FACES[f], a = A(F.shade), tn = f === 2 ? b.tex.top : f === 3 ? b.tex.bottom : b.tex.side;
      pushQuad(S, F.c.map(cc => [(cc[0] - 0.5) * 0.8, cc[1] - 0.5, (cc[2] - 0.5) * 0.16]), uvQuad(tileUV(tn)), [a, a, a, a], WHITE, false);
    }
    return finish(S);
  }
  for (let f = 0; f < 6; f++) {
    const F = FACES[f];
    let tn = f === 2 ? b.tex.top : f === 3 ? b.tex.bottom : b.tex.side;
    if (b.dir && f === 4) tn = b.front;
    const a = A(F.shade);
    pushQuad(S, F.c.map(cc => [cc[0] - 0.5, cc[1] - 0.5, cc[2] - 0.5]), uvQuad(tileUV(tn)), [a, a, a, a], b.tint === 'grass' ? GRASS_TINT[0] : b.tint === 'foliage' ? FOLIAGE_TINT[0] : WHITE, false);
  }
  return finish(S);
}
export { GRASS_TINT, FOLIAGE_TINT };
