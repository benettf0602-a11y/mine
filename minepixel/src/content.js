// Bővített tartalom: ércek, blokkok, lépcsők, lapok, színes gyapjú/beton, ételek, páncélok, eszközök, receptek
import { FK, FL, RSB, RSW, B, I, BLOCKS, ITEMS, def, item, SHAPED, SHAPELESS, KITCHEN, BREW, SMELT, ARMOR, EXTRA_DUR, OPAQUE, OP, EM, SOLID, MATS, MATS_HU } from './blocks.js';
import { COLORS, ARM_MATS, ARM_TYPES } from './textures2.js';

const T = (top, bottom, side) => ({ top, bottom, side });
const ri = (a, b, rnd) => a + Math.floor(rnd() * (b - a + 1));

// ---------- azonosítók ----------
Object.assign(B, {
  COPPER_ORE: 48, LAPIS_ORE: 49, REDSTONE_ORE: 50, EMERALD_ORE: 51, D_COPPER: 52, D_LAPIS: 53, D_REDSTONE: 54,
  BLOCK_COAL: 55, BLOCK_IRON: 56, BLOCK_GOLD: 57, BLOCK_DIAMOND: 58, BLOCK_EMERALD: 59, BLOCK_LAPIS: 60, BLOCK_COPPER: 61, BLOCK_REDSTONE: 62,
  ANDESITE: 63, GRANITE: 64, DIORITE: 65, SMOOTH_STONE: 66, MOSSY_COBBLE: 67, MOSSY_STONEBRICK: 68, CRACKED_STONEBRICK: 69, CHISELED_STONEBRICK: 70,
  POL_ANDESITE: 71, POL_GRANITE: 72, POL_DIORITE: 73, CLAY: 74, TERRACOTTA: 75, NETHERRACK: 76, SOUL_SAND: 77, NETHER_BRICKS: 78, QUARTZ_BLOCK: 79,
  HAY: 80, PUMPKIN: 81, JACK: 82, MELON: 83, SEA_LANTERN: 84, PACKED_ICE: 85, FARMLAND: 86, WHEAT0: 87, WHEAT1: 88, WHEAT2: 89, WHEAT3: 90, SAPLING: 91, BED: 92,
});
const WOOL_BASE = 93;  // 93..107 -> szín 1..15
const CONC_BASE = 108; // 108..123 -> szín 0..15
const SLAB_BASE = 124, STAIR_BASE = 135;
Object.assign(B, { DOOR: 146, DOOR_TOP: 147, DOOR_OPEN: 148, DOOR_TOP_OPEN: 149 });
Object.assign(B, { FENCE: 162, FENCE_GATE: 163, FENCE_GATE_OPEN: 164, LADDER: 165, TRAPDOOR: 166, TRAPDOOR_OPEN: 167, TRAPDOOR_TOP: 168, TRAPDOOR_TOP_OPEN: 169 });
// redstone: kar, gomb, nyomólap, por (16 szint), lámpa, fáklya
Object.assign(B, { LEVER: 170, LEVER_ON: 171, BUTTON: 172, BUTTON_ON: 173, PLATE: 174, PLATE_ON: 175, DUST0: 176, LAMP: 192, LAMP_ON: 193, RSTORCH: 194, RSTORCH_OFF: 195, CMD: 196, CMD_REP: 197, CMD_CHAIN: 198 });
// folyó víz / láva: szintek (1..7 víz, 1..3 láva) + zuhanó változat
Object.assign(B, { WATER_F1: 150, WATER_F2: 151, WATER_F3: 152, WATER_F4: 153, WATER_F5: 154, WATER_F6: 155, WATER_F7: 156, WATER_FALL: 157, LAVA_F1: 158, LAVA_F2: 159, LAVA_F3: 160, LAVA_FALL: 161 });
export const woolId = i => i === 0 ? B.WOOL : WOOL_BASE + i - 1;
export const concreteId = i => CONC_BASE + i;

Object.assign(I, {
  COPPER_INGOT: 320, RAW_COPPER: 321, LAPIS: 322, REDSTONE: 323, EMERALD: 324, QUARTZ: 325, CLAY_BALL: 326, BRICK: 327, FEATHER: 328, BONE: 329, STRING: 330, LEATHER: 331,
  SEEDS: 332, WHEAT: 333, BREAD: 334, RAW_CHICKEN: 335, COOKED_CHICKEN: 336, RAW_MUTTON: 337, COOKED_MUTTON: 338, GOLDEN_APPLE: 339, MELON_SLICE: 340, EGG: 341,
  BUCKET: 342, WATER_BUCKET: 343, LAVA_BUCKET: 344, SHEARS: 345, FLINT_STEEL: 346, BOW: 347, ARROW: 348,
});
I.SAPLING_ITEM = B.SAPLING;
export const dyeId = i => 350 + i;

// ---------- blokkok ----------
const TICKS = new Uint8Array(256);
export { TICKS };
const stoneTool = { tool: 'pickaxe' };
def(B.COPPER_ORE, 'Rézérc', { tex: 'copper_ore', hard: 3, ...stoneTool, tier: 1, dropFn: r => [[I.RAW_COPPER, ri(2, 5, r)]] });
def(B.LAPIS_ORE, 'Lazurit érc', { tex: 'lapis_ore', hard: 3, ...stoneTool, tier: 1, dropFn: r => [[I.LAPIS, ri(4, 8, r)]] });
def(B.REDSTONE_ORE, 'Vörösk érc', { tex: 'redstone_ore', hard: 3, ...stoneTool, tier: 2, dropFn: r => [[I.REDSTONE, ri(4, 5, r)]] });
def(B.EMERALD_ORE, 'Smaragdérc', { tex: 'emerald_ore', hard: 3, ...stoneTool, tier: 2, dropFn: () => [[I.EMERALD, 1]] });
def(B.D_COPPER, 'Mélypala rézérc', { tex: 'd_copper', hard: 4.5, ...stoneTool, tier: 1, dropFn: r => [[I.RAW_COPPER, ri(2, 5, r)]] });
def(B.D_LAPIS, 'Mélypala lazurit érc', { tex: 'd_lapis', hard: 4.5, ...stoneTool, tier: 1, dropFn: r => [[I.LAPIS, ri(4, 8, r)]] });
def(B.D_REDSTONE, 'Mélypala vörösk érc', { tex: 'd_redstone', hard: 4.5, ...stoneTool, tier: 2, dropFn: r => [[I.REDSTONE, ri(4, 5, r)]] });
BLOCKS[B.REDSTONE_ORE].name = 'Redstone érc'; BLOCKS[B.D_REDSTONE].name = 'Mélypala redstone érc'; BLOCKS[B.LAPIS_ORE].name = 'Lapis lazuli érc'; BLOCKS[B.D_LAPIS].name = 'Mélypala lapis érc';
for (const id of [B.GOLD_ORE, B.D_GOLD]) BLOCKS[id].tier = 2;

const mins = [['BLOCK_COAL', 'Szénblokk', 'block_coal', 5, 80 * 10], ['BLOCK_IRON', 'Vasblokk', 'block_iron', 5], ['BLOCK_GOLD', 'Aranyblokk', 'block_gold', 3], ['BLOCK_DIAMOND', 'Gyémántblokk', 'block_diamond', 5],
  ['BLOCK_EMERALD', 'Smaragdblokk', 'block_emerald', 5], ['BLOCK_LAPIS', 'Lapisblokk', 'block_lapis', 3], ['BLOCK_COPPER', 'Rézblokk', 'block_copper', 3], ['BLOCK_REDSTONE', 'Redstone-blokk', 'block_redstone', 5]];
for (const [k, n, t, h, burn] of mins) def(B[k], n, { tex: t, hard: h, tool: 'pickaxe', tier: k === 'BLOCK_COAL' || k === 'BLOCK_LAPIS' || k === 'BLOCK_COPPER' ? 0 : 1, burn: burn || 0 });
const stones = [['ANDESITE', 'Andezit', 'andesite'], ['GRANITE', 'Gránit', 'granite'], ['DIORITE', 'Diorit', 'diorite'], ['SMOOTH_STONE', 'Sima kő', 'smooth_stone'], ['MOSSY_COBBLE', 'Mohás macskakő', 'mossy_cobble'],
  ['MOSSY_STONEBRICK', 'Mohás kőtégla', 'mossy_stonebrick'], ['CRACKED_STONEBRICK', 'Repedt kőtégla', 'cracked_stonebrick'], ['CHISELED_STONEBRICK', 'Vésett kőtégla', 'chiseled_stonebrick'],
  ['POL_ANDESITE', 'Csiszolt andezit', 'pol_andesite'], ['POL_GRANITE', 'Csiszolt gránit', 'pol_granite'], ['POL_DIORITE', 'Csiszolt diorit', 'pol_diorite'], ['NETHERRACK', 'Netherrack', 'netherrack'],
  ['NETHER_BRICKS', 'Nether téglák', 'nether_bricks'], ['TERRACOTTA', 'Terrakotta', 'terracotta'], ['QUARTZ_BLOCK', 'Kvarcblokk', 'quartz_block']];
for (const [k, n, t] of stones) def(B[k], n, { tex: t, hard: k === 'NETHERRACK' ? 0.4 : 1.5, tool: 'pickaxe', drop: k === 'GRANITE' || k === 'ANDESITE' || k === 'DIORITE' ? B[k] : B[k] });
BLOCKS[B.ANDESITE].hard = BLOCKS[B.GRANITE].hard = BLOCKS[B.DIORITE].hard = 1.5;
def(B.CLAY, 'Agyag', { tex: 'clay', hard: 0.6, tool: 'shovel', snd: 'dirt', dropFn: () => [[I.CLAY_BALL, 4]] });
def(B.SOUL_SAND, 'Lélekhomok', { tex: 'soul_sand', hard: 0.5, tool: 'shovel', snd: 'sand' });
def(B.HAY, 'Szénabála', { tex: T('hay_top', 'hay_top', 'hay_side'), hard: 0.5, snd: 'grass' });
def(B.PUMPKIN, 'Tök', { tex: T('pumpkin_top', 'pumpkin_top', 'pumpkin_side'), hard: 1, tool: 'axe', snd: 'wood' });
def(B.JACK, 'Töklámpás', { tex: T('pumpkin_top', 'pumpkin_top', 'pumpkin_side'), front: 'jack_face', dir: true, hard: 1, tool: 'axe', snd: 'wood', emit: 15 });
def(B.MELON, 'Görögdinnye', { tex: T('melon_top', 'melon_top', 'melon_side'), hard: 1, tool: 'axe', snd: 'wood', dropFn: r => [[I.MELON_SLICE, ri(3, 7, r)]] });
def(B.SEA_LANTERN, 'Tengeri lámpás', { tex: 'sea_lantern', hard: 0.3, snd: 'glass', emit: 15, dropFn: r => [[I.QUARTZ, ri(2, 3, r)]] });
def(B.PACKED_ICE, 'Tömör jég', { tex: 'packed_ice', hard: 0.5, tool: 'pickaxe', snd: 'glass', drop: 0 });
def(B.FARMLAND, 'Termőföld', { tex: T('farmland_top', 'dirt', 'dirt'), hard: 0.6, tool: 'shovel', snd: 'dirt', shape: 'farmland', opaque: false, op: 0, dropFn: () => [[B.DIRT, 1]], boxes: [[0, 0, 0, 1, 15 / 16, 1]] });
const cropNames = ['Búza (0)', 'Búza (1)', 'Búza (2)', 'Érett búza'];
for (let k = 0; k < 4; k++) {
  def(B.WHEAT0 + k, cropNames[k], { tex: 'wheat_' + k, solid: false, opaque: false, shape: 'cross', hard: 0, snd: 'grass', crop: true,
    dropFn: k < 3 ? () => [[I.SEEDS, 1]] : r => { const o = [[I.WHEAT, 1]]; const s = ri(0, 3, r); if (s) o.push([I.SEEDS, s]); return o; } });
  TICKS[B.WHEAT0 + k] = 1;
}
def(B.SAPLING, 'Tölgycsemete', { tex: 'sapling', solid: false, opaque: false, shape: 'cross', hard: 0, snd: 'grass' }); TICKS[B.SAPLING] = 1;
def(B.BED, 'Ágy', { tex: T('bed_top', 'bed_bottom', 'bed_side'), hard: 0.2, snd: 'cloth', shape: 'bed', opaque: false, op: 0, boxes: [[0, 0, 0, 1, 9 / 16, 1]], dir: true });
for (const id of [B.QUARTZ_BLOCK]) BLOCKS[id].tier = 0;
// ajtó: alsó + felső fél, zárt / nyitott változat (irány: w.facing = a játékos felé néző oldal)
const doorCommon = { hard: 3, tool: 'axe', snd: 'wood', shape: 'door', opaque: false, op: 0, burn: 8, drop: B.DOOR };
def(B.DOOR, 'Tölgyajtó', { ...doorCommon, tex: T('planks_oak', 'planks_oak', 'door_bottom') });
def(B.DOOR_TOP, 'Tölgyajtó (felső)', { ...doorCommon, tex: T('planks_oak', 'planks_oak', 'door_top') });
def(B.DOOR_OPEN, 'Tölgyajtó (nyitott)', { ...doorCommon, tex: T('planks_oak', 'planks_oak', 'door_bottom') });
def(B.DOOR_TOP_OPEN, 'Tölgyajtó (nyitott, felső)', { ...doorCommon, tex: T('planks_oak', 'planks_oak', 'door_top') });
// kerítés, kerítéskapu, létra, csapóajtó
const woodBits = { hard: 2, tool: 'axe', snd: 'wood', opaque: false, op: 0, burn: 8 };
def(B.FENCE, 'Tölgykerítés', { ...woodBits, tex: 'planks_oak', shape: 'fence', icon: 'i_fence' });
def(B.FENCE_GATE, 'Kerítéskapu', { ...woodBits, tex: 'planks_oak', shape: 'gate', icon: 'i_gate', drop: B.FENCE_GATE });
def(B.FENCE_GATE_OPEN, 'Kerítéskapu (nyitott)', { ...woodBits, tex: 'planks_oak', shape: 'gate', icon: 'i_gate', drop: B.FENCE_GATE });
def(B.LADDER, 'Létra', { hard: 0.4, tool: 'axe', snd: 'wood', tex: 'ladder', shape: 'ladder', solid: false, opaque: false, op: 0, icon: 'ladder', climb: true, burn: 4 });
for (const [id, nm, open] of [[B.TRAPDOOR, 'Csapóajtó', 0], [B.TRAPDOOR_OPEN, 'Csapóajtó (nyitott)', 1], [B.TRAPDOOR_TOP, 'Csapóajtó (felső)', 0], [B.TRAPDOOR_TOP_OPEN, 'Csapóajtó (felső, nyitott)', 1]])
  def(id, nm, { ...woodBits, hard: 3, tex: 'trapdoor', shape: 'trapdoor', icon: 'trapdoor', drop: B.TRAPDOOR });
export const GATES = new Set([B.FENCE_GATE, B.FENCE_GATE_OPEN]);
export const TRAPDOORS = new Set([B.TRAPDOOR, B.TRAPDOOR_OPEN, B.TRAPDOOR_TOP, B.TRAPDOOR_TOP_OPEN]);
export const isTrapTop = id => id === B.TRAPDOOR_TOP || id === B.TRAPDOOR_TOP_OPEN;
export const isTrapOpen = id => id === B.TRAPDOOR_OPEN || id === B.TRAPDOOR_TOP_OPEN;
// a kerítés mely szomszédokhoz csatlakozik (bitek: 1:+x 2:-x 4:+z 8:-z)
export const fenceConn = id => id === B.FENCE || id === B.FENCE_GATE || id === B.FENCE_GATE_OPEN || (id && OPAQUE[id] && SOLID[id] && BLOCKS[id].shape === 'cube');
export const fenceMask = (get, x, y, z) => (fenceConn(get(x + 1, y, z)) ? 1 : 0) | (fenceConn(get(x - 1, y, z)) ? 2 : 0) | (fenceConn(get(x, y, z + 1)) ? 4 : 0) | (fenceConn(get(x, y, z - 1)) ? 8 : 0);
export const LADDER_DIR = { 0: [1, 0], 1: [-1, 0], 4: [0, 1], 5: [0, -1] }; // a létra mögötti fal iránya (facing szerint)
export const BOXSHAPES = new Set(['slab', 'stairs', 'bed', 'farmland', 'door', 'fence', 'gate', 'trapdoor', 'switch', 'prop']);
// ---- szék, fejőállvány, fészek ----
Object.assign(B, { CHAIR: 199, MILKER: 200, MILKER_B: 201, MILKER_M: 202, NEST: 203, NEST_C: 204, NEST_F: 205, NEST_E: 206 });
Object.assign(I, { MILK_BUCKET: 400, CHEESE: 401, OMELETTE: 402, FRIED_EGG: 403, PIZZA: 404, PANCAKE: 405, SANDWICH: 406, APPLE_PIE: 407, SMOOTHIE: 408 });
B.KITCHEN = 207;
def(B.CHAIR, 'Szék', { tex: 'planks_oak', hard: 1, tool: 'axe', snd: 'wood', shape: 'prop', opaque: false, op: 0, icon: 'i_chair', drop: B.CHAIR });
const milkerTex = n => ({ top: 'planks_oak', bottom: 'planks_oak', side: n });
def(B.MILKER, 'Fejőállvány', { tex: milkerTex('milker_empty'), hard: 1.5, tool: 'axe', snd: 'wood', drop: B.MILKER });
def(B.MILKER_B, 'Fejőállvány (vödörrel)', { tex: milkerTex('milker_bucket'), hard: 1.5, tool: 'axe', snd: 'wood', drop: B.MILKER });
def(B.MILKER_M, 'Fejőállvány (tejjel)', { tex: milkerTex('milker_milk'), hard: 1.5, tool: 'axe', snd: 'wood', drop: B.MILKER });
const nestDef = (id, name) => def(id, name, { tex: 'straw', hard: 0.4, snd: 'wood', shape: 'prop', opaque: false, op: 0, icon: 'i_nest', drop: B.NEST });
nestDef(B.NEST, 'Tojásfészek'); nestDef(B.NEST_C, 'Fészek (csirkével)'); nestDef(B.NEST_F, 'Fészek (jóllakott csirkével)'); nestDef(B.NEST_E, 'Fészek (tojással)');
def(B.KITCHEN, 'Konyhai sütő', { tex: { top: 'kitchen_top', bottom: 'planks_oak', side: 'kitchen_side' }, hard: 3, tool: 'pickaxe', front: 'kitchen_front', dir: true, drop: B.KITCHEN });
export const isMilker = id => id === B.MILKER || id === B.MILKER_B || id === B.MILKER_M;
export const isNest = id => id >= B.NEST && id <= B.NEST_E;
const rotY = (f, b) => {            // helyi (néző: +z) → világ; f: 1:+x 0:-x 5:+z 4:-z
  const [x0, y0, z0, x1, y1, z1] = b;
  switch (f) { case 4: return [x0, y0, 1 - z1, x1, y1, 1 - z0]; case 1: return [z0, y0, x0, z1, y1, x1]; case 0: return [1 - z1, y0, x0, 1 - z0, y1, x1]; default: return b; }
};
function propBoxes(id, facing) {
  const k = 1 / 16;
  if (id === B.CHAIR) {
    const f = facing === undefined ? 5 : facing, L = [[2, 7, 2, 14, 9, 14], [2, 0, 2, 4, 7, 4], [12, 0, 2, 14, 7, 4], [2, 0, 12, 4, 7, 14], [12, 0, 12, 14, 7, 14], [2, 9, 2, 14, 16, 4]];
    return L.map(b => rotY(f, b.map(v => v * k)).concat('planks_oak'));
  }
  const out = [[k, 0, k, 15 * k, 2 * k, 15 * k, 'straw'], [k, 2 * k, k, 15 * k, 5 * k, 2 * k, 'planks_oak'], [k, 2 * k, 14 * k, 15 * k, 5 * k, 15 * k, 'planks_oak'], [k, 2 * k, 2 * k, 2 * k, 5 * k, 14 * k, 'planks_oak'], [14 * k, 2 * k, 2 * k, 15 * k, 5 * k, 14 * k, 'planks_oak']];
  if (id === B.NEST_C) out.push([4 * k, 2 * k, 4 * k, 12 * k, 8 * k, 12 * k, 'nest_hen']);
  if (id === B.NEST_F) out.push([4 * k, 2 * k, 4 * k, 12 * k, 8 * k, 12 * k, 'nest_hen_fed']);
  if (id === B.NEST_E) { out.push([4 * k, 2 * k, 4 * k, 12 * k, 8 * k, 12 * k, 'nest_hen_fed']); out.push([6 * k, 8 * k, 6 * k, 10 * k, 11 * k, 10 * k, 'nest_egg']); }
  return out;
}
// ---- redstone ----
const rsBase = { tool: 'pickaxe', snd: 'stone', solid: false, opaque: false, op: 0 };
def(B.LEVER, 'Kar', { ...rsBase, hard: 0.5, tex: 'cobble', tex2: 'lever_stick', shape: 'switch', icon: 'i_lever', drop: B.LEVER });
def(B.LEVER_ON, 'Kar (be)', { ...BLOCKS[B.LEVER], id: B.LEVER_ON, name: 'Kar (be)', drop: B.LEVER });
def(B.BUTTON, 'Kőgomb', { ...rsBase, hard: 0.5, tex: 'stone', shape: 'switch', icon: 'i_button', drop: B.BUTTON });
def(B.BUTTON_ON, 'Kőgomb (be)', { ...BLOCKS[B.BUTTON], id: B.BUTTON_ON, name: 'Kőgomb (be)', drop: B.BUTTON });
def(B.PLATE, 'Kő nyomólap', { ...rsBase, hard: 0.5, tex: 'stone', shape: 'switch', icon: 'i_plate', thin: 1 / 16, drop: B.PLATE });
def(B.PLATE_ON, 'Kő nyomólap (be)', { ...BLOCKS[B.PLATE], id: B.PLATE_ON, name: 'Kő nyomólap (be)', drop: B.PLATE });
for (let l = 0; l < 16; l++) def(B.DUST0 + l, 'Redstone por', { ...rsBase, hard: 0, tex: 'dust', shape: 'dust', thin: 1 / 16, snd: 'stone', dropFn: () => [[I.REDSTONE, 1]], selectable: true });
def(B.LAMP, 'Redstone lámpa', { tex: 'lamp', hard: 0.3, snd: 'glass', drop: B.LAMP });
def(B.LAMP_ON, 'Redstone lámpa (be)', { tex: 'lamp_on', hard: 0.3, snd: 'glass', emit: 15, drop: B.LAMP });
def(B.RSTORCH, 'Redstone fáklya', { tex: 'rs_torch', hard: 0, solid: false, opaque: false, shape: 'torch', emit: 7, snd: 'wood', rsTorch: true });
def(B.RSTORCH_OFF, 'Redstone fáklya (ki)', { tex: 'rs_torch_off', hard: 0, solid: false, opaque: false, shape: 'torch', emit: 0, snd: 'wood', rsTorch: true, drop: B.RSTORCH });
const cmdDef = (id, name, tex) => def(id, name, { tex, hard: -1, snd: 'stone', drop: id, cmd: true });
cmdDef(B.CMD, 'Parancsblokk', 'cmd'); cmdDef(B.CMD_REP, 'Ismétlő parancsblokk', 'cmd_rep'); cmdDef(B.CMD_CHAIN, 'Láncolt parancsblokk', 'cmd_chain');
RSB[B.CMD] = RSB[B.CMD_REP] = RSB[B.CMD_CHAIN] = 1; RSW[B.CMD_REP] = 1;
export const isCmdBlock = id => id === B.CMD || id === B.CMD_REP || id === B.CMD_CHAIN;
export const isDust = id => id >= B.DUST0 && id < B.DUST0 + 16;
export const dustLevel = id => id - B.DUST0;
export const DUST_ID = l => B.DUST0 + l;
// kar / gomb rögzítési irány (facing → a fal blokk iránya)
export const ATTACH_DIR = { 0: [1, 0, 0], 1: [-1, 0, 0], 2: [0, 1, 0], 3: [0, -1, 0], 4: [0, 0, 1], 5: [0, 0, -1] };
export const isLeverOrButton = id => id === B.LEVER || id === B.LEVER_ON || id === B.BUTTON || id === B.BUTTON_ON;
export const isRsSource = id => id === B.LEVER_ON || id === B.BUTTON_ON || id === B.PLATE_ON || id === B.BLOCK_REDSTONE;
// a por mely szomszédokhoz csatlakozik vizuálisan / jelvezetéssel
const DUST_CONN = new Set([B.LEVER, B.LEVER_ON, B.BUTTON, B.BUTTON_ON, B.PLATE, B.PLATE_ON, B.RSTORCH, B.RSTORCH_OFF, B.BLOCK_REDSTONE]);
const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const conductor = id => !!id && OPAQUE[id] === 1 && SOLID[id] === 1;
// 0: nincs; 1: azonos szint; 2: fent (lépcső); -1: lent
export function dustConnTo(get, x, y, z, dx, dz) {
  const n = get(x + dx, y, z + dz);
  if (isDust(n) || DUST_CONN.has(n)) return 1;
  if (!conductor(get(x, y + 1, z)) && conductor(n) && isDust(get(x + dx, y + 1, z + dz))) return 2;
  if (!conductor(n) && isDust(get(x + dx, y - 1, z + dz))) return -1;
  return 0;
}
export function dustMask(get, x, y, z) { let m = 0; for (let i = 0; i < 4; i++) if (dustConnTo(get, x, y, z, DIRS4[i][0], DIRS4[i][1])) m |= 1 << i; return m; }
export { DIRS4 };
// switch alakzatok (padló-keretben: y = a faltól távolodás)
const rotBox = (f, b) => {
  const [x0, y0, z0, x1, y1, z1] = b;
  switch (f) {
    case 2: return [x0, 1 - y1, z0, x1, 1 - y0, z1];
    case 0: return [1 - y1, x0, z0, 1 - y0, x1, z1];
    case 1: return [y0, x0, z0, y1, x1, z1];
    case 4: return [z0, x0, 1 - y1, z1, x1, 1 - y0];
    case 5: return [z0, x0, y0, z1, x1, y1];
    default: return b;
  }
};
function switchBoxes(id, facing) {
  const f = facing === undefined ? 3 : facing, k = 1 / 16;
  if (id === B.PLATE || id === B.PLATE_ON) return [[k, 0, k, 15 * k, id === B.PLATE ? k : 0.5 * k, 15 * k, 'stone']];
  if (id === B.BUTTON || id === B.BUTTON_ON) return [rotBox(f, [5 * k, 0, 6 * k, 11 * k, (id === B.BUTTON ? 2 : 1) * k, 10 * k]).concat('stone')];
  const on = id === B.LEVER_ON;
  const base = [5 * k, 0, 6 * k, 11 * k, 3 * k, 10 * k], lo = on ? [8 * k, 3 * k, 7 * k, 10 * k, 7 * k, 9 * k] : [6 * k, 3 * k, 7 * k, 8 * k, 7 * k, 9 * k], up = on ? [10.5 * k, 7 * k, 7 * k, 12.5 * k, 11.5 * k, 9 * k] : [3.5 * k, 7 * k, 7 * k, 5.5 * k, 11.5 * k, 9 * k];
  return [rotBox(f, base).concat('cobble'), rotBox(f, lo).concat('lever_stick'), rotBox(f, up).concat('lever_stick')];
}
for (const id of [B.LEVER, B.LEVER_ON, B.BUTTON, B.BUTTON_ON, B.PLATE, B.PLATE_ON, B.LAMP, B.LAMP_ON, B.RSTORCH, B.RSTORCH_OFF, B.BLOCK_REDSTONE, B.TNT, B.DOOR, B.DOOR_TOP, B.DOOR_OPEN, B.DOOR_TOP_OPEN, B.FENCE_GATE, B.FENCE_GATE_OPEN, B.TRAPDOOR, B.TRAPDOOR_OPEN, B.TRAPDOOR_TOP, B.TRAPDOOR_TOP_OPEN]) RSB[id] = 1;
for (let l = 0; l < 16; l++) RSB[B.DUST0 + l] = 1;
for (const id of [B.BUTTON_ON, B.PLATE_ON, B.RSTORCH, B.RSTORCH_OFF]) RSW[id] = 1;
export const DOOR_HALVES = new Set([B.DOOR, B.DOOR_TOP, B.DOOR_OPEN, B.DOOR_TOP_OPEN]);
export const isDoorTop = id => id === B.DOOR_TOP || id === B.DOOR_TOP_OPEN;
export const isDoorOpen = id => id === B.DOOR_OPEN || id === B.DOOR_TOP_OPEN;

for (let l = 1; l <= 8; l++) {
  const wi = l < 8 ? B.WATER_F1 + l - 1 : B.WATER_FALL;
  def(wi, 'Folyó víz', { ...BLOCKS[B.WATER], id: wi, name: 'Folyó víz' }); FK[wi] = 1; FL[wi] = l;
  if (l <= 3 || l === 8) { const li = l < 8 ? B.LAVA_F1 + l - 1 : B.LAVA_FALL; def(li, 'Folyó láva', { ...BLOCKS[B.LAVA], id: li, name: 'Folyó láva' }); FK[li] = 2; FL[li] = l; }
}
FK[B.WATER] = 1; FK[B.LAVA] = 2;
export const WATER_ID = l => l === 0 ? B.WATER : l < 8 ? B.WATER_F1 + l - 1 : B.WATER_FALL;
export const LAVA_ID = l => l === 0 ? B.LAVA : l < 8 ? B.LAVA_F1 + l - 1 : B.LAVA_FALL;
// folyadék felszín magassága (0..1) szint + felette lévő blokk alapján
export const fluidHeight = (id, aboveSame) => { const l = FL[id]; return aboveSame || l === 8 ? 1 : l === 0 ? 0.9 : Math.max(0.12, (8 - l) / 8 * 0.9); };

// színes gyapjú + beton
COLORS.forEach(([n], i) => {
  if (i > 0) def(woolId(i), n + ' gyapjú', { tex: 'wool_c' + i, hard: 0.8, snd: 'cloth' });
  def(concreteId(i), n + ' beton', { tex: 'concrete_c' + i, hard: 1.8, tool: 'pickaxe' });
});

// lapok és lépcsők
const SLAB_MATS = [B.PLANKS, B.BIRCH_PLANKS, B.SPRUCE_PLANKS, B.COBBLE, B.STONE, B.STONEBRICK, B.BRICKS, B.SANDSTONE, B.QUARTZ_BLOCK, B.SMOOTH_STONE, B.NETHER_BRICKS];
export const SLAB_OF = {}, STAIR_OF = {}, SLAB_FULL = {};
SLAB_MATS.forEach((m, k) => {
  const base = BLOCKS[m], sid = SLAB_BASE + k, tid = STAIR_BASE + k;
  const common = { tex: { ...base.tex }, hard: base.hard, tool: base.tool, tier: base.tier, snd: base.snd, opaque: false, op: 0, burn: base.burn };
  def(sid, base.name + ' lap', { ...common, shape: 'slab', boxes: [[0, 0, 0, 1, 0.5, 1]], drop: sid });
  def(tid, base.name + ' lépcső', { ...common, shape: 'stairs', drop: tid });
  BLOCKS[sid].full = m; SLAB_OF[m] = sid; STAIR_OF[m] = tid; SLAB_FULL[sid] = m;
  if (m === B.PLANKS || m === B.BIRCH_PLANKS || m === B.SPRUCE_PLANKS) { BLOCKS[sid].burn = 8; BLOCKS[tid].burn = 12; }
});
// kő blokkok nyersanyag-drop javítás (kő -> macskakő marad)

// lépcső ütközés / alakzat (facing = a "hátoldal" iránya: 0:+x 1:-x 4:+z 5:-z)
export function blockBoxes(id, facing, mask = 0, col = false) {
  const b = BLOCKS[id];
  if (b.shape === 'fence') {
    const P = 6 / 16, Q = 10 / 16, top = col ? 1.5 : 1, out = [[P, 0, P, Q, top, Q]];
    const arm = (x0, z0, x1, z1) => col ? out.push([x0, 0, z0, x1, 1.5, z1]) : (out.push([x0, 6 / 16, z0, x1, 9 / 16, z1]), out.push([x0, 12 / 16, z0, x1, 15 / 16, z1]));
    const a = col ? P : 7 / 16, c = col ? Q : 9 / 16;
    if (mask & 1) arm(Q, a, 1, c); if (mask & 2) arm(0, a, P, c); if (mask & 4) arm(a, Q, c, 1); if (mask & 8) arm(a, 0, c, P);
    return out;
  }
  if (b.shape === 'gate') {
    const f = facing === undefined ? 4 : facing, open = id === B.FENCE_GATE_OPEN, ax = f === 0 || f === 1;
    const T = (u0, y0, u1, y1, w0, w1) => ax ? [w0, y0, u0, w1, y1, u1] : [u0, y0, w0, u1, y1, w1];
    const k = 7 / 16, l = 9 / 16;
    if (col) return open ? [T(0, 0, 2 / 16, 1.5, k, l), T(14 / 16, 0, 1, 1.5, k, l)] : [T(0, 0, 1, 1.5, 6 / 16, 10 / 16)];
    const posts = [T(0, 5 / 16, 2 / 16, 1, k, l), T(14 / 16, 5 / 16, 1, 1, k, l)];
    if (!open) return [...posts, T(2 / 16, 6 / 16, 14 / 16, 9 / 16, k, l), T(2 / 16, 12 / 16, 14 / 16, 15 / 16, k, l), T(6 / 16, 9 / 16, 10 / 16, 12 / 16, k, l)];
    const R = (u0, u1, y0, y1) => ax ? [k, y0, u0, 1, y1, u1] : [u0, y0, k, u1, y1, 1];
    return [...posts, R(0, 2 / 16, 6 / 16, 9 / 16), R(0, 2 / 16, 12 / 16, 15 / 16), R(14 / 16, 1, 6 / 16, 9 / 16), R(14 / 16, 1, 12 / 16, 15 / 16)];
  }
  if (b.shape === 'trapdoor') {
    const t = 3 / 16, open = id === B.TRAPDOOR_OPEN || id === B.TRAPDOOR_TOP_OPEN, top = id === B.TRAPDOOR_TOP || id === B.TRAPDOOR_TOP_OPEN, f = facing === undefined ? 5 : facing;
    if (!open) return [top ? [0, 1 - t, 0, 1, 1, 1] : [0, 0, 0, 1, t, 1]];
    return [f === 0 ? [1 - t, 0, 0, 1, 1, 1] : f === 1 ? [0, 0, 0, t, 1, 1] : f === 4 ? [0, 0, 1 - t, 1, 1, 1] : [0, 0, 0, 1, 1, t]];
  }
  if (b.shape === 'switch') return switchBoxes(id, facing);
  if (b.shape === 'prop') return (id >= 209 && id <= 213 && id !== 210) ? dimBoxes(id, facing) : propBoxes(id, facing);
  if (b.shape === 'ladder') {
    const f = facing === undefined ? 5 : facing, t = 2 / 16;
    return [f === 0 ? [1 - t, 0, 0, 1, 1, 1] : f === 1 ? [0, 0, 0, t, 1, 1] : f === 4 ? [0, 0, 1 - t, 1, 1, 1] : [0, 0, 0, 1, 1, t]];
  }
  if (b.shape === 'stairs') {
    const f = facing === undefined ? 5 : facing, base = [0, 0, 0, 1, 0.5, 1];
    const up = f === 0 ? [0.5, 0.5, 0, 1, 1, 1] : f === 1 ? [0, 0.5, 0, 0.5, 1, 1] : f === 4 ? [0, 0.5, 0.5, 1, 1, 1] : [0, 0.5, 0, 1, 1, 0.5];
    return [base, up];
  }
  if (b.shape === 'door') {
    const f = facing === undefined ? 4 : facing, open = id === B.DOOR_OPEN || id === B.DOOR_TOP_OPEN, t = 3 / 16;
    const alongX = f === 0 || f === 1;            // a zárt lap merőleges az x tengelyre
    if (!open) return [f === 0 ? [1 - t, 0, 0, 1, 1, 1] : f === 1 ? [0, 0, 0, t, 1, 1] : f === 4 ? [0, 0, 1 - t, 1, 1, 1] : [0, 0, 0, 1, 1, t]];
    return [alongX ? [0, 0, 0, 1, 1, t] : [0, 0, 0, t, 1, 1]];
  }
  return b.boxes || null;
}

// ---------- tárgyak ----------
const it = (id, name, tex, o = {}) => item(id, name, { tex, ...o });
it(I.COPPER_INGOT, 'Rúdréz', 'i_copper_ingot'); it(I.RAW_COPPER, 'Nyers réz', 'i_raw_copper'); it(I.LAPIS, 'Lapis lazuli', 'i_lapis'); it(I.REDSTONE, 'Redstone por', 'i_redstone');
it(I.EMERALD, 'Smaragd', 'i_emerald'); it(I.QUARTZ, 'Kvarc', 'i_quartz'); it(I.CLAY_BALL, 'Agyaggolyó', 'i_clay_ball'); it(I.BRICK, 'Tégla', 'i_brick');
it(I.FEATHER, 'Toll', 'i_feather'); it(I.BONE, 'Csont', 'i_bone'); it(I.STRING, 'Cérna', 'i_string'); it(I.LEATHER, 'Bőr', 'i_leather');
it(I.SEEDS, 'Búzamag', 'i_seeds'); it(I.WHEAT, 'Búza', 'i_wheat');
it(I.BREAD, 'Kenyér', 'i_bread', { food: 5 }); it(I.RAW_CHICKEN, 'Nyers csirke', 'i_raw_chicken', { food: 2 }); it(I.COOKED_CHICKEN, 'Sült csirke', 'i_cooked_chicken', { food: 6 });
it(I.RAW_MUTTON, 'Nyers birkahús', 'i_raw_mutton', { food: 2 }); it(I.COOKED_MUTTON, 'Sült birkahús', 'i_cooked_mutton', { food: 6 });
it(I.GOLDEN_APPLE, 'Aranyalma', 'i_golden_apple', { food: 4, heal: 8 }); it(I.MELON_SLICE, 'Dinnyeszelet', 'i_melon_slice', { food: 2 });
it(I.EGG, 'Tojás', 'i_egg', { stack: 16 });
it(I.MILK_BUCKET, 'Tejesvödör', 'i_bucket_milk', { stack: 1, food: 2, sat: 1, returns: I.BUCKET });
it(I.BUCKET, 'Vödör', 'i_bucket', { stack: 1 }); it(I.WATER_BUCKET, 'Vizes vödör', 'i_bucket_water', { stack: 1 }); it(I.LAVA_BUCKET, 'Lávás vödör', 'i_bucket_lava', { stack: 1, burn: 1000 });
it(I.SHEARS, 'Olló', 'i_shears', { stack: 1 }); it(I.FLINT_STEEL, 'Kovakő és acél', 'i_flint_steel', { stack: 1 }); it(I.BOW, 'Íj', 'i_bow', { stack: 1 });
it(I.ARROW, 'Nyílvessző', 'i_arrow');
EXTRA_DUR[I.SHEARS] = 238; EXTRA_DUR[I.FLINT_STEEL] = 64; EXTRA_DUR[I.BOW] = 384;
COLORS.forEach(([n], i) => it(dyeId(i), n + ' festék', 'i_dye_' + i));

// páncél
const PROT = { leather: [1, 3, 2, 1], iron: [2, 6, 5, 2], gold: [2, 5, 3, 1], diamond: [3, 8, 6, 3] };
const ADUR = { leather: [55, 80, 75, 65], iron: [165, 240, 225, 195], gold: [77, 112, 105, 91], diamond: [363, 528, 495, 429] };
export const ARMOR_ID = {};
ARM_MATS.forEach((m, mi) => ARM_TYPES.forEach(([t, thu], ti) => {
  const id = 380 + mi * 4 + ti; ARMOR_ID[m[0] + '_' + t] = id;
  it(id, m[1] + ' ' + thu, 'armor_' + t + '_' + m[0], { stack: 1, armor: true });
  ARMOR[id] = { slot: ti, prot: PROT[m[0]][ti], dur: ADUR[m[0]][ti], mat: m[0] };
}));

// ---------- receptek ----------
const PL = [B.PLANKS, B.BIRCH_PLANKS, B.SPRUCE_PLANKS];
const S = I.STICK;
const sh = (pat, key, out, n = 1) => SHAPED.push({ pat, key, out: [out, n] });
const sl = (ing, out, n = 1) => SHAPELESS.push({ ing, out: [out, n] });
// páncélok
const AM = { leather: I.LEATHER, iron: I.IRON_INGOT, gold: I.GOLD_INGOT, diamond: I.DIAMOND };
for (const m of Object.keys(AM)) {
  const k = { M: [AM[m]] };
  sh(['MMM', 'M.M'], k, ARMOR_ID[m + '_helmet']); sh(['M.M', 'MMM', 'MMM'], k, ARMOR_ID[m + '_chestplate']);
  sh(['MMM', 'M.M', 'M.M'], k, ARMOR_ID[m + '_leggings']); sh(['M.M', 'M.M'], k, ARMOR_ID[m + '_boots']);
}
// kapák
const MAT_ING = [PL, [B.COBBLE], [I.IRON_INGOT], [I.GOLD_INGOT], [I.DIAMOND]];
MATS.forEach((m, mi) => sh(['MM', '.S', '.S'], { M: MAT_ING[mi], S: [S] }, I[(m + '_hoe').toUpperCase()]));
sh(['.I', 'I.'], { I: [I.IRON_INGOT] }, I.SHEARS);
sh(['I.I', '.I.'], { I: [I.IRON_INGOT] }, I.BUCKET);
sh(['.SX', 'S.X', '.SX'], { S: [S], X: [I.STRING] }, I.BOW);
sh(['F', 'S', 'K'], { F: [I.FLINT], S: [S], K: [I.FEATHER] }, I.ARROW, 4);
sl([I.IRON_INGOT, I.FLINT], I.FLINT_STEEL);
sh(['WWW'], { W: [I.WHEAT] }, I.BREAD);
sh(['GGG', 'GAG', 'GGG'], { G: [I.GOLD_INGOT], A: [I.APPLE] }, I.GOLDEN_APPLE);
// tároló blokkok
for (const [blk, ingd] of [[B.BLOCK_COAL, I.COAL], [B.BLOCK_IRON, I.IRON_INGOT], [B.BLOCK_GOLD, I.GOLD_INGOT], [B.BLOCK_DIAMOND, I.DIAMOND], [B.BLOCK_EMERALD, I.EMERALD], [B.BLOCK_LAPIS, I.LAPIS], [B.BLOCK_COPPER, I.COPPER_INGOT], [B.BLOCK_REDSTONE, I.REDSTONE]]) {
  sh(['III', 'III', 'III'], { I: [ingd] }, blk); sl([blk], ingd, 9);
}
sh(['III', 'III', 'III'], { I: [I.WHEAT] }, B.HAY); sl([B.HAY], I.WHEAT, 9);
sh(['MMM', 'MMM', 'MMM'], { M: [I.MELON_SLICE] }, B.MELON);
sh(['III', 'III', 'III'], { I: [B.ICE] }, B.PACKED_ICE);
// építőanyagok
sh(['BB', 'BB'], { B: [I.BRICK] }, B.BRICKS); sh(['CC', 'CC'], { C: [I.CLAY_BALL] }, B.CLAY); sh(['QQ', 'QQ'], { Q: [I.QUARTZ] }, B.QUARTZ_BLOCK);
sh(['AA', 'AA'], { A: [B.ANDESITE] }, B.POL_ANDESITE, 4); sh(['AA', 'AA'], { A: [B.GRANITE] }, B.POL_GRANITE, 4); sh(['AA', 'AA'], { A: [B.DIORITE] }, B.POL_DIORITE, 4);
sl([B.DIORITE, B.COBBLE], B.ANDESITE, 2); sh(['CQ', 'QC'], { C: [B.COBBLE], Q: [I.QUARTZ] }, B.DIORITE, 2); sl([B.DIORITE, I.QUARTZ], B.GRANITE);
sh(['S', 'S'], { S: [B.STONEBRICK] }, B.CHISELED_STONEBRICK, 2);
sl([B.COBBLE, I.SEEDS], B.MOSSY_COBBLE); sl([B.STONEBRICK, I.SEEDS], B.MOSSY_STONEBRICK);
sl([B.PUMPKIN, B.TORCH], B.JACK);
sh(['WWW', 'PPP'], { W: [B.WOOL], P: PL }, B.BED);
sh(['PP', 'PP', 'PP'], { P: PL }, B.DOOR, 3);
sh(['PSP', 'PSP'], { P: PL, S: [I.STICK] }, B.FENCE, 3); sh(['SPS', 'SPS'], { P: PL, S: [I.STICK] }, B.FENCE_GATE, 1);
sh(['S.S', 'SSS', 'S.S'], { S: [I.STICK] }, B.LADDER, 3); sh(['PPP', 'PPP'], { P: PL }, B.TRAPDOOR, 2);
sh(['S', 'C'], { S: [I.STICK], C: [B.COBBLE] }, B.LEVER); sl([B.STONE], B.BUTTON); sh(['SS'], { S: [B.STONE] }, B.PLATE);
sh(['.R.', 'RGR', '.R.'], { R: [I.REDSTONE], G: [B.GLOWSTONE] }, B.LAMP); sh(['R', 'S'], { R: [I.REDSTONE], S: [I.STICK] }, B.RSTORCH);
sh(['GQG', 'QGQ', 'GQG'], { G: [B.GLOWSTONE], Q: [I.QUARTZ] }, B.SEA_LANTERN, 2);
// lapok, lépcsők
SLAB_MATS.forEach((m, k) => { sh(['MMM'], { M: [m] }, SLAB_BASE + k, 6); sh(['M..', 'MM.', 'MMM'], { M: [m] }, STAIR_BASE + k, 4); });
// festékek, színes gyapjú, beton
sl([B.POPPY], dyeId(14)); sl([B.DANDELION], dyeId(4)); sl([I.LAPIS], dyeId(11)); sl([I.BONE], dyeId(0), 2); sl([I.COAL], dyeId(15));
const mix = (a, b, out) => sl([dyeId(a), dyeId(b)], dyeId(out), 2);
mix(14, 4, 1); mix(14, 0, 6); mix(13, 0, 5); mix(11, 0, 3); mix(15, 0, 7); mix(11, 13, 9); mix(11, 14, 10); mix(10, 6, 2); mix(14, 13, 12);
sl([dyeId(7), dyeId(0)], dyeId(8), 2);
for (let i = 1; i < 16; i++) sl([B.WOOL, dyeId(i)], woolId(i));
for (let i = 0; i < 16; i++) sl([B.SAND, B.SAND, B.SAND, B.SAND, B.GRAVEL, B.GRAVEL, B.GRAVEL, B.GRAVEL, dyeId(i)], concreteId(i), 8);

// ---------- olvasztás ----------
Object.assign(SMELT, {
  [B.COPPER_ORE]: I.COPPER_INGOT, [B.D_COPPER]: I.COPPER_INGOT, [I.RAW_COPPER]: I.COPPER_INGOT, [I.CLAY_BALL]: I.BRICK, [B.CLAY]: B.TERRACOTTA,
  [B.STONE]: B.SMOOTH_STONE, [B.STONEBRICK]: B.CRACKED_STONEBRICK, [B.CACTUS]: dyeId(13), [B.D_IRON]: I.IRON_INGOT, [B.D_GOLD]: I.GOLD_INGOT,
  [I.RAW_CHICKEN]: I.COOKED_CHICKEN, [I.RAW_MUTTON]: I.COOKED_MUTTON, [B.SAND]: B.GLASS, [B.NETHERRACK]: I.BRICK,
  [B.LAPIS_ORE]: I.LAPIS,
});

// ---------- gyorstáblák frissítése ----------
for (const b of BLOCKS) if (b) { OPAQUE[b.id] = b.opaque ? 1 : 0; OP[b.id] = b.op; EM[b.id] = b.emit; SOLID[b.id] = b.solid ? 1 : 0; }
export const CREATIVE_BLOCKS = BLOCKS.filter(b => b && b.id && !FK[b.id] && !(b.id >= B.WHEAT1 && b.id <= B.WHEAT3) && b.id !== B.FARMLAND && b.id !== B.DOOR_TOP && b.id !== B.DOOR_OPEN && b.id !== B.DOOR_TOP_OPEN && b.id !== B.FENCE_GATE_OPEN && b.id !== B.TRAPDOOR_OPEN && b.id !== B.TRAPDOOR_TOP && b.id !== B.TRAPDOOR_TOP_OPEN && b.id !== B.LEVER_ON && b.id !== B.BUTTON_ON && b.id !== B.PLATE_ON && !isDust(b.id) && b.id !== B.LAMP_ON && b.id !== B.RSTORCH_OFF).map(b => b.id);

// szék, fejőállvány, fészek receptek
sh(['S.', 'SP', 'PP'], { S: [I.STICK], P: PL }, B.CHAIR, 2);
sh(['PSP', 'P.P'], { P: PL, S: [I.STICK] }, B.MILKER, 1);
sh(['W.W', 'WWW'], { W: [I.WHEAT] }, B.NEST, 1);

// ---- Konyhai sütő: saját (nem Minecraft) receptek ----
sh(['BBB', 'BCB', 'BBB'], { B: [B.BRICKS], C: [I.COAL] }, B.KITCHEN);
it(I.CHEESE, 'Sajt', 'i_cheese', { food: 3 }); it(I.OMELETTE, 'Rántotta', 'i_omelette', { food: 7 }); it(I.FRIED_EGG, 'Tükörtojás', 'i_fried_egg', { food: 4 });
it(I.PIZZA, 'Pizza', 'i_pizza', { food: 10 }); it(I.PANCAKE, 'Palacsinta', 'i_pancake', { food: 6 }); it(I.SANDWICH, 'Sajtos szendvics', 'i_sandwich', { food: 9 });
it(I.APPLE_PIE, 'Almás pite', 'i_apple_pie', { food: 8, heal: 2 }); it(I.SMOOTHIE, 'Dinnyeturmix', 'i_smoothie', { food: 5 });
const kl = (ing, out, n = 1) => KITCHEN.push({ ing, out: [out, n] }), ks = (pat, key, out, n = 1) => KITCHEN.push({ pat, key, out: [out, n] });
kl([I.MILK_BUCKET], I.CHEESE, 3);
kl([I.EGG], I.FRIED_EGG);
kl([I.EGG, I.EGG], I.OMELETTE);
kl([I.EGG, I.EGG, I.CHEESE], I.OMELETTE, 2);
kl([I.WHEAT, I.EGG, I.MILK_BUCKET], I.PANCAKE, 3);
kl([I.MELON_SLICE, I.MELON_SLICE, I.MELON_SLICE, I.MILK_BUCKET], I.SMOOTHIE, 2);
ks(['WWW', 'CMC'], { W: [I.WHEAT], C: [I.CHEESE], M: [I.COOKED_PORK, I.COOKED_CHICKEN, I.STEAK, I.COOKED_MUTTON] }, I.PIZZA, 2);
ks(['B', 'C', 'M'], { B: [I.BREAD], C: [I.CHEESE], M: [I.COOKED_CHICKEN, I.COOKED_PORK, I.STEAK, I.COOKED_MUTTON] }, I.SANDWICH, 1);
ks(['AWA', '.E.'], { A: [I.APPLE], W: [I.WHEAT], E: [I.EGG] }, I.APPLE_PIE, 1);

// ---- Nether / End ----
Object.assign(B, { NQ_ORE: 208, NETHER_PORTAL: 209, END_STONE: 210, END_FRAME: 211, END_FRAME_EYE: 212, END_PORTAL: 213 });
Object.assign(I, { ENDER_PEARL: 410, EYE_OF_ENDER: 411, GLOW_DUST: 412 });
def(B.NQ_ORE, 'Nether kvarcérc', { tex: 'nq_ore', hard: 3, tool: 'pickaxe', drop: I.QUARTZ });
def(B.END_STONE, 'Végkő', { tex: 'end_stone', hard: 3, tool: 'pickaxe' });
const portalBase = { solid: false, opaque: false, op: 0, shape: 'prop', selectable: false, hard: -1, drop: 0, replace: false };
def(B.NETHER_PORTAL, 'Nether portál', { ...portalBase, tex: 'portal', emit: 11 });
def(B.END_PORTAL, 'Vég portál', { ...portalBase, tex: 'end_portal', emit: 4 });
def(B.END_FRAME, 'Vég portálkeret', { tex: 'end_frame', shape: 'prop', opaque: false, op: 0, hard: -1, drop: 0, icon: 'end_frame' });
def(B.END_FRAME_EYE, 'Vég portálkeret (szemmel)', { tex: 'end_frame', shape: 'prop', opaque: false, op: 0, hard: -1, drop: 0, icon: 'end_frame' });
for (const n of ['end_eye', 'portal', 'end_portal']) BLOCKS[B.END_FRAME].texExtra = ['end_eye'];
it(I.ENDER_PEARL, 'Véggyöngy', 'i_pearl', { stack: 16 }); it(I.EYE_OF_ENDER, 'Vég szeme', 'i_eye'); it(I.GLOW_DUST, 'Izzókőpor', 'i_glowdust');
sl([I.ENDER_PEARL, I.GLOW_DUST], I.EYE_OF_ENDER); sl([B.GLOWSTONE], I.GLOW_DUST, 4);
export const isPortal = id => id === B.NETHER_PORTAL;
export function dimBoxes(id, facing) {
  const k = 1 / 16;
  if (id === B.NETHER_PORTAL) return (facing === 0 || facing === 1) ? [[6 * k, 0, 0, 10 * k, 1, 1, 'portal']] : [[0, 0, 6 * k, 1, 1, 10 * k, 'portal']];
  if (id === B.END_PORTAL) return [[0, 0, 0, 1, 12 * k, 1, 'end_portal']];
  const o = [[0, 0, 0, 1, 13 * k, 1, 'end_frame']];
  if (id === B.END_FRAME_EYE) o.push([4 * k, 13 * k, 4 * k, 12 * k, 1, 12 * k, 'end_eye']);
  return o;
}

// ---- varázsasztal, üllő ----
Object.assign(B, { ENCHANT: 214, ANVIL: 215 });
def(B.ENCHANT, 'Varázsasztal', { tex: { top: 'enchant_top', bottom: 'obsidian', side: 'enchant_side' }, hard: 5, tool: 'pickaxe', drop: B.ENCHANT });
def(B.ANVIL, 'Üllő', { tex: { top: 'anvil_top', bottom: 'anvil_side', side: 'anvil_side' }, hard: 5, tool: 'pickaxe', drop: B.ANVIL });
sh(['.L.', 'DOD', 'OOO'], { L: [I.LEATHER], D: [I.DIAMOND], O: [B.OBSIDIAN] }, B.ENCHANT);
sh(['BBB', '.I.', 'III'], { B: [B.BLOCK_IRON], I: [I.IRON_INGOT] }, B.ANVIL);

// ---- bájitalok, blaze ----
Object.assign(I, { BLAZE_POWDER: 413, BOTTLE: 414, P_HEAL: 415, P_SPEED: 416, P_STR: 417, P_FIRE: 418 });
B.BREWING = 216;
def(B.BREWING, 'Bájitalfőző', { tex: { top: 'brew_top', bottom: 'cobble', side: 'brew_side' }, hard: 1, tool: 'pickaxe', drop: B.BREWING });
it(I.BLAZE_POWDER, 'Blaze-por', 'i_blazepowder'); it(I.BOTTLE, 'Üvegpalack', 'i_bottle');
it(I.P_HEAL, 'Gyógyító főzet', 'i_p_heal', { stack: 1, potion: 'heal', returns: I.BOTTLE }); it(I.P_SPEED, 'Gyorsasági főzet', 'i_p_speed', { stack: 1, potion: 'speed', returns: I.BOTTLE });
it(I.P_STR, 'Erő főzet', 'i_p_str', { stack: 1, potion: 'str', returns: I.BOTTLE }); it(I.P_FIRE, 'Tűzállóság főzet', 'i_p_fire', { stack: 1, potion: 'fire', returns: I.BOTTLE });
sh(['G.G', '.G.'], { G: [B.GLASS] }, I.BOTTLE, 3);
sh(['.B.', 'CCC'], { B: [I.BLAZE_POWDER], C: [B.COBBLE] }, B.BREWING);
sl([I.ENDER_PEARL, I.BLAZE_POWDER], I.EYE_OF_ENDER);
const bl = (ing, out) => BREW.push({ ing, out: [out, 1] });
bl([I.BOTTLE, I.MELON_SLICE, I.GOLD_INGOT], I.P_HEAL); bl([I.BOTTLE, I.WHEAT, I.GLOW_DUST], I.P_SPEED);
bl([I.BOTTLE, I.BLAZE_POWDER], I.P_STR); bl([I.BOTTLE, I.BLAZE_POWDER, I.GLOW_DUST], I.P_FIRE);

// ---- csónak ----
I.BOAT = 419;
it(I.BOAT, 'Csónak', 'i_boat', { stack: 1 });
sh(['P.P', 'PPP'], { P: PL }, I.BOAT);

// ---------- spawn tojások ----------
Object.assign(I, { EGG_CHICKEN: 430, EGG_COW: 431, EGG_SHEEP: 432, EGG_PIG: 433 });
export const SPAWN_EGGS = { [I.EGG_CHICKEN]: 'chicken', [I.EGG_COW]: 'cow', [I.EGG_SHEEP]: 'sheep', [I.EGG_PIG]: 'pig' };
it(I.EGG_CHICKEN, 'Csirke spawn tojás', 'i_egg_chicken'); it(I.EGG_COW, 'Tehén spawn tojás', 'i_egg_cow');
it(I.EGG_SHEEP, 'Birka spawn tojás', 'i_egg_sheep'); it(I.EGG_PIG, 'Malac spawn tojás', 'i_egg_pig');
