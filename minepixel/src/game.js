// MinePixel – fő játékmotor
import * as THREE from '../vendor/three.module.js';
import { strongholdPos } from './dimgen.js';
import { enchText } from './ui.js';
import { World, Chunk, ckey } from './world.js';
import { meshChunk, blockModel } from './mesher.js';
import { buildAtlas, ATLAS_SIZE, iconURL, crackTextures, hudIcons, tileIndex } from './textures.js';
import { B, I, BLOCKS, ITEMS, ARMOR, SOLID, CS, H, SEA, itemDef, isBlockItem, maxStack, maxDur, toolInfo, breakTime, blockDrops, SMELT, fuelTime, BIOME_NAMES, FK, FL } from './blocks.js';
import { Fluids } from './fluids.js';
import { Redstone } from './redstone.js';
import { importJavaWorld, blockFromName, itemFromName } from './mcimport.js';
import { moveBox, raycast, boxHits, rayAABB } from './physics.js';
import { hashString } from './noise.js';
import { Mobs, Drops, Particles, Arrows } from './entities.js';
import './textures2.js';
import { SLAB_FULL, STAIR_OF, ARMOR_ID, DOOR_HALVES, isDoorTop, isDoorOpen, GATES, TRAPDOORS, isTrapTop, isTrapOpen, LADDER_DIR, ATTACH_DIR, isDust, isLeverOrButton, isCmdBlock, isMilker, isNest, SPAWN_EGGS } from './content.js';
import { Inventory, InvUI } from './ui.js';
import * as A from './audio.js';
import { SS, setGateway, parseSsName } from './ss.js';
function raf(f) { return window.__dedicated ? setTimeout(() => f(performance.now()), 40) : requestAnimationFrame(f); }
import { Plugins } from './plugins.js';
import { Smp, SMP, SMP_HOST_CMDS, sellPrice, itemName, fmt } from './smp.js';
import { renderSidebar, initShop } from './smpui.js';
import { Net, parseCode, pingRoom, randomRoom, buildAvatar, setAvatarArmor } from './multiplayer.js';

THREE.ColorManagement.enabled = false;
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const TEST = new URLSearchParams(location.search).has('test');

// ---------------- Beállítások & tárolás ----------------
const settings = Object.assign({ pname: '', relay: '', smpAddr: '', smpKey: '', smpCode: '', gateway: '', rd: 7, fov: 75, sens: 100, vol: 70, mus: 35, smooth: true, clouds: true, bob: true }, (() => { try { return JSON.parse(localStorage.getItem('minepixel.settings') || '{}'); } catch { return {}; } })());
const saveSettings = () => { try { localStorage.setItem('minepixel.settings', JSON.stringify(settings)); } catch {} };
const store = {
  async list() { if (window.mp) return window.mp.list(); const out = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('mp.save.')) { try { const j = JSON.parse(localStorage.getItem(k)); out.push({ id: k.slice(8), name: j.name, mode: j.mode, time: j.time, seed: j.seed }); } catch {} } } return out.sort((a, b) => b.time - a.time); },
  async read(id) { if (window.mp) return window.mp.read(id); try { return JSON.parse(localStorage.getItem('mp.save.' + id)); } catch { return null; } },
  async write(id, d) { if (window.mp) return window.mp.write(id, d); try { const old = localStorage.getItem('mp.save.' + id); if (old) { try { localStorage.setItem('mp.bak.' + id, old); } catch { localStorage.removeItem('mp.bak.' + id); } } localStorage.setItem('mp.save.' + id, JSON.stringify(d)); } catch (e) { console.warn('mentés sikertelen', e); } },
  async backups(id) { if (window.mp) return window.mp.backups(id); const o = localStorage.getItem('mp.bak.' + id); return o ? [{ stamp: 'ls', time: (() => { try { return JSON.parse(o).time || 0; } catch { return 0; } })(), size: o.length }] : []; },
  async restore(id, stamp) { if (window.mp) return window.mp.restore(id, stamp); const o = localStorage.getItem('mp.bak.' + id); if (!o) return false; const cur = localStorage.getItem('mp.save.' + id); localStorage.setItem('mp.save.' + id, o); if (cur) { try { localStorage.setItem('mp.bak.' + id, cur); } catch {} } return true; },
  async del(id) { if (window.mp) return window.mp.del(id); localStorage.removeItem('mp.save.' + id); },
};

// ---------------- Renderer ----------------
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.autoClear = false;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(settings.fov, 1, 0.05, 700);
camera.rotation.order = 'YXZ';
const handScene = new THREE.Scene();
const handCam = new THREE.PerspectiveCamera(60, 1, 0.05, 10);
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  renderer.setPixelRatio(dpr); renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = handCam.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); handCam.updateProjectionMatrix();
}
window.addEventListener('resize', resize); resize();

// textúra-atlasz
const atlasTex = new THREE.DataTexture(buildAtlas(), ATLAS_SIZE, ATLAS_SIZE, THREE.RGBAFormat);
atlasTex.magFilter = THREE.NearestFilter; atlasTex.minFilter = THREE.NearestFilter; atlasTex.needsUpdate = true;
const HUD = hudIcons();

const G = { map: { value: atlasTex }, uDay: { value: 1 }, uAmb: { value: 0 }, uFog: { value: new THREE.Color(0.6, 0.75, 1) }, uFogNear: { value: 60 }, uFogFar: { value: 110 } };
const VS = `attribute vec3 aux; attribute vec3 tint; varying vec2 vUv; varying vec3 vAux; varying vec3 vTint; varying float vDist;
void main(){ vUv=uv; vAux=aux; vTint=tint; vec4 mv=modelViewMatrix*vec4(position,1.0); vDist=length(mv.xyz); gl_Position=projectionMatrix*mv; }`;
const FS = `uniform sampler2D map; uniform float uDay; uniform float uAmb; uniform vec3 uFog; uniform float uFogNear; uniform float uFogFar; uniform float uAlpha; uniform float uMul;
varying vec2 vUv; varying vec3 vAux; varying vec3 vTint; varying float vDist;
void main(){
  vec4 t = texture2D(map, vUv); if (t.a < 0.5) discard;
  bool tinted = t.a < 0.995;
  vec3 c = t.rgb * (tinted ? vTint : vec3(1.0));
  float sk = vAux.x * uDay; float L = max(max(sk, vAux.y), uAmb);
  float br = mix(0.05, 1.0, pow(L, 1.5));
  float warm = clamp(vAux.y - sk, 0.0, 1.0);
  c *= br * vAux.z * mix(vec3(1.0), vec3(1.0, 0.84, 0.66), warm * 0.8) * uMul;
  float f = smoothstep(uFogNear, uFogFar, vDist);
  c = mix(c, uFog, f);
  gl_FragColor = vec4(c, uAlpha);
}`;
function mkMat(o = {}) {
  return new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, side: o.side || THREE.FrontSide, transparent: !!o.transparent, depthWrite: o.depthWrite !== false,
    uniforms: { map: G.map, uDay: G.uDay, uAmb: G.uAmb, uFog: G.uFog, uFogNear: G.uFogNear, uFogFar: G.uFogFar, uAlpha: { value: o.alpha ?? 1 }, uMul: { value: 1 } } });
}
const matSolid = mkMat(), matPlant = mkMat({ side: THREE.DoubleSide }), matWater = mkMat({ transparent: true, alpha: 0.72, depthWrite: false, side: THREE.DoubleSide });
const matHand = mkMat();

// ---------------- Égbolt ----------------
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), c); const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; return t; }
const sunTex = canvasTex(16, 16, g => { g.fillStyle = '#fff6a8'; g.fillRect(0, 0, 16, 16); g.fillStyle = '#ffe060'; g.fillRect(1, 1, 14, 14); g.fillStyle = '#fffbd0'; g.fillRect(4, 4, 8, 8); });
const moonTex = canvasTex(16, 16, g => { g.fillStyle = '#e8ecf4'; g.fillRect(0, 0, 16, 16); g.fillStyle = '#c4cad8'; for (const [x, y, w, h] of [[2, 3, 4, 3], [9, 2, 3, 4], [6, 9, 5, 4], [2, 11, 3, 3], [12, 10, 2, 3]]) g.fillRect(x, y, w, h); });
const sunMesh = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshBasicMaterial({ map: sunTex, fog: false, depthWrite: false, transparent: true }));
const moonMesh = new THREE.Mesh(new THREE.PlaneGeometry(45, 45), new THREE.MeshBasicMaterial({ map: moonTex, fog: false, depthWrite: false, transparent: true }));
sunMesh.renderOrder = -10; moonMesh.renderOrder = -10; scene.add(sunMesh, moonMesh);
const starGeo = new THREE.BufferGeometry(); { const p = new Float32Array(1400 * 3); for (let i = 0; i < 1400; i++) { const u = Math.random() * 2 - 1, a = Math.random() * 6.283, r = Math.sqrt(1 - u * u); p[i * 3] = r * Math.cos(a) * 450; p[i * 3 + 1] = u * 450; p[i * 3 + 2] = r * Math.sin(a) * 450; } starGeo.setAttribute('position', new THREE.BufferAttribute(p, 3)); }
const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
const stars = new THREE.Points(starGeo, starMat); stars.frustumCulled = false; stars.renderOrder = -11; scene.add(stars);
const cloudTex = canvasTex(64, 64, (g) => {
  g.clearRect(0, 0, 64, 64); g.fillStyle = '#fff';
  let s = 1234567; const r = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) { const n = Math.sin(x * 0.19) * Math.sin(y * 0.23) + Math.sin((x + y) * 0.11) + r() * 0.5; if (n > 0.75) g.fillRect(x, y, 1, 1); }
});
cloudTex.wrapS = cloudTex.wrapT = THREE.RepeatWrapping; cloudTex.repeat.set(6, 6);
const cloudMat = new THREE.MeshBasicMaterial({ map: cloudTex, transparent: true, opacity: 0.85, depthWrite: false, fog: false, side: THREE.DoubleSide, color: 0xffffff });
const clouds = new THREE.Mesh(new THREE.PlaneGeometry(1536, 1536), cloudMat); clouds.rotation.x = -Math.PI / 2; clouds.renderOrder = -5; scene.add(clouds);

// ---------------- Kijelölés, repedés ----------------
const outline = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)), new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6 }));
outline.visible = false; scene.add(outline);
const crackTex = crackTextures().map(d => { const t = new THREE.DataTexture(d, 16, 16, THREE.RGBAFormat); t.magFilter = t.minFilter = THREE.NearestFilter; t.needsUpdate = true; return t; });
const crackMesh = new THREE.Mesh(new THREE.BoxGeometry(1.006, 1.006, 1.006), new THREE.MeshBasicMaterial({ map: crackTex[0], transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
crackMesh.visible = false; scene.add(crackMesh);

// ---------------- Játékállapot ----------------
const inv = new Inventory();
const ui = new InvUI({
  get inv() { return inv; }, get player() { return player; }, get armor() { return player.armor; }, dropItem: (...a) => game.dropItem(...a), refreshHotbar: () => refreshHotbar(),
});
const player = { armor: [null, null, null, null], draw: 0, pos: [0, 80, 0], vel: [0, 0, 0], yaw: 0, pitch: 0, ground: false, health: 20, food: 20, sat: 5, exh: 0, air: 300, creative: false, flying: false, dead: false, hot: 0,
  xp: 0, level: 0, hurtT: 0, inv_t: 0, fall: 0, inWater: false, headWater: false, sprint: false, sneak: false, stepD: 0, regenT: 0, starveT: 0, eatT: 0, drownT: 0, lavaT: 0 };

const game = {
  state: 'menu', paused: false, world: null, mobs: null, drops: null, particles: null, difficulty: 2, name: '', id: '', seed: 0, mode: 'survival', dayTime: 1000, spawn: [0, 80, 0], time: 0,
  tnts: [], falling: [], saveT: 0, mining: null, atk: 0, swing: 0, deathMsg: '', rdActive: 7, ready: false, loadTarget: 0,
  inv, player, settings, smpMode: false, smp: null,
  hurtPlayer, explode, addXP, arrows: null, net: null, mpPlayers: {}, rules: { keepInventory: false, doDaylightCycle: true, doMobSpawning: true, mobGriefing: true, fallDamage: true, pvp: true },
  hurtAny(p, dmg, sx, sz, src) { if (p.cid) this.net.sendTo(p.cid, { t: 'hurt', dmg, sx, sz, src }); else hurtPlayer(dmg, sx, sz, src); },
  playerList() { return this.net && this.net.isHost ? this.net.playerList() : [player]; },
  shootArrow(x, y, z, dx, dy, dz, speed, dmg, owner) {
    if (!this.arrows) return;
    const net = this.net;
    if (net.isClient && owner !== 'player') return;
    this.arrows.fire(x, y, z, dx, dy, dz, speed, dmg, owner); A.sndShoot();
    const a = [x, y, z, dx, dy, dz, speed, dmg];
    if (net.isHost) net.bcast({ t: 'arrow', a, o: owner === 'mob' ? 'mob' : 'remote' });
    else if (net.isClient) net.send({ t: 'arrow', a });
  },
  dropItem(id, n, x, y, z, toss) {
    if (!this.drops) return;
    let a;
    if (toss) { const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw); a = [id, n, x + fx * 0.4, y, z + fz * 0.4, fx * 4.5 + (Math.random() - 0.5), 2.5, fz * 4.5 + (Math.random() - 0.5), 1.4]; }
    else a = [id, n, x + (Math.random() - 0.5) * 0.4, y, z + (Math.random() - 0.5) * 0.4];
    if (this.net && this.net.isClient) this.net.send({ t: 'drop', a }); else this.drops.add(...a);
  },
  particles: null,
};
game.net = new Net(game);
game.fluids = new Fluids(game); game.rs = new Redstone(game);
window.__mp = game; game.THREE = THREE; game.camera = camera; game.renderer = renderer; game.scene = scene;

// ---------------- HUD ----------------
let hudCache = '';
function refreshHotbar() {
  const hb = $('hotbar'); hb.innerHTML = '';
  for (let i = 0; i < 9; i++) {
    const s = inv.slots[i], el = document.createElement('div'); el.className = 'slot' + (i === player.hot ? ' sel' : '');
    ui.fillEl(el, s); hb.appendChild(el);
  }
  lastHeld = -1;
}
function updateBars(force) {
  const key = [armorPoints(), Math.ceil(player.health), Math.floor(player.food), Math.max(0, Math.ceil(player.air / 30)), player.creative, player.xp, player.level, player.headWater].join();
  if (key === hudCache && !force) return; hudCache = key;
  const cr = player.creative;
  $('bars').style.display = cr ? 'none' : 'flex'; $('xpbar').style.display = cr ? 'none' : 'block';
  if (!cr) {
    let h = ''; const hp = Math.ceil(player.health), low = hp <= 4;
    for (let i = 0; i < 10; i++) { const v = hp - i * 2; h += `<img class="${low ? 'shake' : ''}" src="${v >= 2 ? HUD.heart : v === 1 ? HUD.heartHalf : HUD.heartEmpty}">`; }
    $('hearts').innerHTML = h;
    let f = ''; for (let i = 0; i < 10; i++) { const v = Math.floor(player.food) - i * 2; f += `<img src="${v >= 2 ? HUD.food : v === 1 ? HUD.foodHalf : HUD.foodEmpty}">`; }
    $('foods').innerHTML = f;
    const need = 7 + player.level * 2; $('xpfill').style.width = clamp(player.xp / need * 100, 0, 100) + '%'; $('xplvl').textContent = player.level > 0 ? player.level : '';
  }
  { const pts = armorPoints(); let ah2 = ''; if (!cr && pts > 0) for (let i = 0; i < 10; i++) { const v = pts - i * 2; ah2 += `<img src="${v >= 2 ? HUD.armor : v === 1 ? HUD.armorHalf : HUD.armorEmpty}">`; } $('armor').innerHTML = ah2; }
  const a = player.air < 300 && !player.dead ? Math.ceil(player.air / 30) : 0; let ah = ''; for (let i = 0; i < a; i++) ah += `<img src="${HUD.bubble}">`;
  $('air').innerHTML = ah; $('air').style.bottom = cr ? '66px' : '96px';
}
function armorPoints() { let n = 0; for (const a of player.armor) if (a && ARMOR[a.id]) n += ARMOR[a.id].prot + (a.e && a.e.p ? a.e.p * 0.8 : 0); return n; }
let toastT = 0;
function toast(t) { const e = $('toast'); e.textContent = t; e.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => e.classList.remove('show'), 2200); }
function showName() { const s = inv.slots[player.hot], e = $('itemname'); if (!s) { e.classList.remove('show'); return; } e.textContent = itemDef(s.id).name + enchText(s); e.classList.add('show'); clearTimeout(showName.t); showName.t = setTimeout(() => e.classList.remove('show'), 1500); }

function addXP(n) { if (player.creative) return; player.xp += n; for (;;) { const need = 7 + player.level * 2; if (player.xp >= need) { player.xp -= need; player.level++; A.sndLevel(); } else break; } }

// ---------------- Világ-menedzsment ----------------
function newChunkSet(w) { return w.chunks; }
function releaseChunk(w, c) {
  if (c.mesh) { for (const k of ['solid', 'plant', 'water']) { const m = c.mesh[k]; if (m) { scene.remove(m); m.geometry.dispose(); } } c.mesh = null; }
  if (c.modified && c.generated) w.stash.set(ckey(c.cx, c.cz), c.blocks.slice());
  w.chunks.delete(ckey(c.cx, c.cz));
}
function applyMesh(c, data) {
  if (c.mesh) { for (const k of ['solid', 'plant', 'water']) { const m = c.mesh[k]; if (m) { scene.remove(m); m.geometry.dispose(); } } }
  c.mesh = {};
  const mats = { solid: matSolid, plant: matPlant, water: matWater };
  for (const k of ['solid', 'plant', 'water']) {
    const d = data[k]; if (!d) continue;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(d.pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(d.uv, 2));
    g.setAttribute('aux', new THREE.BufferAttribute(d.aux, 3)); g.setAttribute('tint', new THREE.BufferAttribute(d.tint, 3)); g.setIndex(new THREE.BufferAttribute(d.idx, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(c.cx * 16 + 8, 64, c.cz * 16 + 8), 90);
    const m = new THREE.Mesh(g, mats[k]); m.matrixAutoUpdate = false; if (k === 'water') m.renderOrder = 2; scene.add(m); c.mesh[k] = m;
  }
  c.dirty = false;
}
function neighborsReady(w, c) {
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const n = w.chunks.get(ckey(c.cx + dx, c.cz + dz)); if (!n || !n.generated) return false; }
  return true;
}
let lastPCX = 1e9, lastPCZ = 1e9, order = [];
function streamChunks(w, px, pz, rd, genBudgetMs, meshBudgetMs) {
  const pcx = Math.floor(px / 16), pcz = Math.floor(pz / 16);
  if (pcx !== lastPCX || pcz !== lastPCZ || order.rd !== rd || order.w !== w) {
    lastPCX = pcx; lastPCZ = pcz; order = []; order.rd = rd; order.w = w;
    const R = rd + 1;
    for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) { const d = dx * dx + dz * dz; if (d <= R * R + 1) order.push([dx, dz, d]); }
    order.sort((a, b) => a[2] - b[2]);
    for (const c of [...w.chunks.values()]) { const dx = c.cx - pcx, dz = c.cz - pcz; if (dx * dx + dz * dz > (rd + 3) * (rd + 3)) releaseChunk(w, c); }
  }
  let t0 = performance.now();
  for (const [dx, dz] of order) {
    const cx = pcx + dx, cz = pcz + dz, k = ckey(cx, cz);
    if (w.chunks.has(k)) continue;
    const c = new Chunk(cx, cz); w.chunks.set(k, c); w.generateChunk(c);
    for (const [ax, az] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) { const n = w.chunks.get(ckey(cx + ax, cz + az)); if (n) n.dirty = true; }
    if (performance.now() - t0 > genBudgetMs) break;
  }
  t0 = performance.now(); let meshed = 0, pending = 0;
  for (const [dx, dz] of order) {
    if (dx * dx + dz * dz > rd * rd + 1) continue;
    const c = w.chunks.get(ckey(pcx + dx, pcz + dz)); if (!c || !c.generated) { pending++; continue; }
    if (c.dirty || !c.mesh) {
      if (!neighborsReady(w, c)) { pending++; continue; }
      if (performance.now() - t0 > meshBudgetMs && meshed > 0) { pending++; continue; }
      applyMesh(c, meshChunk(w, c, settings.smooth)); meshed++;
    }
  }
  return pending;
}
function flushNear(x, z) {
  const w = game.world, cx = x >> 4, cz = z >> 4;
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const c = w.chunks.get(ckey(cx + dx, cz + dz)); if (c && c.generated && c.dirty && neighborsReady(w, c)) applyMesh(c, meshChunk(w, c, settings.smooth));
  }
}
function remeshAll() { if (!game.world) return; for (const c of game.world.chunks.values()) c.dirty = true; }

// ---------------- Világ indítása / betöltése ----------------
function findSpawn(w) {
  let best = null;
  for (let r = 0; r < 260 && !best; r += 6) for (let a = 0; a < 8 + r / 3 && !best; a++) {
    const ang = a / (8 + r / 3) * 6.283, x = Math.floor(Math.cos(ang) * r), z = Math.floor(Math.sin(ang) * r), col = w.column(x, z);
    if (col.h > SEA + 1 && col.h < 84 && col.biome !== 5 && col.biome !== 6 && col.biome !== 4) best = [x + 0.5, col.h + 1, z + 0.5];
  }
  return best || [0.5, 90, 0.5];
}
function setupWorld(seed, dim) {
  if (game.world) disposeWorld();
  game.world = new World(seed); const w = game.world; w.dim = dim && dim !== 'overworld' ? dim : null; game.dim = w.dim || 'overworld';
  game.mobs = new Mobs(scene, w, game); game.drops = new Drops(scene, w, matSolid); game.particles = new Particles(scene); game.arrows = new Arrows(scene, w, game);
  w.onSet = (x, y, z, id) => { if (game.net.active) game.net.queueBlock(x, y, z, id); };
  game.fluids.attach(w); game.rs.attach(w);
  lastPCX = 1e9; order = [];
}
function disposeWorld() {
  const w = game.world; if (!w) return;
  for (const c of [...w.chunks.values()]) releaseChunk(w, c);
  game.mobs && game.mobs.clear(); game.drops && game.drops.clear(); game.arrows && game.arrows.clear(); game.arrows = null;
  for (const t of game.tnts) scene.remove(t.mesh); game.tnts = []; for (const f of game.falling) scene.remove(f.mesh); game.falling = [];
  if (game.particles) { scene.remove(game.particles.pts); game.particles = null; }
  game.world = null;
}
function showScreen(id) { for (const s of document.querySelectorAll('.screen')) s.classList.toggle('hidden', s.id !== id); }

async function startWorld(save, opts) {
  A.initAudio(); A.startMusic();
  game.state = 'loading'; showScreen('loading'); $('hud').classList.add('hidden');
  const seed = save ? save.seed : opts.seed;
  setupWorld(seed, save && save.dim);
  game.dimData = (save && save.dims) || {}; game.dragonDead = !!(save && save.dragonDead); game.achv = new Set((save && save.ach) || []);
  const w = game.world; const isClient = !!(opts && opts.client);
  game.smpMode = !!(opts && opts.smp); game.smp.reset(); game.net.maxPlayers = game.smpMode ? SMP.maxPlayers : 8;
  if (game.smpMode && !isClient && save && save.smp) game.smp.load(save.smp);
  if (opts && opts.ss) { game.dedicated = true; window.__dedicated = true; game.net.maxPlayers = opts.ss.maxPlayers || 10; }
  if (opts && opts.smpInit) game.smp.applySb(opts.smpInit);
  game.mobs.remote = game.drops.remote = isClient; game.mpPlayers = (save && save.players) || {}; game.rules = Object.assign({ keepInventory: false, doDaylightCycle: true, doMobSpawning: true, mobGriefing: true, fallDamage: true, pvp: true }, (save && save.rules) || {});
  game.id = save ? save.id : opts.id; game.name = save ? save.name : opts.name; game.seed = seed;
  game.mode = save ? save.mode : opts.mode; game.difficulty = save ? save.diff : opts.diff; game.dayTime = save ? save.day : 1000;
  player.creative = game.mode === 'creative'; player.flying = false; player.dead = false;
  if (save) {
    w.voidOutside = !!save.imp;
    w.stash = new Map(Object.entries(save.chunks || {}).map(([k, v]) => [+k, World.unrle(v)]));
    for (const [k, v] of save.facing || []) w.facing.set(k, v); for (const [k, v] of save.containers || []) w.containers.set(k, v);
    game.spawn = save.spawn; const p = save.player;
    Object.assign(player, { pos: p.pos.slice(), yaw: p.yaw, pitch: p.pitch, health: p.health, food: p.food, sat: p.sat, xp: p.xp || 0, level: p.level || 0, hot: p.hot || 0, air: 300, vel: [0, 0, 0], fall: 0 });
    inv.load(save.inv); player.armor = [0, 1, 2, 3].map(i => { const a = (save.armor || [])[i]; return a ? { id: a[0], n: 1, d: a[2] || 0, ...(a[3] ? { e: a[3] } : {}) } : null; });
  } else if (opts && opts.import) {
    const im = opts.import; w.voidOutside = true;
    for (const [cx, row] of im.chunks) for (const [cz, arr] of row) w.stash.set(ckey(cx, cz), arr);
    for (const [k, v] of im.facing) w.facing.set(k, v); for (const [k, v] of im.containers) w.containers.set(k, v);
    game.spawn = im.spawn.slice(); Object.assign(player, { pos: game.spawn.slice(), yaw: 0, pitch: 0, health: 20, food: 20, sat: 5, xp: 0, level: 0, hot: 0, air: 300, vel: [0, 0, 0], fall: 0 });
    inv.load([]); player.armor = [null, null, null, null];
  } else {
    game.spawn = findSpawn(w); Object.assign(player, { pos: game.spawn.slice(), yaw: Math.random() * 6.28, pitch: 0, health: 20, food: 20, sat: 5, xp: 0, level: 0, hot: 0, air: 300, vel: [0, 0, 0], fall: 0 });
    inv.load([]); player.armor = [null, null, null, null];
  }
  game.rdActive = settings.rd;
  // kezdeti chunkok
  const need = Math.min(settings.rd, 4); let tries = 0;
  await new Promise(res => {
    const step = () => {
      const pend = streamChunks(w, player.pos[0], player.pos[2], need, 40, 40);
      let total = 0, done = 0; const pcx = Math.floor(player.pos[0] / 16), pcz = Math.floor(player.pos[2] / 16);
      for (let dz = -need; dz <= need; dz++) for (let dx = -need; dx <= need; dx++) { total++; const c = w.chunks.get(ckey(pcx + dx, pcz + dz)); if (c && c.mesh) done++; }
      $('loadfill').style.width = (done / total * 100) + '%'; $('loadtxt').textContent = `Chunkok: ${done}/${total}`;
      if ((pend === 0 && done === total) || ++tries > 600) res(); else raf(step);
    }; step();
  });
  // biztonságos talajra helyezés új világnál
  if (!save) {
    const x = Math.floor(player.pos[0]), z = Math.floor(player.pos[2]); let y = H - 2; while (y > 1 && !SOLID[w.getBlock(x, y, z)] && FK[w.getBlock(x, y, z)] !== 1) y--;
    player.pos[1] = y + 1.01; game.spawn = player.pos.slice();
  } else if (save.mobs && !isClient) game.mobs.load(save.mobs);
  refreshHotbar(); updateBars(true);
  $('hud').classList.remove('hidden'); showScreen(''); game.state = 'play'; game.paused = false; game.ready = true;
  lockPointer(); if (isClient) game.net.attach();
  toast(save ? 'Világ betöltve: ' + game.name : 'Üdv a MinePixelben!');
  if (opts && opts.online) doHost(true);
  else if (opts && opts.ss) ssHostStart(opts.ss);
  else if (opts && opts.smp && !isClient) smpHostStart();
  renderSidebar(game);
}
function playerState() {
  return { player: { pos: player.pos.map(v => +v.toFixed(3)), yaw: player.yaw, pitch: player.pitch, health: player.health, food: player.food, sat: player.sat, xp: player.xp, level: player.level, hot: player.hot },
    inv: inv.serialize(), armor: player.armor.map(a => a ? [a.id, 1, a.d || 0, a.e || 0] : 0) };
}
function serializeWorld() {
  const w = game.world;
  return { v: 1, id: game.id, name: game.name, seed: game.seed, mode: game.mode, diff: game.difficulty, time: Date.now(), day: game.dayTime, spawn: game.spawn,
    ...playerState(), smpWorld: game.smpMode || undefined, smp: game.smpMode ? game.smp.serialize() : undefined, players: game.mpPlayers, rules: game.rules, imp: !!w.voidOutside, dim: game.dim, dims: Object.fromEntries(Object.entries(game.dimData || {}).filter(([k]) => k !== game.dim)), dragonDead: game.dragonDead, ach: [...(game.achv || [])], chunks: w.collectModified(), facing: [...w.facing], containers: [...w.containers], mobs: game.dim === 'overworld' ? game.mobs.serialize() : [] };
}
async function saveGame(silent) { if (!game.world || game.state !== 'play' || game.net.isClient) return; await store.write(game.id, serializeWorld()); if (!silent) toast('Játék mentve'); }
async function quitToTitle() {
  if (game.net.active) { if (game.net.isHost) { await saveGame(true); } game.net.leave(); }
  else await saveGame(true);
  game.smpMode = false; game.smp.reset(); game.plugins.reset(); renderSidebar(game);
  $('chat').innerHTML = ''; $('chat-in').classList.add('hidden'); game.chatOpen = false; ui.close(); game.state = 'menu'; game.ready = false; A.stopMusic(); disposeWorld(); $('hud').classList.add('hidden');
  if (document.pointerLockElement) document.exitPointerLock();
  startMenuWorld(); showScreen('title');
}

// ---------------- Főmenü-háttér ----------------
let menuCamA = 0;
function startMenuWorld() {
  setupWorld(20261107); game.mode = 'survival'; game.dayTime = 3500; menuCamA = 0; player.dead = false; player.creative = true;
  const h = game.world.column(0, 0).h; game.menuY = Math.max(h, SEA) + 14;
}

// ---------------- Bemenet ----------------
const keys = {}; let mouseL = false, mouseR = false, lastSpace = 0, lastW = 0;
function lockPointer() { if (TEST) return; try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch {} }
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === canvas) { $('clickstart').classList.add('hidden'); return; }
  if (game.state === 'play' && !ui.open && !player.dead && !game.paused && !game.expectUnlock && !TEST) openPause();
  game.expectUnlock = false;
});
canvas.addEventListener('click', () => { if (game.state === 'play' && !game.paused && !ui.open && !player.dead) lockPointer(); });
document.addEventListener('mousemove', e => {
  if (document.pointerLockElement !== canvas && !TEST) return;
  if (game.state !== 'play' || game.paused || ui.open || player.dead) return;
  const s = 0.0022 * (settings.sens / 100);
  player.yaw -= e.movementX * s; player.pitch = clamp(player.pitch - e.movementY * s, -1.5533, 1.5533);
});
document.addEventListener('mousedown', e => {
  if (game.state !== 'play' || game.paused || ui.open || player.dead) return;
  if (document.pointerLockElement !== canvas && !TEST) return;
  if (e.button === 0) { mouseL = true; game.swing = 1; } if (e.button === 2) { mouseR = true; useItem(true); } if (e.button === 1) { e.preventDefault(); pickBlock(); }
});
document.addEventListener('mouseup', e => { if (e.button === 0) mouseL = false; if (e.button === 2) { mouseR = false; player.eatT = 0; releaseBow(); } });
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('wheel', e => {
  if (game.state !== 'play' || game.paused || ui.open) return;
  player.hot = (player.hot + (e.deltaY > 0 ? 1 : 8)) % 9; refreshHotbar(); showName();
}, { passive: true });
window.addEventListener('keydown', e => {
  if (game.chatOpen) return;
  keys[e.code] = true;
  if (game.state !== 'play') return;
  if (e.code === 'Tab') { e.preventDefault(); showPlist(true); return; }
  if (e.code === 'F3') { e.preventDefault(); $('debug').classList.toggle('hidden'); return; }
  if (e.code === 'F5') { e.preventDefault(); game.tp = ((game.tp || 0) + 1) % 3; toast(['Első személyű nézet', 'Harmadik személy (hátul)', 'Harmadik személy (elöl)'][game.tp]); return; }
  if (e.code === 'F4') { e.preventDefault(); toggleMode(); return; }
  if (e.code === 'Escape') {
    if (ui.open) { closeUI(); }
    else if (game.paused) resumeGame();
    else if (TEST) openPause();
    return;
  }
  if (game.paused || player.dead) return;
  if ((e.code === 'KeyT' || e.code === 'Enter') && !ui.open) { e.preventDefault(); openChat(); return; }
  if ((e.code === 'Slash' || e.key === '/') && !ui.open) { e.preventDefault(); openChat('/'); return; }
  if (e.code === 'KeyB' && game.smpMode && !ui.open) { e.preventDefault(); openShop(); return; }
  if (e.code === 'KeyE') { e.preventDefault(); if (ui.open) closeUI(); else openUI(player.creative ? 'creative' : 'inventory'); return; }
  if (ui.open) return;
  if (e.code.startsWith('Digit')) { const n = +e.code.slice(5) - 1; if (n >= 0 && n < 9) { player.hot = n; refreshHotbar(); showName(); } }
  if (e.code === 'KeyQ') { const s = inv.slots[player.hot]; if (s) { const n = e.ctrlKey ? s.n : 1; game.dropItem(s.id, n, player.pos[0], player.pos[1] + 1.4, player.pos[2], true); inv.take(player.hot, n); refreshHotbar(); } }
  if (e.code === 'Space') {
    const t = performance.now(); if (player.creative && t - lastSpace < 300) { player.flying = !player.flying; player.vel[1] = 0; } lastSpace = t;
  }
  if (e.code === 'KeyW' && !e.repeat) { const t = performance.now(); if (t - lastW < 280) player.sprint = true; lastW = t; }
  if (e.code === 'ControlLeft' || e.code === 'ControlRight') { if (keys.KeyW) player.sprint = true; }
});
window.addEventListener('keyup', e => { keys[e.code] = false; if (e.code === 'Tab') showPlist(false); if (e.code === 'KeyW') player.sprint = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouseL = mouseR = false; });
function openUI(mode, ctx) { game.expectUnlock = true; if (document.pointerLockElement) document.exitPointerLock(); ui.show(mode, ctx); mouseL = mouseR = false; }
function closeUI() { if (game.net.active && ui.ctx) game.net.sendContainer(ui.ctx); ui.close(); refreshHotbar(); lockPointer(); }
function toggleMode() { if (game.smpMode && !game.smp.amAdmin()) { toast('Kreatív mód csak az adminnak van.'); return; } player.creative = !player.creative; game.mode = player.creative ? 'creative' : 'survival'; if (!player.creative) player.flying = false; toast('Játékmód: ' + (player.creative ? 'Kreatív' : 'Túlélő')); updateBars(true); }
function openPause() { game.paused = true; $('pause-shop').classList.toggle('hidden', !game.smpMode); document.querySelector('[data-act=invite]').classList.toggle('hidden', game.smpMode); showScreen('pause'); mouseL = mouseR = false; }
function resumeGame() { game.paused = false; showScreen(''); lockPointer(); }

// ---------------- Blokkok kezelése ----------------
function checkSupport(x, y, z) {
  const w = game.world, id = w.getBlock(x, y, z); if (!id) return;
  const b = BLOCKS[id];
  if (b.crop && w.getBlock(x, y - 1, z) !== B.FARMLAND) return breakBlock(x, y, z, true, false);
  if (id === B.SAPLING) { const d = w.getBlock(x, y - 1, z); if (d !== B.GRASS && d !== B.DIRT && d !== B.FARMLAND) return breakBlock(x, y, z, true, false); }
  if (id === B.FARMLAND) { const up = w.getBlock(x, y + 1, z); if (SOLID[up]) { w.setBlock(x, y, z, B.DIRT); return; } }
  if (b.shape === 'cross' && !SOLID[w.getBlock(x, y - 1, z)]) return breakBlock(x, y, z, true, false);
  if (b.shape === 'torch') { if (!(SOLID[w.getBlock(x, y - 1, z)] || SOLID[w.getBlock(x + 1, y, z)] || SOLID[w.getBlock(x - 1, y, z)] || SOLID[w.getBlock(x, y, z + 1)] || SOLID[w.getBlock(x, y, z - 1)])) return breakBlock(x, y, z, true, false); }
  if (id === B.CACTUS) { const d = w.getBlock(x, y - 1, z); if (d !== B.SAND && d !== B.CACTUS) return breakBlock(x, y, z, true, false); }
  if (DOOR_HALVES.has(id)) { if (isDoorTop(id)) { if (!DOOR_HALVES.has(w.getBlock(x, y - 1, z))) return breakBlock(x, y, z, false, false); } else if (!SOLID[w.getBlock(x, y - 1, z)]) return breakBlock(x, y, z, true, false); }
  if (id === B.LEVER || id === B.LEVER_ON || id === B.BUTTON || id === B.BUTTON_ON) { const f = w.facing.get(x + ',' + y + ',' + z), a = ATTACH_DIR[f === undefined ? 3 : f]; if (!SOLID[w.getBlock(x + a[0], y + a[1], z + a[2])]) return breakBlock(x, y, z, true, false); }
  if (id === B.PLATE || id === B.PLATE_ON || isDust(id) || b.rsTorch) { if (!SOLID[w.getBlock(x, y - 1, z)]) return breakBlock(x, y, z, true, false); }
  if (id === B.LADDER) { const f = w.facing.get(x + ',' + y + ',' + z), dd = LADDER_DIR[f === undefined ? 5 : f]; if (!SOLID[w.getBlock(x + dd[0], y, z + dd[1])]) return breakBlock(x, y, z, true, false); }
  if (b.gravity) { const d = w.getBlock(x, y - 1, z); if (!SOLID[d] && y > 0) startFall(x, y, z, id); }
}
function updateNeighbors(x, y, z) { for (const [dx, dy, dz] of [[0, 1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, -1, 0], [0, 0, 0]]) checkSupport(x + dx, y + dy, z + dz); }
function startFall(x, y, z, id) {
  const w = game.world; w.setBlock(x, y, z, B.AIR);
  const m = blockModel(id), g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(m.pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(m.uv, 2)); g.setAttribute('aux', new THREE.BufferAttribute(m.aux, 3)); g.setAttribute('tint', new THREE.BufferAttribute(m.tint, 3)); g.setIndex(new THREE.BufferAttribute(m.idx, 1));
  const mesh = new THREE.Mesh(g, matSolid); mesh.scale.setScalar(0.98); scene.add(mesh);
  game.falling.push({ id, x, z, y, vy: 0, mesh });
  updateNeighbors(x, y, z);
}
function updateFalling(dt) {
  const w = game.world;
  for (let i = game.falling.length - 1; i >= 0; i--) {
    const f = game.falling[i]; f.vy -= 28 * dt; f.y += f.vy * dt;
    const by = Math.floor(f.y - 0.001), below = w.getBlock(f.x, by, f.z);
    if (!w.isLoaded(f.x, f.z)) { f.y += 0; }
    if (SOLID[below] || f.y < 0) {
      const ty = Math.max(0, by + 1), cur = w.getBlock(f.x, ty, f.z);
      if (!cur || BLOCKS[cur].replace || (BLOCKS[cur].shape === 'cross')) { w.setBlock(f.x, ty, f.z, f.id); flushNear(f.x, f.z); A.sndPlace('sand'); updateNeighbors(f.x, ty, f.z); }
      else game.dropItem(f.id, 1, f.x + 0.5, f.y + 0.5, f.z + 0.5);
      scene.remove(f.mesh); f.mesh.geometry.dispose(); game.falling.splice(i, 1); continue;
    }
    f.mesh.position.set(f.x + 0.5, f.y + 0.5, f.z + 0.5);
  }
}
function breakBlock(x, y, z, drop = true, effects = true, tool = 0) {
  const w = game.world, id = w.getBlock(x, y, z); if (!id) return;
  const b = BLOCKS[id];
  w.setBlock(x, y, z, B.AIR);
  if (DOOR_HALVES.has(id)) { const oy = isDoorTop(id) ? y - 1 : y + 1; if (DOOR_HALVES.has(w.getBlock(x, oy, z))) { w.setBlock(x, oy, z, B.AIR); w.facing.delete(x + ',' + oy + ',' + z); } }
  const key = x + ',' + y + ',' + z;
  if (w.containers.has(key)) { const c = w.containers.get(key); for (const s of c.slots) if (s) game.dropItem(s.id, s.n, x + 0.5, y + 0.5, z + 0.5); w.containers.delete(key); }
  w.facing.delete(key);
  if (id === B.OBSIDIAN) removePortalsNear(x, y, z);
  if (drop && id === B.MILKER_B) game.dropItem(I.BUCKET, 1, x + 0.5, y + 0.8, z + 0.5);
  if (drop && id === B.MILKER_M) game.dropItem(I.MILK_BUCKET, 1, x + 0.5, y + 0.8, z + 0.5);
  if (id >= B.NEST_C && id <= B.NEST_E && !game.net.isClient) { game.mobs.spawn('chicken', x + 0.5, y + 0.2, z + 0.5); if (id === B.NEST_E) game.dropItem(I.EGG, 1, x + 0.5, y + 0.5, z + 0.5); }
  if (effects) { game.particles.block(x, y, z, id); A.sndBreak(b.snd); }
  if (drop && !player.creative) for (const [did, n] of blockDrops(b, tool)) game.dropItem(did, n, x + 0.5, y + 0.4, z + 0.5);
  if (!player.creative && drop) { if ([B.LAPIS_ORE, B.D_LAPIS].includes(id)) addXP(3); else if ([B.REDSTONE_ORE, B.D_REDSTONE].includes(id)) addXP(2); else if ([B.COPPER_ORE, B.D_COPPER].includes(id)) addXP(1); else if (id === B.EMERALD_ORE) addXP(5); else if ([B.COAL_ORE, B.D_COAL].includes(id)) addXP(2); else if ([B.IRON_ORE, B.GOLD_ORE, B.D_IRON, B.D_GOLD].includes(id)) addXP(1); else if ([B.DIAMOND_ORE, B.D_DIAMOND].includes(id)) addXP(5); }
  updateNeighbors(x, y, z);
}
function wearTool(slotIdx, amt) {
  const s = inv.slots[slotIdx]; if (!s || !maxDur(s.id)) return;
  if (s.e && s.e.u && Math.random() < s.e.u / (s.e.u + 1)) return;
  s.d = (s.d || 0) + amt;
  if (s.d >= maxDur(s.id)) { inv.slots[slotIdx] = null; A.sndBreak('stone'); toast('Az eszköz eltört'); }
  refreshHotbar();
}
function eyePos() { const e = player.sneak ? 1.5 : 1.62; return [player.pos[0], player.pos[1] + e, player.pos[2]]; }
function lookDir() { const cp = Math.cos(player.pitch); return [-Math.sin(player.yaw) * cp, Math.sin(player.pitch), -Math.cos(player.yaw) * cp]; }
let target = null, mobTarget = null, pvpTarget = null;
function updateTarget() {
  if (!game.world || player.dead) { target = null; mobTarget = null; pvpTarget = null; return; }
  const [ex, ey, ez] = eyePos(), [dx, dy, dz] = lookDir(), reach = player.creative ? 5.5 : 4.5;
  target = raycast(game.world, ex, ey, ez, dx, dy, dz, reach);
  mobTarget = game.mobs.raycast(ex, ey, ez, dx, dy, dz, reach);
  if (mobTarget && target && target.dist < mobTarget.dist) mobTarget = null;
  pvpTarget = null;
  if (game.net.active && game.rules.pvp !== false && !player.creative) {
    let best = Infinity;
    for (const r of game.net.remotes.values()) {
      if (!r.pos || r.dead || r.creative) continue;
      const t = rayAABB(ex, ey, ez, dx, dy, dz, r.pos[0] - 0.3, r.pos[1], r.pos[2] - 0.3, r.pos[0] + 0.3, r.pos[1] + (r.sneak ? 1.5 : 1.8), r.pos[2] + 0.3);
      if (t >= 0 && t <= reach && t < best && (!target || t < target.dist) && (!mobTarget || t < mobTarget.dist)) { best = t; pvpTarget = { r, dist: t }; }
    }
    if (pvpTarget) { mobTarget = null; target = null; }
  }
  if (mobTarget) target = null;
}
function facingFromYaw() { const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw); if (Math.abs(fx) > Math.abs(fz)) return fx > 0 ? 1 : 0; return fz > 0 ? 5 : 4; }
function intersectsPlayer(x, y, z) { const hw = 0.3, h = player.sneak ? 1.5 : 1.8; return player.pos[0] + hw > x && player.pos[0] - hw < x + 1 && player.pos[1] + h > y && player.pos[1] < y + 1 && player.pos[2] + hw > z && player.pos[2] - hw < z + 1; }
function pickBlock() {
  if (!player.creative || !target) return;
  let id = target.id; const b = BLOCKS[id]; id = b.id;
  if (DOOR_HALVES.has(id)) id = B.DOOR; else if (GATES.has(id)) id = B.FENCE_GATE; else if (TRAPDOORS.has(id)) id = B.TRAPDOOR;
  for (let i = 0; i < 9; i++) if (inv.slots[i] && inv.slots[i].id === id) { player.hot = i; refreshHotbar(); return; }
  inv.slots[player.hot] = { id, n: 64, d: 0 }; refreshHotbar(); showName();
}
const ACH = { sit: 'Leültél egy székre', milk: 'Tehénfejés', egg: 'Friss tojás a fészekből', nether: 'Pokoli utazás (Nether)', end: 'A Vég', dragon: 'Sárkányölő', ench: 'Varázslónövendék', potion: 'Gyógyszerész', trade: 'Kereskedő', boat: 'Vízi kalandor', repair: 'Kovács' };
function ach(k) { game.achv = game.achv || new Set(); if (game.achv.has(k) || !ACH[k]) return; game.achv.add(k); toast('🏆 Teljesítmény: ' + ACH[k] + ' (' + game.achv.size + '/' + Object.keys(ACH).length + ')'); }
game.ach = ach;
function sitOn(x, y, z) {
  ach('sit');
  if (player.sit) return;
  const f = game.world.facing.get(x + ',' + y + ',' + z);
  player.sit = { x, y, z }; player.pos = [x + 0.5, y + 0.45, z + 0.5]; player.vel = [0, 0, 0];
  if (f !== undefined) player.yaw = { 5: 0, 4: Math.PI, 1: -Math.PI / 2, 0: Math.PI / 2 }[f] ?? player.yaw;
  toast('Leültél (Space / Shift: felállás)'); A.sndPlace('wood');
}
function standUp() { if (!player.sit) return; const s = player.sit; player.sit = null; player.pos = [s.x + 0.5, s.y + 1.0, s.z + 0.5]; player.vel = [0, 0, 0]; }
function cowOnMilker(m) { const id = game.world.getBlock(Math.floor(m.pos[0]), Math.floor(m.pos[1] - 0.1), Math.floor(m.pos[2])); return id >= B.MILKER && id <= B.MILKER_M ? { x: Math.floor(m.pos[0]), y: Math.floor(m.pos[1] - 0.1), z: Math.floor(m.pos[2]), id } : null; }
function nestUse(t, held) {
  const w = game.world;
  if (t.id === B.NEST_E) { ach('egg'); w.setBlock(t.x, t.y, t.z, B.NEST_C); game.dropItem(I.EGG, 1 + (Math.random() < 0.25 ? 1 : 0), t.x + 0.5, t.y + 0.5, t.z + 0.5); A.sndPlace('wood'); game.swing = 1; flushNear(t.x, t.z); return true; }
  if (t.id === B.NEST_C && held && (held.id === I.SEEDS || held.id === I.WHEAT)) { w.setBlock(t.x, t.y, t.z, B.NEST_F); if (!player.creative) { inv.take(player.hot, 1); refreshHotbar(); } A.sndPlace('wood'); game.swing = 1; toast('A csirke megette – holnapra tojás lesz'); flushNear(t.x, t.z); return true; }
  if (t.id === B.NEST_C) { toast('Etesd meg búzamaggal – holnapra tojás lesz'); return true; }
  if (t.id === B.NEST_F) { toast('Jóllakott, holnapra tojik'); return true; }
  return false;
}
function milkerUse(t, held) {
  const w = game.world;
  if (t.id === B.MILKER && held && held.id === I.BUCKET) { w.setBlock(t.x, t.y, t.z, B.MILKER_B); if (!player.creative) { inv.take(player.hot, 1); refreshHotbar(); } A.sndPlace('stone'); game.swing = 1; flushNear(t.x, t.z); return true; }
  if (t.id === B.MILKER_M) { w.setBlock(t.x, t.y, t.z, B.MILKER); game.dropItem(I.MILK_BUCKET, 1, t.x + 0.5, t.y + 1.1, t.z + 0.5); A.sndPlace('stone'); game.swing = 1; flushNear(t.x, t.z); return true; }
  if (t.id === B.MILKER_B) { toast('Vezess egy tehenet az állványra (búzával), majd fejd meg'); return true; }
  if (t.id === B.MILKER) { toast('Tegyél alá vödröt'); return true; }
  return false;
}
const VBUY = [[I.WHEAT, 20, 1], [I.COAL, 15, 1], [I.IRON_INGOT, 4, 1], [I.RAW_BEEF, 10, 1], [I.STEAK, 6, 1], [I.GOLD_INGOT, 3, 1], [I.LEATHER, 8, 1]];
const VSELL = [[I.BREAD, 6, 1], [I.IRON_INGOT, 1, 3], [I.ARROW, 16, 1], [I.COOKED_PORK, 5, 1], [B.GLOWSTONE, 3, 2], [I.LAPIS, 3, 1], [I.BOTTLE, 3, 1], [I.DIAMOND, 1, 12]];
function tradeVillager(m) {
  ach('trade');
  const held = inv.slots[player.hot], em = I.EMERALD;
  if (held) { const b = VBUY.find(t => t[0] === held.id && held.n >= t[1]); if (b) { inv.take(player.hot, b[1]); const r = inv.add(em, b[2]); if (r > 0) game.dropItem(em, r, player.pos[0], player.pos[1] + 1, player.pos[2]); refreshHotbar(); A.sndLevel(); toast(`Eladtál ${b[1]} ${itemDef(b[0]).name} → ${b[2]} smaragd`); return true; } }
  if (held && held.id === em) {
    m.tradeIdx = ((m.tradeIdx || 0) + 1) % VSELL.length; const o = VSELL[m.tradeIdx];
    if (held.n < o[2]) { toast(`Ajánlat: ${o[1]} ${itemDef(o[0]).name} = ${o[2]} smaragd (kevés smaragd)`); return true; }
    inv.take(player.hot, o[2]); const r = inv.add(o[0], o[1]); if (r > 0) game.dropItem(o[0], r, player.pos[0], player.pos[1] + 1, player.pos[2]); refreshHotbar(); A.sndLevel(); toast(`Vettél ${o[1]} ${itemDef(o[0]).name} (${o[2]} smaragd)`); return true;
  }
  toast('Falusi: smaragdért cserélek (búza, szén, vas, hús…) – tarts smaragdot a vásárláshoz'); return true;
}
function milkCow(m) {
  const st = cowOnMilker(m);
  if (m.milkT > 0) { toast('A tehén most nem ad tejet (várj egy kicsit)'); return true; }
  if (st && st.id === B.MILKER_B) {
    if (game.net.isClient) game.net.send({ t: 'milk', id: m.id });
    ach('milk'); m.milkT = 60; game.world.setBlock(st.x, st.y, st.z, B.MILKER_M); A.sndHit('cloth'); game.swing = 1; flushNear(st.x, st.z); toast('Megfejted a tehenet'); return true;
  }
  const held = inv.slots[player.hot];
  if (held && held.id === I.BUCKET) {
    if (game.net.isClient) game.net.send({ t: 'milk', id: m.id });
    m.milkT = 60; inv.take(player.hot, 1); const r = inv.add(I.MILK_BUCKET, 1); if (r > 0) game.dropItem(I.MILK_BUCKET, 1, player.pos[0], player.pos[1] + 1, player.pos[2]); refreshHotbar(); A.sndHit('cloth'); game.swing = 1; return true;
  }
  return false;
}
game.newDay = function () {
  if (game.net.isClient) return;
  const w = game.world; let n = 0;
  for (const c of w.chunks.values()) {
    if (!c.generated || !c.blocks) continue;
    const bl = c.blocks;
    for (let i = 0; i < bl.length; i++) if (bl[i] === B.NEST_F) { const x = (c.cx << 4) + (i & 15), z = (c.cz << 4) + ((i >> 4) & 15), y = i >> 8; w.setBlock(x, y, z, B.NEST_E); n++; }
  }
  return n;
};

// ---------------- Dimenziók: Nether / End ----------------
const air0 = (w, x, y, z) => w.getBlock(x, y, z) === 0;
function tryLightPortal(x, y, z) {
  const w = game.world;
  for (const ax of [0, 1]) {
    const ux = ax === 0 ? 1 : 0, uz = ax === 0 ? 0 : 1;
    let by = y, k = 0; while (air0(w, x, by - 1, z) && k++ < 22) by--;
    if (w.getBlock(x, by - 1, z) !== B.OBSIDIAN) continue;
    let lx = x, lz = z; k = 0; while (air0(w, lx - ux, by, lz - uz) && k++ < 22) { lx -= ux; lz -= uz; }
    if (w.getBlock(lx - ux, by, lz - uz) !== B.OBSIDIAN) continue;
    let wd = 0; while (air0(w, lx + ux * wd, by, lz + uz * wd) && wd < 23) wd++;
    if (wd < 2 || wd > 21 || w.getBlock(lx + ux * wd, by, lz + uz * wd) !== B.OBSIDIAN) continue;
    let ht = 0; while (air0(w, lx, by + ht, lz) && ht < 23) ht++;
    if (ht < 3 || ht > 21 || w.getBlock(lx, by + ht, lz) !== B.OBSIDIAN) continue;
    let ok = true;
    for (let i = 0; i < wd && ok; i++) if (w.getBlock(lx + ux * i, by - 1, lz + uz * i) !== B.OBSIDIAN || w.getBlock(lx + ux * i, by + ht, lz + uz * i) !== B.OBSIDIAN) ok = false;
    for (let j = 0; j < ht && ok; j++) if (w.getBlock(lx - ux, by + j, lz - uz) !== B.OBSIDIAN || w.getBlock(lx + ux * wd, by + j, lz + uz * wd) !== B.OBSIDIAN) ok = false;
    for (let i = 0; i < wd && ok; i++) for (let j = 0; j < ht; j++) if (!air0(w, lx + ux * i, by + j, lz + uz * i)) { ok = false; break; }
    if (!ok) continue;
    for (let i = 0; i < wd; i++) for (let j = 0; j < ht; j++) { const px = lx + ux * i, py = by + j, pz = lz + uz * i; w.facing.set(px + ',' + py + ',' + pz, ax === 0 ? 4 : 0); w.setBlock(px, py, pz, B.NETHER_PORTAL); }
    flushNear(lx, lz); A.sndPlace('glass'); return true;
  }
  return false;
}
function removePortalsNear(x, y, z) {
  const w = game.world, st = [[x, y, z]], seen = new Set();
  while (st.length) {
    const [cx, cy, cz] = st.pop();
    for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
      const a = cx + dx, b = cy + dy, c = cz + dz, k = a + ',' + b + ',' + c;
      if (seen.has(k) || w.getBlock(a, b, c) !== B.NETHER_PORTAL) continue; seen.add(k); w.facing.delete(k); w.setBlock(a, b, c, 0); st.push([a, b, c]);
    }
  }
}
function buildPortalAt(bx, by, bz) {
  const w = game.world;
  for (let x = bx - 1; x <= bx + 2; x++) for (let z = bz - 1; z <= bz + 2; z++) { w.setBlock(x, by - 1, z, B.OBSIDIAN); for (let y = by; y <= by + 4; y++) w.setBlock(x, y, z, 0); }
  for (let i = -1; i <= 2; i++) { w.setBlock(bx + i, by - 1, bz, B.OBSIDIAN); w.setBlock(bx + i, by + 3, bz, B.OBSIDIAN); }
  for (let j = 0; j < 3; j++) { w.setBlock(bx - 1, by + j, bz, B.OBSIDIAN); w.setBlock(bx + 2, by + j, bz, B.OBSIDIAN); }
  for (let i = 0; i < 2; i++) for (let j = 0; j < 3; j++) { w.facing.set((bx + i) + ',' + (by + j) + ',' + bz, 4); w.setBlock(bx + i, by + j, bz, B.NETHER_PORTAL); }
}
function arrivePortal(tx, tz) {
  const w = game.world; let best = null, bd = 1e9;
  for (let x = tx - 24; x <= tx + 24; x++) for (let z = tz - 24; z <= tz + 24; z++) for (let y = 2; y < 126; y++) if (w.getBlock(x, y, z) === B.NETHER_PORTAL) { const d = (x - tx) ** 2 + (z - tz) ** 2 + (y - 64) ** 2 * 0.01; if (d < bd) { bd = d; best = [x, y, z]; } }
  if (best) {
    let [x, y] = best; const z = best[2];
    while (w.getBlock(x, y - 1, z) === B.NETHER_PORTAL) y--;
    const fc = w.facing.get(x + ',' + y + ',' + z);
    for (const [dx, dz] of (fc === 0 || fc === 1) ? [[2, 0], [-2, 0], [0, 0]] : [[0, 2], [0, -2], [0, 0]]) {
      if (SOLID[w.getBlock(x + dx, y - 1, z + dz)] && !SOLID[w.getBlock(x + dx, y, z + dz)] && !SOLID[w.getBlock(x + dx, y + 1, z + dz)]) return [x + dx + 0.5, y, z + dz + 0.5];
    }
    return [x + 0.5, y, z + 0.5];
  }
  let by = -1;
  if (game.dim === 'nether') { for (let y = 100; y > 33; y--) if (SOLID[w.getBlock(tx, y - 1, tz)] && w.getBlock(tx, y, tz) === 0 && w.getBlock(tx, y + 1, tz) === 0) { by = y; break; } if (by < 0) by = 66; }
  else { for (let y = H - 2; y > 1; y--) if (SOLID[w.getBlock(tx, y, tz)] || FK[w.getBlock(tx, y, tz)] === 1) { by = y + 1; break; } if (by < 0) by = 70; if (FK[w.getBlock(tx, by - 1, tz)] === 1) by++; }
  buildPortalAt(tx, by, tz);
  return [tx + 0.5, by, tz + 2.5];
}
function endArrive() { const w = game.world; for (let y = 90; y > 30; y--) if (SOLID[w.getBlock(0, y, 38)]) return [0.5, y + 1, 38.5]; return [0.5, 66, 38.5]; }
function spawnDragon() {
  if (game.dragonDead || game.net.isClient || game.mobs.list.some(m => m.kind === 'dragon')) return;
  const m = game.mobs.spawn('dragon', 0, 85, 0); m.hp = m.d.hp; toast('Az Ender sárkány felébredt!');
}
game.dragonDefeated = function () {
  game.dragonDead = true; ach('dragon'); const w = game.world;
  for (let z = -2; z <= 2; z++) for (let x = -2; x <= 2; x++) { for (let y = 60; y <= 66; y++) w.setBlock(x, y, z, 0); w.setBlock(x, 62, z, B.BEDROCK); if (Math.abs(x) < 2 && Math.abs(z) < 2) w.setBlock(x, 63, z, B.END_PORTAL); else w.setBlock(x, 63, z, B.BEDROCK); }
  for (let y = 64; y <= 67; y++) w.setBlock(0, y, 0, B.BEDROCK);
  if (!game.net.isClient) { addXP(500); game.net.active && game.net.bcast({ t: 'xp', n: 500 }); }
  toast('Legyőzted az Ender sárkányt! A kijárat portálba lépve hazatérhetsz.');
};
async function travel(dim, opt = {}) {
  if (game.traveling || game.dim === dim) return; game.traveling = true;
  const w = game.world, from = game.dim; game.dimData = game.dimData || {};
  game.dimData[from] = { chunks: w.collectModified(), facing: [...w.facing], containers: [...w.containers] };
  const isClient = game.net.isClient, px = player.pos[0], pz = player.pos[2]; let tx, tz;
  if (opt.pos) { tx = opt.pos[0]; tz = opt.pos[1]; } else if (dim === 'nether') { tx = Math.floor(px / 8); tz = Math.floor(pz / 8); } else if (from === 'nether') { tx = Math.floor(px * 8); tz = Math.floor(pz * 8); } else if (dim === 'end') { tx = 0; tz = 38; } else { tx = Math.floor(game.spawn[0]); tz = Math.floor(game.spawn[2]); }
  if (!isClient && game.net.active) game.net.bcast({ t: 'dim', d: dim, pos: [tx, tz] });
  const hudWas = !$('hud').classList.contains('hidden'); game.state = 'loading'; showScreen('loading'); ui.close();
  setupWorld(game.seed, dim); game.mobs.remote = game.drops.remote = isClient; const w2 = game.world;
  const dd = game.dimData[dim]; if (dd) { w2.stash = new Map(Object.entries(dd.chunks || {}).map(([k, v]) => [+k, World.unrle(v)])); for (const [k, v] of dd.facing || []) w2.facing.set(k, v); for (const [k, v] of dd.containers || []) w2.containers.set(k, v); }
  player.pos = [tx + 0.5, dim === 'overworld' ? 100 : 70, tz + 0.5]; player.vel = [0, 0, 0]; player.fall = 0; player.sit = null; player.flying = false;
  const need = 2; let tries = 0;
  await new Promise(res => { const step = () => { const pend = streamChunks(w2, player.pos[0], player.pos[2], need, 40, 40); let total = 0, done = 0; const pcx = Math.floor(player.pos[0] / 16), pcz = Math.floor(player.pos[2] / 16);
    for (let dz = -need; dz <= need; dz++) for (let dx = -need; dx <= need; dx++) { total++; const c = w2.chunks.get(ckey(pcx + dx, pcz + dz)); if (c && c.mesh) done++; }
    $('loadfill').style.width = (done / total * 100) + '%'; $('loadtxt').textContent = 'Dimenzióváltás…'; if ((pend === 0 && done === total) || ++tries > 600) res(); else raf(step); }; step(); });
  if (!isClient) {
    let pos;
    if (dim === 'end') { pos = endArrive(); } else if (opt.respawn) { pos = game.spawn.slice(); } else pos = arrivePortal(tx, tz);
    player.pos = pos.slice(); player.portalWait = true; player.portalT = 0;
    if (dim === 'end') spawnDragon();
    if (game.net.active) for (const r of game.net.remotes.values()) game.net.sendTo(r.cid, { t: 'tp', x: pos[0] + 1, y: pos[1], z: pos[2] });
  } else { let y = 120; while (y > 2 && !SOLID[w2.getBlock(Math.floor(tx), y, Math.floor(tz))]) y--; player.pos = [tx + 0.5, y + 1.2, tz + 0.5]; }
  if (dim === 'nether') ach('nether'); if (dim === 'end') ach('end'); game.dim = dim; showScreen(''); game.state = 'play'; void hudWas; game.paused = false; game.traveling = false;
  toast(dim === 'nether' ? 'Beléptél a Netherbe' : dim === 'end' ? 'Beléptél a Végbe' : 'Visszatértél a Felvilágba'); lockPointer();
}
game.travel = travel; game.tryLightPortal = tryLightPortal; game.frameEye = frameEye;
function reqTravel(dim, opt) { if (game.net.isClient) { game.net.send({ t: 'dimreq', d: dim }); player.portalWait = true; player.portalT = 0; } else travel(dim, opt); }
function updatePortal(dt, feetB, chestB) {
  const p = player, inN = feetB === B.NETHER_PORTAL || chestB === B.NETHER_PORTAL, inE = feetB === B.END_PORTAL;
  if (!inN && !inE) { p.portalWait = false; p.portalT = Math.max(0, (p.portalT || 0) - dt * 2); return; }
  if (p.portalWait || game.traveling) return;
  p.portalT = (p.portalT || 0) + dt;
  if (p.portalT >= (inE ? 0.8 : p.creative ? 0.3 : 3)) { p.portalT = 0; reqTravel(inE ? (game.dim === 'end' ? 'overworld' : 'end') : (game.dim === 'overworld' ? 'nether' : 'overworld'), inE ? { respawn: true } : undefined); }
}
function frameEye(t, held) {
  const w = game.world;
  if (t.id === B.END_FRAME && held && held.id === I.EYE_OF_ENDER) {
    w.setBlock(t.x, t.y, t.z, B.END_FRAME_EYE); if (!player.creative) { inv.take(player.hot, 1); refreshHotbar(); } A.sndPlace('stone'); game.swing = 1;
    for (let cx = t.x - 4; cx <= t.x + 4; cx++) for (let cz = t.z - 4; cz <= t.z + 4; cz++) {
      let ok = true;
      for (let k = -1; k <= 1 && ok; k++) if (w.getBlock(cx + k, t.y, cz - 2) !== B.END_FRAME_EYE || w.getBlock(cx + k, t.y, cz + 2) !== B.END_FRAME_EYE || w.getBlock(cx - 2, t.y, cz + k) !== B.END_FRAME_EYE || w.getBlock(cx + 2, t.y, cz + k) !== B.END_FRAME_EYE) ok = false;
      if (ok) { for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) w.setBlock(cx + a, t.y, cz + b, B.END_PORTAL); toast('A Vég portál megnyílt!'); break; }
    }
    flushNear(t.x, t.z); return true;
  }
  if (t.id === B.END_FRAME) { toast('Tegyél bele egy Vég szemét'); return true; }
  return t.id === B.END_FRAME_EYE;
}
function eyeHint() {
  const [sx, , sz] = strongholdPos(game.seed), dx = sx - player.pos[0], dz = sz - player.pos[2], d = Math.round(Math.hypot(dx, dz));
  const ang = Math.atan2(dx, -dz), dirs = ['észak', 'északkelet', 'kelet', 'délkelet', 'dél', 'délnyugat', 'nyugat', 'északnyugat'], di = dirs[((Math.round(ang / (Math.PI / 4)) % 8) + 8) % 8];
  toast(game.dim !== 'overworld' ? 'A Vég szeme csak a Felvilágban működik' : `A Vég szeme ${di} felé mutat (~${d} blokk). A portálszoba a föld alatt van (Y≈26).`);
}

function enchantUse(held) {
  if (!held) { toast('Tarts egy eszközt vagy páncélt a kezedben'); return true; }
  const ti = toolInfo(held.id), ar = ARMOR[held.id]; if (!ti && !ar) { toast('Ezt nem lehet varázsolni'); return true; }
  const lap = inv.count(I.LAPIS); if (!player.creative && (player.level < 3 || lap < 3)) { toast('Kell: 3 szint és 3 lazurit'); return true; }
  if (!player.creative) { player.level -= 3; let n = 3; for (let i = 0; i < 36 && n > 0; i++) { const s = inv.slots[i]; if (s && s.id === I.LAPIS) { const t = Math.min(n, s.n); inv.take(i, t); n -= t; } } }
  const main = ar ? 'p' : ti.type === 'sword' ? 's' : 'f', e = {}; e[main] = 1 + ((Math.random() * 3) | 0); if (Math.random() < 0.45) e.u = 1 + ((Math.random() * 2) | 0);
  ach('ench'); held.e = e; refreshHotbar(); updateBars(true); showName(); toast('Megvarázsolva:' + enchText(held)); A.sndLevel(); game.swing = 1; return true;
}
function anvilUse(held) {
  if (!held || !(held.d > 0) || !maxDur(held.id)) { toast('Tarts egy sérült eszközt a kezedben'); return true; }
  const mi = (held.id - 280) % 5, ing = ARMOR[held.id] ? [I.IRON_INGOT] : (held.id >= 280 && held.id < 305 ? [[...[B.PLANKS, B.BIRCH_PLANKS, B.SPRUCE_PLANKS]], [B.COBBLE], [I.IRON_INGOT], [I.GOLD_INGOT], [I.DIAMOND]][mi] : null);
  if (!ing) return true;
  let slot = -1; for (let i = 0; i < 36; i++) { const s = inv.slots[i]; if (s && ing.includes(s.id)) { slot = i; break; } }
  if (slot < 0) { toast('Kell hozzá a megfelelő nyersanyag (pl. vasrúd vashoz)'); return true; }
  if (!player.creative && player.level < 1) { toast('Kell 1 szint'); return true; }
  ach('repair'); if (!player.creative) player.level--; inv.take(slot, 1); held.d = Math.max(0, held.d - Math.ceil(maxDur(held.id) * 0.3)); refreshHotbar(); updateBars(true); A.sndPlace('stone'); toast('Megjavítva'); return true;
}
function useItem(press) {
  if (!game.world) return;
  const held = inv.slots[player.hot], w = game.world;
  if (press && target && game.smpMode && held && (isBlockItem(held.id) || [I.WATER_BUCKET, I.LAVA_BUCKET, I.BUCKET, I.FLINT_STEEL].includes(held.id)) && game.smp.blocked(target.x, target.z) && !(DOOR_HALVES.has(target.id) || GATES.has(target.id) || TRAPDOORS.has(target.id) || isLeverOrButton(target.id) || target.id === B.CHEST)) { if (game.time - (game.protT || -9) > 2) { game.protT = game.time; toast('A spawn környéke védett.'); } return; }
  if (press && mobTarget && mobTarget.mob.kind === 'boat') { if (player.ride) { player.ride = null; } else { ach('boat'); player.ride = mobTarget.mob; toast('Csónakban ülsz (WASD: evezés, Shift: kiszállás, ütés: felszed)'); } return; }
  if (press && mobTarget && mobTarget.mob.kind === 'villager') { tradeVillager(mobTarget.mob); return; }
  if (press && mobTarget && mobTarget.mob.kind === 'cow' && !player.sneak && milkCow(mobTarget.mob)) return;
  if (press && target && !player.sneak) {
    if (target.id === B.CHAIR) { sitOn(target.x, target.y, target.z); return; }
    if (isMilker(target.id) && milkerUse(target, held)) return;
    if (isNest(target.id) && nestUse(target, held)) return;
    if (target.id === B.ENCHANT) { enchantUse(held); return; }
    if (target.id === B.ANVIL) { anvilUse(held); return; }
    if ((target.id === B.END_FRAME || target.id === B.END_FRAME_EYE) && frameEye(target, held)) return;
  }
  if (press && target && !player.sneak) {
    const b = BLOCKS[target.id], key = target.x + ',' + target.y + ',' + target.z;
    if (DOOR_HALVES.has(target.id)) { toggleDoor(target.x, target.y, target.z); return; }
    if (GATES.has(target.id) || TRAPDOORS.has(target.id)) { toggleSimple(target.x, target.y, target.z); return; }
    if (isCmdBlock(target.id)) { if (player.creative) openCmdUI(target); else toast('A parancsblokk csak kreatív módban szerkeszthető.'); return; }
    if (target.id === B.LEVER || target.id === B.LEVER_ON) { w.setBlock(target.x, target.y, target.z, target.id === B.LEVER ? B.LEVER_ON : B.LEVER); A.sndPlace('stone'); game.swing = 1; flushNear(target.x, target.z); return; }
    if (target.id === B.BUTTON) { w.setBlock(target.x, target.y, target.z, B.BUTTON_ON); A.sndPlace('stone'); game.swing = 1; flushNear(target.x, target.z); return; }
    if (target.id === B.CRAFTING) { openUI('crafting'); return; }
    if (target.id === B.KITCHEN) { openUI('kitchen'); return; }
    if (target.id === B.BREWING) { openUI('brew'); return; }
    if (target.id === B.FURNACE) { if (!w.containers.has(key)) w.containers.set(key, { slots: [null, null, null], burn: 0, burnMax: 0, cook: 0 }); openUI('furnace', w.containers.get(key)); return; }
    if (target.id === B.CHEST) { if (!w.containers.has(key)) w.containers.set(key, { slots: new Array(27).fill(null) }); openUI('chest', w.containers.get(key)); return; }
    if (target.id === B.OBSIDIAN && held && (held.id === I.FLINT_STEEL) && tryLightPortal(target.x + target.nx, target.y + target.ny, target.z + target.nz)) { wearTool(player.hot, 1); return; }
    if (target.id === B.TNT && held && (held.id === I.FLINT || held.id === I.FLINT_STEEL)) { igniteTNT(target.x, target.y, target.z, 3); if (held.id === I.FLINT_STEEL) wearTool(player.hot, 1); return; }
    if (target.id === B.BED) { sleepIn(target); return; }
  }
  if (!press) return;
  if (held && !isBlockItem(held.id) && useSpecial(held)) return;
  if (held && isBlockItem(held.id) && target) {
    const b = BLOCKS[held.id], tb = BLOCKS[target.id];
    if (b.shape === 'slab' && target.id === held.id && target.ny === 1) { w.setBlock(target.x, target.y, target.z, b.full); A.sndPlace(b.snd); game.swing = 1; if (!player.creative) { inv.take(player.hot, 1); refreshHotbar(); } flushNear(target.x, target.z); return; }
    let px = target.x + target.nx, py = target.y + target.ny, pz = target.z + target.nz;
    if (tb.replace && !FK[target.id]) { px = target.x; py = target.y; pz = target.z; }
    const cur = w.getBlock(px, py, pz);
    if (cur && !BLOCKS[cur].replace) return;
    if (py < 0 || py >= H) return;
    if (SOLID[b.id] && b.shape !== 'cross' && intersectsPlayer(px, py, pz)) return;
    if (b.shape === 'cross' && !SOLID[w.getBlock(px, py - 1, pz)]) return;
    if (b.shape === 'torch' && !(SOLID[w.getBlock(px, py - 1, pz)] || SOLID[w.getBlock(px + 1, py, pz)] || SOLID[w.getBlock(px - 1, py, pz)] || SOLID[w.getBlock(px, py, pz + 1)] || SOLID[w.getBlock(px, py, pz - 1)])) return;
    if ((b.id === B.CHAIR || b.id === B.NEST) && !SOLID[w.getBlock(px, py - 1, pz)]) return;
    if (b.id === B.CACTUS) { const d = w.getBlock(px, py - 1, pz); if (d !== B.SAND && d !== B.CACTUS) return; }
    if (b.id === B.DOOR) {
      if (py + 1 >= H) return;
      const up = w.getBlock(px, py + 1, pz); if (up && !BLOCKS[up].replace) return;
      if (intersectsPlayer(px, py + 1, pz)) return;
      if (!SOLID[w.getBlock(px, py - 1, pz)]) return;
      const fk = facingFromYaw();
      w.facing.set(px + ',' + py + ',' + pz, fk); w.facing.set(px + ',' + (py + 1) + ',' + pz, fk);
      w.setBlock(px, py, pz, B.DOOR); w.setBlock(px, py + 1, pz, B.DOOR_TOP); A.sndPlace(b.snd); game.swing = 1;
      if (!player.creative) { inv.take(player.hot, 1); refreshHotbar(); }
      flushNear(px, pz); updateNeighbors(px, py, pz); return;
    }
    if (b.id === B.LEVER || b.id === B.BUTTON) {
      const wf = target.ny === 1 ? 3 : target.ny === -1 ? 2 : target.nx === 1 ? 1 : target.nx === -1 ? 0 : target.nz === 1 ? 5 : 4, a = ATTACH_DIR[wf];
      if (!SOLID[w.getBlock(px + a[0], py + a[1], pz + a[2])]) return;
      w.facing.set(px + ',' + py + ',' + pz, wf);
    } else if (b.id === B.PLATE) { if (!SOLID[w.getBlock(px, py - 1, pz)]) return; }
    else if (b.rsTorch) { if (!SOLID[w.getBlock(px, py - 1, pz)]) return; }
    if (b.id === B.LADDER) {
      if (target.ny !== 0) return;
      const wf = target.nx === 1 ? 1 : target.nx === -1 ? 0 : target.nz === 1 ? 5 : 4, [lx, lz] = LADDER_DIR[wf];
      if (!SOLID[w.getBlock(px + lx, py, pz + lz)]) return;
      w.facing.set(px + ',' + py + ',' + pz, wf);
    } else if (b.id === B.FENCE_GATE) w.facing.set(px + ',' + py + ',' + pz, facingFromYaw());
    else if (b.id === B.TRAPDOOR) {
      const [ex, ey, ez] = eyePos(), [, ldy] = lookDir();
      const top = target.ny === -1 ? true : target.ny === 1 ? false : (ey + ldy * target.dist - target.y) > 0.5;
      const hinge = target.ny !== 0 ? (target.nx === 1 ? 1 : target.nx === -1 ? 0 : target.nz === 1 ? 5 : 4) : (facingFromYaw() ^ 1);
      w.facing.set(px + ',' + py + ',' + pz, hinge);
      w.setBlock(px, py, pz, top ? B.TRAPDOOR_TOP : B.TRAPDOOR); A.sndPlace(b.snd); game.swing = 1;
      if (!player.creative) { inv.take(player.hot, 1); refreshHotbar(); }
      flushNear(px, pz); updateNeighbors(px, py, pz); void ex; void ez; return;
    }
    else if (b.id === B.CHAIR) w.facing.set(px + ',' + py + ',' + pz, facingFromYaw());
    else if (b.dir) w.facing.set(px + ',' + py + ',' + pz, facingFromYaw()); else if (b.shape === 'stairs') w.facing.set(px + ',' + py + ',' + pz, facingFromYaw() ^ 1);
    w.setBlock(px, py, pz, b.id); A.sndPlace(b.snd); game.swing = 1;
    if (!player.creative) { inv.take(player.hot, 1); refreshHotbar(); }
    flushNear(px, pz); updateNeighbors(px, py, pz);
  }
}
function toggleSimple(x, y, z) {
  const w = game.world, id = w.getBlock(x, y, z); let nid = 0;
  if (id === B.FENCE_GATE) nid = B.FENCE_GATE_OPEN; else if (id === B.FENCE_GATE_OPEN) nid = B.FENCE_GATE;
  else if (id === B.TRAPDOOR) nid = B.TRAPDOOR_OPEN; else if (id === B.TRAPDOOR_OPEN) nid = B.TRAPDOOR;
  else if (id === B.TRAPDOOR_TOP) nid = B.TRAPDOOR_TOP_OPEN; else if (id === B.TRAPDOOR_TOP_OPEN) nid = B.TRAPDOOR_TOP;
  if (!nid) return;
  w.setBlock(x, y, z, nid);
  if (!isTrapOpen(nid) && !(nid === B.FENCE_GATE_OPEN)) { // zárás: ne zárjuk be a játékost
    const hw = 0.3, h = player.sneak ? 1.5 : 1.8, p = player.pos;
    if (boxHits(w, p[0] - hw, p[1], p[2] - hw, p[0] + hw, p[1] + h, p[2] + hw)) { w.setBlock(x, y, z, id); return; }
  }
  A.sndPlace('wood'); game.swing = 1; flushNear(x, z);
}
function toggleDoor(x, y, z) {
  const w = game.world, id = w.getBlock(x, y, z); if (!DOOR_HALVES.has(id)) return;
  const open = isDoorOpen(id), ly = isDoorTop(id) ? y - 1 : y, uy = ly + 1;
  const lo = w.getBlock(x, ly, z), up = w.getBlock(x, uy, z);
  if (!DOOR_HALVES.has(lo) || !DOOR_HALVES.has(up)) return;
  w.setBlock(x, ly, z, open ? B.DOOR : B.DOOR_OPEN); w.setBlock(x, uy, z, open ? B.DOOR_TOP : B.DOOR_TOP_OPEN);
  if (open) { // zárás: ne zárjuk be a játékost az ajtó lapjába
    const hw = 0.3, h = player.sneak ? 1.5 : 1.8, p = player.pos;
    if (boxHits(w, p[0] - hw, p[1], p[2] - hw, p[0] + hw, p[1] + h, p[2] + hw)) { w.setBlock(x, ly, z, lo); w.setBlock(x, uy, z, up); return; }
  }
  A.sndPlace('wood'); game.swing = 1; flushNear(x, z);
}
function sleepIn(t) {
  game.spawn = [t.x + 0.5, t.y + 1, t.z + 0.5]; const dt = game.dayTime;
  if (game.net.isClient) { toast('Újraéledési pont beállítva (az éjszakát a host alussza át)'); return; }
  if (dt > 12500 && dt < 23500) { game.dayTime = 200; toast('Jó reggelt! Az újraéledési pont beállítva.'); } else toast('Újraéledési pont beállítva (aludni csak éjjel lehet)');
}
function placeDust() {
  const w = game.world; if (!target) return true;
  let px = target.x + target.nx, py = target.y + target.ny, pz = target.z + target.nz;
  if (BLOCKS[target.id].replace && !FK[target.id] && !isDust(target.id)) { px = target.x; py = target.y; pz = target.z; }
  if (isDust(target.id) && target.ny === 1) { px = target.x; py = target.y + 1; pz = target.z; }
  if (target.ny === 1 && isDust(target.id)) return true;
  const cur = w.getBlock(px, py, pz); if (cur && !BLOCKS[cur].replace) return true;
  if (!SOLID[w.getBlock(px, py - 1, pz)]) return true;
  w.setBlock(px, py, pz, B.DUST0); A.sndPlace('stone'); game.swing = 1;
  if (!player.creative) { inv.take(player.hot, 1); refreshHotbar(); }
  flushNear(px, pz); updateNeighbors(px, py, pz); return true;
}
function useSpecial(held) {
  if (SPAWN_EGGS[held.id] && target) {
    if (game.net.isClient) { toast('Spawn tojást csak a házigazda használhat'); return true; }
    const m = game.mobs.spawn(SPAWN_EGGS[held.id], target.x + 0.5 + (target.nx || 0), target.y + (target.ny > 0 ? 1 : target.ny < 0 ? -1 : 0), target.z + 0.5 + (target.nz || 0));
    m.yaw = player.yaw + Math.PI; if (!player.creative) { inv.take(player.hot, 1); refreshHotbar(); } A.sndPlace('grass'); game.swing = 1; return true;
  }
  if (held.id === I.BOAT && target && FK[target.id] === 1) { const m = game.mobs.spawn('boat', target.x + 0.5, target.y + 0.9, target.z + 0.5); m.yaw = player.yaw + Math.PI; if (!player.creative) { inv.take(player.hot, 1); refreshHotbar(); } A.sndPlace('wood'); return true; }
  const pd = itemDef(held.id);
  if (pd && pd.potion) {
    const fx = player.fx = player.fx || {};
    if (pd.potion === 'heal') player.health = Math.min(20, player.health + 10); else fx[pd.potion] = pd.potion === 'fire' ? 180 : 90;
    ach('potion'); inv.take(player.hot, 1); const b = inv.add(I.BOTTLE, 1); if (b > 0) game.dropItem(I.BOTTLE, 1, player.pos[0], player.pos[1] + 1, player.pos[2]); refreshHotbar(); updateBars(true); A.sndLevel(); toast('Megittad: ' + pd.name); return true;
  }
  if (held.id === I.EYE_OF_ENDER) { eyeHint(); return true; }
  const w = game.world, id = held.id;
  if (id === I.REDSTONE) return placeDust();
  if (ARMOR[id]) { const sl = ARMOR[id].slot, cur = player.armor[sl]; player.armor[sl] = { id, n: 1, d: held.d || 0 }; inv.slots[player.hot] = cur ? { id: cur.id, n: 1, d: cur.d || 0 } : null; refreshHotbar(); hudCache = ''; A.sndClick(); return true; }
  if (id === I.BUCKET || id === I.WATER_BUCKET || id === I.LAVA_BUCKET) {
    const [ex, ey, ez] = eyePos(), [dx, dy, dz] = lookDir(), hit = raycast(w, ex, ey, ez, dx, dy, dz, 5, true);
    if (!hit) return true;
    if (id === I.BUCKET) {
      if ((hit.id === B.WATER || hit.id === B.LAVA)) { const f = hit.id === B.WATER ? I.WATER_BUCKET : I.LAVA_BUCKET; w.setBlock(hit.x, hit.y, hit.z, B.AIR); flushNear(hit.x, hit.z); A.sndSplash(); if (!player.creative) { inv.slots[player.hot] = { id: f, n: 1, d: 0 }; refreshHotbar(); } }
    } else {
      let px = hit.x + hit.nx, py = hit.y + hit.ny, pz = hit.z + hit.nz;
      if (FK[hit.id] || BLOCKS[hit.id].replace) { px = hit.x; py = hit.y; pz = hit.z; }
      const cur = w.getBlock(px, py, pz);
      if (cur && !BLOCKS[cur].replace) return true;
      w.setBlock(px, py, pz, id === I.WATER_BUCKET ? B.WATER : B.LAVA); flushNear(px, pz); A.sndSplash(); game.swing = 1;
      if (!player.creative) { inv.slots[player.hot] = { id: I.BUCKET, n: 1, d: 0 }; refreshHotbar(); }
    }
    return true;
  }
  const ti = toolInfo(id);
  if (ti && ti.type === 'hoe' && target && target.ny === 1 && (target.id === B.GRASS || target.id === B.DIRT) && !w.getBlock(target.x, target.y + 1, target.z)) {
    w.setBlock(target.x, target.y, target.z, B.FARMLAND); A.sndPlace('dirt'); wearTool(player.hot, 1); game.swing = 1; flushNear(target.x, target.z); return true;
  }
  if (id === I.SEEDS && target && target.id === B.FARMLAND && target.ny === 1 && !w.getBlock(target.x, target.y + 1, target.z)) {
    w.setBlock(target.x, target.y + 1, target.z, B.WHEAT0); A.sndPlace('grass'); if (!player.creative) { inv.take(player.hot, 1); refreshHotbar(); } flushNear(target.x, target.z); return true;
  }
  if (id === I.SHEARS && mobTarget && mobTarget.mob.kind === 'sheep' && !mobTarget.mob.sheared) {
    if (game.net.isClient) { game.net.send({ t: 'shear', id: mobTarget.mob.id }); mobTarget.mob.sheared = true; wearTool(player.hot, 1); game.swing = 1; A.sndHit('cloth'); return true; }
    const m = mobTarget.mob; m.sheared = true; for (let k = 0, n = 1 + (Math.random() * 3 | 0); k < n; k++) game.dropItem(B.WOOL, 1, m.pos[0], m.pos[1] + 0.8, m.pos[2]); wearTool(player.hot, 1); game.swing = 1; A.sndHit('cloth'); return true;
  }
  return false;
}
function releaseBow() {
  const held = inv.slots[player.hot], dr = player.draw; player.draw = 0;
  if (!held || held.id !== I.BOW || dr < 0.2 || player.dead || ui.open) return;
  let slot = -1; for (let i = 35; i >= 0; i--) if (inv.slots[i] && inv.slots[i].id === I.ARROW) { slot = i; break; }
  if (slot < 0 && !player.creative) return;
  if (!player.creative) inv.take(slot, 1);
  const power = Math.min(1, dr), [ex, ey, ez] = eyePos(), [dx, dy, dz] = lookDir();
  game.arrows.fire(ex + dx * 0.5, ey + dy * 0.5 - 0.1, ez + dz * 0.5, dx, dy, dz, 12 + 30 * power, 2 + power * 4.5, 'player'); A.sndShoot(); game.swing = 0.6;
  if (!player.creative) wearTool(player.hot, 1); refreshHotbar();
}
function tickPlants() {
  const w = game.world;
  for (const key of [...w.ticking]) {
    const [x, y, z] = key.split(',').map(Number); if (!w.isLoaded(x, z)) continue;
    const id = w.getBlock(x, y, z);
    if (id >= B.WHEAT0 && id <= B.WHEAT2) { if (Math.random() < 0.025) { w.setBlock(x, y, z, id + 1); flushNear(x, z); } }
    else if (id === B.SAPLING) { if (Math.random() < 0.007) growTree(x, y, z); }
    else w.ticking.delete(key);
  }
}
function growTree(x, y, z) {
  const w = game.world, h = 4 + (Math.random() * 2 | 0);
  for (let k = 1; k <= h + 1; k++) { const id = w.getBlock(x, y + k, z); if (id && id !== B.LEAVES && !BLOCKS[id].replace) return; }
  for (let dy = -2; dy <= 1; dy++) { const rad = dy <= -1 ? 2 : 1; for (let dz = -rad; dz <= rad; dz++) for (let dx = -rad; dx <= rad; dx++) {
    const corner = Math.abs(dx) === rad && Math.abs(dz) === rad; if (corner && (dy >= 0 || Math.random() < 0.5)) continue; if (dx === 0 && dz === 0 && dy <= 0) continue;
    const c = w.getBlock(x + dx, y + h + dy, z + dz); if (!c || BLOCKS[c].replace) w.setBlock(x + dx, y + h + dy, z + dz, B.LEAVES);
  } }
  for (let k = 0; k <= h; k++) w.setBlock(x, y + k, z, B.LOG);
  flushNear(x, z); A.sndPlace('wood');
}
// evés
function foodVal(held) { if (!held) return 0; const d = itemDef(held.id); return d && d.food ? d.food : 0; }
function updateEating(dt) {
  const held = inv.slots[player.hot], fv = foodVal(held);
  if (mouseR && fv && (player.food < 20 || player.creative && false) && !ui.open) {
    const prev = player.eatT; player.eatT += dt;
    if (Math.floor(prev / 0.25) !== Math.floor(player.eatT / 0.25)) A.sndEat();
    if (player.eatT >= 1.6) { player.eatT = 0; const dd = itemDef(held.id); if (dd && dd.heal) player.health = Math.min(20, player.health + dd.heal); player.food = Math.min(20, player.food + fv); player.sat = Math.min(player.food, player.sat + fv * 0.6); inv.take(player.hot, 1); if (dd && dd.returns) inv.add(dd.returns, 1); refreshHotbar(); updateBars(); }
  } else player.eatT = 0;
}
// TNT, robbanás
function igniteTNT(x, y, z, t, fromNet) {
  if (game.net.isClient && !fromNet) { game.net.send({ t: 'tnt', x, y, z, tt: t }); return; }
  const w = game.world; if (w.getBlock(x, y, z) !== B.TNT) return;
  w.setBlock(x, y, z, B.AIR); flushNear(x, z);
  if (game.net.isHost) game.net.bcast({ t: 'fuse', x, y, z, tt: t });
  spawnTntVisual(x, y, z, t, false);
}
function spawnTntVisual(x, y, z, t, visual) {
  const m = blockModel(B.TNT), g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(m.pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(m.uv, 2)); g.setAttribute('aux', new THREE.BufferAttribute(m.aux, 3)); g.setAttribute('tint', new THREE.BufferAttribute(m.tint, 3)); g.setIndex(new THREE.BufferAttribute(m.idx, 1));
  const mat = mkMat(), mesh = new THREE.Mesh(g, mat); mesh.position.set(x + 0.5, y + 0.5, z + 0.5); scene.add(mesh);
  game.tnts.push({ x: x + 0.5, y: y + 0.5, z: z + 0.5, t, mesh, mat, vy: 2, visual }); A.sndFuse();
}
function updateTNT(dt) {
  for (let i = game.tnts.length - 1; i >= 0; i--) {
    const t = game.tnts[i]; t.t -= dt;
    t.vy -= 20 * dt; const below = game.world.getBlock(Math.floor(t.x), Math.floor(t.y - 0.5 + t.vy * dt), Math.floor(t.z));
    if (SOLID[below]) t.vy = 0; else t.y += t.vy * dt;
    const f = Math.floor(t.t * 5) % 2 === 0; t.mat.uniforms.uMul.value = f ? 3 : 1; const sc = 1 + Math.max(0, 0.8 - t.t) * 0.12; t.mesh.scale.setScalar(sc); t.mesh.position.set(t.x, t.y, t.z);
    if (t.t <= 0) { scene.remove(t.mesh); t.mesh.geometry.dispose(); game.tnts.splice(i, 1); if (!t.visual) explode(t.x, t.y, t.z, 4, 'tnt'); }
  }
}
function explode(x, y, z, r, src, visualOnly) {
  const w = game.world; A.sndExplode();
  if (game.net.isHost) game.net.bcast({ t: 'fx', k: 'ex', x, y, z, r, src });
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), R = Math.ceil(r);
  const touched = new Set();
  if (!visualOnly && !(src === 'creeper' && !game.rules.mobGriefing)) for (let dy = -R; dy <= R; dy++) for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz); if (d > r * (0.75 + Math.random() * 0.35)) continue;
    const bx = ix + dx, by = iy + dy, bz = iz + dz, id = w.getBlock(bx, by, bz); if (!id) continue;
    const b = BLOCKS[id]; if (b.hard < 0 || b.hard >= 50) continue;
    if (id === B.TNT) { igniteTNT(bx, by, bz, 0.3 + Math.random() * 0.6); continue; }
    if (FK[id]) continue;
    w.setBlock(bx, by, bz, B.AIR, false);
    if (DOOR_HALVES.has(id)) { const oy = isDoorTop(id) ? by - 1 : by + 1; if (DOOR_HALVES.has(w.getBlock(bx, oy, bz))) { w.setBlock(bx, oy, bz, B.AIR, false); w.facing.delete(bx + ',' + oy + ',' + bz); } }
    const key = bx + ',' + by + ',' + bz; w.facing.delete(key); if (w.containers.has(key)) { for (const s of w.containers.get(key).slots) if (s) game.dropItem(s.id, s.n, bx + 0.5, by + 0.5, bz + 0.5); w.containers.delete(key); }
    if (Math.random() < 0.25 && !player.creative || Math.random() < 0.25) for (const [did, n] of blockDrops(b, 99 >= 0 ? I.DIAMOND_PICKAXE : 0)) game.dropItem(did, n, bx + 0.5, by + 0.5, bz + 0.5);
    if (Math.random() < 0.3) game.particles.burst(bx + 0.5, by + 0.5, bz + 0.5, [0.35, 0.35, 0.35], 2, 0.4);
    touched.add(bx + ',' + bz);
  }
  for (const k of touched) { const [bx, bz] = k.split(',').map(Number); flushNear(bx, bz); }
  if (!visualOnly) for (let dy = -R - 1; dy <= R + 1; dy++) for (let dz = -R - 1; dz <= R + 1; dz++) for (let dx = -R - 1; dx <= R + 1; dx++) if (Math.random() < 0.12) checkSupport(ix + dx, iy + dy, iz + dz);
  game.particles.burst(x, y, z, [0.9, 0.9, 0.9], 40, 1.2);
  // sebzés
  const hit = (px, py, pz) => { const d = Math.hypot(px - x, py - y, pz - z); return d < r * 2 ? 1 - d / (r * 2) : 0; };
  const pf = hit(player.pos[0], player.pos[1] + 0.9, player.pos[2]);
  if (pf > 0 && !player.dead) { hurtPlayer(Math.floor(pf * pf * 28 + pf * 2), x, z, src); const dx = player.pos[0] - x, dz = player.pos[2] - z, l = Math.hypot(dx, dz) || 1; player.vel[0] += dx / l * 9 * pf; player.vel[2] += dz / l * 9 * pf; player.vel[1] += 6 * pf; }
  if (!visualOnly) for (const m of [...game.mobs.list]) { const f = hit(m.pos[0], m.pos[1] + 0.8, m.pos[2]); if (f > 0) game.mobs.damage(m, Math.floor(f * f * 28 + f * 2), x, z, 1.5); }
}
function hurtPlayer(dmg, sx, sz, src) {
  if (game.dedicated) return;
  if (player.dead || player.creative || game.difficulty === 0 && src !== 'pvp' && src !== 'fall' && src !== 'lava' && src !== 'drown' && src !== 'void') return;
  if (player.inv_t > 0 && src !== 'void') return;
  if (src === 'zombie' || src === 'creeper' || src === 'tnt' || src === 'arrow') dmg = game.difficulty === 1 ? Math.min(dmg / 2 + 1, dmg) : game.difficulty === 3 ? dmg * 1.5 : dmg;
  if (src !== 'void' && src !== 'drown' && src !== 'hunger') {
    const pts = armorPoints(); if (pts > 0) { dmg *= 1 - Math.min(20, pts) * 0.04; for (let i = 0; i < 4; i++) { const a = player.armor[i]; if (a) { a.d = (a.d || 0) + 1; if (a.d >= ARMOR[a.id].dur) { player.armor[i] = null; toast('A páncélod darabja eltört'); } } } hudCache = ''; }
  }
  dmg = Math.max(1, Math.round(dmg));
  player.health -= dmg; player.inv_t = 0.5; player.hurtT = 0.4; player.exh += 0.1; A.sndHurt();
  $('hurt').classList.add('on'); setTimeout(() => $('hurt').classList.remove('on'), 80);
  if (sx !== undefined && src !== 'fall' && src !== 'drown' && src !== 'lava') { const dx = player.pos[0] - sx, dz = player.pos[2] - sz, l = Math.hypot(dx, dz) || 1; player.vel[0] += dx / l * 5; player.vel[2] += dz / l * 5; if (player.ground) player.vel[1] = 4.5; }
  if (player.health <= 0) die(src);
}
const DEATH = { pvp: 'Egy játékos megölt', zombie: 'Zombi ölt meg téged', creeper: 'Felrobbantott egy creeper', tnt: 'Felrobbantál', fall: 'Nagyot estél', lava: 'Lávában égtél meg', drown: 'Vízbe fulladtál', void: 'Kiestél a világból', hunger: 'Éhen haltál', cactus: 'Kaktuszba szúrtad magad', arrow: 'Nyíllövés végzett veled' };
function die(src) {
  if (game.smpMode && game.net.isHost) game.smp.onDeath(game.net.myName, player.pos);
  player.dead = true; player.health = 0; mouseL = mouseR = false;
  const keep = game.rules.keepInventory;
  if (!player.creative && !keep) { for (let i = 0; i < 36; i++) { const s = inv.slots[i]; if (s) game.dropItem(s.id, s.n, player.pos[0], player.pos[1] + 1, player.pos[2]); inv.slots[i] = null; } }
  if (!player.creative && !keep) for (let i = 0; i < 4; i++) { const a = player.armor[i]; if (a) { game.dropItem(a.id, 1, player.pos[0], player.pos[1] + 1, player.pos[2]); player.armor[i] = null; } }
  if (!keep) { player.xp = 0; player.level = 0; } refreshHotbar();
  if (game.net.active) { const t = game.net.myName + ' meghalt: ' + (DEATH[src] || 'Meghaltál'); if (game.net.isHost) game.net.sysChat(t); else game.net.send({ t: 'chat', m: '☠ ' + (DEATH[src] || 'meghalt') }); }
  $('death-msg').textContent = DEATH[src] || 'Meghaltál'; game.expectUnlock = true; if (document.pointerLockElement) document.exitPointerLock(); showScreen('death'); updateBars(true);
}
function respawn() {
  if (game.dim !== 'overworld' && !game.net.isClient) { player.dead = false; player.health = 20; player.food = 20; player.sat = 5; showScreen(''); travel('overworld', { respawn: true }); return; }
  Object.assign(player, { pos: game.spawn.slice(), vel: [0, 0, 0], health: 20, food: 20, sat: 5, air: 300, dead: false, fall: 0, flying: false, exh: 0 });
  let y = Math.floor(player.pos[1]); const w = game.world; while (y < H - 2 && (SOLID[w.getBlock(Math.floor(player.pos[0]), y, Math.floor(player.pos[2]))] || SOLID[w.getBlock(Math.floor(player.pos[0]), y + 1, Math.floor(player.pos[2]))])) y++;
  player.pos[1] = y + 0.01; showScreen(''); updateBars(true); lockPointer();
}

// ---------------- Játékos frissítés ----------------
let stepSnd = 0, bobT = 0, camBob = 0;
function updatePlayer(dt) {
  const w = game.world, p = player;
  if (p.dead) return;
  p.inv_t = Math.max(0, p.inv_t - dt); p.hurtT = Math.max(0, p.hurtT - dt);
  const bx = Math.floor(p.pos[0]), bz = Math.floor(p.pos[2]);
  if (!w.isLoaded(bx, bz)) return; // várjuk a chunkot
  player.heldId = inv.slots[p.hot] ? inv.slots[p.hot].id : 0;
  if (p.ride) {
    const bt = p.ride;
    if (bt.dead || !game.mobs.list.includes(bt) || keys.ShiftLeft || keys.ShiftRight) { const m0 = bt; p.ride = null; if (m0) m0.drive = null; p.pos = [p.pos[0] + Math.sin(p.yaw) * -1.2, p.pos[1] + 0.8, p.pos[2] + Math.cos(p.yaw) * -1.2]; p.vel = [0, 0, 0]; }
    else { bt.drive = [(keys.KeyW ? 1 : 0) - (keys.KeyS ? 0.6 : 0), 0, p.yaw + Math.PI]; p.pos = [bt.pos[0], bt.pos[1] + 0.25, bt.pos[2]]; p.vel = [0, 0, 0]; p.fall = 0; return; }
  }
  if (p.sit) {
    if (w.getBlock(p.sit.x, p.sit.y, p.sit.z) !== B.CHAIR || keys.Space || keys.ShiftLeft || keys.ShiftRight) { standUp(); return; }
    p.vel = [0, 0, 0]; p.pos = [p.sit.x + 0.5, p.sit.y + 0.45, p.sit.z + 0.5]; p.fall = 0; return;
  }
  const feetB = w.getBlock(bx, Math.floor(p.pos[1] + 0.1), bz), chestB = w.getBlock(bx, Math.floor(p.pos[1] + 0.9), bz), eyeB = w.getBlock(bx, Math.floor(p.pos[1] + 1.62), bz);
  p.inWater = FK[feetB] === 1 || FK[chestB] === 1; p.headWater = FK[eyeB] === 1; const inLava = FK[feetB] === 2 || FK[chestB] === 2;
  p.sneak = (keys.ShiftLeft || keys.ShiftRight) && !p.flying;
  updatePortal(dt, feetB, chestB);
  let fw = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0), st = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  if (ui.open || game.paused) { fw = 0; st = 0; }
  if (fw <= 0 && !(keys.ControlLeft && fw > 0)) { if (fw < 0 || !keys.KeyW) p.sprint = false; }
  if (p.sneak || (!p.creative && p.food <= 6)) p.sprint = false;
  if (keys.ControlLeft && fw > 0 && !p.sneak && (p.creative || p.food > 6)) p.sprint = true;
  let speed = p.sneak ? 1.31 : p.sprint ? 5.612 : 4.317;
  if (p.fx) { for (const k in p.fx) if (p.fx[k] > 0) p.fx[k] -= dt; if (p.fx.speed > 0) speed *= 1.4; }
  if (p.flying) speed = p.sprint ? 21 : 10.9;
  const sy = Math.sin(p.yaw), cy = Math.cos(p.yaw);
  let wx = (-sy * fw + cy * st), wz = (-cy * fw - sy * st); const wl = Math.hypot(wx, wz); if (wl > 0) { wx /= wl; wz /= wl; }
  const inLiquid = (p.inWater || inLava) && !p.flying;
  if (inLiquid) speed *= inLava ? 0.35 : 0.55;
  let tx = wx * speed, tz = wz * speed;
  if (p.inWater && !p.flying) { const fy = FK[feetB] === 1 ? Math.floor(p.pos[1] + 0.1) : Math.floor(p.pos[1] + 0.9), fl = game.fluids.flow(bx, fy, bz); tx += fl[0] * 1.9; tz += fl[1] * 1.9; }
  const accel = p.flying ? 9 : (p.ground ? 14 : (inLiquid ? 5 : 2.6));
  const k = 1 - Math.exp(-accel * dt);
  p.vel[0] += (tx - p.vel[0]) * k; p.vel[2] += (tz - p.vel[2]) * k;
  const onLadder = !p.flying && (feetB === B.LADDER || chestB === B.LADDER);
  const wantUp = keys.Space && !ui.open && !game.paused, wantDown = (keys.ShiftLeft || keys.ShiftRight) && !ui.open;
  if (p.flying) { const vt = (wantUp ? 1 : 0) - (wantDown ? 1 : 0); p.vel[1] += (vt * (p.sprint ? 12 : 7.5) - p.vel[1]) * (1 - Math.exp(-10 * dt)); p.fall = 0; }
  else if (onLadder) {
    p.fall = 0;
    if (wantUp || (fw > 0 && p.hitWall)) p.vel[1] = 3.2; else if (p.sneak) p.vel[1] = 0; else p.vel[1] = Math.max(p.vel[1] - 20 * dt, -3.2);
    p.vel[0] *= 0.6; p.vel[2] *= 0.6;
  }
  else if (inLiquid) {
    p.vel[1] -= (inLava ? 6 : 9) * dt; if (wantUp) p.vel[1] += (inLava ? 14 : 22) * dt; p.vel[1] = clamp(p.vel[1], -4, wantUp ? 3.4 : 2);
    p.vel[1] *= Math.pow(0.12, dt); p.fall = 0;
  } else {
    p.vel[1] -= 32 * dt; p.vel[1] = Math.max(p.vel[1], -78);
    if (wantUp && p.ground) { p.vel[1] = 8.95; p.exh += p.sprint ? 0.2 : 0.05; if (p.sprint) { p.vel[0] += wx * 2; p.vel[2] += wz * 2; } A.sndStep('stone', 0.3); }
  }
  // kiugrás a vízből
  if (p.inWater && !p.headWater && wantUp && !p.flying) { const ahead = w.getBlock(Math.floor(p.pos[0] + wx * 0.5), Math.floor(p.pos[1] + 0.2), Math.floor(p.pos[2] + wz * 0.5)); if (SOLID[ahead]) p.vel[1] = 6.2; }
  const wasGround = p.ground, preVy = p.vel[1];
  const r = moveBox(w, p.pos, 0.6, p.sneak ? 1.5 : 1.8, p.vel, dt, p.sneak && p.ground ? { ground: true } : null);
  p.ground = r.ground; p.hitWall = r.hitX || r.hitZ;
  if (r.ground && p.flying) p.flying = false;
  // esés
  if (!p.ground && p.vel[1] < 0 && !inLiquid && !p.flying) p.fall += -p.vel[1] * dt; else if (!p.ground && p.vel[1] > 0) p.fall = Math.max(0, p.fall - p.vel[1] * dt);
  if (p.ground && !wasGround) {
    if (p.fall > 3 && !p.creative && game.rules.fallDamage) { const dmg = Math.floor(p.fall - 3); if (dmg > 0) hurtPlayer(dmg, undefined, undefined, 'fall'); }
    if (p.fall > 1.5) A.sndStep(BLOCKS[w.getBlock(bx, Math.floor(p.pos[1] - 0.1), bz)]?.snd || 'stone', 1.6);
    p.fall = 0;
  }
  if (p.ground || inLiquid) { if (inLiquid) p.fall = 0; }
  if (p.inWater && !game.wasWater) A.sndSplash(); game.wasWater = p.inWater;
  // lépés-hang & fejbillegés
  const hs = Math.hypot(p.vel[0], p.vel[2]);
  if (p.ground && hs > 0.5 && !p.flying) {
    stepSnd += hs * dt; bobT += hs * dt * 1.7;
    if (stepSnd > (p.sprint ? 2.0 : 1.6)) { stepSnd = 0; const bb = BLOCKS[w.getBlock(bx, Math.floor(p.pos[1] - 0.2), bz)]; if (bb) A.sndStep(bb.snd, p.sneak ? 0.4 : 1); }
    if (!p.creative) p.exh += hs * dt * (p.sprint ? 0.1 : 0);
  }
  camBob = lerp(camBob, p.ground && hs > 0.5 && settings.bob ? Math.min(1, hs / 4.3) : 0, 1 - Math.exp(-10 * dt));
  // éhség, regeneráció
  if (!p.creative) {
    if (p.exh >= 4) { p.exh -= 4; if (p.sat > 0) p.sat = Math.max(0, p.sat - 1); else if (game.difficulty > 0) p.food = Math.max(0, p.food - 1); }
    if (p.food >= 18 && p.health < 20 && p.health > 0) { p.regenT += dt; if (p.regenT >= 4) { p.regenT = 0; p.health = Math.min(20, p.health + 1); p.exh += 1.5; } }
    else if (p.food <= 0 && game.difficulty > 0) { p.starveT += dt; if (p.starveT >= 4) { p.starveT = 0; if (p.health > (game.difficulty === 1 ? 10 : game.difficulty === 2 ? 1 : 0)) hurtPlayer(1, undefined, undefined, 'hunger'); } }
    else { p.regenT = 0; p.starveT = 0; }
    if (game.difficulty === 0 && p.health < 20) { p.regenT += dt; if (p.regenT > 1) { p.regenT = 0; p.health = Math.min(20, p.health + 1); } }
    // fulladás
    if (p.headWater) { p.air -= dt * 20; if (p.air <= 0) { p.drownT += dt; if (p.drownT >= 1) { p.drownT = 0; hurtPlayer(2, undefined, undefined, 'drown'); } } } else { p.air = Math.min(300, p.air + dt * 100); p.drownT = 0; }
    if (inLava && !(p.fx && p.fx.fire > 0)) { p.lavaT += dt; if (p.lavaT >= 0.5) { p.lavaT = 0; p.inv_t = 0; hurtPlayer(4, undefined, undefined, 'lava'); } } else p.lavaT = 0;
    // kaktusz
    const hw = 0.33; let cact = false;
    for (const [ox, oz] of [[hw + 0.06, 0], [-hw - 0.06, 0], [0, hw + 0.06], [0, -hw - 0.06]]) if (w.getBlock(Math.floor(p.pos[0] + ox), Math.floor(p.pos[1] + 0.5), Math.floor(p.pos[2] + oz)) === B.CACTUS) cact = true;
    if (cact) { p.cactT = (p.cactT || 0) + dt; if (p.cactT > 0.5) { p.cactT = 0; p.inv_t = 0; hurtPlayer(1, undefined, undefined, 'cactus'); } }
    if (p.pos[1] < -20) { p.inv_t = 0; hurtPlayer(4, undefined, undefined, 'void'); }
  } else { p.air = 300; if (p.pos[1] < -40) { p.pos[1] = 100; p.vel[1] = 0; } }
}

// ---------------- Bányászás / támadás ----------------
let hitSndT = 0;
function updateMining(dt) {
  const m = game.mining;
  game.atk = Math.max(0, game.atk - dt);
  if (!mouseL || ui.open || game.paused || player.dead) { game.mining = null; crackMesh.visible = false; return; }
  const held = inv.slots[player.hot], tid = held ? held.id : 0;
  if (pvpTarget) {
    game.mining = null; crackMesh.visible = false;
    if (game.atk <= 0) {
      game.atk = 0.5; game.swing = 1; const ti = toolInfo(tid); let dmg = (ti ? ti.dmg : 1) + ((held && held.e && held.e.s) || 0) * 1.25 + (player.fx && player.fx.str > 0 ? 3 : 0);
      if (player.fall > 0.6 && !player.ground) dmg *= 1.5;
      game.net.attackPlayer(pvpTarget.r, dmg);
      if (ti) wearTool(player.hot, ti.type === 'sword' ? 1 : 2); player.exh += 0.1; A.sndHit('cloth');
    }
    return;
  }
  if (mobTarget) {
    game.mining = null; crackMesh.visible = false;
    if (game.atk <= 0) {
      game.atk = 0.5; game.swing = 1; const ti = toolInfo(tid); let dmg = (ti ? ti.dmg : 1) + ((held && held.e && held.e.s) || 0) * 1.25 + (player.fx && player.fx.str > 0 ? 3 : 0);
      if (player.fall > 0.6 && !player.ground) dmg *= 1.5; if (player.creative) dmg = Math.max(dmg, 6);
      game.mobs.damage(mobTarget.mob, dmg, player.pos[0], player.pos[2], player.sprint ? 1.6 : 1);
      if (ti) wearTool(player.hot, ti.type === 'sword' ? 1 : 2); player.exh += 0.1;
    }
    return;
  }
  if (!target) { game.mining = null; crackMesh.visible = false; return; }
  if (game.smpMode && game.smp.blocked(target.x, target.z)) { game.mining = null; crackMesh.visible = false; if (game.time - (game.protT || -9) > 2) { game.protT = game.time; toast('A spawn környéke védett.'); } return; }
  const b = BLOCKS[target.id];
  if (player.creative) {
    if (!m || m.cool <= 0) { breakBlock(target.x, target.y, target.z, false); flushNear(target.x, target.z); game.mining = { x: -1, y: -1, z: -1, p: 0, cool: 0.22 }; game.swing = 1; }
    else m.cool -= dt;
    crackMesh.visible = false; return;
  }
  if (b.hard < 0) { crackMesh.visible = false; return; }
  if (!m || m.x !== target.x || m.y !== target.y || m.z !== target.z) game.mining = { x: target.x, y: target.y, z: target.z, p: 0 };
  const mm = game.mining, bt = breakTime(b, tid) / (1 + 0.35 * ((held && held.e && held.e.f) || 0));
  mm.p += bt === 0 ? 2 : dt / bt; hitSndT -= dt; game.swing = Math.max(game.swing, 0.6);
  if (hitSndT <= 0) { hitSndT = 0.25; A.sndHit(b.snd); game.particles.block(target.x, target.y, target.z, target.id, 2); }
  player.exh += dt * 0.02;
  if (mm.p >= 1) {
    breakBlock(target.x, target.y, target.z, true, true, tid);
    const ti = toolInfo(tid); if (ti && b.hard > 0) wearTool(player.hot, ti.type === 'sword' ? 2 : 1);
    flushNear(target.x, target.z); game.mining = null; crackMesh.visible = false; hitSndT = 0.1;
  } else {
    crackMesh.visible = true; crackMesh.position.set(target.x + 0.5, target.y + 0.5, target.z + 0.5); crackMesh.material.map = crackTex[clamp(Math.floor(mm.p * 10), 0, 9)]; crackMesh.material.needsUpdate = true;
  }
}

// ---------------- Kemencék ----------------
function updateFurnaces(dt) {
  for (const f of game.world.containers.values()) {
    if (!f.slots || f.slots.length !== 3) continue;
    const inp = f.slots[0], fuel = f.slots[1], out = f.slots[2];
    const res = inp ? SMELT[inp.id] : undefined;
    const canOut = res !== undefined && (!out || (out.id === res && out.n < maxStack(res)));
    if (f.burn > 0) f.burn -= dt;
    if (canOut && f.burn <= 0 && fuel && fuelTime(fuel.id) > 0) { f.burn = f.burnMax = fuelTime(fuel.id); fuel.n--; if (fuel.n <= 0) f.slots[1] = null; }
    if (canOut && f.burn > 0) {
      f.cook += dt;
      if (f.cook >= 10) { f.cook = 0; inp.n--; if (inp.n <= 0) f.slots[0] = null; if (out) out.n++; else f.slots[2] = { id: res, n: 1, d: 0 }; }
    } else if (f.cook > 0) f.cook = Math.max(0, f.cook - dt * 2);
  }
}

// ---------------- Kéz ----------------
let handGroup = null, lastHeld = -2, handMat = null, handSwitch = 0;
function updateHandModel() {
  const s = inv.slots[player.hot], id = s ? s.id : 0;
  if (id === lastHeld && handGroup) return;
  lastHeld = id; handSwitch = 1;
  if (handGroup) { handScene.remove(handGroup); handGroup.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
  handGroup = new THREE.Group(); handScene.add(handGroup);
  if (!id) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.55), new THREE.MeshBasicMaterial({ color: 0xb98a68 }));
    arm.userData.arm = true; handGroup.add(arm); handGroup.userData = { kind: 'arm' }; handMat = arm.material; return;
  }
  if (isBlockItem(id)) {
    const m = blockModel(id), g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(m.pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(m.uv, 2)); g.setAttribute('aux', new THREE.BufferAttribute(m.aux, 3)); g.setAttribute('tint', new THREE.BufferAttribute(m.tint, 3)); g.setIndex(new THREE.BufferAttribute(m.idx, 1));
    const mesh = new THREE.Mesh(g, matHand); const b = BLOCKS[id];
    mesh.scale.setScalar(b.shape === 'cross' || b.shape === 'torch' ? 0.55 : 0.42); handGroup.add(mesh); handGroup.userData = { kind: 'block' }; handMat = matHand;
  } else {
    const tex = new THREE.CanvasTexture(game.iconCanvas(id)); tex.magFilter = tex.minFilter = THREE.NearestFilter;
    handMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62), handMat); handGroup.add(mesh);
    // vastagság látszata: második, enyhén eltolt lap
    const m2 = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62), new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, color: 0x666666 })); m2.position.z = -0.012; handGroup.add(m2);
    handGroup.userData = { kind: 'item', tool: !!toolInfo(id) };
  }
}
import { iconCanvas } from './textures.js';
game.iconCanvas = iconCanvas;
function placeHand(dt, t) {
  if (!handGroup) return;
  const kind = handGroup.userData.kind;
  handSwitch = Math.max(0, handSwitch - dt * 5);
  game.swing = Math.max(0, game.swing - dt * 4.5);
  const sw = game.swing, swp = Math.sin(Math.sqrt(Math.max(0, 1 - sw)) * Math.PI); // 0..1..0
  const bob = Math.sin(bobT) * 0.012 * camBob, bob2 = Math.abs(Math.cos(bobT)) * 0.012 * camBob;
  const eat = player.eatT > 0 ? Math.sin(player.eatT * 18) * 0.02 : 0;
  let x = 0.5, y = -0.45, z = -0.8;
  x += bob; y += bob2 - handSwitch * 0.4; y += eat;
  if (player.eatT > 0) { x = 0.15; y = -0.3 + eat; z = -0.6; }
  if (kind === 'arm') { handGroup.position.set(x - 0.12, y + 0.16 - swp * 0.08, z + 0.02); handGroup.rotation.set(-1.0 - swp * 0.8, -0.5 + swp * 0.3, 0.1); }
  else if (kind === 'block') { handGroup.position.set(x, y + 0.05 - swp * 0.1, z); handGroup.rotation.set(-swp * 0.8, 0.7 - swp * 0.5, 0); }
  else { handGroup.position.set(x - 0.05 - swp * 0.1, y + 0.18 - swp * 0.08, z - 0.05 - swp * 0.1); handGroup.rotation.set(-swp * 1.1, -0.5 + swp * 0.3, -0.25 - swp * 0.5 + (handGroup.userData.tool ? 0 : 0.0)); }
  if (player.draw > 0 && kind === 'item') { const q = Math.min(1, player.draw); handGroup.position.x -= 0.1 * q; handGroup.position.y += 0.06 * q; handGroup.rotation.z += 0.35 * q; }
  // fény a kézen
  const L = Math.max(game.world.getSky(Math.floor(player.pos[0]), Math.floor(player.pos[1] + 1.4), Math.floor(player.pos[2])) / 15 * G.uDay.value, game.world.getBlk(Math.floor(player.pos[0]), Math.floor(player.pos[1] + 1.4), Math.floor(player.pos[2])) / 15);
  const br = 0.15 + 0.85 * Math.pow(L, 1.4);
  if (kind === 'block') matHand.uniforms.uMul.value = br; else if (handMat && handMat.color) { if (kind === 'arm') handMat.color.setRGB(0.73 * br, 0.54 * br, 0.41 * br); else handMat.color.setRGB(br, br, br); }
}

// ---------------- Nap/éjszaka ----------------
const SKY_DAY = [0.47, 0.65, 1.0], SKY_NIGHT = [0.015, 0.02, 0.06], FOG_DAY = [0.72, 0.82, 1.0];
let dayF = 1;
function updateSky(dt) {
  const prevDay = game.dayTime;
  if (game.rules.doDaylightCycle) game.dayTime = (game.dayTime + dt * 20) % 24000;
  if (game.dayTime < prevDay - 6000) game.newDay();
  const th = game.dayTime / 24000 * Math.PI * 2, h = Math.sin(th);
  dayF = clamp((h + 0.12) / 0.45, 0, 1); dayF = dayF * dayF * (3 - 2 * dayF);
  const dusk = clamp(1 - Math.abs(h) / 0.22, 0, 1) * 0.55;
  const sky = [0, 0, 0], fog = [0, 0, 0];
  const warm = [1.0, 0.52, 0.28];
  for (let i = 0; i < 3; i++) { sky[i] = lerp(SKY_NIGHT[i], SKY_DAY[i], dayF); fog[i] = lerp(SKY_NIGHT[i] * 1.2, FOG_DAY[i], dayF); sky[i] = lerp(sky[i], warm[i] * 0.85, dusk * 0.6 * (dayF > 0.01 ? 1 : 0.2)); fog[i] = lerp(fog[i], warm[i], dusk * 0.7 * (dayF > 0.01 ? 1 : 0.2)); }
  G.uDay.value = lerp(0.17, 1, dayF);
  const cam = camera.position; const D = 380;
  sunMesh.position.set(cam.x + Math.cos(th) * D, cam.y + Math.sin(th) * D, cam.z + 40); sunMesh.lookAt(cam);
  moonMesh.position.set(cam.x - Math.cos(th) * D, cam.y - Math.sin(th) * D, cam.z - 40); moonMesh.lookAt(cam);
  stars.position.copy(cam); stars.rotation.z = th; starMat.opacity = clamp(1 - dayF * 1.4, 0, 1) * 0.95;
  clouds.position.set(cam.x, 132, cam.z); clouds.visible = settings.clouds; cloudTex.offset.x = (game.time * 0.004) % 1; cloudTex.offset.y = (cam.z / 1536 * 6 * 0 + 0) % 1;
  cloudTex.offset.x += cam.x / 1536 * 6; cloudTex.offset.y = -cam.z / 1536 * 6;
  const cl = lerp(0.18, 1, dayF); cloudMat.color.setRGB(cl, cl, cl * 1.02);
  const od = game.dim === 'overworld';
  sunMesh.visible = moonMesh.visible = od; if (!od) { clouds.visible = false; G.uDay.value = 0.5; starMat.opacity = game.dim === 'end' ? 0.95 : 0; }
  G.uAmb.value = game.dim === 'nether' ? 0.32 : game.dim === 'end' ? 0.22 : 0;
  if (game.dim === 'nether') { const c = [0.2, 0.04, 0.03]; return { sky: c, fog: c, near: 6, far: 70 }; }
  if (game.dim === 'end') { const c = [0.05, 0.03, 0.09]; return { sky: c, fog: c, near: 40, far: 160 }; }
  return { sky, fog };
}

// ---------------- Fő ciklus ----------------
let last = performance.now(), fpsAcc = 0, fpsN = 0, fps = 0;
function frame(now) {
  raf(frame);
  let dt = Math.min(0.05, (now - last) / 1000); last = now; game.time += dt;
  fpsAcc += dt; fpsN++; if (fpsAcc > 0.5) { fps = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; }
  if (!game.world) { renderer.clear(); return; }
  const w = game.world;
  if (game.state === 'menu') {
    menuCamA += dt * 0.05; const cx = Math.cos(menuCamA) * 6, cz = Math.sin(menuCamA) * 6;
    camera.position.set(cx, game.menuY, cz); camera.rotation.set(-0.18, -menuCamA + Math.PI / 2, 0);
    streamChunks(w, 0, 0, 6, 8, 8);
    const s = updateSky(dt); G.uFog.value.setRGB(...s.fog); renderer.setClearColor(new THREE.Color(...s.sky), 1); G.uFogNear.value = 40; G.uFogFar.value = 100;
    renderer.clear(); renderer.render(scene, camera); return;
  }
  if (game.state === 'loading') { renderer.clear(); return; }
  const active = game.state === 'play' && (!game.paused || game.net.active);
  if (active) {
    updateTarget();
    updatePlayer(dt);
    if (!ui.open) { updateMining(dt); updateEating(dt); }
    if (mouseR && !ui.open && !player.dead) { game.useT = (game.useT || 0) - dt; if (game.useT <= 0) { game.useT = 0.2; if (!foodVal(inv.slots[player.hot])) useItem(true); } } else game.useT = 0;
    game.mobs.update(dt, game.playerList(), dayF, camera); game.drops.update(dt, game.playerList(), game.time, (p, id, n) => { if (p.cid) { game.net.sendTo(p.cid, { t: 'give', id, n }); return 0; } const left = inv.add(id, n); refreshHotbar(); return left; });
    { const hb = inv.slots[player.hot]; if (mouseR && hb && hb.id === I.BOW && !ui.open && !player.dead) player.draw = Math.min(1.3, player.draw + dt); else if (!mouseR) player.draw = 0; }
    game.tickT = (game.tickT || 0) + dt; if (game.tickT > 0.5) { game.tickT = 0; if (!game.net.isClient) tickPlants(); }
    if (game.state === 'play' && !game.paused) { game.fluids.update(dt); game.rs.update(dt); }
    game.arrows.update(dt, player);
    game.particles.update(dt); updateFalling(dt); updateTNT(dt); if (!game.net.isClient) updateFurnaces(dt); ui.tick(); game.net.update(dt, dayF);
    if (game.smpMode) { game.smp.update(dt); game.smpT = (game.smpT || 0) + dt; if (game.smpT > 1) { game.smpT = 0; renderSidebar(game); } }
    game.saveT += dt; if (game.saveT > 90) { game.saveT = 0; saveGame(true); }
  }
  if (game.dedicated) { updateSky(dt); dedicatedStream(); ssTick(dt); return; }
  // kamera
  const eyeY = player.pos[1] + (player.sneak ? 1.5 : 1.62);
  camera.position.set(player.pos[0], eyeY + Math.abs(Math.sin(bobT)) * 0.045 * camBob - 0.02 * camBob, player.pos[2]);
  camera.rotation.set(player.pitch, player.yaw, Math.sin(bobT) * 0.004 * camBob * 2 + (player.hurtT > 0 ? Math.sin(player.hurtT * 40) * 0.03 * (player.hurtT / 0.4) : 0));
  if (player.dead) camera.rotation.z = 0.6;
  // harmadik személyű nézet (F5)
  if (game.tp) {
    if (!game.selfAv) { game.selfAv = buildAvatar(net.myName || settings.pname || 'Te'); scene.add(game.selfAv.root); game.selfAv.tag.visible = false; }
    const av = game.selfAv, ak = player.armor.map(x => x ? x.id : 0).join(',');
    if (av.armorKey !== ak) setAvatarArmor(av, player.armor.map(x => x ? x.id : 0));
    const sgn = game.tp === 2 ? -1 : 1, cp = Math.cos(player.pitch), back = game.tpDist || 4;
    const dx = -Math.sin(player.yaw) * cp, dy = Math.sin(player.pitch), dz = -Math.cos(player.yaw) * cp;
    camera.position.set(player.pos[0] - dx * back * sgn, eyeY - dy * back * sgn + 0.2, player.pos[2] - dz * back * sgn);
    if (game.tp === 2) camera.rotation.set(-player.pitch, player.yaw + Math.PI, 0);
    const hs = Math.hypot(player.vel[0], player.vel[2]); av.anim = (av.anim || 0) + hs * dt * 1.6; const sw = Math.sin(av.anim) * Math.min(1, hs / 2) * 0.8;
    av.legL.rotation.x = sw; av.legR.rotation.x = -sw; av.armL.rotation.x = -sw; av.armR.rotation.x = sw + (game.swing > 0 ? -game.swing * 1.2 : 0); av.head.rotation.x = player.pitch;
    av.root.position.set(player.pos[0], player.pos[1] - (player.sneak ? 0.15 : 0), player.pos[2]); av.root.rotation.y = player.yaw; av.root.visible = true;
    const lt = game.mobs.lightAt(player.pos[0], player.pos[1], player.pos[2], dayF); for (const m of av.mats) m.color.setRGB(m.base[0] * lt, m.base[1] * lt, m.base[2] * lt);
  } else if (game.selfAv) game.selfAv.root.visible = false;
  const targetFov = settings.fov * (player.sprint && Math.hypot(player.vel[0], player.vel[2]) > 4 ? 1.1 : 1) * (player.flying && player.sprint ? 1.12 : 1) * (1 - Math.min(1, player.draw) * 0.12);
  if (Math.abs(camera.fov - targetFov) > 0.1) { camera.fov = lerp(camera.fov, targetFov, 1 - Math.exp(-dt * 10)); camera.updateProjectionMatrix(); }
  // streaming
  if (game.state === 'play') streamChunks(w, player.pos[0], player.pos[2], settings.rd, 5, 5);
  // égbolt, köd
  const s = updateSky(active ? dt : 0);
  const farBase = settings.rd * 16;
  let fogC = s.fog, near = s.near || farBase * 0.55, far = s.far || farBase * 0.97, clearC = s.sky;
  const inW = player.headWater, eyeBlk = w.getBlock(Math.floor(camera.position.x), Math.floor(camera.position.y), Math.floor(camera.position.z));
  const inLavaEye = FK[eyeBlk] === 2;
  if (inW) { const d = lerp(0.25, 1, dayF); fogC = [0.06 * d + 0.02, 0.18 * d + 0.03, 0.42 * d + 0.05]; near = 0.5; far = 22; clearC = fogC; }
  if (inLavaEye) { fogC = [0.7, 0.2, 0.02]; near = 0.05; far = 2.5; clearC = fogC; }
  G.uFog.value.setRGB(fogC[0], fogC[1], fogC[2]); G.uFogNear.value = near; G.uFogFar.value = far;
  renderer.setClearColor(new THREE.Color(clearC[0], clearC[1], clearC[2]), 1);
  { const dr = game.dim === 'end' ? game.mobs.list.find(m => m.kind === 'dragon' && !m.dead) : null; const bb = $('bossbar'); bb.style.display = dr ? 'block' : 'none'; if (dr) $('bossfill').style.width = Math.max(0, dr.hp / 150 * 100) + '%'; }
  $('water-ov').style.opacity = inW ? 1 : 0; $('lava-ov').style.opacity = inLavaEye ? 1 : 0;
  // kijelölés
  if (target && !ui.open && !player.dead) {
    const b = BLOCKS[target.id]; outline.visible = true;
    if (b.shape === 'torch') { outline.scale.set(0.2, 0.65, 0.2); outline.position.set(target.x + 0.5, target.y + 0.33, target.z + 0.5); }
    else if (b.thin) { outline.scale.set(1, b.thin + 0.05, 1); outline.position.set(target.x + 0.5, target.y + (b.thin + 0.05) / 2, target.z + 0.5); }
    else if (b.shape === 'cross') { outline.scale.set(0.8, 0.8, 0.8); outline.position.set(target.x + 0.5, target.y + 0.4, target.z + 0.5); }
    else { outline.scale.set(1, 1, 1); outline.position.set(target.x + 0.5, target.y + 0.5, target.z + 0.5); }
  } else outline.visible = false;
  if (!game.mining || !mouseL) crackMesh.visible = false;
  // kéz
  updateHandModel(); handGroup.visible = !player.dead && !game.tp; placeHand(dt, game.time);
  // render
  renderer.clear(); renderer.render(scene, camera);
  renderer.clearDepth(); renderer.render(handScene, handCam);
  updateBars();
  if (!$('debug').classList.contains('hidden')) {
    const bx = Math.floor(player.pos[0]), by = Math.floor(player.pos[1]), bz = Math.floor(player.pos[2]);
    const dirs = ['dél (+Z)', 'nyugat (-X)', 'észak (-Z)', 'kelet (+X)'], di = Math.round(((-player.yaw / (Math.PI / 2)) % 4 + 4) % 4) % 4;
    const tt = Math.floor(game.dayTime), hh = Math.floor(((tt / 1000 + 6) % 24)), mm = Math.floor(((tt / 1000 + 6) % 1) * 60);
    $('debug').textContent = `MinePixel 1.20.1 (${fps} fps)\nXYZ: ${player.pos[0].toFixed(2)} / ${player.pos[1].toFixed(2)} / ${player.pos[2].toFixed(2)}\nBlokk: ${bx} ${by} ${bz}   Chunk: ${bx >> 4} ${bz >> 4}\nIrány: ${dirs[di]}\nBiom: ${BIOME_NAMES[w.getBiome(bx, bz)] ?? '?'}\nFény: ég ${w.getSky(bx, by + 1, bz)} blokk ${w.getBlk(bx, by + 1, bz)}\nIdő: ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}\nChunkok: ${w.chunks.size}  Mobok: ${game.mobs.list.length}  Tárgyak: ${game.drops.list.length}\nSeed: ${game.seed}\nMód: ${player.creative ? 'Kreatív' : 'Túlélő'}${target ? `\nCél: ${BLOCKS[target.id].name} (${target.x} ${target.y} ${target.z})` : ''}`;
  }
}

// ---------------- Menük ----------------
const SPLASH = ['Kockás!', 'Pixeles!', 'Bányássz egy kicsit!', 'Vigyázz a creeperekre!', 'Építs valami nagyot!', 'Magyarul!', 'Gyémánt kell!', 'Hu hu hu!', '1.20.1 stílus!', 'Fáklya kell!'];
function bindMenus() {
  $('splash').textContent = SPLASH[(Math.random() * SPLASH.length) | 0];
  const sets = () => {
    $('s-rd').value = settings.rd; $('s-fov').value = settings.fov; $('s-sens').value = settings.sens; $('s-vol').value = settings.vol; $('s-mus').value = settings.mus;
    $('s-rd-v').textContent = settings.rd + ' chunk'; $('s-fov-v').textContent = settings.fov; $('s-sens-v').textContent = settings.sens + '%'; $('s-vol-v').textContent = settings.vol + '%'; $('s-mus-v').textContent = settings.mus + '%';
    $('s-smooth').textContent = 'Szép fény: ' + (settings.smooth ? 'BE' : 'KI'); $('s-clouds').textContent = 'Felhők: ' + (settings.clouds ? 'BE' : 'KI'); $('s-bob').textContent = 'Fejbillegés: ' + (settings.bob ? 'BE' : 'KI');
  };
  for (const [id, key, f] of [['s-rd', 'rd', Number], ['s-fov', 'fov', Number], ['s-sens', 'sens', Number], ['s-vol', 'vol', Number], ['s-mus', 'mus', Number]]) {
    $(id).addEventListener('input', e => { settings[key] = f(e.target.value); sets(); saveSettings(); A.setVolume(settings.vol / 100, settings.mus / 100 * 0.5); if (key === 'fov') { camera.fov = settings.fov; camera.updateProjectionMatrix(); } });
  }
  $('s-smooth').onclick = () => { settings.smooth = !settings.smooth; sets(); saveSettings(); remeshAll(); };
  $('s-clouds').onclick = () => { settings.clouds = !settings.clouds; sets(); saveSettings(); };
  $('s-bob').onclick = () => { settings.bob = !settings.bob; sets(); saveSettings(); };
  A.setVolume(settings.vol / 100, settings.mus / 100 * 0.5);
  let from = 'title';
  const modes = ['survival', 'creative'], diffs = ['Béke', 'Könnyű', 'Normál', 'Nehéz'];
  $('c-mode').onclick = e => { const b = e.target; b.dataset.v = b.dataset.v === 'survival' ? 'creative' : 'survival'; b.textContent = 'Mód: ' + (b.dataset.v === 'survival' ? 'Túlélő' : 'Kreatív'); };
  $('c-online').onclick = e => { const b = e.target; b.dataset.v = b.dataset.v === '1' ? '0' : '1'; b.textContent = 'Barátok meghívása: ' + (b.dataset.v === '1' ? 'BE' : 'KI'); };
  const radii = [12, 24, 40, 64]; let radIdx = 1;
  $('c-rad').onclick = e => { radIdx = (radIdx + 1) % radii.length; e.target.textContent = 'Import méret: ' + radii[radIdx] + ' chunk sugár (' + (radii[radIdx] * 32) + '×' + (radii[radIdx] * 32) + ' blokk)'; };
  $('c-rad').textContent = 'Import méret: ' + radii[radIdx] + ' chunk sugár (' + (radii[radIdx] * 32) + '×' + (radii[radIdx] * 32) + ' blokk)';
  $('c-import').onclick = () => { $('c-files').value = ''; $('c-files').click(); };
  $('c-files').onchange = async e => {
    const files = [...e.target.files]; if (!files.length) return; const info = $('c-impinfo'); info.textContent = 'Beolvasás…'; game.pendingImport = null;
    try {
      const res = await importJavaWorld(files, { radius: radii[radIdx], onProgress: st => { info.textContent = 'Beolvasás… ' + st.chunks + ' chunk'; } });
      game.pendingImport = res; if ($('c-name').value.trim() === '' || $('c-name').value === 'Új világ') $('c-name').value = res.name;
      const un = Object.entries(res.stats.unmapped).sort((a, b) => b[1] - a[1]).slice(0, 4).map(x => x[0]).join(', ');
      info.textContent = `✔ ${res.name}: ${res.stats.chunks} chunk, ${res.stats.chests} láda, ${res.stats.cmds} parancsblokk` + (res.stats.errors ? `, ${res.stats.errors} hibás chunk` : '') + (un ? ` · Ismeretlen blokkok (kőre cserélve): ${un}` : '');
    } catch (err) { info.textContent = '✖ ' + (err.message || err); }
  };
  const tgb = (id, txt) => $(id).onclick = e => { const b = e.target; b.dataset.v = b.dataset.v === '1' ? '0' : '1'; b.textContent = txt + (b.dataset.v === '1' ? 'BE' : 'KI'); };
  tgb('cmd-auto', 'Mindig aktív: '); tgb('cmd-cond', 'Feltételes: ');
  $('cmd-ok').onclick = () => closeCmdUI(true, false); $('cmd-run').onclick = () => closeCmdUI(true, true); $('cmd-cancel').onclick = () => closeCmdUI(false);
  $('cmd-in').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') closeCmdUI(true, false); else if (e.key === 'Escape') closeCmdUI(false); });
  $('c-diff').onclick = e => { const b = e.target; b.dataset.v = (+b.dataset.v + 1) % 4; b.textContent = 'Nehézség: ' + diffs[b.dataset.v]; };
  async function showBackups(s) {
    const bl = await store.backups(s.id);
    if (!bl.length) { toast('Ehhez a világhoz még nincs biztonsági mentés (5 percenként készül)'); return; }
    const txt = bl.map((b, i) => (i + 1) + '. ' + (b.time ? new Date(b.time).toLocaleString('hu-HU') : 'előző mentés') + '  (' + Math.round(b.size / 1024) + ' KB)').join('\n');
    const pick = prompt('„' + s.name + '” biztonsági mentései:\n\n' + txt + '\n\nÍrd be a visszaállítandó mentés sorszámát (a mostani állapot is megmarad másolatként):', '1');
    const n = parseInt(pick, 10); if (!n || n < 1 || n > bl.length) return;
    if (await store.restore(s.id, bl[n - 1].stamp)) { toast('Világ visszaállítva'); showWorlds(); } else toast('A visszaállítás nem sikerült');
  }
  async function showWorlds() {
    showScreen('worlds'); const list = (await store.list()).filter(x => x.id !== SMP.id), el = $('worldlist'); el.innerHTML = '';
    if (!list.length) el.innerHTML = '<div class="empty">Még nincs mentett világ.<br>Hozz létre egyet!</div>';
    for (const s of list) {
      const d = document.createElement('div'); d.className = 'world';
      d.innerHTML = `<div class="wi"><div class="wn"></div><div class="wd"></div></div><div class="bak">Mentések</div><div class="del">Törlés</div>`;
      d.querySelector('.wn').textContent = s.name; d.querySelector('.wd').textContent = `${s.mode === 'creative' ? 'Kreatív' : 'Túlélő'} · seed ${s.seed} · ${new Date(s.time).toLocaleString('hu-HU')}`;
      d.onclick = async e => { if (e.target.classList.contains('bak')) { showBackups(s); return; } if (e.target.classList.contains('del')) { if (confirm('Biztosan törlöd ezt a világot?')) { await store.del(s.id); showWorlds(); } return; } const save = await store.read(s.id); if (save) { save.id = s.id; disposeWorld(); startWorld(save); } };
      el.appendChild(d);
    }
  }
  document.addEventListener('click', e => {
    const act = e.target.dataset && e.target.dataset.act; if (!act) return;
    A.initAudio(); A.sndClick();
    switch (act) {
      case 'play': showWorlds(); break;
      case 'newworld': game.pendingImport = null; $('c-impinfo').textContent = ''; showScreen('create'); break;
      case 'back-title': showScreen('title'); break;
      case 'back-worlds': showWorlds(); break;
      case 'settings': from = 'title'; sets(); showScreen('settings'); break;
      case 'settings-ingame': from = 'pause'; sets(); showScreen('settings'); break;
      case 'settings-done': showScreen(from); break;
      case 'fullscreen': if (window.mp) window.mp.fullscreen(!document.fullscreenElement); else if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); break;
      case 'quit': if (window.mp) window.mp.quit(); else window.close(); break;
      case 'docreate': {
        const name = $('c-name').value.trim() || 'Új világ', sv = $('c-seed').value.trim();
        const seed = sv === '' ? (Math.random() * 2147483647) | 0 : (/^-?\d+$/.test(sv) ? parseInt(sv, 10) | 0 : hashString(sv) | 0);
        const imp = game.pendingImport; game.pendingImport = null; $('c-impinfo').textContent = '';
        disposeWorld(); startWorld(null, { id: 'w' + Date.now(), name, seed: imp ? imp.seed : seed, mode: $('c-mode').dataset.v, diff: +$('c-diff').dataset.v, online: $('c-online').dataset.v === '1', import: imp });
        break;
      }
      case 'resume': resumeGame(); break;
      case 'savequit': quitToTitle(); break;
      case 'respawn': respawn(); break;
    }
  });
  window.addEventListener('keydown', e => { if (e.code === 'F11' && window.mp) { e.preventDefault(); window.mp.fullscreen(!document.fullscreenElement); } });
}
window.addEventListener('beforeunload', () => { if (game.state === 'play') saveGame(true); });


// ---------------- Multiplayer UI ----------------
const net = game.net;
const pname = () => { if (!(settings.pname || '').trim()) { settings.pname = 'Játékos' + (100 + (Math.random() * 900 | 0)); saveSettings(); } return settings.pname.trim(); };
const loadFriends = () => { try { return JSON.parse(localStorage.getItem('minepixel.friends') || '[]'); } catch { return []; } };
const saveFriends = l => { try { localStorage.setItem('minepixel.friends', JSON.stringify(l)); } catch {} };
function addFriend(name, code) {
  name = (name || '').trim().slice(0, 16); code = (code || '').trim(); if (!name || !parseCode(code)) return false;
  const l = loadFriends(), f = l.find(x => x.name.toLowerCase() === name.toLowerCase()); if (f) f.code = code; else l.push({ name, code }); saveFriends(l); return true;
}
const roomKey = () => { let r = ''; try { r = localStorage.getItem('minepixel.room') || ''; } catch {} if (!r) { r = randomRoom(); try { localStorage.setItem('minepixel.room', r); } catch {} } return r; };
function setStatus(id, msg, cls) { const e = $(id); e.textContent = msg || ''; e.className = 'status ' + (cls || ''); }
const ERR = { bad_code: 'Érvénytelen meghívó kód.', no_room: 'Nincs ilyen nyitott világ (a host offline, vagy a kód hibás).', full: 'A világ megtelt.', timeout: 'Időtúllépés – a szerver nem válaszol.', unreachable: 'A szerver nem érhető el. Ellenőrizd a címet / a port továbbítást (25566).', kick: 'A host eltávolított a világból.', host: 'A host kilépett a világból.', closed: 'A kapcsolat megszakadt.', lost: 'A kapcsolat megszakadt.', room_taken: 'Ez a szoba kód már foglalt.', server_start: 'A beépített szerver nem indult el (foglalt a 25566-os port?).', no_relay: 'Böngészőben relay szerver cím kell (Barátok → Haladó).', bad_url: 'Hibás szerver cím.', no_gateway: 'Nincs beállítva a MinePixelSS gateway (Barátok → Haladó → Gateway).', denied: 'Hibás admin kulcs – a szervert csak az admin indíthatja.' };
const errTxt = e => (e && /^deny:/.test(e.message) ? e.message.slice(5) : null) || ERR[e && e.message] || ('Hiba: ' + (e && e.message));
function copyText(t) { try { navigator.clipboard.writeText(t); return true; } catch { try { const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); return true; } catch { return false; } } }

function showFriends() {
  showScreen('friends'); $('f-name').value = pname(); $('f-relay').value = settings.relay || ''; $('f-gateway').value = settings.gateway || ''; setStatus('f-status', '');
  const el = $('friendlist'); el.innerHTML = ''; const l = loadFriends();
  if (!l.length) el.innerHTML = '<div class="empty">Még nincs barátod a listán.<br>Add hozzá a nevét és a meghívó kódját, vagy csatlakozz egy kóddal – a host automatikusan felkerül a listára.</div>';
  for (const f of l) {
    const d = document.createElement('div'); d.className = 'friend';
    d.innerHTML = '<div class="fi"><div class="fn"><span class="dot"></span><span class="nm"></span></div><div class="fs">Ellenőrzés…</div></div><button class="btn green small jn disabled">Csatlakozás</button><button class="btn small dl">✕</button>';
    d.querySelector('.nm').textContent = f.name; el.appendChild(d);
    d.querySelector('.dl').onclick = () => { saveFriends(loadFriends().filter(x => x.name !== f.name)); showFriends(); };
    d.querySelector('.jn').onclick = () => doJoin(f.code);
    pingRoom(f.code).then(r => {
      if (!document.body.contains(d)) return; const dot = d.querySelector('.dot'), fs = d.querySelector('.fs'), jn = d.querySelector('.jn');
      if (r && r.ok) { dot.className = 'dot on'; const w = String(r.name || '').split('|')[1] || 'világ'; fs.textContent = `Online · ${w} · ${r.players} játékos`; jn.classList.remove('disabled'); }
      else { dot.className = 'dot off'; fs.textContent = 'Nincs nyitott világ'; }
    });
  }
}
async function doJoin(code) {
  A.initAudio(); code = (code || '').trim();
  if (!parseCode(code)) { setStatus('f-status', parseSsName(code) ? ERR.no_gateway : ERR.bad_code, 'err'); return; }
  setStatus('f-status', 'Csatlakozás…'); net.token = playerToken();
  let init;
  try { init = await net.join(code, pname()); } catch (e) { setStatus('f-status', errTxt(e), 'err'); return; }
  addFriend(init.smp ? init.wname : init.hostName, net.info.code);
  const me = init.me;
  const save = { id: 'mp_' + Date.now(), dim: init.dim, name: init.wname, seed: init.seed, mode: init.smp ? 'survival' : init.mode, diff: init.diff, day: init.day, spawn: init.spawn, rules: init.rules, chunks: init.chunks, facing: init.facing, containers: init.containers,
    player: me ? me.player : { pos: [init.hostPos[0] + 1, init.hostPos[1], init.hostPos[2]], yaw: 0, pitch: 0, health: 20, food: 20, sat: 5, xp: 0, level: 0, hot: 0 }, inv: me ? me.inv : [], armor: me ? me.armor : [] };
  disposeWorld(); await startWorld(save, { client: true, smp: !!init.smp, smpInit: init.smp });
  game.chatAdd('', 'Csatlakoztál: ' + init.wname + (init.smp ? '' : ' (host: ' + init.hostName + ')') + '. T: chat · Tab: játékosok', true);
}
async function doHost(auto) {
  if (net.isHost) return net.info;
  setStatus('h-status', 'Szerver indítása…');
  const mk = room => net.startHosting({ name: pname(), worldName: game.name, relay: (settings.relay || '').trim(), room });
  try {
    try { await mk(roomKey()); } catch (e) { if (e.message === 'room_taken') await mk(randomRoom()); else throw e; }
    setStatus('h-status', 'A világ nyitva van – a barátaid csatlakozhatnak a kóddal.', 'ok');
    if (auto) { game.chatAdd('', 'Online világ megnyitva. Meghívó kód: ' + net.info.code + ' (a vágólapra másolva, Szünet → Barátok meghívása)', true); copyText(net.info.code); }
    renderHost(); updateBadge(); return net.info;
  } catch (e) { setStatus('h-status', errTxt(e), 'err'); if (auto) toast('Online indítás sikertelen: ' + errTxt(e)); updateBadge(); return null; }
}
function renderHost() {
  const codes = $('h-codes'), pl = $('h-players'), fr = $('h-friends');
  codes.innerHTML = ''; pl.innerHTML = ''; fr.innerHTML = '';
  $('h-stop').style.display = net.isHost ? '' : 'none';
  if (!net.isHost) { codes.innerHTML = '<div class="empty">A világ jelenleg nincs megnyitva.</div>'; return; }
  const i = net.info, rows = [];
  if (i.relay) rows.push(['Meghívó kód (relay)', i.code]); else {
    rows.push(['Helyi hálózat (LAN)', i.code]); for (const ip of (i.ips || []).slice(1)) rows.push(['Másik cím', i.room + '@' + ip + ':' + (i.addr.split(':')[1] || '25566')]);
    rows.push(['Internet (25566 port!)', i.publicCode || '… lekérdezés …']);
  }
  for (const [lab, code] of rows) {
    const d = document.createElement('div'); d.className = 'codebox'; d.innerHTML = '<div class="cl"></div><div class="cv"></div><button class="btn small">Másolás</button>';
    d.querySelector('.cl').textContent = lab; d.querySelector('.cv').textContent = code;
    d.querySelector('button').onclick = e => { if (parseCode(code)) { copyText(code); e.target.textContent = 'Másolva ✓'; } };
    codes.appendChild(d);
  }
  for (const p of net.names()) {
    const d = document.createElement('div'); d.className = 'plrow'; d.innerHTML = '<div class="pn"></div>'; d.firstChild.textContent = p.name + (p.host ? ' (host)' : '');
    if (p.cid) { const b = document.createElement('button'); b.className = 'btn small red'; b.textContent = 'Kirúgás'; b.onclick = () => net.kick(p.cid); d.appendChild(b); }
    pl.appendChild(d);
  }
  const fl = loadFriends();
  if (!fl.length) fr.innerHTML = '<div class="empty">Adj hozzá barátokat a főmenü → Barátok oldalon.</div>';
  for (const f of fl) {
    const d = document.createElement('div'); d.className = 'plrow'; d.innerHTML = '<div class="pn"></div><button class="btn small">Meghívó szöveg másolása</button>'; d.firstChild.textContent = f.name;
    d.querySelector('button').onclick = e => { copyText('Szia ' + f.name + '! Gyere a MinePixel világomba: ' + net.info.code); e.target.textContent = 'Másolva ✓'; };
    fr.appendChild(d);
  }
}
async function openHostScreen() { showScreen('host'); renderHost(); await doHost(); renderHost(); }
function updateBadge() {
  const b = $('netbadge'); if (!net.active) { b.classList.add('hidden'); return; }
  b.classList.remove('hidden'); b.textContent = '● ' + (net.isHost ? 'Online (host)' : 'Online') + ' · ' + net.count() + ' játékos';
}
function showPlist(on) {
  const e = $('plist'); if (!on || !net.active) { e.classList.add('hidden'); return; }
  e.classList.remove('hidden'); e.innerHTML = '';
  for (const p of net.names()) { const d = document.createElement('div'); d.className = 'pr'; d.textContent = p.name + (p.me ? ' (te)' : ''); if (game.smpMode ? game.smp.me.admins.has(p.name.toLowerCase()) : p.host) { const s = document.createElement('small'); s.textContent = game.smpMode ? 'admin' : 'host'; d.appendChild(s); } e.appendChild(d); }
}
game.onNetPlayers = () => { updateBadge(); if (!$('host').classList.contains('hidden')) renderHost(); };
game.onHostInfo = () => { if (!$('host').classList.contains('hidden')) renderHost(); };
game.onNetClosed = async why => {
  if (why === 'lost-host') { toast('Az online kapcsolat megszakadt – a világ offline folytatódik'); updateBadge(); if (!$('host').classList.contains('hidden')) renderHost(); return; }
  if (game.state === 'play') { const wasSmp = game.smpMode, msg = net.lastDeny || ERR[why] || ERR.lost; await quitToTitle(); if (wasSmp) { await showSmp(); setStatus('smp-status', msg, 'err'); } else { showFriends(); setStatus('f-status', msg, 'err'); } }
};
game.chatAdd = (n, m, sys) => {
  const box = $('chat'), d = document.createElement('div'); d.className = 'msg' + (sys ? ' sys' : '');
  if (n) { const b = document.createElement('b'); b.textContent = n + ': '; d.appendChild(b); } d.appendChild(document.createTextNode(m)); box.appendChild(d);
  while (box.children.length > 60) box.firstChild.remove(); setTimeout(() => d.classList.add('old'), 9000);
};
function openChat(pre) { game.chatOpen = true; for (const k in keys) keys[k] = false; mouseL = mouseR = false; $('chat').classList.add('open'); const i = $('chat-in'); i.classList.remove('hidden'); i.value = pre || ''; game.expectUnlock = true; if (document.pointerLockElement) document.exitPointerLock(); setTimeout(() => i.focus(), 0); }
function closeChat(send) {
  const i = $('chat-in'), t = i.value.trim(); game.chatOpen = false; i.classList.add('hidden'); i.blur(); $('chat').classList.remove('open');
  if (send && t && t[0] === '/') { runCommand(t); }
  else if (send && t) { if (net.isHost && game.smpMode) { const e = game.smp.chatCheck(net.myName), n = game.smp.chatName(net.myName); if (e) game.chatAdd('', '✖ ' + e, true); else if (game.plugins.emit('chat', { name: net.myName, message: t }).cancelled) { /* plugin megállította */ } else { game.chatAdd(n, t.slice(0, 200)); net.bcast({ t: 'chat', n, m: t.slice(0, 200) }); } } else if (net.isHost) { game.chatAdd(net.myName, t.slice(0, 200)); net.bcast({ t: 'chat', n: net.myName, m: t.slice(0, 200) }); } else if (net.isClient) net.send({ t: 'chat', m: t }); else game.chatAdd(pname(), t.slice(0, 200)); }
  if (game.state === 'play' && !game.paused && !ui.open && !player.dead) lockPointer();
}
$('chat-in').addEventListener('keydown', e => { e.stopPropagation(); if (e.code === 'Enter') { e.preventDefault(); closeChat(true); } else if (e.code === 'Escape') { e.preventDefault(); closeChat(false); } });
$('f-name').addEventListener('input', e => { settings.pname = e.target.value.slice(0, 16); saveSettings(); });
$('f-gateway').addEventListener('input', e => { settings.gateway = e.target.value.trim(); saveSettings(); setGateway(settings.gateway); });
$('f-relay').addEventListener('input', e => { settings.relay = e.target.value.trim(); saveSettings(); });
document.addEventListener('click', async e => {
  const act = e.target.dataset && e.target.dataset.act; if (!act) return;
  switch (act) {
    case 'friends': A.initAudio(); showFriends(); break;
    case 'smp': A.initAudio(); showSmp(); break;
    case 'smp-refresh': showSmp(); break;
    case 'smp-join': smpJoin(); break;
    case 'smp-host': smpHost(); break;
    case 'shop-open': openShop(); break;
    case 'shop-close': resumeGame(); break;
    case 'f-join': doJoin($('f-code').value); break;
    case 'f-add': { const ok = addFriend($('f-addname').value, $('f-addcode').value); setStatus('f-status', ok ? 'Barát hozzáadva.' : 'Adj meg egy nevet és egy érvényes meghívó kódot (pl. K7Q2MX@192.168.1.5:25566).', ok ? 'ok' : 'err'); if (ok) { $('f-addname').value = ''; $('f-addcode').value = ''; showFriends(); setStatus('f-status', 'Barát hozzáadva.', 'ok'); } break; }
    case 'f-refresh': showFriends(); break;
    case 'invite': openHostScreen(); break;
    case 'h-stop': await net.stopHosting(); updateBadge(); renderHost(); setStatus('h-status', 'Az online mód ki van kapcsolva.'); break;
    case 'h-back': showScreen('pause'); break;
  }
});

// ---------------- MinePixel SMP ----------------
game.smp = new Smp(game); game.plugins = new Plugins(game);
game.onSmpUpdate = () => renderSidebar(game);
const playerToken = () => { let t = ''; try { t = localStorage.getItem('minepixel.tok') || ''; } catch {} if (t.length < 16) { t = Array.from(crypto.getRandomValues(new Uint8Array(20)), b => b.toString(16).padStart(2, '0')).join(''); try { localStorage.setItem('minepixel.tok', t); } catch {} } return t; };
const smpAddr = () => (settings.smpAddr || SMP.defaultAddr || '').trim();
async function showSmp() {
  showScreen('smp'); $('smp-name').value = pname(); $('smp-addr').value = smpAddr(); $('smp-key').value = settings.smpKey || ''; $('smp-code').value = settings.smpCode || ''; setStatus('smp-status', '');
  const dot = $('smp-dot'), info = $('smp-info'), jn = $('smp-join'); dot.className = 'dot'; info.textContent = 'Ellenőrzés…'; jn.classList.add('disabled');
  if (!smpAddr()) { dot.className = 'dot off'; info.textContent = 'Nincs szerver cím megadva (Szerver beállítások).'; return; }
  const t0 = performance.now(), r = await pingRoom(SMP.room + '@' + smpAddr(), 4500); if ($('smp').classList.contains('hidden')) return;
  if (r && r.ok) { dot.className = 'dot on'; info.textContent = `Online · ${r.players} játékos · ${Math.round(performance.now() - t0)} ms`; jn.classList.remove('disabled'); }
  else { dot.className = 'dot off'; info.textContent = 'Offline – az admin még nem indította el a szervert.'; }
}
$('smp-name').addEventListener('input', e => { settings.pname = e.target.value.slice(0, 16); saveSettings(); });
$('smp-addr').addEventListener('input', e => { settings.smpAddr = e.target.value.trim(); saveSettings(); });
$('smp-code').addEventListener('input', e => { settings.smpCode = e.target.value; saveSettings(); });
$('smp-key').addEventListener('input', e => { settings.smpKey = e.target.value; saveSettings(); });
async function smpJoin() {
  A.initAudio(); const addr = smpAddr(); if (!addr) return setStatus('smp-status', 'Add meg a szerver címét (Szerver beállítások).', 'err');
  const code = SMP.room + '@' + addr; if (!parseCode(code)) return setStatus('smp-status', ERR.bad_code, 'err');
  setStatus('smp-status', 'Csatlakozás…'); net.token = playerToken();
  let init; try { init = await net.join(code, pname()); } catch (e) { return setStatus('smp-status', errTxt(e), 'err'); }
  if (!init.smp) { net.leave(); return setStatus('smp-status', 'Ez nem MinePixel SMP szerver.', 'err'); }
  const me = init.me, save = { id: 'mp_smp', dim: init.dim, name: init.wname, seed: init.seed, mode: 'survival', diff: init.diff, day: init.day, spawn: init.spawn, rules: init.rules, chunks: init.chunks, facing: init.facing, containers: init.containers,
    player: me ? me.player : { pos: [init.hostPos[0] + 1, init.hostPos[1], init.hostPos[2]], yaw: 0, pitch: 0, health: 20, food: 20, sat: 5, xp: 0, level: 0, hot: 0 }, inv: me ? me.inv : [], armor: me ? me.armor : [] };
  disposeWorld(); await startWorld(save, { client: true, smp: true, smpInit: init.smp });
}
async function smpHost() {
  A.initAudio(); setStatus('smp-status', 'Szerver betöltése…'); net.token = playerToken();
  const save = await store.read(SMP.id); disposeWorld();
  if (save) { save.id = SMP.id; await startWorld(save, { smp: true }); }
  else await startWorld(null, { id: SMP.id, name: SMP.name, seed: hashString('MinePixel SMP') | 0, mode: 'survival', diff: 2, smp: true });
}
async function smpHostStart() {
  const addr = smpAddr(), relay = /^wss?:\/\//i.test(addr) ? addr : '';
  try {
    await net.startHosting({ name: pname(), worldName: SMP.name, relay, room: SMP.room, key: (settings.smpKey || '').trim() });
    game.plugins.loadAll([]); game.smp.setAdminCode(settings.smpCode); game.smp.hostReady(net.myName); game.smp.pushSb(net.myName); updateBadge();
    game.chatAdd('', 'A MinePixel SMP elindult – te vagy az admin.' + (relay ? '' : ' A játékosok ezzel a címmel csatlakozhatnak: ' + net.info.addr + (net.info.publicCode ? ' (internetről: ' + net.info.publicCode.split('@')[1] + ')' : '')), true);
  } catch (e) { game.chatAdd('', '✖ A szerver online indítása sikertelen: ' + errTxt(e), true); toast('Online indítás sikertelen: ' + errTxt(e)); }
}
const shop = initShop(game, { buy: (id, n) => smpBuy(id, n), sell: l => smpSell(l) });
function openShop() {
  if (!game.smpMode || game.state !== 'play' || player.dead) return;
  game.expectUnlock = true; if (document.pointerLockElement) document.exitPointerLock(); mouseL = mouseR = false; game.paused = true; showScreen('shop'); shop.open();
}
function smpBuy(id, n) { if (net.isHost) game.smp.buy({ name: net.myName, me: true }, id, n); else net.send({ t: 'buy', id, n }); }
function smpSell(list) {
  const out = [];
  for (const [id, n] of list) { let left = n; for (let i = 0; i < 36 && left > 0; i++) { const sl = inv.slots[i]; if (sl && sl.id === id && !(sl.d > 0)) { const k = Math.min(left, sl.n); inv.take(i, k); left -= k; } } if (n - left > 0) out.push([id, n - left]); }
  refreshHotbar(); if (!out.length) return;
  if (net.isHost) game.smp.sell({ name: net.myName, me: true }, out); else net.send({ t: 'sell', l: out });
}
function smpSellCmd(a) {
  const w = (a[0] || '').toLowerCase(), err = m => game.chatAdd('', '✖ ' + m, true);
  if (['hand', 'kez', 'kéz'].includes(w)) { const s = inv.slots[player.hot]; if (!s || sellPrice(s.id) <= 0 || s.d > 0) return err('A kezedben lévő tárgyat nem veszi meg a bolt.'); const n = a[1] ? Math.min(s.n, Math.max(1, +a[1] | 0)) : s.n; return smpSell([[s.id, n]]); }
  if (['all', 'mind'].includes(w)) { const m = new Map(); for (const s of inv.slots) if (s && sellPrice(s.id) > 0 && !(s.d > 0)) m.set(s.id, (m.get(s.id) || 0) + s.n); if (!m.size) return err('Nincs eladható tárgyad.'); return smpSell([...m]); }
  err('Használat: /sell hand [db]  |  /sell all');
}

// ---------------- Parancsok ----------------
const RULE_NAMES = { keepinventory: 'keepInventory', pvp: 'pvp', dodaylightcycle: 'doDaylightCycle', domobspawning: 'doMobSpawning', mobgriefing: 'mobGriefing', falldamage: 'fallDamage' };
const RULE_HU = { keepInventory: 'megtartod a cuccaidat halálkor', doDaylightCycle: 'telik az idő (nappal/éjjel)', doMobSpawning: 'mobok spawnolása', mobGriefing: 'a creeper rombolja a blokkokat', fallDamage: 'esési sebzés', pvp: 'játékosok sebezhetik egymást (PvP)' };
function teleport(x, y, z) { player.pos = [x, y, z]; player.vel = [0, 0, 0]; player.fall = 0; game.mining = null; }
game.teleport = teleport; game.igniteTNT = igniteTNT; game.spawnTntVisual = (x, y, z, t) => spawnTntVisual(x, y, z, t, true);
function findItem(q) {
  q = q.toLowerCase().replace(/^minecraft:/, '').replace(/[ -]/g, '_'); if (/^\d+$/.test(q)) { const id = +q; return itemDef(id) ? id : null; }
  for (const o of [B, I]) for (const k in o) if (k.toLowerCase() === q) return o[k];
  const all = [...Object.keys(BLOCKS), ...Object.keys(ITEMS)].map(Number).filter(id => id > 0 && itemDef(id));
  const hu = q.replace(/_/g, ' ');
  return all.find(id => itemDef(id).name.toLowerCase() === hu) ?? all.find(id => itemDef(id).name.toLowerCase().includes(hu)) ?? (() => { for (const o of [B, I]) for (const k in o) if (k.toLowerCase().includes(q)) return o[k]; return null; })();
}
const parseBool = v => ['true', 'igen', 'be', 'on', '1', 'yes'].includes(String(v).toLowerCase()) ? true : ['false', 'nem', 'ki', 'off', '0', 'no'].includes(String(v).toLowerCase()) ? false : null;
// ---- parancsblokk szerkesztő ----
let cmdCtx = null;
function openCmdUI(t) {
  const k = t.x + ',' + t.y + ',' + t.z, c = game.world.containers.get(k) || { slots: [], cmd: '', auto: false, cond: false };
  cmdCtx = { x: t.x, y: t.y, z: t.z, k, id: t.id }; game.chatOpen = true; for (const kk in keys) keys[kk] = false; mouseL = mouseR = false;
  $('cmd-title').textContent = BLOCKS[t.id].name + ' (' + t.x + ' ' + t.y + ' ' + t.z + ')'; $('cmd-in').value = c.cmd || '';
  const tg = (id, on, txt) => { $(id).dataset.v = on ? '1' : '0'; $(id).textContent = txt + (on ? 'BE' : 'KI'); };
  tg('cmd-auto', c.auto, 'Mindig aktív: '); tg('cmd-cond', c.cond, 'Feltételes: ');
  $('cmd-run').classList.toggle('hidden', net.isClient); $('cmdui').classList.remove('hidden'); game.expectUnlock = true; if (document.pointerLockElement) document.exitPointerLock(); setTimeout(() => $('cmd-in').focus(), 50);
}
function closeCmdUI(save, run) {
  if (!cmdCtx) return; const c = cmdCtx; cmdCtx = null; $('cmdui').classList.add('hidden'); game.chatOpen = false;
  if (save) {
    const v = { slots: [], cmd: $('cmd-in').value.trim().slice(0, 256), auto: $('cmd-auto').dataset.v === '1', cond: $('cmd-cond').dataset.v === '1' };
    game.world.containers.set(c.k, v); if (net.isClient) net.send({ t: 'cmdset', k: c.k, v });
    if (run && !net.isClient) game.rs.runCmd(c.x, c.y, c.z, 0); else if (!net.isClient) game.rs.touch(c.x, c.y, c.z);
  }
  if (game.state === 'play' && !game.paused && !ui.open && !player.dead) lockPointer();
}
game.setCmdBlock = (k, v) => { if (v && typeof v.cmd === 'string') { game.world.containers.set(k, { slots: [], cmd: v.cmd.slice(0, 256), auto: !!v.auto, cond: !!v.cond }); const [x, y, z] = k.split(',').map(Number); game.rs.touch(x, y, z); } };
// ---- parancsblokk-parancsok (host / egyjátékos) ----
function cmdPlayers() {
  const me = { me: true, name: net.active ? net.myName : pname(), pos: player.pos };
  const rem = net.active ? [...net.remotes.values()].filter(r => r.pos && r.cid).map(r => ({ cid: r.cid, name: r.name, pos: r.pos })) : [];
  return [me, ...rem];
}
function cmdTargets(sel, o) {
  if (!sel) return [];
  const ps = cmdPlayers(); sel = sel.trim();
  if (sel[0] !== '@') { const p = ps.find(q => q.name.toLowerCase() === sel.toLowerCase()); return p ? [p] : []; }
  const k = sel[1], d = p => (p.pos[0] - o[0]) ** 2 + (p.pos[1] - o[1]) ** 2 + (p.pos[2] - o[2]) ** 2;
  if (k === 'a') return ps; if (k === 'r') return [ps[(Math.random() * ps.length) | 0]];
  if (k === 'e') { const t = (sel.match(/type=(?:minecraft:)?(\w+)/) || [])[1]; return game.mobs.list.filter(m => !t || m.kind === t).map(m => ({ mob: m, name: m.kind, pos: m.pos })); }
  return [ps.slice().sort((a, b) => d(a) - d(b))[0]];   // @p, @s
}
function runBlockCommand(line, ox, oy, oz) {
  line = line.trim().replace(/^\//, ''); if (!line) return false;
  const w = game.world, o = [ox + 0.5, oy, oz + 0.5];
  const chat = m => { game.chatAdd('', m, true); if (net.isHost) net.bcast({ t: 'chat', n: '', m }); };
  let t = line.split(/\s+/); const cmd = (t.shift() || '').toLowerCase().replace(/^minecraft:/, '');
  const rest = t.join(' '), jsonText = s => { const m = s.match(/\{.*\}|\[.*\]/); if (!m) return s; try { const j = JSON.parse(m[0]); const f = x => typeof x === 'string' ? x : Array.isArray(x) ? x.map(f).join('') : (x.text || '') + (x.extra ? f(x.extra) : ''); return f(j); } catch { return s; } };
  const xyz = (a, b, c) => [coord(a, o[0]), coord(b, o[1]), coord(c, o[2])];
  const blk = tok => { const m = (tok || '').match(/^([\w:]+)(?:\[(.*)\])?$/); if (!m) return null; const pr = {}; if (m[2]) for (const kv of m[2].split(',')) { const [k, v] = kv.split('='); pr[k.trim()] = (v || '').trim(); } const r = blockFromName(m[1], pr); return (r.kind === 'unknown' && !/^(minecraft:)?stone$/.test(m[1])) ? null : r; };
  const put = (x, y, z, r) => { x = Math.floor(x); y = Math.floor(y); z = Math.floor(z); if (y < 0 || y >= 128) return false; const k = x + ',' + y + ',' + z; if (r.facing !== undefined) w.facing.set(k, r.facing); else w.facing.delete(k); return w.setBlock(x, y, z, r.id) !== false; };
  switch (cmd) {
    case 'say': chat('[Parancsblokk] ' + rest); return true;
    case 'tellraw': { const tg = cmdTargets(t[0], o); if (!tg.length) return false; const m = jsonText(t.slice(1).join(' ')); for (const p of tg) { if (p.me) game.chatAdd('', m, true); else if (p.cid) net.sendTo(p.cid, { t: 'chat', n: '', m }); } return true; }
    case 'title': { const tg = cmdTargets(t[0], o); const m = jsonText(t.slice(2).join(' ')); if (!tg.length || !m) return false; for (const p of tg) { if (p.me) toast(m); else if (p.cid) net.sendTo(p.cid, { t: 'chat', n: '', m }); } return true; }
    case 'tp': case 'teleport': {
      let tg, rest2 = t; if (/^(@|[A-Za-z_])/.test(t[0] || '') && !/^~/.test(t[0])) { tg = cmdTargets(t[0], o); rest2 = t.slice(1); } else tg = cmdTargets('@p', o);
      if (!tg.length || !tg[0].name) return false; let pos;
      if (rest2.length >= 3) pos = xyz(rest2[0], rest2[1], rest2[2]); else if (rest2.length === 1) { const d = cmdTargets(rest2[0], o)[0]; if (!d) return false; pos = d.pos.slice(); } else return false;
      if (pos.some(isNaN)) return false;
      for (const p of tg) { if (p.me) teleport(pos[0], pos[1], pos[2]); else if (p.cid) net.sendTo(p.cid, { t: 'tp', x: pos[0], y: pos[1], z: pos[2] }); }
      return true;
    }
    case 'give': {
      const tg = cmdTargets(t[0], o); if (!tg.length) return false; let n = 1; const args = t.slice(1); if (args.length > 1 && /^\d+$/.test(args[args.length - 1])) n = Math.min(2304, +args.pop());
      const id = itemFromName(args[0] || '') || findItem(args.join(' ')); if (!id) return false;
      for (const p of tg) { if (p.me) { let left = n; while (left > 0) { const k = Math.min(left, maxStack(id)), r = inv.add(id, k); if (r > 0) game.dropItem(id, r, player.pos[0], player.pos[1] + 1, player.pos[2]); left -= k; } refreshHotbar(); } else if (p.cid) net.sendTo(p.cid, { t: 'give', id, n }); }
      return true;
    }
    case 'kill': { const tg = cmdTargets(t[0] || '@s', o); if (!tg.length) return false; for (const p of tg) { if (p.mob) game.mobs.kill(p.mob); else if (p.me) die('void'); else if (p.cid) net.sendTo(p.cid, { t: 'hurt', dmg: 1000, sx: 0, sz: 0, src: 'void' }); } return true; }
    case 'setblock': { if (t.length < 4) return false; const [x, y, z] = xyz(t[0], t[1], t[2]), r = blk(t[3]); if (!r || [x, y, z].some(isNaN)) return false; return put(x, y, z, r); }
    case 'fill': {
      if (t.length < 7) return false; const a = xyz(t[0], t[1], t[2]), b = xyz(t[3], t[4], t[5]), r = blk(t[6]); if (!r || a.concat(b).some(isNaN)) return false;
      const mode = (t[7] || 'replace').toLowerCase(), filt = mode === 'replace' && t[8] ? blk(t[8]) : null; const lo = a.map((v, i) => Math.floor(Math.min(v, b[i]))), hi = a.map((v, i) => Math.floor(Math.max(v, b[i])));
      if ((hi[0] - lo[0] + 1) * (hi[1] - lo[1] + 1) * (hi[2] - lo[2] + 1) > 32768) return false; let n = 0;
      for (let x = lo[0]; x <= hi[0]; x++) for (let y = lo[1]; y <= hi[1]; y++) for (let z = lo[2]; z <= hi[2]; z++) {
        const edge = x === lo[0] || x === hi[0] || y === lo[1] || y === hi[1] || z === lo[2] || z === hi[2], cur = w.getBlock(x, y, z);
        if (mode === 'keep' && cur) continue; if (filt && cur !== filt.id) continue; if (mode === 'hollow' && !edge) { put(x, y, z, { id: 0 }); n++; continue; } if (mode === 'outline' && !edge) continue;
        if (put(x, y, z, r)) n++;
      } return n > 0;
    }
    case 'summon': { const kind = (t[0] || '').replace(/^minecraft:/, ''); const p = t.length >= 4 ? xyz(t[1], t[2], t[3]) : [o[0], o[1] + 1, o[2]]; if (p.some(isNaN)) return false; try { return !!game.mobs.spawn(kind, p[0], p[1], p[2]); } catch { return false; } }
    case 'time': { const sub = (t[0] || '').toLowerCase(), v = (t[1] || '').toLowerCase(); const named = { day: 1000, noon: 6000, night: 13000, midnight: 18000 }; if (sub === 'set' && (v in named || /^\d+$/.test(v))) { game.dayTime = v in named ? named[v] : (+v) % 24000; return true; } if (sub === 'add' && /^-?\d+$/.test(v)) { game.dayTime = ((game.dayTime + +v) % 24000 + 24000) % 24000; return true; } return false; }
    case 'gamerule': { const key = RULE_NAMES[(t[0] || '').toLowerCase()], v = parseBool(t[1]); if (!key || v === null) return false; game.rules[key] = v; if (net.isHost) net.bcast({ t: 'rules', r: game.rules }); return true; }
    case 'gamemode': { const v = (t[0] || '').toLowerCase(), c = ['creative', 'c', '1'].includes(v), sv = ['survival', 's', '0'].includes(v); if (!c && !sv) return false; const tg = cmdTargets(t[1] || '@p', o); if (tg.some(p => p.me)) { player.creative = c; game.mode = c ? 'creative' : 'survival'; if (!c) player.flying = false; updateBars(true); } return true; }
    case 'difficulty': { const m = { peaceful: 0, easy: 1, normal: 2, hard: 3 }, v = m[(t[0] || '').toLowerCase()]; if (v === undefined) return false; game.difficulty = v; return true; }
    case 'execute': { const i = t.indexOf('run'); if (i < 0) return false; return runBlockCommand(t.slice(i + 1).join(' '), ox, oy, oz); }
    case 'playsound': case 'particle': case 'effect': case 'weather': case 'scoreboard': case 'data': case 'advancement': case 'xp': case 'experience': case 'clear': case 'enchant': case 'bossbar': case 'team': case 'tag': case 'function': return true;   // nem támogatott, de nem hibázik
    default: return false;
  }
}
game.runBlockCommand = runBlockCommand;
function coord(tok, cur) { if (tok[0] === '~') { const n = tok.length > 1 ? parseFloat(tok.slice(1)) : 0; return isNaN(n) ? NaN : cur + n; } return parseFloat(tok); }
function runCommand(line) {
  const say = m => game.chatAdd('', m, true), err = m => game.chatAdd('', '✖ ' + m, true);
  const a = line.trim().slice(1).split(/\s+/), cmd = (a.shift() || '').toLowerCase(), isMP = net.active, hostOnly = () => { if (net.isClient) { err('Ezt a parancsot csak a host használhatja.'); return true; } return false; };
  const pos = player.pos;
  if (game.smpMode) {
    if (SMP_HOST_CMDS.has(cmd) || game.smp.me.pcmds.has(cmd) || (net.isHost && game.plugins.has(cmd))) { if (net.isHost) game.smp.run({ name: net.myName, me: true }, line); else net.send({ t: 'cmd', l: line }); return; }
    const adm = () => { if (game.smp.amAdmin()) return true; err('Ehhez a parancshoz admin jog kell.'); return false; };
    switch (cmd) {
      case 'shop': case 'bolt': return openShop();
      case 'sell': case 'elad': return smpSellCmd(a);
      case 'worth': case 'ertek': { const s = inv.slots[player.hot]; if (!s) return say('Nincs a kezedben tárgy.'); const p = sellPrice(s.id); return say(itemName(s.id) + ': ' + (p > 0 ? 'eladási ár ' + fmt(p) + ' / db' : 'a bolt nem veszi meg')); }
      case 'help': case '?': case 'segitseg': {
        say('Alap: /bal · /baltop · /pay <játékos> <összeg> · /daily · /kit · /shop (B) · /sell hand|all · /worth');
        say('Teleport: /tpa · /tpahere · /tpaccept · /tpdeny · /tpcancel · /home · /sethome · /delhome · /homes · /spawn · /warp · /warps · /back · /rtp');
        say('Chat/info: /msg · /r · /me · /list · /seen · /playtime · /rules · /pos · /plugins');
        if (game.smp.me.pcmds.has('/set')) say('WorldEdit (admin): //help');
        if (game.smp.amAdmin()) say('Admin: /bal give|take|set · /give · /gamemode · /tp · /kick · /ban · /unban · /mute · /unmute · /broadcast · /setwarp · /delwarp · /clear' + ' · /time · /gamerule · /difficulty · /setspawn' + (net.isHost || game.dedicated ? ' · /op · /deop · /protect' : ''));
        return;
      }
      case 'gamemode': case 'gm': {
        if (!adm()) return; const v = (a[0] || '').toLowerCase(), c = ['creative', 'c', '1', 'kreativ', 'kreatív'].includes(v), sv = ['survival', 's', '0', 'tulelo', 'túlélő'].includes(v);
        if (!c && !sv) return err('Használat: /gamemode survival | creative'); player.creative = c; if (!c) player.flying = false; updateBars(true); return say('Játékmód: ' + (c ? 'Kreatív' : 'Túlélő'));
      }
      case 'tp': case 'teleport': if (!adm()) return; break;
      case 'clear': if (!adm()) return; inv.slots.fill(null); player.armor = [null, null, null, null]; refreshHotbar(); return say('Inventár kiürítve.');
      case 'setspawn': case 'setspawnpoint': case 'sethome_': if (!net.isHost) return err('Ezt a parancsot csak a szerver tulajdonosa használhatja.'); break;
    }
  }
  switch (cmd) {
    case 'help': case '?': case 'segitseg':
      say('Parancsok: /tp <x y z | ~ ~ ~ | játékos | játékos here> · /spawn · /setspawn · /gamerule <szabály> <true/false> · /gamemode <survival/creative> · /time set <day/noon/night/midnight/szám> · /difficulty <peaceful/easy/normal/hard> · /give <item> [db] · /clear · /kill · /seed · /list · /pos'); break;
    case 'tp': case 'teleport': {
      if (!a.length) return err('Használat: /tp <x> <y> <z>  |  /tp <x> <z>  |  /tp <játékos>  |  /tp <játékos> here');
      if (a.length >= 2 && !isNaN(coord(a[0], pos[0])) && !isNaN(coord(a[1], pos[1]))) {
        let x, y, z;
        if (a.length === 2) { x = coord(a[0], pos[0]); z = coord(a[1], pos[2]); y = game.world.column(Math.floor(x), Math.floor(z)).h + 2; }
        else { x = coord(a[0], pos[0]); y = coord(a[1], pos[1]); z = coord(a[2], pos[2]); }
        if ([x, y, z].some(isNaN)) return err('Érvénytelen koordináta.');
        teleport(x, Math.max(1, y), z); return say(`Teleportálva: ${x.toFixed(1)} ${y.toFixed(1)} ${z.toFixed(1)}`);
      }
      if (!isMP) return err('Nincs ilyen játékos (egyjátékos módban koordinátákat adj meg).');
      const nm = a[0].toLowerCase(), t = net.names().find(n => n.name.toLowerCase() === nm) || net.names().find(n => n.name.toLowerCase().startsWith(nm));
      if (!t) return err('Nincs ilyen játékos: ' + a[0]);
      const rem = t.me ? null : net.remotes.get(t.id);
      if ((a[1] || '').toLowerCase() === 'here') {
        if (t.me) return err('Magadhoz nem teleportálhatod magad.');
        if (net.isHost) net.sendTo(t.cid, { t: 'tp', x: pos[0], y: pos[1], z: pos[2] }); else net.send({ t: 'tpreq', name: t.name, x: pos[0], y: pos[1], z: pos[2] });
        return say(t.name + ' hozzád teleportálva.');
      }
      if (t.me) return err('Magadhoz nem teleportálhatod magad.');
      teleport(rem.pos[0], rem.pos[1], rem.pos[2]); return say('Teleportálva ' + t.name + ' mellé.');
    }
    case 'spawn': case 'home': teleport(...game.spawn); return say('Visszateleportálva a respawn pontra.');
    case 'setspawn': case 'setspawnpoint': case 'sethome': game.spawn = [pos[0], pos[1], pos[2]]; if (game.smpMode && net.isHost) net.bcast({ t: 'spawn', p: game.spawn }); return say(`Respawn pont beállítva: ${pos[0].toFixed(1)} ${pos[1].toFixed(1)} ${pos[2].toFixed(1)}`);
    case 'pos': case 'coords': return say(`Pozíció: ${pos[0].toFixed(1)} ${pos[1].toFixed(1)} ${pos[2].toFixed(1)}`);
    case 'gamerule': {
      if (!a.length) return say('Szabályok: ' + Object.entries(game.rules).map(([k, v]) => k + '=' + v).join(', '));
      const key = RULE_NAMES[a[0].toLowerCase()]; if (!key) return err('Ismeretlen szabály. Elérhető: ' + Object.keys(game.rules).join(', '));
      if (a.length === 1) return say(key + ' = ' + game.rules[key] + ' (' + RULE_HU[key] + ')');
      if (hostOnly()) return; const v = parseBool(a[1]); if (v === null) return err('Az érték true vagy false legyen.');
      game.rules[key] = v; say(`Szabály beállítva: ${key} = ${v}`); if (net.isHost) net.bcast({ t: 'rules', r: game.rules }); return;
    }
    case 'gamemode': case 'gm': {
      if (hostOnly()) return; const v = (a[0] || '').toLowerCase(); const c = ['creative', 'c', '1', 'kreativ', 'kreatív'].includes(v), sv = ['survival', 's', '0', 'tulelo', 'túlélő'].includes(v);
      if (!c && !sv) return err('Használat: /gamemode survival | creative');
      player.creative = c; game.mode = c ? 'creative' : 'survival'; if (!c) player.flying = false; updateBars(true); return say('Játékmód: ' + (c ? 'Kreatív' : 'Túlélő'));
    }
    case 'difficulty': {
      if (hostOnly()) return; const m = { peaceful: 0, p: 0, beke: 0, béke: 0, easy: 1, e: 1, konnyu: 1, könnyű: 1, normal: 2, n: 2, normál: 2, hard: 3, h: 3, nehez: 3, nehéz: 3 }, v = m[(a[0] || '').toLowerCase()] ?? (/^[0-3]$/.test(a[0] || '') ? +a[0] : null);
      if (v === null) return err('Használat: /difficulty peaceful | easy | normal | hard'); game.difficulty = v; if (v === 0 && game.mobs) for (const mm of [...game.mobs.list]) if (mm.d.hostile) game.mobs.remove(mm);
      return say('Nehézség: ' + ['Béke', 'Könnyű', 'Normál', 'Nehéz'][v]);
    }
    case 'achievements': case 'adv': return say('Teljesítmények (' + (game.achv ? game.achv.size : 0) + '/' + Object.keys(ACH).length + '): ' + Object.entries(ACH).map(([k, v]) => (game.achv && game.achv.has(k) ? '✔ ' : '✘ ') + v).join(' | '));
    case 'time': {
      if (hostOnly()) return; const sub = (a[0] || '').toLowerCase(), v = (a[1] || '').toLowerCase();
      if (sub === 'query') return say('Idő: ' + Math.floor(game.dayTime));
      const named = { day: 1000, nappal: 1000, noon: 6000, delben: 6000, dél: 6000, night: 13000, ejszaka: 13000, éjszaka: 13000, midnight: 18000, ejfel: 18000, éjfél: 18000 };
      if (sub === 'set' && (v in named || /^\d+$/.test(v))) { game.dayTime = v in named ? named[v] : (+v) % 24000; return say('Idő beállítva: ' + Math.floor(game.dayTime)); }
      if (sub === 'add' && /^-?\d+$/.test(v)) { game.dayTime = ((game.dayTime + +v) % 24000 + 24000) % 24000; return say('Idő: ' + Math.floor(game.dayTime)); }
      return err('Használat: /time set <day|noon|night|midnight|szám>  |  /time add <szám>');
    }
    case 'give': {
      if (hostOnly()) return; if (!a.length) return err('Használat: /give <item> [darab]');
      let n = 1; if (a.length > 1 && /^\d+$/.test(a[a.length - 1])) n = Math.min(2304, +a.pop()); const id = findItem(a.join(' '));
      if (!id) return err('Nincs ilyen item: ' + a.join(' ')); let left = n; while (left > 0) { const k = Math.min(left, maxStack(id)); const r = inv.add(id, k); if (r > 0) { game.dropItem(id, r, pos[0], pos[1] + 1, pos[2]); } left -= k; }
      refreshHotbar(); return say(`Kaptál: ${n} × ${itemDef(id).name}`);
    }
    case 'clear': if (hostOnly()) return; inv.slots.fill(null); player.armor = [null, null, null, null]; refreshHotbar(); return say('Inventár kiürítve.');
    case 'kill': case 'suicide': if (player.dead) return; die('void'); return;
    case 'seed': return say('Seed: ' + game.seed);
    case 'list': return say(isMP ? 'Játékosok (' + net.count() + '): ' + net.names().map(n => n.name).join(', ') : 'Egyedül vagy a világban.');
    default: return err('Ismeretlen parancs: /' + cmd + ' – írd be: /help');
  }
}

Object.assign(game, { findItem, updateBars, runCommand, flushNear, igniteTNT, playerState, refreshHotbar, mpHost: doHost, mpJoin: doJoin, showFriends, openChat });

setGateway(settings.gateway);
// ---------------- MinePixelSS: dedikált szerver mód (rejtett ablak, játékos nélkül) ----------------
function ssConfig() {
  try { if (window.mp && window.mp.ssConf) { const c = window.mp.ssConf(); if (c) return c; } const q = new URLSearchParams(location.search).get('ssconf'); if (q) return JSON.parse(decodeURIComponent(escape(atob(q)))); } catch (e) { console.warn('ssconf', e); }
  return null;
}
const ssLogBuf = [], ssState = { state: 'starting', t: 0, err: '' };
game.ssLog = t => ssLog(t);
function ssLog(t) { ssLogBuf.push('[' + new Date().toLocaleTimeString('hu-HU') + '] ' + t); if (ssLogBuf.length > 400) ssLogBuf.splice(0, 100); ssState.dirty = true; }
function ssReport(force) {
  const players = [...net.remotes.values()].filter(r => r.cid).map(r => ({ name: r.name, admin: game.smpMode ? game.smp.isAdmin(r.name) : false, pos: r.pos ? r.pos.map(v => Math.round(v)) : null }));
  const msg = { state: ssState.state, err: ssState.err, players, fps, day: Math.floor(game.dayTime || 0), logs: ssLogBuf.splice(0) };
  if (window.mp && window.mp.ssReport) window.mp.ssReport(msg); window.__ssLast = msg;
}
function ssTick(dt) { ssState.t += dt; if (ssState.t > 2) { ssState.t = 0; ssReport(); } }
function dedicatedStream() {
  game.dsT = (game.dsT || 0) - 1; if (game.dsT > 0) return; game.dsT = 8;
  const w = game.world, anchors = [player.pos, ...[...net.remotes.values()].filter(r => r.pos).map(r => r.pos)], R = 5; let t0 = performance.now();
  for (const p of anchors) { const pcx = Math.floor(p[0] / 16), pcz = Math.floor(p[2] / 16);
    for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) { if (dx * dx + dz * dz > R * R + 1) continue; const k = ckey(pcx + dx, pcz + dz); if (!w.chunks.has(k) && performance.now() - t0 < 25) { const c = new Chunk(pcx + dx, pcz + dz); w.chunks.set(k, c); w.generateChunk(c); } } }
  for (const c of [...w.chunks.values()]) { let near = false; for (const p of anchors) if (Math.hypot(c.cx - Math.floor(p[0] / 16), c.cz - Math.floor(p[2] / 16)) <= R + 3) { near = true; break; } if (!near) releaseChunk(w, c); }
}
async function ssBoot(conf) {
  window.__dedicated = true; game.dedicated = true; game.ssConf = conf; settings.pname = conf.hostName || 'Konzol'; settings.rd = 3; net.token = 'ss-server-token-0000';
  const orig = game.chatAdd; game.chatAdd = (n, m, sys) => { orig(n, m, sys); ssLog(n ? n + ': ' + m : m); };
  const id = 'ss_' + conf.id; let save = await store.read(id); disposeWorld();
  const opts = { smp: !!conf.smp, ss: conf };
  if (save) { save.id = id; save.mode = 'survival'; await startWorld(save, opts); }
  else await startWorld(null, { id, name: conf.name, seed: conf.seed | 0, mode: 'survival', diff: conf.diff ?? 2, ...opts });
  player.creative = true; player.flying = true; ssLog('Világ betöltve: ' + conf.name);
}
async function ssHostStart(conf) {
  try {
    game.difficulty = conf.diff ?? game.difficulty; Object.assign(game.rules, conf.rules || {});
    if (game.smpMode) { game.smp.setAdminCode(conf.adminCode); game.smp.d.protect = conf.protect ?? 12; const names = game.plugins.loadAll(conf.plugins || [], { worldedit: conf.worldedit !== false }); ssLog('Pluginok: ' + (names.join(', ') || 'nincs')); }
    await net.startHosting({ name: conf.hostName || 'Konzol', worldName: conf.name, relay: conf.relay, room: conf.room, key: conf.key });
    ssState.state = 'online'; ssLog('A szerver elindult: ' + conf.address); ssReport();
  } catch (e) { ssState.state = 'error'; ssState.err = errTxt(e); ssLog('Indítási hiba: ' + ssState.err); ssReport(); }
}
game.ssCmd = line => { line = String(line || '').trim(); if (!line) return; if (line[0] !== '/') line = '/' + line; ssLog('> ' + line); runCommand(line); };
game.ssSay = text => net.sysChat('[Szerver] ' + text);
game.ssStop = async () => { ssState.state = 'stopping'; ssReport(); try { await saveGame(true); } catch (e) { console.warn(e); } try { net.leave(); } catch {} if (window.mp && window.mp.ssStopped) window.mp.ssStopped(); };
if (window.mp && window.mp.onSsStop) { window.mp.onSsStop(() => game.ssStop()); window.mp.onSsCmd(l => game.ssCmd(l)); window.mp.onSsSay && window.mp.onSsSay(t => game.ssSay(t)); }
bindMenus();
{ const conf = ssConfig(); if (conf) { window.__dedicated = true; game.dedicated = true; ssBoot(conf); } else startMenuWorld(); }
raf(frame);
Object.assign(game, { startWorld, saveGame, breakBlock, useItem, respawn, toast, serializeWorld, keys, G, matSolid, streamChunks, updateTarget, openUI, closeUI, getTarget: () => target, getFps: () => fps, mouse: (l, r) => { mouseL = l; mouseR = r; }, ui, quitToTitle });
