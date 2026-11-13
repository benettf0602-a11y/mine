// Procedurális 16x16 pixel textúrák, atlasz, ikonok és HUD-sprite-ok
import { mulberry32, hashString } from './noise.js';
import { BLOCKS, ITEMS, B, TOOL_TYPES, MATS, itemDef } from './blocks.js';

export const clamp = v => v < 0 ? 0 : v > 255 ? 255 : v;
const TINT_A = 250; // alpha < 255 => biomszínezés a shaderben

export function px(d, x, y, c, a = 255) {
  if (x < 0 || y < 0 || x > 15 || y > 15) return;
  const i = (y * 16 + x) * 4; d[i] = clamp(c[0]); d[i + 1] = clamp(c[1]); d[i + 2] = clamp(c[2]); d[i + 3] = a;
}
export function fill(d, r, c, v, a = 255) {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const k = (r() * 2 - 1) * v; px(d, x, y, [c[0] + k, c[1] + k, c[2] + k], a); }
}
export function speck(d, r, n, c, v = 0, a = 255) {
  for (let i = 0; i < n; i++) { const k = (r() * 2 - 1) * v; px(d, (r() * 16) | 0, (r() * 16) | 0, [c[0] + k, c[1] + k, c[2] + k], a); }
}
export function get(d, x, y) { const i = (y * 16 + x) * 4; return [d[i], d[i + 1], d[i + 2], d[i + 3]]; }
export function shade(d, x, y, f) { const i = (y * 16 + x) * 4; d[i] = clamp(d[i] * f); d[i + 1] = clamp(d[i + 1] * f); d[i + 2] = clamp(d[i + 2] * f); }
export function rect(d, x0, y0, w, h, c, a = 255) { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) px(d, x, y, c, a); }
export function ellipse(d, r, cx, cy, rx, ry, c, v = 10) {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
    if (dx * dx + dy * dy <= 1) { const k = (r() * 2 - 1) * v; px(d, x, y, [c[0] + k, c[1] + k, c[2] + k]); }
  }
}
export function line(d, x0, y0, x1, y1, c) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= n; i++) px(d, Math.round(x0 + (x1 - x0) * i / (n || 1)), Math.round(y0 + (y1 - y0) * i / (n || 1)), c);
}

export const P = {};
const STONE = [125, 125, 125], DEEP = [78, 78, 84];
P.stone = (d, r) => { fill(d, r, STONE, 12); speck(d, r, 26, [96, 96, 96], 8); speck(d, r, 12, [150, 150, 150], 6); };
P.dirt = (d, r) => { fill(d, r, [134, 96, 67], 12); speck(d, r, 22, [100, 70, 48], 8); speck(d, r, 10, [158, 118, 84], 8); speck(d, r, 6, [120, 120, 120], 6); };
P.grass_top = (d, r) => { fill(d, r, [232, 232, 232], 14, TINT_A); speck(d, r, 20, [205, 205, 205], 6, TINT_A); };
P.grass_side = (d, r) => {
  P.dirt(d, r);
  for (let x = 0; x < 16; x++) {
    const depth = 3 + (r() < 0.45 ? 1 : 0) + (r() < 0.15 ? 1 : 0);
    for (let y = 0; y < depth; y++) { const k = (r() * 2 - 1) * 12; px(d, x, y, [232 + k, 232 + k, 232 + k], TINT_A); }
  }
};
P.grass_snow = (d, r) => {
  P.dirt(d, r);
  for (let x = 0; x < 16; x++) {
    const depth = 4 + (r() < 0.5 ? 1 : 0) + (r() < 0.2 ? 2 : 0);
    for (let y = 0; y < depth; y++) { const k = (r() * 2 - 1) * 5; px(d, x, y, [244 + k, 248 + k, 250 + k]); }
  }
};
P.snow = (d, r) => { fill(d, r, [244, 248, 250], 4); speck(d, r, 10, [225, 232, 242], 4); };
P.cobble = (d, r) => {
  const seeds = []; for (let i = 0; i < 11; i++) seeds.push([r() * 16, r() * 16, 100 + r() * 40]);
  const own = new Int8Array(256);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    let best = 1e9, bi = 0;
    for (let i = 0; i < seeds.length; i++) for (const ox of [-16, 0, 16]) for (const oy of [-16, 0, 16]) {
      const dx = x - seeds[i][0] - ox, dy = y - seeds[i][1] - oy, dd = dx * dx + dy * dy; if (dd < best) { best = dd; bi = i; }
    }
    own[y * 16 + x] = bi;
  }
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const o = own[y * 16 + x], k = (r() * 2 - 1) * 7, v = seeds[o][2];
    const edge = own[y * 16 + ((x + 1) & 15)] !== o || own[((y + 1) & 15) * 16 + x] !== o;
    px(d, x, y, edge ? [70 + k, 70 + k, 72 + k] : [v + k, v + k, v + k]);
  }
};
P.stonebrick = (d, r) => {
  fill(d, r, [122, 122, 122], 8);
  for (let x = 0; x < 16; x++) { px(d, x, 7, [84, 84, 84]); px(d, x, 15, [84, 84, 84]); px(d, x, 8, [140, 140, 140]); px(d, x, 0, [140, 140, 140]); }
  for (let y = 0; y < 7; y++) px(d, 7, y, [84, 84, 84]);
  for (let y = 8; y < 15; y++) { px(d, 3, y, [84, 84, 84]); px(d, 11, y, [84, 84, 84]); }
};
P.bricks = (d, r) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const row = (y / 4) | 0, off = row % 2 ? 4 : 0, k = (r() * 2 - 1) * 12;
    const mortar = y % 4 === 3 || (x + off) % 8 === 7;
    px(d, x, y, mortar ? [178 + k / 2, 172 + k / 2, 160 + k / 2] : [150 + k, 72 + k / 2, 56 + k / 2]);
  }
};
function planks(c, dark) {
  return (d, r) => {
    for (let y = 0; y < 16; y++) {
      const board = (y / 4) | 0, bk = (hashString('b' + c[0] + board) % 20) - 10;
      for (let x = 0; x < 16; x++) {
        const k = (r() * 2 - 1) * 6 + bk;
        px(d, x, y, y % 4 === 3 ? [dark[0] + k, dark[1] + k, dark[2] + k] : [c[0] + k, c[1] + k, c[2] + k]);
      }
    }
    for (let b = 0; b < 4; b++) { const sx = (hashString('s' + c[0] + b) % 14) + 1; for (let y = b * 4; y < b * 4 + 3; y++) px(d, sx, y, dark); }
  };
}
P.planks_oak = planks([162, 130, 78], [120, 94, 52]);
P.planks_birch = planks([196, 179, 123], [160, 144, 96]);
P.planks_spruce = planks([114, 84, 48], [80, 58, 32]);
P.bedrock = (d, r) => {
  fill(d, r, [70, 70, 70], 6);
  for (let i = 0; i < 18; i++) { const cx = (r() * 16) | 0, cy = (r() * 16) | 0, v = [35, 55, 95, 110][(r() * 4) | 0]; for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) if (r() < 0.75) px(d, (cx + x) & 15, (cy + y) & 15, [v, v, v]); }
};
P.water = (d, r) => { fill(d, r, [46, 86, 210], 10); speck(d, r, 20, [90, 130, 235], 6); speck(d, r, 10, [30, 60, 170], 6); };
P.lava = (d, r) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const t = Math.sin(x * 0.9 + Math.sin(y * 0.7) * 2) * 0.5 + Math.sin(y * 0.8 + x * 0.3) * 0.5 + (r() - 0.5) * 0.8;
    px(d, x, y, t > 0.5 ? [255, 200, 50] : t > -0.2 ? [240, 120, 14] : [190, 60, 6]);
  }
};
P.sand = (d, r) => { fill(d, r, [219, 207, 163], 8); speck(d, r, 20, [196, 184, 140], 5); speck(d, r, 12, [236, 226, 186], 5); };
P.gravel = (d, r) => {
  const pal = [[134, 128, 124], [104, 100, 98], [152, 147, 143], [86, 83, 82], [120, 105, 95]];
  for (let y = 0; y < 16; y += 1) for (let x = 0; x < 16; x++) { const c = pal[(r() * pal.length) | 0]; px(d, x, y, c); }
  for (let i = 0; i < 30; i++) { const x = (r() * 15) | 0, y = (r() * 15) | 0, c = pal[(r() * pal.length) | 0]; px(d, x, y, c); px(d, x + 1, y, c); }
};
function oreTile(bg, col, hi) {
  return (d, r) => {
    P[bg](d, r);
    const cr = mulberry32(hashString(bg + col[0] + col[1]));
    for (let b = 0; b < 6; b++) {
      const cx = 2 + ((cr() * 12) | 0), cy = 2 + ((cr() * 12) | 0);
      for (const [ox, oy] of [[0, 0], [1, 0], [0, 1], [1, 1], [-1, 0]]) if (cr() < 0.8) { const k = (cr() * 2 - 1) * 14; px(d, cx + ox, cy + oy, [col[0] + k, col[1] + k, col[2] + k]); }
      px(d, cx, cy, hi);
    }
  };
}
P.deepslate = (d, r) => {
  fill(d, r, DEEP, 7); speck(d, r, 14, [58, 58, 64], 5);
  for (let i = 0; i < 4; i++) { const y = (r() * 16) | 0; for (let x = 0; x < 16; x++) if (r() < 0.7) shade(d, x, y, 0.82); }
};
P.deepslate_top = (d, r) => { fill(d, r, [84, 84, 90], 6); for (let x = 0; x < 16; x++) { shade(d, x, 0, 0.8); shade(d, x, 15, 0.8); shade(d, 0, x, 0.8); shade(d, 15, x, 0.8); } };
P.coal_ore = oreTile('stone', [30, 30, 34], [70, 70, 80]);
P.iron_ore = oreTile('stone', [216, 176, 148], [240, 210, 190]);
P.gold_ore = oreTile('stone', [252, 222, 60], [255, 250, 170]);
P.diamond_ore = oreTile('stone', [60, 220, 216], [210, 255, 255]);
P.d_coal = oreTile('deepslate', [30, 30, 34], [70, 70, 80]);
P.d_iron = oreTile('deepslate', [216, 176, 148], [240, 210, 190]);
P.d_gold = oreTile('deepslate', [252, 222, 60], [255, 250, 170]);
P.d_diamond = oreTile('deepslate', [60, 220, 216], [210, 255, 255]);
function logSide(c, hi, dash) {
  return (d, r) => {
    const cols = []; for (let x = 0; x < 16; x++) cols.push((r() * 2 - 1) * 14);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const k = cols[x] + (r() * 2 - 1) * 6; px(d, x, y, [c[0] + k, c[1] + k, c[2] + k]); }
    if (dash) for (let i = 0; i < 9; i++) { const x = (r() * 14) | 0, y = (r() * 15) | 0; px(d, x, y, [40, 40, 40]); px(d, x + 1, y, [60, 60, 55]); }
    else speck(d, r, 12, hi, 8);
  };
}
function logTop(wood, bark) {
  return (d, r) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const e = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)), k = (r() * 2 - 1) * 6;
      let c = e > 6.5 ? bark : (Math.floor(e) % 2 ? wood.map(v => v - 22) : wood);
      px(d, x, y, [c[0] + k, c[1] + k, c[2] + k]);
    }
  };
}
P.log_oak = logSide([102, 81, 50], [70, 55, 32]);
P.log_top = logTop([172, 140, 88], [102, 81, 50]);
P.log_birch = logSide([218, 218, 208], [200, 200, 190], true);
P.log_birch_top = logTop([204, 188, 140], [218, 218, 208]);
P.log_spruce = logSide([62, 40, 18], [40, 26, 10]);
P.log_spruce_top = logTop([116, 84, 52], [62, 40, 18]);
function leaves(c, tinted) {
  return (d, r) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const k = (r() * 2 - 1) * 22;
      if (r() < 0.17) { px(d, x, y, [0, 0, 0], 0); continue; }
      if (tinted) px(d, x, y, [220 + k, 220 + k, 220 + k], TINT_A);
      else px(d, x, y, [c[0] + k, c[1] + k, c[2] + k]);
    }
  };
}
P.leaves_oak = leaves(null, true);
P.leaves_birch = leaves([114, 156, 72], false);
P.leaves_spruce = leaves([58, 98, 62], false);
P.glass = (d, r) => {
  for (let i = 0; i < 1024; i += 4) d[i + 3] = 0;
  for (let k = 0; k < 16; k++) { px(d, k, 0, [214, 236, 240]); px(d, k, 15, [190, 220, 228]); px(d, 0, k, [214, 236, 240]); px(d, 15, k, [190, 220, 228]); }
  for (const [x, y] of [[2, 2], [3, 3], [4, 4], [2, 5], [3, 6], [11, 9], [12, 10], [10, 12]]) px(d, x, y, [255, 255, 255]);
};
P.ice = (d, r) => { fill(d, r, [150, 190, 245], 8); for (let i = 0; i < 6; i++) { const x = (r() * 12) | 0, y = (r() * 14) | 0; line(d, x, y, x + 3, y + 1, [200, 225, 252]); } };
P.cactus_side = (d, r) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const k = (x % 4 === 1 || x % 4 === 2) ? 8 : -6; px(d, x, y, [16 + k, 118 + k * 2, 30 + k]); }
  for (let i = 0; i < 12; i++) px(d, 1 + ((i % 4) * 4), 1 + (((i / 4) | 0) * 5) + (i % 2) * 2, [230, 240, 200]);
  for (let k = 0; k < 16; k++) { shade(d, 0, k, 0.8); shade(d, 15, k, 0.8); }
};
P.cactus_top = (d, r) => { fill(d, r, [28, 130, 36], 10); for (let k = 0; k < 16; k++) { px(d, k, 0, [14, 90, 24]); px(d, k, 15, [14, 90, 24]); px(d, 0, k, [14, 90, 24]); px(d, 15, k, [14, 90, 24]); } rect(d, 6, 6, 4, 4, [14, 100, 26]); };
P.cactus_bottom = (d, r) => fill(d, r, [20, 110, 28], 8);
P.crafting_top = (d, r) => {
  P.planks_oak(d, r);
  for (let k = 0; k < 16; k++) { px(d, k, 0, [90, 62, 30]); px(d, k, 15, [90, 62, 30]); px(d, 0, k, [90, 62, 30]); px(d, 15, k, [90, 62, 30]); }
  for (let k = 2; k < 14; k++) { px(d, k, 5, [88, 62, 30]); px(d, k, 10, [88, 62, 30]); px(d, 5, k, [88, 62, 30]); px(d, 10, k, [88, 62, 30]); }
};
P.crafting_side = (d, r) => {
  P.planks_oak(d, r); rect(d, 0, 0, 16, 2, [88, 60, 28]);
  rect(d, 2, 4, 2, 9, [60, 60, 66]); rect(d, 6, 5, 3, 3, [140, 140, 150]); rect(d, 7, 8, 1, 5, [100, 70, 36]); rect(d, 11, 4, 3, 2, [110, 80, 40]); rect(d, 12, 6, 1, 7, [60, 60, 66]);
};
P.crafting_front = (d, r) => {
  P.planks_oak(d, r); rect(d, 0, 0, 16, 2, [88, 60, 28]);
  rect(d, 2, 6, 5, 4, [100, 70, 36]); rect(d, 3, 4, 3, 2, [70, 70, 76]); line(d, 9, 5, 13, 12, [140, 140, 150]); line(d, 10, 5, 14, 12, [100, 100, 110]); rect(d, 2, 11, 6, 2, [60, 60, 66]);
};
P.furnace_top = (d, r) => { fill(d, r, [118, 118, 118], 8); rect(d, 2, 2, 12, 12, [96, 96, 96]); rect(d, 3, 3, 10, 10, [110, 110, 110]); };
P.furnace_side = (d, r) => { P.cobble(d, r); };
P.furnace_front = (d, r) => {
  P.cobble(d, r); rect(d, 3, 3, 10, 5, [40, 40, 44]); rect(d, 4, 4, 8, 3, [18, 18, 20]); rect(d, 4, 10, 8, 4, [34, 34, 38]); rect(d, 5, 11, 6, 2, [10, 10, 12]);
  for (let k = 3; k < 13; k++) { px(d, k, 8, [70, 70, 74]); }
};
P.glowstone = (d, r) => { fill(d, r, [222, 182, 98], 30); speck(d, r, 26, [255, 232, 150], 14); speck(d, r, 16, [170, 120, 50], 14); };
P.wool_white = (d, r) => { fill(d, r, [232, 232, 232], 7); speck(d, r, 40, [212, 212, 212], 5); };
const GLYPH = { T: ['111', '010', '010', '010', '010'], N: ['101', '111', '111', '101', '101'] };
P.tnt_side = (d, r) => {
  fill(d, r, [200, 52, 40], 8); rect(d, 0, 5, 16, 6, [224, 220, 214]);
  [['T', 2], ['N', 6], ['T', 10]].forEach(([ch, ox]) => GLYPH[ch].forEach((row, y) => [...row].forEach((v, x) => { if (v === '1') px(d, ox + x, 5 + y + (y > 0 ? 0 : 0), [60, 60, 60]); })));
  rect(d, 0, 5, 16, 1, [200, 196, 190]);
  for (let x = 0; x < 16; x++) { px(d, x, 0, [150, 34, 28]); px(d, x, 15, [150, 34, 28]); }
};
P.tnt_top = (d, r) => { fill(d, r, [200, 90, 60], 8); rect(d, 6, 6, 4, 4, [40, 40, 40]); rect(d, 7, 7, 2, 2, [90, 70, 40]); };
P.tnt_bottom = (d, r) => { fill(d, r, [180, 70, 50], 8); };
P.bookshelf = (d, r) => {
  P.planks_oak(d, r);
  for (const y0 of [2, 9]) { for (let x = 0; x < 16; x++) for (let y = y0; y < y0 + 5; y++) px(d, x, y, [60, 42, 26]); }
  const cols = [[170, 40, 40], [40, 80, 160], [40, 130, 60], [190, 150, 40], [120, 60, 150], [150, 90, 50]];
  for (const y0 of [2, 9]) { let x = 0; while (x < 16) { const w = 1 + ((r() * 2) | 0), c = cols[(r() * cols.length) | 0]; for (let xx = x; xx < Math.min(16, x + w); xx++) for (let y = y0; y < y0 + 5; y++) px(d, xx, y, [c[0] + (r() * 20 - 10), c[1], c[2]]); x += w; } }
};
P.sandstone_side = (d, r) => { fill(d, r, [218, 206, 160], 6); for (let x = 0; x < 16; x++) { shade(d, x, 3, 0.9); shade(d, x, 11, 0.92); shade(d, x, 0, 1.06); } };
P.sandstone_top = (d, r) => { fill(d, r, [222, 210, 166], 5); };
P.obsidian = (d, r) => { fill(d, r, [20, 14, 32], 6); speck(d, r, 26, [58, 38, 92], 10); };
P.chest_top = (d, r) => { fill(d, r, [152, 108, 50], 8); for (let k = 0; k < 16; k++) { px(d, k, 0, [100, 70, 30]); px(d, k, 15, [100, 70, 30]); px(d, 0, k, [100, 70, 30]); px(d, 15, k, [100, 70, 30]); } };
P.chest_side = (d, r) => { fill(d, r, [152, 108, 50], 8); for (let k = 0; k < 16; k++) { px(d, k, 0, [100, 70, 30]); px(d, k, 15, [100, 70, 30]); px(d, k, 6, [90, 62, 26]); } };
P.chest_front = (d, r) => { P.chest_side(d, r); rect(d, 7, 5, 2, 4, [170, 170, 176]); rect(d, 7, 7, 2, 1, [50, 50, 56]); };
P.torch = (d, r) => {
  d.fill(0);
  for (let y = 8; y < 16; y++) { px(d, 7, y, [138, 100, 50]); px(d, 8, y, [108, 76, 36]); }
  px(d, 7, 6, [255, 230, 90]); px(d, 8, 6, [255, 190, 40]); px(d, 7, 7, [255, 200, 60]); px(d, 8, 7, [250, 150, 20]);
};
P.tallgrass = (d, r) => {
  d.fill(0);
  for (let b = 0; b < 7; b++) { const x = 1 + ((r() * 14) | 0), hgt = 5 + ((r() * 9) | 0), lean = r() < 0.5 ? -1 : 1; for (let k = 0; k < hgt; k++) { const k2 = (r() * 2 - 1) * 18; px(d, x + (k > hgt * 0.6 ? lean : 0), 15 - k, [215 + k2, 215 + k2, 215 + k2], TINT_A); } }
};
P.dandelion = (d, r) => {
  d.fill(0); for (let y = 8; y < 16; y++) px(d, 7, y, [64, 140, 40]); px(d, 8, 12, [64, 140, 40]); px(d, 6, 11, [64, 140, 40]);
  rect(d, 6, 5, 3, 3, [250, 214, 30]); px(d, 7, 6, [255, 240, 120]); px(d, 5, 6, [240, 200, 20]); px(d, 9, 6, [240, 200, 20]); px(d, 7, 4, [240, 200, 20]);
};
P.poppy = (d, r) => {
  d.fill(0); for (let y = 8; y < 16; y++) px(d, 7, y, [60, 130, 38]); px(d, 8, 11, [60, 130, 38]);
  rect(d, 5, 4, 5, 4, [214, 30, 28]); rect(d, 6, 3, 3, 1, [230, 50, 40]); px(d, 7, 5, [30, 20, 20]); px(d, 7, 6, [60, 20, 20]);
};

// ---- tárgyak ----
const PALS = { wood: [[150, 110, 58], [190, 150, 90]], stone: [[120, 120, 124], [160, 160, 164]], iron: [[205, 205, 210], [245, 245, 250]], gold: [[240, 200, 50], [255, 240, 130]], diamond: [[60, 210, 210], [170, 255, 250]] };
const HANDLE = [118, 82, 40], HANDLE_D = [80, 54, 24];
export const MASKS = {
  pickaxe: ['................', '....hhhhhh......', '...hhHHHHhhh....', '..hh.....s.hh...', '.hh.....s...hh..', '.h.....s.....h..', '.......s......h.', '......s.........', '.....s..........', '....s...........', '...s............', '..s.............', '................', '................', '................', '................'],
  axe: ['................', '.........hhh....', '........hHHhh...', '.......hHhhhhh..', '.......hhhhhh...', '......s.hhh.....', '.....s..........', '....s...........', '...s............', '..s.............', '.s..............', '................', '................', '................', '................', '................'],
  shovel: ['..........hhh...', '.........hHHhh..', '.........hHhhh..', '..........hhh...', '.........s.h....', '........s.......', '.......s........', '......s.........', '.....s..........', '....s...........', '...s............', '..s.............', '................', '................', '................', '................'],
  hoe: ['................', '...hhhhhh.......', '..hHHHHHh.......', '..hh....s.......', '.......s........', '......s.........', '.....s..........', '....s...........', '...s............', '..s.............', '.s..............', '................', '................', '................', '................', '................'],
  sword: ['..............hh', '.............hHh', '............hHh.', '...........hHh..', '..........hHh...', '.........hHh....', '..h.....hHh.....', '...h...hHh......', '...hhhhHh.......', '....hhhh........', '...ssh..........', '..ss............', '.ss.............', 'ss..............', '................', '................'],
};
function toolTile(type, mi) {
  return (d) => {
    d.fill(0);
    const pal = PALS[MATS[mi]], rows = MASKS[type];
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const ch = rows[y][x];
      if (ch === 'h') px(d, x, y, pal[0]); else if (ch === 'H') px(d, x, y, pal[1]); else if (ch === 's') px(d, x, y, y % 2 ? HANDLE : HANDLE_D);
    }
    // sötét él
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (d[(y * 16 + x) * 4 + 3] === 0) {
      let near = false; for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + ox, yy = y + oy; if (xx >= 0 && yy >= 0 && xx < 16 && yy < 16 && d[(yy * 16 + xx) * 4 + 3] === 255) near = true; }
      if (near) px(d, x, y, [30, 24, 20], 140);
    }
  };
}
TOOL_TYPES.forEach(t => MATS.forEach((m, mi) => { P['tool_' + t + '_' + MATS[mi]] = toolTile(t, mi); }));
P.i_stick = d => { d.fill(0); line(d, 3, 13, 12, 4, HANDLE); line(d, 4, 13, 12, 5, HANDLE_D); line(d, 2, 13, 11, 4, [150, 110, 60]); };
P.i_coal = (d, r) => { d.fill(0); ellipse(d, r, 8, 9, 4.6, 4.2, [34, 34, 38], 8); speck(d, r, 6, [80, 80, 92], 6); };
const ingot = (c, hi, lo) => (d, r) => { d.fill(0); for (let y = 6; y < 11; y++) for (let x = 3 + (10 - y) / 2 | 0; x < 13 - (y - 5) / 2 | 0; x++) px(d, x, y, y === 6 ? hi : y === 10 ? lo : c); line(d, 5, 6, 11, 6, hi); };
P.i_iron_ingot = ingot([216, 216, 218], [250, 250, 252], [150, 150, 156]);
P.i_gold_ingot = ingot([248, 212, 50], [255, 246, 150], [190, 146, 20]);
P.i_diamond = (d) => {
  d.fill(0); const c = [70, 230, 226], hi = [200, 255, 255], lo = [30, 160, 170];
  for (let y = 4; y <= 12; y++) { const w = y < 7 ? 5 + (y - 4) : 8 - Math.max(0, y - 7) * 1.5; const x0 = Math.round(8 - w / 2), x1 = Math.round(8 + w / 2); for (let x = x0; x < x1; x++) px(d, x, y, y > 7 ? lo : c); }
  line(d, 6, 5, 9, 5, hi); px(d, 5, 6, hi); px(d, 7, 7, hi);
};
P.i_apple = (d, r) => { d.fill(0); ellipse(d, r, 8, 9.5, 4.8, 4.6, [206, 32, 32], 8); px(d, 6, 8, [244, 120, 120]); px(d, 6, 9, [244, 120, 120]); px(d, 8, 4, [90, 60, 30]); px(d, 8, 3, [90, 60, 30]); px(d, 9, 3, [60, 160, 40]); px(d, 10, 3, [60, 160, 40]); };
const meat = (c, hi, bone) => (d, r) => { d.fill(0); ellipse(d, r, 8, 9, 5.2, 4, c, 8); speck(d, r, 8, hi, 8); if (bone) { rect(d, 12, 5, 2, 2, [240, 236, 220]); px(d, 11, 7, [240, 236, 220]); } };
P.i_raw_pork = meat([236, 152, 152], [250, 196, 196], true);
P.i_cooked_pork = meat([172, 98, 56], [200, 130, 80], true);
P.i_raw_beef = meat([190, 50, 60], [240, 200, 190], false);
P.i_steak = meat([132, 70, 40], [170, 100, 60], false);
P.i_rotten = (d, r) => { d.fill(0); ellipse(d, r, 8, 9, 5, 4, [118, 134, 78], 10); speck(d, r, 8, [70, 90, 50], 8); };
P.i_gunpowder = (d, r) => { d.fill(0); for (let y = 6; y < 13; y++) for (let x = 8 - (y - 5); x < 8 + (y - 5); x++) { const k = (r() * 2 - 1) * 14; px(d, x, y, [92 + k, 92 + k, 98 + k]); } };
P.i_raw_iron = (d, r) => { d.fill(0); ellipse(d, r, 8, 9, 4.8, 4, [214, 170, 140], 10); speck(d, r, 5, [150, 150, 156], 8); };
P.i_raw_gold = (d, r) => { d.fill(0); ellipse(d, r, 8, 9, 4.8, 4, [236, 192, 62], 10); speck(d, r, 5, [255, 240, 140], 8); };
P.i_flint = (d) => { d.fill(0); const c = [66, 66, 72]; for (const [x, y] of [[8, 4], [7, 5], [8, 5], [9, 5], [6, 6], [7, 6], [8, 6], [9, 6], [10, 6], [6, 7], [7, 7], [8, 7], [9, 7], [10, 7], [7, 8], [8, 8], [9, 8], [10, 8], [8, 9], [9, 9], [10, 9], [9, 10]]) px(d, x, y, c); px(d, 8, 5, [130, 130, 140]); px(d, 7, 6, [110, 110, 120]); };

// ---- Atlasz ----
export const tileIndex = new Map();
export const tiles = new Map();
let atlasData = null;
const ATLAS = 512, TPR = ATLAS / 16;

export function buildAtlas() {
  const names = new Set(['stone']);
  for (const b of BLOCKS) if (b && b.tex) { names.add(b.tex.top); names.add(b.tex.bottom); names.add(b.tex.side); if (b.front) names.add(b.front); if (b.tex2) names.add(b.tex2); }
  for (const b of BLOCKS) if (b && b.icon) names.add(b.icon);
  for (const n of ['nest_hen', 'nest_hen_fed', 'nest_egg', 'portal', 'end_portal', 'end_frame', 'end_eye']) names.add(n);
  for (const k of Object.keys(ITEMS)) names.add(ITEMS[k].tex);
  let i = 0;
  atlasData = new Uint8Array(ATLAS * ATLAS * 4);
  for (const name of names) {
    if (!P[name]) throw new Error('hiányzó textúra: ' + name);
    const d = new Uint8ClampedArray(1024);
    P[name](d, mulberry32(hashString(name)));
    tiles.set(name, d); tileIndex.set(name, i);
    const tx = i % TPR, ty = (i / TPR) | 0;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const imgY = ty * 16 + y, row = ATLAS - 1 - imgY; // GL-hez fordítva
      const o = (row * ATLAS + tx * 16 + x) * 4, s = (y * 16 + x) * 4;
      atlasData[o] = d[s]; atlasData[o + 1] = d[s + 1]; atlasData[o + 2] = d[s + 2]; atlasData[o + 3] = d[s + 3];
    }
    i++;
  }
  return atlasData;
}
export const ATLAS_SIZE = ATLAS;
export function tileUV(name) {
  const i = tileIndex.get(name), tx = i % TPR, ty = (i / TPR) | 0, e = 0.0002;
  return [tx / TPR + e, 1 - (ty + 1) / TPR + e, (tx + 1) / TPR - e, 1 - ty / TPR - e]; // u0,vBottom,u1,vTop
}
const avgCache = new Map();
export function avgColor(name) {
  if (avgCache.has(name)) return avgCache.get(name);
  const d = tiles.get(name); let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < 1024; i += 4) if (d[i + 3] > 40) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
  const c = n ? [r / n / 255, g / n / 255, b / n / 255] : [0.5, 0.5, 0.5];
  avgCache.set(name, c); return c;
}

// ---- Ikonok ----
function tileCanvas(name) {
  const c = document.createElement('canvas'); c.width = c.height = 16;
  const ctx = c.getContext('2d'); const img = ctx.createImageData(16, 16); const td = tiles.get(name) || tiles.get('stone'); if (td) img.data.set(td); ctx.putImageData(img, 0, 0); return c;
}
const iconCache = new Map();
export function iconCanvas(id) {
  if (iconCache.has(id)) return iconCache.get(id);
  const out = document.createElement('canvas'); out.width = out.height = 32;
  const ctx = out.getContext('2d'); ctx.imageSmoothingEnabled = false;
  if (id < 256) {
    const b = BLOCKS[id];
    if (b.shape === 'cross' || b.shape === 'torch' || b.shape === 'door' || b.icon) {
      ctx.drawImage(tileCanvas(b.icon || b.tex.side), 0, 0, 32, 32);
    } else {
      const top = tileCanvas(b.tex.top), side = tileCanvas(b.front && b.dir ? b.front : b.tex.side), side2 = tileCanvas(b.tex.side);
      const tm = (cv, a, bb, c, dd, e, f, dark) => {
        ctx.save(); ctx.setTransform(a, bb, c, dd, e, f); ctx.drawImage(cv, 0, 0);
        if (dark) { ctx.fillStyle = `rgba(0,0,0,${dark})`; ctx.fillRect(0, 0, 16, 16); }
        ctx.restore();
      };
      tm(side, 14 / 16, 7 / 16, 0, 14 / 16, 2, 9, 0.2);
      tm(side2, 14 / 16, -7 / 16, 0, 14 / 16, 16, 16, 0.4);
      tm(top, 14 / 16, 7 / 16, -14 / 16, 7 / 16, 16, 2, 0);
    }
  } else {
    ctx.drawImage(tileCanvas(ITEMS[id].tex), 0, 0, 32, 32);
  }
  iconCache.set(id, out); return out;
}
const urlCache = new Map();
export function iconURL(id) { if (!urlCache.has(id)) urlCache.set(id, iconCanvas(id).toDataURL()); return urlCache.get(id); }

// ---- Repedés-textúrák (blokktörés) ----
export function crackTextures() {
  const r = mulberry32(777), order = [];
  const seen = new Set();
  for (let w = 0; w < 7; w++) {
    let x = 8 + ((r() * 6) | 0) - 3, y = 8 + ((r() * 6) | 0) - 3, ang = r() * Math.PI * 2;
    for (let s = 0; s < 22; s++) {
      ang += (r() - 0.5) * 1.2; x += Math.cos(ang); y += Math.sin(ang);
      const px2 = Math.round(x), py2 = Math.round(y), k = px2 + ',' + py2;
      if (px2 < 0 || py2 < 0 || px2 > 15 || py2 > 15) break;
      if (!seen.has(k)) { seen.add(k); order.push([px2, py2]); }
    }
  }
  const res = [];
  for (let s = 1; s <= 10; s++) {
    const d = new Uint8Array(1024), n = Math.floor(order.length * s / 10);
    for (let i = 0; i < n; i++) { const [x, y] = order[i], o = ((15 - y) * 16 + x) * 4; d[o] = 10; d[o + 1] = 10; d[o + 2] = 10; d[o + 3] = 190; }
    res.push(d);
  }
  return res;
}

// ---- HUD-sprite-ok ----
function spriteCanvas(rows, pal, outline = [30, 0, 0]) {
  const h = rows.length, w = rows[0].length, c = document.createElement('canvas'); c.width = w + 2; c.height = h + 2;
  const ctx = c.getContext('2d'), filled = (x, y) => x >= 0 && y >= 0 && x < w && y < h && rows[y][x] !== '.';
  for (let y = -1; y <= h; y++) for (let x = -1; x <= w; x++) {
    if (filled(x, y)) { ctx.fillStyle = pal[rows[y][x]]; ctx.fillRect(x + 1, y + 1, 1, 1); }
    else { let n = false; for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) if (filled(x + ox, y + oy)) n = true; if (n) { ctx.fillStyle = `rgb(${outline})`; ctx.fillRect(x + 1, y + 1, 1, 1); } }
  }
  return c;
}
export function hudIcons() {
  const heart = ['.RR.RR.', 'RWRRRRR', 'RRRRRRR', '.RRRRR.', '..RRR..', '...R...'];
  const food = ['..bbbb..', '.bBBBBb.', '.bBBBBb.', '..bbbb..', '...bb...', '..wb....', '.ww.....'];
  const mk = (rows, pal, frac, dead) => {
    const rr = rows.map((row, y) => [...row].map((ch, x) => ch === '.' ? '.' : (x / row.length < frac ? ch : 'x')).join(''));
    return spriteCanvas(rr, Object.assign({ x: dead }, pal)).toDataURL();
  };
  const arm = ['GG....GG', 'GGG..GGG', '.GGGGGG.', '.GGwGGG.', '.GGGGGG.', '.GGGGGG.', '..GGGG..'], ap = { G: '#c4c8d0', w: '#ffffff' };
  const hp = { R: '#e01c1c', W: '#ff9a9a' }, fp = { b: '#b86a2e', B: '#e08c44', w: '#f0ebdc' };
  const bubble = (() => { const c = document.createElement('canvas'); c.width = c.height = 9; const x = c.getContext('2d'); x.fillStyle = '#bfe0ff'; x.beginPath(); x.arc(4.5, 4.5, 4, 0, 7); x.fill(); x.fillStyle = '#5aa0e8'; x.beginPath(); x.arc(4.5, 4.5, 3, 0, 7); x.fill(); x.fillStyle = '#e8f4ff'; x.fillRect(3, 2, 2, 1); return c.toDataURL(); })();
  return {
    heart: mk(heart, hp, 1, '#000'), heartHalf: mk(heart, hp, 0.5, '#3a1010'), heartEmpty: mk(heart, hp, 0, '#3a1010'),
    food: mk(food, fp, 1, '#000'), foodHalf: mk(food, fp, 0.5, '#2a2018'), foodEmpty: mk(food, fp, 0, '#2a2018'), bubble,
    armor: mk(arm, ap, 1, '#000'), armorHalf: mk(arm, ap, 0.5, '#2a2a2a'), armorEmpty: mk(arm, ap, 0, '#2a2a2a'),
  };
}
