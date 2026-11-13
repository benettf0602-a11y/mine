// Minecraft Java Edition világ (Anvil, .mca) importálása MinePixel világgá.
// Támogatott: 1.13+ (palettás szekciók, 1.18+ új formátum is). A magasság 0..127 közé vágva (1 blokk = 1 blokk).
import { B, BLOCKS, CS, H } from './blocks.js';
import { SLAB_OF, STAIR_OF, woolId, dyeId, ARMOR_ID } from './content.js';
import { I } from './blocks.js';

// ================= NBT =================
class Rd {
  constructor(buf) { this.u = buf instanceof Uint8Array ? buf : new Uint8Array(buf); this.dv = new DataView(this.u.buffer, this.u.byteOffset, this.u.byteLength); this.p = 0; }
  u8() { return this.u[this.p++]; }
  i16() { const v = this.dv.getInt16(this.p); this.p += 2; return v; }
  i32() { const v = this.dv.getInt32(this.p); this.p += 4; return v; }
  str() { const n = this.dv.getUint16(this.p); this.p += 2; const s = TD.decode(this.u.subarray(this.p, this.p + n)); this.p += n; return s; }
}
const TD = new TextDecoder();
function tag(r, t) {
  switch (t) {
    case 1: return (r.u8() << 24) >> 24;
    case 2: return r.i16();
    case 3: return r.i32();
    case 4: { const hi = r.i32(), lo = r.i32(); return hi * 4294967296 + (lo >>> 0); }
    case 5: { const v = r.dv.getFloat32(r.p); r.p += 4; return v; }
    case 6: { const v = r.dv.getFloat64(r.p); r.p += 8; return v; }
    case 7: { const n = r.i32(), a = r.u.subarray(r.p, r.p + n); r.p += n; return a; }
    case 8: return r.str();
    case 9: { const it = r.u8(), n = r.i32(), a = new Array(n); for (let i = 0; i < n; i++) a[i] = tag(r, it); return a; }
    case 10: { const o = {}; for (;;) { const k = r.u8(); if (!k) break; const name = r.str(); o[name] = tag(r, k); } return o; }
    case 11: { const n = r.i32(), a = new Int32Array(n); for (let i = 0; i < n; i++) a[i] = r.i32(); return a; }
    case 12: { const n = r.i32(), a = new Int32Array(n * 2); for (let i = 0; i < n * 2; i++) a[i] = r.i32(); return a; }   // [hi, lo, hi, lo, ...]
    default: throw new Error('NBT: ismeretlen tag ' + t);
  }
}
export function parseNBT(buf) { const r = new Rd(buf); if (r.u8() !== 10) throw new Error('NBT: nem compound'); r.str(); return tag(r, 10); }

async function inflate(bytes, fmt) {
  const ds = new DecompressionStream(fmt);
  const res = new Response(new Blob([bytes]).stream().pipeThrough(ds));
  return new Uint8Array(await res.arrayBuffer());
}
async function unpackBytes(u8) { // gzip / zlib / nyers
  if (u8[0] === 0x1f && u8[1] === 0x8b) return inflate(u8, 'gzip');
  if (u8[0] === 0x78) return inflate(u8, 'deflate');
  return u8;
}

// ================= blokk leképezés =================
const COL = ['white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray', 'light_gray', 'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black'];
const FC = { east: 1, west: 0, south: 5, north: 4 };     // irány → MinePixel facing kód (lépcső/ajtó/létra/kapu/csapóajtó/parancsblokk)
const colIdx = n => { const i = COL.findIndex(c => n.startsWith(c + '_')); return i < 0 ? 0 : i; };
const PLANK_KINDS = { oak: B.PLANKS, birch: B.BIRCH_PLANKS, spruce: B.SPRUCE_PLANKS };

function slabMaterial(pre) {
  if (/^(oak|jungle|acacia|dark_oak|mangrove|cherry|bamboo|crimson|warped|petrified_oak)$/.test(pre)) return B.PLANKS;
  if (pre === 'birch') return B.BIRCH_PLANKS; if (pre === 'spruce') return B.SPRUCE_PLANKS;
  if (/^(cobblestone|mossy_cobblestone|cobbled_deepslate)$/.test(pre)) return B.COBBLE;
  if (/^(stone_brick|mossy_stone_brick|deepslate_brick|polished_blackstone_brick)$/.test(pre)) return B.STONEBRICK;
  if (pre === 'brick') return B.BRICKS;
  if (/sandstone/.test(pre)) return B.SANDSTONE;
  if (/quartz/.test(pre)) return B.QUARTZ_BLOCK;
  if (pre === 'smooth_stone') return B.SMOOTH_STONE;
  if (/nether_brick/.test(pre)) return B.NETHER_BRICKS;
  return B.STONE;
}
const ORES = { gold_ore: B.GOLD_ORE, iron_ore: B.IRON_ORE, coal_ore: B.COAL_ORE, diamond_ore: B.DIAMOND_ORE, copper_ore: B.COPPER_ORE, lapis_ore: B.LAPIS_ORE, redstone_ore: B.REDSTONE_ORE, emerald_ore: B.EMERALD_ORE,
  deepslate_gold_ore: B.D_GOLD, deepslate_iron_ore: B.D_IRON, deepslate_coal_ore: B.D_COAL, deepslate_diamond_ore: B.D_DIAMOND, deepslate_copper_ore: B.D_COPPER, deepslate_lapis_ore: B.D_LAPIS, deepslate_redstone_ore: B.D_REDSTONE, deepslate_emerald_ore: B.STONE };
const EXACT = {
  stone: B.STONE, granite: B.GRANITE, diorite: B.DIORITE, andesite: B.ANDESITE, polished_granite: B.POL_GRANITE, polished_diorite: B.POL_DIORITE, polished_andesite: B.POL_ANDESITE,
  cobblestone: B.COBBLE, mossy_cobblestone: B.MOSSY_COBBLE, bedrock: B.BEDROCK, sand: B.SAND, red_sand: B.SAND, gravel: B.GRAVEL, glowstone: B.GLOWSTONE, shroomlight: B.GLOWSTONE, tnt: B.TNT, bookshelf: B.BOOKSHELF,
  sandstone: B.SANDSTONE, smooth_sandstone: B.SANDSTONE, cut_sandstone: B.SANDSTONE, chiseled_sandstone: B.SANDSTONE, red_sandstone: B.SANDSTONE, smooth_red_sandstone: B.SANDSTONE, cut_red_sandstone: B.SANDSTONE, chiseled_red_sandstone: B.SANDSTONE,
  stone_bricks: B.STONEBRICK, mossy_stone_bricks: B.MOSSY_STONEBRICK, cracked_stone_bricks: B.CRACKED_STONEBRICK, chiseled_stone_bricks: B.CHISELED_STONEBRICK, bricks: B.BRICKS, nether_bricks: B.NETHER_BRICKS, red_nether_bricks: B.NETHER_BRICKS, cracked_nether_bricks: B.NETHER_BRICKS, chiseled_nether_bricks: B.NETHER_BRICKS,
  smooth_stone: B.SMOOTH_STONE, ice: B.ICE, frosted_ice: B.ICE, packed_ice: B.PACKED_ICE, blue_ice: B.PACKED_ICE, snow_block: B.SNOW, powder_snow: B.SNOW, cactus: B.CACTUS, crafting_table: B.CRAFTING,
  coal_block: B.BLOCK_COAL, iron_block: B.BLOCK_IRON, gold_block: B.BLOCK_GOLD, diamond_block: B.BLOCK_DIAMOND, emerald_block: B.BLOCK_EMERALD, lapis_block: B.BLOCK_LAPIS, redstone_block: B.BLOCK_REDSTONE, raw_iron_block: B.BLOCK_IRON, raw_gold_block: B.BLOCK_GOLD, raw_copper_block: B.BLOCK_COPPER,
  clay: B.CLAY, netherrack: B.NETHERRACK, soul_sand: B.SOUL_SAND, soul_soil: B.SOUL_SAND, hay_block: B.HAY, melon: B.MELON, sea_lantern: B.SEA_LANTERN, obsidian: B.OBSIDIAN, crying_obsidian: B.OBSIDIAN, ancient_debris: B.OBSIDIAN,
  pumpkin: B.PUMPKIN, carved_pumpkin: B.PUMPKIN, jack_o_lantern: B.JACK, farmland: B.FARMLAND, deepslate: B.DEEPSLATE, cobbled_deepslate: B.DEEPSLATE, polished_deepslate: B.DEEPSLATE, deepslate_bricks: B.DEEPSLATE, deepslate_tiles: B.DEEPSLATE, chiseled_deepslate: B.DEEPSLATE,
  tuff: B.STONE, calcite: B.STONE, dripstone_block: B.STONE, smooth_basalt: B.DEEPSLATE, basalt: B.DEEPSLATE, blackstone: B.DEEPSLATE, polished_blackstone: B.DEEPSLATE, gilded_blackstone: B.DEEPSLATE, end_stone: B.SANDSTONE, prismarine: B.STONEBRICK,
  dandelion: B.DANDELION, poppy: B.POPPY, short_grass: B.TALLGRASS, grass: B.TALLGRASS, fern: B.TALLGRASS, tall_grass: B.TALLGRASS, large_fern: B.TALLGRASS, dead_bush: B.TALLGRASS,
  redstone_lamp: B.LAMP, lever: B.LEVER, command_block: B.CMD, repeating_command_block: B.CMD_REP, chain_command_block: B.CMD_CHAIN,
};
const AIRISH = /(sapling|propagule|flower|tulip|orchid|allium|azure_bluet|oxeye|cornflower|lily|rose_bush|peony|lilac|sunflower|berry|berries|vine|sign|banner|carpet|rail|repeater|comparator|flower_pot|potted|_head|_skull|candle|coral|kelp|seagrass|sea_pickle|cobweb|^fire$|soul_fire|bamboo|sugar_cane|mushroom$|roots|spore|lichen|frogspawn|sculk_vein|tripwire|hook|petals|cake|bell|lantern|chain|end_rod|lightning_rod|anvil|enchanting|brewing|cauldron|grindstone|lectern|loom|stonecutter|smithing|cartography|fletching|composter|jukebox|note_block|observer|piston|dispenser|dropper|hopper|daylight|target|item_frame|painting|armor_stand|snow$|hanging|moss_carpet|big_dripleaf|small_dripleaf|pointed_dripstone|amethyst_cluster|amethyst_bud|decorated_pot|torchflower|pitcher|nether_sprouts|crimson_fungus|warped_fungus|weeping|twisting|cave_vines|glow_)/;

const cache = new Map();
// név ("minecraft:oak_stairs" vagy "oak_stairs") + állapot-tulajdonságok → { id, facing, kind }
export function blockFromName(name, props = {}) {
  const n = String(name).replace(/^minecraft:/, '');
  const key = n + JSON.stringify(props);
  let r = cache.get(key); if (r) return r;
  r = mapBlock(n, props); cache.set(key, r); return r;
}
const R = (id, facing, kind) => ({ id, facing, kind });
function mapBlock(n, p) {
  let m;
  if (/^(air|cave_air|void_air|light|barrier|structure_void|structure_block|jigsaw)$/.test(n)) return R(0);
  if (n === 'water' || n === 'bubble_column') return R(B.WATER);
  if (n === 'lava') return R(B.LAVA);
  if (n === 'grass_block') return R(p.snowy === 'true' ? B.SNOW_GRASS : B.GRASS);
  if (/^(dirt|coarse_dirt|podzol|mycelium|rooted_dirt|dirt_path|grass_path|mud|packed_mud|muddy_mangrove_roots|farmland)$/.test(n) && n !== 'farmland') return R(B.DIRT);
  if (ORES[n] !== undefined) return R(ORES[n]);
  if (/^nether_(gold|quartz)_ore$/.test(n)) return R(B.NETHERRACK);
  if (EXACT[n] !== undefined) {
    const id = EXACT[n];
    if (id === B.LEVER) return leverOf(p);
    if (id === B.CMD || id === B.CMD_REP || id === B.CMD_CHAIN) return R(id, FC[p.facing], 'cmd');
    if (id === B.LAMP) return R(p.lit === 'true' ? B.LAMP_ON : B.LAMP);
    return R(id);
  }
  if ((m = n.match(/^(oak|jungle|acacia|dark_oak|mangrove|cherry|bamboo|crimson|warped|birch|spruce)_planks$/))) return R(PLANK_KINDS[m[1]] || B.PLANKS);
  if ((m = n.match(/^(?:stripped_)?(oak|jungle|acacia|dark_oak|mangrove|cherry|birch|spruce|crimson|warped)_(?:log|wood|stem|hyphae)$/))) return R(m[1] === 'birch' ? B.BIRCH_LOG : m[1] === 'spruce' ? B.SPRUCE_LOG : B.LOG);
  if (n === 'bamboo_block' || n === 'stripped_bamboo_block') return R(B.LOG);
  if (/_leaves$/.test(n)) return R(n.startsWith('spruce') ? B.SPRUCE_LEAVES : n.startsWith('birch') ? B.BIRCH_LEAVES : B.LEAVES);
  if (n === 'azalea' || n === 'flowering_azalea') return R(B.LEAVES);
  if (/glass_pane$/.test(n) || /(^|_)glass$/.test(n) || n === 'tinted_glass') return R(B.GLASS);
  if (/_wool$/.test(n)) return R(woolId(colIdx(n)));
  if (/_concrete(_powder)?$/.test(n)) return R(108 + colIdx(n));
  if (/terracotta$/.test(n) || n === 'terracotta') return R(B.TERRACOTTA);
  if (/^(copper_block|cut_copper|exposed_copper|weathered_copper|oxidized_copper|waxed_.*copper.*)$/.test(n) && !/slab|stairs/.test(n)) return R(B.BLOCK_COPPER);
  if (/^(quartz_block|quartz_pillar|smooth_quartz|chiseled_quartz_block|quartz_bricks)$/.test(n)) return R(B.QUARTZ_BLOCK);
  if (n === 'furnace' || n === 'blast_furnace' || n === 'smoker') return R(B.FURNACE, FC[p.facing], 'furnace');
  if (n === 'chest' || n === 'trapped_chest' || n === 'barrel' || n === 'ender_chest') return R(B.CHEST, FC[p.facing], 'chest');
  if (n === 'torch' || n === 'wall_torch' || n === 'soul_torch' || n === 'soul_wall_torch') return R(B.TORCH);
  if (n === 'redstone_torch' || n === 'redstone_wall_torch') return R(p.lit === 'false' ? B.RSTORCH_OFF : B.RSTORCH);
  if (n === 'wheat') return R(B.WHEAT0 + Math.min(3, Math.floor((+p.age || 0) / 2)));
  if (n === 'ladder') return R(B.LADDER, FC[p.facing], 'ladder');
  if (/_bed$/.test(n)) return p.part === 'foot' ? R(B.BED, FC[p.facing], 'bed') : R(0);
  if (n === 'redstone_wire') return R(B.DUST0 + Math.max(0, Math.min(15, +p.power || 0)));
  if (/_fence$/.test(n) || /_wall$/.test(n)) return R(B.FENCE);
  if (/_fence_gate$/.test(n)) return R(p.open === 'true' ? B.FENCE_GATE_OPEN : B.FENCE_GATE, FC[p.facing], 'gate');
  if (/_door$/.test(n)) { const open = p.open === 'true', top = p.half === 'upper'; return R(top ? (open ? B.DOOR_TOP_OPEN : B.DOOR_TOP) : (open ? B.DOOR_OPEN : B.DOOR), FC[p.facing], 'door'); }
  if (/_trapdoor$/.test(n)) { const open = p.open === 'true', top = p.half === 'top'; return R(top ? (open ? B.TRAPDOOR_TOP_OPEN : B.TRAPDOOR_TOP) : (open ? B.TRAPDOOR_OPEN : B.TRAPDOOR), FC[p.facing], 'trapdoor'); }
  if (/_button$/.test(n)) return switchOf(B.BUTTON, B.BUTTON_ON, p);
  if (/_pressure_plate$/.test(n)) return R(p.powered === 'true' ? B.PLATE_ON : B.PLATE);
  if ((m = n.match(/^(\w+?)_slab$/))) { const mat = slabMaterial(m[1]); return p.type === 'double' ? R(mat) : R(SLAB_OF[mat] || mat); }
  if ((m = n.match(/^(\w+?)_stairs$/))) { const mat = slabMaterial(m[1]); return R(STAIR_OF[mat] || mat, FC[p.facing], 'stairs'); }
  if (AIRISH.test(n)) return R(0, undefined, 'skip');
  return R(B.STONE, undefined, 'unknown');
}
function switchOf(off, on, p) {
  const face = p.face || 'wall', f = face === 'floor' ? 3 : face === 'ceiling' ? 2 : FC[p.facing];
  return R(p.powered === 'true' ? on : off, f, 'attach');
}
function leverOf(p) { return switchOf(B.LEVER, B.LEVER_ON, p); }

// ================= tárgy leképezés (ládák tartalma) =================
const ITEM_EXACT = {
  stick: I.STICK, coal: I.COAL, charcoal: I.COAL, iron_ingot: I.IRON_INGOT, gold_ingot: I.GOLD_INGOT, diamond: I.DIAMOND, apple: I.APPLE, porkchop: I.RAW_PORK, cooked_porkchop: I.COOKED_PORK, beef: I.RAW_BEEF, cooked_beef: I.STEAK,
  rotten_flesh: I.ROTTEN, gunpowder: I.GUNPOWDER, raw_iron: I.RAW_IRON, raw_gold: I.RAW_GOLD, flint: I.FLINT, copper_ingot: I.COPPER_INGOT, raw_copper: I.RAW_COPPER, lapis_lazuli: I.LAPIS, redstone: I.REDSTONE, emerald: I.EMERALD, quartz: I.QUARTZ,
  clay_ball: I.CLAY_BALL, brick: I.BRICK, feather: I.FEATHER, bone: I.BONE, string: I.STRING, leather: I.LEATHER, wheat_seeds: I.SEEDS, wheat: I.WHEAT, bread: I.BREAD, chicken: I.RAW_CHICKEN, cooked_chicken: I.COOKED_CHICKEN,
  mutton: I.RAW_MUTTON, cooked_mutton: I.COOKED_MUTTON, golden_apple: I.GOLDEN_APPLE, enchanted_golden_apple: I.GOLDEN_APPLE, melon_slice: I.MELON_SLICE, egg: I.EGG, bucket: I.BUCKET, water_bucket: I.WATER_BUCKET, lava_bucket: I.LAVA_BUCKET,
  shears: I.SHEARS, flint_and_steel: I.FLINT_STEEL, bow: I.BOW, arrow: I.ARROW, netherite_ingot: I.DIAMOND, redstone_torch: B.RSTORCH,
};
const TOOLS = { pickaxe: 'PICKAXE', axe: 'AXE', shovel: 'SHOVEL', sword: 'SWORD', hoe: 'HOE' };
const TMAT = { wooden: 'WOOD', stone: 'STONE', iron: 'IRON', golden: 'GOLD', diamond: 'DIAMOND', netherite: 'DIAMOND' };
export function itemFromName(name) {
  const n = String(name).replace(/^minecraft:/, '');
  if (ITEM_EXACT[n] !== undefined) return ITEM_EXACT[n];
  let m;
  if ((m = n.match(/^(wooden|stone|iron|golden|diamond|netherite)_(pickaxe|axe|shovel|sword|hoe)$/))) return I[TMAT[m[1]] + '_' + TOOLS[m[2]]] || 0;
  if ((m = n.match(/^(leather|chainmail|iron|golden|diamond|netherite|turtle)_(helmet|chestplate|leggings|boots)$/))) { const mat = { leather: 'leather', chainmail: 'iron', iron: 'iron', golden: 'gold', diamond: 'diamond', netherite: 'diamond', turtle: 'leather' }[m[1]]; return ARMOR_ID[mat + '_' + m[2]] || 0; }
  if ((m = n.match(/^(\w+)_dye$/))) { const i = COL.indexOf(m[1]); return i >= 0 ? dyeId(i) : 0; }
  const b = blockFromName(n, {});
  if (b.id && b.kind !== 'unknown' && b.kind !== 'skip') return b.id;
  return 0;
}

// ================= chunk átalakítás =================
function unpackPalette(longs, bits, count, spanning) {
  const out = new Uint16Array(count), mask = (1 << bits) - 1;
  const word = k => longs[(k >> 1) * 2 + 1 - (k & 1)];   // k: 32 bites szó index (alsó rész előbb)
  if (!spanning) {
    const per = Math.floor(64 / bits);
    for (let i = 0; i < count; i++) {
      const li = (i / per) | 0, p = li * 64 + (i - li * per) * bits;
      let v = word(p >> 5) >>> (p & 31); if ((p & 31) + bits > 32) v |= word((p >> 5) + 1) << (32 - (p & 31));
      out[i] = v & mask;
    }
  } else {
    for (let i = 0; i < count; i++) {
      const p = i * bits; let v = word(p >> 5) >>> (p & 31); if ((p & 31) + bits > 32) v |= word((p >> 5) + 1) << (32 - (p & 31));
      out[i] = v & mask;
    }
  }
  return out;
}
const palKey = e => (e.Name || 'air') + (e.Properties ? JSON.stringify(e.Properties) : '');

function convertChunk(root, cx, cz, out, stats) {
  const lvl = root.Level || root;
  const status = lvl.Status || root.Status; if (status && !/full$/.test(status)) return false;
  const dv = root.DataVersion || 0;
  const sections = lvl.sections || lvl.Sections; if (!sections || !sections.length) return false;
  const blocks = new Uint8Array(CS * CS * H), x0 = cx * CS, z0 = cz * CS;
  let any = false;
  for (const s of sections) {
    const sy = (s.Y << 24) >> 24;
    let pal, data;
    if (s.block_states) { pal = s.block_states.palette; data = s.block_states.data; }
    else if (s.Palette) { pal = s.Palette; data = s.BlockStates; }
    else if (s.Blocks) { stats.legacy = true; continue; }
    else continue;
    if (!pal || !pal.length) continue;
    const map = pal.map(e => blockFromName(e.Name || 'air', e.Properties || {}));
    for (const e of pal) { const r = map[pal.indexOf(e)]; if (r.kind === 'unknown') { const k = (e.Name || '').replace('minecraft:', ''); stats.unmapped[k] = (stats.unmapped[k] || 0) + 1; } }
    let idx = null;
    if (pal.length > 1 && data) idx = unpackPalette(data, Math.max(4, 32 - Math.clz32(pal.length - 1)), 4096, dv && dv < 2529 && !s.block_states);
    for (let i = 0; i < 4096; i++) {
      const r = map[idx ? idx[i] : 0]; if (!r || !r.id) continue;
      const y = sy * 16 + (i >> 8); if (y < 0 || y >= H) continue;
      const lx = i & 15, lz = (i >> 4) & 15, bi = (y << 8) | (lz << 4) | lx;
      blocks[bi] = r.id; any = true; stats.blocks++;
      if (r.facing !== undefined) out.facing.set((x0 + lx) + ',' + y + ',' + (z0 + lz), r.facing);
      if (r.kind === 'chest') out.chestAt.add((x0 + lx) + ',' + y + ',' + (z0 + lz));
    }
  }
  if (!any) return false;
  // tárolók, parancsblokkok
  for (const te of (lvl.block_entities || lvl.TileEntities || [])) {
    const id = String(te.id || '').replace('minecraft:', ''), y = te.y;
    if (y < 0 || y >= H) continue; const key = te.x + ',' + y + ',' + te.z;
    if (Array.isArray(te.Items) && (id === 'chest' || id === 'trapped_chest' || id === 'barrel')) {
      const slots = new Array(27).fill(null);
      for (const it of te.Items) { const sl = (it.Slot << 24) >> 24; if (sl < 0 || sl > 26) continue; const iid = itemFromName(it.id || ''); if (iid) slots[sl] = { id: iid, n: Math.max(1, it.Count ?? it.count ?? 1), d: 0 }; }
      out.containers.set(key, { slots }); stats.chests++;
    } else if (id === 'furnace' || id === 'blast_furnace' || id === 'smoker') {
      const slots = [null, null, null];
      for (const it of (te.Items || [])) { const sl = (it.Slot << 24) >> 24; if (sl < 0 || sl > 2) continue; const iid = itemFromName(it.id || ''); if (iid) slots[sl] = { id: iid, n: Math.max(1, it.Count ?? it.count ?? 1), d: 0 }; }
      out.containers.set(key, { slots, burn: 0, burnMax: 0, cook: 0 });
    } else if (id === 'command_block') {
      const bi = (y << 8) | ((te.z & 15) << 4) | (te.x & 15), bid = blocks[bi];
      if (bid === B.CMD || bid === B.CMD_REP || bid === B.CMD_CHAIN) { out.containers.set(key, { slots: [], cmd: String(te.Command || ''), auto: !!te.auto, cond: !!te.conditionMet && false }); stats.cmds++; }
    }
  }
  out.chunks.set(cx, out.chunks.get(cx) || new Map());
  out.chunks.get(cx).set(cz, blocks);
  return true;
}

// ================= régió olvasás =================
async function readRegion(file, rx, rz, want, out, stats) {
  const buf = new Uint8Array(await file.arrayBuffer()); if (buf.length < 8192) return;
  const dv = new DataView(buf.buffer);
  let n = 0;
  for (let i = 0; i < 1024; i++) {
    const cx = rx * 32 + (i & 31), cz = rz * 32 + (i >> 5);
    if (!want(cx, cz)) continue;
    const off = dv.getUint32(i * 4); const sector = off >>> 8, cnt = off & 255; if (!sector || !cnt) continue;
    const p = sector * 4096; if (p + 5 > buf.length) continue;
    const len = dv.getUint32(p), comp = buf[p + 4]; if (len < 2 || p + 4 + len > buf.length) continue;
    const raw = buf.subarray(p + 5, p + 4 + len);
    try {
      const data = comp === 1 ? await inflate(raw, 'gzip') : comp === 2 ? await inflate(raw, 'deflate') : raw;
      const root = parseNBT(data);
      if (convertChunk(root, cx, cz, out, stats)) stats.chunks++;
    } catch (e) { stats.errors++; }
    if (++n % 12 === 0) { await new Promise(r => setTimeout(r, 0)); out.progress && out.progress(stats); }
  }
}

// files: File[] (mappa kiválasztásából, webkitRelativePath-tal)
export async function importJavaWorld(files, opts = {}) {
  const radius = opts.radius || 24, progress = opts.onProgress;
  const rel = f => (f.webkitRelativePath || f.name).replace(/\\/g, '/');
  const levelFiles = files.filter(f => /(^|\/)level\.dat$/.test(rel(f))).sort((a, b) => rel(a).length - rel(b).length);
  const regionFiles = files.filter(f => /(^|\/)region\/r\.-?\d+\.-?\d+\.mca$/.test(rel(f)) && !/\/(DIM-?\d+|dimensions)\//.test(rel(f)));
  if (!regionFiles.length) throw new Error('Nem találtam region/*.mca fájlokat. Válaszd ki a Minecraft világ mappáját (ahol a level.dat van).');
  const prefix = levelFiles.length ? rel(levelFiles[0]).replace(/level\.dat$/, '') : null;
  const mine = prefix === null ? regionFiles : regionFiles.filter(f => rel(f).startsWith(prefix));
  const use = mine.length ? mine : regionFiles;
  let name = 'Importált világ', spawn = null, seed = 0;
  if (levelFiles.length) {
    try {
      const lv = parseNBT(await unpackBytes(new Uint8Array(await levelFiles[0].arrayBuffer()))).Data || {};
      if (lv.LevelName) name = String(lv.LevelName).slice(0, 24);
      if (typeof lv.SpawnX === 'number') spawn = [lv.SpawnX, lv.SpawnY, lv.SpawnZ];
      if (lv.RandomSeed !== undefined) seed = Number(lv.RandomSeed) | 0;
      else if (lv.WorldGenSettings && lv.WorldGenSettings.seed !== undefined) seed = Number(lv.WorldGenSettings.seed) | 0;
    } catch (e) { /* level.dat nélkül is megy */ }
  }
  // középpont: a spawn, különben a régiók közepe
  const regs = use.map(f => { const m = rel(f).match(/r\.(-?\d+)\.(-?\d+)\.mca$/); return { f, rx: +m[1], rz: +m[2] }; });
  let ccx, ccz;
  if (spawn) { ccx = Math.floor(spawn[0] / 16); ccz = Math.floor(spawn[2] / 16); }
  else { ccx = Math.round(regs.reduce((a, r) => a + r.rx * 32 + 16, 0) / regs.length); ccz = Math.round(regs.reduce((a, r) => a + r.rz * 32 + 16, 0) / regs.length); }
  const out = { chunks: new Map(), facing: new Map(), containers: new Map(), chestAt: new Set(), progress };
  const stats = { chunks: 0, blocks: 0, chests: 0, cmds: 0, errors: 0, unmapped: {}, legacy: false };
  const want = (cx, cz) => Math.abs(cx - ccx) <= radius && Math.abs(cz - ccz) <= radius;
  for (const r of regs) {
    // csak azok a régiók, amik érintik a területet
    if (r.rx * 32 + 31 < ccx - radius || r.rx * 32 > ccx + radius || r.rz * 32 + 31 < ccz - radius || r.rz * 32 > ccz + radius) continue;
    await readRegion(r.f, r.rx, r.rz, want, out, stats);
  }
  if (!stats.chunks) throw new Error(stats.legacy ? 'Ez egy régi (1.12 vagy korábbi) formátumú térkép. Nyisd meg egyszer Minecraft 1.13+ verzióban (az átalakítja), majd importáld újra.' : 'Nem sikerült chunkokat beolvasni a térképből.');
  // lapos kulcs-térkép (ckey)
  const flat = new Map();
  for (const [cx, row] of out.chunks) for (const [cz, arr] of row) flat.set(cx + ',' + cz, arr);
  // spawn pont: a talaj tetején
  const sx = spawn ? spawn[0] : ccx * 16 + 8, sz = spawn ? spawn[2] : ccz * 16 + 8;
  const top = (x, z) => { const row = out.chunks.get(Math.floor(x / 16)), arr = row && row.get(Math.floor(z / 16)); if (!arr) return -1; for (let y = H - 1; y > 0; y--) { const id = arr[(y << 8) | ((z & 15) << 4) | (x & 15)]; if (id && BLOCKS[id] && BLOCKS[id].solid !== false && !BLOCKS[id].liquid) return y; } return -1; };
  let spy = top(sx, sz), spx = sx, spz = sz;
  if (spy < 0) { outer: for (const [cx, row] of out.chunks) for (const [cz] of row) { for (let dz = 0; dz < 16; dz += 4) for (let dx = 0; dx < 16; dx += 4) { const y = top(cx * 16 + dx, cz * 16 + dz); if (y >= 0) { spx = cx * 16 + dx; spz = cz * 16 + dz; spy = y; break outer; } } } }
  return { name, seed, spawn: [spx + 0.5, Math.max(2, spy + 1), spz + 0.5], chunks: out.chunks, flat, facing: out.facing, containers: out.containers, stats };
}
