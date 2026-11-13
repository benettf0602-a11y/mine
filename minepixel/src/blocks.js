// Blokkok, tárgyak, receptek – minden adat egy helyen (DOM-mentes, node-ban is tesztelhető)
export const CS = 16, H = 128, SEA = 48;

export const B = {
  AIR: 0, STONE: 1, GRASS: 2, DIRT: 3, COBBLE: 4, PLANKS: 5, BEDROCK: 6, WATER: 7, LAVA: 8, SAND: 9, GRAVEL: 10,
  GOLD_ORE: 11, IRON_ORE: 12, COAL_ORE: 13, LOG: 14, LEAVES: 15, GLASS: 16, DIAMOND_ORE: 17, SNOW_GRASS: 18, SNOW: 19,
  ICE: 20, CACTUS: 21, CRAFTING: 22, FURNACE: 23, BRICKS: 24, TORCH: 25, GLOWSTONE: 26, WOOL: 27, TNT: 28, BOOKSHELF: 29,
  SANDSTONE: 30, STONEBRICK: 31, TALLGRASS: 32, DANDELION: 33, POPPY: 34, BIRCH_LOG: 35, BIRCH_LEAVES: 36,
  SPRUCE_LOG: 37, SPRUCE_LEAVES: 38, BIRCH_PLANKS: 39, SPRUCE_PLANKS: 40, DEEPSLATE: 41, D_COAL: 42, D_IRON: 43,
  D_GOLD: 44, D_DIAMOND: 45, CHEST: 46, OBSIDIAN: 47,
};

export const I = { STICK: 256, COAL: 257, IRON_INGOT: 258, GOLD_INGOT: 259, DIAMOND: 260, APPLE: 261, RAW_PORK: 262,
  COOKED_PORK: 263, RAW_BEEF: 264, STEAK: 265, ROTTEN: 266, GUNPOWDER: 267, RAW_IRON: 268, RAW_GOLD: 269, FLINT: 270 };

// Szerszámok: 280 + típus*5 + anyag
export const TOOL_TYPES = ['pickaxe', 'axe', 'shovel', 'sword', 'hoe'];
export const TOOL_TYPES_HU = ['csákány', 'balta', 'ásó', 'kard', 'kapa'];
export const MATS = ['wood', 'stone', 'iron', 'gold', 'diamond'];
export const MATS_HU = ['Fa', 'Kő', 'Vas', 'Arany', 'Gyémánt'];
const MAT_SPEED = [2, 4, 6, 12, 8];
const MAT_DUR = [59, 131, 250, 32, 1561];
const MAT_HARVEST = [0, 1, 2, 0, 3];
const MAT_DMG = [4, 5, 6, 4, 7];
TOOL_TYPES.forEach((t, ti) => MATS.forEach((m, mi) => { I[(m + '_' + t).toUpperCase()] = 280 + ti * 5 + mi; }));

export function toolInfo(id) {
  if (id < 280 || id >= 305) return null;
  const ti = ((id - 280) / 5) | 0, mi = (id - 280) % 5;
  const dmgBonus = ti === 3 ? MAT_DMG[mi] : ti === 1 ? MAT_DMG[mi] - 1 : ti === 0 ? MAT_DMG[mi] - 2 : 1;
  return { type: TOOL_TYPES[ti], mat: mi, speed: MAT_SPEED[mi], harvest: MAT_HARVEST[mi], dur: MAT_DUR[mi], dmg: Math.max(1, dmgBonus) };
}

export const BLOCKS = new Array(256).fill(null);
export const ITEMS = {};

const T = (top, bottom, side) => ({ top, bottom, side });
export function def(id, name, o) {
  const b = Object.assign({
    id, name, solid: true, opaque: true, shape: 'cube', hard: 1, tool: null, tier: 0, drop: id, snd: 'stone',
    emit: 0, op: null, cullSame: false, selectable: true, replace: false, tint: null, gravity: false, dir: false,
    tex: null, stack: 64, liquid: false,
  }, o);
  if (typeof b.tex === 'string') b.tex = T(b.tex, b.tex, b.tex);
  if (b.op === null) b.op = b.opaque ? 15 : 0;
  BLOCKS[id] = b;
  return b;
}
def(B.AIR, 'Levegő', { solid: false, opaque: false, shape: 'none', selectable: false, replace: true, hard: 0, drop: 0 });
def(B.STONE, 'Kő', { tex: 'stone', hard: 1.5, tool: 'pickaxe', drop: B.COBBLE });
def(B.GRASS, 'Fűblokk', { tex: T('grass_top', 'dirt', 'grass_side'), hard: 0.6, tool: 'shovel', drop: B.DIRT, snd: 'grass', tint: 'grass' });
def(B.DIRT, 'Föld', { tex: 'dirt', hard: 0.5, tool: 'shovel', snd: 'dirt' });
def(B.COBBLE, 'Macskakő', { tex: 'cobble', hard: 2, tool: 'pickaxe' });
def(B.PLANKS, 'Tölgydeszka', { tex: 'planks_oak', hard: 2, tool: 'axe', snd: 'wood' });
def(B.BEDROCK, 'Alapkőzet', { tex: 'bedrock', hard: -1 });
def(B.WATER, 'Víz', { tex: 'water', solid: false, opaque: false, shape: 'water', selectable: false, replace: true, hard: -1, drop: 0, cullSame: true, op: 1, liquid: true });
def(B.LAVA, 'Láva', { tex: 'lava', solid: false, opaque: false, shape: 'lava', selectable: false, replace: true, hard: -1, drop: 0, cullSame: true, op: 0, emit: 15, liquid: true });
def(B.SAND, 'Homok', { tex: 'sand', hard: 0.5, tool: 'shovel', snd: 'sand', gravity: true });
def(B.GRAVEL, 'Murva', { tex: 'gravel', hard: 0.6, tool: 'shovel', snd: 'gravel', gravity: true });
def(B.GOLD_ORE, 'Aranyérc', { tex: 'gold_ore', hard: 3, tool: 'pickaxe', tier: 3, drop: I.RAW_GOLD });
def(B.IRON_ORE, 'Vasérc', { tex: 'iron_ore', hard: 3, tool: 'pickaxe', tier: 1, drop: I.RAW_IRON });
def(B.COAL_ORE, 'Szénérc', { tex: 'coal_ore', hard: 3, tool: 'pickaxe', tier: 0, drop: I.COAL });
def(B.LOG, 'Tölgyrönk', { tex: T('log_top', 'log_top', 'log_oak'), hard: 2, tool: 'axe', snd: 'wood' });
def(B.LEAVES, 'Tölgylevél', { tex: 'leaves_oak', hard: 0.2, opaque: false, op: 1, snd: 'grass', cullSame: false, tint: 'foliage', drop: 0 });
def(B.GLASS, 'Üveg', { tex: 'glass', hard: 0.3, opaque: false, op: 0, snd: 'glass', cullSame: true, drop: 0 });
def(B.DIAMOND_ORE, 'Gyémántérc', { tex: 'diamond_ore', hard: 3, tool: 'pickaxe', tier: 3, drop: I.DIAMOND });
def(B.SNOW_GRASS, 'Havas fűblokk', { tex: T('snow', 'dirt', 'grass_snow'), hard: 0.6, tool: 'shovel', drop: B.DIRT, snd: 'grass' });
def(B.SNOW, 'Hóblokk', { tex: 'snow', hard: 0.2, tool: 'shovel', snd: 'grass' });
def(B.ICE, 'Jég', { tex: 'ice', hard: 0.5, tool: 'pickaxe', opaque: false, op: 1, snd: 'glass', cullSame: true, drop: 0 });
def(B.CACTUS, 'Kaktusz', { tex: T('cactus_top', 'cactus_bottom', 'cactus_side'), hard: 0.4, shape: 'cactus', opaque: false, snd: 'grass' });
def(B.CRAFTING, 'Barkácsasztal', { tex: T('crafting_top', 'planks_oak', 'crafting_side'), hard: 2.5, tool: 'axe', snd: 'wood', front: 'crafting_front', dir: true });
def(B.FURNACE, 'Kemence', { tex: T('furnace_top', 'furnace_top', 'furnace_side'), hard: 3.5, tool: 'pickaxe', front: 'furnace_front', dir: true });
def(B.BRICKS, 'Téglák', { tex: 'bricks', hard: 2, tool: 'pickaxe' });
def(B.TORCH, 'Fáklya', { tex: 'torch', hard: 0, solid: false, opaque: false, shape: 'torch', emit: 14, snd: 'wood', stack: 64 });
def(B.GLOWSTONE, 'Világítókő', { tex: 'glowstone', hard: 0.3, emit: 15, snd: 'glass' });
def(B.WOOL, 'Fehér gyapjú', { tex: 'wool_white', hard: 0.8, snd: 'cloth' });
def(B.TNT, 'TNT', { tex: T('tnt_top', 'tnt_bottom', 'tnt_side'), hard: 0, snd: 'grass' });
def(B.BOOKSHELF, 'Könyvespolc', { tex: T('planks_oak', 'planks_oak', 'bookshelf'), hard: 1.5, tool: 'axe', snd: 'wood' });
def(B.SANDSTONE, 'Homokkő', { tex: T('sandstone_top', 'sandstone_top', 'sandstone_side'), hard: 0.8, tool: 'pickaxe' });
def(B.STONEBRICK, 'Kőtégla', { tex: 'stonebrick', hard: 1.5, tool: 'pickaxe' });
def(B.TALLGRASS, 'Magas fű', { tex: 'tallgrass', solid: false, opaque: false, shape: 'cross', hard: 0, snd: 'grass', tint: 'grass', replace: true, drop: 0 });
def(B.DANDELION, 'Pitypang', { tex: 'dandelion', solid: false, opaque: false, shape: 'cross', hard: 0, snd: 'grass' });
def(B.POPPY, 'Pipacs', { tex: 'poppy', solid: false, opaque: false, shape: 'cross', hard: 0, snd: 'grass' });
def(B.BIRCH_LOG, 'Nyírrönk', { tex: T('log_birch_top', 'log_birch_top', 'log_birch'), hard: 2, tool: 'axe', snd: 'wood' });
def(B.BIRCH_LEAVES, 'Nyírlevél', { tex: 'leaves_birch', hard: 0.2, opaque: false, op: 1, snd: 'grass', drop: 0 });
def(B.SPRUCE_LOG, 'Lucfenyő-rönk', { tex: T('log_spruce_top', 'log_spruce_top', 'log_spruce'), hard: 2, tool: 'axe', snd: 'wood' });
def(B.SPRUCE_LEAVES, 'Lucfenyő-levél', { tex: 'leaves_spruce', hard: 0.2, opaque: false, op: 1, snd: 'grass', drop: 0 });
def(B.BIRCH_PLANKS, 'Nyírdeszka', { tex: 'planks_birch', hard: 2, tool: 'axe', snd: 'wood' });
def(B.SPRUCE_PLANKS, 'Lucfenyő-deszka', { tex: 'planks_spruce', hard: 2, tool: 'axe', snd: 'wood' });
def(B.DEEPSLATE, 'Mélypala', { tex: T('deepslate_top', 'deepslate_top', 'deepslate'), hard: 3, tool: 'pickaxe', drop: B.DEEPSLATE });
def(B.D_COAL, 'Mélypala szénérc', { tex: 'd_coal', hard: 4.5, tool: 'pickaxe', drop: I.COAL });
def(B.D_IRON, 'Mélypala vasérc', { tex: 'd_iron', hard: 4.5, tool: 'pickaxe', tier: 1, drop: I.RAW_IRON });
def(B.D_GOLD, 'Mélypala aranyérc', { tex: 'd_gold', hard: 4.5, tool: 'pickaxe', tier: 3, drop: I.RAW_GOLD });
def(B.D_DIAMOND, 'Mélypala gyémántérc', { tex: 'd_diamond', hard: 4.5, tool: 'pickaxe', tier: 3, drop: I.DIAMOND });
def(B.CHEST, 'Láda', { tex: T('chest_top', 'chest_top', 'chest_side'), hard: 2.5, tool: 'axe', snd: 'wood', front: 'chest_front', dir: true });
def(B.OBSIDIAN, 'Obszidián', { tex: 'obsidian', hard: 50, tool: 'pickaxe', tier: 3 });

// Gyorstáblák a világ és a mesher számára
export const OPAQUE = new Uint8Array(256);   // teljes blokk, elfedi a szomszédot
export const OP = new Uint8Array(256);       // fényelnyelés (15 = átlátszatlan)
export const EM = new Uint8Array(256);       // fényforrás
export const SOLID = new Uint8Array(256);
export const FK = new Uint8Array(256);       // folyadék fajta: 0 nincs, 1 víz, 2 láva
export const FL = new Uint8Array(256);
export const RSB = new Uint8Array(256);      // redstone-hoz tartozó blokkok (szimuláció figyeli)
export const RSW = new Uint8Array(256);      // betöltéskor felébresztendő (aktív) redstone blokkok       // folyadék szint: 0 forrás, 1..7 folyó, 8 zuhanó
for (const b of BLOCKS) if (b) { OPAQUE[b.id] = b.opaque ? 1 : 0; OP[b.id] = b.op; EM[b.id] = b.emit; SOLID[b.id] = b.solid ? 1 : 0; }

// ---- Tárgyak ----
export function item(id, name, o = {}) { ITEMS[id] = Object.assign({ id, name, stack: 64, food: 0, burn: 0, tex: null }, o); }
item(I.STICK, 'Pálca', { burn: 5, tex: 'i_stick' });
item(I.COAL, 'Szén', { burn: 80, tex: 'i_coal' });
item(I.IRON_INGOT, 'Vasrúd', { tex: 'i_iron_ingot' });
item(I.GOLD_INGOT, 'Aranyrúd', { tex: 'i_gold_ingot' });
item(I.DIAMOND, 'Gyémánt', { tex: 'i_diamond' });
item(I.APPLE, 'Alma', { food: 4, tex: 'i_apple' });
item(I.RAW_PORK, 'Nyers sertéshús', { food: 3, tex: 'i_raw_pork' });
item(I.COOKED_PORK, 'Sült sertéshús', { food: 8, tex: 'i_cooked_pork' });
item(I.RAW_BEEF, 'Nyers marhahús', { food: 3, tex: 'i_raw_beef' });
item(I.STEAK, 'Steak', { food: 8, tex: 'i_steak' });
item(I.ROTTEN, 'Rothadt hús', { food: 4, tex: 'i_rotten' });
item(I.GUNPOWDER, 'Lőpor', { tex: 'i_gunpowder' });
item(I.RAW_IRON, 'Nyers vas', { tex: 'i_raw_iron' });
item(I.RAW_GOLD, 'Nyers arany', { tex: 'i_raw_gold' });
item(I.FLINT, 'Kova', { tex: 'i_flint' });
TOOL_TYPES.forEach((t, ti) => MATS.forEach((m, mi) => {
  const id = 280 + ti * 5 + mi;
  item(id, MATS_HU[mi] + ' ' + TOOL_TYPES_HU[ti], { stack: 1, tool: true, tex: 'tool_' + t + '_' + m, burn: mi === 0 ? 10 : 0 });
}));

export function itemDef(id) {
  if (id < 256) { const b = BLOCKS[id]; return b ? { id, name: b.name, stack: 64, block: true, food: 0, burn: b.burn || (id === B.PLANKS || id === B.LOG || id === B.BIRCH_LOG || id === B.SPRUCE_LOG || id === B.BIRCH_PLANKS || id === B.SPRUCE_PLANKS) ? 15 : 0 } : null; }
  return ITEMS[id] || null;
}
export function isBlockItem(id) { return id > 0 && id < 256; }
export function maxStack(id) { const d = itemDef(id); return d ? d.stack : 64; }
export const ARMOR = {}; export const EXTRA_DUR = {};
export function maxDur(id) { const t = toolInfo(id); if (t) return t.dur; if (ARMOR[id]) return ARMOR[id].dur; return EXTRA_DUR[id] || 0; }

// ---- Blokk törése: idő és ejtett tárgy ----
export function canHarvest(b, toolId) {
  if (!b.tool) return true;
  const t = toolInfo(toolId);
  if (b.tool === 'pickaxe') { if (!t || t.type !== 'pickaxe') return b.tier === 0 && b.id !== B.STONE && b.id !== B.COBBLE && b.id !== B.OBSIDIAN && false; return t.harvest >= b.tier; }
  return true; // axe / shovel blokkok kézzel is ejtenek
}
export function breakTime(b, toolId) {
  if (b.hard < 0) return Infinity;
  if (b.hard === 0) return 0;
  const t = toolInfo(toolId);
  const ok = canHarvest(b, toolId);
  let speed = 1;
  if (t && b.tool === t.type) speed = t.speed;
  else if (t && b.id === B.LEAVES) speed = 1;
  return b.hard * (ok ? 1.5 : 5) / speed;
}
export function blockDrops(b, toolId, rnd = Math.random) {
  const out = [];
  if (!canHarvest(b, toolId)) return out;
  if (b.id === B.LEAVES || b.id === B.BIRCH_LEAVES || b.id === B.SPRUCE_LEAVES) {
    if (rnd() < 0.08) out.push([I.STICK, 1]);
    if (b.id === B.LEAVES && rnd() < 0.05) out.push([I.APPLE, 1]);
    if (b.id === B.LEAVES && rnd() < 0.06 && I.SAPLING_ITEM) out.push([I.SAPLING_ITEM, 1]);
    return out;
  }
  if (b.id === B.GRAVEL) { out.push([rnd() < 0.12 ? I.FLINT : B.GRAVEL, 1]); return out; }
  if (b.dropFn) return b.dropFn(rnd);
  if (b.id === B.TALLGRASS) { if (rnd() < 0.14 && I.SEEDS) out.push([I.SEEDS, 1]); return out; }
  if (b.id === B.GLASS || b.id === B.ICE) return out;
  if (b.drop) out.push([b.drop, 1]);
  return out;
}

// ---- Receptek ----
const PL = [B.PLANKS, B.BIRCH_PLANKS, B.SPRUCE_PLANKS];
const LG = [B.LOG, B.BIRCH_LOG, B.SPRUCE_LOG];
const S = I.STICK;
export const SHAPED = [
  { pat: ['P', 'P'], key: { P: PL }, out: [S, 4] },
  { pat: ['PP', 'PP'], key: { P: PL }, out: [B.CRAFTING, 1] },
  { pat: ['PPP', 'P.P', 'PPP'], key: { P: PL }, out: [B.CHEST, 1] },
  { pat: ['CCC', 'C.C', 'CCC'], key: { C: [B.COBBLE] }, out: [B.FURNACE, 1] },
  { pat: ['C', 'S'], key: { C: [I.COAL], S: [S] }, out: [B.TORCH, 4] },
  { pat: ['SS', 'SS'], key: { S: [B.STONE] }, out: [B.STONEBRICK, 4] },
  { pat: ['SS', 'SS'], key: { S: [B.SAND] }, out: [B.SANDSTONE, 1] },
  { pat: ['BB', 'BB'], key: { B: [B.COBBLE] }, out: [B.BRICKS, 1], skip: true },
  { pat: ['GSG', 'SGS', 'GSG'], key: { G: [I.GUNPOWDER], S: [B.SAND] }, out: [B.TNT, 1] },
  { pat: ['PPP', 'BBB', 'PPP'], key: { P: PL, B: [I.STICK] }, out: [B.BOOKSHELF, 1], skip: true },
  { pat: ['GGG', 'GGG', 'GGG'], key: { G: [I.GOLD_INGOT] }, out: [B.GLOWSTONE, 1], skip: true },
  { pat: ['PPP', 'P.P', 'PPP'], key: { P: [B.GLASS] }, out: [B.GLASS, 1], skip: true },
];
// Szerszámok
const MAT_ING = [PL, [B.COBBLE], [I.IRON_INGOT], [I.GOLD_INGOT], [I.DIAMOND]];
MATS.forEach((m, mi) => {
  SHAPED.push({ pat: ['MMM', '.S.', '.S.'], key: { M: MAT_ING[mi], S: [S] }, out: [I[(m + '_pickaxe').toUpperCase()], 1] });
  SHAPED.push({ pat: ['MM', 'MS', '.S'], key: { M: MAT_ING[mi], S: [S] }, out: [I[(m + '_axe').toUpperCase()], 1] });
  SHAPED.push({ pat: ['M', 'S', 'S'], key: { M: MAT_ING[mi], S: [S] }, out: [I[(m + '_shovel').toUpperCase()], 1] });
  SHAPED.push({ pat: ['M', 'M', 'S'], key: { M: MAT_ING[mi], S: [S] }, out: [I[(m + '_sword').toUpperCase()], 1] });
});
// Egyéb: üveg/színes dolgok – kemencében. Rönk -> deszka (alaklenyes)
export const SHAPELESS = [
  { ing: [B.LOG], out: [B.PLANKS, 4] },
  { ing: [B.BIRCH_LOG], out: [B.BIRCH_PLANKS, 4] },
  { ing: [B.SPRUCE_LOG], out: [B.SPRUCE_PLANKS, 4] },
];

function ingOk(want, id) { return want === '.' ? id === 0 : (Array.isArray(want) ? want.includes(id) : want === id); }

// grid: tömb (n*n), elemei {id,n} | null. Visszaad: {id,count} | null
export const KITCHEN = [], BREW = [];
const recList = k => k === 'brew' ? BREW : KITCHEN;
export function matchRecipe(grid, n, kitchen = false) {
  let minX = n, minY = n, maxX = -1, maxY = -1, count = 0;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (grid[y * n + x]) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); count++; }
  }
  if (!count) return null;
  const w = maxX - minX + 1, h = maxY - minY + 1;
  const cell = (x, y) => { const s = grid[(minY + y) * n + minX + x]; return s ? s.id : 0; };
  for (const r of (kitchen ? recList(kitchen).filter(k => k.pat) : SHAPED)) {
    if (r.skip) continue;
    if (r.pat.length !== h || r.pat[0].length !== w) continue;
    for (let mirror = 0; mirror < 2; mirror++) {
      let ok = true;
      for (let y = 0; y < h && ok; y++) for (let x = 0; x < w; x++) {
        const px = mirror ? w - 1 - x : x;
        const ch = r.pat[y][px];
        const id = cell(x, y);
        if (ch === '.') { if (id !== 0) { ok = false; break; } }
        else if (!ingOk(r.key[ch], id)) { ok = false; break; }
      }
      if (ok) return { id: r.out[0], count: r.out[1] };
    }
  }
  const have = grid.filter(s => s).map(s => s.id).sort((a, b) => a - b);
  for (const r of (kitchen ? recList(kitchen).filter(k => k.ing) : SHAPELESS)) {
    if (r.ing.length !== have.length) continue;
    const want = r.ing.slice().sort((a, b) => a - b);
    if (want.every((v, i) => v === have[i])) return { id: r.out[0], count: r.out[1] };
  }
  return null;
}

// ---- Kemence ----
export const SMELT = {
  [B.IRON_ORE]: I.IRON_INGOT, [I.RAW_IRON]: I.IRON_INGOT, [I.RAW_GOLD]: I.GOLD_INGOT, [B.GOLD_ORE]: I.GOLD_INGOT,
  [B.SAND]: B.GLASS, [B.COBBLE]: B.STONE, [I.RAW_PORK]: I.COOKED_PORK, [I.RAW_BEEF]: I.STEAK,
  [B.LOG]: I.COAL, [B.BIRCH_LOG]: I.COAL, [B.SPRUCE_LOG]: I.COAL, [B.STONE]: B.STONEBRICK, [B.CACTUS]: I.COAL,
};
export function fuelTime(id) { const d = itemDef(id); return d ? d.burn : 0; }

// ---- Biomok ----
export const BIOME = { PLAINS: 0, FOREST: 1, DESERT: 2, SNOWY: 3, MOUNTAIN: 4, OCEAN: 5, BEACH: 6, BIRCH: 7 };
export const BIOME_NAMES = ['Síkság', 'Erdő', 'Sivatag', 'Havas tundra', 'Hegyek', 'Óceán', 'Strand', 'Nyírerdő'];
