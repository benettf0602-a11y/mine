// Új textúrák: bővített blokk- és tárgykínálat (procedurálisan, 16x16)
import { P, px, fill, speck, rect, ellipse, line, shade, MASKS } from './textures.js';
import { mulberry32, hashString } from './noise.js';

export const COLORS = [
  ['Fehér', 0xe9ecec], ['Narancs', 0xf07613], ['Bíbor', 0xbd44b3], ['Világoskék', 0x3aafd9], ['Sárga', 0xf8c627], ['Lime', 0x70b919],
  ['Rózsaszín', 0xed8dac], ['Szürke', 0x3e4447], ['Világosszürke', 0x8e8e86], ['Ciánkék', 0x158991], ['Lila', 0x792aac], ['Kék', 0x35399d],
  ['Barna', 0x724728], ['Zöld', 0x546d1b], ['Piros', 0xa12722], ['Fekete', 0x141519],
];
const rgb = h => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
const dark = (c, f) => [c[0] * f, c[1] * f, c[2] * f];

function ore(bg, col, hi, seedKey) {
  return (d, r) => {
    P[bg](d, r);
    const cr = mulberry32(hashString(seedKey));
    for (let b = 0; b < 6; b++) {
      const cx = 2 + ((cr() * 12) | 0), cy = 2 + ((cr() * 12) | 0);
      for (const [ox, oy] of [[0, 0], [1, 0], [0, 1], [1, 1], [-1, 0]]) if (cr() < 0.8) { const k = (cr() * 2 - 1) * 14; px(d, cx + ox, cy + oy, [col[0] + k, col[1] + k, col[2] + k]); }
      px(d, cx, cy, hi);
    }
  };
}
P.copper_ore = ore('stone', [214, 128, 84], [250, 190, 140], 'cu');
P.d_copper = ore('deepslate', [214, 128, 84], [250, 190, 140], 'dcu');
P.lapis_ore = ore('stone', [38, 76, 190], [110, 150, 250], 'lap');
P.d_lapis = ore('deepslate', [38, 76, 190], [110, 150, 250], 'dlap');
P.redstone_ore = ore('stone', [210, 28, 20], [255, 110, 90], 'red');
P.d_redstone = ore('deepslate', [210, 28, 20], [255, 110, 90], 'dred');
P.emerald_ore = ore('stone', [30, 200, 80], [170, 255, 190], 'em');

function mineralBlock(c, hi, lo, pattern) {
  return (d, r) => {
    fill(d, r, c, 7);
    for (let k = 0; k < 16; k++) { px(d, k, 0, hi); px(d, 0, k, hi); px(d, k, 15, lo); px(d, 15, k, lo); }
    if (pattern === 'diamond') { speck(d, r, 14, [170, 255, 250], 0); }
    if (pattern === 'cross') { for (let k = 2; k < 14; k++) { px(d, k, 7, lo); px(d, k, 8, lo); px(d, 7, k, lo); px(d, 8, k, lo); } }
    if (pattern === 'coal') { fill(d, r, c, 10); speck(d, r, 30, [60, 60, 66], 6); for (let k = 0; k < 16; k++) { px(d, k, 0, [20, 20, 22]); px(d, 0, k, [20, 20, 22]); px(d, k, 15, [12, 12, 14]); px(d, 15, k, [12, 12, 14]); } }
  };
}
P.block_coal = mineralBlock([28, 28, 32], [50, 50, 56], [14, 14, 16], 'coal');
P.block_iron = mineralBlock([220, 220, 222], [250, 250, 252], [170, 170, 176], 'cross');
P.block_gold = mineralBlock([250, 214, 56], [255, 246, 170], [200, 150, 24], 'cross');
P.block_diamond = mineralBlock([84, 226, 220], [200, 255, 255], [40, 170, 170], 'diamond');
P.block_emerald = mineralBlock([40, 200, 90], [160, 255, 190], [20, 130, 56], 'cross');
P.block_lapis = mineralBlock([34, 70, 170], [90, 130, 240], [20, 44, 120], 'cross');
P.block_copper = mineralBlock([204, 118, 80], [240, 170, 130], [150, 80, 50], 'cross');
P.block_redstone = mineralBlock([176, 22, 14], [240, 70, 50], [110, 10, 6], 'cross');

const stoneVar = (c, v, spk) => (d, r) => { fill(d, r, c, v); speck(d, r, 24, spk, 10); };
P.andesite = stoneVar([136, 136, 138], 10, [110, 110, 112]);
P.granite = (d, r) => { fill(d, r, [154, 106, 89], 12); speck(d, r, 22, [190, 140, 120], 8); speck(d, r, 12, [120, 78, 64], 8); };
P.diorite = (d, r) => { fill(d, r, [190, 190, 192], 10); speck(d, r, 26, [120, 120, 124], 10); speck(d, r, 8, [235, 235, 236], 6); };
P.smooth_stone = (d, r) => { fill(d, r, [160, 160, 160], 3); for (let k = 0; k < 16; k++) { px(d, k, 15, [140, 140, 140]); px(d, 15, k, [140, 140, 140]); } };
const polished = (c) => (d, r) => { fill(d, r, c, 4); for (let k = 0; k < 16; k++) { px(d, k, 0, dark(c, 1.1)); px(d, k, 15, dark(c, 0.82)); px(d, 0, k, dark(c, 1.08)); px(d, 15, k, dark(c, 0.84)); } };
P.pol_andesite = polished([140, 142, 143]); P.pol_granite = polished([160, 112, 96]); P.pol_diorite = polished([200, 200, 202]);
P.mossy_cobble = (d, r) => { P.cobble(d, r); speck(d, r, 40, [74, 116, 54], 14); speck(d, r, 20, [98, 140, 70], 10); };
P.mossy_stonebrick = (d, r) => { P.stonebrick(d, r); speck(d, r, 34, [74, 116, 54], 14); };
P.cracked_stonebrick = (d, r) => { P.stonebrick(d, r); line(d, 2, 1, 5, 6, [70, 70, 70]); line(d, 11, 9, 8, 14, [70, 70, 70]); line(d, 12, 2, 14, 5, [70, 70, 70]); };
P.chiseled_stonebrick = (d, r) => { fill(d, r, [124, 124, 124], 6); rect(d, 2, 2, 12, 12, [96, 96, 96]); rect(d, 3, 3, 10, 10, [138, 138, 138]); rect(d, 5, 5, 6, 6, [108, 108, 108]); };
P.clay = (d, r) => { fill(d, r, [160, 166, 180], 7); speck(d, r, 14, [140, 146, 162], 5); };
P.terracotta = (d, r) => { fill(d, r, [152, 94, 68], 6); speck(d, r, 14, [132, 80, 58], 5); };
P.netherrack = (d, r) => { fill(d, r, [112, 54, 54], 18); speck(d, r, 30, [140, 70, 66], 10); speck(d, r, 14, [80, 30, 34], 8); };
P.soul_sand = (d, r) => { fill(d, r, [84, 66, 54], 8); for (const [x, y] of [[3, 4], [4, 4], [10, 8], [11, 8], [6, 12], [7, 12]]) { px(d, x, y, [40, 30, 28]); } };
P.nether_bricks = (d, r) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const row = (y / 4) | 0, off = row % 2 ? 4 : 0, k = (r() * 2 - 1) * 6, m = y % 4 === 3 || (x + off) % 8 === 7; px(d, x, y, m ? [30, 14, 18] : [66 + k, 28 + k / 2, 34 + k / 2]); } };
P.quartz_block = (d, r) => { fill(d, r, [236, 230, 222], 4); for (let k = 0; k < 16; k++) { px(d, k, 15, [214, 208, 200]); } };
P.hay_top = (d, r) => { fill(d, r, [200, 164, 40], 10); rect(d, 5, 5, 6, 6, [170, 130, 30]); };
P.hay_side = (d, r) => { fill(d, r, [208, 172, 44], 10); for (let x = 0; x < 16; x++) { px(d, x, 3, [120, 80, 30]); px(d, x, 4, [120, 80, 30]); px(d, x, 11, [120, 80, 30]); px(d, x, 12, [120, 80, 30]); } for (let y = 0; y < 16; y += 2) speck(d, r, 1, [226, 196, 70], 0); };
P.pumpkin_top = (d, r) => { fill(d, r, [200, 120, 20], 10); rect(d, 6, 6, 4, 4, [90, 100, 30]); };
P.pumpkin_side = (d, r) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const k = (x % 4 < 2 ? 10 : -8) + (r() * 2 - 1) * 4; px(d, x, y, [214 + k, 124 + k, 22]); } };
P.pumpkin_face = (d, r) => { P.pumpkin_side(d, r); rect(d, 3, 4, 3, 3, [60, 30, 4]); rect(d, 10, 4, 3, 3, [60, 30, 4]); rect(d, 5, 9, 6, 2, [60, 30, 4]); rect(d, 4, 8, 2, 2, [60, 30, 4]); rect(d, 10, 8, 2, 2, [60, 30, 4]); };
P.jack_face = (d, r) => { P.pumpkin_face(d, r); rect(d, 3, 4, 3, 3, [255, 220, 90]); rect(d, 10, 4, 3, 3, [255, 220, 90]); rect(d, 5, 9, 6, 2, [255, 190, 50]); rect(d, 4, 8, 2, 2, [255, 190, 50]); rect(d, 10, 8, 2, 2, [255, 190, 50]); };
P.melon_top = (d, r) => { fill(d, r, [110, 150, 40], 10); rect(d, 6, 6, 4, 4, [80, 110, 30]); };
P.melon_side = (d, r) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const s = x % 4 < 2; px(d, x, y, s ? [128, 168, 44] : [86, 130, 36]); } speck(d, r, 12, [160, 190, 70], 6); };
P.sea_lantern = (d, r) => { fill(d, r, [172, 214, 206], 10); rect(d, 3, 3, 10, 10, [220, 244, 238]); rect(d, 5, 5, 6, 6, [250, 255, 250]); for (let k = 0; k < 16; k++) { px(d, k, 0, [120, 170, 160]); px(d, 0, k, [120, 170, 160]); } };
P.packed_ice = (d, r) => { fill(d, r, [140, 180, 240], 6); for (let i = 0; i < 5; i++) { const x = (r() * 12) | 0, y = (r() * 14) | 0; line(d, x, y, x + 3, y + 1, [190, 215, 250]); } };
P.farmland_top = (d, r) => { fill(d, r, [90, 56, 36], 8); for (let x = 0; x < 16; x += 4) for (let y = 0; y < 16; y++) px(d, x, y, [62, 38, 24]); speck(d, r, 10, [110, 72, 48], 6); };
P.sapling = (d, r) => { d.fill(0); for (let y = 8; y < 15; y++) px(d, 7, y, [100, 76, 40]); for (const [x, y] of [[4, 5], [5, 4], [6, 3], [7, 2], [8, 3], [9, 4], [10, 5], [5, 6], [6, 6], [8, 6], [9, 6], [6, 7], [8, 7], [7, 5], [7, 6], [6, 5], [8, 5], [7, 4], [7, 3]]) px(d, x, y, [48 + ((x * 7 + y * 3) % 20), 120 + ((x * 5) % 22), 40]); };
for (let st = 0; st < 4; st++) {
  P['wheat_' + st] = (d, r) => {
    d.fill(0); const rr = mulberry32(5 + st);
    const h = [4, 7, 10, 14][st], col = st === 3 ? [214, 186, 90] : [70 + st * 25, 150 - st * 10, 40];
    for (let x = 1; x < 16; x += 3) { const hh = h - ((rr() * 3) | 0); for (let k = 0; k < hh; k++) px(d, x, 15 - k, [col[0] + (rr() * 20 - 10), col[1] + (rr() * 20 - 10), col[2]]); if (st === 3) { px(d, x, 15 - hh, [230, 200, 100]); px(d, x + 1, 15 - hh + 1, [214, 180, 80]); px(d, x - 1, 15 - hh + 2, [214, 180, 80]); } }
  };
}
P.bed_top = (d, r) => { fill(d, r, [190, 30, 30], 6); rect(d, 0, 0, 16, 5, [240, 240, 240]); rect(d, 1, 1, 14, 3, [250, 250, 250]); };
P.bed_side = (d, r) => { fill(d, r, [160, 110, 60], 5); rect(d, 0, 0, 16, 9, [190, 30, 30]); rect(d, 0, 0, 16, 2, [230, 70, 60]); };
P.bed_bottom = (d, r) => P.planks_oak(d, r);
P.door_bottom = (d, r) => {
  P.planks_oak(d, r);
  for (let k = 0; k < 16; k++) { px(d, k, 15, [70, 48, 22]); px(d, 0, k, [88, 62, 30]); px(d, 15, k, [88, 62, 30]); }
  rect(d, 2, 2, 12, 5, [136, 106, 58]); rect(d, 2, 9, 12, 5, [136, 106, 58]);
  rect(d, 2, 2, 12, 1, [96, 70, 36]); rect(d, 2, 9, 12, 1, [96, 70, 36]);
  rect(d, 12, 7, 2, 2, [196, 196, 204]); px(d, 12, 7, [240, 240, 246]);
};
P.door_top = (d, r) => {
  P.planks_oak(d, r);
  for (let k = 0; k < 16; k++) { px(d, k, 0, [88, 62, 30]); px(d, 0, k, [88, 62, 30]); px(d, 15, k, [88, 62, 30]); }
  rect(d, 2, 2, 12, 6, [150, 200, 230]); rect(d, 3, 3, 4, 2, [210, 235, 250]);
  rect(d, 2, 2, 12, 1, [96, 70, 36]); rect(d, 2, 7, 12, 1, [96, 70, 36]); rect(d, 7, 2, 2, 6, [96, 70, 36]);
  rect(d, 2, 10, 12, 4, [136, 106, 58]); rect(d, 2, 10, 12, 1, [96, 70, 36]);
};

// ---- színes gyapjú és beton ----
COLORS.forEach(([n, h], i) => {
  const c = rgb(h);
  P['wool_c' + i] = (d, r) => { fill(d, r, c, 6); speck(d, r, 40, dark(c, 0.9), 4); };
  P['concrete_c' + i] = (d, r) => { fill(d, r, c, 3); speck(d, r, 14, dark(c, 0.95), 2); };
  P['i_dye_' + i] = (d) => { d.fill(0); for (const [x, y, w, h2] of [[5, 7, 6, 4], [6, 6, 4, 6], [4, 8, 8, 2]]) rect(d, x, y, w, h2, c); px(d, 6, 7, dark([255, 255, 255], 0.95)); px(d, 9, 10, dark(c, 0.7)); };
});

// ---- tárgyak ----
const ing = (c, hi, lo) => (d) => { d.fill(0); for (let y = 6; y < 11; y++) for (let x = 3 + (10 - y) / 2 | 0; x < 13 - (y - 5) / 2 | 0; x++) px(d, x, y, y === 6 ? hi : y === 10 ? lo : c); line(d, 5, 6, 11, 6, hi); };
P.i_copper_ingot = ing([224, 128, 90], [255, 190, 150], [160, 80, 50]);
P.i_raw_copper = (d, r) => { d.fill(0); ellipse(d, r, 8, 9, 4.8, 4, [200, 120, 86], 10); speck(d, r, 6, [90, 170, 130], 8); };
P.i_lapis = (d, r) => { d.fill(0); ellipse(d, r, 8, 9, 4.4, 4, [38, 76, 200], 14); px(d, 6, 8, [130, 170, 255]); px(d, 9, 10, [20, 40, 130]); };
P.i_redstone = (d, r) => { d.fill(0); for (let y = 6; y < 13; y++) for (let x = 8 - (y - 5); x < 8 + (y - 5); x++) { const k = (r() * 2 - 1) * 24; px(d, x, y, [200 + k, 20, 14]); } };
P.i_emerald = (d) => { d.fill(0); for (let y = 4; y <= 12; y++) { const w = y < 8 ? 3 + (y - 4) : 7 - (y - 8) * 1; const x0 = Math.round(8 - w / 2), x1 = Math.round(8 + w / 2); for (let x = x0; x < x1; x++) px(d, x, y, y > 8 ? [20, 150, 64] : [40, 210, 90]); } line(d, 6, 5, 9, 5, [190, 255, 210]); px(d, 7, 7, [190, 255, 210]); };
P.i_quartz = (d) => { d.fill(0); for (const [x, y] of [[8, 4], [7, 5], [8, 5], [9, 5], [7, 6], [8, 6], [9, 6], [6, 7], [7, 7], [8, 7], [9, 7], [6, 8], [7, 8], [8, 8], [9, 8], [7, 9], [8, 9], [7, 10]]) px(d, x, y, [236, 230, 222]); px(d, 8, 5, [255, 255, 255]); px(d, 7, 7, [200, 195, 188]); };
P.i_clay_ball = (d, r) => { d.fill(0); ellipse(d, r, 8, 9, 4.6, 4.4, [160, 166, 182], 8); px(d, 6, 8, [200, 206, 220]); };
P.i_brick = (d, r) => { d.fill(0); rect(d, 3, 5, 10, 6, [160, 78, 58]); rect(d, 3, 5, 10, 1, [196, 110, 84]); rect(d, 3, 10, 10, 1, [110, 50, 38]); speck(d, r, 6, [130, 60, 44], 8); };
P.i_feather = (d) => { d.fill(0); line(d, 3, 13, 12, 3, [230, 230, 230]); line(d, 4, 13, 13, 4, [200, 200, 200]); line(d, 3, 12, 11, 3, [250, 250, 250]); line(d, 2, 14, 4, 12, [150, 150, 150]); };
P.i_bone = (d) => { d.fill(0); line(d, 4, 12, 12, 4, [240, 240, 230]); line(d, 5, 12, 12, 5, [210, 210, 200]); for (const [x, y] of [[3, 12], [4, 13], [3, 13], [12, 3], [13, 4], [13, 3]]) px(d, x, y, [240, 240, 230]); };
P.i_string = (d) => { d.fill(0); for (let i = 0; i < 12; i++) { px(d, 2 + i, 12 - i + (i % 2), [235, 235, 235]); } px(d, 4, 11, [200, 200, 200]); px(d, 9, 6, [200, 200, 200]); };
P.i_leather = (d, r) => { d.fill(0); rect(d, 3, 4, 10, 9, [160, 98, 60]); rect(d, 2, 5, 2, 4, [160, 98, 60]); rect(d, 12, 5, 2, 4, [160, 98, 60]); speck(d, r, 10, [120, 70, 40], 8); rect(d, 4, 4, 8, 1, [190, 126, 84]); };
P.i_seeds = (d, r) => { d.fill(0); for (const [x, y] of [[5, 7], [6, 7], [8, 9], [9, 9], [6, 11], [10, 6], [7, 5]]) { px(d, x, y, [60, 120, 40]); px(d, x + 1, y, [40, 90, 30]); } };
P.i_wheat = (d) => { d.fill(0); line(d, 4, 14, 9, 3, [200, 170, 70]); line(d, 8, 14, 11, 4, [214, 186, 90]); line(d, 11, 14, 12, 5, [190, 160, 60]); for (const [x, y] of [[9, 3], [10, 4], [8, 4], [11, 4], [12, 5], [11, 5]]) px(d, x, y, [230, 200, 100]); };
P.i_bread = (d, r) => { d.fill(0); ellipse(d, r, 8, 9, 6, 3.4, [196, 140, 60], 8); for (let k = 0; k < 4; k++) line(d, 4 + k * 2, 7, 5 + k * 2, 10, [140, 90, 36]); rect(d, 3, 8, 10, 1, [224, 176, 92]); };
const meat2 = (c, hi) => (d, r) => { d.fill(0); ellipse(d, r, 8, 9, 5, 4, c, 8); speck(d, r, 7, hi, 8); rect(d, 12, 7, 2, 3, [240, 236, 220]); rect(d, 13, 6, 2, 2, [240, 236, 220]); };
P.i_raw_chicken = meat2([240, 190, 170], [255, 225, 210]); P.i_cooked_chicken = meat2([190, 120, 60], [220, 156, 90]);
P.i_raw_mutton = meat2([210, 90, 100], [240, 170, 170]); P.i_cooked_mutton = meat2([150, 80, 44], [190, 116, 70]);
P.i_golden_apple = (d, r) => { d.fill(0); ellipse(d, r, 8, 9.5, 4.8, 4.6, [250, 214, 60], 10); px(d, 6, 8, [255, 250, 190]); px(d, 6, 9, [255, 250, 190]); px(d, 8, 4, [90, 60, 30]); px(d, 9, 3, [60, 160, 40]); px(d, 10, 3, [60, 160, 40]); };
P.i_melon_slice = (d) => { d.fill(0); for (let y = 5; y < 12; y++) for (let x = 3 + (y - 5); x < 13 - (y - 5); x++) px(d, x, y, y === 11 || x === 3 + (y - 5) || x === 12 - (y - 5) ? [90, 140, 40] : [220, 60, 70]); for (const [x, y] of [[7, 7], [9, 8], [8, 9]]) px(d, x, y, [30, 20, 20]); };
P.i_egg = (d, r) => { d.fill(0); ellipse(d, r, 8, 9, 3.6, 4.6, [226, 200, 160], 6); px(d, 7, 7, [255, 240, 210]); };
const bucket = (fillc) => (d) => {
  d.fill(0);
  for (let y = 5; y < 13; y++) { const inset = Math.floor((y - 5) / 3); for (let x = 3 + inset; x < 13 - inset; x++) px(d, x, y, y === 5 ? [190, 190, 196] : (x === 3 + inset || x === 12 - inset ? [120, 120, 128] : [160, 160, 168])); }
  if (fillc) rect(d, 4, 5, 8, 2, fillc); else rect(d, 4, 5, 8, 1, [60, 60, 66]);
  line(d, 3, 4, 12, 4, [140, 140, 148]);
};
P.i_bucket = bucket(null); P.i_bucket_water = bucket([50, 90, 220]); P.i_bucket_lava = bucket([240, 120, 14]);
P.i_shears = (d) => { d.fill(0); line(d, 3, 12, 11, 4, [200, 200, 206]); line(d, 3, 4, 11, 12, [170, 170, 178]); rect(d, 2, 12, 3, 3, [150, 60, 40]); rect(d, 2, 2, 3, 3, [150, 60, 40]); px(d, 8, 8, [60, 60, 66]); };
P.i_flint_steel = (d) => { d.fill(0); rect(d, 3, 8, 6, 5, [190, 190, 198]); rect(d, 4, 9, 4, 3, [0, 0, 0], 0); rect(d, 4, 9, 4, 3, [90, 90, 98]); rect(d, 8, 4, 5, 5, [70, 70, 76]); px(d, 9, 5, [130, 130, 140]); px(d, 10, 4, [255, 190, 60]); };
P.i_bow = (d) => { d.fill(0); const pts = [[11, 2], [12, 3], [13, 4], [13, 6], [13, 8], [13, 10], [12, 12], [11, 13]]; for (const [x, y] of pts) { px(d, x - 1, y, [140, 96, 48]); px(d, x, y, [110, 76, 36]); } line(d, 11, 2, 11, 13, [230, 230, 230]); };
P.i_arrow = (d) => { d.fill(0); line(d, 3, 13, 11, 5, [150, 110, 56]); line(d, 4, 13, 12, 5, [120, 86, 40]); for (const [x, y] of [[12, 4], [13, 3], [12, 3], [13, 4], [11, 4], [13, 5]]) px(d, x, y, [140, 140, 148]); for (const [x, y] of [[2, 14], [3, 14], [2, 13], [4, 14], [2, 12]]) px(d, x, y, [236, 236, 236]); };

// ---- páncél ----
export const ARM_MATS = [['leather', 'Bőr', [160, 98, 60], [200, 134, 88], [110, 64, 38]], ['iron', 'Vas', [212, 212, 218], [248, 248, 252], [140, 140, 148]], ['gold', 'Arany', [244, 206, 52], [255, 244, 150], [186, 140, 20]], ['diamond', 'Gyémánt', [64, 214, 212], [176, 255, 250], [30, 140, 150]]];
export const ARM_TYPES = [['helmet', 'sisak'], ['chestplate', 'mellvért'], ['leggings', 'nadrág'], ['boots', 'csizma']];
function armorTile(type, m) {
  return (d) => {
    d.fill(0); const [, , c, hi, lo] = m;
    const R = (x, y, w, h) => { rect(d, x, y, w, h, c); rect(d, x, y, w, 1, hi); rect(d, x, y + h - 1, w, 1, lo); };
    if (type === 'helmet') { R(3, 3, 10, 6); rect(d, 3, 9, 3, 3, c); rect(d, 10, 9, 3, 3, c); rect(d, 3, 9, 1, 3, lo); rect(d, 12, 9, 1, 3, lo); rect(d, 6, 6, 4, 3, [0, 0, 0], 0); px(d, 7, 7, [30, 24, 20]); }
    if (type === 'chestplate') { R(4, 3, 8, 10); rect(d, 1, 3, 3, 5, c); rect(d, 12, 3, 3, 5, c); rect(d, 1, 3, 3, 1, hi); rect(d, 12, 3, 3, 1, hi); rect(d, 6, 3, 4, 2, [0, 0, 0], 0); rect(d, 7, 6, 2, 6, lo); }
    if (type === 'leggings') { R(3, 3, 10, 4); rect(d, 3, 7, 4, 7, c); rect(d, 9, 7, 4, 7, c); rect(d, 3, 7, 1, 7, hi); rect(d, 9, 7, 1, 7, hi); rect(d, 6, 7, 1, 7, lo); rect(d, 12, 7, 1, 7, lo); }
    if (type === 'boots') { R(2, 6, 5, 6); R(9, 6, 5, 6); rect(d, 2, 11, 6, 2, c); rect(d, 9, 11, 6, 2, c); rect(d, 2, 12, 6, 1, lo); rect(d, 9, 12, 6, 1, lo); }
  };
}
for (const m of ARM_MATS) for (const [t] of ARM_TYPES) P['armor_' + t + '_' + m[0]] = armorTile(t, m);

// ---- kerítés / kapu / létra / csapóajtó ----
P.ladder = (d, r) => {
  d.fill(0);
  const wd = [128, 92, 48], wl = [158, 118, 64], wk = [96, 68, 34];
  for (let y = 0; y < 16; y++) { px(d, 2, y, wl); px(d, 3, y, wd); px(d, 12, y, wl); px(d, 13, y, wd); }
  for (const y of [1, 5, 9, 13]) for (let x = 4; x < 12; x++) { px(d, x, y, wl); px(d, x, y + 1, wk); }
};
P.trapdoor = (d, r) => {
  P.planks_oak(d, r);
  const e = [92, 64, 30], m = [120, 88, 46];
  for (let k = 0; k < 16; k++) { px(d, k, 0, e); px(d, k, 15, e); px(d, 0, k, e); px(d, 15, k, e); }
  for (let k = 1; k < 15; k++) { px(d, k, 1, m); px(d, k, 14, m); px(d, 1, k, m); px(d, 14, k, m); px(d, k, 7, e); px(d, k, 8, e); }
  rect(d, 6, 6, 4, 4, [70, 50, 24]); px(d, 7, 7, [190, 190, 198]);
};
P.i_fence = (d, r) => {
  d.fill(0);
  const wl = [158, 118, 64], wd = [112, 80, 40];
  for (const x of [2, 12]) for (let y = 1; y < 15; y++) { px(d, x, y, wl); px(d, x + 1, y, wd); }
  for (const y of [4, 9]) for (let x = 4; x < 12; x++) { px(d, x, y, wl); px(d, x, y + 1, wd); }
};
P.i_gate = (d, r) => {
  d.fill(0);
  const wl = [158, 118, 64], wd = [112, 80, 40];
  for (const x of [1, 13]) for (let y = 2; y < 15; y++) { px(d, x, y, wl); px(d, x + 1, y, wd); }
  for (const y of [4, 10]) for (let x = 3; x < 13; x++) { px(d, x, y, wl); px(d, x, y + 1, wd); }
  for (let y = 5; y < 10; y++) { px(d, 7, y, wl); px(d, 8, y, wd); }
};

// ---- redstone ----
P.lever_stick = (d, r) => { fill(d, r, [128, 92, 48], 14); for (let k = 0; k < 16; k++) { px(d, k, 0, [96, 68, 34]); px(d, k, 15, [96, 68, 34]); } };
P.dust = (d, r) => { // fehér-szürke alap, a mesher pirosra színezi
  d.fill(0);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const k = 200 + ((r() * 55) | 0); px(d, x, y, [k, k, k], 250); }
};
const lampTex = on => (d, r) => {
  fill(d, r, on ? [250, 210, 120] : [96, 62, 38], on ? 14 : 12);
  const e = on ? [196, 140, 60] : [64, 40, 24], m = on ? [255, 240, 170] : [124, 80, 50];
  for (let k = 0; k < 16; k++) { px(d, k, 0, e); px(d, k, 15, e); px(d, 0, k, e); px(d, 15, k, e); }
  for (let k = 3; k < 13; k++) { px(d, k, 3, m); px(d, k, 12, m); px(d, 3, k, m); px(d, 12, k, m); }
  rect(d, 6, 6, 4, 4, on ? [255, 250, 200] : [150, 100, 60]);
};
P.lamp = lampTex(false); P.lamp_on = lampTex(true);
const rsTorchTex = on => (d, r) => {
  d.fill(0);
  for (let y = 8; y < 16; y++) { px(d, 7, y, [138, 100, 50]); px(d, 8, y, [108, 76, 36]); }
  const a = on ? [255, 60, 40] : [96, 24, 20], b2 = on ? [220, 20, 14] : [70, 14, 12];
  px(d, 7, 6, a); px(d, 8, 6, b2); px(d, 7, 7, a); px(d, 8, 7, b2); px(d, 7, 5, on ? [255, 140, 120] : a); px(d, 8, 5, a);
};
P.rs_torch = rsTorchTex(true); P.rs_torch_off = rsTorchTex(false);
P.i_lever = (d, r) => {
  d.fill(0);
  rect(d, 4, 11, 8, 3, [118, 118, 122]); rect(d, 4, 14, 8, 1, [86, 86, 90]);
  for (let k = 0; k < 8; k++) { px(d, 6 + (k >> 1), 10 - k, [150, 108, 56]); px(d, 7 + (k >> 1), 10 - k, [112, 78, 38]); }
  px(d, 10, 2, [190, 140, 70]);
};
P.i_button = (d, r) => { d.fill(0); rect(d, 4, 6, 8, 5, [126, 126, 130]); rect(d, 4, 6, 8, 1, [160, 160, 164]); rect(d, 4, 10, 8, 1, [92, 92, 96]); rect(d, 4, 11, 8, 2, [70, 70, 74]); };
P.i_plate = (d, r) => { d.fill(0); rect(d, 2, 9, 12, 3, [126, 126, 130]); rect(d, 2, 9, 12, 1, [164, 164, 168]); rect(d, 2, 12, 12, 1, [86, 86, 90]); };

// ---- parancsblokk ----
const cmdTex = (base, light) => (d, r) => {
  fill(d, r, base, 8);
  for (let k = 0; k < 16; k++) { px(d, k, 0, light); px(d, k, 15, light); px(d, 0, k, light); px(d, 15, k, light); }
  for (let k = 2; k < 14; k++) { px(d, k, 2, [0, 0, 0]); px(d, k, 13, [0, 0, 0]); px(d, 2, k, [0, 0, 0]); px(d, 13, k, [0, 0, 0]); }
  for (let k = 4; k <= 11; k++) px(d, k, 8, light);              // nyíl
  for (let k = 0; k < 4; k++) { px(d, 8 + k, 5 + k, light); px(d, 8 + k, 11 - k, light); }
};
P.cmd = cmdTex([176, 116, 60], [244, 190, 120]); P.cmd_rep = cmdTex([118, 80, 160], [196, 160, 240]); P.cmd_chain = cmdTex([80, 140, 100], [160, 230, 170]);

// ---- szék / fejőállvány / fészek ----
P.straw = (d, r) => { fill(d, r, [214, 184, 90], 22); for (let i = 0; i < 24; i++) { const x = (r() * 16) | 0, y = (r() * 16) | 0; rect(d, x, y, 3, 1, [170, 136, 56]); } };
const milkerBase = (d, r) => { P.planks_oak(d, r); rect(d, 0, 0, 16, 2, [88, 60, 28]); rect(d, 0, 14, 16, 2, [88, 60, 28]); rect(d, 0, 0, 2, 16, [88, 60, 28]); rect(d, 14, 0, 2, 16, [88, 60, 28]); };
P.milker_empty = (d, r) => { milkerBase(d, r); rect(d, 4, 4, 8, 8, [60, 42, 22]); };
P.milker_bucket = (d, r) => { milkerBase(d, r); rect(d, 4, 4, 8, 8, [60, 42, 22]); rect(d, 5, 6, 6, 5, [170, 170, 178]); rect(d, 5, 6, 6, 1, [210, 210, 216]); rect(d, 6, 7, 4, 2, [40, 40, 46]); };
P.milker_milk = (d, r) => { milkerBase(d, r); rect(d, 4, 4, 8, 8, [60, 42, 22]); rect(d, 5, 6, 6, 5, [170, 170, 178]); rect(d, 5, 6, 6, 1, [210, 210, 216]); rect(d, 6, 7, 4, 2, [250, 250, 250]); };
const hen = fed => (d, r) => { d.fill(0); P.straw(d, r); rect(d, 3, 3, 10, 10, [245, 245, 240]); rect(d, 3, 3, 10, 2, [225, 225, 218]); rect(d, 10, 5, 2, 2, [20, 20, 20]); rect(d, 12, 6, 2, 1, [240, 150, 30]); rect(d, 9, 2, 3, 2, [200, 40, 40]); if (fed) rect(d, 5, 9, 4, 1, [200, 180, 60]); };
P.nest_hen = hen(false); P.nest_hen_fed = hen(true);
P.nest_egg = (d, r) => { fill(d, r, [236, 214, 176], 8); rect(d, 3, 3, 3, 3, [255, 245, 225]); };
P.i_chair = (d, r) => { d.fill(0); rect(d, 4, 2, 8, 2, [150, 110, 58]); rect(d, 4, 2, 2, 12, [120, 90, 46]); rect(d, 4, 8, 8, 2, [170, 128, 70]); rect(d, 10, 10, 2, 4, [120, 90, 46]); };
P.i_nest = (d, r) => { d.fill(0); ellipse(d, r, 8, 10, 6, 3.5, [214, 184, 90], 10); rect(d, 3, 9, 10, 2, [120, 90, 46]); };
P.i_bucket_milk = bucket([250, 250, 250]);

// ---- konyhai sütő + ételek ----
P.kitchen_top = (d, r) => { fill(d, r, [70, 70, 76], 8); rect(d, 2, 2, 12, 12, [50, 50, 56]); for (const k of [4, 8, 11]) rect(d, k, 4, 2, 8, [30, 30, 34]); };
P.kitchen_side = (d, r) => { P.bricks(d, r); };
P.kitchen_front = (d, r) => { P.bricks(d, r); rect(d, 3, 4, 10, 9, [40, 40, 46]); rect(d, 4, 5, 8, 7, [225, 150, 60]); rect(d, 4, 5, 8, 2, [250, 200, 90]); rect(d, 5, 2, 6, 1, [200, 200, 205]); px(d, 4, 2, [180, 60, 50]); px(d, 11, 2, [180, 60, 50]); };
const disc = (c1, c2, extra) => (d, r) => { d.fill(0); ellipse(d, r, 8, 9, 6, 5, c1, 10); ellipse(d, r, 8, 9, 4, 3, c2, 10); if (extra) extra(d); };
P.i_cheese = (d) => { d.fill(0); for (let y = 6; y < 13; y++) for (let x = 2 + (y - 6) / 2 | 0; x < 14; x++) px(d, x, y, y === 6 ? [255, 230, 120] : [240, 195, 60]); px(d, 6, 9, [200, 150, 30]); px(d, 10, 8, [200, 150, 30]); px(d, 9, 11, [200, 150, 30]); };
P.i_omelette = disc([250, 215, 80], [255, 240, 150], d => { rect(d, 5, 8, 2, 2, [90, 170, 70]); });
P.i_fried_egg = disc([250, 250, 250], [250, 190, 40], null);
P.i_pizza = disc([220, 170, 90], [235, 190, 80], d => { rect(d, 5, 7, 2, 2, [190, 50, 40]); rect(d, 9, 9, 2, 2, [190, 50, 40]); rect(d, 7, 11, 2, 1, [190, 50, 40]); });
P.i_pancake = (d, r) => { d.fill(0); for (let k = 0; k < 3; k++) { ellipse(d, r, 8, 11 - k * 2, 6, 2.2, [215, 160, 80], 8); } rect(d, 6, 4, 4, 1, [250, 220, 90]); };
P.i_sandwich = (d) => { d.fill(0); rect(d, 2, 5, 12, 2, [210, 160, 90]); rect(d, 2, 7, 12, 1, [250, 210, 70]); rect(d, 2, 8, 12, 2, [200, 110, 90]); rect(d, 2, 10, 12, 2, [210, 160, 90]); };
P.i_apple_pie = disc([200, 150, 80], [180, 110, 50], d => { line(d, 4, 7, 12, 11, [230, 190, 120]); line(d, 4, 11, 12, 7, [230, 190, 120]); });
P.i_smoothie = (d) => { d.fill(0); rect(d, 5, 3, 6, 10, [235, 120, 130]); rect(d, 5, 3, 6, 1, [255, 255, 255]); rect(d, 7, 1, 1, 4, [80, 200, 90]); rect(d, 4, 3, 1, 10, [200, 220, 230]); rect(d, 11, 3, 1, 10, [200, 220, 230]); };

// ---- Nether / End textúrák ----
P.nq_ore = (d, r) => { P.netherrack ? P.netherrack(d, r) : fill(d, r, [110, 40, 40], 14); for (let i = 0; i < 6; i++) rect(d, (r() * 13) | 0, (r() * 13) | 0, 2, 2, [235, 230, 220]); };
P.end_stone = (d, r) => { fill(d, r, [222, 222, 160], 14); speck(d, r, [196, 196, 130], 40); };
P.portal = (d, r) => { d.fill(0); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const v = Math.sin(x * 0.9 + y * 0.5) + Math.cos(y * 1.1 - x * 0.3); if (v > -0.6) px(d, x, y, [110 + ((v * 40) | 0) + 40, 30, 200 + ((r() * 40) | 0)]); } };
P.end_portal = (d, r) => { fill(d, r, [8, 14, 20], 4); for (let i = 0; i < 14; i++) px(d, (r() * 16) | 0, (r() * 16) | 0, [80, 200, 180]); };
P.end_frame = (d, r) => { fill(d, r, [90, 120, 90], 10); rect(d, 0, 0, 16, 2, [220, 220, 150]); rect(d, 0, 14, 16, 2, [60, 80, 60]); rect(d, 4, 4, 8, 8, [50, 70, 55]); };
P.end_eye = (d, r) => { fill(d, r, [30, 110, 90], 10); rect(d, 5, 5, 6, 6, [20, 160, 120]); rect(d, 7, 7, 2, 2, [10, 30, 20]); };
P.i_pearl = (d, r) => { d.fill(0); ellipse(d, r, 8, 8, 5, 5, [20, 110, 100], 10); px(d, 6, 6, [120, 230, 200]); px(d, 7, 6, [120, 230, 200]); };
P.i_eye = (d, r) => { d.fill(0); ellipse(d, r, 8, 8, 5, 5, [30, 150, 110], 10); rect(d, 7, 7, 3, 3, [230, 120, 30]); px(d, 8, 8, [20, 20, 20]); };
P.i_glowdust = (d, r) => { d.fill(0); for (let i = 0; i < 18; i++) px(d, 3 + ((r() * 10) | 0), 6 + ((r() * 7) | 0), [250, 210, 100]); };
P.end_frame_ic = null;

P.enchant_top = (d, r) => { fill(d, r, [150, 20, 30], 10); rect(d, 0, 0, 16, 1, [60, 10, 20]); rect(d, 0, 15, 16, 1, [60, 10, 20]); rect(d, 0, 0, 1, 16, [60, 10, 20]); rect(d, 15, 0, 1, 16, [60, 10, 20]); rect(d, 5, 5, 6, 6, [90, 60, 150]); rect(d, 7, 6, 2, 4, [230, 230, 250]); };
P.enchant_side = (d, r) => { P.obsidian(d, r); rect(d, 0, 0, 16, 4, [150, 20, 30]); for (const [x, y] of [[3, 9], [8, 11], [12, 8]]) px(d, x, y, [90, 230, 220]); };
P.anvil_top = (d, r) => { fill(d, r, [60, 60, 66], 8); rect(d, 3, 6, 10, 4, [40, 40, 46]); };
P.anvil_side = (d, r) => { fill(d, r, [70, 70, 76], 8); rect(d, 0, 0, 16, 3, [90, 90, 98]); rect(d, 5, 3, 6, 10, [56, 56, 62]); };

P.brew_top = (d, r) => { fill(d, r, [90, 90, 96], 8); rect(d, 6, 6, 4, 4, [30, 30, 36]); };
P.brew_side = (d, r) => { P.cobble(d, r); rect(d, 6, 2, 4, 10, [210, 180, 60]); rect(d, 3, 6, 10, 2, [210, 180, 60]); };
P.i_blazepowder = (d, r) => { d.fill(0); for (let i = 0; i < 20; i++) px(d, 3 + ((r() * 10) | 0), 4 + ((r() * 9) | 0), [250, 170 + ((r() * 60) | 0), 30]); };
P.i_bottle = (d) => { d.fill(0); rect(d, 6, 2, 4, 3, [190, 220, 230]); rect(d, 4, 5, 8, 8, [190, 220, 230]); rect(d, 5, 6, 6, 6, [20, 30, 40]); };
const pot = c => (d) => { d.fill(0); rect(d, 6, 2, 4, 3, [190, 220, 230]); rect(d, 4, 5, 8, 8, [190, 220, 230]); rect(d, 5, 6, 6, 6, c); rect(d, 5, 6, 6, 1, [255, 255, 255]); };
P.i_p_heal = pot([230, 40, 60]); P.i_p_speed = pot([100, 190, 240]); P.i_p_str = pot([170, 30, 30]); P.i_p_fire = pot([240, 150, 30]);

P.i_boat = (d) => { d.fill(0); rect(d, 2, 8, 12, 4, [150, 110, 58]); rect(d, 3, 12, 10, 1, [120, 90, 46]); rect(d, 1, 6, 2, 3, [170, 128, 70]); rect(d, 13, 6, 2, 3, [170, 128, 70]); rect(d, 4, 7, 8, 1, [100, 74, 36]); };

// spawn tojás ikonok: tojás alak két színnel (alap + foltok)
const spawnEgg = (base, spot) => (d, r) => {
  d.fill(0); ellipse(d, r, 8, 9, 4.6, 5.8, base, 6);
  for (const [x, y] of [[6, 5], [9, 7], [5, 9], [8, 11], [10, 10], [7, 7]]) px(d, x, y, spot);
  px(d, 6, 4, [255, 255, 255]);
};
P.i_egg_chicken = spawnEgg([226, 60, 50], [250, 245, 235]);
P.i_egg_cow = spawnEgg([70, 52, 40], [235, 235, 235]);
P.i_egg_sheep = spawnEgg([235, 235, 228], [90, 90, 90]);
P.i_egg_pig = spawnEgg([240, 160, 170], [200, 100, 115]);
